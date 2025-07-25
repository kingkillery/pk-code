/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpenDialogActionReturn, Command, CommandContext } from './types.js';

export const helpCommand: Command = {
  name: 'help',
  altName: '?',
  description: 'for help on qwen code',
  action: (_context: CommandContext, _args: string): OpenDialogActionReturn => {
    console.debug('Opening help UI ...');
    return {
      type: 'dialog',
      dialog: 'help',
    };
  },
};
