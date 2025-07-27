/* eslint-disable no-undef */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { load as yamlLoad } from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse agent content from file (supports both JSON and Markdown formats)
 */
const parseAgentFromFile = async (filePath, content) => {
  if (filePath.endsWith('.json')) {
    // Legacy JSON format
    return JSON.parse(content);
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

    const agent = parsed;

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
 * Test the agent parsing functionality
 */
async function testAgentParsing() {
  try {
    const agentsDir = path.join(__dirname, '.pk', 'agents');
    console.log('Testing agent parsing in:', agentsDir);

    // Read all agent files
    const files = await fs.readdir(agentsDir);
    const agentFiles = files.filter(
      (file) =>
        file.endsWith('.json') ||
        file.endsWith('.md') ||
        file.endsWith('.markdown'),
    );

    console.log('Found agent files:', agentFiles);

    for (const file of agentFiles) {
      try {
        const filePath = path.join(agentsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const agent = await parseAgentFromFile(filePath, content);

        console.log(`\n✅ Successfully parsed ${file}:`);
        console.log('  Name:', agent.name);
        console.log('  Description:', agent.description);
        console.log('  Keywords:', agent.keywords);
        console.log(
          '  Tools:',
          agent.tools?.map((t) => t.name || t).join(', '),
        );
        console.log('  Model:', agent.model);
        console.log('  Provider:', agent.provider);
        console.log('  Has System Prompt:', !!agent.systemPrompt);
        if (agent.systemPrompt) {
          console.log(
            '  System Prompt Preview:',
            agent.systemPrompt.substring(0, 100) + '...',
          );
        }
      } catch (error) {
        console.error(`❌ Failed to parse ${file}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testAgentParsing();
