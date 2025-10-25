/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContentGenerator } from '../core/contentGenerator.js';
import type {
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import type { Config } from '../config/config.js';
import type {
  Subagent,
  SubagentExecutionOptions,
  SubagentExecutionResult,
} from './types.js';

/**
 * Content generator factory function
 */
export type ContentGeneratorFactory = (
  subagent: Subagent,
) => Promise<ContentGenerator>;

/**
 * Simplified subagent executor
 * 
 * Replaces the complex AgentExecutor, AgentOrchestrator, AgentRouter,
 * and ResultAggregator with a single, straightforward execution flow.
 */
export class SubagentExecutor {
  private readonly contentGeneratorFactory: ContentGeneratorFactory;
  private readonly config?: Config;

  constructor(
    contentGeneratorFactory: ContentGeneratorFactory,
    config?: Config,
  ) {
    this.contentGeneratorFactory = contentGeneratorFactory;
    this.config = config;
  }

  /**
   * Execute a query using a specific subagent
   * 
   * Simple, direct execution without orchestration complexity.
   */
  async execute(
    subagent: Subagent,
    query: string,
    options: SubagentExecutionOptions = {},
  ): Promise<SubagentExecutionResult> {
    const startTime = Date.now();

    try {
      // Get content generator using the factory
      const generator = await this.contentGeneratorFactory(subagent);

      // Build the request
      const request = this.buildRequest(subagent, query, options);

      // Set timeout
      const timeout = options.timeout ?? 60000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), timeout),
      );

      // Execute with timeout
      const response = (await Promise.race([
        generator.generateContent(request),
        timeoutPromise,
      ])) as GenerateContentResponse;

      const duration = Date.now() - startTime;

      // Extract response text
      const responseText = this.extractResponseText(response);

      return {
        query,
        subagentName: subagent.config.name,
        response: responseText,
        duration,
        success: true,
        usage: this.extractUsage(response),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        query,
        subagentName: subagent.config.name,
        response: '',
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build the generation request
   */
  private buildRequest(
    subagent: Subagent,
    query: string,
    options: SubagentExecutionOptions,
  ): GenerateContentParameters {
    const temperature =
      options.temperature ?? subagent.config.temperature ?? 0.7;
    const maxTokens = options.maxTokens ?? subagent.config.maxTokens ?? 2048;

    // Build system prompt
    const systemPrompt =
      subagent.config.systemPrompt ||
      `You are ${subagent.config.name}: ${subagent.config.description}`;

    const request: GenerateContentParameters = {
      model: subagent.config.model,
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nUser Query: ${query}` }],
        },
      ],
      config: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };

    return request;
  }

  /**
   * Extract response text from generation response
   */
  private extractResponseText(response: GenerateContentResponse): string {
    if (!response || !response.candidates || response.candidates.length === 0) {
      return '';
    }

    const candidate = response.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      return '';
    }

    return candidate.content.parts
      .map((p) => (p.text ? p.text : ''))
      .join('');
  }

  /**
   * Extract token usage from response
   */
  private extractUsage(response: GenerateContentResponse):
    | {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
      }
    | undefined {
    if (!response.usageMetadata) {
      return undefined;
    }

    const usage = response.usageMetadata;
    return {
      inputTokens: usage.promptTokenCount || 0,
      outputTokens: usage.candidatesTokenCount || 0,
      totalTokens: usage.totalTokenCount || 0,
    };
  }
}
