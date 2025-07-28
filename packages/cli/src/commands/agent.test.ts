import { handleAgentCommand } from './agent.js';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Mock UI commands that are imported
vi.mock('../ui/commands/agentCommands.js', () => ({
  getAgentsDir: vi.fn(() => '/mock/agents'),
  ensureAgentsDir: vi.fn(),
  parseAgentFromFile: vi.fn(),
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

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

// Mock process.kill
const processKillSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

describe('agent command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processKillSpy.mockClear();
  });

  afterEach(() => {
    processKillSpy.mockRestore();
  });

it.skip('should start the browser agent'
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

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
      .mockReturnValueOnce(true)  // .mcp.json exists
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

    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

it.skip('should stop the browser agent'
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

  it('should handle unknown agent', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handleAgentCommand('start', 'unknown');
    expect(consoleSpy).toHaveBeenCalledWith('Only browser agent start is supported');
    expect(consoleSpy).toHaveBeenCalledWith('Usage: pk agent start browser');
    consoleSpy.mockRestore();
  });

  it('should handle unknown command', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handleAgentCommand('unknown', 'browser');
    expect(consoleSpy).toHaveBeenCalledWith('Unknown command: unknown');
    consoleSpy.mockRestore();
  });

  it('should handle missing arguments', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handleAgentCommand('', '');
    expect(consoleSpy).toHaveBeenCalledWith('Usage: pk agent <command> [args]');
    expect(consoleSpy).toHaveBeenCalledWith('Commands: create, list, delete, start, stop');
    consoleSpy.mockRestore();
  });
});
