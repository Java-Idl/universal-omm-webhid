# Universal OMM (Onboard Memory Manager) — WebHID Edition

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Demo-brightgreen?logo=github)](https://java-idl.github.io/universal-omm-webhid/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Protocol](https://img.shields.io/badge/Protocol-Logitech%20HID%2B%2B%202.0%20%2F%204.2-cyan)](REPORT.md)
[![WebHID API](https://img.shields.io/badge/WebHID-Chromium%20Native-orange?logo=googlechrome)](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API)

> **Zero-install, browser-native peripheral management for Logitech G-series gaming mice.**  
> Configure DPI, polling rate, onboard memory profiles, and RGB lighting directly from your web browser using the native **WebHID API**.

---

## 🚀 Live Web App

Try the application live in any Chromium browser (Google Chrome, Microsoft Edge, Brave, Opera):

👉 **[https://java-idl.github.io/universal-omm-webhid/](https://java-idl.github.io/universal-omm-webhid/)**

*(No drivers, no background services, no Electron bloat, and no administrator privileges required.)*

---

## ⚡ Highlights & Capabilities

- 🖱️ **HERO Sensor & Adjustable DPI (`0x2201`)**:
  - Continuous stepped slider (100 – 25,600 DPI in 50 DPI steps).
  - High-precision logarithmic circular neon gauge.
  - Quick gaming presets: `400`, `800`, `1200`, `1600`, `2400`, `3200`, `6400`, `16000` DPI.
- ⚡ **Report Rate / Polling Frequency (`0x8061`)**:
  - Switch dynamically between `125 Hz` (8ms), `250 Hz` (4ms), `500 Hz` (2ms), and `1000 Hz` (1ms).
- 💾 **Onboard Flash Memory Profiles (`0x8100`)**:
  - Inspect and switch between 5 physical EEPROM memory slots.
  - Non-volatile profile commits (Function `0x0C`) written directly to hardware flash.
- 🌈 **LIGHTSYNC RGB Studio (`0x8070`)**:
  - Configure Primary Logo (Zone 0) and DPI indicator LEDs (Zone 1).
  - Static, Breathing, and Color Cycle modes.
  - **Non-volatile flash persistence (`persistence = 0x01`)**: Lighting survives power loss, replugging, and reboots.
- 🔍 **Real-Time WebHID Bus Wire Sniffer**:
  - Live bi-directional packet telemetry (`TX` host commands & `RX` peripheral responses).
  - High-precision timestamps, resolved feature names, function dispatch IDs, and raw hex streams.
  - Controls: Pause stream, clear log, and export packet captures as structured JSON.
- 🧪 **Hardware Simulation Fallback**:
  - Integrated G502 HERO simulation mode allows full interface evaluation and protocol debugging even without physical hardware plugged in.

---

## 🔬 Protocol Architecture & Reverse-Engineering Findings

This application was engineered by reverse-analyzing Logitech's official **Onboard Memory Manager (`OnboardMemoryManager_2.7.4428.exe`)** and disassembling `logi_nethidppio.dll`.

For the complete technical wire framing specification, command offsets, and packet captures, see the [Comprehensive Protocol Report (REPORT.md)](REPORT.md).

### Key Architectural Discoveries:

1. **Zero Authentication / Shared Secrets**:
   - HID++ 2.0 has **no encryption, no shared keys, and no cryptographic authentication**. Communication is purely standard HID report frames dispatched to vendor endpoints.
2. **Dual-Endpoint Routing on Windows**:
   - On Windows, Logitech USB collections have strict report size allocations:
     - **Collection 4 (`UsagePage 0xFF00, Usage 0x0001`)**: Accepts **ONLY Short Reports** (`0x10`, 7 bytes — DPI, discovery, report rate). Writing a 20-byte Long Report (`0x11`) to Collection 4 fails at the OS level.
     - **Collection 5 (`UsagePage 0xFF00, Usage 0x0002`)**: Accepts **20-byte Long Reports** (`0x11` — RGB lighting and memory page chunks) AND streams asynchronous Interrupt IN responses.
   - The driver engine automatically correlates and routes packets across both endpoints.
3. **Software Control Lock (`SWControl` - Function `0x08`)**:
   - By default, peripherals operate in Firmware Mode (`sw_control = 0`) where onboard profile rules override live software commands.
   - To apply software lighting, the driver automatically issues Function `0x08` (`sw_control = 1`) before dispatching color payloads.
4. **Non-Volatile EEPROM Persistence**:
   - Byte 12 of the `SetZoneEffect` (Function `0x03`) payload designates persistence:
     - `0x00` = Volatile (SRAM only; lost on unplugging/power cycle).
     - `0x01` = Volatile + Non-Volatile (burned to EEPROM; survives unplugging and reboots).

---

## 📁 Repository Structure

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml          # Automated GitHub Pages CI/CD workflow
├── webhid-spa/                 # The WebHID Single Page Application (GitHub Pages root)
│   ├── index.html              # Modern gaming-themed HTML5 dashboard
│   ├── style.css               # Dark mode styling with glassmorphism & neon glows
│   ├── app.js                  # Frontend state controller & simulation engine
│   └── hidpp.js                # Core asynchronous WebHID HID++ 2.0 driver engine
├── poc/
│   └── omm_protocol_demo.py    # Python CLI protocol implementation
├── set_mouse_color.py          # Standalone Python CLI utility to set color & DPI
├── hooks/
│   └── hid_hook.js             # Frida hook script for intercepting HID I/O
├── REPORT.md                   # Full reverse-engineering specification & research report
├── LICENSE                     # MIT License
└── README.md                   # Project documentation
```

---

## 🛠️ Local Development

To run the SPA locally:

```bash
# 1. Clone the repository
git clone https://github.com/Java-Idl/universal-omm-webhid.git
cd universal-omm-webhid

# 2. Start a local HTTP server (WebHID requires http://localhost or HTTPS)
python -m http.server 8080 --directory webhid-spa

# 3. Open in a Chromium browser
# Navigate to: http://localhost:8080
```

### Python CLI Tools

You can also test the device directly via Python using the included scripts:

```bash
# Set mouse to Red (255, 0, 0) and 1600 DPI:
python set_mouse_color.py 255 0 0 1600

# Set mouse to Cyan (0, 229, 255) and 2400 DPI:
python set_mouse_color.py 0 229 255 2400

# Run full end-to-end verification PoC:
python poc/omm_protocol_demo.py
```

---

## 🔒 Security & Privacy

- **100% Client-Side**: All WebHID communication occurs entirely within your browser sandboxed environment.
- **Zero Telemetry**: No network requests, analytics, or external trackers are sent to any server.
- **Permission-Based**: Hardware access requires explicit user confirmation via the native browser WebHID permission dialog.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
Logitech and Logitech G are registered trademarks of Logitech Europe S.A. This project is an independent interoperability tool developed for hardware ownership rights and interoperability research.
