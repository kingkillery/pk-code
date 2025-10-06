/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Command } from './types.js';
import { SettingScope } from '../../config/settings.js';

export const settingsCommand: Command = {
  name: 'settings',
  description: 'View and edit configuration settings',
  action: async (context, args) => {
    const {
      services: { config, settings },
    } = context;

    if (!config || !settings) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Config or settings not available',
      };
    }

    const subCommand = args.trim();

    // If no subcommand, show current settings
    if (!subCommand) {
      const currentSettings = {
        'Default Model': settings.merged.defaultModel || 'Not set',
        'Auth Type': settings.merged.selectedAuthType || 'Not set',
        Theme: settings.merged.theme || 'Not set',
        Sandbox: settings.merged.sandbox || 'Not set',
        'Telemetry Enabled': settings.merged.telemetry?.enabled ? 'Yes' : 'No',
        'Usage Statistics': settings.merged.usageStatisticsEnabled
          ? 'Yes'
          : 'No',
        'Show Memory Usage': settings.merged.showMemoryUsage ? 'Yes' : 'No',
        'Auto Configure Memory': settings.merged.autoConfigureMaxOldSpaceSize
          ? 'Yes'
          : 'No',
      };

      const settingsList = Object.entries(currentSettings)
        .map(([key, value]) => `  ${key}: ${value}`)
        .join('\n');

      return {
        type: 'message',
        messageType: 'info',
        content: `Current Settings:\n${settingsList}\n\nUse '/settings set <key> <value>' to change a setting.\nUse '/settings reset <key>' to reset a setting.`,
      };
    }

    // Handle set command
    if (subCommand.startsWith('set ')) {
      const parts = subCommand.substring(4).split(' ');
      if (parts.length < 2) {
        return {
          type: 'message',
          messageType: 'error',
          content: 'Usage: /settings set <key> <value>',
        };
      }

      const [key, ...valueParts] = parts;
      const value = valueParts.join(' ');

      try {
        switch (key) {
          case 'defaultModel': {
            settings.setValue(SettingScope.User, 'defaultModel', value);
            return {
              type: 'message',
              messageType: 'info',
              content: `Default model set to: ${value}`,
            };
          }

          case 'theme': {
            settings.setValue(SettingScope.User, 'theme', value);
            return {
              type: 'message',
              messageType: 'info',
              content: `Theme set to: ${value}`,
            };
          }

          case 'telemetry': {
            const telemetryEnabled =
              value.toLowerCase() === 'true' ||
              value === '1' ||
              value === 'yes';
            settings.setValue(SettingScope.User, 'telemetry', {
              ...settings.merged.telemetry,
              enabled: telemetryEnabled,
            });
            return {
              type: 'message',
              messageType: 'info',
              content: `Telemetry ${telemetryEnabled ? 'enabled' : 'disabled'}`,
            };
          }

          case 'usageStatistics': {
            const usageEnabled =
              value.toLowerCase() === 'true' ||
              value === '1' ||
              value === 'yes';
            settings.setValue(
              SettingScope.User,
              'usageStatisticsEnabled',
              usageEnabled,
            );
            return {
              type: 'message',
              messageType: 'info',
              content: `Usage statistics ${usageEnabled ? 'enabled' : 'disabled'}`,
            };
          }

          case 'showMemoryUsage': {
            const memoryEnabled =
              value.toLowerCase() === 'true' ||
              value === '1' ||
              value === 'yes';
            settings.setValue(
              SettingScope.User,
              'showMemoryUsage',
              memoryEnabled,
            );
            return {
              type: 'message',
              messageType: 'info',
              content: `Memory usage display ${memoryEnabled ? 'enabled' : 'disabled'}`,
            };
          }

          case 'autoConfigureMemory': {
            const autoMemoryEnabled =
              value.toLowerCase() === 'true' ||
              value === '1' ||
              value === 'yes';
            settings.setValue(
              SettingScope.User,
              'autoConfigureMaxOldSpaceSize',
              autoMemoryEnabled,
            );
            return {
              type: 'message',
              messageType: 'info',
              content: `Auto memory configuration ${autoMemoryEnabled ? 'enabled' : 'disabled'}`,
            };
          }

          default:
            return {
              type: 'message',
              messageType: 'error',
              content: `Unknown setting: ${key}. Available settings: defaultModel, theme, telemetry, usageStatistics, showMemoryUsage, autoConfigureMemory`,
            };
        }
      } catch (error) {
        return {
          type: 'message',
          messageType: 'error',
          content: `Failed to update setting: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }

    // Handle reset command
    if (subCommand.startsWith('reset ')) {
      const key = subCommand.substring(6);

      try {
        switch (key) {
          case 'defaultModel': {
            settings.setValue(SettingScope.User, 'defaultModel', undefined);
            return {
              type: 'message',
              messageType: 'info',
              content: 'Default model reset to default',
            };
          }

          case 'theme': {
            settings.setValue(SettingScope.User, 'theme', undefined);
            return {
              type: 'message',
              messageType: 'info',
              content: 'Theme reset to default',
            };
          }

          case 'telemetry': {
            settings.setValue(SettingScope.User, 'telemetry', undefined);
            return {
              type: 'message',
              messageType: 'info',
              content: 'Telemetry settings reset to default',
            };
          }

          case 'usageStatistics': {
            settings.setValue(
              SettingScope.User,
              'usageStatisticsEnabled',
              undefined,
            );
            return {
              type: 'message',
              messageType: 'info',
              content: 'Usage statistics reset to default',
            };
          }

          case 'showMemoryUsage': {
            settings.setValue(SettingScope.User, 'showMemoryUsage', undefined);
            return {
              type: 'message',
              messageType: 'info',
              content: 'Memory usage display reset to default',
            };
          }

          case 'autoConfigureMemory': {
            settings.setValue(
              SettingScope.User,
              'autoConfigureMaxOldSpaceSize',
              undefined,
            );
            return {
              type: 'message',
              messageType: 'info',
              content: 'Auto memory configuration reset to default',
            };
          }

          default:
            return {
              type: 'message',
              messageType: 'error',
              content: `Unknown setting: ${key}. Available settings: defaultModel, theme, telemetry, usageStatistics, showMemoryUsage, autoConfigureMemory`,
            };
        }
      } catch (error) {
        return {
          type: 'message',
          messageType: 'error',
          content: `Failed to reset setting: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }

    return {
      type: 'message',
      messageType: 'error',
      content: 'Usage: /settings [set <key> <value> | reset <key>]',
    };
  },
};
