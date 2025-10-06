#!/usr/bin/env python3
"""
Batch Processing Examples with PK Code

This script demonstrates various patterns for using PK Code in loops
to process multiple files, codebases, or perform repetitive tasks.
"""

import os
import sys
import json
import time
from pathlib import Path
from typing import List, Dict, Any
from python_wrapper import PKCode


def analyze_codebase_structure(codebase_path: str, output_file: str = "codebase_analysis.json"):
    """
    Analyze the entire structure of a codebase
    
    Args:
        codebase_path: Path to the codebase to analyze
        output_file: File to save analysis results
    """
    print(f"Analyzing codebase structure at: {codebase_path}")
    
    pk = PKCode(model="claude-3-5-sonnet", working_dir=codebase_path)
    
    # Get directory structure
    code_files = []
    for root, dirs, files in os.walk(codebase_path):
        # Skip common non-code directories
        dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', '__pycache__', '.venv', 'dist', 'build']]
        
        for file in files:
            if file.endswith(('.py', '.js', '.ts', '.tsx', '.java', '.go', '.rs', '.cpp', '.c', '.h')):
                rel_path = os.path.relpath(os.path.join(root, file), codebase_path)
                code_files.append(rel_path)
    
    print(f"Found {len(code_files)} code files")
    
    # Analyze each file
    results = []
    for i, file_path in enumerate(code_files, 1):
        print(f"[{i}/{len(code_files)}] Analyzing: {file_path}")
        
        result = pk.analyze_file(file_path, "general")
        result["file_path"] = file_path
        result["file_size"] = os.path.getsize(os.path.join(codebase_path, file_path))
        results.append(result)
        
        # Small delay to avoid overwhelming the API
        time.sleep(0.5)
    
    # Generate summary
    successful = sum(1 for r in results if r["success"])
    summary = {
        "total_files": len(code_files),
        "successful_analyses": successful,
        "failed_analyses": len(code_files) - successful,
        "analysis_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "codebase_path": codebase_path,
        "results": results
    }
    
    # Save results
    with open(output_file, "w") as f:
        json.dump(summary, f, indent=2)
    
    print(f"Analysis complete! Results saved to {output_file}")
    print(f"Success rate: {successful}/{len(code_files)} ({successful/len(code_files)*100:.1f}%)")
    
    return summary


def security_audit_loop(codebase_path: str, high_risk_patterns: List[str] = None):
    """
    Perform security audit on codebase with focus on high-risk patterns
    
    Args:
        codebase_path: Path to codebase
        high_risk_patterns: List of file patterns to prioritize for security analysis
    """
    if high_risk_patterns is None:
        high_risk_patterns = [
            "**/auth*.py",
            "**/login*.py", 
            "**/password*.py",
            "**/token*.py",
            "**/session*.py",
            "**/api*.py",
            "**/database*.py",
            "**/config*.py"
        ]
    
    print("Starting security audit loop...")
    
    pk = PKCode(model="gpt-4", working_dir=codebase_path)
    
    security_results = []
    
    for pattern in high_risk_patterns:
        print(f"\nAuditing pattern: {pattern}")
        
        # Get files matching pattern
        import glob
        matching_files = glob.glob(pattern, root_dir=codebase_path, recursive=True)
        
        if not matching_files:
            print(f"No files found for pattern: {pattern}")
            continue
        
        for file_path in matching_files:
            full_path = os.path.join(codebase_path, file_path)
            if os.path.isfile(full_path):
                print(f"  Security analyzing: {file_path}")
                
                result = pk.analyze_file(file_path, "security")
                result["file_path"] = file_path
                result["audit_pattern"] = pattern
                security_results.append(result)
                
                if result["success"]:
                    # Check for security keywords in response
                    response_lower = result["response"].lower()
                    security_issues = []
                    
                    if any(keyword in response_lower for keyword in ["vulnerability", "security", "risk", "unsafe", "injection"]):
                        security_issues.append("potential_security_issues")
                    
                    if any(keyword in response_lower for keyword in ["password", "credential", "secret", "key"]):
                        security_issues.append("sensitive_data_handling")
                    
                    result["security_flags"] = security_issues
                    
                    if security_issues:
                        print(f"    ⚠️  Security flags: {', '.join(security_issues)}")
                    else:
                        print(f"    ✅ No obvious security issues")
                else:
                    print(f"    ❌ Analysis failed: {result['error']}")
                
                time.sleep(1)  # Rate limiting
    
    # Generate security report
    security_report = {
        "audit_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "codebase_path": codebase_path,
        "total_files_analyzed": len(security_results),
        "files_with_issues": len([r for r in security_results if r.get("security_flags")]),
        "results": security_results
    }
    
    with open("security_audit_report.json", "w") as f:
        json.dump(security_report, f, indent=2)
    
    print(f"\nSecurity audit complete! Report saved to security_audit_report.json")
    
    return security_report


def refactoring_loop(project_path: str, refactoring_goals: Dict[str, str]):
    """
    Loop through files and apply refactoring based on specific goals
    
    Args:
        project_path: Path to the project
        refactoring_goals: Dictionary mapping file patterns to refactoring goals
    """
    print("Starting refactoring loop...")
    
    pk = PKCode(model="claude-3-5-sonnet", working_dir=project_path)
    
    refactoring_results = []
    
    for pattern, goal in refactoring_goals.items():
        print(f"\nRefactoring pattern: {pattern}")
        print(f"Goal: {goal}")
        
        import glob
        matching_files = glob.glob(pattern, root_dir=project_path, recursive=True)
        
        for file_path in matching_files:
            full_path = os.path.join(project_path, file_path)
            if os.path.isfile(full_path):
                print(f"  Refactoring: {file_path}")
                
                result = pk.refactor_code(file_path, goal)
                result["file_path"] = file_path
                result["refactoring_goal"] = goal
                refactoring_results.append(result)
                
                if result["success"]:
                    print(f"    ✅ Refactoring completed")
                else:
                    print(f"    ❌ Refactoring failed: {result['error']}")
                
                time.sleep(2)  # Longer delay for refactoring tasks
    
    # Save refactoring report
    refactoring_report = {
        "refactoring_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "project_path": project_path,
        "refactoring_goals": refactoring_goals,
        "total_files_processed": len(refactoring_results),
        "successful_refactorings": len([r for r in refactoring_results if r["success"]]),
        "results": refactoring_results
    }
    
    with open("refactoring_report.json", "w") as f:
        json.dump(refactoring_report, f, indent=2)
    
    print(f"\nRefactoring loop complete! Report saved to refactoring_report.json")
    
    return refactoring_report


def test_generation_loop(source_path: str, test_output_path: str):
    """
    Generate tests for all source files in a directory
    
    Args:
        source_path: Path containing source files
        test_output_path: Path where tests should be generated
    """
    print(f"Generating tests for files in: {source_path}")
    
    pk = PKCode(model="gpt-4", working_dir=source_path)
    
    # Ensure test output directory exists
    os.makedirs(test_output_path, exist_ok=True)
    
    # Find source files
    source_files = []
    for ext in ['*.py', '*.js', '*.ts', '*.tsx']:
        import glob
        files = glob.glob(os.path.join(source_path, ext), recursive=True)
        source_files.extend(files)
    
    print(f"Found {len(source_files)} source files")
    
    test_results = []
    
    for i, source_file in enumerate(source_files, 1):
        rel_path = os.path.relpath(source_file, source_path)
        print(f"[{i}/{len(source_files)}] Generating tests for: {rel_path}")
        
        # Determine test framework based on file extension
        ext = os.path.splitext(source_file)[1]
        if ext == '.py':
            framework = 'pytest'
        elif ext in ['.js', '.ts', '.tsx']:
            framework = 'jest'
        else:
            framework = 'pytest'  # default
        
        result = pk.generate_tests(rel_path, framework)
        result["source_file"] = rel_path
        result["test_framework"] = framework
        test_results.append(result)
        
        if result["success"]:
            # Save generated test to file
            test_filename = f"test_{os.path.splitext(os.path.basename(rel_path))[0]}{ext}"
            test_filepath = os.path.join(test_output_path, test_filename)
            
            with open(test_filepath, 'w') as f:
                f.write(result["response"])
            
            result["test_file_path"] = test_filepath
            print(f"    ✅ Test saved to: {test_filename}")
        else:
            print(f"    ❌ Test generation failed: {result['error']}")
        
        time.sleep(1.5)
    
    # Generate test generation report
    test_report = {
        "generation_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "source_path": source_path,
        "test_output_path": test_output_path,
        "total_source_files": len(source_files),
        "successful_generations": len([r for r in test_results if r["success"]]),
        "results": test_results
    }
    
    with open("test_generation_report.json", "w") as f:
        json.dump(test_report, f, indent=2)
    
    print(f"\nTest generation complete! Report saved to test_generation_report.json")
    print(f"Success rate: {len([r for r in test_results if r['success']])}/{len(source_files)}")
    
    return test_report


def documentation_generation_loop(project_path: str, docs_output_path: str):
    """
    Generate documentation for all files in a project
    
    Args:
        project_path: Path to the project
        docs_output_path: Path where documentation should be saved
    """
    print(f"Generating documentation for project: {project_path}")
    
    pk = PKCode(model="claude-3-5-sonnet", working_dir=project_path)
    
    # Ensure docs output directory exists
    os.makedirs(docs_output_path, exist_ok=True)
    
    # Find all code files
    code_files = []
    for root, dirs, files in os.walk(project_path):
        dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', '__pycache__', '.venv', 'dist', 'build']]
        
        for file in files:
            if file.endswith(('.py', '.js', '.ts', '.tsx', '.java', '.go', '.rs')):
                rel_path = os.path.relpath(os.path.join(root, file), project_path)
                code_files.append(rel_path)
    
    print(f"Found {len(code_files)} files to document")
    
    doc_results = []
    
    for i, file_path in enumerate(code_files, 1):
        print(f"[{i}/{len(code_files)}] Documenting: {file_path}")
        
        result = pk.analyze_file(file_path, "documentation")
        result["source_file"] = file_path
        doc_results.append(result)
        
        if result["success"]:
            # Save documentation to file
            doc_filename = f"{os.path.splitext(os.path.basename(file_path))[0]}_docs.md"
            doc_filepath = os.path.join(docs_output_path, doc_filename)
            
            # Add header to documentation
            doc_content = f"# Documentation for {file_path}\n\n"
            doc_content += f"Generated on: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n"
            doc_content += "---\n\n"
            doc_content += result["response"]
            
            with open(doc_filepath, 'w') as f:
                f.write(doc_content)
            
            result["doc_file_path"] = doc_filepath
            print(f"    ✅ Documentation saved to: {doc_filename}")
        else:
            print(f"    ❌ Documentation generation failed: {result['error']}")
        
        time.sleep(1)
    
    # Generate index file
    index_content = "# Project Documentation\n\n"
    index_content += f"Generated on: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    index_content += "## Documented Files\n\n"
    
    for result in doc_results:
        if result["success"]:
            file_name = os.path.basename(result["doc_file_path"])
            index_content += f"- [{result['source_file']}]({file_name})\n"
    
    index_path = os.path.join(docs_output_path, "README.md")
    with open(index_path, 'w') as f:
        f.write(index_content)
    
    # Generate documentation report
    doc_report = {
        "generation_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "project_path": project_path,
        "docs_output_path": docs_output_path,
        "total_files": len(code_files),
        "successful_generations": len([r for r in doc_results if r["success"]]),
        "results": doc_results
    }
    
    with open("documentation_generation_report.json", "w") as f:
        json.dump(doc_report, f, indent=2)
    
    print(f"\nDocumentation generation complete!")
    print(f"Report saved to documentation_generation_report.json")
    print(f"Index created at: {index_path}")
    
    return doc_report


def main():
    """Main function demonstrating various batch processing patterns"""
    
    if len(sys.argv) < 2:
        print("Usage: python batch_processing_examples.py <command> [args]")
        print("\nAvailable commands:")
        print("  analyze <codebase_path>           - Analyze entire codebase structure")
        print("  security <codebase_path>          - Perform security audit")
        print("  refactor <project_path>            - Refactor code based on goals")
        print("  tests <source_path> <output_path>  - Generate tests for source files")
        print("  docs <project_path> <output_path>   - Generate documentation")
        return
    
    command = sys.argv[1]
    
    try:
        if command == "analyze":
            if len(sys.argv) < 3:
                print("Usage: python batch_processing_examples.py analyze <codebase_path>")
                return
            codebase_path = sys.argv[2]
            analyze_codebase_structure(codebase_path)
            
        elif command == "security":
            if len(sys.argv) < 3:
                print("Usage: python batch_processing_examples.py security <codebase_path>")
                return
            codebase_path = sys.argv[2]
            security_audit_loop(codebase_path)
            
        elif command == "refactor":
            if len(sys.argv) < 3:
                print("Usage: python batch_processing_examples.py refactor <project_path>")
                return
            project_path = sys.argv[2]
            
            # Example refactoring goals
            refactoring_goals = {
                "**/legacy_*.py": "Modernize legacy code by improving readability, adding type hints, and following Python best practices",
                "**/*_old.js": "Update to modern JavaScript ES6+ syntax and improve code organization",
                "**/util*.py": "Improve error handling and add input validation"
            }
            
            refactoring_loop(project_path, refactoring_goals)
            
        elif command == "tests":
            if len(sys.argv) < 4:
                print("Usage: python batch_processing_examples.py tests <source_path> <output_path>")
                return
            source_path = sys.argv[2]
            output_path = sys.argv[3]
            test_generation_loop(source_path, output_path)
            
        elif command == "docs":
            if len(sys.argv) < 4:
                print("Usage: python batch_processing_examples.py docs <project_path> <output_path>")
                return
            project_path = sys.argv[2]
            output_path = sys.argv[3]
            documentation_generation_loop(project_path, output_path)
            
        else:
            print(f"Unknown command: {command}")
            
    except Exception as e:
        print(f"Error executing command '{command}': {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()