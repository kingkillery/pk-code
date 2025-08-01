/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import OpenAI from 'openai';
import { Config } from '../config/config.js';
import { OpenAIContentGenerator } from './openaiContentGenerator.js';
import {
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import { safeJsonParseResponse } from '../utils/safeJsonParse.js';

export class OpenRouterContentGenerator extends OpenAIContentGenerator {
  private preferredProvider?: string;
  private fallbackModels = [
    'qwen/qwen3-coder:free',
    'qwen/qwen-2.5-coder-32b-instruct:free',
    'mistralai/devstral-small',
    'anthropic/claude-3-haiku',
  ];

  constructor(
    apiKey: string,
    model: string,
    config: Config,
    provider?: string,
  ) {
    super(apiKey, model, config);
    this.preferredProvider = provider;

    // Override the OpenAI client with OpenRouter-specific configuration
    const timeoutConfig = {
      timeout: 120000,
      maxRetries: 3,
    };

    // Allow config to override timeout settings
    const contentGeneratorConfig = config.getContentGeneratorConfig();
    if (contentGeneratorConfig?.timeout) {
      timeoutConfig.timeout = contentGeneratorConfig.timeout;
    }
    if (contentGeneratorConfig?.maxRetries !== undefined) {
      timeoutConfig.maxRetries = contentGeneratorConfig.maxRetries;
    }

    // Create a new OpenAI client configured for OpenRouter
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      timeout: timeoutConfig.timeout,
      maxRetries: timeoutConfig.maxRetries,
      defaultHeaders: this.getOpenRouterHeaders(),
    });

    // Patch the client to add provider routing to request body
    this.patchClientForProviderRouting();
  }

  /**
   * Validate if a model is available on OpenRouter
   */
  static async validateModel(model: string): Promise<boolean> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models');
      if (!response.ok) {
        console.warn(
          `Failed to fetch OpenRouter models list for validation: ${response.status} ${response.statusText}`,
        );
        return true; // Allow the request to proceed if we can't validate
      }

      const parseResult = await safeJsonParseResponse<{
        data?: Array<{ id: string }>;
      }>(response, {
        context: 'OpenRouter models API validation',
        validateContentType: false, // OpenRouter might not always return proper Content-Type
      });

      if (!parseResult.success) {
        console.warn(
          `Failed to parse OpenRouter models response: ${parseResult.error}`,
        );
        return true; // Allow the request to proceed if we can't parse response
      }

      const models = parseResult.data?.data || [];
      return models.some((m: { id: string }) => m.id === model);
    } catch (error) {
      console.warn('Error validating OpenRouter model:', error);
      return true; // Allow the request to proceed if validation fails
    }
  }

  /**
   * Get available models from OpenRouter
   */
  static async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models');
      if (!response.ok) {
        console.warn(
          `Failed to fetch OpenRouter models: ${response.status} ${response.statusText}`,
        );
        return [];
      }

      const parseResult = await safeJsonParseResponse<{
        data?: Array<{ id: string }>;
      }>(response, {
        context: 'OpenRouter models API fetch',
        validateContentType: false, // OpenRouter might not always return proper Content-Type
      });

      if (!parseResult.success) {
        console.warn(
          `Failed to parse OpenRouter models response: ${parseResult.error}`,
        );
        return [];
      }

      const models = parseResult.data?.data || [];
      return models.map((model: { id: string }) => model.id);
    } catch (error) {
      console.warn('Error fetching OpenRouter models:', error);
      return [];
    }
  }

  private getOpenRouterHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'HTTP-Referer': 'https://qwen-code.dev',
      'X-Title': 'Qwen Code',
    };

    // Add preferred provider header if specified
    if (this.preferredProvider) {
      headers['X-OR-Provider'] = this.preferredProvider;
    }

    return headers;
  }

  /**
   * Enhanced error handling specific to OpenRouter API
   */
  private enhanceOpenRouterError(error: Error, model: string): Error {
    const errorMessage = error.message.toLowerCase();

    // Check for specific OpenRouter error patterns
    if (errorMessage.includes('400') && errorMessage.includes('provider')) {
      let enhancedMessage = `OpenRouter API Error: ${error.message}\n\n`;
      enhancedMessage += `Troubleshooting steps for model "${model}":\n`;
      enhancedMessage += `1. Verify your OPENROUTER_API_KEY is correct and has sufficient credits\n`;
      enhancedMessage += `2. Check if the model "${model}" is available and accessible\n`;
      enhancedMessage += `3. Try using a different model (e.g., "qwen/qwen3-coder:free")\n`;
      enhancedMessage += `4. If using a specific provider, verify it supports this model\n`;
      enhancedMessage += `5. Check OpenRouter status at https://status.openrouter.ai/\n\n`;
      enhancedMessage += `Available alternatives:\n`;
      enhancedMessage += `- qwen/qwen3-coder:free (free tier)\n`;
      enhancedMessage += `- qwen/qwen-2.5-coder-32b-instruct\n`;
      enhancedMessage += `- mistralai/devstral-small\n\n`;
      enhancedMessage += `To switch models, use the /model command or set OPENROUTER_MODEL environment variable.`;

      return new Error(enhancedMessage);
    }

    if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
      return new Error(
        `OpenRouter Authentication Error: ${error.message}\n\n` +
          `Please check your OPENROUTER_API_KEY:\n` +
          `1. Ensure the API key is valid and not expired\n` +
          `2. Verify the key has sufficient credits\n` +
          `3. Check if the key has access to the selected model\n\n` +
          `Get your API key from: https://openrouter.ai/settings/keys`,
      );
    }

    if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
      return new Error(
        `OpenRouter Rate Limit Error: ${error.message}\n\n` +
          `Rate limit exceeded. Please:\n` +
          `1. Wait a moment before trying again\n` +
          `2. Consider upgrading your OpenRouter plan for higher limits\n` +
          `3. Use a different model with lower demand\n\n` +
          `Rate limits info: https://openrouter.ai/docs/requests`,
      );
    }

    if (
      errorMessage.includes('502') ||
      errorMessage.includes('503') ||
      errorMessage.includes('504')
    ) {
      return new Error(
        `OpenRouter Server Error: ${error.message}\n\n` +
          `The OpenRouter service is temporarily unavailable:\n` +
          `1. Try again in a few moments\n` +
          `2. Check OpenRouter status: https://status.openrouter.ai/\n` +
          `3. Consider switching to a different model temporarily\n` +
          `4. If the issue persists, contact OpenRouter support`,
      );
    }

    // Return the original error if no specific pattern matches
    return error;
  }

  /**
   * Attempt to use a fallback model if the current model fails
   */
  private async attemptFallback(
    request: GenerateContentParameters,
    originalError: Error,
    isStreaming = false,
  ): Promise<
    GenerateContentResponse | AsyncGenerator<GenerateContentResponse>
  > {
    const currentModel = this.getModel();

    // Only attempt fallback for certain error types
    if (!this.shouldAttemptFallback(originalError)) {
      throw originalError;
    }

    console.warn(
      `[OpenRouter] Model "${currentModel}" failed, attempting fallback...`,
    );

    for (const fallbackModel of this.fallbackModels) {
      if (fallbackModel === currentModel) {
        continue; // Skip the model that already failed
      }

      try {
        console.debug(`[OpenRouter] Trying fallback model: ${fallbackModel}`);

        // Temporarily change the model
        (this as unknown as { model: string }).model = fallbackModel;

        // Get the API key from the client
        const apiKey = (this as unknown as { client: { apiKey: string } })
          .client.apiKey;
        const timeoutConfig = {
          timeout: 120000,
          maxRetries: 1, // Reduce retries for fallback attempts
        };

        // Create a new client with the fallback model
        (this as any).client = new OpenAI({
          apiKey,
          baseURL: 'https://openrouter.ai/api/v1',
          timeout: timeoutConfig.timeout,
          maxRetries: timeoutConfig.maxRetries,
          defaultHeaders: this.getOpenRouterHeaders(),
        });

        // Attempt the request with the fallback model
        const result = isStreaming
          ? await super.generateContentStream(request)
          : await super.generateContent(request);

        console.info(
          `[OpenRouter] Successfully using fallback model: ${fallbackModel}`,
        );
        return result;
      } catch (fallbackError) {
        console.debug(
          `[OpenRouter] Fallback model "${fallbackModel}" also failed:`,
          fallbackError,
        );
        continue; // Try the next fallback model
      }
    }

    // If all fallbacks failed, throw the original error with additional context
    throw new Error(
      `All OpenRouter models failed. Original error: ${originalError.message}\n\n` +
        `Attempted fallback models: ${this.fallbackModels.join(', ')}\n\n` +
        `Please check your API key, network connection, or try again later.`,
    );
  }

  /**
   * Determine if we should attempt fallback based on the error type
   */
  private shouldAttemptFallback(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();

    // Attempt fallback for specific error types
    return (
      errorMessage.includes('400') ||
      errorMessage.includes('provider') ||
      errorMessage.includes('model not found') ||
      errorMessage.includes('model not available') ||
      errorMessage.includes('502') ||
      errorMessage.includes('503') ||
      errorMessage.includes('504')
    );
  }

  /**
   * Override generateContent to add OpenRouter provider routing and fallback mechanism
   */
  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    try {
      // If we have a preferred provider, intercept the OpenAI client call
      if (this.preferredProvider) {
        return await this.generateContentWithProvider(request);
      }
      
      // Otherwise, use the parent implementation
      return await super.generateContent(request);
    } catch (error) {
      const enhancedError = this.enhanceOpenRouterError(
        error as Error,
        this.getModel(),
      );

      // Attempt fallback if appropriate
      return (await this.attemptFallback(
        request,
        enhancedError,
        false,
      )) as GenerateContentResponse;
    }
  }

  /**
   * Override generateContentStream to add OpenRouter provider routing and fallback mechanism
   */
  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    try {
      // If we have a preferred provider, intercept the OpenAI client call
      if (this.preferredProvider) {
        return await this.generateContentStreamWithProvider(request);
      }
      
      // Otherwise, use the parent implementation
      return await super.generateContentStream(request);
    } catch (error) {
      const enhancedError = this.enhanceOpenRouterError(
        error as Error,
        this.getModel(),
      );

      // Attempt fallback if appropriate
      return (await this.attemptFallback(
        request,
        enhancedError,
        true,
      )) as AsyncGenerator<GenerateContentResponse>;
    }
  }


  /**
   * Patch the OpenAI client to automatically add provider routing to request body
   */
  private patchClientForProviderRouting(): void {
    if (!this.preferredProvider) {
      return; // No provider specified, no need to patch
    }

    const originalCreate = this.client.chat.completions.create.bind(
      this.client.chat.completions,
    );

    // Override the create method to add provider field to request body
    this.client.chat.completions.create = ((params: any, options?: any) => {
      // Add OpenRouter provider routing to the request body
      const enhancedParams = {
        ...params,
        provider: {
          only: [this.preferredProvider],
        },
      };

      // Call the original method with enhanced parameters
      return originalCreate(enhancedParams, options);
    }) as any;
  }

  /**
   * Generate content with provider routing by directly calling OpenAI API
   */
  private async generateContentWithProvider(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    try {
      // The provider routing is handled by the patched client
      return await super.generateContent(request);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate content stream with provider routing by directly calling OpenAI API
   */
  private async generateContentStreamWithProvider(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    try {
      // The provider routing is handled by the patched client
      return await super.generateContentStream(request);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get the current model being used
   */
  private getModel(): string {
    // Access the protected model property from the parent class
    return (this as unknown as { model: string }).model;
  }
}
