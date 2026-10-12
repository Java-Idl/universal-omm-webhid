/**
 * Universal Logitech HID++ 2.0 / 4.x WebHID Driver Engine
 * Reverse-engineered from Logitech Onboard Memory Manager (OMM 2.7.4428)
 * 
 * Implements:
 * - Dynamic Feature Resolution (0x0000 IRoot)
 * - Multi-Endpoint Windows WebHID routing (Short 0x10 / Long 0x11 / Read Collections)
 * - Lightspeed Wireless Receiver Multiplexing (Unit IDs 0xFF and 0x01..0x06)
 * - Multi-Stage DPI Sensor Management (0x2201, 0x2202)
 * - Polling Frequency / Report Rate (0x8061)
 * - Battery & Wireless Power Telemetry (0x1004, 0x1000)
 * - LIGHTSYNC RGB Effects & Non-Volatile Persistence (0x8070, 0x8071)
 * - Physical Button Remapping & Wire Spy (0x8110, 0x8100)
 * - Onboard Profiles & EEPROM Flash Commit (0x8100)
 * - Sensor Tuning (Angle Snapping, Performance Mode, Sleep Timeouts)
 */

export const HIDPP_FEATURES = {
    ROOT: 0x0000,
    FEATURE_SET: 0x0001,
    DEVICE_INFO: 0x0003,
    DEVICE_NAME: 0x0005,
    BATTERY_STATUS: 0x1000,
    BATTERY_PERCENT: 0x1001,
    UNIFIED_BATTERY: 0x1004,
    WIRELESS_STATUS: 0x1B0C,
    SPECIAL_KEYS: 0x1B04,
    HIRES_WHEEL: 0x2121,
    ADJUSTABLE_DPI: 0x2201,
    DPI_SENSOR: 0x2202,
    ANGLE_SNAPPING: 0x2240,
    REPORT_RATE: 0x8061,
    COLOR_LED: 0x8070,
    RGB_CLUSTER: 0x8071,
    ZONE_LIGHTING: 0x8081,
    ONBOARD_PROFILES: 0x8100,
    BUTTON_SPY: 0x8110
};

export const FEATURE_NAMES = {
    0x0000: 'IRoot (Discovery)',
    0x0001: 'IFeatureSet',
    0x0003: 'IDeviceInfo',
    0x0005: 'DeviceName',
    0x1000: 'BatteryLevelStatus',
    0x1001: 'BatteryChargeInfo',
    0x1004: 'UnifiedBattery',
    0x1B04: 'SpecialKeysButtons',
    0x1B0C: 'WirelessStatus',
    0x2121: 'HiResWheel',
    0x2201: 'AdjustableDPI',
    0x2202: 'SensorDPIParams',
    0x2240: 'AngleSnapping',
    0x8061: 'ReportRate',
    0x8070: 'ColorLED_RGB',
    0x8071: 'RGBCluster_v2',
    0x8081: 'PerKeyZoneLighting',
    0x8100: 'OnboardProfiles',
    0x8110: 'ButtonSpyRemap'
};

// OMM Remapping Action Types & Constants
export const BUTTON_BEHAVIOR = {
    EXECUTE_MACRO: 0x00,
    STOP_MACRO: 0x10,
    STOP_ALL_MACROS: 0x20,
    REMAPPING: 0x80,
    FUNCTION_EXECUTION: 0x90,
    DISABLED: 0xFF
};

export const REMAPPING_OPCODES = {
    NOT_SENT: 0x00,
    MOUSE_BUTTON: 0x01,
    KEYBOARD_KEY: 0x02,
    CONSUMER_KEY: 0x03
};

export const FUNCTION_OPCODES = {
    NO_ACTION: 0x00,
    TILT_LEFT: 0x01,
    TILT_RIGHT: 0x02,
    SELECT_NEXT_DPI: 0x03,
    SELECT_PREV_DPI: 0x04,
    CYCLE_DPIS: 0x05,
    DEFAULT_DPI: 0x06,
    DPI_SHIFT: 0x07, // Sniper Button
    SELECT_NEXT_PROFILE: 0x08,
    SELECT_PREV_PROFILE: 0x09,
    CYCLE_PROFILES: 0x0A,
    G_SHIFT: 0x0B,
    BATTERY_INDICATOR: 0x0C,
    ENABLE_SPECIFIC_PROFILE: 0x0D,
    TOGGLE_PERFORMANCE_MODE: 0x0E,
    HOST_BUTTON: 0x0F,
    SCROLL_DOWN: 0x10,
    SCROLL_UP: 0x11
};

export const MOUSE_BUTTON_BITS = {
    PRIMARY: 0x01,    // Left Click
    SECONDARY: 0x02,  // Right Click
    MIDDLE: 0x04,     // Middle Click
    BACK: 0x08,       // Button 4
    FORWARDS: 0x10    // Button 5
};

export const CONSUMER_KEYS = {
    PLAY_PAUSE: 205,
    PREVIOUS_TRACK: 181,
    NEXT_TRACK: 182,
    MUTE: 226,
    VOLUME_UP: 233,
    VOLUME_DOWN: 234
};

export const MODIFIERS = {
    CTRL: 0x01,
    SHIFT: 0x02,
    ALT: 0x04,
    GUI: 0x08 // Windows / Cmd Key
};

// Standard Physical Button Definitions (OMM mouse model)
export const PHYSICAL_BUTTONS = [
    { id: 1, name: 'Button 1 (Left Click)', defaultAction: { behavior: 0x80, type: 'mouse', value: 1, label: 'Primary Click' } },
    { id: 2, name: 'Button 2 (Right Click)', defaultAction: { behavior: 0x80, type: 'mouse', value: 2, label: 'Secondary Click' } },
    { id: 3, name: 'Button 3 (Middle Click)', defaultAction: { behavior: 0x80, type: 'mouse', value: 4, label: 'Middle Click' } },
    { id: 4, name: 'Button 4 (Back)', defaultAction: { behavior: 0x80, type: 'mouse', value: 8, label: 'Back' } },
    { id: 5, name: 'Button 5 (Forward)', defaultAction: { behavior: 0x80, type: 'mouse', value: 16, label: 'Forward' } },
    { id: 6, name: 'Button 6 (DPI Shift / Sniper)', defaultAction: { behavior: 0x90, type: 'func', value: 7, label: 'DPI Shift (Sniper)' } },
    { id: 7, name: 'Button 7 (DPI Down)', defaultAction: { behavior: 0x90, type: 'func', value: 4, label: 'DPI Down' } },
    { id: 8, name: 'Button 8 (DPI Up)', defaultAction: { behavior: 0x90, type: 'func', value: 3, label: 'DPI Up' } },
    { id: 9, name: 'Button 9 (Profile Switch)', defaultAction: { behavior: 0x90, type: 'func', value: 10, label: 'Cycle Profiles' } },
    { id: 10, name: 'Button 10 (Wheel Tilt Left)', defaultAction: { behavior: 0x90, type: 'func', value: 1, label: 'Tilt Left' } },
    { id: 11, name: 'Button 11 (Wheel Tilt Right)', defaultAction: { behavior: 0x90, type: 'func', value: 2, label: 'Tilt Right' } }
];

export class HidppDevice {
    constructor() {
        this.writeDevice = null;
        this.readDevice = null;
        this.isConnected = false;
        this.deviceIndex = 0xFF; // Default 0xFF (Direct Corded USB) or 0x01..0x06 (Wireless Lightspeed Dongle)
        this.deviceInfo = {
            name: 'Disconnected',
            vid: 0,
            pid: 0,
            serial: '',
            protocolVersion: 'HID++ 2.0 / 4.2',
            transport: 'USB Corded'
        };
        this.featureIndexMap = new Map(); // Feature ID -> Runtime Index
        this.indexFeatureMap = new Map(); // Runtime Index -> Feature ID
        this.pendingRequests = new Map(); // Key `${featIdx}_${fnId}_${swId}` -> { resolve, reject, timer }
        this.swCounter = 0x01;
        this.packetListeners = [];
        this.buttonEventListeners = [];
        this.batteryListeners = [];
    }

    onPacket(listener) {
        this.packetListeners.push(listener);
    }

    onButtonEvent(listener) {
        this.buttonEventListeners.push(listener);
    }

    onBatteryUpdate(listener) {
        this.batteryListeners.push(listener);
    }

    emitPacket(direction, reportId, devIdx, featIdx, fnId, swId, rawBytes, meta = '') {
        const featName = this.indexFeatureMap.get(featIdx) 
            ? `${FEATURE_NAMES[this.indexFeatureMap.get(featIdx)] || 'Feature'} (0x${featIdx.toString(16).padStart(2, '0')})`
            : (featIdx === 0 ? 'IRoot (0x00)' : `Feat 0x${featIdx.toString(16).padStart(2, '0')}`);

        const packetObj = {
            timestamp: new Date().toLocaleTimeString() + '.' + String(new Date().getMilliseconds()).padStart(3, '0'),
            direction,
            reportId: `0x${reportId.toString(16).padStart(2, '0')}`,
            devIdx: `0x${devIdx.toString(16).padStart(2, '0')}`,
            featIdx: `0x${featIdx.toString(16).padStart(2, '0')}`,
            featName,
            fnId: `0x${fnId.toString(16)}`,
            swId: `0x${swId.toString(16)}`,
            rawHex: Array.from(rawBytes).map(b => b.toString(16).padStart(2, '0')).join(' '),
            meta
        };

        for (const cb of this.packetListeners) {
            try { cb(packetObj); } catch (e) { console.error(e); }
        }
    }

    /**
     * Request device via WebHID and setup both collections
     */
    async requestAndOpen() {
        if (!navigator.hid) {
            throw new Error('WebHID API is not supported in this browser. Please use Chrome, Edge, Brave, or Opera over localhost or HTTPS.');
        }

        // Request Logitech peripherals with vendorId 0x046D
        const requested = await navigator.hid.requestDevice({
            filters: [{ vendorId: 0x046D }]
        });

        if (!requested || requested.length === 0) {
            throw new Error('No Logitech device selected.');
        }

        // Query all granted devices from navigator.hid.getDevices() to bind both collections!
        const allGranted = await navigator.hid.getDevices();
        const logiDevices = allGranted.filter(d => d.vendorId === 0x046D);
        const deviceList = logiDevices.length > 0 ? logiDevices : requested;

        return await this.setupDevices(deviceList);
    }

    async setupDevices(deviceList) {
        let writeCandidate = null;
        let readCandidate = null;

        for (const dev of deviceList) {
            if (!dev.opened) {
                await dev.open();
            }

            for (const col of dev.collections) {
                if (col.usagePage === 0xFF00) {
                    if (col.usage === 0x0001) {
                        writeCandidate = dev;
                    } else if (col.usage === 0x0002) {
                        readCandidate = dev;
                    }
                }
            }
        }

        // Fallback for single collection devices
        if (!writeCandidate && deviceList.length > 0) writeCandidate = deviceList[0];
        if (!readCandidate && deviceList.length > 0) readCandidate = deviceList[0];

        this.writeDevice = writeCandidate;
        this.readDevice = readCandidate;

        this.deviceInfo = {
            name: writeCandidate.productName || 'Logitech Gaming Peripheral',
            vid: writeCandidate.vendorId,
            pid: writeCandidate.productId,
            serial: writeCandidate.serialNumber || 'N/A',
            protocolVersion: 'HID++ 2.0 / 4.2',
            transport: writeCandidate.productName?.toLowerCase().includes('receiver') ? 'Lightspeed Wireless 2.4GHz' : 'USB Direct'
        };

        // Determine device unit index: Corded USB (0xFF) vs Lightspeed Wireless Dongle (0x01)
        if (this.deviceInfo.transport.includes('Wireless')) {
            this.deviceIndex = 0x01; // First paired slot on Lightspeed receiver
        } else {
            this.deviceIndex = 0xFF; // Direct USB
        }

        // Attach input report handler on readDevice
        this.readDevice.addEventListener('inputreport', (event) => {
            this.handleInputReport(event);
        });

        this.isConnected = true;

        // Perform initial feature enumeration
        await this.discoverFeatures();

        // Query Device Name if supported
        try {
            const queriedName = await this.queryDeviceName();
            if (queriedName) this.deviceInfo.name = queriedName;
        } catch (e) {}

        return this.deviceInfo;
    }

    handleInputReport(event) {
        const { reportId, data } = event;
        const u8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

        const fullBytes = new Uint8Array(u8.length + 1);
        fullBytes[0] = reportId;
        fullBytes.set(u8, 1);

        if (u8.length < 3) return;

        const devIdx = u8[0];
        const featIdx = u8[1];
        const fnSw = u8[2];
        const fnId = (fnSw >> 4) & 0x0F;
        const swId = fnSw & 0x0F;

        // Check for asynchronous notifications (swId === 0 or button event)
        const featureId = this.indexFeatureMap.get(featIdx);

        // Feature 0x8110 (Button Spy Broadcasts)
        if (featureId === HIDPP_FEATURES.BUTTON_SPY) {
            const rawStatus = (u8[4] << 8) | u8[3];
            for (const cb of this.buttonEventListeners) {
                try { cb({ rawStatus, data: Array.from(u8) }); } catch (e) {}
            }
        }

        // Feature 0x1004 / 0x1000 (Battery Broadcasts)
        if (featureId === HIDPP_FEATURES.UNIFIED_BATTERY || featureId === HIDPP_FEATURES.BATTERY_STATUS) {
            this.parseAndEmitBattery(u8);
        }

        const reqKey = `${featIdx}_${fnId}_${swId}`;
        const wildcardKey = `${featIdx}_${fnId}`;

        this.emitPacket('RX', reportId, devIdx, featIdx, fnId, swId, fullBytes, 'Device Response');

        if (this.pendingRequests.has(reqKey)) {
            const req = this.pendingRequests.get(reqKey);
            clearTimeout(req.timer);
            this.pendingRequests.delete(reqKey);
            req.resolve(fullBytes);
        } else if (this.pendingRequests.has(wildcardKey)) {
            const req = this.pendingRequests.get(wildcardKey);
            clearTimeout(req.timer);
            this.pendingRequests.delete(wildcardKey);
            req.resolve(fullBytes);
        }
    }

    getNextSwId() {
        this.swCounter = (this.swCounter + 1) & 0x0F;
        if (this.swCounter === 0) this.swCounter = 1;
        return this.swCounter;
    }

    async sendCommand(featIdx, fnId, payload = [], isLong = false, timeoutMs = 850) {
        if (!this.isConnected || !this.writeDevice) {
            throw new Error('Device not connected.');
        }

        const swId = this.getNextSwId();
        const reportId = isLong ? 0x11 : 0x10;
        const totalPayloadLen = isLong ? 19 : 6;

        const data = new Uint8Array(totalPayloadLen);
        data[0] = this.deviceIndex; // 0xFF or receiver unit index 0x01
        data[1] = featIdx;
        data[2] = ((fnId & 0x0F) << 4) | (swId & 0x0F);

        for (let i = 0; i < payload.length && (i + 3) < totalPayloadLen; i++) {
            data[3 + i] = payload[i];
        }

        const fullSendBytes = new Uint8Array(data.length + 1);
        fullSendBytes[0] = reportId;
        fullSendBytes.set(data, 1);

        const reqKey = `${featIdx}_${fnId}_${swId}`;

        return new Promise(async (resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(reqKey);
                reject(new Error(`Timeout waiting for Feat=0x${featIdx.toString(16).padStart(2,'0')} Fn=0x${fnId.toString(16)} (sw=${swId})`));
            }, timeoutMs);

            this.pendingRequests.set(reqKey, { resolve, reject, timer });

            try {
                this.emitPacket('TX', reportId, this.deviceIndex, featIdx, fnId, swId, fullSendBytes, 'Host Command');
                // sendReport routes short reports (0x10) to write collection and long reports (0x11) to read collection
                const targetDev = (isLong && this.readDevice) ? this.readDevice : (this.writeDevice || this.readDevice);
                await targetDev.sendReport(reportId, data);
            } catch (err) {
                clearTimeout(timer);
                this.pendingRequests.delete(reqKey);
                reject(err);
            }
        });
    }

    async queryFeature(featureId) {
        const featHi = (featureId >> 8) & 0xFF;
        const featLo = featureId & 0xFF;
        const res = await this.sendCommand(0x00, 0x00, [featHi, featLo, 0x00]);

        if (res && res.length >= 7) {
            const runtimeIdx = res[4];
            const featType = res[5];
            const featVer = res[6];
            if (runtimeIdx !== 0) {
                this.featureIndexMap.set(featureId, runtimeIdx);
                this.indexFeatureMap.set(runtimeIdx, featureId);
                return { runtimeIdx, featType, featVer };
            }
        }
        return null;
    }

    async discoverFeatures() {
        const featuresToProbe = [
            HIDPP_FEATURES.FEATURE_SET,
            HIDPP_FEATURES.DEVICE_INFO,
            HIDPP_FEATURES.DEVICE_NAME,
            HIDPP_FEATURES.UNIFIED_BATTERY,
            HIDPP_FEATURES.BATTERY_STATUS,
            HIDPP_FEATURES.BATTERY_PERCENT,
            HIDPP_FEATURES.ADJUSTABLE_DPI,
            HIDPP_FEATURES.DPI_SENSOR,
            HIDPP_FEATURES.ANGLE_SNAPPING,
            HIDPP_FEATURES.REPORT_RATE,
            HIDPP_FEATURES.COLOR_LED,
            HIDPP_FEATURES.RGB_CLUSTER,
            HIDPP_FEATURES.ONBOARD_PROFILES,
            HIDPP_FEATURES.BUTTON_SPY,
            HIDPP_FEATURES.SPECIAL_KEYS
        ];

        for (const featId of featuresToProbe) {
            try {
                await this.queryFeature(featId);
            } catch (e) {
                // Not supported on this specific hardware model, silently continue
            }
        }
    }

    /* -------------------------------------------------------------
     * Device Information & Naming (0x0003, 0x0005)
     * ------------------------------------------------------------- */
    async queryDeviceName() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.DEVICE_NAME);
        if (!featIdx) return null;

        // Function 0x0: getNameCount
        const countRes = await this.sendCommand(featIdx, 0x00, [0x00, 0x00, 0x00]);
        const nameLength = countRes[4] || 0;
        if (nameLength === 0) return null;

        let nameStr = '';
        for (let i = 0; i < nameLength; i += 16) {
            // Function 0x1: getDeviceNameChunk
            const chunkRes = await this.sendCommand(featIdx, 0x01, [i, 0x00, 0x00], true);
            if (chunkRes && chunkRes.length >= 5) {
                const chars = Array.from(chunkRes.slice(4)).filter(c => c > 0 && c < 128);
                nameStr += String.fromCharCode(...chars);
            }
        }
        return nameStr.trim();
    }

    /* -------------------------------------------------------------
     * Battery & Power Telemetry (0x1004, 0x1000)
     * ------------------------------------------------------------- */
    async getBatteryStatus() {
        // Try 0x1004 Unified Battery first
        const feat1004 = this.featureIndexMap.get(HIDPP_FEATURES.UNIFIED_BATTERY);
        if (feat1004) {
            // Function 0x1: getStatus
            const res = await this.sendCommand(feat1004, 0x01, [0x00, 0x00, 0x00]);
            if (res.length >= 7) {
                const percent = res[4];
                const level = res[5]; // 1=critical, 2=low, 4=good, 8=full
                const chargingStatus = res[6]; // 0=discharging, 1=charging, 2=slow, 3=complete, 5=wireless
                const isCharging = chargingStatus === 1 || chargingStatus === 2 || chargingStatus === 5;
                const isWirelessPowerPlay = chargingStatus === 5;
                return { percent, level, chargingStatus, isCharging, isWirelessPowerPlay, isSupported: true };
            }
        }

        // Try 0x1000 Battery Level Status
        const feat1000 = this.featureIndexMap.get(HIDPP_FEATURES.BATTERY_STATUS);
        if (feat1000) {
            // Function 0x1: getBatteryLevelStatus
            const res = await this.sendCommand(feat1000, 0x01, [0x00, 0x00, 0x00]);
            if (res.length >= 7) {
                const percent = res[4];
                const status = res[6];
                const isCharging = status === 1 || status === 2;
                return { percent, level: 4, chargingStatus: status, isCharging, isWirelessPowerPlay: false, isSupported: true };
            }
        }

        return { isSupported: false, percent: 100, isCharging: false };
    }

    parseAndEmitBattery(u8) {
        const percent = u8[3] !== undefined ? u8[3] : 100;
        const charging = u8[5] === 1 || u8[5] === 5;
        for (const cb of this.batteryListeners) {
            try { cb({ percent, isCharging: charging }); } catch (e) {}
        }
    }

    /* -------------------------------------------------------------
     * Multi-Stage DPI Sensor Management (0x2201, 0x2202)
     * ------------------------------------------------------------- */
    async getDpi() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ADJUSTABLE_DPI);
        if (!featIdx) throw new Error('Adjustable DPI feature (0x2201) not supported on this device.');

        // Function 0x2: getSensorDPI
        const res = await this.sendCommand(featIdx, 0x02, [0x00, 0x00, 0x00]);
        if (res.length >= 7) {
            const sensor = res[4];
            const dpi = (res[5] << 8) | res[6];
            const defaultDpi = res.length >= 9 ? (res[7] << 8) | res[8] : 1000;
            return { sensor, dpi, defaultDpi };
        }
        throw new Error('Invalid DPI response received.');
    }

    async setDpi(dpi, sensor = 0) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ADJUSTABLE_DPI);
        if (!featIdx) throw new Error('Adjustable DPI feature not supported on this device.');

        const dpiHi = (dpi >> 8) & 0xFF;
        const dpiLo = dpi & 0xFF;

        // Function 0x3: setSensorDPI
        const res = await this.sendCommand(featIdx, 0x03, [sensor, dpiHi, dpiLo]);
        if (res.length >= 7) {
            const confirmedDpi = (res[5] << 8) | res[6];
            return confirmedDpi;
        }
        return dpi;
    }

    /* -------------------------------------------------------------
     * Report Rate / Polling Frequency (0x8061)
     * ------------------------------------------------------------- */
    async setReportRate(rateHz) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.REPORT_RATE);
        if (!featIdx) throw new Error('Report Rate feature (0x8061) not supported.');

        // Bitmasks: 1000Hz = 0x01, 500Hz = 0x02, 250Hz = 0x04, 125Hz = 0x08
        const rateMap = { 1000: 0x01, 500: 0x02, 250: 0x04, 125: 0x08 };
        const mask = rateMap[rateHz] || 0x01;
        await this.sendCommand(featIdx, 0x01, [mask, 0x00, 0x00]);
        return true;
    }

    /* -------------------------------------------------------------
     * LIGHTSYNC RGB Lighting (0x8070, 0x8071)
     * ------------------------------------------------------------- */
    async setLightingEffect(zone, effectMode, r, g, b) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.COLOR_LED);
        if (!featIdx) throw new Error('Color LED feature (0x8070) not supported on this device.');

        // Enable Software Control (Function 0x08)
        try {
            await this.sendCommand(featIdx, 0x08, [0x01, 0x00, 0x00]);
        } catch (e) {}

        // Long Report (0x11): Function 0x03 setZoneEffect
        // payload: [zone, effectMode, R, G, B, color_anim(0x02), 6x zeros, persistence(0x01=NV Flash), 3x zeros]
        const payload = [
            zone & 0xFF,
            effectMode & 0xFF,
            r & 0xFF,
            g & 0xFF,
            b & 0xFF,
            0x02, // Immediate solid color application
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x01, // 0x01 = Persist to EEPROM/Flash across power cycles
            0x00, 0x00, 0x00
        ];
        return await this.sendCommand(featIdx, 0x03, payload, true);
    }

    /* -------------------------------------------------------------
     * Physical Button Remapping & Wire Spy (0x8110)
     * ------------------------------------------------------------- */
    async startButtonSpy() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.BUTTON_SPY);
        if (!featIdx) return false;
        // Function 0x1: startSpy
        try {
            await this.sendCommand(featIdx, 0x01, [0x00, 0x00, 0x00]);
            return true;
        } catch (e) {
            return false;
        }
    }

    async stopButtonSpy() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.BUTTON_SPY);
        if (!featIdx) return;
        try {
            await this.sendCommand(featIdx, 0x02, [0x00, 0x00, 0x00]);
        } catch (e) {}
    }

    async getButtonRemappings() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.BUTTON_SPY);
        if (!featIdx) return null;
        // Function 0x3: getRemapping (returns 16 entries)
        try {
            const res = await this.sendCommand(featIdx, 0x03, [0x00, 0x00, 0x00], true);
            if (res && res.length >= 20) {
                return Array.from(res.slice(4, 20));
            }
        } catch (e) {}
        return null;
    }

    async setButtonRemappings(mappingArray16) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.BUTTON_SPY);
        if (!featIdx) throw new Error('Button remapping feature (0x8110) not available.');

        if (mappingArray16.length !== 16) {
            throw new Error('Remapping array must contain exactly 16 button mappings.');
        }

        // Function 0x4: setRemapping (Long report 0x11 with 16 byte indices)
        return await this.sendCommand(featIdx, 0x04, mappingArray16, true);
    }

    /* -------------------------------------------------------------
     * Onboard Profiles & EEPROM Flash Commit (0x8100)
     * ------------------------------------------------------------- */
    async getOnboardProfilesInfo() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) throw new Error('Onboard profiles feature (0x8100) not available on this device.');

        // Function 0x0: getOnboardProfilesInfo
        const res = await this.sendCommand(featIdx, 0x00, [0x00, 0x00, 0x00]);
        if (res.length >= 10) {
            return {
                formatVersion: res[4],
                profileCount: res[7] || 5,
                sectorSize: 256
            };
        }
        return { formatVersion: 1, profileCount: 5, sectorSize: 256 };
    }

    async getOnboardMode() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) return 1; // Default to Onboard mode
        // Function 0x2: getOnboardMode (1 = Onboard, 2 = Host/Software)
        try {
            const res = await this.sendCommand(featIdx, 0x02, [0x00, 0x00, 0x00]);
            return res[4] || 1;
        } catch (e) {
            return 1;
        }
    }

    async setOnboardMode(mode) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) return;
        // Function 0x1: setOnboardMode (1 = Onboard Memory, 2 = Host)
        await this.sendCommand(featIdx, 0x01, [mode & 0xFF, 0x00, 0x00]);
    }

    async getActiveProfile() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) return 1;

        // Function 0x4: getActiveProfile
        const res = await this.sendCommand(featIdx, 0x04, [0x00, 0x00, 0x00]);
        if (res.length >= 6) {
            return (res[4] << 8) | res[5];
        }
        return 1;
    }

    async setActiveProfile(sectorId) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) throw new Error('Onboard profiles feature not available.');

        // Function 0x3: setActiveProfile
        const secHi = (sectorId >> 8) & 0xFF;
        const secLo = sectorId & 0xFF;
        const res = await this.sendCommand(featIdx, 0x03, [secHi, secLo, 0x00]);
        return res[4] === 0x00;
    }

    async commitProfileToFlash(sectorId) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) throw new Error('Onboard profiles feature not available.');

        // Function 0xC: writeProfileData sector commit
        const secHi = (sectorId >> 8) & 0xFF;
        const secLo = sectorId & 0xFF;
        const res = await this.sendCommand(featIdx, 0x0C, [secHi, secLo, 0x00]);
        return res[4] === 0x00;
    }

    /* -------------------------------------------------------------
     * Sensor Tuning & Angle Snapping (0x2240)
     * ------------------------------------------------------------- */
    async setAngleSnapping(enabled) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ANGLE_SNAPPING);
        if (featIdx) {
            // Function 0x1: setAngleSnapping (0x01 = On, 0x00 = Off)
            await this.sendCommand(featIdx, 0x01, [enabled ? 0x01 : 0x00, 0x00, 0x00]);
            return true;
        }
        return false;
    }

    async disconnect() {
        await this.stopButtonSpy();
        if (this.writeDevice) {
            try { await this.writeDevice.close(); } catch (e) {}
            this.writeDevice = null;
        }
        if (this.readDevice) {
            try { await this.readDevice.close(); } catch (e) {}
            this.readDevice = null;
        }
        this.isConnected = false;
        this.featureIndexMap.clear();
        this.indexFeatureMap.clear();
        this.pendingRequests.clear();
    }
}
