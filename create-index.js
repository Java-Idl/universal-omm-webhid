/**
 * Node.js CLI to update lol-spa/index.html with a custom multiline macro script.
 * Usage:
 *   node create-index.js
 *   node create-index.js "STRING git pull\nENTER" 2
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HID_MODIFIERS = {
    CTRL: 0x01, STRG: 0x01, LCTRL: 0x01,
    SHIFT: 0x02, LSHIFT: 0x02,
    ALT: 0x04, LALT: 0x04,
    WIN: 0x08, WINDOWS: 0x08, CMD: 0x08, COMMAND: 0x08, GUI: 0x08, LGUI: 0x08,
    RCTRL: 0x10, RSHIFT: 0x20, RALT: 0x40, RWIN: 0x80
};

const HID_KEY_CODES = {
    NONE: 0,
    A: 4, B: 5, C: 6, D: 7, E: 8, F: 9, G: 10, H: 11, I: 12, J: 13,
    K: 14, L: 15, M: 16, N: 17, O: 18, P: 19, Q: 20, R: 21, S: 22,
    T: 23, U: 24, V: 25, W: 26, X: 27, Y: 28, Z: 29,
    '1': 30, '2': 31, '3': 32, '4': 33, '5': 34, '6': 35, '7': 36, '8': 37, '9': 38, '0': 39,
    ENTER: 40, RETURN: 40, ESCAPE: 41, ESC: 41, BACKSPACE: 42,
    TAB: 43, SPACE: 44, MINUS: 45, '-': 45, EQUAL: 46, '=': 46,
    LBRACKET: 47, RBRACKET: 48, BSLASH: 49, SEMICOLON: 51, QUOTE: 52,
    COMMA: 54, DOT: 55, SLASH: 56, CAPSLOCK: 57,
    F1: 58, F2: 59, F3: 60, F4: 61, F5: 62, F6: 63, F7: 64, F8: 65, F9: 66, F10: 67, F11: 68, F12: 69,
    PRINTSCREEN: 70, DELETE: 76, HOME: 74, END: 77, PAGEUP: 75, PAGEDOWN: 78,
    RIGHT: 79, LEFT: 80, DOWN: 81, UP: 82
};

function compileMacroScript(scriptText) {
    const bytes = [];
    const lines = scriptText.split('\n');

    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#') || line.startsWith('//')) continue;

        if (/^(TYPE|STRING)\s+/i.test(line)) {
            const str = line.replace(/^(TYPE|STRING)\s+/i, '');
            for (let char of str) {
                const upper = char.toUpperCase();
                let mod = 0x00, key = 0;
                if (char >= 'A' && char <= 'Z') {
                    mod = 0x02; key = upper.charCodeAt(0) - 'A'.charCodeAt(0) + 4;
                } else if (char >= 'a' && char <= 'z') {
                    key = upper.charCodeAt(0) - 'A'.charCodeAt(0) + 4;
                } else if (char >= '1' && char <= '9') {
                    key = char.charCodeAt(0) - '1'.charCodeAt(0) + 30;
                } else if (char === '0') key = 39;
                else if (char === ' ') key = 44;
                else if (char === '.') key = 55;
                else if (char === ',') key = 54;
                else if (char === '-') key = 45;
                else if (char === '_') { mod = 0x02; key = 45; }
                else if (char === '/') key = 56;
                else key = HID_KEY_CODES[upper] || 0;

                if (key > 0) {
                    bytes.push(0x43, mod, key);
                    bytes.push(0x40, 0x00, 0x14);
                    bytes.push(0x44, mod, key);
                    bytes.push(0x40, 0x00, 0x14);
                }
            }
            continue;
        }

        if (/^(DELAY|WAIT|SLEEP)\b/i.test(line)) {
            const ms = parseInt(line.split(/\s+/)[1], 10) || 100;
            const clamped = Math.min(Math.max(ms, 1), 65535);
            bytes.push(0x40, (clamped >> 8) & 0xFF, clamped & 0xFF);
            continue;
        }

        if (/^(DOWN|PRESS)\s+/i.test(line)) {
            const target = line.replace(/^(DOWN|PRESS)\s+/i, '').trim().toUpperCase();
            if (target in HID_MODIFIERS) bytes.push(0x43, HID_MODIFIERS[target], 0x00);
            else if (target in HID_KEY_CODES) bytes.push(0x43, 0x00, HID_KEY_CODES[target]);
            continue;
        }

        if (/^(UP|RELEASE)\s+/i.test(line)) {
            const target = line.replace(/^(UP|RELEASE)\s+/i, '').trim().toUpperCase();
            if (target in HID_MODIFIERS) bytes.push(0x44, HID_MODIFIERS[target], 0x00);
            else if (target in HID_KEY_CODES) bytes.push(0x44, 0x00, HID_KEY_CODES[target]);
            continue;
        }

        const tokens = line.split(/\s+/);
        let modMask = 0x00, keyToken = null;
        for (const t of tokens) {
            const u = t.toUpperCase();
            if (u in HID_MODIFIERS) modMask |= HID_MODIFIERS[u];
            else if (u in HID_KEY_CODES) keyToken = u;
        }
        const kCode = keyToken ? HID_KEY_CODES[keyToken] : 0;
        if (kCode > 0 || modMask > 0) {
            bytes.push(0x43, modMask, kCode);
            bytes.push(0x40, 0x00, 0x28);
            bytes.push(0x44, modMask, kCode);
        }
    }

    bytes.push(0xFF);
    return new Uint8Array(bytes);
}

const inputScript = process.argv[2] || `STRING lol\nENTER`;
const targetBtnId = parseInt(process.argv[3], 10) || 2;

console.log(`Compiling Macro:\n---\n${inputScript}\n---`);
const bytecode = compileMacroScript(inputScript);
console.log(`Bytecode size: ${bytecode.length} bytes (max 253)`);
if (bytecode.length > 253) {
    console.error('Error: Macro bytecode exceeds 253 bytes.');
    process.exit(1);
}

const hexArray = Array.from(bytecode).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ');

const template = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>lol</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #0d0d0d; color: #eee; font-family: monospace; height: 100vh; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        #c { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 1; pointer-events: none; }
        #ui { position: relative; z-index: 2; display: flex; flex-direction: column; gap: 12px; width: 320px; }
        #b { background: #ff2a5f; color: #fff; border: none; padding: 12px; font-size: 16px; font-family: monospace; font-weight: bold; cursor: pointer; border-radius: 4px; }
        #b:hover { background: #ff104a; }
        #b:disabled { opacity: 0.5; cursor: not-allowed; }
        #s { font-size: 12px; color: #888; min-height: 16px; }
        #s.ok { color: #00ff66; }
        #s.err { color: #ff3333; }
        #t { background: #1a1a1a; border: 1px solid #333; color: #fff; padding: 10px; font-size: 14px; font-family: monospace; outline: none; border-radius: 4px; }
        #t:focus { border-color: #ff2a5f; }
    </style>
</head>
<body>
    <canvas id="c"></canvas>
    <div id="ui">
        <button id="b">connect</button>
        <div id="s"></div>
        <input type="text" id="t" spellcheck="false" autocomplete="off" placeholder="test right click here...">
    </div>

    <script>
        const c = document.getElementById('c'), ctx = c.getContext('2d');
        let w = c.width = window.innerWidth, h = c.height = window.innerHeight;
        window.onresize = () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; };

        const colors = ['#00ff66', '#ff2a5f', '#00f0ff', '#ffff00', '#ffffff', '#ff8800'];
        const words = ['lol', 'LOL', 'lmao'];
        const lols = Array.from({ length: 32 }, () => ({
            x: Math.random() * w, y: Math.random() * h,
            vx: (Math.random() - 0.5) * 8 + (Math.random() > 0.5 ? 2.5 : -2.5),
            vy: (Math.random() - 0.5) * 8 + (Math.random() > 0.5 ? 2.5 : -2.5),
            size: Math.floor(Math.random() * 24 + 14),
            color: colors[Math.floor(Math.random() * colors.length)],
            text: words[Math.floor(Math.random() * words.length)]
        }));

        function draw() {
            ctx.clearRect(0, 0, w, h);
            for (const p of lols) {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0 || p.x > w) p.vx *= -1;
                if (p.y < 0 || p.y > h) p.vy *= -1;
                ctx.font = \`bold \${p.size}px monospace\`;
                ctx.fillStyle = p.color;
                ctx.fillText(p.text, p.x, p.y);
            }
            requestAnimationFrame(draw);
        }
        draw();

        function crcCcitt(data, length = 253) {
            let crc = 0xFFFF;
            for (let i = 0; i < length; i++) {
                crc ^= (data[i] << 8);
                for (let j = 0; j < 8; j++) {
                    crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
                    crc &= 0xFFFF;
                }
            }
            return crc;
        }

        const DEFAULT_G502_PROFILE_SECTOR = new Uint8Array([
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
            0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x3A, 0x43, 0xFF
        ]);

        function buildProfileSector(targetBtnId = ${targetBtnId}) {
            const sector = new Uint8Array(DEFAULT_G502_PROFILE_SECTOR);
            const offset = 32 + (targetBtnId - 1) * 4;
            sector[offset + 0] = 0x00;
            sector[offset + 1] = 0x06;
            sector[offset + 2] = 0x00;
            sector[offset + 3] = 0x00;
            const crc = crcCcitt(sector, 253);
            sector[253] = (crc >> 8) & 0xFF;
            sector[254] = crc & 0xFF;
            sector[255] = 0xFF;
            return sector;
        }

        const TARGET_BYTECODE = new Uint8Array([${hexArray}]);

        class HIDPP {
            constructor() {
                this.writeDevice = null;
                this.readDevice = null;
                this.pending = new Map();
                this.featMap = new Map();
                this.swId = 0x01;
            }

            async requestAndOpen() {
                if (!navigator.hid) throw new Error('WebHID unavailable. Must be on HTTPS.');
                const requested = await navigator.hid.requestDevice({ filters: [{ vendorId: 0x046D }] });
                if (!requested || requested.length === 0) throw new Error('No device selected');

                const allGranted = await navigator.hid.getDevices();
                const logi = allGranted.filter(d => d.vendorId === 0x046D);
                const devList = logi.length > 0 ? logi : requested;

                for (const dev of devList) {
                    if (!dev.opened) await dev.open();
                    for (const col of dev.collections) {
                        if (col.usagePage === 0xFF00) {
                            if (col.usage === 0x0001) this.writeDevice = dev;
                            if (col.usage === 0x0002) this.readDevice = dev;
                        }
                    }
                }
                if (!this.writeDevice && devList.length > 0) this.writeDevice = devList[0];
                if (!this.readDevice && devList.length > 0) this.readDevice = devList[0];

                const unique = new Set([this.writeDevice, this.readDevice].filter(Boolean));
                for (const d of unique) d.addEventListener('inputreport', e => this.handleReport(e));
                await this.resolveFeatures();
            }

            handleReport(e) {
                const u8 = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength);
                if (u8.length < 3) return;
                const devIdx = u8[0], featIdx = u8[1], fnSw = u8[2];
                const fnId = (fnSw >> 4) & 0x0F, swId = fnSw & 0x0F;

                if (featIdx === 0xFF && u8.length >= 5) {
                    const errFeat = u8[2], errFn = (u8[3] >> 4) & 0x0F, errSw = u8[3] & 0x0F;
                    const key = \`\${errFeat}_\${errFn}_\${errSw}\`, wildcard = \`\${errFeat}_\${errFn}\`;
                    const target = this.pending.get(key) || this.pending.get(wildcard);
                    if (target) {
                        clearTimeout(target.timer);
                        this.pending.delete(key); this.pending.delete(wildcard);
                        target.reject(new Error(\`Hardware error 0x\${u8[4].toString(16)}\`));
                    }
                    return;
                }

                const key = \`\${featIdx}_\${fnId}_\${swId}\`, wildcard = \`\${featIdx}_\${fnId}\`;
                const target = this.pending.get(key) || this.pending.get(wildcard);
                if (target) {
                    clearTimeout(target.timer);
                    this.pending.delete(key); this.pending.delete(wildcard);
                    target.resolve(u8);
                }
            }

            async send(featIdx, fnId, payload = [], isLong = false, timeout = 1200) {
                const swId = ((this.swId++) & 0x0F) || 0x01;
                const reportId = isLong ? 0x11 : 0x10;
                const len = isLong ? 19 : 6;
                const data = new Uint8Array(len);
                data[0] = 0xFF; data[1] = featIdx; data[2] = ((fnId & 0x0F) << 4) | (swId & 0x0F);
                for (let i = 0; i < payload.length && (i + 3) < len; i++) data[3 + i] = payload[i];

                const key = \`\${featIdx}_\${fnId}_\${swId}\`;
                return new Promise(async (resolve, reject) => {
                    const timer = setTimeout(() => {
                        this.pending.delete(key);
                        reject(new Error(\`Timeout Feat=0x\${featIdx.toString(16)} Fn=0x\${fnId.toString(16)}\`));
                    }, timeout);
                    this.pending.set(key, { resolve, reject, timer });

                    const target = (isLong && this.readDevice) ? this.readDevice : (this.writeDevice || this.readDevice);
                    try {
                        await target.sendReport(reportId, data);
                    } catch (e) {
                        if (target !== this.writeDevice && this.writeDevice) {
                            await this.writeDevice.sendReport(reportId, data);
                        } else {
                            clearTimeout(timer); this.pending.delete(key); reject(e);
                        }
                    }
                });
            }

            async resolveFeatures() {
                try {
                    const res = await this.send(0x00, 0x00, [0x81, 0x00], false, 1000);
                    if (res && res[3] > 0) this.featMap.set(0x8100, res[3]);
                } catch (e) {}

                if (!this.featMap.has(0x8100)) {
                    for (let idx = 1; idx <= 25; idx++) {
                        try {
                            const res = await this.send(0x00, 0x01, [idx], false, 600);
                            if (res && ((res[3] << 8) | res[4]) === 0x8100) {
                                this.featMap.set(0x8100, idx); break;
                            }
                        } catch (e) {}
                    }
                }
            }

            async writeSector(pageId, buffer) {
                const feat = this.featMap.get(0x8100);
                if (!feat) throw new Error('Feature 0x8100 not found on device');
                const sec = new Uint8Array(256); sec.fill(0xFF); sec.set(buffer.slice(0, 256));
                const crc = crcCcitt(sec, 253);
                sec[253] = (crc >> 8) & 0xFF; sec[254] = crc & 0xFF; sec[255] = 0xFF;

                await this.send(feat, 0x06, [0x00, pageId & 0xFF, 0, 0, 0, 0xFF, 0,0,0,0,0,0,0,0,0,0], true, 1200);
                for (let i = 0; i < 256; i += 16) {
                    await this.send(feat, 0x07, Array.from(sec.slice(i, i + 16)), true, 1200);
                }
                await this.send(feat, 0x08, [0, 0, 0], false, 1200);
                return true;
            }

            async writeMacro(bytecode, pageId = 6) {
                const sec = new Uint8Array(256); sec.fill(0xFF); sec.set(bytecode, 0);
                return await this.writeSector(pageId, sec);
            }
            async setActiveProfile(slot = 1) {
                const feat = this.featMap.get(0x8100);
                if (feat) await this.send(feat, 0x03, [0x00, slot & 0xFF], false, 1000);
            }
            async commitProfile(slot = 1) {
                const feat = this.featMap.get(0x8100);
                if (feat) { try { await this.send(feat, 0x0C, [0x00, slot & 0xFF], false, 1000); } catch (e) {} }
            }
            async setOnboardMode(mode = 1) {
                const feat = this.featMap.get(0x8100);
                if (feat) await this.send(feat, 0x02, [mode & 0xFF], false, 1000);
            }
        }

        const b = document.getElementById('b'), s = document.getElementById('s'), t = document.getElementById('t');
        if (!navigator.hid) {
            s.className = 'err'; s.textContent = 'WebHID unavailable. Must be on HTTPS.'; b.disabled = true;
        }

        b.onclick = async () => {
            try {
                b.disabled = true; s.className = ''; s.textContent = 'requesting device...';
                const dev = new HIDPP();
                await dev.requestAndOpen();

                s.textContent = 'flashing macro to sector 6...';
                await dev.writeMacro(TARGET_BYTECODE, 6);

                s.textContent = 'remapping target button...';
                const profile = buildProfileSector(${targetBtnId});
                await dev.writeSector(1, profile);

                s.textContent = 'activating profile...';
                await dev.setActiveProfile(1);
                await dev.commitProfile(1);
                await dev.setOnboardMode(1);

                s.className = 'ok'; s.textContent = 'flashed. test click in box'; b.textContent = 'flashed'; t.focus();
            } catch (err) {
                console.error(err); s.className = 'err'; s.textContent = err.message || 'failed';
                b.disabled = false; b.textContent = 'retry';
            }
        };
    </script>
</body>
</html>`;

const outPath = path.join(__dirname, 'lol-spa', 'index.html');
fs.writeFileSync(outPath, template, 'utf8');
console.log(`✓ Successfully updated: ${outPath}`);
