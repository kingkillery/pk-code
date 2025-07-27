/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { inferenceProviderCommand } from './inferenceProviderCommand.js';
import { CommandContext } from './types.js';
import { Config } from '@pk-code/core';
import {
  setOpenRouterProvider,
  getOpenRouterProvider,
  getAvailableOpenRouterProviders,
} from '../../config/auth.js';

// Mock dependencies
vi.mock('../../config/auth.js', () => ({
  setOpenRouterProvider: vi.fn(),
  getOpenRouterProvider: vi.fn(),
  getAvailableOpenRouterProviders: vi.fn(),
}));

describe('inferenceProviderCommand', () => {
  let context: CommandContext;
  let config: Partial<Config>;

  beforeEach(() => {
    vi.resetAllMocks();

    config = {
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

    // Mock available providers
    vi.mocked(getAvailableOpenRouterProviders).mockReturnValue([
      'openai',
      'anthropic',
      'deepinfra',
      'cerebras',
      'chutes',
    ]);
  });

  it('should return error when config is not available', async () => {
    context.services.config = null;

    const result = await inferenceProviderCommand.action!(context, '');

    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content: 'Config not available',
    });
  });

  it('should return error when not using OpenRouter', async () => {
    (config.getAuthType as vi.Mock).mockReturnValue('openai');

    const result = await inferenceProviderCommand.action!(context, '');

    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content:
        'The /inference-p command only works with OpenRouter. Current auth method is: openai',
    });
  });

  it('should display current provider and available options when no args provided', async () => {
    (config.getAuthType as vi.Mock).mockReturnValue('openrouter');
    vi.mocked(getOpenRouterProvider).mockReturnValue('cerebras');

    const result = await inferenceProviderCommand.action!(context, '');

    expect(result).toEqual({
      type: 'message',
      messageType: 'info',
      content: expect.stringContaining('Current provider: cerebras'),
    });
    expect((result as { content: string }).content).toContain(
      'Available OpenRouter providers:',
    );
    expect((result as { content: string }).content).toContain('• deepinfra');
    expect((result as { content: string }).content).toContain('• cerebras');
  });

  it('should display auto when no provider is set', async () => {
    (config.getAuthType as vi.Mock).mockReturnValue('openrouter');
    vi.mocked(getOpenRouterProvider).mockReturnValue(undefined);

    const result = await inferenceProviderCommand.action!(context, '');

    expect(result).toEqual({
      type: 'message',
      messageType: 'info',
      content: expect.stringContaining(
        'Current provider: auto (OpenRouter will choose automatically)',
      ),
    });
  });

  it('should clear provider when "auto" is specified', async () => {
    (config.getAuthType as vi.Mock).mockReturnValue('openrouter');
    const originalEnv = process.env.OPENROUTER_PROVIDER;

    const result = await inferenceProviderCommand.action!(context, 'auto');

    expect(result).toEqual({
      type: 'message',
      messageType: 'info',
      content:
        'OpenRouter provider cleared. OpenRouter will now choose automatically.',
    });
    expect(process.env.OPENROUTER_PROVIDER).toBe('');

    // Restore original env
    process.env.OPENROUTER_PROVIDER = originalEnv;
  });

  it('should set valid provider', async () => {
    (config.getAuthType as vi.Mock).mockReturnValue('openrouter');

    const result = await inferenceProviderCommand.action!(context, 'cerebras');

    expect(setOpenRouterProvider).toHaveBeenCalledWith('cerebras');
    expect(result).toEqual({
      type: 'message',
      messageType: 'info',
      content: 'OpenRouter inference provider set to: cerebras',
    });
  });

  it('should return error for invalid provider', async () => {
    (config.getAuthType as vi.Mock).mockReturnValue('openrouter');

    const result = await inferenceProviderCommand.action!(
      context,
      'invalid-provider',
    );

    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content:
        "Invalid provider: invalid-provider. Use '/inference-p' to see available providers.",
    });
    expect(setOpenRouterProvider).not.toHaveBeenCalled();
  });

  describe('completion', () => {
    it('should return empty array when config is not available', async () => {
      context.services.config = null;

      const result = await inferenceProviderCommand.completion!(context, '');

      expect(result).toEqual([]);
    });

    it('should return empty array when not using OpenRouter', async () => {
      (config.getAuthType as vi.Mock).mockReturnValue('openai');

      const result = await inferenceProviderCommand.completion!(context, '');

      expect(result).toEqual([]);
    });

    it('should return all options when no partial arg', async () => {
      (config.getAuthType as vi.Mock).mockReturnValue('openrouter');

      const result = await inferenceProviderCommand.completion!(context, '');

      expect(result).toEqual([
        'auto',
        'clear',
        'openai',
        'anthropic',
        'deepinfra',
        'cerebras',
        'chutes',
      ]);
    });

    it('should filter options by partial arg', async () => {
      (config.getAuthType as vi.Mock).mockReturnValue('openrouter');

      const result = await inferenceProviderCommand.completion!(context, 'ce');

      expect(result).toEqual(['cerebras']);
    });

    it('should be case insensitive', async () => {
      (config.getAuthType as vi.Mock).mockReturnValue('openrouter');

      const result = await inferenceProviderCommand.completion!(context, 'CE');

      expect(result).toEqual(['cerebras']);
    });
  });
});
