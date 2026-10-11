import hid
import sys

devs = hid.enumerate(0x046D, 0xC08B)
hidpp_dev = [d for d in devs if d['usage_page'] == 0xFF00 and d['usage'] == 0x0001][0]

h = hid.device()
h.open_path(hidpp_dev['path'])
h.set_nonblocking(False)

# Send the exact packet OMM sends: 10 ff 0c 0f 00 00 00 (getOnboardProfilesInfo)
pkt = bytes([0x10, 0xFF, 0x0C, 0x0F, 0x00, 0x00, 0x00])
w = h.write(pkt)
print(f"Sent {w} bytes: {' '.join(f'{b:02x}' for b in pkt)}")
sys.stdout.flush()

res = h.read(64, timeout_ms=1000)
print(f"Received {len(res)} bytes: {' '.join(f'{b:02x}' for b in res)}")
sys.stdout.flush()

h.close()
