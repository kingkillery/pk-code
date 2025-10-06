/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import {
  loadRegistry,
  clearRegistryCache,
  getAllProviders,
  getProvider,
  getProviders,
  getProvidersWithCapability,
  getProvidersWithModelType,
  getProviderDefaultModels,
  getProviderDefaultModel,
  listDefaultModelsByType,
  selectBestModel,
  validateProviderConfiguration,
  getConfiguredProviders,
  getRegistryMetadata,
} from '../../src/providers/registry-service.js';

// Mock the file system
vi.mock('node:fs/promises');

describe('Registry Service', () => {
  const mockRegistry = {
    version: '1.0.0',
    lastUpdated: '2025-10-05T20:30:00.000Z',
    providers: {
      'test-provider': {
        id: 'test-provider',
        name: 'Test Provider',
        description: 'A test provider',
        envKey: 'TEST_PROVIDER_API_KEY',
        package: '@pk-code/test-provider',
        defaultModels: {
          chat: 'test-chat-model',
          fast: 'test-fast-model',
          embedding: 'test-embedding-model',
        },
        capabilities: {
          vision: true,
          toolCalling: true,
          streaming: true,
          embedding: true,
          imageGeneration: false,
          maxContext: 128000,
          supportsSystemMessages: true,
          supportsParallelTools: true,
        },
        pricing: {
          currency: 'USD',
          perMillionTokens: {
            'test-chat-model': { input: 1.0, output: 2.0 },
            'test-fast-model': { input: 0.5, output: 1.0 },
          },
        },
        endpoints: {
          chat: 'https://api.test-provider.com/v1/chat',
          embedding: 'https://api.test-provider.com/v1/embeddings',
        },
      },
      'vision-provider': {
        id: 'vision-provider',
        name: 'Vision Provider',
        description: 'A vision-capable provider',
        envKey: 'VISION_PROVIDER_API_KEY',
        package: '@pk-code/vision-provider',
        defaultModels: {
          chat: 'vision-chat-model',
          fast: 'vision-fast-model',
        },
        capabilities: {
          vision: true,
          toolCalling: true,
          streaming: true,
          embedding: false,
          imageGeneration: true,
          maxContext: 256000,
          supportsSystemMessages: true,
          supportsParallelTools: false,
        },
        endpoints: {
          chat: 'https://api.vision-provider.com/v1/chat',
          image: 'https://api.vision-provider.com/v1/images',
        },
      },
    },
    capabilityDefinitions: {
      vision: { name: 'Vision', description: 'Can process images' },
      toolCalling: { name: 'Tool Calling', description: 'Can call tools' },
    },
  };

  beforeEach(() => {
    clearRegistryCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearRegistryCache();
  });

  describe('loadRegistry', () => {
    it('should load and validate registry successfully', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockRegistry));

      const registry = await loadRegistry();

      expect(registry.version).toBe('1.0.0');
      expect(Object.keys(registry.providers)).toHaveLength(2);
      expect(registry.providers['test-provider']).toBeDefined();
    });

    it('should cache loaded registry', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockRegistry));

      const registry1 = await loadRegistry();
      const registry2 = await loadRegistry();

      expect(registry1).toBe(registry2);
      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should throw error for invalid registry', async () => {
      const invalidRegistry = { ...mockRegistry, version: 'invalid' };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidRegistry));

      await expect(loadRegistry()).rejects.toThrow('Invalid provider registry');
    });

    it('should throw error for missing file', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      await expect(loadRegistry()).rejects.toThrow(
        'Failed to load provider registry',
      );
    });
  });

  describe('getAllProviders', () => {
    it('should return all providers', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockRegistry));

      const providers = await getAllProviders();

      expect(providers).toHaveLength(2);
      expect(providers[0].id).toBe('test-provider');
      expect(providers[1].id).toBe('vision-provider');
    });
  });

  describe('getProvider', () => {
    beforeEach(() => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockRegistry));
    });

    it('should return provider by ID', async () => {
      const provider = await getProvider('test-provider');

      expect(provider).toBeDefined();
      expect(provider?.id).toBe('test-provider');
      expect(provider?.name).toBe('Test Provider');
    });

    it('should return null for unknown provider', async () => {
      const provider = await getProvider('unknown-provider');

      expect(provider).toBeNull();
    });
  });

  describe('getProviderDefaultModels', () => {
    beforeEach(() => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockRegistry));
    });

    it('should return default models for a provider', async () => {
      const defaults = await getProviderDefaultModels('test-provider');

      expect(defaults).toEqual({
        chat: 'test-chat-model',
        fast: 'test-fast-model',
        embedding: 'test-embedding-model',
      });
    });

    it('should return null for unknown provider', async () => {
      const defaults = await getProviderDefaultModels('missing-provider');
      expect(defaults).toBeNull();
    });
  });

  describe('getProviderDefaultModel', () => {
    beforeEach(() => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockRegistry));
    });

    it('should return a specific default model for a provider', async () => {
      const model = await getProviderDefaultModel('test-provider', 'chat');
      expect(model).toBe('test-chat-model');
    });

    it('should return null when model type is not available', async () => {
      const model = await getProviderDefaultModel(
        'vision-provider',
        'embedding',
      );
      expect(model).toBeNull();
    });
  });

  describe('listDefaultModelsByType', () => {
    beforeEach(() => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockRegistry));
    });

    it('should list providers offering a given model type', async () => {
      const summaries = await listDefaultModelsByType('chat');

      expect(summaries).toEqual([
        expect.objectContaining({
          providerId: 'test-provider',
          model: 'test-chat-model',
          hasPricing: true,
        }),
        expect.objectContaining({
          providerId: 'vision-provider',
          model: 'vision-chat-model',
          hasPricing: false,
        }),
      ]);
    });

    it('should respect additional filters', async () => {
      const summaries = await listDefaultModelsByType('chat', {
        capability: 'embedding',
      });

      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toMatchObject({
        providerId: 'test-provider',
        model: 'test-chat-model',
      });
    });
  });

  describe('getProviders', () => {
    beforeEach(() => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockRegistry));
    });

    it('should return all providers when no filter specified', async () => {
      const providers = await getProviders();

      expect(providers).toHaveLength(2);
    });

    it('should filter by capability', async () => {
      const providers = await getProviders({ capability: 'vision' });

      expect(providers).toHaveLength(2);
    });

    it('should filter by embedding capability', async () => {
      const providers = await getProviders({ capability: 'embedding' });

      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('test-provider');
    });

    it('should filter by pricing availability', async () => {
      const providers = await getProviders({ hasPricing: true });

      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('test-provider');
    });

    it('should filter by model type', async () => {
      const providers = await getProviders({ supportsModelType: 'embedding' });

      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('test-provider');
    });

    it('should filter by minimum context size', async () => {
      const providers = await getProviders({ minContextSize: 200000 });

      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('vision-provider');
    });
  });

  describe('getProvidersWithCapability', () => {
    beforeEach(() => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockRegistry));
    });

    it('should return providers with vision capability', async () => {
      const providers = await getProvidersWithCapability('vision');

      expect(providers).toHaveLength(2);
    });

    it('should return providers with embedding capability', async () => {
      const providers = await getProvidersWithCapability('embedding');

      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('test-provider');
    });
  });

  describe('getProvidersWithModelType', () => {
    beforeEach(() => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockRegistry));
    });

    it('should return providers with chat model', async () => {
      const providers = await getProvidersWithModelType('chat');

      expect(providers).toHaveLength(2);
    });

    it('should return providers with embedding model', async () => {
      const providers = await getProvidersWithModelType('embedding');

      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('test-provider');
    });
  });

  describe('selectBestModel', () => {
    beforeEach(() => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockRegistry));
    });

    it('should select best chat model', async () => {
      const selection = await selectBestModel({ modelType: 'chat' });

      expect(selection).toBeDefined();
      expect(selection?.modelType).toBe('chat');
      expect(selection?.provider.id).toBe('test-provider');
    });

    it('should select cheapest model when requested', async () => {
      const selection = await selectBestModel({
        modelType: 'chat',
        preferCheapest: true,
      });

      expect(selection).toBeDefined();
      expect(selection?.provider.id).toBe('test-provider');
    });

    it('should filter by capability', async () => {
      const selection = await selectBestModel({
        modelType: 'chat',
        capability: 'embedding',
      });

      expect(selection).toBeDefined();
      expect(selection?.provider.id).toBe('test-provider');
    });

    it('should exclude specified providers', async () => {
      const selection = await selectBestModel({
        modelType: 'chat',
        excludeProviders: ['test-provider'],
      });

      expect(selection).toBeDefined();
      expect(selection?.provider.id).toBe('vision-provider');
    });

    it('should return null when no suitable model found', async () => {
      const selection = await selectBestModel({
        modelType: 'nonexistent',
        excludeProviders: ['test-provider', 'vision-provider'],
      });

      expect(selection).toBeNull();
    });
  });

  describe('validateProviderConfiguration', () => {
    beforeEach(() => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockRegistry));
    });

    it('should validate configured provider', async () => {
      // Mock environment variable
      process.env.TEST_PROVIDER_API_KEY = 'test-key';

      const validation = await validateProviderConfiguration('test-provider');

      expect(validation.isValid).toBe(true);
      expect(validation.missingVars).toHaveLength(0);
      expect(validation.provider?.id).toBe('test-provider');

      // Clean up
      delete process.env.TEST_PROVIDER_API_KEY;
    });

    it('should detect missing environment variable', async () => {
      const validation = await validateProviderConfiguration('test-provider');

      expect(validation.isValid).toBe(false);
      expect(validation.missingVars).toContain('TEST_PROVIDER_API_KEY');
    });

    it('should return null for unknown provider', async () => {
      const validation =
        await validateProviderConfiguration('unknown-provider');

      expect(validation.isValid).toBe(false);
      expect(validation.missingVars).toHaveLength(0);
      expect(validation.provider).toBeNull();
    });
  });

  describe('getRegistryMetadata', () => {
    beforeEach(() => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockRegistry));
    });

    it('should return registry metadata', async () => {
      const metadata = await getRegistryMetadata();

      expect(metadata.version).toBe('1.0.0');
      expect(metadata.lastUpdated).toBe('2025-10-05T20:30:00.000Z');
      expect(metadata.providerCount).toBe(2);
    });
  });

  describe('getConfiguredProviders', () => {
    beforeEach(() => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockRegistry));
    });

    it('should return only configured providers', async () => {
      // Mock one provider as configured
      process.env.TEST_PROVIDER_API_KEY = 'test-key';

      const configuredProviders = await getConfiguredProviders();

      expect(configuredProviders).toHaveLength(1);
      expect(configuredProviders[0].id).toBe('test-provider');

      // Clean up
      delete process.env.TEST_PROVIDER_API_KEY;
    });

    it('should return empty array when no providers configured', async () => {
      const configuredProviders = await getConfiguredProviders();

      expect(configuredProviders).toHaveLength(0);
    });
  });
});
