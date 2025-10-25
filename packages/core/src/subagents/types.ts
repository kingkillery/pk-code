/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simplified subagent system types
 * 
 * This module defines the core types for the simplified subagent architecture,
 * replacing the complex multi-agent orchestration system.
 */

/**
 * Tool definition for a subagent
 */
export interface SubagentTool {
  /** Tool name/identifier */
  name: string;
  /** Optional tool description */
  description?: string;
}

/**
 * Example interaction for demonstrating subagent usage
 */
export interface SubagentExample {
  /** User input for the example */
  input: string;
  /** Expected subagent response or behavior */
  output: string;
  /** Optional description of what this example demonstrates */
  description?: string;
}

/**
 * Simplified subagent configuration
 */
export interface SubagentConfig {
  /** Unique subagent name/identifier */
  name: string;
  /** Human-readable description of the subagent's purpose */
  description: string;
  /** Keywords for subagent discovery */
  keywords: string[];
  /** List of tools this subagent can use */
  tools: SubagentTool[];
  /** AI model to use */
  model: string;
  /** AI provider for the model */
  provider: string;
  /** System prompt for the subagent */
  systemPrompt?: string;
  /** Optional temperature setting (0-1) */
  temperature?: number;
  /** Optional max tokens setting */
  maxTokens?: number;
  /** Example interactions */
  examples: SubagentExample[];
}

/**
 * Loaded subagent with metadata
 */
export interface Subagent {
  /** Subagent configuration */
  config: SubagentConfig;
  /** File path where the subagent was loaded from */
  filePath: string;
  /** Whether this is from project or global directory */
  source: 'project' | 'global';
  /** File modification time */
  lastModified: Date;
}

/**
 * Simple execution options (replacing complex OrchestrationOptions)
 */
export interface SubagentExecutionOptions {
  /** Maximum execution time in milliseconds (default: 60000) */
  timeout?: number;
  /** Override subagent's tool list */
  tools?: string[];
  /** Override temperature */
  temperature?: number;
  /** Override max tokens */
  maxTokens?: number;
}

/**
 * Simple execution result
 */
export interface SubagentExecutionResult {
  /** The query that was executed */
  query: string;
  /** The subagent that executed the query */
  subagentName: string;
  /** The response text */
  response: string;
  /** Execution duration in milliseconds */
  duration: number;
  /** Whether execution was successful */
  success: boolean;
  /** Error message if execution failed */
  error?: string;
  /** Token usage information */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

/**
 * Subagent discovery result
 */
export interface SubagentDiscoveryResult {
  /** Successfully loaded subagents */
  subagents: Subagent[];
  /** Errors encountered during loading */
  errors: SubagentLoadError[];
  /** Total files processed */
  filesProcessed: number;
}

/**
 * Subagent loading error
 */
export interface SubagentLoadError {
  /** File path that failed to load */
  filePath: string;
  /** Error message */
  message: string;
  /** Error type */
  type: 'parse-error' | 'validation-error' | 'file-error';
  /** Original error if available */
  originalError?: Error;
}
