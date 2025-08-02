import { spawn, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import * as net from 'net';

const execAsync = promisify(exec);

const BROWSER_AGENT_PID_FILE = path.join('.taskmaster', 'browser-agent.pid');
const GLOBAL_SETTINGS_FILE = path.join(os.homedir(), '.pk', 'settings.json');

// Helper function to read global settings
async function getGlobalSettings(): Promise<Record<string, unknown>> {
  if (fs.existsSync(GLOBAL_SETTINGS_FILE)) {
    try {
      const data = fs.readFileSync(GLOBAL_SETTINGS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn(`Warning: Failed to parse ${GLOBAL_SETTINGS_FILE}: ${error}`);
      return {};
    }
  }
  return {};
}

// Import agent management functions from UI commands
import {
  getAgentsDir,
  parseAgentFromFile,
  agentCommands,
} from '../ui/commands/agentCommands.js';

function showAgentHelp(errorMessage?: string) {
  if (errorMessage) {
    console.error(`Error: ${errorMessage}\n`);
  }
  console.error('Usage: pk agent <command> [args]');
  console.error('Commands: create, list, show, delete, start, stop, help, run');
  console.error('Examples:');
  console.error('  pk agent list                    # List all agents');
  console.error(
    '  pk agent show <name>             # Show details for an agent',
  );
  console.error(
    '  pk agent create                  # Create agent interactively',
  );
  console.error('  pk agent delete <name>           # Delete an agent');
  console.error('  pk agent start browser           # Start browser agent');
  console.error('  pk agent stop browser            # Stop browser agent');
  console.error(
    "  pk agent run '<agent1>,<agent2>'    # Run one or more agents in parallel",
  );
  console.error('  pk agent help                    # Show this help message');
}

export async function handleAgentCommand(
  command: string,
  agentNameOrArgs?: string,
): Promise<void> {
  console.log(
    `DEBUG: command='${command}', agentNameOrArgs='${agentNameOrArgs}'`,
  );
  if (!command) {
    showAgentHelp();
    return;
  }

  switch (command) {
    case 'list':
    case 'ls':
      await handleListAgents();
      break;
    case 'show':
    case 'view':
      if (!agentNameOrArgs) {
        console.error('Usage: pk agent show <agent-name>');
        return;
      }
      await handleShowAgent(agentNameOrArgs);
      break;
    case 'create':
      await handleCreateAgent();
      break;
    case 'delete':
    case 'rm':
      if (!agentNameOrArgs) {
        console.error('Usage: pk agent delete <agent-name>');
        return;
      }
      await handleDeleteAgent(agentNameOrArgs);
      break;
    case 'start':
      if (agentNameOrArgs === 'browser') {
        await startBrowserAgent();
      } else {
        console.error('Only browser agent start is supported');
        console.error('Usage: pk agent start browser');
      }
      break;
    case 'stop':
      if (agentNameOrArgs === 'browser') {
        await stopBrowserAgent();
      } else {
        console.error('Only browser agent stop is supported');
        console.error('Usage: pk agent stop browser');
      }
      break;
    case 'run':
      if (!agentNameOrArgs) {
        console.error('Usage: pk agent run <agent1>,<agent2>');
        return;
      }
      await handleRunAgents(agentNameOrArgs.split(','));
      break;
    case 'help':
    case '-h':
    case '--help':
      showAgentHelp();
      break;
    default:
      showAgentHelp(`Unknown command: ${command}`);
  }
}

// Agent management functions adapted from UI commands
async function handleListAgents(): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const agentsDir = getAgentsDir(projectRoot);

    // Check if agents directory exists
    try {
      await fs.promises.access(agentsDir);
    } catch {
      console.log(
        'No agents directory found. Use "pk agent create" to create your first agent.',
      );
      return;
    }

    // Read all agent files (both .md and .json for backward compatibility)
    const files = await fs.promises.readdir(agentsDir);
    const agentFiles = files.filter(
      (f) =>
        f.endsWith('.md') || f.endsWith('.markdown') || f.endsWith('.json'),
    );

    if (agentFiles.length === 0) {
      console.log(
        'No agents found. Use "pk agent create" to create your first agent.',
      );
      return;
    }

    const agents: Array<import('@pk-code/core').AgentConfig> = [];

    for (const file of agentFiles) {
      try {
        const filePath = path.join(agentsDir, file);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const agent = await parseAgentFromFile(filePath, content);
        agents.push(agent);
      } catch (error) {
        console.warn(`Failed to parse agent file ${file}:`, error);
      }
    }

    if (agents.length === 0) {
      console.log('No valid agents found.');
      return;
    }

    // Format agent list with color and tool information
    console.log(`\n🤖 Available Agents (${agents.length}):\n`);
    for (const agent of agents) {
      // Try to get color from YAML frontmatter
      let colorIndicator = '';
      try {
        const contentLines = agent.systemPrompt?.split('\n') || [];
        if (contentLines.length > 0 && contentLines[0].startsWith('---')) {
          const yamlMatch = agent.systemPrompt?.match(/---\n([\s\S]*?)\n---/);
          if (yamlMatch && yamlMatch[1]) {
            const yamlLines = yamlMatch[1].split('\n');
            const colorLine = yamlLines.find(line => line.startsWith('color:'));
            if (colorLine) {
              const color = colorLine.split(':')[1].trim();
              colorIndicator = ` (${color})`;
            }
          }
        }
      } catch (_e) {
        // Ignore parsing errors
      }
      
      // Get tools info
      const toolsInfo = agent.tools && agent.tools.length > 0 
        ? ` [${agent.tools.map((t: { name: string }) => t.name).join(', ')}]` 
        : ' [all tools]';
      
      console.log(`- ${agent.name}${colorIndicator}${toolsInfo}`);
    }
    console.log('\nFor more details, use `pk agent show <agent-name>`.');
  } catch (error) {
    console.error(
      `Failed to list agents: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handleShowAgent(agentName: string): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const agentsDir = getAgentsDir(projectRoot);
    const baseFileName = agentName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Try to find the agent file (check both .md and .json extensions)
    const possibleExtensions = ['.md', '.json'];
    let filePath: string | null = null;

    for (const ext of possibleExtensions) {
      const testPath = path.join(agentsDir, baseFileName + ext);
      try {
        await fs.promises.access(testPath);
        filePath = testPath;
        break;
      } catch {
        // File doesn't exist, try next extension
      }
    }

    if (!filePath) {
      console.error(`Agent "${agentName}" not found.`);
      return;
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    const agent = await parseAgentFromFile(filePath, content);

    console.log(`
🤖 Agent: ${agent.name}
`);
    
    // Extract color from YAML frontmatter if available
    let color = 'default';
    try {
      const contentLines = agent.systemPrompt?.split('\n') || [];
      if (contentLines.length > 0 && contentLines[0].startsWith('---')) {
        const yamlMatch = agent.systemPrompt?.match(/---\n([\s\S]*?)\n---/);
        if (yamlMatch && yamlMatch[1]) {
          const yamlLines = yamlMatch[1].split('\n');
          const colorLine = yamlLines.find(line => line.startsWith('color:'));
          if (colorLine) {
            color = colorLine.split(':')[1].trim();
          }
        }
      }
    } catch (_e) {
      // Ignore parsing errors
    }
    
    console.log(`  Description: ${agent.description || 'No description'}`);
    console.log(`  Color: ${color}`);
    console.log(`  Keywords: ${(agent.keywords || []).join(', ')}`);
    console.log(
      `  Model: ${agent.model || 'default'} (${agent.provider || 'default'})`,
    );
    console.log(
      `  Tools: ${!agent.tools || agent.tools.length === 0 ? 'all' : agent.tools.map((t: { name: string }) => t.name).join(', ')}`,
    );
    if (agent.examples && agent.examples.length > 0) {
      console.log('\n  Examples:');
      agent.examples.forEach((example: { input: string; output: string; description?: string }, index: number) => {
        console.log(`    ${index + 1}. ${example.description || 'Example'}:`);
        console.log(`       Input: ${example.input}`);
        console.log(`       Output: ${example.output}`);
      });
    }
    if (agent.systemPrompt) {
      // Extract just the system prompt content, not the full markdown with frontmatter
      let promptContent = agent.systemPrompt;
      try {
        const contentLines = agent.systemPrompt.split('\n');
        if (contentLines.length > 0 && contentLines[0].startsWith('---')) {
          // Find the end of the frontmatter
          let frontmatterEndIndex = 1;
          while (frontmatterEndIndex < contentLines.length && contentLines[frontmatterEndIndex] !== '---') {
            frontmatterEndIndex++;
          }
          if (frontmatterEndIndex < contentLines.length) {
            promptContent = contentLines.slice(frontmatterEndIndex + 1).join('\n').trim();
          }
        }
      } catch (_e) {
        // Fallback to original content if parsing fails
      }
      
      if (promptContent) {
        console.log('\n---\nSystem Prompt:');
        // Limit the output to prevent overwhelming the terminal
        const lines = promptContent.split('\n');
        if (lines.length > 50) {
          console.log(lines.slice(0, 50).join('\n'));
          console.log(`\n... (showing first 50 lines, ${lines.length - 50} more lines available)`);
        } else {
          console.log(promptContent);
        }
      }
    }
  } catch (error) {
    console.error(
      `Failed to show agent: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handleCreateAgent(): Promise<void> {
  // Import the interactive creation component
  const { handleCreateAgentCommandCLI } = await import('./create-agent-cli.js');
  void handleCreateAgentCommandCLI();
}

async function handleDeleteAgent(agentName: string): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const agentsDir = getAgentsDir(projectRoot);
    const baseFileName = agentName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Try to find the agent file (check both .md and .json extensions)
    const possibleExtensions = ['.md', '.json'];
    let filePath: string | null = null;

    for (const ext of possibleExtensions) {
      const testPath = path.join(agentsDir, baseFileName + ext);
      try {
        await fs.promises.access(testPath);
        filePath = testPath;
        break;
      } catch {
        // File doesn't exist, try next extension
      }
    }

    if (!filePath) {
      console.error(`Agent "${agentName}" not found.`);
      return;
    }

    // Delete the agent file
    await fs.promises.unlink(filePath);
    console.log(`✅ Agent "${agentName}" deleted successfully.`);
  } catch (error) {
    console.error(
      `Failed to delete agent: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Helper function to check for browser-use MCP server configuration
async function getBrowserMcpConfig(): Promise<{ hasConfig: boolean; configSource: string }> {
  const globalSettings = await getGlobalSettings();
  if (globalSettings.mcpServers && typeof globalSettings.mcpServers === 'object' && globalSettings.mcpServers !== null && 'browser-use' in globalSettings.mcpServers) {
    return { hasConfig: true, configSource: 'global' };
  }

  const mcpConfigFile = path.resolve('.mcp.json');
  if (fs.existsSync(mcpConfigFile)) {
    try {
      const data = fs.readFileSync(mcpConfigFile, 'utf8');
      const config = JSON.parse(data);
      if (config.mcpServers && config.mcpServers['browser-use']) {
        return { hasConfig: true, configSource: 'local' };
      }
    } catch (error) {
      console.warn(`Warning: Failed to parse ${mcpConfigFile}: ${error}`);
    }
  }

  return { hasConfig: false, configSource: '' };
}

async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}



async function checkBrowserUseInstallation(): Promise<boolean> {
  try {
    // Check if browser-use is installed by trying to resolve its package.json
    require.resolve('browser-use/package.json');
    return true;
  } catch (error) {
    return false;
  }
}

async function getChromeConfig(): Promise<{ chromePath: string | null }> {
  const globalSettings = await getGlobalSettings();
  return {
    chromePath: (typeof globalSettings.chromePath === 'string' ? globalSettings.chromePath : null),
  };
}

async function getBrowserConfig(): Promise<any> {
  const { hasConfig, configSource } = await getBrowserMcpConfig();
  if (!hasConfig) {
    return null;
  }

  if (configSource === 'global') {
    const globalSettings = await getGlobalSettings();
    return (globalSettings.mcpServers as any)?.['browser-use'] || null;
  } else {
    const mcpConfigFile = path.resolve('.mcp.json');
    const data = fs.readFileSync(mcpConfigFile, 'utf8');
    const config = JSON.parse(data);
    return config.mcpServers['browser-use'];
  }
}

async function startBrowserAgent() {
  if (fs.existsSync(BROWSER_AGENT_PID_FILE)) {
    const pid = parseInt(fs.readFileSync(BROWSER_AGENT_PID_FILE, 'utf8'), 10);
    try {
      process.kill(pid, 0);
      console.log(`Browser agent is already running with PID: ${pid}. To stop it, run "pk agent stop browser".`);
      return;
    } catch (_error) {
      console.warn('Found stale PID file from a previous session. Removing it.');
      fs.unlinkSync(BROWSER_AGENT_PID_FILE);
    }
  }

  const isInstalled = await checkBrowserUseInstallation();
  if (!isInstalled) {
    console.error('Error: The "browser-use" package is not installed.');
    console.error('Please install it by running: npm install -g browser-use');
    return;
  }

  const { chromePath } = await getChromeConfig();
  if (!chromePath || !fs.existsSync(chromePath)) {
    console.error('Error: Chrome executable path is not configured or is invalid.');
    console.error('Please run "pk config browser" to set the correct path to your Chrome/Chromium executable.');
    return;
  }

  const browserConfig = await getBrowserConfig();
  if (!browserConfig) {
    console.error('Error: browser-use MCP server configuration not found.');
    console.error('Please run "pk config browser" to set up browser configuration.');
    return;
  }

  const port = browserConfig.port || 3001;
  if (await isPortInUse(port)) {
    console.error(`Error: Port ${port} is already in use. The browser agent requires this port.`);
    console.error('Please stop the process using this port or configure a different port for the browser agent.');
    return;
  }

  const taskmasterDir = path.dirname(BROWSER_AGENT_PID_FILE);
  if (!fs.existsSync(taskmasterDir)) {
    fs.mkdirSync(taskmasterDir, { recursive: true });
  }

  const spawnOptions: import('child_process').SpawnOptions = {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, ...browserConfig.env },
  };

  const child = spawn(browserConfig.command, browserConfig.args || [], spawnOptions);
  child.unref();

  if (child.pid) {
    fs.writeFileSync(BROWSER_AGENT_PID_FILE, String(child.pid));
    console.log(`Browser agent started successfully with PID: ${child.pid}.`);
  } else {
    console.error('Failed to start the browser agent. Please check your configuration and try again.');
  }
}

async function stopBrowserAgent() {
  if (!fs.existsSync(BROWSER_AGENT_PID_FILE)) {
    console.log('Browser agent is not running.');
    return;
  }

  const pid = parseInt(fs.readFileSync(BROWSER_AGENT_PID_FILE, 'utf8'), 10);

  try {
    // Check if the process is actually running
    process.kill(pid, 0);

    if (process.platform === 'win32') {
      await execAsync(`taskkill /PID ${pid} /F`);
    } else {
      process.kill(pid, 'SIGTERM');
      // Add a small delay to allow graceful shutdown before sending SIGKILL
      await new Promise(resolve => setTimeout(resolve, 100));
      process.kill(pid, 'SIGKILL');
    }
    console.log(`Browser agent with PID ${pid} stopped successfully.`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('ESRCH')) {
      // Process not found, clean up the stale PID file
      console.warn(`Stale PID file found for a non-existent process (PID: ${pid}). Cleaning up.`);
    } else {
      // On Windows, taskkill might fail if the process is already gone.
      // On other platforms, process.kill will throw an error.
      if (!/not found/i.test((error as Error).message)) {
        console.error(`Error stopping browser agent: ${(error as Error).message}`);
      }
    }
  } finally {
    if (fs.existsSync(BROWSER_AGENT_PID_FILE)) {
      fs.unlinkSync(BROWSER_AGENT_PID_FILE);
    }
  }
}




async function handleRunAgents(agentNames: string[]): Promise<void> {
  const projectRoot = process.cwd();
  const agentsDir = getAgentsDir(projectRoot);

  // Import the enhanced agent runner
  const { EnhancedAgentRunner } = await import('../agent/EnhancedAgentRunner.js');

  const runners = await Promise.all(
    agentNames.map(async (agentName) => {
      const baseFileName = agentName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const possibleExtensions = ['.md', '.json'];
      let filePath: string | null = null;

      for (const ext of possibleExtensions) {
        const testPath = path.join(agentsDir, baseFileName + ext);
         
        try {
          await fs.promises.access(testPath);
          filePath = testPath;
          break;
        } catch {
          // File doesn't exist, try next extension
        }
      }

      if (!filePath) {
        throw new Error(`Agent "${agentName}" not found.`);
      }

      const content = await fs.promises.readFile(filePath, 'utf-8');
      const agent = await parseAgentFromFile(filePath, content);
      return new EnhancedAgentRunner(agent);
    }),
  );

  agentCommands.run(runners);
}
