/* eslint-disable no-undef */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dump as yamlDump } from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test creating a new agent in Markdown format
 */
async function testCreateAgent() {
  try {
    const agentsDir = path.join(__dirname, '.pk', 'agents');
    
    // Simulate agent creation parameters
    const agentConfig = {
      name: 'test-agent',
      description: 'A test agent created to verify the new Markdown format',
      keywords: ['test', 'markdown', 'yaml'],
      tools: [
        { name: 'file-system' },
        { name: 'search-codebase' }
      ],
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      temperature: 0.5,
      maxTokens: 3000
    };
    
    // Create the agent file content
    const yamlFrontMatter = yamlDump(agentConfig, { indent: 2 });
    const systemPrompt = `# ${agentConfig.name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} Agent

You are a specialized AI assistant designed for ${agentConfig.description.toLowerCase()}.

## Instructions

- Stay focused on your designated role and responsibilities
- Provide clear, actionable guidance
- Use the available tools effectively to accomplish tasks
- Maintain a helpful and professional demeanor

## Available Tools

${agentConfig.tools.map(tool => `- **${tool.name}**: Use this tool for relevant operations`).join('\n')}

## Examples

### Example 1
**Input**: "Help me with a task"
**Output**: "I'll assist you with that task using my specialized capabilities."

### Example 2
**Input**: "What can you do?"
**Output**: "I can help with tasks related to ${agentConfig.description.toLowerCase()} using the tools available to me."`;
    
    const fileContent = `---\n${yamlFrontMatter}---\n\n${systemPrompt}`;
    
    // Create the file
    const fileName = `${agentConfig.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`;
    const filePath = path.join(agentsDir, fileName);
    
    await fs.writeFile(filePath, fileContent, 'utf-8');
    
    console.log(`✅ Successfully created agent: ${fileName}`);
    console.log(`📁 Location: ${filePath}`);
    console.log(`📄 Content preview:`);
    console.log(fileContent.substring(0, 300) + '...');
    
  } catch (error) {
    console.error('❌ Failed to create agent:', error.message);
  }
}

// Run the test
testCreateAgent();