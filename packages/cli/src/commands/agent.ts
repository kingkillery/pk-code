import { Command } from 'commander';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const BROWSER_AGENT_PID_FILE = path.join('.taskmaster', 'browser-agent.pid');

export const agentCommand = new Command('agent')
  .description('Manage background agent processes')
  .addCommand(
    new Command('start')
      .description('Start a background agent')
      .argument('<agentName>', 'The name of the agent to start (e.g., browser)')
      .action(async (agentName) => {
        if (agentName === 'browser') {
          await startBrowserAgent();
        } else {
          console.error(`Unknown agent: ${agentName}`);
        }
      }),
  )
  .addCommand(
    new Command('stop')
      .description('Stop a background agent')
      .argument('<agentName>', 'The name of the agent to stop (e.g., browser)')
      .action(async (agentName) => {
        if (agentName === 'browser') {
          await stopBrowserAgent();
        } else {
          console.error(`Unknown agent: ${agentName}`);
        }
      }),
  );

async function startBrowserAgent() {
  if (fs.existsSync(BROWSER_AGENT_PID_FILE)) {
    console.log('Browser agent is already running.');
    return;
  }

  const scriptPath = path.resolve('scripts', 'start-browser-agent.sh');
  if (!fs.existsSync(scriptPath)) {
    console.error(
      `Error: start-browser-agent.sh script not found at ${scriptPath}`,
    );
    return;
  }

  const child = spawn('bash', [scriptPath], {
    detached: true,
    stdio: 'ignore',
  });

  child.unref();

  fs.writeFileSync(BROWSER_AGENT_PID_FILE, String(child.pid));
  console.log(`Browser agent started with PID: ${child.pid}`);
}

async function stopBrowserAgent() {
  if (!fs.existsSync(BROWSER_AGENT_PID_FILE)) {
    console.log('Browser agent is not running.');
    return;
  }

  const pid = parseInt(fs.readFileSync(BROWSER_AGENT_PID_FILE, 'utf8'), 10);
  try {
    process.kill(pid, 'SIGTERM');
    console.log(`Browser agent with PID ${pid} stopped.`);
  } catch (error) {
    console.error(`Error stopping browser agent with PID ${pid}:`, error);
  } finally {
    fs.unlinkSync(BROWSER_AGENT_PID_FILE);
  }
}
