The configuration for the browser-use MCP server is found in the .mcp.json file at the project root:

```
{
  "mcpServers": {
    "browser-use": {
      "command": "cmd",
      "args": ["/c", "uvx", "--from", "browser-use[cli]", 
      "browser-use", "--mcp"],
      "env": {
        "BROWSER_USE_USER_DATA_DIR": 
        "C:\\Users\\prest\\AppData\\Local\\Google\\Chrome\\
        User Data"
      },
      "description": "Browser automation tools. Requires 
      'browser-use[cli]' to be installed. The 
      BROWSER_USE_USER_DATA_DIR path is configured."
    }
  }
}
```
- This configuration specifies how the browser-use MCP server is launched, including the persistent Chrome user data directory for session continuity.
- Additional integration details, setup instructions, and phased rollout plans are documented in pk-code-browser-use-mcp-setup.md and PK.md .
- The CLI provides commands like pk config browser , pk agent start browser , and pk agent stop browser to manage and configure the browser-use integration.
- The MCP client logic in the codebase (see packages/core/src/tools/mcp-client.ts and config.ts ) loads this configuration to establish connections to the browser-use server.
For further details on advanced configuration and troubleshooting, refer to docs/tools/mcp-server.md .