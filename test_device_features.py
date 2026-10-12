import hid

devs = hid.enumerate(0x046D)
print("Found Logitech devices:")
for d in devs:
    p = d.get('product_string', '')
    print(f"VID=0x{d['vendor_id']:04X} PID=0x{d['product_id']:04X} Prod={p} UsagePage=0x{d['usage_page']:04X} Usage=0x{d['usage']:04X}")

col1 = next((d for d in devs if d['usage_page'] == 0xFF00 and d['usage'] == 1), None)
col2 = next((d for d in devs if d['usage_page'] == 0xFF00 and d['usage'] == 2), None)

if col1 and col2:
    d1 = hid.device()
    d1.open_path(col1['path'])
    d2 = hid.device()
    d2.open_path(col2['path'])
    print("\nSuccessfully opened collections 1 and 2.")

    # Probe all features:
    features_to_test = [
        (0x0001, "IFeatureSet"),
        (0x0003, "IDeviceInfo"),
        (0x0005, "DeviceName"),
        (0x1000, "BatteryLevelStatus"),
        (0x1004, "UnifiedBattery"),
        (0x2121, "HiResWheel"),
        (0x2201, "AdjustableDPI"),
        (0x2202, "SensorDpiParameters"),
        (0x2240, "AngleSnapping"),
        (0x8061, "ReportRate"),
        (0x8070, "ColorLED_RGB"),
        (0x8071, "RGBCluster_v2"),
        (0x8100, "OnboardProfiles"),
        (0x8110, "ButtonSpyRemap")
    ]

    print("\nFeature Discovery Results:")
    for feat_id, name in features_to_test:
        hi = (feat_id >> 8) & 0xFF
        lo = feat_id & 0xFF
        d1.write(bytes([0x10, 0xFF, 0x00, 0x01, hi, lo, 0x00]))
        res = bytes(d2.read(64, 200))
        if len(res) >= 5 and res[4] != 0:
            print(f"  [+] 0x{feat_id:04X} {name:<22}: Supported! Runtime Idx = 0x{res[4]:02X}")
        else:
            print(f"  [-] 0x{feat_id:04X} {name:<22}: NOT SUPPORTED (index 0x00)")

    d1.close()
    d2.close()
