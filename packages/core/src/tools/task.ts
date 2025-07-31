/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import { BaseTool, ToolResult } from './tools.js';
import {
  AgentOrchestrator,
  OrchestrationMode,
} from '../agents/agent-orchestrator.js';
import { AgentRegistry } from '../agents/agent-registry.js';
import { ContentGenerator } from '../core/contentGenerator.js';
import { ParsedAgent } from '../agents/types.js';

/**
 * Parameters for the Task tool
 */
export interface TaskParams {
  /** Short description of the task (3-5 words) */
  description: string;
  /** The task prompt for the sub-agent to execute */
  prompt: string;
  /** The type of specialized agent to use for this task */
  subagent_type: string;
}

/**
 * Available sub-agent types with their capabilities
 */
export const SUBAGENT_TYPES = {
  'general-purpose': {
    description:
      'General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you.',
    tools: ['*'],
    keywords: [
      'general',
      'research',
      'search',
      'multi-step',
      'complex',
      'investigation',
    ],
  },
  'ux-researcher': {
    description:
      'Use this agent when you need to analyze and improve user experience, accessibility, or interface design. This includes auditing UI/UX flows, ensuring WCAG compliance, reviewing design systems, proposing wireframes or mockups, and enhancing component accessibility.',
    tools: ['read', 'grep', 'glob', 'edit', 'write'],
    keywords: [
      'ux',
      'ui',
      'accessibility',
      'wcag',
      'design',
      'usability',
      'interface',
      'user-experience',
    ],
  },
  'debug-detective': {
    description:
      'Use this agent when you encounter bugs, errors, unexpected behavior, or need systematic debugging assistance.',
    tools: ['read', 'grep', 'shell', 'edit', 'glob'],
    keywords: [
      'debug',
      'bug',
      'error',
      'troubleshoot',
      'fix',
      'investigate',
      'systematic',
    ],
  },
  'tech-debt-analyzer': {
    description:
      'Use this agent when you need to identify, analyze, and systematically fix technical debt in your codebase. This includes finding code duplication, overly complex files, unused code, missing types, and other maintainability issues.',
    tools: ['read', 'grep', 'glob', 'edit', 'shell'],
    keywords: [
      'tech-debt',
      'refactor',
      'cleanup',
      'duplication',
      'complexity',
      'maintainability',
      'optimization',
    ],
  },
  'atlas-architect': {
    description:
      'Use this agent when you need comprehensive system architecture planning, technical design decisions, or implementation roadmaps for complex software projects. This agent excels at breaking down high-level requirements into actionable development plans while proactively identifying risks and ensuring quality gates.',
    tools: ['read', 'grep', 'glob', 'write', 'edit'],
    keywords: [
      'architecture',
      'design',
      'planning',
      'roadmap',
      'system-design',
      'technical-strategy',
    ],
  },
  'production-readiness-scanner': {
    description:
      'Use this agent when you need to identify incomplete, stubbed, or demo code that could cause production issues.',
    tools: ['read', 'grep', 'glob', 'shell'],
    keywords: [
      'production',
      'readiness',
      'incomplete',
      'stub',
      'demo',
      'security',
      'deployment',
    ],
  },
  'build-lint-validator': {
    description:
      'Use this agent when you need to validate code quality before commits, after making changes to TypeScript files, when build failures occur, or when preparing code for production deployment.',
    tools: ['shell', 'read', 'grep', 'edit'],
    keywords: [
      'build',
      'lint',
      'validation',
      'typescript',
      'quality',
      'ci-cd',
      'deployment',
    ],
  },
  'problem-investigator': {
    description:
      'Use this agent when you need to systematically investigate and understand complex problems, bugs, or unexpected behaviors in code or systems. This agent excels at deep-dive analysis, root cause investigation, and turning confusing issues into clear understanding.',
    tools: ['read', 'grep', 'glob', 'shell', 'edit'],
    keywords: [
      'investigate',
      'analyze',
      'problem-solving',
      'root-cause',
      'systematic',
      'deep-dive',
    ],
  },
  'qwen-code-engineer': {
    description:
      'Use this agent when working on the Qwen-Code codebase for any engineering tasks including bug fixes, feature development, code reviews, refactoring, testing, or architectural improvements. This agent should be your primary choice for all development work within the Qwen-Code project.',
    tools: ['*'],
    keywords: [
      'qwen-code',
      'engineering',
      'development',
      'feature',
      'bug-fix',
      'refactor',
      'testing',
    ],
  },
  'qa-code-reviewer': {
    description:
      'Use this agent when you need rigorous code review with evidence-driven analysis and point-based scoring.',
    tools: ['read', 'grep', 'glob', 'shell'],
    keywords: [
      'code-review',
      'qa',
      'quality',
      'analysis',
      'scoring',
      'validation',
      'assessment',
    ],
  },
} as const;

/**
 * Task tool for launching specialized sub-agents to handle complex, multi-step tasks autonomously
 */
export class TaskTool extends BaseTool<TaskParams, ToolResult> {
  static readonly Name = 'Task';

  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly contentGeneratorFactory: (
      agent: ParsedAgent,
    ) => Promise<ContentGenerator>,
  ) {
    super(
      TaskTool.Name,
      'Task',
      'Launch a new agent to handle complex, multi-step tasks autonomously. Use this tool to delegate work to specialized sub-agents that can work independently on specific aspects of your task.',
      {
        type: Type.OBJECT,
        properties: {
          description: {
            type: Type.STRING,
            description: 'A short (3-5 word) description of the task',
          },
          prompt: {
            type: Type.STRING,
            description: 'The task for the agent to perform',
          },
          subagent_type: {
            type: Type.STRING,
            description: 'The type of specialized agent to use for this task',
            enum: Object.keys(SUBAGENT_TYPES),
          },
        },
        required: ['description', 'prompt', 'subagent_type'],
      },
      true, // isOutputMarkdown
      false, // canUpdateOutput
    );
  }

  validateToolParams(params: TaskParams): string | null {
    if (!params.description?.trim()) {
      return 'Description is required and cannot be empty';
    }
    if (!params.prompt?.trim()) {
      return 'Prompt is required and cannot be empty';
    }
    if (!params.subagent_type || !(params.subagent_type in SUBAGENT_TYPES)) {
      return `Invalid subagent_type. Must be one of: ${Object.keys(SUBAGENT_TYPES).join(', ')}`;
    }
    return null;
  }

  getDescription(params: TaskParams): string {
    const _subagentInfo =
      SUBAGENT_TYPES[params.subagent_type as keyof typeof SUBAGENT_TYPES];
    return `Launching ${params.subagent_type} agent to: ${params.description}`;
  }

  async execute(params: TaskParams, _signal: AbortSignal): Promise<ToolResult> {
    const validationError = this.validateToolParams(params);
    if (validationError) {
      return {
        llmContent: `Task validation failed: ${validationError}`,
        returnDisplay: `❌ **Task Failed**\n\n${validationError}`,
      };
    }

    try {
      // Create orchestrator for sub-agent execution with optimized settings for sub-agents
      const orchestrator = new AgentOrchestrator(
        this.agentRegistry,
        this.contentGeneratorFactory,
        {
          mode: this.shouldUseMultiAgent(params.prompt)
            ? OrchestrationMode.MULTI_AGENT
            : OrchestrationMode.SINGLE_AGENT,
          maxAgents: this.calculateOptimalAgentCount(params.prompt),
          performance: {
            maxExecutionTime: 300000, // 5 minutes
            targetConfidence: 0.8,
          },
          execution: {
            timeout: 120000, // 2 minutes per agent
            maxConcurrency: 3, // Allow up to 3 concurrent agents
            continueOnError: true, // Continue even if some agents fail
            aggregateResults: true, // Enable result aggregation
          },
        },
      );

      // Find appropriate agent for the subagent type
      const subagentInfo =
        SUBAGENT_TYPES[params.subagent_type as keyof typeof SUBAGENT_TYPES];
      const matchingAgents = this.agentRegistry.findAgents(
        [...subagentInfo.keywords],
      );

      if (matchingAgents.length === 0) {
        // Create a virtual agent if no specific agent is found
        const virtualAgent: ParsedAgent = {
          config: {
            name: params.subagent_type,
            description: subagentInfo.description,
            keywords: [...subagentInfo.keywords],
            tools: subagentInfo.tools.map((tool) => ({ name: tool })),
            model: 'gemini-2.0-flash',
            provider: 'gemini',
            examples: [
              {
                input: `Example task for ${params.subagent_type}`,
                output: `Specialized response from ${params.subagent_type} agent`,
              },
            ],
          },
          filePath: `virtual://${params.subagent_type}.md`,
          source: 'project',
          content: `# ${params.subagent_type}\n\n${subagentInfo.description}`,
          lastModified: new Date(),
        };

        // Temporarily register the virtual agent
        this.agentRegistry.registerAgent(virtualAgent);
      }

      // Execute the task using the orchestrator
      const result = await orchestrator.processQuery(params.prompt);

      // Format the response
      const summary = `**${params.description}** (${params.subagent_type})`;
      const confidence = Math.round(result.response.confidence * 100);
      const duration = Math.round(result.performance.totalDuration);

      let displayContent = `✅ **Task Completed: ${summary}**\n\n`;
      displayContent += `**Agent:** ${result.routing.selectedAgents.join(', ')}\n`;
      displayContent += `**Confidence:** ${confidence}%\n`;
      displayContent += `**Duration:** ${duration}ms\n\n`;
      displayContent += `**Result:**\n${result.response.text}`;

      if (
        result.response.alternatives &&
        result.response.alternatives.length > 0
      ) {
        displayContent += `\n\n**Alternative Approaches:**\n`;
        result.response.alternatives.forEach((alt, index) => {
          displayContent += `${index + 1}. ${alt}\n`;
        });
      }

      if (result.response.summary) {
        displayContent += `\n\n**Summary:** ${result.response.summary}`;
      }

      return {
        summary: `Executed task: ${params.description}`,
        llmContent: result.response.text,
        returnDisplay: displayContent,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      return {
        llmContent: `Task execution failed: ${errorMessage}`,
        returnDisplay: `❌ **Task Failed: ${params.description}**\n\n**Error:** ${errorMessage}\n\n**Agent Type:** ${params.subagent_type}`,
      };
    }
  }

  /**
   * Get information about available sub-agent types
   */
  static getSubagentTypes(): typeof SUBAGENT_TYPES {
    return SUBAGENT_TYPES;
  }

  /**
   * Get detailed information about a specific sub-agent type
   */
  static getSubagentInfo(
    type: string,
  ): (typeof SUBAGENT_TYPES)[keyof typeof SUBAGENT_TYPES] | null {
    return SUBAGENT_TYPES[type as keyof typeof SUBAGENT_TYPES] || null;
  }

  /**
   * Determine if a task would benefit from multi-agent execution
   */
  private shouldUseMultiAgent(prompt: string): boolean {
    // Check for indicators that suggest multi-agent would be beneficial
    const multiAgentIndicators = [
      'and also',
      'additionally',
      'furthermore',
      'both',
      'as well as',
      'compare',
      'analyze different',
      'multiple approaches',
      'various',
      'comprehensive',
      'thorough',
      'complete analysis',
    ];

    const lowerPrompt = prompt.toLowerCase();
    const hasMultipleRequirements = multiAgentIndicators.some((indicator) =>
      lowerPrompt.includes(indicator),
    );

    // Complex tasks over 200 characters might benefit from multi-agent
    const isComplexTask = prompt.length > 200;

    return hasMultipleRequirements || isComplexTask;
  }

  /**
   * Calculate optimal number of agents for a task
   */
  private calculateOptimalAgentCount(prompt: string): number {
    if (!this.shouldUseMultiAgent(prompt)) {
      return 1;
    }

    // Count distinct requirements/questions
    const requirements = prompt
      .split(/[.!?]/)
      .filter((s) => s.trim().length > 0);
    const questionCount = (prompt.match(/\?/g) || []).length;
    const andCount = (prompt.match(/\band\b/gi) || []).length;

    // Base agent count on complexity indicators
    const agentCount = Math.min(
      Math.max(1, Math.floor(requirements.length / 2)),
      Math.max(1, questionCount),
      Math.max(1, andCount),
    );

    // Cap at 3 agents for optimal performance
    return Math.min(agentCount, 3);
  }
}
