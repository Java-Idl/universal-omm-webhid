import hid
import sys
import time

devs = hid.enumerate(0x046D, 0xC08B)

handles = []
for idx, d in enumerate(devs):
    try:
        h = hid.device()
        h.open_path(d['path'])
        handles.append((idx, d, h))
        print(f"Opened collection {idx}: UP=0x{d['usage_page']:04X}, Usage=0x{d['usage']:04X}")
    except Exception as e:
        print(f"Could not open collection {idx}: {e}")

c4 = [h for idx, d, h in handles if d['usage_page'] == 0xFF00 and d['usage'] == 0x0001][0]
pkt = bytes([0x10, 0xFF, 0x0C, 0x0F, 0x00, 0x00, 0x00])
w = c4.write(pkt)
print(f"Sent {w} bytes on Collection 4: {' '.join(f'{b:02x}' for b in pkt)}")

time.sleep(0.05)

for idx, d, h in handles:
    try:
        data = h.read(64, timeout_ms=100)
        if data:
            print(f"[SUCCESS!] Read {len(data)} bytes from Collection {idx} (UP=0x{d['usage_page']:04X}, Usage=0x{d['usage']:04X}):")
            print("  " + ' '.join(f'{b:02x}' for b in data))
        else:
            print(f"Collection {idx}: 0 bytes")
    except Exception as e:
        print(f"Collection {idx} read error: {e}")

for idx, d, h in handles:
    h.close()
