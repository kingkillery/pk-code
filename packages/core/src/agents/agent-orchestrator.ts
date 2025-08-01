/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContentGenerator } from '../core/contentGenerator.js';
import type { ParsedAgent, AgentRegistry } from './types.js';
import { AgentRouter } from './agent-router.js';
import {
  AgentExecutor,
  type AgentExecutionResult,
  type ExecutionOptions,
} from './agent-executor.js';
import {
  ResultAggregator,
  type AggregationOptions,
} from './result-aggregator.js';
import { TaskPlanner, type DecompositionRequest, type TaskDAG } from '../orchestrator/TaskPlanner.js';
import { Blackboard } from '../orchestrator/Blackboard.js';
import { 
  ReActFramework, 
  createReActFramework,
  type ReActResponse,
  type ReActCycle,
  type ReActPromptConfig 
} from './react-framework.js';

/**
 * Orchestration mode for query handling
 */
export enum OrchestrationMode {
  /** Single best agent only */
  SINGLE_AGENT = 'single-agent',
  /** Multiple agents with intelligent aggregation */
  MULTI_AGENT = 'multi-agent',
  /** Automatic mode selection based on query complexity */
  AUTO = 'auto',
}

/**
 * Orchestration options
 */
export interface OrchestrationOptions {
  /** Mode for handling the query */
  mode: OrchestrationMode;
  /** Maximum number of agents to use */
  maxAgents?: number;
  /** Routing options */
  routing?: {
    /** Minimum confidence threshold for agent selection */
    minConfidence?: number;
    /** Fallback agent name */
    fallbackAgent?: string;
  };
  /** Execution options */
  execution?: ExecutionOptions;
  /** Aggregation options */
  aggregation?: AggregationOptions;
  /** Performance targets */
  performance?: {
    /** Maximum total execution time in milliseconds */
    maxExecutionTime?: number;
    /** Target confidence level (0-1) */
    targetConfidence?: number;
  };
  /** ReAct framework configuration */
  react?: {
    /** Enable ReAct prompting */
    enabled?: boolean;
    /** ReAct prompt configuration */
    promptConfig?: Partial<ReActPromptConfig>;
    /** Maximum re-prompts for invalid responses */
    maxReprompts?: number;
  };
}

/**
 * Complete orchestration result
 */
export interface OrchestrationResult {
  /** Query that was processed */
  query: string;
  /** Mode used for processing */
  mode: OrchestrationMode;
  /** Routing information */
  routing: {
    strategy: 'single' | 'multi';
    selectedAgents: string[];
    confidence: number;
    reason: string;
  };
  /** Execution results */
  execution: {
    status: 'success' | 'partial' | 'failed';
    duration: number;
    agentResults: AgentExecutionResult[];
  };
  /** Final response */
  response: {
    /** Primary response text */
    text: string;
    /** Response confidence (0-1) */
    confidence: number;
    /** Alternative responses or approaches */
    alternatives?: string[];
    /** Summary of the response generation process */
    summary?: string;
  };
  /** Performance metrics */
  performance: {
    totalDuration: number;
    routingDuration: number;
    executionDuration: number;
    aggregationDuration: number;
    overhead: number;
  };
  /** Metadata about the orchestration */
  metadata: {
    timestamp: Date;
    successfulAgents: number;
    failedAgents: number;
    aggregated: boolean;
    recommendationStrength?: number;
  };
}

/**
 * Main orchestrator that coordinates routing, execution, and aggregation
 */
export class AgentOrchestrator {
  private readonly router: AgentRouter;
  private readonly executor: AgentExecutor;
  private readonly aggregator: ResultAggregator;
  private readonly reactFramework: ReActFramework;

  private readonly planner: TaskPlanner;
  private readonly blackboard: Blackboard;
  private readonly reactCycles: Map<string, ReActCycle[]> = new Map();

  constructor(
    private readonly registry: AgentRegistry,
    private readonly contentGeneratorFactory: (
      agent: ParsedAgent,
    ) => Promise<ContentGenerator>,
    private readonly defaultOptions: Partial<OrchestrationOptions> = {},
  ) {
    // Initialize components
    const fallbackAgent = this.findFallbackAgent();
    this.router = new AgentRouter(registry, fallbackAgent);
    this.executor = new AgentExecutor();
    this.aggregator = new ResultAggregator();
    this.planner = new TaskPlanner(registry);
    this.blackboard = new Blackboard();
    
    // Initialize ReAct framework with configuration
    this.reactFramework = createReActFramework(
      defaultOptions.react?.promptConfig || {
        strictJson: true,
        includeExamples: true,
      }
    );
  }

  /**
   * Process a query using the complete orchestration pipeline
   */
  async processQuery(
    query: string,
    options?: Partial<OrchestrationOptions>,
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const effectiveOptions = { ...this.defaultOptions, ...options };

    // Determine orchestration mode
    const mode = this.determineOrchestrationMode(query, effectiveOptions);

    try {
      let result: OrchestrationResult;

      switch (mode) {
        case OrchestrationMode.SINGLE_AGENT:
          result = await this.processSingleAgent(
            query,
            effectiveOptions,
            startTime,
          );
          break;
        case OrchestrationMode.MULTI_AGENT:
          result = await this.processMultiAgent(
            query,
            effectiveOptions,
            startTime,
          );
          break;
        case OrchestrationMode.AUTO:
        default:
          result = await this.processAutoMode(
            query,
            effectiveOptions,
            startTime,
          );
          break;
      }

      // Validate performance targets
      this.validatePerformanceTargets(result, effectiveOptions);


      // Store results in blackboard
      this.storeResultsInBlackboard(result);

      return result;
    } catch (error) {
      // Create error result
      const totalDuration = Date.now() - startTime;

      return {
        query,
        mode,
        routing: {
          strategy: 'single',
          selectedAgents: [],
          confidence: 0,
          reason: 'Orchestration failed',
        },
        execution: {
          status: 'failed',
          duration: totalDuration,
          agentResults: [],
        },
        response: {
          text: `Error processing query: ${error instanceof Error ? error.message : 'Unknown error'}`,
          confidence: 0,
        },
        performance: {
          totalDuration,
          routingDuration: 0,
          executionDuration: 0,
          aggregationDuration: 0,
          overhead: totalDuration,
        },
        metadata: {
          timestamp: new Date(),
          successfulAgents: 0,
          failedAgents: 0,
          aggregated: false,
        },
      };
    }
  }

  /**
   * Process query using single agent mode
   */
  private async processSingleAgent(
    query: string,
    options: Partial<OrchestrationOptions>,
    startTime: number,
  ): Promise<OrchestrationResult> {
    const routingStart = Date.now();

    // Route to single best agent
    const routingResult = await this.router.routeSingleAgent(query);
    const routingDuration = Date.now() - routingStart;

    // Execute single agent
    const executionStart = Date.now();
    let executionResult: AgentExecutionResult;
    
    // Check if ReAct is enabled
    if (options.react?.enabled) {
      // Initialize react cycles for this agent if not already done
      if (!this.reactCycles.has(routingResult.agent.config.name)) {
        this.reactCycles.set(routingResult.agent.config.name, []);
      }
      
      // Use ReAct framework for execution
      executionResult = await this.executeWithReAct(
        routingResult.agent,
        query,
        {
          ...options.execution,
          react: options.react,
        } as ExecutionOptions & { react?: { maxReprompts?: number } },
      );
    } else {
      // Use standard execution
      const executionOptions: ExecutionOptions = {
        ...options.execution,
        contentGeneratorFactory: this.contentGeneratorFactory,
      };
      
      executionResult = await this.executor.executeSingleAgent(
        routingResult,
        query,
        executionOptions,
      );
    }
    const executionDuration = Date.now() - executionStart;

    // Extract response
    const responseText = this.extractResponseText(executionResult);
    const totalDuration = Date.now() - startTime;

    return {
      query,
      mode: OrchestrationMode.SINGLE_AGENT,
      routing: {
        strategy: 'single',
        selectedAgents: [routingResult.agent.config.name],
        confidence: routingResult.confidence,
        reason: routingResult.reason,
      },
      execution: {
        status: executionResult.status === 'success' ? 'success' : 'failed',
        duration: executionDuration,
        agentResults: [executionResult],
      },
      response: {
        text: responseText,
        confidence: routingResult.confidence,
        alternatives: routingResult.alternatives
          .slice(0, 2)
          .map((alt) => `${alt.agent.config.name}: ${alt.reason}`),
      },
      performance: {
        totalDuration,
        routingDuration,
        executionDuration,
        aggregationDuration: 0,
        overhead: totalDuration - routingDuration - executionDuration,
      },
      metadata: {
        timestamp: new Date(),
        successfulAgents: executionResult.status === 'success' ? 1 : 0,
        failedAgents: executionResult.status === 'success' ? 0 : 1,
        aggregated: false,
      },
    };
  }

  /**
   * Process query using multi-agent mode
   */
  private async processMultiAgent(
    query: string,
    options: Partial<OrchestrationOptions>,
    startTime: number,
  ): Promise<OrchestrationResult> {
    const routingStart = Date.now();

    // Route to multiple agents
    const maxAgents = options.maxAgents || 3;
    const multiRoutingResult = await this.router.routeMultipleAgents(
      query,
      maxAgents,
    );
    const routingDuration = Date.now() - routingStart;

    // Execute multiple agents
    const executionStart = Date.now();
    const executionOptions: ExecutionOptions = {
      ...options.execution,
      contentGeneratorFactory: this.contentGeneratorFactory,
      aggregateResults: true,
    };

    const multiExecutionResult = await this.executor.executeMultipleAgents(
      multiRoutingResult,
      query,
      executionOptions,
    );
    const executionDuration = Date.now() - executionStart;

    // Aggregate results
    const aggregationStart = Date.now();
    const allRoutingResults = [
      ...multiRoutingResult.primaryAgents,
      ...multiRoutingResult.secondaryAgents,
    ];

    const aggregatedResponse = await this.aggregator.aggregateResults(
      multiExecutionResult,
      query,
      allRoutingResults,
      options.aggregation,
    );
    const aggregationDuration = Date.now() - aggregationStart;

    // Extract final response
    const responseText = this.extractResponseText({
      status: 'success',
      response: aggregatedResponse.primary,
    } as AgentExecutionResult);

    const totalDuration = Date.now() - startTime;
    const allResults = [
      ...multiExecutionResult.primaryResults,
      ...multiExecutionResult.secondaryResults,
    ];

    return {
      query,
      mode: OrchestrationMode.MULTI_AGENT,
      routing: {
        strategy: 'multi',
        selectedAgents: allRoutingResults.map((r) => r.agent.config.name),
        confidence: aggregatedResponse.confidence,
        reason: `Multi-agent routing with ${multiRoutingResult.strategy} execution`,
      },
      execution: {
        status: multiExecutionResult.status,
        duration: executionDuration,
        agentResults: allResults,
      },
      response: {
        text: responseText,
        confidence: aggregatedResponse.confidence,
        alternatives: aggregatedResponse.alternatives,
        summary: aggregatedResponse.summary,
      },
      performance: {
        totalDuration,
        routingDuration,
        executionDuration,
        aggregationDuration,
        overhead:
          totalDuration -
          routingDuration -
          executionDuration -
          aggregationDuration,
      },
      metadata: {
        timestamp: new Date(),
        successfulAgents: multiExecutionResult.metadata.successfulAgents,
        failedAgents: multiExecutionResult.metadata.failedAgents,
        aggregated: true,
        recommendationStrength: aggregatedResponse.recommendationStrength,
      },
    };
  }

  /**
   * Process query using auto mode
   */
  private async processAutoMode(
    query: string,
    options: Partial<OrchestrationOptions>,
    startTime: number,
  ): Promise<OrchestrationResult> {
    // Analyze query complexity to decide between single and multi-agent
    const complexity = this.analyzeQueryComplexity(query);

    if (complexity.score > 7 || complexity.requiresMultipleExpertise) {
      // Use multi-agent for complex queries
      return this.processMultiAgent(
        query,
        {
          ...options,
          mode: OrchestrationMode.MULTI_AGENT,
        },
        startTime,
      );
    } else {
      // Use single agent for simple queries
      return this.processSingleAgent(
        query,
        {
          ...options,
          mode: OrchestrationMode.SINGLE_AGENT,
        },
        startTime,
      );
    }
  }

  /**
   * Execute agent with ReAct framework
   */
  private async executeWithReAct(
    agent: ParsedAgent,
    query: string,
    options: ExecutionOptions & { react?: { maxReprompts?: number } },
  ): Promise<AgentExecutionResult> {
    const executionStartTime = Date.now();
    let prompt = this.reactFramework.enhancePrompt(query, agent);
    let attempt = 0;
    while (attempt <= (options.react?.maxReprompts || 2)) {
      const apiStartTime = Date.now();
      const response = await this.contentGeneratorFactory(agent).then((generator) =>
        generator.generateContent({ 
          model: agent.config.model || 'gpt-4',
          contents: [{ role: 'user', parts: [{ text: prompt }] }] 
        })
      );
      const apiDuration = Date.now() - apiStartTime;

      // Parse ReAct response
      const reactResponse = this.reactFramework.parseResponse(response);

      if (reactResponse.action.type !== 'error') {
        // Log cycle
        this.reactCycles.get(agent.config.name)?.push(
          this.reactFramework.createCycle(query, reactResponse.thought, reactResponse.action)
        );

        const totalDuration = Date.now() - executionStartTime;
        return {
          agent,
          status: 'success',
          response,
          duration: totalDuration,
          startTime: new Date(executionStartTime),
          taskId: `task-${agent.config.name}-${Date.now()}`,
          artifacts: [],
          metadata: { apiDuration },
        };
      }

      // Handle error and re-prompt
      const errorMessage = reactResponse.action.message || 'Invalid response format';
      prompt = this.reactFramework.createReprompt(errorMessage, reactResponse.raw || '');

      attempt++;
    }

    // Max re-prompt attempts reached
    const totalDuration = Date.now() - executionStartTime;
    return {
      agent,
      status: 'error',
      error: { message: 'Max re-prompt attempts reached' },
      duration: totalDuration,
      startTime: new Date(executionStartTime),
      taskId: `task-${agent.config.name}-${Date.now()}`,
      artifacts: [],
      metadata: {},
    };
  }

  /**
   * Decompose a request into a DAG of tasks and schedule agents
   */
  async planAndExecuteTasks(query: string, options?: Partial<OrchestrationOptions>): Promise<void> {
    // Decompose query into tasks
    const decompositionRequest: DecompositionRequest = {
      query,
      availableAgents: this.registry.getAgents(),
    };
    const { dag } = await this.planner.decomposeQuery(decompositionRequest);

    // Monitor and execute tasks
    await this.executeTasks(dag);
  }

  /**
   * Execute tasks in a DAG
   */
  private async executeTasks(dag: TaskDAG): Promise<void> {
    const readyTasks = this.planner.getReadyTasks(dag);
    for (const task of readyTasks) {
      try {
        // Assign agent and execute
        const routingResult = await this.router.routeTask({ 
          id: task.id, 
          query: task.description 
        });
        
        // Determine agent from routing result
        let agent: ParsedAgent;
        if ('primaryAgents' in routingResult) {
          // MultiAgentRoutingResult
          if (routingResult.primaryAgents.length === 0) {
            throw new Error('No agents available for task');
          }
          agent = routingResult.primaryAgents[0].agent;
        } else {
          // RoutingResult
          agent = routingResult.agent;
        }
        
        this.blackboard.assignTask(task.id, agent.config.name);
        await this.executor.executeTask(agent, { id: task.id, query: task.description });
        this.planner.completeTask(dag, task.id);

        // Log and notify completion
        this.blackboard.updateTaskStatus(task.id, 'completed', agent.config.name);
        console.log(`✅ Completed task: ${task.title}`);
      } catch (error) {
        // Handle task failure
        this.planner.failTask(dag, task.id, error instanceof Error ? error.message : 'Unknown error');
        console.error(`❌ Failed task: ${task.title}`, error);
      }
    }
  }

  /**
   * Store results in the blackboard
   */
  private storeResultsInBlackboard(result: OrchestrationResult): void {
    // Extract and store artifacts and task status
    for (const agentResult of result.execution.agentResults) {
      if (agentResult.artifacts) {
        for (const artifact of agentResult.artifacts) {
          // Convert simple artifact to full Artifact structure
          this.blackboard.createArtifact({
            name: `Artifact ${artifact.id}`,
            type: (artifact.type as 'file' | 'document' | 'data' | 'report' | 'config' | 'schema' | 'other') || 'other',
            content: artifact.content,
            createdBy: agentResult.taskId,
            tags: ['agent-generated', agentResult.agent.config.name],
            dependencies: [],
            metadata: {
              agentName: agentResult.agent.config.name,
              executionDuration: agentResult.duration,
              originalArtifactId: artifact.id,
            },
          });
        }
      }

      // Update task status (map AgentExecutionResult status to TaskStatus)
      const taskStatus: 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'blocked' = 
        agentResult.status === 'success' ? 'completed' :
        agentResult.status === 'error' ? 'failed' :
        agentResult.status === 'timeout' ? 'failed' :
        agentResult.status === 'cancelled' ? 'blocked' : 'failed';
      
      this.blackboard.updateTaskStatus(agentResult.taskId, taskStatus, agentResult.agent.config.name);
    }
  }

  /**
   * Analyze query complexity to determine best orchestration approach
   */
  private analyzeQueryComplexity(query: string): {
    score: number;
    requiresMultipleExpertise: boolean;
    factors: string[];
  } {
    let score = 1;
    const factors: string[] = [];

    // Length factor
    if (query.length > 200) {
      score += 2;
      factors.push('Long query');
    } else if (query.length > 100) {
      score += 1;
      factors.push('Medium-length query');
    }

    // Multiple questions/requirements
    const questionMarks = (query.match(/\?/g) || []).length;
    const andConnectors = (
      query.match(/\band\b|\balso\b|\badditionally\b/gi) || []
    ).length;
    if (questionMarks > 1 || andConnectors > 2) {
      score += 3;
      factors.push('Multiple requirements');
    }

    // Technical complexity indicators
    const complexIndicators = [
      'architecture',
      'design pattern',
      'optimization',
      'performance',
      'scalability',
      'security',
      'integration',
      'microservice',
      'database',
      'algorithm',
      'data structure',
    ];
    const complexMatches = complexIndicators.filter((indicator) =>
      query.toLowerCase().includes(indicator),
    ).length;
    score += complexMatches;
    if (complexMatches > 0) {
      factors.push('Technical complexity');
    }

    // Multiple technologies mentioned
    const technologies = [
      'react',
      'vue',
      'angular',
      'node',
      'python',
      'java',
      'go',
      'docker',
      'kubernetes',
      'aws',
      'azure',
      'gcp',
    ];
    const techMatches = technologies.filter((tech) =>
      query.toLowerCase().includes(tech),
    ).length;

    const requiresMultipleExpertise = techMatches > 2 || complexMatches > 2;
    if (requiresMultipleExpertise) {
      score += 2;
      factors.push('Multiple expertise areas');
    }

    return {
      score: Math.min(score, 10),
      requiresMultipleExpertise,
      factors,
    };
  }

  /**
   * Determine the appropriate orchestration mode
   */
  private determineOrchestrationMode(
    query: string,
    options: Partial<OrchestrationOptions>,
  ): OrchestrationMode {
    if (options.mode && options.mode !== OrchestrationMode.AUTO) {
      return options.mode;
    }

    // Check for explicit multi-agent indicators
    if (
      query.includes('compare') ||
      query.includes('alternatives') ||
      query.includes('different approaches') ||
      query.includes('pros and cons')
    ) {
      return OrchestrationMode.MULTI_AGENT;
    }

    // Default to auto mode for intelligent selection
    return OrchestrationMode.AUTO;
  }

  /**
   * Find fallback agent for routing
   */
  private findFallbackAgent(): ParsedAgent | undefined {
    const agents = this.registry.getAgents();

    // Look for a general-purpose agent
    const generalAgent = agents.find((agent) =>
      agent.config.keywords.some(
        (k) =>
          k.toLowerCase().includes('general') ||
          k.toLowerCase().includes('assistant') ||
          k.toLowerCase().includes('help'),
      ),
    );

    if (generalAgent) return generalAgent;

    // Fallback to the first available agent
    return agents.length > 0 ? agents[0] : undefined;
  }

  /**
   * Extract response text from execution result
   */
  private extractResponseText(result: AgentExecutionResult): string {
    if (result.status !== 'success' || !result.response) {
      return result.error?.message || 'Failed to generate response';
    }

    return (
      result.response.candidates?.[0]?.content?.parts?.[0]?.text ||
      'No response content available'
    );
  }

  /**
   * Validate performance targets and log warnings
   */
  private validatePerformanceTargets(
    result: OrchestrationResult,
    options: Partial<OrchestrationOptions>,
  ): void {
    const targets = options.performance;
    if (!targets) return;

    if (
      targets.maxExecutionTime &&
      result.performance.totalDuration > targets.maxExecutionTime
    ) {
      console.warn(
        `Execution time ${result.performance.totalDuration}ms exceeded target ${targets.maxExecutionTime}ms`,
      );
    }

    if (
      targets.targetConfidence &&
      result.response.confidence < targets.targetConfidence
    ) {
      console.warn(
        `Response confidence ${result.response.confidence} below target ${targets.targetConfidence}`,
      );
    }

    // Check overhead target (≤400ms)
    if (result.performance.overhead > 400) {
      console.warn(
        `Orchestration overhead ${result.performance.overhead}ms exceeded 400ms target`,
      );
    }
  }

  /**
   * Get orchestration statistics
   */
  getStatistics(): {
    availableAgents: number;
    routerStats: {
      totalRoutes: number;
      averageConfidence: number;
    };
    executorStats: {
      totalExecutions: number;
      averageExecutionTime: number;
      successRate: number;
    };
  } {
    return {
      availableAgents: this.registry.size(),
      routerStats: {
        totalRoutes: 0, // Would be tracked in a real implementation
        averageConfidence: 0, // Would be calculated from historical data
      },
      executorStats: {
        totalExecutions: 0, // Would be tracked in a real implementation
        averageExecutionTime: 0, // Would be calculated from historical data
        successRate: 0, // Would be calculated from historical data
      },
    };
  }
}

/**
 * Factory function to create an orchestrator
 */
export function createAgentOrchestrator(
  registry: AgentRegistry,
  contentGeneratorFactory: (agent: ParsedAgent) => Promise<ContentGenerator>,
  defaultOptions?: Partial<OrchestrationOptions>,
): AgentOrchestrator {
  return new AgentOrchestrator(
    registry,
    contentGeneratorFactory,
    defaultOptions,
  );
}
