/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { modelCommand } from './model.js';
import { CommandContext } from './types.js';
import { AuthType, Config } from '@pk-code/core';
import {
  setOpenAIModel,
  setOpenRouterModel,
  setGeminiModel,
  validateOpenRouterModel,
  validateGeminiModel,
  getAvailableOpenAIModels,
} from '../../config/auth.js';

// Mock dependencies
vi.mock('../../config/auth.js', () => ({
  setOpenAIModel: vi.fn(),
  setOpenRouterModel: vi.fn(),
  setGeminiModel: vi.fn(),
  validateOpenRouterModel: vi.fn(),
  validateGeminiModel: vi.fn(),
  getAvailableOpenAIModels: vi.fn(),
  getAvailableOpenRouterModels: vi.fn(),
  getAvailableGeminiModels: vi.fn(),
}));

describe('modelCommand', () => {
  let context: CommandContext;
  let config: Partial<Config>;

  beforeEach(() => {
    vi.resetAllMocks();

    config = {
      getModel: vi.fn(),
      setModel: vi.fn(),
      getAuthType: vi.fn(),
    };

    context = {
      services: {
        config: config as Config,
        settings: {} as never,
        git: {} as never,
        logger: {} as never,
      },
      ui: {
        addItem: vi.fn(),
        clear: vi.fn(),
        setDebugMessage: vi.fn(),
      },
      session: {
        stats: {} as never,
      },
    };
  });

  it('should display the current model and available models when no new model is provided', async () => {
    (config.getModel as vi.Mock).mockReturnValue('gpt-4');
    (config.getAuthType as vi.Mock).mockReturnValue(AuthType.USE_OPENAI);
    (getAvailableOpenAIModels as vi.Mock).mockResolvedValue([
      'gpt-4',
      'gpt-3.5-turbo',
    ]);

    const result = await modelCommand.action(context, '');

    expect(result).toEqual({
      type: 'message',
      messageType: 'info',
      content:
        'The current model is: gpt-4\n\nAvailable OpenAI models:\n  • gpt-4\n  • gpt-3.5-turbo\n\nTo switch models, use: /model <model-name>',
    });
  });

  it('should switch the model for OpenAI', async () => {
    (config.getAuthType as vi.Mock).mockReturnValue(AuthType.USE_OPENAI);
    (getAvailableOpenAIModels as vi.Mock).mockResolvedValue([
      'gpt-4',
      'gpt-3.5-turbo',
    ]);

    const result = await modelCommand.action(context, 'gpt-3.5-turbo');

    expect(setOpenAIModel).toHaveBeenCalledWith('gpt-3.5-turbo');
    expect(config.setModel).toHaveBeenCalledWith('gpt-3.5-turbo');
    expect(result).toEqual({
      type: 'message',
      messageType: 'info',
      content: 'Switched model to: gpt-3.5-turbo',
    });
  });

  it('should switch the model for OpenRouter when model is valid', async () => {
    (config.getAuthType as vi.Mock).mockReturnValue(AuthType.USE_OPENROUTER);
    (validateOpenRouterModel as vi.Mock).mockResolvedValue(true);

    const result = await modelCommand.action(context, 'claude-2');

    expect(validateOpenRouterModel).toHaveBeenCalledWith('claude-2');
    expect(setOpenRouterModel).toHaveBeenCalledWith('claude-2');
    expect(config.setModel).toHaveBeenCalledWith('claude-2');
    expect(result).toEqual({
      type: 'message',
      messageType: 'info',
      content: 'Switched model to: claude-2',
    });
  });

  it('should return an error for invalid OpenRouter model', async () => {
    (config.getAuthType as vi.Mock).mockReturnValue(AuthType.USE_OPENROUTER);
    (validateOpenRouterModel as vi.Mock).mockResolvedValue(false);

    const result = await modelCommand.action(context, 'invalid-model');

    expect(validateOpenRouterModel).toHaveBeenCalledWith('invalid-model');
    expect(setOpenRouterModel).not.toHaveBeenCalled();
    expect(config.setModel).not.toHaveBeenCalled();
    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content:
        "Invalid model: invalid-model. Use '/model' to see available models for your current provider (openrouter).",
    });
  });

  it('should switch the model for Gemini when model is valid', async () => {
    (config.getAuthType as vi.Mock).mockReturnValue(AuthType.USE_GEMINI);
    (validateGeminiModel as vi.Mock).mockResolvedValue(true);

    const result = await modelCommand.action(context, 'gemini-pro');

    expect(validateGeminiModel).toHaveBeenCalledWith('gemini-pro');
    expect(setGeminiModel).toHaveBeenCalledWith('gemini-pro');
    expect(config.setModel).toHaveBeenCalledWith('gemini-pro');
    expect(result).toEqual({
      type: 'message',
      messageType: 'info',
      content: 'Switched model to: gemini-pro',
    });
  });

  it('should return an error for invalid Gemini model', async () => {
    (config.getAuthType as vi.Mock).mockReturnValue(AuthType.USE_GEMINI);
    (validateGeminiModel as vi.Mock).mockResolvedValue(false);

    const result = await modelCommand.action(context, 'invalid-gemini-model');

    expect(validateGeminiModel).toHaveBeenCalledWith('invalid-gemini-model');
    expect(setGeminiModel).not.toHaveBeenCalled();
    expect(config.setModel).not.toHaveBeenCalled();
    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content:
        "Invalid model: invalid-gemini-model. Use '/model' to see available models for your current provider (gemini-api-key).",
    });
  });

  it('should handle provider-prefixed models correctly', async () => {
    (config.getAuthType as vi.Mock).mockReturnValue(AuthType.USE_OPENROUTER);
    (validateOpenRouterModel as vi.Mock).mockResolvedValue(true);

    const result = await modelCommand.action(
      context,
      'mistralai/devstral-small',
    );

    expect(validateOpenRouterModel).toHaveBeenCalledWith(
      'mistralai/devstral-small',
    );
    expect(setOpenRouterModel).toHaveBeenCalledWith('mistralai/devstral-small');
    expect(config.setModel).toHaveBeenCalledWith('mistralai/devstral-small');
    expect(result).toEqual({
      type: 'message',
      messageType: 'info',
      content: 'Switched model to: mistralai/devstral-small',
    });
  });
});
