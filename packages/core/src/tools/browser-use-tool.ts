/**
 * @license
 * Copyright 2025 PK Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import { BaseTool, ToolResult } from './tools.js';
import { Config } from '../config/config.js';

interface BrowserUseParams {
  action: 'create_task' | 'get_status' | 'get_details' | 'pause' | 'resume' | 'stop';
  task?: string;
  taskId?: string;
  structuredOutputSchema?: string;
  pollInterval?: number;
  waitForCompletion?: boolean;
}

interface TaskStep {
  action: string;
  timestamp: string;
  details?: any;
}

interface TaskDetails {
  id: string;
  status: 'running' | 'finished' | 'failed' | 'stopped';
  steps: TaskStep[];
  output?: string;
  error?: string;
}

export class BrowserUseTool extends BaseTool<BrowserUseParams, ToolResult> {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.browser-use.com/api/v1';

  constructor(private readonly config: Config) {
    super(
      'browser_use',
      'Browser Use',
      `Automate browser interactions using the Browser Use API. This tool can:
- Create browser automation tasks
- Monitor task execution with real-time step streaming
- Get task status and details
- Control task execution (pause/resume/stop)
- Support structured JSON output

Examples:
- Create a task: {"action": "create_task", "task": "Go to google.com and search for AI news"}
- Get task status: {"action": "get_status", "taskId": "task-id"}
- Get task details with streaming: {"action": "get_details", "taskId": "task-id", "waitForCompletion": true}
- Pause a task: {"action": "pause", "taskId": "task-id"}
- Resume a task: {"action": "resume", "taskId": "task-id"}
- Stop a task: {"action": "stop", "taskId": "task-id"}

For structured output, include a JSON schema in structuredOutputSchema when creating a task.`,
      {
        type: Type.OBJECT,
        properties: {
          action: {
            type: Type.STRING,
            description: 'The action to perform',
            enum: ['create_task', 'get_status', 'get_details', 'pause', 'resume', 'stop'],
          },
          task: {
            type: Type.STRING,
            description: 'The task instructions (for create_task action)',
          },
          taskId: {
            type: Type.STRING,
            description: 'The task ID (for status/details/control actions)',
          },
          structuredOutputSchema: {
            type: Type.STRING,
            description: 'JSON schema for structured output (optional, for create_task)',
          },
          pollInterval: {
            type: Type.NUMBER,
            description: 'Polling interval in seconds (default: 2)',
          },
          waitForCompletion: {
            type: Type.BOOLEAN,
            description: 'Whether to wait for task completion and stream steps (default: false)',
          },
        },
        required: ['action'],
      },
      true, // isOutputMarkdown - render markdown in returnDisplay
      true, // canUpdateOutput - enable incremental streaming
    );

    // Get API key from environment or config
    this.apiKey = process.env.BROWSER_USE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('BROWSER_USE_API_KEY not set. Browser Use tool will not work.');
    }
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  // Generic fetch with timeout and retry/backoff
  private async fetchWithRetry(
    url: string,
    options: RequestInit & { timeoutMs?: number },
    signal?: AbortSignal,
    maxRetries: number = 3,
    initialDelayMs: number = 500,
  ): Promise<Response> {
    const timeoutMs = options.timeoutMs ?? 15000;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const attempt = async (attemptNo: number): Promise<Response> => {
      if (signal?.aborted) {
        throw new Error('Aborted');
      }

      const controller = new AbortController();
      let abortedByTimeout = false;
      const timeout = setTimeout(() => {
        abortedByTimeout = true;
        controller.abort();
      }, timeoutMs);
      if (signal) {
        if (signal.aborted) controller.abort();
        signal.addEventListener('abort', () => controller.abort(), { once: true });
      }
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        if (!res.ok) {
          // Map common statuses to friendly errors with truncation and hints
          const raw = await res.text().catch(() => '');
          const truncated = raw && raw.length > 2048 ? `${raw.slice(0, 2048)}... [truncated]` : raw;
          let friendly = `HTTP ${res.status} ${res.statusText}`;
          if (truncated) friendly += `: ${truncated}`;
          if (res.status === 401 || res.status === 403) {
            friendly += ' — authentication/permission error (check BROWSER_USE_API_KEY and account permissions).';
          } else if (res.status === 400 || res.status === 422) {
            friendly += ' — request invalid (verify parameters/structuredOutputSchema).';
          }
          // Respect Retry-After for 429
          if (res.status === 429 && attemptNo < maxRetries) {
            const retryAfter = res.headers.get('retry-after');
            let delayMs = 0;
            if (retryAfter) {
              const secs = parseInt(retryAfter, 10);
              if (!Number.isNaN(secs)) delayMs = secs * 1000;
              else {
                const d = new Date(retryAfter);
                if (!Number.isNaN(d.getTime())) {
                  delayMs = Math.max(0, d.getTime() - Date.now());
                }
              }
            }
            if (delayMs <= 0) {
              delayMs = initialDelayMs * Math.pow(2, attemptNo - 1);
            }
            await sleep(delayMs);
            return attempt(attemptNo + 1);
          }
          // Retry on 5xx
          if (res.status >= 500 && attemptNo < maxRetries) {
            throw new Error(`retryable:${friendly}`);
          }
          throw new Error(friendly);
        }
        return res;
      } catch (e: any) {
        const isAbort = e?.name === 'AbortError' || /abort/i.test(String(e?.message));
        const isNetwork = /fetch|network|ECONN|ENOTFOUND|EAI_AGAIN|TLS|Timeout/i.test(String(e?.message));
        // If externally aborted, do not retry
        if (isAbort && signal?.aborted && !abortedByTimeout) {
          throw e;
        }
        const isRetryable = isAbort || isNetwork || String(e?.message).startsWith('retryable:');
        if (isRetryable && attemptNo < maxRetries) {
          const delay = initialDelayMs * Math.pow(2, attemptNo - 1);
          await new Promise(r => setTimeout(r, delay));
          return attempt(attemptNo + 1);
        }
        throw e;
      } finally {
        clearTimeout(timeout);
      }
    };

    return attempt(1);
  }

  private async createTask(instructions: string, structuredOutputSchema?: string, signal?: AbortSignal): Promise<string> {
    const payload: any = { task: instructions };
    if (structuredOutputSchema) {
      payload.structured_output_json = structuredOutputSchema;
    }

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/run-task`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        timeoutMs: 20000,
      },
      signal,
    );

    const result = await response.json() as { id: string };
    return result.id;
  }

  private async getTaskStatus(taskId: string, signal?: AbortSignal): Promise<string> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/task/${taskId}/status`,
      { headers: this.getHeaders(), timeoutMs: 15000 },
      signal,
    );
    const data = await response.json() as any;
    if (typeof data === 'string') return data;
    if (data && typeof data.status === 'string') return data.status;
    return 'unknown';
  }

  private async getTaskDetails(taskId: string, signal?: AbortSignal): Promise<TaskDetails> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/task/${taskId}`,
      { headers: this.getHeaders(), timeoutMs: 20000 },
      signal,
    );

    return await response.json() as TaskDetails;
  }

  private async pauseTask(taskId: string, signal?: AbortSignal): Promise<void> {
    await this.fetchWithRetry(
      `${this.baseUrl}/pause-task?task_id=${taskId}`,
      { method: 'PUT', headers: this.getHeaders(), timeoutMs: 10000 },
      signal,
    );
  }

  private async resumeTask(taskId: string, signal?: AbortSignal): Promise<void> {
    await this.fetchWithRetry(
      `${this.baseUrl}/resume-task?task_id=${taskId}`,
      { method: 'PUT', headers: this.getHeaders(), timeoutMs: 10000 },
      signal,
    );
  }

  private async stopTask(taskId: string, signal?: AbortSignal): Promise<void> {
    await this.fetchWithRetry(
      `${this.baseUrl}/stop-task?task_id=${taskId}`,
      { method: 'PUT', headers: this.getHeaders(), timeoutMs: 10000 },
      signal,
    );
  }

  private async waitForCompletion(
    taskId: string,
    pollInterval: number = 2,
    signal?: AbortSignal,
    updateOutput?: (output: string) => void,
  ): Promise<TaskDetails> {
    const uniqueSteps = new Set<string>();
    let headerEmitted = false;

    while (!signal?.aborted) {
      const details = await this.getTaskDetails(taskId, signal);

      if (!headerEmitted) {
        const header = `Streaming steps for task ${taskId}…`;
        if (updateOutput) updateOutput(header);
        else if (this.config.getDebugMode()) console.log(`\n${header}`);
        headerEmitted = true;
      }
      
      // Stream new steps via updateOutput (preferred) and console (fallback)
      if (details.steps && details.steps.length > 0) {
        for (const step of details.steps) {
          const stepKey = JSON.stringify(step);
          if (!uniqueSteps.has(stepKey)) {
            uniqueSteps.add(stepKey);
            const line = `[${step.timestamp}] ${step.action}`;
            let detailsChunk = '';
            if (step.details) {
              const full = JSON.stringify(step.details, null, 2);
              const truncated = full.length > 2048 ? `${full.slice(0, 2048)}... [details truncated]` : full;
              detailsChunk = `\n  Details: ${truncated}`;
            }
            const chunk = `${line}${detailsChunk}`;
            if (updateOutput) updateOutput(`\n${chunk}`);
            else if (this.config.getDebugMode()) console.log(`\n${chunk}`);
          }
        }
      }

      if (details.status === 'finished' || details.status === 'failed' || details.status === 'stopped') {
        if (updateOutput) updateOutput(`\nStatus: ${details.status}`);
        return details;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval * 1000));
    }

    throw new Error('Task waiting was aborted');
  }

  async execute(
    params: BrowserUseParams,
    signal: AbortSignal,
    updateOutput?: (output: string) => void,
  ): Promise<ToolResult> {
    if (!this.apiKey) {
      return {
        llmContent: 'Error: BROWSER_USE_API_KEY is not configured',
        returnDisplay: '❌ Browser Use API key is not configured. Please set the BROWSER_USE_API_KEY environment variable.',
      };
    }

    try {
      switch (params.action) {
        case 'create_task': {
          if (!params.task) {
            throw new Error('Task instructions are required for create_task action');
          }

          const taskId = await this.createTask(params.task, params.structuredOutputSchema, signal);
          
          if (params.waitForCompletion) {
            if (updateOutput) updateOutput(`✅ Task created: ${taskId}`);
            else if (this.config.getDebugMode()) console.log(`✅ Task created with ID: ${taskId}`);
            if (updateOutput) updateOutput('\n⏳ Waiting for completion and streaming steps...');

            const details = await this.waitForCompletion(
              taskId,
              params.pollInterval || 2,
              signal,
              updateOutput,
            );

            const output = details.output || 'Task completed without output';
            const statusEmoji = details.status === 'finished' ? '✅' : '❌';
            
            return {
              llmContent: `Task ${taskId} ${details.status}. Output: ${output}`,
              returnDisplay: `${statusEmoji} Task ${taskId} ${details.status}\n\n**Steps:**\n${details.steps.map(s => `- [${s.timestamp}] ${s.action}`).join('\n')}\n\n**Output:**\n${output}`,
            };
          } else {
            return {
              llmContent: `Task created successfully with ID: ${taskId}`,
              returnDisplay: `✅ Task created successfully!\n**Task ID:** ${taskId}\n\nUse \`get_status\` or \`get_details\` with this ID to monitor progress.`,
            };
          }
        }

        case 'get_status': {
          if (!params.taskId) {
            throw new Error('Task ID is required for get_status action');
          }

          const status = await this.getTaskStatus(params.taskId, signal);
          return {
            llmContent: `Task ${params.taskId} status: ${status}`,
            returnDisplay: `📊 Task ${params.taskId} status: **${status}**`,
          };
        }

        case 'get_details': {
          if (!params.taskId) {
            throw new Error('Task ID is required for get_details action');
          }

          if (params.waitForCompletion) {
            if (updateOutput) updateOutput('⏳ Streaming task steps...');
            else if (this.config.getDebugMode()) console.log('⏳ Streaming task steps...');
            const details = await this.waitForCompletion(
              params.taskId,
              params.pollInterval || 2,
              signal,
              updateOutput,
            );

            const output = details.output || 'No output available';
            const statusEmoji = details.status === 'finished' ? '✅' : '❌';
            
            return {
              llmContent: `Task ${params.taskId} ${details.status}. Steps: ${details.steps.length}. Output: ${output}`,
              returnDisplay: `${statusEmoji} Task ${params.taskId} ${details.status}\n\n**Steps:** ${details.steps.length}\n${details.steps.map(s => `- [${s.timestamp}] ${s.action}`).join('\n')}\n\n**Output:**\n${output}`,
            };
          } else {
            const details = await this.getTaskDetails(params.taskId, signal);
            const output = details.output || 'No output yet';
            
            return {
              llmContent: `Task ${params.taskId} status: ${details.status}. Steps: ${details.steps.length}. Output: ${output}`,
              returnDisplay: `📊 Task ${params.taskId}\n**Status:** ${details.status}\n**Steps:** ${details.steps.length}\n\n**Recent Steps:**\n${details.steps.slice(-5).map(s => `- [${s.timestamp}] ${s.action}`).join('\n')}\n\n**Output:**\n${output}`,
            };
          }
        }

        case 'pause': {
          if (!params.taskId) {
            throw new Error('Task ID is required for pause action');
          }

          await this.pauseTask(params.taskId, signal);
          return {
            llmContent: `Task ${params.taskId} has been paused`,
            returnDisplay: `⏸️ Task ${params.taskId} has been paused successfully.`,
          };
        }

        case 'resume': {
          if (!params.taskId) {
            throw new Error('Task ID is required for resume action');
          }

          await this.resumeTask(params.taskId, signal);
          return {
            llmContent: `Task ${params.taskId} has been resumed`,
            returnDisplay: `▶️ Task ${params.taskId} has been resumed successfully.`,
          };
        }

        case 'stop': {
          if (!params.taskId) {
            throw new Error('Task ID is required for stop action');
          }

          await this.stopTask(params.taskId, signal);
          return {
            llmContent: `Task ${params.taskId} has been stopped`,
            returnDisplay: `⏹️ Task ${params.taskId} has been stopped successfully.`,
          };
        }

        default:
          throw new Error(`Unknown action: ${params.action}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Browser Use API error: ${errorMessage}`,
        returnDisplay: `❌ Browser Use API Error:\n${errorMessage}`,
      };
    }
  }

  async shouldConfirmExecute(params: BrowserUseParams): Promise<any> {
    // Only require confirmation for task creation with potentially sensitive operations
    if (params.action === 'create_task' && params.task) {
      const sensitiveKeywords = ['password', 'delete', 'remove', 'payment', 'purchase', 'buy'];
      const taskLower = params.task.toLowerCase();
      
      if (sensitiveKeywords.some(keyword => taskLower.includes(keyword))) {
        return {
          title: 'Browser Automation Task',
          description: `This will create a browser automation task with the following instructions:\n\n"${params.task}"\n\nThis task may involve sensitive operations.`,
          onConfirm: async () => {},
        };
      }
    }
    
    return null;
  }
}
