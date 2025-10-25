/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import { BaseTool, ToolResult } from './tools.js';
import { ContentGenerator } from '../core/contentGenerator.js';
import { SubagentManager, SubagentExecutor, type Subagent } from '../subagents/index.js';

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
  
  private readonly subagentManager: SubagentManager;
  private readonly contentGeneratorFactory: (
    subagent: Subagent,
  ) => Promise<ContentGenerator>;

  constructor(
    subagentManager: SubagentManager,
    contentGeneratorFactory: (
      subagent: Subagent,
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
    this.subagentManager = subagentManager;
    this.contentGeneratorFactory = contentGeneratorFactory;
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
      // Create executor for sub-agent execution
      const executor = new SubagentExecutor(this.contentGeneratorFactory);

      // Find appropriate subagent for the subagent type
      const subagentInfo =
        SUBAGENT_TYPES[params.subagent_type as keyof typeof SUBAGENT_TYPES];
      
      // Try to find matching subagent by keywords
      const matchingSubagents = this.subagentManager.find([
        ...subagentInfo.keywords,
      ]);

      let targetSubagent: Subagent;

      if (matchingSubagents.length > 0) {
        // Use the first matching subagent
        targetSubagent = matchingSubagents[0];
      } else {
        // Use default or first available subagent
        const defaultSubagent =
          this.subagentManager.get('default') ||
          this.subagentManager.getAll()[0];

        if (!defaultSubagent) {
          return {
            llmContent: `No subagents available for task delegation.`,
            returnDisplay: `❌ **Task Failed**\n\nNo subagents available.`,
          };
        }

        targetSubagent = defaultSubagent;
      }

      // Execute the task using the executor with appropriate timeout
      const result = await executor.execute(targetSubagent, params.prompt, {
        timeout: 120000, // 2 minutes
      });

      if (!result.success) {
        return {
          llmContent: `Task execution failed: ${result.error || 'Unknown error'}`,
          returnDisplay: `❌ **Task Failed**\n\n${result.error || 'Unknown error'}`,
        };
      }

      // Format the response
      const summary = `**${params.description}** (${params.subagent_type})`;
      const confidence = result.success ? 90 : 10;
      const duration = result.duration;

      let displayContent = `✅ **Task Completed: ${summary}**\n\n`;
      displayContent += `**Agent:** ${targetSubagent.config.name}\n`;
      displayContent += `**Confidence:** ${confidence}%\n`;
      displayContent += `**Duration:** ${duration}ms\n\n`;
      displayContent += `**Result:**\n${result.response}`;

      if (result.usage) {
        displayContent += `\n\n**Token Usage:**\n`;
        displayContent += `- Input: ${result.usage.inputTokens}\n`;
        displayContent += `- Output: ${result.usage.outputTokens}\n`;
        displayContent += `- Total: ${result.usage.totalTokens}\n`;
      }

      return {
        summary: `Executed task: ${params.description}`,
        llmContent: result.response,
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

}
