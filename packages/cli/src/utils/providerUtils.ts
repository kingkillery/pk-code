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
  // First, try environment variables directly for the preferred provider
  let apiKey: string | null = null;

  // Use environment variables directly to avoid credential resolution issues
  if (preferredProvider === 'openrouter' && process.env.OPENROUTER_API_KEY) {
    apiKey = process.env.OPENROUTER_API_KEY;
  } else if (preferredProvider === 'openai' && process.env.OPENAI_API_KEY) {
    apiKey = process.env.OPENAI_API_KEY;
  } else if (preferredProvider === 'gemini' && process.env.GEMINI_API_KEY) {
    apiKey = process.env.GEMINI_API_KEY;
  } else if (
    preferredProvider === 'anthropic' &&
    process.env.ANTHROPIC_API_KEY
  ) {
    apiKey = process.env.ANTHROPIC_API_KEY;
  } else if (preferredProvider === 'cohere' && process.env.COHERE_API_KEY) {
    apiKey = process.env.COHERE_API_KEY;
  }

  // Fallback to getCredential if environment variable not found
  if (!apiKey) {
    try {
      apiKey = await getCredential(preferredProvider);
    } catch (error) {
      console.debug(
        `Could not get credentials for ${preferredProvider}:`,
        error,
      );
    }
  }

  if (apiKey) {
    const provider = createProvider(preferredProvider);
    if (provider) {
      try {
        await provider.initialize({ apiKey });
        console.debug(
          `Successfully initialized ${preferredProvider} provider for agent operations`,
        );
        return provider;
      } catch (error) {
        console.warn(`Failed to initialize ${preferredProvider}:`, error);
      }
    }
  }

  // Only try fallback providers if the user doesn't have the preferred provider configured
  // This prevents authentication conflicts when user is properly set up with OpenRouter
  if (!apiKey) {
    console.debug(
      `No API key found for ${preferredProvider}, trying fallback providers...`,
    );

    // Fallback providers in order of preference (OpenRouter first for Qwen access)
    const fallbackProviders = [
      'openrouter',
      'gemini',
      'openai',
      'anthropic',
      'cohere',
    ].filter((p) => p !== preferredProvider);

    for (const providerName of fallbackProviders) {
      let fallbackApiKey: string | null = null;

      // Try environment variables first for fallback providers too
      if (providerName === 'openrouter' && process.env.OPENROUTER_API_KEY) {
        fallbackApiKey = process.env.OPENROUTER_API_KEY;
      } else if (providerName === 'openai' && process.env.OPENAI_API_KEY) {
        fallbackApiKey = process.env.OPENAI_API_KEY;
      } else if (providerName === 'gemini' && process.env.GEMINI_API_KEY) {
        fallbackApiKey = process.env.GEMINI_API_KEY;
      } else if (
        providerName === 'anthropic' &&
        process.env.ANTHROPIC_API_KEY
      ) {
        fallbackApiKey = process.env.ANTHROPIC_API_KEY;
      } else if (providerName === 'cohere' && process.env.COHERE_API_KEY) {
        fallbackApiKey = process.env.COHERE_API_KEY;
      }

      if (!fallbackApiKey) {
        try {
          fallbackApiKey = await getCredential(providerName);
        } catch (error) {
          console.debug(
            `Could not get credentials for fallback provider ${providerName}:`,
            error,
          );
          continue;
        }
      }

      if (fallbackApiKey) {
        const provider = createProvider(providerName);
        if (provider) {
          try {
            await provider.initialize({ apiKey: fallbackApiKey });
            console.debug(
              `Successfully initialized fallback ${providerName} provider for agent operations`,
            );
            return provider;
          } catch (error) {
            console.warn(
              `Failed to initialize fallback ${providerName}:`,
              error,
            );
          }
        }
      }
    }
  }

  console.debug('No AI provider could be initialized for agent operations');
  return null;
}

/**
 * Gets the default provider for agent creation (prefer OpenRouter with Qwen model)
 */
export async function getDefaultAgentProvider(): Promise<AIProvider | null> {
  return getConfiguredProvider('openrouter');
}
