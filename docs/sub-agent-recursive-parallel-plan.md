# Sub-Agent Recursive Parallel Execution Plan

This plan describes how to enable PK Code to spawn sub-agents as separate `pk` subprocesses (including multiple PowerShell instances on Windows) to execute tasks in parallel, and to integrate this with the existing sub-agent architecture (router, executor, orchestrator, planner/blackboard).

## Goals

- Process isolation: Run each routed sub-agent/task in its own `pk` process.
- Platform support: Windows (PowerShell), macOS/Linux (bash/sh), headless mode.
- Orchestrator control: Allow in-process and subprocess execution strategies.
- DAG parallelism: Execute multiple "ready" tasks concurrently with backpressure.
- Observability: Telemetry, audit, and clean cancellation across subprocesses.
- Safety: Propagate auth via env, avoid secrets in argv, honor tool restrictions.

## High-Level Architecture

- CLI layer:
  - Extend `pk agent run` to run named agents (or queries) in parallel by spawning `pk` subprocesses (recursive self-call), reusing the parallel executor logic.
  - Provide a programmatic helper to spawn a pk subprocess with structured options (agent name, query, env, window mode).
- Core layer:
  - Add `ProcessExecutionStrategy` in orchestrator/executor to choose between in-process vs subprocess for multi-agent and task DAG execution.
  - Enhance `TaskPlanner` execution path to schedule multiple ready tasks concurrently as subprocesses when configured.
- Cross-cutting:
  - Standardize environment variables for subprocess context propagation (session, task id, agent, auth type, concurrency bounds, tool whitelist).
  - Add Windows PowerShell and POSIX shell launchers with graceful signal handling.

## Proposed Interfaces/Config

- New orchestrator option:
```ts
interface OrchestrationOptions {
  execution?: ExecutionOptions & {
    processIsolation?: 'in-process' | 'subprocess';
    maxProcessConcurrency?: number; // default 2-4
    windowsConsole?: 'hidden' | 'new-window' | 'inherit'; // default hidden
  };
}
```

- Subprocess spawn helper (CLI):
```ts
interface PkSubprocessOptions {
  agent?: string;           // optional, or use prompt
  query?: string;           // used with `pk use`
  prompt?: string;          // used with `-p`
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  windowsConsole?: 'hidden' | 'new-window' | 'inherit';
  yolo?: boolean;
}
function spawnPkSubprocess(opts: PkSubprocessOptions): ChildProcess;
```

- Env propagation (no secrets in argv):
  - `PK_PARENT_SESSION_ID`, `PK_TASK_ID`, `PK_AGENT_NAME`, `PK_PROCESS_ISOLATION=1`.
  - `PK_PREFER_LOCAL_BROWSER` (to avoid cloud browser_use conflicts) respected.
  - `PK_TOOL_WHITELIST` (comma-separated) when agents restrict tools.

## Step-by-Step Implementation

1) CLI: Implement `agent run` (parallel agents)
- File: `packages/cli/src/commands/agent.ts`
  - Add `handleRunAgents(agentNames: string[], query?: string)` that spawns parallel pk subprocesses.
  - Accept syntax: `pk agent run 'agentA,agentB' --query "..."` OR per-agent prompts: `--prompts 'q1;q2'`.
  - Concurrency control via `--parallel-tasks` (reuse executor semantics).
  - Cross-platform spawn: Windows uses `powershell.exe` when `windowsConsole=new-window`; otherwise spawn Node directly.
  - Output aggregation similar to `parallel.ts` with task IDs and summary.

2) Shared subprocess helper
- New file: `packages/cli/src/utils/pkSubprocess.ts`
  - `spawnPkSubprocess()` building node args for `pk` CLI (`index.js`) with flags: prefer `pk use <agent> <query>` if agent provided, else `-p`.
  - Inject env: session id, task id, yolo, tool whitelist.
  - Windows `new-window`: spawn `powershell.exe -NoProfile -Command Start-Process -WindowStyle Normal -File ...` (or `Start-Process` with proper args) to open a new console, falling back to hidden.
  - POSIX: `bash -lc` optional new terminal only if explicitly requested (out of scope for MVP).

3) Orchestrator: subprocess strategy
- File: `packages/core/src/agents/agent-orchestrator.ts`
  - Extend `processMultiAgent()` to branch on `execution.processIsolation==='subprocess'` and delegate to a new `executeMultiViaSubprocess()` that uses CLI helper through an adapter. Because core cannot import CLI, define an interface and inject a factory from CLI entry OR put the subprocess adapter in a small cross-package util.
  - For MVP, keep subprocess orchestration in CLI layer: a new `packages/cli/src/agent/SubprocessOrchestratorAdapter.ts` that mirrors `AgentExecutor.executeMultipleAgents` but via pk subprocesses. Wire this when CLI runs in non-interactive mode.

4) DAG: parallel ready tasks
- File: `packages/core/src/agents/agent-orchestrator.ts` (`executeTasks`)
  - Modify to collect all `readyTasks` and run concurrently, limited by `execution.maxProcessConcurrency` when `processIsolation==='subprocess'`, else `execution.maxConcurrency` for in-process.
  - For subprocess path, use the adapter to spawn pk per task with `pk use <agent> "<task desc>"`.
  - Update blackboard status on start/finish; propagate artifacts from subprocess stdout via a simple JSON fence convention (e.g., detect ```json pk-artifacts: ... ``` blocks).

5) Telemetry, audit, and cancellation
- Ensure child processes inherit telemetry env where applicable.
- Implement parent->child cancellation: on timeout or SIGINT, send `SIGTERM` (Windows: `taskkill /pid <pid> /t /f` fallback). Gracefully escalate after 5s.
- Extend `parallel.ts` cleanup logic to be reusable by `agent run`.

6) Configuration and settings
- Add settings to `~/.pk/settings.json` and CLI flags:
  - `--process-isolation subprocess|in-process`
  - `--process-concurrency N`
  - Windows console behavior flag.
- Respect `PK_PREFER_LOCAL_BROWSER=1` during subprocess tool discovery to avoid cloud tool registration.

7) Tests
- Unit tests (Vitest):
  - Mock `child_process.spawn` to verify args/env per platform.
  - Test `agent run` outputs and summary with mixed success/error.
  - Test DAG execution runs multiple ready tasks concurrently with cap.
- Integration tests:
  - Reuse patterns from `integration-tests/*` to simulate parallel subprocess and verify exit codes.

8) Docs
- Update `docs/cli/commands.md` with `agent run` usage and examples.
- Update `PARALLEL_EXECUTION.md` with subprocess-based sub-agents.
- Add Windows guidance: PowerShell vs hidden console.

## Rollout Phases

- Phase A (MVP): `pk agent run` parallel subprocesses, Windows hidden console, CLI-only adapter, no blackboard artifacts import.
- Phase B: Orchestrator subprocess option, DAG parallelism, basic artifact import.
- Phase C: New-window support on Windows, richer artifact channel, telemetry polish.

## Acceptance Criteria

- `pk agent run 'a1,a2' --query "Fix X"` runs both agents concurrently and exits with non-zero if any fail; works on Windows/macOS/Linux.
- Orchestrator can run multi-agent in subprocess mode with configurable concurrency; cancellation kills children cleanly.
- DAG executor runs multiple ready tasks concurrently (bounded) and updates statuses correctly.

## Risks & Mitigations

- Rate limits across parallel calls → add per-provider backoff and configurable concurrency caps.
- Windows signal handling → use `taskkill` fallback; avoid orphaned consoles.
- Secrets in argv → pass via env only; never echo.
- Tool conflicts (cloud browser tool) → `PK_PREFER_LOCAL_BROWSER=1` respected.

---

Owner: Engineering
Last updated: 2025-08-24
