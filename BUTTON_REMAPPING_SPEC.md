# Logitech HID++ 2.0 / 4.x Button Remapping & Macro Protocol Specification

## 1. Overview & Architecture

In Logitech gaming peripherals (G-Series mice and keyboards), button inputs and key remappings operate under two distinct execution layers:

1. **Host-Driven Wire Spy (`0x8110` ButtonSpyRemap)**:  
   Real-time monitoring of raw physical button switch closures and logical-to-physical remap index tables.
2. **Autonomous Onboard Memory Profiles (`0x8100` OnboardProfiles)**:  
   Non-volatile EEPROM/Flash storage of button bindings, keystroke sequences, modifier masks, and firmware function triggers. When Onboard Memory Mode (`0x01`) is active, the peripheral's internal microcontroller executes bindings directly with zero driver latency and zero host software dependencies.

This document details the exact wire packet structures, opcodes, memory layouts, and sequence diagrams reverse-engineered from Logitech Onboard Memory Manager 2.7.4428 (`OnboardMemoryManager_2.7.4428.exe`) and `logi_nethidppio.dll`.

---

## 2. Feature `0x8110`: Button Spy & Remapping Table

Feature `0x8110` provides live wire inspection and logical remap array control.

### 2.1 Function Dispatch Table

| Function ID | Function Name | Request Report | Payload Parameters | Response Report | Description |
|---|---|---|---|---|---|
| `0x0` | `getNumberOfButtons` | Short (`0x10`) | `[0x00, 0x00, 0x00]` | Short (`0x10`) | Returns total physical button switches (`Byte 4`). |
| `0x1` | `startSpy` | Short (`0x10`) | `[0x00, 0x00, 0x00]` | Short (`0x10`) | Begins reporting real-time button events over USB Interrupt IN. |
| `0x2` | `stopSpy` | Short (`0x10`) | `[0x00, 0x00, 0x00]` | Short (`0x10`) | Disables live button reporting. |
| `0x3` | `getRemapping` | Long (`0x11`) | `[0x00, 0x00, 0x00]` | Long (`0x11`) | Returns 16-byte logical assignment array for buttons 1–16. |
| `0x4` | `setRemapping` | Long (`0x11`) | 16-byte mapping array | Long (`0x11`) | Writes 16-byte logical assignment array to runtime RAM. |

---

### 2.2 Button Wire Spy Report (`0x8110` Interrupt Event)

When `startSpy` is issued, every physical button state transition sends an asynchronous Interrupt IN report:

```
Byte 0: Report ID (0x10 or 0x11)
Byte 1: Device Index (0xFF or Receiver Slot 0x01..0x06)
Byte 2: Feature Index (Runtime index for 0x8110, e.g., 0x0D on G502 HERO)
Byte 3: Software ID & Function (0x00)
Byte 4: Button State Low Byte (Buttons 1 to 8 bitmask)
Byte 5: Button State High Byte (Buttons 9 to 16 bitmask)
```

#### Button State Bitmask Mapping:
- `Bit 0` (`0x0001`): Button 1 (Primary / Left Click)
- `Bit 1` (`0x0002`): Button 2 (Secondary / Right Click)
- `Bit 2` (`0x0004`): Button 3 (Middle Click / Scroll Click)
- `Bit 3` (`0x0008`): Button 4 (Back)
- `Bit 4` (`0x0010`): Button 5 (Forward)
- `Bit 5` (`0x0020`): Button 6 (DPI Shift / Sniper)
- `Bit 6` (`0x0040`): Button 7 (DPI Down)
- `Bit 7` (`0x0080`): Button 8 (DPI Up)
- `Bit 8` (`0x0100`): Button 9 (Profile Cycle)
- `Bit 9` (`0x0200`): Button 10 (Wheel Tilt Left)
- `Bit 10` (`0x0400`): Button 11 (Wheel Tilt Right)

---

### 2.3 16-Byte Remapping Array Structure

When reading (`Fn 0x03`) or writing (`Fn 0x04`), the 16 bytes represent physical buttons `1` through `16`:

```
Byte Offset | Physical Button Target
------------+-----------------------
  Byte 0    | Physical Button 1 (Left)
  Byte 1    | Physical Button 2 (Right)
  Byte 2    | Physical Button 3 (Middle)
  Byte 3    | Physical Button 4 (Back)
  Byte 4    | Physical Button 5 (Forward)
  Byte 5    | Physical Button 6 (DPI Shift)
  Byte 6    | Physical Button 7 (DPI Down)
  Byte 7    | Physical Button 8 (DPI Up)
  Byte 8    | Physical Button 9 (Profile Cycle)
  Byte 9    | Physical Button 10 (Tilt Left)
  Byte 10   | Physical Button 11 (Tilt Right)
  Byte 11..15 | Extended Buttons 12–16 / Reserved
```

Each byte value defines the triggered logical action:
- `0x00`: Disabled (No action)
- `0x01` – `0x10`: Logical Button ID (e.g. `1` = Left Click, `2` = Right Click, `3` = Middle, `4` = Back, `5` = Forward, `6` = DPI Shift, `7` = DPI Down, `8` = DPI Up, `10` = Cycle Profiles)

---

## 3. Feature `0x8100`: Onboard Flash Memory Profile Format

In Onboard Memory Mode (`0x01`), bindings are read directly from EEPROM flash sectors. Each physical button entry is stored as a structured **4-byte Action Descriptor**:

```
+---------------+-------------------+-----------------------+----------------------+
| Byte 0        | Byte 1            | Byte 2                | Byte 3               |
| Behavior Code | Remap / Func Code | Modifier / Key / Param | Button / Ext Param   |
+---------------+-------------------+-----------------------+----------------------+
```

### 3.1 Button Behavior Codes (`Byte 0`)

Extracted from `logi.hidppio.Feature8100.BUTTON_BEHAVIOR`:

| Behavior Code (Hex) | Decimal | Enum Value | Description |
|---|---|---|---|
| `0x00` | `0` | `EXECUTE_MACRO` | Triggers a multi-step macro block stored in flash. |
| `0x10` | `16` | `STOP_MACRO` | Halts execution of the currently running macro. |
| `0x20` | `32` | `STOP_ALL_MACROS` | Halts all concurrent repeating macros. |
| `0x80` | `128` | `REMAPPING` | Standard key, mouse button, or consumer media binding. |
| `0x90` | `144` | `FUNCTION_EXECUTION`| Hardware internal firmware function (DPI, Profile, Tilt). |
| `0xFF` | `255` | `DISABLED` | Physical switch is disabled. |

---

### 3.2 Remapping Opcodes (`Byte 1` when `Behavior == 0x80`)

| Opcode | Enum Name | Description | Byte 2 Usage | Byte 3 Usage |
|---|---|---|---|---|
| `0x00` | `NOT_SENT` | Unassigned | `0x00` | `0x00` |
| `0x01` | `GENERIC_MOUSE_BUTTON` | Standard mouse click | Reserved (`0x00`) | Mouse bit: `1`=Left, `2`=Right, `4`=Middle, `8`=Back, `16`=Fwd |
| `0x02` | `MAPPED_TO_STANDARD_KEY`| Keyboard key + modifiers | Modifier bitmask (`Ctrl`, `Shift`, etc.) | USB HID Keyboard Scan Code (A–Z, 0–9, F1–F12, etc.) |
| `0x03` | `MAPPED_TO_CONSUMER_KEY`| Media / Consumer key | Consumer Key High Byte | Consumer Key Low Byte (e.g., `205` = Play/Pause) |

#### Keyboard Modifier Bitmask (`Byte 2` for Opcode `0x02`):
- `0x01`: Left Ctrl
- `0x02`: Left Shift
- `0x04`: Left Alt
- `0x08`: Left GUI / Windows Key
- `0x10`: Right Ctrl
- `0x20`: Right Shift
- `0x40`: Right Alt
- `0x80`: Right GUI

#### Consumer / Media Key Codes (`Byte 2 & 3` for Opcode `0x03`):
- `181` (`0x00B5`): Previous Track
- `182` (`0x00B6`): Next Track
- `205` (`0x00CD`): Play / Pause
- `226` (`0x00E2`): Mute Audio
- `233` (`0x00E9`): Volume Up
- `234` (`0x00EA`): Volume Down

---

### 3.3 Function Execution Opcodes (`Byte 1` when `Behavior == 0x90`)

Extracted from `logi.hidppio.Feature8100.FUNCTION_OPCODES`:

| Opcode | Enum Identifier | Effect |
|---|---|---|
| `0x00` | `NO_ACTION` | No action executed. |
| `0x01` | `TILT_LEFT` | Wheel horizontal scroll left. |
| `0x02` | `TILT_RIGHT` | Wheel horizontal scroll right. |
| `0x03` | `SELECT_NEXT_DPI` | Increment active DPI stage. |
| `0x04` | `SELECT_PREVIOUS_DPI` | Decrement active DPI stage. |
| `0x05` | `CYCLE_DPIS` | Cycle sequentially through configured DPI stages. |
| `0x06` | `DEFAULT_DPI` | Instant revert to designated Default DPI stage. |
| `0x07` | `DPI_SHIFT` | Momentary Sniper DPI (active only while switch is held down). |
| `0x08` | `SELECT_NEXT_PROFILE` | Switch to next enabled profile slot. |
| `0x09` | `SELECT_PREVIOUS_PROFILE`| Switch to previous enabled profile slot. |
| `0x0A` | `CYCLE_PROFILES` | Cycle sequentially through available onboard profiles. |
| `0x0B` | `G_SHIFT` | Activates secondary shift layer while held down. |
| `0x0C` | `BATTERY_LIFE_INDICATOR`| Triggers DPI LED cluster to show remaining charge. |
| `0x0D` | `ENABLED_PROFILE_SPECIFIC`| Switch directly to profile index in `Byte 3`. |
| `0x0E` | `TOGGLE_PERFORMANCE_MODE`| Toggle between Performance and Endurance power modes. |
| `0x10` | `SCROLL_DOWN` | Emulate wheel scroll down. |
| `0x11` | `SCROLL_UP` | Emulate wheel scroll up. |

---

## 4. Reverse-Engineered Packet Traces from OMM

Captured during an active session with Logitech G502 HERO (`VID 0x046D, PID 0xC08B`):

### 4.1 Profile Button Sector Chunk Write
OMM writes 16-byte blocks to the profile sector via Long Report (`0x11`) using Feature Index `0x0C` (Runtime Index for `0x8100` OnboardProfiles):

```hex
TX 11 FF 0C 7F 80 01 00 01 80 01 00 02 80 01 00 04 80 01 00 08
RX 11 FF 0C 7F 00 03 00 00 00 00 00 00 00 00 00 00 00 00 00 00
```
#### Breakdown:
- `80 01 00 01`: Button 1 -> Remap (`0x80`), Mouse (`0x01`), Left Click (`0x01`)
- `80 01 00 02`: Button 2 -> Remap (`0x80`), Mouse (`0x01`), Right Click (`0x02`)
- `80 01 00 04`: Button 3 -> Remap (`0x80`), Mouse (`0x01`), Middle Click (`0x04`)
- `80 01 00 08`: Button 4 -> Remap (`0x80`), Mouse (`0x01`), Back Click (`0x08`)

```hex
TX 11 FF 0C 7F 80 01 00 10 80 02 08 07 90 04 FF FF 90 07 FF FF
RX 11 FF 0C 7F 00 04 00 00 00 00 00 00 00 00 00 00 00 00 00 00
```
#### Breakdown:
- `80 01 00 10`: Button 5 -> Forward Click (`0x10`)
- `80 02 08 07`: Button 6 -> Keyboard Key (`0x02`), Mod = Win (`0x08`), ScanCode `0x07` ('D' key = Win+D show desktop)
- `90 04 FF FF`: Button 7 -> Function (`0x90`), Opcode `0x04` (`SELECT_PREVIOUS_DPI`)
- `90 07 FF FF`: Button 8 -> Function (`0x90`), Opcode `0x07` (`DPI_SHIFT` / Sniper)

```hex
TX 11 FF 0C 7F 90 0A FF FF 90 02 FF FF 90 01 FF FF FF FF FF FF
RX 11 FF 0C 7F 00 05 00 00 00 00 00 00 00 00 00 00 00 00 00 00
```
#### Breakdown:
- `90 0A FF FF`: Button 9 -> Function (`0x90`), Opcode `0x0A` (`CYCLE_PROFILES`)
- `90 02 FF FF`: Button 10 -> Function (`0x90`), Opcode `0x02` (`TILT_RIGHT`)
- `90 01 FF FF`: Button 11 -> Function (`0x90`), Opcode `0x01` (`TILT_LEFT`)

---

## 5. Non-Volatile Flash Commit Sequence (`0x0C`)

To commit sector modifications so they survive power disconnection:

```
Step 1: Host dispatches Function 0x0C (writeProfileData Commit)
        TX 10 FF [featIdx] CF [sectorHi] [sectorLo] 00
Step 2: Device EEPROM write cycle completes (~25ms)
Step 3: Device acknowledges with Status = 0x00 (Success)
        RX 10 FF [featIdx] CF 00 00 00
```
After Step 3, the peripheral's internal firmware reloads the active profile directly from flash without host intervention.
