Got it. I’ll research how to best implement sub-agent invocation in pk-code by leveraging its headless mode, including:

* How to structure and invoke self-instances using `child_process`, `worker_threads`, or other Node.js mechanisms
* Best practices for parsing agent definitions stored as Markdown with YAML front matter
* Recommendations for building an intelligent routing layer (embedding + heuristic)

I’ll report back with a clear strategy, code structure suggestions, and library recommendations.


# Implementing Sub-Agents via Headless Mode in PK-Code

## 1. Headless (Non-Interactive) Mode in PK-Code CLI

**Yes – PK-Code supports a headless mode.** The CLI can run in a non-interactive “one-shot” mode using flags or piping input, instead of launching the full TUI. In fact, this is analogous to Anthropic’s Claude Code `-p` flag for single-prompt execution. Key options include:

* **`-p/--prompt "<message>"`:** Supply a one-off prompt string to execute and then exit. For example:

  ```bash
  pk -p "Write a Python function to calculate prime numbers"
  ```

  This will run the prompt through the AI and print the assistant’s response to stdout, then terminate. It does **not** start the interactive REPL UI.

* **Piping input:** You can also pipe a prompt into PK-Code. For example:

  ```bash
  echo "Explain this code" | pk -p
  ```

  This will feed the prompt via stdin and produce an output, then exit. (The `-p` flag in this context ensures PK-Code knows to run non-interactively even if a TTY isn’t detected.)

Under the hood, the CLI decides on interactive vs headless mode by checking if a prompt was provided or if stdin is non-TTY. In the Gemini CLI (from which PK-Code is adapted), an internal flag `promptInteractive` and a TTY check control this flow. If a prompt is given or input is piped in, the CLI skips rendering the React interface and instead calls a `runNonInteractive` routine to handle the request in headless mode. For example:

> **Code Reference:**
>
> ```typescript
> const shouldBeInteractive = 
>   !!argv.promptInteractive || (process.stdin.isTTY && input?.length === 0);
> if (!shouldBeInteractive) {
>   // Run in non-interactive mode
>   await runNonInteractive(config, input, promptId);
>   process.exit(0);
> }
> ```

In headless mode, certain interactive-only tools are automatically disabled for safety. For instance, tools like **ShellTool**, **EditTool**, or **WriteFileTool** (which could alter files or execute commands) require user confirmation normally – but in non-interactive usage, PK-Code will **not** invoke them unless an override flag (like `--yolo`) is used. This conservative default mirrors Claude Code’s approach to **tool allowlists**, where potentially risky actions must be explicitly allowed. It ensures that running PK-Code in scripts or CI won’t inadvertently modify your system without permission.

Finally, running headless also means **no interactive authentication prompts**. API credentials must be provided via config or environment variables. PK-Code will automatically pick up keys from environment (e.g. `OPENAI_API_KEY`, `GEMINI_API_KEY`, etc.) since there’s no UI to prompt the user. If authentication is not set up, headless mode will simply error out rather than pausing for input.

## 2. Spawning Sub-Agents as Parallel Headless Instances

**Yes – we plan to leverage headless mode to spawn multiple sub-agent instances of PK-Code in parallel.** The idea is that each **sub-agent** is essentially a specialized PK-Code session with its own prompt context and tool restrictions, running concurrently with others. By invoking PK-Code’s CLI (or internal API) in headless mode for each agent, we achieve isolation between agents and avoid one agent’s state bleeding into another’s context window. This approach removes the single-agent bottleneck by delegating tasks to “mini-bots,” akin to having multiple Claude Code processes working together.

**How we’ll implement parallel spawning:** In the Node.js backend of PK-Code, we can spawn sub-agents using asynchronous concurrency. The controller (lead agent) will likely use `Promise.allSettled()` to launch all selected agent prompts at once and wait for them to finish. For example, if three agent tasks need to run, the code will initiate all three and then aggregate results when all promises have settled (whether fulfilled or rejected). This yields significant wall-clock time savings – three agents running in parallel could finish \~3× faster than if run sequentially, assuming adequate CPU and I/O resources.

Under the hood, each sub-agent could be started via a child process call to the `pk` CLI with the appropriate `-p` prompt. However, since these agents primarily perform I/O-bound work (API calls, file reads, etc.), we don’t necessarily need heavy multithreading. Node’s event loop can handle multiple asynchronous operations in parallel. Only if a sub-agent needs to do CPU-intensive computation (which is rarer for coding assistants) would we consider offloading to a worker thread. This is in line with Node’s best practices: **“Workers are useful for CPU-intensive JavaScript operations; do not use them for I/O”**. Our design reflects that guideline – we use **Promise-based concurrency** by default, and fall back to the Node.js `worker_threads` module only for compute-heavy tasks that might block the event loop. By combining `Promise.allSettled()` with conditional use of worker threads, we ensure we can run ≥3 agents concurrently without exceeding \~400 ms overhead versus single-agent mode (as per our performance goal).

Each agent process will load its own **agent profile** (the Markdown/YAML file in `.pk/agents/` for project or `~/.pk/agents/` for user scope). The **YAML front-matter** defines the agent’s name, description, model/backend override, and allowed tools. We’ll parse this and use it to configure the sub-agent’s environment: for example, if an agent’s file specifies `tools: [ "readFile", "searchWeb" ]`, the spawned PK-Code instance will only register those tools, and any attempt to use others will be blocked (returning an error like “Tool not permitted by agent”). This whitelist mechanism ensures each sub-agent operates within a sandbox of capabilities appropriate to its role (e.g. a “SQL Assistant” agent might only have DB query tools enabled, etc.). If the agent config omits a tools list, it inherits the default tool set (to maintain backwards compatibility with general-purpose agents).

**Passing the agent’s prompt context:** The content of the Markdown file (after the YAML header) serves as the “persona” or extended system prompt for that agent. It can include role instructions and even example Q\&A pairs (`<example>` blocks) to illustrate how the agent should behave. When spawning an agent, the orchestrator will prepend this content to the agent’s prompt. Concretely, if the user’s query is `“Can you review our test coverage?”` and they have an agent named “TestGuru” with a prompt file, the system will combine **TestGuru’s instructions** + **the user query** and feed that as the input to `pk -p`. This way, the agent runs with a tailored personality and focus. (In the future, we may allow the agent file to specify its own system vs. user prompt template, but initially a simple concatenation or a formatted prompt will suffice.)

Notably, the user can also **explicitly invoke a specific agent** by name, bypassing the router (for instance by typing a command like `pk use TestGuru: "<question>"`). In this case, only that agent is launched to handle the query, ensuring full user control when needed.

## 3. Best Practices for Multi-Agent Orchestration

**No (existing blueprint) – we don’t have an internal precedent for this, so we’re researching best practices from the industry.** Multi-agent systems are an emerging area, and we are drawing inspiration from how tools like Anthropic’s Claude and others handle parallel agents. Some guiding principles and learnings include:

* **Orchestrator & Worker pattern:** It’s often effective to have a primary “lead” agent that parses the user’s request and decides which sub-tasks to farm out to specialist agents. Anthropic’s team found a lead **Researcher agent** could spawn multiple **subagents** in parallel to tackle different aspects of a complex query, then aggregate the results. This pattern prevents any single agent from becoming a bottleneck and mirrors real-world teamwork where specialists handle their parts independently.

* **Separate context windows:** Each sub-agent has its own context (prompt + history), which **resets for each task**. This is powerful because it gives more total context window across the system – subagents can explore different facets in parallel, then return concise findings to the lead agent. In our case, each agent gets up to N tokens of its own context (depending on model), rather than sharing one massive context. This helps especially for breadth-first exploration tasks or analyzing different large files simultaneously.

* **Delegation and routing:** Designing the **router** (the logic that maps a user’s request to the right agent or agents) is crucial. Initially we’ll implement a simple heuristic or keyword-based router (for example, if the prompt contains words like “test” or “coverage”, route to the testing agent). Over time, this can be improved with embeddings or classifiers to achieve our target of ≥80% correct delegation on first try. We’ll follow Claude’s documented best practices for prompting multiple agents – e.g. clearly **instructing the lead agent when to delegate** and having subagents **verify or validate** aspects of the solution. Anthropic notes that prompting an agent to explicitly create subagents for verification can improve reliability in complex tasks.

* **Result aggregation:** After parallel agents finish, the orchestrator needs to combine their outputs. A simple approach is to have each sub-agent return a structured result (perhaps as JSON or markdown sections), which the main process then merges or summarizes. This might involve some post-processing – for example, if Agent A produces code and Agent B writes documentation, the orchestrator might insert B’s docs as comments above A’s code. We’ll need to define a clear schema for agent outputs to make aggregation straightforward.

* **Safety and auditability:** Each sub-agent runs in isolation and logs its actions. We plan to maintain an **audit log** of which agent handled which query and what tools it used. This is important because delegation can introduce new failure modes (e.g. the router might mistakenly send a sensitive task to an agent that doesn’t handle security properly). An audit trail helps in reviewing such decisions and improving the router. Also, as mentioned, tool usage is restricted per agent to minimize risk. Anthropic’s Claude Code similarly starts with a conservative allowlist and requires explicit permission for potentially dangerous actions – our sub-agents will uphold the same principle.

* **Prompt design for agents:** The content in the agent’s markdown should follow good prompt-writing practices. We might include sections that outline the agent’s role, examples of its behavior, and even format guidelines for its output. The provided **`hello-world-agent.md`** (to be created) will demonstrate a minimal agent definition with a YAML header and some instructions, serving as a template for users. This will encourage a consistent structure (e.g. including the agent’s purpose, any specific style, and sample Q\&A pairs as guidance).

In summary, since there isn’t a one-size-fits-all blueprint, we’re combining proven ideas: an orchestrator-subagent architecture from Anthropic’s research, Node.js concurrency patterns for reliability, and strict tool permission models from Claude Code. This should give power users the flexibility to delegate tasks to AI helpers confidently, while maintaining control and safety.

## 4. Current Status and Next Steps

This sub-agent system is **currently in the design and planning phase** – no production code exists yet for it in PK-Code. We have outlined the requirements and goals (see the Q4 2025 roadmap), and the implementation will be broken into milestones:

* **Agent Loader & Schema (Planned by Aug 23, 2025):** Build the file discovery mechanism to scan for agent definitions in the project’s `.pk/agents/` folder and the user’s home `~/.pk/agents/`. We will use a YAML 1.2 parser in safe mode to parse the front-matter (to prevent execution of any malicious tags) and validate it against a JSON Schema. If an agent file is invalid (e.g. bad YAML syntax), the CLI will log an error and exit with code 1, rather than proceed unpredictably. We’ll also implement **hot-reloading**, so that if an agent file is added or changed, the next time the CLI runs (or perhaps even mid-session), the new agent becomes available. Name collisions will be handled by preferring the project-local agent over the global one, and issuing a warning.

* **Routing & Delegation Logic (Planned by Sep 6, 2025):** Develop the routing function that maps user prompts to one or more agents. This will include a simple rules engine or embedding similarity check to pick the best agent. We’ll also add support for the explicit `use <agent>` syntax to force a particular agent. Part of this milestone is writing a suite of 50 sample prompts to measure delegation accuracy and tuning the routing heuristics to hit the 80% success target.

* **Parallel Executor (Planned by Sep 20, 2025):** Implement the asynchronous spawning of agent processes as discussed. We’ll likely create a small sub-module (e.g. `agentRunner.ts`) that takes an agent definition and a user query, and returns a Promise of that agent’s result. This module can decide whether to use a simple `child_process.spawn("pk -p ...")` or call an internal function to simulate a headless run (since PK-Code’s core could potentially be invoked programmatically without a new OS process). We will start with `Promise.allSettled([...agents])` to run them concurrently, and add **timeout handling** (if an agent hangs or takes too long, we don’t want to block the others indefinitely – using `Promise.race` with a timeout or AbortController can help). If we encounter any CPU-bound tasks or heavy memory usage in an agent, we’ll explore moving that agent’s work to a `Worker thread` to keep the main thread snappy, per Node’s guidance. Our performance budget is to add at most \~0.4 seconds overhead compared to single-agent execution, which we’ll verify with benchmarking.

* **Provider Fallback & Resilience (Planned by Oct 4, 2025):** Since each agent may call an LLM API (OpenAI, Anthropic, Alibaba Qwen, etc.), we want the system to be robust to provider failures. We’ll implement a policy where if a model call fails (network issue, rate limit, etc.), the agent can automatically retry with an alternate provider or model if available. For example, if the default is OpenAI and it’s down, the agent might retry with a locally hosted model or another API, to maintain a ≥99.9% success rate. This “fallback chain” will be configurable. (The reference to **APIPark** in our goals likely pertains to a guideline or library for API call reliability we intend to follow.)

* **Developer Experience & Docs (Planned by Oct 18, 2025):** Before public beta, we will create clear documentation and examples for the sub-agent feature. This includes the **Hello World Agent** example (`hello-world-agent.md`) to help users get started in under 5 minutes. We’ll document how to write an agent file (explaining each YAML field and giving tips for the prompt content). We’ll also update our Confluence PRD and README to cover sub-agents, and add usage notes like how to list available agents (`pk list-agents --verbose` could show all discovered agents and their allowed tools). Ensuring that first-time users can successfully spin up a custom agent and see it respond in a useful way is a key success metric for us.

**To recap,** the plan to add file-based sub-agents in PK-Code is well underway conceptually, but as of now the implementation is pending. We’ve identified the headless mode invocation as the linchpin of spawning parallel agents, and confirmed the CLI already supports that. Our next steps are to write the loader and router, and then iteratively build out the parallel execution and fallback mechanisms. By following the roadmap and best practices outlined above, we aim to ship a robust sub-agent system that dramatically enhances PK-Code’s power and flexibility for advanced users.


