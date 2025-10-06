# Potential Improvements for PK Code CLI

Created: 2025-10-05 14:00:35 -0600

## System-Level Opportunities

1. **Configuration Cohesion**
   - Align model defaults in `packages/core/src/config/models.ts` with user-facing docs (`README.md`, `docs/config.md`).
   - Add a startup migration helper that validates `.env`, `.pk/settings.json`, and workspace config precedence.
   - Introduce a `pk config doctor` command under `packages/cli/src/commands/` to surface missing provider keys, sandbox flags, and conflicting overrides via the configuration layer in `packages/core/src/config/`.

2. **Agent Orchestration Observability**
   - Extend `packages/core/src/agents/` to emit OpenTelemetry traces for routing decisions, tool calls, and retries using existing OTEL exporters declared in `package.json`.
   - Add a `/diagnostics` TUI panel in `packages/cli/src/ui/` that streams live agent pipeline state (queued tasks, circuit-breakers, tool invocations).

3. **Workspace Automation & Scripts**
   - Create reusable workflow presets in `scripts/workflows/` consumable via `pk generate --workflow <name>` leveraging the multi-step instruction parser (`README.md:265-336`).
   - Provide a task library that versions prompt chains alongside code so teams can share automation templates.

4. **Sandbox Ergonomics** _(implemented 2025-10-05)_
   - ✅ `scripts/build_sandbox.js` now performs container runtime preflight checks (Docker/Podman availability, seatbelt permissions) and surfaces remediation guidance.
   - ✅ Added `pk sandbox status` command backed by `packages/core/src/sandbox/status.ts` to report current `PK_SANDBOX` mode, writable roots, and network restrictions.

5. **Provider Lifecycle Management**
   - Define a provider registry manifest (e.g., `packages/core/providers.json`) describing capability flags (vision, large context, function calling) to power model fallback recommendations.
   - Enable opt-in telemetry leveraging OpenTelemetry dependencies to aggregate anonymous provider errors and improve retry/backoff tuning.

6. **Developer Experience**
   - Supply faster local loops via targeted scripts (`npm run dev --workspace @pk/core`, Justfile recipes) that wrap lint/test commands per package.
   - Automate Ink snapshot review in `packages/cli` with a Vitest watcher that previews diffs inside the TUI for safer UI changes.

7. **Community & Documentation**
   - Replace `ROADMAP.md` with a PK-specific roadmap aligned with the areas in `AGENTS.md`, linking to active GitHub project boards.
   - Expand `docs/` with guided examples covering MCP server integration, browser automation, and multi-agent debugging sessions.

## Priority Execution Plan (2025-10-05)

### Configuration Doctor & Diagnostics Panel

- Establish a `pk config doctor` command in `packages/cli/src/commands/config/doctor.ts` that composes checks from `packages/core/src/config/validators/` and emits actionable remediation steps.
- Build configuration check modules covering environment precedence, missing provider keys, conflicting sandbox flags, and version mismatches in `packages/core/src/config/validators/`.
- Add telemetry-free success/failure summaries to `pk config doctor` and wire it into onboarding (`npm run start`) warnings.
- Implement an agent `/diagnostics` panel under `packages/cli/src/ui/panels/diagnostics.tsx` that subscribes to new OpenTelemetry spans emitted from `packages/core/src/agents/metrics.ts`.
- Extend agent execution to emit structured events for routing, tool invocation, retry, and circuit-breaker state via OTEL exporters already declared in `package.json`.

### Provider Registry Schema & Model Migration

- Define `packages/core/providers/registry.json` capturing provider ids, default models, capability flags (vision, context-size, tool-calling), and environment variable mappings.
- Create TypeScript types in `packages/core/src/providers/registry.ts` with runtime validation (via `zod`) to load the manifest and expose typed helpers.
- Migrate constants from `packages/core/src/config/models.ts` and related modules to consume the registry loader, ensuring backward-compatible fallbacks for unspecified providers.
- Update provider selection logic in `packages/core/src/config/models.ts` and CLI prompts in `packages/cli/src/commands/config/model.ts` to surface registry-derived suggestions and fallbacks.
- Add automated tests in `packages/core/test/providers/registry.test.ts` verifying schema integrity and migration behavior.

### Roadmap & Documentation Refresh

- Replace `ROADMAP.md` with PK-specific milestones aligned to areas in `AGENTS.md`, and link each focus area to active GitHub issues/projects.
- Draft an overview doc `docs/roadmap.md` detailing quarterly objectives, priority workstreams (config doctor, diagnostics panel, provider registry), and contribution guidelines.
- Expand `docs/examples/` with guided walkthroughs for MCP integration, browser automation flows, and multi-agent debugging, referencing the new tooling.
- Update `README.md` and `docs/getting-started.md` to highlight the new `pk config doctor` command and diagnostics capabilities once implemented.
- Announce documentation changes via `CHANGELOG.md` entry and an issue template update in `.github/` to steer community contributions toward current goals.
