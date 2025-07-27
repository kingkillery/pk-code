/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { render, Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { setCredential } from '@qwen-code/core';

const providers = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Gemini', value: 'gemini' },
  { label: 'OpenRouter', value: 'openrouter' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Cohere', value: 'cohere' },
];

const Init = () => {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');

  const handleSelect = (item: { label: string; value: string }) => {
    setSelectedProvider(item.value);
  };

  const handleSubmit = async () => {
    if (selectedProvider && apiKey) {
      await setCredential(selectedProvider, apiKey);
      console.log(`Credential for ${selectedProvider} has been added.`);
      process.exit(0);
    }
  };

  return (
    <Box flexDirection="column">
      {!selectedProvider ? (
        <>
          <Text>Select a provider to configure:</Text>
          <SelectInput items={providers} onSelect={handleSelect} />
        </>
      ) : (
        <>
          <Text>Enter API key for {selectedProvider}:</Text>
          <TextInput value={apiKey} onChange={setApiKey} onSubmit={handleSubmit} />
        </>
      )}
    </Box>
  );
};

export const handleInitCommand = () => {
  render(<Init />);
};
