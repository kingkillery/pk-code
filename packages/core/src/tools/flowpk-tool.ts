/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import { BaseTool, ToolResult } from './tools.js';
import { Config } from '../config/config.js';
import { BrowserUseTool } from './browser-use-tool.js';

type FlowAction = 'create_and_run' | 'run_from_dsl';

export interface FlowPkParams {
  action: FlowAction;
  name?: string;
  oneLiner?: string;
  dsl?: string;
  pollInterval?: number;
  waitForCompletion?: boolean;
}

/**
 * Minimal MVP of a flow tool that accepts a tiny DSL or a one-liner,
 * compiles to plain-language browser instructions, and executes via BrowserUseTool.
 *
 * Notes:
 * - Logic blocks (IF/WHILE/ELSE) are rendered to imperative text for the Browser Use API to interpret.
 * - This MVP does not fully evaluate conditions locally; it delegates control flow to the browser agent.
 * - Streaming is supported by relaying updateOutput into BrowserUseTool.waitForCompletion().
 */
export class FlowPkTool extends BaseTool<FlowPkParams, ToolResult> {
  private readonly browserTool: BrowserUseTool;

  constructor(private readonly config: Config) {
    super(
      'flowpk',
      'FlowPK',
      'Create and run simple browser automation flows using a compact DSL or a one-liner. Generates readable steps and streams progress.',
      {
        type: Type.OBJECT,
        properties: {
          action: {
            type: Type.STRING,
            description: 'What to do',
            enum: ['create_and_run', 'run_from_dsl'],
          },
          name: { type: Type.STRING, description: 'Optional workflow name' },
          oneLiner: {
            type: Type.STRING,
            description: 'A short instruction to turn into a flow',
          },
          dsl: {
            type: Type.STRING,
            description: 'Flow DSL script to execute directly',
          },
          pollInterval: {
            type: Type.NUMBER,
            description: 'Polling interval in seconds (default: 2)',
          },
          waitForCompletion: {
            type: Type.BOOLEAN,
            description: 'Whether to wait for completion and stream steps',
          },
        },
        required: ['action'],
      },
      true, // isOutputMarkdown
      true, // canUpdateOutput
    );
    this.browserTool = new BrowserUseTool(config);
  }

  private normalizeOneLinerToDsl(text: string): string {
    // Basic heuristic: start with a NOTE and leave steps implicit.
    // Users can later refine to explicit NAVIGATE/CLICK/TYPE/etc.
    return [
      `# Auto-generated from one-liner`,
      `NOTE "${text.replace(/\\"/g, '"')}"`,
      `# Add explicit steps as needed (NAVIGATE, WAIT_FOR, CLICK, TYPE, EXTRACT, IF/WHILE, etc.)`,
    ].join('\n');
  }

  private compileDslToPlainInstructions(dsl: string): string {
    // Very lightweight line-based renderer from DSL to imperative English.
    // Intentionally conservative; lets Browser Use agent interpret control flow.
    const lines = dsl
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));

    const out: string[] = [];
    const stack: string[] = [];

    const push = (s: string) => out.push(s);

    for (const line of lines) {
      const upper = line.toUpperCase();
      if (upper.startsWith('SET ')) {
        push(`Set variable: ${line.slice(4)}`);
      } else if (upper.startsWith('NAVIGATE ')) {
        const arg = line.slice('NAVIGATE'.length).trim();
        push(`Navigate to ${arg.replace(/^['"]|['"]$/g, '')}.`);
      } else if (upper.startsWith('CLICK ')) {
        const sel = line.slice('CLICK'.length).trim();
        push(`Click element matching ${sel}.`);
      } else if (upper.startsWith('TYPE ')) {
        // TYPE "text" INTO <selector>
        const m = line.match(/^TYPE\s+(.+?)\s+INTO\s+(.+)$/i);
        if (m) {
          push(`Type ${m[1]} into ${m[2]}.`);
        } else {
          push(`Type input: ${line.slice(4).trim()}.`);
        }
      } else if (upper.startsWith('WAIT_FOR ')) {
        const rest = line.slice('WAIT_FOR'.length).trim();
        push(`Wait until ${rest}.`);
      } else if (upper.startsWith('EXTRACT ')) {
        push(`Extract data: ${line.slice('EXTRACT'.length).trim()}.`);
      } else if (upper.startsWith('NOTE ')) {
        push(`Note: ${line.slice('NOTE'.length).trim()}`);
      } else if (upper.startsWith('RESULT ')) {
        push(`Record result: ${line.slice('RESULT'.length).trim()}.`);
      } else if (upper.startsWith('LOGIN ')) {
        push(`Perform login: ${line.slice('LOGIN'.length).trim()}.`);
      } else if (upper.startsWith('IF ')) {
        push(`If (${line.slice(3).trim()}):`);
        stack.push('IF');
      } else if (upper.startsWith('ELIF ')) {
        push(`Else if (${line.slice(5).trim()}):`);
      } else if (upper === 'ELSE') {
        push('Else:');
      } else if (upper.startsWith('WHILE ')) {
        push(`While (${line.slice(6).trim()}):`);
        stack.push('WHILE');
      } else if (upper.startsWith('FOR_EACH ')) {
        push(`For each ${line.slice(8).trim()}:`);
        stack.push('FOR');
      } else if (upper === 'END') {
        const ctx = stack.pop();
        if (ctx) push(`End ${ctx}.`);
        else push('End.');
      } else {
        // Fallback: keep the line as an instruction
        push(line);
      }
    }
    return out.join('\n');
  }

  async execute(
    params: FlowPkParams,
    signal: AbortSignal,
    updateOutput?: (output: string) => void,
  ): Promise<ToolResult> {
    const wait = params.waitForCompletion ?? true;
    const poll = params.pollInterval ?? 2;

    try {
      let dsl = params.dsl;
      if (!dsl && params.oneLiner) {
        dsl = this.normalizeOneLinerToDsl(params.oneLiner);
      }
      if (!dsl) {
        throw new Error('Provide either oneLiner or dsl.');
      }

      const plain = this.compileDslToPlainInstructions(dsl);
      const taskText = `Follow these steps deterministically. Reuse session cookies. Obey waits and idempotent checks.\n\n${plain}`;

      // Delegate execution to BrowserUseTool
      const result = await this.browserTool.execute(
        {
          action: 'create_task',
          task: taskText,
          waitForCompletion: wait,
          pollInterval: poll,
        },
        signal,
        updateOutput,
      );

      const displayName = params.name ? `\n**Workflow:** ${params.name}` : '';
      return {
        llmContent: `Flow executed. DSL:\n${dsl}\n\nTask:\n${taskText}\n\n${typeof result.llmContent === 'string' ? result.llmContent : ''}`,
        returnDisplay: `✅ Flow executed${displayName}.\n\n**Normalized DSL**\n\n\`\`\`\n${dsl}\n\`\`\`\n\n**Compiled Task**\n\n\`\`\`\n${plain}\n\`\`\`\n\n${result.returnDisplay}`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        llmContent: `FlowPK error: ${msg}`,
        returnDisplay: `❌ FlowPK Error:\n${msg}`,
      };
    }
  }
}

