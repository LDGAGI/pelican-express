/* ============================================================================
   B · UTILITIES — math, springs, verlet, procedural geometry, textures
   ========================================================================== */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
/* deterministic-ish rng so a "seed" can reshuffle scenery */
function mulberry(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- springs */
class Spring {
  constructor(k = 130, d = 15, x = 0) { this.k = k; this.d = d; this.x = x; this.v = 0; }
  step(target, dt) {
    const n = clamp(Math.ceil(dt * 180), 1, 6), h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (-this.k * (this.x - target) - this.d * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
  kick(v) { this.v += v; }
}
class Spring3 {
  constructor(k = 90, d = 13) {
    this.k = k; this.d = d;
    this.p = new THREE.Vector3(); this.v = new THREE.Vector3();
  }
  step(target, dt) {
    const n = clamp(Math.ceil(dt * 180), 1, 6), h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v.addScaledVector(target.clone().sub(this.p), -this.k * h);
      this.v.multiplyScalar(Math.max(0, 1 - this.d * h));
      this.p.addScaledVector(this.v, h);
    }
    return this.p;
  }
}

/* ------------------------------------------------------------- verlet rope */
class Rope {
  constructor(n, seg, opts = {}) {
    this.n = n; this.seg = seg;
    this.p = []; this.pp = [];
    this.gravity = opts.gravity ?? -9.0;
    this.damp = opts.damp ?? 0.972;
    this.stiff = opts.stiff ?? 1.0;
    for (let i = 0; i < n; i++) { this.p.push(new THREE.Vector3()); this.pp.push(new THREE.Vector3()); }
    this._t = new THREE.Vector3();
  }
  place(anchor, dir) {
    for (let i = 0; i < this.n; i++) {
      this.p[i].copy(anchor).addScaledVector(dir, this.seg * i);
      this.pp[i].copy(this.p[i]);
    }
  }
  step(dt, anchor, wind, extra) {
    const p = this.p, pp = this.pp;
    p[0].copy(anchor); pp[0].copy(anchor);
    const g = this.gravity * dt * dt;
    for (let i = 1; i < this.n; i++) {
      const v = this._t.copy(p[i]).sub(pp[i]).multiplyScalar(this.damp);
      pp[i].copy(p[i]);
      p[i].add(v);
      p[i].y += g;
      p[i].x += wind.x * dt * dt;
      p[i].z += wind.z * dt * dt;
      p[i].y += wind.y * dt * dt;
      if (extra) extra(p[i], i / (this.n - 1));
    }
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < this.n - 1; i++) {
        const a = p[i], b = p[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const diff = (d - this.seg) / d * 0.5 * this.stiff;
        const ox = dx * diff, oy = dy * diff, oz = dz * diff;
        if (i > 0) { a.x += ox; a.y += oy; a.z += oz; }
        b.x -= ox; b.y -= oy; b.z -= oz;
      }
    }
  }
}

/* ------------------------------------------------------- geometry helpers */
/* Cylinder spanning a→b, optionally tapered. */
function tubeGeo(a, b, rA, rB = rA, radial = 10, capped = true) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length() || 1e-5;
  const g = new THREE.CylinderGeometry(rB, rA, len, radial, 1, !capped);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}

/* Torus arc in the XY plane, centred at c, radius r, tube rt. */
function arcGeo(c, r, rt, a0, a1, seg = 24, radial = 8) {
  const g = new THREE.TorusGeometry(r, rt, radial, seg, a1 - a0);
  g.rotateZ(a0);
  g.translate(c.x, c.y, c.z);
  return g;
}

function mergeGeoms(geoms) {
  const list = geoms.filter(Boolean);
  let vCount = 0, iCount = 0;
  for (const g of list) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  let vo = 0, io = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
    pos.set(p.array, vo * 3);
    if (n) nor.set(n.array, vo * 3);
    if (t) uv.set(t.array, vo * 2);
    if (g.index) { const gi = g.index.array; for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo; io += gi.length; }
    else { for (let i = 0; i < p.count; i++) idx[io + i] = i + vo; io += p.count; }
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

/* Loft an elliptical cross-section along a path.
   sections: [{p:Vector3, rx, ry, roll}]  — roll rotates the section about the tangent. */
function loft(sections, radial = 18, capA = true, capB = true) {
  const n = sections.length;
  const pos = [], nor = [], uv = [], idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  const alt = new THREE.Vector3(0, 0, 1);
  const tan = new THREE.Vector3(), side = new THREE.Vector3(), upv = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const s = sections[i];
    if (i < n - 1) tan.subVectors(sections[i + 1].p, s.p);
    else tan.subVectors(s.p, sections[i - 1].p);
    if (tan.lengthSq() < 1e-12) tan.set(1, 0, 0);
    tan.normalize();
    const ref = Math.abs(tan.dot(up)) > 0.985 ? alt : up;
    side.crossVectors(tan, ref).normalize();
    upv.crossVectors(side, tan).normalize();
    const roll = s.roll || 0, cr = Math.cos(roll), sr = Math.sin(roll);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      let cx = Math.cos(a) * s.rx, cy = Math.sin(a) * s.ry;
      const rx2 = cx * cr - cy * sr, ry2 = cx * sr + cy * cr;
      pos.push(
        s.p.x + side.x * rx2 + upv.x * ry2,
        s.p.y + side.y * rx2 + upv.y * ry2,
        s.p.z + side.z * rx2 + upv.z * ry2);
      nor.push(side.x * Math.cos(a) + upv.x * Math.sin(a),
        side.y * Math.cos(a) + upv.y * Math.sin(a),
        side.z * Math.cos(a) + upv.z * Math.sin(a));
      uv.push(j / radial, i / (n - 1));
    }
  }
  const ring = radial + 1;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * ring + j, b = a + 1, c = a + ring, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const capAt = (i, dir) => {
    const s = sections[i];
    const base = pos.length / 3;
    pos.push(s.p.x, s.p.y, s.p.z); nor.push(0, dir, 0); uv.push(0.5, 0.5);
    for (let j = 0; j < radial; j++) {
      const a = i * ring + j;
      if (dir > 0) idx.push(base, a, a + 1); else idx.push(base, a + 1, a);
    }
  };
  if (capA) capAt(0, -1);
  if (capB) capAt(n - 1, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* Resample control sections through a Catmull-Rom for smooth lofts. */
function smoothSections(ctrl, n) {
  const out = [];
  const get = (i) => ctrl[clamp(i, 0, ctrl.length - 1)];
  for (let k = 0; k < n; k++) {
    const f = (k / (n - 1)) * (ctrl.length - 1);
    const i = Math.floor(f), t = f - i;
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const cr = (a, b, c, d) =>
      0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    out.push({
      p: new THREE.Vector3(cr(p0.p.x, p1.p.x, p2.p.x, p3.p.x),
        cr(p0.p.y, p1.p.y, p2.p.y, p3.p.y),
        cr(p0.p.z, p1.p.z, p2.p.z, p3.p.z)),
      rx: Math.max(1e-4, cr(p0.rx, p1.rx, p2.rx, p3.rx)),
      ry: Math.max(1e-4, cr(p0.ry, p1.ry, p2.ry, p3.ry)),
      roll: lerp(p1.roll || 0, p2.roll || 0, t),
    });
  }
  return out;
}

/* Deform a geometry in place with a callback (v,i) -> Vector3 offset. */
function sculpt(geo, fn) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const d = fn(v, i);
    p.setXYZ(i, v.x + d.x, v.y + d.y, v.z + d.z);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/* --------------------------------------------------------------- textures */
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(opts.rx ?? 1, opts.ry ?? 1);
  t.anisotropy = opts.aniso ?? 8;
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.offset) t.offset.set(opts.offset[0], opts.offset[1]);
  t.needsUpdate = true;
  return t;
}

/* Tileable value noise on a canvas. */
function noiseFill(g, w, h, o) {
  const cell = o.cell, oct = o.oct ?? 4, base = o.base ?? 0.5, amp = o.amp ?? 0.5;
  const img = g.getImageData(0, 0, w, h), d = img.data;
  const rnd = mulberry(o.seed ?? 7);
  const grids = [];
  for (let oi = 0; oi < oct; oi++) {
    const n = cell << oi;
    const arr = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) arr[i] = rnd();
    grids.push({ n, arr });
  }
  const sample = (gr, x, y) => {
    const n = gr.n, fx = x * n, fy = y * n;
    const x0 = Math.floor(fx) % n, y0 = Math.floor(fy) % n;
    const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    let tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const a = gr.arr[y0 * n + x0], b = gr.arr[y0 * n + x1];
    const cc = gr.arr[y1 * n + x0], dd = gr.arr[y1 * n + x1];
    return lerp(lerp(a, b, tx), lerp(cc, dd, tx), ty);
  };
  const tint = o.tint || [1, 1, 1];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0, a = amp, tot = 0;
      for (let oi = 0; oi < oct; oi++) { v += sample(grids[oi], x / w, y / h) * a; tot += a; a *= 0.5; }
      v = base + (v / tot - 0.5) * amp * 2;
      const p = (y * w + x) * 4;
      d[p] = clamp(v * 255 * tint[0], 0, 255);
      d[p + 1] = clamp(v * 255 * tint[1], 0, 255);
      d[p + 2] = clamp(v * 255 * tint[2], 0, 255);
      d[p + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

/* Common standard material tweaks: soft rim light so the cartoon reads. */
function rimPatch(mat, color = 0xffe9d0, power = 2.6, strength = 0.55) {
  mat.userData.rim = { value: new THREE.Color(color) };
  mat.userData.rimP = { value: power };
  mat.userData.rimS = { value: strength };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRimColor = mat.userData.rim;
    sh.uniforms.uRimPower = mat.userData.rimP;
    sh.uniforms.uRimStr = mat.userData.rimS;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uRimColor; uniform float uRimPower; uniform float uRimStr;`)
      .replace('#include <opaque_fragment>', `
        {
          float rim = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), uRimPower);
          outgoingLight += uRimColor * rim * uRimStr;
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'rim';
  return mat;
}
