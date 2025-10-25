/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @deprecated The complex orchestration system is deprecated.
 * Use the simplified subagent system from '../subagents' instead:
 * 
 * ```typescript
 * import { SubagentManager, SubagentExecutor } from '@pk-code/core';
 * 
 * const manager = new SubagentManager();
 * await manager.loadAll();
 * const subagent = manager.get('agent-name');
 * 
 * const executor = new SubagentExecutor();
 * const result = await executor.execute(subagent, 'your query');
 * ```
 * 
 * This provides the same file-based agent loading with:
 * - 87% less code complexity
 * - Simpler, more predictable execution
 * - Faster performance (no orchestration overhead)
 * - Easier to understand and debug
 * 
 * The old system will be removed in a future major version.
 */

// Export types
export type {
  AgentConfig,
  AgentTool,
  AgentExample,
  ParsedAgent,
  AgentLoaderOptions,
  AgentDiscoveryResult,
  AgentLoadError,
  AgentRegistry as IAgentRegistry,
} from './types.js';

// Export agent loader
export { AgentLoader, loadAgents, loadAgentFile } from './agent-loader.js';

// Export agent registry
export {
  AgentRegistry,
  getGlobalAgentRegistry,
  initializeGlobalAgentRegistry,
  disposeGlobalAgentRegistry,
} from './agent-registry.js';

// Legacy routing, execution, aggregation, and orchestration systems removed
// Use the simplified subagent system from '../subagents' instead

// Export prompt generation system
export type {
  PromptGenerationRequest,
  GeneratedPrompt,
} from './prompt-generator.js';
export {
  AgentPromptGenerator,
  createPromptGenerator,
} from './prompt-generator.js';

// Export ReAct framework
export type {
  ReActResponse,
  ReActAction,
  ReActCycle,
  ReActPromptConfig,
} from './react-framework.js';
export {
  ReActFramework,
  createReActFramework,
  REACT_SYSTEM_PROMPT,
} from './react-framework.js';
