# Testing Browser Use API Integration in PK Code

## Setup

1. Set your Browser Use API key as an environment variable:
   ```powershell
   $env:BROWSER_USE_API_KEY = "your-api-key-here"
   ```

2. Run PK Code:
   ```powershell
   pk
   ```

## Test Commands

Once PK Code is running, you can test the Browser Use integration with these commands:

### 1. Create a simple browser automation task:
```
Use the browser_use tool to create a task that goes to google.com and searches for "OpenAI"
```

### 2. Create a task and wait for completion:
```
Use the browser_use tool with action "create_task", task "Go to google.com and search for artificial intelligence news", and waitForCompletion true
```

### 3. Get status of a task (replace task-id with actual ID):
```
Use the browser_use tool with action "get_status" and taskId "task-id"
```

### 4. Get detailed information about a task:
```
Use the browser_use tool with action "get_details" and taskId "task-id"
```

### 5. Create a task with structured output:
```
Use the browser_use tool to create a task that gets the top 3 news headlines from CNN.com with a structured output schema for an array of headlines
```

## Example with Structured Output

To get structured data, you can provide a JSON schema:

```
Use the browser_use tool with action "create_task", task "Go to hackernews and get the top 5 story titles", structuredOutputSchema "{\"type\": \"object\", \"properties\": {\"stories\": {\"type\": \"array\", \"items\": {\"type\": \"string\"}}}}", and waitForCompletion true
```

## Control Commands

You can also pause, resume, or stop tasks:

```
Use the browser_use tool with action "pause" and taskId "task-id"
Use the browser_use tool with action "resume" and taskId "task-id"
Use the browser_use tool with action "stop" and taskId "task-id"
```

## Direct API Access

The Browser Use tool is now fully integrated into PK Code and can be accessed directly by the AI agent. Just describe what you want to automate in the browser, and the agent will use the appropriate Browser Use API calls.

Example natural language requests:
- "Go to GitHub and find the most starred Python repositories"
- "Search for the latest AI news on Google and summarize the top results"
- "Navigate to a shopping site and find the best deals on laptops"

## Troubleshooting

If you see an error about the API key not being configured:
1. Make sure you've set the BROWSER_USE_API_KEY environment variable
2. Restart PK Code after setting the environment variable

If tasks fail:
1. Check that your API key is valid
2. Ensure you have sufficient credits in your Browser Use account
3. Check the error messages returned by the tool for specific issues
