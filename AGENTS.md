# Agent Development Guide

This guide is intended for AI agents working on the PK Code codebase. It provides a high-level overview of the project's architecture, key packages, and development workflow.

## Architecture

The PK Code CLI is built on a modular, provider-based architecture. This means that the core application is not tied to any specific AI provider. Instead, it interacts with providers through a standardized `AIProvider` interface.

### Key Packages

- **`packages/cli`:** The main user-facing component of the PK Code CLI. It handles user input, renders the UI, and manages the overall interactive experience.
- **`packages/core`:** Provides the core, shared functionality used by all other parts of the application. It defines the standardized interfaces and provides essential services.
- **`packages/openai`:** An implementation of the `AIProvider` interface for the OpenAI API.
- **`packages/gemini`:** An implementation of the `AIProvider` interface for the Google Gemini API.
- **`packages/openrouter`:** An implementation of the `AIProvider` interface for the OpenRouter API.
- **`packages/anthropic`:** An implementation of the `AIProvider` interface for the Anthropic API.
- **`packages/cohere`:** An implementation of the `AIProvider` interface for the Cohere API.
- **`packages/vscode-ide-companion`:** An integration with Visual Studio Code, allowing users to interact with PK Code directly from their editor.
- **`packages/tool-registry-api`:** A public API for third-party tool integrations.

## Browser-Use Integration

The `browser-use` library is integrated into the PK Code CLI, allowing agents to interact with live web applications. This integration is achieved through the Model Context Protocol (MCP), with `browser-use` running as a separate MCP server.

### Enabling the Browser-Use Integration

To enable the `browser-use` integration, you must first configure the path to your browser's user data directory. This can be done by running the following command:

```bash
pk config browser
```

This command will guide you through an interactive setup process to find and save the correct path.

### Starting and Stopping the Browser-Use Agent

Once the `browser-use` integration has been configured, you can start and stop the `browser-use` agent using the following commands:

```bash
# Start the browser-use agent
pk agent start browser

# Stop the browser-use agent
pk agent stop browser
```

When the `browser-use` agent is running, a set of `browser.*` tools will be available to the PK Code agent, allowing it to interact with the web browser.
