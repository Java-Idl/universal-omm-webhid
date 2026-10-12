/**
 * Universal Logitech HID++ 2.0 / 4.x WebHID Driver Engine
 * Reverse-engineered from Logitech Onboard Memory Manager (OMM 2.7.4428)
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

export const CONSUMER_KEYS = {
    PLAY_PAUSE: 0x00CD,
    NEXT_TRACK: 0x00B5,
    PREV_TRACK: 0x00B6,
    STOP: 0x00B7,
    MUTE: 0x00E2,
    VOLUME_UP: 0x00E9,
    VOLUME_DOWN: 0x00EA
};

export class HidppDevice {
    constructor() {
        this.writeDevice = null;
        this.readDevice = null;
        this.isConnected = false;
        this.deviceIndex = 0xFF; // 0xFF for wired USB, 0x01..0x06 for Lightspeed dongle
        this.deviceInfo = {
            name: 'Disconnected',
            vid: 0,
            pid: 0,
            serial: '',
            protocolVersion: 'HID++ 2.0 / 4.2',
            transport: 'USB Direct',
            isWired: true
        };
        this.featureIndexMap = new Map(); // Feature ID -> Runtime Index
        this.indexFeatureMap = new Map(); // Runtime Index -> Feature ID
        this.pendingRequests = new Map();
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

    async requestAndOpen() {
        if (!navigator.hid) {
            throw new Error('WebHID API is not supported in this browser. Please use Chrome, Edge, Brave, or Opera over localhost or HTTPS.');
        }

        const requested = await navigator.hid.requestDevice({
            filters: [{ vendorId: 0x046D }]
        });

        if (!requested || requested.length === 0) {
            throw new Error('No Logitech device selected.');
        }

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

        if (!writeCandidate && deviceList.length > 0) writeCandidate = deviceList[0];
        if (!readCandidate && deviceList.length > 0) readCandidate = deviceList[0];

        this.writeDevice = writeCandidate;
        this.readDevice = readCandidate;

        const isReceiver = writeCandidate.productName?.toLowerCase().includes('receiver');

        this.deviceInfo = {
            name: writeCandidate.productName || 'Logitech Gaming Peripheral',
            vid: writeCandidate.vendorId,
            pid: writeCandidate.productId,
            serial: writeCandidate.serialNumber || 'N/A',
            protocolVersion: 'HID++ 2.0 / 4.2',
            transport: isReceiver ? 'Lightspeed Wireless 2.4GHz' : 'USB Direct',
            isWired: !isReceiver
        };

        this.deviceIndex = isReceiver ? 0x01 : 0xFF;

        const uniqueDevices = new Set([this.writeDevice, this.readDevice].filter(Boolean));
        for (const dev of uniqueDevices) {
            dev.addEventListener('inputreport', (event) => {
                this.handleInputReport(event);
            });
        }

        this.isConnected = true;

        await this.discoverFeatures();

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
        data[0] = this.deviceIndex;
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
                reject(new Error(`Timeout waiting for Feat=0x${featIdx.toString(16).padStart(2,'0')} Fn=0x${fnId.toString(16)}`));
            }, timeoutMs);

            this.pendingRequests.set(reqKey, { resolve, reject, timer });

            try {
                this.emitPacket('TX', reportId, this.deviceIndex, featIdx, fnId, swId, fullSendBytes, 'Host Command');
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
            HIDPP_FEATURES.ADJUSTABLE_DPI,
            HIDPP_FEATURES.DPI_SENSOR,
            HIDPP_FEATURES.ANGLE_SNAPPING,
            HIDPP_FEATURES.REPORT_RATE,
            HIDPP_FEATURES.COLOR_LED,
            HIDPP_FEATURES.RGB_CLUSTER,
            HIDPP_FEATURES.ONBOARD_PROFILES,
            HIDPP_FEATURES.BUTTON_SPY
        ];

        for (const featId of featuresToProbe) {
            try {
                await this.queryFeature(featId);
            } catch (e) {}
        }
    }

    async queryDeviceName() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.DEVICE_NAME);
        if (!featIdx) return null;

        const countRes = await this.sendCommand(featIdx, 0x00, [0x00, 0x00, 0x00]);
        const nameLength = countRes[4] || 0;
        if (nameLength === 0) return null;

        let nameStr = '';
        for (let i = 0; i < nameLength; i += 16) {
            const chunkRes = await this.sendCommand(featIdx, 0x01, [i, 0x00, 0x00], true);
            if (chunkRes && chunkRes.length >= 5) {
                const chars = Array.from(chunkRes.slice(4)).filter(c => c > 0 && c < 128);
                nameStr += String.fromCharCode(...chars);
            }
        }
        return nameStr.trim();
    }

    /* -------------------------------------------------------------
     * Battery Telemetry (0x1004, 0x1000)
     * ------------------------------------------------------------- */
    async getBatteryStatus() {
        const feat1004 = this.featureIndexMap.get(HIDPP_FEATURES.UNIFIED_BATTERY);
        if (feat1004) {
            const res = await this.sendCommand(feat1004, 0x01, [0x00, 0x00, 0x00]);
            if (res.length >= 7) {
                const percent = res[4];
                const level = res[5];
                const chargingStatus = res[6];
                const isCharging = chargingStatus === 1 || chargingStatus === 2 || chargingStatus === 5;
                const isWirelessPowerPlay = chargingStatus === 5;
                return { percent, level, chargingStatus, isCharging, isWirelessPowerPlay, isSupported: true };
            }
        }

        const feat1000 = this.featureIndexMap.get(HIDPP_FEATURES.BATTERY_STATUS);
        if (feat1000) {
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
            try { cb({ percent, isCharging: charging, isSupported: true }); } catch (e) {}
        }
    }

    /* -------------------------------------------------------------
     * DPI & Report Rate
     * ------------------------------------------------------------- */
    async getDpi() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ADJUSTABLE_DPI);
        if (!featIdx) throw new Error('Adjustable DPI feature (0x2201) not available.');

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
        if (!featIdx) throw new Error('Adjustable DPI feature not available.');

        const dpiHi = (dpi >> 8) & 0xFF;
        const dpiLo = dpi & 0xFF;

        const res = await this.sendCommand(featIdx, 0x03, [sensor, dpiHi, dpiLo]);
        if (res.length >= 7) {
            return (res[5] << 8) | res[6];
        }
        return dpi;
    }

    async setReportRate(rateHz) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.REPORT_RATE);
        if (featIdx) {
            const rateMap = { 1000: 0x01, 500: 0x02, 250: 0x04, 125: 0x08 };
            const mask = rateMap[rateHz] || 0x01;
            await this.sendCommand(featIdx, 0x01, [mask, 0x00, 0x00]);
            return true;
        }
        return false;
    }

    /* -------------------------------------------------------------
     * LIGHTSYNC RGB Studio (0x8070)
     * Handles Static (1), Breathing (2), Color Cycle (3), Off (0)
     * ------------------------------------------------------------- */
    async setLightingEffect(zone, effectMode, r, g, b, periodMs = 3000, intensity = 100) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.COLOR_LED);
        if (!featIdx) throw new Error('Color LED feature (0x8070) not available.');

        const periodHi = (periodMs >> 8) & 0xFF;
        const periodLo = periodMs & 0xFF;
        const brightness = Math.min(100, Math.max(0, intensity));

        let payload;

        if (effectMode === 3) {
            // COLOR CYCLING:
            // Layout: [zone, 0x03, 0, 0, 0, 0, 0, periodHi, periodLo, brightness, 0, 0, persistence(1), 0, 0, 0]
            payload = [
                zone & 0xFF,
                0x03,
                0x00, 0x00, 0x00, 0x00, 0x00,
                periodHi, periodLo,
                brightness,
                0x00, 0x00,
                0x01, // Persistence = 1 (Non-volatile Flash)
                0x00, 0x00, 0x00
            ];
        } else if (effectMode === 2) {
            // BREATHING (PULSING):
            // Layout: [zone, 0x02, R, G, B, periodHi, periodLo, 0, brightness, 0, 0, 0, persistence(1), 0, 0, 0]
            payload = [
                zone & 0xFF,
                0x02,
                r & 0xFF, g & 0xFF, b & 0xFF,
                periodHi, periodLo,
                0x00,
                brightness,
                0x00, 0x00, 0x00,
                0x01, // Persistence = 1
                0x00, 0x00, 0x00
            ];
        } else if (effectMode === 0) {
            // OFF:
            payload = [
                zone & 0xFF,
                0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x01,
                0x00, 0x00, 0x00
            ];
        } else {
            // STATIC / FIXED COLOR (1):
            // Layout: [zone, 0x01, R, G, B, 0x02 (NO_EFFECT), 0, 0, 0, 0, 0, 0, persistence(1), 0, 0, 0]
            payload = [
                zone & 0xFF,
                0x01,
                r & 0xFF, g & 0xFF, b & 0xFF,
                0x02,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x01,
                0x00, 0x00, 0x00
            ];
        }

        return await this.sendCommand(featIdx, 0x03, payload, true);
    }

    /**
     * Flash mouse LEDs to visually identify the hardware
     */
    async flashIdentify() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.COLOR_LED);
        if (!featIdx) return;

        // Flash rapid bright white / cyan pulses
        for (let i = 0; i < 3; i++) {
            await this.setLightingEffect(0, 1, 255, 255, 255);
            await new Promise(r => setTimeout(r, 120));
            await this.setLightingEffect(0, 1, 0, 229, 255);
            await new Promise(r => setTimeout(r, 120));
        }
    }

    /* -------------------------------------------------------------
     * Button Remapping & Spy (0x8110)
     * ------------------------------------------------------------- */
    async startButtonSpy() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.BUTTON_SPY);
        if (!featIdx) return false;
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

        return await this.sendCommand(featIdx, 0x04, mappingArray16, true);
    }

    /* -------------------------------------------------------------
     * Onboard Profiles (0x8100)
     * ------------------------------------------------------------- */
    async getOnboardMode() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) return 1;
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
        await this.sendCommand(featIdx, 0x01, [mode & 0xFF, 0x00, 0x00]);
    }

    async getActiveProfile() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) return 1;
        const res = await this.sendCommand(featIdx, 0x04, [0x00, 0x00, 0x00]);
        if (res.length >= 6) {
            return (res[4] << 8) | res[5];
        }
        return 1;
    }

    async setActiveProfile(sectorId) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) throw new Error('Onboard profiles feature not available.');
        const secHi = (sectorId >> 8) & 0xFF;
        const secLo = sectorId & 0xFF;
        const res = await this.sendCommand(featIdx, 0x03, [secHi, secLo, 0x00]);
        return res[4] === 0x00;
    }

    async commitProfileToFlash(sectorId) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) throw new Error('Onboard profiles feature not available.');
        const secHi = (sectorId >> 8) & 0xFF;
        const secLo = sectorId & 0xFF;
        const res = await this.sendCommand(featIdx, 0x0C, [secHi, secLo, 0x00]);
        return res[4] === 0x00;
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
