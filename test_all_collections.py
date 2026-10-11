import hid
import time

devs = hid.enumerate(0x046D, 0xC08B)
print(f"Total collections for G502 HERO: {len(devs)}")

for idx, d in enumerate(devs):
    print(f"\n--- Testing Collection {idx}: UsagePage=0x{d['usage_page']:04X}, Usage=0x{d['usage']:04X}, Interface={d['interface_number']} ---")
    h = hid.device()
    try:
        h.open_path(d['path'])
        
        # Query Root Feature (0x0000) Function 0 for Feature 0x0001 (FeatureSet)
        # Short report: 10 ff 00 10 00 01 00 (7 bytes)
        # Note: on Windows hidapi write(), length must match the report size expected or padded
        req_short = bytes([0x10, 0xFF, 0x00, 0x10, 0x00, 0x01, 0x00])
        try:
            w_ret = h.write(req_short)
            print(f"  h.write(7-byte) returned: {w_ret}")
            res = h.read(64, timeout_ms=200)
            if res:
                print(f"  --> Received read(): {' '.join(f'{b:02x}' for b in res)}")
        except Exception as e:
            print(f"  h.write failed: {e}")
            
        try:
            # Test send_feature_report
            feat_ret = h.send_feature_report(req_short)
            print(f"  send_feature_report returned: {feat_ret}")
            res_feat = h.get_feature_report(0x10, 7)
            if res_feat:
                print(f"  --> Received get_feature_report: {' '.join(f'{b:02x}' for b in res_feat)}")
        except Exception as e:
            print(f"  feature_report failed: {e}")
            
        h.close()
    except Exception as e:
        print(f"  Failed to open: {e}")
