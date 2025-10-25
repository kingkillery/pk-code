/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import {
  Config,
  createCodeAssistContentGenerator,
  AuthType,
  SubagentManager,
  SubagentExecutor,
  type Subagent,
  type SubagentExecutionOptions,
} from '@pk-code/core';

/**
 * Handle the 'use' command to execute a specific agent with a query
 */
export async function handleUseCommand(
  agentName: string,
  query: string,
  config?: Config,
  overrideOptions?: SubagentExecutionOptions,
): Promise<string | null> {
  try {
    let agent = agentName;
    let currentQuery = query;

    if (!currentQuery && agent.includes(':')) {
      const parsed = parseUseCommandSyntax(agent);
      if (parsed) {
        agent = parsed.agent;
        currentQuery = parsed.query;
      }
    }

    const isDryRun = (() => {
      const v = String(process.env.PK_DRY_RUN || '').toLowerCase();
      return v === '1' || v === 'true' || v === 'yes';
    })();

    if (isDryRun) {
      const lines = [
        `DRY-RUN for pk use` + (agent ? ` (agent: ${agent})` : ''),
        `- Query: ${currentQuery || '(none)'}`,
        `- No agents executed; this is a simulated response.`,
      ];
      const out = lines.join('\n');
      console.log('\n' + out + '\n');
      return out;
    }

    if (!config) {
      throw new Error('Config required for content generation');
    }

    const projectRoot = config.getProjectRoot?.() ?? process.cwd();
    const manager = new SubagentManager({ projectRoot, includeGlobal: true });
    const discovery = await manager.loadAll();

    if (discovery.errors.length > 0 && config.getDebugMode?.()) {
      console.debug(
        '[Subagents] Encountered errors while loading agents:',
        discovery.errors.map((e) => `${e.filePath}: ${e.message}`).join('; '),
      );
    }

    const normalizedAgentName = agent.trim();
    const requestedDefault =
      normalizedAgentName.length === 0 || normalizedAgentName === '@default';

    let targetSubagent: Subagent | undefined;

    if (!requestedDefault && normalizedAgentName.length > 0) {
      targetSubagent = manager.get(normalizedAgentName);

      if (!targetSubagent) {
        const matches = manager.find([normalizedAgentName]);
        if (matches.length === 1) {
          console.log(
            `Using similar agent "${matches[0].config.name}" instead of "${normalizedAgentName}"`,
          );
          targetSubagent = matches[0];
        } else if (matches.length > 1) {
          console.error(
            `Agent "${normalizedAgentName}" not found. Did you mean one of these?`,
          );
          matches.slice(0, 3).forEach((match) => {
            console.error(`  - ${match.config.name}: ${match.config.description}`);
          });
          return null;
        } else {
          console.log(
            `Agent "${normalizedAgentName}" not found. Falling back to default agent...`,
          );
        }
      }
    }

    if (!targetSubagent) {
      console.log('No specific agent requested. Using default agent...');

      const preferredNames = [
        config.getDefaultSubagentName(),
        'default',
      ].filter((name): name is string => Boolean(name));

      for (const preferredName of preferredNames) {
        const candidate = manager.get(preferredName);
        if (candidate) {
          targetSubagent = candidate;
          break;
        }
      }

      if (!targetSubagent) {
        const allAgents = manager.getAll();
        if (allAgents.length > 0) {
          targetSubagent = allAgents[0];
        }
      }
    }

    if (!targetSubagent) {
      console.error('No agents available. Please configure at least one agent.');
      return null;
    }

    const executor = new SubagentExecutor(async (_subagent: Subagent) => {
      const version = process.env.CLI_VERSION || process.version;
      const httpOptions = {
        headers: {
          'User-Agent': `PK-Code-CLI/${version} (${process.platform}; ${process.arch})`,
        },
      };

      const authType = config.getAuthType?.() ?? AuthType.LOGIN_WITH_GOOGLE;
      return await createCodeAssistContentGenerator(
        httpOptions,
        authType,
        config,
      );
    }, config);

    const preferredOptions = config.getSubagentExecutionOptions?.(
      targetSubagent.config.name,
    );

    const finalOptions = (() => {
      const runtime = overrideOptions && Object.keys(overrideOptions).length > 0
        ? { ...overrideOptions }
        : undefined;

      if (!preferredOptions && !runtime) {
        return undefined;
      }

      if (!preferredOptions) {
        return runtime;
      }

      return {
        ...preferredOptions,
        ...(runtime ?? {}),
      };
    })();

    console.log(
      `Executing subagent "${targetSubagent.config.name}": ${targetSubagent.config.description}`,
    );

    if (finalOptions?.attachments?.length) {
      const attachmentSummary = finalOptions.attachments
        .map((attachment) => {
          const described = attachment.description?.trim();
          if (described) {
            return described;
          }
          const filename = path.basename(attachment.path);
          return filename || attachment.path;
        })
        .join(', ');
      console.log(`Attachments included: ${attachmentSummary}`);
    }

    const result = await executor.execute(
      targetSubagent,
      currentQuery,
      finalOptions,
    );

    if (result.success) {
      console.log('\n' + result.response);
      return result.response;
    }

    console.error('Execution failed:', result.error ?? 'Unknown error');
    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error executing agent "${agentName}":`, errorMessage);
    return null;
  }
}

/**
 * Parse the special syntax "pk use <agent>: 'query'"
 * This function handles the case where the user provides the colon syntax
 */
export function parseUseCommandSyntax(
  input: string,
): { agent: string; query: string } | null {
  // Look for pattern: <agent>: "query" or <agent>: 'query' (allow trailing whitespace)
  const colonMatch = input.match(/^([^:]+):\s*["']([^"']+)["']\s*$/);
  if (colonMatch) {
    return {
      agent: colonMatch[1].trim(),
      query: colonMatch[2], // Content inside quotes, preserve as-is
    };
  }

  // Look for pattern: <agent>: query (without quotes)
  const colonMatchNoQuotes = input.match(/^([^:]+):\s*(.+)$/);
  if (colonMatchNoQuotes) {
    return {
      agent: colonMatchNoQuotes[1].trim(),
      query: colonMatchNoQuotes[2].trim(),
    };
  }

  return null;
}
