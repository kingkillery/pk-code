# Notion MCP Server Configuration for pk-code

## Notion MCP Integration

pk-code now supports Notion MCP integration, including OAuth authentication. The setup process is as follows:

## Notion MCP Integration Setup

1. Set the `NOTION_API_KEY` environment variable with your Notion API key.
2. Verify the configuration by running `pk` and using the `/mcp` command to check if the Notion tools are discovered.
3. If you encounter any issues, refer to the troubleshooting section below.

## Troubleshooting

### 1. "NOTION_API_KEY not set" Error
- Ensure you've set the environment variable in your current shell session
- Environment variables are session-specific - set it each time you open a new terminal

### 2. Connection Timeout
- The Notion MCP server might be temporarily unavailable
- Try again after a few moments

### 3. Authentication Error (401)
- Verify your NOTION_API_KEY is correct
- Ensure it starts with "secret_" (typical Notion API key format)

### 4. No Tools Available
- Check that your Notion integration has proper permissions
- Verify the workspace access for your API key

## Test Script

A test script has been created at:
`C:\Users\prest\Desktop\Desktop_Projects\May-Dec-2025\Qwen-Code\pk-code\test-notion-mcp.js`

Run it to verify your configuration:
```bash
node test-notion-mcp.js
```

## Support

If you encounter issues:
1. Check the pk-code debug output with `--debug` flag
2. Review the MCP server status with `/mcp` command
3. Consult the pk-code documentation for MCP servers

## Troubleshooting

### 1. "NOTION_API_KEY not set" Error
- Ensure you've set the environment variable in your current shell session
- Environment variables are session-specific - set it each time you open a new terminal

### 2. Connection Timeout
- The Notion MCP server might be temporarily unavailable
- Try again after a few moments

### 3. Authentication Error (401)
- Verify your NOTION_API_KEY is correct
- Ensure it starts with "secret_" (typical Notion API key format)

### 4. No Tools Available
- Check that your Notion integration has proper permissions
- Verify the workspace access for your API key

## Technical Details

### How pk-code Processes MCP Configurations

1. **Settings Loading** (`loadSettings()` in `settings.ts`):
   - Loads from `~/.pk/settings.json`
   - Applies `resolveEnvVarsInObject()` to expand environment variables

2. **Transport Creation** (`createTransport()` in `mcp-client.ts`):
   - Detects `httpUrl` property → Creates `StreamableHTTPClientTransport`
   - Passes headers via `requestInit.headers`
   - Headers include the expanded Authorization token

3. **Connection Process**:
   - Client connects with 10-minute default timeout
   - Tools are discovered via MCP protocol
   - Tools are registered with pk-code's tool registry

### Code Flow
```
settings.json → loadSettings() → resolveEnvVarsInObject() → 
Config creation → discoverMcpTools() → createTransport() → 
StreamableHTTPClientTransport with headers → Notion MCP Server
```

## Security Notes

- Never commit your API key to version control
- Use environment variables for all sensitive values
- The `${NOTION_API_KEY}` syntax ensures the key isn't stored in plain text
- Consider using a `.env` file for persistent environment variables (pk-code supports this)

## What You Can Do Now

With the Notion MCP server configured, pk-code can:
- Search your Notion workspace
- Fetch page and database contents  
- Create and update pages
- Manage database entries
- Access all other Notion API capabilities exposed via MCP

## Test Script

A test script has been created at:
`C:\Users\prest\Desktop\Desktop_Projects\May-Dec-2025\Qwen-Code\pk-code\test-notion-mcp.js`

Run it to verify your configuration:
```bash
node test-notion-mcp.js
```

## Support

If you encounter issues:
1. Check the pk-code debug output with `--debug` flag
2. Review the MCP server status with `/mcp` command
3. Consult the pk-code documentation for MCP servers
