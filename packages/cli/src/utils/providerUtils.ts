/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getCredential, AIProvider } from '@pk-code/core';
import { OpenAIProvider } from '@pk-code/openai';
import { GeminiProvider } from '@pk-code/gemini';
import { OpenRouterProvider } from '@pk-code/openrouter';
import { AnthropicProvider } from '@pk-code/anthropic';
import { CohereProvider } from '@pk-code/cohere';

/**
 * Creates an AI provider instance based on the provider name
 */
function createProvider(name: string): AIProvider | null {
  switch (name) {
    case 'openai':
      return new OpenAIProvider();
    case 'gemini':
      return new GeminiProvider();
    case 'openrouter':
      return new OpenRouterProvider();
    case 'anthropic':
      return new AnthropicProvider();
    case 'cohere':
      return new CohereProvider();
    default:
      return null;
  }
}

/**
 * Gets a configured AI provider for agent prompt generation
 */
export async function getConfiguredProvider(
  preferredProvider: string = 'openrouter',
): Promise<AIProvider | null> {
  // Try the preferred provider first
  const apiKey = await getCredential(preferredProvider);
  if (apiKey) {
    const provider = createProvider(preferredProvider);
    if (provider) {
      try {
        await provider.initialize({ apiKey });
        return provider;
      } catch (error) {
        console.warn(`Failed to initialize ${preferredProvider}:`, error);
      }
    }
  }

  // Fallback providers in order of preference (OpenRouter first for Qwen access)
  const fallbackProviders = ['openrouter', 'gemini', 'openai', 'anthropic', 'cohere']
    .filter(p => p !== preferredProvider);

  for (const providerName of fallbackProviders) {
    const fallbackApiKey = await getCredential(providerName);
    if (fallbackApiKey) {
      const provider = createProvider(providerName);
      if (provider) {
        try {
          await provider.initialize({ apiKey: fallbackApiKey });
          return provider;
        } catch (error) {
          console.warn(`Failed to initialize fallback ${providerName}:`, error);
        }
      }
    }
  }

  return null;
}

/**
 * Gets the default provider for agent creation (prefer OpenRouter with Qwen model)
 */
export async function getDefaultAgentProvider(): Promise<AIProvider | null> {
  return getConfiguredProvider('openrouter');
}