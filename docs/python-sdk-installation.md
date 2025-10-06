# PK Code Python SDK Installation Guide

This guide explains how to install and use the PK Code Python SDK, which enables programmatic agent execution from Python scripts.

## 🚀 Quick Installation

### Step 1: Install PK Code CLI
```bash
npm install -g pk-code-cli
```

### Step 2: Install Python SDK
Start PK Code CLI and run:
```
/install-python-sdk
```

This command will:
- Install the Python SDK globally to `~/.pk-code/python-sdk/`
- Create setup scripts for your platform
- Provide instructions for adding to Python path

### Step 3: Setup Python Path
Follow the platform-specific instructions provided after installation:

#### Linux/macOS:
```bash
# Run the setup script
bash ~/.pk-code/python-sdk/setup.sh

# Or manually add to ~/.bashrc or ~/.zshrc:
export PYTHONPATH="$HOME/.pk-code/python-sdk:$PYTHONPATH"
```

#### Windows:
```cmd
# Run the setup script as Administrator
%USERPROFILE%\.pk-code\python-sdk\setup.bat

# Or manually add to User Environment Variables:
PYTHONPATH=%USERPROFILE%\.pk-code\python-sdk;%PYTHONPATH%
```

### Step 4: Verify Installation
```bash
python -c "from pk_code_python_sdk import PKCode; print('✅ SDK imported successfully!')"
```

## 📁 Installation Structure

After installation, you'll have the following structure in `~/.pk-code/python-sdk/`:

```
~/.pk-code/python-sdk/
├── __init__.py                    # Package initialization
├── python_wrapper.py             # Main PKCode class
├── powershell_wrapper.ps1         # PowerShell wrapper
├── batch_processing_examples.py   # Advanced examples
├── getting_started.py             # Basic examples
├── setup_and_test.py              # Setup and test script
├── test_sdk_installation.py       # Installation verification
├── setup.sh                       # Linux/macOS setup script
├── setup.bat                      # Windows setup script
└── README.md                      # Documentation
```

## 🐍 Usage Examples

### Basic Usage
```python
from pk_code_python_sdk import PKCode

# Initialize PK Code
pk = PKCode(model="gpt-4")

# Simple prompt execution
result = pk.execute("What is 2+2?")
print(result["response"])

# File analysis
result = pk.analyze_file("src/auth.py", "security")
print(result["response"])
```

### Your Use Case - Loop Processing
```python
from pk_code_python_sdk import PKCode

pk = PKCode(model="claude-3-5-sonnet")

# Your exact use case
files = ["src/auth.py", "src/database.py", "src/api.py", "src/utils.py"]
prompts = [
    "Analyze this file for security vulnerabilities",
    "Review code quality and suggest improvements",
    "Identify performance bottlenecks"
]

for file_path in files:
    for prompt in prompts:
        print(f"Processing {file_path} with: {prompt}")
        result = pk.execute(prompt, files=[file_path])
        
        if result["success"]:
            print(f"✅ Complete: {file_path}")
            # Save or process result
            with open(f"analysis_{file_path.replace('/', '_')}.md", "a") as f:
                f.write(f"## {prompt}\n\n{result['response']}\n\n")
        else:
            print(f"❌ Failed: {result['error']}")
```

### Batch Processing
```python
from pk_code_python_sdk import PKCode

pk = PKCode()

# Analyze all Python files
results = pk.batch_analyze(["**/*.py"], "security")

for result in results:
    if result["success"]:
        print(f"✅ {result['file_path']}")
    else:
        print(f"❌ {result['file_path']}: {result['error']}")
```

### Different Analysis Types
```python
pk = PKCode()

# Security analysis
result = pk.analyze_file("auth.py", "security")

# Performance analysis
result = pk.analyze_file("database.py", "performance")

# Code quality review
result = pk.analyze_file("api.py", "code_quality")

# Documentation generation
result = pk.analyze_file("utils.py", "documentation")
```

### Advanced Features
```python
pk = PKCode()

# Code refactoring
result = pk.refactor_code("legacy_code.py", "Improve readability and add error handling")

# Test generation
result = pk.generate_tests("module.py", "pytest")

# Code review
result = pk.code_review("src/auth.py", "security")
```

### Convenience Functions
```python
from pk_code_python_sdk import quick_analyze, quick_execute

# Quick analysis
result = quick_analyze("file.py", "security")

# Quick execution
result = quick_execute("What is Python?")
```

## 🔧 Configuration Options

### PKCode Class Parameters
```python
pk = PKCode(
    model="gpt-4",              # AI model to use
    timeout=300,                # Timeout in seconds
    working_dir="/path/to/project",  # Working directory
    pk_command="pk"             # Command to invoke PK Code
)
```

### Available Models
- `gpt-4` - OpenAI GPT-4
- `claude-3-5-sonnet` - Anthropic Claude 3.5 Sonnet
- `gemini-1.5-pro` - Google Gemini 1.5 Pro
- And others supported by PK Code

### Analysis Types
- `general` - Comprehensive overview
- `security` - Security vulnerabilities and issues
- `performance` - Performance bottlenecks and optimization
- `code_quality` - Code quality and maintainability
- `documentation` - Generate comprehensive documentation

## 📊 Response Format

All methods return a dictionary with this structure:

```python
{
    "success": bool,           # Whether the execution succeeded
    "response": str,           # The AI response/output
    "error": str or None,      # Error message if failed
    "return_code": int,        # Process return code
    "prompt": str,             # The original prompt
    "model": str,              # Model used
    "files": list or None,     # Files processed (if any)
    "execution_time": float    # Time taken (if measured)
}
```

## 🧪 Testing Installation

Run the test script to verify everything is working:

```bash
python ~/.pk-code/python-sdk/test_sdk_installation.py
```

Or run it directly:
```bash
python -c "from pk_code_python_sdk import PKCode; pk = PKCode(); print('✅ SDK working!')"
```

## 🔄 Updating the SDK

To update to the latest version:

1. Run the installation command again in PK Code CLI:
   ```
   /install-python-sdk
   ```

2. Or manually update the files from the latest PK Code repository

## 🐛 Troubleshooting

### Common Issues

#### Import Error: `ModuleNotFoundError`
```bash
# Solution: Add to PYTHONPATH
export PYTHONPATH="$HOME/.pk-code/python-sdk:$PYTHONPATH"

# Or run the setup script
bash ~/.pk-code/python-sdk/setup.sh
```

#### PK Code Not Found
```bash
# Solution: Install PK Code CLI
npm install -g pk-code-cli

# Verify installation
pk --version
```

#### Authentication Error
```bash
# Solution: Configure API keys
echo 'your-api-key' | pk login --with-api-key --provider=openai

# Check status
pk login --status
```

#### Timeout Errors
```python
# Solution: Increase timeout
pk = PKCode(timeout=600)  # 10 minutes
```

### Debug Mode

Enable debug output to troubleshoot issues:

```python
import logging
logging.basicConfig(level=logging.DEBUG)

pk = PKCode()
result = pk.execute("Your prompt", yolo=True)  # Skip confirmations
```

## 📚 Advanced Examples

### Security Audit Script
```python
from pk_code_python_sdk import PKCode
import glob

def security_audit(codebase_path):
    pk = PKCode(model="gpt-4")
    
    # Find high-risk files
    high_risk_patterns = [
        "**/auth*.py",
        "**/login*.py",
        "**/password*.py",
        "**/token*.py",
        "**/session*.py"
    ]
    
    security_issues = []
    
    for pattern in high_risk_patterns:
        files = glob.glob(pattern, root_dir=codebase_path, recursive=True)
        
        for file_path in files:
            result = pk.analyze_file(file_path, "security")
            
            if result["success"] and "vulnerability" in result["response"].lower():
                security_issues.append({
                    "file": file_path,
                    "issues": result["response"]
                })
    
    return security_issues

# Usage
issues = security_audit("/path/to/codebase")
print(f"Found {len(issues)} files with security issues")
```

### Automated Refactoring Pipeline
```python
from pk_code_python_sdk import PKCode
import os

def refactor_legacy_code(project_path):
    pk = PKCode(model="claude-3-5-sonnet")
    
    refactoring_goals = {
        "**/legacy_*.py": "Modernize to Python 3.8+ with type hints and error handling",
        "**/*_old.js": "Update to modern JavaScript ES6+ syntax",
        "**/deprecated_*.ts": "Refactor to current TypeScript best practices"
    }
    
    results = []
    
    for pattern, goal in refactoring_goals.items():
        files = glob.glob(pattern, root_dir=project_path, recursive=True)
        
        for file_path in files:
            result = pk.refactor_code(file_path, goal)
            result["file_path"] = file_path
            result["goal"] = goal
            results.append(result)
    
    return results

# Usage
results = refactor_legacy_code("/path/to/project")
successful = sum(1 for r in results if r["success"])
print(f"Refactored {successful}/{len(results)} files")
```

## 🤝 Contributing

Found issues or want to contribute? Please:

1. Check the [PK Code repository](https://github.com/kingkillery/pk-code)
2. Report issues or submit pull requests
3. Join the community discussions

## 📄 License

The PK Code Python SDK is provided under the same license as PK Code CLI.