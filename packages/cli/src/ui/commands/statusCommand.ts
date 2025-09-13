/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SlashCommand, CommandContext } from './types.js';
import { formatDuration, formatNumber } from '../utils/formatters.js';
import { uiTelemetryService } from '@pk-code/core';

export const statusCommand: SlashCommand = {
  name: 'status',
  description: 'Display comprehensive session status and token usage',

  action: async (context: CommandContext, _args: string) => {
    const { config } = context.services;
    const { stats } = context.session;

    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Configuration not available',
      };
    }

    // Get current metrics
    const metrics = uiTelemetryService.getMetrics();
    const lastPromptTokenCount = uiTelemetryService.getLastPromptTokenCount();

    // Calculate session duration
    const now = new Date();
    const wallDuration = now.getTime() - stats.sessionStartTime.getTime();

    // Calculate total tokens across all models
    const totalTokens = Object.values(metrics.models).reduce(
      (sum, model) => sum + model.tokens.total,
      0,
    );
    const totalInputTokens = Object.values(metrics.models).reduce(
      (sum, model) => sum + model.tokens.prompt,
      0,
    );
    const totalOutputTokens = Object.values(metrics.models).reduce(
      (sum, model) => sum + model.tokens.candidates,
      0,
    );
    const totalCachedTokens = Object.values(metrics.models).reduce(
      (sum, model) => sum + model.tokens.cached,
      0,
    );

    // Get token limits
    const maxContextSize = 32768; // Default context size
    const contextUsagePercent = totalTokens
      ? Math.round((totalTokens / maxContextSize) * 100)
      : 0;

    // Get model info
    const modelVersion = config.getModel() || 'Unknown';
    const authType = config.getAuthType();

    // Build status message
    let message = '🔍 Session Status\n\n';

    // Session info
    message += `📊 Session Information:\n`;
    message += `  • Duration: ${formatDuration(wallDuration)}\n`;
    message += `  • Prompts: ${stats.promptCount}\n`;
    message += `  • Model: ${modelVersion}\n`;
    message += `  • Auth: ${authType}\n\n`;

    // Token usage
    message += `🪙 Token Usage:\n`;
    message += `  • Total Tokens: ${formatNumber(totalTokens)} / ${formatNumber(maxContextSize)} (${contextUsagePercent}%)\n`;
    message += `  • Input Tokens: ${formatNumber(totalInputTokens)}\n`;
    message += `  • Output Tokens: ${formatNumber(totalOutputTokens)}\n`;
    message += `  • Cached Tokens: ${formatNumber(totalCachedTokens)}\n`;
    message += `  • Last Prompt: ${formatNumber(lastPromptTokenCount)} tokens\n\n`;

    // Calculate performance metrics from API and tool data
    const totalApiRequests = Object.values(metrics.models).reduce(
      (sum, model) => sum + model.api.totalRequests,
      0,
    );
    const totalApiTime = Object.values(metrics.models).reduce(
      (sum, model) => sum + model.api.totalLatencyMs,
      0,
    );
    const totalApiErrors = Object.values(metrics.models).reduce(
      (sum, model) => sum + model.api.totalErrors,
      0,
    );

    // Performance metrics
    message += `⚡ Performance:\n`;
    message += `  • API Calls: ${totalApiRequests}\n`;
    message += `  • Tool Calls: ${metrics.tools.totalCalls}\n`;
    message += `  • Errors: ${totalApiErrors}\n`;

    if (totalApiRequests > 0) {
      const avgApiTime = Math.round(totalApiTime / totalApiRequests);
      message += `  • Avg API Time: ${avgApiTime}ms\n`;
    }

    if (metrics.tools.totalCalls > 0) {
      const avgToolTime = Math.round(
        metrics.tools.totalDurationMs / metrics.tools.totalCalls,
      );
      message += `  • Avg Tool Time: ${avgToolTime}ms\n`;
    }

    // Model-specific metrics
    const modelData = metrics.models[modelVersion];
    if (modelData) {
      message += `\n📈 Model Metrics (${modelVersion}):\n`;
      message += `  • Requests: ${modelData.api.totalRequests}\n`;
      message += `  • Tokens: ${formatNumber(modelData.tokens.total)}\n`;

      if (modelData.api.totalRequests > 0) {
        const avgTokensPerRequest = Math.round(
          modelData.tokens.total / modelData.api.totalRequests,
        );
        message += `  • Avg Tokens/Request: ${formatNumber(avgTokensPerRequest)}\n`;
      }
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    message += `\n💾 Memory Usage:\n`;
    message += `  • Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB\n`;
    message += `  • RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB\n`;

    // Context warning
    if (contextUsagePercent > 80) {
      message += `\n⚠️ Warning: Context usage is high (${contextUsagePercent}%). Consider using /compress to reduce context size.\n`;
    }

    return {
      type: 'message',
      messageType: 'info',
      content: message,
    };
  },
};
