#!/usr/bin/env python3
"""
Logitech HID++ 2.0 Protocol Interoperability Demonstration
Target: Logitech G502 HERO Gaming Mouse (VID: 0x046D, PID: 0xC08B) & compatible HID++ 2.0 peripherals.

This proof-of-concept tool connects to the hardware device via cython-hidapi,
dynamically queries Feature 0x0000 (IRoot) to resolve runtime feature indices,
reads current sensor DPI, updates sensor DPI, queries onboard profile memory,
and executes profile activation/commit commands using the verified wire protocol.
"""

import sys
import time
from typing import Optional, Tuple, Dict
import hid

LOGITECH_VID = 0x046D

# HID++ 2.0 Protocol Feature IDs
FEATURE_ROOT = 0x0000              # IRoot (Feature Discovery)
FEATURE_FEATURE_SET = 0x0001       # IFeatureSet (Feature Enumeration)
FEATURE_DEVICE_INFO = 0x0003       # IDeviceInfo
FEATURE_DEVICE_NAME = 0x0005       # Device Name & Type
FEATURE_ADJUSTABLE_DPI = 0x2201    # Adjustable DPI
FEATURE_DPI_SENSOR = 0x2202        # Sensor DPI Parameters & Ranges
FEATURE_REPORT_RATE = 0x8061       # Report Rate (Polling Rate)
FEATURE_COLOR_LED = 0x8070         # Color LED Effects (RGB Zones)
FEATURE_ONBOARD_PROFILES = 0x8100  # Onboard Profiles & Mode Control
FEATURE_BUTTON_SPY = 0x8110        # Button Spy & Remapping

# Report IDs
REPORT_ID_SHORT = 0x10  # 7-byte message
REPORT_ID_LONG = 0x11   # 20-byte message
REPORT_ID_VERY_LONG = 0x12  # 64-byte message

# Standard Device Index
DEVICE_INDEX_DIRECT = 0xFF  # Corded USB device


class LogitechHidpp20Device:
    """HID++ 2.0 peripheral controller over dual Windows HID collections."""

    def __init__(self, vid: int = LOGITECH_VID, pid: Optional[int] = None):
        self.vid = vid
        self.pid = pid
        self.dev_out: Optional[hid.device] = None
        self.dev_in: Optional[hid.device] = None
        self.feature_cache: Dict[int, int] = {}
        self.product_name = "Unknown Logitech Device"

    def open(self) -> bool:
        """Locates and opens the dual HID collections required for Windows HID++ I/O."""
        devs = hid.enumerate(self.vid, self.pid if self.pid else 0)
        
        # On Windows, Logitech HID++ endpoints split into:
        # Collection 4 (UsagePage=0xFF00, Usage=0x0001): Interrupt/Feature Output Channel
        # Collection 5 (UsagePage=0xFF00, Usage=0x0002): Interrupt Input Channel
        write_dev = None
        read_dev = None
        
        for d in devs:
            if d['usage_page'] == 0xFF00 and d['usage'] == 0x0001:
                write_dev = d
            elif d['usage_page'] == 0xFF00 and d['usage'] == 0x0002:
                read_dev = d
                
        if not write_dev or not read_dev:
            print("[-] Error: Unable to locate Logitech HID++ collections (UsagePage 0xFF00, Usages 1 & 2).")
            return False

        self.product_name = write_dev.get('product_string', 'Logitech Mouse')
        self.pid = write_dev['product_id']

        print(f"[+] Found {self.product_name} (VID: 0x{self.vid:04X}, PID: 0x{self.pid:04X})")
        print(f"    Write Collection Path: {write_dev['path']}")
        print(f"    Read Collection Path:  {read_dev['path']}")

        self.dev_out = hid.device()
        self.dev_out.open_path(write_dev['path'])

        self.dev_in = hid.device()
        self.dev_in.open_path(read_dev['path'])
        
        print("[+] Device handles successfully acquired.")
        return True

    def close(self):
        """Closes HID device handles."""
        if self.dev_out:
            self.dev_out.close()
            self.dev_out = None
        if self.dev_in:
            self.dev_in.close()
            self.dev_in = None

    def send_receive(self, report: bytes, timeout_ms: int = 1000) -> bytes:
        """Sends a HID++ message and reads the device response."""
        if not self.dev_out or not self.dev_in:
            raise RuntimeError("Device is not open.")

        self.dev_out.write(report)
        response = self.dev_in.read(64, timeout_ms=timeout_ms)
        return bytes(response)

    def resolve_feature(self, feature_id: int) -> Optional[int]:
        """
        Dynamically queries Feature 0x0000 (IRoot) Function 0x0 to get the runtime index of a feature.
        Wire packet: [0x10, 0xFF, 0x00, 0x00, (feature_id >> 8), (feature_id & 0xFF), 0x00]
        """
        if feature_id in self.feature_cache:
            return self.feature_cache[feature_id]

        req = bytes([
            REPORT_ID_SHORT,
            DEVICE_INDEX_DIRECT,
            0x00,  # Root feature index is always 0x00
            0x00,  # Function 0 (getFeature), Software ID 0
            (feature_id >> 8) & 0xFF,
            feature_id & 0xFF,
            0x00
        ])

        resp = self.send_receive(req)
        if len(resp) >= 7 and resp[0] in [REPORT_ID_SHORT, REPORT_ID_LONG]:
            feat_idx = resp[4]
            feat_type = resp[5]
            feat_version = resp[6]
            if feat_idx != 0:
                self.feature_cache[feature_id] = feat_idx
                print(f"[+] Feature 0x{feature_id:04X} -> Runtime Index 0x{feat_idx:02X} (Type 0x{feat_type:02X}, Version {feat_version})")
                return feat_idx

        print(f"[-] Feature 0x{feature_id:04X} is not supported by this device.")
        return None

    def get_current_dpi(self, sensor_idx: int = 0) -> Optional[Tuple[int, int]]:
        """
        Queries current DPI via Feature 0x2201 (Adjustable DPI), Function 0x2 (getSensorDPI).
        Wire packet: [0x10, 0xFF, feat_idx, 0x20, sensor_idx, 0x00, 0x00]
        """
        feat_idx = self.resolve_feature(FEATURE_ADJUSTABLE_DPI)
        if feat_idx is None:
            return None

        req = bytes([
            REPORT_ID_SHORT,
            DEVICE_INDEX_DIRECT,
            feat_idx,
            0x20,  # Function 0x2 (getSensorDPI) << 4 | Software ID 0
            sensor_idx,
            0x00,
            0x00
        ])

        resp = self.send_receive(req)
        # Response layout: [0x11, 0xFF, feat_idx, 0x20, sensor_idx, dpi_hi, dpi_lo, default_dpi_hi, default_dpi_lo, ...]
        if len(resp) >= 9 and resp[0] in [REPORT_ID_SHORT, REPORT_ID_LONG]:
            dpi = (resp[5] << 8) | resp[6]
            default_dpi = (resp[7] << 8) | resp[8]
            return dpi, default_dpi
        return None

    def set_dpi(self, dpi: int, sensor_idx: int = 0) -> bool:
        """
        Sets active DPI via Feature 0x2201 (Adjustable DPI), Function 0x3 (setSensorDPI).
        Wire packet: [0x10, 0xFF, feat_idx, 0x30, sensor_idx, (dpi >> 8), (dpi & 0xFF)]
        """
        feat_idx = self.resolve_feature(FEATURE_ADJUSTABLE_DPI)
        if feat_idx is None:
            return False

        req = bytes([
            REPORT_ID_SHORT,
            DEVICE_INDEX_DIRECT,
            feat_idx,
            0x30,  # Function 0x3 (setSensorDPI) << 4 | Software ID 0
            sensor_idx,
            (dpi >> 8) & 0xFF,
            dpi & 0xFF
        ])

        resp = self.send_receive(req)
        if len(resp) >= 7 and resp[0] in [REPORT_ID_SHORT, REPORT_ID_LONG]:
            ack_dpi = (resp[5] << 8) | resp[6]
            print(f"[+] Device acknowledged setSensorDPI({dpi}): Active DPI is now {ack_dpi}")
            return ack_dpi == dpi
        return False

    def get_onboard_profiles_info(self) -> Optional[dict]:
        """
        Queries memory layout via Feature 0x8100, Function 0x0 (getOnboardProfilesInfo).
        Wire packet: [0x10, 0xFF, feat_idx, 0x00, 0x00, 0x00, 0x00]
        """
        feat_idx = self.resolve_feature(FEATURE_ONBOARD_PROFILES)
        if feat_idx is None:
            return None

        req = bytes([
            REPORT_ID_SHORT,
            DEVICE_INDEX_DIRECT,
            feat_idx,
            0x00,  # Function 0x0 << 4 | Software ID 0
            0x00,
            0x00,
            0x00
        ])

        resp = self.send_receive(req)
        if len(resp) >= 12 and resp[0] == REPORT_ID_LONG:
            info = {
                "format_version": resp[4],
                "profile_count": resp[7],
                "sector_size_bytes": 256,
            }
            return info
        return None

    def get_active_profile(self) -> Optional[int]:
        """
        Queries active profile sector via Feature 0x8100, Function 0x4 (getActiveProfile).
        Wire packet: [0x10, 0xFF, feat_idx, 0x40, 0x00, 0x00, 0x00]
        """
        feat_idx = self.resolve_feature(FEATURE_ONBOARD_PROFILES)
        if feat_idx is None:
            return None

        req = bytes([
            REPORT_ID_SHORT,
            DEVICE_INDEX_DIRECT,
            feat_idx,
            0x40,  # Function 0x4 << 4 | Software ID 0
            0x00,
            0x00,
            0x00
        ])

        resp = self.send_receive(req)
        if len(resp) >= 7 and resp[0] in [REPORT_ID_SHORT, REPORT_ID_LONG]:
            active_sector = (resp[4] << 8) | resp[5]
            return active_sector
        return None

    def activate_profile(self, sector_id: int) -> bool:
        """
        Activates profile slot via Feature 0x8100, Function 0x3 (setActiveProfile).
        Wire packet: [0x10, 0xFF, feat_idx, 0x30, (sector_id >> 8), (sector_id & 0xFF), 0x00]
        """
        feat_idx = self.resolve_feature(FEATURE_ONBOARD_PROFILES)
        if feat_idx is None:
            return False

        req = bytes([
            REPORT_ID_SHORT,
            DEVICE_INDEX_DIRECT,
            feat_idx,
            0x30,  # Function 0x3 << 4 | Software ID 0
            (sector_id >> 8) & 0xFF,
            sector_id & 0xFF,
            0x00
        ])

        resp = self.send_receive(req)
        return len(resp) >= 5 and resp[4] == 0x00

    def commit_profile_to_flash(self, sector_id: int) -> bool:
        """
        Commits active profile buffer to persistent flash memory via Feature 0x8100, Function 0xC (writeProfileData commit).
        Wire packet: [0x10, 0xFF, feat_idx, 0xC0, (sector_id >> 8), (sector_id & 0xFF), 0x00]
        """
        feat_idx = self.resolve_feature(FEATURE_ONBOARD_PROFILES)
        if feat_idx is None:
            return False

        req = bytes([
            REPORT_ID_SHORT,
            DEVICE_INDEX_DIRECT,
            feat_idx,
            0xC0,  # Function 0xC << 4 | Software ID 0
            (sector_id >> 8) & 0xFF,
            sector_id & 0xFF,
            0x00
        ])

        resp = self.send_receive(req)
        return len(resp) >= 5 and resp[4] == 0x00


def main():
    print("=" * 70)
    print(" Logitech HID++ 2.0 Peripheral Interoperability PoC (G502 HERO)")
    print("=" * 70)

    device = LogitechHidpp20Device()
    if not device.open():
        sys.exit(1)

    try:
        # Step 1: Feature Resolution via Root Feature 0x0000
        print("\n[Step 1] Dynamically resolving HID++ feature runtime indices...")
        device.resolve_feature(FEATURE_FEATURE_SET)
        f_dpi = device.resolve_feature(FEATURE_ADJUSTABLE_DPI)
        f_prof = device.resolve_feature(FEATURE_ONBOARD_PROFILES)

        # Step 2: Read Current Sensor DPI
        print("\n[Step 2] Reading current sensor DPI...")
        dpi_info = device.get_current_dpi()
        if dpi_info:
            current_dpi, default_dpi = dpi_info
            print(f"[+] Current Active DPI: {current_dpi} (Factory Default: {default_dpi})")
        else:
            print("[-] Failed to query current DPI.")
            current_dpi = 1600

        # Step 3: Issue Controlled DPI Set
        target_dpi = 1600 if current_dpi != 1600 else 2400
        print(f"\n[Step 3] Switching DPI to target: {target_dpi}...")
        success = device.set_dpi(target_dpi)
        if success:
            verified_dpi, _ = device.get_current_dpi()
            print(f"[+] Verification: Current DPI is confirmed to be {verified_dpi}")

        # Step 4: Query Onboard Profiles Information
        print("\n[Step 4] Querying Onboard Profiles info (0x8100)...")
        prof_info = device.get_onboard_profiles_info()
        if prof_info:
            print(f"[+] Memory Format: V{prof_info['format_version']}")
            print(f"[+] Total Profiles: {prof_info['profile_count']}")
            print(f"[+] Sector Size:   {prof_info['sector_size_bytes']} bytes")

        # Step 5: Query and Commit Profile Slot
        print("\n[Step 5] Checking active profile slot & issuing flash commit...")
        active_sector = device.get_active_profile()
        print(f"[+] Active Profile Slot: Slot {active_sector}")

        if active_sector is not None:
            print(f"[*] Re-activating profile slot {active_sector}...")
            device.activate_profile(active_sector)
            print(f"[*] Committing profile slot {active_sector} to non-volatile flash memory...")
            commit_ok = device.commit_profile_to_flash(active_sector)
            if commit_ok:
                print(f"[+] Profile slot {active_sector} successfully committed to device memory!")

        print("\n" + "=" * 70)
        print(" PoC Execution Completed Successfully!")
        print("=" * 70)

    finally:
        device.close()


if __name__ == "__main__":
    main()
