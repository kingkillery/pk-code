/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getCredential } from '@qwen-code/core';
import { OpenAIProvider } from '@qwen-code/openai';
import { GeminiProvider } from '@qwen-code/gemini';

export async function handleGenerateCommand(prompt: string, providerName: string) {
  const apiKey = await getCredential(providerName);
  if (!apiKey) {
    console.error(`API key for ${providerName} not found. Please configure it using the "config" command.`);
    return;
  }

  const createProvider = (name: string) => {
    import { OpenRouterProvider } from '@qwen-code/openrouter';

    import { AnthropicProvider } from '@qwen-code/anthropic';

    import { CohereProvider } from '@qwen-code/cohere';

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
  };

  const provider = createProvider(providerName);
  if (!provider) {
    console.error(`Unknown provider: ${providerName}`);
    return;
  }

  try {
    await provider.initialize({ apiKey });
    const generatedCode = await provider.generateCode(prompt);
    console.log(generatedCode);
  } catch (error) {
    console.error(`Error with ${providerName}:`, error.message);
    const fallbackProviderName = providerName === 'openai' ? 'gemini' : 'openai';
    console.log(`Attempting to fallback to ${fallbackProviderName}...`);

    const fallbackApiKey = await getCredential(fallbackProviderName);
    if (!fallbackApiKey) {
      console.error(`API key for fallback provider ${fallbackProviderName} not found.`);
      return;
    }

    const fallbackProvider = createProvider(fallbackProviderName);
    if (!fallbackProvider) {
      console.error(`Unknown fallback provider: ${fallbackProviderName}`);
      return;
    }

    try {
      await fallbackProvider.initialize({ apiKey: fallbackApiKey });
      const generatedCode = await fallbackProvider.generateCode(prompt);
      console.log(generatedCode);
    } catch (fallbackError) {
      console.error(`Error with fallback provider ${fallbackProviderName}:`, fallbackError.message);
    }
  }
}
