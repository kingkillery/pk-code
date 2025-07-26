# Qwen Code

![Qwen Code Screenshot](./docs/assets/qwen-screenshot.png)

Qwen Code is a command-line AI workflow tool adapted from [**Gemini CLI**](https://github.com/google-gemini/gemini-cli) (Please refer to [this document](./README.gemini.md) for more details), optimized for [Qwen3-Coder](https://github.com/QwenLM/Qwen3-Coder) models with enhanced parser support & tool support.

> [!WARNING]
> Qwen Code may issue multiple API calls per cycle, resulting in higher token usage, similar to Claude Code. We’re actively working to enhance API efficiency and improve the overall developer experience. ModelScope offers 2,000 free API calls if you are in China mainland. Please check [API config section](#api-configuration) for more details.

## Key Features

- **Code Understanding & Editing** - Query and edit large codebases beyond traditional context window limits
- **Workflow Automation** - Automate operational tasks like handling pull requests and complex rebases
- **Enhanced Parser** - Adapted parser specifically optimized for Qwen-Coder models

## Quick Start

### Prerequisites

Ensure you have [Node.js version 20](https://nodejs.org/en/download) or higher installed.

```bash
curl -qL https://www.npmjs.com/install.sh | sh
```

### Installation

```bash
npm install -g @qwen-code/qwen-code
qwen --version
```

Then run from anywhere:

```bash
qwen
```

Or you can install it from source:

```bash
git clone https://github.com/QwenLM/qwen-code.git
cd qwen-code
npm install
npm install -g .
```

### API Configuration

Set your Qwen API key (In Qwen Code project, you can also set your API key in `.env` file). the `.env` file should be placed in the root directory of your current project.

> ⚠️ **Notice:** <br>
> **If you are in mainland China, please go to https://bailian.console.aliyun.com/ or https://modelscope.cn/docs/model-service/API-Inference/intro to apply for your API key** <br>
> **If you are not in mainland China, please go to https://modelstudio.console.alibabacloud.com/ to apply for your API key**

If you are in mainland China, you can use Qwen3-Coder through the Alibaba Cloud bailian platform.

```bash
export OPENAI_API_KEY="your_api_key_here"
export OPENAI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
export OPENAI_MODEL="qwen3-coder-plus"
```

If you are in mainland China, ModelScope offers 2,000 free model inference API calls per day:

```bash
export OPENAI_API_KEY="your_api_key_here"
export OPENAI_BASE_URL="https://api-inference.modelscope.cn/v1"
export OPENAI_MODEL="Qwen/Qwen3-Coder-480B-A35B-Instruct"
```

If you are not in mainland China, you can use Qwen3-Coder through the Alibaba Cloud modelstuido platform.

```bash
export OPENAI_API_KEY="your_api_key_here"
export OPENAI_BASE_URL="https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
export OPENAI_MODEL="qwen3-coder-plus"
```

## Supported Providers

Qwen Code supports a variety of AI providers, allowing you to choose the one that best suits your needs. The following providers are currently supported:

- OpenAI
- Google Gemini
- OpenRouter
- Anthropic
- Cohere

## Usage Examples

### Interactive Mode

```sh
cd your-project/
qwen
> Describe the main pieces of this system's architecture
```

### Non-Interactive Mode

```sh
# Generate code from a prompt
qwen-code generate "create a react component that displays a button"

# Configure a new provider
qwen-code config add openai YOUR_API_KEY

# List configured providers
qwen-code config list
```

## GitHub Action

You can use Qwen Code as a GitHub Action in your CI/CD workflows to automate tasks like code generation, review, or analysis.

### Example Workflow

Create a file named `.github/workflows/qwen-code.yml` in your repository with the following content:

```yaml
name: Qwen Code CI

on: [push]

jobs:
  qwen_code_job:
    runs-on: ubuntu-latest
    name: Run Qwen Code
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Run Qwen Code Action
        id: qwen_code
        uses: ./ .github/actions/qwen-code
        with:
          prompt: 'Explain the purpose of the main function in this project.'
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}

      - name: Echo the response
        run: echo "${{ steps.qwen_code.outputs.response }}"
```

### Inputs

-   `prompt` (required): The prompt to send to Qwen Code.
-   `model` (optional): The model to use. Defaults to the Qwen Code default.
-   `openai-api-key` (optional): Your OpenAI API key. It's recommended to store this as a secret in your repository settings.
-   `working-directory` (optional): The directory to run the command in. Defaults to the repository root.

### Outputs

-   `response`: The response text from the Qwen Code AI.

## Popular Tasks

### Understand New Codebases

```text
> What are the core business logic components?
> What security mechanisms are in place?
> How does the data flow work?
```

### Code Refactoring & Optimization

```text
> What parts of this module can be optimized?
> Help me refactor this class to follow better design patterns
> Add proper error handling and logging
```

### Documentation & Testing

```text
> Generate comprehensive JSDoc comments for this function
> Write unit tests for this component
> Create API documentation
```

## Benchmark Results

### Terminal-Bench

| Agent     | Model              | Accuracy |
| --------- | ------------------ | -------- |
| Qwen Code | Qwen3-Coder-480A35 | 37.5     |

## Project Structure

```
qwen-code/
├── packages/           # Core packages
├── docs/              # Documentation
├── examples/          # Example code
└── tests/            # Test files
```

## Development & Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) to learn how to contribute to the project.

## Troubleshooting

If you encounter issues, check the [troubleshooting guide](docs/troubleshooting.md).

## Acknowledgments

This project is based on [Google Gemini CLI](https://github.com/google-gemini/gemini-cli). We acknowledge and appreciate the excellent work of the Gemini CLI team. Our main contribution focuses on parser-level adaptations to better support Qwen-Coder models.

## License

[LICENSE](./LICENSE)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=QwenLM/qwen-code&type=Date)](https://www.star-history.com/#QwenLM/qwen-code&Date)
