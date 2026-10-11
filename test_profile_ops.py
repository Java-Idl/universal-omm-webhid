import hid

devs = hid.enumerate(0x046D, 0xC08B)
write_col = [d for d in devs if d['usage_page'] == 0xFF00 and d['usage'] == 0x0001][0]
read_col = [d for d in devs if d['usage_page'] == 0xFF00 and d['usage'] == 0x0002][0]

dev_out = hid.device()
dev_out.open_path(write_col['path'])
dev_in = hid.device()
dev_in.open_path(read_col['path'])

def send_hidpp(report):
    dev_out.write(report)
    res = dev_in.read(64, timeout_ms=500)
    return bytes(res)

print("--- Query Onboard Profiles Info via Feature 0x8100 (Index 0x0C, Fn 0x0) ---")
resp = send_hidpp(bytes([0x10, 0xFF, 0x0C, 0x00, 0x00, 0x00, 0x00]))
print(f"Resp: {' '.join(f'{b:02x}' for b in resp)}")

print("\n--- Query Active Profile Slot via Feature 0x8100 (Index 0x0C, Fn 0x4) ---")
resp = send_hidpp(bytes([0x10, 0xFF, 0x0C, 0x40, 0x00, 0x00, 0x00]))
print(f"Resp: {' '.join(f'{b:02x}' for b in resp)}")
if len(resp) >= 6:
    active_slot = (resp[4] << 8) | resp[5]
    print(f"--> Active Profile Sector / Slot: {active_slot}")

print("\n--- Activate Profile Slot 1 via Feature 0x8100 (Index 0x0C, Fn 0x3) ---")
resp = send_hidpp(bytes([0x10, 0xFF, 0x0C, 0x30, 0x00, 0x01, 0x00]))
print(f"Resp: {' '.join(f'{b:02x}' for b in resp)}")

print("\n--- Commit/Save Profile via Feature 0x8100 (Index 0x0C, Fn 0xC) ---")
resp = send_hidpp(bytes([0x10, 0xFF, 0x0C, 0xC0, 0x01, 0x00, 0x00]))
print(f"Resp: {' '.join(f'{b:02x}' for b in resp)}")

dev_out.close()
dev_in.close()
