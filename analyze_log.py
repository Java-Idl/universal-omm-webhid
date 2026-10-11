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

print(f"Total user sessions captured: {len(sessions)}")
target_lines = sessions[-1] if sessions else lines

print(f"Lines in latest session: {len(target_lines)}")

# Parse events
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

print(f"Total parsed HID++ packets: {len(events)}")

# Filter out repetitive polling (10 ff 0c 2f 00 00 00)
non_polling = []
for e in events:
    b = e["bytes"]
    if b.startswith("10 ff 0c 2f") or b.startswith("11 ff 0c 2f"):
        continue
    non_polling.append(e)

print(f"Non-polling packets (feature enumeration, DPI set, profile, rate, lighting): {len(non_polling)}")
for idx, e in enumerate(non_polling):
    print(f"{idx+1}. [{e['dir']}] {e['api']} Len={e['len']} {e['decoded']} => {e['bytes']}")
