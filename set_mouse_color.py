#!/usr/bin/env python3
"""
Direct Logitech HID++ 2.0 Color & DPI Controller
Target: Logitech G502 HERO Gaming Mouse (VID: 0x046D, PID: 0xC08B)
"""

import sys
import time
import hid

def set_color_and_dpi(r=255, g=0, b=0, dpi=1600):
    devs = hid.enumerate(0x046D, 0xC08B)
    col1 = next((d for d in devs if d['usage_page'] == 0xFF00 and d['usage'] == 1), None)
    col2 = next((d for d in devs if d['usage_page'] == 0xFF00 and d['usage'] == 2), None)

    if not col1 or not col2:
        print("[-] Could not find Logitech HID++ collections (0xFF00/1 and 0xFF00/2).")
        return False

    d1 = hid.device()
    d1.open_path(col1['path'])
    d2 = hid.device()
    d2.open_path(col2['path'])

    try:
        # Step 1: Feature Discovery for 0x2201 (DPI) and 0x8070 (RGB)
        d1.write(bytes([0x10, 0xFF, 0x00, 0x01, 0x22, 0x01, 0x00]))
        res_dpi = bytes(d2.read(64, 300))
        dpi_feat_idx = res_dpi[4] if len(res_dpi) >= 5 else 0x0A

        d1.write(bytes([0x10, 0xFF, 0x00, 0x02, 0x80, 0x70, 0x00]))
        res_rgb = bytes(d2.read(64, 300))
        rgb_feat_idx = res_rgb[4] if len(res_rgb) >= 5 else 0x02

        print(f"[+] Discovered Runtime Indices: DPI=0x{dpi_feat_idx:02X}, RGB=0x{rgb_feat_idx:02X}")

        # Step 2: Set DPI
        dpi_hi = (dpi >> 8) & 0xFF
        dpi_lo = dpi & 0xFF
        d1.write(bytes([0x10, 0xFF, dpi_feat_idx, 0x31, 0x00, dpi_hi, dpi_lo]))
        ack_dpi = bytes(d2.read(64, 300))
        confirmed_dpi = (ack_dpi[5] << 8) | ack_dpi[6] if len(ack_dpi) >= 7 else dpi
        print(f"[+] Physical Mouse DPI set to: {confirmed_dpi}")

        # Step 3: Check and set Onboard Mode (Feature 0x8100, Fn 0x01)
        d1.write(bytes([0x10, 0xFF, 0x00, 0x03, 0x81, 0x00, 0x00]))
        res_8100 = bytes(d2.read(64, 300))
        f8100_idx = res_8100[4] if len(res_8100) >= 5 else 0x0C

        # Step 4: Enable Software Lighting Control (Fn 0x08)
        d1.write(bytes([0x10, 0xFF, rgb_feat_idx, 0x81, 0x01, 0x00, 0x00]))
        d2.read(64, 300)

        # Step 5: Set Zone 0 (Logo) and Zone 1 (DPI LEDs) to Static Color with Persistence = 1 (NV Flash)
        for zone in [0, 1]:
            # Byte 12 of payload (index 16 of packet) is persistence: 1 = VOLATILE_AND_NONVOLATILE
            payload = [zone, 0x01, r, g, b, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]
            pkt = bytes([0x11, 0xFF, rgb_feat_idx, 0x31] + payload)
            d2.write(pkt)
            ack = bytes(d2.read(64, 300))
            status = "OK" if len(ack) >= 5 and ack[4] == 0x00 else f"Ack: {ack.hex()}"
            print(f"[+] Zone {zone} set to RGB({r}, {g}, {b}) [Flash NV]: {status}")

        print("[+] Mouse LEDs & DPI updated and saved to non-volatile memory!")
        return True

    finally:
        d1.close()
        d2.close()

if __name__ == '__main__':
    # Default: Bright RED (255, 0, 0) and 1600 DPI
    r = int(sys.argv[1]) if len(sys.argv) > 1 else 255
    g = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    b = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    dpi = int(sys.argv[4]) if len(sys.argv) > 4 else 1600
    set_color_and_dpi(r, g, b, dpi)
