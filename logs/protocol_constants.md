# Logitech HID++ 2.0 Protocol Constants & Architecture Reference

## 1. Overview
This reference documents the protocol constants, feature IDs, function dispatch IDs, message layouts, and OS API entry points extracted from Logitech Onboard Memory Manager 2.7.4428 (`logi_nethidppio.dll` and decompiled C# models).

---

## 2. Windows HID API & Low-Level Transport Binding

In `logi_nethidppio.dll` (64-bit native/managed mixed-mode assembly), communication with Logitech HID devices is implemented via direct Windows HID and Win32 file I/O APIs:

| API Name | Library | IAT RVA | File Offset | Description |
|---|---|---|---|---|
| `HidD_GetFeature` | `HID.DLL` | `0x1AA050` | `0x1A8250` | Synchronous retrieval of HID feature reports |
| `HidD_SetFeature` | `HID.DLL` | `0x1AA058` | `0x1A8258` | Synchronous issuance of HID feature reports |
| `HidP_GetCaps` | `HID.DLL` | `0x1AA020` | `0x1A8220` | Query device capability and report lengths |
| `CreateFileA` | `KERNEL32.DLL` | `0x1AA0B8` | `0x1A82B8` | Open device handle (read/write access) |
| `ReadFile` | `KERNEL32.DLL` | `0x1AA0C0` | `0x1A82C0` | Asynchronous/Overlapped read of HID reports |
| `WriteFile` | `KERNEL32.DLL` | `0x1AA0C8` | `0x1A82C8` | Asynchronous/Overlapped write of HID output reports |

Message structures in memory use `logi.hidppio.message` ([message.cs](file:///c:/Users/java/temp/rev_omm/logs/dotnet_dump/logi_nethidppio/logi.hidppio/message.cs), 80 bytes) containing a `std::vector<unsigned char>` payload at offset `+24` and string identifier at offset `+48`.

---

## 3. Wire Report Format (HID++ 2.0 Message Layouts)

Logitech HID++ 2.0 uses structured message frames over USB Interrupt / Feature endpoints:

### Short Report (7 Bytes)
| Byte Offset | Field Name | Description |
|---|---|---|
| `Byte 0` | Report ID | `0x10` (Short HID++ message) |
| `Byte 1` | Device Index | `0xFF` (Direct/Corded USB) or `0x01`..`0x06` (Wireless Receiver Slot) |
| `Byte 2` | Feature Index | Runtime index resolved via Root feature (`0x0000`) |
| `Byte 3` | Function & Software ID | `(Function_ID << 4) \| (Software_ID & 0x0F)` |
| `Bytes 4..6` | Parameters | 3-byte payload parameters |

### Long Report (20 Bytes)
| Byte Offset | Field Name | Description |
|---|---|---|
| `Byte 0` | Report ID | `0x11` (Long HID++ message) |
| `Byte 1` | Device Index | `0xFF` (Direct/Corded USB) or `0x01`..`0x06` (Wireless Receiver Slot) |
| `Byte 2` | Feature Index | Runtime index resolved via Root feature (`0x0000`) |
| `Byte 3` | Function & Software ID | `(Function_ID << 4) \| (Software_ID & 0x0F)` |
| `Bytes 4..19` | Parameters | 16-byte payload parameters |

### Very Long Report (64 Bytes)
| Byte Offset | Field Name | Description |
|---|---|---|
| `Byte 0` | Report ID | `0x12` (Very Long HID++ message, used on modern high-speed peripherals) |
| `Byte 1` | Device Index | `0xFF` or receiver slot `0x01`..`0x06` |
| `Byte 2` | Feature Index | Runtime index |
| `Byte 3` | Function & Software ID | `(Function_ID << 4) \| (Software_ID & 0x0F)` |
| `Bytes 4..63` | Parameters | 60-byte payload parameters |

---

## 4. Feature IDs and Function Dispatch Table

Extracted from [FeatureBase-logi.cs](file:///c:/Users/java/temp/rev_omm/logs/dotnet_dump/logi_nethidppio/logi.hidppio/FeatureBase-logi.cs) and [-Module-.cs](file:///c:/Users/java/temp/rev_omm/logs/dotnet_dump/logi_nethidppio/-Module-.cs):

### Feature `0x0000`: IRoot (Feature Discovery)
- **Feature ID**: `0x0000` (Line 12 of `FeatureBase-logi.cs`)
- **Native Implementation**: Line 68508 in `-Module-.cs`
- **Functions**:
  - `0x0`: `getFeature(featureId)`:
    - Input: `[0x10, dev_idx, 0x00, 0x00, feat_hi, feat_lo, 0x00]`
    - Response: `[0x10, dev_idx, 0x00, 0x00, feature_index, feature_type, feature_version]`
    - Note: If `feature_index == 0x00`, the feature is unsupported.

### Feature `0x2201`: Adjustable DPI (Legacy / Multi-Sensor)
- **Feature ID**: `0x2201` (8705 decimal, Line 1388 of `FeatureBase-logi.cs`)
- **Native Implementation**: Lines 68781–68793 in `-Module-.cs`
- **Functions**:
  - `0x0`: `getSensorCount()`: Returns total sensors supported.
  - `0x1`: `getSensorDpiList(sensor_idx)`: Returns list of supported DPI steps.
  - `0x2`: `getSensorDPI(sensor_idx)`: Returns current DPI value (`DPIResolution`).
  - `0x3`: `setSensorDPI(sensor_idx, dpi, dpi_level)`: Sets current active sensor DPI.

### Feature `0x2202`: Sensor DPI Parameters & Ranges
- **Feature ID**: `0x2202` (8706 decimal, Line 1541 of `FeatureBase-logi.cs`)
- **Native Implementation**: Lines 68849–68865 in `-Module-.cs`
- **Functions**:
  - `0x0`: `getSensorCount()`
  - `0x1`: `getSensorCapabilities(sensor_idx)`
  - `0x2`: `getSensorDpiRanges(sensor_idx, direction)`
  - `0x3`: `getSensorDpiParameters(sensor_idx)`
  - `0x4`: `setSensorDpiParameters(sensor_idx, dpi_x, dpi_y, ...)`

### Feature `0x8061`: Report Rate (Polling Frequency)
- **Feature ID**: `0x8061` (32865 decimal, Line 1847 of `FeatureBase-logi.cs`)
- **Native Implementation**: Lines 68881–68885 in `-Module-.cs`
- **Functions**:
  - `0x0`: `getDeviceCapabilities(connection)`: Query supported report rates.
  - `0x1`: `getActualReportRateList()`: Query actual active report rate.
  - **Rate Encoding**:
    - `0x08`: 125 Hz (8 ms interval)
    - `0x04`: 250 Hz (4 ms interval)
    - `0x02`: 500 Hz (2 ms interval)
    - `0x01`: 1000 Hz (1 ms interval)
    - Extended rates (2000, 4000, 8000 Hz on newer G-Series HERO sensors) map via `ReportRateExtended`.

### Feature `0x8070`: Color LED Effects (RGB Lighting)
- **Feature ID**: `0x8070` (32880 decimal, Line 2000 of `FeatureBase-logi.cs`)
- **Native Implementation**: Lines 69037–69101 in `-Module-.cs`
- **Functions**:
  - `0x0`: `getInfo()`: Total zones, LED capabilities.
  - `0x1`: `getZoneInfo(zone_idx)`: Zone configuration and supported effects.
  - `0x2`: `getZoneEffectInfo(zone_idx, effect_idx)`: Effect parameters descriptor.
  - `0x3`: `setZoneEffect(zone_idx, effect_idx, data, persistence)`: Apply lighting effect (Off, Fixed, Breathing, Color Cycle).
  - `0x4`: `getNVConfig(capability)`: Read non-volatile lighting configuration.
  - `0x5`: `setNVConfig(data)`: Write non-volatile lighting configuration.
  - `0x6`: `getLEDBinning(zone_idx, bin_idx)`
  - `0x7`: `getSWControl()`: Host software RGB control mode status.
  - `0x8`: `setSWControl(data)`: Enable/disable host control override.
  - `0x9`: `getEffectSettings(zone_idx, ...)`
  - `0xA`: `clearEffectSettings(zone_idx)`
  - `0xB`: `setCyclingDirection(direction)`
  - `0xC`: `getCurrentColor(zone_idx)`
  - `0xD`: `synchronizeEffect(zone_idx, drift)`
  - `0xE`: `getZoneEffect(zone_idx)`
  - `0xF`: `setLEDBinInfo(data)`

### Feature `0x8100`: Onboard Profiles Directory & Mode Control
- **Feature ID**: `0x8100` (33024 decimal, Line 2612 of `FeatureBase-logi.cs`)
- **Native Implementation**: Lines 69402–69450 in `-Module-.cs`
- **Functions**:
  - `0x0`: `getOnboardProfilesInfo()`: Query memory layout, profile count, sector size, format version.
  - `0x1`: `setOnboardMode(mode)`: Set device operating mode (`1` = Onboard Memory Mode, `2` = Host/Software Mode).
  - `0x2`: `getOnboardMode()`: Query operating mode (`ONBOARD_MODE`).
  - `0x3`: `setActiveProfile(profile_sector)`: Activate onboard profile slot.
  - `0x4`: `getActiveProfile()`: Returns active profile sector index.
  - `0x5`: `executeMacro(sector, address)`: Trigger macro execution from onboard memory.
  - `0x6`: `getActiveProfileResolution()`: Query active DPI level index for current profile.
  - `0x7`: `setActiveProfileResolution(index)`: Switch active DPI step within active profile.
  - `0x8`: `readProfileDirectory()`: Read profile metadata directory entries across slots.
  - `0x9`: `writeProfileDirectory(entries)`: Write profile metadata directory.
  - `0xA`: `getProfileMemoryManager()`
  - `0xB`: `readProfileData(sector)`: Read raw profile data block from flash memory sector.
  - `0xC`: `writeProfileData(sector, data)`: Write raw profile data block to flash memory sector.

### Feature `0x8110`: Onboard Memory Access / Button Spy & Remapping
- **Feature ID**: `0x8110` (33040 decimal, Line 2765 of `FeatureBase-logi.cs`)
- **Class**: [Feature8110.cs](file:///c:/Users/java/temp/rev_omm/logs/dotnet_dump/logi_nethidppio/logi.hidppio/Feature8110.cs)
- **Functions**:
  - `0x0`: `getNumberOfButtons()`: Returns total physical button count.
  - `0x1`: `startSpy()`: Begin monitoring raw button events from firmware.
  - `0x2`: `stopSpy()`: Terminate button monitoring.
  - `0x3`: `getRemapping()`: Read current button logical-to-physical index mapping array (16 entries).
  - `0x4`: `setRemapping(list)`: Write 16-entry button remapping array.
