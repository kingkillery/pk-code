/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getCredential } from '@pk-code/core';
import { OpenAIProvider } from '@pk-code/openai';
import { GeminiProvider } from '@pk-code/gemini';
import { OpenRouterProvider } from '@pk-code/openrouter';
import { AnthropicProvider } from '@pk-code/anthropic';
import { CohereProvider } from '@pk-code/cohere';

export async function handleGenerateCommand(prompt: string, providerName: string): Promise<string | null> {
  const apiKey = await getCredential(providerName);
  if (!apiKey) {
    console.error(`API key for ${providerName} not found. Please configure it using the "config" command.`);
    return null;
  }

  const createProvider = (name: string) => {
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
    return null;
  }

  try {
    await provider.initialize({ apiKey });
    const generatedCode = await provider.generateCode(prompt);
    console.log(generatedCode);
    return generatedCode;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error with ${providerName}:`, errorMessage);
    const fallbackProviderName = providerName === 'openai' ? 'gemini' : 'openai';
    console.log(`Attempting to fallback to ${fallbackProviderName}...`);

    const fallbackApiKey = await getCredential(fallbackProviderName);
    if (!fallbackApiKey) {
      console.error(`API key for fallback provider ${fallbackProviderName} not found.`);
      return null;
    }

    const fallbackProvider = createProvider(fallbackProviderName);
    if (!fallbackProvider) {
      console.error(`Unknown fallback provider: ${fallbackProviderName}`);
      return null;
    }

    try {
      await fallbackProvider.initialize({ apiKey: fallbackApiKey });
      const generatedCode = await fallbackProvider.generateCode(prompt);
      console.log(generatedCode);
      return generatedCode;
    } catch (fallbackError) {
      const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      console.error(`Error with fallback provider ${fallbackProviderName}:`, fallbackErrorMessage);
      return null;
    }
  }
}
