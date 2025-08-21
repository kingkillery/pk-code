# Agent Development Guide

This guide is intended for AI agents working on the PK Code codebase. It provides essential context for understanding the project architecture, development patterns, and implementation strategies.

## Project Overview

PK Code (formerly Qwen Code) is a sophisticated AI-powered CLI tool built as a monorepo with multiple specialized packages. The system integrates various AI providers through standardized interfaces and supports extensible tooling through the Model Context Protocol (MCP).

## Architecture

The system follows a modular, provider-based architecture with clear separation of concerns:

### Core Package Structure

- **`packages/core/`**: Central business logic, AI integrations, authentication, and tool system
  - Authentication  configuration management
  - AI provider integrations (OpenAI, Gemini, OpenRouter, Anthropic, Cohere)
  - Tool registry and MCP client/integration utilities
  - File discovery, git operations, telemetry
  
- **`packages/cli/`**: Terminal user interface and command processing
  - React + Ink-based terminal UI
  - Command processing with yargs
  - Authentication dialogs and configuration management
  - Theme system and user preferences
  
- **`packages/vscode-ide-companion/`**: VS Code extension integration
- **`packages/tool-registry-api/`**: Public API for third-party tool integrations

### Sub-Agent System Architecture

The project includes a sophisticated multi-agent system (`packages/core/src/agents/`) with:

See also: `packages/core/src/agents/ARCHITECTURE.md` for deeper orchestration details.

- **Agent Router**: Keyword-based routing to specialized AI agents
- **Agent Executor**: Concurrent, sequential, and prioritized execution with resource management
- **Result Aggregator**: Intelligent synthesis of multi-agent responses using consensus strategies
- **Agent Orchestrator**: Pipeline management with different operation modes

## Key Development Patterns

### Configuration Management

**Environment configuration:**
- Project `.env` and user-level `~/.pk/.env` are supported. For exact precedence and resolution logic, see `packages/core/src/config/config.ts`.

**Auth Type Selection:**
1. Saved user preference
2. `PK_DEFAULT_AUTH_TYPE` environment variable
3. Auto-detection from available API keys
4. Interactive auth dialog fallback

### Model Selection

- Default model: see `packages/core/src/config/models.ts` for `DEFAULT_PK_MODEL`.
- Provider-specific model environment variables are respected when present, e.g. `OPENAI_MODEL`, `ANTHROPIC_MODEL`, `GOOGLE_MODEL`, `OPENROUTER_MODEL`, `COHERE_MODEL`. If none are set for the chosen provider, the default model is used.
- Note: `PK_MODEL` is not documented for general use; prefer the provider-specific variables above.

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
4. See `WARP.md` (repository guidance), `CLAUDE.md` (rules), and `README.md` (product usage) for comprehensive development guidance

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
- Routing uses heuristics to select specialized agents (be mindful of scalability with many agents)
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
- Only add comments when they provide high value; avoid excessive commentary

## Development Workflow

1. **Setup**: Clone repo, run `npm install` to set up workspace
2. **Development**: Use `npm run start` for interactive local development, or `npm run debug` to attach a debugger
3. **Testing**:
   - All workspaces: `npm run test`
   - Single test (CLI): `npx vitest run packages/cli/src/commands/agent.test.ts --config packages/cli/vitest.config.ts`
   - Single test (Core): `npx vitest run packages/core/src/tools/grep.test.ts --config packages/core/vitest.config.ts`
   - By name: `npx vitest run -t "AgentRunner" --config packages/cli/vitest.config.ts`
4. **Quality Check**: Always run `npm run preflight` before submitting changes
5. **Build**: Use `npm run build && npm run bundle` for distribution artifacts

## Integration Points

## Browser Automation Integration

The Browser Use API is now directly integrated into PK Code CLI as a built-in tool, allowing agents to interact with live web applications through cloud-based browser automation.

### Enabling Browser Automation

To enable browser automation, simply set your Browser Use API key:

```bash
export BROWSER_USE_API_KEY="your-api-key-here"
```

### Using Browser Automation

The `browser_use` tool is automatically available in PK Code and can be used to:
- Create browser automation tasks
- Monitor task execution with real-time step streaming
- Get task status and details
- Control task execution (pause/resume/stop)
- Get structured JSON output from web pages

Example usage:
```bash
# Use natural language to interact with Browser Use
pk
> Use browser_use to go to hackernews and get the top 5 story titles
```
