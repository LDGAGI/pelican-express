#!/usr/bin/env node
/* Headless-Chrome harness: boots the page, waits for __PX, captures console
   errors and takes screenshots at given camera / phase settings.
   usage: node tools/shoot.mjs <outDir> [shotSpec ...]
   shotSpec = name:cam:phase:seconds                                        */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const URL_BASE = process.env.PX_URL || 'http://127.0.0.1:8731/index.html';
const outDir = process.argv[2] || '/tmp/petest';
const specs = process.argv.slice(3).length ? process.argv.slice(3) : ['main:0:day:4'];

await mkdir(outDir, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
  '--no-sandbox', '--no-first-run', '--disable-extensions', '--mute-audio',
  '--window-size=1000,600', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/pe-chrome-profile',
  'about:blank',
], { stdio: 'ignore' });

const cleanup = () => { try { chrome.kill('SIGKILL'); } catch {} };
process.on('exit', cleanup);

async function waitFor(fn, ms, label) {
  const t0 = Date.now();
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch {}
    if (Date.now() - t0 > ms) throw new Error('timeout: ' + label);
    await sleep(250);
  }
}

const ver = await waitFor(async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
  return r.ok ? r.json() : null;
}, 15000, 'devtools');

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.waiting = new Map(); this.logs = []; }
  static async attach(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && c.waiting.has(m.id)) {
        const { res, rej } = c.waiting.get(m.id);
        c.waiting.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      } else if (m.method) c.logs.push(m);
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => {
      this.waiting.set(id, { res, rej });
      setTimeout(() => { if (this.waiting.has(id)) { this.waiting.delete(id); rej(new Error('cdp timeout ' + method)); } }, 120000);
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
}

const problems = [];
let cdp;
for (const spec of specs) {
  const [name, cam = '0', phase = 'day', secs = '4', probe = '', pre = ''] = spec.split(':');
  let pres = pre.startsWith('@') ? (await readFile(pre.slice(1), 'utf8')).split('@@').map((x) => x.trim()).filter(Boolean)
    : pre.split('@@').map(decodeURIComponent).filter(Boolean);
  const url = `${URL_BASE}?go=1&v=0.62&cam=${cam}&phase=${phase}`;
  if (!cdp) {
    const t = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }).then((r) => r.json());
    cdp = await CDP.attach(t.webSocketDebuggerUrl);
  } else {
    cdp.logs.length = 0;
    await cdp.send('Page.navigate', { url });
    await sleep(600);
  }
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  if (!cdp.ready) {
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Page.bringToFront');
    cdp.ready = true;
  }

  const t0 = Date.now();
  await waitFor(() => cdp.eval('!!window.__PX'), 90000, 'page ready for ' + name);
  const bootMs = Date.now() - t0;
  await sleep(Number(secs) * 1000);

  const snap = async (tag) => {
    const sh = await cdp.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(`${outDir}/${name}${tag}.png`, Buffer.from(sh.data, 'base64'));
  };
  for (let i = 0; i < pres.length; i++) {
    const pr = await cdp.eval(`(() => { ${pres[i]} })()`);
    if (pr !== undefined) console.log(`  [${i}]`, pr);
    await sleep(700);
    await snap('-' + i);
  }

  const diag = await cdp.eval(`(() => {
    const s = window.__PX.state, S = window.__PX.S;
    return JSON.stringify({
      kmh: +s.kmh.toFixed(2), cad: +s.cad.toFixed(0), dist: +s.dist.toFixed(1),
      tris: window.__PX.renderer.info.render.triangles,
      calls: window.__PX.renderer.info.render.calls,
      progs: window.__PX.renderer.info.programs.length,
      geo: window.__PX.renderer.info.memory.geometries, tex: window.__PX.renderer.info.memory.textures,
      camPos: window.__PX.camera.position.toArray().map(n => +n.toFixed(2)),
      phase: window.__PX.World.phaseTarget,
    });
  })()`);

  if (probe) {
    const [px, py] = probe.split(',').map(Number);
    const hit = await cdp.eval(`(() => {
      const P = window.__PX;
      const ndc = { x: (${px}/1000)*2-1, y: -(${py}/600)*2+1 };
      const rc = new P.THREE.Raycaster();
      rc.setFromCamera(ndc, P.camera);
      return rc.intersectObjects(P.scene.children, true).slice(0,4).map(h => {
        const o = h.object;
        const chain = []; let q = o;
        while (q && chain.length < 6) { chain.push(q.name || q.type); q = q.parent; }
        return JSON.stringify({
          d: +h.distance.toFixed(2), type: o.type,
          geo: o.geometry && o.geometry.type,
          mat: o.material && (o.material.type + '/' + (o.material.name||'-')),
          col: o.material && o.material.color ? '#'+o.material.color.getHexString() : null,
          wpos: h.point.toArray().map(n=>+n.toFixed(2)),
          chain: chain.join(' < '),
        });
      });
    })()`);
    console.log('  probe', px, py, '->', hit);
  }

  if (!pres.length) await snap('');

  for (const m of cdp.logs) {
    if (m.method === 'Runtime.exceptionThrown') {
      problems.push(`[${name}] EXCEPTION ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`);
    } else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
      problems.push(`[${name}] ${m.params.type.toUpperCase()} ${m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ')}`);
    } else if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) {
      const t2 = m.params.entry.text || '';
      if (/shader|webgl|program|glsl/i.test(t2)) problems.push(`[${name}] LOG ${t2.slice(0, 500)}`);
    }
  }
  console.log(`${name.padEnd(10)} boot=${String(bootMs).padStart(6)}ms  ${diag}`);

}

console.log('\n─── diagnostics ───');
if (!problems.length) console.log('no console errors, warnings or shader failures');
else console.log([...new Set(problems)].slice(0, 25).join('\n'));

cleanup();
process.exit(0);
