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

5. **Provider Lifecycle Management** _(implemented 2025-10-05)_
   - ✅ Created provider registry manifest `packages/core/providers/registry.json` describing capability flags (vision, large context, function calling, pricing, endpoints).
   - ✅ Implemented TypeScript types and validation in `packages/core/src/providers/registry.ts` with Zod schemas.
   - ✅ Added `pk config providers` command to list all available providers with configuration status.
   - ✅ Added `pk config provider <id>` command for detailed provider information.
   - ✅ Added `pk config recommend` command to suggest best providers for different use cases.
   - ❌ Enable opt-in telemetry leveraging OpenTelemetry dependencies to aggregate anonymous provider errors and improve retry/backoff tuning (deferred).

6. **Developer Experience**
   - Supply faster local loops via targeted scripts (`npm run dev --workspace @pk/core`, Justfile recipes) that wrap lint/test commands per package.
   - Automate Ink snapshot review in `packages/cli` with a Vitest watcher that previews diffs inside the TUI for safer UI changes.

7. **Community & Documentation**
   - Replace `ROADMAP.md` with a PK-specific roadmap aligned with the areas in `AGENTS.md`, linking to active GitHub project boards.
   - Expand `docs/` with guided examples covering MCP server integration, browser automation, and multi-agent debugging sessions.

## Priority Execution Plan (2025-10-05)

### Configuration Doctor & Diagnostics Panel _(completed 2025-10-05)_

- ✅ Implemented `pk config doctor` command in `packages/cli/src/commands/config.ts` with checks from `packages/core/src/config/doctor.ts`.
- ✅ Built configuration check modules covering:
  - Provider credentials (environment variables and credential store)
  - Settings file validation
  - Sandbox environment configuration
  - Environment file precedence (.env)
- ✅ Added telemetry-free success/failure summaries with actionable remediation steps.
- ✅ Implemented `/diagnostics` slash command that opens an interactive TUI diagnostics panel
- ✅ Created `DiagnosticsPanel` component in `packages/cli/src/ui/components/DiagnosticsPanel.tsx` that:
  - Runs configuration doctor checks in real-time
  - Displays status with color-coded indicators (✅ ok, ⚠️ warning, ❌ error)
  - Shows actionable suggestions for each issue
  - Supports ESC key to close
- ✅ Integrated diagnostics command into the command service and slash command processor
- ❌ Extend agent execution to emit structured events for routing, tool invocation, retry, and circuit-breaker state via OTEL exporters (deferred - would require OpenTelemetry integration).

### Provider Registry Schema & Model Migration _(completed 2025-10-05)_

- ✅ Defined `packages/core/providers/registry.json` capturing provider ids, default models, capability flags (vision, context-size, tool-calling), and environment variable mappings.
- ✅ Created TypeScript types in `packages/core/src/providers/registry.ts` with runtime validation (via `zod`) to load the manifest and expose typed helpers.
- ✅ Implemented provider selection logic with registry-derived suggestions via:
  - `pk config providers` - lists all providers with configuration status
  - `pk config provider <id>` - shows detailed provider information
  - `pk config recommend` - suggests best providers for different use cases
- ❌ Migrate constants from `packages/core/src/config/models.ts` and related modules to consume the registry loader (needs verification).
- ❌ Add automated tests in `packages/core/test/providers/registry.test.ts` verifying schema integrity and migration behavior (not yet implemented).

### Roadmap & Documentation Refresh

- Replace `ROADMAP.md` with PK-specific milestones aligned to areas in `AGENTS.md`, and link each focus area to active GitHub issues/projects.
- Draft an overview doc `docs/roadmap.md` detailing quarterly objectives, priority workstreams (config doctor, diagnostics panel, provider registry), and contribution guidelines.
- Expand `docs/examples/` with guided walkthroughs for MCP integration, browser automation flows, and multi-agent debugging, referencing the new tooling.
- Update `README.md` and `docs/getting-started.md` to highlight the new `pk config doctor` command and diagnostics capabilities once implemented.
- Announce documentation changes via `CHANGELOG.md` entry and an issue template update in `.github/` to steer community contributions toward current goals.
