/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import type { ParsedAgent } from './types.js';
import type { ContentGenerator } from '../core/contentGenerator.js';
import type { RoutingResult, MultiAgentRoutingResult } from './agent-router.js';

/**
 * Result of a single agent execution
 */
export interface AgentExecutionResult {
  /** Agent that was executed */
  agent: ParsedAgent;
  /** Execution status */
  status: 'success' | 'error' | 'timeout' | 'cancelled';
  /** Generated response (if successful) */
  response?: GenerateContentResponse;
  /** Error information (if failed) */
  error?: {
    message: string;
    code?: string;
    originalError?: Error;
  };
  /** Execution duration in milliseconds */
  duration: number;
  /** Start time */
  startTime: Date;
  /** End time */
  endTime?: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of multi-agent execution
 */
export interface MultiAgentExecutionResult {
  /** Primary results from main agents */
  primaryResults: AgentExecutionResult[];
  /** Secondary results from supporting agents */
  secondaryResults: AgentExecutionResult[];
  /** Overall execution status */
  status: 'success' | 'partial' | 'failed';
  /** Total execution duration */
  totalDuration: number;
  /** Execution strategy used */
  strategy: 'sequential' | 'parallel' | 'prioritized';
  /** Aggregated response */
  aggregatedResponse?: AggregatedResponse;
  /** Execution metadata */
  metadata: {
    totalAgents: number;
    successfulAgents: number;
    failedAgents: number;
    timeoutAgents: number;
    cancelledAgents: number;
  };
}

/**
 * Aggregated response from multiple agents
 */
export interface AggregatedResponse {
  /** Primary response (from highest confidence agent) */
  primary: GenerateContentResponse;
  /** Supporting responses */
  supporting: GenerateContentResponse[];
  /** Confidence score for the aggregated response */
  confidence: number;
  /** Summary of key insights from all agents */
  summary?: string;
  /** Conflicting opinions or alternative approaches */
  alternatives?: string[];
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold?: number;
  /** Time to wait before trying again after circuit opens (ms) */
  resetTimeout?: number;
  /** Monitor window for failures (ms) */
  monitoringWindow?: number;
}

/**
 * Execution options for agent executor
 */
export interface ExecutionOptions {
  /** Maximum execution time per agent in milliseconds (5s-300s range, default 30s) */
  timeout?: number;
  /** Maximum total execution time for all agents */
  totalTimeout?: number;
  /** Maximum number of concurrent executions */
  maxConcurrency?: number;
  /** Whether to continue execution if some agents fail */
  continueOnError?: boolean;
  /** Whether to aggregate results automatically */
  aggregateResults?: boolean;
  /** Custom content generator factory */
  contentGeneratorFactory?: (agent: ParsedAgent) => Promise<ContentGenerator>;
  /** Progress callback */
  onProgress?: (result: AgentExecutionResult) => void;
  /** Resource limits */
  resourceLimits?: {
    maxMemoryMB?: number;
    maxCpuPercent?: number;
  };
  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;
  /** Optional AbortSignal for external cancellation */
  abortSignal?: AbortSignal;
}

/**
 * Circuit breaker state for an agent
 */
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

/**
 * High-performance parallel agent execution engine with enhanced timeout handling
 */
export class AgentExecutor {
  private readonly defaultTimeout: number = 30000; // 30 seconds
  private readonly minTimeout: number = 5000; // 5 seconds minimum
  private readonly maxTimeout: number = 300000; // 5 minutes maximum
  private readonly defaultMaxConcurrency: number = 5;
  private readonly circuitBreakers = new Map<string, CircuitBreakerState>();

  constructor(
    private readonly defaultOptions: Partial<ExecutionOptions> = {},
  ) {}

  /**
   * Execute a single agent with the given query
   */
  async executeSingleAgent(
    routingResult: RoutingResult,
    query: string,
    options?: ExecutionOptions,
  ): Promise<AgentExecutionResult> {
    const effectiveOptions = { ...this.defaultOptions, ...options };
    const timeout = effectiveOptions.timeout || this.defaultTimeout;
    const circuitBreakerConfig = effectiveOptions.circuitBreaker;

    const startTime = new Date();
    const result: AgentExecutionResult = {
      agent: routingResult.agent,
      status: 'success',
      duration: 0,
      startTime,
      metadata: {},
    };

    // Check circuit breaker if configured
    if (circuitBreakerConfig) {
      const isAllowed = this.checkCircuitBreaker(routingResult.agent, circuitBreakerConfig);
      if (!isAllowed) {
        result.endTime = new Date();
        result.duration = result.endTime.getTime() - startTime.getTime();
        result.status = 'error';
        result.error = {
          message: 'Agent execution blocked by circuit breaker',
          code: 'CIRCUIT_BREAKER_OPEN',
        };
        result.metadata!.circuitBreakerState = 'OPEN';
        
        effectiveOptions.onProgress?.(result);
        return result;
      }
    }

    try {
      // Create content generator for the agent
      const contentGenerator = await this.createContentGenerator(
        routingResult.agent,
        effectiveOptions,
      );

      // Prepare the request
      const request = this.prepareRequest(routingResult.agent, query);

      // Execute with enhanced timeout and cancellation support
      const response = await this.executeWithTimeout(
        async (signal: AbortSignal) => {
          // Pass abort signal to content generator if it supports it
          if ('generateContentWithSignal' in contentGenerator) {
            return (contentGenerator as { generateContentWithSignal: (req: unknown, signal: AbortSignal) => Promise<GenerateContentResponse> }).generateContentWithSignal(request, signal);
          } else {
            // Fallback: monitor signal and reject if aborted
            return new Promise<GenerateContentResponse>((resolve, reject) => {
              if (signal.aborted) {
                reject(new CancellationError('Already aborted'));
                return;
              }

              const abortHandler = () => {
                reject(new CancellationError('Operation was cancelled'));
              };
              signal.addEventListener('abort', abortHandler);

              contentGenerator.generateContent(request)
                .then(resolve)
                .catch(reject)
                .finally(() => {
                  signal.removeEventListener('abort', abortHandler);
                });
            });
          }
        },
        timeout,
        effectiveOptions.abortSignal,
      );

      result.status = 'success';
      result.response = response;
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - startTime.getTime();
      
      // Record success for circuit breaker
      if (circuitBreakerConfig) {
        this.recordCircuitBreakerSuccess(routingResult.agent);
        const cbState = this.circuitBreakers.get(routingResult.agent.config.name);
        result.metadata!.circuitBreakerState = cbState?.state || 'CLOSED';
      }

      // Add performance metadata
      result.metadata!.overheadMs = Math.max(0, result.duration - (response as { executionTime?: number })?.executionTime || 0);

      // Report progress
      effectiveOptions.onProgress?.(result);

      return result;
    } catch (_error) {
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - startTime.getTime();

      // Record failure for circuit breaker
      if (circuitBreakerConfig && !(_error instanceof CancellationError)) {
        this.recordCircuitBreakerFailure(routingResult.agent, circuitBreakerConfig);
        const cbState = this.circuitBreakers.get(routingResult.agent.config.name);
        result.metadata!.circuitBreakerState = cbState?.state || 'CLOSED';
      }

      if (_error instanceof TimeoutError) {
        result.status = 'timeout';
        result.error = {
          message: `Agent execution timed out after ${this.validateTimeout(timeout)}ms`,
          code: 'TIMEOUT',
          originalError: _error,
        };
      } else if (_error instanceof CancellationError) {
        result.status = 'cancelled';
        result.error = {
          message: 'Agent execution was cancelled',
          code: 'CANCELLED',
          originalError: _error,
        };
      } else {
        result.status = 'error';
        result.error = {
          message: _error instanceof Error ? _error.message : 'Unknown error',
          code: 'EXECUTION_ERROR',
          originalError: _error instanceof Error ? _error : undefined,
        };
      }

      // Report progress
      effectiveOptions.onProgress?.(result);

      return result;
    }
  }

  /**
   * Execute multiple agents in parallel with intelligent resource management
   */
  async executeMultipleAgents(
    routingResult: MultiAgentRoutingResult,
    query: string,
    options?: ExecutionOptions,
  ): Promise<MultiAgentExecutionResult> {
    const effectiveOptions = { ...this.defaultOptions, ...options };
    const maxConcurrency =
      effectiveOptions.maxConcurrency || this.defaultMaxConcurrency;
    const totalTimeout =
      effectiveOptions.totalTimeout || this.defaultTimeout * 2;

    const startTime = new Date();
    const allAgents = [
      ...routingResult.primaryAgents,
      ...routingResult.secondaryAgents,
    ];

    try {
      // Execute based on strategy
      let results: AgentExecutionResult[];

      switch (routingResult.strategy) {
        case 'sequential':
          results = await this.executeSequential(
            allAgents,
            query,
            effectiveOptions,
          );
          break;
        case 'prioritized':
          results = await this.executePrioritized(
            routingResult.primaryAgents,
            routingResult.secondaryAgents,
            query,
            effectiveOptions,
          );
          break;
        case 'parallel':
        default:
          results = await this.executeParallel(
            allAgents,
            query,
            effectiveOptions,
            maxConcurrency,
          );
          break;
      }

      // Apply total timeout
      const elapsedTime = Date.now() - startTime.getTime();
      if (elapsedTime > totalTimeout) {
        // Cancel remaining executions and mark as timeout
        results = results.map((r) =>
          r.status === 'success'
            ? r
            : {
                ...r,
                status: 'timeout' as const,
                error: {
                  message: 'Total execution time exceeded',
                  code: 'TOTAL_TIMEOUT',
                },
              },
        );
      }

      // Split results into primary and secondary
      const primaryResults = results.filter((r) =>
        routingResult.primaryAgents.some(
          (pr) => pr.agent.config.name === r.agent.config.name,
        ),
      );
      const secondaryResults = results.filter((r) =>
        routingResult.secondaryAgents.some(
          (sr) => sr.agent.config.name === r.agent.config.name,
        ),
      );

      // Calculate metadata
      const metadata = {
        totalAgents: results.length,
        successfulAgents: results.filter((r) => r.status === 'success').length,
        failedAgents: results.filter((r) => r.status === 'error').length,
        timeoutAgents: results.filter((r) => r.status === 'timeout').length,
        cancelledAgents: results.filter((r) => r.status === 'cancelled').length,
      };

      // Determine overall status
      let status: MultiAgentExecutionResult['status'];
      if (metadata.successfulAgents === metadata.totalAgents) {
        status = 'success';
      } else if (metadata.successfulAgents > 0) {
        status = 'partial';
      } else {
        status = 'failed';
      }

      // Aggregate results if requested
      let aggregatedResponse: AggregatedResponse | undefined;
      if (effectiveOptions.aggregateResults && metadata.successfulAgents > 0) {
        aggregatedResponse = this.aggregateResponses(
          results.filter((r) => r.status === 'success' && r.response),
          routingResult.primaryAgents,
        );
      }

      const endTime = new Date();
      const totalDuration = endTime.getTime() - startTime.getTime();

      return {
        primaryResults,
        secondaryResults,
        status,
        totalDuration,
        strategy: routingResult.strategy,
        aggregatedResponse,
        metadata,
      };
    } catch (_error) {
      const endTime = new Date();
      const totalDuration = endTime.getTime() - startTime.getTime();

      return {
        primaryResults: [],
        secondaryResults: [],
        status: 'failed',
        totalDuration,
        strategy: routingResult.strategy,
        metadata: {
          totalAgents: allAgents.length,
          successfulAgents: 0,
          failedAgents: allAgents.length,
          timeoutAgents: 0,
          cancelledAgents: 0,
        },
      };
    }
  }

  /**
   * Execute agents sequentially
   */
  private async executeSequential(
    routingResults: RoutingResult[],
    query: string,
    options: ExecutionOptions,
  ): Promise<AgentExecutionResult[]> {
    const results: AgentExecutionResult[] = [];

    for (const routingResult of routingResults) {
      const result = await this.executeSingleAgent(
        routingResult,
        query,
        options,
      );
      results.push(result);

      // Stop on first error if continueOnError is false
      if (!options.continueOnError && result.status !== 'success') {
        break;
      }
    }

    return results;
  }

  /**
   * Execute agents in parallel with concurrency control
   */
  private async executeParallel(
    routingResults: RoutingResult[],
    query: string,
    options: ExecutionOptions,
    maxConcurrency: number,
  ): Promise<AgentExecutionResult[]> {
    const results: AgentExecutionResult[] = [];
    const executing = new Set<Promise<AgentExecutionResult>>();

    for (let i = 0; i < routingResults.length; i++) {
      // Wait if we've reached max concurrency
      if (executing.size >= maxConcurrency) {
        const completed = await Promise.race(executing);
        executing.delete(Promise.resolve(completed));
        results.push(completed);
      }

      // Start execution
      const executionPromise = this.executeSingleAgent(
        routingResults[i],
        query,
        options,
      );
      executing.add(executionPromise);
    }

    // Wait for remaining executions
    const remainingResults = await Promise.allSettled(Array.from(executing));
    for (const result of remainingResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    }

    return results;
  }

  /**
   * Execute with primary agents first, then secondary
   */
  private async executePrioritized(
    primaryAgents: RoutingResult[],
    secondaryAgents: RoutingResult[],
    query: string,
    options: ExecutionOptions,
  ): Promise<AgentExecutionResult[]> {
    // Execute primary agents first
    const primaryResults = await this.executeParallel(
      primaryAgents,
      query,
      options,
      Math.min(primaryAgents.length, 3),
    );

    // Only execute secondary agents if primary agents succeeded
    const primarySuccesses = primaryResults.filter(
      (r) => r.status === 'success',
    ).length;

    let secondaryResults: AgentExecutionResult[] = [];
    if (primarySuccesses > 0 && secondaryAgents.length > 0) {
      secondaryResults = await this.executeParallel(
        secondaryAgents,
        query,
        options,
        Math.min(secondaryAgents.length, 2),
      );
    }

    return [...primaryResults, ...secondaryResults];
  }

  /**
   * Create content generator for an agent
   */
  private async createContentGenerator(
    agent: ParsedAgent,
    options: ExecutionOptions,
  ): Promise<ContentGenerator> {
    if (options.contentGeneratorFactory) {
      return options.contentGeneratorFactory(agent);
    }

    // Default implementation - this would need to be integrated with the existing
    // content generator system in the PK-Code codebase
    throw new Error(
      'Content generator factory not provided. This should be integrated with the existing PK-Code content generation system.',
    );
  }

  /**
   * Prepare request for agent execution
   */
  private prepareRequest(
    agent: ParsedAgent,
    query: string,
  ): GenerateContentParameters {
    const systemPrompt =
      agent.config.systemPrompt ||
      `You are ${agent.config.name}: ${agent.config.description}`;

    return {
      model: agent.config.model || 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nUser Query: ${query}` }],
        },
      ],
      config: {
        temperature: agent.config.temperature || 0.7,
        maxOutputTokens: agent.config.maxTokens || 2048,
      },
    };
  }

  /**
   * Validate and normalize timeout value
   */
  private validateTimeout(timeout: number): number {
    return Math.max(this.minTimeout, Math.min(this.maxTimeout, timeout));
  }

  /**
   * Check circuit breaker state for an agent
   */
  private checkCircuitBreaker(
    agent: ParsedAgent,
    config: CircuitBreakerConfig,
  ): boolean {
    const agentKey = agent.config.name;
    const state = this.circuitBreakers.get(agentKey);
    
    if (!state) {
      this.circuitBreakers.set(agentKey, {
        failures: 0,
        lastFailureTime: 0,
        state: 'CLOSED',
      });
      return true;
    }

    const now = Date.now();
    const { 
      resetTimeout = 60000,
      monitoringWindow = 300000
    } = config;

    // Reset old failures outside monitoring window
    if (now - state.lastFailureTime > monitoringWindow) {
      state.failures = 0;
      state.state = 'CLOSED';
    }

    switch (state.state) {
      case 'CLOSED':
        return true;
      case 'OPEN':
        if (now - state.lastFailureTime > resetTimeout) {
          state.state = 'HALF_OPEN';
          return true;
        }
        return false;
      case 'HALF_OPEN':
        return true;
      default:
        return true;
    }
  }

  /**
   * Record circuit breaker failure
   */
  private recordCircuitBreakerFailure(
    agent: ParsedAgent,
    config: CircuitBreakerConfig,
  ): void {
    const agentKey = agent.config.name;
    const state = this.circuitBreakers.get(agentKey);
    
    if (!state) return;

    const { failureThreshold: _failureThreshold = 5 } = config;
    
    state.failures++;
    state.lastFailureTime = Date.now();
    
    if (state.failures >= _failureThreshold) {
      state.state = 'OPEN';
    }
  }

  /**
   * Record circuit breaker success
   */
  private recordCircuitBreakerSuccess(agent: ParsedAgent): void {
    const agentKey = agent.config.name;
    const state = this.circuitBreakers.get(agentKey);
    
    if (!state) return;

    if (state.state === 'HALF_OPEN') {
      state.state = 'CLOSED';
      state.failures = 0;
    }
  }

  /**
   * Execute a function with enhanced timeout and cancellation using AbortController
   */
  private async executeWithTimeout<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    externalSignal?: AbortSignal,
  ): Promise<T> {
    const validatedTimeout = this.validateTimeout(timeoutMs);
    
    // Create a composite abort controller
    const abortController = new AbortController();
    const { signal } = abortController;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      abortController.abort(new TimeoutError(`Operation timed out after ${validatedTimeout}ms`));
    }, validatedTimeout);

    // Handle external cancellation
    const externalAbortHandler = () => {
      abortController.abort(new CancellationError('Operation was cancelled by external signal'));
    };

    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutId);
        throw new CancellationError('Operation was cancelled before execution');
      }
      externalSignal.addEventListener('abort', externalAbortHandler);
    }

    try {
      const result = await fn(signal);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle abort signals with proper error types
      if (signal.aborted) {
        const abortReason = signal.reason;
        if (abortReason instanceof TimeoutError || abortReason instanceof CancellationError) {
          throw abortReason;
        }
        throw new CancellationError('Operation was cancelled');
      }
      
      throw error;
    } finally {
      if (externalSignal) {
        externalSignal.removeEventListener('abort', externalAbortHandler);
      }
    }
  }

  /**
   * Aggregate responses from multiple successful agent executions
   */
  private aggregateResponses(
    results: AgentExecutionResult[],
    primaryAgents: RoutingResult[],
  ): AggregatedResponse {
    const successfulResults = results.filter((r) => r.response);

    if (successfulResults.length === 0) {
      throw new Error('No successful results to aggregate');
    }

    // Find primary response (highest confidence agent that succeeded)
    let primaryResponse = successfulResults[0].response!;
    let primaryConfidence = 0.5;

    for (const result of successfulResults) {
      const agent = result.agent;
      const routingResult = primaryAgents.find(
        (p) => p.agent.config.name === agent.config.name,
      );
      if (routingResult && routingResult.confidence > primaryConfidence) {
        primaryResponse = result.response!;
        primaryConfidence = routingResult.confidence;
      }
    }

    // Collect supporting responses
    const supportingResponses = successfulResults
      .filter((r) => r.response !== primaryResponse)
      .map((r) => r.response!);

    // Calculate overall confidence based on consensus and individual confidences
    const avgConfidence =
      primaryAgents
        .filter((p) =>
          successfulResults.some(
            (r) => r.agent.config.name === p.agent.config.name,
          ),
        )
        .reduce((sum, p) => sum + p.confidence, 0) / primaryAgents.length;

    return {
      primary: primaryResponse,
      supporting: supportingResponses,
      confidence: avgConfidence,
      summary: this.generateSummary(successfulResults),
      alternatives: this.extractAlternatives(supportingResponses),
    };
  }

  /**
   * Generate summary from multiple agent results
   */
  private generateSummary(results: AgentExecutionResult[]): string {
    const agentNames = results.map((r) => r.agent.config.name).join(', ');
    const avgDuration =
      results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    return `Aggregated response from ${results.length} agents (${agentNames}) with average execution time of ${Math.round(avgDuration)}ms.`;
  }

  /**
   * Extract alternative approaches from supporting responses
   */
  private extractAlternatives(responses: GenerateContentResponse[]): string[] {
    // This is a simplified implementation - in practice, you might want to use
    // NLP techniques to identify truly different approaches
    return responses
      .slice(0, 3)
      .map(
        (response, index) =>
          `Alternative ${index + 1}: ${this.extractFirstSentence(response)}`,
      );
  }

  /**
   * Extract first sentence from a response
   */
  private extractFirstSentence(response: GenerateContentResponse): string {
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const firstSentence = text.split(/[.!?]/)[0];
    return (
      firstSentence.substring(0, 100) +
      (firstSentence.length > 100 ? '...' : '')
    );
  }
}

/**
 * Custom error classes
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class CancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CancellationError';
  }
}

/**
 * Factory function to create an agent executor
 */
export function createAgentExecutor(
  defaultOptions?: Partial<ExecutionOptions>,
): AgentExecutor {
  return new AgentExecutor(defaultOptions);
}
