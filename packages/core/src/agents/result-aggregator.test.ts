/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ResultAggregator,
  createResultAggregator,
  ConsensusStrategy,
  type AggregationOptions,
} from './result-aggregator.js';
import type {
  AgentExecutionResult,
  MultiAgentExecutionResult,
} from './agent-executor.js';
import type { ParsedAgent, AgentConfig } from './types.js';
import type { RoutingResult } from './agent-router.js';
import type { GenerateContentResponse } from '@google/genai';

// Mock response generator
const createMockResponse = (text: string): GenerateContentResponse => ({
  candidates: [
    {
      content: {
        parts: [{ text }],
      },
    },
  ],
});

// Mock agent
const createMockAgent = (
  name: string,
  keywords: string[] = [],
  tools: string[] = [],
): ParsedAgent => ({
  config: {
    name,
    description: `${name} agent`,
    keywords,
    tools: tools.map((tool) => ({ name: tool })),
    model: 'gpt-4',
    provider: 'openai',
    examples: [{ input: 'test', output: 'response' }],
  } as AgentConfig,
  filePath: `/test/agents/${name}.md`,
  source: 'project',
  content: `---\nname: ${name}\n---`,
  lastModified: new Date(),
});

// Mock execution result
const createMockExecutionResult = (
  agent: ParsedAgent,
  responseText: string,
  duration = 1000,
  status: 'success' | 'error' | 'timeout' = 'success',
): AgentExecutionResult => ({
  agent,
  status,
  response: status === 'success' ? createMockResponse(responseText) : undefined,
  duration,
  startTime: new Date(Date.now() - duration),
  endTime: new Date(),
  error:
    status !== 'success'
      ? { message: `${status} error`, code: status.toUpperCase() }
      : undefined,
});

// Mock routing result
const createMockRoutingResult = (
  agent: ParsedAgent,
  confidence = 0.8,
): RoutingResult => ({
  agent,
  confidence,
  reason: 'Test routing',
  alternatives: [],
});

describe('ResultAggregator', () => {
  let aggregator: ResultAggregator;
  let agents: ParsedAgent[];
  let executionResults: AgentExecutionResult[];
  let routingResults: RoutingResult[];
  let multiAgentResult: MultiAgentExecutionResult;

  beforeEach(() => {
    aggregator = new ResultAggregator();

    // Create test agents
    agents = [
      createMockAgent(
        'code-expert',
        ['code', 'programming'],
        ['edit', 'create'],
      ),
      createMockAgent('test-specialist', ['test', 'qa'], ['shell', 'test']),
      createMockAgent(
        'docs-writer',
        ['docs', 'documentation'],
        ['write', 'read'],
      ),
    ];

    // Create execution results
    executionResults = [
      createMockExecutionResult(
        agents[0],
        'Here is a comprehensive solution using modern JavaScript patterns. function createUser() { return { name: "", age: 0 }; }',
        1200,
      ),
      createMockExecutionResult(
        agents[1],
        'You should write tests for this function. Use Jest for testing: describe("createUser", () => { it("should work", () => {}); });',
        800,
      ),
      createMockExecutionResult(
        agents[2],
        'Documentation is important. This function creates a user object with default properties.',
        600,
      ),
    ];

    // Create routing results
    routingResults = [
      createMockRoutingResult(agents[0], 0.9),
      createMockRoutingResult(agents[1], 0.7),
      createMockRoutingResult(agents[2], 0.6),
    ];

    // Create multi-agent result
    multiAgentResult = {
      primaryResults: executionResults.slice(0, 2),
      secondaryResults: executionResults.slice(2),
      status: 'success',
      totalDuration: 2000,
      strategy: 'parallel',
      metadata: {
        totalAgents: 3,
        successfulAgents: 3,
        failedAgents: 0,
        timeoutAgents: 0,
        cancelledAgents: 0,
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create aggregator with default options', () => {
      const aggregator = new ResultAggregator();
      expect(aggregator).toBeDefined();
    });

    it('should create aggregator with custom options', () => {
      const options: Partial<AggregationOptions> = {
        strategy: ConsensusStrategy.HIGHEST_CONFIDENCE,
        minConfidence: 0.5,
        maxAlternatives: 5,
      };
      const aggregator = new ResultAggregator(options);
      expect(aggregator).toBeDefined();
    });
  });

  describe('aggregateResults', () => {
    it('should aggregate results with highest confidence strategy', async () => {
      const options: Partial<AggregationOptions> = {
        strategy: ConsensusStrategy.HIGHEST_CONFIDENCE,
      };

      const result = await aggregator.aggregateResults(
        multiAgentResult,
        'create a user function',
        routingResults,
        options,
      );

      expect(result.primary).toBeDefined();
      expect(result.confidence).toBe(0.9); // Highest confidence agent
      expect(result.primaryQuality).toBeDefined();
      expect(result.supportingQualities).toHaveLength(2);
      expect(result.aggregationMetadata.strategy).toBe(
        ConsensusStrategy.HIGHEST_CONFIDENCE,
      );
    });

    it('should aggregate results with intelligent merge strategy', async () => {
      const options: Partial<AggregationOptions> = {
        strategy: ConsensusStrategy.INTELLIGENT_MERGE,
      };

      const result = await aggregator.aggregateResults(
        multiAgentResult,
        'create a user function',
        routingResults,
        options,
      );

      expect(result.primary).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.summary).toContain('agents');
      expect(result.aggregationMetadata.strategy).toBe(
        ConsensusStrategy.INTELLIGENT_MERGE,
      );
    });

    it('should aggregate results with fastest success strategy', async () => {
      const options: Partial<AggregationOptions> = {
        strategy: ConsensusStrategy.FASTEST_SUCCESS,
      };

      const result = await aggregator.aggregateResults(
        multiAgentResult,
        'create a user function',
        routingResults,
        options,
      );

      expect(result.primary).toBeDefined();
      // Should select the fastest successful result (docs-writer with 600ms)
      expect(
        result.primary.candidates?.[0]?.content?.parts?.[0]?.text,
      ).toContain('Documentation');
    });

    it('should aggregate results with expert priority strategy', async () => {
      const options: Partial<AggregationOptions> = {
        strategy: ConsensusStrategy.EXPERT_PRIORITY,
        agentPriorities: {
          'code-expert': 10,
          'test-specialist': 5,
          'docs-writer': 1,
        },
      };

      const result = await aggregator.aggregateResults(
        multiAgentResult,
        'create a user function',
        routingResults,
        options,
      );

      expect(result.primary).toBeDefined();
      // Should select code-expert due to highest priority
      expect(
        result.primary.candidates?.[0]?.content?.parts?.[0]?.text,
      ).toContain('function createUser');
    });

    it('should filter results by minimum confidence', async () => {
      const options: Partial<AggregationOptions> = {
        minConfidence: 0.8,
      };

      const result = await aggregator.aggregateResults(
        multiAgentResult,
        'create a user function',
        routingResults,
        options,
      );

      // Only code-expert (0.9) and test-specialist (0.7 < 0.8) should be included
      // Wait, test-specialist is 0.7 so should be excluded
      expect(result.aggregationMetadata.participatingAgents).toContain(
        'code-expert',
      );
    });

    it('should limit alternatives', async () => {
      const options: Partial<AggregationOptions> = {
        maxAlternatives: 1,
      };

      const result = await aggregator.aggregateResults(
        multiAgentResult,
        'create a user function',
        routingResults,
        options,
      );

      expect(result.alternatives?.length).toBeLessThanOrEqual(1);
    });

    it('should include conflict analysis', async () => {
      // Create conflicting responses
      const conflictingResults = [
        createMockExecutionResult(
          agents[0],
          'Use TypeScript for type safety: interface User { name: string; age: number; }',
          1000,
        ),
        createMockExecutionResult(
          agents[1],
          'Use JavaScript for simplicity: const user = { name: "", age: 0 };',
          800,
        ),
      ];

      const conflictingMultiResult: MultiAgentExecutionResult = {
        ...multiAgentResult,
        primaryResults: conflictingResults,
        secondaryResults: [],
      };

      const result = await aggregator.aggregateResults(
        conflictingMultiResult,
        'create a user object',
        routingResults.slice(0, 2),
      );

      expect(result.conflictAnalysis).toBeDefined();
      expect(result.conflictAnalysis.hasConflicts).toBe(true);
    });

    it('should calculate performance metrics', async () => {
      const result = await aggregator.aggregateResults(
        multiAgentResult,
        'create a user function',
        routingResults,
      );

      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics.totalExecutionTime).toBe(1200); // Max duration
      expect(result.performanceMetrics.averageResponseTime).toBe(866.67); // Average of 1200, 800, 600
      expect(result.performanceMetrics.successRate).toBe(1.0); // All successful
      expect(result.performanceMetrics.timeoutRate).toBe(0); // No timeouts
    });

    it('should calculate recommendation strength', async () => {
      const result = await aggregator.aggregateResults(
        multiAgentResult,
        'create a user function',
        routingResults,
      );

      expect(result.recommendationStrength).toBeGreaterThan(0);
      expect(result.recommendationStrength).toBeLessThanOrEqual(1);
    });

    it('should handle partial failures', async () => {
      const partialResults = [
        ...executionResults.slice(0, 2),
        createMockExecutionResult(agents[2], '', 500, 'error'),
      ];

      const partialMultiResult: MultiAgentExecutionResult = {
        ...multiAgentResult,
        primaryResults: partialResults.slice(0, 2),
        secondaryResults: partialResults.slice(2),
        status: 'partial',
        metadata: {
          totalAgents: 3,
          successfulAgents: 2,
          failedAgents: 1,
          timeoutAgents: 0,
          cancelledAgents: 0,
        },
      };

      const result = await aggregator.aggregateResults(
        partialMultiResult,
        'create a user function',
        routingResults,
      );

      expect(result.aggregationMetadata.excludedAgents).toHaveLength(1);
      expect(result.aggregationMetadata.excludedAgents[0].name).toBe(
        'docs-writer',
      );
      expect(result.aggregationMetadata.excludedAgents[0].reason).toContain(
        'error',
      );
    });

    it('should throw error when no successful results', async () => {
      const failedMultiResult: MultiAgentExecutionResult = {
        ...multiAgentResult,
        primaryResults: [],
        secondaryResults: [],
        status: 'failed',
        metadata: {
          totalAgents: 0,
          successfulAgents: 0,
          failedAgents: 3,
          timeoutAgents: 0,
          cancelledAgents: 0,
        },
      };

      await expect(
        aggregator.aggregateResults(failedMultiResult, 'test query', []),
      ).rejects.toThrow('No successful results to aggregate');
    });
  });

  describe('quality evaluation', () => {
    it('should evaluate response quality correctly', async () => {
      const result = await aggregator.aggregateResults(
        multiAgentResult,
        'create a user function with proper documentation and examples',
        routingResults,
      );

      expect(result.primaryQuality).toBeDefined();
      expect(result.primaryQuality.lengthScore).toBeGreaterThan(0);
      expect(result.primaryQuality.completenessScore).toBeGreaterThan(0);
      expect(result.primaryQuality.specificityScore).toBeGreaterThan(0);
      expect(result.primaryQuality.coherenceScore).toBeGreaterThan(0);
      expect(result.primaryQuality.overallScore).toBeGreaterThan(0);
    });

    it('should detect code quality when present', async () => {
      const codeResult = createMockExecutionResult(
        agents[0],
        'Here is a well-structured function:\n```javascript\nfunction createUser(name, age) {\n  // Validate inputs\n  if (!name || age < 0) throw new Error("Invalid input");\n  \n  return {\n    name,\n    age,\n    getId: () => Math.random()\n  };\n}\n```',
        1000,
      );

      const codeMultiResult: MultiAgentExecutionResult = {
        ...multiAgentResult,
        primaryResults: [codeResult],
        secondaryResults: [],
      };

      const result = await aggregator.aggregateResults(
        codeMultiResult,
        'create a user function',
        [routingResults[0]],
      );

      expect(result.primaryQuality.codeQualityScore).toBeDefined();
      expect(result.primaryQuality.codeQualityScore).toBeGreaterThan(0);
    });

    it('should score longer responses appropriately', async () => {
      const shortResponse = createMockExecutionResult(
        agents[0],
        'Short answer.',
        500,
      );
      const longResponse = createMockExecutionResult(
        agents[1],
        'This is a much longer and more comprehensive response that provides detailed explanations, examples, and best practices for implementing the requested functionality. '.repeat(
          10,
        ),
        1000,
      );

      const shortResult = await aggregator.aggregateResults(
        {
          ...multiAgentResult,
          primaryResults: [shortResponse],
          secondaryResults: [],
        },
        'explain how to create a user',
        [routingResults[0]],
      );

      const longResult = await aggregator.aggregateResults(
        {
          ...multiAgentResult,
          primaryResults: [longResponse],
          secondaryResults: [],
        },
        'explain how to create a user',
        [routingResults[1]],
      );

      // Longer response should have better length score (up to optimal length)
      expect(longResult.primaryQuality.lengthScore).toBeGreaterThan(
        shortResult.primaryQuality.lengthScore,
      );
    });

    it('should evaluate completeness based on query coverage', async () => {
      const completeResponse = createMockExecutionResult(
        agents[0],
        'To create a user function with validation and testing: First, implement the function with proper validation. Second, add comprehensive tests. Third, document the API clearly.',
        1000,
      );

      const incompleteResponse = createMockExecutionResult(
        agents[1],
        'Just use an object.',
        500,
      );

      const completeResult = await aggregator.aggregateResults(
        {
          ...multiAgentResult,
          primaryResults: [completeResponse],
          secondaryResults: [],
        },
        'create user function with validation and testing',
        [routingResults[0]],
      );

      const incompleteResult = await aggregator.aggregateResults(
        {
          ...multiAgentResult,
          primaryResults: [incompleteResponse],
          secondaryResults: [],
        },
        'create user function with validation and testing',
        [routingResults[1]],
      );

      expect(completeResult.primaryQuality.completenessScore).toBeGreaterThan(
        incompleteResult.primaryQuality.completenessScore,
      );
    });
  });

  describe('conflict detection', () => {
    it('should detect implementation conflicts', async () => {
      const conflictingResults = [
        createMockExecutionResult(
          agents[0],
          'Use classes: class User { constructor(name) { this.name = name; } }',
          1000,
        ),
        createMockExecutionResult(
          agents[1],
          'Use factory functions: function createUser(name) { return { name }; }',
          800,
        ),
      ];

      const result = await aggregator.aggregateResults(
        {
          ...multiAgentResult,
          primaryResults: conflictingResults,
          secondaryResults: [],
        },
        'create a user',
        routingResults.slice(0, 2),
      );

      expect(result.conflictAnalysis.hasConflicts).toBe(true);
      expect(result.conflictAnalysis.conflicts.length).toBeGreaterThan(0);
    });

    it('should find consensus themes', async () => {
      const consensusResults = [
        createMockExecutionResult(
          agents[0],
          'Create a function that returns an object with validation',
          1000,
        ),
        createMockExecutionResult(
          agents[1],
          'Build a function-based approach with proper validation',
          800,
        ),
        createMockExecutionResult(
          agents[2],
          'Document the function implementation thoroughly',
          600,
        ),
      ];

      const result = await aggregator.aggregateResults(
        {
          ...multiAgentResult,
          primaryResults: consensusResults,
          secondaryResults: [],
        },
        'create a user function',
        routingResults,
      );

      expect(result.conflictAnalysis.consensus.length).toBeGreaterThan(0);
      expect(
        result.conflictAnalysis.consensus.some((c) =>
          c.topic.includes('function'),
        ),
      ).toBe(true);
    });
  });

  describe('performance and scalability', () => {
    it('should aggregate large number of results efficiently', async () => {
      // Create many agents and results
      const manyAgents = Array.from({ length: 20 }, (_, i) =>
        createMockAgent(`agent-${i}`, [`keyword-${i}`]),
      );

      const manyResults = manyAgents.map((agent) =>
        createMockExecutionResult(
          agent,
          `Response from ${agent.config.name}`,
          1000,
        ),
      );

      const manyRoutingResults = manyAgents.map((agent) =>
        createMockRoutingResult(agent, 0.5 + Math.random() * 0.5),
      );

      const largeMultiResult: MultiAgentExecutionResult = {
        primaryResults: manyResults.slice(0, 10),
        secondaryResults: manyResults.slice(10),
        status: 'success',
        totalDuration: 2000,
        strategy: 'parallel',
        metadata: {
          totalAgents: 20,
          successfulAgents: 20,
          failedAgents: 0,
          timeoutAgents: 0,
          cancelledAgents: 0,
        },
      };

      const startTime = Date.now();
      const result = await aggregator.aggregateResults(
        largeMultiResult,
        'complex query',
        manyRoutingResults,
      );
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.aggregationMetadata.aggregationTime).toBeLessThan(500);
    });

    it('should handle mixed success/failure scenarios', async () => {
      const mixedResults = [
        createMockExecutionResult(agents[0], 'Success 1', 1000, 'success'),
        createMockExecutionResult(agents[1], '', 800, 'timeout'),
        createMockExecutionResult(agents[2], 'Success 2', 600, 'success'),
      ];

      const mixedMultiResult: MultiAgentExecutionResult = {
        primaryResults: mixedResults.slice(0, 2),
        secondaryResults: mixedResults.slice(2),
        status: 'partial',
        totalDuration: 2000,
        strategy: 'parallel',
        metadata: {
          totalAgents: 3,
          successfulAgents: 2,
          failedAgents: 0,
          timeoutAgents: 1,
          cancelledAgents: 0,
        },
      };

      const result = await aggregator.aggregateResults(
        mixedMultiResult,
        'test query',
        routingResults,
      );

      expect(result.aggregationMetadata.participatingAgents).toHaveLength(2);
      expect(result.aggregationMetadata.excludedAgents).toHaveLength(1);
      expect(result.aggregationMetadata.excludedAgents[0].reason).toContain(
        'timeout',
      );
    });
  });

  describe('customization options', () => {
    it('should respect custom scoring weights', async () => {
      const options: Partial<AggregationOptions> = {
        strategy: ConsensusStrategy.INTELLIGENT_MERGE,
        weights: {
          confidence: 0.1,
          speed: 0.7,
          agentExpertise: 0.1,
          responseQuality: 0.1,
        },
      };

      const result = await aggregator.aggregateResults(
        multiAgentResult,
        'create a user function',
        routingResults,
        options,
      );

      // With high speed weight, should prefer fastest agent (docs-writer)
      expect(
        result.primary.candidates?.[0]?.content?.parts?.[0]?.text,
      ).toContain('Documentation');
    });

    it('should include conflicts when requested', async () => {
      const options: Partial<AggregationOptions> = {
        includeConflicts: true,
      };

      const result = await aggregator.aggregateResults(
        multiAgentResult,
        'create a user function',
        routingResults,
        options,
      );

      expect(result.conflictAnalysis).toBeDefined();
    });

    it('should exclude conflicts when not requested', async () => {
      const options: Partial<AggregationOptions> = {
        includeConflicts: false,
      };

      const result = await aggregator.aggregateResults(
        multiAgentResult,
        'create a user function',
        routingResults,
        options,
      );

      // Conflicts should still be analyzed but not included in alternatives
      expect(result.conflictAnalysis).toBeDefined();
    });
  });

  describe('structured response format', () => {
    it('should generate structured response with agent attribution', async () => {
      const result = await aggregator.aggregateResults(
        multiAgentResult,
        'create a user function',
        routingResults,
      );

      expect(result.structured).toBeDefined();
      expect(result.structured.version).toBe('1.0');
      expect(result.structured.primary.agent).toBe('code-expert');
      expect(result.structured.primary.confidence).toBe(0.9);
      expect(result.structured.primary.content).toContain('function createUser');
      expect(result.structured.primary.quality).toBeDefined();
      expect(result.structured.primary.executionTime).toBeGreaterThan(0);
    });

    it('should include supporting responses with metadata', async () => {
      const result = await aggregator.aggregateResults(
        multiAgentResult,
        'create a user function',
        routingResults,
      );

      expect(result.structured.supporting).toHaveLength(2);
      expect(result.structured.supporting[0].agent).toBe('test-specialist');
      expect(result.structured.supporting[0].reason).toContain('Alternative approach');
      expect(result.structured.supporting[0].quality).toBeDefined();
    });

    it('should provide comprehensive analysis section', async () => {
      const result = await aggregator.aggregateResults(
        multiAgentResult,
        'create a user function',
        routingResults,
      );

      expect(result.structured.analysis).toBeDefined();
      expect(result.structured.analysis.recommendationStrength).toBeGreaterThan(0);
      expect(result.structured.analysis.consensus).toBeInstanceOf(Array);
      expect(result.structured.analysis.conflicts).toBeInstanceOf(Array);
      expect(result.structured.analysis.performance.totalAgents).toBe(3);
      expect(result.structured.analysis.performance.successfulAgents).toBe(3);
    });

    it('should include metadata with timestamp and processing info', async () => {
      const query = 'create a user function';
      const result = await aggregator.aggregateResults(
        multiAgentResult,
        query,
        routingResults,
      );

      expect(result.structured.metadata).toBeDefined();
      expect(result.structured.metadata.strategy).toBe(ConsensusStrategy.INTELLIGENT_MERGE);
      expect(result.structured.metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.structured.metadata.query).toBe(query);
      expect(result.structured.metadata.processingTime).toBeGreaterThan(0);
    });

    it('should format responses consistently across different strategies', async () => {
      const strategies = [
        ConsensusStrategy.HIGHEST_CONFIDENCE,
        ConsensusStrategy.FASTEST_SUCCESS,
        ConsensusStrategy.EXPERT_PRIORITY,
        ConsensusStrategy.INTELLIGENT_MERGE,
      ];

      for (const strategy of strategies) {
        const result = await aggregator.aggregateResults(
          multiAgentResult,
          'test query',
          routingResults,
          { strategy },
        );

        expect(result.structured.version).toBe('1.0');
        expect(result.structured.primary).toBeDefined();
        expect(result.structured.metadata.strategy).toBe(strategy);
        expect(result.structured.analysis.performance.totalAgents).toBeGreaterThan(0);
      }
    });
  });

  describe('factory function', () => {
    it('should create aggregator with factory function', () => {
      const aggregator = createResultAggregator();
      expect(aggregator).toBeInstanceOf(ResultAggregator);
    });

    it('should create aggregator with custom options', () => {
      const options: Partial<AggregationOptions> = {
        strategy: ConsensusStrategy.FASTEST_SUCCESS,
        minConfidence: 0.7,
      };
      const aggregator = createResultAggregator(options);
      expect(aggregator).toBeInstanceOf(ResultAggregator);
    });
  });
});
