/**
 * Logitech HID++ 2.0 WebHID Lab - Application Controller
 * Handles UI interactions, WebHID hardware bridging, simulation engine, and live telemetry.
 */

import { HidppDevice, HIDPP_FEATURES, FEATURE_NAMES } from './hidpp.js';

class AppController {
    constructor() {
        this.device = new HidppDevice();
        this.isSimulated = false;
        this.isPaused = false;
        this.packetHistory = [];
        this.maxPackets = 500;
        
        // State
        this.currentDpi = 1600;
        this.currentRate = 1000;
        this.currentSlot = 1;
        this.currentZone = 0;
        this.currentMode = 1;
        this.currentColor = '#00e5ff';

        this.initDom();
        this.bindEvents();
        this.updateGauge(this.currentDpi);
    }

    initDom() {
        // Status & Connectivity
        this.statusDot = document.getElementById('statusDot');
        this.statusLabel = document.getElementById('statusLabel');
        this.deviceNameBadge = document.getElementById('deviceNameBadge');
        this.btnConnect = document.getElementById('btnConnect');
        this.btnSimulate = document.getElementById('btnSimulate');
        this.btnDisconnect = document.getElementById('btnDisconnect');

        // DPI
        this.dpiDisplayValue = document.getElementById('dpiDisplayValue');
        this.gaugeBar = document.getElementById('gaugeBar');
        this.dpiSlider = document.getElementById('dpiSlider');
        this.dpiHexPreview = document.getElementById('dpiHexPreview');
        this.dpiFeatureBadge = document.getElementById('dpiFeatureBadge');
        this.presetChips = document.querySelectorAll('.preset-chips .chip');

        // Polling Rate
        this.rateCards = document.querySelectorAll('.rate-card');
        this.pollingBadge = document.getElementById('pollingBadge');

        // Profiles
        this.slotTabs = document.querySelectorAll('.slot-tab');
        this.activeProfileBadge = document.getElementById('activeProfileBadge');
        this.sectorAddr = document.getElementById('sectorAddr');
        this.btnActivateSlot = document.getElementById('btnActivateSlot');
        this.btnCommitFlash = document.getElementById('btnCommitFlash');

        // RGB
        this.zonePills = document.querySelectorAll('.zone-pill');
        this.modePills = document.querySelectorAll('.mode-pill');
        this.rgbColorInput = document.getElementById('rgbColorInput');
        this.colorHexText = document.getElementById('colorHexText');
        this.swatches = document.querySelectorAll('.palette-swatches .swatch');
        this.btnApplyRgb = document.getElementById('btnApplyRgb');

        // Discovery & Telemetry
        this.btnRefreshDiscovery = document.getElementById('btnRefreshDiscovery');
        this.featuresTableBody = document.getElementById('featuresTableBody');
        this.packetStreamFeed = document.getElementById('packetStreamFeed');
        this.packetCountBadge = document.getElementById('packetCountBadge');
        this.btnPausePackets = document.getElementById('btnPausePackets');
        this.btnClearPackets = document.getElementById('btnClearPackets');
        this.btnExportLog = document.getElementById('btnExportLog');
        this.toastContainer = document.getElementById('toastContainer');
    }

    bindEvents() {
        // Connect & Disconnect
        this.btnConnect.addEventListener('click', () => this.handleConnect());
        this.btnSimulate.addEventListener('click', () => this.handleSimulate());
        this.btnDisconnect.addEventListener('click', () => this.handleDisconnect());

        // Packet Logger Listener
        this.device.onPacket((pkt) => this.handlePacketLogged(pkt));

        // DPI Events
        this.dpiSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            this.setDpiState(val, false);
        });

        this.dpiSlider.addEventListener('change', async (e) => {
            const val = parseInt(e.target.value, 10);
            await this.applyDpi(val);
        });

        this.presetChips.forEach(chip => {
            chip.addEventListener('click', async () => {
                const val = parseInt(chip.dataset.dpi, 10);
                this.dpiSlider.value = val;
                this.setDpiState(val, true);
                await this.applyDpi(val);
            });
        });

        // Polling Rate Events
        this.rateCards.forEach(card => {
            card.addEventListener('click', async () => {
                const rate = parseInt(card.dataset.rate, 10);
                await this.applyPollingRate(rate);
            });
        });

        // Profile Events
        this.slotTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const slot = parseInt(tab.dataset.slot, 10);
                this.selectProfileSlot(slot);
            });
        });

        this.btnActivateSlot.addEventListener('click', async () => {
            await this.applyActiveProfile(this.currentSlot);
        });

        this.btnCommitFlash.addEventListener('click', async () => {
            await this.applyCommitFlash(this.currentSlot);
        });

        // RGB Events
        this.zonePills.forEach(pill => {
            pill.addEventListener('click', () => {
                this.zonePills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.currentZone = parseInt(pill.dataset.zone, 10);
            });
        });

        this.modePills.forEach(pill => {
            pill.addEventListener('click', () => {
                this.modePills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.currentMode = parseInt(pill.dataset.mode, 10);
            });
        });

        this.rgbColorInput.addEventListener('input', (e) => {
            this.setColor(e.target.value);
        });

        this.rgbColorInput.addEventListener('change', async (e) => {
            this.setColor(e.target.value);
            await this.applyLighting();
        });

        this.swatches.forEach(swatch => {
            swatch.addEventListener('click', async () => {
                this.setColor(swatch.dataset.color);
                await this.applyLighting();
            });
        });

        this.btnApplyRgb.addEventListener('click', async () => {
            await this.applyLighting();
        });

        // Discovery refresh
        this.btnRefreshDiscovery.addEventListener('click', async () => {
            await this.refreshDiscovery();
        });

        // Sniffer console controls
        this.btnPausePackets.addEventListener('click', () => {
            this.isPaused = !this.isPaused;
            this.btnPausePackets.textContent = this.isPaused ? 'Resume' : 'Pause';
            this.showToast(this.isPaused ? 'Telemetry paused' : 'Telemetry resumed');
        });

        this.btnClearPackets.addEventListener('click', () => {
            this.packetStreamFeed.innerHTML = '';
            this.packetHistory = [];
            this.packetCountBadge.textContent = '0 Packets';
            this.showToast('Packet log cleared');
        });

        this.btnExportLog.addEventListener('click', () => {
            this.exportPackets();
        });
    }

    /* -------------------------------------------------------------
     * Connectivity & Hardware Handling
     * ------------------------------------------------------------- */

    async handleConnect() {
        try {
            this.showToast('Requesting WebHID device...', 'info');
            const info = await this.device.requestAndOpen();
            this.isSimulated = false;

            this.updateConnectedUI(info.name, `VID: 0x${info.vid.toString(16).toUpperCase()} PID: 0x${info.pid.toString(16).toUpperCase()}`);
            this.showToast(`Connected: ${info.name}`, 'success');

            await this.syncHardwareState();
        } catch (err) {
            console.error(err);
            this.showToast(err.message || 'Failed to connect WebHID device', 'error');
        }
    }

    handleSimulate() {
        this.isSimulated = true;
        this.device.isConnected = true;
        this.device.deviceInfo = {
            name: 'Logitech G502 HERO Gaming Mouse (Simulated)',
            vid: 0x046D,
            pid: 0xC08B,
            protocolVersion: 'HID++ 2.0 / 4.2'
        };

        // Populate standard G502 HERO runtime index mappings
        this.device.featureIndexMap.set(HIDPP_FEATURES.FEATURE_SET, 0x01);
        this.device.featureIndexMap.set(HIDPP_FEATURES.DEVICE_INFO, 0x02);
        this.device.featureIndexMap.set(HIDPP_FEATURES.DEVICE_NAME, 0x03);
        this.device.featureIndexMap.set(HIDPP_FEATURES.ADJUSTABLE_DPI, 0x07);
        this.device.featureIndexMap.set(HIDPP_FEATURES.DPI_SENSOR, 0x08);
        this.device.featureIndexMap.set(HIDPP_FEATURES.REPORT_RATE, 0x09);
        this.device.featureIndexMap.set(HIDPP_FEATURES.COLOR_LED, 0x0D);
        this.device.featureIndexMap.set(HIDPP_FEATURES.ONBOARD_PROFILES, 0x0B);
        this.device.featureIndexMap.set(HIDPP_FEATURES.BUTTON_SPY, 0x0C);

        for (const [feat, idx] of this.device.featureIndexMap.entries()) {
            this.device.indexFeatureMap.set(idx, feat);
        }

        this.updateConnectedUI(
            this.device.deviceInfo.name, 
            'VID: 0x046D PID: 0xC08B (Simulated Wire)',
            true
        );

        this.updateFeaturesTable();
        this.dpiFeatureBadge.textContent = 'Runtime Idx: 0x07 (Active)';
        this.dpiFeatureBadge.classList.add('badge-success');

        // Log initial discovery simulation packets
        this.emitSimulatedDiscoveryPackets();
        this.showToast('G502 HERO Simulation Mode active', 'success');
    }

    async handleDisconnect() {
        if (!this.isSimulated) {
            await this.device.disconnect();
        }
        this.isSimulated = false;
        this.device.isConnected = false;

        this.statusDot.className = 'status-indicator-dot';
        this.statusLabel.textContent = 'DISCONNECTED';
        this.deviceNameBadge.textContent = 'No Hardware Bound';
        this.btnConnect.classList.remove('hidden');
        this.btnSimulate.classList.remove('hidden');
        this.btnDisconnect.classList.add('hidden');
        this.dpiFeatureBadge.textContent = 'Awaiting Sync';
        this.dpiFeatureBadge.classList.remove('badge-success');

        this.showToast('Device disconnected');
    }

    updateConnectedUI(name, subtitle, isSim = false) {
        this.statusDot.className = `status-indicator-dot ${isSim ? 'simulated' : 'connected'}`;
        this.statusLabel.textContent = isSim ? 'SIMULATED' : 'CONNECTED';
        this.deviceNameBadge.textContent = name;
        this.btnConnect.classList.add('hidden');
        this.btnSimulate.classList.add('hidden');
        this.btnDisconnect.classList.remove('hidden');
    }

    async syncHardwareState() {
        this.updateFeaturesTable();

        const dpiIdx = this.device.featureIndexMap.get(HIDPP_FEATURES.ADJUSTABLE_DPI);
        if (dpiIdx) {
            this.dpiFeatureBadge.textContent = `Runtime Idx: 0x${dpiIdx.toString(16).padStart(2, '0')} (Active)`;
            this.dpiFeatureBadge.classList.add('badge-success');
            try {
                const dpiData = await this.device.getDpi();
                this.setDpiState(dpiData.dpi, true);
                this.showToast(`Hardware DPI Read: ${dpiData.dpi} DPI`, 'info');
            } catch (e) {
                console.warn('Could not read hardware DPI:', e);
            }
        }
    }

    async refreshDiscovery() {
        if (!this.device.isConnected) {
            this.showToast('Connect device or simulate first.', 'error');
            return;
        }

        if (this.isSimulated) {
            this.emitSimulatedDiscoveryPackets();
            this.showToast('Discovered 8 HID++ 2.0 features (Simulated)', 'success');
            return;
        }

        this.showToast('Probing IRoot (0x0000)...');
        await this.device.discoverFeatures();
        this.updateFeaturesTable();
        this.showToast('Feature Discovery completed', 'success');
    }

    updateFeaturesTable() {
        this.featuresTableBody.innerHTML = '';
        
        // Root feature is always row 0
        const rows = [
            { id: 0x0000, name: 'IRoot (Discovery)', idx: '0x00', type: 'Core', status: 'Permanent' }
        ];

        for (const [featId, idx] of this.device.featureIndexMap.entries()) {
            rows.push({
                id: featId,
                name: FEATURE_NAMES[featId] || `Feature 0x${featId.toString(16)}`,
                idx: `0x${idx.toString(16).padStart(2, '0')}`,
                type: (featId >= 0x8000) ? 'Vendor' : 'Standard',
                status: 'Discovered'
            });
        }

        for (const r of rows) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><code>0x${r.id.toString(16).padStart(4, '0')}</code></td>
                <td>${r.name}</td>
                <td><code>${r.idx}</code></td>
                <td>${r.type}</td>
                <td><span class="badge badge-success">${r.status}</span></td>
            `;
            this.featuresTableBody.appendChild(tr);
        }
    }

    emitSimulatedDiscoveryPackets() {
        const simulatedFeatures = [
            { id: 0x0001, idx: 0x01, name: 'IFeatureSet' },
            { id: 0x0003, idx: 0x02, name: 'IDeviceInfo' },
            { id: 0x2201, idx: 0x07, name: 'AdjustableDPI' },
            { id: 0x8061, idx: 0x09, name: 'ReportRate' },
            { id: 0x8070, idx: 0x0D, name: 'ColorLED_RGB' },
            { id: 0x8100, idx: 0x0B, name: 'OnboardProfiles' }
        ];

        let sw = 1;
        for (const feat of simulatedFeatures) {
            const hi = (feat.id >> 8) & 0xFF;
            const lo = feat.id & 0xFF;
            // TX probe
            this.device.emitPacket('TX', 0x10, 0xFF, 0x00, 0x0, sw, [0x10, 0xFF, 0x00, sw, hi, lo, 0x00], `Query Root for 0x${feat.id.toString(16)}`);
            // RX answer
            this.device.emitPacket('RX', 0x10, 0xFF, 0x00, 0x0, sw, [0x10, 0xFF, 0x00, sw, feat.idx, 0x00, 0x01], `Resolved ${feat.name} to Idx 0x0${feat.idx.toString(16)}`);
            sw++;
        }
    }

    /* -------------------------------------------------------------
     * DPI Sensor Controls
     * ------------------------------------------------------------- */

    setDpiState(dpi, updateSlider = false) {
        this.currentDpi = dpi;
        this.dpiDisplayValue.textContent = dpi;
        this.updateGauge(dpi);

        if (updateSlider) {
            this.dpiSlider.value = dpi;
        }

        // Update active preset chip
        this.presetChips.forEach(chip => {
            if (parseInt(chip.dataset.dpi, 10) === dpi) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });

        // Update hex command preview
        const featIdx = this.device.featureIndexMap.get(HIDPP_FEATURES.ADJUSTABLE_DPI) || 0x07;
        const dpiHi = (dpi >> 8) & 0xFF;
        const dpiLo = dpi & 0xFF;
        this.dpiHexPreview.textContent = `TX 0x10 FF ${featIdx.toString(16).padStart(2, '0').toUpperCase()} 31 00 ${dpiHi.toString(16).padStart(2, '0').toUpperCase()} ${dpiLo.toString(16).padStart(2, '0').toUpperCase()} (Fn 0x03 setSensorDPI)`;
    }

    updateGauge(dpi) {
        // Map 100 to 25600 DPI to dashoffset (circumference = 515.2)
        // Logarithmic feel for gaming DPI
        const minLog = Math.log10(100);
        const maxLog = Math.log10(25600);
        const curLog = Math.log10(Math.max(100, Math.min(25600, dpi)));
        const ratio = (curLog - minLog) / (maxLog - minLog);
        
        const circumference = 515.2;
        const offset = circumference - (ratio * circumference * 0.75); // 270 deg sweep
        this.gaugeBar.style.strokeDashoffset = offset;
    }

    async applyDpi(dpi) {
        if (!this.device.isConnected) {
            this.showToast(`Set DPI to ${dpi} (Offline)`, 'info');
            return;
        }

        try {
            if (this.isSimulated) {
                const featIdx = 0x07;
                const dpiHi = (dpi >> 8) & 0xFF;
                const dpiLo = dpi & 0xFF;
                this.device.emitPacket('TX', 0x10, 0xFF, featIdx, 0x03, 0x01, [0x10, 0xFF, featIdx, 0x31, 0x00, dpiHi, dpiLo], `Set Sensor DPI to ${dpi}`);
                this.device.emitPacket('RX', 0x10, 0xFF, featIdx, 0x03, 0x01, [0x10, 0xFF, featIdx, 0x31, 0x00, dpiHi, dpiLo], `Sensor Confirmed ${dpi} DPI`);
                this.showToast(`DPI set to ${dpi} (Simulated)`, 'success');
            } else {
                await this.device.setDpi(dpi);
                this.showToast(`DPI confirmed on hardware: ${dpi}`, 'success');
            }
        } catch (err) {
            console.error(err);
            this.showToast(err.message, 'error');
        }
    }

    /* -------------------------------------------------------------
     * Report Rate / Polling Rate
     * ------------------------------------------------------------- */

    async applyPollingRate(rate) {
        this.currentRate = rate;
        this.rateCards.forEach(card => {
            if (parseInt(card.dataset.rate, 10) === rate) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

        this.pollingBadge.textContent = `${rate} Hz`;

        if (!this.device.isConnected) {
            this.showToast(`Polling Rate set to ${rate} Hz (Offline)`, 'info');
            return;
        }

        const rateMasks = { 1000: 0x01, 500: 0x02, 250: 0x04, 125: 0x08 };
        const mask = rateMasks[rate] || 0x01;
        const featIdx = this.device.featureIndexMap.get(HIDPP_FEATURES.REPORT_RATE) || 0x09;

        try {
            if (this.isSimulated) {
                this.device.emitPacket('TX', 0x10, 0xFF, featIdx, 0x01, 0x01, [0x10, 0xFF, featIdx, 0x11, mask, 0x00, 0x00], `Set Report Rate to ${rate} Hz (Mask: 0x0${mask.toString(16)})`);
                this.device.emitPacket('RX', 0x10, 0xFF, featIdx, 0x01, 0x01, [0x10, 0xFF, featIdx, 0x11, mask, 0x00, 0x00], `Hardware Report Rate Updated`);
                this.showToast(`Polling rate switched to ${rate} Hz (Simulated)`, 'success');
            } else {
                await this.device.setReportRate(rate);
                this.showToast(`Report rate changed to ${rate} Hz`, 'success');
            }
        } catch (err) {
            console.error(err);
            this.showToast(err.message, 'error');
        }
    }

    /* -------------------------------------------------------------
     * Onboard Profiles (0x8100)
     * ------------------------------------------------------------- */

    selectProfileSlot(slot) {
        this.currentSlot = slot;
        this.slotTabs.forEach(t => {
            if (parseInt(t.dataset.slot, 10) === slot) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });

        this.sectorAddr.textContent = `0x000${slot}`;
        this.activeProfileBadge.textContent = `Slot #${slot} Selected`;
    }

    async applyActiveProfile(slot) {
        if (!this.device.isConnected) {
            this.showToast(`Slot #${slot} activated (Offline)`, 'info');
            return;
        }

        const featIdx = this.device.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES) || 0x0B;

        try {
            if (this.isSimulated) {
                this.device.emitPacket('TX', 0x10, 0xFF, featIdx, 0x03, 0x01, [0x10, 0xFF, featIdx, 0x31, 0x00, slot, 0x00], `Switch Active Profile Slot to #${slot}`);
                this.device.emitPacket('RX', 0x10, 0xFF, featIdx, 0x03, 0x01, [0x10, 0xFF, featIdx, 0x31, 0x00, 0x00, 0x00], `Active Sector Loaded`);
                this.activeProfileBadge.textContent = `Slot #${slot} Active`;
                this.showToast(`Active Profile Slot switched to #${slot} (Simulated)`, 'success');
            } else {
                await this.device.setActiveProfile(slot);
                this.activeProfileBadge.textContent = `Slot #${slot} Active`;
                this.showToast(`Active profile changed to Slot #${slot}`, 'success');
            }
        } catch (err) {
            console.error(err);
            this.showToast(err.message, 'error');
        }
    }

    async applyCommitFlash(slot) {
        if (!this.device.isConnected) {
            this.showToast('Device not connected', 'error');
            return;
        }

        const featIdx = this.device.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES) || 0x0B;

        try {
            if (this.isSimulated) {
                this.device.emitPacket('TX', 0x10, 0xFF, featIdx, 0x0C, 0x01, [0x10, 0xFF, featIdx, 0xC1, 0x00, slot, 0x00], `Commit Slot #${slot} to Non-Volatile Flash`);
                this.device.emitPacket('RX', 0x10, 0xFF, featIdx, 0x0C, 0x01, [0x10, 0xFF, featIdx, 0xC1, 0x00, 0x00, 0x00], `Sector Flash Commit Success`);
                this.showToast(`Profile #${slot} committed to Flash EEPROM (Simulated)`, 'success');
            } else {
                await this.device.commitProfileToFlash(slot);
                this.showToast(`Profile #${slot} committed to onboard memory!`, 'success');
            }
        } catch (err) {
            console.error(err);
            this.showToast(err.message, 'error');
        }
    }

    /* -------------------------------------------------------------
     * LIGHTSYNC RGB (0x8070)
     * ------------------------------------------------------------- */

    setColor(hex) {
        this.currentColor = hex;
        this.rgbColorInput.value = hex;
        this.colorHexText.textContent = hex.toUpperCase();
    }

    async applyLighting() {
        const hex = this.currentColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;

        if (!this.device.isConnected) {
            this.showToast(`RGB Color Applied: RGB(${r},${g},${b}) (Offline)`, 'info');
            return;
        }

        const featIdx = this.device.featureIndexMap.get(HIDPP_FEATURES.COLOR_LED) || 0x0D;

        try {
            if (this.isSimulated) {
                const pkt = [0x11, 0xFF, featIdx, 0x31, this.currentZone, this.currentMode, r, g, b, 0x00, 0x64];
                this.device.emitPacket('TX', 0x11, 0xFF, featIdx, 0x03, 0x01, pkt, `Set Zone ${this.currentZone} RGB(${r},${g},${b}) Mode ${this.currentMode}`);
                this.device.emitPacket('RX', 0x11, 0xFF, featIdx, 0x03, 0x01, [0x11, 0xFF, featIdx, 0x31, 0x00, 0x00, 0x00], `Lighting Zone Acknowledged`);
                this.showToast(`RGB Packet Dispatched: Zone ${this.currentZone}`, 'success');
            } else {
                await this.device.setLightingEffect(this.currentZone, this.currentMode, r, g, b);
                // Also update other zone so entire mouse glows in sync
                const otherZone = this.currentZone === 0 ? 1 : 0;
                try {
                    await this.device.setLightingEffect(otherZone, this.currentMode, r, g, b);
                } catch (e) {}
                this.showToast(`Lighting applied & saved to NV Flash (${this.currentColor.toUpperCase()})`, 'success');
            }
        } catch (err) {
            console.error(err);
            this.showToast(err.message, 'error');
        }
    }

    /* -------------------------------------------------------------
     * Live Wire Sniffer / Telemetry Feed
     * ------------------------------------------------------------- */

    handlePacketLogged(pkt) {
        this.packetHistory.push(pkt);
        if (this.packetHistory.length > this.maxPackets) {
            this.packetHistory.shift();
        }

        this.packetCountBadge.textContent = `${this.packetHistory.length} Packets`;

        if (this.isPaused) return;

        const row = document.createElement('div');
        row.className = `packet-row ${pkt.direction.toLowerCase()}`;
        row.innerHTML = `
            <span class="pkt-time">${pkt.timestamp.split(' ')[0] || pkt.timestamp}</span>
            <span class="pkt-dir ${pkt.direction.toLowerCase()}">${pkt.direction}</span>
            <span class="pkt-report">${pkt.reportId}</span>
            <span class="pkt-feat" title="${pkt.featName}">${pkt.featName}</span>
            <span class="pkt-hex" title="${pkt.rawHex}">${pkt.rawHex}</span>
            <span class="pkt-meta" title="${pkt.meta}">${pkt.meta}</span>
        `;

        this.packetStreamFeed.appendChild(row);

        // Keep scroll down
        this.packetStreamFeed.scrollTop = this.packetStreamFeed.scrollHeight;
    }

    exportPackets() {
        const jsonStr = JSON.stringify(this.packetHistory, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logitech_hidpp_telemetry_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Packet capture exported to JSON', 'success');
    }

    /* -------------------------------------------------------------
     * Toast Notifications
     * ------------------------------------------------------------- */

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'error' ? 'toast-error' : (type === 'success' ? 'toast-success' : '')}`;
        
        let iconSvg = '';
        if (type === 'success') {
            iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#00e676" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
        } else if (type === 'error') {
            iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ff1744" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
        } else {
            iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#00e5ff" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
        }

        toast.innerHTML = `${iconSvg} <span>${message}</span>`;
        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AppController();
});
