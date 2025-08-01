/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  GuardrailManager, 
  GuardrailConfig, 
  OrchestratorPhase, 
  PhaseTransition,
  createGuardrailManager 
} from '../packages/core/src/orchestrator/guardrails';

describe('Guardrail Injection Mechanism', () => {
  let guardrailManager: GuardrailManager;
  let config: GuardrailConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      phaseTransitionMessages: true,
      toolCallValidation: true,
      retryEnabled: true,
      maxRetries: 1
    };
    guardrailManager = new GuardrailManager(config);
  });

  describe('Phase Transition Messages', () => {
    it('should generate guardrail message for metadata to pareto transition', () => {
      const transition: PhaseTransition = {
        from: OrchestratorPhase.METADATA,
        to: OrchestratorPhase.PARETO,
        timestamp: new Date().toISOString()
      };

      const message = guardrailManager.recordPhaseTransition(transition);

      expect(message).not.toBeNull();
      expect(message?.type).toBe('phase_transition');
      expect(message?.phase).toBe(OrchestratorPhase.PARETO);
      expect(message?.message).toContain('Focus Selection (Pareto-20)');
      expect(message?.message).toContain('≤5 critical files');
    });

    it('should generate guardrail message for pareto to strategic transition', () => {
      // First transition to pareto
      guardrailManager.recordPhaseTransition({
        from: OrchestratorPhase.METADATA,
        to: OrchestratorPhase.PARETO,
        timestamp: new Date().toISOString()
      });

      // Then transition to strategic
      const transition: PhaseTransition = {
        from: OrchestratorPhase.PARETO,
        to: OrchestratorPhase.STRATEGIC,
        timestamp: new Date().toISOString()
      };

      const message = guardrailManager.recordPhaseTransition(transition);

      expect(message).not.toBeNull();
      expect(message?.type).toBe('phase_transition');
      expect(message?.phase).toBe(OrchestratorPhase.STRATEGIC);
      expect(message?.message).toContain('Strategic Planning');
      expect(message?.message).toContain('≤350 tokens');
      expect(message?.message).toContain('### PROCEED TO EXECUTION');
    });

    it('should generate guardrail message for strategic to execution transition', () => {
      // Set up previous transitions
      guardrailManager.recordPhaseTransition({
        from: OrchestratorPhase.METADATA,
        to: OrchestratorPhase.PARETO,
        timestamp: new Date().toISOString()
      });
      guardrailManager.recordPhaseTransition({
        from: OrchestratorPhase.PARETO,
        to: OrchestratorPhase.STRATEGIC,
        timestamp: new Date().toISOString()
      });

      const transition: PhaseTransition = {
        from: OrchestratorPhase.STRATEGIC,
        to: OrchestratorPhase.EXECUTION,
        timestamp: new Date().toISOString()
      };

      const message = guardrailManager.recordPhaseTransition(transition);

      expect(message).not.toBeNull();
      expect(message?.type).toBe('phase_transition');
      expect(message?.phase).toBe(OrchestratorPhase.EXECUTION);
      expect(message?.message).toContain('Execution Loop');
      expect(message?.message).toContain('Thought→Action→Observation');
    });

    it('should reject invalid phase transitions', () => {
      const invalidTransition: PhaseTransition = {
        from: OrchestratorPhase.METADATA,
        to: OrchestratorPhase.EXECUTION, // Skip pareto and strategic
        timestamp: new Date().toISOString()
      };

      expect(() => {
        guardrailManager.recordPhaseTransition(invalidTransition);
      }).toThrow('Invalid phase transition');
    });

    it('should not generate messages when phase transitions disabled', () => {
      const disabledConfig: GuardrailConfig = {
        ...config,
        phaseTransitionMessages: false
      };
      const disabledManager = new GuardrailManager(disabledConfig);

      const transition: PhaseTransition = {
        from: OrchestratorPhase.METADATA,
        to: OrchestratorPhase.PARETO,
        timestamp: new Date().toISOString()
      };

      const message = disabledManager.recordPhaseTransition(transition);
      expect(message).toBeNull();
    });
  });

  describe('Tool Call Guardrails', () => {
    it('should generate guardrail for debugger tool call', () => {
      const message = guardrailManager.generateToolCallGuardrail(
        'run_pdb_test',
        OrchestratorPhase.EXECUTION,
        { success: true }
      );

      expect(message).not.toBeNull();
      expect(message?.type).toBe('tool_call');
      expect(message?.message).toContain('After debugger call');
      expect(message?.message).toContain('read_files');
      expect(message?.metadata?.toolName).toBe('run_pdb_test');
    });

    it('should generate guardrail for file edit tool call', () => {
      const message = guardrailManager.generateToolCallGuardrail(
        'edit_files',
        OrchestratorPhase.EXECUTION,
        { success: true }
      );

      expect(message).not.toBeNull();
      expect(message?.message).toContain('After file edit');
      expect(message?.message).toContain('pytest -q');
    });

    it('should generate different guardrail for successful vs failed commands', () => {
      const successMessage = guardrailManager.generateToolCallGuardrail(
        'run_command',
        OrchestratorPhase.EXECUTION,
        { success: true, exitCode: 0 }
      );

      const failMessage = guardrailManager.generateToolCallGuardrail(
        'run_command',
        OrchestratorPhase.EXECUTION,
        { success: false, exitCode: 1 }
      );

      expect(successMessage?.message).toContain('Command executed successfully');
      expect(failMessage?.message).toContain('Command failed');
      expect(failMessage?.message).toContain('Review error output');
    });

    it('should not generate tool guardrails when disabled', () => {
      const disabledConfig: GuardrailConfig = {
        ...config,
        toolCallValidation: false
      };
      const disabledManager = new GuardrailManager(disabledConfig);

      const message = disabledManager.generateToolCallGuardrail(
        'edit_files',
        OrchestratorPhase.EXECUTION,
        { success: true }
      );

      expect(message).toBeNull();
    });
  });

  describe('Retry Logic Guardrails', () => {
    it('should generate retry message for first attempt', () => {
      const message = guardrailManager.generateRetryMessage(
        'search_codebase',
        1,
        'Network timeout'
      );

      expect(message).not.toBeNull();
      expect(message?.type).toBe('retry');
      expect(message?.message).toContain('attempt 1/1');
      expect(message?.message).toContain('Retrying with same model');
      expect(message?.metadata?.fallback).toBe(false);
    });

    it('should generate fallback message when max retries exceeded', () => {
      const message = guardrailManager.generateRetryMessage(
        'search_codebase',
        2, // Exceeds maxRetries of 1
        'Network timeout'
      );

      expect(message).not.toBeNull();
      expect(message?.message).toContain('Max retries (1) exceeded');
      expect(message?.message).toContain('fallback LLM (gpt-4o)');
      expect(message?.metadata?.fallback).toBe(true);
    });

    it('should not generate retry messages when disabled', () => {
      const disabledConfig: GuardrailConfig = {
        ...config,
        retryEnabled: false
      };
      const disabledManager = new GuardrailManager(disabledConfig);

      const message = disabledManager.generateRetryMessage(
        'search_codebase',
        1,
        'Network timeout'
      );

      expect(message).toBeNull();
    });
  });

  describe('Phase Output Validation', () => {
    it('should validate valid Pareto phase output', () => {
      const validOutput = {
        pareto: [
          { path: 'src/main.ts', reason: 'Core entry point, 60% of functionality.' },
          { path: 'tests/unit.test.ts', reason: 'Primary test suite, catches 80% of bugs.' }
        ]
      };

      const message = guardrailManager.generateValidationMessage(
        OrchestratorPhase.PARETO,
        validOutput
      );

      expect(message).not.toBeNull();
      expect(message?.message).toContain('Pareto phase validated');
      expect(message?.message).toContain('2 critical files identified');
    });

    it('should detect invalid Pareto phase output', () => {
      const invalidOutput = {
        pareto: [
        1, 2, 3, 4, 5, 6] // Too many files, wrong format
      };

      const message = guardrailManager.generateValidationMessage(
        OrchestratorPhase.PARETO,
        invalidOutput
      );

      expect(message).not.toBeNull();
      expect(message?.message).toContain('Exceeded limit of 5 files');
    });

    it('should validate valid Strategic phase output', () => {
      const validOutput = {
        plan: {
          projectSetup: 'Load config',
          implementationSteps: ['Step 1', 'Step 2'],
          testingPlan: 'Run tests',
          proceed: '### PROCEED TO EXECUTION'
        },
        tokenCount: 300
      };

      const message = guardrailManager.generateValidationMessage(
        OrchestratorPhase.STRATEGIC,
        validOutput
      );

      expect(message).not.toBeNull();
      expect(message?.message).toContain('Strategic phase validated');
      expect(message?.message).toContain('ready for execution');
    });

    it('should detect invalid Strategic phase output', () => {
      const invalidOutput = {
        plan: {
          projectSetup: 'Load config',
          // Missing proceed marker
        },
        tokenCount: 400 // Exceeds limit
      };

      const message = guardrailManager.generateValidationMessage(
        OrchestratorPhase.STRATEGIC,
        invalidOutput
      );

      expect(message).not.toBeNull();
      expect(message?.message).toContain('Must end with');
      expect(message?.message).toContain('### PROCEED TO EXECUTION');
    });

    it('should validate Execution phase output', () => {
      const validOutput = {
        steps: [
          { thought: 'Load config', action: 'read_files', observation: 'Config loaded' },
          { thought: 'Run tests', action: 'run_command', observation: 'Tests passed' }
        ]
      };

      const message = guardrailManager.generateValidationMessage(
        OrchestratorPhase.EXECUTION,
        validOutput
      );

      expect(message).not.toBeNull();
      expect(message?.message).toContain('Execution phase validated');
      expect(message?.message).toContain('2 steps completed');
    });
  });

  describe('Guardrail History and State', () => {
    it('should track phase transition history', () => {
      guardrailManager.recordPhaseTransition({
        from: OrchestratorPhase.METADATA,
        to: OrchestratorPhase.PARETO,
        timestamp: new Date().toISOString()
      });

      guardrailManager.recordPhaseTransition({
        from: OrchestratorPhase.PARETO,
        to: OrchestratorPhase.STRATEGIC,
        timestamp: new Date().toISOString()
      });

      const history = guardrailManager.getTransitionHistory();
      expect(history).toHaveLength(2);
      expect(history[0].from).toBe(OrchestratorPhase.METADATA);
      expect(history[0].to).toBe(OrchestratorPhase.PARETO);
      expect(history[1].from).toBe(OrchestratorPhase.PARETO);
      expect(history[1].to).toBe(OrchestratorPhase.STRATEGIC);
    });

    it('should track current phase', () => {
      expect(guardrailManager.getCurrentPhase()).toBeNull();

      guardrailManager.recordPhaseTransition({
        from: OrchestratorPhase.METADATA,
        to: OrchestratorPhase.PARETO,
        timestamp: new Date().toISOString()
      });

      expect(guardrailManager.getCurrentPhase()).toBe(OrchestratorPhase.PARETO);
    });

    it('should accumulate guardrail messages', () => {
      guardrailManager.recordPhaseTransition({
        from: OrchestratorPhase.METADATA,
        to: OrchestratorPhase.PARETO,
        timestamp: new Date().toISOString()
      });

      guardrailManager.generateToolCallGuardrail(
        'edit_files',
        OrchestratorPhase.PARETO,
        { success: true }
      );

      const messages = guardrailManager.getGuardrailMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].type).toBe('phase_transition');
      expect(messages[1].type).toBe('tool_call');
    });

    it('should clear history and messages', () => {
      guardrailManager.recordPhaseTransition({
        from: OrchestratorPhase.METADATA,
        to: OrchestratorPhase.PARETO,
        timestamp: new Date().toISOString()
      });

      expect(guardrailManager.getGuardrailMessages()).toHaveLength(1);
      expect(guardrailManager.getTransitionHistory()).toHaveLength(1);

      guardrailManager.clear();

      expect(guardrailManager.getGuardrailMessages()).toHaveLength(0);
      expect(guardrailManager.getTransitionHistory()).toHaveLength(0);
      expect(guardrailManager.getCurrentPhase()).toBeNull();
    });
  });

  describe('Factory Function', () => {
    it('should create GuardrailManager using factory function', () => {
      const manager = createGuardrailManager(config);
      expect(manager).toBeInstanceOf(GuardrailManager);
    });
  });

  describe('Sub-Agent Guardrails', () => {
    it('should generate guardrail for pk-debugger sub-agent', () => {
      const message = guardrailManager.generateSubAgentGuardrail(
        'pk-debugger',
        OrchestratorPhase.EXECUTION,
        { success: true, output: 'Debug analysis complete' }
      );

      expect(message).not.toBeNull();
      expect(message?.type).toBe('tool_call');
      expect(message?.message).toContain('After debugger analysis');
      expect(message?.message).toContain('read_files');
      expect(message?.metadata?.agentName).toBe('pk-debugger');
    });

    it('should generate guardrail for pk-planner sub-agent', () => {
      const message = guardrailManager.generateSubAgentGuardrail(
        'pk-planner',
        OrchestratorPhase.EXECUTION,
        { success: true, output: 'Strategic plan updated' }
      );

      expect(message).not.toBeNull();
      expect(message?.type).toBe('tool_call');
      expect(message?.message).toContain('After strategic planning');
      expect(message?.message).toContain('search_codebase');
      expect(message?.metadata?.agentName).toBe('pk-planner');
    });

    it('should not generate guardrail for unknown sub-agent', () => {
      const message = guardrailManager.generateSubAgentGuardrail(
        'unknown-agent',
        OrchestratorPhase.EXECUTION,
        { success: true }
      );

      expect(message).toBeNull();
    });

    it('should not generate sub-agent guardrails when disabled', () => {
      const disabledConfig: GuardrailConfig = {
        ...config,
        toolCallValidation: false
      };
      const disabledManager = new GuardrailManager(disabledConfig);

      const message = disabledManager.generateSubAgentGuardrail(
        'pk-debugger',
        OrchestratorPhase.EXECUTION,
        { success: true }
      );

      expect(message).toBeNull();
    });
  });

  describe('Disabled Guardrails', () => {
    it('should not generate any messages when completely disabled', () => {
      const disabledConfig: GuardrailConfig = {
        enabled: false,
        phaseTransitionMessages: true,
        toolCallValidation: true,
        retryEnabled: true,
        maxRetries: 1
      };
      const disabledManager = new GuardrailManager(disabledConfig);

      // Try to generate various types of messages
      const phaseMessage = disabledManager.recordPhaseTransition({
        from: OrchestratorPhase.METADATA,
        to: OrchestratorPhase.PARETO,
        timestamp: new Date().toISOString()
      });

      const toolMessage = disabledManager.generateToolCallGuardrail(
        'edit_files',
        OrchestratorPhase.EXECUTION,
        { success: true }
      );

      const validationMessage = disabledManager.generateValidationMessage(
        OrchestratorPhase.PARETO,
        { pareto: [] }
      );

      const retryMessage = disabledManager.generateRetryMessage(
        'search_codebase',
        1,
        'Error'
      );

      const subAgentMessage = disabledManager.generateSubAgentGuardrail(
        'pk-debugger',
        OrchestratorPhase.EXECUTION,
        { success: true }
      );

      expect(phaseMessage).toBeNull();
      expect(toolMessage).toBeNull();
      expect(validationMessage).toBeNull();
      expect(retryMessage).toBeNull();
      expect(subAgentMessage).toBeNull();
    });
  });
});
