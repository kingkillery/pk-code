/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';

interface OpenRouterKeyPromptProps {
  onSubmit: (apiKey: string, model: string, provider?: string) => void;
  onCancel: () => void;
}

export function OpenRouterKeyPrompt({
  onSubmit,
  onCancel,
}: OpenRouterKeyPromptProps): React.JSX.Element {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('qwen/qwen-2.5-coder-32b-instruct');
  const [provider, setProvider] = useState('');
  const [currentField, setCurrentField] = useState<'apiKey' | 'model' | 'provider'>(
    'apiKey',
  );

  useInput((input, key) => {
    // Filter paste-related control sequences
    let cleanInput = (input || '')
      .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '') // eslint-disable-line no-control-regex
      .replace(/\[200~/g, '')
      .replace(/\[201~/g, '')
      .replace(/^\[|~$/g, '');

    // Filter invisible characters (ASCII < 32, except carriage return and newline)
    cleanInput = cleanInput
      .split('')
      .filter((ch) => ch.charCodeAt(0) >= 32)
      .join('');

    if (cleanInput.length > 0) {
      if (currentField === 'apiKey') {
        setApiKey((prev) => prev + cleanInput);
      } else if (currentField === 'model') {
        setModel((prev) => prev + cleanInput);
      } else if (currentField === 'provider') {
        setProvider((prev) => prev + cleanInput);
      }
      return;
    }

    // Check if Enter key is pressed
    if (input.includes('\n') || input.includes('\r')) {
      if (currentField === 'apiKey') {
        setCurrentField('model');
        return;
      } else if (currentField === 'model') {
        setCurrentField('provider');
        return;
      } else if (currentField === 'provider') {
        if (apiKey.trim()) {
          onSubmit(apiKey.trim(), model.trim(), provider.trim() || undefined);
        } else {
          setCurrentField('apiKey');
        }
      }
      return;
    }

    if (key.escape) {
      onCancel();
      return;
    }

    // Handle Tab key for field navigation
    if (key.tab) {
      if (currentField === 'apiKey') {
        setCurrentField('model');
      } else if (currentField === 'model') {
        setCurrentField('provider');
      } else if (currentField === 'provider') {
        setCurrentField('apiKey');
      }
      return;
    }

    // Handle arrow keys for field navigation
    if (key.upArrow) {
      if (currentField === 'model') {
        setCurrentField('apiKey');
      } else if (currentField === 'provider') {
        setCurrentField('model');
      }
      return;
    }

    if (key.downArrow) {
      if (currentField === 'apiKey') {
        setCurrentField('model');
      } else if (currentField === 'model') {
        setCurrentField('provider');
      }
      return;
    }

    // Handle backspace
    if (key.backspace || key.delete) {
      if (currentField === 'apiKey') {
        setApiKey((prev) => prev.slice(0, -1));
      } else if (currentField === 'model') {
        setModel((prev) => prev.slice(0, -1));
      } else if (currentField === 'provider') {
        setProvider((prev) => prev.slice(0, -1));
      }
      return;
    }
  });

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.AccentBlue}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color={Colors.AccentBlue}>
        OpenRouter Configuration Required
      </Text>
      <Box marginTop={1}>
        <Text>
          Please enter your OpenRouter configuration. You can get an API key
          from <Text color={Colors.AccentBlue}>https://openrouter.ai/keys</Text>
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box width={12}>
          <Text
            color={currentField === 'apiKey' ? Colors.AccentBlue : Colors.Gray}
          >
            API Key:
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text>
            {currentField === 'apiKey' ? '> ' : '  '}
            {apiKey || ' '}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box width={12}>
          <Text
            color={currentField === 'model' ? Colors.AccentBlue : Colors.Gray}
          >
            Model:
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text>
            {currentField === 'model' ? '> ' : '  '}
            {model}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box width={12}>
          <Text
            color={currentField === 'provider' ? Colors.AccentBlue : Colors.Gray}
          >
            Provider:
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text>
            {currentField === 'provider' ? '> ' : '  '}
            {provider || '(optional - e.g., deepinfra, cerebras, chutes)'}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.Gray}>
          Press Enter to continue, Tab/↑↓ to navigate, Esc to cancel
        </Text>
      </Box>
    </Box>
  );
}
