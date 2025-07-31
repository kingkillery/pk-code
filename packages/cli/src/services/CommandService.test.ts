/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandService } from './CommandService.js';
import { Command } from '../ui/commands/types.js';

// Mock commands for testing
const mockCommand1: Command = {
  name: 'test1',
  description: 'Test command 1',
  action: vi.fn(),
};

const mockCommand2: Command = {
  name: 'test2',
  description: 'Test command 2',
  action: vi.fn(),
};

describe('CommandService', () => {
  let commandService: CommandService;
  let mockCommandLoader: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCommandLoader = vi.fn();
    commandService = new CommandService(mockCommandLoader);
  });

  describe('constructor', () => {
    it('should create a CommandService instance with default loader', () => {
      const service = new CommandService();
      expect(service).toBeInstanceOf(CommandService);
    });

    it('should create a CommandService instance with custom loader', () => {
      const customLoader = vi.fn();
      const service = new CommandService(customLoader);
      expect(service).toBeInstanceOf(CommandService);
    });
  });

  describe('loadCommands', () => {
    it('should load commands using the provided loader', async () => {
      const mockCommands = [mockCommand1, mockCommand2];
      mockCommandLoader.mockResolvedValue(mockCommands);

      await commandService.loadCommands();

      expect(mockCommandLoader).toHaveBeenCalled();
    });

    it('should handle loader that returns empty array', async () => {
      mockCommandLoader.mockResolvedValue([]);

      await commandService.loadCommands();

      expect(commandService.getCommands()).toEqual([]);
    });

    it('should handle loader that throws an error', async () => {
      const errorMessage = 'Failed to load commands';
      mockCommandLoader.mockRejectedValue(new Error(errorMessage));

      await expect(commandService.loadCommands()).rejects.toThrow(errorMessage);
    });
  });

  describe('getCommands', () => {
    it('should return empty array before loading commands', () => {
      expect(commandService.getCommands()).toEqual([]);
    });

    it('should return loaded commands after loading', async () => {
      const mockCommands = [mockCommand1, mockCommand2];
      mockCommandLoader.mockResolvedValue(mockCommands);

      await commandService.loadCommands();

      expect(commandService.getCommands()).toEqual(mockCommands);
    });

    it('should return the same array reference on multiple calls', async () => {
      const mockCommands = [mockCommand1];
      mockCommandLoader.mockResolvedValue(mockCommands);

      await commandService.loadCommands();

      const firstCall = commandService.getCommands();
      const secondCall = commandService.getCommands();

      expect(firstCall).toBe(secondCall);
    });
  });
});