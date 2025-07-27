/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GenerateContentResponse } from '@google/genai';
import type {
  AgentExecutionResult,
  MultiAgentExecutionResult,
  AggregatedResponse,
} from './agent-executor.js';
import type { ParsedAgent } from './types.js';
import type { RoutingResult } from './agent-router.js';

/**
 * Consensus strategy for result aggregation
 */
export enum ConsensusStrategy {
  /** Use the highest confidence result */
  HIGHEST_CONFIDENCE = 'highest-confidence',
  /** Use majority consensus */
  MAJORITY_CONSENSUS = 'majority-consensus',
  /** Combine all results intelligently */
  INTELLIGENT_MERGE = 'intelligent-merge',
  /** Use the fastest successful result */
  FASTEST_SUCCESS = 'fastest-success',
  /** Use expert agent priority */
  EXPERT_PRIORITY = 'expert-priority',
}

/**
 * Aggregation options
 */
export interface AggregationOptions {
  /** Strategy to use for consensus */
  strategy: ConsensusStrategy;
  /** Minimum confidence threshold to include a result */
  minConfidence?: number;
  /** Maximum number of alternatives to include */
  maxAlternatives?: number;
  /** Whether to include conflicting opinions */
  includeConflicts?: boolean;
  /** Custom scoring weights */
  weights?: {
    confidence: number;
    speed: number;
    agentExpertise: number;
    responseQuality: number;
  };
  /** Custom agent priorities (agent name -> priority score) */
  agentPriorities?: Record<string, number>;
}

/**
 * Quality metrics for response evaluation
 */
export interface ResponseQuality {
  /** Length score (0-1, optimal length gets higher score) */
  lengthScore: number;
  /** Completeness score (0-1, based on addressing query components) */
  completenessScore: number;
  /** Specificity score (0-1, specific answers score higher) */
  specificityScore: number;
  /** Coherence score (0-1, well-structured responses score higher) */
  coherenceScore: number;
  /** Code quality score (0-1, for code generation tasks) */
  codeQualityScore?: number;
  /** Overall quality score (0-1) */
  overallScore: number;
}

/**
 * Conflict detection result
 */
export interface ConflictAnalysis {
  /** Whether conflicts were detected */
  hasConflicts: boolean;
  /** Conflicting aspects */
  conflicts: Array<{
    aspect: string;
    agentOpinions: Array<{
      agent: string;
      opinion: string;
      confidence: number;
    }>;
  }>;
  /** Consensus aspects */
  consensus: Array<{
    aspect: string;
    agreement: string;
    supportingAgents: string[];
  }>;
}

/**
 * Structured response format for multi-agent output
 */
export interface StructuredResponse {
  /** Response format version */
  version: string;
  /** Primary recommendation */
  primary: {
    /** Agent that provided this response */
    agent: string;
    /** Agent's confidence in routing */
    confidence: number;
    /** Response content */
    content: string;
    /** Response quality metrics */
    quality: ResponseQuality;
    /** Execution time for this agent */
    executionTime: number;
  };
  /** Supporting responses */
  supporting: Array<{
    /** Agent name */
    agent: string;
    /** Agent's confidence */
    confidence: number;
    /** Response content */
    content: string;
    /** Quality metrics */
    quality: ResponseQuality;
    /** Execution time */
    executionTime: number;
    /** Reason for being secondary */
    reason: string;
  }>;
  /** Aggregation analysis */
  analysis: {
    /** Overall recommendation strength */
    recommendationStrength: number;
    /** Consensus areas */
    consensus: string[];
    /** Conflicting viewpoints */
    conflicts: string[];
    /** Performance summary */
    performance: {
      totalAgents: number;
      successfulAgents: number;
      totalExecutionTime: number;
      aggregationOverhead: number;
    };
  };
  /** Metadata */
  metadata: {
    /** Aggregation strategy used */
    strategy: ConsensusStrategy;
    /** Timestamp */
    timestamp: string;
    /** Original query */
    query: string;
    /** Processing time */
    processingTime: number;
  };
}

/**
 * Enhanced aggregated response with detailed analysis
 */
export interface EnhancedAggregatedResponse extends AggregatedResponse {
  /** Quality metrics for the primary response */
  primaryQuality: ResponseQuality;
  /** Quality metrics for supporting responses */
  supportingQualities: ResponseQuality[];
  /** Conflict analysis */
  conflictAnalysis: ConflictAnalysis;
  /** Execution performance metrics */
  performanceMetrics: {
    totalExecutionTime: number;
    averageResponseTime: number;
    successRate: number;
    timeoutRate: number;
  };
  /** Recommendation strength (0-1) */
  recommendationStrength: number;
  /** Aggregation metadata */
  aggregationMetadata: {
    strategy: ConsensusStrategy;
    participatingAgents: string[];
    excludedAgents: Array<{ name: string; reason: string }>;
    aggregationTime: number;
  };
  /** Structured format for easy consumption */
  structured: StructuredResponse;
}

/**
 * Advanced result aggregation system for multi-agent responses
 */
export class ResultAggregator {
  private readonly defaultOptions: AggregationOptions = {
    strategy: ConsensusStrategy.INTELLIGENT_MERGE,
    minConfidence: 0.3,
    maxAlternatives: 3,
    includeConflicts: true,
    weights: {
      confidence: 0.4,
      speed: 0.2,
      agentExpertise: 0.2,
      responseQuality: 0.2,
    },
  };

  constructor(private readonly options: Partial<AggregationOptions> = {}) {}

  /**
   * Aggregate results from multiple agent executions
   */
  async aggregateResults(
    multiAgentResult: MultiAgentExecutionResult,
    originalQuery: string,
    routingResults: RoutingResult[],
    options?: Partial<AggregationOptions>,
  ): Promise<EnhancedAggregatedResponse> {
    const effectiveOptions = {
      ...this.defaultOptions,
      ...this.options,
      ...options,
    };
    const startTime = Date.now();

    // Filter successful results
    const allResults = [
      ...multiAgentResult.primaryResults,
      ...multiAgentResult.secondaryResults,
    ];
    const successfulResults = allResults.filter(
      (r) =>
        r.status === 'success' &&
        r.response &&
        this.getAgentConfidence(r.agent, routingResults) >=
          (effectiveOptions.minConfidence || 0),
    );

    if (successfulResults.length === 0) {
      throw new Error('No successful results to aggregate');
    }

    // Evaluate quality for each response
    const qualityEvaluations = successfulResults.map((result) => ({
      result,
      quality: this.evaluateResponseQuality(result.response!, originalQuery),
      confidence: this.getAgentConfidence(result.agent, routingResults),
      routingResult: routingResults.find(
        (r) => r.agent.config.name === result.agent.config.name,
      ),
    }));

    // Apply aggregation strategy
    const primaryResult = await this.selectPrimaryResult(
      qualityEvaluations,
      effectiveOptions,
    );

    const supportingResults = qualityEvaluations
      .filter((evaluation) => evaluation.result !== primaryResult.result)
      .slice(0, effectiveOptions.maxAlternatives || 3);

    // Perform conflict analysis
    const conflictAnalysis = this.analyzeConflicts(qualityEvaluations);

    // Calculate performance metrics
    const performanceMetrics = this.calculatePerformanceMetrics(allResults);

    // Calculate recommendation strength
    const recommendationStrength = this.calculateRecommendationStrength(
      primaryResult,
      qualityEvaluations,
      conflictAnalysis,
    );

    // Generate summary and alternatives
    const summary = this.generateIntelligentSummary(
      qualityEvaluations,
      conflictAnalysis
    );

    const alternatives = this.generateAlternatives(
      supportingResults,
      effectiveOptions.includeConflicts ? conflictAnalysis : undefined,
    );

    const aggregationTime = Date.now() - startTime;

    // Generate structured response format
    const structured: StructuredResponse = this.generateStructuredResponse(
      primaryResult,
      supportingResults,
      conflictAnalysis,
      performanceMetrics,
      recommendationStrength,
      effectiveOptions.strategy,
      originalQuery,
      aggregationTime,
      allResults.length,
    );

    return {
      primary: primaryResult.result.response!,
      supporting: supportingResults.map((sr) => sr.result.response!),
      confidence: primaryResult.confidence,
      summary,
      alternatives,
      primaryQuality: primaryResult.quality,
      supportingQualities: supportingResults.map((sr) => sr.quality),
      conflictAnalysis,
      performanceMetrics,
      recommendationStrength,
      aggregationMetadata: {
        strategy: effectiveOptions.strategy,
        participatingAgents: successfulResults.map((r) => r.agent.config.name),
        excludedAgents: allResults
          .filter((r) => r.status !== 'success')
          .map((r) => ({
            name: r.agent.config.name,
            reason:
              r.status === 'timeout'
                ? 'Execution timeout'
                : r.status === 'cancelled'
                  ? 'Execution cancelled'
                  : r.error?.message || 'Unknown error',
          })),
        aggregationTime,
      },
      structured,
    };
  }

  /**
   * Select the primary result based on the aggregation strategy
   */
  private async selectPrimaryResult(
    evaluations: Array<{
      result: AgentExecutionResult;
      quality: ResponseQuality;
      confidence: number;
      routingResult?: RoutingResult;
    }>,
    options: AggregationOptions,
  ): Promise<(typeof evaluations)[0]> {
    switch (options.strategy) {
      case ConsensusStrategy.HIGHEST_CONFIDENCE:
        return evaluations.reduce((best, current) =>
          current.confidence > best.confidence ? current : best,
        );

      case ConsensusStrategy.FASTEST_SUCCESS:
        return evaluations.reduce((fastest, current) =>
          current.result.duration < fastest.result.duration ? current : fastest,
        );

      case ConsensusStrategy.EXPERT_PRIORITY:
        return this.selectByExpertPriority(evaluations, options);

      case ConsensusStrategy.MAJORITY_CONSENSUS:
        return this.selectByMajorityConsensus(evaluations);

      case ConsensusStrategy.INTELLIGENT_MERGE:
      default:
        return this.selectByIntelligentScoring(evaluations, options);
    }
  }

  /**
   * Select primary result using expert priority
   */
  private selectByExpertPriority(
    evaluations: Array<{
      result: AgentExecutionResult;
      quality: ResponseQuality;
      confidence: number;
      routingResult?: RoutingResult;
    }>,
    options: AggregationOptions,
  ): (typeof evaluations)[0] {
    const priorities = options.agentPriorities || {};

    return evaluations.reduce((best, current) => {
      const currentPriority = priorities[current.result.agent.config.name] || 0;
      const bestPriority = priorities[best.result.agent.config.name] || 0;

      if (currentPriority > bestPriority) return current;
      if (currentPriority === bestPriority) {
        // Fallback to quality score
        return current.quality.overallScore > best.quality.overallScore
          ? current
          : best;
      }
      return best;
    });
  }

  /**
   * Select primary result using majority consensus
   */
  private selectByMajorityConsensus(
    evaluations: Array<{
      result: AgentExecutionResult;
      quality: ResponseQuality;
      confidence: number;
      routingResult?: RoutingResult;
    }>,
  ): (typeof evaluations)[0] {
    // Simplified implementation - in practice, this would use NLP to analyze
    // semantic similarity between responses

    // For now, use the response with highest quality among top confidence agents
    const topConfidenceThreshold =
      Math.max(...evaluations.map((e) => e.confidence)) * 0.8;
    const topCandidates = evaluations.filter(
      (e) => e.confidence >= topConfidenceThreshold,
    );

    return topCandidates.reduce((best, current) =>
      current.quality.overallScore > best.quality.overallScore ? current : best,
    );
  }

  /**
   * Select primary result using intelligent scoring
   */
  private selectByIntelligentScoring(
    evaluations: Array<{
      result: AgentExecutionResult;
      quality: ResponseQuality;
      confidence: number;
      routingResult?: RoutingResult;
    }>,
    options: AggregationOptions,
  ): (typeof evaluations)[0] {
    const weights = options.weights || this.defaultOptions.weights!;

    const scoredEvaluations = evaluations.map((evaluation) => {
      // Normalize speed score (faster is better)
      const maxDuration = Math.max(
        ...evaluations.map((e) => e.result.duration),
      );
      const speedScore = 1 - evaluation.result.duration / maxDuration;

      // Calculate agent expertise score based on keyword matching
      const expertiseScore = this.calculateExpertiseScore(
        evaluation.result.agent,
      );

      // Calculate composite score
      const compositeScore =
        evaluation.confidence * weights.confidence +
        speedScore * weights.speed +
        expertiseScore * weights.agentExpertise +
        evaluation.quality.overallScore * weights.responseQuality;

      return { ...evaluation, compositeScore };
    });

    return scoredEvaluations.reduce((best, current) =>
      current.compositeScore > best.compositeScore ? current : best,
    );
  }

  /**
   * Evaluate the quality of a response
   */
  private evaluateResponseQuality(
    response: GenerateContentResponse,
    originalQuery: string,
  ): ResponseQuality {
    const text = this.extractResponseText(response);

    // Length score (optimal range: 100-2000 characters)
    const lengthScore = this.calculateLengthScore(text);

    // Completeness score (based on addressing query components)
    const completenessScore = this.calculateCompletenessScore(
      text,
      originalQuery,
    );

    // Specificity score (specific vs generic responses)
    const specificityScore = this.calculateSpecificityScore(text);

    // Coherence score (structure and flow)
    const coherenceScore = this.calculateCoherenceScore(text);

    // Code quality score (if applicable)
    const codeQualityScore = this.calculateCodeQualityScore(text);

    // Overall score (weighted average)
    const overallScore =
      (lengthScore * 0.15 +
        completenessScore * 0.35 +
        specificityScore * 0.25 +
        coherenceScore * 0.25 +
        (codeQualityScore || 0) * 0.1) /
      (codeQualityScore ? 1.1 : 1.0);

    return {
      lengthScore,
      completenessScore,
      specificityScore,
      coherenceScore,
      codeQualityScore,
      overallScore,
    };
  }

  /**
   * Analyze conflicts between agent responses
   */
  private analyzeConflicts(
    evaluations: Array<{
      result: AgentExecutionResult;
      quality: ResponseQuality;
      confidence: number;
      routingResult?: RoutingResult;
    }>
  ): ConflictAnalysis {
    // Simplified conflict detection - in practice, this would use advanced NLP
    const responses = evaluations.map((e) =>
      this.extractResponseText(e.result.response!),
    );

    // Check for obvious conflicts in code recommendations
    const hasCodeConflicts = this.detectCodeConflicts(responses);

    // Check for conflicting approaches
    const hasApproachConflicts = this.detectApproachConflicts(responses);

    const conflicts: ConflictAnalysis['conflicts'] = [];
    const consensus: ConflictAnalysis['consensus'] = [];

    if (hasCodeConflicts) {
      conflicts.push({
        aspect: 'Implementation approach',
        agentOpinions: evaluations.map((e) => ({
          agent: e.result.agent.config.name,
          opinion: this.extractImplementationApproach(
            this.extractResponseText(e.result.response!),
          ),
          confidence: e.confidence,
        })),
      });
    }

    if (hasApproachConflicts) {
      conflicts.push({
        aspect: 'Technical approach',
        agentOpinions: evaluations.map((e) => ({
          agent: e.result.agent.config.name,
          opinion: this.extractTechnicalApproach(
            this.extractResponseText(e.result.response!),
          ),
          confidence: e.confidence,
        })),
      });
    }

    // Find consensus areas
    if (responses.length > 1) {
      const commonThemes = this.findCommonThemes(responses);
      for (const theme of commonThemes) {
        consensus.push({
          aspect: theme.topic,
          agreement: theme.agreement,
          supportingAgents: evaluations
            .filter((_, i) => theme.supportingIndices.includes(i))
            .map((e) => e.result.agent.config.name),
        });
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      consensus,
    };
  }

  /**
   * Calculate performance metrics from execution results
   */
  private calculatePerformanceMetrics(
    results: AgentExecutionResult[],
  ): EnhancedAggregatedResponse['performanceMetrics'] {
    const totalExecutionTime = Math.max(...results.map((r) => r.duration));
    const averageResponseTime =
      results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const successfulResults = results.filter((r) => r.status === 'success');
    const timeoutResults = results.filter((r) => r.status === 'timeout');

    return {
      totalExecutionTime,
      averageResponseTime,
      successRate: successfulResults.length / results.length,
      timeoutRate: timeoutResults.length / results.length,
    };
  }

  /**
   * Calculate recommendation strength based on consensus and quality
   */
  private calculateRecommendationStrength(
    primaryResult: {
      result: AgentExecutionResult;
      quality: ResponseQuality;
      confidence: number;
    },
    allEvaluations: Array<{
      result: AgentExecutionResult;
      quality: ResponseQuality;
      confidence: number;
    }>,
    conflictAnalysis: ConflictAnalysis,
  ): number {
    let strength =
      primaryResult.confidence * 0.4 + primaryResult.quality.overallScore * 0.4;

    // Boost for consensus
    const consensusBoost = conflictAnalysis.consensus.length * 0.05;
    strength += consensusBoost;

    // Penalty for conflicts
    const conflictPenalty = conflictAnalysis.conflicts.length * 0.1;
    strength -= conflictPenalty;

    // Boost for multiple high-quality supporting results
    const supportingHighQuality = allEvaluations.filter(
      (e) => e !== primaryResult && e.quality.overallScore > 0.7,
    ).length;
    strength += supportingHighQuality * 0.05;

    return Math.min(Math.max(strength, 0), 1);
  }

  /**
   * Generate intelligent summary incorporating all results
   */
  private generateIntelligentSummary(
    evaluations: Array<{
      result: AgentExecutionResult;
      quality: ResponseQuality;
      confidence: number;
      routingResult?: RoutingResult;
    }>,
    conflictAnalysis: ConflictAnalysis
  ): string {
    const agentCount = evaluations.length;
    const avgQuality =
      evaluations.reduce((sum, e) => sum + e.quality.overallScore, 0) /
      agentCount;
    const avgConfidence =
      evaluations.reduce((sum, e) => sum + e.confidence, 0) / agentCount;
    const avgDuration =
      evaluations.reduce((sum, e) => sum + e.result.duration, 0) / agentCount;

    let summary = `Response aggregated from ${agentCount} specialized agents `;
    summary += `(avg quality: ${(avgQuality * 100).toFixed(0)}%, `;
    summary += `avg confidence: ${(avgConfidence * 100).toFixed(0)}%, `;
    summary += `avg response time: ${Math.round(avgDuration)}ms). `;

    if (conflictAnalysis.consensus.length > 0) {
      summary += `Strong consensus on ${conflictAnalysis.consensus.length} key aspects. `;
    }

    if (conflictAnalysis.hasConflicts) {
      summary += `Note: ${conflictAnalysis.conflicts.length} conflicting viewpoints identified - see alternatives for details.`;
    } else {
      summary += `All agents provided consistent recommendations.`;
    }

    return summary;
  }

  /**
   * Generate structured response format for easy consumption
   */
  private generateStructuredResponse(
    primaryResult: {
      result: AgentExecutionResult;
      quality: ResponseQuality;
      confidence: number;
    },
    supportingResults: Array<{
      result: AgentExecutionResult;
      quality: ResponseQuality;
      confidence: number;
    }>,
    conflictAnalysis: ConflictAnalysis,
    performanceMetrics: EnhancedAggregatedResponse['performanceMetrics'],
    recommendationStrength: number,
    strategy: ConsensusStrategy,
    originalQuery: string,
    processingTime: number,
    totalAgents: number,
  ): StructuredResponse {
    return {
      version: '1.0',
      primary: {
        agent: primaryResult.result.agent.config.name,
        confidence: primaryResult.confidence,
        content: this.extractResponseText(primaryResult.result.response!),
        quality: primaryResult.quality,
        executionTime: primaryResult.result.duration,
      },
      supporting: supportingResults.map((sr, index) => ({
        agent: sr.result.agent.config.name,
        confidence: sr.confidence,
        content: this.extractResponseText(sr.result.response!),
        quality: sr.quality,
        executionTime: sr.result.duration,
        reason: `Alternative approach #${index + 1}`,
      })),
      analysis: {
        recommendationStrength,
        consensus: conflictAnalysis.consensus.map(c => c.agreement),
        conflicts: conflictAnalysis.conflicts.map(c => 
          `${c.aspect}: ${c.agentOpinions.length} different opinions`
        ),
        performance: {
          totalAgents,
          successfulAgents: 1 + supportingResults.length,
          totalExecutionTime: performanceMetrics.totalExecutionTime,
          aggregationOverhead: processingTime,
        },
      },
      metadata: {
        strategy,
        timestamp: new Date().toISOString(),
        query: originalQuery,
        processingTime,
      },
    };
  }

  /**
   * Generate meaningful alternatives from supporting results
   */
  private generateAlternatives(
    supportingResults: Array<{
      result: AgentExecutionResult;
      quality: ResponseQuality;
      confidence: number;
      routingResult?: RoutingResult;
    }>,
    conflictAnalysis?: ConflictAnalysis,
  ): string[] {
    const alternatives: string[] = [];

    // Add high-quality alternative approaches
    for (const support of supportingResults.slice(0, 2)) {
      const text = this.extractResponseText(support.result.response!);
      const approach = this.extractMainApproach(text);
      if (approach) {
        alternatives.push(`${support.result.agent.config.name}: ${approach}`);
      }
    }

    // Add conflict-based alternatives
    if (conflictAnalysis?.hasConflicts) {
      for (const conflict of conflictAnalysis.conflicts.slice(0, 1)) {
        const topOpinions = conflict.agentOpinions
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 2);

        for (const opinion of topOpinions) {
          if (!alternatives.some((alt) => alt.includes(opinion.agent))) {
            alternatives.push(`${opinion.agent}: ${opinion.opinion}`);
          }
        }
      }
    }

    return alternatives.slice(0, 3);
  }

  // Helper methods for quality evaluation
  private extractResponseText(response: GenerateContentResponse): string {
    return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  private calculateLengthScore(text: string): number {
    const length = text.length;
    if (length < 50) return 0.3;
    if (length < 100) return 0.6;
    if (length < 500) return 1.0;
    if (length < 1000) return 0.9;
    if (length < 2000) return 0.8;
    return 0.7;
  }

  private calculateCompletenessScore(text: string, query: string): number {
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const textLower = text.toLowerCase();
    const addressed = queryWords.filter((word) => textLower.includes(word));
    return addressed.length / Math.max(queryWords.length, 1);
  }

  private calculateSpecificityScore(text: string): number {
    const genericPhrases = [
      'might be',
      'could be',
      'in general',
      'typically',
      'usually',
    ];
    const specificIndicators = [
      'specifically',
      'exactly',
      'precisely',
      'for example',
      "here's how",
    ];

    const genericCount = genericPhrases.filter((phrase) =>
      text.toLowerCase().includes(phrase),
    ).length;
    const specificCount = specificIndicators.filter((indicator) =>
      text.toLowerCase().includes(indicator),
    ).length;

    return Math.max(0, Math.min(1, 0.5 + (specificCount - genericCount) * 0.1));
  }

  private calculateCoherenceScore(text: string): number {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length < 2) return 0.8;

    // Simple coherence heuristics
    const hasGoodFlow =
      text.includes('first') ||
      text.includes('then') ||
      text.includes('finally');
    const hasStructure =
      text.includes('\n') || text.includes('1.') || text.includes('-');

    let score = 0.6;
    if (hasGoodFlow) score += 0.2;
    if (hasStructure) score += 0.2;

    return Math.min(score, 1.0);
  }

  private calculateCodeQualityScore(text: string): number | undefined {
    if (!this.containsCode(text)) return undefined;

    let score = 0.5;

    // Check for code structure indicators
    if (
      text.includes('function') ||
      text.includes('class') ||
      text.includes('def ')
    )
      score += 0.2;
    if (text.includes('// ') || text.includes('# ') || text.includes('/* '))
      score += 0.1; // Comments
    if (
      text.includes('try') ||
      text.includes('catch') ||
      text.includes('except')
    )
      score += 0.1; // Error handling
    if (
      text.includes('test') ||
      text.includes('assert') ||
      text.includes('expect')
    )
      score += 0.1; // Testing

    return Math.min(score, 1.0);
  }

  private containsCode(text: string): boolean {
    const codeIndicators = [
      'function',
      'const ',
      'let ',
      'var ',
      'class ',
      'def ',
      'import ',
      'from ',
      '```',
    ];
    return codeIndicators.some((indicator) => text.includes(indicator));
  }

  private getAgentConfidence(
    agent: ParsedAgent,
    routingResults: RoutingResult[],
  ): number {
    const routing = routingResults.find(
      (r) => r.agent.config.name === agent.config.name,
    );
    return routing?.confidence || 0.5;
  }

  private calculateExpertiseScore(agent: ParsedAgent): number {
    // Simple expertise scoring based on agent configuration
    let score = 0.5;

    if (agent.config.tools.length > 5) score += 0.2;
    if (agent.config.keywords.length > 10) score += 0.1;
    if (agent.config.examples.length > 2) score += 0.1;
    if (agent.config.systemPrompt && agent.config.systemPrompt.length > 100)
      score += 0.1;

    return Math.min(score, 1.0);
  }

  // Simplified conflict detection methods
  private detectCodeConflicts(responses: string[]): boolean {
    const codeBlocks = responses.map((r) => this.extractCodeBlocks(r));
    return codeBlocks.filter((blocks) => blocks.length > 0).length > 1;
  }

  private detectApproachConflicts(responses: string[]): boolean {
    const approaches = responses.map((r) => this.extractTechnicalApproach(r));
    const uniqueApproaches = new Set(approaches.filter((a) => a.length > 0));
    return uniqueApproaches.size > 1;
  }

  private extractCodeBlocks(text: string): string[] {
    const codeBlockRegex = /```[\s\S]*?```/g;
    return text.match(codeBlockRegex) || [];
  }

  private extractImplementationApproach(text: string): string {
    // Simplified extraction of implementation approach
    const lines = text.split('\n').slice(0, 3);
    return (
      lines.find((line) => line.length > 20 && line.length < 100) ||
      'Standard approach'
    );
  }

  private extractTechnicalApproach(text: string): string {
    // Simplified extraction of technical approach
    const keywords = ['use', 'implement', 'create', 'build', 'design'];
    for (const keyword of keywords) {
      const index = text.toLowerCase().indexOf(keyword);
      if (index !== -1) {
        const sentence = text.substring(index, index + 100);
        return sentence.split('.')[0];
      }
    }
    return '';
  }

  private extractMainApproach(text: string): string {
    const firstSentence = text.split(/[.!?]/)[0];
    return firstSentence.length > 10 && firstSentence.length < 150
      ? firstSentence
      : '';
  }

  private findCommonThemes(responses: string[]): Array<{
    topic: string;
    agreement: string;
    supportingIndices: number[];
  }> {
    // Simplified theme detection - in practice, this would use NLP
    const commonKeywords = [
      'function',
      'class',
      'component',
      'module',
      'service',
    ];
    const themes: Array<{
      topic: string;
      agreement: string;
      supportingIndices: number[];
    }> = [];

    for (const keyword of commonKeywords) {
      const supportingIndices = responses
        .map((response, index) => ({ response, index }))
        .filter(({ response }) => response.toLowerCase().includes(keyword))
        .map(({ index }) => index);

      if (supportingIndices.length > 1) {
        themes.push({
          topic: `${keyword} usage`,
          agreement: `Multiple agents recommend using ${keyword}`,
          supportingIndices,
        });
      }
    }

    return themes;
  }
}

/**
 * Factory function to create a result aggregator
 */
export function createResultAggregator(
  options?: Partial<AggregationOptions>,
): ResultAggregator {
  return new ResultAggregator(options);
}
