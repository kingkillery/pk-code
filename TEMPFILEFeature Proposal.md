<first-draft> 

# Feature Proposal:

## Purpose

Convert either a short natural-language instruction or a mini-DSL script into a deterministic browser workflow. Execute with **browser-use** (local preferred, Cloud API fallback). Browser sessions are stateful. Flows must be idempotent.

## Slash Command Integration

We introduce a dedicated **slash command** for fast access and management:

- **/flowpk** → opens a sub-menu with:
  - **Create Workflow**
  - **List Workflows**

### Granular Access

Users can manage workflows directly through extended commands:

- `/flowpk edit [workflow-name]`
- `/flowpk view [workflow-name]`

### Workflow CLI Format

- Workflows are displayed in a **CLI-style box layout**, where each condition or instruction is shown on its own row.
- **Conditions** (e.g., `IF`, `WHILE`) appear in a dedicated row with alternate colors/shading for readability.
- **Execution instructions** follow below each condition.
- **Indentation** (`-` or tab) manages sub-rules and parent-child hierarchy.

Example visual:

```
┌──────────────────────────────┐
│ IF EXISTS(".login-button")   │   ← shaded/colored row for condition
├──────────────────────────────┤
│ - CLICK ".login-button"      │   ← execution instruction
│ - WAIT_FOR "#dashboard"      │
└──────────────────────────────┘
```

## Conditional Agent Logic

Workflows may integrate conditional agent logic similar to `browser-use` patterns. For example:

```python
from browser_use import Agent

if Agent(task="Are there new GitHub issues?")():
    Agent(task="Go and fix it")()
else:
    Agent(task="Scan my code and find issues")()
```

This allows conditions to be evaluated by agents, and corresponding execution instructions to run automatically. These checks and actions can be represented in CLI-box workflows as well.

## Inputs

- **<one_liner>**: Free text instruction (normalize to DSL).
- : Already in DSL form.

## DSL Syntax

- **Keywords**: Case-insensitive. `#` starts a comment. Strings are quoted.
- **Types**: `bool | number | string`.
- **Variables**: `IDENT = <expr>`

### Statements

- `SET <var> = <expr>`
- `NAVIGATE "<url|back>"`
- `CLICK <selector|text>`
- `TYPE "<text>" INTO <selector>`
- `WAIT_FOR <selector|text> [TIMEOUT=<s>]`
- `EXTRACT {field:expr,...} FROM <selector>`
- `NOTE "<msg>"`
- `RESULT <key> = <expr>`
- `RESULT push = <object>`
- `LOGIN USING "<login_alias>"`

### Control Flow

- `IF … ELIF … ELSE … END`
- `WHILE <cond> [MAX_LOOPS=<n>] … END`
- `FOR_EACH <item> IN <list_selector>: … END`

### Helpers

- `EXISTS(<selector|text>)`
- `TEXT_CONTAINS(<scope>, "<substr>")`
- `URL_CONTAINS("<substr>")`
- Comparators: `== != < <= > >=`
- `STATUS("<field>") == "<value>"`
- `LOGGED_IN("<site_alias>")`

### Selector Priority

1. ARIA role/name or visible text
2. `data-test` / `data-qa`
3. Label→input association
4. CSS
5. XPath (last resort)

Avoid `nth-child` selectors.

## Planning Rules

- Always insert `WAIT_FOR` before `CLICK` or `TYPE`.
- Default timeout: **20s**. Retries: **2** (backoff 1s/3s).
- `WHILE` loops must include `MAX_LOOPS`.
- Guard mutations with idempotent checks.
- Capture evidence (screenshot + DOM snippet) after critical steps.

## Execution Rules

- Reuse session cookies.
- On Cloud: set pagination, rate limits, `include_finished=false`, always return `status`.
- On error: retry, then stop with diagnostics (step, locator, waits, retries, evidence, cause, next action).
- Redact all secrets.

## Outputs

1. **Normalized DSL block**.
2. **Action Plan** (step list: action, selector/URL, pre/post waits, retries).
3. **Logs** (timestamped, with retries and evidence).
4. **Structured JSON**:

```json
{
  "status": "success | partial | failed",
  "key_findings": {...},
  "records": [...],
  "artifacts": [
    {"type": "screenshot", "path": "..."},
    {"type": "dom-snippet", "path": "..."}
  ],
  "logs": [...],
  "next_actions": [...]
}
```

</first-draft> 

<deep-dive>

# Refining the Feature Proposal Prompt for PK-Code’s `/flowpk` Feature

## Summary of the Current Feature Proposal Template

**Structure:** The existing **Feature Proposal** document is organized into clear sections covering everything from high-level purpose to detailed specifications. It includes:

- **Purpose:** A brief description of what the feature should do (convert a natural-language instruction or mini-DSL script into a deterministic browser workflow).
- **Slash Command Integration:** User interface details, introducing a new slash command `/flowpk` with sub-commands (Create Workflow, List Workflows). It also describes **Granular Access** commands (`/flowpk edit [name]`, `/flowpk view [name]`) and a **Workflow CLI Format** for displaying workflows in a pseudo-terminal box layout (including an example illustrating conditional and action rows).
- **Conditional Agent Logic:** An example of embedding agent calls within the workflow (using `browser_use.Agent`) to decide conditional branches.
- **Inputs:** Defines two input modes – a free-text one-liner (to be normalized into the DSL) and a direct DSL script (already in DSL form). *(Note: The second input bullet in the template is blankly formatted, which presumably means a DSL script input.)*
- **DSL Syntax:** A thorough definition of the workflow scripting language, including keywords and data types, variable syntax, and lists of supported statements and structures. The DSL supports actions like `NAVIGATE`, `CLICK`, `TYPE`, `WAIT_FOR`, `EXTRACT`, `RESULT`, etc., control flow blocks like `IF…ELIF…ELSE`, `WHILE` loops with bounds, and `FOR_EACH` loops, as well as helper functions (`EXISTS(selector)`, `TEXT_CONTAINS`, `URL_CONTAINS`, etc.). It also specifies a priority order for element selectors (ARIA roles/text first, then data attributes, labels, CSS, and XPath last).
- **Planning Rules:** Guidelines for constructing the workflow logic (e.g. always insert a `WAIT_FOR` before `CLICK` or `TYPE`, enforce a default timeout, require `MAX_LOOPS` in loops, use idempotent checks before performing actions, capture evidence like screenshots after key steps).
- **Execution Rules:** Operational constraints for running workflows (e.g. reuse session cookies, set proper pagination/rate-limit flags for cloud execution, handle errors with retries and diagnostic info, and never expose secrets in outputs).
- **Outputs:** Expectations for what the feature should produce after execution. It lists four output components: (1) a normalized DSL code block, (2) an action plan (step-by-step list of actions with their waits/retries), (3) detailed logs, and (4) a structured JSON report with fields like `status`, `key_findings`, `records`, `artifacts` (e.g. screenshots, DOM snippets), `logs`, and `next_actions`.

**Strengths:** The current template is comprehensive and well-sectioned, which is valuable for understanding the feature’s scope. It clearly defines the new **DSL grammar and commands** (making it unambiguous what syntax the agent should accept). It also covers end-to-end considerations – from how users will invoke the feature (slash commands) to how the output should be structured – ensuring the agent (or developer) has a full picture of the desired functionality. The inclusion of **rules and examples** (like the CLI layout and agent logic snippet) provides concrete guidance and reduces guesswork. Overall, it reads like a mini-specification, touching UI, logic, and output format, which can guide implementation and testing.

 

**Limitations:** Despite its thoroughness, this proposal is written in a narrative, human-oriented style rather than in a structured prompt format optimized for an AI agent. There is **no explicit division of “persona, context, task, format”** – meaning an agent might not readily know what role to adopt, which details are background vs. instructions, and what the exact deliverable should look like. Some sections (e.g. the CLI box-drawing format and styling guidance) are descriptive and might be open to interpretation, which could confuse a deterministic machine planning process. The document doesn’t break down the implementation into discrete steps or **to-do items** – the agent would have to infer the tasks (parsing DSL, adding new commands, integrating with `browser_use`, etc.) from the description. In its current form, the prompt may risk the agent **overlooking requirements** (for example, the need to enforce idempotency or include `MAX_LOOPS` in loops) because they are buried in prose. Finally, the template does not specify the expected **output format from the agent’s perspective** (e.g. whether the agent should produce code snippets, a commit diff, a test plan, etc.), which could lead to non-deterministic results. In short, the content is rich, but it isn’t yet structured as a direct set of instructions for an autonomous coding agent.

## Agent-Oriented Four-Part Prompt Template

To make the feature request machine-friendly and unambiguous, we can rewrite it in the **Four-Part format** – explicitly separating the persona, context, task, and format. Below is a proposed template for the `/flowpk` feature prompt, designed for an internal agent to ingest and act on deterministically:

 

**Persona:** You are an AI coding agent integrated with the PK Codebase. You have access to the project’s files and context (including agent guidelines and browser automation libraries). You specialize in implementing new features by generating and modifying code, following project conventions and constraints. Act as a diligent software engineer who writes correct, well-structured code and updates documentation as needed.

 

**Context:** PK Code is introducing a new **browser workflow DSL feature** called `/flowpk`. The goal is to let users create and run browser automation flows by either writing a simple instruction (which must be converted to a DSL script) or by providing a script in a mini-DSL format. The following facts and requirements are known:

- The system already uses a library called **`browser_use`** to automate web actions for AI agents. The new DSL and workflows will build on this, enabling conditional logic and sequences of browser actions in a reusable way.
- **User Interface:** The feature will be accessed via a Slack-style **slash command** `/flowpk`. Users can choose to **Create Workflow** (enter a new one-liner or DSL script) or **List Workflows** via a submenu. Additional sub-commands will allow editing or viewing saved workflows (`/flowpk edit [name]`, `/flowpk view [name]`). This implies you need to implement command handlers or interactive prompts for these actions.
- **Workflow Storage:** Each workflow likely has a name/identifier. Created workflows should be saved (in memory or persistent storage) so they can be listed, viewed, and edited. Consider how to store the DSL scripts and any metadata (perhaps in a JSON or database, or using an existing “todo” or workflow list structure in pk-code).
- **DSL Syntax:** The mini-DSL must support common browser actions and control structures. **Actions** include navigating to pages, clicking, typing, waiting for elements, extracting data, logging notes, recording results, and performing logins. For example: `NAVIGATE "url"`, `CLICK <selector>`, `TYPE "text" INTO <selector>`, `WAIT_FOR <selector>`, `EXTRACT {field: expr} FROM <selector>`, `RESULT key = expr`, etc.. **Control flow** constructs include `IF/ELIF/ELSE ... END` for conditional branching, `WHILE <cond> ... END` (with a required `MAX_LOOPS` limit), and `FOR_EACH item IN <list> ... END` loops. The DSL also provides **helper functions** like `EXISTS(selector)` to check presence of an element, `TEXT_CONTAINS(scope, "substring")`, `URL_CONTAINS("substring")`, comparators (`==, !=, <, >, <=, >=`), and status checks such as `STATUS("field") == "value"` or `LOGGED_IN("site")`. Use case-insensitive keywords and quote strings; treat `#` as a comment delimiter. Variables can be assigned with `IDENT = expression`. (Refer to the Feature Proposal’s DSL spec for full details to implement the parser/validator).
- **Workflow Execution Rules:** When executing a workflow, follow the given rules. For **planning** the sequence: always insert a `WAIT_FOR` step before any `CLICK` or `TYPE` action (to ensure the element is present); ensure any `WHILE` loops include a `MAX_LOOPS` to prevent infinite loops; and aim for idempotence by guarding any state-changing actions with checks (e.g., only perform an action if it hasn’t been done, or element exists, etc.). For **execution**: reuse session cookies between steps (persist login state), handle cloud execution by respecting pagination and rate limit flags (`include_finished=false`, etc.), and on errors, implement a retry-then-abort logic with diagnostic info logged. Also, ensure sensitive data (like credentials or tokens) are never printed or logged in plain text.
- **Output format:** The feature should produce clear outputs after running a workflow. These include: (1) a normalized DSL script (the final DSL code that was executed, e.g. after translating a one-liner input), (2) an action plan – essentially a step-by-step listing of what actions were taken (including selectors or URLs targeted, wait times, and retry counts for each step), (3) execution logs with timestamps, including any retries and any evidence captured, and (4) a structured JSON object summarizing the run. The JSON should contain fields like `"status"` (`success`, `partial`, or `failed`), `"key_findings"` (any important results or flags the flow discovered), `"records"` (list of extracted data records, if any), `"artifacts"` (paths or references to screenshots/DOM snapshots taken), `"logs"` (perhaps an array or link to detailed logs), and `"next_actions"` (suggested next steps or follow-up actions). This means your implementation should collate these results, likely by accumulating logs and outputs during execution, then format the final results accordingly.

*(Additional context: See `AGENTS.md` for general agent guidelines and `WARP.md` for any existing browser automation architecture to ensure this implementation is consistent. The new `/flowpk` feature should align with how pk-code agents handle tasks and todos – for example, consider using any existing task queue or checklist format from `todo.md` if applicable.)*

 

**Task:** Implement the `/flowpk` browser-DSL feature in the pk-codebase, so that an end-user can create, edit, list, and execute browser workflows as described. Break down the work into the following sub-tasks:

1. **DSL Definition & Parser** – Create a robust parser or interpreter for the workflow DSL. This includes defining the grammar (per the spec) and writing code to parse commands and control structures. Ensure the parser can handle both a single-line natural language instruction (by converting it into DSL, possibly via prompt or rule-based mappings) and a multi-line DSL script. Validate DSL syntax (e.g., unknown commands or missing `END` for loops should produce errors). Consider where this code should reside (e.g., a new module like `flow_parser.py` or integrated into an existing browser automation module).
2. **Command Handlers (/flowpk)** – Implement the `/flowpk` slash command and its subcommands in the CLI or chat interface component of pk-code. This involves hooking into the command-dispatch system:
   - **Create Workflow:** prompt the user for a workflow name and either a one-liner or DSL script, then use the parser to normalize/validate it. Save the workflow definition in the system’s storage (could be an in-memory dictionary, a file, or a database – depending on pk-code’s architecture). Provide feedback if the workflow is saved successfully or if there are syntax errors.
   - **List Workflows:** retrieve the list of saved workflows and display their names (and maybe a short description) to the user.
   - **View Workflow:** when given a workflow name, retrieve and display the stored DSL script in the CLI-style box format as described (render conditions and indented actions with the special box-drawing characters for a polished look).
   - **Edit Workflow:** allow updating an existing workflow’s DSL. Likely, this means fetching the current script, showing it (perhaps in an editor or as text), and then accepting a modified version from the user, then saving it back. Ensure the updated script is parsed/validated before saving.
     Make sure to handle user input carefully and provide helpful messages (e.g., confirm on successful save, or error messages if a workflow name is not found).
3. **Workflow Execution Engine:** Enable running the workflows step by step using the DSL. Integrate with `browser_use` (or the internal browser agent logic) to perform each action in the script. This will involve implementing functions for each DSL statement (e.g., a function to actually perform `NAVIGATE` using a browser controller, a function for `CLICK` that finds the element by selector and clicks it, etc.). Use or extend the existing `Agent` or browser session classes to carry out these actions. For control flow, implement the logic to evaluate conditions (including possibly calling `Agent(task=...)` as shown in the example for agent-based conditions) and loop structures (ensuring loops respect `MAX_LOOPS` to avoid infinite iterations).
   - As the workflow runs, collect logs and evidence. For example, after a `CLICK`, you might take a screenshot or, after an `EXTRACT`, save the extracted data. Store these in a structured way so they can be output later. Apply the **Planning/Execution Rules**: always wait for elements before interactions, retry actions on failures a couple of times, and stop if something consistently fails while logging the failure cause. Redact or omit any sensitive info from logs.
   - Idempotency: if the same workflow is run multiple times, design it so that it doesn’t create duplicate effects (e.g., if a workflow registers a user and it’s already registered, perhaps detect that and skip). This may be more about how the user writes flows, but your engine can provide hooks (like `EXISTS()` checks and conditions) to facilitate this.
4. **Result Aggregation & Output:** After execution, compile the outputs as specified. This means printing or sending back to the user a **normalized DSL block** (especially if they gave a one-liner input, show the expanded DSL script), an **Action Plan** (probably a list of each step taken – you can derive this from the execution log, including any waits or retries for each step), and the **Logs** (which might be quite verbose; consider whether to show full logs or just a summary with a reference to a log file). Most importantly, produce the **Structured JSON** result. Implement a function to populate this JSON structure with the run’s outcome (status, any key findings or outputs gathered by `EXTRACT` steps, number of records or items processed, file paths of saved artifacts like screenshots, etc.). Ensure this JSON is well-formed and includes all required fields.
5. **Testing & Validation:** Write unit or integration tests for the critical pieces – e.g., parsing various DSL snippets (covering each command and control structure), executing a simple workflow in a dry-run mode, and the slash command handlers. Verify that listing, viewing, editing workflows update the stored data correctly. Also test error conditions (like malformed DSL, or trying to run a workflow that doesn’t exist) to confirm the system responds gracefully. If `todo.md` or similar files exist for tracking features, update them with checkmarks or notes that this feature is implemented. Additionally, update or create any documentation (if there’s a README or `CLAUDE.md`/`AGENTS.md` file describing available commands or behaviors, add the details of `/flowpk` feature there for future reference).

**Format:**

- **Plan First, Then Implement:** Begin by outputting a brief **implementation plan** enumerating the steps or components you will develop (you can largely follow the task breakdown above). Use a clear, bullet-point or checkbox format for the plan so it’s easy to verify against requirements before coding. For example: start with a checklist of “[ ] Parser for DSL”, “[ ] /flowpk command wiring”, etc. This lets reviewers (or the agent supervisor) confirm the approach.
- **Code Changes:** After the plan, produce the necessary **code modifications**. For each file to be created or edited, provide the file path and the code content. If modifying existing files, show the diff or at least the relevant sections with your changes. Ensure code is well-formatted and commented where non-obvious. When creating new modules (e.g., `flowpk.py` or similar), include module docstrings or comments describing their purpose.
- **Testing Output:** If applicable, include any new tests or example usage demonstrating the feature working (for instance, an example of running a simple workflow and the resulting JSON). These can be presented as additional code blocks or a short narrated sequence.
- **No Extraneous Commentary:** Apart from structured planning remarks and necessary in-line comments in code, do not output extraneous explanation. The final answer should be actionable — the plan (for oversight) and the code (for execution). Keep all outputs in **Markdown format** (for readability in the pk-code review system), using triple backticks for code blocks and clear markdown syntax for lists or headings.

By following this format, the instructions to the agent are explicit: it knows its role, has all relevant context (feature spec and rules), a breakdown of what to do, and how to present the solution. This structured prompt should make the agent’s behavior **deterministic** and aligned with pk-code’s development workflow.

## Implementation Strategy Recommendations

When directing an autonomous agent to implement this feature, there are multiple possible approaches. Here are a few strategies along with their pros and cons:

1. **Pseudocode-First Implementation:** The agent first writes high-level pseudocode or a step-by-step plan for the feature, then incrementally refines that into actual code. **Pros:** This approach forces the agent to structure the solution before diving into syntax, which can lead to fewer logical errors and a clearer understanding of the required components. It also provides an opportunity for review or verification of the approach at the pseudocode stage (useful if the process involves human oversight or an automated plan-checking system). **Cons:** It can be time-consuming, as the agent essentially writes the solution twice (once in pseudocode, once in code). There’s also a risk that the pseudocode might not capture all low-level details, leading to gaps that have to be addressed during coding anyway. In an automated pipeline, writing pseudocode might be an unnecessary step unless it’s actually reviewed or utilized – if not, it could reduce efficiency.
2. **DSL-First, Bottom-Up Development:** Focus on the core DSL parsing and execution logic before integrating the feature with the UI/commands. For example, the agent would first implement the DSL parser and ensure that workflows can be executed programmatically, and only then add the slash command interface and storage of flows. **Pros:** By tackling the DSL engine in isolation, the agent can validate the hardest part (interpreting and running workflows) without the additional complexity of user interface concerns. This bottom-up approach ensures that once the UI is wired up, it relies on a solid, tested back-end. It’s especially good if there are existing tests or examples to run the DSL engine headlessly. **Cons:** It delays seeing an end-to-end result – until the UI is connected, there’s no user-visible functionality, which might make it harder to validate the feature as a whole early on. There’s also a possibility of designing the DSL engine in a way that doesn’t mesh perfectly with how the commands are supposed to be used (for instance, how workflows are stored or referenced by name). In other words, a purely back-end focus might require rework once the front-end integration is attempted. Coordination between the DSL part and the command part is needed to avoid mismatches.
3. **Test-Driven Development (TDD):** Write tests for the expected behaviors (parsing certain DSL snippets, executing a sample workflow, ensuring outputs JSON structure matches spec, etc.) before or in parallel with writing the implementation. **Pros:** This ensures the requirements are concretely defined – the agent will have to think about the feature in terms of verifiable outcomes from the start. It reduces the chance of regressions and provides a safety net; once the code is written, passing the tests will confirm that major aspects (like “WAIT_FOR is always before CLICK in plan” or “a missing END yields a parse error”) are correctly handled. TDD can guide the agent to write only the necessary code to fulfill the test expectations, possibly avoiding over-engineering. **Cons:** Writing tests requires the agent to *already* understand the desired behavior in detail, which might be challenging if the spec is complex – essentially the agent has to solve the problem (in terms of expected results) before writing the solution. If the agent misinterprets the spec and writes incorrect tests, it might then implement code that passes those tests but still doesn’t meet the true requirements. Also, creating extensive tests upfront can be time-consuming; if the agent is under strict token or time constraints, it might slow down the development process. Finally, maintaining those tests adds overhead – if the spec changes, tests need to be updated along with code.

Each of these strategies could be viable for implementing the `/flowpk` feature. In practice, a **hybrid approach** might work best: for instance, the agent could sketch a high-level plan (like pseudocode) to break the task down, then implement the DSL parser first (unit testing it with a few cases), and progressively build up to the full feature, using small tests at each stage (rather than fully test-driven or fully one-shot coding). This leverages the strengths of each method while mitigating their weaknesses. The key is that our refined prompt will guide the agent to adopt a structured approach – by planning first and being aware of the specification details – which naturally lends itself to a more deterministic and correct implementation.

</deep-dive>