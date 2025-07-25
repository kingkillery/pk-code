/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@qwen-code/qwen-code-core';
import { loadEnvironment } from './settings.js';

export const validateAuthMethod = (authMethod: string): string | null => {
  loadEnvironment();
  if (
    authMethod === AuthType.LOGIN_WITH_GOOGLE ||
    authMethod === AuthType.CLOUD_SHELL
  ) {
    return null;
  }

  if (authMethod === AuthType.USE_GEMINI) {
    if (!process.env.GEMINI_API_KEY) {
      return 'GEMINI_API_KEY environment variable not found. Add that to your environment and try again (no reload needed if using .env)!';
    }
    return null;
  }

  if (authMethod === AuthType.USE_VERTEX_AI) {
    const hasVertexProjectLocationConfig =
      !!process.env.GOOGLE_CLOUD_PROJECT && !!process.env.GOOGLE_CLOUD_LOCATION;
    const hasGoogleApiKey = !!process.env.GOOGLE_API_KEY;
    if (!hasVertexProjectLocationConfig && !hasGoogleApiKey) {
      return (
        'When using Vertex AI, you must specify either:\n' +
        '• GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION environment variables.\n' +
        '• GOOGLE_API_KEY environment variable (if using express mode).\n' +
        'Update your environment and try again (no reload needed if using .env)!'
      );
    }
    return null;
  }

  if (authMethod === AuthType.USE_OPENAI) {
    if (!process.env.OPENAI_API_KEY) {
      return 'OPENAI_API_KEY environment variable not found. You can enter it interactively or add it to your .env file.';
    }
    return null;
  }

  if (authMethod === AuthType.USE_OPENROUTER) {
    if (!process.env.OPENROUTER_API_KEY) {
      return 'OPENROUTER_API_KEY environment variable not found. You can enter it interactively or add it to your .env file.';
    }
    return null;
  }

  return 'Invalid auth method selected.';
};

export const setOpenAIApiKey = (apiKey: string): void => {
  process.env.OPENAI_API_KEY = apiKey;
};

export const setOpenAIBaseUrl = (baseUrl: string): void => {
  process.env.OPENAI_BASE_URL = baseUrl;
};

export const setOpenAIModel = (model: string): void => {
  process.env.OPENAI_MODEL = model;
};

export const setOpenRouterApiKey = (apiKey: string): void => {
  process.env.OPENROUTER_API_KEY = apiKey;
};

export const validateOpenRouterModel = async (
  model: string,
): Promise<boolean> => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models');
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    const models = data.data || [];
    return models.some((m: { id: string }) => m.id === model);
  } catch (_error) {
    return false;
  }
};

export const setOpenRouterModel = (model: string): void => {
  process.env.OPENROUTER_MODEL = model;
};

export const setOpenRouterProvider = (provider: string): void => {
  process.env.OPENROUTER_PROVIDER = provider;
};

export const getOpenRouterProvider = (): string | undefined =>
  process.env.OPENROUTER_PROVIDER?.trim();

export const setGeminiModel = (model: string): void => {
  process.env.GEMINI_MODEL = model;
};

export const getAvailableOpenAIModels = async (): Promise<string[]> => [
  // Common OpenAI models - in production this could be fetched from API
  'gpt-4',
  'gpt-4-turbo',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-3.5-turbo',
  'o1-preview',
  'o1-mini',
];

export const getAvailableOpenRouterModels = async (): Promise<string[]> => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models');
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    interface OpenRouterModel {
      id: string;
    }

    // ...

    return data.data?.map((model: OpenRouterModel) => model.id) || [];
  } catch (_error) {
    // Fallback to common models if API fails
    return [
      'anthropic/claude-3-sonnet',
      'anthropic/claude-3-haiku',
      'openai/gpt-4',
      'openai/gpt-3.5-turbo',
      'mistralai/devstral-small',
      'mistralai/mistral-7b-instruct',
    ];
  }
};

export const getAvailableOpenRouterProviders = (): string[] => [
  'openai',
  'anthropic',
  'google',
  'meta-llama',
  'mistralai',
  'cohere',
  'together',
  'deepinfra',
  'fireworks',
  'lepton',
  'novita',
  'cerebras',
  'chutes',
];

export const getAvailableGeminiModels = async (): Promise<string[]> => [
  // Common Gemini models - in production this could be fetched from API
  'qwen3-coder-max',
  'gemini-2.5-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-pro',
];

export const validateGeminiModel = async (model: string): Promise<boolean> => {
  const availableModels = await getAvailableGeminiModels();
  return availableModels.includes(model);
};
