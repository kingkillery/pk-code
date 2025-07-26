/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenerateContentParameters, Tool } from '@google/genai';
import { VisionModelConfig } from './contentGenerator.js';

/**
 * Strategy for routing requests between text and vision models
 */
export class ModelRoutingStrategy {
  constructor(private visionConfig: VisionModelConfig) {}

  /**
   * Determines whether a request should be routed to the vision model
   */
  shouldUseVision(request: GenerateContentParameters): boolean {
    switch (this.visionConfig.routingStrategy) {
      case 'explicit':
        // Only use vision when explicitly requested
        return this.hasExplicitVisionRequest(request);
      
      case 'tool-based':
        // Use vision when vision-related tools are present
        return this.hasVisionTools(request);
      
      case 'auto':
      default:
        // Automatically detect based on content, tools, and context
        return this.shouldAutoRouteToVision(request);
    }
  }

  /**
   * Check if the request explicitly asks for vision capabilities
   */
  private hasExplicitVisionRequest(request: GenerateContentParameters): boolean {
    const textContent = this.extractTextContent(request);
    const visionKeywords = [
      'analyze this image',
      'describe the screenshot',
      'what do you see',
      'analyze the ui',
      'describe the interface',
      'vision model',
      'use vision'
    ];
    
    return visionKeywords.some(keyword => 
      textContent.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Check if the request contains vision-related tools
   */
  private hasVisionTools(_request: GenerateContentParameters): boolean {
    // Tools are typically passed separately, not in GenerateContentParameters
    // For now, we'll return false and handle tool detection elsewhere
    return false;
  }

  /**
   * Auto-detect if vision model should be used based on multiple factors
   */
  private shouldAutoRouteToVision(request: GenerateContentParameters): boolean {
    // Check for image content in request
    const hasImages = this.hasImageContent(request);
    
    // Check for vision-related tools
    const hasVisionTools = this.hasVisionTools(request);
    
    // Check for browser/UI related requests
    const isBrowserContext = this.isBrowserRelatedRequest(request);
    
    // Check for screenshot/snapshot related requests
    const isScreenshotContext = this.isScreenshotRelatedRequest(request);
    
    return hasImages || hasVisionTools || isBrowserContext || isScreenshotContext;
  }

  /**
   * Check if the request contains image data
   */
  private hasImageContent(request: GenerateContentParameters): boolean {
    if (!(request as unknown as { parts?: unknown[] }).parts) return false;
    
    return (request as unknown as { parts: unknown[] }).parts.some((part: unknown) => 
      this.isImagePart(part)
    );
  }

  /**
   * Check if a part contains image data
   */
  private isImagePart(part: unknown): boolean {
    const p = part as Record<string, unknown>;
    return Boolean((p.inlineData && (p.inlineData as Record<string, unknown>).mimeType?.toString().startsWith('image/')) ||
           (p.fileData && (p.fileData as Record<string, unknown>).mimeType?.toString().startsWith('image/')));
  }

  /**
   * Check if a tool is vision-related
   */
  private isVisionTool(tool: Tool): boolean {
    if (!tool.functionDeclarations) return false;
    
    const visionToolNames = [
      'screenshot',
      'snapshot',
      'browser_screenshot',
      'browser_snapshot',
      'capture',
      'image_analysis'
    ];
    
    return tool.functionDeclarations.some(func => 
      func.name && visionToolNames.some(visionName => 
        func.name!.toLowerCase().includes(visionName.toLowerCase())
      )
    );
  }

  /**
   * Check if the request is browser/UI related
   */
  private isBrowserRelatedRequest(request: GenerateContentParameters): boolean {
    const textContent = this.extractTextContent(request);
    
    const browserKeywords = [
      'webpage', 'website', 'browser', 'ui', 'interface', 'dom',
      'element', 'button', 'click', 'form', 'input', 'navigation',
      'menu', 'modal', 'dialog', 'layout', 'design', 'visual'
    ];
    
    return browserKeywords.some(keyword => 
      new RegExp(`\\b${keyword}\\b`, 'i').test(textContent)
    );
  }

  /**
   * Check if the request is screenshot/snapshot related
   */
  private isScreenshotRelatedRequest(request: GenerateContentParameters): boolean {
    const textContent = this.extractTextContent(request);
    
    const screenshotKeywords = [
      'screenshot', 'snapshot', 'capture', 'screen', 'image',
      'picture', 'visual', 'see', 'look', 'observe', 'analyze'
    ];
    
    return screenshotKeywords.some(keyword => 
      new RegExp(`\\b${keyword}\\b`, 'i').test(textContent)
    );
  }

  /**
   * Extract all text content from request parts
   */
  private extractTextContent(request: GenerateContentParameters): string {
    if (!(request as unknown as { parts?: unknown[] }).parts) return '';
    
    return (request as unknown as { parts: unknown[] }).parts
      .filter((part: unknown) => typeof part === 'object' && part !== null && 'text' in part)
      .map((part: unknown) => (part as { text: string }).text)
      .join(' ');
  }

  /**
   * Get the configured vision model name
   */
  getVisionModel(): string {
    return this.visionConfig.visionModel;
  }

  /**
   * Check if fallback to text model is enabled
   */
  shouldFallbackToText(): boolean {
    return this.visionConfig.fallbackToText ?? true;
  }

  /**
   * Get the routing strategy being used
   */
  getRoutingStrategy(): string {
    return this.visionConfig.routingStrategy;
  }
}
