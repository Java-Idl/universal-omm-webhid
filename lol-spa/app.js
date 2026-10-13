import { HIDPPDevice, buildProfileSector, compileMacroScript } from './hidpp.js';

/* -------------------------------------------------------------
 * 1. Floating LOL Background Animation Engine
 * ------------------------------------------------------------- */
const canvas = document.getElementById('lol-canvas');
const ctx = canvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
});

const WORDS = ['lol', 'LOL', 'lol', 'LMAO', 'lol', 'LOL', 'xD', 'lol'];
const COLORS = [
    'rgba(255, 71, 126, ',   // Neon Pink
    'rgba(0, 240, 255, ',    // Cyan
    'rgba(255, 255, 255, ',  // White
    'rgba(180, 100, 255, ',  // Purple
    'rgba(255, 180, 0, '     // Yellow/Gold
];

class FloatingLol {
    constructor() {
        this.reset(true);
    }

    reset(initial = false) {
        this.x = Math.random() * width;
        this.y = initial ? Math.random() * height : height + 30;
        this.text = WORDS[Math.floor(Math.random() * WORDS.length)];
        this.size = Math.random() * 26 + 14; // 14px to 40px
        this.speedY = -(Math.random() * 1.5 + 0.6); // drift upward
        this.speedX = (Math.random() - 0.5) * 1.2; // slight horizontal drift
        this.rotation = (Math.random() - 0.5) * 0.4;
        this.rotSpeed = (Math.random() - 0.5) * 0.01;
        this.colorPrefix = COLORS[Math.floor(Math.random() * COLORS.length)];
        this.opacity = Math.random() * 0.35 + 0.08; // subtle transparent
    }

    update() {
        this.y += this.speedY;
        this.x += this.speedX;
        this.rotation += this.rotSpeed;

        if (this.y < -50 || this.x < -50 || this.x > width + 50) {
            this.reset(false);
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.font = `900 ${this.size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = `${this.colorPrefix}${this.opacity})`;
        ctx.fillText(this.text, 0, 0);
        ctx.restore();
    }
}

const PARTICLES = Array.from({ length: 45 }, () => new FloatingLol());

function animate() {
    ctx.clearRect(0, 0, width, height);
    for (const p of PARTICLES) {
        p.update();
        p.draw();
    }
    requestAnimationFrame(animate);
}
animate();

/* -------------------------------------------------------------
 * 2. Instant Mouse Flasher Logic
 * ------------------------------------------------------------- */
const btnConnect = document.getElementById('btn-connect');
const statusBox = document.getElementById('status-box');
const statusTitle = document.getElementById('status-title');
const statusDesc = document.getElementById('status-desc');
const spinner = document.getElementById('spinner');
const testArea = document.getElementById('test-area');
const sandboxInput = document.getElementById('sandbox-input');
const btnRestore = document.getElementById('btn-restore');

let connectedDevice = null;

function setStatus(title, desc, isSuccess = false) {
    statusBox.classList.remove('hidden');
    statusTitle.textContent = title;
    statusDesc.textContent = desc;

    if (isSuccess) {
        statusBox.classList.add('success');
        spinner.classList.add('hidden');
    } else {
        statusBox.classList.remove('success');
        spinner.classList.remove('hidden');
    }
}

// Macro script: type 'lol' and press Enter
const LOL_SCRIPT = `STRING lol\nENTER`;

async function flashRightClickInstantly() {
    try {
        if (!navigator.hid) {
            alert('WebHID is not supported in this browser. Please use Google Chrome or Microsoft Edge on Windows/Mac/Linux.');
            return;
        }

        btnConnect.disabled = true;
        setStatus('Requesting Device...', 'Please select your Logitech mouse in the browser prompt...');

        // 1. Request Logitech device
        const devices = await navigator.hid.requestDevice({
            filters: [{ vendorId: 0x046D }]
        });

        if (!devices || devices.length === 0) {
            setStatus('Connection Cancelled', 'No device selected.');
            btnConnect.disabled = false;
            return;
        }

        const rawDevice = devices[0];
        setStatus('Connecting...', `Establishing HID++ 2.0 handshake with ${rawDevice.productName || 'Logitech Mouse'}...`);

        // 2. Connect & Resolve Features
        connectedDevice = new HIDPPDevice(rawDevice);
        await connectedDevice.connect();

        // 3. Compile LOL Macro
        setStatus('Compiling Payload...', 'Compiling "lol" bytecode for hardware interpreter...');
        const compiled = compileMacroScript(LOL_SCRIPT);
        if (!compiled.success) {
            throw new Error(`Macro compile failed: ${compiled.errors.join(', ')}`);
        }

        // 4. Burn macro directly to Sector 6
        setStatus('Burning Macro...', 'Writing 46-byte LOL bytecode to Flash Sector 6 with CRC-16 CCITT...');
        await connectedDevice.writeMacro(compiled.bytecode, 6);

        // 5. Update Profile Sector 1 to remap Button 2 (Right Click)
        setStatus('Binding Right Click...', 'Updating Profile Sector 1 jump table (Offset 36 -> Sector 6)...');
        const profileSector = buildProfileSector([
            { id: 2, action: { type: 'macro', page: 6, offset: 0 } }
        ]);

        await connectedDevice.writeSector(1, profileSector);

        // 6. Activate Profile 1 and commit to hardware flash
        setStatus('Committing to Silicon...', 'Committing Profile 1 to non-volatile flash and enabling Onboard Mode...');
        await connectedDevice.setActiveProfile(1);
        try {
            await connectedDevice.commitProfileToFlash(1);
        } catch (e) {
            console.warn('Commit notice:', e);
        }
        await connectedDevice.setOnboardMode(1);

        // 7. Complete!
        setStatus(
            '🎉 Right Mouse Button is now LOL\'d!',
            'Hardware memory updated successfully! Right click anywhere to test.',
            true
        );

        btnConnect.innerHTML = `<span class="btn-icon">✓</span><span class="btn-text">Flashed &amp; Active!</span>`;
        testArea.classList.remove('hidden');
        sandboxInput.focus();

        // Spawn a burst of extra LOL particles
        for (let i = 0; i < 25; i++) {
            const p = new FloatingLol();
            p.y = height / 2;
            p.x = width / 2;
            p.speedY = (Math.random() - 0.5) * 6;
            p.speedX = (Math.random() - 0.5) * 6;
            p.size = 32;
            p.opacity = 0.8;
            PARTICLES.push(p);
        }

    } catch (err) {
        console.error('Error flashing mouse:', err);
        setStatus('Error Flashing Device', err.message || String(err));
        btnConnect.disabled = false;
    }
}

async function restoreDefaultRightClick() {
    if (!connectedDevice) {
        alert('Please connect device first.');
        return;
    }

    try {
        btnRestore.disabled = true;
        btnRestore.textContent = 'Restoring...';
        setStatus('Restoring...', 'Resetting Button 2 back to standard physical secondary click...');

        // Restore Button 2 to normal mouse click: [0x80, 0x01, 0x00, 0x02]
        const restoreSector = buildProfileSector([
            { id: 2, action: { type: 'mouse', value: 2 } }
        ]);

        await connectedDevice.writeSector(1, restoreSector);
        await connectedDevice.setActiveProfile(1);
        try {
            await connectedDevice.commitProfileToFlash(1);
        } catch (e) {}

        setStatus('✓ Restored!', 'Right click is back to normal standard click.', true);
        btnRestore.textContent = '✓ Restored to Normal';
    } catch (err) {
        console.error('Restore failed:', err);
        alert(`Restore failed: ${err.message}`);
        btnRestore.disabled = false;
        btnRestore.textContent = '↺ Restore Normal Right Click';
    }
}

btnConnect.addEventListener('click', flashRightClickInstantly);
btnRestore.addEventListener('click', restoreDefaultRightClick);
