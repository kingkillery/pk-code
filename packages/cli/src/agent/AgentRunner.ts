import { AgentConfig } from '@pk-code/core';

export type AgentStatus = 'pending' | 'running' | 'success' | 'error';

export class AgentRunner {
  agent: AgentConfig;
  status: AgentStatus = 'pending';
  latestOutput = '';

  constructor(agent: AgentConfig) {
    this.agent = agent;
  }

  async run() {
    this.status = 'running';
    this.latestOutput = 'Agent is running...';

    // Simulate agent work
    await new Promise((resolve) => setTimeout(resolve, 2000));

    this.status = 'success';
    this.latestOutput = 'Agent finished successfully.';
  }
}
