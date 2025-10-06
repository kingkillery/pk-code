/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Command } from './types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
const BROWSER_AGENT_PID_FILE = path.join('.taskmaster', 'browser-agent.pid');

interface GlobalSettings {
  mcpServers?: Record<string, unknown>;
  chromePath?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.filter(
    (item): item is string => typeof item === 'string',
  );
  return items.length > 0 ? items : undefined;
}

function parseEnvRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

async function getGlobalSettings(): Promise<GlobalSettings> {
  try {
    const settingsPath = path.join(os.homedir(), '.pk', 'settings.json');
    const data = await fs.promises.readFile(settingsPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function getBrowserMcpConfig(): Promise<{
  hasConfig: boolean;
  configSource: string;
}> {
  const globalSettings = await getGlobalSettings();
  const globalServers = isRecord(globalSettings.mcpServers)
    ? (globalSettings.mcpServers as Record<string, unknown>)
    : undefined;

  if (globalServers && 'browser-use' in globalServers) {
    return { hasConfig: true, configSource: 'global' };
  }

  const mcpConfigFile = path.resolve('.mcp.json');
  if (fs.existsSync(mcpConfigFile)) {
    try {
      const data = fs.readFileSync(mcpConfigFile, 'utf8');
      const config = JSON.parse(data);
      const localServers = isRecord(config.mcpServers)
        ? (config.mcpServers as Record<string, unknown>)
        : undefined;
      if (localServers && 'browser-use' in localServers) {
        return { hasConfig: true, configSource: 'local' };
      }
    } catch (error) {
      console.warn(`Warning: Failed to parse ${mcpConfigFile}: ${error}`);
    }
  }

  return { hasConfig: false, configSource: '' };
}

interface BrowserConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  port?: number;
}

function toBrowserConfig(value: unknown): BrowserConfig | null {
  if (!isRecord(value)) {
    return null;
  }

  const command = value['command'];
  if (typeof command !== 'string' || command.trim() === '') {
    return null;
  }

  const args = parseStringArray(value['args']);
  const env = parseEnvRecord(value['env']);
  const port = typeof value['port'] === 'number' ? value['port'] : undefined;

  const config: BrowserConfig = { command };
  if (args) {
    config.args = args;
  }
  if (env) {
    config.env = env;
  }
  if (port !== undefined) {
    config.port = port;
  }

  return config;
}

function getUserDataDirFromSettings(
  settings: GlobalSettings,
): string | undefined {
  const browserSettings = settings.mcpServers?.['browser-use'];
  if (!isRecord(browserSettings)) {
    return undefined;
  }

  const value = browserSettings['userDataDir'];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

async function getBrowserConfig(): Promise<BrowserConfig | null> {
  const { hasConfig, configSource } = await getBrowserMcpConfig();
  if (!hasConfig) {
    return null;
  }

  if (configSource === 'global') {
    const globalSettings = await getGlobalSettings();
    if (isRecord(globalSettings.mcpServers)) {
      return toBrowserConfig(globalSettings.mcpServers['browser-use']);
    }
    return null;
  }

  const mcpConfigFile = path.resolve('.mcp.json');
  try {
    const data = fs.readFileSync(mcpConfigFile, 'utf8');
    const config = JSON.parse(data);
    if (isRecord(config) && isRecord(config.mcpServers)) {
      return toBrowserConfig(config.mcpServers['browser-use']);
    }
  } catch (error) {
    console.warn(`Warning: Failed to parse ${mcpConfigFile}: ${error}`);
  }
  return null;
}

async function isBrowserAgentRunning(): Promise<boolean> {
  if (!fs.existsSync(BROWSER_AGENT_PID_FILE)) {
    return false;
  }

  const pid = parseInt(fs.readFileSync(BROWSER_AGENT_PID_FILE, 'utf8'), 10);
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    // Process not running, clean up stale PID file
    fs.unlinkSync(BROWSER_AGENT_PID_FILE);
    return false;
  }
}

async function startBrowserAgent(): Promise<{
  success: boolean;
  message: string;
}> {
  // Check if already running
  if (await isBrowserAgentRunning()) {
    return { success: true, message: 'Browser agent is already running' };
  }

  // No longer require a globally configured Chrome executable path.
  // The browser-use CLI will manage Chromium/Chrome discovery itself, and
  // we rely on `.mcp.json` (or global settings) for any needed user data dir.

  // Check browser config; if missing, synthesize a sensible default so we can start automatically
  let browserConfig = await getBrowserConfig();
  if (!browserConfig) {
    const globalSettings = await getGlobalSettings();
    const userDataDir = getUserDataDirFromSettings(globalSettings);
    if (process.platform === 'win32') {
      browserConfig = {
        command: 'cmd',
        args: [
          '/c',
          'uvx',
          '--from',
          'browser-use[cli]',
          'browser-use',
          '--mcp',
        ],
        env: userDataDir
          ? { BROWSER_USE_USER_DATA_DIR: userDataDir }
          : undefined,
        port: 3001,
      };
    } else {
      browserConfig = {
        command: 'bash',
        args: ['-lc', 'uvx --from browser-use[cli] browser-use --mcp'],
        env: userDataDir
          ? { BROWSER_USE_USER_DATA_DIR: userDataDir }
          : undefined,
        port: 3001,
      };
    }
  }

  // Create .taskmaster directory if it doesn't exist
  const taskmasterDir = path.dirname(BROWSER_AGENT_PID_FILE);
  if (!fs.existsSync(taskmasterDir)) {
    fs.mkdirSync(taskmasterDir, { recursive: true });
  }

  // Start the agent
  const spawnOptions: Parameters<typeof spawn>[2] = {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, ...(browserConfig.env ?? {}) },
  };

  const child = spawn(
    browserConfig.command,
    browserConfig.args || [],
    spawnOptions,
  );

  if (typeof child.unref === 'function') {
    child.unref();
  }

  const pid = child.pid;

  if (typeof pid === 'number') {
    fs.writeFileSync(BROWSER_AGENT_PID_FILE, String(pid));
    // Wait a moment for the agent to start
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return {
      success: true,
      message: `Browser agent started with PID ${pid}`,
    };
  } else {
    return { success: false, message: 'Failed to start the browser agent' };
  }
}

export const browserUseCommand: Command = {
  name: 'browser-use',
  description:
    'Launch Browser-use either via API (requires BROWSER_USE_API_KEY) or locally via the Browser-use CLI (MCP agent).',
  subCommands: [
    {
      name: 'api',
      description:
        'Use the Browser Use API integration (requires BROWSER_USE_API_KEY).',
      action: async () =>
        process.env.BROWSER_USE_API_KEY
          ? {
              type: 'message',
              messageType: 'info',
              content:
                '✅ Browser Use API mode selected. You can now use the built-in "browser_use" tool. Example:\n  Use the browser_use tool with action "create_task" and task "Go to google.com and search for AI news"',
            }
          : {
              type: 'message',
              messageType: 'error',
              content:
                '❌ BROWSER_USE_API_KEY is not set. Set it and restart the app. Example (PowerShell):\n  $env:BROWSER_USE_API_KEY = "<your-key>"\nThen try again with /browser-use api',
            },
    },
    {
      name: 'local',
      description:
        'Use the local Browser-use CLI via MCP (automatically starts if needed).',
      action: async () => {
        // Try to start the browser agent automatically
        const result = await startBrowserAgent();

        if (result.success) {
          return {
            type: 'message',
            messageType: 'info',
            content: `✅ Local browser agent is ready! ${result.message}\n\nYou can now use browser automation commands. The browser.* MCP tools are available.\n\nExample: "Navigate to google.com and search for AI news"`,
          };
        } else {
          return {
            type: 'message',
            messageType: 'error',
            content: `❌ Failed to start browser agent: ${result.message}`,
          };
        }
      },
    },
  ],
};
