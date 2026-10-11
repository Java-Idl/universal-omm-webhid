import re

with open("logs/hid_api.log", "r", encoding="utf-8") as f:
    lines = f.readlines()

sessions = []
curr_session = []
for line in lines:
    if line.startswith("--- USER SESSION"):
        if curr_session:
            sessions.append(curr_session)
        curr_session = [line]
    elif curr_session:
        curr_session.append(line)
if curr_session:
    sessions.append(curr_session)

target_lines = sessions[-1] if sessions else lines

events = []
i = 0
while i < len(target_lines):
    line = target_lines[i].strip()
    if line.startswith("[") and ("SEND" in line or "RECV" in line):
        m = re.match(r"\[(.*?)\] \[(.*?)\] \[(.*?)\] Handle=(.*?) Len=(\d+) (.*)", line)
        if m:
            ts, api, direction, handle, length, decoded = m.groups()
            bytes_line = ""
            if i + 1 < len(target_lines) and target_lines[i+1].strip().startswith("Bytes:"):
                bytes_line = target_lines[i+1].strip().split("Bytes:")[1].strip()
                i += 1
            events.append({
                "ts": ts,
                "api": api,
                "dir": direction,
                "len": int(length),
                "decoded": decoded,
                "bytes": bytes_line
            })
    i += 1

print(f"Total parsed HID++ packets in latest session: {len(events)}")

non_polling = []
for e in events:
    b = e["bytes"]
    if b.startswith("10 ff 0c 2f") or b.startswith("11 ff 0c 2f"):
        continue
    non_polling.append(e)

print(f"Non-polling packets: {len(non_polling)}")

print("\n--- FIRST 40 PACKETS ---")
for idx, e in enumerate(non_polling[:40]):
    print(f"{idx+1:02d}. [{e['dir']}] Len={e['len']:02d} {e['decoded']} => {e['bytes']}")

print("\n--- PACKETS 41 TO 80 ---")
for idx, e in enumerate(non_polling[40:80]):
    print(f"{idx+41:02d}. [{e['dir']}] Len={e['len']:02d} {e['decoded']} => {e['bytes']}")

print("\n--- PACKETS 81 TO END ---")
for idx, e in enumerate(non_polling[80:]):
    print(f"{idx+81:02d}. [{e['dir']}] Len={e['len']:02d} {e['decoded']} => {e['bytes']}")
