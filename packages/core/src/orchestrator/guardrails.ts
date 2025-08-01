/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GuardrailConfig {
  enabled: boolean;
  phaseTransitionMessages: boolean;
  toolCallValidation: boolean;
  retryEnabled: boolean;
  maxRetries: number;
}

export interface PhaseTransition {
  from: OrchestratorPhase;
  to: OrchestratorPhase;
  timestamp: string;
  context?: Record<string, any>;
}

export enum OrchestratorPhase {
  METADATA = 'metadata',
  PARETO = 'pareto', 
  STRATEGIC = 'strategic',
  EXECUTION = 'execution'
}

export interface GuardrailMessage {
  type: 'phase_transition' | 'tool_call' | 'validation' | 'retry';
  phase: OrchestratorPhase;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * GuardrailManager handles automatic injection of guardrail messages
 * between orchestrator phases and after key tool calls
 */
export class GuardrailManager {
  private config: GuardrailConfig;
  private transitionHistory: PhaseTransition[] = [];
  private guardrailMessages: GuardrailMessage[] = [];

  constructor(config: GuardrailConfig) {
    this.config = config;
  }

  /**
   * Generate guardrail message for phase transitions
   */
  generatePhaseTransitionMessage(transition: PhaseTransition): GuardrailMessage | null {
    if (!this.config.enabled || !this.config.phaseTransitionMessages) {
      return null;
    }

    const messages: Record<string, string> = {
      [`${OrchestratorPhase.METADATA}_to_${OrchestratorPhase.PARETO}`]: 
        "Next: Focus Selection (Pareto-20). Identify ≤5 critical files with quantitative justification.",
      
      [`${OrchestratorPhase.PARETO}_to_${OrchestratorPhase.STRATEGIC}`]: 
        "Next: Strategic Planning. Compose implementation plan ≤350 tokens ending with '### PROCEED TO EXECUTION'.",
      
      [`${OrchestratorPhase.STRATEGIC}_to_${OrchestratorPhase.EXECUTION}`]: 
        "Next: Execution Loop. Iterate through plan steps with Thought→Action→Observation pattern."
    };

    const transitionKey = `${transition.from}_to_${transition.to}`;
    const message = messages[transitionKey];

    if (!message) {
      return null;
    }

    const guardrailMessage: GuardrailMessage = {
      type: 'phase_transition',
      phase: transition.to,
      message,
      timestamp: new Date().toISOString(),
      metadata: {
        transition: transitionKey,
        context: transition.context
      }
    };

    this.guardrailMessages.push(guardrailMessage);
    return guardrailMessage;
  }

  /**
   * Generate guardrail message after tool calls
   */
  generateToolCallGuardrail(toolName: string, phase: OrchestratorPhase, result: any): GuardrailMessage | null {
    if (!this.config.enabled || !this.config.toolCallValidation) {
      return null;
    }

    // Tool-specific guardrails based on Refact.ai patterns
    const toolGuardrails: Record<string, string> = {
      'run_pdb_test': 'After debugger call: Open relevant files via read_files to examine stack trace context.',
      'edit_files': 'After file edit: Run tests (pytest -q) to validate changes.',
      'create_file': 'After file creation: Verify file exists and check for syntax errors.',
      'search_codebase': 'After search: Read the most relevant files found for deeper analysis.',
      'grep': 'After grep: Examine matched files to understand context and patterns.',
      'run_command': (result?.exitCode === 0) 
        ? 'Command executed successfully. Proceed with next step.'
        : 'Command failed. Review error output and adjust approach.'
    };

    // Sub-agent specific guardrails
    const subAgentGuardrails: Record<string, string> = {
      'pk-debugger': 'After debugger analysis: Use read_files to examine the source files mentioned in the stack trace for context and understanding.',
      'pk-planner': 'After strategic planning: Use search_codebase or read_files to gather architectural context for the revised plan.'
    };

    const message = toolGuardrails[toolName];
    if (!message) {
      return null;
    }

    const guardrailMessage: GuardrailMessage = {
      type: 'tool_call',
      phase,
      message,
      timestamp: new Date().toISOString(),
      metadata: {
        toolName,
        result: result ? { success: !!result.success, exitCode: result.exitCode } : null
      }
    };

    this.guardrailMessages.push(guardrailMessage);
    return guardrailMessage;
  }

  /**
   * Validate phase transition is allowed
   */
  validatePhaseTransition(from: OrchestratorPhase, to: OrchestratorPhase): boolean {
    const validTransitions: Record<OrchestratorPhase, OrchestratorPhase[]> = {
      [OrchestratorPhase.METADATA]: [OrchestratorPhase.PARETO],
      [OrchestratorPhase.PARETO]: [OrchestratorPhase.STRATEGIC],
      [OrchestratorPhase.STRATEGIC]: [OrchestratorPhase.EXECUTION],
      [OrchestratorPhase.EXECUTION]: [] // Terminal phase
    };

    return validTransitions[from]?.includes(to) || false;
  }

  /**
   * Record a phase transition
   */
  recordPhaseTransition(transition: PhaseTransition): GuardrailMessage | null {
    if (!this.validatePhaseTransition(transition.from, transition.to)) {
      throw new Error(`Invalid phase transition from ${transition.from} to ${transition.to}`);
    }

    this.transitionHistory.push(transition);
    return this.generatePhaseTransitionMessage(transition);
  }

  /**
   * Get retry message when tool call fails
   */
  generateRetryMessage(toolName: string, attempt: number, error: string): GuardrailMessage | null {
    if (!this.config.enabled || !this.config.retryEnabled) {
      return null;
    }

    if (attempt > this.config.maxRetries) {
      return {
        type: 'retry',
        phase: OrchestratorPhase.EXECUTION, // Default to execution phase
        message: `Max retries (${this.config.maxRetries}) exceeded for ${toolName}. Switching to fallback LLM (gpt-4o).`,
        timestamp: new Date().toISOString(),
        metadata: { toolName, attempt, error, fallback: true }
      };
    }

    const guardrailMessage: GuardrailMessage = {
      type: 'retry',
      phase: OrchestratorPhase.EXECUTION,
      message: `${toolName} failed (attempt ${attempt}/${this.config.maxRetries}). Retrying with same model...`,
      timestamp: new Date().toISOString(),
      metadata: { toolName, attempt, error, fallback: false }
    };

    this.guardrailMessages.push(guardrailMessage);
    return guardrailMessage;
  }

  /**
   * Get all guardrail messages
   */
  getGuardrailMessages(): GuardrailMessage[] {
    return [...this.guardrailMessages];
  }

  /**
   * Get transition history
   */
  getTransitionHistory(): PhaseTransition[] {
    return [...this.transitionHistory];
  }

  /**
   * Clear all messages and history (useful for testing)
   */
  clear(): void {
    this.guardrailMessages = [];
    this.transitionHistory = [];
  }

  /**
   * Get current phase from transition history
   */
  getCurrentPhase(): OrchestratorPhase | null {
    if (this.transitionHistory.length === 0) {
      return null;
    }
    return this.transitionHistory[this.transitionHistory.length - 1].to;
  }

  /**
   * Generate guardrail message after sub-agent calls
   */
  generateSubAgentGuardrail(agentName: string, phase: OrchestratorPhase, result: any): GuardrailMessage | null {
    if (!this.config.enabled || !this.config.toolCallValidation) {
      return null;
    }

    // Sub-agent specific guardrails
    const subAgentGuardrails: Record<string, string> = {
      'pk-debugger': 'After debugger analysis: Use read_files to examine the source files mentioned in the stack trace for context and understanding.',
      'pk-planner': 'After strategic planning: Use search_codebase or read_files to gather architectural context for the revised plan.'
    };

    const message = subAgentGuardrails[agentName];
    if (!message) {
      return null;
    }

    const guardrailMessage: GuardrailMessage = {
      type: 'tool_call',
      phase,
      message,
      timestamp: new Date().toISOString(),
      metadata: {
        agentName,
        result: result ? { success: !!result.success, output: result.output } : null
      }
    };

    this.guardrailMessages.push(guardrailMessage);
    return guardrailMessage;
  }

  /**
   * Generate validation message for phase outputs
   */
  generateValidationMessage(phase: OrchestratorPhase, output: any): GuardrailMessage | null {
    if (!this.config.enabled) {
      return null;
    }

    let validationMessage: string | null = null;

    switch (phase) {
      case OrchestratorPhase.PARETO:
        if (!output?.pareto || !Array.isArray(output.pareto)) {
          validationMessage = "Pareto phase output invalid: Must contain YAML block with 'pareto' array.";
        } else if (output.pareto.length > 5) {
          validationMessage = "Pareto phase validation: Exceeded limit of 5 files. Focus on most critical.";
        } else {
          validationMessage = `Pareto phase validated: ${output.pareto.length} critical files identified.`;
        }
        break;

      case OrchestratorPhase.STRATEGIC:
        if (!output?.plan?.proceed || output.plan.proceed !== '### PROCEED TO EXECUTION') {
          validationMessage = "Strategic phase validation: Must end with '### PROCEED TO EXECUTION'.";
        } else if (output.tokenCount > 350) {
          validationMessage = "Strategic phase validation: Exceeded 350 token limit. Consider condensing.";
        } else {
          validationMessage = "Strategic phase validated: Plan complete and ready for execution.";
        }
        break;

      case OrchestratorPhase.EXECUTION:
        if (!output?.steps || !Array.isArray(output.steps)) {
          validationMessage = "Execution phase validation: Must contain steps with Thought→Action→Observation.";
        } else {
          const hasThoughtActionObs = output.steps.every((step: any) => 
            step.thought && step.action && step.observation
          );
          if (!hasThoughtActionObs) {
            validationMessage = "Execution phase validation: Each step must have thought, action, and observation.";
          } else {
            validationMessage = `Execution phase validated: ${output.steps.length} steps completed.`;
          }
        }
        break;

      default:
        return null;
    }

    if (!validationMessage) {
      return null;
    }

    const guardrailMessage: GuardrailMessage = {
      type: 'validation',
      phase,
      message: validationMessage,
      timestamp: new Date().toISOString(),
      metadata: { output }
    };

    this.guardrailMessages.push(guardrailMessage);
    return guardrailMessage;
  }
}

/**
 * Factory function to create GuardrailManager from config
 */
export function createGuardrailManager(config: GuardrailConfig): GuardrailManager {
  return new GuardrailManager(config);
}
