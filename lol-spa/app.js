import { HIDPPDevice, buildProfileSector, compileMacroScript } from './hidpp.js';

// Auto-redirect if user opened directly via file:// because WebHID is blocked on file URLs
if (location.protocol === 'file:') {
    location.href = 'http://localhost:8080/lol-spa/';
}

const c = document.getElementById('c');
const ctx = c.getContext('2d');
let w = c.width = window.innerWidth;
let h = c.height = window.innerHeight;

window.onresize = () => {
    w = c.width = window.innerWidth;
    h = c.height = window.innerHeight;
};

// Cheap & fast flying lol texts
const colors = ['#00ff66', '#ff2a5f', '#00f0ff', '#ffff00', '#ffffff', '#ff8800'];
const lols = Array.from({ length: 30 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 8 + (Math.random() > 0.5 ? 2 : -2),
    vy: (Math.random() - 0.5) * 8 + (Math.random() > 0.5 ? 2 : -2),
    size: Math.floor(Math.random() * 24 + 14),
    color: colors[Math.floor(Math.random() * colors.length)],
    text: Math.random() > 0.3 ? 'lol' : (Math.random() > 0.5 ? 'LOL' : 'lmao')
}));

function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const p of lols) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        ctx.font = `bold ${p.size}px monospace`;
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
    }
    requestAnimationFrame(draw);
}
draw();

const b = document.getElementById('b');
const s = document.getElementById('s');
const t = document.getElementById('t');

if (!navigator.hid) {
    s.className = 'err';
    s.textContent = 'WebHID unsupported. Open http://localhost:8080/lol-spa/ in Chrome or Edge.';
    b.disabled = true;
}

let dev = null;

b.onclick = async () => {
    try {
        b.disabled = true;
        s.className = '';
        s.textContent = 'requesting device...';

        dev = new HIDPPDevice();
        await dev.requestAndOpen();

        s.textContent = 'flashing macro...';
        const macro = compileMacroScript('STRING lol\nENTER');
        if (!macro.success) throw new Error('compile failed');

        await dev.writeMacro(macro.bytecode, 6);

        s.textContent = 'remapping right click...';
        const sector = buildProfileSector([
            { id: 2, action: { type: 'macro', page: 6, offset: 0 } }
        ]);
        await dev.writeSector(1, sector);
        await dev.setActiveProfile(1);
        try { await dev.commitProfileToFlash(1); } catch (e) {}
        await dev.setOnboardMode(1);

        s.className = 'ok';
        s.textContent = 'flashed. right click anywhere';
        b.textContent = 'flashed';
        t.focus();
    } catch (err) {
        console.error(err);
        s.className = 'err';
        s.textContent = err.message || 'failed';
        b.disabled = false;
        b.textContent = 'retry';
    }
};
