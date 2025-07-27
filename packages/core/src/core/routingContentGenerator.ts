/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
} from '@google/genai';
import {
  ContentGenerator,
  MultimodalContentGenerator,
  VisionModelConfig,
} from './contentGenerator.js';
import { ModelRoutingStrategy } from './modelRoutingStrategy.js';
import { UserTierId } from '../code_assist/types.js';

/**
 * Content generator that routes requests between text and vision models
 * based on intelligent analysis of the request content
 */
export class RoutingContentGenerator implements MultimodalContentGenerator {
  private routingStrategy: ModelRoutingStrategy;

  constructor(
    private textModel: ContentGenerator,
    private visionModel: ContentGenerator,
    private visionConfig: VisionModelConfig,
    private textModelName: string,
  ) {
    this.routingStrategy = new ModelRoutingStrategy(visionConfig);
  }

  /**
   * Generate content with automatic routing between text and vision models
   */
  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    const shouldUseVision = this.routingStrategy.shouldUseVision(request);

    try {
      if (shouldUseVision) {
        console.debug(
          `[RoutingContentGenerator] Routing to vision model: ${this.visionConfig.visionModel}`,
        );
        return await this.visionModel.generateContent(request);
      } else {
        console.debug(
          `[RoutingContentGenerator] Routing to text model: ${this.textModelName}`,
        );
        return await this.textModel.generateContent(request);
      }
    } catch (error) {
      // If vision model fails and fallback is enabled, try text model
      if (shouldUseVision && this.routingStrategy.shouldFallbackToText()) {
        console.warn(
          `[RoutingContentGenerator] Vision model failed, falling back to text model:`,
          error,
        );
        return await this.textModel.generateContent(request);
      }
      throw error;
    }
  }

  /**
   * Generate streaming content with automatic routing
   */
  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const shouldUseVision = this.routingStrategy.shouldUseVision(request);

    try {
      if (shouldUseVision) {
        console.debug(
          `[RoutingContentGenerator] Streaming from vision model: ${this.visionConfig.visionModel}`,
        );
        return await this.visionModel.generateContentStream(request);
      } else {
        console.debug(
          `[RoutingContentGenerator] Streaming from text model: ${this.textModelName}`,
        );
        return await this.textModel.generateContentStream(request);
      }
    } catch (error) {
      // If vision model fails and fallback is enabled, try text model
      if (shouldUseVision && this.routingStrategy.shouldFallbackToText()) {
        console.warn(
          `[RoutingContentGenerator] Vision streaming failed, falling back to text model:`,
          error,
        );
        return await this.textModel.generateContentStream(request);
      }
      throw error;
    }
  }

  /**
   * Generate content explicitly using the vision model
   */
  async generateContentWithVision(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    console.debug(
      `[RoutingContentGenerator] Explicit vision model request: ${this.visionConfig.visionModel}`,
    );

    try {
      return await this.visionModel.generateContent(request);
    } catch (error) {
      if (this.routingStrategy.shouldFallbackToText()) {
        console.warn(
          `[RoutingContentGenerator] Explicit vision request failed, falling back to text model:`,
          error,
        );
        return await this.textModel.generateContent(request);
      }
      throw error;
    }
  }

  /**
   * Count tokens using the appropriate model based on routing logic
   */
  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    const shouldUseVision = this.routingStrategy.shouldUseVision(request);

    try {
      if (shouldUseVision) {
        return await this.visionModel.countTokens(request);
      } else {
        return await this.textModel.countTokens(request);
      }
    } catch (error) {
      // If vision model fails and fallback is enabled, try text model
      if (shouldUseVision && this.routingStrategy.shouldFallbackToText()) {
        return await this.textModel.countTokens(request);
      }
      throw error;
    }
  }

  /**
   * Embed content using the text model (vision models typically don't support embeddings)
   */
  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // Always use text model for embeddings
    return await this.textModel.embedContent(request);
  }

  /**
   * Get user tier from the primary text model
   */
  async getTier(): Promise<UserTierId | undefined> {
    if (this.textModel.getTier) {
      return await this.textModel.getTier();
    }
    return undefined;
  }

  /**
   * Check if vision capabilities are available
   */
  isVisionCapable(): boolean {
    return true;
  }

  /**
   * Get the vision model name
   */
  getVisionModel(): string {
    return this.visionConfig.visionModel;
  }

  /**
   * Get the text model name
   */
  getTextModel(): string {
    return this.textModelName;
  }

  /**
   * Get routing strategy information
   */
  getRoutingInfo() {
    return {
      textModel: this.textModelName,
      visionModel: this.visionConfig.visionModel,
      strategy: this.routingStrategy.getRoutingStrategy(),
      fallbackEnabled: this.routingStrategy.shouldFallbackToText(),
    };
  }

  /**
   * Force routing to vision model for the next request
   */
  async forceVisionRouting(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    return await this.generateContentWithVision(request);
  }

  /**
   * Force routing to text model for the next request
   */
  async forceTextRouting(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    return await this.textModel.generateContent(request);
  }
}
