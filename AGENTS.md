# Agent Development Guide

This guide is intended for AI agents working on the PK Code codebase. It provides essential context for understanding the project architecture, development patterns, and implementation strategies.

## Project Overview

PK Code (formerly Qwen Code) is a sophisticated AI-powered CLI tool built as a monorepo with multiple specialized packages. The system integrates various AI providers through standardized interfaces and supports extensible tooling through the Model Context Protocol (MCP).

## Architecture

The system follows a modular, provider-based architecture with clear separation of concerns:

### Core Package Structure

- **`packages/core/`**: Central business logic, AI integrations, authentication, and tool system
  - Authentication & configuration management
  - AI provider integrations (OpenAI, Gemini, OpenRouter, Anthropic, Cohere)
  - Tool registry and MCP server management
  - File discovery, git operations, telemetry
  
- **`packages/cli/`**: Terminal user interface and command processing
  - React + Ink-based terminal UI
  - Command processing with yargs
  - Authentication dialogs and configuration management
  - Theme system and user preferences
  
- **`packages/vscode-ide-companion/`**: VSCode extension integration
- **`packages/tool-registry-api/`**: Public API for third-party tool integrations

### Sub-Agent System Architecture

The project includes a sophisticated multi-agent system (`packages/core/src/agents/`) with:

- **Agent Router**: Keyword-based routing to specialized AI agents
- **Agent Executor**: Concurrent, sequential, and prioritized execution with resource management
- **Result Aggregator**: Intelligent synthesis of multi-agent responses using consensus strategies
- **Agent Orchestrator**: Pipeline management with different operation modes

## Key Development Patterns

### Configuration Management

**Environment Loading Priority:**
1. Current directory `.pk/.env`
2. Current directory `.env` 
3. Parent directories (recursive)
4. Home directory `.pk/.env`
5. Home directory `.env`

**Auth Type Selection:**
1. Saved user preference
2. `PK_DEFAULT_AUTH_TYPE` environment variable
3. Auto-detection from available API keys
4. Interactive auth dialog fallback

### Model Selection

**Default Model**: `DEFAULT_PK_MODEL = 'pk3-coder-max'` (defined in `packages/core/src/config/models.ts`)

**CLI Priority**: `OPENROUTER_MODEL || PK_MODEL || DEFAULT_PK_MODEL`

### Build and Distribution

1. `npm run build` - TypeScript compilation across all packages
2. `npm run bundle` - esbuild creates single executable `bundle/pk.js`
3. `npm install -g` - Global installation of `pk` command
4. `pk` command executes the bundled standalone file

## Agent-Specific Development Guidelines

### Understanding the Codebase

**Before making changes:**
1. Run `npm run preflight` to ensure all quality gates pass
2. Examine existing test patterns in the relevant package
3. Review the authentication flow if working on auth-related features
4. Check `PK.md` for comprehensive development guidelines

### Common Development Tasks

**Adding New AI Providers:**
- Implement the standardized `AIProvider` interface
- Add authentication method to auth selection flow
- Update environment variable detection logic
- Add provider-specific configuration UI components

**Extending Tool System:**
- Tools are discovered through MCP servers
- Register new tools in the tool registry
- Ensure proper error handling and timeout management
- Test tool integration with the agent execution pipeline

**UI Component Development:**
- Use React functional components with Hooks
- Follow Ink patterns for terminal rendering
- Maintain responsive design for various terminal widths
- Integrate with existing theme system

### Testing Strategy

**Framework**: Vitest with extensive mocking

**Key Patterns:**
- Co-locate test files with source code
- Mock Node.js built-ins (`fs`, `os`, `child_process`)
- Mock external SDKs (`@google/genai`, `@modelcontextprotocol/sdk`)
- Use `ink-testing-library` for React component testing
- Implement proper setup/teardown with `beforeEach`/`afterEach`

### Performance Considerations

**Multi-Agent System:**
- Agent routing uses keyword-based scoring (potential bottleneck with many agents)
- Execution supports parallel processing with `Promise.allSettled()`
- Circuit breaker patterns prevent cascading failures
- Timeout management prevents hanging operations

**UI Responsiveness:**
- Use React's concurrent features appropriately
- Implement proper loading states and error boundaries
- Optimize for terminal rendering performance
- Handle terminal resizing gracefully

## Critical Implementation Notes

### Type Safety
- Prefer `unknown` over `any` types
- Use plain objects with TypeScript interfaces over classes
- Leverage ES module syntax for encapsulation
- Maintain strict typing for agent configurations

### Error Handling
- Implement comprehensive error catching in agent execution
- Use defensive patterns for external API calls
- Provide graceful degradation for tool failures
- Log errors appropriately for debugging

### Code Style
- Use functional programming patterns (array operators, immutability)
- Follow React best practices (no direct state mutation, proper effect usage)
- Use hyphens in flag names (`my-flag` not `my_flag`)
- Minimize high-value comments only

## Development Workflow

1. **Setup**: Clone repo, run `npm install` to set up workspace
2. **Development**: Use `npm run dev` for hot reloading during development
3. **Testing**: Run `npm run test` for individual package testing
4. **Quality Check**: Always run `npm run preflight` before submitting changes
5. **Build**: Use `npm run build && npm run bundle` for distribution artifacts

## Integration Points

## Browser-Use Integration

The `browser-use` library is integrated into the PK Code CLI, allowing agents to interact with live web applications. This integration is achieved through the Model Context Protocol (MCP), with `browser-use` running as a separate MCP server.

### Enabling the Browser-Use Integration

To enable the `browser-use` integration, you must first configure the path to your browser's user data directory. This can be done by running the following command:

```bash
pk config browser
```

This command will guide you through an interactive setup process to find and save the correct path.

### Starting and Stopping the Browser-Use Agent

Once the `browser-use` integration has been configured, you can start and stop the `browser-use` agent using the following commands:

```bash
# Start the browser-use agent
pk agent start browser

# Stop the browser-use agent
pk agent stop browser
```

When the `browser-use` agent is running, a set of `browser.*` tools will be available to the PK Code agent, allowing it to interact with the web browser.
