/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  getProviderDefaultModel,
  getProviderDefaultModels,
  selectBestModel,
} from '../providers/registry-service.js';

const GOOGLE_PROVIDER_ID = 'google';

const FALLBACK_GEMINI_MODELS = {
  chat: 'gemini-1.5-pro',
  fast: 'gemini-1.5-flash',
  embedding: 'text-embedding-004',
} as const;

// Legacy constants for backward compatibility - retain fallbacks for synchronous consumers
// @deprecated Use getDefaultModelForProvider('google', 'chat') instead
export const DEFAULT_GEMINI_MODEL = FALLBACK_GEMINI_MODELS.chat;

// @deprecated Use getDefaultModelForProvider('google', 'fast') instead
export const DEFAULT_GEMINI_FLASH_MODEL = FALLBACK_GEMINI_MODELS.fast;

// @deprecated Use getDefaultModelForProvider('google', 'embedding') instead
export const DEFAULT_GEMINI_EMBEDDING_MODEL = FALLBACK_GEMINI_MODELS.embedding;

/**
 * Get the default model for a provider and model type
 * @param providerId The provider ID
 * @param modelType The model type (chat, fast, embedding, etc.)
 * @returns The default model name or null if not found
 */
export async function getDefaultModelForProvider(
  providerId: string,
  modelType: 'chat' | 'fast' | 'embedding' | 'image' | 'legacy',
): Promise<string | null> {
  const registryModel = await getProviderDefaultModel(providerId, modelType);
  if (registryModel) {
    return registryModel;
  }

  if (providerId === GOOGLE_PROVIDER_ID) {
    return (
      FALLBACK_GEMINI_MODELS[
        modelType as keyof typeof FALLBACK_GEMINI_MODELS
      ] ?? null
    );
  }

  return null;
}

/**
 * Get the best chat model based on criteria
 * @param criteria Selection criteria
 * @returns Best model selection or null
 */
export async function getBestChatModel(criteria?: {
  capability?:
    | 'vision'
    | 'toolCalling'
    | 'streaming'
    | 'embedding'
    | 'imageGeneration';
  preferCheapest?: boolean;
  minContextSize?: number;
  excludeProviders?: string[];
}) {
  return selectBestModel({
    modelType: 'chat',
    ...criteria,
  });
}

/**
 * Get the best fast model based on criteria
 * @param criteria Selection criteria
 * @returns Best model selection or null
 */
export async function getBestFastModel(criteria?: {
  capability?:
    | 'vision'
    | 'toolCalling'
    | 'streaming'
    | 'embedding'
    | 'imageGeneration';
  preferCheapest?: boolean;
  minContextSize?: number;
  excludeProviders?: string[];
}) {
  return selectBestModel({
    modelType: 'fast',
    ...criteria,
  });
}

/**
 * Get the best embedding model based on criteria
 * @param criteria Selection criteria
 * @returns Best model selection or null
 */
export async function getBestEmbeddingModel(criteria?: {
  preferCheapest?: boolean;
  excludeProviders?: string[];
}) {
  return selectBestModel({
    modelType: 'embedding',
    capability: 'embedding',
    ...criteria,
  });
}

/**
 * Get a model with fallback options
 * @param preferredModels Array of preferred model names in order
 * @param capability Optional capability requirement
 * @returns Model selection or null
 */
export async function getModelWithFallback(
  preferredModels: string[],
  capability?:
    | 'vision'
    | 'toolCalling'
    | 'streaming'
    | 'embedding'
    | 'imageGeneration',
) {
  const { selectModelWithFallback } = await import(
    '../providers/registry-service.js'
  );
  return selectModelWithFallback(preferredModels, capability);
}

/**
 * Legacy function to get Google's default models
 * @deprecated Use getDefaultModelForProvider('google', modelType) instead
 */
export async function getGoogleDefaultModels() {
  const defaults = await getProviderDefaultModels(GOOGLE_PROVIDER_ID);

  return {
    chat: defaults?.chat || DEFAULT_GEMINI_MODEL,
    fast: defaults?.fast || DEFAULT_GEMINI_FLASH_MODEL,
    embedding: defaults?.embedding || DEFAULT_GEMINI_EMBEDDING_MODEL,
  };
}
