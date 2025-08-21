# Implementation Instructions: Address QA Findings for BrowserUseTool

You are the implementation engineer. Your task is to address the QA findings and complete the streaming and reliability polish for BrowserUseTool without regressing existing functionality. Do not over-refactor beyond the scope below.

Sections: Project Setup, Implementation Steps, Testing Plan, Deployment, Docs Updates.

---

## Project Setup

You are working in a TypeScript monorepo:
- Root: pk-code
- Target packages:
  - packages/core (tooling, BrowserUseTool)
  - packages/cli (UI integration)

Use existing tooling (pnpm/npm as configured). Keep Prettier/ESLint consistent with repo settings.

Open-ended (confirm or use defaults):
- Node version: use project’s current engines field.
- Package manager: use the one in lockfile/CI (likely pnpm). If ambiguous, default to npm.

Source-of-truth updates required throughout:
- Update README/feature docs only where noted.
- Keep inline comments explaining non-obvious behavior (timeouts, retry policy, streaming semantics).
- If CHANGELOG is used, add an entry under Unreleased.

---

## Implementation Steps

I want you to implement the following fixes and improvements in the exact order. Provide small, surgical commits.

1) Respect user-initiated cancellation (no retries on abort)
- File: packages/core/src/tools/browser-use-tool.ts
- Function: fetchWithRetry(...)
- Change: Distinguish external AbortSignal cancellations from network/timeout aborts. If `signal?.aborted === true` at catch-time or you detect an AbortError where the external signal triggered abort, do NOT retry—immediately rethrow so UI stops cleanly.
- Implementation guidance:
  - Track a boolean `externalAbort = signal?.aborted` or attach a flag when forwarding the external signal into your controller (e.g., set in an event listener).
  - In catch, if `externalAbort === true` (or if you can map error to external signal), return/throw without retry.
  - Continue to retry on 5xx/429 and genuine transient network errors.

2) Remove dead code and unused fields
- File: packages/core/src/tools/browser-use-tool.ts
- Remove the unused local `mergedSignal` variable.
- Either remove `seenSteps` class field or actually use it in `waitForCompletion` to bound memory. Preferred: remove field and rely on local `uniqueSteps` set.

3) Harden error mapping and messages (best-effort)
- File: packages/core/src/tools/browser-use-tool.ts
- In fetchWithRetry, keep friendly mapping but:
  - Ensure large error bodies are truncated (e.g., 1–2KB) to avoid noisy UI.
  - Include a short hint for 401/403 (auth/permission) and 422/400 (request validation) without leaking secrets.

4) Streaming output semantics: clarify and normalize
- File: packages/core/src/tools/browser-use-tool.ts
- In `waitForCompletion`:
  - Emit an initial header chunk once (e.g., `Streaming steps for task ${taskId}…`). Guard with a boolean so it’s not duplicated.
  - For each new step, emit a single-line concise message first; only include `Details:` payload if it’s reasonably small (e.g., length < 2KB). If larger, append `(details truncated)`.
  - On terminal state, emit a short final status line before returning.
- In `execute` for `create_task` and `get_details` when `waitForCompletion=true`:
  - Emit a short preamble (“Waiting for completion…”); rely on `waitForCompletion` to drive granularity.

5) Minimal CLI/UI integration check (no functional code changes unless needed)
- File: packages/cli/src/ui/* (no required edits if the `updateOutput` callback already flows to the renderer)
- Verify `canUpdateOutput=true` tools render incremental chunks. If you must change anything, keep it minimal and aligned with current UI streaming conventions.

6) Small documentation touch
- File: test-browser-use.md
- Ensure it explicitly mentions live incremental progress appears during `waitForCompletion: true` and that cancellation (ESC/Stop) is immediate.

Optional (nice-to-have if trivial):
- Add a preflight banner at startup when BROWSER_USE_API_KEY is missing (only if a clear existing hook exists; otherwise skip).

---

## Testing Plan

I want unit and light integration tests. Keep them fast and deterministic.

1) Unit tests for fetchWithRetry
- New file: packages/core/src/tools/__tests__/browser-use-fetchWithRetry.test.ts
- Cases:
  - Retries on 500 → succeeds on second attempt (mock fetch).
  - Retries on 429 → exponential delay path exercised (mock timers, assert call count).
  - Does NOT retry on external abort: simulate AbortSignal.abort() before first attempt; expect single call and AbortError propagated.
  - Times out with controller abort; ensure limited retry behavior and friendly error text.

2) Unit tests for streaming behavior
- New file: packages/core/src/tools/__tests__/browser-use-streaming.test.ts
- Cases:
  - waitForCompletion emits header once and step chunks per new step.
  - Large `details` chunk is truncated with notice.
  - Final terminal status chunk emitted.

3) Integration-ish smoke (mocked API)
- New file: packages/core/src/tools/__tests__/browser-use-integration.test.ts
- Simulate create_task → waitForCompletion with mocked getTaskDetails responses progressing from running → finished.
- Verify that `updateOutput` receives multiple chunks and final ToolResult is returned with a summary.

Notes:
- Use jest/jest-like setup consistent with repo tests.
- Prefer fake timers for backoff assertions.
- Do not hit real network.

---

## Deployment

- No infra changes. Standard build/test pipeline only.
- Run typecheck and tests locally; ensure CI passes.
- If CHANGELOG is present, add an entry under Unreleased: “BrowserUseTool: incremental streaming improvements; abort respected; retry/backoff hardened.”

---

## Documentation Updates

- test-browser-use.md already updated; add a one-liner clarifying abort behavior is immediate and will not trigger retries.
- If README/AGENTS overview mentions browser-use behavior, add a short bullet: “Streaming: long tasks surface live progress; cancellation is immediate.”

---

## Open-Ended Items (confirm or proceed with defaults)
- Node/package manager/version: follow repo’s current config.
- UI renderer behavior for streaming: assume current `canUpdateOutput` pipeline is correct; otherwise coordinate a minimal fix.

---

## References
- AbortController MDN: https://developer.mozilla.org/en-US/docs/Web/API/AbortController
- Fetch standard (WHATWG): https://fetch.spec.whatwg.org/

