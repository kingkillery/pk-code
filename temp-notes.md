### Initial Documentation Files Review

**`README.md`**:
- High-level overview of PK Code CLI.
- Features: AI-driven, interactive terminal (React/Ink), multi-provider, context-aware, vision integration, monorepo.
- Installation, configuration, usage (interactive/direct commands).
- Supported AI providers: OpenAI, Anthropic, Google, OpenRouter, Cohere.
- Vision & Multimodal support, Browser Automation (via `browser-use` MCP server).
- MCP Server Integration details.
- Advanced configuration, CI/CD, common use cases.
- Architecture: `packages/core`, `cli`, `vscode-ide-companion`, `tool-registry-api`.
- Contributing, support, licensing.

**`AGENTS.md`**:
- Guide for AI agents working on the codebase.
- Project Overview: PK Code (formerly Qwen Code), monorepo, MCP.
- Architecture: Modular, provider-based.
    - `packages/core`: Business logic, AI integrations, auth, tools.
    - `packages/cli`: Terminal UI (React/Ink), commands.
    - `packages/vscode-ide-companion`: VSCode extension.
    - `packages/tool-registry-api`: Public API for tools.
- Sub-Agent System: Router, Executor, Aggregator, Orchestrator.
- Key Development Patterns: Environment loading priority, Auth type selection, Model selection.
- Build and Distribution process.
- Agent-Specific Guidelines: Codebase understanding, common tasks (adding providers, extending tools, UI dev), testing strategy (Vitest, mocking, Ink testing), performance (multi-agent, UI responsiveness).
- Critical Implementation Notes: Type safety (`unknown` over `any`, plain objects), error handling, code style (functional, React best practices, hyphens for flags).
- Development Workflow: Setup, Dev, Testing, Quality Check (`npm run preflight`), Build.
- Integration Points: `browser-use` via MCP server.

**`PK.md`**:
- Comprehensive development guide for contributors.
- Building and Running: `npm run preflight` for quality checks (build, test, typecheck, lint).
- Writing Tests: Vitest framework.
    - Structure: `describe`, `it`, `expect`, `vi`. Co-located files (`.test.ts`, `.test.tsx`).
    - Mocking: `vi.mock`, `vi.hoisted`, `vi.fn`, `vi.spyOn`. Commonly mocked: Node.js built-ins, external SDKs, internal modules.
    - React Component Testing (Ink): `render()` from `ink-testing-library`, `lastFrame()`.
    - Asynchronous Testing: `async/await`, `vi.useFakeTimers()`.
- Git Repo: `main` branch.
- JavaScript/TypeScript:
    - Prefer plain JavaScript objects with TypeScript interfaces/types over classes.
    - Embrace ES module syntax for encapsulation (export public API, unexported private).
    - Avoid `any`, prefer `unknown` for type safety. Use type assertions with caution.
    - Embrace JavaScript's array operators for immutability and functional programming.
- React Guidelines (mirrored from `react-mcp-server`):
    - Functional components with Hooks.
    - Pure, side-effect-free rendering.
    - One-way data flow.
    - Immutable state updates.
    - Accurate `useEffect` usage (synchronization only, no `setState` within, cleanup functions).
    - Rules of Hooks.
    - `useRef` only when necessary.
    - Prefer composition and small components.
    - Optimize for concurrency (pure functions, functional updates, cleanup).
    - Optimize to reduce network waterfalls (parallel fetching, Suspense, server-centric).
    - Rely on React Compiler (omit `useMemo`, `useCallback`, `React.memo`).
    - Design for good user experience (placeholders, graceful error handling).
