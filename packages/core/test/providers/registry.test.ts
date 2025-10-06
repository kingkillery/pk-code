/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  ProviderRegistrySchema,
  isValidProvider,
  isValidProviderRegistry,
  type Provider,
  type ProviderRegistry,
} from '../../src/providers/registry.js';

describe('Provider Registry Schema', () => {
  const validProvider: Provider = {
    id: 'test-provider',
    name: 'Test Provider',
    description: 'A test provider for unit testing',
    envKey: 'TEST_PROVIDER_API_KEY',
    package: '@pk-code/test-provider',
    defaultModels: {
      chat: 'test-chat-model',
      fast: 'test-fast-model',
    },
    capabilities: {
      vision: true,
      toolCalling: true,
      streaming: true,
      embedding: false,
      imageGeneration: false,
      maxContext: 128000,
      supportsSystemMessages: true,
      supportsParallelTools: true,
    },
    pricing: {
      currency: 'USD',
      perMillionTokens: {
        'test-chat-model': {
          input: 1.0,
          output: 2.0,
        },
      },
    },
    endpoints: {
      chat: 'https://api.test-provider.com/v1/chat',
      embedding: 'https://api.test-provider.com/v1/embeddings',
    },
  };

  const validRegistry: ProviderRegistry = {
    version: '1.0.0',
    lastUpdated: '2025-10-05T20:30:00.000Z',
    providers: {
      'test-provider': validProvider,
    },
    capabilityDefinitions: {
      vision: {
        name: 'Vision',
        description: 'Can process and analyze images',
      },
      toolCalling: {
        name: 'Tool Calling',
        description: 'Can call external tools and functions',
      },
    },
  };

  describe('Provider Validation', () => {
    it('should validate a correct provider', () => {
      expect(isValidProvider(validProvider)).toBe(true);
    });

    it('should reject provider with missing required fields', () => {
      const invalidProvider = { ...validProvider };
      delete (invalidProvider as any).id;
      expect(isValidProvider(invalidProvider)).toBe(false);
    });

    it('should reject provider with invalid ID format', () => {
      const invalidProvider = { ...validProvider, id: 'Invalid_ID!' };
      expect(isValidProvider(invalidProvider)).toBe(false);
    });

    it('should reject provider with invalid env key format', () => {
      const invalidProvider = { ...validProvider, envKey: 'invalid_key' };
      expect(isValidProvider(invalidProvider)).toBe(false);
    });

    it('should reject provider with invalid package name', () => {
      const invalidProvider = { ...validProvider, package: 'invalid-package' };
      expect(isValidProvider(invalidProvider)).toBe(false);
    });

    it('should reject provider with no default models', () => {
      const invalidProvider = { ...validProvider, defaultModels: {} };
      expect(isValidProvider(invalidProvider)).toBe(false);
    });

    it('should reject provider with no endpoints', () => {
      const invalidProvider = { ...validProvider, endpoints: {} };
      expect(isValidProvider(invalidProvider)).toBe(false);
    });

    it('should accept provider without optional pricing', () => {
      const providerWithoutPricing = { ...validProvider };
      delete (providerWithoutPricing as any).pricing;
      expect(isValidProvider(providerWithoutPricing)).toBe(true);
    });

    it('should accept provider with additional environment variables', () => {
      const providerWithAdditionalVars = {
        ...validProvider,
        additionalEnvVars: ['TEST_VAR_1', 'TEST_VAR_2'],
      };
      expect(isValidProvider(providerWithAdditionalVars)).toBe(true);
    });
  });

  describe('Registry Validation', () => {
    it('should validate a correct registry', () => {
      expect(isValidProviderRegistry(validRegistry)).toBe(true);
    });

    it('should reject registry with invalid version format', () => {
      const invalidRegistry = { ...validRegistry, version: '1.0' };
      expect(isValidProviderRegistry(invalidRegistry)).toBe(false);
    });

    it('should reject registry with no providers', () => {
      const invalidRegistry = { ...validRegistry, providers: {} };
      expect(isValidProviderRegistry(invalidRegistry)).toBe(false);
    });

    it('should reject registry with invalid provider', () => {
      const invalidRegistry = {
        ...validRegistry,
        providers: {
          'test-provider': { ...validProvider, id: 'Invalid_ID!' },
        },
      };
      expect(isValidProviderRegistry(invalidRegistry)).toBe(false);
    });

    it('should accept registry without lastUpdated field', () => {
      const registryWithoutLastUpdated = { ...validRegistry };
      delete (registryWithoutLastUpdated as any).lastUpdated;
      expect(isValidProviderRegistry(registryWithoutLastUpdated)).toBe(true);
    });
  });

  describe('Schema Validation', () => {
    it('should parse valid registry with schema', () => {
      const result = ProviderRegistrySchema.safeParse(validRegistry);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('1.0.0');
        expect(Object.keys(result.data.providers)).toContain('test-provider');
      }
    });

    it('should fail to parse invalid registry with schema', () => {
      const invalidRegistry = { ...validRegistry, version: 'invalid' };
      const result = ProviderRegistrySchema.safeParse(invalidRegistry);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toContain('version');
      }
    });
  });
});
