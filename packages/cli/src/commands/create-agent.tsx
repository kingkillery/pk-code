/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { render, Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const providers = [
  { label: 'Gemini', value: 'gemini' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'OpenRouter', value: 'openrouter' },
  { label: 'Cohere', value: 'cohere' },
];

const models = {
  gemini: [
    { label: 'Gemini 2.0 Flash Exp', value: 'gemini-2.0-flash-exp' },
    { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
    { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
  ],
  openai: [
    { label: 'GPT-4o', value: 'gpt-4o' },
    { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
    { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
  ],
  anthropic: [
    { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
    { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-20241022' },
    { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
  ],
  openrouter: [
    { label: 'Qwen 3 32B', value: 'qwen/qwen3-32b' },
    { label: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
    { label: 'GPT-4o', value: 'openai/gpt-4o' },
  ],
  cohere: [
    { label: 'Command R+', value: 'command-r-plus' },
    { label: 'Command R', value: 'command-r' },
  ],
};

const availableTools = [
  { label: 'File System', value: 'file-system' },
  { label: 'Search Codebase', value: 'search-codebase' },
  { label: 'Web Search', value: 'web-search' },
  { label: 'Shell Commands', value: 'shell' },
  { label: 'Memory Tool', value: 'memory' },
];

interface AgentConfig {
  name: string;
  description: string;
  keywords: string[];
  tools: string[];
  model: string;
  provider: string;
  temperature: number;
  maxTokens: number;
  examples: Array<{
    input: string;
    output: string;
    description: string;
  }>;
  instructions: string;
  reviewAreas?: string[];
}

const CreateAgent = () => {
  const [step, setStep] = useState<
    | 'name'
    | 'description'
    | 'keywords'
    | 'provider'
    | 'model'
    | 'tools'
    | 'temperature'
    | 'maxTokens'
    | 'instructions'
    | 'examples'
    | 'review'
    | 'save'
  >('name');

  const [config, setConfig] = useState<AgentConfig>({
    name: '',
    description: '',
    keywords: [],
    tools: [],
    model: '',
    provider: '',
    temperature: 0.3,
    maxTokens: 4000,
    examples: [],
    instructions: '',
  });

  const [currentInput, setCurrentInput] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [exampleField, setExampleField] = useState<
    'input' | 'output' | 'description'
  >('input');

  const handleNext = () => {
    switch (step) {
      case 'name': {
        if (!currentInput.trim()) return;
        setConfig((prev) => ({ ...prev, name: currentInput.trim() }));
        setCurrentInput('');
        setStep('description');
        break;
      }
      case 'description': {
        if (!currentInput.trim()) return;
        setConfig((prev) => ({ ...prev, description: currentInput.trim() }));
        setCurrentInput('');
        setStep('keywords');
        break;
      }
      case 'keywords': {
        if (!currentInput.trim()) return;
        const keywords = currentInput
          .split(',')
          .map((k) => k.trim())
          .filter((k) => k);
        setConfig((prev) => ({ ...prev, keywords }));
        setCurrentInput('');
        setStep('provider');
        break;
      }
      case 'provider': {
        setStep('model');
        break;
      }
      case 'model': {
        setStep('tools');
        break;
      }
      case 'tools': {
        setConfig((prev) => ({ ...prev, tools: selectedTools }));
        setStep('temperature');
        break;
      }
      case 'temperature': {
        const temp = parseFloat(currentInput);
        if (isNaN(temp) || temp < 0 || temp > 1) return;
        setConfig((prev) => ({ ...prev, temperature: temp }));
        setCurrentInput('');
        setStep('maxTokens');
        break;
      }
      case 'maxTokens': {
        const tokens = parseInt(currentInput, 10);
        if (isNaN(tokens) || tokens < 100 || tokens > 10000) return;
        setConfig((prev) => ({ ...prev, maxTokens: tokens }));
        setCurrentInput('');
        setStep('instructions');
        break;
      }
      case 'instructions': {
        if (!currentInput.trim()) return;
        setConfig((prev) => ({ ...prev, instructions: currentInput.trim() }));
        setCurrentInput('');
        setStep('examples');
        break;
      }
      case 'examples': {
        setStep('review');
        break;
      }
      case 'review': {
        setStep('save');
        break;
      }
      default: {
        // Handle unexpected step values
        break;
      }
    }
  };

  const handleProviderSelect = (item: { label: string; value: string }) => {
    setSelectedProvider(item.value);
    setConfig((prev) => ({ ...prev, provider: item.value }));
    handleNext();
  };

  const handleModelSelect = (item: { label: string; value: string }) => {
    setConfig((prev) => ({ ...prev, model: item.value }));
    handleNext();
  };

  const handleToolSelect = (item: { label: string; value: string }) => {
    const newTools = selectedTools.includes(item.value)
      ? selectedTools.filter((t) => t !== item.value)
      : [...selectedTools, item.value];
    setSelectedTools(newTools);
  };

  const addExample = () => {
    const newExample = { input: '', output: '', description: '' };
    setConfig((prev) => ({
      ...prev,
      examples: [...prev.examples, newExample],
    }));
    setExampleIndex(config.examples.length);
    setExampleField('input');
    setCurrentInput('');
  };

  const updateExample = () => {
    if (!currentInput.trim()) return;
    const updatedExamples = [...config.examples];
    updatedExamples[exampleIndex] = {
      ...updatedExamples[exampleIndex],
      [exampleField]: currentInput.trim(),
    };
    setConfig((prev) => ({ ...prev, examples: updatedExamples }));
    setCurrentInput('');

    if (exampleField === 'input') {
      setExampleField('output');
    } else if (exampleField === 'output') {
      setExampleField('description');
    } else {
      // Move to next example or finish
      if (exampleIndex < config.examples.length - 1) {
        setExampleIndex(exampleIndex + 1);
        setExampleField('input');
      } else {
        handleNext();
      }
    }
  };

  const saveAgent = () => {
    const agentsDir = join(process.cwd(), '.pk', 'agents');
    if (!existsSync(agentsDir)) {
      mkdirSync(agentsDir, { recursive: true });
    }

    const filename = `${config.name}.md`;
    const filepath = join(agentsDir, filename);

    const yamlFrontMatter = `---
name: ${config.name}
description: ${config.description}
keywords:
${config.keywords.map((k) => `  - ${k}`).join('\n')}
tools:
${config.tools.map((t) => `  - name: ${t}`).join('\n')}
model: ${config.model}
provider: ${config.provider}
temperature: ${config.temperature}
maxTokens: ${config.maxTokens}
${
  config.examples.length > 0
    ? `examples:
${config.examples
  .map(
    (ex) => `  - input: "${ex.input}"
    output: "${ex.output}"
    description: "${ex.description}"`,
  )
  .join('\n')}`
    : ''
}
---`;

    const markdownContent = `
# ${config.name.charAt(0).toUpperCase() + config.name.slice(1)} Agent

${config.instructions}

## Instructions

- Stay focused on your designated role and responsibilities
- Provide clear, actionable guidance
- Use the available tools effectively to accomplish tasks
- Maintain a helpful and professional demeanor

## Available Tools

${config.tools.map((tool) => `- **${tool}**: Use this tool for relevant operations`).join('\n')}

${
  config.examples.length > 0
    ? `## Examples

${config.examples
  .map(
    (ex, i) => `### Example ${i + 1}
**Input**: "${ex.input}"
**Output**: "${ex.output}"
**Description**: ${ex.description}`,
  )
  .join('\n\n')}`
    : ''
}`;

    const fullContent = yamlFrontMatter + markdownContent;

    try {
      writeFileSync(filepath, fullContent, 'utf8');
      console.log(
        `\n✅ Agent '${config.name}' created successfully at: ${filepath}`,
      );
      console.log(
        `\n🚀 You can now use it with: pk use ${config.name} "<your query>"`,
      );
      process.exit(0);
    } catch (error) {
      console.error('❌ Error saving agent:', error);
      process.exit(1);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'name':
        return (
          <Box flexDirection="column">
            <Text color="cyan">🤖 Create New Agent</Text>
            <Text>
              {'\n'}Enter agent name (e.g., &quot;code-reviewer&quot;,
              &quot;debug-detective&quot;):
            </Text>
            <TextInput
              value={currentInput}
              onChange={setCurrentInput}
              onSubmit={handleNext}
            />
          </Box>
        );

      case 'description':
        return (
          <Box flexDirection="column">
            <Text color="green">Agent: {config.name}</Text>
            <Text>
              {'\n'}Enter a brief description of what this agent does:
            </Text>
            <TextInput
              value={currentInput}
              onChange={setCurrentInput}
              onSubmit={handleNext}
            />
          </Box>
        );

      case 'keywords':
        return (
          <Box flexDirection="column">
            <Text color="green">Agent: {config.name}</Text>
            <Text>Description: {config.description}</Text>
            <Text>
              {'\n'}Enter keywords (comma-separated, e.g.,
              &quot;review,code,quality&quot;):
            </Text>
            <TextInput
              value={currentInput}
              onChange={setCurrentInput}
              onSubmit={handleNext}
            />
          </Box>
        );

      case 'provider':
        return (
          <Box flexDirection="column">
            <Text color="green">Agent: {config.name}</Text>
            <Text>{'\n'}Select AI provider:</Text>
            <SelectInput items={providers} onSelect={handleProviderSelect} />
          </Box>
        );

      case 'model':
        return (
          <Box flexDirection="column">
            <Text color="green">Agent: {config.name}</Text>
            <Text>Provider: {config.provider}</Text>
            <Text>{'\n'}Select model:</Text>
            <SelectInput
              items={models[selectedProvider as keyof typeof models] || []}
              onSelect={handleModelSelect}
            />
          </Box>
        );

      case 'tools':
        return (
          <Box flexDirection="column">
            <Text color="green">Agent: {config.name}</Text>
            <Text>Model: {config.model}</Text>
            <Text>
              {'\n'}Select tools (space to toggle, enter to continue):
            </Text>
            <Text color="gray">
              Selected: {selectedTools.join(', ') || 'none'}
            </Text>
            <SelectInput items={availableTools} onSelect={handleToolSelect} />
            <Text>{'\n'}Press Enter to continue with selected tools</Text>
            <TextInput value="" onChange={() => {}} onSubmit={handleNext} />
          </Box>
        );

      case 'temperature':
        return (
          <Box flexDirection="column">
            <Text color="green">Agent: {config.name}</Text>
            <Text>Tools: {config.tools.join(', ')}</Text>
            <Text>{'\n'}Enter temperature (0.0-1.0, default 0.3):</Text>
            <TextInput
              value={currentInput}
              onChange={setCurrentInput}
              onSubmit={handleNext}
              placeholder="0.3"
            />
          </Box>
        );

      case 'maxTokens':
        return (
          <Box flexDirection="column">
            <Text color="green">Agent: {config.name}</Text>
            <Text>Temperature: {config.temperature}</Text>
            <Text>{'\n'}Enter max tokens (100-10000, default 4000):</Text>
            <TextInput
              value={currentInput}
              onChange={setCurrentInput}
              onSubmit={handleNext}
              placeholder="4000"
            />
          </Box>
        );

      case 'instructions':
        return (
          <Box flexDirection="column">
            <Text color="green">Agent: {config.name}</Text>
            <Text>Max Tokens: {config.maxTokens}</Text>
            <Text>{'\n'}Enter detailed instructions for the agent:</Text>
            <TextInput
              value={currentInput}
              onChange={setCurrentInput}
              onSubmit={handleNext}
            />
          </Box>
        );

      case 'examples':
        return (
          <Box flexDirection="column">
            <Text color="green">Agent: {config.name}</Text>
            <Text>Examples: {config.examples.length}</Text>
            <Text>{'\n'}Add examples? (optional)</Text>
            <Text color="gray">Current examples: {config.examples.length}</Text>

            {config.examples.length === 0 ? (
              <Box flexDirection="column">
                <Text>
                  Press &apos;a&apos; to add an example, or Enter to skip:
                </Text>
                <TextInput
                  value={currentInput}
                  onChange={setCurrentInput}
                  onSubmit={(value) => {
                    if (value === 'a') {
                      addExample();
                    } else {
                      handleNext();
                    }
                  }}
                />
              </Box>
            ) : (
              <Box flexDirection="column">
                <Text>
                  Enter {exampleField} for example {exampleIndex + 1}:
                </Text>
                <TextInput
                  value={currentInput}
                  onChange={setCurrentInput}
                  onSubmit={updateExample}
                />
                <Text color="gray">
                  Press &apos;a&apos; to add another example after this one
                </Text>
              </Box>
            )}
          </Box>
        );

      case 'review':
        return (
          <Box flexDirection="column">
            <Text color="cyan">📋 Review Agent Configuration</Text>
            <Text>
              {'\n'}Name: {config.name}
            </Text>
            <Text>Description: {config.description}</Text>
            <Text>Keywords: {config.keywords.join(', ')}</Text>
            <Text>Provider: {config.provider}</Text>
            <Text>Model: {config.model}</Text>
            <Text>Tools: {config.tools.join(', ')}</Text>
            <Text>Temperature: {config.temperature}</Text>
            <Text>Max Tokens: {config.maxTokens}</Text>
            <Text>Examples: {config.examples.length}</Text>
            <Text>{'\n'}Press Enter to save, or Ctrl+C to cancel:</Text>
            <TextInput value="" onChange={() => {}} onSubmit={handleNext} />
          </Box>
        );

      case 'save':
        saveAgent();
        return (
          <Box flexDirection="column">
            <Text color="green">💾 Saving agent...</Text>
          </Box>
        );

      default:
        return <Text>Unknown step</Text>;
    }
  };

  return renderStep();
};

export const handleCreateAgentCommand = () => {
  render(<CreateAgent />);
};
