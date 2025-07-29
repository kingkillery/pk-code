/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Command,
  CommandContext,
  MessageActionReturn,
  OpenDialogActionReturn,
} from './types.js';
import {
  AgentConfig,
  createPromptGenerator,
  PromptGenerationRequest,
} from '@pk-code/core';
import fs from 'fs/promises';
import path from 'path';
import { load as yamlLoad } from 'js-yaml';
import {
  getDefaultAgentProvider,
  DEFAULT_OPENROUTER_MODEL,
} from '../../utils/providerUtils.js';

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

/**
 * Get the agents directory path
 */
export const getAgentsDir = (projectRoot: string): string =>
  path.join(projectRoot, '.pk', 'agents');

/**
 * Ensure agents directory exists
 */
export const ensureAgentsDir = async (projectRoot: string): Promise<string> => {
  const agentsDir = getAgentsDir(projectRoot);
  await fs.mkdir(agentsDir, { recursive: true });
  return agentsDir;
};

/**
 * Auto-format YAML frontmatter using LLM when parsing fails
 */
const autoFormatYamlFrontmatter = async (
  yamlContent: string,
  filePath: string,
): Promise<string> => {
  try {
    console.warn(`Attempting to auto-format malformed YAML in ${filePath}...`);

    const aiProvider = await getDefaultAgentProvider();
    if (!aiProvider) {
      throw new Error('No AI provider available for YAML formatting');
    }

    const prompt = `You are a YAML formatting expert. Fix the following malformed YAML frontmatter for an agent configuration file. The YAML should be valid and properly formatted with correct indentation. Preserve all the original content but fix syntax issues like improper line breaks, missing quotes, or bad indentation.\n\nOriginal malformed YAML:\n\`\`\`yaml\n${yamlContent}\n\`\`\`\n\nReturn ONLY the corrected YAML content (without the \`\`\`yaml wrapper), properly formatted and ready to parse. The YAML should include fields like name, description, color, etc.`;

    const fixedYaml = await aiProvider.generateCode(prompt, {
      model: DEFAULT_OPENROUTER_MODEL,
    });
    const fixedYamlTrimmed = fixedYaml.trim();

    // Test if the fixed YAML can be parsed
    try {
      yamlLoad(fixedYamlTrimmed);
      console.log(`✅ Successfully auto-formatted YAML in ${filePath}`);
      return fixedYamlTrimmed;
    } catch (testError) {
      console.error(
        `❌ Auto-formatted YAML still invalid in ${filePath}:`,
        testError,
      );
      throw new Error('Auto-formatting failed to produce valid YAML');
    }
  } catch (error) {
    console.error(`❌ Failed to auto-format YAML in ${filePath}:`, error);
    throw error;
  }
};

/**
 * Write the corrected YAML back to the file
 */
const writeFixedYamlToFile = async (
  filePath: string,
  originalContent: string,
  fixedYaml: string,
): Promise<void> => {
  try {
    const frontMatterMatch = originalContent.match(/^---\n([\s\S]*?)\n---/);
    if (!frontMatterMatch) {
      throw new Error('Could not find YAML frontmatter to replace');
    }

    const markdownContent = originalContent.substring(
      frontMatterMatch[0].length,
    );
    const newContent = `---\n${fixedYaml}\n---${markdownContent}`;

    await fs.writeFile(filePath, newContent, 'utf-8');
    console.log(`✅ Updated ${filePath} with corrected YAML frontmatter`);
  } catch (error) {
    console.error(`❌ Failed to write corrected YAML to ${filePath}:`, error);
    throw error;
  }
};

/**
 * Parse agent content from file (supports both JSON and Markdown formats)
 */
export const parseAgentFromFile = async (
  filePath: string,
  content: string,
): Promise<AgentConfig> => {
  if (filePath.endsWith('.json')) {
    // Legacy JSON format
    return JSON.parse(content) as AgentConfig;
  } else {
    // New Markdown format with YAML frontmatter
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontMatterMatch) {
      throw new Error('No YAML front-matter found in agent file');
    }

    const yamlContent = frontMatterMatch[1];
    let parsed;
    let originalYamlContent = yamlContent;
    let currentYamlContent = yamlContent;

    try {
      parsed = yamlLoad(yamlContent);
    } catch (error) {
      try {
        // Attempt to auto-format malformed YAML using LLM
        const fixedYamlTrimmed = await autoFormatYamlFrontmatter(
          yamlContent,
          filePath,
        );
        currentYamlContent = fixedYamlTrimmed;
        parsed = yamlLoad(fixedYamlTrimmed);

        // Write the fixed YAML back to the file so it doesn't happen again
        await writeFixedYamlToFile(filePath, content, fixedYamlTrimmed);
      } catch (formatError) {
        // If auto-formatting fails, throw the original parsing error
        console.error(`Auto-formatting failed for ${filePath}:`, formatError);
        throw new Error(
          `Failed to parse YAML front-matter: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Invalid YAML front-matter in agent file');
    }

    const agent = parsed as AgentConfig;

    // Extract system prompt from markdown content if not already set
    if (!agent.systemPrompt) {
      const markdownContent = content
        .substring(frontMatterMatch[0].length)
        .trim();
      if (markdownContent) {
        agent.systemPrompt = markdownContent;
      }
    }

    return agent;
  }
};

/**
 * Process agent creation data and create the agent file
 */
const _processAgentCreation = async (
  data: AgentCreationData,
  projectRoot: string,
): Promise<MessageActionReturn> => {
  try {
    let finalDescription = data.description;
    let systemPrompt = '';
    let agentColor = 'blue';

    // Generate enhanced prompt if requested
    if (data.generatePrompt) {
      try {
        // Try to get a real AI provider for prompt generation
        const aiProvider = await getDefaultAgentProvider();

        if (aiProvider) {
          // Use real AI generation
          const promptGenerator = createPromptGenerator(aiProvider);
          const request: PromptGenerationRequest = {
            name: data.name,
            description: data.description,
            keywords: data.keywords,
            tools:
              data.tools === 'all'
                ? []
                : data.tools.split(',').map((t) => ({ name: t.trim() })),
            domain: data.domain as
              | 'coding'
              | 'review'
              | 'debugging'
              | 'creative'
              | 'testing'
              | 'analysis',
          };

          const result = await promptGenerator.generateSystemPrompt(request);
          systemPrompt = result.systemPrompt;
          finalDescription = result.enhancedDescription;
          agentColor = result.suggestedColor;
        } else {
          // Fallback to template-based generation
          console.debug(
            'No AI provider available for enhanced prompt generation, using template-based generation',
          );
          generateTemplatePrompt();
        }
      } catch (error) {
        console.debug(
          'AI prompt generation failed, using template fallback:',
          error,
        );
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

      agentColor = domainColorMap[data.domain] || 'blue';

      finalDescription = `Use this agent when you need specialized assistance with ${data.description.toLowerCase()}. Examples: <example>Context: User needs help with ${data.keywords[0]} tasks. user: "Can you help me with ${data.keywords[0]}?" assistant: "I'll use the ${data.name} agent to provide specialized guidance on ${data.keywords[0]} tasks."</example> <example>Context: User has a specific ${data.keywords[1] || data.keywords[0]} challenge. user: "I'm working on ${data.keywords[1] || data.keywords[0]} and need expert advice" assistant: "Let me engage the ${data.name} agent to provide expert assistance with your ${data.keywords[1] || data.keywords[0]} challenge."</example>`;

      systemPrompt = `You are a ${data.name.replace(/-/g, ' ')} specialist, an expert in ${data.keywords.join(', ')}. Your mission is to ${data.description.toLowerCase()}.\n\nWhen working on tasks, you will:\n\n**Phase 1: Analysis**\n- Understand the requirements thoroughly\n- Identify key challenges and constraints\n- Plan your approach systematically\n\n**Phase 2: Implementation**\n- Execute your plan with precision\n- Follow best practices and conventions\n- Maintain high quality standards\n\n**Phase 3: Verification**\n- Review your work for completeness\n- Validate against requirements\n- Ensure reliability and correctness\n\n**Quality Standards:**\n- Provide clear, actionable guidance\n- Use available tools effectively\n- Maintain professional expertise\n- Focus on practical solutions\n\nYour expertise in ${data.keywords.join(', ')} makes you uniquely qualified to deliver exceptional results in this domain.`;
    }

    // Ensure agents directory exists
    const agentsDir = await ensureAgentsDir(projectRoot);

    // Create agent file with .md extension
    const fileName = `${data.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`;
    const filePath = path.join(agentsDir, fileName);

    // Check if agent already exists
    try {
      await fs.access(filePath);
      return {
        type: 'message',
        messageType: 'error',
        content: `Agent "${data.name}" already exists at ${filePath}`,
      };
    } catch {
      // File doesn't exist, which is what we want
    }

    // Create Markdown content with YAML frontmatter
    const yamlFrontmatter = `---\nname: ${data.name}\ndescription: ${finalDescription}\ncolor: ${agentColor}\n---`;

    const markdownContent = systemPrompt
      ? `${yamlFrontmatter}\n\n${systemPrompt}`
      : `${yamlFrontmatter}\n\n# ${data.name}\n\n${data.description}\n\nYou are a specialized AI assistant focused on ${data.keywords.join(', ')}. Your role is to help users with tasks related to these areas.\n\n## Instructions\n\n- Always stay focused on your area of expertise\n- Provide clear, actionable guidance\n- Ask clarifying questions when needed\n- Use the available tools effectively\n\n## Examples\n\n*Add example interactions here to demonstrate your capabilities*\n`;

    // Write agent configuration to file
    await fs.writeFile(filePath, markdownContent);

    return {
      type: 'message',
      messageType: 'info',
      content: `✅ Agent "${data.name}" created successfully at ${filePath}\n\nConfiguration:\n- Description: ${finalDescription.length > 100 ? finalDescription.substring(0, 100) + '...' : finalDescription}\n- Keywords: ${data.keywords.join(', ')}\n- Domain: ${data.domain}\n- Color: ${agentColor}\n- Enhanced Prompt: ${data.generatePrompt ? 'Yes' : 'No'}\n- Tools: ${data.tools}\n- Model: ${data.model} (${data.provider})`,
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `Failed to create agent: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Create agent command - Create agent with command arguments or interactively
 */
const createAgentCommand: Command = {
  name: 'create-agent',
  description:
    'Create a new sub-agent. Usage: /create-agent <name> "<description>" "<keywords>" [domain] [--generate-prompt] [tools] [model] [provider]',
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<MessageActionReturn | OpenDialogActionReturn> => {
    const { services } = context;

    if (!services.config?.getProjectRoot()) {
      return {
        type: 'message',
        messageType: 'error',
        content:
          'No project root found. Please run this command from within a project.',
      };
    }

    const projectRoot = services.config.getProjectRoot();

    // If no arguments provided, launch interactive mode
    if (!args.trim()) {
      return {
        type: 'dialog',
        dialog: 'agent-creation',
      };
    }

    try {
      // Parse arguments - handle quoted strings
      const argParts = [];
      let current = '';
      let inQuotes = false;
      let quoteChar = '';

      for (let i = 0; i < args.length; i++) {
        const char = args[i];
        if ((char === '"' || char === "'") && !inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar && inQuotes) {
          inQuotes = false;
          quoteChar = '';
        } else if (char === ' ' && !inQuotes) {
          if (current.trim()) {
            argParts.push(current.trim());
            current = '';
          }
        } else {
          current += char;
        }
      }
      if (current.trim()) {
        argParts.push(current.trim());
      }

      if (argParts.length < 3) {
        return {
          type: 'message',
          messageType: 'error',
          content:
            'Missing required arguments. Usage: /agent create <name> "<description>" "<keywords>" [domain] [--generate-prompt] [tools] [model] [provider]',
        };
      }

      const name = argParts[0];
      const description = argParts[1];
      const keywordsInput = argParts[2];

      // Check for --generate-prompt flag
      const generatePromptIndex = argParts.indexOf('--generate-prompt');
      const shouldGeneratePrompt = generatePromptIndex !== -1;

      // Remove the flag from args for easier parsing
      const filteredArgs = argParts.filter(
        (arg) => arg !== '--generate-prompt',
      );

      const domain = filteredArgs[3] || 'general';
      const toolsInput = filteredArgs[4] || 'all';
      const model = filteredArgs[5] || DEFAULT_OPENROUTER_MODEL;
      const provider = filteredArgs[6] || 'openrouter';

      const keywords = keywordsInput
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k);
      if (keywords.length === 0) {
        return {
          type: 'message',
          messageType: 'error',
          content: 'At least one keyword is required.',
        };
      }

      const tools =
        toolsInput === 'all'
          ? []
          : toolsInput
              .split(',')
              .map((t) => ({ name: t.trim() }))
              .filter((t) => t.name);

      let finalDescription = description;
      let systemPrompt = '';
      let agentColor = 'blue';

      // Generate enhanced prompt if requested
      if (shouldGeneratePrompt) {
        try {
          // Try to get a real AI provider for prompt generation
          const aiProvider = await getDefaultAgentProvider();

          if (aiProvider) {
            // Use real AI generation
            const promptGenerator = createPromptGenerator(aiProvider);
            const request: PromptGenerationRequest = {
              name,
              description,
              keywords,
              tools: tools.map((t) => ({ name: t.name })),
              domain: domain as
                | 'coding'
                | 'review'
                | 'debugging'
                | 'creative'
                | 'testing'
                | 'analysis',
            };

            const result = await promptGenerator.generateSystemPrompt(request);
            systemPrompt = result.systemPrompt;
            finalDescription = result.enhancedDescription;
            agentColor = result.suggestedColor;
          } else {
            // Fallback to template-based generation
            console.debug(
              'No AI provider available for enhanced prompt generation, using template-based generation',
            );
            generateTemplatePrompt();
          }
        } catch (error) {
          console.debug(
            'AI prompt generation failed, using template fallback:',
            error,
          );
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

        agentColor = domainColorMap[domain] || 'blue';

        finalDescription = `Use this agent when you need specialized assistance with ${description.toLowerCase()}. Examples: <example>Context: User needs help with ${keywords[0]} tasks. user: "Can you help me with ${keywords[0]}?" assistant: "I'll use the ${name} agent to provide specialized guidance on ${keywords[0]} tasks."</example> <example>Context: User has a specific ${keywords[1] || keywords[0]} challenge. user: "I'm working on ${keywords[1] || keywords[0]} and need expert advice" assistant: "Let me engage the ${name} agent to provide expert assistance with your ${keywords[1] || keywords[0]} challenge."</example>`;

        systemPrompt = `You are a ${name.replace(/-/g, ' ')} specialist, an expert in ${keywords.join(', ')}. Your mission is to ${description.toLowerCase()}.\n\nWhen working on tasks, you will:\n\n**Phase 1: Analysis**\n- Understand the requirements thoroughly\n- Identify key challenges and constraints\n- Plan your approach systematically\n\n**Phase 2: Implementation**\n- Execute your plan with precision\n- Follow best practices and conventions\n- Maintain high quality standards\n\n**Phase 3: Verification**\n- Review your work for completeness\n- Validate against requirements\n- Ensure reliability and correctness\n\n**Quality Standards:**\n- Provide clear, actionable guidance\n- Use available tools effectively\n- Maintain professional expertise\n- Focus on practical solutions\n\nYour expertise in ${keywords.join(', ')} makes you uniquely qualified to deliver exceptional results in this domain.`;
      }

      // Create agent configuration for YAML frontmatter
      const _agentConfig: AgentConfig = {
        name,
        description: finalDescription,
        keywords,
        tools,
        model,
        provider,
        examples: [],
      };

      // Ensure agents directory exists
      const agentsDir = await ensureAgentsDir(projectRoot);

      // Create agent file with .md extension
      const fileName = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`;
      const filePath = path.join(agentsDir, fileName);

      // Check if agent already exists
      try {
        await fs.access(filePath);
        return {
          type: 'message',
          messageType: 'error',
          content: `Agent "${name}" already exists at ${filePath}`,
        };
      } catch {
        // File doesn't exist, which is what we want
      }

      // Create Markdown content with YAML frontmatter
      const yamlFrontmatter = `---\nname: ${name}\ndescription: ${finalDescription}\ncolor: ${agentColor}\n---`;

      const markdownContent = systemPrompt
        ? `${yamlFrontmatter}\n\n${systemPrompt}`
        : `${yamlFrontmatter}\n\n# ${name}\n\n${description}\n\nYou are a specialized AI assistant focused on ${keywords.join(', ')}. Your role is to help users with tasks related to these areas.\n\n## Instructions\n\n- Always stay focused on your area of expertise\n- Provide clear, actionable guidance\n- Ask clarifying questions when needed\n- Use the available tools effectively\n\n## Examples\n\n*Add example interactions here to demonstrate your capabilities*\n`;

      // Write agent configuration to file
      await fs.writeFile(filePath, markdownContent);

      return {
        type: 'message',
        messageType: 'info',
        content: `✅ Agent "${name}" created successfully at ${filePath}\n\nConfiguration:\n- Description: ${finalDescription.length > 100 ? finalDescription.substring(0, 100) + '...' : finalDescription}\n- Keywords: ${keywords.join(', ')}\n- Domain: ${domain}\n- Color: ${agentColor}\n- Enhanced Prompt: ${shouldGeneratePrompt ? 'Yes' : 'No'}\n- Tools: ${tools.length === 0 ? 'all' : tools.map((t) => t.name).join(', ')}\n- Model: ${model} (${provider})`,
      };
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Failed to create agent: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * List agents command
 */
const listAgentsCommand: Command = {
  name: 'list-agents',
  altName: 'agents',
  description: 'List all available sub-agents',
  action: async (context: CommandContext): Promise<MessageActionReturn> => {
    const { services } = context;

    if (!services.config?.getProjectRoot()) {
      return {
        type: 'message',
        messageType: 'error',
        content:
          'No project root found. Please run this command from within a project.',
      };
    }

    try {
      const agentsDir = getAgentsDir(services.config.getProjectRoot());

      // Check if agents directory exists
      try {
        await fs.access(agentsDir);
      } catch {
        return {
          type: 'message',
          messageType: 'info',
          content:
            'No agents directory found. Use /agent create to create your first agent.',
        };
      }

      // Read all agent files (both .md and .json for backward compatibility)
      const files = await fs.readdir(agentsDir);
      const agentFiles = files.filter(
        (f) =>
          f.endsWith('.md') || f.endsWith('.markdown') || f.endsWith('.json'),
      );

      if (agentFiles.length === 0) {
        return {
          type: 'message',
          messageType: 'info',
          content:
            'No agents found. Use /agent create to create your first agent.',
        };
      }

      const agents: AgentConfig[] = [];

      for (const file of agentFiles) {
        try {
          const filePath = path.join(agentsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const agent = await parseAgentFromFile(filePath, content);
          agents.push(agent);
        } catch (error) {
          console.warn(`Failed to parse agent file ${file}:`, error);
        }
      }

      if (agents.length === 0) {
        return {
          type: 'message',
          messageType: 'info',
          content: 'No valid agents found.',
        };
      }

      // Format agent list
      let output = `\n🤖 **Available Sub-Agents (${agents.length})**\n\n`;

      for (const agent of agents) {
        output += `**- ${agent.name}**\n`;
      }

      output += '\nFor more details, run \`pk agent show <agent-name>\`';

      return {
        type: 'message',
        messageType: 'info',
        content: output,
      };
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Failed to list agents: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Show agent details command
 */
const showAgentCommand: Command = {
  name: 'show-agent',
  description: 'Show details for a specific sub-agent',
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<MessageActionReturn> => {
    const { services } = context;

    if (!services.config?.getProjectRoot()) {
      return {
        type: 'message',
        messageType: 'error',
        content:
          'No project root found. Please run this command from within a project.',
      };
    }

    const agentName = args.trim();
    if (!agentName) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Usage: /agent show <agent-name>',
      };
    }

    try {
      const agentsDir = getAgentsDir(services.config.getProjectRoot());
      const baseFileName = agentName.toLowerCase().replace(/[^a-z0-9]/g, '-');

      // Try to find the agent file (check both .md and .json extensions)
      const possibleExtensions = ['.md', '.json'];
      let filePath: string | null = null;

      for (const ext of possibleExtensions) {
        const testPath = path.join(agentsDir, baseFileName + ext);
        try {
          await fs.access(testPath);
          filePath = testPath;
          break;
        } catch {
          // File doesn't exist, try next extension
        }
      }

      if (!filePath) {
        return {
          type: 'message',
          messageType: 'error',
          content: `Agent "${agentName}" not found.`,
        };
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const agent = await parseAgentFromFile(filePath, content);

      let output = `\n🤖 **Agent: ${agent.name}**\n\n`;
      output += `  **Description**: ${agent.description || 'No description'}\n`;
      output += `  **Keywords**: ${(agent.keywords || []).join(', ')}\n`;
      output += `  **Model**: ${agent.model || 'default'} (${agent.provider || 'default'})\n`;
      output += `  **Tools**: ${!agent.tools || agent.tools.length === 0 ? 'all' : agent.tools.map((t: any) => t.name).join(', ')}\n`;

      if (agent.systemPrompt) {
        output += `\n---\n**System Prompt**:\n${agent.systemPrompt}\n`;
      }

      return {
        type: 'message',
        messageType: 'info',
        content: output,
      };
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Failed to show agent: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Delete agent command
 */
const deleteAgentCommand: Command = {
  name: 'delete-agent',
  description: 'Delete a sub-agent',
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<MessageActionReturn> => {
    const { services } = context;

    if (!services.config?.getProjectRoot()) {
      return {
        type: 'message',
        messageType: 'error',
        content:
          'No project root found. Please run this command from within a project.',
      };
    }

    const agentName = args.trim();
    if (!agentName) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Usage: /agent delete <agent-name>',
      };
    }

    try {
      const agentsDir = getAgentsDir(services.config.getProjectRoot());
      const baseFileName = agentName.toLowerCase().replace(/[^a-z0-9]/g, '-');

      // Try to find the agent file (check both .md and .json extensions)
      const possibleExtensions = ['.md', '.json'];
      let filePath: string | null = null;

      for (const ext of possibleExtensions) {
        const testPath = path.join(agentsDir, baseFileName + ext);
        try {
          await fs.access(testPath);
          filePath = testPath;
          break;
        } catch {
          // File doesn't exist, try next extension
        }
      }

      if (!filePath) {
        return {
          type: 'message',
          messageType: 'error',
          content: `Agent "${agentName}" not found.`,
        };
      }

      // Delete the agent file
      await fs.unlink(filePath);

      return {
        type: 'message',
        messageType: 'info',
        content: `✅ Agent "${agentName}" deleted successfully.`,
      };
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Failed to delete agent: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * Main agent command with subcommands
 */
export const agentCommand: Command = {
  name: 'agent',
  description: 'Manage sub-agents',
  subCommands: [
    {
      name: 'create',
      description: 'Create a new sub-agent interactively',
      action: createAgentCommand.action,
    },
    {
      name: 'list',
      altName: 'ls',
      description: 'List all available sub-agents',
      action: listAgentsCommand.action,
    },
    {
      name: 'show',
      altName: 'view',
      description: 'Show details for a specific sub-agent',
      action: showAgentCommand.action,
    },
    {
      name: 'delete',
      altName: 'rm',
      description: 'Delete a sub-agent',
      action: deleteAgentCommand.action,
    },
  ],
};

// Only export the hierarchical agent command structure
// Individual commands are now only accessible via /agent subcommands

import { render } from 'ink';
import { MultiAgentRun } from '../components/MultiAgentRun.js';
import { AgentRunner } from '../../agent/AgentRunner.js';
import React from 'react';

/**
 * Run multiple agents in parallel with UI rendering
 */
const runAgents = (runners: AgentRunner[]): void => {
  const { unmount } = render(React.createElement(MultiAgentRun, { runners }));

  // Start all agents in parallel
  Promise.all(runners.map((runner) => runner.run()))
    .then(() => {
      // Wait a moment to show completion, then unmount
      setTimeout(() => {
        unmount();
      }, 2000);
    })
    .catch((error) => {
      console.error('Agent execution failed:', error);
      unmount();
    });
};

export const agentCommands = {
  create: _processAgentCreation,
  run: runAgents,
};
