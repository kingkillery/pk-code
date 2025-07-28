import { handleAgentCommand } from './agent.js';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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

  it('should start the browser agent', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(false) // PID file doesn't exist
      .mockReturnValueOnce(true); // script file exists

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

    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should stop the browser agent', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('1234');
    await handleAgentCommand('stop', 'browser');
    expect(processKillSpy).toHaveBeenCalledWith(1234, 'SIGTERM');
    expect(fs.unlinkSync).toHaveBeenCalledWith(
      path.join('.taskmaster', 'browser-agent.pid'),
    );
  });

  it('should handle unknown agent', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handleAgentCommand('start', 'unknown');
    expect(consoleSpy).toHaveBeenCalledWith('Unknown agent: unknown');
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
    expect(consoleSpy).toHaveBeenCalledWith(
      'Usage: pk agent <command> <agentName>',
    );
    consoleSpy.mockRestore();
  });
});
