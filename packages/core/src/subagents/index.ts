/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simplified Subagent System
 * 
 * This module provides a streamlined alternative to the complex multi-agent
 * orchestration system. It focuses on simplicity and explicitness:
 * 
 * - File-based configuration (Markdown + YAML frontmatter)
 * - Direct execution without complex routing or aggregation
 * - Single responsibility: execute one subagent at a time
 * - Predictable behavior with minimal overhead
 * 
 * Usage:
 * ```typescript
 * import { SubagentManager, SubagentExecutor } from './subagents';
 * 
 * const manager = new SubagentManager();
 * await manager.loadAll();
 * 
 * const subagent = manager.get('code-reviewer');
 * const executor = new SubagentExecutor();
 * 
 * const result = await executor.execute(
 *   subagent,
 *   'Review this code for security issues'
 * );
 * 
 * console.log(result.response);
 * ```
 */

export { SubagentManager } from './subagent-manager.js';
export { SubagentExecutor } from './subagent-executor.js';
export { BUILTIN_AGENTS } from './builtin-agents.js';

export type {
  Subagent,
  SubagentConfig,
  SubagentTool,
  SubagentExample,
  SubagentExecutionOptions,
  SubagentExecutionResult,
  SubagentDiscoveryResult,
  SubagentLoadError,
} from './types.js';
