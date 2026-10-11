import frida
import subprocess
import time
import os
import sys

LOG_FILE = "logs/hid_api.log"
EXE_PATH = os.path.abspath("OnboardMemoryManager_2.7.4428.exe")

with open(LOG_FILE, "a", encoding="utf-8") as f:
    f.write(f"\n--- SESSION STARTED AT {time.ctime()} ---\n")

print(f"[*] Starting {EXE_PATH}...")
proc = subprocess.Popen([EXE_PATH])
print(f"[+] Started OMM with PID {proc.pid}. Waiting 3 seconds for DLL initialization...")
time.sleep(3)

session = frida.attach(proc.pid)

def on_message(message, data):
    if message['type'] == 'send':
        payload = message['payload']
        msg_str = payload.get('message', str(payload))
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(msg_str + "\n")
            f.flush()
        print(msg_str.strip())
    elif message['type'] == 'error':
        print(f"[!] Frida Error: {message['stack']}")
    elif message['type'] == 'log':
        print(f"[*] {message['payload']}")

with open("hooks/hid_hook.js", "r", encoding="utf-8") as f:
    hook_code = f.read()

script = session.create_script(hook_code)
script.on("message", on_message)
script.load()

print(f"[+] Hooks attached to PID {proc.pid}! Ready and logging to {LOG_FILE}...")
sys.stdout.flush()

try:
    while proc.poll() is None:
        time.sleep(0.5)
except KeyboardInterrupt:
    pass

print("[*] Process exited. Detaching...")
try:
    session.detach()
except:
    pass
