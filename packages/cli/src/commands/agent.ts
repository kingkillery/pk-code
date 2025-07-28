import { spawn, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BROWSER_AGENT_PID_FILE = path.join('.taskmaster', 'browser-agent.pid');

export async function handleAgentCommand(
  command: string,
  agentName: string,
): Promise<void> {
  if (!command || !agentName) {
    console.error('Usage: pk agent <command> <agentName>');
    console.error('Commands: start, stop');
    console.error('Agents: browser');
    return;
  }

  if (agentName !== 'browser') {
    console.error(`Unknown agent: ${agentName}`);
    return;
  }

  switch (command) {
    case 'start':
      await startBrowserAgent();
      break;
    case 'stop':
      await stopBrowserAgent();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Available commands: start, stop');
  }
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

  const mcpConfigFile = path.resolve('.mcp.json');
  if (!fs.existsSync(mcpConfigFile)) {
    console.error(
      'Error: .mcp.json not found. Please run "pk config browser" to set up browser configuration.',
    );
    return;
  }

  const taskmasterDir = path.dirname(BROWSER_AGENT_PID_FILE);
  if (!fs.existsSync(taskmasterDir)) {
    fs.mkdirSync(taskmasterDir, { recursive: true });
  }

  const isWindows = process.platform === 'win32';
  const scriptName = isWindows
    ? 'start-browser-agent.bat'
    : 'start-browser-agent.sh';
  const scriptPath = path.resolve('scripts', scriptName);

  if (!fs.existsSync(scriptPath)) {
    console.error(`Error: ${scriptName} script not found at ${scriptPath}`);
    return;
  }

  const spawnOptions: import('child_process').SpawnOptions = {
    detached: true,
    stdio: 'ignore',
  };

  const child = isWindows
    ? spawn('cmd.exe', ['/c', scriptPath], spawnOptions)
    : spawn('bash', [scriptPath], spawnOptions);

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
