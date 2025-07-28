import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRunner } from './AgentRunner';
import { AgentConfig } from '@pk-code/core';

describe('AgentRunner', () => {
  const mockAgent: AgentConfig = {
    name: 'test-agent',
    description: 'A test agent for unit testing',
    keywords: ['test', 'unit'],
    tools: [],
    model: 'gpt-4',
    provider: 'openai',
    examples: [],
    systemPrompt: 'You are a test agent.',
  };

  let runner: AgentRunner;

  beforeEach(() => {
    runner = new AgentRunner(mockAgent);
  });

  it('should initialize with correct agent and default values', () => {
    expect(runner.agent).toBe(mockAgent);
    expect(runner.status).toBe('pending');
    expect(runner.latestOutput).toBe('');
  });

  it('should update status and output during run', async () => {
    const runPromise = runner.run();
    
    // Initially should be running
    expect(runner.status).toBe('running');
    expect(runner.latestOutput).toBe('Agent is running...');
    
    // Wait for completion
    await runPromise;
    
    // Should be success after completion
    expect(runner.status).toBe('success');
    expect(runner.latestOutput).toBe('Agent finished successfully.');
  });

  it('should handle agent run lifecycle correctly', async () => {
    // Track status changes
    const statusChanges: string[] = [];
    const outputChanges: string[] = [];
    
    // Start the run process
    const runPromise = runner.run();
    
    // Capture initial status
    statusChanges.push(runner.status);
    outputChanges.push(runner.latestOutput);
    
    // Wait for completion
    await runPromise;
    
    // Capture final status
    statusChanges.push(runner.status);
    outputChanges.push(runner.latestOutput);
    
    expect(statusChanges).toEqual(['running', 'success']);
    expect(outputChanges).toEqual(['Agent is running...', 'Agent finished successfully.']);
  });

  it('should work with different agent configurations', () => {
    const customAgent: AgentConfig = {
      name: 'custom-agent',
      description: 'A custom agent',
      keywords: ['custom'],
      tools: [{ name: 'file-system' }],
      model: 'claude-3',
      provider: 'anthropic',
      examples: [],
      systemPrompt: 'You are a custom agent.',
      color: 'red',
    };

    const customRunner = new AgentRunner(customAgent);
    
    expect(customRunner.agent.name).toBe('custom-agent');
    expect(customRunner.agent.color).toBe('red');
    expect(customRunner.status).toBe('pending');
  });
});
