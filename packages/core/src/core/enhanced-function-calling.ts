/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Content, FunctionCall, GenerateContentResponse } from '@google/genai';
import { ToolRegistry } from '../tools/tool-registry.js';
import { Config } from '../config/config.js';
import { executeToolCall } from './nonInteractiveToolExecutor.js';
import { ToolCallRequestInfo } from './turn.js';

/**
 * Enhanced function calling system with multi-step program synthesis support
 */

export interface FunctionCallChain {
  id: string;
  calls: FunctionCall[];
  dependencies: Map<string, string[]>; // callId -> dependent callIds
  executionOrder: string[];
  context: {
    sessionId: string;
    maxDepth: number;
    timeout: number;
    errorHandling: 'fail-fast' | 'continue-on-error' | 'retry';
  };
}

export interface SynthesisContext {
  goal: string;
  constraints: string[];
  availableTools: string[];
  previousResults: Map<string, any>;
  contextWindow: {
    currentSize: number;
    maxSize: number;
    modelSupportsLargeContext: boolean;
  };
}

export interface SynthesisStep {
  id: string;
  description: string;
  requiredTools: string[];
  expectedOutput: string;
  validationCriteria: string[];
  fallbackStrategies: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedTokens: number;
}

export class EnhancedFunctionCalling {
  private readonly maxChainDepth = 10;
  private readonly defaultTimeout = 300000; // 5 minutes

  /**
   * Execute a chain of function calls with dependencies
   */
  async executeFunctionChain(
    chain: FunctionCallChain,
    config: Config,
    toolRegistry: ToolRegistry,
    abortController: AbortController,
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const executed = new Set<string>();
    const failed = new Set<string>();

    // Execute calls in dependency order
    for (const callId of chain.executionOrder) {
      if (abortController.signal.aborted) {
        throw new Error('Function chain execution cancelled');
      }

      // Check if dependencies are satisfied
      const dependencies = chain.dependencies.get(callId) || [];
      const unsatisfiedDeps = dependencies.filter(
        (dep) => !executed.has(dep) && !failed.has(dep),
      );

      if (unsatisfiedDeps.length > 0) {
        if (chain.context.errorHandling === 'fail-fast') {
          throw new Error(
            `Dependencies not satisfied for call ${callId}: ${unsatisfiedDeps.join(', ')}`,
          );
        }
        continue; // Skip this call for now
      }

      const call = chain.calls.find((c) => c.id === callId);
      if (!call) continue;

      try {
        const result = await this.executeSingleCall(
          call,
          config,
          toolRegistry,
          abortController,
          results,
        );
        results.set(callId, result);
        executed.add(callId);
      } catch (error) {
        failed.add(callId);
        results.set(callId, {
          error: error instanceof Error ? error.message : String(error),
        });

        if (chain.context.errorHandling === 'fail-fast') {
          throw error;
        }
      }
    }

    return results;
  }

  /**
   * Synthesize a program through multi-step function calling
   */
  async synthesizeProgram(
    context: SynthesisContext,
    config: Config,
    toolRegistry: ToolRegistry,
    abortController: AbortController,
  ): Promise<{
    steps: SynthesisStep[];
    executionPlan: FunctionCallChain;
    estimatedTokens: number;
  }> {
    // Generate synthesis steps based on goal
    const steps = await this.generateSynthesisSteps(context);

    // Create function call chain
    const executionPlan = await this.createFunctionCallChain(steps, context);

    // Estimate total token usage
    const estimatedTokens = this.estimateTokenUsage(steps, context);

    // Check if context window needs extension
    if (this.shouldExtendContextWindow(estimatedTokens, context)) {
      // Extend context window if supported
      await this.extendContextWindow(config, estimatedTokens);
    }

    return {
      steps,
      executionPlan,
      estimatedTokens,
    };
  }

  /**
   * Generate synthesis steps from natural language goal
   */
  private async generateSynthesisSteps(
    context: SynthesisContext,
  ): Promise<SynthesisStep[]> {
    const { goal, constraints, availableTools } = context;

    // Analyze goal to determine required steps
    const steps: SynthesisStep[] = [];

    // Step 1: Requirements analysis
    steps.push({
      id: 'analyze-requirements',
      description: 'Analyze the program requirements and constraints',
      requiredTools: ['read-file', 'grep'],
      expectedOutput: 'Clear requirements specification',
      validationCriteria: [
        'Requirements are well-defined',
        'Constraints are identified',
      ],
      fallbackStrategies: [
        'Use default requirements',
        'Ask user for clarification',
      ],
      priority: 'high',
      estimatedTokens: 1000,
    });

    // Step 2: Architecture design
    if (
      goal.toLowerCase().includes('architecture') ||
      goal.toLowerCase().includes('design')
    ) {
      steps.push({
        id: 'design-architecture',
        description: 'Design the system architecture',
        requiredTools: ['write-file', 'edit-file'],
        expectedOutput: 'Architecture specification and diagrams',
        validationCriteria: [
          'Architecture is scalable',
          'Components are well-defined',
        ],
        fallbackStrategies: ['Use standard architecture patterns'],
        priority: 'high',
        estimatedTokens: 2000,
      });
    }

    // Step 3: Implementation planning
    steps.push({
      id: 'plan-implementation',
      description: 'Create detailed implementation plan',
      requiredTools: ['list-dir', 'read-file'],
      expectedOutput: 'Implementation roadmap with milestones',
      validationCriteria: ['Plan is actionable', 'Timeline is realistic'],
      fallbackStrategies: ['Use agile planning approach'],
      priority: 'medium',
      estimatedTokens: 1500,
    });

    // Step 4: Code generation
    steps.push({
      id: 'generate-code',
      description: 'Generate the actual program code',
      requiredTools: ['write-file', 'edit-file', 'run-terminal-cmd'],
      expectedOutput: 'Working program code',
      validationCriteria: ['Code compiles', 'Basic functionality works'],
      fallbackStrategies: ['Generate minimal viable code', 'Use templates'],
      priority: 'high',
      estimatedTokens: 5000,
    });

    // Step 5: Testing and validation
    if (availableTools.includes('run-terminal-cmd')) {
      steps.push({
        id: 'test-implementation',
        description: 'Test the generated code',
        requiredTools: ['run-terminal-cmd', 'read-file'],
        expectedOutput: 'Test results and validation report',
        validationCriteria: ['Tests pass', 'Code quality is acceptable'],
        fallbackStrategies: ['Manual testing', 'Basic validation only'],
        priority: 'high',
        estimatedTokens: 1000,
      });
    }

    // Step 6: Documentation
    steps.push({
      id: 'generate-documentation',
      description: 'Create documentation for the program',
      requiredTools: ['write-file', 'read-file'],
      expectedOutput: 'README and documentation files',
      validationCriteria: [
        'Documentation is complete',
        'Usage examples provided',
      ],
      fallbackStrategies: ['Generate basic documentation'],
      priority: 'medium',
      estimatedTokens: 1000,
    });

    return steps;
  }

  /**
   * Create function call chain from synthesis steps
   */
  private async createFunctionCallChain(
    steps: SynthesisStep[],
    context: SynthesisContext,
  ): Promise<FunctionCallChain> {
    const calls: FunctionCall[] = [];
    const dependencies = new Map<string, string[]>();
    const executionOrder: string[] = [];

    // Create function calls for each step
    for (const step of steps) {
      const callId = `call-${step.id}`;

      // Create appropriate function call based on step requirements
      const functionCall = this.createFunctionCallForStep(step, context);
      calls.push(functionCall);

      // Determine dependencies based on step relationships
      const stepDependencies = this.determineStepDependencies(step, steps);
      dependencies.set(
        callId,
        stepDependencies.map((dep) => `call-${dep}`),
      );

      executionOrder.push(callId);
    }

    // Topologically sort execution order based on dependencies
    const sortedOrder = this.topologicalSort(dependencies);

    return {
      id: `chain-${Date.now()}`,
      calls,
      dependencies,
      executionOrder: sortedOrder,
      context: {
        sessionId: `session-${Date.now()}`,
        maxDepth: this.maxChainDepth,
        timeout: this.defaultTimeout,
        errorHandling: 'continue-on-error',
      },
    };
  }

  /**
   * Create function call for a specific synthesis step
   */
  private createFunctionCallForStep(
    step: SynthesisStep,
    context: SynthesisContext,
  ): FunctionCall {
    const { requiredTools } = step;

    // Choose primary tool based on step requirements
    let primaryTool = 'run-terminal-cmd'; // Default

    if (requiredTools.includes('read-file')) {
      primaryTool = 'read-file';
    } else if (requiredTools.includes('write-file')) {
      primaryTool = 'write-file';
    } else if (requiredTools.includes('edit-file')) {
      primaryTool = 'edit-file';
    } else if (requiredTools.includes('grep')) {
      primaryTool = 'grep';
    }

    // Create function call arguments based on step
    const args = this.generateFunctionCallArgs(step, primaryTool, context);

    return {
      id: `call-${step.id}`,
      name: primaryTool,
      args,
    };
  }

  /**
   * Generate arguments for function call based on step requirements
   */
  private generateFunctionCallArgs(
    step: SynthesisStep,
    toolName: string,
    context: SynthesisContext,
  ): Record<string, unknown> {
    switch (toolName) {
      case 'read-file':
        return {
          target_file: this.inferTargetFile(step, context),
          offset: 1,
          limit: 100,
        };

      case 'write-file':
        return {
          file_path: this.inferTargetFile(step, context),
          content: this.generateInitialContent(step),
        };

      case 'run-terminal-cmd':
        return {
          command: this.generateTerminalCommand(step),
          is_background: false,
        };

      case 'grep':
        return {
          pattern: this.generateSearchPattern(step),
          path: '.',
          output_mode: 'content',
        };

      default:
        return {};
    }
  }

  /**
   * Determine dependencies between steps
   */
  private determineStepDependencies(
    step: SynthesisStep,
    allSteps: SynthesisStep[],
  ): string[] {
    const dependencies: string[] = [];

    // Basic dependency rules
    if (
      step.id === 'design-architecture' &&
      allSteps.some((s) => s.id === 'analyze-requirements')
    ) {
      dependencies.push('analyze-requirements');
    }

    if (
      step.id === 'generate-code' &&
      allSteps.some((s) => s.id === 'design-architecture')
    ) {
      dependencies.push('design-architecture');
    }

    if (
      step.id === 'test-implementation' &&
      allSteps.some((s) => s.id === 'generate-code')
    ) {
      dependencies.push('generate-code');
    }

    if (step.id === 'generate-documentation') {
      // Documentation depends on most other steps
      if (allSteps.some((s) => s.id === 'generate-code'))
        dependencies.push('generate-code');
      if (allSteps.some((s) => s.id === 'test-implementation'))
        dependencies.push('test-implementation');
    }

    return dependencies;
  }

  /**
   * Topologically sort execution order based on dependencies
   */
  private topologicalSort(dependencies: Map<string, string[]>): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (node: string) => {
      if (visited.has(node)) return;
      if (visiting.has(node)) {
        throw new Error('Circular dependency detected');
      }

      visiting.add(node);

      const deps = dependencies.get(node) || [];
      for (const dep of deps) {
        visit(dep);
      }

      visiting.delete(node);
      visited.add(node);
      result.push(node);
    };

    // Visit all nodes
    for (const node of dependencies.keys()) {
      if (!visited.has(node)) {
        visit(node);
      }
    }

    return result;
  }

  /**
   * Execute single function call with context
   */
  private async executeSingleCall(
    call: FunctionCall,
    config: Config,
    toolRegistry: ToolRegistry,
    abortController: AbortController,
    previousResults: Map<string, any>,
  ): Promise<any> {
    const requestInfo: ToolCallRequestInfo = {
      callId: call.id || `call-${Date.now()}`,
      name: call.name as string,
      args: (call.args as Record<string, unknown>) || {},
      isClientInitiated: false,
      prompt_id: `chain-${Date.now()}`,
    };

    const toolResponse = await executeToolCall(
      config,
      requestInfo,
      toolRegistry,
      abortController.signal,
    );

    if (toolResponse.error) {
      throw new Error(`Tool execution failed: ${toolResponse.error.message}`);
    }

    return toolResponse.resultDisplay;
  }

  /**
   * Estimate token usage for synthesis steps
   */
  private estimateTokenUsage(
    steps: SynthesisStep[],
    context: SynthesisContext,
  ): number {
    let totalTokens = 0;

    // Base tokens for system prompts and instructions
    totalTokens += 1000;

    // Add tokens for each step
    for (const step of steps) {
      totalTokens += step.estimatedTokens;
      // Add tokens for tool call overhead
      totalTokens += 500;
    }

    // Add tokens for context
    totalTokens += Math.ceil(context.goal.length / 4); // Rough token estimation
    for (const constraint of context.constraints) {
      totalTokens += Math.ceil(constraint.length / 4);
    }

    return totalTokens;
  }

  /**
   * Check if context window should be extended
   */
  private shouldExtendContextWindow(
    estimatedTokens: number,
    context: SynthesisContext,
  ): boolean {
    if (!context.contextWindow.modelSupportsLargeContext) return false;

    const { currentSize, maxSize } = context.contextWindow;
    const bufferSize = Math.max(estimatedTokens, currentSize);

    return bufferSize > maxSize * 0.8 && maxSize < 1000000; // 1M token limit
  }

  /**
   * Extend context window for large operations
   */
  private async extendContextWindow(
    config: Config,
    requiredTokens: number,
  ): Promise<void> {
    // This would interact with the model configuration to extend context window
    // Implementation depends on the specific model provider
    console.log(
      `Extending context window to accommodate ${requiredTokens} tokens`,
    );

    // Placeholder for actual implementation
    // Would modify model configuration or use model-specific APIs
  }

  // Helper methods for generating content

  private inferTargetFile(
    step: SynthesisStep,
    context: SynthesisContext,
  ): string {
    const goal = context.goal.toLowerCase();

    if (goal.includes('readme') || step.id.includes('documentation')) {
      return 'README.md';
    }
    if (goal.includes('package.json') || goal.includes('npm')) {
      return 'package.json';
    }
    if (goal.includes('typescript') || goal.includes('.ts')) {
      return `src/${step.id.replace(/-/g, '_')}.ts`;
    }
    if (goal.includes('javascript') || goal.includes('.js')) {
      return `src/${step.id.replace(/-/g, '_')}.js`;
    }

    return `${step.id}.txt`;
  }

  private generateInitialContent(step: SynthesisStep): string {
    switch (step.id) {
      case 'analyze-requirements':
        return `# Requirements Analysis

## Goal
${step.description}

## Requirements
- TBD

## Constraints
- TBD

## Success Criteria
${step.validationCriteria.map((criteria) => `- ${criteria}`).join('\n')}
`;

      case 'design-architecture':
        return `# System Architecture

## Overview
TBD

## Components
- TBD

## Data Flow
- TBD
`;

      case 'plan-implementation':
        return `# Implementation Plan

## Phases
1. TBD

## Timeline
- TBD

## Resources Required
- TBD
`;

      default:
        return `# ${step.description}

TBD - Implementation details to be added.
`;
    }
  }

  private generateTerminalCommand(step: SynthesisStep): string {
    switch (step.id) {
      case 'test-implementation':
        return 'npm test';
      case 'generate-code':
        return 'npm run build';
      default:
        return 'echo "Step completed"';
    }
  }

  private generateSearchPattern(step: SynthesisStep): string {
    switch (step.id) {
      case 'analyze-requirements':
        return 'TODO|FIXME|BUG|HACK';
      case 'design-architecture':
        return 'class|interface|function|module';
      default:
        return '.*';
    }
  }
}

export const enhancedFunctionCalling = new EnhancedFunctionCalling();
