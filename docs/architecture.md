# Architecture Overview

This document provides a high-level overview of the Qwen Code CLI's architecture.

## Core Components

The Qwen Code CLI is composed of several key packages that work together to provide a flexible and extensible AI coding assistant.

1.  **CLI Package (`packages/cli`):**
    - **Purpose:** This is the main user-facing component of the Qwen Code CLI. It handles user input, renders the UI, and manages the overall interactive experience.
    - **Key Functions:**
      - Command-line argument parsing
      - Interactive UI rendering (using Ink)
      - Command handling (e.g., `config`, `generate`, `init`)

2.  **Core Package (`packages/core`):**
    - **Purpose:** This package provides the core, shared functionality used by all other parts of the application. It defines the standardized interfaces and provides essential services.
    - **Key Functions:**
      - `AIProvider` interface: A standardized interface that all AI provider packages must implement.
      - Secure credential management (using `keytar`)

3.  **Provider Packages (`packages/openai`, `packages/gemini`, etc.):**
    - **Purpose:** Each provider package is a self-contained module that implements the `AIProvider` interface for a specific AI service (e.g., OpenAI, Google Gemini, OpenRouter).
    - **Key Functions:**
      - API client for the specific AI service
      - Implementation of the `initialize` and `generateCode` methods from the `AIProvider` interface

4.  **VS Code Extension (`packages/vscode-ide-companion`):**
    - **Purpose:** This package provides an integration with Visual Studio Code, allowing users to interact with Qwen Code directly from their editor.
    - **Key Functions:**
      - An MCP (Model Context Protocol) server that exposes Qwen Code's functionality to the editor.
      - Tools for interacting with the editor, such as getting the active file or inserting generated code.

## Provider-Based Architecture

The Qwen Code CLI is built on a provider-based architecture. This means that the core application is not tied to any specific AI provider. Instead, it interacts with providers through a standardized `AIProvider` interface.

This architecture provides several key benefits:

- **Flexibility:** Users can choose from a variety of supported AI providers.
- **Extensibility:** It is easy to add support for new AI providers by simply creating a new package that implements the `AIProvider` interface.
- **Maintainability:** The code for each provider is isolated in its own package, making it easier to maintain and update.

## Interaction Flow

A typical interaction with the Qwen Code CLI follows this flow:

1.  **User Input:** The user runs a command in their terminal (e.g., `qwen-code generate "..."`).
2.  **Command Handling:** The `packages/cli` package parses the command and its arguments.
3.  **Provider Selection:** The appropriate provider package is selected based on the user's configuration.
4.  **Credential Retrieval:** The `packages/core` package securely retrieves the user's API key for the selected provider.
5.  **Provider Initialization:** The selected provider is initialized with the user's API key.
6.  **Code Generation:** The provider's `generateCode` method is called with the user's prompt.
7.  **API Request:** The provider sends a request to the AI service's API.
8.  **API Response:** The AI service returns the generated code.
9.  **Display to User:** The `packages/cli` package displays the generated code to the user in the terminal.
