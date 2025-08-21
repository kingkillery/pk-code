# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

- Shell: pwsh on Windows (examples are cross-platform; where env vars are set inline like FOO=bar cmd, use $env:FOO="bar" in PowerShell.)

Repository overview
- Monorepo using npm workspaces (Node 20+). Root package name: pk-code-cli. CLI binary: pk.
- Packages:
  - packages/core: Core engine, agent orchestration, tools, services, telemetry, and utilities.
  - packages/cli: React/Ink-based terminal UI, command layer, configuration, and app bootstrapping.
  - Additional provider adapters: packages/{openai,anthropic,gemini,openrouter,cohere} expose provider-specific bindings via lightweight index.ts modules.
  - vscode-ide-companion: VS Code extension glue to the core engine.
- Scripts directory hosts build/test/bundle utilities used by npm scripts.

Common commands
Use npm from the repo root unless noted.
- Install deps: npm install
- Build:
  - Build root (bundle prerequisites): npm run build
  - Build all (root + sandbox image assets): npm run build:all
  - Build all workspaces: npm run build:packages
  - Bundle distributable (runs generate + esbuild + copies assets): npm run bundle
- Start/dev:
  - Start local dev CLI: npm run start
  - Debug (inspector): npm run debug
- Lint/format/typecheck:
  - Lint: npm run lint
  - Lint (fix): npm run lint:fix
  - Format: npm run format
  - Typecheck (all workspaces): npm run typecheck
- Tests:
  - Unit/integration (per-workspace via npm): npm run test
  - CI suite (workspace tests + scripts tests): npm run test:ci
  - Scripts tests only: npm run test:scripts
  - E2E/integration (no sandbox): npm run test:integration:sandbox:none
  - E2E/integration (Docker sandbox): npm run test:integration:sandbox:docker
  - E2E/integration (Podman sandbox): npm run test:integration:sandbox:podman
  - Full E2E convenience: npm run test:e2e
- Preflight (build+lint+typecheck+tests): npm run preflight
- Clean build artifacts: npm run clean

Running a single test
Vitest is used throughout. Run from repo root with an explicit config for the target package.
- By file:
  - CLI package: npx vitest run packages/cli/src/commands/agent.test.ts --config packages/cli/vitest.config.ts
  - Core package: npx vitest run packages/core/src/tools/grep.test.ts --config packages/core/vitest.config.ts
- By test name pattern:
  - npx vitest run -t "AgentRunner" --config packages/cli/vitest.config.ts
Notes for PowerShell: replace any inline VAR=value prefix with $env:VAR="value" on a prior line if needed.

Provider configuration (env)
Set one or more API keys before running pk in interactive or CI contexts.
- OpenAI: set OPENAI_API_KEY, optional OPENAI_MODEL
- Anthropic: set ANTHROPIC_API_KEY, optional ANTHROPIC_MODEL
- Google Gemini: set GOOGLE_API_KEY, optional GOOGLE_MODEL
- OpenRouter: set OPENROUTER_API_KEY, optional OPENROUTER_MODEL
- Cohere: set COHERE_API_KEY, optional COHERE_MODEL
Example (pwsh):
- $env:OPENAI_API_KEY = "..."; $env:OPENAI_MODEL = "gpt-4o-mini"

Sandboxed integration tests
The integration tests honor PK_SANDBOX to choose execution mode.
- No sandbox: set PK_SANDBOX to false
- Docker: set PK_SANDBOX to docker
- Podman: set PK_SANDBOX to podman
Examples:
- PowerShell: $env:PK_SANDBOX = "docker"; node integration-tests/run-tests.js
- Bash: PK_SANDBOX=docker node integration-tests/run-tests.js

Using the CLI (pk)
- From source dev session: npm run start (interactive React/Ink UI)
- From global install: npm install -g pk-code-cli, then run pk
- Useful direct commands:
  - pk generate "Create a REST API endpoint for user authentication"
  - pk --prompt-file path/to/file.txt --list-extensions

High-level architecture
Big picture of how the system fits together so agents can reason across modules quickly.
- packages/core (engine)
  - Agents and orchestration (src/agents/*):
    - agent-loader, agent-registry: Discover/load agent definitions by name; registry exposes available agents.
    - agent-orchestrator, agent-executor, agent-router: Plan and route turns, execute tools, aggregate results.
    - prompt-generator, react-framework: Build provider-agnostic prompts and facilitate multi-step React-style tool flows.
  - Tools layer (src/tools/*):
    - Uniform tool interfaces for shell, grep, ls, file read/write, web fetch/search, MCP client tooling, memory operations, diff/edit, etc.
    - Tool registry composes and exposes tools; modifiable-tool utilities add wrappers like safety and validation.
  - Services (src/services/*):
    - Git service for repo context, file discovery, loop detection, memory service, and search index utilities.
  - Core runtime (src/core/*):
    - Client and content generators per provider (OpenAI, Gemini, OpenRouter), token limits, model routing, logging.
    - CoreToolScheduler and NonInteractiveToolExecutor coordinate tool execution without UI.
  - Telemetry (src/telemetry/*):
    - Metrics/loggers (OTel-compatible), clearcut logger bridge, UI telemetry helpers.
  - Utils (src/utils/*):
    - Editing helpers, file utils, git ignore parsing, embedding index generation, safe JSON parse/stringify, retry, session helpers.
  - Config and credentials:
    - src/config/*, src/credentials.ts provide model/provider config handling and secure key storage integration.

- packages/cli (UI and commands)
  - Entry points: src/gemini.tsx and index.ts mount the Ink app and wire the command router.
  - Command layer (src/commands/*):
    - User-visible commands like agent, config, generate, init, parallel, use; index.ts aggregates CLI routes.
  - UI components (src/ui/*):
    - React/Ink components (InputPrompt, History, Stats displays, Privacy notices, Theme manager), contexts for session state, and hooks for command processing and streaming.
  - Config layer (src/config/*):
    - yargs-based CLI args parsing, settings management, auth flows, and extension loading.
  - Utils (src/utils/*):
    - Launch-time sandbox warnings, versioning, provider utilities, stdin handling, packaging helpers.

- Provider adapters
  - Lightweight packages export index.ts that bind provider SDKs to core abstractions (openai, anthropic, gemini, openrouter, cohere).

- VS Code companion
  - vscode-ide-companion integrates IDE workflows by delegating to core services where possible.

- Scripts
  - scripts/*.js power build, bundle, sandbox image prep, telemetry, packaging, and version bumping used by npm scripts.

Important repository rules (from CLAUDE/Cursor docs)
- Preflight before submitting: Always validate changes locally with npm run preflight (build, tests, lint, typecheck).
- Testing style (Vitest):
  - Use vi.mock at file top for module-level dependencies (e.g., os, fs). Prefer vi.hoisted for early mocks.
  - Co-locate *.test.ts(x) with source files; use Ink testing library for UI components.
  - For timers, prefer vi.useFakeTimers with advance/run helpers; reset/restore mocks in beforeEach/afterEach.
- TypeScript style:
  - Prefer plain objects + TypeScript types over classes; encapsulate with ES modules (export what’s public).
  - Avoid any and risky assertions; prefer unknown with explicit narrowing.
  - Favor immutable array ops (map/filter/reduce) over mutation.
- React (Ink) guidance:
  - Functional components with Hooks; keep render pure; avoid unnecessary useEffect; follow Rules of Hooks.
  - Do not mutate state; avoid manual memoization unless necessary; rely on clear data flow.
- Task Master notes (if using .taskmaster): see .taskmaster/CLAUDE.md for commands; do not manually edit .taskmaster/tasks/tasks.json.

CI and branches
- Default branch: main
- GitHub Actions workflows exist for CI, release, and scheduled triage; preflight mirrors CI checks locally.

Troubleshooting quick checks
- Ensure Node 20+ (engines field enforced).
- Verify provider keys are set in env before running interactive pk or provider-bound tests.
- For Windows, prefer $env:NAME = "value" to set environment variables before running scripts that expect VAR=value.
