/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';
import { ParsedAgent } from '@pk-code/core';

/**
 * Enhanced command parser for complex multi-step instructions
 * Supports natural language processing of multi-step workflows
 */

// Command execution context
export interface CommandContext {
  query: string;
  workingDirectory: string;
  availableAgents: ParsedAgent[];
  userPreferences: Record<string, unknown>;
  contextWindow?: {
    currentSize: number;
    maxSize: number;
    modelSupportsLargeContext: boolean;
  };
}

// Multi-step instruction schema
export const MultiStepInstructionSchema = z.object({
  steps: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      agent: z.string().optional(),
      dependencies: z.array(z.string()).optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      estimatedDuration: z.number().optional(),
      successCriteria: z.string().optional(),
      fallbackStrategies: z.array(z.string()).optional(),
    }),
  ),
  workflow: z.object({
    type: z.enum(['sequential', 'parallel', 'conditional', 'iterative']),
    maxConcurrency: z.number().optional(),
    timeout: z.number().optional(),
    errorHandling: z
      .enum(['fail-fast', 'continue-on-error', 'retry'])
      .optional(),
  }),
  context: z.object({
    domain: z.string(),
    complexity: z.enum(['simple', 'medium', 'complex', 'expert']),
    requiredExpertise: z.array(z.string()).optional(),
  }),
});

// Parsed multi-step instruction
export type MultiStepInstruction = z.infer<typeof MultiStepInstructionSchema>;

// Command parsing result
export interface ParsedCommand {
  type: 'single' | 'multi-step' | 'workflow' | 'agentic-program';
  instruction?: MultiStepInstruction;
  agent?: string;
  query?: string;
  confidence: number;
  reasoning: string;
}

/**
 * Enhanced command parser that can handle complex multi-step instructions
 */
export class AdvancedCommandParser {
  private readonly contextWindowLimit = 256000; // 256K tokens
  private readonly extendedLimit = 1000000; // 1M tokens for large operations

  /**
   * Parse a natural language command into structured execution plan
   */
  async parseCommand(
    input: string,
    context: CommandContext,
  ): Promise<ParsedCommand> {
    // Check if this is a simple single-step command
    if (this.isSimpleCommand(input)) {
      return {
        type: 'single',
        query: input,
        confidence: 0.9,
        reasoning: 'Simple command detected - single step execution',
      };
    }

    // Check if this is an agent-specific command
    const agentMatch = this.extractAgentCommand(input);
    if (agentMatch) {
      return {
        type: 'single',
        agent: agentMatch.agent,
        query: agentMatch.query,
        confidence: 0.95,
        reasoning: `Agent-specific command for ${agentMatch.agent}`,
      };
    }

    // Parse complex multi-step instructions
    const multiStepResult = await this.parseMultiStepInstruction(
      input,
      context,
    );
    if (multiStepResult.confidence > 0.7) {
      return multiStepResult;
    }

    // Fallback to agentic program synthesis
    const programResult = await this.parseAgenticProgram(input, context);
    if (programResult.confidence > 0.6) {
      return programResult;
    }

    // Default to single command with lower confidence
    return {
      type: 'single',
      query: input,
      confidence: 0.6,
      reasoning: 'Fallback to single command execution',
    };
  }

  /**
   * Check if input is a simple single-step command
   */
  private isSimpleCommand(input: string): boolean {
    const simplePatterns = [
      /^read\s+file/i,
      /^write\s+to/i,
      /^search\s+for/i,
      /^list\s+files/i,
      /^run\s+command/i,
      /^edit\s+file/i,
      /^show\s+me/i,
      /^what\s+is/i,
      /^how\s+do\s+i/i,
      /^explain/i,
      /^analyze/i,
    ];

    return (
      simplePatterns.some((pattern) => pattern.test(input)) &&
      input.split(/[.!?]+/).length <= 2
    );
  }

  /**
   * Extract agent-specific commands like "/agent-name do something"
   */
  private extractAgentCommand(
    input: string,
  ): { agent: string; query: string } | null {
    const agentPattern = /^\/(\w+)(?:\s+(.+))?$/;
    const match = input.match(agentPattern);

    if (match) {
      return {
        agent: match[1],
        query: match[2] || '',
      };
    }

    return null;
  }

  /**
   * Parse multi-step instructions from natural language
   */
  private async parseMultiStepInstruction(
    input: string,
    context: CommandContext,
  ): Promise<ParsedCommand> {
    const multiStepIndicators = [
      'first',
      'then',
      'next',
      'after that',
      'finally',
      'step 1',
      'step 2',
      'step 3',
      '1.',
      '2.',
      '3.',
      '4.',
      '5.',
      'begin by',
      'start with',
      'followed by',
      'and then',
      'subsequently',
      'consequently',
    ];

    const hasMultiStepIndicators = multiStepIndicators.some((indicator) =>
      input.toLowerCase().includes(indicator),
    );

    if (!hasMultiStepIndicators) {
      return {
        type: 'single',
        query: input,
        confidence: 0.3,
        reasoning: 'No multi-step indicators detected',
      };
    }

    // Parse steps from input
    const steps = this.extractSteps(input);
    const workflow = this.determineWorkflowType(input, steps.length);
    const complexity = this.assessComplexity(input, context);

    const instruction: MultiStepInstruction = {
      steps: steps.map((step, index) => ({
        id: `step-${index + 1}`,
        description: step.description,
        agent: step.agent,
        dependencies: index > 0 ? [`step-${index}`] : [],
        priority: step.priority || 'medium',
        estimatedDuration: step.estimatedDuration,
        successCriteria: step.successCriteria,
      })),
      workflow: {
        type: workflow.type,
        maxConcurrency: workflow.maxConcurrency,
        timeout: workflow.timeout || 300000, // 5 minutes default
        errorHandling: workflow.errorHandling || 'continue-on-error',
      },
      context: {
        domain: this.extractDomain(input),
        complexity,
        requiredExpertise: this.extractRequiredExpertise(input, context),
      },
    };

    return {
      type: 'multi-step',
      instruction,
      confidence: this.calculateConfidence(steps, workflow, complexity),
      reasoning: `Parsed ${steps.length} steps with ${workflow.type} workflow`,
    };
  }

  /**
   * Parse agentic program synthesis requests
   */
  private async parseAgenticProgram(
    input: string,
    context: CommandContext,
  ): Promise<ParsedCommand> {
    const programIndicators = [
      'create a program',
      'build an application',
      'implement a system',
      'develop a solution',
      'design and implement',
      'program synthesis',
      'generate code for',
      'build a tool',
      'create a service',
    ];

    const isProgramRequest = programIndicators.some((indicator) =>
      input.toLowerCase().includes(indicator),
    );

    if (!isProgramRequest) {
      return {
        type: 'single',
        query: input,
        confidence: 0.2,
        reasoning: 'No program synthesis indicators detected',
      };
    }

    // Analyze program requirements
    const requirements = this.extractProgramRequirements(input);
    const architecture = this.determineArchitecture(input, context);

    const instruction: MultiStepInstruction = {
      steps: [
        {
          id: 'analyze-requirements',
          description: 'Analyze program requirements and constraints',
          agent: 'architect',
          priority: 'high',
          successCriteria: 'Requirements clearly defined and validated',
        },
        {
          id: 'design-architecture',
          description: `Design ${architecture} architecture`,
          agent: 'architect',
          dependencies: ['analyze-requirements'],
          priority: 'high',
          successCriteria: 'Architecture design completed and reviewed',
        },
        {
          id: 'implement-core',
          description: 'Implement core functionality',
          agent: 'developer',
          dependencies: ['design-architecture'],
          priority: 'high',
          successCriteria: 'Core features implemented and tested',
        },
        {
          id: 'add-features',
          description: 'Add additional features and enhancements',
          agent: 'developer',
          dependencies: ['implement-core'],
          priority: 'medium',
          successCriteria: 'All requested features implemented',
        },
        {
          id: 'test-integration',
          description: 'Perform integration testing',
          agent: 'tester',
          dependencies: ['add-features'],
          priority: 'high',
          successCriteria: 'All tests pass and system is stable',
        },
      ],
      workflow: {
        type: 'sequential',
        timeout: 1800000, // 30 minutes
        errorHandling: 'fail-fast',
      },
      context: {
        domain: this.extractDomain(input),
        complexity: 'complex',
        requiredExpertise: ['programming', 'system-design', 'testing'],
      },
    };

    return {
      type: 'agentic-program',
      instruction,
      confidence: 0.8,
      reasoning: `Program synthesis request detected: ${architecture} ${requirements.join(', ')}`,
    };
  }

  /**
   * Extract individual steps from multi-step input
   */
  private extractSteps(input: string): Array<{
    description: string;
    agent?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    estimatedDuration?: number;
    successCriteria?: string;
  }> {
    const lines = input
      .split(/[.!?]+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const steps: Array<{
      description: string;
      agent?: string;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      estimatedDuration?: number;
      successCriteria?: string;
    }> = [];

    for (const line of lines) {
      const step = this.parseStepLine(line);
      if (step) {
        steps.push(step);
      }
    }

    return steps.length > 0
      ? steps
      : [
          {
            description: input,
            priority: 'medium',
          },
        ];
  }

  /**
   * Parse individual step line
   */
  private parseStepLine(line: string): {
    description: string;
    agent?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    estimatedDuration?: number;
    successCriteria?: string;
  } | null {
    // Remove step indicators
    const cleanLine = line
      .replace(/^(first|then|next|step \d+|after that|finally|\d+\.)/i, '')
      .trim();

    if (cleanLine.length === 0) return null;

    // Extract agent assignment (e.g., "using developer agent")
    const agentMatch = cleanLine.match(/(?:using|with|via)\s+(\w+)\s+agent/i);
    const agent = agentMatch ? agentMatch[1] : undefined;

    // Extract priority indicators
    let priority: 'low' | 'medium' | 'high' | 'critical' | undefined;
    if (/\b(critical|urgent|important)\b/i.test(cleanLine)) {
      priority = 'critical';
    } else if (/\b(high|major)\b/i.test(cleanLine)) {
      priority = 'high';
    } else if (/\b(low|minor)\b/i.test(cleanLine)) {
      priority = 'low';
    }

    // Extract estimated duration (e.g., "in 5 minutes", "takes 2 hours")
    const durationMatch = cleanLine.match(
      /(\d+)\s*(minutes?|hours?|seconds?|days?)/i,
    );
    let estimatedDuration: number | undefined;
    if (durationMatch) {
      const value = parseInt(durationMatch[1], 10);
      const unit = durationMatch[2].toLowerCase();
      switch (unit) {
        case 'second':
        case 'seconds':
          estimatedDuration = value * 1000;
          break;
        case 'minute':
        case 'minutes':
          estimatedDuration = value * 60 * 1000;
          break;
        case 'hour':
        case 'hours':
          estimatedDuration = value * 60 * 60 * 1000;
          break;
        case 'day':
        case 'days':
          estimatedDuration = value * 24 * 60 * 60 * 1000;
          break;
        default:
          // Unknown time unit, use default duration
          estimatedDuration = undefined;
          break;
      }
    }

    return {
      description: cleanLine,
      agent,
      priority: priority || 'medium',
      estimatedDuration,
    };
  }

  /**
   * Determine workflow type from input
   */
  private determineWorkflowType(
    input: string,
    stepCount: number,
  ): {
    type: 'sequential' | 'parallel' | 'conditional' | 'iterative';
    maxConcurrency?: number;
    timeout?: number;
    errorHandling?: 'fail-fast' | 'continue-on-error' | 'retry';
  } {
    const lowerInput = input.toLowerCase();

    // Check for parallel indicators
    if (
      lowerInput.includes('parallel') ||
      lowerInput.includes('simultaneously') ||
      lowerInput.includes('at the same time') ||
      stepCount > 5
    ) {
      return {
        type: 'parallel',
        maxConcurrency: Math.min(stepCount, 3),
        errorHandling: 'continue-on-error',
      };
    }

    // Check for conditional workflow
    if (
      lowerInput.includes('if') ||
      lowerInput.includes('when') ||
      lowerInput.includes('depending on') ||
      lowerInput.includes('based on')
    ) {
      return {
        type: 'conditional',
        errorHandling: 'continue-on-error',
      };
    }

    // Check for iterative workflow
    if (
      lowerInput.includes('repeat') ||
      lowerInput.includes('iterate') ||
      lowerInput.includes('loop') ||
      lowerInput.includes('until')
    ) {
      return {
        type: 'iterative',
        errorHandling: 'retry',
      };
    }

    // Default to sequential
    return {
      type: 'sequential',
      errorHandling: 'fail-fast',
    };
  }

  /**
   * Assess complexity of the request
   */
  private assessComplexity(
    input: string,
    context: CommandContext,
  ): 'simple' | 'medium' | 'complex' | 'expert' {
    let score = 0;

    // Length and detail indicators
    if (input.length > 500) score += 2;
    else if (input.length > 200) score += 1;

    // Technical indicators
    const technicalTerms = [
      'architecture',
      'design pattern',
      'optimization',
      'scalability',
      'security',
      'performance',
      'integration',
      'microservice',
      'database',
      'algorithm',
      'distributed',
      'concurrent',
    ];
    const technicalMatches = technicalTerms.filter((term) =>
      input.toLowerCase().includes(term),
    ).length;
    score += technicalMatches;

    // Multiple domains
    const domains = [
      'frontend',
      'backend',
      'database',
      'infrastructure',
      'testing',
    ];
    const domainMatches = domains.filter((domain) =>
      input.toLowerCase().includes(domain),
    ).length;
    if (domainMatches > 2) score += 2;

    // Context window consideration
    if (context.contextWindow) {
      const { currentSize, maxSize } = context.contextWindow;
      if (currentSize > maxSize * 0.8) score += 1;
    }

    if (score >= 5) return 'expert';
    if (score >= 3) return 'complex';
    if (score >= 2) return 'medium';
    return 'simple';
  }

  /**
   * Extract domain from input
   */
  private extractDomain(input: string): string {
    const lowerInput = input.toLowerCase();

    if (
      lowerInput.includes('web') ||
      lowerInput.includes('frontend') ||
      lowerInput.includes('ui')
    ) {
      return 'web-development';
    }
    if (
      lowerInput.includes('api') ||
      lowerInput.includes('backend') ||
      lowerInput.includes('server')
    ) {
      return 'backend-development';
    }
    if (lowerInput.includes('database') || lowerInput.includes('data')) {
      return 'data-engineering';
    }
    if (
      lowerInput.includes('infrastructure') ||
      lowerInput.includes('deployment')
    ) {
      return 'devops';
    }
    if (lowerInput.includes('test') || lowerInput.includes('quality')) {
      return 'testing';
    }

    return 'general';
  }

  /**
   * Extract required expertise areas
   */
  private extractRequiredExpertise(
    input: string,
    context: CommandContext,
  ): string[] {
    const expertise: string[] = [];
    const lowerInput = input.toLowerCase();

    if (
      lowerInput.includes('react') ||
      lowerInput.includes('vue') ||
      lowerInput.includes('angular')
    ) {
      expertise.push('frontend-frameworks');
    }
    if (
      lowerInput.includes('node') ||
      lowerInput.includes('python') ||
      lowerInput.includes('java')
    ) {
      expertise.push('programming-languages');
    }
    if (lowerInput.includes('database') || lowerInput.includes('sql')) {
      expertise.push('database-design');
    }
    if (
      lowerInput.includes('api') ||
      lowerInput.includes('rest') ||
      lowerInput.includes('graphql')
    ) {
      expertise.push('api-design');
    }
    if (lowerInput.includes('test') || lowerInput.includes('tdd')) {
      expertise.push('testing');
    }

    return expertise.length > 0 ? expertise : ['general-programming'];
  }

  /**
   * Extract program requirements from input
   */
  private extractProgramRequirements(input: string): string[] {
    const requirements: string[] = [];
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('user interface') || lowerInput.includes('ui')) {
      requirements.push('user-interface');
    }
    if (
      lowerInput.includes('database') ||
      lowerInput.includes('data storage')
    ) {
      requirements.push('data-persistence');
    }
    if (lowerInput.includes('api') || lowerInput.includes('web service')) {
      requirements.push('api-integration');
    }
    if (lowerInput.includes('authentication') || lowerInput.includes('login')) {
      requirements.push('authentication');
    }
    if (lowerInput.includes('real-time') || lowerInput.includes('websocket')) {
      requirements.push('real-time-features');
    }

    return requirements.length > 0 ? requirements : ['basic-functionality'];
  }

  /**
   * Determine architecture type from input
   */
  private determineArchitecture(
    input: string,
    _context: CommandContext,
  ): string {
    const lowerInput = input.toLowerCase();

    if (
      lowerInput.includes('microservice') ||
      lowerInput.includes('distributed')
    ) {
      return 'microservices';
    }
    if (
      lowerInput.includes('serverless') ||
      lowerInput.includes('lambda') ||
      lowerInput.includes('function')
    ) {
      return 'serverless';
    }
    if (
      lowerInput.includes('monolith') ||
      lowerInput.includes('single application')
    ) {
      return 'monolithic';
    }
    if (lowerInput.includes('web app') || lowerInput.includes('website')) {
      return 'web-application';
    }
    if (lowerInput.includes('cli') || lowerInput.includes('command line')) {
      return 'command-line-tool';
    }
    if (lowerInput.includes('api') || lowerInput.includes('service')) {
      return 'api-service';
    }

    return 'web-application'; // Default
  }

  /**
   * Calculate confidence score for parsed command
   */
  private calculateConfidence(
    steps: any[],
    workflow: any,
    complexity: string,
  ): number {
    let confidence = 0.5;

    // More steps increase confidence
    if (steps.length > 1) confidence += 0.2;
    if (steps.length > 3) confidence += 0.1;

    // Clear workflow type increases confidence
    if (workflow.type !== 'sequential') confidence += 0.1;

    // Higher complexity increases confidence in multi-step parsing
    if (complexity === 'complex' || complexity === 'expert') confidence += 0.15;

    return Math.min(confidence, 0.95);
  }

  /**
   * Check if context window extension is needed
   */
  shouldExtendContextWindow(context: CommandContext): boolean {
    if (!context.contextWindow) return false;

    const { currentSize, maxSize, modelSupportsLargeContext } =
      context.contextWindow;

    // Extend if we're approaching the limit and model supports it
    return (
      modelSupportsLargeContext &&
      currentSize > maxSize * 0.8 &&
      maxSize < this.extendedLimit
    );
  }

  /**
   * Get recommended context window size for operation
   */
  getRecommendedContextWindow(context: CommandContext): number {
    if (!context.contextWindow) return this.contextWindowLimit;

    const { currentSize, modelSupportsLargeContext } = context.contextWindow;

    if (!modelSupportsLargeContext)
      return Math.min(currentSize, this.contextWindowLimit);

    // Scale based on operation complexity
    if (currentSize > this.contextWindowLimit * 1.5) {
      return Math.min(currentSize * 1.2, this.extendedLimit);
    }

    return Math.min(currentSize * 1.1, this.contextWindowLimit);
  }
}

export const advancedCommandParser = new AdvancedCommandParser();
