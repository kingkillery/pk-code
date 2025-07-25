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
  GoogleGenAI,
} from '@google/genai';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import { DEFAULT_GEMINI_MODEL } from '../config/models.js';
import { Config } from '../config/config.js';
import { getEffectiveModel } from './modelCheck.js';
import { UserTierId } from '../code_assist/types.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;

  getTier?(): Promise<UserTierId | undefined>;
}

/**
 * Extended interface for multimodal content generation with vision capabilities
 */
export interface MultimodalContentGenerator extends ContentGenerator {
  /**
   * Generate content with explicit vision model routing
   */
  generateContentWithVision(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse>;

  /**
   * Check if the content generator has vision capabilities
   */
  isVisionCapable(): boolean;

  /**
   * Get the vision model name being used
   */
  getVisionModel(): string | undefined;

  /**
   * Get the text model name being used
   */
  getTextModel(): string;
}

export enum AuthType {
  LOGIN_WITH_GOOGLE = 'oauth-personal',
  USE_GEMINI = 'gemini-api-key',
  USE_VERTEX_AI = 'vertex-ai',
  CLOUD_SHELL = 'cloud-shell',
  USE_OPENAI = 'openai',
  USE_OPENROUTER = 'openrouter',
}

export type VisionModelConfig = {
  visionModel: string;
  visionProvider?: string;
  routingStrategy: 'auto' | 'explicit' | 'tool-based';
  fallbackToText: boolean;
  visionApiKey?: string;
};

export type ContentGeneratorConfig = {
  model: string;
  apiKey?: string;
  vertexai?: boolean;
  authType?: AuthType | undefined;
  enableOpenAILogging?: boolean;
  // Timeout configuration in milliseconds
  timeout?: number;
  // Maximum retries for failed requests
  maxRetries?: number;
  samplingParams?: {
    top_p?: number;
    top_k?: number;
    repetition_penalty?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    temperature?: number;
    max_tokens?: number;
  };
  // Vision model configuration
  visionConfig?: VisionModelConfig;
  enableSmartRouting?: boolean;
};

export async function createContentGeneratorConfig(
  model: string | undefined,
  authType: AuthType | undefined,
): Promise<ContentGeneratorConfig> {
  const geminiApiKey = process.env.GEMINI_API_KEY || undefined;
  const googleApiKey = process.env.GOOGLE_API_KEY || undefined;
  const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT || undefined;
  const googleCloudLocation = process.env.GOOGLE_CLOUD_LOCATION || undefined;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  // Use runtime model from config if available, otherwise fallback to parameter or default
  const effectiveModel = model || DEFAULT_GEMINI_MODEL;

  const contentGeneratorConfig: ContentGeneratorConfig = {
    model: effectiveModel,
    authType,
  };

  // If we are using Google auth or we are in Cloud Shell, there is nothing else to validate for now
  if (
    authType === AuthType.LOGIN_WITH_GOOGLE ||
    authType === AuthType.CLOUD_SHELL
  ) {
    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_GEMINI && geminiApiKey) {
    contentGeneratorConfig.apiKey = geminiApiKey;
    contentGeneratorConfig.vertexai = false;
    contentGeneratorConfig.model = await getEffectiveModel(
      contentGeneratorConfig.apiKey,
      contentGeneratorConfig.model,
    );

    return contentGeneratorConfig;
  }

  if (
    authType === AuthType.USE_VERTEX_AI &&
    (googleApiKey || (googleCloudProject && googleCloudLocation))
  ) {
    contentGeneratorConfig.apiKey = googleApiKey;
    contentGeneratorConfig.vertexai = true;

    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_OPENAI && openaiApiKey) {
    const openaiModel = process.env.OPENAI_MODEL?.trim();
    if (!openaiModel) {
      throw new Error(
        'OPENAI_MODEL environment variable is required when using OpenAI. ' +
          'Please set OPENAI_MODEL to your desired model (e.g., "gpt-4", "gpt-3.5-turbo")',
      );
    }

    contentGeneratorConfig.apiKey = openaiApiKey;
    contentGeneratorConfig.model = openaiModel;

    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_OPENROUTER && process.env.OPENROUTER_API_KEY) {
    let openrouterModel = process.env.OPENROUTER_MODEL?.trim();
    // Set default model for OpenRouter if none is specified
    if (!openrouterModel) {
      openrouterModel = 'qwen/qwen3-coder';
      process.env.OPENROUTER_MODEL = openrouterModel;
    }

    contentGeneratorConfig.apiKey = process.env.OPENROUTER_API_KEY;
    contentGeneratorConfig.model = openrouterModel;
    // Add provider support for OpenRouter
    (
      contentGeneratorConfig as ContentGeneratorConfig & { provider?: string }
    ).provider = process.env.OPENROUTER_PROVIDER?.trim();

    // Add vision model configuration if enabled
    if (process.env.ENABLE_VISION_ROUTING === 'true') {
      const visionModel = process.env.VISION_MODEL_NAME?.trim() || 'bytedance/ui-tars-1.5-7b';
      const visionProvider = process.env.VISION_MODEL_PROVIDER?.trim() || 'openrouter';
      const routingStrategy = (process.env.VISION_ROUTING_STRATEGY as 'auto' | 'explicit' | 'tool-based') || 'auto';
      const fallbackToText = process.env.VISION_FALLBACK_TO_TEXT !== 'false';

      contentGeneratorConfig.visionConfig = {
        visionModel,
        visionProvider,
        routingStrategy,
        fallbackToText,
        visionApiKey: process.env.VISION_MODEL_API_KEY?.trim() || process.env.OPENROUTER_API_KEY,
      };
      contentGeneratorConfig.enableSmartRouting = true;
    }

    return contentGeneratorConfig;
  }

  return contentGeneratorConfig;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  const version = process.env.CLI_VERSION || process.version;
  const httpOptions = {
    headers: {
      'User-Agent': `GeminiCLI/${version} (${process.platform}; ${process.arch})`,
    },
  };
  
  // Create the base content generator first
  let baseGenerator: ContentGenerator;
  
  if (
    config.authType === AuthType.LOGIN_WITH_GOOGLE ||
    config.authType === AuthType.CLOUD_SHELL
  ) {
    baseGenerator = createCodeAssistContentGenerator(
      httpOptions,
      config.authType,
      gcConfig,
      sessionId,
    );
  } else if (
    config.authType === AuthType.USE_GEMINI ||
    config.authType === AuthType.USE_VERTEX_AI
  ) {
    const googleGenAI = new GoogleGenAI({
      apiKey: config.apiKey === '' ? undefined : config.apiKey,
      vertexai: config.vertexai,
      httpOptions,
    });

    const model = googleGenAI.getGenerativeModel({ model: config.model });
    baseGenerator = {
      generateContent: model.generateContent.bind(model),
      generateContentStream: model.generateContentStream.bind(model),
      countTokens: model.countTokens.bind(model),
      embedContent: async (request) => {
        const embeddingModel = googleGenAI.getGenerativeModel({ model: 'text-embedding-004' });
        return embeddingModel.embedContent(request);
      },
    } as ContentGenerator;
  } else if (config.authType === AuthType.USE_OPENAI) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    if (!config.model?.trim()) {
      throw new Error('OpenAI model is required');
    }

    // Import OpenAIContentGenerator dynamically to avoid circular dependencies
    const { OpenAIContentGenerator } = await import(
      './openaiContentGenerator.js'
    );

    // Always use OpenAIContentGenerator, logging is controlled by enableOpenAILogging flag
    baseGenerator = new OpenAIContentGenerator(config.apiKey, config.model, gcConfig);
  } else if (config.authType === AuthType.USE_OPENROUTER) {
    if (!config.apiKey) {
      throw new Error('OpenRouter API key is required');
    }
    if (!config.model?.trim()) {
      throw new Error('OpenRouter model is required');
    }

    // Import OpenRouterContentGenerator dynamically to avoid circular dependencies
    const { OpenRouterContentGenerator } = await import(
      './openrouterContentGenerator.js'
    );

    baseGenerator = new OpenRouterContentGenerator(
      config.apiKey,
      config.model,
      gcConfig,
      (config as ContentGeneratorConfig & { provider?: string }).provider,
    );
  } else {
    throw new Error(
      `Error creating contentGenerator: Unsupported authType: ${config.authType}`,
    );
  }

  // If vision routing is enabled and we have vision config, create a routing generator
  if (config.enableSmartRouting && config.visionConfig) {
    try {
      // Import RoutingContentGenerator dynamically
      const { RoutingContentGenerator } = await import(
        './routingContentGenerator.js'
      );
      
      // Create vision model content generator
      const visionConfig: ContentGeneratorConfig = {
        ...config,
        model: config.visionConfig.visionModel,
        apiKey: config.visionConfig.visionApiKey || config.apiKey,
      };
      
      // For now, vision models are primarily on OpenRouter
      if (config.visionConfig.visionProvider === 'openrouter' || !config.visionConfig.visionProvider) {
        const { OpenRouterContentGenerator } = await import(
          './openrouterContentGenerator.js'
        );
        
        const visionGenerator = new OpenRouterContentGenerator(
          visionConfig.apiKey!,
          visionConfig.model,
          gcConfig,
          config.visionConfig.visionProvider
        );
        
        console.debug(`[ContentGenerator] Created routing generator with text model: ${config.model}, vision model: ${config.visionConfig.visionModel}`);
        
        return new RoutingContentGenerator(
          baseGenerator,
          visionGenerator,
          config.visionConfig,
          config.model
        );
      }
    } catch (error) {
      console.warn('[ContentGenerator] Failed to create routing content generator, falling back to base generator:', error);
    }
  }

  return baseGenerator;
}
