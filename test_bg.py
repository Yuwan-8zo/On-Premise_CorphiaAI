import urllib.request
import json
import traceback
import time
import subprocess
import os
import signal

def run_backend_and_test():
    # Start backend
    proc = subprocess.Popen(
        r"venv\Scripts\python.exe -m uvicorn app.main:app --port 8001",
        cwd=r"d:\Cursor\on-premise_CorphiaAI\backend",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        shell=True
    )
    time.sleep(5) # Wait for it to start
    
    # Run test
    try:
        data = json.dumps({"email": "engineer@gmail.com", "password": "Engineer123"}).encode('utf-8')
        req = urllib.request.Request('http://localhost:8001/api/v1/auth/login', data=data, headers={'Content-Type': 'application/json'}, method='POST')
        with urllib.request.urlopen(req) as response:
            print("Success:", response.read().decode())
    except urllib.error.HTTPError as e:
        print("HTTP Error:", e.code)
        print("Error Body:", e.read().decode('utf-8'))
    except Exception as e:
        print("Exception:", str(e))
        
    subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
    outs, errs = proc.communicate(timeout=5)
    print("\n--- Uvicorn Stdout ---\n", outs)
    print("\n--- Uvicorn Stderr ---\n", errs)

if __name__ == "__main__":
    run_backend_and_test()
