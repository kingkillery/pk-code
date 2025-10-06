"""
PK Code Python SDK

This package provides a Python wrapper for the PK Code CLI,
enabling programmatic agent execution from Python scripts.

Installation:
    # Install globally using PK Code CLI
    /install-python-sdk
    
    # Or manually add to your project
    from pk_code_python_sdk import PKCode

Usage:
    from pk_code_python_sdk import PKCode
    
    pk = PKCode(model="gpt-4")
    result = pk.execute("What is 2+2?")
    print(result["response"])
    
    # File analysis
    result = pk.analyze_file("src/auth.py", "security")
    print(result["response"])
    
    # Batch processing
    results = pk.batch_analyze(["**/*.py"], "code_quality")
    for result in results:
        if result["success"]:
            print(f"✅ {result['file_path']}")
"""

from .python_wrapper import PKCode

__version__ = "1.0.0"
__all__ = ["PKCode"]