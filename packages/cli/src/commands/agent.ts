import { spawn, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BROWSER_AGENT_PID_FILE = path.join('.taskmaster', 'browser-agent.pid');
const GLOBAL_SETTINGS_FILE = path.join(os.homedir(), '.pk', 'settings.json');

// Import agent management functions from UI commands
import {
  getAgentsDir,
  parseAgentFromFile,
  agentCommands,
} from '../ui/commands/agentCommands.js';
import { AgentRunner } from '../agent/AgentRunner.js';

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

    const agents: import('@pk-code/core').AgentConfig[] = [];

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

    // Format agent list
    console.log(`\n🤖 Available Agents (${agents.length}):\n`);
    for (const agent of agents) {
      console.log(`- ${agent.name}`);
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

    console.log(`\n🤖 Agent: ${agent.name}\n`);
    console.log(`  Description: ${agent.description || 'No description'}`);
    console.log(`  Keywords: ${(agent.keywords || []).join(', ')}`);
    console.log(
      `  Model: ${agent.model || 'default'} (${agent.provider || 'default'})`,
    );
    console.log(
      `  Tools: ${!agent.tools || agent.tools.length === 0 ? 'all' : agent.tools.map((t: { name: string }) => t.name).join(', ')}`,
    );
    if (agent.systemPrompt) {
      console.log(`\n---\nSystem Prompt:\n${agent.systemPrompt}`);
    }
  } catch (error) {
    console.error(
      `Failed to show agent: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handleCreateAgent(): Promise<void> {
  console.log('Interactive agent creation is not yet supported in CLI mode.');
  console.log('Please use the interactive UI mode to create agents.');
  console.log('Run "pk" without arguments to enter interactive mode.');
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
  // First check global .pk/settings.json
  if (fs.existsSync(GLOBAL_SETTINGS_FILE)) {
    try {
      const data = fs.readFileSync(GLOBAL_SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(data);
      if (settings.mcpServers && settings.mcpServers['browser-use']) {
        return { hasConfig: true, configSource: 'global .pk/settings.json' };
      }
    } catch (error) {
      console.warn(`Warning: Failed to parse ${GLOBAL_SETTINGS_FILE}: ${error}`);
    }
  }

  // Fallback to local .mcp.json
  const mcpConfigFile = path.resolve('.mcp.json');
  if (fs.existsSync(mcpConfigFile)) {
    try {
      const data = fs.readFileSync(mcpConfigFile, 'utf8');
      const config = JSON.parse(data);
      if (config.mcpServers && config.mcpServers['browser-use']) {
        return { hasConfig: true, configSource: 'local .mcp.json' };
      }
    } catch (error) {
      console.warn(`Warning: Failed to parse ${mcpConfigFile}: ${error}`);
    }
  }

  return { hasConfig: false, configSource: '' };
}

async function startBrowserAgent() {
  if (fs.existsSync(BROWSER_AGENT_PID_FILE)) {
    const pid = parseInt(fs.readFileSync(BROWSER_AGENT_PID_FILE, 'utf8'), 10);
    try {
      process.kill(pid, 0);
      console.log(`Browser agent is already running with PID: ${pid}.`);
      return;
    } catch (_error) {
      console.log('Found stale PID file, removing it.');
      fs.unlinkSync(BROWSER_AGENT_PID_FILE);
    }
  }

  const mcpConfig = await getBrowserMcpConfig();
  if (!mcpConfig.hasConfig) {
    console.error(
      'Error: browser-use MCP server configuration not found.',
    );
    console.error('Please run "pk config browser" to set up browser configuration.');
    console.error('Configuration should be in ~/.pk/settings.json or .mcp.json');
    return;
  }

  console.log(`Using browser-use configuration from: ${mcpConfig.configSource}`);

  const taskmasterDir = path.dirname(BROWSER_AGENT_PID_FILE);
  if (!fs.existsSync(taskmasterDir)) {
    fs.mkdirSync(taskmasterDir, { recursive: true });
  }

  // Get the browser-use MCP server configuration
  let browserUseConfig: any = null;
  
  // Try global settings first
  if (fs.existsSync(GLOBAL_SETTINGS_FILE)) {
    try {
      const data = fs.readFileSync(GLOBAL_SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(data);
      browserUseConfig = settings.mcpServers?.['browser-use'];
    } catch (error) {
      // Continue to try local config
    }
  }

  // Fallback to local .mcp.json
  if (!browserUseConfig) {
    const mcpConfigFile = path.resolve('.mcp.json');
    if (fs.existsSync(mcpConfigFile)) {
      try {
        const data = fs.readFileSync(mcpConfigFile, 'utf8');
        const config = JSON.parse(data);
        browserUseConfig = config.mcpServers?.['browser-use'];
      } catch (error) {
        console.error('Error reading MCP configuration:', error);
        return;
      }
    }
  }

  if (!browserUseConfig) {
    console.error('Error: browser-use configuration not found');
    return;
  }

  // Prepare environment variables
  const env = { ...process.env };
  if (browserUseConfig.env) {
    Object.keys(browserUseConfig.env).forEach(key => {
      let value = browserUseConfig.env[key];
      // Handle environment variable substitution
      if (typeof value === 'string' && value.startsWith('$')) {
        const envVarName = value.slice(1);
        value = process.env[envVarName] || value;
      }
      env[key] = value;
    });
  }

  const spawnOptions: import('child_process').SpawnOptions = {
    detached: true,
    stdio: 'ignore',
    env: env,
  };

  // Start the browser-use MCP server using the configured command and args
  const child = spawn(browserUseConfig.command, browserUseConfig.args || [], spawnOptions);
  child.unref();

  if (child.pid) {
    fs.writeFileSync(BROWSER_AGENT_PID_FILE, String(child.pid));
    console.log(`Browser agent started with PID: ${child.pid}`);
  } else {
    console.error('Failed to start browser agent.');
  }
}

async function stopBrowserAgent() {
  if (!fs.existsSync(BROWSER_AGENT_PID_FILE)) {
    console.log('Browser agent is not running.');
    return;
  }

  const pid = parseInt(fs.readFileSync(BROWSER_AGENT_PID_FILE, 'utf8'), 10);

  try {
    if (process.platform === 'win32') {
      await execAsync(`taskkill /PID ${pid} /F`);
      console.log(`Terminated browser agent with PID ${pid}.`);
    } else {
      process.kill(pid, 'SIGTERM');
      console.log(`Sent SIGTERM to browser agent with PID ${pid}.`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      process.kill(pid, 'SIGKILL');
      console.log(`Sent SIGKILL to browser agent with PID ${pid}.`);
    }
  } catch (error) {
    if (error instanceof Error) {
      // On Windows, taskkill might fail if the process is already gone.
      // On other platforms, process.kill will throw an error.
      if (!/not found/i.test(error.message)) {
        console.error(`Error stopping browser agent: ${error.message}`);
      }
    }
  } finally {
    if (fs.existsSync(BROWSER_AGENT_PID_FILE)) {
      fs.unlinkSync(BROWSER_AGENT_PID_FILE);
    }
    console.log('Browser agent stopped.');
  }
}




async function handleRunAgents(agentNames: string[]): Promise<void> {
  const projectRoot = process.cwd();
  const agentsDir = getAgentsDir(projectRoot);

  const runners = await Promise.all(
    agentNames.map(async (agentName) => {
      const baseFileName = agentName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const possibleExtensions = ['.md', '.json'];
      let filePath: string | null = null;

      for (const ext of possibleExtensions) {
        const testPath = path.join(agentsDir, baseFileName + ext);
        // eslint-disable-next-line no-empty
        try {
          await fs.promises.access(testPath);
          filePath = testPath;
          break;
        } catch {}
      }

      if (!filePath) {
        throw new Error(`Agent "${agentName}" not found.`);
      }

      const content = await fs.promises.readFile(filePath, 'utf-8');
      const agent = await parseAgentFromFile(filePath, content);
      return new AgentRunner(agent);
    }),
  );

  agentCommands.run(runners);
}
