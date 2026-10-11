/**
 * Logitech HID++ 2.0 WebHID Driver Engine
 * Implements wire protocol discovery, DPI adjustment, and onboard memory operations.
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
    HIRES_WHEEL: 0x2121,
    ADJUSTABLE_DPI: 0x2201,
    DPI_SENSOR: 0x2202,
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
    0x1000: 'BatteryVoltage',
    0x1004: 'UnifiedBattery',
    0x2121: 'HiResWheel',
    0x2201: 'AdjustableDPI',
    0x2202: 'SensorDPIParams',
    0x8061: 'ReportRate',
    0x8070: 'ColorLED_RGB',
    0x8100: 'OnboardProfiles',
    0x8110: 'ButtonSpyRemap'
};

export class HidppDevice {
    constructor() {
        this.writeDevice = null;
        this.readDevice = null;
        this.isConnected = false;
        this.deviceInfo = {
            name: 'Disconnected',
            vid: 0,
            pid: 0,
            protocolVersion: 'HID++ 2.0 / 4.2'
        };
        this.featureIndexMap = new Map(); // Feature ID -> Runtime Index
        this.indexFeatureMap = new Map(); // Runtime Index -> Feature ID
        this.pendingRequests = new Map(); // Key `${featIdx}_${fnId}_${swId}` -> { resolve, reject, timer }
        this.swCounter = 0x01;
        this.packetListeners = [];
    }

    onPacket(listener) {
        this.packetListeners.push(listener);
    }

    emitPacket(direction, reportId, devIdx, featIdx, fnId, swId, rawBytes, meta = '') {
        const featName = this.indexFeatureMap.get(featIdx) 
            ? `${FEATURE_NAMES[this.indexFeatureMap.get(featIdx)] || 'Unknown'} (0x${featIdx.toString(16).padStart(2, '0')})`
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
            throw new Error('WebHID API is not supported in this browser. Please use Chrome, Edge, Brave, or Opera over localhost/HTTPS.');
        }

        // Request Logitech peripherals with vendorId 0x046D
        const requested = await navigator.hid.requestDevice({
            filters: [{ vendorId: 0x046D }]
        });

        if (!requested || requested.length === 0) {
            throw new Error('No Logitech device selected.');
        }

        // Query all granted devices from navigator.hid.getDevices() to get both Collection 0x0001 & 0x0002!
        const allGranted = await navigator.hid.getDevices();
        const logiDevices = allGranted.filter(d => d.vendorId === 0x046D);
        const deviceList = logiDevices.length > 0 ? logiDevices : requested;

        return await this.setupDevices(deviceList);
    }

    async setupDevices(deviceList) {
        // Find Write collection (usage 0x0001) and Read collection (usage 0x0002)
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

        // Fallback: if collection was single
        if (!writeCandidate && deviceList.length > 0) writeCandidate = deviceList[0];
        if (!readCandidate && deviceList.length > 0) readCandidate = deviceList[0];

        this.writeDevice = writeCandidate;
        this.readDevice = readCandidate;

        this.deviceInfo = {
            name: writeCandidate.productName || 'Logitech Gaming Mouse',
            vid: writeCandidate.vendorId,
            pid: writeCandidate.productId,
            protocolVersion: 'HID++ 2.0 / 4.2'
        };

        // Attach input report handler on readDevice
        this.readDevice.addEventListener('inputreport', (event) => {
            this.handleInputReport(event);
        });

        this.isConnected = true;

        // Perform initial feature enumeration
        await this.discoverFeatures();

        return this.deviceInfo;
    }

    handleInputReport(event) {
        const { reportId, data } = event;
        const u8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

        // Entire report including reportId as byte 0
        const fullBytes = new Uint8Array(u8.length + 1);
        fullBytes[0] = reportId;
        fullBytes.set(u8, 1);

        if (u8.length < 3) return;

        const devIdx = u8[0];
        const featIdx = u8[1];
        const fnSw = u8[2];
        const fnId = (fnSw >> 4) & 0x0F;
        const swId = fnSw & 0x0F;

        // Check if there is a pending request matching featIdx + fnId + swId
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

    async sendCommand(featIdx, fnId, payload = [], isLong = false, timeoutMs = 800) {
        if (!this.isConnected || !this.writeDevice) {
            throw new Error('Device not connected.');
        }

        const swId = this.getNextSwId();
        const reportId = isLong ? 0x11 : 0x10;
        const totalPayloadLen = isLong ? 19 : 6;

        const data = new Uint8Array(totalPayloadLen);
        data[0] = 0xFF; // Device Index (direct corded)
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
                reject(new Error(`Timeout waiting for response to Feat=0x${featIdx.toString(16)} Fn=0x${fnId.toString(16)}`));
            }, timeoutMs);

            this.pendingRequests.set(reqKey, { resolve, reject, timer });

        try {
            this.emitPacket('TX', reportId, 0xFF, featIdx, fnId, swId, fullSendBytes, 'Host Command');
            // sendReport requires omitting reportId in data
            // CRITICAL DISCOVERY: On Windows, Short Reports (0x10, 7B) route to Collection 0x0001 (writeDevice)
            // Long Reports (0x11, 20B) route to Collection 0x0002 (readDevice)
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
        // Query Root Feature 0x0000, Function 0x0
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
            HIDPP_FEATURES.ADJUSTABLE_DPI,
            HIDPP_FEATURES.DPI_SENSOR,
            HIDPP_FEATURES.REPORT_RATE,
            HIDPP_FEATURES.COLOR_LED,
            HIDPP_FEATURES.ONBOARD_PROFILES,
            HIDPP_FEATURES.BUTTON_SPY
        ];

        for (const featId of featuresToProbe) {
            try {
                await this.queryFeature(featId);
            } catch (e) {
                console.warn(`Could not probe feature 0x${featId.toString(16)}:`, e);
            }
        }
    }

    async getDpi() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ADJUSTABLE_DPI);
        if (!featIdx) throw new Error('Adjustable DPI feature not available on device.');

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
        if (!featIdx) throw new Error('Adjustable DPI feature not available on device.');

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

    async getOnboardProfilesInfo() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) throw new Error('Onboard profiles feature not available on device.');

        // Function 0x0: getOnboardProfilesInfo
        const res = await this.sendCommand(featIdx, 0x00, [0x00, 0x00, 0x00]);
        if (res.length >= 10) {
            return {
                formatVersion: res[4],
                profileCount: res[7],
                sectorSize: 256
            };
        }
        return { formatVersion: 1, profileCount: 5, sectorSize: 256 };
    }

    async getActiveProfile() {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (!featIdx) throw new Error('Onboard profiles feature not available.');

        // Function 0x4: getActiveProfile
        const res = await this.sendCommand(featIdx, 0x04, [0x00, 0x00, 0x00]);
        if (res.length >= 6) {
            const sector = (res[4] << 8) | res[5];
            return sector;
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

        // Function 0xC: writeProfileData commit
        const secHi = (sectorId >> 8) & 0xFF;
        const secLo = sectorId & 0xFF;
        const res = await this.sendCommand(featIdx, 0x0C, [secHi, secLo, 0x00]);
        return res[4] === 0x00;
    }

    async setReportRate(rateHz) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.REPORT_RATE);
        // Bitmask: 1000Hz = 0x01, 500Hz = 0x02, 250Hz = 0x04, 125Hz = 0x08
        const rateMap = { 1000: 0x01, 500: 0x02, 250: 0x04, 125: 0x08 };
        const mask = rateMap[rateHz] || 0x01;
        if (featIdx) {
            await this.sendCommand(featIdx, 0x01, [mask, 0x00, 0x00]);
        }
        return true;
    }

    async setLightingEffect(zone, effectMode, r, g, b) {
        const featIdx = this.featureIndexMap.get(HIDPP_FEATURES.COLOR_LED);
        if (!featIdx) throw new Error('Color LED feature (0x8070) not available.');

        // Step 1: Ensure Software Lighting Control (Fn 0x08) is enabled (sw_control_flag = 1)
        // Without this, mouse firmware runs in Onboard Memory mode and ignores/overrides software color!
        try {
            await this.sendCommand(featIdx, 0x08, [0x01, 0x00, 0x00]);
        } catch (e) {
            console.warn('Set SWControl warning:', e);
        }

        // Step 2: Long Report (0x11): Function 0x3 setZoneEffect
        // payload layout: [zone, effectMode, R, G, B, color_anim(0x02), 6x zeros, persistence(0x01=NV Flash), 3x zeros]
        const payload = [
            zone & 0xFF,
            effectMode & 0xFF,
            r & 0xFF,
            g & 0xFF,
            b & 0xFF,
            0x02, // NO_EFFECT / immediate solid application
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x01, // persistence: 1 = VOLATILE_AND_NONVOLATILE (persists across reboots!)
            0x00, 0x00, 0x00
        ];
        const res = await this.sendCommand(featIdx, 0x03, payload, true);
        return res;
    }

    async disconnect() {
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
    }
}
