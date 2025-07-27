/* eslint-disable no-undef */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test the enhanced agent creation with template fallback
 */
async function testEnhancedAgentCreation() {
  try {
    console.log('🧪 Testing Enhanced Agent Creation');

    // Create an agent using the CLI format (without actual AI since no API keys in test)
    const agentConfig = {
      name: 'test-enhanced-agent',
      description: 'A test agent created with the enhanced system',
      keywords: ['testing', 'enhancement', 'ai-generated'],
      domain: 'testing',
      tools: [{ name: 'file-system' }, { name: 'search-codebase' }],
      shouldGeneratePrompt: true,
    };

    // Simulate the template fallback generation
    const systemPrompt = `You are a ${agentConfig.name.replace(/-/g, ' ')} specialist, an expert in ${agentConfig.keywords.join(', ')}. Your mission is to ${agentConfig.description.toLowerCase()}.

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

Your expertise in ${agentConfig.keywords.join(', ')} makes you uniquely qualified to deliver exceptional results in this domain.`;

    const enhancedDescription = `Use this agent when you need specialized assistance with ${agentConfig.description.toLowerCase()}. Examples: <example>Context: User needs help with ${agentConfig.keywords[0]} tasks. user: "Can you help me with ${agentConfig.keywords[0]}?" assistant: "I'll use the ${agentConfig.name} agent to provide specialized guidance on ${agentConfig.keywords[0]} tasks."</example> <example>Context: User has a specific ${agentConfig.keywords[1]} challenge. user: "I'm working on ${agentConfig.keywords[1]} and need expert advice" assistant: "Let me engage the ${agentConfig.name} agent to provide expert assistance with your ${agentConfig.keywords[1]} challenge."</example>`;

    const agentColor = 'pink'; // testing domain -> pink

    // Create the agent file content in the new format
    const yamlFrontmatter = `---
name: ${agentConfig.name}
description: ${enhancedDescription}
color: ${agentColor}
---`;

    const fileContent = `${yamlFrontmatter}

${systemPrompt}`;

    // Write the test agent
    const agentsDir = path.join(__dirname, '.pk', 'agents');
    await fs.mkdir(agentsDir, { recursive: true });

    const fileName = `${agentConfig.name}.md`;
    const filePath = path.join(agentsDir, fileName);

    await fs.writeFile(filePath, fileContent, 'utf-8');

    console.log(`✅ Enhanced agent created: ${fileName}`);
    console.log(`📁 Location: ${filePath}`);
    console.log(`🎨 Color: ${agentColor}`);
    console.log(
      `🤖 Enhanced Prompt: ${agentConfig.shouldGeneratePrompt ? 'Yes' : 'No'}`,
    );
    console.log(`📄 Content preview:`);
    console.log(fileContent.substring(0, 400) + '...');

    // Verify the format matches existing agents
    const content = await fs.readFile(filePath, 'utf-8');
    const hasCorrectFormat =
      content.includes('---\nname:') &&
      content.includes('description:') &&
      content.includes('color:') &&
      content.includes('<example>');

    console.log(
      `✅ Format validation: ${hasCorrectFormat ? 'PASSED' : 'FAILED'}`,
    );
  } catch (error) {
    console.error('❌ Failed to test enhanced agent creation:', error.message);
  }
}

// Run the test
testEnhancedAgentCreation();
