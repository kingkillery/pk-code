#!/bin/bash
# This script starts the browser-use agent with a persistent profile.
# It dynamically reads the Chrome user data directory from .mcp.json

# Configuration file path (can be overridden via environment variable)
MCP_CONFIG_FILE="${MCP_CONFIG_FILE:-.mcp.json}"

# Check if .mcp.json exists
if [ ! -f "$MCP_CONFIG_FILE" ]; then
    echo "Error: .mcp.json not found in current directory"
    echo "Please run 'pk config browser' to set up browser configuration"
    exit 1
fi

# Function to extract browser user data directory using different methods
extract_browser_path() {
    # Try jq first (most reliable)
    if command -v jq &> /dev/null; then
        jq -r '.mcpServers["browser-use"].env.BROWSER_USE_USER_DATA_DIR // empty' "$MCP_CONFIG_FILE" 2>/dev/null
        return $?
    fi
    
    # Fallback: use grep and sed (less reliable but works without jq)
    echo "Warning: jq not found, using fallback parsing method" >&2
    grep -A 10 '"browser-use"' "$MCP_CONFIG_FILE" | \
    grep '"BROWSER_USE_USER_DATA_DIR"' | \
    sed 's/.*"BROWSER_USE_USER_DATA_DIR"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' | \
    head -n 1
}

# Extract browser user data directory from .mcp.json
BROWSER_USER_DATA_DIR=$(extract_browser_path)

# Check if the configuration was found
if [ -z "$BROWSER_USER_DATA_DIR" ] || [ "$BROWSER_USER_DATA_DIR" = "null" ]; then
    echo "Error: Browser configuration not found in .mcp.json"
    echo "Please run 'pk config browser' to set up browser configuration"
    if ! command -v jq &> /dev/null; then
        echo ""
        echo "For better JSON parsing, consider installing jq:"
        echo "  - Ubuntu/Debian: sudo apt-get install jq"
        echo "  - macOS: brew install jq"
        echo "  - Windows: choco install jq or download from https://stedolan.github.io/jq/"
    fi
    exit 1
fi

# Export the environment variable
export BROWSER_USE_USER_DATA_DIR="$BROWSER_USER_DATA_DIR"

echo "Starting browser-use MCP server with persistent profile..."
echo "Configuration loaded from: $MCP_CONFIG_FILE"
echo "Browser data will be loaded from: $BROWSER_USE_USER_DATA_DIR"

# Verify the directory exists (optional warning)
if [ ! -d "$BROWSER_USE_USER_DATA_DIR" ]; then
    echo "Warning: Browser data directory does not exist: $BROWSER_USE_USER_DATA_DIR"
    echo "The browser-use agent may not work correctly"
fi

uvx browser-use --mcp
