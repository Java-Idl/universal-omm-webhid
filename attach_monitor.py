import frida
import time
import sys
import os

LOG_FILE = "logs/hid_api.log"

print("[*] Waiting for OnboardMemoryManager to be launched by user...")
sys.stdout.flush()

local_device = frida.get_local_device()

pid = None
while pid is None:
    try:
        for p in local_device.enumerate_processes():
            if "onboardmemorymanager" in p.name.lower():
                pid = p.pid
                print(f"[+] Detected OMM process: {p.name} (PID: {pid})")
                break
    except Exception as e:
        pass
    if pid is None:
        time.sleep(0.5)

print("[*] Waiting 2 seconds for libraries to initialize...")
time.sleep(2)

print(f"[*] Attaching Frida to PID {pid}...")
session = local_device.attach(pid)

with open(LOG_FILE, "a", encoding="utf-8") as f:
    f.write(f"\n--- USER SESSION ATTACHED AT {time.ctime()} (PID {pid}) ---\n")

def on_message(message, data):
    if message['type'] == 'send':
        payload = message['payload']
        msg_str = payload.get('message', str(payload))
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(msg_str + "\n")
            f.flush()
        print(msg_str.strip())
        sys.stdout.flush()
    elif message['type'] == 'error':
        print(f"[!] Frida Error: {message['stack']}")
        sys.stdout.flush()
    elif message['type'] == 'log':
        print(f"[*] {message['payload']}")
        sys.stdout.flush()

with open("hooks/hid_hook.js", "r", encoding="utf-8") as f:
    hook_code = f.read()

script = session.create_script(hook_code)
script.on("message", on_message)
script.load()

print(f"[+] Successfully hooked PID {pid}! Capturing packets to {LOG_FILE}...")
sys.stdout.flush()

try:
    while True:
        # Check if process is still running
        procs = [p.pid for p in local_device.enumerate_processes()]
        if pid not in procs:
            print("[*] OMM process closed.")
            break
        time.sleep(0.5)
except KeyboardInterrupt:
    pass

try:
    session.detach()
except:
    pass
