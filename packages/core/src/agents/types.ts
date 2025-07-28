/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tool definition for an agent
 */
export interface AgentTool {
  /** Tool name/identifier */
  name: string;
  /** Optional tool description */
  description?: string;
  /** Optional tool parameters schema */
  parameters?: Record<string, unknown>;
}

/**
 * Example interaction for demonstrating agent usage
 */
export interface AgentExample {
  /** User input for the example */
  input: string;
  /** Expected agent response or behavior */
  output: string;
  /** Optional description of what this example demonstrates */
  description?: string;
}

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  /** Unique agent name/identifier */
  name: string;
  /** Human-readable description of the agent's purpose */
  description: string;
  /** Keywords for agent discovery and matching */
  keywords: string[];
  /**
   * The priority of the agent, used for tie-breaking when multiple agents have the same score.
   * Lower numbers indicate higher priority.
   */
  priority?: number;
  /** List of tools this agent can use */
  tools: AgentTool[];
  /** AI model to use for this agent */
  model: string;
  /** AI provider for the model */
  provider: string;
  /** Example interactions demonstrating agent usage */
  examples: AgentExample[];
  /** Optional system prompt for the agent */
  systemPrompt?: string;
  /** Optional temperature setting for model */
  temperature?: number;
  /** Optional max tokens setting */
  maxTokens?: number;
  /** Optional custom configuration */
  customConfig?: Record<string, unknown>;
}

/**
 * Parsed agent definition from a file
 */
export interface ParsedAgent {
  /** Agent configuration */
  config: AgentConfig;
  /** File path where the agent was loaded from */
  filePath: string;
  /** Whether this is from a project-specific or global agent directory */
  source: 'project' | 'global';
  /** File content (for potential re-parsing or hot-reloading) */
  content: string;
  /** File modification time for change detection */
  lastModified: Date;
}

/**
 * Agent loader configuration options
 */
export interface AgentLoaderOptions {
  /** Project root directory (optional, defaults to user's home directory) */
  projectRoot?: string;
  /** Whether to include global agents from ~/.pk/agents/ */
  includeGlobal?: boolean;
  /** Whether to validate agents against schema */
  validateSchema?: boolean;
  /** Custom agent directory paths to search */
  customPaths?: string[];
}

/**
 * Agent discovery result
 */
export interface AgentDiscoveryResult {
  /** Successfully loaded agents */
  agents: ParsedAgent[];
  /** Errors encountered during loading */
  errors: AgentLoadError[];
  /** Total files processed */
  filesProcessed: number;
}

/**
 * Agent loading error
 */
export interface AgentLoadError {
  /** File path that failed to load */
  filePath: string;
  /** Error message */
  message: string;
  /** Error type */
  type: 'parse-error' | 'validation-error' | 'file-error' | 'schema-error';
  /** Original error object if available */
  originalError?: Error;
}

/**
 * Agent registry interface for managing loaded agents
 */
export interface AgentRegistry {
  /** Get all registered agents */
  getAgents(): ParsedAgent[];
  /** Get agent by name */
  getAgent(name: string): ParsedAgent | undefined;
  /** Find agents matching keywords */
  findAgents(keywords: string[]): ParsedAgent[];
  /** Register a new agent */
  registerAgent(agent: ParsedAgent): void;
  /** Unregister an agent by name */
  unregisterAgent(name: string): boolean;
  /** Clear all agents */
  clear(): void;
  /** Get number of registered agents */
  size(): number;
}
