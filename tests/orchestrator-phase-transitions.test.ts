/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock orchestrator for testing phase transitions
class MockOrchestrator {
  private currentPhase: string = 'init';
  private metadata: { task_id?: string; start_timestamp?: string } = {};
  private phaseResults: Record<string, unknown> = {};

  // Phase 0 - Metadata
  initializeMetadata(task_id?: string) {
    this.metadata.task_id = task_id || 'test-task-' + Date.now();
    this.metadata.start_timestamp = new Date().toISOString();
    this.currentPhase = 'metadata';
    return { success: true, metadata: this.metadata };
  }

  // Phase 1 - Focus Selection (Pareto-20)
  async executePareto(_taskDescription: string) {
    if (this.currentPhase !== 'metadata') {
      throw new Error('Pareto phase requires metadata initialization first');
    }
    
    // Mock YAML output validation
    const paretoOutput = {
      pareto: [
        { path: 'src/core/engine.ts', reason: 'Main orchestration logic, 70% of execution flow.' },
        { path: 'tests/integration.test.ts', reason: 'End-to-end validation, catches 80% of bugs.' },
        { path: 'config/models.json', reason: 'Model selection affects all AI interactions.' }
      ]
    };
    
    this.phaseResults.pareto = paretoOutput;
    this.currentPhase = 'pareto';
    
    return {
      success: true,
      phase: 'pareto',
      output: paretoOutput,
      temperature: 0, // Deterministic as specified
      fileCount: paretoOutput.pareto.length
    };
  }

  // Phase 2 - Strategic Plan (single call)
  async executeStrategic() {
    if (this.currentPhase !== 'pareto') {
      throw new Error('Strategic phase requires Pareto phase completion first');
    }

    const strategicPlan = {
      projectSetup: 'Load configuration from .taskmaster/config.json',
      implementationSteps: [
        '1. Initialize orchestrator with metadata tracking',
        '2. Execute Pareto analysis for file prioritization',
        '3. Generate strategic implementation plan',
        '4. Execute plan with guardrails and retry logic'
      ],
      testingPlan: 'Run pytest -q after each major change',
      rollbackSafety: 'Git stash changes if tests fail',
      openQuestions: ['Should we enable multi-patch voting?'],
      proceed: '### PROCEED TO EXECUTION'
    };

    this.phaseResults.strategic = strategicPlan;
    this.currentPhase = 'strategic';

    return {
      success: true,
      phase: 'strategic',
      plan: strategicPlan,
      tokenCount: 340, // Under 350 token limit
      temperature: 0.1
    };
  }

  // Phase 3 - Execution Loop
  async executeExecution() {
    if (this.currentPhase !== 'strategic') {
      throw new Error('Execution phase requires Strategic phase completion first');
    }

    const executionSteps = [
      { thought: 'Initialize orchestrator configuration', action: 'read_config', observation: 'Config loaded successfully' },
      { thought: 'Apply guardrails for tool validation', action: 'setup_guardrails', observation: 'Retry logic enabled' },
      { thought: 'Execute strategic plan step by step', action: 'run_tests', observation: 'All tests passing' }
    ];

    this.phaseResults.execution = executionSteps;
    this.currentPhase = 'execution';

    return {
      success: true,
      phase: 'execution',
      steps: executionSteps,
      temperature: 0.2,
      completion: 'TASK COMPLETE'
    };
  }

  // Validation methods
  validateTransition(fromPhase: string, toPhase: string) {
    const validTransitions = {
      'init': ['metadata'],
      'metadata': ['pareto'],
      'pareto': ['strategic'],
      'strategic': ['execution'],
      'execution': [] // Terminal phase
    };

    if (!validTransitions[fromPhase] || !validTransitions[fromPhase].includes(toPhase)) {
      return { valid: false, error: `Invalid transition from ${fromPhase} to ${toPhase}` };
    }

    return { valid: true };
  }

  getCurrentPhase() {
    return this.currentPhase;
  }

  getPhaseResults() {
    return this.phaseResults;
  }
}

describe('Orchestrator Phase Transitions', () => {
  let orchestrator: MockOrchestrator;

  beforeEach(() => {
    orchestrator = new MockOrchestrator();
  });

  describe('Phase Sequence Validation', () => {
    it('should initialize metadata (Phase 0) correctly', () => {
      const result = orchestrator.initializeMetadata();
      
      expect(result.success).toBe(true);
      expect(result.metadata.task_id).toBeDefined();
      expect(result.metadata.start_timestamp).toBeDefined();
      expect(orchestrator.getCurrentPhase()).toBe('metadata');
    });

    it('should execute Pareto phase (Phase 1) after metadata', async () => {
      orchestrator.initializeMetadata();
      const result = await orchestrator.executePareto('Implement new feature');
      
      expect(result.success).toBe(true);
      expect(result.phase).toBe('pareto');
      expect(result.temperature).toBe(0); // Deterministic
      expect(result.output.pareto).toHaveLength(3); // ≤5 files as specified
      expect(orchestrator.getCurrentPhase()).toBe('pareto');
    });

    it('should execute Strategic phase (Phase 2) after Pareto', async () => {
      orchestrator.initializeMetadata();
      await orchestrator.executePareto('Test task');
      const result = await orchestrator.executeStrategic();
      
      expect(result.success).toBe(true);
      expect(result.phase).toBe('strategic');
      expect(result.tokenCount).toBeLessThanOrEqual(350); // Token limit
      expect(result.plan.proceed).toBe('### PROCEED TO EXECUTION');
      expect(orchestrator.getCurrentPhase()).toBe('strategic');
    });

    it('should execute Execution phase (Phase 3) after Strategic', async () => {
      orchestrator.initializeMetadata();
      await orchestrator.executePareto('Test task');
      await orchestrator.executeStrategic();
      const result = await orchestrator.executeExecution();
      
      expect(result.success).toBe(true);
      expect(result.phase).toBe('execution');
      expect(result.completion).toBe('TASK COMPLETE');
      expect(orchestrator.getCurrentPhase()).toBe('execution');
    });
  });

  describe('Phase Transition Rules', () => {
    it('should prevent Pareto phase without metadata initialization', async () => {
      await expect(orchestrator.executePareto('Test task')).rejects.toThrow(
        'Pareto phase requires metadata initialization first'
      );
    });

    it('should prevent Strategic phase without Pareto completion', async () => {
      orchestrator.initializeMetadata();
      await expect(orchestrator.executeStrategic()).rejects.toThrow(
        'Strategic phase requires Pareto phase completion first'
      );
    });

    it('should prevent Execution phase without Strategic completion', async () => {
      orchestrator.initializeMetadata();
      await orchestrator.executePareto('Test task');
      await expect(orchestrator.executeExecution()).rejects.toThrow(
        'Execution phase requires Strategic phase completion first'
      );
    });

    it('should validate all transition rules', () => {
      expect(orchestrator.validateTransition('init', 'metadata').valid).toBe(true);
      expect(orchestrator.validateTransition('metadata', 'pareto').valid).toBe(true);
      expect(orchestrator.validateTransition('pareto', 'strategic').valid).toBe(true);
      expect(orchestrator.validateTransition('strategic', 'execution').valid).toBe(true);
      
      // Invalid transitions
      expect(orchestrator.validateTransition('init', 'pareto').valid).toBe(false);
      expect(orchestrator.validateTransition('pareto', 'execution').valid).toBe(false);
      expect(orchestrator.validateTransition('execution', 'pareto').valid).toBe(false);
    });
  });

  describe('Phase Output Validation', () => {
    it('should validate Pareto phase YAML output format', async () => {
      orchestrator.initializeMetadata();
      const result = await orchestrator.executePareto('Test task');
      
      expect(result.output).toHaveProperty('pareto');
      expect(Array.isArray(result.output.pareto)).toBe(true);
      
      result.output.pareto.forEach((item: { path: unknown; reason: unknown }) => {
        expect(item).toHaveProperty('path');
        expect(item).toHaveProperty('reason');
        expect(typeof item.path).toBe('string');
        expect(typeof item.reason).toBe('string');
        expect(item.reason.length).toBeLessThanOrEqual(200); // ≤2 sentences
      });
    });

    it('should validate Strategic phase plan structure', async () => {
      orchestrator.initializeMetadata();
      await orchestrator.executePareto('Test task');
      const result = await orchestrator.executeStrategic();
      
      expect(result.plan).toHaveProperty('projectSetup');
      expect(result.plan).toHaveProperty('implementationSteps');
      expect(result.plan).toHaveProperty('testingPlan');
      expect(result.plan).toHaveProperty('rollbackSafety');
      expect(result.plan).toHaveProperty('proceed');
      expect(result.plan.proceed).toBe('### PROCEED TO EXECUTION');
    });

    it('should validate Execution phase loop structure', async () => {
      orchestrator.initializeMetadata();
      await orchestrator.executePareto('Test task');
      await orchestrator.executeStrategic();
      const result = await orchestrator.executeExecution();
      
      expect(Array.isArray(result.steps)).toBe(true);
      result.steps.forEach((step: { thought?: unknown; action?: unknown; observation?: unknown }) => {
        expect(step).toHaveProperty('thought');
        expect(step).toHaveProperty('action');
        expect(step).toHaveProperty('observation');
      });
    });
  });

  describe('Complete Phase Flow', () => {
    it('should execute complete orchestrator flow', async () => {
      // Phase 0
      const metadataResult = orchestrator.initializeMetadata();
      expect(metadataResult.success).toBe(true);
      
      // Phase 1
      const paretoResult = await orchestrator.executePareto('Implement feature X');
      expect(paretoResult.success).toBe(true);
      
      // Phase 2
      const strategicResult = await orchestrator.executeStrategic();
      expect(strategicResult.success).toBe(true);
      
      // Phase 3
      const executionResult = await orchestrator.executeExecution();
      expect(executionResult.success).toBe(true);
      expect(executionResult.completion).toBe('TASK COMPLETE');
      
      // Verify phase results are stored
      const phaseResults = orchestrator.getPhaseResults();
      expect(phaseResults).toHaveProperty('pareto');
      expect(phaseResults).toHaveProperty('strategic');
      expect(phaseResults).toHaveProperty('execution');
    });

    it('should maintain temperature settings per phase', async () => {
      orchestrator.initializeMetadata();
      
      const paretoResult = await orchestrator.executePareto('Test');
      expect(paretoResult.temperature).toBe(0); // Deterministic
      
      const strategicResult = await orchestrator.executeStrategic();
      expect(strategicResult.temperature).toBe(0.1);
      
      const executionResult = await orchestrator.executeExecution();
      expect(executionResult.temperature).toBe(0.2);
    });
  });
});
