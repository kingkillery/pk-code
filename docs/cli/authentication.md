# Authentication

Qwen Code supports a variety of AI providers. To use a provider, you must first add your API key using the `qwen-code config` command.

## Supported Providers

- OpenAI
- Google Gemini
- OpenRouter
- Anthropic
- Cohere

## Configuring Credentials

You can manage your provider credentials using the `qwen-code config` command.

### Add a Credential

To add a new credential, use the `add` subcommand, followed by the provider name and your API key.

```bash
qwen-code config add openai YOUR_API_KEY
```

### Remove a Credential

To remove a credential, use the `remove` subcommand, followed by the provider name.

```bash
qwen-code config remove openai
```

### List Configured Providers

To see a list of all the providers you have configured, use the `list` subcommand.

```bash
qwen-code config list
```

## Interactive Onboarding

If you are setting up Qwen Code for the first time, you can use the `init` command to be guided through the process of selecting a provider and adding your API key.

```bash
qwen-code init
```
