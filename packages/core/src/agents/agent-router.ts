/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ParsedAgent, AgentRegistry } from './types.js';

/**
 * Confidence levels for agent routing decisions
 */
export enum RoutingConfidence {
  /** Exact match or explicit agent invocation */
  EXACT = 1.0,
  /** High keyword match or strong semantic similarity */
  HIGH = 0.8,
  /** Moderate keyword match */
  MEDIUM = 0.6,
  /** Low match or fallback candidate */
  LOW = 0.4,
  /** No relevant match found */
  NONE = 0.0,
}

/**
 * Result of agent routing analysis
 */
export interface RoutingResult {
  /** Selected agent for execution */
  agent: ParsedAgent;
  /** Confidence score for the routing decision */
  confidence: RoutingConfidence;
  /** Reason for the routing decision */
  reason: string;
  /** Alternative agents that could handle the query */
  alternatives: Array<{
    agent: ParsedAgent;
    confidence: RoutingConfidence;
    reason: string;
  }>;
}

/**
 * Multi-agent routing result for parallel execution
 */
export interface MultiAgentRoutingResult {
  /** Primary agents for execution */
  primaryAgents: RoutingResult[];
  /** Secondary agents that could provide additional value */
  secondaryAgents: RoutingResult[];
  /** Execution strategy recommendation */
  strategy: 'sequential' | 'parallel' | 'prioritized';
  /** Estimated execution time in milliseconds */
  estimatedDuration: number;
}

/**
 * Query analysis for routing decisions
 */
interface QueryAnalysis {
  /** Extracted keywords from the query */
  keywords: string[];
  /** Detected query intent */
  intent:
    | 'code-generation'
    | 'debugging'
    | 'testing'
    | 'documentation'
    | 'analysis'
    | 'general';
  /** Complexity score (1-10) */
  complexity: number;
  /** Whether the query mentions specific technologies */
  technologies: string[];
  /** Whether explicit agent invocation was detected */
  explicitAgent?: string;
}

/**
 * Intelligent agent router that selects the best agent(s) for a given query
 */
export class AgentRouter {
  private readonly registry: AgentRegistry;
  private readonly fallbackAgent?: ParsedAgent;

  constructor(registry: AgentRegistry, fallbackAgent?: ParsedAgent) {
    this.registry = registry;
    this.fallbackAgent = fallbackAgent;
  }

  /**
   * Route a query to the most appropriate single agent
   */
  async routeSingleAgent(query: string): Promise<RoutingResult> {
    const analysis = this.analyzeQuery(query);

    // Handle explicit agent invocation (pk use <agent>: "query")
    if (analysis.explicitAgent) {
      const explicitAgent = this.registry.getAgent(analysis.explicitAgent);
      if (explicitAgent) {
        return {
          agent: explicitAgent,
          confidence: RoutingConfidence.EXACT,
          reason: `Explicitly requested agent: ${analysis.explicitAgent}`,
          alternatives: [],
        };
      }
    }

    // Score all agents against the query
    const scoredAgents = this.scoreAgents(analysis);

    if (scoredAgents.length === 0) {
      if (this.fallbackAgent) {
        return {
          agent: this.fallbackAgent,
          confidence: RoutingConfidence.LOW,
          reason: 'No specific agent match found, using fallback',
          alternatives: [],
        };
      }
      throw new Error(
        'No suitable agent found for query and no fallback available',
      );
    }

    // Use fallback only if the best match has very low confidence
    if (
      scoredAgents[0].confidence < RoutingConfidence.LOW &&
      this.fallbackAgent
    ) {
      return {
        agent: this.fallbackAgent,
        confidence: RoutingConfidence.LOW,
        reason: 'No adequate agent match found, using fallback',
        alternatives: scoredAgents.slice(0, 3).map((scored) => ({
          agent: scored.agent,
          confidence: scored.confidence,
          reason: scored.reason,
        })),
      };
    }

    const best = scoredAgents[0];
    const alternatives = scoredAgents.slice(1, 4).map((scored) => ({
      agent: scored.agent,
      confidence: scored.confidence,
      reason: scored.reason,
    }));

    return {
      agent: best.agent,
      confidence: best.confidence,
      reason: best.reason,
      alternatives,
    };
  }

  /**
   * Route a query to multiple agents for parallel execution
   */
  async routeMultipleAgents(
    query: string,
    maxAgents: number = 3,
  ): Promise<MultiAgentRoutingResult> {
    const analysis = this.analyzeQuery(query);

    // Handle explicit agent invocation
    if (analysis.explicitAgent) {
      const singleResult = await this.routeSingleAgent(query);
      return {
        primaryAgents: [singleResult],
        secondaryAgents: [],
        strategy: 'sequential',
        estimatedDuration: this.estimateExecutionTime([singleResult.agent]),
      };
    }

    const scoredAgents = this.scoreAgents(analysis);

    // Group agents by confidence levels
    const highConfidence = scoredAgents.filter(
      (s) => s.confidence >= RoutingConfidence.HIGH,
    );
    const mediumConfidence = scoredAgents.filter(
      (s) =>
        s.confidence >= RoutingConfidence.MEDIUM &&
        s.confidence < RoutingConfidence.HIGH,
    );

    // Select primary agents (high confidence, up to maxAgents)
    const primaryAgents = highConfidence.slice(0, maxAgents).map((scored) => ({
      agent: scored.agent,
      confidence: scored.confidence,
      reason: scored.reason,
      alternatives: [] as Array<{
        agent: ParsedAgent;
        confidence: RoutingConfidence;
        reason: string;
      }>,
    }));

    // Select secondary agents (medium confidence, fill remaining slots)
    const remainingSlots = maxAgents - primaryAgents.length;
    const secondaryAgents = mediumConfidence
      .slice(0, remainingSlots)
      .map((scored) => ({
        agent: scored.agent,
        confidence: scored.confidence,
        reason: scored.reason,
        alternatives: [] as Array<{
          agent: ParsedAgent;
          confidence: RoutingConfidence;
          reason: string;
        }>,
      }));

    // Determine execution strategy
    let strategy: 'sequential' | 'parallel' | 'prioritized' = 'parallel';
    if (primaryAgents.length === 1) {
      strategy = 'sequential';
    } else if (analysis.complexity > 7) {
      strategy = 'prioritized';
    }

    const allSelectedAgents = [...primaryAgents, ...secondaryAgents].map(
      (s) => s.agent,
    );

    return {
      primaryAgents,
      secondaryAgents,
      strategy,
      estimatedDuration: this.estimateExecutionTime(allSelectedAgents),
    };
  }

  /**
   * Validate if an agent can handle a specific query type
   */
  validateAgentCapability(agent: ParsedAgent, query: string): boolean {
    const analysis = this.analyzeQuery(query);

    // Check if agent has required tools for the query intent
    const requiredTools = this.getRequiredToolsForIntent(analysis.intent);
    const agentTools = agent.config.tools.map((t) => t.name.toLowerCase());

    const hasRequiredTools = requiredTools.every((tool) =>
      agentTools.some((agentTool) => agentTool.includes(tool)),
    );

    // Check technology compatibility
    const hasTechSupport =
      analysis.technologies.length === 0 ||
      analysis.technologies.some((tech) =>
        agent.config.keywords.some((keyword) =>
          keyword.toLowerCase().includes(tech.toLowerCase()),
        ),
      );

    return hasRequiredTools && hasTechSupport;
  }

  /**
   * Analyze query to extract routing-relevant information
   */
  private analyzeQuery(query: string): QueryAnalysis {
    // Check for explicit agent invocation pattern
    const explicitMatch = query.match(
      /pk\s+use\s+([a-zA-Z0-9-_]+):\s*"([^"]+)"/,
    );
    const explicitAgent = explicitMatch ? explicitMatch[1] : undefined;
    const actualQuery = explicitMatch ? explicitMatch[2] : query;

    // Extract keywords (remove common words)
    const commonWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'can',
      'this',
      'that',
      'these',
      'those',
    ]);
    const keywords = actualQuery
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !commonWords.has(word))
      .slice(0, 10);

    // Detect intent - order matters for priority, more specific intents first
    let intent: QueryAnalysis['intent'] = 'general';
    if (
      /\b(test|testing|spec|verify|validate|unit|integration)\s+(for|of|my)\b/i.test(
        actualQuery,
      ) ||
      /\b(create|write|build|make)\s+(unit|integration|end.*to.*end|e2e|spec|tests?)\b/i.test(
        actualQuery,
      )
    ) {
      intent = 'testing';
    } else if (
      /\b(fix|debug|troubleshoot)\s+(this|my|the)?\s*(error|bug|issue|problem)\b/i.test(
        actualQuery,
      ) ||
      /\b(error|bug|issue|problem)\s+(in|with|on)\s+(my|this|the)\s+(code|app|function|component)\b/i.test(
        actualQuery,
      )
    ) {
      intent = 'debugging';
    } else if (
      /\b(write|create|generate|update|add)\s+(docs?|documentation|readme|comments?)\s+(for|about|of)\b/i.test(
        actualQuery,
      ) ||
      /\b(document|docs)\s+(this|my|the)\s+(component|function|api|code)\b/i.test(
        actualQuery,
      )
    ) {
      intent = 'documentation';
    } else if (
      /\b(generate|create|write|build|make)\s+(a|an|some)?\s*(function|class|component|code|app|program|script)\b/i.test(
        actualQuery,
      ) ||
      /\b(code|implement|develop)\s+(a|an|some)?\s*(function|class|component|feature)\b/i.test(
        actualQuery,
      )
    ) {
      intent = 'code-generation';
    } else if (
      /\b(analyze|review|check|examine|inspect)\b/i.test(actualQuery)
    ) {
      intent = 'analysis';
    }

    // Calculate complexity based on query characteristics
    let complexity = 1;
    complexity += Math.min(keywords.length / 10, 3); // More keywords = more complex
    complexity +=
      actualQuery.length > 100 ? 2 : actualQuery.length > 50 ? 1 : 0;
    complexity += (actualQuery.match(/\band\b|\bor\b|\bwith\b/gi) || []).length; // Multiple requirements
    complexity = Math.min(complexity, 10);

    // Detect technologies
    const techPatterns = [
      /\b(react|vue|angular|svelte)\b/i,
      /\b(node|express|fastify|koa)\b/i,
      /\b(typescript|javascript|python|java|go|rust|c\+\+)\b/i,
      /\b(docker|kubernetes|aws|gcp|azure)\b/i,
      /\b(mysql|postgres|mongodb|redis)\b/i,
    ];
    const technologies: string[] = [];
    for (const pattern of techPatterns) {
      const matches = actualQuery.match(pattern);
      if (matches) {
        technologies.push(...matches.map((m) => m.toLowerCase()));
      }
    }

    return {
      keywords,
      intent,
      complexity,
      technologies,
      explicitAgent,
    };
  }

  /**
   * Score all available agents against a query analysis
   */
  private scoreAgents(analysis: QueryAnalysis): Array<{
    agent: ParsedAgent;
    confidence: RoutingConfidence;
    reason: string;
  }> {
    const agents = this.registry.getAgents();
    const scored: Array<{
      agent: ParsedAgent;
      score: number;
      confidence: RoutingConfidence;
      reason: string;
    }> = [];

    for (const agent of agents) {
      const score = this.calculateAgentScore(agent, analysis);

      let confidence: RoutingConfidence;
      let reason: string;

      if (score >= 0.9) {
        confidence = RoutingConfidence.EXACT;
        reason = 'Exact match for requirements';
      } else if (score >= 0.7) {
        confidence = RoutingConfidence.HIGH;
        reason = 'Strong keyword and capability match';
      } else if (score >= 0.5) {
        confidence = RoutingConfidence.MEDIUM;
        reason = 'Moderate keyword match';
      } else if (score >= 0.3) {
        confidence = RoutingConfidence.LOW;
        reason = 'Basic capability match';
      } else {
        continue; // Skip agents with very low scores
      }

      scored.push({ agent, score, confidence, reason });
    }

    // Sort by score (descending) and then by priority (ascending)
    return scored
      .sort((a, b) => {
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        // Lower priority number means higher priority
        return (
          (a.agent.config.priority ?? 999) - (b.agent.config.priority ?? 999)
        );
      })
      .map(({ agent, confidence, reason }) => ({ agent, confidence, reason }));
  }

  /**
   * Calculate numeric score for an agent against query analysis
   */
  private calculateAgentScore(
    agent: ParsedAgent,
    analysis: QueryAnalysis,
  ): number {
    let score = 0;

    // Keyword matching (40% weight)
    const keywordScore = this.calculateKeywordScore(agent, analysis.keywords);
    score += keywordScore * 0.4;

    // Intent matching (30% weight)
    const intentScore = this.calculateIntentScore(agent, analysis.intent);
    score += intentScore * 0.3;

    // Technology matching (20% weight)
    const techScore = this.calculateTechnologyScore(
      agent,
      analysis.technologies,
    );
    score += techScore * 0.2;

    // Tool capability matching (10% weight)
    const toolScore = this.calculateToolScore(agent, analysis.intent);
    score += toolScore * 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate keyword matching score
   */
  private calculateKeywordScore(
    agent: ParsedAgent,
    queryKeywords: string[],
  ): number {
    if (queryKeywords.length === 0) return 0.5; // Neutral score for empty keywords

    const agentKeywords = agent.config.keywords.map((k) => k.toLowerCase());
    const agentName = agent.config.name.toLowerCase();
    const agentDescription = agent.config.description.toLowerCase();

    let score = 0;
    const queryKeywordSet = new Set(queryKeywords);

    // Direct keyword matches (high weight)
    const matchedKeywords = agentKeywords.filter((ak) =>
      queryKeywordSet.has(ak),
    );
    score += (matchedKeywords.length / queryKeywordSet.size) * 0.6;

    // Partial matches and name/description matches (lower weight)
    let partialMatchScore = 0;
    for (const keyword of queryKeywords) {
      if (
        agentKeywords.some((ak) => ak.includes(keyword) || keyword.includes(ak))
      ) {
        partialMatchScore += 0.2;
      }
      if (agentName.includes(keyword) || agentDescription.includes(keyword)) {
        partialMatchScore += 0.1;
      }
    }
    score += Math.min(partialMatchScore / queryKeywordSet.size, 0.4);

    // Bonus for high match density
    if (matchedKeywords.length > 0) {
      const density = matchedKeywords.length / agentKeywords.length;
      score += density * 0.2;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate intent matching score
   */
  private calculateIntentScore(
    agent: ParsedAgent,
    intent: QueryAnalysis['intent'],
  ): number {
    const relevantKeywords = this.getIntentKeywords(intent);
    const agentText = [
      agent.config.name,
      agent.config.description,
      ...agent.config.keywords,
    ]
      .join(' ')
      .toLowerCase();

    const matches = relevantKeywords.filter((keyword) =>
      agentText.includes(keyword),
    ).length;

    return matches / relevantKeywords.length;
  }

  /**
   * Calculate technology matching score
   */
  private calculateTechnologyScore(
    agent: ParsedAgent,
    technologies: string[],
  ): number {
    if (technologies.length === 0) return 1.0; // No specific tech requirements

    const agentText = [
      agent.config.name,
      agent.config.description,
      ...agent.config.keywords,
    ]
      .join(' ')
      .toLowerCase();

    const matches = technologies.filter((tech) =>
      agentText.includes(tech),
    ).length;

    return matches / technologies.length;
  }

  /**
   * Calculate tool capability score
   */
  private calculateToolScore(
    agent: ParsedAgent,
    intent: QueryAnalysis['intent'],
  ): number {
    const requiredTools = this.getRequiredToolsForIntent(intent);
    const agentTools = agent.config.tools.map((t) => t.name.toLowerCase());

    if (requiredTools.length === 0) return 1.0;

    const hasTools = requiredTools.filter((tool) =>
      agentTools.some((agentTool) => agentTool.includes(tool)),
    ).length;

    return hasTools / requiredTools.length;
  }

  /**
   * Get required tools for a specific intent
   */
  private getRequiredToolsForIntent(intent: QueryAnalysis['intent']): string[] {
    switch (intent) {
      case 'code-generation':
        return ['edit', 'write', 'create'];
      case 'debugging':
        return ['read', 'grep', 'shell', 'debug'];
      case 'testing':
        return ['shell', 'read', 'test'];
      case 'documentation':
        return ['read', 'write', 'edit'];
      case 'analysis':
        return ['read', 'grep', 'search'];
      default:
        return [];
    }
  }

  private getIntentKeywords(intent: QueryAnalysis['intent']): string[] {
    switch (intent) {
      case 'code-generation':
        return ['generate', 'create', 'build', 'code', 'development'];
      case 'debugging':
        return ['debug', 'fix', 'troubleshoot', 'error', 'bug'];
      case 'testing':
        return ['test', 'spec', 'verification', 'quality'];
      case 'documentation':
        return ['docs', 'documentation', 'readme', 'comment'];
      case 'analysis':
        return ['analyze', 'review', 'audit', 'inspect'];
      case 'general':
        return ['general', 'assistant', 'help'];
      default:
        return [];
    }
  }

  /**
   * Estimate execution time for a set of agents
   */
  private estimateExecutionTime(agents: ParsedAgent[]): number {
    // Base time per agent (in milliseconds)
    const baseTime = 2000;

    // Additional time based on agent complexity
    const complexityTime = agents.reduce(
      (total, agent) => total + agent.config.tools.length * 100,
      0,
    );

    // Parallel execution reduces total time
    const parallelFactor = agents.length > 1 ? 0.7 : 1.0;

    return Math.round((baseTime + complexityTime) * parallelFactor);
  }
}

/**
 * Factory function to create an agent router
 */
export function createAgentRouter(
  registry: AgentRegistry,
  fallbackAgent?: ParsedAgent,
): AgentRouter {
  return new AgentRouter(registry, fallbackAgent);
}
