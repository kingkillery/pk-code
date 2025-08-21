# CLI Commands

PK CLI supports several built-in commands to help you manage your session, customize the interface, and control its behavior. These commands are prefixed with a forward slash (`/`), an at symbol (`@`), or an exclamation mark (`!`).

## pk commands

These commands are run directly from your terminal.

- **`pk config`**
  - **Description:** Manage your AI provider credentials.
  - **Sub-commands:**
    - **`add <provider> <apiKey>`**
      - **Description:** Adds a new credential for a specified provider.
      - **Usage:** `pk config add openai YOUR_API_KEY`
    - **`remove <provider>`**
      - **Description:** Removes the credential for a specified provider.
      - **Usage:** `pk config remove openai`
    - **`list`**
      - **Description:** Lists all configured providers.
      - **Usage:** `pk config list`

- **`pk generate \u003cprompt\u003e`**
  - **Description:** Generates code from a prompt using the configured provider.
  - **Usage:** `pk generate "create a react component that displays a button"`

- **Non-interactive prompt flags**
  - `-p, --prompt` String prompt. Appended to stdin if provided.
  - `--prompt-file` Path to a file containing the prompt. Useful for long or quote-heavy text and Windows PowerShell.
  - `-i, --prompt-interactive` Execute the provided prompt, then remain in interactive mode.
  - Mutual exclusivity: Do not combine `--prompt-file` with `-p/--prompt` or `-i/--prompt-interactive`.
  - Verify your setup (safe no-op): `pk --prompt-file prompt.txt --list-extensions`
  - PowerShell examples:
    - Here-string (safe for quotes and angle brackets):
      `pk --prompt @'\nSystem for Judging "Interesting" AI Posts\n- criterion 1\n- criterion 2\n'@`
    - File-based prompt:
      `Set-Content -Path prompt.txt -Value @'\nSystem for Judging "Interesting" AI Posts\n- criterion 1\n- criterion 2\n'@ ; pk --prompt-file prompt.txt`
    - Single-quoted inline (short prompts only):
      `pk --prompt 'Short "quoted" prompt with > and < safely wrapped'`

Slash commands provide meta-level control over the CLI itself.

- **`/bug`**
  - **Description:** File an issue about Gemini CLI. By default, the issue is filed within the GitHub repository for Gemini CLI. The string you enter after `/bug` will become the headline for the bug being filed. The default `/bug` behavior can be modified using the `bugCommand` setting in your `.qwen/settings.json` files.

- **`/chat`**
  - **Description:** Save and resume conversation history for branching conversation state interactively, or resuming a previous state from a later session.
  - **Sub-commands:**
    - **`save`**
      - **Description:** Saves the current conversation history. You must add a `<tag>` for identifying the conversation state.
      - **Usage:** `/chat save <tag>`
    - **`resume`**
      - **Description:** Resumes a conversation from a previous save.
      - **Usage:** `/chat resume <tag>`
    - **`list`**
      - **Description:** Lists available tags for chat state resumption.

- **`/clear`**
  - **Description:** Clear the terminal screen, including the visible session history and scrollback within the CLI. The underlying session data (for history recall) might be preserved depending on the exact implementation, but the visual display is cleared.
  - **Keyboard shortcut:** Press **Ctrl+L** at any time to perform a clear action.

- **`/compress`**
  - **Description:** Replace the entire chat context with a summary. This saves on tokens used for future tasks while retaining a high level summary of what has happened.

- **`/editor`**
  - **Description:** Open a dialog for selecting supported editors.

- **`/extensions`**
  - **Description:** Lists all active extensions in the current Gemini CLI session. See [Gemini CLI Extensions](../extension.md).

- **`/help`** (or **`/?`**)
  - **Description:** Display help information about the Gemini CLI, including available commands and their usage.

- **`/mcp`**
  - **Description:** List configured Model Context Protocol (MCP) servers, their connection status, server details, and available tools.
  - **Sub-commands:**
    - **`desc`** or **`descriptions`**:
      - **Description:** Show detailed descriptions for MCP servers and tools.
    - **`nodesc`** or **`nodescriptions`**:
      - **Description:** Hide tool descriptions, showing only the tool names.
    - **`schema`**:
      - **Description:** Show the full JSON schema for the tool's configured parameters.
  - **Keyboard Shortcut:** Press **Ctrl+T** at any time to toggle between showing and hiding tool descriptions.

- **`/memory`**
  - **Description:** Manage the AI's instructional context (hierarchical memory loaded from `GEMINI.md` files).
  - **Sub-commands:**
    - **`add`**:
      - **Description:** Adds the following text to the AI's memory. Usage: `/memory add <text to remember>`
    - **`show`**:
      - **Description:** Display the full, concatenated content of the current hierarchical memory that has been loaded from all `GEMINI.md` files. This lets you inspect the instructional context being provided to the Gemini model.
    - **`refresh`**:
      - **Description:** Reload the hierarchical instructional memory from all `GEMINI.md` files found in the configured locations (global, project/ancestors, and sub-directories). This command updates the model with the latest `GEMINI.md` content.
    - **Note:** For more details on how `GEMINI.md` files contribute to hierarchical memory, see the [CLI Configuration documentation](./configuration.md#4-geminimd-files-hierarchical-instructional-context).

- **`/restore`**
  - **Description:** Restores the project files to the state they were in just before a tool was executed. This is particularly useful for undoing file edits made by a tool. If run without a tool call ID, it will list available checkpoints to restore from.
  - **Usage:** `/restore [tool_call_id]`
  - **Note:** Only available if the CLI is invoked with the `--checkpointing` option or configured via [settings](./configuration.md). See [Checkpointing documentation](../checkpointing.md) for more details.

- **`/stats`**
  - **Description:** Display detailed statistics for the current Gemini CLI session, including token usage, cached token savings (when available), and session duration. Note: Cached token information is only displayed when cached tokens are being used, which occurs with API key authentication but not with OAuth authentication at this time.

- [**`/theme`**](./themes.md)
  - **Description:** Open a dialog that lets you change the visual theme of Gemini CLI.

- **`/auth`**
  - **Description:** Open a dialog that lets you change the authentication method.

- **`/about`**
  - **Description:** Show version info. Please share this information when filing issues.

## Agent Creation

PK CLI supports creating custom AI agents using interactive prompts. This leverages the existing `pk -p` command with specialized templates.

### Basic Agent Creation

To create a new agent, use the interactive mode with an agent creation template:

```bash
pk -p "You are an expert agent designer. Help me create a new AI agent for [describe your needs]. Please create an agent file following the standard format and save it to .pk/agents/[agent-name].md"
```

### Using Specialized Templates

For common agent types, you can reference specific templates located in `.claude/prompts/`:

- **General Agent**: Use `.claude/prompts/agent-creation-template.md`
- **Code Review Agent**: Use `.claude/prompts/code-review-agent-template.md`
- **Debugging Agent**: Use `.claude/prompts/debugging-agent-template.md`
- **Documentation Agent**: Use `.claude/prompts/documentation-agent-template.md`
- **Testing Agent**: Use `.claude/prompts/testing-agent-template.md`

### Example Agent Creation

```bash
# Create a database optimization agent
pk -p "Using the agent creation template, help me create a database optimization agent that specializes in PostgreSQL performance tuning, query optimization, and index management."

# Create a React code reviewer
pk -p "Using the code review agent template, help me create a React code reviewer that focuses on component best practices, hooks usage, and performance optimization."
```

### Agent File Format

Created agents follow this structure:

```markdown
---
name: agent-name
description: Brief description of what this agent does
color: blue|red|green|yellow|purple
---

# Agent Name

Detailed description of the agent's capabilities and behavior.

## Core Traits

- Key characteristics
- Specializations

## Examples

<example>
Context: When to use this agent
user: 'Example user input'
assistant: 'Expected response pattern'
</example>
```

### Agent Management

- **Location**: Agents are saved to `.pk/agents/[agent-name].md`
- **Naming**: Use lowercase with hyphens (e.g., `database-optimizer`)
- **Colors**: Choose from blue, red, green, yellow, purple
- **Validation**: The system checks for existing agents before creation

- [**`/tools`**](../tools/index.md)
  - **Description:** Display a list of tools that are currently available within Gemini CLI.
  - **Sub-commands:**
    - **`desc`** or **`descriptions`**:
      - **Description:** Show detailed descriptions of each tool, including each tool's name with its full description as provided to the model.
    - **`nodesc`** or **`nodescriptions`**:
      - **Description:** Hide tool descriptions, showing only the tool names.

- **`/privacy`**
  - **Description:** Display the Privacy Notice and allow users to select whether they consent to the collection of their data for service improvement purposes.

- **`/quit`** (or **`/exit`**)
  - **Description:** Exit Gemini CLI.

## At commands (`@`)

At commands are used to include the content of files or directories as part of your prompt to Gemini. These commands include git-aware filtering.

- **`@<path_to_file_or_directory>`**
  - **Description:** Inject the content of the specified file or files into your current prompt. This is useful for asking questions about specific code, text, or collections of files.
  - **Examples:**
    - `@path/to/your/file.txt Explain this text.`
    - `@src/my_project/ Summarize the code in this directory.`
    - `What is this file about? @README.md`
  - **Details:**
    - If a path to a single file is provided, the content of that file is read.
    - If a path to a directory is provided, the command attempts to read the content of files within that directory and any subdirectories.
    - Spaces in paths should be escaped with a backslash (e.g., `@My\ Documents/file.txt`).
    - The command uses the `read_many_files` tool internally. The content is fetched and then inserted into your query before being sent to the Gemini model.
    - **Git-aware filtering:** By default, git-ignored files (like `node_modules/`, `dist/`, `.env`, `.git/`) are excluded. This behavior can be changed via the `fileFiltering` settings.
    - **File types:** The command is intended for text-based files. While it might attempt to read any file, binary files or very large files might be skipped or truncated by the underlying `read_many_files` tool to ensure performance and relevance. The tool indicates if files were skipped.
  - **Output:** The CLI will show a tool call message indicating that `read_many_files` was used, along with a message detailing the status and the path(s) that were processed.

- **`@` (Lone at symbol)**
  - **Description:** If you type a lone `@` symbol without a path, the query is passed as-is to the Gemini model. This might be useful if you are specifically talking _about_ the `@` symbol in your prompt.

### Error handling for `@` commands

- If the path specified after `@` is not found or is invalid, an error message will be displayed, and the query might not be sent to the Gemini model, or it will be sent without the file content.
- If the `read_many_files` tool encounters an error (e.g., permission issues), this will also be reported.

## Shell mode & passthrough commands (`!`)

The `!` prefix lets you interact with your system's shell directly from within Gemini CLI.

- **`!<shell_command>`**
  - **Description:** Execute the given `<shell_command>` in your system's default shell. Any output or errors from the command are displayed in the terminal.
  - **Examples:**
    - `!ls -la` (executes `ls -la` and returns to Gemini CLI)
    - `!git status` (executes `git status` and returns to Gemini CLI)

- **`!` (Toggle shell mode)**
  - **Description:** Typing `!` on its own toggles shell mode.
    - **Entering shell mode:**
      - When active, shell mode uses a different coloring and a "Shell Mode Indicator".
      - While in shell mode, text you type is interpreted directly as a shell command.
    - **Exiting shell mode:**
      - When exited, the UI reverts to its standard appearance and normal Gemini CLI behavior resumes.

- **Caution for all `!` usage:** Commands you execute in shell mode have the same permissions and impact as if you ran them directly in your terminal.
