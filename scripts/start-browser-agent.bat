@echo off
setlocal enabledelayedexpansion

REM This script starts the browser-use agent with a persistent profile.
REM It dynamically reads the Chrome user data directory from .mcp.json

REM Configuration file path (can be overridden via environment variable)
if "%MCP_CONFIG_FILE%"=="" set MCP_CONFIG_FILE=.mcp.json

REM Check if .mcp.json exists
if not exist "%MCP_CONFIG_FILE%" (
    echo Error: .mcp.json not found in current directory
    echo Please run 'pk config browser' to set up browser configuration
    exit /b 1
)

REM Extract browser user data directory from .mcp.json
REM First, try to use PowerShell for JSON parsing (most reliable on Windows)
powershell -Command "try { $json = Get-Content '%MCP_CONFIG_FILE%' | ConvertFrom-Json; $json.mcpServers.'browser-use'.env.BROWSER_USE_USER_DATA_DIR } catch { $null }" > temp_browser_path.txt 2>nul

REM Read the result
set /p BROWSER_USER_DATA_DIR=<temp_browser_path.txt
del temp_browser_path.txt >nul 2>&1

REM If PowerShell method failed or returned null/empty, try fallback method
if "!BROWSER_USER_DATA_DIR!"=="" (
    echo Warning: PowerShell JSON parsing failed, using fallback parsing method
    
    REM Fallback: use findstr (less reliable but works without PowerShell)
    findstr /C:"browser-use" "%MCP_CONFIG_FILE%" >nul
    if !errorlevel! equ 0 (
        for /f "tokens=2 delims=:" %%a in ('findstr /C:"BROWSER_USE_USER_DATA_DIR" "%MCP_CONFIG_FILE%"') do (
            set temp_line=%%a
            REM Remove quotes and spaces
            set temp_line=!temp_line:"=!
            set temp_line=!temp_line: =!
            set temp_line=!temp_line:,=!
            set BROWSER_USER_DATA_DIR=!temp_line!
        )
    )
)

REM Remove any trailing whitespace or control characters
for /f "tokens=* delims= " %%a in ("!BROWSER_USER_DATA_DIR!") do set BROWSER_USER_DATA_DIR=%%a

REM Check if the configuration was found
if "!BROWSER_USER_DATA_DIR!"=="" (
    echo Error: Browser configuration not found in .mcp.json
    echo Please run 'pk config browser' to set up browser configuration
    echo.
    echo For better JSON parsing on Windows, ensure PowerShell is available
    echo or consider using Windows Subsystem for Linux ^(WSL^) with jq
    exit /b 1
)

if "!BROWSER_USER_DATA_DIR!"=="null" (
    echo Error: Browser configuration not found in .mcp.json
    echo Please run 'pk config browser' to set up browser configuration
    exit /b 1
)

REM Export the environment variable
set BROWSER_USE_USER_DATA_DIR=!BROWSER_USER_DATA_DIR!

echo Starting browser-use MCP server with persistent profile...
echo Configuration loaded from: %MCP_CONFIG_FILE%
echo Browser data will be loaded from: !BROWSER_USE_USER_DATA_DIR!

REM Verify the directory exists (optional warning)
if not exist "!BROWSER_USE_USER_DATA_DIR!" (
    echo Warning: Browser data directory does not exist: !BROWSER_USE_USER_DATA_DIR!
    echo The browser-use agent may not work correctly
)

REM Start the browser-use agent
uvx browser-use --mcp