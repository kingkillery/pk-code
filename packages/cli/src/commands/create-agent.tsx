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
import { createPromptGenerator, PromptGenerationRequest, GeneratedPrompt } from '@pk-code/core';
import { getDefaultAgentProvider } from '../utils/providerUtils.js';

const providers = [
  { label: 'OpenRouter (Recommended)', value: 'openrouter' },
  { label: 'Gemini', value: 'gemini' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
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
    { label: 'Qwen 3 235B (Recommended)', value: 'qwen/qwen3-235b-a22b' },
    { label: 'Qwen 3 32B', value: 'qwen/qwen3-32b' },
    { label: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
    { label: 'GPT-4o', value: 'openai/gpt-4o' },
  ],
  cohere: [
    { label: 'Command R+', value: 'command-r-plus' },
    { label: 'Command R', value: 'command-r' },
  ],
};

const domains = [
  { label: 'Coding & Development', value: 'coding' },
  { label: 'Code Analysis & Review', value: 'analysis' },
  { label: 'Debugging & Troubleshooting', value: 'debugging' },
  { label: 'Quality Assurance & Testing', value: 'testing' },
  { label: 'Code Review & Evaluation', value: 'review' },
  { label: 'Creative & Content', value: 'creative' },
  { label: 'General Purpose', value: 'general' },
];

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
  color?: string;
  enhancedDescription?: string;
}

const CreateAgent = () => {
  const [step, setStep] = useState<
    | 'name'
    | 'description'
    | 'keywords'
    | 'domain'
    | 'generate-prompt'
    | 'review-prompt'
    | 'provider'
    | 'model'
    | 'tools'
    | 'temperature'
    | 'maxTokens'
    | 'examples'
    | 'review'
    | 'save'
  >('name');

  const [config, setConfig] = useState<AgentConfig>({
    name: '',
    description: '',
    keywords: [],
    tools: [],
    model: 'qwen/qwen3-235b-a22b',
    provider: 'openrouter',
    temperature: 0.3,
    maxTokens: 4000,
    examples: [],
    instructions: '',
    color: 'blue',
    enhancedDescription: '',
  });

  const [currentInput, setCurrentInput] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [exampleField, setExampleField] = useState<
    'input' | 'output' | 'description'
  >('input');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState<GeneratedPrompt | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [useGeneratedPrompt, setUseGeneratedPrompt] = useState(true);

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
        setStep('domain');
        break;
      }
      case 'domain': {
        setStep('generate-prompt');
        break;
      }
      case 'generate-prompt': {
        // Will be handled by generatePrompt function
        break;
      }
      case 'review-prompt': {
        if (useGeneratedPrompt && generatedPrompt) {
          setConfig((prev) => ({
            ...prev,
            instructions: generatedPrompt.systemPrompt,
            enhancedDescription: generatedPrompt.enhancedDescription,
            color: generatedPrompt.suggestedColor,
          }));
        }
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

  const handleDomainSelect = (item: { label: string; value: string }) => {
    setSelectedDomain(item.value);
    handleNext();
  };

  const generatePrompt = async () => {
    setIsGenerating(true);
    try {
      // Get a real AI provider for prompt generation
      const aiProvider = await getDefaultAgentProvider();
      
      if (!aiProvider) {
        console.error('No AI provider available for prompt generation. Please configure your API keys.');
        // Fall back to template-based generation
        generateFallbackPrompt();
        return;
      }

      const promptGenerator = createPromptGenerator(aiProvider);
      const request: PromptGenerationRequest = {
        name: config.name,
        description: config.description,
        keywords: config.keywords,
        tools: config.tools.map(t => ({ name: t })),
        domain: selectedDomain as 'coding' | 'review' | 'debugging' | 'creative' | 'testing' | 'analysis',
      };

      const result = await promptGenerator.generateSystemPrompt(request);
      setGeneratedPrompt(result);
      setStep('review-prompt');
    } catch (error) {
      console.error('Failed to generate prompt with AI:', error);
      // Fall back to template-based generation
      generateFallbackPrompt();
    } finally {
      setIsGenerating(false);
    }
  };

  const generateFallbackPrompt = () => {
    // Template-based fallback when AI generation fails
    const systemPrompt = `You are a ${config.name.replace(/-/g, ' ')} specialist, an expert in ${config.keywords.join(', ')}. Your mission is to ${config.description.toLowerCase()}.

When working on tasks, you will:

**Phase 1: Analysis**
- Understand the requirements thoroughly
- Identify key challenges and constraints
- Plan your approach systematically

**Phase 2: Implementation**
- Execute your plan with precision
- Follow best practices and conventions
- Maintain high quality standards

**Phase 3: Verification**
- Review your work for completeness
- Validate against requirements
- Ensure reliability and correctness

**Quality Standards:**
- Provide clear, actionable guidance
- Use available tools effectively
- Maintain professional expertise
- Focus on practical solutions

Your expertise in ${config.keywords.join(', ')} makes you uniquely qualified to deliver exceptional results in this domain.`;

    const enhancedDescription = `Use this agent when you need specialized assistance with ${config.description.toLowerCase()}. Examples: <example>Context: User needs help with ${config.keywords[0]} tasks. user: "Can you help me with ${config.keywords[0]}?" assistant: "I'll use the ${config.name} agent to provide specialized guidance on ${config.keywords[0]} tasks."</example> <example>Context: User has a specific ${config.keywords[1] || config.keywords[0]} challenge. user: "I'm working on ${config.keywords[1] || config.keywords[0]} and need expert advice" assistant: "Let me engage the ${config.name} agent to provide expert assistance with your ${config.keywords[1] || config.keywords[0]} challenge."</example>`;

    const suggestedColor = selectedDomain === 'review' ? 'pink' : selectedDomain === 'debugging' ? 'red' : selectedDomain === 'creative' ? 'green' : 'blue';

    const result: GeneratedPrompt = {
      systemPrompt,
      enhancedDescription,
      suggestedColor,
      confidence: 0.7, // Lower confidence for template-based generation
    };

    setGeneratedPrompt(result);
    setStep('review-prompt');
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

    const description = config.enhancedDescription || config.description;
    const yamlFrontMatter = `---
name: ${config.name}
description: ${description}
color: ${config.color || 'blue'}
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

      case 'domain':
        return (
          <Box flexDirection="column">
            <Text color="green">Agent: {config.name}</Text>
            <Text>Keywords: {config.keywords.join(', ')}</Text>
            <Text>{'\n'}Select the domain for this agent:</Text>
            <SelectInput items={domains} onSelect={handleDomainSelect} />
          </Box>
        );

      case 'generate-prompt':
        return (
          <Box flexDirection="column">
            <Text color="cyan">🤖 AI-Powered Prompt Generation</Text>
            <Text>{'\n'}I can generate a high-quality system prompt based on proven patterns from successful agents.</Text>
            <Text color="gray">This will create a professional prompt tailored to your agent&apos;s purpose.</Text>
            <Text>{'\n'}Generate AI-powered prompt? (y/n):</Text>
            <TextInput
              value={currentInput}
              onChange={setCurrentInput}
              onSubmit={(value) => {
                if (value.toLowerCase() === 'y' || value.toLowerCase() === 'yes') {
                  generatePrompt();
                } else {
                  setStep('provider');
                }
              }}
            />
          </Box>
        );

      case 'review-prompt':
        if (isGenerating) {
          return (
            <Box flexDirection="column">
              <Text color="yellow">🔄 Generating your agent prompt...</Text>
              <Text color="gray">Using Qwen AI to create a professional, high-quality system prompt.</Text>
            </Box>
          );
        }

        return (
          <Box flexDirection="column">
            <Text color="cyan">📝 Generated Prompt Review</Text>
            {generatedPrompt && (
              <Box flexDirection="column">
                <Text>{'\n'}Generation Method: {generatedPrompt.confidence >= 0.8 ? '🤖 AI-Powered' : '📋 Template-Based'}</Text>
                <Text>Color: {generatedPrompt.suggestedColor}</Text>
                <Text>Quality Score: {Math.round(generatedPrompt.confidence * 100)}%</Text>
                <Text color="gray">{'\n'}Description:</Text>
                <Text>{generatedPrompt.enhancedDescription.substring(0, 200)}...</Text>
                <Text color="gray">{'\n'}System Prompt Preview:</Text>
                <Text>{generatedPrompt.systemPrompt.substring(0, 300)}...</Text>
              </Box>
            )}
            <Text>{'\n'}Use this generated prompt? (y/n):</Text>
            <TextInput
              value={currentInput}
              onChange={setCurrentInput}
              onSubmit={(value) => {
                setUseGeneratedPrompt(value.toLowerCase() === 'y' || value.toLowerCase() === 'yes');
                handleNext();
              }}
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
