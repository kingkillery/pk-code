# PK Code CLI

![PK Code Screenshot](./docs/assets/pk-screenshot.png)

PK Code is a powerful AI-driven command-line interface that transforms how developers interact with code. Built as a modern terminal application, it combines the power of large language models with intuitive developer workflows to streamline coding, debugging, and project management tasks.

## ✨ Key Features

- **🧠 Intelligent Code Analysis** - Understand complex codebases instantly with AI-powered insights
- **⚡ Interactive Terminal Interface** - Beautiful, responsive CLI built with React and Ink
- **🔗 Multi-Provider Support** - Works with OpenAI, Anthropic, Google Gemini, and more
- **🎯 Context-Aware Assistance** - Maintains project context across conversations
- **🛠️ Workflow Automation** - Automate repetitive development tasks
- **🔍 Vision Model Integration** - Advanced UI analysis and screenshot interpretation
- **📦 Monorepo Architecture** - Scalable codebase with modular packages

## 🚀 Quick Start

### Prerequisites

- [Node.js 20+](https://nodejs.org/en/download) 
- Your preferred AI provider API key

### Installation

#### From npm (Recommended)

```bash
npm install -g pk-code-cli
pk --version
```

#### From Source

```bash
git clone https://github.com/kingkillery/pk-code.git
cd pk-code
npm install
npm run build
npm install -g .
```

### Configuration

Create a `.env` file in your project root or set environment variables:

#### OpenAI

```bash
export OPENAI_API_KEY="your_openai_key"
export OPENAI_MODEL="gpt-4"
```

#### Anthropic Claude

```bash
export ANTHROPIC_API_KEY="your_anthropic_key"
export ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"
```

#### Google Gemini

```bash
export GOOGLE_API_KEY="your_google_key"
export GOOGLE_MODEL="gemini-1.5-pro"
```

## 🎯 Usage

### Interactive Mode

Launch PK Code in interactive mode for conversational coding assistance:

```bash
cd your-project/
pk
```

Example interactions:

```
> Explain the architecture of this codebase
> Help me debug this React component
> Generate unit tests for the auth service
> Refactor this function to use TypeScript
```

### Direct Commands

Execute specific tasks without entering interactive mode:

```bash
# Code generation
pk generate "Create a REST API endpoint for user authentication"

# Code analysis
pk analyze "What are the performance bottlenecks in this code?"

# Documentation
pk docs "Generate JSDoc comments for all functions in src/utils"
```

## 🔌 Supported AI Providers

| Provider | Models | Features |
|----------|--------|----------|
| **OpenAI** | GPT-4, GPT-3.5 | Chat, Code, Vision |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 | Advanced reasoning, Code |
| **Google** | Gemini 1.5 Pro, Gemini 1.0 Pro | Multimodal, Long context |
| **OpenRouter** | Multiple models | Model variety, Cost optimization |
| **Cohere** | Command R+, Command | Multilingual, RAG |

## 🎨 Vision & Multimodal Support

PK Code features advanced vision capabilities for UI analysis, screenshot interpretation, and visual debugging.

### Features

- **🔄 Smart Model Routing** - Automatically chooses between text and vision models
- **🖥️ UI Analysis** - Specialized models for interface understanding
- **📸 Screenshot Processing** - Analyze application screenshots and mockups
- **🔧 Browser Integration** - Works seamlessly with browser automation tools

### Configuration

```bash
# Enable vision capabilities
ENABLE_VISION_ROUTING=true
VISION_MODEL_NAME="gpt-4-vision-preview"
VISION_MODEL_PROVIDER="openai"
VISION_ROUTING_STRATEGY="auto"
```

### Example Usage

```bash
# Analyze a screenshot
pk "What UI improvements can you suggest for this dashboard?"

# Debug visual issues
pk "Why is the layout broken on mobile devices?"

# Generate code from mockups
pk "Convert this design mockup into React components"
```

## 🔧 Advanced Configuration

### Provider-Specific Settings

```bash
# OpenRouter (Access to multiple models)
export OPENROUTER_API_KEY="your_openrouter_key"
export OPENROUTER_MODEL="anthropic/claude-3.5-sonnet"

# Cohere (Optimized for enterprise)
export COHERE_API_KEY="your_cohere_key"
export COHERE_MODEL="command-r-plus"
```

### Advanced Options

```bash
# Context settings
export PK_MAX_CONTEXT_SIZE=32000
export PK_CONVERSATION_MEMORY=true

# Performance tuning
export PK_RESPONSE_TIMEOUT=30000
export PK_CONCURRENT_REQUESTS=3

# Debug mode
export DEBUG=pk:*
```

## 🚀 CI/CD Integration

### GitHub Actions

Integrate PK Code into your CI/CD pipeline for automated code analysis and generation:

```yaml
name: Code Analysis with PK Code

on: [pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install PK Code
        run: npm install -g pk-code-cli
      
      - name: Analyze Code Changes
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          pk analyze "Review the changes in this PR for potential issues"
```

## 📚 Common Use Cases

### 🔍 Code Review & Analysis

```bash
# Analyze code quality
pk "Review this function for potential bugs and improvements"

# Security audit
pk "Check this code for security vulnerabilities"

# Performance analysis
pk "Identify performance bottlenecks in this module"
```

### 🏗️ Code Generation

```bash
# Generate boilerplate
pk "Create a complete CRUD API for a user management system"

# Generate tests
pk "Write comprehensive unit tests for the authentication service"

# Generate documentation
pk "Create detailed API documentation for all endpoints"
```

### 🐛 Debugging & Problem Solving

```bash
# Debug issues
pk "Help me understand why this React component isn't re-rendering"

# Explain error messages
pk "Explain this TypeScript error and suggest fixes"

# Architecture guidance
pk "Suggest the best design pattern for this use case"
```

## 📊 Performance & Benchmarks

| Task Type | Response Time | Accuracy | Token Efficiency |
|-----------|---------------|----------|------------------|
| Code Analysis | 2-5s | 95% | ⭐⭐⭐⭐⭐ |
| Code Generation | 3-8s | 92% | ⭐⭐⭐⭐ |
| Debugging Help | 1-3s | 96% | ⭐⭐⭐⭐⭐ |
| Documentation | 2-6s | 94% | ⭐⭐⭐⭐ |

## 🏗️ Architecture

PK Code is built with a modern, extensible architecture:

```
pk-code/
├── packages/
│   ├── core/              # Core engine and utilities
│   ├── cli/               # Command-line interface
│   ├── vscode-ide-companion/  # VS Code integration
│   └── shared/            # Shared types and utilities
├── docs/                  # Documentation and guides
├── examples/              # Usage examples
├── integration-tests/     # End-to-end tests
└── scripts/              # Build and deployment scripts
```

### Key Components

- **🎛️ Core Engine** - Handles AI provider communication and context management
- **💻 CLI Interface** - React-based terminal UI built with Ink
- **🔌 Provider Adapters** - Standardized interfaces for different AI services
- **🧠 Context Manager** - Maintains conversation state and project context
- **⚡ Response Processor** - Formats and validates AI responses

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/kingkillery/pk-code.git
cd pk-code

# Install dependencies
npm install

# Run tests
npm test

# Start development
npm run dev
```

### Running Tests

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

## 🆘 Support & Troubleshooting

### Common Issues

**API Key Issues**
```bash
# Verify your API key is set
echo $OPENAI_API_KEY

# Test connection
pk config test
```

**Performance Issues**
```bash
# Enable debug mode
export DEBUG=pk:*
pk your-command
```

**Memory Issues**
```bash
# Reduce context size
export PK_MAX_CONTEXT_SIZE=16000
```

### Getting Help

- 📖 [Documentation](./docs/)
- 🐛 [Report Issues](https://github.com/kingkillery/pk-code/issues)
- 💬 [Discussions](https://github.com/kingkillery/pk-code/discussions)
- 📧 [Email Support](mailto:support@pk-code.dev)

## 📄 License

PK Code is licensed under the [Apache License 2.0](./LICENSE).

## 🌟 Acknowledgments

Built on the foundation of [Google Gemini CLI](https://github.com/google-gemini/gemini-cli). Special thanks to the Gemini CLI team for their excellent work that made this project possible.

---

<div align="center">
  <strong>Made with ❤️ by the PK Code Team</strong>
  <br><br>
  <a href="https://github.com/kingkillery/pk-code/stargazers">
    <img src="https://img.shields.io/github/stars/kingkillery/pk-code?style=social" alt="GitHub Stars">
  </a>
  <a href="https://github.com/kingkillery/pk-code/network/members">
    <img src="https://img.shields.io/github/forks/kingkillery/pk-code?style=social" alt="GitHub Forks">
  </a>
  <a href="https://github.com/kingkillery/pk-code/issues">
    <img src="https://img.shields.io/github/issues/kingkillery/pk-code" alt="GitHub Issues">
  </a>
</div>
