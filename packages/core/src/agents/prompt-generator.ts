/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentTool } from './types.js';
import { AIProvider } from '../provider.js';

/**
 * Request for generating an agent prompt
 */
export interface PromptGenerationRequest {
  name: string;
  description: string;
  keywords: string[];
  tools: AgentTool[];
  domain?:
    | 'coding'
    | 'analysis'
    | 'creative'
    | 'debugging'
    | 'review'
    | 'testing'
    | 'general';
  examples?: Array<{
    context: string;
    userInput: string;
    expectedBehavior: string;
  }>;
}

/**
 * Generated prompt result
 */
export interface GeneratedPrompt {
  systemPrompt: string;
  enhancedDescription: string;
  suggestedColor: string;
  confidence: number;
}

/**
 * AI-powered agent prompt generator that creates high-quality system prompts
 * following proven best practices from successful AI agents
 */
export class AgentPromptGenerator {
  constructor(private aiProvider: AIProvider) {}

  /**
   * Generate a high-quality system prompt for an AI agent
   */
  async generateSystemPrompt(
    request: PromptGenerationRequest,
  ): Promise<GeneratedPrompt> {
    const metaPrompt = this.buildMetaPrompt(request);

    try {
      const fullPrompt = `${this.getGeneratorSystemPrompt()}\n\n${metaPrompt}`;
      const response = await this.aiProvider.generateCode(fullPrompt);

      const result = this.parseGeneratedResponse(response);
      return result;
    } catch (error) {
      throw new Error(
        `Failed to generate agent prompt: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get the system prompt for the prompt generator itself
   */
  private getGeneratorSystemPrompt(): string {
    return `You are an expert AI agent prompt engineer specializing in creating high-quality system prompts for coding and development assistants. You follow proven patterns from successful AI agents like:

- **Production Readiness Scanner**: Systematic code auditing with clear categorization
- **QA Code Reviewer**: Evidence-driven analysis with structured workflows  
- **Engineering Specialists**: Clear persona definition with phase-based workflows

Your goal is to create professional, effective system prompts that define:
1. **Clear Persona & Role**: Who the agent is and their expertise
2. **Structured Workflow**: How they approach tasks step-by-step
3. **Tool Usage Guidelines**: When and how to use available tools
4. **Output Standards**: Expected format and quality of responses
5. **Quality Controls**: Verification and validation approaches

Always output your response in this exact JSON format:
{
  "systemPrompt": "The complete system prompt text...",
  "enhancedDescription": "Enhanced description with examples for YAML frontmatter...",
  "suggestedColor": "blue|pink|green|yellow|purple|red",
  "confidence": 0.85
}`;
  }

  /**
   * Build the meta-prompt for generating the agent prompt
   */
  private buildMetaPrompt(request: PromptGenerationRequest): string {
    const toolsList = request.tools
      .map(
        (tool) =>
          `- ${tool.name}${tool.description ? `: ${tool.description}` : ''}`,
      )
      .join('\n');

    const examplesSection = request.examples
      ? request.examples
          .map(
            (ex, i) =>
              `Example ${i + 1}: ${ex.context} → "${ex.userInput}" → ${ex.expectedBehavior}`,
          )
          .join('\n')
      : '';

    return `Create a high-quality system prompt for an AI agent with these specifications:

**Agent Details:**
- Name: ${request.name}
- Purpose: ${request.description}
- Domain: ${request.domain || 'general'}
- Keywords: ${request.keywords.join(', ')}

**Available Tools:**
${toolsList || 'No specific tools defined'}

**Usage Examples:**
${examplesSection || 'No specific examples provided'}

**Requirements:**

1. **Define a Clear Persona**: The agent should have a specific role and expertise level
2. **Create Structured Workflows**: Break complex tasks into clear phases
3. **Specify Tool Usage**: Define when and how to use each available tool
4. **Set Quality Standards**: Include verification and validation steps
5. **Format Guidelines**: Specify expected output formats and response structure

**For the enhancedDescription field**: Create a description following this exact pattern:
"Use this agent when [specific trigger conditions]. Examples: <example>Context: [situation] user: '[user input]' assistant: '[assistant response using the agent]'</example> <example>Context: [different situation] user: '[user input]' assistant: '[assistant response]'</example>"

**Color Guidelines:**
- blue: Technical analysis, engineering, debugging
- pink: Code review, quality assurance, testing  
- green: Creative tasks, content generation
- yellow: Planning, architecture, design
- purple: Research, investigation, analysis
- red: Security, critical issues, urgent tasks

Generate a professional system prompt that would create an effective, reliable AI agent for this purpose.`;
  }

  /**
   * Parse the AI-generated response and extract the structured result
   */
  private parseGeneratedResponse(content: string): GeneratedPrompt {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!parsed.systemPrompt || !parsed.enhancedDescription) {
        throw new Error('Missing required fields in generated response');
      }

      return {
        systemPrompt: parsed.systemPrompt.trim(),
        enhancedDescription: parsed.enhancedDescription.trim(),
        suggestedColor: parsed.suggestedColor || 'blue',
        confidence: parsed.confidence || 0.8,
      };
    } catch (_error) {
      // Fallback: try to extract content manually
      const fallbackPrompt = this.extractFallbackPrompt(content);
      return {
        systemPrompt: fallbackPrompt,
        enhancedDescription: `Use this agent for ${this.extractDescription(content)}`,
        suggestedColor: 'blue',
        confidence: 0.5,
      };
    }
  }

  /**
   * Fallback method to extract a basic prompt if JSON parsing fails
   */
  private extractFallbackPrompt(content: string): string {
    // Remove JSON markers and try to extract the main content
    const cleaned = content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .replace(/^\{.*?"systemPrompt":\s*"/m, '')
      .replace(/".*$/s, '')
      .trim();

    return (
      cleaned ||
      'You are a specialized AI assistant. Provide helpful and accurate responses.'
    );
  }

  /**
   * Extract description from content for fallback
   */
  private extractDescription(content: string): string {
    return content.length > 50 ? content.substring(0, 50) + '...' : content;
  }
}

/**
 * Create a prompt generator instance with the provided AI provider
 */
export function createPromptGenerator(
  aiProvider: AIProvider,
): AgentPromptGenerator {
  return new AgentPromptGenerator(aiProvider);
}
