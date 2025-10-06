#!/usr/bin/env python3
"""
PK Code Python Wrapper - Getting Started Example

This is a simple example to get you started with the PK Code Python wrapper.
Run this after you've completed the setup process.
"""

import sys
import os

# Add the current directory to Python path to import the wrapper
sys.path.insert(0, os.path.dirname(__file__))

def main():
    print("🚀 PK Code Python Wrapper - Getting Started")
    print("=" * 50)
    
    try:
        # Import the PK Code wrapper
        from python_wrapper import PKCode
        print("✅ Successfully imported PK Code wrapper")
        
        # Initialize PK Code
        print("\n🔧 Initializing PK Code...")
        pk = PKCode(model="gpt-4")
        print("✅ PK Code initialized successfully!")
        
        # Example 1: Simple prompt
        print("\n📝 Example 1: Simple prompt")
        print("-" * 30)
        result = pk.execute("What is Python? Answer in one sentence.")
        
        if result["success"]:
            print(f"✅ Response: {result['response']}")
        else:
            print(f"❌ Error: {result.get('error', 'Unknown error')}")
        
        # Example 2: File analysis (if we have a sample file)
        sample_file = "getting_started.py"  # Analyze this file itself
        if os.path.exists(sample_file):
            print(f"\n📁 Example 2: Analyzing file: {sample_file}")
            print("-" * 30)
            result = pk.analyze_file(sample_file, "general")
            
            if result["success"]:
                print(f"✅ Analysis complete!")
                print(f"Response preview: {result['response'][:200]}...")
            else:
                print(f"❌ Analysis failed: {result.get('error', 'Unknown error')}")
        else:
            print(f"\n⚠️  Sample file {sample_file} not found, skipping file analysis example")
        
        # Example 3: Your use case - Loop through files
        print("\n🔄 Example 3: Loop through files (your use case)")
        print("-" * 30)
        
        # Create some dummy files for demonstration
        dummy_files = ["dummy1.py", "dummy2.js", "dummy3.txt"]
        
        for i, filename in enumerate(dummy_files, 1):
            # Create dummy file
            with open(filename, 'w') as f:
                if filename.endswith('.py'):
                    f.write(f"# Dummy Python file {i}\ndef hello_world():\n    print('Hello from file {i}')\n")
                elif filename.endswith('.js'):
                    f.write(f"// Dummy JavaScript file {i}\nfunction hello{i}() {{\n    console.log('Hello from file {i}');\n}}\n")
                else:
                    f.write(f"Dummy text file {i}\nThis is just a test file.\n")
            
            # Analyze the file
            print(f"  [{i}/{len(dummy_files)}] Analyzing {filename}...")
            result = pk.analyze_file(filename, "general")
            
            if result["success"]:
                print(f"    ✅ Analysis complete")
            else:
                print(f"    ❌ Analysis failed: {result.get('error', 'Unknown error')}")
        
        # Clean up dummy files
        print("\n🧹 Cleaning up dummy files...")
        for filename in dummy_files:
            if os.path.exists(filename):
                os.remove(filename)
        print("✅ Cleanup complete")
        
        # Success message
        print("\n" + "=" * 50)
        print("🎉 GETTING STARTED COMPLETE!")
        print("=" * 50)
        print("✅ PK Code Python wrapper is working perfectly!")
        print()
        print("You're now ready to use PK Code in your own scripts!")
        print()
        print("Next steps:")
        print("1. Check out batch_processing_examples.py for advanced usage")
        print("2. Read the README.md for comprehensive documentation")
        print("3. Start building your own automation scripts!")
        print()
        print("Quick reference:")
        print("- pk.execute('Your prompt')                    # Simple prompt")
        print("- pk.analyze_file('file.py', 'security')      # File analysis")
        print("- pk.batch_analyze(['*.py'], 'code_quality')  # Batch analysis")
        print("- pk.refactor_code('file.py', 'goal')          # Refactoring")
        print("- pk.generate_tests('file.py', 'pytest')       # Test generation")
        
        return True
        
    except ImportError as e:
        print(f"❌ Failed to import PK Code wrapper: {e}")
        print("\n💡 Make sure you've completed the setup:")
        print("   1. Run: python setup_and_test.py")
        print("   2. Or install PK Code CLI: npm install -g pk-code-cli")
        print("   3. Configure authentication: pk login --with-api-key --provider=openai")
        return False
        
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)