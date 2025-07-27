import { agentCommand } from './agent.js';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    unref: vi.fn(),
    pid: 1234,
  })),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

describe('agent command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start the browser agent', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await agentCommand.parseAsync(['node', 'pk', 'agent', 'start', 'browser']);
    expect(spawn).toHaveBeenCalledWith(
      'bash',
      [path.resolve('scripts', 'start-browser-agent.sh')],
      { detached: true, stdio: 'ignore' },
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('.taskmaster', 'browser-agent.pid'),
      '1234',
    );
  });

  it('should stop the browser agent', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('1234');
    await agentCommand.parseAsync(['node', 'pk', 'agent', 'stop', 'browser']);
    expect(process.kill).toHaveBeenCalledWith(1234, 'SIGTERM');
    expect(fs.unlinkSync).toHaveBeenCalledWith(
      path.join('.taskmaster', 'browser-agent.pid'),
    );
  });
});
