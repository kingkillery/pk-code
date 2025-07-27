/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { useTextBuffer } from './shared/text-buffer.js';
import { useKeypress } from '../hooks/useKeypress.js';
import chalk from 'chalk';

export interface AgentCreationData {
  name: string;
  description: string;
  keywords: string[];
  domain: string;
  tools: string;
  model: string;
  provider: string;
  generatePrompt: boolean;
}

interface InteractiveAgentCreatorProps {
  onComplete: (data: AgentCreationData) => void;
  onCancel: () => void;
}

type Step =
  | 'name'
  | 'description'
  | 'keywords'
  | 'domain'
  | 'tools'
  | 'model'
  | 'provider'
  | 'generatePrompt'
  | 'confirm';

const STEPS: Step[] = [
  'name',
  'description',
  'keywords',
  'domain',
  'tools',
  'model',
  'provider',
  'generatePrompt',
  'confirm',
];

const STEP_LABELS: Record<Step, string> = {
  name: 'Agent Name',
  description: 'What should this agent do?',
  keywords: 'Keywords (comma-separated)',
  domain: 'Domain',
  tools: 'Tools',
  model: 'Model',
  provider: 'Provider',
  generatePrompt: 'Generate Enhanced Prompt?',
  confirm: 'Confirm Creation',
};

const STEP_PROMPTS: Record<Step, string> = {
  name: 'Enter a name for your agent (e.g., "code-reviewer", "bug-hunter"):',
  description:
    'Describe what this agent should do (you can paste a large prompt here):',
  keywords: 'Enter keywords that will trigger this agent (comma-separated):',
  domain:
    'Select a domain (coding, review, debugging, creative, testing, analysis, general):',
  tools: 'Specify tools (comma-separated, or "all" for all tools):',
  model: 'Enter the model to use:',
  provider: 'Enter the provider:',
  generatePrompt: 'Generate an enhanced AI prompt? (y/n):',
  confirm: 'Create this agent?',
};

const DEFAULT_VALUES: Partial<Record<Step, string>> = {
  domain: 'general',
  tools: 'all',
  model: 'qwen/qwen3-235b-a22b',
  provider: 'openrouter',
};

export const InteractiveAgentCreator: React.FC<
  InteractiveAgentCreatorProps
> = ({ onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState<Step>('name');
  const [data, setData] = useState<Partial<AgentCreationData>>({});
  const inputBuffer = useTextBuffer({
    viewport: { width: 80, height: 20 },
    isValidPath: () => false,
  });
  const [_isConfirming, _setIsConfirming] = useState(false);

  const currentStepIndex = STEPS.indexOf(currentStep);
  const _isLastStep = currentStepIndex === STEPS.length - 1;

  // Initialize input with default value if available
  useEffect(() => {
    const defaultValue = DEFAULT_VALUES[currentStep];
    if (defaultValue && !data[currentStep as keyof AgentCreationData]) {
      inputBuffer.setText(defaultValue);
    } else {
      inputBuffer.setText('');
    }
  }, [currentStep, inputBuffer, data]);

  const handleNext = useCallback(() => {
    const value = inputBuffer.text.trim();

    if (currentStep === 'confirm') {
      if (value.toLowerCase() === 'y' || value.toLowerCase() === 'yes') {
        // Create the final data object
        const finalData: AgentCreationData = {
          name: data.name || '',
          description: data.description || '',
          keywords: data.keywords || [],
          domain: data.domain || 'general',
          tools: data.tools || 'all',
          model: data.model || 'qwen/qwen3-235b-a22b',
          provider: data.provider || 'openrouter',
          generatePrompt: data.generatePrompt || false,
        };
        onComplete(finalData);
        return;
      } else {
        onCancel();
        return;
      }
    }

    // Validate and process input based on current step
    let processedValue: unknown = value;

    switch (currentStep) {
      case 'name':
        if (!value) {
          inputBuffer.setText(''); // Clear invalid input
          return;
        }
        break;
      case 'description':
        if (!value) {
          inputBuffer.setText(''); // Clear invalid input
          return;
        }
        // Handle large pasted content - detect if it looks like an agent prompt
        if (value.includes('***') || value.includes('---')) {
          // This might be a pre-formatted agent prompt, let's extract parts
          const lines = value.split('\n');
          let extractedName = '';
          let extractedDescription = '';
          let cleanPrompt = value;

          // Look for name and description in the first few lines
          for (let i = 0; i < Math.min(5, lines.length); i++) {
            const line = lines[i].toLowerCase();
            if (line.includes('name:') && !extractedName) {
              extractedName = lines[i].split(':')[1]?.trim() || '';
            }
            if (line.includes('description:') && !extractedDescription) {
              extractedDescription = lines[i].split(':')[1]?.trim() || '';
            }
          }

          // If we found a name and current name is empty, suggest using it
          if (extractedName && !data.name) {
            setData((prev) => ({ ...prev, name: extractedName }));
          }

          // Clean up the prompt by removing the frontmatter-like content
          cleanPrompt = value
            .replace(/\*\*\*.*?\*\*\*/gs, '')
            .replace(/---.*?---/gs, '')
            .trim();
          processedValue = cleanPrompt || value;
        }
        break;
      case 'keywords':
        if (!value) {
          inputBuffer.setText(''); // Clear invalid input
          return;
        }
        processedValue = value
          .split(',')
          .map((k: string) => k.trim())
          .filter((k: string) => k);
        break;
      case 'generatePrompt':
        processedValue =
          value.toLowerCase() === 'y' || value.toLowerCase() === 'yes';
        break;
      default:
        // For other steps (domain, tools, model, provider, confirm), use value as is
        processedValue = value;
        break;
    }

    // Update data
    setData((prev) => ({ ...prev, [currentStep]: processedValue }));

    // Move to next step
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentStepIndex + 1]);
    }
  }, [currentStep, currentStepIndex, inputBuffer, data, onComplete, onCancel]);

  const handlePrevious = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStep(STEPS[currentStepIndex - 1]);
    }
  }, [currentStepIndex]);

  const handleInput = useCallback(
    (key: {
      name: string;
      ctrl: boolean;
      meta: boolean;
      shift: boolean;
      paste: boolean;
      sequence: string;
    }) => {
      if (key.name === 'return' && !key.ctrl && !key.meta) {
        handleNext();
        return;
      }

      if (key.name === 'escape') {
        onCancel();
        return;
      }

      if (key.ctrl && key.name === 'c') {
        onCancel();
        return;
      }

      // Allow going back with Ctrl+P or Up arrow (except on first step)
      if (
        (key.ctrl && key.name === 'p') ||
        (key.name === 'up' && inputBuffer.text === '')
      ) {
        if (currentStepIndex > 0) {
          handlePrevious();
          return;
        }
      }

      // Handle regular text input
      inputBuffer.handleInput(key);
    },
    [handleNext, handlePrevious, currentStepIndex, inputBuffer, onCancel],
  );

  useKeypress(handleInput, { isActive: true });

  const renderProgressBar = () => {
    const progress = ((currentStepIndex + 1) / STEPS.length) * 100;
    const filledWidth = Math.floor((progress / 100) * 40);
    const emptyWidth = 40 - filledWidth;

    return (
      <Box marginY={1}>
        <Text color={Colors.AccentBlue}>
          Progress: [{'█'.repeat(filledWidth)}
          {'░'.repeat(emptyWidth)}] {Math.round(progress)}%
        </Text>
      </Box>
    );
  };

  const renderCurrentData = () => {
    const entries = Object.entries(data).filter(
      ([_, value]) => value !== undefined && value !== '',
    );
    if (entries.length === 0) return null;

    return (
      <Box flexDirection="column" marginY={1}>
        <Text color={Colors.AccentPurple}>Current Configuration:</Text>
        {entries.map(([key, value]) => (
          <Text key={key} color={Colors.Gray}>
            • {key}: {Array.isArray(value) ? value.join(', ') : String(value)}
          </Text>
        ))}
      </Box>
    );
  };

  const renderConfirmation = () => {
    if (currentStep !== 'confirm') return null;

    const suggestedFileName = data.name
      ? `${data.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`
      : 'new-agent.md';

    return (
      <Box flexDirection="column" marginY={1}>
        <Text color={Colors.AccentGreen}>Ready to create agent:</Text>
        <Text color={Colors.Foreground}>Name: {data.name}</Text>
        <Text color={Colors.Foreground}>
          Description: {data.description?.substring(0, 100)}
          {(data.description?.length || 0) > 100 ? '...' : ''}
        </Text>
        <Text color={Colors.Foreground}>
          Keywords:{' '}
          {Array.isArray(data.keywords)
            ? data.keywords.join(', ')
            : data.keywords}
        </Text>
        <Text color={Colors.Foreground}>Domain: {data.domain}</Text>
        <Text color={Colors.Foreground}>Tools: {data.tools}</Text>
        <Text color={Colors.Foreground}>
          Model: {data.model} ({data.provider})
        </Text>
        <Text color={Colors.Foreground}>
          Enhanced Prompt: {data.generatePrompt ? 'Yes' : 'No'}
        </Text>
        <Text color={Colors.AccentYellow}>
          File: .pk/agents/{suggestedFileName}
        </Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      <Box marginY={1}>
        <Text color={Colors.AccentBlue} bold>
          🤖 Interactive Agent Creator
        </Text>
      </Box>

      {renderProgressBar()}

      <Box marginY={1}>
        <Text color={Colors.AccentPurple} bold>
          {STEP_LABELS[currentStep]} ({currentStepIndex + 1}/{STEPS.length})
        </Text>
      </Box>

      <Box marginY={1}>
        <Text color={Colors.Foreground}>{STEP_PROMPTS[currentStep]}</Text>
      </Box>

      {renderConfirmation()}

      <Box
        borderStyle="round"
        borderColor={Colors.AccentBlue}
        paddingX={1}
        marginY={1}
      >
        <Text color={Colors.AccentPurple}>{'> '}</Text>
        <Box flexGrow={1}>
          <Text>
            {inputBuffer.text}
            {chalk.inverse(' ')}
          </Text>
        </Box>
      </Box>

      {renderCurrentData()}

      <Box marginY={1}>
        <Text color={Colors.Gray}>
          Press Enter to continue • Ctrl+P/↑ to go back • Esc to cancel
        </Text>
      </Box>
    </Box>
  );
};
