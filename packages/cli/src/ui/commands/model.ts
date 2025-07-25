/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  setGeminiModel,
  setOpenAIModel,
  setOpenRouterModel,
  validateOpenRouterModel,
  validateGeminiModel,
  getAvailableOpenAIModels,
  getAvailableOpenRouterModels,
  getAvailableGeminiModels,
} from '../../config/auth.js';
import { type Command } from './types.js';

export const modelCommand: Command = {
  name: 'model',
  description: 'View or switch the current model',
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

    const newModel = args.trim();
    const currentModel = config.getModel();
    const authType = config.getAuthType();

    // If no model specified, show current model and available options
    if (!newModel) {
      try {
        let availableModels: string[] = [];
        let providerName = '';

        switch (authType) {
          case 'openai':
            availableModels = await getAvailableOpenAIModels();
            providerName = 'OpenAI';
            break;
          case 'openrouter':
            availableModels = await getAvailableOpenRouterModels();
            providerName = 'OpenRouter';
            break;
          default:
            availableModels = await getAvailableGeminiModels();
            providerName = 'Gemini';
            break;
        }

        const modelsList =
          availableModels.length > 0
            ? availableModels
                .slice(0, 10)
                .map((model) => `  • ${model}`)
                .join('\n')
            : '  No models available';

        const moreModelsNote =
          availableModels.length > 10
            ? `\n  ... and ${availableModels.length - 10} more models`
            : '';

        return {
          type: 'message',
          messageType: 'info',
          content: `The current model is: ${currentModel}\n\nAvailable ${providerName} models:\n${modelsList}${moreModelsNote}\n\nTo switch models, use: /model <model-name>`,
        };
      } catch (_error) {
        return {
          type: 'message',
          messageType: 'info',
          content: `The current model is: ${currentModel}\n\nTo switch models, use: /model \u003cmodel-name\u003e`,
        };
      }
    }

    // Validate and switch to new model
    try {
      let isValidModel = false;

      switch (authType) {
        case 'openai': {
          const openAIModels = await getAvailableOpenAIModels();
          isValidModel = openAIModels.includes(newModel);
          if (isValidModel) {
            setOpenAIModel(newModel);
          }
          break;
        }

        case 'openrouter':
          isValidModel = await validateOpenRouterModel(newModel);
          if (isValidModel) {
            setOpenRouterModel(newModel);
          }
          break;

        default: // gemini
          isValidModel = await validateGeminiModel(newModel);
          if (isValidModel) {
            setGeminiModel(newModel);
          }
          break;
      }

      if (!isValidModel) {
        return {
          type: 'message',
          messageType: 'error',
          content: `Invalid model: ${newModel}. Use '/model' to see available models for your current provider (${authType}).`,
        };
      }

      config.setModel(newModel);

      // For OpenRouter, refresh the content generator to pick up the new model
      if (authType === 'openrouter') {
        try {
          await config.refreshContentGenerator();
        } catch (error) {
          console.error('Failed to refresh content generator:', error);
          // Don't fail the entire command if refresh fails
        }
      }

      return {
        type: 'message',
        messageType: 'info',
        content: `Switched model to: ${newModel}`,
      };
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Failed to switch model: ${error instanceof Error ? error.message : 'Unknown error'}. Try again or use '/model' to see available models.`,
      };
    }
  },
};
