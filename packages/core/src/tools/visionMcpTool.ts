/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tool, CallableTool, Schema } from '@google/genai';
import { DiscoveredMCPTool } from './mcp-tool.js';
import { MultimodalContentGenerator } from '../core/contentGenerator.js';
import { getResponseText } from '../utils/generateContentResponseUtilities.js';

/**
 * Enhanced MCP tool that can leverage vision capabilities for browser automation
 */
export class VisionMCPTool extends DiscoveredMCPTool {
  constructor(
    callableTool: CallableTool,
    serverName: string,
    toolNameForModel: string,
    description: string,
    parameters: Schema,
    serverToolName: string,
    timeout?: number,
    trust?: boolean,
    private visionContentGenerator?: MultimodalContentGenerator
  ) {
    super(
      callableTool,
      serverName,
      toolNameForModel,
      description,
      parameters,
      serverToolName,
      timeout,
      trust
    );
  }

  /**
   * Execute the MCP tool with optional vision enhancement
   */
  async execute(params: any, signal?: AbortSignal) {
    const result = await super.execute(params, signal);

    // If this is a vision-capable browser tool and we have vision support, enhance the result
    if (this.shouldEnhanceWithVision() && this.visionContentGenerator) {
      return this.enhanceWithVisionAnalysis(result, params, signal);
    }

    return result;
  }

  /**
   * Check if this tool should be enhanced with vision analysis
   */
  private shouldEnhanceWithVision(): boolean {
    if (!this.visionContentGenerator || !this.visionContentGenerator.isVisionCapable()) {
      return false;
    }

    // Check if this is a screenshot or browser snapshot tool
    const visionToolNames = [
      'screenshot',
      'snapshot',
      'browser_screenshot',
      'browser_snapshot',
      'capture'
    ];

    return visionToolNames.some(visionName =>
      this.name.toLowerCase().includes(visionName.toLowerCase()) ||
      this.serverToolName.toLowerCase().includes(visionName.toLowerCase())
    );
  }

  /**
   * Enhance the browser tool result with vision analysis
   */
  private async enhanceWithVisionAnalysis(
    browserResult: any,
    originalParams: any,
    signal?: AbortSignal
  ) {
    try {
      // Extract image data from the browser result
      const imageData = this.extractImageDataFromResult(browserResult);
      
      if (!imageData) {
        console.debug('[VisionMCPTool] No image data found in browser result, skipping vision enhancement');
        return browserResult;
      }

      console.debug(`[VisionMCPTool] Enhancing ${this.name} result with vision analysis using ${this.visionContentGenerator!.getVisionModel()}`);

      // Create vision analysis request
      const visionRequest = {
        model: this.visionContentGenerator!.getVisionModel() || 'bytedance/ui-tars-1.5-7b',
        contents: [{
          parts: [
            {
              text: this.createVisionAnalysisPrompt(originalParams)
            },
            {
              inlineData: {
                mimeType: imageData.mimeType,
                data: imageData.data
              }
            }
          ]
        }]
      };

      // Get vision analysis
      const visionAnalysis = await this.visionContentGenerator!.generateContentWithVision(visionRequest);
      const analysisText = getResponseText(visionAnalysis);

      console.debug('[VisionMCPTool] Vision analysis completed successfully');

      // Enhance the original result with vision analysis
      return {
        ...browserResult,
        visionAnalysis: analysisText,
        llmContent: this.combineResultsForLLM(browserResult, analysisText),
        returnDisplay: this.combineResultsForDisplay(browserResult, analysisText)
      };

    } catch (error) {
      console.warn('[VisionMCPTool] Vision analysis failed, returning original result:', error);
      return browserResult;
    }
  }

  /**
   * Extract image data from browser MCP result
   */
  private extractImageDataFromResult(result: any): { mimeType: string; data: string } | null {
    // Try different possible locations for image data in the result
    
    // Check for direct image data
    if (result.image || result.screenshot) {
      const imageData = result.image || result.screenshot;
      if (typeof imageData === 'string') {
        return {
          mimeType: 'image/png',
          data: imageData
        };
      }
      if (imageData.data && imageData.mimeType) {
        return {
          mimeType: imageData.mimeType,
          data: imageData.data
        };
      }
    }

    // Check for base64 encoded images in content
    if (result.content && typeof result.content === 'string') {
      const base64ImageMatch = result.content.match(/data:image\/(png|jpeg|jpg|gif);base64,([^"]+)/);
      if (base64ImageMatch) {
        return {
          mimeType: `image/${base64ImageMatch[1]}`,
          data: base64ImageMatch[2]
        };
      }
    }

    // Check for browser-specific result structures
    if (result.llmContent) {
      const base64ImageMatch = result.llmContent.match(/data:image\/(png|jpeg|jpg|gif);base64,([^"]+)/);
      if (base64ImageMatch) {
        return {
          mimeType: `image/${base64ImageMatch[1]}`,
          data: base64ImageMatch[2]
        };
      }
    }

    return null;
  }

  /**
   * Create a contextual prompt for vision analysis based on the tool and parameters
   */
  private createVisionAnalysisPrompt(originalParams: any): string {
    const toolName = this.name.toLowerCase();
    
    if (toolName.includes('screenshot') || toolName.includes('snapshot')) {
      return `You are analyzing a webpage screenshot. Please provide a detailed analysis of:

1. **UI Layout & Structure**: Describe the overall layout, main sections, and visual hierarchy
2. **Interactive Elements**: Identify buttons, links, forms, menus, and other clickable elements
3. **Content Analysis**: Summarize the main content, headings, and key information visible
4. **Navigation Elements**: Describe navigation menus, breadcrumbs, or other wayfinding elements
5. **Visual Design**: Comment on the design style, color scheme, and visual appeal
6. **Actionable Insights**: Suggest what actions a user might want to take on this page

Be specific about element locations (top-left, center, bottom-right, etc.) and provide actionable descriptions that would help with browser automation tasks.

Additional context from the tool call: ${JSON.stringify(originalParams, null, 2)}`;
    }

    return `Analyze this image from a web browser context. Describe what you see including UI elements, layout, content, and any actionable items. Tool context: ${JSON.stringify(originalParams, null, 2)}`;
  }

  /**
   * Combine browser result and vision analysis for LLM context
   */
  private combineResultsForLLM(browserResult: any, visionAnalysis: string): string {
    const originalContent = browserResult.llmContent || browserResult.content || 'Browser tool executed successfully.';
    
    return `${originalContent}

## Vision Analysis
${visionAnalysis}`;
  }

  /**
   * Combine browser result and vision analysis for user display
   */
  private combineResultsForDisplay(browserResult: any, visionAnalysis: string): string {
    const originalDisplay = browserResult.returnDisplay || browserResult.content || 'Browser tool executed successfully.';
    
    return `${originalDisplay}

---

**🔍 Vision Analysis:**
${visionAnalysis}`;
  }

  /**
   * Set the vision content generator for this tool
   */
  setVisionContentGenerator(visionContentGenerator: MultimodalContentGenerator) {
    this.visionContentGenerator = visionContentGenerator;
  }

  /**
   * Check if this tool has vision capabilities
   */
  hasVisionCapabilities(): boolean {
    return !!this.visionContentGenerator && this.visionContentGenerator.isVisionCapable();
  }

  /**
   * Get information about the vision capabilities
   */
  getVisionInfo() {
    if (!this.visionContentGenerator) {
      return null;
    }

    return {
      hasVision: this.visionContentGenerator.isVisionCapable(),
      visionModel: this.visionContentGenerator.getVisionModel(),
      textModel: this.visionContentGenerator.getTextModel(),
      enhancesThisTool: this.shouldEnhanceWithVision()
    };
  }
}
