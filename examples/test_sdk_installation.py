#!/usr/bin/env python3
"""
Test script to verify PK Code Python SDK installation

This script tests that the SDK is properly installed and working.
Run this after installing the SDK with /install-python-sdk
"""

import sys
import os

def test_import():
    """Test that the SDK can be imported"""
    print("🧪 Testing PK Code Python SDK import...")
    
    try:
        # Try importing from the installed location
        sys.path.insert(0, os.path.expanduser("~/.pk-code/python-sdk"))
        from pk_code_python_sdk import PKCode
        print("✅ Successfully imported PKCode from pk_code_python_sdk")
        return True
    except ImportError as e:
        print(f"❌ Failed to import PKCode: {e}")
        print("\n💡 Make sure you've:")
        print("   1. Run /install-python-sdk in PK Code CLI")
        print("   2. Added the SDK to your PYTHONPATH")
        print("   3. Restarted your terminal/shell")
        return False

def test_initialization():
    """Test that PKCode can be initialized"""
    print("\n🧪 Testing PKCode initialization...")
    
    try:
        sys.path.insert(0, os.path.expanduser("~/.pk-code/python-sdk"))
        from pk_code_python_sdk import PKCode
        
        pk = PKCode()
        print("✅ Successfully initialized PKCode")
        return True
    except Exception as e:
        print(f"❌ Failed to initialize PKCode: {e}")
        return False

def test_simple_execution():
    """Test simple prompt execution"""
    print("\n🧪 Testing simple prompt execution...")
    
    try:
        sys.path.insert(0, os.path.expanduser("~/.pk-code/python-sdk"))
        from pk_code_python_sdk import PKCode
        
        pk = PKCode()
        result = pk.execute("What is 2+2? Just give me the number.")
        
        if result["success"]:
            print("✅ Successfully executed prompt")
            print(f"Response: {result['response'][:100]}...")
            return True
        else:
            print(f"❌ Prompt execution failed: {result.get('error', 'Unknown error')}")
            return False
    except Exception as e:
        print(f"❌ Exception during execution: {e}")
        return False

def test_file_analysis():
    """Test file analysis functionality"""
    print("\n🧪 Testing file analysis...")
    
    try:
        sys.path.insert(0, os.path.expanduser("~/.pk-code/python-sdk"))
        from pk_code_python_sdk import PKCode
        
        pk = PKCode()
        
        # Test with this file itself
        result = pk.analyze_file("test_sdk_installation.py", "general")
        
        if result["success"]:
            print("✅ Successfully analyzed file")
            print(f"Analysis preview: {result['response'][:150]}...")
            return True
        else:
            print(f"❌ File analysis failed: {result.get('error', 'Unknown error')}")
            return False
    except Exception as e:
        print(f"❌ Exception during file analysis: {e}")
        return False

def test_convenience_functions():
    """Test convenience functions"""
    print("\n🧪 Testing convenience functions...")
    
    try:
        sys.path.insert(0, os.path.expanduser("~/.pk-code/python-sdk"))
        from pk_code_python_sdk import quick_analyze, quick_execute
        
        # Test quick_execute
        result = quick_execute("What is Python? Answer in one sentence.")
        if result["success"]:
            print("✅ quick_execute works")
        else:
            print("❌ quick_execute failed")
            return False
        
        # Test quick_analyze
        result = quick_analyze("test_sdk_installation.py", "general")
        if result["success"]:
            print("✅ quick_analyze works")
        else:
            print("❌ quick_analyze failed")
            return False
        
        return True
    except Exception as e:
        print(f"❌ Exception during convenience function test: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 PK Code Python SDK Installation Test")
    print("=" * 50)
    
    tests = [
        ("Import Test", test_import),
        ("Initialization Test", test_initialization),
        ("Simple Execution Test", test_simple_execution),
        ("File Analysis Test", test_file_analysis),
        ("Convenience Functions Test", test_convenience_functions),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Results Summary")
    print("=" * 50)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! PK Code Python SDK is working correctly!")
        print("\nYou can now use it in your projects:")
        print("```")
        print("from pk_code_python_sdk import PKCode")
        print("")
        print("pk = PKCode()")
        print("result = pk.execute('Your prompt here')")
        print("print(result['response'])")
        print("```")
        return True
    else:
        print(f"\n⚠️  {total - passed} tests failed. Please check the installation.")
        print("\nTroubleshooting:")
        print("1. Make sure PK Code CLI is installed: npm install -g pk-code-cli")
        print("2. Make sure PK Code is authenticated: pk login --with-api-key --provider=openai")
        print("3. Make sure the SDK is in your PYTHONPATH")
        print("4. Try running the setup script again")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)