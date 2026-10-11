import hid
import time

devs = hid.enumerate(0x046D, 0xC08B)
hidpp_dev = None
for d in devs:
    if d['usage_page'] == 0xFF00 and d['usage'] == 0x0001:
        hidpp_dev = d
        break

if not hidpp_dev:
    print("HID++ interface not found!")
    exit(1)

print(f"Opening HID++ device at path: {hidpp_dev['path']}")
h = hid.device()
h.open_path(hidpp_dev['path'])
print("[+] Successfully opened HID++ device handle!")

# Query Root Feature (0x0000) Function 0 for Feature 0x0001 (FeatureSet)
# Short report: 10 ff 00 00 00 01 00 (7 bytes)
req = bytes([0x10, 0xFF, 0x00, 0x00, 0x00, 0x01, 0x00])
h.write(req)

res = h.read(64, timeout_ms=1000)
print(f"[+] Device response: {' '.join(f'{b:02x}' for b in res)}")

# Query Root Feature (0x0000) Function 0 for Feature 0x8100 (Onboard Profiles)
req2 = bytes([0x10, 0xFF, 0x00, 0x00, 0x81, 0x00, 0x00])
h.write(req2)
res2 = h.read(64, timeout_ms=1000)
print(f"[+] Query Feature 0x8100 response: {' '.join(f'{b:02x}' for b in res2)}")

h.close()
