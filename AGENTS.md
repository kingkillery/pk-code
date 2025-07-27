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

## Development Workflow

When working on the PK Code codebase, please adhere to the following workflow:

1.  **Understand the Task:** Carefully review the task description and any related documentation.
2.  **Analyze the Codebase:** Before making any changes, analyze the existing codebase to understand the current implementation and identify the relevant files and packages.
3.  **Implement the Changes:** Make the necessary changes to the codebase, following the existing coding style and conventions.
4.  **Update the Documentation:** After implementing the changes, update any relevant documentation to reflect the new functionality.
5.  **Submit a Pull Request:** Once the changes are complete and the documentation has been updated, submit a pull request for review.
