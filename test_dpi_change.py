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

print("--- Query current DPI via Feature 0x2201 (Index 0x0A, Function 0x2) ---")
# 10 ff 0a 20 00 00 00
resp = send_hidpp(bytes([0x10, 0xFF, 0x0A, 0x20, 0x00, 0x00, 0x00]))
print(f"Resp: {' '.join(f'{b:02x}' for b in resp)}")
if len(resp) >= 6:
    curr_dpi = (resp[4] << 8) | resp[5]
    print(f"--> Current DPI: {curr_dpi}")

print("\n--- Set DPI to 1600 (0x0640) via Feature 0x2201 (Index 0x0A, Function 0x3) ---")
# 10 ff 0a 30 00 06 40
resp = send_hidpp(bytes([0x10, 0xFF, 0x0A, 0x30, 0x00, 0x06, 0x40]))
print(f"Resp: {' '.join(f'{b:02x}' for b in resp)}")

print("\n--- Query current DPI again to verify ---")
resp = send_hidpp(bytes([0x10, 0xFF, 0x0A, 0x20, 0x00, 0x00, 0x00]))
print(f"Resp: {' '.join(f'{b:02x}' for b in resp)}")
if len(resp) >= 6:
    curr_dpi = (resp[4] << 8) | resp[5]
    print(f"--> Verified DPI after set: {curr_dpi}")

dev_out.close()
dev_in.close()
