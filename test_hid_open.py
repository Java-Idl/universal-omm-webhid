import hid

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
try:
    h.open_path(hidpp_dev['path'])
    print("[+] Successfully opened HID++ device handle!")
    
    # Send Root Feature query for Feature 0x0000 (IRoot) -> getFeature(0x0000)
    # Query for feature 0x0000: ReportID 0x10, Dev 0xFF, FeatIdx 0x00, Fn 0x00, FeatID 0x00 0x00
    # In Windows hidapi, write() takes bytes starting with Report ID.
    req = bytes([0x10, 0xFF, 0x00, 0x1E, 0x00, 0x01, 0x00]) # query feature 0x0001 (FeatureSet)
    h.write(req)
    res = h.read(64, timeout_ms=500)
    print(f"[+] Device response: {' '.join(f'{b:02x}' for b in res)}")
    h.close()
except Exception as e:
    print(f"[-] Open/communicate error: {e}")
