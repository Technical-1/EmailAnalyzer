#!/usr/bin/env python3
"""
EmailHelper WebApp Launcher
Starts the interactive web interface for email download and analysis
"""

import os
import sys
import subprocess
import webbrowser
from pathlib import Path

def check_dependencies():
    """Check if required packages are installed"""
    required_packages = [
        'flask', 'flask-socketio', 'pandas', 'numpy', 'tqdm', 'colorama'
    ]

    missing_packages = []
    for package in required_packages:
        try:
            __import__(package.replace('-', '_'))
        except ImportError:
            missing_packages.append(package)

    if missing_packages:
        print("❌ Missing required packages. Installing...")
        try:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'])
            print("✅ Dependencies installed successfully!")
        except subprocess.CalledProcessError:
            print("❌ Failed to install dependencies. Please run:")
            print("   pip install -r requirements.txt")
            sys.exit(1)

def create_directories():
    """Create necessary directories"""
    directories = ['emails', 'processed', 'exports', 'static', 'templates']
    for dir_name in directories:
        Path(dir_name).mkdir(exist_ok=True)
        print(f"📁 Created directory: {dir_name}")

def start_webapp():
    """Start the Flask webapp"""
    print("🚀 Starting EmailHelper WebApp...")
    print("📱 Web interface will open in your browser")
    print("🔗 If it doesn't open automatically, visit: http://localhost:5000")
    print("❌ Press Ctrl+C to stop the server")
    print("-" * 60)

    # Open browser after a short delay
    def open_browser():
        import time
        time.sleep(2)
        webbrowser.open('http://localhost:5000')

    import threading
    browser_thread = threading.Thread(target=open_browser)
    browser_thread.daemon = True
    browser_thread.start()

    # Start the Flask app
    try:
        from app import socketio, app
        socketio.run(app, debug=True, host='0.0.0.0', port=5000)
    except KeyboardInterrupt:
        print("\n👋 WebApp stopped by user")
    except Exception as e:
        print(f"❌ Error starting webapp: {e}")
        sys.exit(1)

def main():
    print("🎯 EmailHelper WebApp Launcher")
    print("=" * 40)

    # Check if we're in the right directory
    if not Path('app.py').exists():
        print("❌ Please run this script from the EmailHelper directory")
        sys.exit(1)

    # Check and install dependencies
    check_dependencies()

    # Create necessary directories
    create_directories()

    # Start the webapp
    start_webapp()

if __name__ == "__main__":
    main()
