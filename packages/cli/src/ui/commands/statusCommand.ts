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
    const { config, settings } = context.services;
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
    
    // Get token limits
    const maxContextSize = settings.get('MAX_CONTEXT_SIZE') || 32768;
    const contextUsagePercent = metrics.totalTokens 
      ? Math.round((metrics.totalTokens / maxContextSize) * 100)
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
    message += `  • Total Tokens: ${formatNumber(metrics.totalTokens)} / ${formatNumber(maxContextSize)} (${contextUsagePercent}%)\n`;
    message += `  • Input Tokens: ${formatNumber(metrics.inputTokens)}\n`;
    message += `  • Output Tokens: ${formatNumber(metrics.outputTokens)}\n`;
    message += `  • Cached Tokens: ${formatNumber(metrics.cachedTokens)}\n`;
    message += `  • Last Prompt: ${formatNumber(lastPromptTokenCount)} tokens\n\n`;
    
    // Performance metrics
    message += `⚡ Performance:\n`;
    message += `  • API Calls: ${metrics.apiCalls}\n`;
    message += `  • Tool Calls: ${metrics.toolCalls}\n`;
    message += `  • Errors: ${metrics.errors}\n`;
    
    if (metrics.apiCalls > 0) {
      const avgApiTime = Math.round(metrics.totalApiTime / metrics.apiCalls);
      message += `  • Avg API Time: ${avgApiTime}ms\n`;
    }
    
    if (metrics.toolCalls > 0) {
      const avgToolTime = Math.round(metrics.totalToolTime / metrics.toolCalls);
      message += `  • Avg Tool Time: ${avgToolTime}ms\n`;
    }
    
    // Model-specific metrics
    const modelMetrics = metrics.modelMetrics[modelVersion];
    if (modelMetrics) {
      message += `\n📈 Model Metrics (${modelVersion}):\n`;
      message += `  • Requests: ${modelMetrics.requests}\n`;
      message += `  • Tokens: ${formatNumber(modelMetrics.totalTokens)}\n`;
      
      if (modelMetrics.requests > 0) {
        const avgTokensPerRequest = Math.round(modelMetrics.totalTokens / modelMetrics.requests);
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
