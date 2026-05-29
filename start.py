#!/usr/bin/env python3
"""
start.py — launches the FastAPI server + optional ngrok tunnel

Usage:
    python start.py          # start server (ngrok must be running separately)
    python start.py --ngrok  # start server AND open ngrok tunnel automatically
"""

import subprocess
import sys
import time
import threading
import argparse
import os
import json
import urllib.request

from dotenv import load_dotenv, set_key

load_dotenv()


def start_ngrok(port: int) -> str | None:
    """Start ngrok and return the public HTTPS URL."""
    print("Starting ngrok tunnel …")
    proc = subprocess.Popen(
        ["ngrok", "http", str(port), "--log=stdout"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    # Give ngrok a moment to start
    time.sleep(2)
    try:
        with urllib.request.urlopen("http://localhost:4040/api/tunnels") as r:
            data = json.loads(r.read())
        for tunnel in data.get("tunnels", []):
            if tunnel.get("proto") == "https":
                url = tunnel["public_url"]
                print(f"  ngrok tunnel: {url}")
                # Auto-update .env
                if os.path.exists(".env"):
                    set_key(".env", "BASE_URL", url)
                    print(f"  Updated BASE_URL in .env → {url}")
                return url
    except Exception as e:
        print(f"  Could not read ngrok URL: {e}")
    return None


def start_server(port: int):
    """Start the uvicorn server."""
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info",
    )


def main():
    parser = argparse.ArgumentParser(description="AI Call Agent launcher")
    parser.add_argument("--ngrok", action="store_true", help="Auto-start ngrok tunnel")
    args = parser.parse_args()

    port = int(os.getenv("PORT", 5050))

    print("=" * 55)
    print("  AI Phone Call Agent")
    print("=" * 55)
    print(f"  Agent   : {os.getenv('AGENT_NAME', 'Aria')}")
    print(f"  Business: {os.getenv('BUSINESS_NAME', 'TechStore India')}")
    print(f"  Port    : {port}")
    print()

    if args.ngrok:
        ngrok_thread = threading.Thread(target=start_ngrok, args=(port,), daemon=True)
        ngrok_thread.start()
        time.sleep(3)  # let ngrok start before uvicorn logs flood the console

    print(f"Server starting on http://0.0.0.0:{port}")
    print("Endpoints:")
    print(f"  POST /incoming-call  ← set as Twilio Voice webhook")
    print(f"  POST /make-call      ← trigger outbound calls")
    print(f"  GET  /               ← health check")
    print()
    start_server(port)


if __name__ == "__main__":
    main()
