/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GenerateContentResponse } from '@google/genai';
import { getResponseText, getFunctionCalls } from '../utils/generateContentResponseUtilities.js';
import type { ParsedAgent } from './types.js';

/**
 * ReAct framework response format
 */
export interface ReActResponse {
  /** The agent's reasoning about the task */
  thought: string;
  /** The action to be taken */
  action: ReActAction;
  /** Raw response for fallback */
  raw?: string;
}

/**
 * ReAct action types
 */
export type ReActAction = 
  | { type: 'tool'; name: string; parameters: Record<string, unknown> }
  | { type: 'response'; content: string }
  | { type: 'clarification'; question: string }
  | { type: 'error'; message: string };

/**
 * ReAct cycle state for tracking conversation history
 */
export interface ReActCycle {
  /** Unique identifier for this cycle */
  id: string;
  /** The original query or task */
  query: string;
  /** The agent's thought process */
  thought: string;
  /** The action taken */
  action: ReActAction;
  /** The observation/result from the action */
  observation?: string;
  /** Timestamp of the cycle */
  timestamp: Date;
  /** Duration in milliseconds */
  duration?: number;
}

/**
 * ReAct prompt template configuration
 */
export interface ReActPromptConfig {
  /** Whether to enforce strict JSON output */
  strictJson: boolean;
  /** Examples to include in the prompt */
  includeExamples: boolean;
  /** Maximum thought length */
  maxThoughtLength?: number;
  /** Custom instructions */
  customInstructions?: string;
}

/**
 * Default ReAct prompt template
 */
export const REACT_SYSTEM_PROMPT = `You are an AI assistant that follows the ReAct (Reasoning and Acting) framework. For every request, you must:

1. THINK: Analyze the query and reason about what needs to be done
2. ACT: Decide on an action (use a tool, provide a response, ask for clarification, or report an error)

You MUST respond in the following JSON format:
{
  "thought": "Your detailed reasoning about the task and what you need to do",
  "action": {
    "type": "tool|response|clarification|error",
    "name": "tool name (only for tool type)",
    "parameters": {}, // tool parameters (only for tool type)
    "content": "response content (only for response type)",
    "question": "clarification question (only for clarification type)",
    "message": "error message (only for error type)"
  }
}

Important rules:
- Always include both "thought" and "action" fields
- Be specific and detailed in your reasoning
- Choose the most appropriate action type
- For tools, use exact tool names and valid parameters
- Keep your response in valid JSON format`;

/**
 * ReAct framework implementation
 */
export class ReActFramework {
  constructor(
    private readonly config: ReActPromptConfig = {
      strictJson: true,
      includeExamples: true,
    }
  ) {}

  /**
   * Enhance a prompt with ReAct instructions
   */
  enhancePrompt(
    originalPrompt: string,
    agent: ParsedAgent,
    availableTools?: string[]
  ): string {
    const parts: string[] = [];

    // Add base ReAct instructions
    parts.push(REACT_SYSTEM_PROMPT);

    // Add custom instructions if provided
    if (this.config.customInstructions) {
      parts.push(`\nAdditional Instructions:\n${this.config.customInstructions}`);
    }

    // Add available tools information
    if (availableTools && availableTools.length > 0) {
      parts.push(`\nAvailable Tools:\n${availableTools.map(t => `- ${t}`).join('\n')}`);
    }

    // Add examples if configured
    if (this.config.includeExamples) {
      parts.push(`\nExamples:`);
      parts.push(this.getExamplePrompts());
    }

    // Add the original query
    parts.push(`\nUser Query: ${originalPrompt}`);

    return parts.join('\n\n');
  }

  /**
   * Parse a response into ReAct format
   */
  parseResponse(response: GenerateContentResponse): ReActResponse {
    // 1) Prefer structured tool/function calls (e.g., GPT-* function/tool calls mapped to functionCall parts)
    const functionCalls = getFunctionCalls(response);
    if (functionCalls && functionCalls.length > 0) {
      const firstCall = functionCalls[0];
      const thoughtText =
        getResponseText(response) || `Selecting tool: ${firstCall.name}`;
      return {
        thought: thoughtText.trim(),
        action: {
          type: 'tool',
          name: String(firstCall.name),
          parameters: (firstCall.args as Record<string, unknown>) || {},
        },
        raw: JSON.stringify(functionCalls[0]),
      };
    }

    // 2) Otherwise, attempt to parse JSON from the textual response (common for Qwen-Code JSON output)
    const text = this.extractResponseText(response);
    
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(text);
      
      // Validate required fields
      if (!parsed.thought || !parsed.action) {
        throw new Error('Missing required fields: thought and action');
      }

      // Validate action structure
      const action = this.validateAction(parsed.action);
      
      return {
        thought: String(parsed.thought).trim(),
        action,
        raw: text,
      };
    } catch (_error) {
      // 3) Fallback: try to extract structured content from non-JSON response
      return this.extractFromUnstructuredResponse(text);
    }
  }

  /**
   * Validate and normalize action object
   */
  private validateAction(action: unknown): ReActAction {
    if (typeof action !== 'object' || action === null || !('type' in action)) {
      throw new Error('Action must have a type');
    }

    const a = action as Record<string, unknown>;

    switch (a.type) {
      case 'tool':
        if (!a.name) {
          throw new Error('Tool action must have a name');
        }
        return {
          type: 'tool',
          name: String(a.name),
          parameters: (a.parameters as Record<string, unknown>) || {},
        };
      
      case 'response':
        if (!a.content) {
          throw new Error('Response action must have content');
        }
        return {
          type: 'response',
          content: String(a.content),
        };
      
      case 'clarification':
        if (!a.question) {
          throw new Error('Clarification action must have a question');
        }
        return {
          type: 'clarification',
          question: String(a.question),
        };
      
      case 'error':
        if (!a.message) {
          throw new Error('Error action must have a message');
        }
        return {
          type: 'error',
          message: String(a.message),
        };
      
      default:
        throw new Error(`Unknown action type: ${String(a.type)}`);
    }
  }

  /**
   * Extract structured content from unstructured response
   */
  private extractFromUnstructuredResponse(text: string): ReActResponse {
    // Look for thought patterns
    const thoughtMatch = text.match(/(?:thought|thinking|reasoning):\s*(.+?)(?:\n|$)/i);
    const thought = thoughtMatch ? thoughtMatch[1].trim() : 'Processing request...';

    // Look for action patterns
    
    // Try to detect tool calls
    const toolMatch = text.match(/(?:calling|using|executing)\s+tool:\s*(\w+)/i);
    if (toolMatch) {
      return {
        thought,
        action: {
          type: 'tool',
          name: toolMatch[1],
          parameters: {},
        },
        raw: text,
      };
    }

    // Try to detect questions
    if (text.includes('?') && text.match(/(?:clarify|confirm|please|could you)/i)) {
      const questionMatch = text.match(/([^.!]+\?)/);
      if (questionMatch) {
        return {
          thought,
          action: {
            type: 'clarification',
            question: questionMatch[1].trim(),
          },
          raw: text,
        };
      }
    }

    // Default to response
    return {
      thought,
      action: {
        type: 'response',
        content: text,
      },
      raw: text,
    };
  }

  /**
   * Extract text from response
   */
  private extractResponseText(response: GenerateContentResponse): string {
    return (
      response.candidates?.[0]?.content?.parts?.[0]?.text ||
      'No response content'
    );
  }

  /**
   * Get example prompts for few-shot learning
   */
  private getExamplePrompts(): string {
    return `
Example 1:
User: List all files in the current directory
Response:
{
  "thought": "The user wants to see all files in the current directory. I need to use the file system tool to list directory contents.",
  "action": {
    "type": "tool",
    "name": "list_directory",
    "parameters": {
      "path": "."
    }
  }
}

Example 2:
User: What is the capital of France?
Response:
{
  "thought": "This is a straightforward factual question about geography. I can answer this directly without needing any tools.",
  "action": {
    "type": "response",
    "content": "The capital of France is Paris."
  }
}

Example 3:
User: Fix the bug in my code
Response:
{
  "thought": "The user is asking me to fix a bug, but they haven't provided any code or specified which file contains the bug. I need more information to help them.",
  "action": {
    "type": "clarification",
    "question": "Could you please specify which file contains the bug, or share the code you'd like me to review?"
  }
}`;
  }

  /**
   * Create a re-prompt message for invalid responses
   */
  createReprompt(error: string, originalResponse: string): string {
    return `Your previous response was not in the correct format. 

Error: ${error}

Your response was:
${originalResponse}

Please provide a valid response following the ReAct format:
{
  "thought": "Your reasoning here",
  "action": {
    "type": "tool|response|clarification|error",
    // ... appropriate fields for the action type
  }
}`;
  }

  /**
   * Create a ReAct cycle from components
   */
  createCycle(
    query: string,
    thought: string,
    action: ReActAction,
    observation?: string
  ): ReActCycle {
    return {
      id: `cycle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      query,
      thought,
      action,
      observation,
      timestamp: new Date(),
    };
  }
}

/**
 * Factory function to create ReAct framework
 */
export function createReActFramework(
  config?: Partial<ReActPromptConfig>
): ReActFramework {
  return new ReActFramework({
    strictJson: true,
    includeExamples: true,
    ...config,
  });
}
