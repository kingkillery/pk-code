/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  setOpenRouterProvider,
  getOpenRouterProvider,
  getAvailableOpenRouterProviders,
} from '../../config/auth.js';
import { type Command } from './types.js';

export const inferenceProviderCommand: Command = {
  name: 'inference-p',
  altName: 'infp',
  description: 'View or set the OpenRouter inference provider',
  action: async (context, args) => {
    const {
      services: { config },
    } = context;

    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Config not available',
      };
    }

    const authType = config.getAuthType();

    // Only works with OpenRouter
    if (authType !== 'openrouter') {
      return {
        type: 'message',
        messageType: 'error',
        content:
          'The /inference-p command only works with OpenRouter. Current auth method is: ' +
          authType,
      };
    }

    const newProvider = args.trim();
    const currentProvider = getOpenRouterProvider();

    // If no provider specified, show current provider and available options
    if (!newProvider) {
      const availableProviders = getAvailableOpenRouterProviders();
      const providersList = availableProviders
        .map((provider) => `  • ${provider}`)
        .join('\n');

      const currentProviderText = currentProvider
        ? `Current provider: ${currentProvider}`
        : 'Current provider: auto (OpenRouter will choose automatically)';

      return {
        type: 'message',
        messageType: 'info',
        content: `${currentProviderText}\n\nAvailable OpenRouter providers:\n${providersList}\n\nTo set a provider, use: /inference-p <provider-name>\nTo reset to auto, use: /inference-p auto`,
      };
    }

    // Handle "auto" or "none" to clear the provider
    if (
      newProvider === 'auto' ||
      newProvider === 'none' ||
      newProvider === 'clear'
    ) {
      process.env.OPENROUTER_PROVIDER = '';

      // Refresh the content generator to pick up the cleared provider
      try {
        await config.refreshContentGenerator();
      } catch (error) {
        console.error('Failed to refresh content generator:', error);
        // Don't fail the entire command if refresh fails
      }

      return {
        type: 'message',
        messageType: 'info',
        content:
          'OpenRouter provider cleared. OpenRouter will now choose automatically.',
      };
    }

    // Validate provider
    const availableProviders = getAvailableOpenRouterProviders();
    if (!availableProviders.includes(newProvider)) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Invalid provider: ${newProvider}. Use '/inference-p' to see available providers.`,
      };
    }

    // Set the new provider
    setOpenRouterProvider(newProvider);

    // Refresh the content generator to pick up the new provider
    try {
      await config.refreshContentGenerator();
    } catch (error) {
      console.error('Failed to refresh content generator:', error);
      // Don't fail the entire command if refresh fails
    }

    return {
      type: 'message',
      messageType: 'info',
      content: `OpenRouter inference provider set to: ${newProvider}`,
    };
  },
  completion: async (context, partialArg) => {
    const {
      services: { config },
    } = context;

    if (!config) {
      return [];
    }

    const authType = config.getAuthType();
    if (authType !== 'openrouter') {
      return [];
    }

    const availableProviders = getAvailableOpenRouterProviders();
    const allOptions = ['auto', 'clear', ...availableProviders];

    if (!partialArg) {
      return allOptions;
    }

    return allOptions.filter((provider) =>
      provider.toLowerCase().startsWith(partialArg.toLowerCase()),
    );
  },
};
