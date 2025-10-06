# PK Code Programmatic Usage Examples

This directory contains examples and wrappers for using PK Code programmatically from Python and PowerShell scripts. Perfect for batch processing, automation, and integrating PK Code into your workflows.

## 🚀 Quick Start

### Prerequisites

1. **Install PK Code CLI**: Make sure PK Code is installed and configured
   ```bash
   npm install -g pk-code-cli
   ```

2. **Verify Installation**: Check that PK Code is working
   ```bash
   pk --version
   ```

3. **Configure Authentication**: Set up your API keys
   ```bash
   # For OpenAI (GPT models)
   echo 'your-openai-api-key' | pk login --with-api-key --provider=openai
   
   # For Anthropic (Claude models)
   echo 'your-anthropic-api-key' | pk login --with-api-key --provider=anthropic
   
   # For Google (Gemini models)
   echo 'your-google-api-key' | pk login --with-api-key --provider=google
   ```

4. **Python Requirements** (for Python wrapper):
   ```bash
   # Python 3.7+ is required (subprocess and concurrent.futures are built-in)
   python --version  # Should be 3.7 or higher
   ```

### 🛠️ Automated Setup

Run the setup script to automatically install and test everything:
```bash
python setup_and_test.py
```

This script will:
- Check prerequisites (Node.js, npm, Python)
- Install PK Code CLI if needed
- Test the installation
- Guide you through authentication setup
- Test the Python wrapper

## 📁 Files Overview

- `python_wrapper.py` - Python class wrapper for PK Code CLI
- `powershell_wrapper.ps1` - PowerShell class wrapper for PK Code CLI  
- `batch_processing_examples.py` - Comprehensive batch processing examples
- `README.md` - This file

## 🐍 Python Wrapper

### Basic Usage

```python
from python_wrapper import PKCode

# Initialize PK Code
pk = PKCode(model="gpt-4", timeout=300)

# Simple prompt execution
result = pk.execute("Explain quantum computing")
print(result["response"])

# File analysis
result = pk.analyze_file("src/auth.py", "security")
print(result["response"])

# Batch analysis
results = pk.batch_analyze(["*.py", "*.js"], "code_quality")
for result in results:
    if result["success"]:
        print(f"✓ {result['file_path']}")
    else:
        print(f"✗ {result['file_path']}: {result['error']}")
```

### Advanced Examples

#### Code Refactoring
```python
pk = PKCode(model="claude-3-5-sonnet")
result = pk.refactor_code("legacy_code.py", "Improve readability and add error handling")
```

#### Test Generation
```python
result = pk.generate_tests("module.py", "pytest")
# Save the generated tests
with open("test_module.py", "w") as f:
    f.write(result["response"])
```

#### Security Analysis
```python
result = pk.analyze_file("auth.py", "security")
if "vulnerability" in result["response"].lower():
    print("⚠️ Security issues found!")
```

## 💻 PowerShell Wrapper

### Basic Usage

```powershell
# Load the wrapper
. .\powershell_wrapper.ps1

# Initialize PK Code
$pk = [PKCode]::new("gpt-4")

# Simple prompt execution
$result = $pk.Execute("Explain quantum computing")
Write-Host $result.response

# File analysis
$result = $pk.AnalyzeFile("src/auth.ps1", "security")
Write-Host $result.response

# Batch analysis
$results = $pk.BatchAnalyze(@("*.ps1", "*.py"), "code_quality")
foreach ($result in $results) {
    if ($result.success) {
        Write-Host "✓ $($result.file_path)" -ForegroundColor Green
    } else {
        Write-Host "✗ $($result.file_path): $($result.error)" -ForegroundColor Red
    }
}
```

### Interactive Mode

```powershell
# Start interactive loop
.\powershell_wrapper.ps1 interactive
```

## 🔄 Batch Processing Examples

The `batch_processing_examples.py` script provides comprehensive examples of using PK Code in loops for various tasks:

### 1. Codebase Analysis
```bash
python batch_processing_examples.py analyze /path/to/your/codebase
```
Analyzes the entire structure of a codebase and saves results to `codebase_analysis.json`.

### 2. Security Audit
```bash
python batch_processing_examples.py security /path/to/your/codebase
```
Performs security-focused analysis on high-risk files (auth, database, API files).

### 3. Automated Refactoring
```bash
python batch_processing_examples.py refactor /path/to/project
```
Applies refactoring goals to files matching specific patterns.

### 4. Test Generation
```bash
python batch_processing_examples.py tests /path/to/source /path/to/tests
```
Generates comprehensive tests for all source files.

### 5. Documentation Generation
```bash
python batch_processing_examples.py docs /path/to/project /path/to/docs
```
Generates documentation for all code files in a project.

## 🎯 Common Use Cases

### 1. Code Review Automation
```python
# Review all Python files for security issues
pk = PKCode(model="gpt-4")
results = pk.batch_analyze(["**/*.py"], "security")

# Generate report
security_issues = []
for result in results:
    if result["success"] and "vulnerability" in result["response"].lower():
        security_issues.append({
            "file": result["file_path"],
            "issues": result["response"]
        })

print(f"Found {len(security_issues)} files with security issues")
```

### 2. Legacy Code Modernization
```python
# Modernize all legacy files
legacy_patterns = ["**/legacy_*.py", "**/*_old.js", "**/deprecated_*.ts"]

for pattern in legacy_patterns:
    results = pk.batch_analyze([pattern], "code_quality")
    for result in results:
        if result["success"]:
            refactored = pk.refactor_code(result["file_path"], 
                                        "Modernize to current best practices")
            # Save refactored code...
```

### 3. Automated Testing
```python
# Generate tests for all modules without tests
source_files = glob.glob("**/*.py", recursive=True)
test_files = glob.glob("**/test_*.py", recursive=True)

# Find modules without tests
modules_without_tests = []
for source in source_files:
    module_name = os.path.splitext(os.path.basename(source))[0]
    has_test = any(module_name in test for test in test_files)
    if not has_test and not source.startswith("test_"):
        modules_without_tests.append(source)

# Generate tests
for module in modules_without_tests:
    result = pk.generate_tests(module, "pytest")
    if result["success"]:
        test_filename = f"test_{os.path.basename(module)}"
        with open(test_filename, "w") as f:
            f.write(result["response"])
```

### 4. Documentation Maintenance
```python
# Keep documentation up to date
def update_documentation(source_file, doc_file):
    # Get current documentation
    current_doc = ""
    if os.path.exists(doc_file):
        with open(doc_file, 'r') as f:
            current_doc = f.read()
    
    # Generate new documentation
    result = pk.analyze_file(source_file, "documentation")
    
    if result["success"]:
        # Compare and update if significantly different
        if len(result["response"]) > len(current_doc) * 1.5:  # 50% longer
            with open(doc_file, 'w') as f:
                f.write(f"# Documentation for {source_file}\n\n")
                f.write(result["response"])
            print(f"Updated documentation for {source_file}")
```

## 🔧 Configuration Options

### PK Code Class Parameters

- `model`: AI model to use (gpt-4, claude-3-5-sonnet, gemini-1.5-pro, etc.)
- `timeout`: Timeout in seconds for each execution (default: 300)
- `working_dir`: Working directory for PK Code execution (default: current directory)

### Analysis Types

- `general`: Comprehensive overview of purpose and structure
- `security`: Security vulnerabilities and issues
- `performance`: Performance bottlenecks and optimization
- `code_quality`: Code quality and maintainability issues
- `documentation`: Generate comprehensive documentation

## 📊 Output Formats

All methods return a dictionary with the following structure:

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

## 🚨 Error Handling

```python
pk = PKCode()

result = pk.execute("Your prompt here")
if not result["success"]:
    print(f"Error: {result['error']}")
    print(f"Return code: {result['return_code']}")
    
    # Retry logic
    if "timeout" in result["error"].lower():
        pk.timeout = 600  # Increase timeout
        result = pk.execute("Your prompt here")
```

## 🔄 Loop Patterns

### For Loop Pattern
```python
files = ["file1.py", "file2.py", "file3.py"]
pk = PKCode()

for file_path in files:
    print(f"Processing {file_path}...")
    result = pk.analyze_file(file_path, "code_quality")
    
    if result["success"]:
        # Process successful result
        print(f"✓ {file_path}")
    else:
        # Handle failure
        print(f"✗ {file_path}: {result['error']}")
    
    # Rate limiting
    time.sleep(1)
```

### While Loop Pattern
```python
pk = PKCode()
batch_size = 10
offset = 0

while True:
    # Get next batch of files
    files = get_files_batch(offset, batch_size)
    if not files:
        break
    
    # Process batch
    results = pk.batch_analyze(files, "general")
    
    # Process results...
    offset += batch_size
```

### Concurrent Processing
```python
import concurrent.futures

def process_file(file_path):
    pk = PKCode()
    return pk.analyze_file(file_path, "security")

files = ["file1.py", "file2.py", "file3.py"]

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
    futures = [executor.submit(process_file, file) for file in files]
    
    for future in concurrent.futures.as_completed(futures):
        result = future.result()
        print(f"Processed: {result['file_path']}")
```

## 📝 Tips and Best Practices

1. **Rate Limiting**: Add delays between API calls to avoid rate limits
2. **Error Handling**: Always check the `success` field and handle errors gracefully
3. **Batch Processing**: Use batch analysis for multiple files to reduce overhead
4. **Model Selection**: Choose appropriate models based on task complexity
5. **Timeout Management**: Set appropriate timeouts for long-running tasks
6. **Result Caching**: Cache results to avoid reprocessing unchanged files
7. **Progress Tracking**: Print progress for long-running batch operations

## 🐛 Troubleshooting

### Common Issues

1. **PK Code not found**: Ensure PK Code is installed and in your PATH
2. **Authentication errors**: Make sure API keys are configured with `pk login`
3. **Timeout errors**: Increase the timeout value or reduce batch sizes
4. **Memory issues**: Process files in smaller batches
5. **Rate limiting**: Add longer delays between API calls

### Debug Mode

```python
# Enable debug output
pk = PKCode(model="gpt-4")
result = pk.execute("Your prompt", yolo=True)  # Skip confirmations

# Print full result for debugging
import json
print(json.dumps(result, indent=2))
```

## 🤝 Contributing

Feel free to submit issues, feature requests, or pull requests to improve these wrappers!

## 📄 License

These examples are provided under the same license as PK Code.