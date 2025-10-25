/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';
import type {
  GenerateContentParameters,
  GenerateContentResponse,
  Part,
} from '@google/genai';
import type {
  ContentGenerator,
  MultimodalContentGenerator,
} from '../core/contentGenerator.js';
import type { Config } from '../config/config.js';
import type {
  Subagent,
  SubagentExecutionOptions,
  SubagentExecutionResult,
  SubagentAttachment,
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
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      // Get content generator using the factory
      const generator = await this.contentGeneratorFactory(subagent);

      // Build the request
      const request = await this.buildRequest(subagent, query, options);

      // Set timeout
      const timeout = options.timeout ?? 60000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Execution timeout')),
          timeout,
        );
      });

      // Execute with timeout
      const executionPromise = this.invokeGenerator(
        generator,
        request,
        options,
      );

      const response = (await Promise.race([
        executionPromise,
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
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Build the generation request
   */
  private async buildRequest(
    subagent: Subagent,
    query: string,
    options: SubagentExecutionOptions,
  ): Promise<GenerateContentParameters> {
    const temperature =
      options.temperature ?? subagent.config.temperature ?? 0.7;
    const maxTokens = options.maxTokens ?? subagent.config.maxTokens ?? 2048;

    // Build system prompt
    const systemPrompt =
      subagent.config.systemPrompt ||
      `You are ${subagent.config.name}: ${subagent.config.description}`;

    const trimmedQuery = query?.trim();
    const userParts: Part[] = [
      {
        text: `${systemPrompt}\n\nUser Query: ${
          trimmedQuery && trimmedQuery.length > 0 ? trimmedQuery : '(empty)'
        }`,
      },
    ];

    const attachmentParts = await this.createAttachmentParts(
      options.attachments,
    );
    userParts.push(...attachmentParts);

    const request: GenerateContentParameters = {
      model: subagent.config.model,
      contents: [
        {
          role: 'user',
          parts: userParts,
        },
      ],
      config: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };

    return request;
  }

  private async createAttachmentParts(
    attachments: SubagentAttachment[] | undefined,
  ): Promise<Part[]> {
    if (!attachments || attachments.length === 0) {
      return [];
    }

    const baseDir = this.resolveBaseDir();
    const parts: Part[] = [];

    for (const attachment of attachments) {
      if (!attachment.path) {
        continue;
      }

      const resolvedPath = path.isAbsolute(attachment.path)
        ? attachment.path
        : path.resolve(baseDir, attachment.path);

      let fileBuffer: Buffer;
      try {
        fileBuffer = await fs.readFile(resolvedPath);
      } catch (error) {
        throw new Error(
          `Failed to read attachment "${attachment.path}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      const detectedMime = mime.lookup(resolvedPath) || undefined;
      const mimeType = attachment.mimeType || detectedMime || 'application/octet-stream';

      const descriptor =
        attachment.description ||
        `Attachment: ${path.basename(resolvedPath)} (${mimeType})`;

      parts.push({ text: descriptor });
      parts.push({
        inlineData: {
          data: fileBuffer.toString('base64'),
          mimeType,
        },
      });
    }

    return parts;
  }

  private resolveBaseDir(): string {
    if (typeof this.config?.getWorkingDir === 'function') {
      return this.config.getWorkingDir();
    }
    if (typeof this.config?.getProjectRoot === 'function') {
      return this.config.getProjectRoot();
    }
    return process.cwd();
  }

  private async invokeGenerator(
    generator: ContentGenerator,
    request: GenerateContentParameters,
    options: SubagentExecutionOptions,
  ): Promise<GenerateContentResponse> {
    const supportsVision = this.isMultimodalGenerator(generator);
    const shouldUseVision =
      supportsVision &&
      ((options.attachments && options.attachments.length > 0) ||
        options.forceVision === true);

    if (shouldUseVision) {
      return await (generator as MultimodalContentGenerator).generateContentWithVision(
        request,
      );
    }

    return await generator.generateContent(request);
  }

  private isMultimodalGenerator(
    generator: ContentGenerator,
  ): generator is MultimodalContentGenerator {
    const candidate = generator as Partial<MultimodalContentGenerator>;
    return (
      typeof candidate.generateContentWithVision === 'function' &&
      typeof candidate.isVisionCapable === 'function'
    );
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
