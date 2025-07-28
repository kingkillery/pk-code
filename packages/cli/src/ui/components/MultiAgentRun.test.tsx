import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import { MultiAgentRun } from './MultiAgentRun';
import { AgentRunner } from '../../agent/AgentRunner';
import { AgentConfig } from '@pk-code/core';

describe('MultiAgentRun', () => {
  let mockRunner1: AgentRunner;
  let mockRunner2: AgentRunner;

  const mockAgent1: AgentConfig = {
    name: 'test-agent-1',
    description: 'First test agent',
    keywords: ['test'],
    tools: [],
    model: 'gpt-4',
    provider: 'openai',
    examples: [],
    systemPrompt: 'You are test agent 1.',
    color: 'blue',
  };

  const mockAgent2: AgentConfig = {
    name: 'test-agent-2',
    description: 'Second test agent',
    keywords: ['test'],
    tools: [],
    model: 'gpt-4',
    provider: 'openai',
    examples: [],
    systemPrompt: 'You are test agent 2.',
    color: 'red',
  };

  beforeEach(() => {
    mockRunner1 = new AgentRunner(mockAgent1);
    mockRunner2 = new AgentRunner(mockAgent2);
    
    // Mock timers for the component's setInterval
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render multiple agent runners', () => {
    const { lastFrame } = render(<MultiAgentRun runners={[mockRunner1, mockRunner2]} />);
    
    expect(lastFrame()).toContain('test-agent-1');
    expect(lastFrame()).toContain('test-agent-2');
    expect(lastFrame()).toContain('pending'); // Default status
  });

  it('should display agent status and output', () => {
    // Update runner states
    mockRunner1.status = 'running';
    mockRunner1.latestOutput = 'Processing task...';
    mockRunner2.status = 'success';
    mockRunner2.latestOutput = 'Task completed successfully';

    const { lastFrame } = render(<MultiAgentRun runners={[mockRunner1, mockRunner2]} />);
    
    expect(lastFrame()).toContain('running');
    expect(lastFrame()).toContain('success');
    expect(lastFrame()).toContain('Processing task...');
    expect(lastFrame()).toContain('Task completed successfully');
  });

  it('should update display when runner states change', () => {
    const { lastFrame, rerender } = render(<MultiAgentRun runners={[mockRunner1]} />);
    
    // Initial state
    expect(lastFrame()).toContain('pending');
    expect(lastFrame()).not.toContain('Agent completed');
    
    // Update runner state
    mockRunner1.status = 'success';
    mockRunner1.latestOutput = 'Agent completed';
    
    // Re-render component
    rerender(<MultiAgentRun runners={[mockRunner1]} />);
    
    // Should show updated state
    expect(lastFrame()).toContain('success');
    expect(lastFrame()).toContain('Agent completed');
  });

  it('should handle empty runners array', () => {
    const { lastFrame } = render(<MultiAgentRun runners={[]} />);
    
    // Should not crash and should render empty container
    expect(lastFrame()).toBeDefined();
    expect(lastFrame()).not.toContain('test-agent');
  });

  it('should handle runners with different colors', () => {
    const { lastFrame } = render(<MultiAgentRun runners={[mockRunner1, mockRunner2]} />);
    
    // The output should contain the agent names
    expect(lastFrame()).toContain('test-agent-1');
    expect(lastFrame()).toContain('test-agent-2');
    
    // Note: Testing actual colors in terminal output is complex,
    // but we can verify the component renders without errors
    expect(lastFrame()).toBeTruthy();
  });

  it('should handle missing agent color gracefully', () => {
    const agentWithoutColor: AgentConfig = {
      ...mockAgent1,
      color: undefined,
    };
    const runnerWithoutColor = new AgentRunner(agentWithoutColor);

    const { lastFrame } = render(<MultiAgentRun runners={[runnerWithoutColor]} />);
    
    expect(lastFrame()).toContain('test-agent-1');
    expect(lastFrame()).toBeTruthy();
  });

  it('should handle runners with different status types', () => {
    const runners = [mockRunner1, mockRunner2];
    runners[0].status = 'running';
    runners[0].latestOutput = 'In progress...';
    runners[1].status = 'error';
    runners[1].latestOutput = 'Something went wrong';

    const { lastFrame } = render(<MultiAgentRun runners={runners} />);
    
    expect(lastFrame()).toContain('running');
    expect(lastFrame()).toContain('error');
    expect(lastFrame()).toContain('In progress...');
    expect(lastFrame()).toContain('Something went wrong');
  });
});
