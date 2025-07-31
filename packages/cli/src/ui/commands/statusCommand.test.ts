/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { statusCommand } from './statusCommand.js';
import { mockCommandContext } from '../../test-utils/mockCommandContext.js';
import { uiTelemetryService } from '@pk-code/core';

vi.mock('@pk-code/core', () => ({
  uiTelemetryService: {
    getMetrics: vi.fn(),
    getLastPromptTokenCount: vi.fn(),
  },
}));

describe('statusCommand', () => {
  let context: ReturnType<typeof mockCommandContext>;

  beforeEach(() => {
    context = mockCommandContext();
    vi.clearAllMocks();
    
    // Mock telemetry data
    vi.mocked(uiTelemetryService.getMetrics).mockReturnValue({
      totalTokens: 15000,
      inputTokens: 10000,
      outputTokens: 5000,
      cachedTokens: 2000,
      apiCalls: 10,
      toolCalls: 5,
      errors: 1,
      totalApiTime: 5000,
      totalToolTime: 2500,
      modelMetrics: {
        'gemini-2.5-flash': {
          requests: 10,
          totalTokens: 15000,
        },
      },
    });
    
    vi.mocked(uiTelemetryService.getLastPromptTokenCount).mockReturnValue(500);
  });

  it('should display comprehensive session status', async () => {
    const result = await statusCommand.action(context, '');

    expect(result).toEqual({
      type: 'message',
      messageType: 'info',
      content: expect.stringContaining('🔍 Session Status'),
    });

    const content = result.content as string;
    expect(content).toContain('📊 Session Information:');
    expect(content).toContain('• Duration:');
    expect(content).toContain('• Prompts: 0');
    expect(content).toContain('• Model: gemini-2.5-flash');
    
    expect(content).toContain('🪙 Token Usage:');
    expect(content).toContain('• Total Tokens: 15,000 / 32,768 (46%)');
    expect(content).toContain('• Input Tokens: 10,000');
    expect(content).toContain('• Output Tokens: 5,000');
    expect(content).toContain('• Cached Tokens: 2,000');
    expect(content).toContain('• Last Prompt: 500 tokens');
    
    expect(content).toContain('⚡ Performance:');
    expect(content).toContain('• API Calls: 10');
    expect(content).toContain('• Tool Calls: 5');
    expect(content).toContain('• Errors: 1');
    expect(content).toContain('• Avg API Time: 500ms');
    expect(content).toContain('• Avg Tool Time: 500ms');
    
    expect(content).toContain('📈 Model Metrics (gemini-2.5-flash):');
    expect(content).toContain('• Requests: 10');
    expect(content).toContain('• Tokens: 15,000');
    expect(content).toContain('• Avg Tokens/Request: 1,500');
    
    expect(content).toContain('💾 Memory Usage:');
  });

  it('should show warning when context usage is high', async () => {
    vi.mocked(uiTelemetryService.getMetrics).mockReturnValue({
      totalTokens: 28000, // > 80% of 32768
      inputTokens: 20000,
      outputTokens: 8000,
      cachedTokens: 0,
      apiCalls: 0,
      toolCalls: 0,
      errors: 0,
      totalApiTime: 0,
      totalToolTime: 0,
      modelMetrics: {},
    });

    const result = await statusCommand.action(context, '');
    const content = result.content as string;
    
    expect(content).toContain('⚠️ Warning: Context usage is high (85%). Consider using /compress to reduce context size.');
  });

  it('should handle missing configuration', async () => {
    const contextWithoutConfig = mockCommandContext();
    contextWithoutConfig.services.config = null;

    const result = await statusCommand.action(contextWithoutConfig, '');

    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content: 'Configuration not available',
    });
  });

  it('should handle custom context size from settings', async () => {
    context.services.settings.get = vi.fn((key: string) => {
      if (key === 'MAX_CONTEXT_SIZE') return 16384;
      return undefined;
    });

    vi.mocked(uiTelemetryService.getMetrics).mockReturnValue({
      totalTokens: 8192,
      inputTokens: 8192,
      outputTokens: 0,
      cachedTokens: 0,
      apiCalls: 0,
      toolCalls: 0,
      errors: 0,
      totalApiTime: 0,
      totalToolTime: 0,
      modelMetrics: {},
    });

    const result = await statusCommand.action(context, '');
    const content = result.content as string;

    expect(content).toContain('• Total Tokens: 8,192 / 16,384 (50%)');
  });
});
