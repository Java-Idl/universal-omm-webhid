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
    REPORT_RATE_LEGACY: 0x8060,
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
    0x8060: 'ReportRateLegacy',
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
        // Only process asynchronous broadcasts (Fn 0x00 and Sw 0x00)
        // Command responses (such as getRemapping Fn 0x03) must not be processed as button presses!
        if (featureId === HIDPP_FEATURES.BUTTON_SPY && fnId === 0x00 && swId === 0x00) {
            const rawStatus = (u8[4] << 8) | u8[3];
            for (const cb of this.buttonEventListeners) {
                try { cb({ rawStatus, fnId, swId, data: Array.from(u8) }); } catch (e) {}
            }
        }

        // Feature 0x1004 / 0x1000 (Battery Broadcasts)
        if (featureId === HIDPP_FEATURES.UNIFIED_BATTERY || featureId === HIDPP_FEATURES.BATTERY_STATUS) {
            this.parseAndEmitBattery(u8);
        }

        // Check for HID++ 2.0 Error Packet: [devIdx, 0xFF, failedFeatIdx, failedFnSw, errorCode]
        if (featIdx === 0xFF && u8.length >= 5) {
            const errFeatIdx = u8[2];
            const errFnSw = u8[3];
            const errFnId = (errFnSw >> 4) & 0x0F;
            const errSwId = errFnSw & 0x0F;
            const errCode = u8[4];
            const errReqKey = `${errFeatIdx}_${errFnId}_${errSwId}`;
            const errWildcardKey = `${errFeatIdx}_${errFnId}`;

            this.emitPacket('RX', reportId, devIdx, errFeatIdx, errFnId, errSwId, fullBytes, `HID++ Error 0x${errCode.toString(16).padStart(2,'0')}`);

            const targetReq = this.pendingRequests.get(errReqKey) || this.pendingRequests.get(errWildcardKey);
            if (targetReq) {
                clearTimeout(targetReq.timer);
                this.pendingRequests.delete(errReqKey);
                this.pendingRequests.delete(errWildcardKey);
                const errNames = {
                    0x01: 'Unknown Error',
                    0x02: 'Invalid Argument',
                    0x03: 'Out of Range',
                    0x04: 'Invalid Command',
                    0x05: 'Busy / Locked',
                    0x09: 'Resource Error'
                };
                const msg = errNames[errCode] || `Code 0x${errCode.toString(16).padStart(2, '0')}`;
                targetReq.reject(new Error(`Hardware returned HID++ error: ${msg} on Feat=0x${errFeatIdx.toString(16)} Fn=0x${errFnId.toString(16)}`));
                return;
            }
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
                try {
                    await targetDev.sendReport(reportId, data);
                } catch (sendErr) {
                    if (targetDev !== this.writeDevice && this.writeDevice) {
                        await this.writeDevice.sendReport(reportId, data);
                    } else {
                        throw sendErr;
                    }
                }
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
            HIDPP_FEATURES.REPORT_RATE_LEGACY,
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

    async getFirmwareInfo(entity = 0) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.DEVICE_INFO);
        if (!featIdx) return null;
        try {
            const res = await this.sendCommand(featIdx, 0x01, [entity, 0x00, 0x00]);
            if (res && res.length >= 11) {
                const prefix = String.fromCharCode(...Array.from(res.slice(4, 7)).filter(b => b >= 32 && b <= 126));
                const fwVer = `${res[7].toString(16).padStart(2, '0')}.${res[8].toString(16).padStart(2, '0')}`;
                const fwBuild = `${res[9].toString(16).padStart(2, '0')}${res[10].toString(16).padStart(2, '0')}`;
                return `${prefix} ${fwVer} (Build ${fwBuild})`.trim();
            }
        } catch (e) {}
        return null;
    }

    async getReportRate() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.REPORT_RATE) || 
                        this.featureIndexMap.get(HIDPP_FEATURES.REPORT_RATE_LEGACY);
        if (!featIdx) return 1000;

        try {
            const res = await this.sendCommand(featIdx, 0x01, [0x00, 0x00, 0x00]);
            if (res && res.length >= 5) {
                const mask = res[4];
                const maskMap = { 0x01: 1000, 0x02: 500, 0x04: 250, 0x08: 125 };
                return maskMap[mask] || 1000;
            }
        } catch (e) {
            console.error('getReportRate error:', e);
        }
        return 1000;
    }

    async setReportRate(rateHz) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.REPORT_RATE) || 
                        this.featureIndexMap.get(HIDPP_FEATURES.REPORT_RATE_LEGACY);
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
    async getLightingInfo() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.COLOR_LED);
        if (!featIdx) return null;
        try {
            const res = await this.sendCommand(featIdx, 0x00, [0x00, 0x00, 0x00]);
            if (res && res.length >= 5) {
                const zoneCount = res[4] || 1;
                return { zoneCount };
            }
        } catch (e) {}
        return null;
    }

    async getLightingEffect(zone = 0) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.COLOR_LED);
        if (!featIdx) return null;
        try {
            const res = await this.sendCommand(featIdx, 0x0E, [zone & 0xFF, 0x00, 0x00]);
            if (res && res.length >= 6) {
                const effectMode = res[5]; // 0=Off, 1=Static, 2=Breathing, 3=ColorCycle
                let r = 0, g = 229, b = 255;
                let periodMs = 3000;
                let intensity = 100;

                if (effectMode === 1) { // Static Color
                    r = res[6] !== undefined ? res[6] : 0;
                    g = res[7] !== undefined ? res[7] : 229;
                    b = res[8] !== undefined ? res[8] : 255;
                } else if (effectMode === 2) { // Breathing
                    r = res[6] !== undefined ? res[6] : 0;
                    g = res[7] !== undefined ? res[7] : 229;
                    b = res[8] !== undefined ? res[8] : 255;
                    periodMs = (res[9] << 8) | res[10];
                    intensity = res[12] !== undefined ? res[12] : 100;
                } else if (effectMode === 3) { // Color Cycle
                    periodMs = (res[11] << 8) | res[12];
                    intensity = res[13] !== undefined ? res[13] : 100;
                }

                const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
                return {
                    zone,
                    mode: effectMode,
                    color: hex,
                    r, g, b,
                    period: periodMs || 3000,
                    intensity: (intensity > 0 && intensity <= 100) ? intensity : 100
                };
            }
        } catch (e) {
            console.error('getLightingEffect error:', e);
        }
        return null;
    }

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
    async getButtonCount() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.BUTTON_SPY);
        if (!featIdx) return 11;
        try {
            const res = await this.sendCommand(featIdx, 0x00, [0x00, 0x00, 0x00]);
            if (res && res.length >= 5) {
                return res[4] || 11;
            }
        } catch (e) {}
        return 11;
    }

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
            // Important: Request must be Short Report 0x10 (isLong = false)
            const res = await this.sendCommand(featIdx, 0x03, [0x00, 0x00, 0x00], false);
            if (res && res.length >= 20) {
                return Array.from(res.slice(4, 20));
            }
        } catch (e) {
            console.error('getButtonRemappings error:', e);
        }
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
    async getOnboardProfilesInfo() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) return null;
        try {
            const res = await this.sendCommand(featIdx, 0x00, [0x00, 0x00, 0x00]);
            if (res && res.length >= 8) {
                return {
                    formatVersion: res[4],
                    sectorCount: res[5],
                    profileFormat: res[6],
                    profileCount: res[7]
                };
            }
        } catch (e) {}
        return null;
    }

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

    async getActiveProfileResolution() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) return 0;
        try {
            const res = await this.sendCommand(featIdx, 0x06, [0x00, 0x00, 0x00]);
            if (res && res.length >= 6) {
                return res[5] !== undefined ? res[5] : (res[4] || 0);
            }
        } catch (e) {}
        return 0;
    }

    async setActiveProfile(slot = 1) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) throw new Error('Onboard profiles feature not available.');
        // Function 0x03: setActiveProfile(slot) - Short report [0x00, slot & 0xFF, 0x00]
        const res = await this.sendCommand(featIdx, 0x03, [0x00, slot & 0xFF, 0x00], false, 1200);
        return res && (res[4] === 0x00 || res[4] === (slot & 0xFF));
    }

    async commitProfileToFlash(slot = 1) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) throw new Error('Onboard profiles feature not available.');
        // Function 0x0C: commit_profile_to_flash - Short report [slot & 0xFF, 0x00, 0x00]
        const res = await this.sendCommand(featIdx, 0x0C, [slot & 0xFF, 0x00, 0x00], false, 1200);
        return res && (res[4] === 0x00 || res[4] === (slot & 0xFF));
    }

    async executeMacro(sector = 6, offset = 0) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) throw new Error('Onboard profiles feature not available.');
        // Function 0x05: execute_macro(sector, address)
        const res = await this.sendCommand(featIdx, 0x05, [0x00, sector & 0xFF, (offset >> 8) & 0xFF, offset & 0xFF], false, 1000);
        return res;
    }

    /* -------------------------------------------------------------
     * Sector / Flash Page Read & Write (Feature 0x8100)
     * ------------------------------------------------------------- */
    async readSector(pageId, pageSize = 256) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) throw new Error('Onboard profiles feature (0x8100) not available.');

        // Function 0x0B reads profile data
        const res = await this.sendCommand(featIdx, 0x0B, [0x00, pageId & 0xFF, 0x00], false, 1000);
        return res;
    }

    async writeSector(pageId, buffer, pageSize = 256) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) throw new Error('Onboard profiles feature (0x8100) not available.');

        const sectorBuffer = new Uint8Array(pageSize);
        sectorBuffer.fill(0xFF);
        sectorBuffer.set(buffer.slice(0, pageSize));

        // Ensure CRC-CCITT (poly 0x1021, init 0xFFFF) across first 253 bytes is embedded at tail
        const crc = crcCcitt(sectorBuffer, pageSize - 3);
        sectorBuffer[pageSize - 3] = (crc >> 8) & 0xFF;
        sectorBuffer[pageSize - 2] = crc & 0xFF;
        sectorBuffer[pageSize - 1] = 0xFF;

        // 1. Prepare Sector Transaction (Function 0x06)
        // Wire packet: [0x11, 0xFF, featIdx, 0x6F, 0x00, pageId, 0x00, 0x00, 0x00, 0xFF, 0x00...]
        const prepPayload = [
            0x00, // ROM flag
            pageId & 0xFF,
            0x00, // offset Hi
            0x00, // offset Lo
            0x00, // length Hi
            0xFF, // length Lo
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0
        ];
        await this.sendCommand(featIdx, 0x06, prepPayload, true, 1200);

        // 2. Transfer 16-byte chunks (Function 0x07)
        for (let start = 0; start < pageSize; start += 16) {
            const chunk = Array.from(sectorBuffer.slice(start, start + 16));
            while (chunk.length < 16) chunk.push(0xFF);
            await this.sendCommand(featIdx, 0x07, chunk, true, 1200);
        }

        // 3. Finalize Sector Write (Function 0x08)
        // Short report (0x10) to writeDevice
        await this.sendCommand(featIdx, 0x08, [0x00, 0x00, 0x00], false, 1200);

        return true;
    }

    async writeMacro(macroBytecode, pageId = 6) {
        const pageSize = 256;
        if (macroBytecode.length > pageSize - 3) {
            throw new Error(`Macro size (${macroBytecode.length} bytes) exceeds page capacity (${pageSize - 3} bytes).`);
        }

        const sectorBuffer = new Uint8Array(pageSize);
        sectorBuffer.fill(0xFF);
        sectorBuffer.set(macroBytecode, 0);

        // Ensure macro end marker 0xFF is present
        if (macroBytecode.length < pageSize && sectorBuffer[macroBytecode.length - 1] !== 0xFF) {
            sectorBuffer[macroBytecode.length] = 0xFF;
        }

        // Ensure Onboard Mode is active before writing
        try {
            await this.setOnboardMode(1);
        } catch (e) {}

        return await this.writeSector(pageId, sectorBuffer, pageSize);
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

/* -------------------------------------------------------------
 * HID Scancode Tables & Multiline Macro Compiler
 * ------------------------------------------------------------- */
export const HID_MODIFIERS = {
    CTRL: 0x01,
    STRG: 0x01,
    LCTRL: 0x01,
    SHIFT: 0x02,
    LSHIFT: 0x02,
    ALT: 0x04,
    LALT: 0x04,
    WIN: 0x08,
    WINDOWS: 0x08,
    CMD: 0x08,
    COMMAND: 0x08,
    GUI: 0x08,
    LGUI: 0x08,
    RCTRL: 0x10,
    RSTRG: 0x10,
    RSHIFT: 0x20,
    RALT: 0x40,
    ALTGR: 0x40,
    RWIN: 0x80,
    RGUI: 0x80
};

export const HID_KEY_CODES = {
    NONE: 0,
    A: 4, B: 5, C: 6, D: 7, E: 8, F: 9, G: 10, H: 11, I: 12, J: 13,
    K: 14, L: 15, M: 16, N: 17, O: 18, P: 19, Q: 20, R: 21, S: 22,
    T: 23, U: 24, V: 25, W: 26, X: 27, Y: 28, Z: 29,
    '1': 30, '2': 31, '3': 32, '4': 33, '5': 34, '6': 35, '7': 36, '8': 37, '9': 38, '0': 39,
    ENTER: 40, RETURN: 40,
    ESCAPE: 41, ESC: 41,
    BACKSPACE: 42, BSPACE: 42,
    TAB: 43,
    SPACE: 44,
    MINUS: 45, '-': 45,
    EQUAL: 46, '=': 46,
    LBRACKET: 47, '[': 47,
    RBRACKET: 48, ']': 48,
    BSLASH: 49, '\\': 49,
    NONUS_HASH: 50, '#': 50,
    SEMICOLON: 51, SCOLON: 51, ';': 51,
    QUOTE: 52, "'": 52, '"': 52,
    GRAVE: 53, '`': 53, '~': 53,
    COMMA: 54, ',': 54,
    DOT: 55, '.': 55,
    SLASH: 56, '/': 56,
    CAPSLOCK: 57, CAPS: 57,
    F1: 58, F2: 59, F3: 60, F4: 61, F5: 62, F6: 63,
    F7: 64, F8: 65, F9: 66, F10: 67, F11: 68, F12: 69,
    PRINTSCREEN: 70, PRINT: 70, PSCREEN: 70,
    SCROLLLOCK: 71,
    PAUSE: 72,
    INSERT: 73,
    HOME: 74,
    PAGEUP: 75, PGUP: 75,
    DELETE: 76, DEL: 76,
    END: 77,
    PAGEDOWN: 78, PGDOWN: 78,
    RIGHT: 79,
    LEFT: 80,
    DOWN: 81,
    UP: 82,
    NUMLOCK: 83,
    KP_SLASH: 84, KP_ASTERISK: 85, KP_MINUS: 86, KP_PLUS: 87, KP_ENTER: 88,
    KP_1: 89, KP_2: 90, KP_3: 91, KP_4: 92, KP_5: 93, KP_6: 94, KP_7: 95, KP_8: 96, KP_9: 97, KP_0: 98,
    KP_DOT: 99,
    APPLICATION: 101, APP: 101, MENU: 101,
    MUTE: 127, VOLUMEUP: 128, VOLUMEDOWN: 129
};

export function crcCcitt(data, length = 253) {
    let crc = 0xFFFF;
    for (let i = 0; i < length; i++) {
        const b = data[i];
        crc ^= (b << 8);
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }
    return crc;
}

export const DEFAULT_G502_PROFILE_SECTOR = new Uint8Array([
    0x01, 0x01, 0x00, 0xB0, 0x04, 0x60, 0x09, 0x80, 0x0C, 0x00, 0x19, 0x00, 0x00, 0xFF, 0xFF, 0xFF,
    0xFF, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0x80, 0x01, 0x00, 0x01, 0x80, 0x01, 0x00, 0x02, 0x80, 0x01, 0x00, 0x04, 0x80, 0x01, 0x00, 0x08,
    0x80, 0x01, 0x00, 0x10, 0x80, 0x02, 0x08, 0x07, 0x90, 0x04, 0xFF, 0xFF, 0x90, 0x07, 0xFF, 0xFF,
    0x90, 0x0A, 0xFF, 0xFF, 0x90, 0x02, 0xFF, 0xFF, 0x90, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x13, 0x88, 0x64, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x13, 0x88, 0x64, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x3A, 0x43, 0xFF,
]);

export function buildProfileSector(buttonActions = [], baseSector = DEFAULT_G502_PROFILE_SECTOR) {
    const sector = new Uint8Array(baseSector);
    for (const btn of buttonActions) {
        if (!btn || !btn.id || btn.id < 1 || btn.id > 11) continue;
        const offset = 32 + (btn.id - 1) * 4;
        const act = btn.defaultAction || btn.action || {};
        if (act.type === 'macro') {
            const page = act.page || 0x06;
            const macroOffset = act.offset || 0;
            sector[offset + 0] = 0x00; // BUTTON_BEHAVIOR.EXECUTE_MACRO
            sector[offset + 1] = page & 0xFF;
            sector[offset + 2] = (macroOffset >> 8) & 0xFF;
            sector[offset + 3] = macroOffset & 0xFF;
        } else if (act.type === 'mouse') {
            sector[offset + 0] = 0x80;
            sector[offset + 1] = 0x01;
            sector[offset + 2] = 0x00;
            sector[offset + 3] = (act.value || 1) & 0xFF;
        } else if (act.type === 'key') {
            sector[offset + 0] = 0x80;
            sector[offset + 1] = 0x02;
            sector[offset + 2] = (act.modifiers || 0) & 0xFF;
            sector[offset + 3] = (act.value || 4) & 0xFF;
        } else if (act.type === 'func') {
            sector[offset + 0] = 0x90;
            sector[offset + 1] = (act.value || 0) & 0xFF;
            sector[offset + 2] = 0xFF;
            sector[offset + 3] = 0xFF;
        }
    }
    const crc = crcCcitt(sector, 253);
    sector[253] = (crc >> 8) & 0xFF;
    sector[254] = crc & 0xFF;
    sector[255] = 0xFF;
    return sector;
}

export function compileMacroScript(scriptText, maxBytes = 256) {
    const bytes = [];
    const lines = scriptText.split('\n');
    const errors = [];
    let lineNum = 0;
    let instructionCount = 0;

    for (let line of lines) {
        lineNum++;
        line = line.trim();
        if (!line || line.startsWith('#') || line.startsWith('//')) continue;

        // 1. Text typing helper: TYPE <text> or STRING <text>
        if (/^(TYPE|STRING)\s+/i.test(line)) {
            const textToType = line.replace(/^(TYPE|STRING)\s+/i, '');
            for (let char of textToType) {
                const upper = char.toUpperCase();
                let mod = 0x00;
                let keycode = 0;

                if (char >= 'A' && char <= 'Z') {
                    mod = 0x02; // Shift
                    keycode = upper.charCodeAt(0) - 'A'.charCodeAt(0) + 4;
                } else if (char >= 'a' && char <= 'z') {
                    keycode = upper.charCodeAt(0) - 'A'.charCodeAt(0) + 4;
                } else if (char >= '1' && char <= '9') {
                    keycode = char.charCodeAt(0) - '1'.charCodeAt(0) + 30;
                } else if (char === '0') {
                    keycode = 39;
                } else if (char === ' ') {
                    keycode = 44;
                } else if (char === '.') {
                    keycode = 55;
                } else if (char === ',') {
                    keycode = 54;
                } else if (char === '-') {
                    keycode = 45;
                } else if (char === '_') {
                    mod = 0x02; keycode = 45;
                } else if (char === '/') {
                    keycode = 56;
                } else if (char === ':') {
                    mod = 0x02; keycode = 51;
                } else {
                    keycode = HID_KEY_CODES[upper] || 0;
                }

                if (keycode > 0) {
                    bytes.push(0x43, mod, keycode); // Key Down
                    bytes.push(0x40, 0x00, 0x14);   // 20ms debounce
                    bytes.push(0x44, mod, keycode); // Key Up
                    bytes.push(0x40, 0x00, 0x14);   // 20ms debounce
                    instructionCount++;
                }
            }
            continue;
        }

        // 2. Delay / Wait: DELAY <ms> or WAIT <ms> or SLEEP <ms>
        if (/^(DELAY|WAIT|SLEEP)\b/i.test(line)) {
            const parts = line.split(/\s+/);
            const ms = parseInt(parts[1], 10) || 100;
            const clampedMs = Math.min(Math.max(ms, 1), 65535);
            const hi = (clampedMs >> 8) & 0xFF;
            const lo = clampedMs & 0xFF;
            bytes.push(0x40, hi, lo);
            instructionCount++;
            continue;
        }

        // 3. Raw Down / Up commands: DOWN <mod/key> or UP <mod/key>
        if (/^(DOWN|PRESS)\s+/i.test(line)) {
            const target = line.replace(/^(DOWN|PRESS)\s+/i, '').trim().toUpperCase();
            if (target in HID_MODIFIERS) {
                bytes.push(0x43, HID_MODIFIERS[target], 0x00);
            } else if (target in HID_KEY_CODES) {
                bytes.push(0x43, 0x00, HID_KEY_CODES[target]);
            } else {
                errors.push(`Line ${lineNum}: Unknown key or modifier "${target}" for DOWN.`);
            }
            instructionCount++;
            continue;
        }

        if (/^(UP|RELEASE)\s+/i.test(line)) {
            const target = line.replace(/^(UP|RELEASE)\s+/i, '').trim().toUpperCase();
            if (target in HID_MODIFIERS) {
                bytes.push(0x44, HID_MODIFIERS[target], 0x00);
            } else if (target in HID_KEY_CODES) {
                bytes.push(0x44, 0x00, HID_KEY_CODES[target]);
            } else {
                errors.push(`Line ${lineNum}: Unknown key or modifier "${target}" for UP.`);
            }
            instructionCount++;
            continue;
        }

        // 4. Key Chords / Combos: [MODIFIER(S)...] [KEY]
        const tokens = line.split(/\s+/);
        let modMask = 0x00;
        let keyToken = null;

        for (const token of tokens) {
            const tok = token.toUpperCase();
            if (tok in HID_MODIFIERS) {
                modMask |= HID_MODIFIERS[tok];
            } else if (tok in HID_KEY_CODES || /^[A-Z0-9]$/i.test(tok)) {
                keyToken = tok;
            } else {
                errors.push(`Line ${lineNum}: Unrecognized token "${token}".`);
            }
        }

        let keyCode = 0;
        if (keyToken) {
            if (keyToken in HID_KEY_CODES) {
                keyCode = HID_KEY_CODES[keyToken];
            } else if (keyToken.length === 1 && keyToken >= 'A' && keyToken <= 'Z') {
                keyCode = keyToken.charCodeAt(0) - 'A'.charCodeAt(0) + 4;
            } else if (keyToken.length === 1 && keyToken >= '0' && keyToken <= '9') {
                keyCode = keyToken === '0' ? 39 : (keyToken.charCodeAt(0) - '1'.charCodeAt(0) + 30);
            }
        }

        if (modMask > 0 && keyCode === 0) {
            // Modifier only tap
            bytes.push(0x43, modMask, 0x00);
            bytes.push(0x40, 0x00, 0x20); // 32ms tap
            bytes.push(0x44, modMask, 0x00);
            instructionCount++;
        } else if (keyCode > 0) {
            // Key press with optional modifiers
            bytes.push(0x43, modMask, keyCode);
            bytes.push(0x40, 0x00, 0x28); // 40ms press
            bytes.push(0x44, modMask, keyCode);
            instructionCount++;
        } else if (!errors.length) {
            errors.push(`Line ${lineNum}: Missing valid key in chord.`);
        }
    }

    // Always append Macro End sentinel
    bytes.push(0xFF);

    const bytecode = new Uint8Array(bytes);
    const hex = Array.from(bytecode).map(b => b.toString(16).padStart(2, '0')).join(' ');

    const exceedsCapacity = bytecode.length > maxBytes;
    if (exceedsCapacity) {
        errors.push(`Compiled macro is ${bytecode.length} bytes, exceeding page maximum (${maxBytes} bytes).`);
    }

    return {
        success: errors.length === 0,
        bytecode,
        hex,
        byteLength: bytecode.length,
        maxBytes,
        instructionCount,
        errors
    };
}

