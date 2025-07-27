# PK-Code & Browser-Use Integration Plan

## 1. Executive Summary

**Goal:** To integrate the `browser-use` Python library into the `pk-code` Node.js CLI, creating a single, powerful agentic tool that can reason about a local codebase and interact with live web applications.

**Chosen Architecture:** We will use the Model Context Protocol (MCP) as the bridge between the two tools.

- **`pk-code` (The Client):** Will act as an MCP client, leveraging its existing MCP capabilities.
- **`browser-use` (The Server):** Will run as a separate, persistent MCP server process, exposing browser automation tools.

This architecture is robust, scalable, and allows for a clean separation of concerns between the code-focused agent (`pk-code`) and the web-focused tool (`browser-use`).

**Core User Benefit:** Users will be able to issue high-level, multi-domain commands (e.g., "Analyze this component, then find its live implementation in our Storybook and take a screenshot.") that `pk-code` will autonomously execute by orchestrating its internal tools and the new browser tools.

## 2. Implementation Details

### Part A: The `browser-use` MCP Server Setup

This part focuses on ensuring the `browser-use` server is run correctly to provide a stateful and persistent browser environment. The key is using a persistent browser profile to maintain logins, cookies, and sessions.

**Action Items:**

1.  **Create User Documentation:** Write clear instructions for users on how to enable browser persistence. This involves finding their local browser's `User Data` directory path.
    - **Windows:** `C:\Users\<YourUser>\AppData\Local\Google\Chrome\User Data`
    - **macOS:** `~/Library/Application Support/Google/Chrome`
    - **Linux:** `~/.config/google-chrome`
2.  **Create a Helper Script:** Add a script to the `pk-code` repository (e.g., `scripts/start-browser-agent.sh`) to abstract away the complexity of starting the server. This script will set the necessary environment variable and launch the `browser-use` MCP server.

    ```bash
    #!/bin/bash
    # This script starts the browser-use agent with a persistent profile.

    # --- IMPORTANT ---
    # Set this path to your actual Chrome/Chromium user data directory.
    export BROWSER_USE_USER_DATA_DIR="/path/to/your/chrome/profile"

    echo "Starting browser-use MCP server with persistent profile..."
    echo "Browser data will be loaded from: $BROWSER_USE_USER_DATA_DIR"

    uvx browser-use --mcp
    ```

### Part B: `pk-code` MCP Client Integration

This part involves the core development work within the `pk-code` codebase to consume the tools exposed by the `browser-use` server.

**Action Items:**

1.  **Establish MCP Connection:**
    - Modify `pk-code`'s MCP client logic to connect to the `browser-use` server. This connection should be configurable and initiated when browser tools are required.
2.  **Implement Tool Prefixing:**
    - When registering tools from the `browser-use` server, apply a unique namespace prefix (e.g., `browser.`) to all incoming tools. This prevents naming collisions with `pk-code`'s internal tools and creates a clear `browser.navigate`, `browser.click`, `browser.get_state` command structure.
3.  **Enhance Agent Prompting:**
    - Update the `pk-code` agent's core system prompt. When the `browser.*` tools are detected, the prompt must be dynamically augmented to inform the LLM of these new capabilities.
    - _Example Prompt Addition:_ "You have a set of tools prefixed with `browser.` to interact with a live web browser. Use `browser.get_state` to see the current page and its interactive elements. Use `browser.click(index)` and `browser.type(index, text)` to interact with those elements."
4.  **Implement Vision Model Routing:**
    - The `browser.get_state` tool can return a base64-encoded screenshot.
    - When the `pk-code` agent receives a tool response containing a screenshot, it must intelligently route the next phase of its reasoning to a vision-capable model (e.g., GPT-4V, or `bytedance/ui-tars-1.5-7b` via OpenRouter). This is essential for visual analysis and UI-related tasks.

### Part C: User Experience & Process Management

This part focuses on making the integration seamless for the end-user.

**Action Items:**

1.  **Create `agent` Commands:**
    - Implement `pk agent start browser`: This command will use Node.js's `child_process` to execute the `scripts/start-browser-agent.sh` script in the background, managing the server process for the user.
    - Implement `pk agent stop browser`: This command will find and terminate the background `browser-use` server process.
2.  **Implement First-Time Setup:**
    - Create a one-time setup command: `pk config browser`. This interactive command will guide the user in finding their browser profile path and save it to the `pk-code` global settings file, so they don't have to set the environment variable manually.

## 3. Phased Rollout Plan

### Phase 1: Core Integration (MVP)

- [ ] Implement the MCP connection logic in `pk-code`.
- [ ] Implement the `browser.` tool prefixing.
- [ ] Create the initial user documentation for manually starting the `browser-use` server with the correct environment variable.
- [ ] Update the agent's system prompt to recognize and describe the new browser tools.

### Phase 2: Enhanced User Experience

- [ ] Create the `scripts/start-browser-agent.sh` helper script.
- [ ] Implement the `pk agent start browser` and `pk agent stop browser` commands for easy process management.
- [ ] Implement the `pk config browser` command for a guided first-time setup.

### Phase 3: Advanced Visual Agency

- [ ] Implement the vision model routing logic. When a screenshot is present in the context, `pk-code` should automatically use a specified vision model for analysis.

### Phase 4: The "Super-Agent" Orchestrator

- [ ] Evolve the MCP client to support connections to **multiple** MCP servers simultaneously (e.g., `browser-use`, `filesystem`, `github`).
- [ ] This will enable `pk-code` to tackle extremely complex, cross-domain tasks, solidifying its position as a top-tier developer agent.
