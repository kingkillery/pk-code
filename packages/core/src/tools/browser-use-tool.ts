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
  private seenSteps: Map<string, Set<string>> = new Map();

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
      false, // isOutputMarkdown
      false, // canUpdateOutput
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

  private async createTask(instructions: string, structuredOutputSchema?: string): Promise<string> {
    const payload: any = { task: instructions };
    if (structuredOutputSchema) {
      payload.structured_output_json = structuredOutputSchema;
    }

    const response = await fetch(`${this.baseUrl}/run-task`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create task: ${error}`);
    }

    const result = await response.json() as { id: string };
    return result.id;
  }

  private async getTaskStatus(taskId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/task/${taskId}/status`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get task status: ${error}`);
    }

    return await response.json() as string;
  }

  private async getTaskDetails(taskId: string): Promise<TaskDetails> {
    const response = await fetch(`${this.baseUrl}/task/${taskId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get task details: ${error}`);
    }

    return await response.json() as TaskDetails;
  }

  private async pauseTask(taskId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/pause-task?task_id=${taskId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to pause task: ${error}`);
    }
  }

  private async resumeTask(taskId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/resume-task?task_id=${taskId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to resume task: ${error}`);
    }
  }

  private async stopTask(taskId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/stop-task?task_id=${taskId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to stop task: ${error}`);
    }
  }

  private async waitForCompletion(
    taskId: string,
    pollInterval: number = 2,
    signal?: AbortSignal
  ): Promise<TaskDetails> {
    const uniqueSteps = new Set<string>();

    while (!signal?.aborted) {
      const details = await this.getTaskDetails(taskId);
      
      // Stream new steps
      if (details.steps && details.steps.length > 0) {
        for (const step of details.steps) {
          const stepKey = JSON.stringify(step);
          if (!uniqueSteps.has(stepKey)) {
            uniqueSteps.add(stepKey);
            const stepOutput = `\n[${step.timestamp}] ${step.action}`;
            // Print step to console for real-time feedback
            console.log(stepOutput);
            if (step.details) {
              const detailsStr = JSON.stringify(step.details, null, 2);
              console.log(`  Details: ${detailsStr}`);
            }
          }
        }
      }

      if (details.status === 'finished' || details.status === 'failed' || details.status === 'stopped') {
        return details;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval * 1000));
    }

    throw new Error('Task waiting was aborted');
  }

  async execute(params: BrowserUseParams, signal?: AbortSignal): Promise<ToolResult> {
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

          const taskId = await this.createTask(params.task, params.structuredOutputSchema);
          
          if (params.waitForCompletion) {
            console.log(`✅ Task created with ID: ${taskId}`);
            console.log('⏳ Waiting for completion and streaming steps...');
            
            const details = await this.waitForCompletion(
              taskId,
              params.pollInterval || 2,
              signal
            );

            const output = details.output || 'Task completed without output';
            const status = details.status === 'finished' ? '✅' : '❌';
            
            return {
              llmContent: `Task ${taskId} ${details.status}. Output: ${output}`,
              returnDisplay: `${status} Task ${taskId} ${details.status}\n\n**Steps:**\n${details.steps.map(s => `- [${s.timestamp}] ${s.action}`).join('\n')}\n\n**Output:**\n${output}`,
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

          const status = await this.getTaskStatus(params.taskId);
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
            console.log('⏳ Streaming task steps...');
            const details = await this.waitForCompletion(
              params.taskId,
              params.pollInterval || 2,
              signal
            );

            const output = details.output || 'No output available';
            const status = details.status === 'finished' ? '✅' : '❌';
            
            return {
              llmContent: `Task ${params.taskId} ${details.status}. Steps: ${details.steps.length}. Output: ${output}`,
              returnDisplay: `${status} Task ${params.taskId} ${details.status}\n\n**Steps:** ${details.steps.length}\n${details.steps.map(s => `- [${s.timestamp}] ${s.action}`).join('\n')}\n\n**Output:**\n${output}`,
            };
          } else {
            const details = await this.getTaskDetails(params.taskId);
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

          await this.pauseTask(params.taskId);
          return {
            llmContent: `Task ${params.taskId} has been paused`,
            returnDisplay: `⏸️ Task ${params.taskId} has been paused successfully.`,
          };
        }

        case 'resume': {
          if (!params.taskId) {
            throw new Error('Task ID is required for resume action');
          }

          await this.resumeTask(params.taskId);
          return {
            llmContent: `Task ${params.taskId} has been resumed`,
            returnDisplay: `▶️ Task ${params.taskId} has been resumed successfully.`,
          };
        }

        case 'stop': {
          if (!params.taskId) {
            throw new Error('Task ID is required for stop action');
          }

          await this.stopTask(params.taskId);
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
