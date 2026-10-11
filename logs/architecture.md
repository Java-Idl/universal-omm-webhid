# Architecture Analysis: Logitech Onboard Memory Manager (OMM) 2.7.4428

## 1. Executive Summary
- **Binary**: `OnboardMemoryManager_2.7.4428.exe` (13,139,608 bytes)
- **Runtime**: **.NET Framework 4.x (CLR v4.0.30319)** with embedded assemblies and mixed-mode C++/CLI communication engine.
- **Packaging**: Single-file bundled executable containing WPF GUI and all runtime dependencies embedded as managed resources under `OnboardMemoryManager.embeddeddlls.*`.
- **Protocol Driver**: `logi_nethidppio.dll` (Logitech .NET HID++ I/O library), embedded and loaded via custom dynamic assembly loader (`OnboardMemoryManager.Helpers.AssemblyLoader`).
- **Decompilation Path**: Successfully decompiled into high-level C# source code via **ILSpy CLI (ilspycmd)** into `logs/dotnet_dump/` and `logs/dotnet_dump/logi_nethidppio/`. Disassembly in Ghidra/native is unnecessary for high-level protocol analysis, as full type definitions, feature classes, and HID++ wire packet logic are directly available in C#.

---

## 2. Binary Inspection & Runtime Determination

### PE Header & Section Layout
- **Target CPU**: x64 (AMD64)
- **Subsystem**: Windows GUI (Version 6.0)
- **Sections**:
  - `.text`: 12,756,480 bytes (contains IL code, embedded resource stream, native CRT/C++ bootstrap)
  - `.rsrc`: 372,224 bytes (contains application icons, version info, manifest)
- **Data Directories**:
  - `IMAGE_DIRECTORY_ENTRY_RESOURCE`: VA `0xC2E000`, Size `0x5ADC4`
  - `IMAGE_DIRECTORY_ENTRY_SECURITY`: VA `0xC85600`, Size `0x2898`
  - `IMAGE_DIRECTORY_ENTRY_COM_DESCRIPTOR`: VA `0x2000`, Size `0x48` (CLR Header)

### CLR (COR20) Metadata Header
- **Size (`cb`)**: 72 bytes (`0x48`)
- **Runtime Version**: 2.5
- **MetaData RVA**: `0x23B8C`, Size: `0x36F78`
- **Metadata Magic**: `BSJB`
- **CLR Version String**: `v4.0.30319` (.NET Framework 4.0+)
- **EntryPointToken**: `0x060000A6` (Method token)
- **Managed Resources Directory**: RVA `0x5AB04`, Size `0xBD1A30` (~12.39 MB)

### Verification Against Alternative Runtimes
- **Electron Inspection**: Executable scanned via 7-Zip (`7z l`). No Chromium runtime binaries, no `resources/app.asar`, no Node.js runtime bindings.
- **Native / Packed**: The binary is not packed with standard native protectors (UPX, Themida, VMProtect). It is an official single-file managed wrapper loading embedded DLLs via `AppDomain.CurrentDomain.AssemblyResolve`.

---

## 3. Internal Component & Packaging Architecture

### Custom Resource Assembly Loader
The application entry point registers an `AssemblyResolve` handler implemented in [AssemblyLoader.cs](file:///c:/Users/java/temp/rev_omm/logs/dotnet_dump/OnboardMemoryManager.Helpers/AssemblyLoader.cs):
- When referenced assemblies or localized resources are requested, the loader searches manifest resource streams matching `OnboardMemoryManager.embeddeddlls.{name}.dll`.
- Assemblies are loaded into memory via `Assembly.Load(byte[])` or written to a disk cache directory if native unmanaged dependencies are present.
- Specifically, for `logi_nethidppio.dll`, the loader extracts 49 native dependency DLLs (`ucrtbase.dll`, `vcruntime140.dll`, `msvcp140*.dll`, `api-ms-win-core-*.dll`) before loading the assembly.

### Assembly Hierarchy
1. **Host Executable (`OnboardMemoryManager.exe`)**:
   - UI Framework: Windows Presentation Foundation (WPF) with `MahApps.Metro` and `ControlzEx`.
   - Presentation & ViewModels: `OnboardMemoryManager.ViewModels`, `OnboardMemoryManager.Components` (DPI sliders, report rate pickers, color picker, button assignment matrices).
   - High-level Models:
     - [HIDMouse.cs](file:///c:/Users/java/temp/rev_omm/logs/dotnet_dump/OnboardMemoryManager.Models/HIDMouse.cs): Mouse-specific feature orchestration, DPI steps, report rates.
     - [HIDProfile.cs](file:///c:/Users/java/temp/rev_omm/logs/dotnet_dump/OnboardMemoryManager.Models/HIDProfile.cs): Memory profile parsing, macro structures, button mappings.
     - [DPI.cs](file:///c:/Users/java/temp/rev_omm/logs/dotnet_dump/OnboardMemoryManager.Models/DPI.cs): DPI sensitivity structures.
     - [DevicesController.cs](file:///c:/Users/java/temp/rev_omm/logs/dotnet_dump/OnboardMemoryManager.Controllers/DevicesController.cs): Hardware discovery, connection monitoring, profile synchronization.

2. **Core Protocol Engine (`logi_nethidppio.dll`)**:
   - Mixed-mode C++/CLI assembly providing direct interaction with the Windows HID subsystem.
   - Root namespaces:
     - `logi.hidppio`: Core device abstraction, message serialization, and HID++ 2.0 feature classes.
     - `logi.hidppio.types`: Low-level report descriptors, enums, byte buffers.
     - `logi.hidppio.onboard_profiles`: G-series onboard profile memory page layout and serialization.

---

## 4. HID++ 2.0 Features Identified in Decompiled Code

The protocol engine explicitly implements feature classes corresponding to standard and proprietary HID++ 2.0 / CentPP feature IDs:

| Feature Class | Target Feature ID | Description |
|---|---|---|
| `Feature0000` | `0x0000` | IRoot (Feature enumeration, protocol version) |
| `Feature0003` | `0x0003` | IDeviceInfo (Entity / device model info) |
| `Feature0005` | `0x0005` | Device Name & Type |
| `Feature1000` | `0x1000` | Battery Voltage / Status |
| `Feature1001` | `0x1001` | Battery Percentage |
| `Feature1004` | `0x1004` | Unified Battery Status |
| `Feature1B0C` | `0x1B0C` | Wireless Device Pairing / Connection Status |
| `Feature2121` | `0x2121` | Hi-Res Wheel / Scroll Configuration |
| `Feature2201` | `0x2201` | Adjustable DPI (legacy 16-bit / multi-sensor) |
| `Feature2202` | `0x2202` | Sensor DPI Resolution & Ranges |
| `Feature4540` | `0x4540` | Device Mode / Configuration |
| `Feature8061` | `0x8061` | Report Rate (Polling rate selection: 125/250/500/1000 Hz) |
| `Feature8070` | `0x8070` | Color LED Effects / RGB Zones |
| `Feature8071` | `0x8071` | RGB Lighting Cluster |
| `Feature8081` | `0x8081` | Per-Key / Zone Lighting Effects |
| `Feature8100` | `0x8100` | Onboard Profiles Directory & Mode Control |
| `Feature8110` | `0x8110` | Onboard Memory Access (Page Read/Write for G-Series Profiles) |

---

## 5. Next Steps for Phase 2
Proceed to Phase 2:
- Analyze decompiled classes in `logi.hidppio` and `OnboardMemoryManager.Models`.
- Extract exact byte structures, function indexes, request/response formats for features `0x0000`, `0x2201`, `0x2202`, `0x8060`/`0x8061`, `0x8070`, `0x8100`, and `0x8110`.
- Identify Windows HID API calls (`HidD_*`, `CreateFile`, `WriteFile`) inside `logi_nethidppio`.
