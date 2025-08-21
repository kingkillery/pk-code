import { AgentConfig, createCodeAssistContentGenerator, AuthType } from '@pk-code/core';
import { Config } from '@pk-code/core/src/config/config.js';

export type AgentStatus = 'pending' | 'running' | 'success' | 'error';

export class EnhancedAgentRunner {
  agent: AgentConfig;
  status: AgentStatus = 'pending';
  latestOutput = '';
  private sessionId: string;

  constructor(agent: AgentConfig, sessionId?: string) {
    this.agent = agent;
    this.sessionId = sessionId || Math.random().toString(36).substring(2, 15);
  }

  async run(query: string, config: Config): Promise<{output: string, sessionId: string}> {
    this.status = 'running';
    this.latestOutput = `Agent "${this.agent.name}" is running with isolated context...`;
    
    try {
      // Create isolated content generator for this agent
      const version = process.env.CLI_VERSION || process.version;
      const httpOptions = {
        headers: {
          'User-Agent': `PK-Code-CLI/${version} (${process.platform}; ${process.arch})`,
        },
      };

      const contentGenerator = await createCodeAssistContentGenerator(
        httpOptions,
        AuthType.LOGIN_WITH_GOOGLE,
        config,
      );

      // Build the system prompt with agent context
      const systemPrompt =
        this.agent.systemPrompt ||
        `You are ${this.agent.name}: ${this.agent.description}`;

      // Prepare the request with agent-specific parameters
      const request = {
        model: this.agent.model || 'gemini-pro',
        contents: [
          {
            role: 'user' as const,
            parts: [{ text: `${systemPrompt}\n\nUser Query: ${query}` }],
          },
        ],
        generationConfig: {
          temperature: this.agent.temperature || 0.7,
          maxOutputTokens: this.agent.maxTokens || 2048,
        },
      };

      // Execute the content generation
      const response = await contentGenerator.generateContent(request);

      // Extract and return the response
      const responseText =
        response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      this.status = 'success';
      this.latestOutput = responseText;
      
      return {
        output: responseText,
        sessionId: this.sessionId
      };
    } catch (error) {
      this.status = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.latestOutput = `Error during agent execution: ${errorMessage}`;
      
      return {
        output: this.latestOutput,
        sessionId: this.sessionId
      };
    }
  }
  
  getStatus(): { status: AgentStatus, output: string, sessionId: string } {
    return {
      status: this.status,
      output: this.latestOutput,
      sessionId: this.sessionId
    };
  }
}