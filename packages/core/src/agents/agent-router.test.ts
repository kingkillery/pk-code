/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AgentRouter,
  RoutingConfidence,
  createAgentRouter,
} from './agent-router.js';
import type { ParsedAgent, AgentConfig, AgentRegistry } from './types.js';

// Mock agent registry
const createMockRegistry = (): AgentRegistry => {
  const agents: ParsedAgent[] = [];

  return {
    getAgents: () => agents,
    getAgent: (name: string) => agents.find((a) => a.config.name === name),
    findAgents: (keywords: string[]) =>
      agents.filter((agent) =>
        keywords.some((keyword) =>
          agent.config.keywords.some((agentKeyword) =>
            agentKeyword.toLowerCase().includes(keyword.toLowerCase()),
          ),
        ),
      ),
    registerAgent: (agent: ParsedAgent) => {
      agents.push(agent);
    },
    unregisterAgent: (name: string) => {
      const index = agents.findIndex((a) => a.config.name === name);
      if (index >= 0) {
        agents.splice(index, 1);
        return true;
      }
      return false;
    },
    clear: () => {
      agents.length = 0;
    },
    size: () => agents.length,
  };
};

const createMockAgent = (
  name: string,
  keywords: string[] = [],
  description = 'Test agent',
  tools: string[] = [],
): ParsedAgent => ({
  config: {
    name,
    description,
    keywords,
    tools: tools.map((tool) => ({ name: tool })),
    model: 'gpt-4',
    provider: 'openai',
    examples: [{ input: 'test', output: 'response' }],
  } as AgentConfig,
  filePath: `/test/agents/${name}.md`,
  source: 'project',
  content: `---\nname: ${name}\n---`,
  lastModified: new Date(),
});

describe('AgentRouter', () => {
  let registry: AgentRegistry;
  let router: AgentRouter;
  let fallbackAgent: ParsedAgent;

  beforeEach(() => {
    registry = createMockRegistry();
    fallbackAgent = createMockAgent(
      'fallback',
      ['general', 'assistant'],
      'General purpose assistant',
    );
    router = new AgentRouter(registry, fallbackAgent);

    // Register test agents
    registry.registerAgent(
      createMockAgent(
        'code-generator',
        ['code', 'generate', 'create', 'javascript', 'typescript'],
        'Generates code for various languages',
        ['edit', 'write', 'create'],
      ),
    );

    registry.registerAgent(
      createMockAgent(
        'debug-specialist',
        ['debug', 'fix', 'error', 'troubleshoot'],
        'Helps debug and fix code issues',
        ['read', 'grep', 'shell'],
      ),
    );

    registry.registerAgent(
      createMockAgent(
        'test-expert',
        ['test', 'testing', 'spec', 'verification'],
        'Creates and manages test suites',
        ['shell', 'read', 'test'],
      ),
    );

    registry.registerAgent(
      createMockAgent(
        'docs-writer',
        ['documentation', 'docs', 'readme', 'comment'],
        'Creates technical documentation',
        ['read', 'write', 'edit'],
      ),
    );

    registry.registerAgent(
      createMockAgent(
        'react-specialist',
        ['react', 'jsx', 'component', 'frontend'],
        'React development specialist',
        ['edit', 'create', 'read'],
      ),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create router with registry', () => {
      const router = new AgentRouter(registry);
      expect(router).toBeDefined();
    });

    it('should create router with fallback agent', () => {
      const router = new AgentRouter(registry, fallbackAgent);
      expect(router).toBeDefined();
    });
  });

  describe('routeSingleAgent', () => {
    it('should route to exact agent when explicitly requested', async () => {
      const query = 'pk use code-generator: "create a function"';
      const result = await router.routeSingleAgent(query);

      expect(result.agent.config.name).toBe('code-generator');
      expect(result.confidence).toBe(RoutingConfidence.EXACT);
      expect(result.reason).toContain('Explicitly requested agent');
    });

    it('should route to best matching agent for code generation', async () => {
      const query = 'generate a JavaScript function to calculate factorial';
      const result = await router.routeSingleAgent(query);

      expect(result.agent.config.name).toBe('code-generator');
      expect(result.confidence).toBeGreaterThanOrEqual(
        RoutingConfidence.MEDIUM,
      );
      expect(result.alternatives).toBeDefined();
    });

    it('should route to debug specialist for error fixing', async () => {
      const query = 'fix this error in my code: TypeError cannot read property';
      const result = await router.routeSingleAgent(query);

      expect(result.agent.config.name).toBe('debug-specialist');
      expect(result.confidence).toBeGreaterThanOrEqual(
        RoutingConfidence.MEDIUM,
      );
    });

    it('should route to test expert for testing queries', async () => {
      const query = 'create unit tests for my API endpoints';
      const result = await router.routeSingleAgent(query);

      expect(result.agent.config.name).toBe('test-expert');
      expect(result.confidence).toBeGreaterThanOrEqual(
        RoutingConfidence.MEDIUM,
      );
    });

    it('should route to docs writer for documentation queries', async () => {
      const query = 'write documentation for this component';
      const result = await router.routeSingleAgent(query);

      expect(result.agent.config.name).toBe('docs-writer');
      expect(result.confidence).toBeGreaterThanOrEqual(
        RoutingConfidence.MEDIUM,
      );
    });

    it('should route to react specialist for React queries', async () => {
      const query = 'create a React component with hooks';
      const result = await router.routeSingleAgent(query);

      expect(result.agent.config.name).toBe('react-specialist');
      expect(result.confidence).toBeGreaterThanOrEqual(
        RoutingConfidence.MEDIUM,
      );
    });

    it('should use fallback agent when no good match found', async () => {
      const query = 'tell me about quantum physics';
      const result = await router.routeSingleAgent(query);

      expect(result.agent.config.name).toBe('fallback');
      expect(result.confidence).toBe(RoutingConfidence.LOW);
      expect(result.reason).toContain('fallback');
    });

    it('should throw error when no agents available and no fallback', async () => {
      const emptyRegistry = createMockRegistry();
      const routerNoFallback = new AgentRouter(emptyRegistry);

      await expect(
        routerNoFallback.routeSingleAgent('test query'),
      ).rejects.toThrow('No suitable agent found');
    });

    it('should handle explicit agent that does not exist', async () => {
      const query = 'pk use nonexistent: "do something"';
      const result = await router.routeSingleAgent(query);

      // Should fall back to normal routing
      expect(result.agent.config.name).not.toBe('nonexistent');
    });
  });

  describe('routeMultipleAgents', () => {
    it('should route to multiple agents for complex queries', async () => {
      const query = 'build a React component with tests and documentation';
      const result = await router.routeMultipleAgents(query, 3);

      expect(result.primaryAgents.length).toBeGreaterThan(0);
      expect(
        result.primaryAgents.length + result.secondaryAgents.length,
      ).toBeLessThanOrEqual(3);
      expect(['parallel', 'sequential', 'prioritized']).toContain(
        result.strategy,
      );
    });

    it('should handle explicit agent invocation in multi-agent mode', async () => {
      const query = 'pk use code-generator: "create a component"';
      const result = await router.routeMultipleAgents(query);

      expect(result.primaryAgents).toHaveLength(1);
      expect(result.primaryAgents[0].agent.config.name).toBe('code-generator');
      expect(result.strategy).toBe('sequential');
    });

    it('should limit to maxAgents parameter', async () => {
      const query = 'complex development task requiring multiple skills';
      const result = await router.routeMultipleAgents(query, 2);

      const totalAgents =
        result.primaryAgents.length + result.secondaryAgents.length;
      expect(totalAgents).toBeLessThanOrEqual(2);
    });

    it('should use prioritized strategy for complex queries', async () => {
      const query =
        'design and implement a scalable microservice architecture with proper testing, documentation, security, and monitoring';
      const result = await router.routeMultipleAgents(query);

      expect(result.strategy).toBe('prioritized');
    });

    it('should provide estimated duration', async () => {
      const query = 'create a simple function';
      const result = await router.routeMultipleAgents(query);

      expect(result.estimatedDuration).toBeGreaterThan(0);
      expect(typeof result.estimatedDuration).toBe('number');
    });
  });

  describe('validateAgentCapability', () => {
    it('should validate agent has required tools for code generation', () => {
      const agent = registry.getAgent('code-generator')!;
      const canHandle = router.validateAgentCapability(
        agent,
        'generate a function',
      );

      expect(canHandle).toBe(true);
    });

    it('should validate agent has required tools for debugging', () => {
      const agent = registry.getAgent('debug-specialist')!;
      const canHandle = router.validateAgentCapability(
        agent,
        'debug this error',
      );

      expect(canHandle).toBe(true);
    });

    it('should reject agent without required tools', () => {
      const agent = registry.getAgent('docs-writer')!;
      const canHandle = router.validateAgentCapability(
        agent,
        'debug complex algorithm',
      );

      expect(canHandle).toBe(false);
    });

    it('should validate technology compatibility', () => {
      const agent = registry.getAgent('react-specialist')!;
      const canHandleReact = router.validateAgentCapability(
        agent,
        'create React component',
      );
      const canHandleVue = router.validateAgentCapability(
        agent,
        'create Vue component',
      );

      expect(canHandleReact).toBe(true);
      expect(canHandleVue).toBe(false);
    });
  });

  describe('query analysis', () => {
    it('should detect explicit agent invocation pattern', async () => {
      const queries = [
        'pk use code-generator: "make a function"',
        'pk use test-expert: "write tests"',
        'pk use   debug-specialist  :  "fix bug"',
      ];

      for (const query of queries) {
        const result = await router.routeSingleAgent(query);
        expect(result.confidence).toBe(RoutingConfidence.EXACT);
      }
    });

    it('should extract keywords correctly', async () => {
      const query = 'generate a TypeScript function with error handling';
      const result = await router.routeSingleAgent(query);

      // Should route to code-generator due to "generate" and "typescript" keywords
      expect(result.agent.config.name).toBe('code-generator');
    });

    it('should detect query intent correctly', async () => {
      const testCases = [
        { query: 'create a new component', expectedAgent: 'code-generator' },
        { query: 'fix this bug in my code', expectedAgent: 'debug-specialist' },
        { query: 'write tests for the function', expectedAgent: 'test-expert' },
        { query: 'document this API', expectedAgent: 'docs-writer' },
      ];

      for (const testCase of testCases) {
        const result = await router.routeSingleAgent(testCase.query);
        expect(result.agent.config.name).toBe(testCase.expectedAgent);
      }
    });

    it('should calculate complexity correctly', async () => {
      const simpleQuery = 'hello';
      const complexQuery =
        'design and implement a scalable microservice architecture with proper testing, documentation, security monitoring and performance optimization';

      const simpleResult = await router.routeMultipleAgents(simpleQuery);
      const complexResult = await router.routeMultipleAgents(complexQuery);

      // Complex query should result in more agents or prioritized strategy
      expect(
        complexResult.primaryAgents.length +
          complexResult.secondaryAgents.length,
      ).toBeGreaterThanOrEqual(
        simpleResult.primaryAgents.length + simpleResult.secondaryAgents.length,
      );
    });
  });

  describe('performance requirements', () => {
    it('should meet ≥80% correct delegation target', async () => {
      const testQueries = [
        { query: 'generate JavaScript code', expectedAgent: 'code-generator' },
        { query: 'fix this error', expectedAgent: 'debug-specialist' },
        { query: 'create unit tests', expectedAgent: 'test-expert' },
        { query: 'write documentation', expectedAgent: 'docs-writer' },
        { query: 'build React component', expectedAgent: 'react-specialist' },
      ];

      let correctRoutes = 0;
      for (const testCase of testQueries) {
        const result = await router.routeSingleAgent(testCase.query);
        if (result.agent.config.name === testCase.expectedAgent) {
          correctRoutes++;
        }
      }

      const successRate = correctRoutes / testQueries.length;
      expect(successRate).toBeGreaterThanOrEqual(0.8); // ≥80% target
    });

    it('should execute routing within reasonable time', async () => {
      const startTime = Date.now();
      await router.routeSingleAgent('create a simple function');
      const duration = Date.now() - startTime;

      // Routing should be fast (under 100ms for this simple case)
      expect(duration).toBeLessThan(100);
    });

    it('should handle large number of agents efficiently', () => {
      // Add many agents to test scaling
      for (let i = 0; i < 50; i++) {
        registry.registerAgent(createMockAgent(`agent-${i}`, [`keyword-${i}`]));
      }

      const startTime = Date.now();
      void router.routeSingleAgent('test query');
      const duration = Date.now() - startTime;

      // Should still be reasonably fast with many agents
      expect(duration).toBeLessThan(500);
    });
  });

  describe('edge cases', () => {
    it('should handle empty query', async () => {
      const result = await router.routeSingleAgent('');
      expect(result.agent).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle very long query', async () => {
      const longQuery = 'create '.repeat(1000) + 'function';
      const result = await router.routeSingleAgent(longQuery);

      expect(result.agent.config.name).toBe('code-generator');
    });

    it('should handle special characters in query', async () => {
      const query = 'create a function with @#$%^&*() characters';
      const result = await router.routeSingleAgent(query);

      expect(result.agent).toBeDefined();
    });

    it('should handle malformed explicit agent syntax', async () => {
      const malformedQueries = [
        'pk use agent',
        'pk use : "query"',
        'pk use agent: query without quotes',
        'use agent: "query"', // missing pk
      ];

      for (const query of malformedQueries) {
        const result = await router.routeSingleAgent(query);
        expect(result.confidence).not.toBe(RoutingConfidence.EXACT);
      }
    });
  });

  describe('factory function', () => {
    it('should create router with factory function', () => {
      const router = createAgentRouter(registry, fallbackAgent);
      expect(router).toBeInstanceOf(AgentRouter);
    });

    it('should create router without fallback', () => {
      const router = createAgentRouter(registry);
      expect(router).toBeInstanceOf(AgentRouter);
    });
  });
});
