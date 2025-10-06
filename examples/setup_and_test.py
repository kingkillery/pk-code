#!/usr/bin/env python3
"""
PK Code Setup and Test Script

This script helps you set up and test the PK Code Python wrapper.
Run this script to verify everything is working correctly.
"""

import subprocess
import sys
import os

def run_command(cmd, description):
    """Run a command and display results"""
    print(f"\n{'='*60}")
    print(f"🔧 {description}")
    print(f"{'='*60}")
    print(f"Command: {' '.join(cmd)}")
    print("-" * 40)
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            print("✅ SUCCESS")
            if result.stdout.strip():
                print(f"Output: {result.stdout.strip()}")
        else:
            print("❌ FAILED")
            if result.stderr.strip():
                print(f"Error: {result.stderr.strip()}")
            if result.stdout.strip():
                print(f"Output: {result.stdout.strip()}")
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        print("❌ TIMEOUT")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def check_prerequisites():
    """Check if prerequisites are installed"""
    print("🔍 Checking prerequisites...")
    
    # Check Node.js
    node_ok = run_command(["node", "--version"], "Checking Node.js installation")
    
    # Check npm
    npm_ok = run_command(["npm", "--version"], "Checking npm installation")
    
    # Check Python
    python_ok = run_command([sys.executable, "--version"], "Checking Python installation")
    
    return node_ok and npm_ok and python_ok

def install_pk_code():
    """Install PK Code CLI"""
    print("\n📦 Installing PK Code CLI...")
    
    # Check if already installed
    if run_command(["pk", "--version"], "Checking if PK Code is already installed"):
        print("✅ PK Code is already installed!")
        return True
    
    # Install PK Code
    install_ok = run_command(
        ["npm", "install", "-g", "pk-code-cli"], 
        "Installing PK Code CLI globally"
    )
    
    if install_ok:
        print("✅ PK Code installed successfully!")
    else:
        print("❌ Failed to install PK Code")
        print("💡 Try running manually: npm install -g pk-code-cli")
    
    return install_ok

def test_pk_code():
    """Test PK Code installation"""
    print("\n🧪 Testing PK Code installation...")
    
    # Test version command
    version_ok = run_command(["pk", "--version"], "Testing PK Code version command")
    
    if not version_ok:
        return False
    
    # Test help command
    help_ok = run_command(["pk", "--help"], "Testing PK Code help command")
    
    return version_ok and help_ok

def test_python_wrapper():
    """Test the Python wrapper"""
    print("\n🐍 Testing Python wrapper...")
    
    try:
        # Import the wrapper
        sys.path.insert(0, os.path.dirname(__file__))
        from python_wrapper import PKCode
        
        # Test initialization
        print("Initializing PK Code wrapper...")
        pk = PKCode()
        print("✅ PK Code wrapper initialized successfully!")
        
        # Test simple execution (non-interactive)
        print("Testing simple prompt execution...")
        result = pk.execute("What is 2+2? Just give me the number.")
        
        if result["success"]:
            print("✅ Python wrapper test successful!")
            print(f"Response: {result['response'][:100]}...")
            return True
        else:
            print("❌ Python wrapper test failed")
            print(f"Error: {result.get('error', 'Unknown error')}")
            return False
            
    except Exception as e:
        print(f"❌ Python wrapper test failed: {e}")
        return False

def setup_authentication():
    """Guide user through authentication setup"""
    print("\n🔐 Authentication Setup")
    print("=" * 40)
    print("PK Code requires API keys to work with AI models.")
    print("Choose one of the following providers:")
    print()
    print("1. OpenAI (GPT models):")
    print("   echo 'your-openai-api-key' | pk login --with-api-key --provider=openai")
    print()
    print("2. Anthropic (Claude models):")
    print("   echo 'your-anthropic-api-key' | pk login --with-api-key --provider=anthropic")
    print()
    print("3. Google (Gemini models):")
    print("   echo 'your-google-api-key' | pk login --with-api-key --provider=google")
    print()
    print("💡 Get API keys from:")
    print("   - OpenAI: https://platform.openai.com/api-keys")
    print("   - Anthropic: https://console.anthropic.com/")
    print("   - Google: https://makersuite.google.com/app/apikey")
    print()
    
    # Check if already authenticated
    auth_check = run_command(["pk", "login", "--status"], "Checking authentication status")
    
    if auth_check:
        print("✅ Authentication is already configured!")
    else:
        print("⚠️  Authentication not configured. Please run one of the commands above.")

def main():
    """Main setup and test function"""
    print("🚀 PK Code Python Wrapper Setup & Test")
    print("=" * 50)
    
    # Step 1: Check prerequisites
    if not check_prerequisites():
        print("\n❌ Prerequisites check failed!")
        print("Please install Node.js, npm, and Python before continuing.")
        return False
    
    # Step 2: Install PK Code
    if not install_pk_code():
        print("\n❌ PK Code installation failed!")
        return False
    
    # Step 3: Test PK Code
    if not test_pk_code():
        print("\n❌ PK Code test failed!")
        return False
    
    # Step 4: Setup authentication
    setup_authentication()
    
    # Step 5: Test Python wrapper
    if not test_python_wrapper():
        print("\n❌ Python wrapper test failed!")
        return False
    
    # Success!
    print("\n" + "=" * 50)
    print("🎉 SETUP COMPLETE!")
    print("=" * 50)
    print("✅ PK Code CLI is installed and working")
    print("✅ Python wrapper is working")
    print("✅ Ready to use!")
    print()
    print("Next steps:")
    print("1. Import the wrapper: from python_wrapper import PKCode")
    print("2. Create instance: pk = PKCode()")
    print("3. Execute prompts: result = pk.execute('Your prompt here')")
    print()
    print("Example usage:")
    print("```")
    print("from python_wrapper import PKCode")
    print()
    print("pk = PKCode(model='gpt-4')")
    print("result = pk.analyze_file('src/auth.py', 'security')")
    print("print(result['response'])")
    print("```")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)