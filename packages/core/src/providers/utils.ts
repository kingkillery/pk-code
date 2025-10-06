/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type Provider,
  type ProviderCapability,
  type ModelType,
} from './registry.js';
import {
  getProvidersWithCapability,
  selectBestModel,
} from './registry-service.js';

/**
 * Check if a provider supports a specific capability
 */
export function providerSupportsCapability(
  provider: Provider,
  capability: ProviderCapability,
): boolean {
  return provider.capabilities[capability];
}

/**
 * Check if a provider has a specific model type
 */
export function providerHasModelType(
  provider: Provider,
  modelType: ModelType,
): boolean {
  return Boolean(provider.defaultModels[modelType]);
}

/**
 * Get the default model for a provider and model type
 */
export function getProviderDefaultModelId(
  provider: Provider,
  modelType: ModelType,
): string | null {
  return provider.defaultModels[modelType] || null;
}

/**
 * Get all capabilities of a provider as an array
 */
export function getProviderCapabilities(
  provider: Provider,
): ProviderCapability[] {
  return (Object.keys(provider.capabilities) as ProviderCapability[]).filter(
    (capability) => provider.capabilities[capability],
  );
}

/**
 * Format provider information for display
 */
export function formatProviderInfo(provider: Provider): string {
  const capabilities = getProviderCapabilities(provider)
    .map((cap) => cap.replace(/([A-Z])/g, ' $1').toLowerCase())
    .join(', ');

  const modelTypes = Object.keys(provider.defaultModels)
    .map((type) => type.charAt(0).toUpperCase() + type.slice(1))
    .join(', ');

  return [
    `Provider: ${provider.name} (${provider.id})`,
    `Description: ${provider.description}`,
    `Environment Key: ${provider.envKey}`,
    `Package: ${provider.package}`,
    `Model Types: ${modelTypes}`,
    `Capabilities: ${capabilities}`,
    `Max Context: ${provider.capabilities.maxContext.toLocaleString()} tokens`,
    `Pricing: ${provider.pricing ? 'Available' : 'Not specified'}`,
  ].join('\n');
}

/**
 * Format provider information as a table row
 */
export function formatProviderTableRow(provider: Provider): string {
  const capabilities = getProviderCapabilities(provider)
    .map((cap) => cap.slice(0, 3).toUpperCase())
    .join('/');

  const modelTypes = Object.keys(provider.defaultModels)
    .map((type) => type.slice(0, 4))
    .join(',');

  return [
    provider.id.padEnd(12),
    provider.name.padEnd(12),
    capabilities.padEnd(15),
    modelTypes.padEnd(20),
    provider.capabilities.maxContext.toLocaleString().padEnd(10),
    provider.pricing ? 'Yes' : 'No',
  ].join(' | ');
}

/**
 * Get table header for provider listing
 */
export function getProviderTableHeader(): string {
  return [
    'ID'.padEnd(12),
    'Name'.padEnd(12),
    'Capabilities'.padEnd(15),
    'Model Types'.padEnd(20),
    'Max Context'.padEnd(10),
    'Pricing',
  ].join(' | ');
}

/**
 * Get table separator for provider listing
 */
export function getProviderTableSeparator(): string {
  return [
    '-'.repeat(12),
    '-'.repeat(12),
    '-'.repeat(15),
    '-'.repeat(20),
    '-'.repeat(10),
    '-'.repeat(7),
  ].join(' | ');
}

/**
 * Compare providers by capability set
 */
export function compareProvidersByCapabilities(
  a: Provider,
  b: Provider,
): number {
  const aCapabilities = getProviderCapabilities(a).length;
  const bCapabilities = getProviderCapabilities(b).length;
  return bCapabilities - aCapabilities; // Sort by most capabilities first
}

/**
 * Compare providers by max context size
 */
export function compareProvidersByContextSize(
  a: Provider,
  b: Provider,
): number {
  return b.capabilities.maxContext - a.capabilities.maxContext; // Sort by largest context first
}

/**
 * Compare providers by pricing (cheapest first)
 */
export function compareProvidersByPricing(
  a: Provider,
  b: Provider,
  modelType: ModelType = 'chat',
): number {
  if (!a.pricing && !b.pricing) return 0;
  if (!a.pricing) return 1; // b comes first if it has pricing
  if (!b.pricing) return -1; // a comes first if it has pricing

  const aModel = a.defaultModels[modelType];
  const bModel = b.defaultModels[modelType];

  if (!aModel && !bModel) return 0;
  if (!aModel) return 1;
  if (!bModel) return -1;

  const aPrice = a.pricing.perMillionTokens[aModel]?.input || Infinity;
  const bPrice = b.pricing.perMillionTokens[bModel]?.input || Infinity;

  return aPrice - bPrice;
}

/**
 * Get providers sorted by different criteria
 */
export async function getSortedProviders(
  sortBy: 'name' | 'capabilities' | 'context' | 'pricing' = 'name',
  modelType: ModelType = 'chat',
): Promise<Provider[]> {
  const providers = await getProvidersWithCapability('toolCalling'); // Get all providers that support tool calling

  switch (sortBy) {
    case 'name':
      return providers.sort((a, b) => a.name.localeCompare(b.name));
    case 'capabilities':
      return providers.sort(compareProvidersByCapabilities);
    case 'context':
      return providers.sort(compareProvidersByContextSize);
    case 'pricing':
      return providers.sort((a, b) =>
        compareProvidersByPricing(a, b, modelType),
      );
    default:
      return providers;
  }
}

/**
 * Get recommended providers for specific use cases
 */
export async function getRecommendedProviders(
  useCase: 'general' | 'vision' | 'embedding' | 'fast' | 'large-context',
): Promise<Provider[]> {
  switch (useCase) {
    case 'general': {
      return selectBestModel({ modelType: 'chat', preferCheapest: true }).then(
        (result) => (result ? [result.provider] : []),
      );
    }

    case 'vision': {
      const visionProviders = await getProvidersWithCapability('vision');
      return visionProviders.slice(0, 3); // Top 3 vision providers
    }

    case 'embedding': {
      const embeddingProviders = await getProvidersWithCapability('embedding');
      return embeddingProviders.slice(0, 3); // Top 3 embedding providers
    }

    case 'fast': {
      const fastProviders = await selectBestModel({
        modelType: 'fast',
        preferCheapest: true,
      }).then((result) => (result ? [result.provider] : []));
      return fastProviders;
    }

    case 'large-context': {
      const providers = await getProvidersWithCapability('toolCalling');
      return providers.sort(compareProvidersByContextSize).slice(0, 3); // Top 3 providers with largest context
    }

    default:
      return [];
  }
}

/**
 * Validate model name format
 */
export function isValidModelName(modelName: string): boolean {
  // Basic validation for model names (can be extended)
  return /^[a-zA-Z0-9._/-]+$/.test(modelName) && modelName.length > 0;
}

/**
 * Extract provider ID from model name (if possible)
 */
export function extractProviderFromModel(modelName: string): string | null {
  // Try to extract provider from common patterns
  if (modelName.startsWith('gpt-') || modelName.startsWith('text-'))
    return 'openai';
  if (modelName.startsWith('claude-')) return 'anthropic';
  if (modelName.startsWith('gemini-')) return 'google';
  if (modelName.includes('/')) {
    const provider = modelName.split('/')[0];
    if (
      ['anthropic', 'meta-llama', 'google', 'openai', 'mistralai'].includes(
        provider,
      )
    ) {
      return 'openrouter'; // Assume OpenRouter for multi-provider models
    }
  }
  if (modelName.startsWith('command-')) return 'cohere';
  if (modelName.startsWith('qwen-')) return 'qwen';

  return null;
}

/**
 * Get provider suggestions based on partial input
 */
export async function getProviderSuggestions(
  partialId: string,
): Promise<Provider[]> {
  const allProviders = await getProvidersWithCapability('toolCalling');
  const lowerPartial = partialId.toLowerCase();

  return allProviders.filter(
    (provider) =>
      provider.id.toLowerCase().includes(lowerPartial) ||
      provider.name.toLowerCase().includes(lowerPartial) ||
      provider.description.toLowerCase().includes(lowerPartial),
  );
}

/**
 * Get model suggestions for a provider
 */
export function getModelSuggestions(
  provider: Provider,
  partialModel: string,
): string[] {
  const lowerPartial = partialModel.toLowerCase();
  const allModels = Object.values(provider.defaultModels);

  return allModels.filter((model) =>
    model.toLowerCase().includes(lowerPartial),
  );
}

/**
 * Check if provider is configured and ready to use
 */
export async function isProviderReady(providerId: string): Promise<boolean> {
  try {
    const { validateProviderConfiguration } = await import(
      './registry-service.js'
    );
    const validation = await validateProviderConfiguration(providerId);
    return validation.isValid;
  } catch {
    return false;
  }
}
