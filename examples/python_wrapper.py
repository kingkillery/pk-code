#!/usr/bin/env python3
"""
Python wrapper for PK Code CLI - enables programmatic agent execution

This wrapper allows you to use PK Code from Python scripts, perfect for:
- Batch processing multiple files
- Running analysis in loops
- Integrating PK Code into Python workflows
- Building automated pipelines

Requirements:
- PK Code CLI installed and configured
- Python 3.7+

Installation:
1. Install PK Code CLI:
   npm install -g pk-code-cli

2. Configure authentication:
   pk login --with-api-key --provider=openai
   # or
   pk login --with-api-key --provider=anthropic

3. Verify installation:
   pk --version
"""

import subprocess
import json
import os
import sys
from typing import List, Dict, Optional, Union
from pathlib import Path
import time
import tempfile


class PKCode:
    """Python wrapper for PK Code CLI"""
    
    def __init__(self, model: str = "gpt-4", timeout: int = 300, working_dir: Optional[str] = None, pk_command: str = "pk"):
        """
        Initialize PK Code wrapper
        
        Args:
            model: AI model to use (gpt-4, claude-3-5-sonnet, gemini-1.5-pro, etc.)
            timeout: Timeout in seconds for each execution
            working_dir: Working directory for PK Code execution
            pk_command: Command to invoke PK Code (default: "pk")
        """
        self.model = model
        self.timeout = timeout
        self.working_dir = working_dir or os.getcwd()
        self.pk_command = pk_command
        
        # Verify PK Code is available
        self._verify_installation()
    
    def _verify_installation(self):
        """Verify that PK Code CLI is installed and accessible"""
        try:
            result = subprocess.run(
                [self.pk_command, "--version"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode != 0:
                raise RuntimeError(f"PK Code CLI not working properly: {result.stderr}")
        except (subprocess.TimeoutExpired, FileNotFoundError) as e:
            raise RuntimeError(
                f"PK Code CLI not found. Please install it with: npm install -g pk-code-cli\n"
                f"Error: {e}"
            )
        
    def execute(self, prompt: str, files: Optional[List[str]] = None, 
                context: Optional[str] = None, yolo: bool = False) -> Dict:
        """
        Execute PK Code with a prompt
        
        Args:
            prompt: The prompt to send to PK Code
            files: List of files to include as context
            context: Additional context to include
            yolo: Skip confirmations for automated execution
            
        Returns:
            Dictionary with response, metadata, and execution info
        """
        # Build command
        cmd = [self.pk_command, "--model", self.model, "--prompt", prompt]
        
        if yolo:
            cmd.append("--yolo")
            
        # Add file context if provided
        if files:
            for file_path in files:
                if os.path.exists(file_path):
                    cmd.extend(["--file", file_path])
                else:
                    print(f"Warning: File {file_path} not found")
        
        # Add context if provided
        if context:
            cmd.extend(["--context", context])
            
        try:
            # Execute PK Code
            result = subprocess.run(
                cmd,
                cwd=self.working_dir,
                capture_output=True,
                text=True,
                timeout=self.timeout
            )
            
            return {
                "success": result.returncode == 0,
                "response": result.stdout,
                "error": result.stderr if result.stderr else None,
                "return_code": result.returncode,
                "prompt": prompt,
                "model": self.model,
                "files": files,
                "execution_time": None  # Could add timing if needed
            }
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "response": None,
                "error": f"Execution timed out after {self.timeout} seconds",
                "return_code": -1,
                "prompt": prompt,
                "model": self.model,
                "files": files,
                "execution_time": self.timeout
            }
        except Exception as e:
            return {
                "success": False,
                "response": None,
                "error": str(e),
                "return_code": -1,
                "prompt": prompt,
                "model": self.model,
                "files": files,
                "execution_time": None
            }
    
    def analyze_file(self, file_path: str, analysis_type: str = "general") -> Dict:
        """
        Analyze a single file
        
        Args:
            file_path: Path to the file to analyze
            analysis_type: Type of analysis (general, security, performance, etc.)
            
        Returns:
            Analysis result
        """
        prompts = {
            "general": f"Analyze this file and provide a comprehensive overview of its purpose, structure, and key functionality.",
            "security": f"Perform a security analysis of this file, identifying potential vulnerabilities, security issues, and recommendations.",
            "performance": f"Analyze this file for performance issues, bottlenecks, and optimization opportunities.",
            "code_quality": f"Review this code for quality issues, maintainability, and suggest improvements following best practices.",
            "documentation": f"Generate comprehensive documentation for this file, including function descriptions and usage examples."
        }
        
        prompt = prompts.get(analysis_type, prompts["general"])
        return self.execute(prompt, files=[file_path])
    
    def batch_analyze(self, file_patterns: List[str], analysis_type: str = "general", 
                     max_concurrent: int = 3) -> List[Dict]:
        """
        Analyze multiple files matching patterns
        
        Args:
            file_patterns: List of file patterns (glob patterns)
            analysis_type: Type of analysis to perform
            max_concurrent: Maximum concurrent executions
            
        Returns:
            List of analysis results
        """
        import glob
        import concurrent.futures
        
        # Collect all files matching patterns
        all_files = []
        for pattern in file_patterns:
            matched_files = glob.glob(pattern, recursive=True)
            all_files.extend(matched_files)
        
        # Remove duplicates
        all_files = list(set(all_files))
        
        print(f"Found {len(all_files)} files to analyze")
        
        results = []
        
        # Process files with limited concurrency
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_concurrent) as executor:
            # Submit all tasks
            future_to_file = {
                executor.submit(self.analyze_file, file_path, analysis_type): file_path 
                for file_path in all_files
            }
            
            # Collect results as they complete
            for future in concurrent.futures.as_completed(future_to_file):
                file_path = future_to_file[future]
                try:
                    result = future.result()
                    result["file_path"] = file_path
                    results.append(result)
                    print(f"✓ Analyzed: {file_path}")
                except Exception as e:
                    results.append({
                        "success": False,
                        "file_path": file_path,
                        "error": str(e),
                        "response": None
                    })
                    print(f"✗ Failed to analyze: {file_path} - {e}")
        
        return results
    
    def refactor_code(self, file_path: str, refactoring_goal: str) -> Dict:
        """
        Refactor a file based on a specific goal
        
        Args:
            file_path: Path to the file to refactor
            refactoring_goal: Description of refactoring goal
            
        Returns:
            Refactoring result
        """
        prompt = f"""
        Refactor this code with the following goal: {refactoring_goal}
        
        Please:
        1. Analyze the current code structure
        2. Identify areas for improvement based on the goal
        3. Provide the refactored code
        4. Explain the changes made and why they improve the code
        5. Ensure the refactored code maintains the same functionality
        """
        
        return self.execute(prompt, files=[file_path], yolo=True)
    
    def generate_tests(self, file_path: str, test_framework: str = "pytest") -> Dict:
        """
        Generate tests for a file
        
        Args:
            file_path: Path to the file to generate tests for
            test_framework: Test framework to use (pytest, jest, vitest, etc.)
            
        Returns:
            Test generation result
        """
        prompt = f"""
        Generate comprehensive tests for this code using {test_framework}.
        
        Please:
        1. Analyze the code structure and functionality
        2. Identify key functions, methods, and edge cases
        3. Generate unit tests that cover:
           - Happy path scenarios
           - Edge cases and error conditions
           - Boundary conditions
        4. Include proper setup and teardown if needed
        5. Add descriptive test names and comments
        6. Follow {test_framework} best practices
        """
        
        return self.execute(prompt, files=[file_path], yolo=True)
    
    def code_review(self, file_path: str, review_focus: str = "general") -> Dict:
        """
        Perform code review on a file
        
        Args:
            file_path: Path to the file to review
            review_focus: Focus area for review (security, performance, maintainability, etc.)
            
        Returns:
            Code review result
        """
        focus_areas = {
            "security": "security vulnerabilities, authentication, authorization, input validation",
            "performance": "performance bottlenecks, efficiency, resource usage, scalability",
            "maintainability": "code readability, structure, documentation, technical debt",
            "best_practices": "adherence to coding standards, design patterns, conventions",
            "testing": "test coverage, test quality, testability"
        }
        
        focus = focus_areas.get(review_focus, "overall code quality and best practices")
        
        prompt = f"""
        Perform a thorough code review focusing on: {focus}
        
        Please provide:
        1. Overall assessment of code quality
        2. Specific issues found with line numbers
        3. Security concerns (if applicable)
        4. Performance considerations
        5. Suggestions for improvement
        6. Best practices recommendations
        7. Priority level for each issue (Critical, High, Medium, Low)
        """
        
        return self.execute(prompt, files=[file_path])


def example_usage():
    """Example usage of PK Code wrapper"""
    
    # Initialize PK Code
    pk = PKCode(model="gpt-4", working_dir=".")
    
    print("=== PK Code Python Wrapper Examples ===\n")
    
    # Example 1: Simple prompt execution
    print("1. Simple prompt execution:")
    result = pk.execute("Explain the concept of recursion in programming")
    print(f"Success: {result['success']}")
    print(f"Response: {result['response'][:200]}...\n")
    
    # Example 2: File analysis
    print("2. File analysis:")
    if os.path.exists("example.py"):
        result = pk.analyze_file("example.py", "code_quality")
        print(f"Analysis result: {result['success']}")
        print(f"Response: {result['response'][:300]}...\n")
    
    # Example 3: Batch analysis
    print("3. Batch analysis:")
    results = pk.batch_analyze(["*.py", "*.js"], "general", max_concurrent=2)
    print(f"Analyzed {len(results)} files")
    successful = sum(1 for r in results if r['success'])
    print(f"Successful: {successful}, Failed: {len(results) - successful}\n")
    
    # Example 4: Code refactoring
    print("4. Code refactoring:")
    if os.path.exists("legacy_code.py"):
        result = pk.refactor_code("legacy_code.py", "Improve readability and add error handling")
        print(f"Refactoring success: {result['success']}")
        print(f"Response: {result['response'][:300]}...\n")
    
    # Example 5: Test generation
    print("5. Test generation:")
    if os.path.exists("module.py"):
        result = pk.generate_tests("module.py", "pytest")
        print(f"Test generation success: {result['success']}")
        print(f"Response: {result['response'][:300]}...\n")


def batch_processing_example():
    """Example of batch processing multiple files"""
    
    pk = PKCode(model="claude-3-5-sonnet")
    
    # Define files to process
    files_to_process = [
        "src/auth.py",
        "src/database.py", 
        "src/api.py",
        "src/utils.py"
    ]
    
    # Process each file with different analysis types
    analysis_tasks = [
        ("src/auth.py", "security"),
        ("src/database.py", "performance"),
        ("src/api.py", "code_quality"),
        ("src/utils.py", "documentation")
    ]
    
    results = []
    
    print("Starting batch processing...")
    
    for file_path, analysis_type in analysis_tasks:
        if os.path.exists(file_path):
            print(f"Processing {file_path} with {analysis_type} analysis...")
            result = pk.analyze_file(file_path, analysis_type)
            result["file_path"] = file_path
            result["analysis_type"] = analysis_type
            results.append(result)
            
            if result["success"]:
                print(f"✓ Completed {file_path}")
            else:
                print(f"✗ Failed {file_path}: {result['error']}")
        else:
            print(f"⚠ File not found: {file_path}")
    
    # Generate summary report
    print("\n=== Batch Processing Summary ===")
    successful = sum(1 for r in results if r["success"])
    print(f"Total files processed: {len(results)}")
    print(f"Successful: {successful}")
    print(f"Failed: {len(results) - successful}")
    
    # Save results to file
    with open("batch_analysis_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print("Results saved to batch_analysis_results.json")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "example":
        example_usage()
    elif len(sys.argv) > 1 and sys.argv[1] == "batch":
        batch_processing_example()
    else:
        print("PK Code Python Wrapper")
        print("Usage:")
        print("  python python_wrapper.py example    # Run example usage")
        print("  python python_wrapper.py batch      # Run batch processing example")
        print("\nOr import the PKCode class in your own scripts:")
        print("  from python_wrapper import PKCode")
        print("  pk = PKCode()")
        print("  result = pk.execute('Your prompt here')")