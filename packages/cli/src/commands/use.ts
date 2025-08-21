/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  getGlobalAgentRegistry,
  initializeGlobalAgentRegistry,
  type ParsedAgent,
  Config,
  createCodeAssistContentGenerator,
  AuthType,
} from '@pk-code/core';

import { 
  createAgentOrchestrator,
  OrchestrationMode
} from '@pk-code/core';

/**
 * Handle the 'use' command to execute a specific agent with a query
 */
export async function handleUseCommand(
  agentName: string,
  query: string,
  config?: Config,
): Promise<string | null> {
  try {
    // Optional dry-run: short-circuit and simulate a response without providers/registry.
    const isDryRun = (() => {
      const v = String(process.env.PK_DRY_RUN || '').toLowerCase();
      return v === '1' || v === 'true' || v === 'yes';
    })();
    if (isDryRun) {
      let dryAgent = agentName;
      let dryQuery = query;
      if (!dryQuery && dryAgent.includes(':')) {
        const parts = dryAgent.split(':');
        dryAgent = parts[0].trim();
        dryQuery = parts.slice(1).join(':').trim();
      }
      const lines = [
        `DRY-RUN for pk use` + (dryAgent ? ` (agent: ${dryAgent})` : ''),
        `- Query: ${dryQuery || '(none)'}`,
        `- No agents executed; this is a simulated response.`,
      ];
      const out = lines.join('\n');
      console.log('\n' + out + '\n');
      return out;
    }

    // Initialize the global agent registry if not already done
    const projectRoot = process.cwd();
    let registry;

    try {
      registry = getGlobalAgentRegistry();
    } catch {
      // Registry not initialized, initialize it
      await initializeGlobalAgentRegistry(projectRoot, {
        includeGlobal: true,
        validateSchema: true,
      });
      registry = getGlobalAgentRegistry();
    }

    // Check if this is an explicit agent invocation (agentName: query)
    if (agentName.includes(':')) {
      const parts = agentName.split(':');
      const actualAgentName = parts[0].trim();
      const actualQuery = parts.slice(1).join(':').trim();
      
      // Find the agent by name
      const agent = registry.getAgent(actualAgentName);
      if (!agent) {
        console.error(`Agent "${actualAgentName}" not found.`);
        return null;
      }
      
      return await executeAgent(agent, actualQuery, config);
    }

    // Check if we're explicitly requesting a specific agent
    const agent = registry.getAgent(agentName);
    if (agent) {
      return await executeAgent(agent, query, config);
    }

    // Try searching for agents with similar names
    const searchResults = registry.searchAgents(agentName);
    if (searchResults.length === 1) {
      console.log(
        `Using similar agent "${searchResults[0].config.name}" instead of "${agentName}"`,
      );
      return await executeAgent(searchResults[0], query, config);
    } else if (searchResults.length > 1) {
      console.error(
        `Agent "${agentName}" not found. Did you mean one of these?`,
      );
      searchResults.slice(0, 3).forEach((a) => {
        console.error(`  - ${a.config.name}: ${a.config.description}`);
      });
      return null;
    }

    // If no specific agent found, use automatic delegation based on query analysis
    console.log('No specific agent requested. Using automatic delegation...');
    
    // Create orchestrator for automatic agent selection
    const orchestrator = createAgentOrchestrator(
      registry,
      async (_agent) => {
        // Create content generator using the existing system
        const version = process.env.CLI_VERSION || process.version;
        const httpOptions = {
          headers: {
            'User-Agent': `PK-Code-CLI/${version} (${process.platform}; ${process.arch})`,
          },
        };

        if (!config) {
          throw new Error('Config required for content generation');
        }
        return await createCodeAssistContentGenerator(
          httpOptions,
          AuthType.LOGIN_WITH_GOOGLE,
          config,
        );
      }
    );

    // Process query with automatic orchestration
    const result = await orchestrator.processQuery(query, {
      mode: OrchestrationMode.AUTO,
    });

    // Display the result
    console.log('\n' + result.response.text);
    return result.response.text;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error executing agent "${agentName}":`, errorMessage);
    return null;
  }
}

/**
 * Execute a specific agent with the given query
 */
async function executeAgent(
  agent: ParsedAgent,
  query: string,
  config?: Config,
): Promise<string | null> {
  try {
    console.log(
      `Executing agent "${agent.config.name}": ${agent.config.description}`,
    );

    if (!config) {
      throw new Error('Config required for content generation');
    }

    // Create content generator using the existing system
    const version = process.env.CLI_VERSION || process.version;
    const httpOptions = {
      headers: {
        'User-Agent': `PK-Code-CLI/${version} (${process.platform}; ${process.arch})`,
      },
    };

    const contentGenerator = await createCodeAssistContentGenerator(
      httpOptions,
      AuthType.LOGIN_WITH_GOOGLE,
      config,
    );

    // Build the system prompt with agent context
    const systemPrompt =
      agent.config.systemPrompt ||
      `You are ${agent.config.name}: ${agent.config.description}`;

    // Prepare the request with agent-specific parameters
    const request = {
      model: 'gemini-pro',
      contents: [
        {
          role: 'user' as const,
          parts: [{ text: `${systemPrompt}\n\nUser Query: ${query}` }],
        },
      ],
      generationConfig: {
        temperature: agent.config.temperature || 0.7,
        maxOutputTokens: agent.config.maxTokens || 2048,
      },
    };

    // Execute the content generation
    const response = await contentGenerator.generateContent(request);

    // Extract and display the response
    const responseText =
      response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (responseText) {
      console.log('\n' + responseText);
      return responseText;
    } else {
      console.error('No response content received from agent');
      return null;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error during agent execution:`, errorMessage);
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
