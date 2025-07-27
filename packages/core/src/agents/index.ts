/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
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

// Export routing system
export type { RoutingResult, MultiAgentRoutingResult } from './agent-router.js';
export {
  AgentRouter,
  RoutingConfidence,
  createAgentRouter,
} from './agent-router.js';

// Export execution system
export type {
  AgentExecutionResult,
  MultiAgentExecutionResult,
  AggregatedResponse,
  ExecutionOptions,
} from './agent-executor.js';
export {
  AgentExecutor,
  TimeoutError,
  CancellationError,
  createAgentExecutor,
} from './agent-executor.js';

// Export aggregation system
export type {
  EnhancedAggregatedResponse,
  AggregationOptions,
  ResponseQuality,
  ConflictAnalysis,
} from './result-aggregator.js';
export {
  ResultAggregator,
  ConsensusStrategy,
  createResultAggregator,
} from './result-aggregator.js';

// Export orchestration system
export type {
  OrchestrationResult,
  OrchestrationOptions,
} from './agent-orchestrator.js';
export {
  AgentOrchestrator,
  OrchestrationMode,
  createAgentOrchestrator,
} from './agent-orchestrator.js';
