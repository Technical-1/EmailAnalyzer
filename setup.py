#!/usr/bin/env python3
"""
Setup script for EmailHelper - Automated email download and processing
"""

import subprocess
import sys
import os
from pathlib import Path

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"🔧 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed: {e}")
        print(f"Error output: {e.stderr}")
        return False

def main():
    print("🚀 Setting up EmailHelper...")

    # Check Python version
    if sys.version_info < (3, 8):
        print("❌ Python 3.8 or higher required")
        sys.exit(1)

    print(f"✅ Python {sys.version.split()[0]} detected")

    # Install dependencies
    if not run_command("pip install -r requirements.txt", "Installing Python dependencies"):
        sys.exit(1)

    # Create necessary directories
    dirs = ["emails", "processed", "exports"]
    for dir_name in dirs:
        Path(dir_name).mkdir(exist_ok=True)
        print(f"📁 Created directory: {dir_name}")

    # Make scripts executable
    scripts = ["email_downloader.py", "email_processor.py", "cursor_email_reviewer.py"]
    for script in scripts:
        if os.path.exists(script):
            os.chmod(script, 0o755)
            print(f"🔧 Made {script} executable")

    print("\n" + "="*80)
    print("🎉 SETUP COMPLETE!")
    print("="*80)
    print("\n📋 NEXT STEPS:")
    print("1. Run: python email_downloader.py")
    print("   - Enter your Outlook/UFL email credentials")
    print("   - Select mailbox to download (usually 'INBOX')")
    print("   - Wait for download to complete (may take hours for 6000+ emails)")
    print("\n2. After download, analyze emails:")
    print("   python email_processor.py --analyze --export-summary --create-index")
    print("\n3. Review emails efficiently:")
    print("   python cursor_email_reviewer.py")
    print("\n📚 Available tools:")
    print("• email_downloader.py - Download emails from IMAP")
    print("• email_processor.py - Analyze and search downloaded emails")
    print("• cursor_email_reviewer.py - Interactive email review tool")
    print("\n💡 Tips:")
    print("• Use bulk categorization for common senders")
    print("• Save progress frequently during review")
    print("• Look for account/password reset emails first")
    print("• Categorize financial and service emails as high priority")
    print("\n🔐 SECURITY NOTE:")
    print("Your email credentials are only used for IMAP access and are not stored.")
    print("Consider using an app password if 2FA is enabled on your account.")

if __name__ == "__main__":
    main()
