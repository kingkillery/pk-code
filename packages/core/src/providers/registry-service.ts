/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type Provider,
  type ProviderRegistry,
  type ProviderCapability,
  type ModelType,
  type ProviderFilter,
  type ModelSelectionCriteria,
  type DefaultModels,
  ProviderRegistrySchema,
} from './registry.js';

// Cache the loaded registry
let cachedRegistry: ProviderRegistry | null = null;
let registryLoadError: Error | null = null;

/**
 * Get the path to the provider registry file
 */
function getRegistryPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.join(__dirname, '../../providers/registry.json');
}

/**
 * Load and validate the provider registry
 */
export async function loadRegistry(): Promise<ProviderRegistry> {
  if (cachedRegistry) {
    return cachedRegistry;
  }

  if (registryLoadError) {
    throw registryLoadError;
  }

  try {
    const registryPath = getRegistryPath();
    const registryData = await fs.readFile(registryPath, 'utf-8');
    const parsed = JSON.parse(registryData);

    const validationResult = ProviderRegistrySchema.safeParse(parsed);
    if (!validationResult.success) {
      const error = new Error(
        `Invalid provider registry: ${validationResult.error.message}`,
      );
      registryLoadError = error;
      throw error;
    }

    cachedRegistry = validationResult.data;
    return cachedRegistry;
  } catch (error) {
    const wrappedError = new Error(
      `Failed to load provider registry: ${(error as Error).message}`,
    );
    registryLoadError = wrappedError;
    throw wrappedError;
  }
}

/**
 * Clear the registry cache (useful for testing or hot reloading)
 */
export function clearRegistryCache(): void {
  cachedRegistry = null;
  registryLoadError = null;
}

/**
 * Get all providers
 */
export async function getAllProviders(): Promise<Provider[]> {
  const registry = await loadRegistry();
  return Object.values(registry.providers);
}

/**
 * Get a specific provider by ID
 */
export async function getProvider(id: string): Promise<Provider | null> {
  try {
    const registry = await loadRegistry();
    return registry.providers[id] || null;
  } catch {
    return null;
  }
}

/**
 * Get all default models configured for a provider
 */
export async function getProviderDefaultModels(
  providerId: string,
): Promise<DefaultModels | null> {
  const provider = await getProvider(providerId);
  return provider ? provider.defaultModels : null;
}

/**
 * Get a specific default model for a provider
 */
export async function getProviderDefaultModel(
  providerId: string,
  modelType: ModelType,
): Promise<string | null> {
  const defaults = await getProviderDefaultModels(providerId);
  if (!defaults) {
    return null;
  }

  return defaults[modelType] || null;
}

/**
 * Get providers that match a filter
 */
export async function getProviders(
  filter: ProviderFilter = {},
): Promise<Provider[]> {
  const providers = await getAllProviders();

  return providers.filter((provider) => {
    if (filter.capability && !provider.capabilities[filter.capability]) {
      return false;
    }

    if (filter.hasPricing && !provider.pricing) {
      return false;
    }

    if (
      filter.supportsModelType &&
      !provider.defaultModels[filter.supportsModelType]
    ) {
      return false;
    }

    if (
      filter.minContextSize &&
      provider.capabilities.maxContext < filter.minContextSize
    ) {
      return false;
    }

    return true;
  });
}

export interface DefaultModelSummary {
  providerId: string;
  providerName: string;
  modelType: ModelType;
  model: string;
  hasPricing: boolean;
  capabilities: ProviderCapability[];
}

/**
 * List default models grouped by model type
 */
export async function listDefaultModelsByType(
  modelType: ModelType,
  filter: Omit<ProviderFilter, 'supportsModelType'> = {},
): Promise<DefaultModelSummary[]> {
  const providers = await getProviders({
    ...filter,
    supportsModelType: modelType,
  });

  return providers
    .map((provider) => {
      const model = provider.defaultModels[modelType];
      if (!model) {
        return null;
      }

      const enabledCapabilities = (
        [
          'vision',
          'toolCalling',
          'streaming',
          'embedding',
          'imageGeneration',
          'supportsSystemMessages',
          'supportsParallelTools',
        ] as ProviderCapability[]
      ).filter((capability) => Boolean(provider.capabilities[capability]));

      return {
        providerId: provider.id,
        providerName: provider.name,
        modelType,
        model,
        hasPricing: Boolean(provider.pricing),
        capabilities: enabledCapabilities,
      } satisfies DefaultModelSummary;
    })
    .filter((entry): entry is DefaultModelSummary => Boolean(entry));
}

/**
 * Get providers that support a specific capability
 */
export async function getProvidersWithCapability(
  capability: ProviderCapability,
): Promise<Provider[]> {
  return getProviders({ capability });
}

/**
 * Get providers that support a specific model type
 */
export async function getProvidersWithModelType(
  modelType: ModelType,
): Promise<Provider[]> {
  return getProviders({ supportsModelType: modelType });
}

/**
 * Get the best model based on selection criteria
 */
export async function selectBestModel(
  criteria: ModelSelectionCriteria,
): Promise<{
  provider: Provider;
  model: string;
  modelType: ModelType;
} | null> {
  const providers = await getProviders({
    capability: criteria.capability,
    minContextSize: criteria.minContextSize,
  });

  // Filter out excluded providers
  const filteredProviders = providers.filter(
    (p) => !criteria.excludeProviders?.includes(p.id),
  );

  if (filteredProviders.length === 0) {
    return null;
  }

  // Determine which model type to use
  const modelType = criteria.modelType || 'chat';

  // Filter providers that have the requested model type
  const providersWithModelType = filteredProviders.filter(
    (p) => p.defaultModels[modelType],
  );

  if (providersWithModelType.length === 0) {
    return null;
  }

  let selectedProvider: Provider;

  if (criteria.preferCheapest) {
    // Select cheapest provider (if pricing info is available)
    const providersWithPricing = providersWithModelType.filter(
      (p) => p.pricing,
    );

    if (providersWithPricing.length > 0) {
      selectedProvider = providersWithPricing.reduce((cheapest, current) => {
        const cheapestPrice =
          cheapest.pricing!.perMillionTokens[cheapest.defaultModels[modelType]!]
            ?.input || Infinity;
        const currentPrice =
          current.pricing!.perMillionTokens[current.defaultModels[modelType]!]
            ?.input || Infinity;
        return currentPrice < cheapestPrice ? current : cheapest;
      });
    } else {
      // Fallback to first provider if no pricing info
      selectedProvider = providersWithModelType[0];
    }
  } else {
    // Select first available provider
    selectedProvider = providersWithModelType[0];
  }

  const model = selectedProvider.defaultModels[modelType]!;

  return {
    provider: selectedProvider,
    model,
    modelType,
  };
}

/**
 * Get a model for a provider with fallback options
 */
export async function selectModelWithFallback(
  preferredModels: string[],
  capability?: ProviderCapability,
): Promise<{
  provider: Provider;
  model: string;
} | null> {
  const providers = await getProviders({ capability });

  for (const modelId of preferredModels) {
    // Try to find a provider that has this exact model
    const matchingProvider = providers.find((p) =>
      Object.values(p.defaultModels).includes(modelId),
    );

    if (matchingProvider) {
      return {
        provider: matchingProvider,
        model: modelId,
      };
    }
  }

  return null;
}

/**
 * Get capability definitions
 */
export async function getCapabilityDefinitions(): Promise<
  Record<string, { name: string; description: string }>
> {
  const registry = await loadRegistry();
  return registry.capabilityDefinitions;
}

/**
 * Validate that a provider's environment variables are set
 */
export async function validateProviderConfiguration(
  providerId: string,
): Promise<{
  isValid: boolean;
  missingVars: string[];
  provider: Provider | null;
}> {
  const provider = await getProvider(providerId);

  if (!provider) {
    return {
      isValid: false,
      missingVars: [],
      provider: null,
    };
  }

  const requiredVars = [provider.envKey];
  if (provider.additionalEnvVars) {
    requiredVars.push(...provider.additionalEnvVars);
  }

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  return {
    isValid: missingVars.length === 0,
    missingVars,
    provider,
  };
}

/**
 * Get all configured providers (those with valid environment variables)
 */
export async function getConfiguredProviders(): Promise<Provider[]> {
  const providers = await getAllProviders();
  const configuredProviders: Provider[] = [];

  for (const provider of providers) {
    const validation = await validateProviderConfiguration(provider.id);
    if (validation.isValid) {
      configuredProviders.push(provider);
    }
  }

  return configuredProviders;
}

/**
 * Get registry metadata
 */
export async function getRegistryMetadata(): Promise<{
  version: string;
  lastUpdated?: string;
  providerCount: number;
}> {
  const registry = await loadRegistry();
  return {
    version: registry.version,
    lastUpdated: registry.lastUpdated,
    providerCount: Object.keys(registry.providers).length,
  };
}
