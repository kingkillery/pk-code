/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Command } from './types.js';

export const browserUseCommand: Command = {
  name: 'browser-use',
  description:
    'Launch Browser-use either via API (requires BROWSER_USE_API_KEY) or locally via the Browser-use CLI (MCP agent).',
  subCommands: [
    {
      name: 'api',
      description: 'Use the Browser Use API integration (requires BROWSER_USE_API_KEY).',
      action: async ({ ui }) => {
        const apiKey = process.env.BROWSER_USE_API_KEY;
        if (!apiKey) {
          return {
            type: 'message',
            messageType: 'error',
            content:
              '❌ BROWSER_USE_API_KEY is not set. Set it and restart the app. Example (PowerShell):\n  $env:BROWSER_USE_API_KEY = "<your-key>"\nThen try again with /browser-use api',
          };
        }
        return {
          type: 'message',
          messageType: 'info',
          content:
            '✅ Browser Use API mode selected. You can now use the built-in "browser_use" tool. Example:\n  Use the browser_use tool with action "create_task" and task "Go to google.com and search for AI news"',
        };
      },
    },
    {
      name: 'local',
      description:
        'Use the local Browser-use CLI via MCP (requires pk config browser and agent running).',
      action: async () => {
        return {
          type: 'message',
          messageType: 'info',
          content:
            '🧭 Local mode selected. If not already running, start the agent with:\n  pk agent start browser\nStop with:\n  pk agent stop browser\nOnce running, browser.* MCP tools will be available to the agent.',
        };
      },
    },
  ],
};

