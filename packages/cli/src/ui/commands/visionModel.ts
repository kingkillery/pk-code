/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Command, SlashCommandActionReturn, CommandContext } from './types.js';
import { AuthType, MultimodalContentGenerator } from '@qwen-code/qwen-code-core';

const visionModelCommand: Command = {
  name: 'vision-model',
  altName: 'vm',
  description: 'Manage vision model settings for browser MCP enhancement',
  async action(context: CommandContext, args: string): Promise<SlashCommandActionReturn> {
    const { services } = context;
    const { config } = services;
    
    // Parse arguments
    const trimmedArgs = args.trim();
    const parts = trimmedArgs.split(/\s+/);
    const command = parts[0]?.toLowerCase();
    const value = parts.slice(1).join(' ');

    // Handle different subcommands
    switch (command) {
      case '':
      case 'status':
        return await showVisionStatus(context);
      
      case 'enable':
        return await enableVision(context);
      
      case 'disable':
        return await disableVision(context);
      
      case 'model':
        return await setVisionModel(context, value);
      
      case 'strategy':
        return await setVisionStrategy(context, value);
      
      default:
        return {
          type: 'message',
          messageType: 'error',
          content: `Unknown vision model command: ${command}. Use '/vision-model' to see current status.`
        };
    }
  }
};

async function showVisionStatus(context: CommandContext): Promise<SlashCommandActionReturn> {
  const { services } = context;
  const { config } = services;
  
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Config not available'
    };
  }
  
  const authType = config.getAuthType();
  const contentGenerator = config.getGeminiClient()?.getContentGenerator();
  
  let statusContent = '## Vision Model Status\n\n';
  
  // Check if vision routing is enabled
  const visionEnabled = process.env.ENABLE_VISION_ROUTING === 'true';
  statusContent += `**Vision Routing:** ${visionEnabled ? '✅ Enabled' : '❌ Disabled'}\n\n`;
  
  if (!visionEnabled) {
    statusContent += 'To enable vision routing, use `/vision-model enable`\n\n';
    statusContent += '**Configuration Variables:**\n';
    statusContent += `- ENABLE_VISION_ROUTING="${process.env.ENABLE_VISION_ROUTING || 'false'}"\n`;
    statusContent += `- VISION_MODEL_NAME="${process.env.VISION_MODEL_NAME || 'bytedance/ui-tars-1.5-7b'}"\n`;
    statusContent += `- VISION_ROUTING_STRATEGY="${process.env.VISION_ROUTING_STRATEGY || 'auto'}"\n`;
    
    return {
      type: 'message',
      messageType: 'info',
      content: statusContent
    };
  }
  
  // Show detailed vision status
  statusContent += '**Vision Model Configuration:**\n';
  statusContent += `- Model: ${process.env.VISION_MODEL_NAME || 'bytedance/ui-tars-1.5-7b'}\n`;
  statusContent += `- Provider: ${process.env.VISION_MODEL_PROVIDER || 'openrouter'}\n`;
  statusContent += `- Strategy: ${process.env.VISION_ROUTING_STRATEGY || 'auto'}\n`;
  statusContent += `- Fallback to Text: ${process.env.VISION_FALLBACK_TO_TEXT !== 'false' ? 'Yes' : 'No'}\n\n`;
  
  // Check if we have a multimodal content generator
  if (contentGenerator && 'isVisionCapable' in contentGenerator) {
    const multimodalGenerator = contentGenerator as MultimodalContentGenerator;
    
    statusContent += '**Current Content Generator:**\n';
    statusContent += `- Vision Capable: ${multimodalGenerator.isVisionCapable() ? '✅ Yes' : '❌ No'}\n`;
    
    if (multimodalGenerator.isVisionCapable()) {
      statusContent += `- Text Model: ${multimodalGenerator.getTextModel()}\n`;
      statusContent += `- Vision Model: ${multimodalGenerator.getVisionModel()}\n`;
      
      // Show routing info if available
      if ('getRoutingInfo' in multimodalGenerator) {
        const routingInfo = (multimodalGenerator as any).getRoutingInfo();
        statusContent += `- Routing Strategy: ${routingInfo.strategy}\n`;
        statusContent += `- Fallback Enabled: ${routingInfo.fallbackEnabled ? 'Yes' : 'No'}\n`;
      }
    }
  } else {
    statusContent += '**Current Content Generator:**\n';
    statusContent += '- Vision Capable: ❌ No (Standard content generator in use)\n';
    statusContent += '\n*Note: You may need to restart or refresh the content generator to use vision capabilities.*\n';
  }
  
  statusContent += '\n**Compatible Auth Types:**\n';
  statusContent += '- OpenRouter: ✅ Supported\n';
  statusContent += '- Other providers: ⚠️ Vision model must be available on the same provider\n';
  
  if (authType !== AuthType.USE_OPENROUTER) {
    statusContent += `\n*Current auth type (${authType}) may not support vision routing. Consider using OpenRouter for best compatibility.*`;
  }
  
  return {
    type: 'message',
    messageType: 'info',
    content: statusContent
  };
}

async function enableVision(context: CommandContext): Promise<SlashCommandActionReturn> {
  const { services } = context;
  const { config } = services;
  
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Config not available'
    };
  }
  
  // Check if we're using a compatible auth type
  const authType = config.getAuthType();
  if (authType !== AuthType.USE_OPENROUTER) {
    return {
      type: 'message',
      messageType: 'warning',
      content: `Vision routing works best with OpenRouter. Current auth type: ${authType}.\n\nTo enable anyway, set ENABLE_VISION_ROUTING=true in your .env file and restart.`
    };
  }
  
  // Enable vision routing
  process.env.ENABLE_VISION_ROUTING = 'true';
  
  // Set defaults if not already set
  if (!process.env.VISION_MODEL_NAME) {
    process.env.VISION_MODEL_NAME = 'bytedance/ui-tars-1.5-7b';
  }
  if (!process.env.VISION_MODEL_PROVIDER) {
    process.env.VISION_MODEL_PROVIDER = 'openrouter';
  }
  if (!process.env.VISION_ROUTING_STRATEGY) {
    process.env.VISION_ROUTING_STRATEGY = 'auto';
  }
  
  try {
    // Refresh the content generator to pick up vision capabilities
    if (authType === AuthType.USE_OPENROUTER) {
      await config.refreshContentGenerator();
    }
    
    return {
      type: 'message',
      messageType: 'info',
      content: `✅ Vision routing enabled!\n\n**Configuration:**\n- Model: ${process.env.VISION_MODEL_NAME}\n- Strategy: ${process.env.VISION_ROUTING_STRATEGY}\n\nVision capabilities will now be used for browser screenshot analysis and UI-related tasks.`
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error', 
      content: `Vision routing enabled, but failed to refresh content generator: ${error}\n\nYou may need to restart the application to use vision capabilities.`
    };
  }
}

async function disableVision(context: CommandContext): Promise<SlashCommandActionReturn> {
  const { services } = context;
  const { config } = services;
  
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Config not available'
    };
  }
  
  // Disable vision routing
  process.env.ENABLE_VISION_ROUTING = 'false';
  
  try {
    // Refresh the content generator to remove vision capabilities
    await config.refreshContentGenerator();
    
    return {
      type: 'message',
      messageType: 'info',
      content: '❌ Vision routing disabled. Only text models will be used.'
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `Vision routing disabled, but failed to refresh content generator: ${error}\n\nYou may need to restart the application for changes to take effect.`
    };
  }
}

async function setVisionModel(context: CommandContext, modelName: string): Promise<SlashCommandActionReturn> {
  if (!modelName.trim()) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Please specify a vision model name. Example: `/vision-model model bytedance/ui-tars-1.5-7b`'
    };
  }
  
  const { services } = context;
  const { config } = services;
  
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Config not available'
    };
  }
  
  // Update the vision model
  process.env.VISION_MODEL_NAME = modelName.trim();
  
  // If vision routing is enabled, refresh the content generator
  if (process.env.ENABLE_VISION_ROUTING === 'true') {
    try {
      await config.refreshContentGenerator();
      
      return {
        type: 'message',
        messageType: 'info',
        content: `✅ Vision model updated to: ${modelName}\n\nThe new model will be used for future vision-related tasks.`
      };
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Vision model updated to ${modelName}, but failed to refresh content generator: ${error}\n\nYou may need to restart the application for changes to take effect.`
      };
    }
  } else {
    return {
      type: 'message',
      messageType: 'info',
      content: `Vision model set to: ${modelName}\n\n*Note: Vision routing is currently disabled. Use \`/vision-model enable\` to activate it.*`
    };
  }
}

async function setVisionStrategy(context: CommandContext, strategy: string): Promise<SlashCommandActionReturn> {
  const validStrategies = ['auto', 'explicit', 'tool-based'];
  
  if (!strategy.trim() || !validStrategies.includes(strategy.trim().toLowerCase())) {
    return {
      type: 'message',
      messageType: 'error',
      content: `Invalid strategy. Valid options: ${validStrategies.join(', ')}\n\n**Strategies:**\n- **auto**: Automatically detect when to use vision based on content\n- **explicit**: Only use vision when explicitly requested\n- **tool-based**: Use vision when vision-related tools are detected`
    };
  }
  
  const { services } = context;
  const { config } = services;
  
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Config not available'
    };
  }
  
  const normalizedStrategy = strategy.trim().toLowerCase();
  process.env.VISION_ROUTING_STRATEGY = normalizedStrategy;
  
  // If vision routing is enabled, refresh the content generator
  if (process.env.ENABLE_VISION_ROUTING === 'true') {
    try {
      await config.refreshContentGenerator();
      
      return {
        type: 'message',
        messageType: 'info',
        content: `✅ Vision routing strategy updated to: ${normalizedStrategy}\n\nThe new strategy will be used for future model routing decisions.`
      };
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Vision strategy updated to ${normalizedStrategy}, but failed to refresh content generator: ${error}\n\nYou may need to restart the application for changes to take effect.`
      };
    }
  } else {
    return {
      type: 'message',
      messageType: 'info',
      content: `Vision routing strategy set to: ${normalizedStrategy}\n\n*Note: Vision routing is currently disabled. Use \`/vision-model enable\` to activate it.*`
    };
  }
}

export { visionModelCommand };
