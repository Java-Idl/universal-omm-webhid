/**
 * Universal OMM (Onboard Memory Manager) - Application Controller
 * Zero-install browser-native peripheral manager using WebHID.
 */

import { 
    HidppDevice, 
    HIDPP_FEATURES, 
    FEATURE_NAMES, 
    PHYSICAL_BUTTONS,
    BUTTON_BEHAVIOR,
    REMAPPING_OPCODES,
    FUNCTION_OPCODES,
    CONSUMER_KEYS
} from './hidpp.js';

class AppController {
    constructor() {
        this.device = new HidppDevice();
        this.isPaused = false;
        this.packetHistory = [];
        this.maxPackets = 500;
        this.isSpyActive = false;

        // DPI State (OMM Multi-Stage Model)
        this.dpiStages = [400, 800, 1600, 3200, 6400];
        this.activeStageIndex = 2; // 1600 DPI
        this.defaultStageIndex = 2;
        this.sniperStageIndex = 0; // 400 DPI
        this.currentRate = 1000;
        this.angleSnapping = false;
        this.separateXY = false;

        // Button Remapping State
        this.physicalButtons = JSON.parse(JSON.stringify(PHYSICAL_BUTTONS));
        this.selectedButtonId = 1;
        this.recordedKey = null;

        // Profiles State
        this.currentSlot = 1;
        this.profileNames = {
            1: 'Default / FPS',
            2: 'MMO / Macros',
            3: 'Sniper Low',
            4: 'Productivity',
            5: 'General'
        };
        this.onboardMode = true;

        // RGB State
        this.currentZone = 0;
        this.currentMode = 1;
        this.currentColor = '#00e5ff';
        this.currentPeriod = 3000;
        this.currentIntensity = 100;

        // Button Remapping Identify Mode
        this.isIdentifyMode = false;

        // Battery State
        this.batteryInfo = { percent: 80, isCharging: false, level: 4 };

        this.initDom();
        this.checkBrowserCompatibility();
        this.bindEvents();
        this.renderDpiStages();
        this.renderPhysicalButtons();
        this.updateGauge(this.dpiStages[this.activeStageIndex]);
        this.updateRgbControlVisibility();
    }

    /* -------------------------------------------------------------
     * DOM Initialization & Compatibility Check
     * ------------------------------------------------------------- */
    initDom() {
        // Browser Warning Modal
        this.browserWarningModal = document.getElementById('browserWarningModal');
        this.detectedBrowserName = document.getElementById('detectedBrowserName');
        this.btnDismissWarning = document.getElementById('btnDismissWarning');

        // Header
        this.statusDot = document.getElementById('statusDot');
        this.statusLabel = document.getElementById('statusLabel');
        this.deviceNameBadge = document.getElementById('deviceNameBadge');
        this.btnConnect = document.getElementById('btnConnect');
        this.btnDisconnect = document.getElementById('btnDisconnect');
        this.batteryPill = document.getElementById('batteryPill');
        this.batteryText = document.getElementById('batteryText');
        this.batteryFillLevel = document.getElementById('batteryFillLevel');
        this.chargingIndicator = document.getElementById('chargingIndicator');

        // Navigation Tabs
        this.navTabs = document.querySelectorAll('.nav-tab');
        this.tabPanes = document.querySelectorAll('.tab-pane');

        // Sensor & DPI Tab
        this.dpiDisplayValue = document.getElementById('dpiDisplayValue');
        this.gaugeBar = document.getElementById('gaugeBar');
        this.dpiSlider = document.getElementById('dpiSlider');
        this.dpiHexPreview = document.getElementById('dpiHexPreview');
        this.dpiFeatureBadge = document.getElementById('dpiFeatureBadge');
        this.dpiStageChipsContainer = document.getElementById('dpiStageChipsContainer');
        this.btnAddDpiStage = document.getElementById('btnAddDpiStage');
        this.btnRemoveDpiStage = document.getElementById('btnRemoveDpiStage');
        this.btnSetDefaultDpi = document.getElementById('btnSetDefaultDpi');
        this.btnSetSniperDpi = document.getElementById('btnSetSniperDpi');
        this.rateCards = document.querySelectorAll('.rate-card');
        this.pollingBadge = document.getElementById('pollingBadge');
        this.chkAngleSnapping = document.getElementById('chkAngleSnapping');
        this.chkSeparateXY = document.getElementById('chkSeparateXY');

        // Buttons & Remapping Tab
        this.physicalButtonList = document.getElementById('physicalButtonList');
        this.buttonSpyBadge = document.getElementById('buttonSpyBadge');
        this.btnToggleSpy = document.getElementById('btnToggleSpy');
        this.btnIdentifyDevice = document.getElementById('btnIdentifyDevice');
        this.btnIdentifyButton = document.getElementById('btnIdentifyButton');
        this.identifyBanner = document.getElementById('identifyBanner');
        this.testerDisplay = document.getElementById('testerDisplay');
        this.selectedButtonTitle = document.getElementById('selectedButtonTitle');
        this.selectedButtonBadge = document.getElementById('selectedButtonBadge');
        this.actionCatTabs = document.querySelectorAll('.action-cat-tab');
        this.actionPanes = document.querySelectorAll('.action-pane');
        this.optButtons = document.querySelectorAll('.opt-btn');
        this.keystrokeInput = document.getElementById('keystrokeInput');
        this.keystrokePreviewText = document.getElementById('keystrokePreviewText');
        this.modCtrl = document.getElementById('modCtrl');
        this.modShift = document.getElementById('modShift');
        this.modAlt = document.getElementById('modAlt');
        this.modWin = document.getElementById('modWin');
        this.btnAssignAction = document.getElementById('btnAssignAction');
        this.btnCommitRemappings = document.getElementById('btnCommitRemappings');

        // Profiles Tab
        this.slotTabs = document.querySelectorAll('.slot-tab');
        this.activeProfileBadge = document.getElementById('activeProfileBadge');
        this.profileNameInput = document.getElementById('profileNameInput');
        this.sectorAddr = document.getElementById('sectorAddr');
        this.btnActivateSlot = document.getElementById('btnActivateSlot');
        this.btnCommitFlash = document.getElementById('btnCommitFlash');
        this.chkOnboardMode = document.getElementById('chkOnboardMode');
        this.onboardModeBadge = document.getElementById('onboardModeBadge');

        // RGB Tab
        this.zonePills = document.querySelectorAll('.zone-pill');
        this.modePills = document.querySelectorAll('.mode-pill');
        this.colorPickerRow = document.getElementById('colorPickerRow');
        this.effectParamBox = document.getElementById('effectParamBox');
        this.periodSlider = document.getElementById('periodSlider');
        this.periodValueBadge = document.getElementById('periodValueBadge');
        this.intensitySlider = document.getElementById('intensitySlider');
        this.intensityValueBadge = document.getElementById('intensityValueBadge');
        this.rgbColorInput = document.getElementById('rgbColorInput');
        this.colorHexText = document.getElementById('colorHexText');
        this.swatches = document.querySelectorAll('.palette-swatches .swatch');
        this.rgbGlowDemo = document.getElementById('rgbGlowDemo');
        this.rgbStatusLabel = document.getElementById('rgbStatusLabel');
        this.btnApplyRgb = document.getElementById('btnApplyRgb');

        // Power Tab
        this.batteryStateBadge = document.getElementById('batteryStateBadge');
        this.wiredPowerNotice = document.getElementById('wiredPowerNotice');
        this.wirelessBatteryGauge = document.getElementById('wirelessBatteryGauge');
        this.metricPowerSource = document.getElementById('metricPowerSource');
        this.metricPowerState = document.getElementById('metricPowerState');
        this.metricBatteryHard = document.getElementById('metricBatteryHard');
        this.batteryBigPercent = document.getElementById('batteryBigPercent');
        this.batteryStatusSub = document.getElementById('batteryStatusSub');
        this.metricChargingState = document.getElementById('metricChargingState');
        this.metricBatteryLevel = document.getElementById('metricBatteryLevel');
        this.metricPowerPlay = document.getElementById('metricPowerPlay');
        this.btnRefreshBattery = document.getElementById('btnRefreshBattery');
        this.pmPills = document.querySelectorAll('.pm-pill');
        this.selSleepTimeout = document.getElementById('selSleepTimeout');

        // Sniffer Tab
        this.btnRefreshDiscovery = document.getElementById('btnRefreshDiscovery');
        this.featuresTableBody = document.getElementById('featuresTableBody');
        this.packetStreamFeed = document.getElementById('packetStreamFeed');
        this.packetCountBadge = document.getElementById('packetCountBadge');
        this.btnPausePackets = document.getElementById('btnPausePackets');
        this.btnClearPackets = document.getElementById('btnClearPackets');
        this.btnExportLog = document.getElementById('btnExportLog');
        this.toastContainer = document.getElementById('toastContainer');
    }

    checkBrowserCompatibility() {
        const hasWebHID = 'hid' in navigator;
        const ua = navigator.userAgent;
        let browserName = 'Chromium';

        if (ua.includes('Firefox')) browserName = 'Mozilla Firefox';
        else if (ua.includes('Safari') && !ua.includes('Chrome')) browserName = 'Apple Safari';
        else if (ua.includes('Edg/')) browserName = 'Microsoft Edge';
        else if (ua.includes('Chrome')) browserName = 'Google Chrome';
        else if (ua.includes('Opera') || ua.includes('OPR')) browserName = 'Opera';

        if (!hasWebHID || browserName === 'Mozilla Firefox' || browserName === 'Apple Safari') {
            this.detectedBrowserName.textContent = browserName;
            this.browserWarningModal.classList.remove('hidden');
            this.btnConnect.disabled = true;
            this.btnConnect.title = 'WebHID is not supported in this browser';
        }
    }

    /* -------------------------------------------------------------
     * Event Listeners & Binding
     * ------------------------------------------------------------- */
    bindEvents() {
        // Warning Modal Dismiss
        this.btnDismissWarning.addEventListener('click', () => {
            this.browserWarningModal.classList.add('hidden');
        });

        // Connectivity
        this.btnConnect.addEventListener('click', () => this.handleConnect());
        this.btnDisconnect.addEventListener('click', () => this.handleDisconnect());

        // Nav Tabs Switching
        this.navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                this.navTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                this.tabPanes.forEach(pane => {
                    if (pane.id === `tab-${target}`) {
                        pane.classList.add('active');
                    } else {
                        pane.classList.remove('active');
                    }
                });
            });
        });

        // Device Packet & Event Streams
        this.device.onPacket((pkt) => this.handlePacketLogged(pkt));
        this.device.onButtonEvent((evt) => this.handleButtonSpyEvent(evt));
        this.device.onBatteryUpdate((b) => this.updateBatteryUI(b));

        // DPI Slider & Presets
        this.dpiSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            this.dpiStages[this.activeStageIndex] = val;
            this.updateActiveDpiDisplay(val);
            this.renderDpiStages();
        });

        this.dpiSlider.addEventListener('change', async (e) => {
            const val = parseInt(e.target.value, 10);
            await this.applyDpi(val);
        });

        this.btnAddDpiStage.addEventListener('click', () => this.addDpiStage());
        this.btnRemoveDpiStage.addEventListener('click', () => this.removeDpiStage());
        this.btnSetDefaultDpi.addEventListener('click', () => {
            this.defaultStageIndex = this.activeStageIndex;
            this.renderDpiStages();
            this.showToast(`DPI ${this.dpiStages[this.activeStageIndex]} set as Default Stage`, 'success');
        });
        this.btnSetSniperDpi.addEventListener('click', () => {
            this.sniperStageIndex = this.activeStageIndex;
            this.renderDpiStages();
            this.showToast(`DPI ${this.dpiStages[this.activeStageIndex]} set as Sniper Shift`, 'success');
        });

        // Polling Rate
        this.rateCards.forEach(card => {
            card.addEventListener('click', () => {
                const rate = parseInt(card.dataset.rate, 10);
                this.applyPollingRate(rate);
            });
        });

        // Sensor Tuning Switches (if present in DOM)
        if (this.chkAngleSnapping) {
            this.chkAngleSnapping.addEventListener('change', async (e) => {
                this.angleSnapping = e.target.checked;
                try {
                    if (this.device.isConnected) {
                        await this.device.setAngleSnapping(this.angleSnapping);
                    }
                    this.showToast(`Angle Snapping: ${this.angleSnapping ? 'Enabled' : 'Disabled'}`, 'info');
                } catch (err) {
                    this.showToast(err.message, 'error');
                }
            });
        }

        if (this.chkSeparateXY) {
            this.chkSeparateXY.addEventListener('change', (e) => {
                this.separateXY = e.target.checked;
                this.showToast(`Independent X/Y DPI: ${this.separateXY ? 'Active' : 'Unified'}`, 'info');
            });
        }

        // Button Remapping Events
        this.actionCatTabs.forEach(catTab => {
            catTab.addEventListener('click', () => {
                const cat = catTab.dataset.cat;
                this.actionCatTabs.forEach(c => c.classList.remove('active'));
                catTab.classList.add('active');

                this.actionPanes.forEach(pane => {
                    if (pane.id === `pane-${cat}`) {
                        pane.classList.add('active');
                    } else {
                        pane.classList.remove('active');
                    }
                });
            });
        });

        this.optButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.optButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Keystroke Recording
        this.keystrokeInput.addEventListener('keydown', (e) => {
            e.preventDefault();
            this.recordedKey = {
                key: e.key.toUpperCase(),
                code: e.keyCode
            };
            this.updateKeystrokeDisplay();
        });

        [this.modCtrl, this.modShift, this.modAlt, this.modWin].forEach(chk => {
            chk.addEventListener('change', () => this.updateKeystrokeDisplay());
        });

        this.btnAssignAction.addEventListener('click', () => this.applyActionAssignment());
        this.btnCommitRemappings.addEventListener('click', () => this.commitAllRemappings());

        this.btnToggleSpy.addEventListener('click', async () => {
            if (!this.device.isConnected) {
                this.showToast('Connect device to use live button tester', 'error');
                return;
            }
            if (!this.isSpyActive) {
                const ok = await this.device.startButtonSpy();
                if (ok) {
                    this.isSpyActive = true;
                    this.buttonSpyBadge.textContent = 'Spy Active (Listening)';
                    this.buttonSpyBadge.classList.add('badge-success');
                    this.btnToggleSpy.textContent = 'Disable Live Spy';
                    this.showToast('Hardware button spy active. Click mouse buttons!', 'success');
                }
            } else {
                await this.device.stopButtonSpy();
                this.isSpyActive = false;
                this.buttonSpyBadge.textContent = 'Spy Inactive';
                this.buttonSpyBadge.classList.remove('badge-success');
                this.btnToggleSpy.textContent = 'Enable Live Spy';
                if (this.isIdentifyMode) {
                    this.isIdentifyMode = false;
                    if (this.btnIdentifyButton) this.btnIdentifyButton.classList.remove('btn-active');
                    if (this.identifyBanner) this.identifyBanner.classList.add('hidden');
                }
                this.showToast('Hardware button spy disabled', 'info');
            }
        });

        // Flash Mouse Peripheral Identification
        if (this.btnIdentifyDevice) {
            this.btnIdentifyDevice.addEventListener('click', async () => {
                if (!this.device.isConnected) {
                    this.showToast('Connect peripheral to flash LEDs', 'error');
                    return;
                }
                try {
                    this.showToast('Flashing peripheral LEDs for hardware identification...', 'info');
                    await this.device.flashIdentify();
                } catch (err) {
                    this.showToast(err.message, 'error');
                }
            });
        }

        // Identify Physical Button via Click
        if (this.btnIdentifyButton) {
            this.btnIdentifyButton.addEventListener('click', async () => {
                if (!this.device.isConnected) {
                    this.showToast('Connect peripheral to identify physical buttons', 'error');
                    return;
                }
                this.isIdentifyMode = !this.isIdentifyMode;
                if (this.isIdentifyMode) {
                    // Automatically activate live spy if not yet running
                    if (!this.isSpyActive) {
                        const ok = await this.device.startButtonSpy();
                        if (ok) {
                            this.isSpyActive = true;
                            this.buttonSpyBadge.textContent = 'Spy Active (Listening)';
                            this.buttonSpyBadge.classList.add('badge-success');
                            this.btnToggleSpy.textContent = 'Disable Live Spy';
                        }
                    }
                    this.btnIdentifyButton.classList.add('btn-active');
                    this.btnIdentifyButton.innerHTML = '⏹ Stop Identify';
                    if (this.identifyBanner) this.identifyBanner.classList.remove('hidden');
                    this.showToast('🎯 Identify Mode Active: Press any physical button on your mouse!', 'info');
                } else {
                    this.btnIdentifyButton.classList.remove('btn-active');
                    this.btnIdentifyButton.innerHTML = '🎯 Identify Button';
                    if (this.identifyBanner) this.identifyBanner.classList.add('hidden');
                    this.showToast('Identify Mode stopped', 'info');
                }
            });
        }

        // Profiles Slot Management
        this.slotTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const slot = parseInt(tab.dataset.slot, 10);
                this.selectProfileSlot(slot);
            });
        });

        this.btnActivateSlot.addEventListener('click', () => this.applyActiveProfile(this.currentSlot));
        this.btnCommitFlash.addEventListener('click', () => this.applyCommitFlash(this.currentSlot));

        this.chkOnboardMode.addEventListener('change', async (e) => {
            this.onboardMode = e.target.checked;
            this.onboardModeBadge.textContent = this.onboardMode ? 'Onboard Mode Active' : 'Software/Host Mode';
            if (this.device.isConnected) {
                await this.device.setOnboardMode(this.onboardMode ? 1 : 2);
            }
            this.showToast(`Operating Mode: ${this.onboardMode ? 'Onboard Memory' : 'Host Mode'}`, 'info');
        });

        this.profileNameInput.addEventListener('input', (e) => {
            this.profileNames[this.currentSlot] = e.target.value;
            const slotTab = document.querySelector(`.slot-tab[data-slot="${this.currentSlot}"] .slot-name`);
            if (slotTab) slotTab.textContent = e.target.value;
        });

        // RGB Lighting
        this.zonePills.forEach(zp => {
            zp.addEventListener('click', () => {
                this.zonePills.forEach(p => p.classList.remove('active'));
                zp.classList.add('active');
                this.currentZone = parseInt(zp.dataset.zone, 10);
            });
        });

        this.modePills.forEach(mp => {
            mp.addEventListener('click', () => {
                this.modePills.forEach(p => p.classList.remove('active'));
                mp.classList.add('active');
                this.currentMode = parseInt(mp.dataset.mode, 10);
                this.updateRgbControlVisibility();
            });
        });

        if (this.periodSlider) {
            this.periodSlider.addEventListener('input', (e) => {
                this.currentPeriod = parseInt(e.target.value, 10);
                if (this.periodValueBadge) {
                    this.periodValueBadge.textContent = `${this.currentPeriod.toLocaleString()} ms (${(this.currentPeriod / 1000).toFixed(1)}s cycle)`;
                }
            });
        }

        if (this.intensitySlider) {
            this.intensitySlider.addEventListener('input', (e) => {
                this.currentIntensity = parseInt(e.target.value, 10);
                if (this.intensityValueBadge) {
                    this.intensityValueBadge.textContent = `${this.currentIntensity}%`;
                }
            });
        }

        this.rgbColorInput.addEventListener('input', (e) => {
            this.setColor(e.target.value);
        });

        this.swatches.forEach(sw => {
            sw.addEventListener('click', () => {
                this.setColor(sw.dataset.color);
            });
        });

        this.btnApplyRgb.addEventListener('click', () => this.applyLighting());

        // Power & Battery Tab
        this.btnRefreshBattery.addEventListener('click', () => this.refreshBatteryStatus());
        this.pmPills.forEach(pm => {
            pm.addEventListener('click', () => {
                this.pmPills.forEach(p => p.classList.remove('active'));
                pm.classList.add('active');
                this.showToast(`Power Mode updated: ${pm.querySelector('.pm-name').textContent}`, 'info');
            });
        });

        // Sniffer Tab
        this.btnRefreshDiscovery.addEventListener('click', () => this.refreshDiscovery());
        this.btnPausePackets.addEventListener('click', () => {
            this.isPaused = !this.isPaused;
            this.btnPausePackets.textContent = this.isPaused ? 'Resume' : 'Pause';
        });
        this.btnClearPackets.addEventListener('click', () => {
            this.packetHistory = [];
            this.packetStreamFeed.innerHTML = '';
            this.packetCountBadge.textContent = '0 Packets';
        });
        this.btnExportLog.addEventListener('click', () => this.exportPackets());
    }

    /* -------------------------------------------------------------
     * Hardware Connection Lifecycle
     * ------------------------------------------------------------- */
    async handleConnect() {
        try {
            this.showToast('Requesting Logitech WebHID device...', 'info');
            const info = await this.device.requestAndOpen();

            this.updateConnectedUI(info.name, `VID: 0x${info.vid.toString(16).toUpperCase()} PID: 0x${info.pid.toString(16).toUpperCase()} (${info.transport})`);
            this.showToast(`Connected: ${info.name}`, 'success');

            await this.syncHardwareState();
        } catch (err) {
            console.error(err);
            this.showToast(err.message || 'Failed to connect WebHID device', 'error');
        }
    }

    async handleDisconnect() {
        await this.device.disconnect();
        this.isSpyActive = false;

        this.statusDot.className = 'status-indicator-dot';
        this.statusLabel.textContent = 'DISCONNECTED';
        this.deviceNameBadge.textContent = 'No Hardware Connected';
        this.btnConnect.classList.remove('hidden');
        this.btnDisconnect.classList.add('hidden');
        this.batteryPill.classList.add('hidden');
        this.dpiFeatureBadge.textContent = 'Awaiting Connection';
        this.dpiFeatureBadge.classList.remove('badge-success');
        this.buttonSpyBadge.textContent = 'Spy Inactive';
        this.buttonSpyBadge.classList.remove('badge-success');

        this.showToast('Peripheral disconnected', 'info');
    }

    updateConnectedUI(name, subtitle) {
        this.statusDot.className = 'status-indicator-dot connected';
        this.statusLabel.textContent = 'CONNECTED';
        this.deviceNameBadge.textContent = name;
        this.btnConnect.classList.add('hidden');
        this.btnDisconnect.classList.remove('hidden');
    }

    async syncHardwareState() {
        this.updateFeaturesTable();

        // 1. Check DPI Feature (0x2201)
        const dpiIdx = this.device.featureIndexMap.get(HIDPP_FEATURES.ADJUSTABLE_DPI);
        if (dpiIdx) {
            this.dpiFeatureBadge.textContent = `0x2201 Active (Idx 0x${dpiIdx.toString(16).padStart(2, '0')})`;
            this.dpiFeatureBadge.classList.add('badge-success');
            try {
                const dpiData = await this.device.getDpi();
                this.dpiStages[this.activeStageIndex] = dpiData.dpi;
                this.updateActiveDpiDisplay(dpiData.dpi);
                this.renderDpiStages();
            } catch (e) {}
        }

        // 2. Query Battery Status (0x1004 / 0x1000)
        const hasBatt = this.device.featureIndexMap.has(HIDPP_FEATURES.BATTERY_STATUS) || 
                        this.device.featureIndexMap.has(HIDPP_FEATURES.UNIFIED_BATTERY);
        if (!hasBatt) {
            // Corded USB bus-powered device (e.g. G502 HERO Wired)
            this.batteryPill.classList.add('hidden');
            if (this.wiredPowerNotice) this.wiredPowerNotice.classList.remove('hidden');
            if (this.wirelessBatteryGauge) this.wirelessBatteryGauge.classList.add('hidden');
            if (this.batteryStateBadge) {
                this.batteryStateBadge.textContent = 'USB Bus Powered (5V)';
                this.batteryStateBadge.className = 'card-badge badge-success';
            }
            if (this.metricPowerSource) this.metricPowerSource.textContent = 'USB 5V Continuous Bus';
            if (this.metricPowerState) this.metricPowerState.textContent = 'Continuous 1000 Hz';
            if (this.metricBatteryHard) this.metricBatteryHard.textContent = 'Corded USB (No Battery)';
        } else {
            if (this.wiredPowerNotice) this.wiredPowerNotice.classList.add('hidden');
            if (this.wirelessBatteryGauge) this.wirelessBatteryGauge.classList.remove('hidden');
            await this.refreshBatteryStatus();
        }

        // 3. Query Active Profile Slot (0x8100)
        const profilesIdx = this.device.featureIndexMap.get(HIDPP_FEATURES.ONBOARD_PROFILES);
        if (profilesIdx) {
            try {
                const activeSlot = await this.device.getActiveProfile();
                if (activeSlot >= 1 && activeSlot <= 5) {
                    this.selectProfileSlot(activeSlot);
                }
                const mode = await this.device.getOnboardMode();
                this.onboardMode = (mode === 1);
                this.chkOnboardMode.checked = this.onboardMode;
                this.onboardModeBadge.textContent = this.onboardMode ? 'Onboard Mode Active' : 'Software/Host Mode';
            } catch (e) {}
        }

        // 4. Query Button Remappings (0x8110)
        const spyIdx = this.device.featureIndexMap.get(HIDPP_FEATURES.BUTTON_SPY);
        if (spyIdx) {
            try {
                const remappings = await this.device.getButtonRemappings();
                if (remappings && remappings.length >= 11) {
                    // Sync physical buttons
                    for (let i = 0; i < 11; i++) {
                        const val = remappings[i];
                        if (val > 0) {
                            this.physicalButtons[i].defaultAction = {
                                behavior: 0x80,
                                type: 'mouse',
                                value: val,
                                label: `Assigned (0x0${val.toString(16)})`
                            };
                        }
                    }
                    this.renderPhysicalButtons();
                }
            } catch (e) {}
        }
    }

    /* -------------------------------------------------------------
     * Battery Telemetry
     * ------------------------------------------------------------- */
    async refreshBatteryStatus() {
        if (!this.device.isConnected) return;
        try {
            const b = await this.device.getBatteryStatus();
            this.updateBatteryUI(b);
        } catch (e) {}
    }

    updateBatteryUI(b) {
        if (!b || !b.isSupported) {
            this.batteryPill.classList.add('hidden');
            if (this.wiredPowerNotice) this.wiredPowerNotice.classList.remove('hidden');
            if (this.wirelessBatteryGauge) this.wirelessBatteryGauge.classList.add('hidden');
            if (this.batteryStateBadge) this.batteryStateBadge.textContent = 'USB Bus Powered (5V)';
            return;
        }

        if (this.wiredPowerNotice) this.wiredPowerNotice.classList.add('hidden');
        if (this.wirelessBatteryGauge) this.wirelessBatteryGauge.classList.remove('hidden');

        this.batteryInfo = b;
        this.batteryPill.classList.remove('hidden');
        this.batteryText.textContent = `${b.percent}%`;
        this.batteryFillLevel.style.width = `${Math.min(100, Math.max(5, b.percent))}%`;

        if (b.isCharging) {
            this.chargingIndicator.classList.remove('hidden');
        } else {
            this.chargingIndicator.classList.add('hidden');
        }

        // Power Tab details
        if (this.batteryBigPercent) this.batteryBigPercent.textContent = `${b.percent}%`;
        if (this.batteryStatusSub) this.batteryStatusSub.textContent = b.isCharging ? 'Charging' : 'Discharging';
        if (this.batteryStateBadge) {
            this.batteryStateBadge.textContent = b.isCharging ? 'Charging' : `${b.percent}% Battery`;
            this.batteryStateBadge.className = 'card-badge badge-cyan';
        }
        if (this.metricChargingState) this.metricChargingState.textContent = b.isCharging ? (b.isWirelessPowerPlay ? 'Wireless (PowerPlay)' : 'Charging via USB') : 'Discharging';
        if (this.metricBatteryLevel) this.metricBatteryLevel.textContent = b.level === 8 ? 'Full' : (b.level === 4 ? 'Good' : (b.level === 2 ? 'Low' : 'Critical'));
        if (this.metricPowerPlay) this.metricPowerPlay.textContent = b.isWirelessPowerPlay ? 'Active (Pad Powered)' : 'Inactive';
        if (this.metricPowerSource) this.metricPowerSource.textContent = b.isWirelessPowerPlay ? 'PowerPlay Pad' : (b.isCharging ? 'USB Cable' : 'Internal LiPo');
        if (this.metricBatteryHard) this.metricBatteryHard.textContent = 'Wireless Lightspeed Rechargeable';
    }

    /* -------------------------------------------------------------
     * Multi-Stage DPI Sensor Management
     * ------------------------------------------------------------- */
    renderDpiStages() {
        this.dpiStageChipsContainer.innerHTML = '';
        this.dpiStages.forEach((dpi, idx) => {
            const chip = document.createElement('div');
            chip.className = `dpi-stage-chip ${idx === this.activeStageIndex ? 'active' : ''} ${idx === this.defaultStageIndex ? 'is-default' : ''} ${idx === this.sniperStageIndex ? 'is-sniper' : ''}`;
            
            let tagText = '';
            if (idx === this.defaultStageIndex && idx === this.sniperStageIndex) tagText = 'Default & Shift';
            else if (idx === this.defaultStageIndex) tagText = 'Default';
            else if (idx === this.sniperStageIndex) tagText = 'Shift';

            chip.innerHTML = `
                <span class="stage-num">STAGE ${idx + 1}</span>
                <span class="stage-val">${dpi}</span>
                ${tagText ? `<span class="stage-tag">${tagText}</span>` : ''}
            `;

            chip.addEventListener('click', async () => {
                this.activeStageIndex = idx;
                this.updateActiveDpiDisplay(dpi);
                this.renderDpiStages();
                await this.applyDpi(dpi);
            });

            this.dpiStageChipsContainer.appendChild(chip);
        });
    }

    addDpiStage() {
        if (this.dpiStages.length >= 5) {
            this.showToast('Maximum 5 DPI stages supported', 'error');
            return;
        }
        const lastVal = this.dpiStages[this.dpiStages.length - 1];
        const nextVal = Math.min(25600, lastVal + 800);
        this.dpiStages.push(nextVal);
        this.activeStageIndex = this.dpiStages.length - 1;
        this.updateActiveDpiDisplay(nextVal);
        this.renderDpiStages();
        this.showToast(`Added DPI Stage ${this.dpiStages.length}: ${nextVal} DPI`, 'success');
    }

    removeDpiStage() {
        if (this.dpiStages.length <= 1) {
            this.showToast('Minimum 1 DPI stage required', 'error');
            return;
        }
        this.dpiStages.pop();
        if (this.activeStageIndex >= this.dpiStages.length) {
            this.activeStageIndex = this.dpiStages.length - 1;
        }
        this.updateActiveDpiDisplay(this.dpiStages[this.activeStageIndex]);
        this.renderDpiStages();
        this.showToast(`Removed stage. ${this.dpiStages.length} stages remaining`, 'info');
    }

    updateActiveDpiDisplay(dpi) {
        this.dpiDisplayValue.textContent = dpi;
        this.dpiSlider.value = dpi;
        this.updateGauge(dpi);

        const featIdx = this.device.featureIndexMap.get(HIDPP_FEATURES.ADJUSTABLE_DPI) || 0x07;
        const dpiHi = (dpi >> 8) & 0xFF;
        const dpiLo = dpi & 0xFF;
        this.dpiHexPreview.textContent = `TX 0x10 FF ${featIdx.toString(16).padStart(2, '0').toUpperCase()} 31 00 ${dpiHi.toString(16).padStart(2, '0').toUpperCase()} ${dpiLo.toString(16).padStart(2, '0').toUpperCase()} (Fn 0x03 setSensorDPI)`;
    }

    updateGauge(dpi) {
        const minLog = Math.log10(100);
        const maxLog = Math.log10(25600);
        const curLog = Math.log10(Math.max(100, Math.min(25600, dpi)));
        const ratio = (curLog - minLog) / (maxLog - minLog);
        
        const circumference = 515.2;
        const offset = circumference - (ratio * circumference * 0.75);
        this.gaugeBar.style.strokeDashoffset = offset;
    }

    async applyDpi(dpi) {
        if (!this.device.isConnected) return;
        try {
            await this.device.setDpi(dpi);
            this.showToast(`DPI confirmed on hardware: ${dpi}`, 'success');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    async applyPollingRate(rate) {
        this.currentRate = rate;
        this.rateCards.forEach(card => {
            if (parseInt(card.dataset.rate, 10) === rate) card.classList.add('active');
            else card.classList.remove('active');
        });
        this.pollingBadge.textContent = `${rate} Hz`;

        if (!this.device.isConnected) return;
        try {
            await this.device.setReportRate(rate);
            this.showToast(`Report rate changed to ${rate} Hz`, 'success');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    /* -------------------------------------------------------------
     * Physical Button Remapping & Wire Spy
     * ------------------------------------------------------------- */
    renderPhysicalButtons() {
        this.physicalButtonList.innerHTML = '';
        this.physicalButtons.forEach(btn => {
            const item = document.createElement('div');
            item.className = `btn-remap-item ${btn.id === this.selectedButtonId ? 'active' : ''}`;
            item.id = `btn-remap-${btn.id}`;
            item.innerHTML = `
                <span class="btn-remap-name">${btn.name}</span>
                <span class="btn-remap-action-badge">${btn.defaultAction.label}</span>
            `;

            item.addEventListener('click', () => {
                this.selectedButtonId = btn.id;
                this.selectedButtonTitle.textContent = `${btn.name} Assignment`;
                this.selectedButtonBadge.textContent = btn.defaultAction.label;
                this.renderPhysicalButtons();
            });

            this.physicalButtonList.appendChild(item);
        });
    }

    handleButtonSpyEvent(evt) {
        const rawStatus = evt.rawStatus;
        this.testerDisplay.textContent = `Raw Status: 0x${rawStatus.toString(16).padStart(4, '0').toUpperCase()} (${evt.data.map(b => b.toString(16).padStart(2,'0')).join(' ')})`;

        let pressedBtnId = null;

        for (let i = 0; i < 16; i++) {
            const isDown = ((rawStatus >> i) & 1) === 1;
            const btnEl = document.getElementById(`btn-remap-${i + 1}`);
            if (btnEl) {
                if (isDown) {
                    btnEl.classList.add('testing');
                    if (pressedBtnId === null) pressedBtnId = i + 1;
                } else {
                    btnEl.classList.remove('testing');
                }
            }
        }

        // Automatic Button Identification Mode
        if (this.isIdentifyMode && pressedBtnId !== null) {
            const targetBtn = this.physicalButtons.find(b => b.id === pressedBtnId);
            if (targetBtn) {
                this.selectedButtonId = pressedBtnId;
                this.selectedButtonTitle.textContent = `${targetBtn.name} Assignment`;
                this.selectedButtonBadge.textContent = targetBtn.defaultAction.label;
                this.renderPhysicalButtons();

                const targetEl = document.getElementById(`btn-remap-${pressedBtnId}`);
                if (targetEl) {
                    targetEl.classList.add('identified-flash');
                    setTimeout(() => targetEl.classList.remove('identified-flash'), 1200);
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }

                this.showToast(`🎯 Identified Button: ${targetBtn.name} (Hardware ID ${pressedBtnId})`, 'success');
            }
        }
    }

    updateKeystrokeDisplay() {
        let text = '';
        if (this.modCtrl.checked) text += 'Ctrl + ';
        if (this.modShift.checked) text += 'Shift + ';
        if (this.modAlt.checked) text += 'Alt + ';
        if (this.modWin.checked) text += 'Win + ';
        text += this.recordedKey ? this.recordedKey.key : 'None';
        this.keystrokeInput.value = this.recordedKey ? this.recordedKey.key : '';
        this.keystrokePreviewText.textContent = `Assigned: ${text}`;
    }

    applyActionAssignment() {
        const activeCatTab = document.querySelector('.action-cat-tab.active');
        const cat = activeCatTab ? activeCatTab.dataset.cat : 'mouse';
        const targetBtn = this.physicalButtons.find(b => b.id === this.selectedButtonId);
        if (!targetBtn) return;

        let actionObj = null;

        if (cat === 'keystroke') {
            if (!this.recordedKey) {
                this.showToast('Please press a keyboard key first', 'error');
                return;
            }
            let label = '';
            if (this.modCtrl.checked) label += 'Ctrl+';
            if (this.modShift.checked) label += 'Shift+';
            if (this.modAlt.checked) label += 'Alt+';
            if (this.modWin.checked) label += 'Win+';
            label += this.recordedKey.key;
            actionObj = { behavior: 0x80, type: 'key', value: this.recordedKey.code, label };
        } else {
            const activeOpt = document.querySelector('.action-pane.active .opt-btn.active');
            if (activeOpt) {
                actionObj = {
                    behavior: activeOpt.dataset.action === 'mouse' ? 0x80 : 0x90,
                    type: activeOpt.dataset.action,
                    value: parseInt(activeOpt.dataset.val, 10),
                    label: activeOpt.textContent.trim()
                };
            }
        }

        if (actionObj) {
            targetBtn.defaultAction = actionObj;
            this.selectedButtonBadge.textContent = actionObj.label;
            this.renderPhysicalButtons();
            this.showToast(`Assigned "${actionObj.label}" to ${targetBtn.name}`, 'success');
        }
    }

    async commitAllRemappings() {
        if (!this.device.isConnected) {
            this.showToast('Connect peripheral to commit remappings to hardware', 'error');
            return;
        }

        // Prepare 16-element remapping array
        const mapArray = new Array(16).fill(0);
        for (let i = 0; i < this.physicalButtons.length && i < 16; i++) {
            const act = this.physicalButtons[i].defaultAction;
            mapArray[i] = act.value || (i + 1);
        }

        try {
            await this.device.setButtonRemappings(mapArray);
            await this.device.commitProfileToFlash(this.currentSlot);
            this.showToast('Remappings committed to onboard EEPROM flash!', 'success');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    /* -------------------------------------------------------------
     * Profiles Management
     * ------------------------------------------------------------- */
    selectProfileSlot(slot) {
        this.currentSlot = slot;
        this.slotTabs.forEach(t => {
            if (parseInt(t.dataset.slot, 10) === slot) t.classList.add('active');
            else t.classList.remove('active');
        });

        this.sectorAddr.textContent = `0x000${slot}`;
        this.activeProfileBadge.textContent = `Slot #${slot} Active`;
        this.profileNameInput.value = this.profileNames[slot] || `Profile ${slot}`;
    }

    async applyActiveProfile(slot) {
        if (!this.device.isConnected) {
            this.showToast(`Slot #${slot} selected`, 'info');
            return;
        }
        try {
            await this.device.setActiveProfile(slot);
            this.selectProfileSlot(slot);
            this.showToast(`Hardware profile switched to Slot #${slot}`, 'success');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    async applyCommitFlash(slot) {
        if (!this.device.isConnected) {
            this.showToast('Connect device first', 'error');
            return;
        }
        try {
            await this.device.commitProfileToFlash(slot);
            this.showToast(`Profile #${slot} successfully written to EEPROM flash!`, 'success');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    /* -------------------------------------------------------------
     * LIGHTSYNC RGB Studio
     * ------------------------------------------------------------- */
    updateRgbControlVisibility() {
        if (!this.colorPickerRow || !this.effectParamBox) return;

        // Mode 0: Off, 1: Static, 2: Breathing, 3: Color Cycle
        if (this.currentMode === 0) {
            this.colorPickerRow.style.display = 'none';
            this.effectParamBox.style.display = 'none';
            this.rgbStatusLabel.textContent = 'Active: LEDs Disabled (Off)';
            this.rgbGlowDemo.style.background = '#1a1d24';
            this.rgbGlowDemo.style.boxShadow = 'none';
        } else if (this.currentMode === 1) {
            // Static
            this.colorPickerRow.style.display = 'block';
            this.effectParamBox.style.display = 'block';
            if (this.periodSlider) this.periodSlider.closest('.slider-param-row').style.display = 'none';
            if (this.intensitySlider) this.intensitySlider.closest('.slider-param-row').style.display = 'block';
            this.setColor(this.currentColor);
        } else if (this.currentMode === 2) {
            // Breathing
            this.colorPickerRow.style.display = 'block';
            this.effectParamBox.style.display = 'block';
            if (this.periodSlider) this.periodSlider.closest('.slider-param-row').style.display = 'block';
            if (this.intensitySlider) this.intensitySlider.closest('.slider-param-row').style.display = 'block';
            this.setColor(this.currentColor);
        } else if (this.currentMode === 3) {
            // Color Cycle (Autonomous Spectrum Sweep)
            this.colorPickerRow.style.display = 'none';
            this.effectParamBox.style.display = 'block';
            if (this.periodSlider) this.periodSlider.closest('.slider-param-row').style.display = 'block';
            if (this.intensitySlider) this.intensitySlider.closest('.slider-param-row').style.display = 'block';
            this.rgbStatusLabel.textContent = `Active: Full Spectrum Rainbow Cycle (${(this.currentPeriod/1000).toFixed(1)}s Period)`;
            this.rgbGlowDemo.style.background = 'linear-gradient(135deg, #ff0055, #ffb300, #00e676, #00e5ff, #7c4dff)';
            this.rgbGlowDemo.style.boxShadow = '0 0 25px rgba(0, 229, 255, 0.4)';
        }
    }

    setColor(hex) {
        this.currentColor = hex;
        if (this.rgbColorInput) this.rgbColorInput.value = hex;
        if (this.colorHexText) this.colorHexText.textContent = hex.toUpperCase();
        if (this.rgbGlowDemo && this.currentMode !== 3 && this.currentMode !== 0) {
            this.rgbGlowDemo.style.background = hex;
            this.rgbGlowDemo.style.boxShadow = `0 0 20px ${hex}`;
        }
        if (this.rgbStatusLabel && this.currentMode !== 3 && this.currentMode !== 0) {
            this.rgbStatusLabel.textContent = `Active: ${hex.toUpperCase()}`;
        }
    }

    async applyLighting() {
        const hex = this.currentColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;

        const modeNames = { 0: 'Off', 1: 'Static Color', 2: 'Breathing', 3: 'Color Cycle' };
        const modeLabel = modeNames[this.currentMode] || `Mode ${this.currentMode}`;

        if (!this.device.isConnected) {
            this.showToast(`RGB Effect: ${modeLabel} (Offline Preview)`, 'info');
            return;
        }

        try {
            // Send to current zone with frequency (periodMs) and intensity
            await this.device.setLightingEffect(
                this.currentZone, 
                this.currentMode, 
                r, g, b, 
                this.currentPeriod, 
                this.currentIntensity
            );

            // Also mirror effect to the other zone so all device LEDs stay in sync
            const otherZone = this.currentZone === 0 ? 1 : 0;
            try { 
                await this.device.setLightingEffect(
                    otherZone, 
                    this.currentMode, 
                    r, g, b, 
                    this.currentPeriod, 
                    this.currentIntensity
                ); 
            } catch (e) {}

            this.showToast(`Lighting applied & saved to NV Flash (${modeLabel}, ${this.currentPeriod}ms)`, 'success');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    /* -------------------------------------------------------------
     * Telemetry & Packet Logger
     * ------------------------------------------------------------- */
    async refreshDiscovery() {
        if (!this.device.isConnected) {
            this.showToast('Connect device first', 'error');
            return;
        }
        this.showToast('Probing IRoot (0x0000)...', 'info');
        await this.device.discoverFeatures();
        this.updateFeaturesTable();
        this.showToast('Feature Discovery completed', 'success');
    }

    updateFeaturesTable() {
        this.featuresTableBody.innerHTML = '';
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

    handlePacketLogged(pkt) {
        this.packetHistory.push(pkt);
        if (this.packetHistory.length > this.maxPackets) this.packetHistory.shift();
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

document.addEventListener('DOMContentLoaded', () => {
    window.app = new AppController();
});
