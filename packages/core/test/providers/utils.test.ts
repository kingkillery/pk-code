/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  providerSupportsCapability,
  providerHasModelType,
  getProviderDefaultModelId,
  getProviderCapabilities,
  formatProviderInfo,
  formatProviderTableRow,
  getProviderTableHeader,
  getProviderTableSeparator,
  compareProvidersByCapabilities,
  compareProvidersByContextSize,
  compareProvidersByPricing,
  isValidModelName,
  extractProviderFromModel,
  getModelSuggestions,
} from '../../src/providers/utils.js';
import type { Provider } from '../../src/providers/registry.js';

describe('Provider Utils', () => {
  const mockProvider: Provider = {
    id: 'test-provider',
    name: 'Test Provider',
    description: 'A test provider for unit testing',
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
        'test-embedding-model': { input: 0.1, output: 0.1 },
      },
    },
    endpoints: {
      chat: 'https://api.test-provider.com/v1/chat',
      embedding: 'https://api.test-provider.com/v1/embeddings',
    },
  };

  const mockProviderWithoutPricing: Provider = {
    ...mockProvider,
    id: 'no-pricing-provider',
    pricing: undefined,
  };

  describe('providerSupportsCapability', () => {
    it('should return true for supported capability', () => {
      expect(providerSupportsCapability(mockProvider, 'vision')).toBe(true);
      expect(providerSupportsCapability(mockProvider, 'toolCalling')).toBe(
        true,
      );
    });

    it('should return false for unsupported capability', () => {
      expect(providerSupportsCapability(mockProvider, 'imageGeneration')).toBe(
        false,
      );
    });
  });

  describe('providerHasModelType', () => {
    it('should return true for existing model type', () => {
      expect(providerHasModelType(mockProvider, 'chat')).toBe(true);
      expect(providerHasModelType(mockProvider, 'embedding')).toBe(true);
    });

    it('should return false for non-existing model type', () => {
      expect(providerHasModelType(mockProvider, 'image')).toBe(false);
    });
  });

  describe('getProviderDefaultModelId', () => {
    it('should return model name for existing type', () => {
      expect(getProviderDefaultModelId(mockProvider, 'chat')).toBe(
        'test-chat-model',
      );
      expect(getProviderDefaultModelId(mockProvider, 'fast')).toBe(
        'test-fast-model',
      );
    });

    it('should return null for non-existing type', () => {
      expect(getProviderDefaultModelId(mockProvider, 'image')).toBeNull();
    });
  });

  describe('getProviderCapabilities', () => {
    it('should return array of enabled capabilities', () => {
      const capabilities = getProviderCapabilities(mockProvider);

      expect(capabilities).toContain('vision');
      expect(capabilities).toContain('toolCalling');
      expect(capabilities).toContain('streaming');
      expect(capabilities).toContain('embedding');
      expect(capabilities).toContain('supportsSystemMessages');
      expect(capabilities).toContain('supportsParallelTools');
      expect(capabilities).not.toContain('imageGeneration');
    });
  });

  describe('formatProviderInfo', () => {
    it('should format provider information as readable text', () => {
      const info = formatProviderInfo(mockProvider);

      expect(info).toContain('Test Provider (test-provider)');
      expect(info).toContain('A test provider for unit testing');
      expect(info).toContain('TEST_PROVIDER_API_KEY');
      expect(info).toContain('@pk-code/test-provider');
      expect(info).toContain('Chat, Fast, Embedding');
      expect(info).toContain('vision, tool calling, streaming');
      expect(info).toContain('128,000 tokens');
      expect(info).toContain('Available');
    });
  });

  describe('formatProviderTableRow', () => {
    it('should format provider as table row', () => {
      const row = formatProviderTableRow(mockProvider);

      expect(row).toContain('test-provider');
      expect(row).toContain('Test Provider');
      expect(row).toContain('VIM/TOO/STR/EMA/SYS/PAR'); // Capabilities abbreviations
      expect(row).toContain('chat,fast,embe'); // Model type abbreviations
      expect(row).toContain('128,000');
      expect(row).toContain('Yes'); // Has pricing
    });
  });

  describe('Table formatting', () => {
    it('should return table header', () => {
      const header = getProviderTableHeader();
      expect(header).toContain('ID');
      expect(header).toContain('Name');
      expect(header).toContain('Capabilities');
      expect(header).toContain('Model Types');
      expect(header).toContain('Max Context');
      expect(header).toContain('Pricing');
    });

    it('should return table separator', () => {
      const separator = getProviderTableSeparator();
      expect(separator).toContain('---');
    });
  });

  describe('compareProvidersByCapabilities', () => {
    it('should sort providers by capability count', () => {
      const providerWithFewCaps: Provider = {
        ...mockProvider,
        id: 'few-caps',
        capabilities: {
          ...mockProvider.capabilities,
          vision: false,
          embedding: false,
          imageGeneration: false,
          supportsParallelTools: false,
        },
      };

      const result = compareProvidersByCapabilities(
        mockProvider,
        providerWithFewCaps,
      );
      expect(result).toBe(-1); // mockProvider has more capabilities
    });

    it('should return 0 for equal capability count', () => {
      const result = compareProvidersByCapabilities(mockProvider, mockProvider);
      expect(result).toBe(0);
    });
  });

  describe('compareProvidersByContextSize', () => {
    it('should sort providers by context size', () => {
      const providerWithSmallContext: Provider = {
        ...mockProvider,
        id: 'small-context',
        capabilities: {
          ...mockProvider.capabilities,
          maxContext: 64000,
        },
      };

      const result = compareProvidersByContextSize(
        mockProvider,
        providerWithSmallContext,
      );
      expect(result).toBe(-1); // mockProvider has larger context
    });
  });

  describe('compareProvidersByPricing', () => {
    it('should sort providers by pricing', () => {
      const result = compareProvidersByPricing(
        mockProvider,
        mockProviderWithoutPricing,
        'chat',
      );
      expect(result).toBe(-1); // mockProvider has pricing, should come first
    });

    it('should handle providers without pricing', () => {
      const result = compareProvidersByPricing(
        mockProviderWithoutPricing,
        mockProvider,
        'chat',
      );
      expect(result).toBe(1); // mockProviderWithoutPricing should come after
    });

    it('should handle providers without specified model', () => {
      const providerWithoutChatModel: Provider = {
        ...mockProvider,
        id: 'no-chat',
        defaultModels: {
          fast: 'test-fast-model',
        },
      };

      const result = compareProvidersByPricing(
        mockProvider,
        providerWithoutChatModel,
        'chat',
      );
      expect(result).toBe(-1); // providerWithoutChatModel should come after
    });
  });

  describe('isValidModelName', () => {
    it('should validate correct model names', () => {
      expect(isValidModelName('gpt-4')).toBe(true);
      expect(isValidModelName('claude-3-5-sonnet-20241022')).toBe(true);
      expect(isValidModelName('anthropic/claude-3-5-sonnet')).toBe(true);
      expect(isValidModelName('meta-llama/Meta-Llama-3.1-70B-Instruct')).toBe(
        true,
      );
    });

    it('should reject invalid model names', () => {
      expect(isValidModelName('')).toBe(false);
      expect(isValidModelName('invalid name!')).toBe(false);
      expect(isValidModelName('model@name')).toBe(false);
    });
  });

  describe('extractProviderFromModel', () => {
    it('should extract provider from OpenAI models', () => {
      expect(extractProviderFromModel('gpt-4')).toBe('openai');
      expect(extractProviderFromModel('gpt-3.5-turbo')).toBe('openai');
      expect(extractProviderFromModel('text-embedding-ada-002')).toBe('openai');
    });

    it('should extract provider from Anthropic models', () => {
      expect(extractProviderFromModel('claude-3-5-sonnet-20241022')).toBe(
        'anthropic',
      );
      expect(extractProviderFromModel('claude-3-haiku-20240307')).toBe(
        'anthropic',
      );
    });

    it('should extract provider from Google models', () => {
      expect(extractProviderFromModel('gemini-1.5-pro')).toBe('google');
      expect(extractProviderFromModel('gemini-1.5-flash')).toBe('google');
    });

    it('should extract provider from OpenRouter models', () => {
      expect(extractProviderFromModel('anthropic/claude-3.5-sonnet')).toBe(
        'openrouter',
      );
      expect(extractProviderFromModel('meta-llama/llama-3.1-8b-instruct')).toBe(
        'openrouter',
      );
    });

    it('should extract provider from other providers', () => {
      expect(extractProviderFromModel('command-r-plus')).toBe('cohere');
      expect(extractProviderFromModel('qwen-2.5-72b-instruct')).toBe('qwen');
    });

    it('should return null for unrecognized models', () => {
      expect(extractProviderFromModel('unknown-model')).toBeNull();
      expect(extractProviderFromModel('random-model-name')).toBeNull();
    });
  });

  describe('getModelSuggestions', () => {
    it('should suggest models matching partial input', () => {
      const suggestions = getModelSuggestions(mockProvider, 'test');
      expect(suggestions).toContain('test-chat-model');
      expect(suggestions).toContain('test-fast-model');
      expect(suggestions).toContain('test-embedding-model');
    });

    it('should suggest models case-insensitively', () => {
      const suggestions = getModelSuggestions(mockProvider, 'CHAT');
      expect(suggestions).toContain('test-chat-model');
    });

    it('should return empty array for no matches', () => {
      const suggestions = getModelSuggestions(mockProvider, 'nomatch');
      expect(suggestions).toHaveLength(0);
    });
  });
});
