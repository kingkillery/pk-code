/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Command, CommandContext, MessageActionReturn } from './types.js';
import { AgentConfig, createPromptGenerator, PromptGenerationRequest } from '@pk-code/core';
import fs from 'fs/promises';
import path from 'path';
import { load as yamlLoad } from 'js-yaml';
import { getDefaultAgentProvider } from '../../utils/providerUtils.js';

/**
 * Get the agents directory path
 */
const getAgentsDir = (projectRoot: string): string =>
  path.join(projectRoot, '.pk', 'agents');

/**
 * Ensure agents directory exists
 */
const ensureAgentsDir = async (projectRoot: string): Promise<string> => {
  const agentsDir = getAgentsDir(projectRoot);
  await fs.mkdir(agentsDir, { recursive: true });
  return agentsDir;
};

/**
 * Parse agent content from file (supports both JSON and Markdown formats)
 */
const parseAgentFromFile = async (
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
    const parsed = yamlLoad(yamlContent);

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
 * Create agent command - Create agent with command arguments
 */
const createAgentCommand: Command = {
  name: 'create-agent',
  description:
    'Create a new sub-agent. Usage: /create-agent <name> "<description>" "<keywords>" [domain] [--generate-prompt] [tools] [model] [provider]',
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

    const projectRoot = services.config.getProjectRoot();

    if (!args.trim()) {
      return {
        type: 'message',
        messageType: 'error',
        content:
          'Usage: /agent create <name> "<description>" "<keywords>" [domain] [--generate-prompt] [tools] [model] [provider]\n\nExample: /agent create "code-reviewer" "Reviews code for best practices" "review,code,quality" "review" --generate-prompt "file-system,web-search" "qwen/qwen3-235b-a22b" "openrouter"',
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
      const filteredArgs = argParts.filter(arg => arg !== '--generate-prompt');
      
      const domain = filteredArgs[3] || 'general';
      const toolsInput = filteredArgs[4] || 'all';
      const model = filteredArgs[5] || 'qwen/qwen3-235b-a22b';
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
              tools: tools.map(t => ({ name: t.name })),
              domain: domain as 'coding' | 'review' | 'debugging' | 'creative' | 'testing' | 'analysis',
            };

            const result = await promptGenerator.generateSystemPrompt(request);
            systemPrompt = result.systemPrompt;
            finalDescription = result.enhancedDescription;
            agentColor = result.suggestedColor;
          } else {
            // Fallback to template-based generation
            console.warn('No AI provider available, using template-based generation');
            generateTemplatePrompt();
          }
        } catch (error) {
          console.warn('Failed to generate AI prompt, using template fallback:', error);
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
        
        systemPrompt = `You are a ${name.replace(/-/g, ' ')} specialist, an expert in ${keywords.join(', ')}. Your mission is to ${description.toLowerCase()}.

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

Your expertise in ${keywords.join(', ')} makes you uniquely qualified to deliver exceptional results in this domain.`;
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
        output += `**${agent.name}**\n`;
        output += `  Description: ${agent.description}\n`;
        output += `  Keywords: ${agent.keywords.join(', ')}\n`;
        output += `  Model: ${agent.model} (${agent.provider})\n`;
        output += `  Tools: ${agent.tools.length === 0 ? 'all' : agent.tools.map((t) => t.name).join(', ')}\n\n`;
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
        content: `Failed to list agents: ${error instanceof Error ? error.message : String(error)}`,
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
      name: 'delete',
      altName: 'rm',
      description: 'Delete a sub-agent',
      action: deleteAgentCommand.action,
    },
  ],
};

// Only export the hierarchical agent command structure
// Individual commands are now only accessible via /agent subcommands
