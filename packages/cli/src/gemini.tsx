/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render } from 'ink';
import { AppWrapper } from './ui/App.js';
import { loadCliConfig, parseArguments, CliArgs } from './config/config.js';
import { readStdin } from './utils/readStdin.js';
import { basename } from 'node:path';
import v8 from 'node:v8';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { start_sandbox } from './utils/sandbox.js';
import {
  LoadedSettings,
  loadSettings,
  USER_SETTINGS_PATH,
  SettingScope,
} from './config/settings.js';
import { themeManager } from './ui/themes/theme-manager.js';
import { getStartupWarnings } from './utils/startupWarnings.js';
import { getUserStartupWarnings } from './utils/userStartupWarnings.js';
import { runNonInteractive } from './nonInteractiveCli.js';
import { loadExtensions, Extension } from './config/extension.js';
import { cleanupCheckpoints, registerCleanup } from './utils/cleanup.js';
import { getCliVersion } from './utils/version.js';
import {
  ApprovalMode,
  Config,
  EditTool,
  ShellTool,
  WriteFileTool,
  sessionId,
  logUserPrompt,
  AuthType,
  getOauthClient,
} from '@pk-code/core';
import { validateAuthMethod } from './config/auth.js';
import { setMaxSizedBoxDebugging } from './ui/components/shared/MaxSizedBox.js';

function getNodeMemoryArgs(config: Config): string[] {
  const totalMemoryMB = os.totalmem() / (1024 * 1024);
  const heapStats = v8.getHeapStatistics();
  const currentMaxOldSpaceSizeMb = Math.floor(
    heapStats.heap_size_limit / 1024 / 1024,
  );

  // Set target to 50% of total memory
  const targetMaxOldSpaceSizeInMB = Math.floor(totalMemoryMB * 0.5);
  if (config.getDebugMode()) {
    console.debug(
      `Current heap size ${currentMaxOldSpaceSizeMb.toFixed(2)} MB`,
    );
  }

  if (process.env.GEMINI_CLI_NO_RELAUNCH) {
    return [];
  }

  if (targetMaxOldSpaceSizeInMB > currentMaxOldSpaceSizeMb) {
    if (config.getDebugMode()) {
      console.debug(
        `Need to relaunch with more memory: ${targetMaxOldSpaceSizeInMB.toFixed(2)} MB`,
      );
    }
    return [`--max-old-space-size=${targetMaxOldSpaceSizeInMB}`];
  }

  return [];
}

async function relaunchWithAdditionalArgs(additionalArgs: string[]) {
  const nodeArgs = [...additionalArgs, ...process.argv.slice(1)];
  const newEnv = { ...process.env, GEMINI_CLI_NO_RELAUNCH: 'true' };

  const child = spawn(process.execPath, nodeArgs, {
    stdio: 'inherit',
    env: newEnv,
  });

  await new Promise((resolve) => child.on('close', resolve));
  process.exit(0);
}

import { handleConfigCommand } from './commands/config.js';

import { handleGenerateCommand } from './commands/generate.js';

import { handleInitCommand } from './commands/init.js';

import { handleUseCommand, parseUseCommandSyntax } from './commands/use.js';

import { handleCreateAgentCommand } from './commands/create-agent.js';
import { agentCommand } from './commands/agent.js';

export async function main() {
  const argv = await parseArguments();
  if (argv._[0] === 'init') {
    handleInitCommand();
    return;
  }
  if (argv._[0] === 'generate') {
    await handleGenerateCommand(argv.prompt || '', argv.provider || 'openai');
    process.exit(0);
  }
  if (argv._[0] === 'config') {
    await handleConfigCommand(
      argv._[1] as string,
      argv._[2] as string,
      argv._[3] as string,
    );
    process.exit(0);
  }
  if (argv._[0] === 'create-agent') {
    handleCreateAgentCommand();
    return;
  }
  if (argv._[0] === 'use') {
    // Handle both "pk use agent query" and "pk use agent: query" syntaxes
    let agentName = argv.agent || (argv._[1] as string) || '';
    let query = argv.query || (argv._[2] as string) || '';

    // Check if we have the colon syntax in a single argument
    if (!query && agentName.includes(':')) {
      const parsed = parseUseCommandSyntax(agentName);
      if (parsed) {
        agentName = parsed.agent;
        query = parsed.query;
      }
    }

    if (!agentName || !query) {
      console.error(
        'Usage: pk use <agent> <query> or pk use "<agent>: <query>"',
      );
      console.error(
        'Example: pk use qwen-code-engineer "Fix the authentication bug"',
      );
      console.error(
        'Example: pk use "debug-detective: Investigate performance issue"',
      );
      process.exit(1);
    }

    // Load necessary configuration for the use command
    const workspaceRoot = process.cwd();
    const settings = loadSettings(workspaceRoot);

    if (settings.errors.length > 0) {
      for (const error of settings.errors) {
        let errorMessage = `Error in ${error.path}: ${error.message}`;
        if (!process.env.NO_COLOR) {
          errorMessage = `\x1b[31m${errorMessage}\x1b[0m`;
        }
        console.error(errorMessage);
        console.error(`Please fix ${error.path} and try again.`);
      }
      process.exit(1);
    }

    const extensions = loadExtensions(workspaceRoot);
    const config = await loadCliConfig(
      settings.merged,
      extensions,
      sessionId,
      argv,
    );

    await config.initialize();

    await handleUseCommand(agentName, query, config);
    process.exit(0);
  }
  if (argv._[0] === 'agent') {
    agentCommand.parse(process.argv.slice(1));
    return;
  }
  const workspaceRoot = process.cwd();
  const settings = loadSettings(workspaceRoot);

  await cleanupCheckpoints();
  if (settings.errors.length > 0) {
    for (const error of settings.errors) {
      let errorMessage = `Error in ${error.path}: ${error.message}`;
      if (!process.env.NO_COLOR) {
        errorMessage = `\x1b[31m${errorMessage}\x1b[0m`;
      }
      console.error(errorMessage);
      console.error(`Please fix ${error.path} and try again.`);
    }
    process.exit(1);
  }

  // Set a default auth type if one isn't set, using environment-based auto-detection
  // Only auto-detect if no auth type is explicitly configured
  if (!settings.merged.selectedAuthType) {
    let autoDetectedAuthType: AuthType;

    // Prioritize based on available API keys in environment
    if (process.env.CLOUD_SHELL === 'true') {
      autoDetectedAuthType = AuthType.CLOUD_SHELL;
    } else if (process.env.OPENROUTER_API_KEY) {
      autoDetectedAuthType = AuthType.USE_OPENROUTER;
    } else if (process.env.OPENAI_API_KEY) {
      autoDetectedAuthType = AuthType.USE_OPENAI;
    } else if (process.env.GEMINI_API_KEY) {
      autoDetectedAuthType = AuthType.USE_GEMINI;
    } else {
      // Default to OpenRouter if no API keys are present
      autoDetectedAuthType = AuthType.USE_OPENROUTER;
    }

    console.debug(
      `Auto-detected auth type: ${autoDetectedAuthType} based on available environment variables`,
    );

    settings.setValue(
      SettingScope.User,
      'selectedAuthType',
      autoDetectedAuthType,
    );
  } else {
    console.debug(
      `Using configured auth type: ${settings.merged.selectedAuthType}`,
    );
  }

  const extensions = loadExtensions(workspaceRoot);
  const config = await loadCliConfig(
    settings.merged,
    extensions,
    sessionId,
    argv,
  );

  if (argv.promptInteractive && !process.stdin.isTTY) {
    console.error(
      'Error: The --prompt-interactive flag is not supported when piping input from stdin.',
    );
    process.exit(1);
  }

  if (config.getListExtensions()) {
    console.log('Installed extensions:');
    for (const extension of extensions) {
      console.log(`- ${extension.config.name}`);
    }
    process.exit(0);
  }

  setMaxSizedBoxDebugging(config.getDebugMode());

  await config.initialize();

  if (settings.merged.theme) {
    if (!themeManager.setActiveTheme(settings.merged.theme)) {
      // If the theme is not found during initial load, log a warning and continue.
      // The useThemeCommand hook in App.tsx will handle opening the dialog.
      console.warn(`Warning: Theme "${settings.merged.theme}" not found.`);
    }
  }

  // hop into sandbox if we are outside and sandboxing is enabled
  if (!process.env.SANDBOX) {
    const memoryArgs = settings.merged.autoConfigureMaxOldSpaceSize
      ? getNodeMemoryArgs(config)
      : [];
    const sandboxConfig = config.getSandbox();
    if (sandboxConfig) {
      if (settings.merged.selectedAuthType) {
        // Validate authentication here because the sandbox will interfere with the Oauth2 web redirect.
        try {
          const err = validateAuthMethod(settings.merged.selectedAuthType);
          if (err) {
            throw new Error(err);
          }
          await config.refreshAuth(settings.merged.selectedAuthType);
        } catch (err) {
          console.error('Error authenticating:', err);
          process.exit(1);
        }
      }
      await start_sandbox(sandboxConfig, memoryArgs);
      process.exit(0);
    } else {
      // Not in a sandbox and not entering one, so relaunch with additional
      // arguments to control memory usage if needed.
      if (memoryArgs.length > 0) {
        await relaunchWithAdditionalArgs(memoryArgs);
        process.exit(0);
      }
    }
  }

  if (
    settings.merged.selectedAuthType === AuthType.LOGIN_WITH_GOOGLE &&
    config.getNoBrowser()
  ) {
    // Do oauth before app renders to make copying the link possible.
    await getOauthClient(settings.merged.selectedAuthType, config);
  }

  let input = config.getQuestion();
  const startupWarnings = [
    ...(await getStartupWarnings()),
    ...(await getUserStartupWarnings(workspaceRoot)),
  ];

  const shouldBeInteractive =
    !!argv.promptInteractive || (process.stdin.isTTY && input?.length === 0);

  // Render UI, passing necessary config values. Check that there is no command line question.
  if (shouldBeInteractive) {
    const version = await getCliVersion();
    setWindowTitle(basename(workspaceRoot), settings);
    const instance = render(
      <React.StrictMode>
        <AppWrapper
          config={config}
          settings={settings}
          startupWarnings={startupWarnings}
          version={version}
        />
      </React.StrictMode>,
      { exitOnCtrlC: false },
    );

    registerCleanup(() => instance.unmount());
    return;
  }
  // If not a TTY, read from stdin
  // This is for cases where the user pipes input directly into the command
  if (!process.stdin.isTTY && !input) {
    input += await readStdin();
  }
  if (!input) {
    console.error('No input provided via stdin.');
    process.exit(1);
  }

  const prompt_id = Math.random().toString(16).slice(2);
  logUserPrompt(config, {
    'event.name': 'user_prompt',
    'event.timestamp': new Date().toISOString(),
    prompt: input,
    prompt_id,
    auth_type: config.getContentGeneratorConfig()?.authType,
    prompt_length: input.length,
  });

  // Non-interactive mode handled by runNonInteractive
  const nonInteractiveConfig = await loadNonInteractiveConfig(
    config,
    extensions,
    settings,
    argv,
  );

  await runNonInteractive(nonInteractiveConfig, input, prompt_id);
  process.exit(0);
}

function setWindowTitle(title: string, settings: LoadedSettings) {
  if (!settings.merged.hideWindowTitle) {
    const windowTitle = (process.env.CLI_TITLE || `Qwen - ${title}`).replace(
      // eslint-disable-next-line no-control-regex
      /[\x00-\x1F\x7F]/g,
      '',
    );
    process.stdout.write(`\x1b]2;${windowTitle}\x07`);

    process.on('exit', () => {
      process.stdout.write(`\x1b]2;\x07`);
    });
  }
}

// --- Global Unhandled Rejection Handler ---
process.on('unhandledRejection', (reason, _promise) => {
  // Log other unexpected unhandled rejections as critical errors
  console.error('=========================================');
  console.error('CRITICAL: Unhandled Promise Rejection!');
  console.error('=========================================');
  console.error('Reason:', reason);
  console.error('Stack trace may follow:');
  if (!(reason instanceof Error)) {
    console.error(reason);
  }
  // Exit for genuinely unhandled errors
  process.exit(1);
});

async function loadNonInteractiveConfig(
  config: Config,
  extensions: Extension[],
  settings: LoadedSettings,
  argv: CliArgs,
) {
  let finalConfig = config;
  if (config.getApprovalMode() !== ApprovalMode.YOLO) {
    // Everything is not allowed, ensure that only read-only tools are configured.
    const existingExcludeTools = settings.merged.excludeTools || [];
    const interactiveTools = [
      ShellTool.Name,
      EditTool.Name,
      WriteFileTool.Name,
    ];

    const newExcludeTools = [
      ...new Set([...existingExcludeTools, ...interactiveTools]),
    ];

    const nonInteractiveSettings = {
      ...settings.merged,
      excludeTools: newExcludeTools,
    };
    finalConfig = await loadCliConfig(
      nonInteractiveSettings,
      extensions,
      config.getSessionId(),
      argv,
    );
    await finalConfig.initialize();
  }

  return await validateNonInterActiveAuth(
    settings.merged.selectedAuthType,
    finalConfig,
  );
}

async function validateNonInterActiveAuth(
  selectedAuthType: AuthType | undefined,
  nonInteractiveConfig: Config,
) {
  // making a special case for the cli. many headless environments might not have a settings.json set
  // so if any API key is set, we'll use that. However since the oauth things are interactive anyway, we'll
  // still expect that exists
  if (
    !selectedAuthType &&
    !process.env.GEMINI_API_KEY &&
    !process.env.OPENROUTER_API_KEY &&
    !process.env.OPENAI_API_KEY
  ) {
    console.error(
      `Please set an Auth method in your ${USER_SETTINGS_PATH} OR specify GEMINI_API_KEY, OPENROUTER_API_KEY, or OPENAI_API_KEY env variable file before running`,
    );
    process.exit(1);
  }

  // Auto-select auth type based on available credentials only if not already configured
  if (!selectedAuthType) {
    if (process.env.OPENROUTER_API_KEY) {
      selectedAuthType = AuthType.USE_OPENROUTER;
      console.debug(
        'Auto-selected OpenRouter for non-interactive mode based on OPENROUTER_API_KEY',
      );
    } else if (process.env.OPENAI_API_KEY) {
      selectedAuthType = AuthType.USE_OPENAI;
      console.debug(
        'Auto-selected OpenAI for non-interactive mode based on OPENAI_API_KEY',
      );
    } else if (process.env.GEMINI_API_KEY) {
      selectedAuthType = AuthType.USE_GEMINI;
      console.debug(
        'Auto-selected Gemini for non-interactive mode based on GEMINI_API_KEY',
      );
    } else {
      selectedAuthType = AuthType.USE_GEMINI;
      console.debug(
        'Defaulting to Gemini for non-interactive mode (no API keys found)',
      );
    }
  } else {
    console.debug(
      `Using configured auth type for non-interactive mode: ${selectedAuthType}`,
    );
  }
  const err = validateAuthMethod(selectedAuthType);
  if (err != null) {
    console.error(err);
    process.exit(1);
  }

  await nonInteractiveConfig.refreshAuth(selectedAuthType);
  return nonInteractiveConfig;
}
