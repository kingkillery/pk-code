/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Backward Compatibility Adapter
 * 
 * This module provides a compatibility layer for code that still uses
 * the old orchestration system. It maps old API calls to the new
 * simplified subagent system.
 * 
 * @deprecated This adapter is temporary and will be removed in a future version.
 * Please migrate to the new SubagentManager and SubagentExecutor API.
 */

import type { ContentGenerator } from '../core/contentGenerator.js';
import {
  SubagentManager,
  SubagentExecutor,
  type Subagent,
  type SubagentExecutionResult,
} from './index.js';

/**
 * Legacy orchestration mode (kept for compatibility)
 * @deprecated Use direct subagent execution instead
 */
export enum LegacyOrchestrationMode {
  SINGLE_AGENT = 'single-agent',
  MULTI_AGENT = 'multi-agent',
  AUTO = 'auto',
}

/**
 * Legacy orchestration options (simplified)
 * @deprecated Use SubagentExecutionOptions instead
 */
export interface LegacyOrchestrationOptions {
  mode?: LegacyOrchestrationMode;
  maxAgents?: number;
  timeout?: number;
}

/**
 * Legacy orchestration result (mapped from subagent result)
 * @deprecated Use SubagentExecutionResult instead
 */
export interface LegacyOrchestrationResult {
  query: string;
  mode: LegacyOrchestrationMode;
  response: {
    text: string;
    confidence: number;
  };
  execution: {
    status: 'success' | 'partial' | 'failed';
    duration: number;
  };
  performance: {
    totalDuration: number;
  };
}

/**
 * Adapter that translates old orchestration API to new subagent API
 * @deprecated Use SubagentManager and SubagentExecutor directly
 */
export class OrchestrationCompatibilityAdapter {
  private readonly manager: SubagentManager;
  private readonly executor: SubagentExecutor;

  constructor(
    contentGeneratorFactory: (subagent: Subagent) => Promise<ContentGenerator>,
    projectRoot?: string,
  ) {
    this.manager = new SubagentManager({ projectRoot });
    this.executor = new SubagentExecutor(contentGeneratorFactory);
  }

  /**
   * Initialize the adapter by loading subagents
   * @deprecated Call manager.loadAll() directly
   */
  async initialize(): Promise<void> {
    await this.manager.loadAll();
  }

  /**
   * Execute a query using the old orchestration-style API
   * @deprecated Use executor.execute(subagent, query) directly
   */
  async processQuery(
    query: string,
    options: LegacyOrchestrationOptions = {},
  ): Promise<LegacyOrchestrationResult> {
    console.warn(
      '[DEPRECATED] OrchestrationCompatibilityAdapter.processQuery() is deprecated. ' +
        'Please use SubagentExecutor.execute() directly.',
    );

    // Get the default subagent (or first available)
    const subagent =
      this.manager.get('default') || this.manager.getAll()[0];

    if (!subagent) {
      throw new Error(
        'No subagents available. Please configure at least one subagent.',
      );
    }

    // Execute using the new system
    const startTime = Date.now();
    const result = await this.executor.execute(subagent, query, {
      timeout: options.timeout,
    });
    const totalDuration = Date.now() - startTime;

    // Map to old result format
    return this.mapToLegacyResult(
      query,
      result,
      options.mode || LegacyOrchestrationMode.SINGLE_AGENT,
      totalDuration,
    );
  }

  /**
   * Route to a specific agent by name
   * @deprecated Use manager.get(name) and executor.execute() directly
   */
  async executeWithAgent(
    agentName: string,
    query: string,
    options: LegacyOrchestrationOptions = {},
  ): Promise<LegacyOrchestrationResult> {
    console.warn(
      '[DEPRECATED] OrchestrationCompatibilityAdapter.executeWithAgent() is deprecated. ' +
        'Please use SubagentExecutor.execute() directly.',
    );

    const subagent = this.manager.get(agentName);
    if (!subagent) {
      throw new Error(`Subagent not found: ${agentName}`);
    }

    const startTime = Date.now();
    const result = await this.executor.execute(subagent, query, {
      timeout: options.timeout,
    });
    const totalDuration = Date.now() - startTime;

    return this.mapToLegacyResult(
      query,
      result,
      LegacyOrchestrationMode.SINGLE_AGENT,
      totalDuration,
    );
  }

  /**
   * Convert ParsedAgent to Subagent format
   * @deprecated This is for migration only
   */
  static convertParsedAgentToSubagent(parsedAgent: ParsedAgent): Subagent {
    return {
      config: {
        name: parsedAgent.config.name,
        description: parsedAgent.config.description,
        keywords: parsedAgent.config.keywords,
        tools: parsedAgent.config.tools.map((t) => ({
          name: t.name,
          description: t.description,
        })),
        model: parsedAgent.config.model,
        provider: parsedAgent.config.provider,
        systemPrompt: parsedAgent.config.systemPrompt,
        temperature: parsedAgent.config.temperature,
        maxTokens: parsedAgent.config.maxTokens,
        examples: parsedAgent.config.examples,
      },
      filePath: parsedAgent.filePath,
      source: parsedAgent.source,
      lastModified: parsedAgent.lastModified,
    };
  }

  /**
   * Map new subagent result to old orchestration result format
   */
  private mapToLegacyResult(
    query: string,
    result: SubagentExecutionResult,
    mode: LegacyOrchestrationMode,
    totalDuration: number,
  ): LegacyOrchestrationResult {
    return {
      query,
      mode,
      response: {
        text: result.response,
        confidence: result.success ? 0.9 : 0.1, // Simplified confidence
      },
      execution: {
        status: result.success ? 'success' : 'failed',
        duration: result.duration,
      },
      performance: {
        totalDuration,
      },
    };
  }
}

/**
 * Helper function to create a compatibility adapter
 * @deprecated Use SubagentManager and SubagentExecutor directly
 */
export function createCompatibilityAdapter(
  contentGeneratorFactory: (subagent: Subagent) => Promise<ContentGenerator>,
  projectRoot?: string,
): OrchestrationCompatibilityAdapter {
  console.warn(
    '[DEPRECATED] createCompatibilityAdapter() is deprecated. ' +
      'Please use SubagentManager and SubagentExecutor directly.',
  );
  return new OrchestrationCompatibilityAdapter(
    contentGeneratorFactory,
    projectRoot,
  );
}
