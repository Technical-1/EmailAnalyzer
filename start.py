#!/usr/bin/env python3
"""
EmailHelper - Quick Start Script
Launches the interactive webapp for email backup and analysis
"""

import os
import sys

def main():
    print("🎯 EmailHelper - Interactive Email Backup Tool")
    print("=" * 50)
    print("📧 Perfect for: Outlook/UFL email access cutoff")
    print("🎯 Handles: 6000+ emails with ease")
    print("⚡ Features: Real-time download, analysis, and viewing")
    print()
    print("🚀 Starting interactive web interface...")
    print("💡 Your browser will open automatically")
    print()

    # Run the webapp launcher
    os.system(f"{sys.executable} run_webapp.py")

if __name__ == "__main__":
    main()
