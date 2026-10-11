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

# 1. Ping / IRoot test
print("--- 1. Querying Root for Feature 0x0001 (FeatureSet) ---")
# Feature 0x0000, Function 0x0: 10 ff 00 00 00 01 00
resp = send_hidpp(bytes([0x10, 0xFF, 0x00, 0x00, 0x00, 0x01, 0x00]))
print(f"Resp: {' '.join(f'{b:02x}' for b in resp)}")
feat_idx_0001 = resp[4] if len(resp) > 4 else None
print(f"--> Feature 0x0001 resolved to Runtime Index: {feat_idx_0001}")

print("\n--- 2. Querying Root for Feature 0x2201 (Adjustable DPI) ---")
# Feature 0x0000, Function 0x0: 10 ff 00 00 22 01 00
resp = send_hidpp(bytes([0x10, 0xFF, 0x00, 0x00, 0x22, 0x01, 0x00]))
print(f"Resp: {' '.join(f'{b:02x}' for b in resp)}")
feat_idx_2201 = resp[4] if len(resp) > 4 else None
print(f"--> Feature 0x2201 resolved to Runtime Index: {feat_idx_2201}")

print("\n--- 3. Querying Root for Feature 0x8100 (Onboard Profiles) ---")
# Feature 0x0000, Function 0x0: 10 ff 00 00 81 00 00
resp = send_hidpp(bytes([0x10, 0xFF, 0x00, 0x00, 0x81, 0x00, 0x00]))
print(f"Resp: {' '.join(f'{b:02x}' for b in resp)}")
feat_idx_8100 = resp[4] if len(resp) > 4 else None
print(f"--> Feature 0x8100 resolved to Runtime Index: {feat_idx_8100}")

dev_out.close()
dev_in.close()
