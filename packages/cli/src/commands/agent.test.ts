import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleAgentCommand } from './agent.js';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  getAgentsDir,
  parseAgentFromFile,
  agentCommands,
} from '../ui/commands/agentCommands.js';
import { AgentRunner } from '../agent/AgentRunner.js';

interface MockAgent {
  name: string;
  description: string;
  keywords?: string[];
  model?: string;
  provider?: string;
  tools?: Array<{ name: string }>;
  systemPrompt?: string;
}

// Mock UI commands that are imported
vi.mock('../ui/commands/agentCommands.js', () => ({
  getAgentsDir: vi.fn(() => '/mock/agents'),
  ensureAgentsDir: vi.fn(),
  parseAgentFromFile: vi.fn(),
  agentCommands: {
    run: vi.fn(),
  },
}));

// Mock AgentRunner
vi.mock('../agent/AgentRunner.js', () => ({
  AgentRunner: vi.fn(),
}));

// Mock util module
vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    promisify: vi.fn((fn) => fn),
  };
});

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    spawn: vi.fn(() => ({
      unref: vi.fn(),
      pid: 1234,
    })),
  };
});

// Mock net module for port checking
vi.mock('net', () => ({
  createServer: vi.fn(() => {
    const server = {
      once: vi.fn(),
      close: vi.fn(),
      listen: vi.fn(),
    };
    // Simulate port in use
    server.once.mockImplementation((event, callback) => {
      if (event === 'error') {
        // @ts-ignore
        callback({ code: 'EADDRINUSE' });
      }
      return server;
    });
    return server;
  }),
}));

describe('Browser Agent Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show error if browser-use is not installed', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false); // PID file
    // Mock require.resolve to throw an error, simulating package not found
    vi.mock('browser-use/package.json', () => {
      throw new Error("Cannot find module 'browser-use/package.json'");
    });

    await handleAgentCommand('start', 'browser');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: The "browser-use" package is not installed.');
    expect(mockConsoleError).toHaveBeenCalledWith('Please install it by running: npm install -g browser-use');
  });

  it('should show error if Chrome path is not configured', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false); // PID file
    vi.mock('browser-use/package.json', () => ({})); // Mock package as installed
    vi.mocked(fs.readFileSync).mockReturnValueOnce(JSON.stringify({})); // Global settings

    await handleAgentCommand('start', 'browser');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Chrome executable path is not configured or is invalid.');
  });

  it('should show error if browser-use config is missing', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (p.toString().endsWith('settings.json')) return true;
      if (p.toString().endsWith('.mcp.json')) return false;
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValueOnce(JSON.stringify({ chromePath: '/mock/chrome' })); // Global settings

    await handleAgentCommand('start', 'browser');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: browser-use MCP server configuration not found.');
  });

  it('should show error if agent is already running', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true); // PID file
    vi.mocked(fs.readFileSync).mockReturnValue('1234');
    processKillSpy.mockImplementation(() => true); // Process is running

    await handleAgentCommand('start', 'browser');

    expect(mockConsoleLog).toHaveBeenCalledWith('Browser agent is already running with PID: 1234. To stop it, run "pk agent stop browser".');
  });

  it('should show error if agent is not running on stop', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false); // PID file

    await handleAgentCommand('stop', 'browser');

    expect(mockConsoleLog).toHaveBeenCalledWith('Browser agent is not running.');
  });

  it('should handle stale PID file on start', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true); // PID file
    vi.mocked(fs.readFileSync).mockReturnValue('1234');
    processKillSpy.mockImplementation(() => {
      throw new Error('ESRCH');
    }); // Process not found

    // Mock the rest of the start sequence to prevent further errors in this test
    vi.mock('browser-use/package.json', () => ({}));
    vi.mocked(fs.readFileSync).mockReturnValueOnce(JSON.stringify({ chromePath: '/mock/chrome' }));

    await handleAgentCommand('start', 'browser');

    expect(console.warn).toHaveBeenCalledWith('Found stale PID file from a previous session. Removing it.');
    expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('browser-agent.pid'));
  });

  it('should handle stale PID file on stop', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true); // PID file
    vi.mocked(fs.readFileSync).mockReturnValue('5678');
    processKillSpy.mockImplementation(() => {
      throw new Error('ESRCH');
    }); // Process not found

    await handleAgentCommand('stop', 'browser');

    expect(console.warn).toHaveBeenCalledWith('Stale PID file found for a non-existent process (PID: 5678). Cleaning up.');
    expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('browser-agent.pid'));
  });
});

// Mock console methods to avoid noise in tests
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi
  .spyOn(console, 'error')
  .mockImplementation(() => {});


// Mock process.kill
const processKillSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

describe('agent command', () => {
  const mockProjectRoot = '/test/project';
  const mockAgentsDir = path.join(mockProjectRoot, '.pk', 'agents');

  beforeEach(() => {
    vi.clearAllMocks();
    processKillSpy.mockClear();
    vi.spyOn(process, 'cwd').mockReturnValue(mockProjectRoot);
    vi.mocked(getAgentsDir).mockReturnValue(mockAgentsDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show help when no command is provided', async () => {
    await handleAgentCommand('');
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Usage: pk agent <command> [args]',
    );
  });

  it('should show help for unknown commands', async () => {
    await handleAgentCommand('unknown-command');
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Error: Unknown command: unknown-command\n',
    );
  });

  it('should handle list command when no agents exist', async () => {
    vi.mocked(fs.promises.access).mockRejectedValue(
      new Error('Directory not found'),
    );

    await handleAgentCommand('list');

    expect(mockConsoleLog).toHaveBeenCalledWith(
      'No agents directory found. Use "pk agent create" to create your first agent.',
    );
  });

  it('should handle list command with existing agents', async () => {
    const mockAgentFiles = ['agent1.md', 'agent2.json', 'not-agent.txt'];
    const mockAgent1 = { name: 'agent1', description: 'Test agent 1' };
    const mockAgent2 = { name: 'agent2', description: 'Test agent 2' };

    vi.mocked(fs.promises.access).mockResolvedValue(undefined);
    vi.mocked(fs.promises.readdir).mockResolvedValue(mockAgentFiles as fs.Dirent[]);
    vi.mocked(fs.promises.readFile).mockResolvedValue('mock file content');
    vi.mocked(parseAgentFromFile)
      .mockResolvedValueOnce(mockAgent1 as MockAgent)
      .mockResolvedValueOnce(mockAgent2 as MockAgent);

    await handleAgentCommand('list');

    expect(mockConsoleLog).toHaveBeenCalledWith('\n🤖 Available Agents (2):\n');
    expect(mockConsoleLog).toHaveBeenCalledWith('- agent1');
    expect(mockConsoleLog).toHaveBeenCalledWith('- agent2');
  });

  it('should handle show command for existing agent', async () => {
    const mockAgent = {
      name: 'test-agent',
      description: 'Test description',
      keywords: ['test', 'demo'],
      model: 'gpt-4',
      provider: 'openai',
      tools: [{ name: 'file-system' }],
      systemPrompt: 'You are a test agent.',
    };

    vi.mocked(fs.promises.access).mockResolvedValue(undefined);
    vi.mocked(fs.promises.readFile).mockResolvedValue('mock file content');
    vi.mocked(parseAgentFromFile).mockResolvedValue(mockAgent as MockAgent);

    await handleAgentCommand('show', 'test-agent');

    expect(mockConsoleLog).toHaveBeenCalledWith('\n🤖 Agent: test-agent\n');
    expect(mockConsoleLog).toHaveBeenCalledWith(
      '  Description: Test description',
    );
    expect(mockConsoleLog).toHaveBeenCalledWith('  Keywords: test, demo');
  });

  it('should handle show command for non-existent agent', async () => {
    vi.mocked(fs.promises.access).mockRejectedValue(
      new Error('File not found'),
    );

    await handleAgentCommand('show', 'non-existent');

    expect(mockConsoleError).toHaveBeenCalledWith(
      'Agent "non-existent" not found.',
    );
  });

  it('should handle delete command for existing agent', async () => {
    vi.mocked(fs.promises.access).mockResolvedValue(undefined);
    vi.mocked(fs.promises.unlink).mockResolvedValue(undefined);

    await handleAgentCommand('delete', 'test-agent');

    expect(mockConsoleLog).toHaveBeenCalledWith(
      '✅ Agent "test-agent" deleted successfully.',
    );
  });

  it('should handle delete command for non-existent agent', async () => {
    vi.mocked(fs.promises.access).mockRejectedValue(
      new Error('File not found'),
    );

    await handleAgentCommand('delete', 'non-existent');

    expect(mockConsoleError).toHaveBeenCalledWith(
      'Agent "non-existent" not found.',
    );
  });

  it('should handle run command with single agent', async () => {
    const mockAgent = { name: 'test-agent', description: 'Test agent' };
    const mockRunner = { agent: mockAgent, status: 'pending', run: vi.fn() };

    vi.mocked(fs.promises.access).mockResolvedValue(undefined);
    vi.mocked(fs.promises.readFile).mockResolvedValue('mock content');
    vi.mocked(parseAgentFromFile).mockResolvedValue(mockAgent as MockAgent);
    vi.mocked(AgentRunner).mockImplementation(() => mockRunner);

    await handleAgentCommand('run', 'test-agent');

    expect(AgentRunner).toHaveBeenCalledWith(mockAgent);
    expect(agentCommands.run).toHaveBeenCalledWith([mockRunner]);
  });

  it('should handle run command with multiple agents', async () => {
    const mockAgent1 = { name: 'agent1', description: 'Agent 1' };
    const mockAgent2 = { name: 'agent2', description: 'Agent 2' };
    const mockRunner1 = { agent: mockAgent1, status: 'pending', run: vi.fn() };
    const mockRunner2 = { agent: mockAgent2, status: 'pending', run: vi.fn() };

    vi.mocked(fs.promises.access).mockResolvedValue(undefined);
    vi.mocked(fs.promises.readFile).mockResolvedValue('mock content');
    vi.mocked(parseAgentFromFile)
      .mockResolvedValueOnce(mockAgent1)
      .mockResolvedValueOnce(mockAgent2);
    vi.mocked(AgentRunner)
      .mockImplementationOnce(() => mockRunner1)
      .mockImplementationOnce(() => mockRunner2);

    await handleAgentCommand('run', 'agent1,agent2');

    expect(AgentRunner).toHaveBeenCalledTimes(2);
    expect(agentCommands.run).toHaveBeenCalledWith([mockRunner1, mockRunner2]);
  });

  it('should handle run command with non-existent agent', async () => {
    vi.mocked(fs.promises.access).mockRejectedValue(
      new Error('File not found'),
    );

    await expect(handleAgentCommand('run', 'non-existent')).rejects.toThrow(
      'Agent "non-existent" not found.',
    );
  });

  it.skip('should start the browser agent', async () => {
    // Mock process.platform for consistent test behavior
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      configurable: true,
    });

    // Set up the sequence of fs.existsSync calls in order
    const mockExistsSync = vi.mocked(fs.existsSync);
    mockExistsSync
      .mockReturnValueOnce(false) // PID file doesn't exist (first check)
      .mockReturnValueOnce(true) // .mcp.json exists
      .mockReturnValueOnce(false) // .taskmaster directory doesn't exist initially
      .mockReturnValueOnce(true); // script file exists

    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

    await handleAgentCommand('start', 'browser');

    expect(spawn).toHaveBeenCalledWith(
      'bash',
      [path.resolve('scripts', 'start-browser-agent.sh')],
      { detached: true, stdio: 'ignore' },
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('.taskmaster', 'browser-agent.pid'),
      '1234',
    );

    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  });

  it.skip('should stop the browser agent', async () => {
    // Mock process.platform for consistent test behavior
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      configurable: true,
    });

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('1234');

    await handleAgentCommand('stop', 'browser');

    expect(processKillSpy).toHaveBeenCalledWith(1234, 'SIGTERM');
    expect(fs.unlinkSync).toHaveBeenCalledWith(
      path.join('.taskmaster', 'browser-agent.pid'),
    );

    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  });

  it('should handle unknown agent for start command', async () => {
    await handleAgentCommand('start', 'unknown');
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Only browser agent start is supported',
    );
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Usage: pk agent start browser',
    );
  });

  it('should handle unknown command', async () => {
    await handleAgentCommand('unknown', 'browser');
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Error: Unknown command: unknown\n',
    );
  });

  it('should handle missing arguments for commands that require them', async () => {
    await handleAgentCommand('show');
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Usage: pk agent show <agent-name>',
    );

    await handleAgentCommand('delete');
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Usage: pk agent delete <agent-name>',
    );

    await handleAgentCommand('run');
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Usage: pk agent run <agent1>,<agent2>',
    );
  });

  it('should handle filesystem errors gracefully', async () => {
    vi.mocked(fs.promises.access).mockRejectedValue(
      new Error('Permission denied'),
    );

    await handleAgentCommand('list');

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to list agents:'),
    );
  });
});
