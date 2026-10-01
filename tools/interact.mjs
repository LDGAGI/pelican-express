#!/usr/bin/env node
/* Interaction smoke test: click-to-catch, keyboard shortcuts, HUD state,
   day→dusk→night cycle, responsive layout. */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9334;
const URL = (process.env.PX_URL || 'http://127.0.0.1:8731/index.html');

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
  '--no-sandbox', '--no-first-run', '--mute-audio', '--window-size=900,600', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/pe-chrome-int',
], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill('SIGKILL'); } catch {} });

const wait = async (fn, ms, l) => {
  const t0 = Date.now();
  for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t0 > ms) throw new Error('timeout ' + l); await sleep(250); }
};
await wait(async () => (await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok, 15000, 'devtools');

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.w = new Map(); this.logs = []; }
  static async attach(u) {
    const ws = new WebSocket(u);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && c.w.has(m.id)) { const { res, rej } = c.w.get(m.id); c.w.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
      else if (m.method) c.logs.push(m);
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => { this.w.set(id, { res, rej }); setTimeout(() => { if (this.w.has(id)) { this.w.delete(id); rej(new Error('timeout ' + method)); } }, 25000); });
  }
  async ev(e) {
    const r = await this.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
    return r.result.value;
  }
}

const t = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL)}`, { method: 'PUT' }).then((r) => r.json());
const cdp = await CDP.attach(t.webSocketDebuggerUrl);
await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
await cdp.send('Page.bringToFront');
await wait(() => cdp.ev('!!window.__PX'), 90000, 'ready');
await sleep(1500);

const results = [];
const check = (name, pass, detail = '') => { results.push([pass, name, detail]); console.log(`${pass ? ' ok ' : 'FAIL'}  ${name}${detail ? '  \u2014 ' + detail : ''}`); };
const tap = async (sel) => { await cdp.ev(`document.querySelector(${JSON.stringify(sel)}).click()`); await sleep(400); };
const step = async (label, fn) => { try { await fn(); } catch (e) { check(label + ' (threw)', false, String(e.message).slice(0, 120)); } };
try { await cdp.ev('window.__PX.api.setDpr(0.5)'); } catch {}

/* 1 — the start gate is up, HUD hidden */
check('gate visible before start', await cdp.ev('document.getElementById("gate").hidden === false'));
check('HUD hidden before start', await cdp.ev('document.getElementById("hud").hidden === true'));

/* 2 — click 开始骑行 */
const clickSel = async (sel) => {
  const box = await cdp.ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return JSON.stringify({x: r.x + r.width/2, y: r.y + r.height/2}); })()`);
  const p = JSON.parse(box);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await cdp.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0 });
  }
};
await clickSel('#startBtn');
await sleep(1200);
check('HUD shown after start', await cdp.ev('document.getElementById("hud").hidden === false'));
check('gate dismissed', await cdp.ev('document.getElementById("gate").classList.contains("out")'));
check('ride started', await cdp.ev('window.__PX.S.running === true'));

/* 3 — click the pelican to catch a fish (raycast path) */
await cdp.ev('window.__PX.api.pickCam(2)');
await sleep(2500);
const headPt = JSON.parse(await cdp.ev(`(() => {
  const P = window.__PX;
  const v = P.pelican.headG.getWorldPosition(new P.THREE.Vector3()).project(P.camera);
  return JSON.stringify({x: Math.round((v.x*0.5+0.5)*window.innerWidth), y: Math.round((-v.y*0.5+0.5)*window.innerHeight)});
})()`));
const before = await cdp.ev('window.__PX.state.fish');
let after = before;
for (let attempt = 0; attempt < 3 && after === before; attempt++) {
  for (const type of ['mousePressed', 'mouseReleased']) {
    try {
      await cdp.send('Input.dispatchMouseEvent', { type, x: headPt.x, y: headPt.y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0 });
    } catch {}
  }
  await sleep(2000);
  after = await cdp.ev('window.__PX.state.fish');
}
check('click on pelican catches a fish', after === before + 1, `${before} → ${after}`);
check('catch toast shown', await cdp.ev('document.getElementById("toast").classList.contains("show")'));
check('HUD stat updated', await cdp.ev('document.getElementById("sFish").textContent === String(window.__PX.state.fish)'));

/* 4 — keyboard */
await step('keyboard block', async () => {
/* CDP input dispatch wedges this headless build, so drive the app's own
   listeners with synthetic DOM events — the handlers under test are identical. */
const key = async (k, code) => {
  await cdp.ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, code: ${JSON.stringify(code)}, bubbles: true }))`);
  await sleep(400);
};
await key('b', 'KeyB');
check('bell toast', (await cdp.ev('document.getElementById("toast").textContent')).includes('叮'));
await key('s', 'KeyS');
check('shades toggle on', await cdp.ev('window.__PX.pelican.shades.visible === true'));
await key('s', 'KeyS');
check('shades toggle off', await cdp.ev('window.__PX.pelican.shades.visible === false'));
const p0 = await cdp.ev('window.__PX.World.phaseTarget');
await key('n', 'KeyN');
const p1 = await cdp.ev('window.__PX.World.phaseTarget');
check('N cycles the time of day', p0 !== p1, `${p0} → ${p1}`);
await key(' ', 'Space');
check('space brakes', await cdp.ev('window.__PX.S.braking === true'));
await key(' ', 'Space');
await key('3', 'Digit3');
check('digit selects camera', await cdp.ev('window.__PX.World ? true : true') && await cdp.ev('document.querySelector("#cams button.on").dataset.cam === "2"'));
await key('1', 'Digit1');
check('camera returns to follow', await cdp.ev('document.querySelector("#cams button.on").dataset.cam === "0"'));
});

/* 5 — speed slider */
await step('speed block', async () => {
await cdp.ev(`(() => { const s = document.getElementById('speed'); s.value = 92; s.dispatchEvent(new Event('input')); })()`);
await sleep(2500);
const fast = await cdp.ev('window.__PX.state.kmh');
await cdp.ev(`(() => { const s = document.getElementById('speed'); s.value = 8; s.dispatchEvent(new Event('input')); })()`);
await sleep(2500);
const slow = await cdp.ev('window.__PX.state.kmh');
check('speed slider changes pace', fast > slow + 2, `${fast.toFixed(1)} → ${slow.toFixed(1)} km/h`);
check('distance accumulates', await cdp.ev('window.__PX.state.dist') > 5);
});

/* 6 */
await step('help block', async () => {
await tap('#helpTab');
check('help sheet opens', await cdp.ev('document.getElementById("helpSheet").hidden === false'));
await tap('#helpTab');
});

/* 7 — responsive layout */
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await sleep(1200);
const mob = JSON.parse(await cdp.ev(`(() => {
  const d = document.querySelector('.dock').getBoundingClientRect();
  const s = document.querySelector('.stats').getBoundingClientRect();
  return JSON.stringify({ dockW: Math.round(d.width), dockR: Math.round(d.right), dockB: Math.round(d.bottom),
    statsR: Math.round(s.right), vw: window.innerWidth, vh: window.innerHeight,
    overflow: document.documentElement.scrollWidth > window.innerWidth });
})()`));
check('dock fits a 390px viewport', mob.dockW <= mob.vw && mob.dockR <= mob.vw, JSON.stringify(mob));
check('no horizontal overflow on mobile', !mob.overflow);
void 0;
const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
(await import('node:fs/promises')).writeFile('/tmp/petest/mobile.png', Buffer.from(shot.data, 'base64'));

/* 8 — console cleanliness */
const errs = cdp.logs.filter((m) =>
  (m.method === 'Runtime.exceptionThrown') ||
  (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') ||
  (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && /shader|webgl|program/i.test(m.params.entry.text || '')));
check('no runtime / shader errors', errs.length === 0, errs.slice(0, 2).map((m) => JSON.stringify(m.params).slice(0, 200)).join(' | '));

const failed = results.filter((r) => !r[0]);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
chrome.kill('SIGKILL');
process.exit(failed.length ? 1 : 0);
