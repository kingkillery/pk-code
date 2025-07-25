/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpenDialogActionReturn, Command, CommandContext } from './types.js';

export const authCommand: Command = {
  name: 'auth',
  description: 'change the auth method',
  action: (_context: CommandContext, _args: string): OpenDialogActionReturn => ({
    type: 'dialog',
    dialog: 'auth',
  }),
};
