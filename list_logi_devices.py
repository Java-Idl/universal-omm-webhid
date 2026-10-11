import hid

devs = hid.enumerate()
logi_devs = [d for d in devs if d['vendor_id'] == 0x046D]
print(f"Total HID devices: {len(devs)}")
print(f"Total Logitech HID devices (VID 0x046D): {len(logi_devs)}")
for d in logi_devs:
    path = d['path'].decode('utf-8', errors='ignore') if isinstance(d['path'], bytes) else str(d['path'])
    print(f"VID: 0x{d['vendor_id']:04X}, PID: 0x{d['product_id']:04X}, UsagePage: 0x{d['usage_page']:04X}, Usage: 0x{d['usage']:04X}, Interface: {d['interface_number']}, Product: '{d['product_string']}'")
