/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Command, CommandContext, MessageActionReturn } from './types.js';
import { AgentConfig } from '@pk-code/core';
import fs from 'fs/promises';
import path from 'path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

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
const parseAgentFromFile = async (filePath: string, content: string): Promise<AgentConfig> => {
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
      const markdownContent = content.substring(frontMatterMatch[0].length).trim();
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
  description: 'Create a new sub-agent. Usage: /create-agent <name> "<description>" "<keywords>" [tools] [model] [provider]',
  action: async (context: CommandContext): Promise<MessageActionReturn> => {
    const { services } = context;
    
    if (!services.config?.getProjectRoot()) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'No project root found. Please run this command from within a project.',
      };
    }

    const projectRoot = services.config.getProjectRoot();
    
    if (!args.trim()) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Usage: /create-agent <name> "<description>" "<keywords>" [tools] [model] [provider]\n\nExample: /create-agent "code-reviewer" "Reviews code for best practices" "review,code,quality" "file-system,web-search" "gemini-2.0-flash-exp" "gemini"',
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
          content: 'Missing required arguments. Usage: /create-agent <name> "<description>" "<keywords>" [tools] [model] [provider]',
        };
      }
      
      const name = argParts[0];
      const description = argParts[1];
      const keywordsInput = argParts[2];
      const toolsInput = argParts[3] || 'all';
      const model = argParts[4] || 'gemini-2.0-flash-exp';
      const provider = argParts[5] || 'gemini';
      
      const keywords = keywordsInput.split(',').map(k => k.trim()).filter(k => k);
      if (keywords.length === 0) {
        return {
          type: 'message',
          messageType: 'error',
          content: 'At least one keyword is required.',
        };
      }

      const tools = toolsInput === 'all' ? [] : toolsInput.split(',').map(t => ({ name: t.trim() })).filter(t => t.name);

      // Create agent configuration for YAML frontmatter
      const agentConfig: AgentConfig = {
        name,
        description,
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
      const yamlFrontmatter = yamlDump(agentConfig, { indent: 2 });
      const markdownContent = `---\n${yamlFrontmatter}---\n\n# ${name}\n\n${description}\n\nYou are a specialized AI assistant focused on ${keywords.join(', ')}. Your role is to help users with tasks related to these areas.\n\n## Instructions\n\n- Always stay focused on your area of expertise\n- Provide clear, actionable guidance\n- Ask clarifying questions when needed\n- Use the available tools effectively\n\n## Examples\n\n*Add example interactions here to demonstrate your capabilities*\n`;

      // Write agent configuration to file
      await fs.writeFile(filePath, markdownContent);

      return {
        type: 'message',
        messageType: 'info',
        content: `✅ Agent "${name}" created successfully at ${filePath}\n\nConfiguration:\n- Description: ${description}\n- Keywords: ${keywords.join(', ')}\n- Tools: ${tools.length === 0 ? 'all' : tools.map(t => t.name).join(', ')}\n- Model: ${model} (${provider})`,
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
        content: 'No project root found. Please run this command from within a project.',
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
          content: 'No agents directory found. Use /create-agent to create your first agent.',
        };
      }

      // Read all agent files (both .md and .json for backward compatibility)
      const files = await fs.readdir(agentsDir);
      const agentFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.markdown') || f.endsWith('.json'));
      
      if (agentFiles.length === 0) {
        return {
          type: 'message',
          messageType: 'info',
          content: 'No agents found. Use /create-agent to create your first agent.',
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
        output += `  Tools: ${agent.tools.length === 0 ? 'all' : agent.tools.map(t => t.name).join(', ')}\n\n`;
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
  action: async (context: CommandContext, args: string): Promise<MessageActionReturn> => {
    const { services } = context;
    
    if (!services.config?.getProjectRoot()) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'No project root found. Please run this command from within a project.',
      };
    }

    const agentName = args.trim();
    if (!agentName) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Usage: /delete-agent <agent-name>',
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

// Export individual commands for backward compatibility
export { createAgentCommand, listAgentsCommand, deleteAgentCommand };