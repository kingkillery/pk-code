/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  createPromptGenerator,
  PromptGenerationRequest,
} from '@pk-code/core';
import {
  getDefaultAgentProvider,
  DEFAULT_OPENROUTER_MODEL,
} from '../utils/providerUtils.js';

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
    { label: 'Qwen 3 Coder (Free)', value: DEFAULT_OPENROUTER_MODEL },
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

const colors = [
  { label: 'Blue', value: 'blue' },
  { label: 'Green', value: 'green' },
  { label: 'Red', value: 'red' },
  { label: 'Purple', value: 'purple' },
  { label: 'Pink', value: 'pink' },
  { label: 'Orange', value: 'orange' },
  { label: 'Yellow', value: 'yellow' },
  { label: 'Cyan', value: 'cyan' },
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

/**
 * Interactive CLI wizard for creating agents
 */
export async function handleCreateAgentCommandCLI(): Promise<void> {
  console.log('🤖 Interactive Agent Creation Wizard\n');
  
  // Collect agent configuration through interactive prompts
  const config: AgentConfig = {
    name: '',
    description: '',
    keywords: [],
    tools: [],
    model: DEFAULT_OPENROUTER_MODEL,
    provider: 'openrouter',
    temperature: 0.3,
    maxTokens: 4000,
    examples: [],
    instructions: '',
    color: 'blue',
  };

  // Step 1: Agent name
  config.name = await promptUser('Enter agent name (e.g., "code-reviewer", "debug-detective"): ');
  if (!config.name.trim()) {
    console.error('❌ Agent name is required');
    process.exit(1);
  }

  // Step 2: Description
  config.description = await promptUser('Enter a brief description of what this agent does: ');
  if (!config.description.trim()) {
    console.error('❌ Description is required');
    process.exit(1);
  }

  // Step 3: Keywords
  const keywordsInput = await promptUser('Enter keywords (comma-separated, e.g., "review,code,quality"): ');
  config.keywords = keywordsInput
    .split(',')
    .map(k => k.trim())
    .filter(k => k);

  // Step 4: Domain
  console.log('\nSelect the domain for this agent:');
  domains.forEach((domain, index) => {
    console.log(`${index + 1}. ${domain.label}`);
  });
  
  const domainIndex = parseInt(await promptUser('Enter domain number: ')) - 1;
  const selectedDomain = domains[domainIndex] || domains[0]; // Default to first if invalid

  // Step 5: AI-Powered Prompt Generation
  const generatePrompt = await promptUser('Generate AI-powered prompt? (y/n): ');
  let generatedPrompt = null;
  
  if (generatePrompt.toLowerCase() === 'y' || generatePrompt.toLowerCase() === 'yes') {
    try {
      // Try to get a real AI provider for prompt generation
      const aiProvider = await getDefaultAgentProvider();

      if (aiProvider) {
        // Use real AI generation
        const promptGenerator = createPromptGenerator(aiProvider);
        const request: PromptGenerationRequest = {
          name: config.name,
          description: config.description,
          keywords: config.keywords,
          tools: config.tools.map((t) => ({ name: t })),
          domain: selectedDomain.value as any,
        };

        generatedPrompt = await promptGenerator.generateSystemPrompt(request);
        config.instructions = generatedPrompt.systemPrompt;
        config.enhancedDescription = generatedPrompt.enhancedDescription;
        config.color = generatedPrompt.suggestedColor;
      } else {
        console.log('No AI provider available, using template-based generation');
        generateTemplatePrompt();
      }
    } catch (error) {
      console.log('AI prompt generation failed, using template fallback:', error);
      generateTemplatePrompt();
    }
  }

  function generateTemplatePrompt() {
    const domainColorMap: Record<string, string> = {
      review: 'pink',
      debugging: 'red',
      testing: 'pink',
      creative: 'green',
      analysis: 'purple',
      coding: 'blue',
      general: 'blue',
    };

    config.color = domainColorMap[selectedDomain.value] || 'blue';

    config.enhancedDescription = `Use this agent when you need specialized assistance with ${config.description.toLowerCase()}. Examples: <example>Context: User needs help with ${config.keywords[0]} tasks. user: "Can you help me with ${config.keywords[0]}?" assistant: "I'll use the ${config.name} agent to provide specialized guidance on ${config.keywords[0]} tasks."</example> <example>Context: User has a specific ${config.keywords[1] || config.keywords[0]} challenge. user: "I'm working on ${config.keywords[1] || config.keywords[0]} and need expert advice" assistant: "Let me engage the ${config.name} agent to provide expert assistance with your ${config.keywords[1] || config.keywords[0]} challenge."</example>`;

    config.instructions = `You are a ${config.name.replace(/-/g, ' ')} specialist, an expert in ${config.keywords.join(', ')}. Your mission is to ${config.description.toLowerCase()}.

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
  }

  // Step 6: Provider selection
  console.log('\nSelect AI provider:');
  providers.forEach((provider, index) => {
    console.log(`${index + 1}. ${provider.label}`);
  });
  
  const providerIndex = parseInt(await promptUser('Enter provider number: ')) - 1;
  config.provider = providers[providerIndex]?.value || 'openrouter';

  // Step 7: Model selection
  const providerModels = models[config.provider as keyof typeof models] || [];
  if (providerModels.length > 0) {
    console.log(`\nSelect model for ${config.provider}:`);
    providerModels.forEach((model, index) => {
      console.log(`${index + 1}. ${model.label}`);
    });
    
    const modelIndex = parseInt(await promptUser('Enter model number: ')) - 1;
    config.model = providerModels[modelIndex]?.value || DEFAULT_OPENROUTER_MODEL;
  }

  // Step 8: Tool selection
  console.log('\nSelect tools (enter numbers separated by commas, e.g., "1,3,4"):');
  availableTools.forEach((tool, index) => {
    console.log(`${index + 1}. ${tool.label}`);
  });
  
  const toolsInput = await promptUser('Enter tool numbers: ');
  const toolIndices = toolsInput
    .split(',')
    .map(t => parseInt(t.trim()) - 1)
    .filter(i => !isNaN(i) && i >= 0 && i < availableTools.length);
  
  config.tools = toolIndices.map(i => availableTools[i].value);

  // Step 9: Color selection
  console.log('\nSelect agent color:');
  colors.forEach((color, index) => {
    console.log(`${index + 1}. ${color.label}`);
  });
  
  const colorIndex = parseInt(await promptUser('Enter color number: ')) - 1;
  config.color = colors[colorIndex]?.value || 'blue';

  // Step 10: Temperature
  const tempInput = await promptUser('Enter temperature (0.0-1.0, default 0.3): ');
  const temp = parseFloat(tempInput);
  if (!isNaN(temp) && temp >= 0 && temp <= 1) {
    config.temperature = temp;
  }

  // Step 11: Max tokens
  const tokensInput = await promptUser('Enter max tokens (100-10000, default 4000): ');
  const tokens = parseInt(tokensInput);
  if (!isNaN(tokens) && tokens >= 100 && tokens <= 10000) {
    config.maxTokens = tokens;
  }

  // Step 12: Save agent
  saveAgent(config);
}

/**
 * Prompt user for input
 */
function promptUser(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
}

/**
 * Save agent to file
 */
function saveAgent(config: AgentConfig): void {
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

${config.examples.length > 0
    ? `## Examples

${config.examples
  .map(
    (ex, i) => `### Example ${i + 1}
**Input**: "${ex.input}"
**Output**: "${ex.output}"
**Description**: ${ex.description}`,
  )
  .join('\n\n')}`
    : ''}`;

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
}