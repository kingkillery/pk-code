/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpenDialogActionReturn, Command, CommandContext } from './types.js';

export const diagnosticsCommand: Command = {
  name: 'diagnostics',
  altName: 'diag',
  description: 'Show system diagnostics and configuration status',
  action: (_context: CommandContext, _args: string): OpenDialogActionReturn => {
    console.debug('Opening diagnostics panel ...');
    return {
      type: 'dialog',
      dialog: 'diagnostics',
    };
  },
};
