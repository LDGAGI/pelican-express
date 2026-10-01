/* ============================================================================
   F · BIKE — procedural bicycle: frame, laced wheels, live drivetrain,
   fenders, wicker basket, headlamp, fish pennant.
   ========================================================================== */

const BIKE = {
  rearHub: new THREE.Vector3(-0.510, 0.335, 0),
  BB:      new THREE.Vector3(0.000, 0.275, 0),
  ST:      new THREE.Vector3(-0.145, 0.800, 0),
  HT:      new THREE.Vector3(0.395, 0.865, 0),
  HB:      new THREE.Vector3(0.452, 0.660, 0),
  frontHub:new THREE.Vector3(0.545, 0.335, 0),
  saddle:  new THREE.Vector3(-0.170, 0.905, 0),
  barC:    new THREE.Vector3(0.355, 0.950, 0),
  ringR:   0.090,
  cogR:    0.040,
  crank:   0.170,
  pedalZ:  0.098,
  driveZ:  0.062,
};

function alignYMatrix(from, to, radiusScale = 1) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length() || 1e-5;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return new THREE.Matrix4().compose(
    new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5), q,
    new THREE.Vector3(radiusScale, len, radiusScale));
}

function fenderGeo(r, halfW, a0, a1, seg = 22) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = a0 + (a1 - a0) * (i / seg);
    const c = Math.cos(a), s = Math.sin(a);
    for (let j = 0; j < 2; j++) {
      const z = (j ? 1 : -1) * halfW;
      pos.push(c * r, s * r + 0.014 * (1 - (z / halfW) * (z / halfW)), z);
      nor.push(c, s, 0);
      uv.push(i / seg, j);
    }
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2, b = a + 2;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/* A fish, used in the basket and for the jumping-fishery FX. */
function fishGeo(L = 0.26) {
  const s = smoothSections([
    { p: new THREE.Vector3(-L * 0.50, 0, 0), rx: L * 0.012, ry: L * 0.02 },
    { p: new THREE.Vector3(-L * 0.32, 0, 0), rx: L * 0.075, ry: L * 0.085 },
    { p: new THREE.Vector3(-L * 0.05, 0, 0), rx: L * 0.105, ry: L * 0.115 },
    { p: new THREE.Vector3(L * 0.18, 0, 0), rx: L * 0.075, ry: L * 0.085 },
    { p: new THREE.Vector3(L * 0.36, 0, 0), rx: L * 0.026, ry: L * 0.030 },
    { p: new THREE.Vector3(L * 0.44, 0, 0), rx: L * 0.010, ry: L * 0.014 },
  ], 12);
  const body = loft(s, 12);
  /* NOTE: non-indexed geometry must hold whole triangles — a 4-vertex strip makes
     computeVertexNormals() read past the end and write NaN, which then spreads
     through the bloom chain as a black block. */
  const tail = new THREE.BufferGeometry();
  tail.setAttribute('position', new THREE.Float32BufferAttribute([
    L * 0.42, 0, 0, L * 0.63, L * 0.17, 0, L * 0.49, -L * 0.01, 0,
    L * 0.42, 0, 0, L * 0.49, -L * 0.01, 0, L * 0.63, -L * 0.17, 0,
  ], 3));
  tail.computeVertexNormals();
  const dorsal = new THREE.BufferGeometry();
  dorsal.setAttribute('position', new THREE.Float32BufferAttribute([
    -L * 0.16, L * 0.09, 0, L * 0.12, L * 0.10, 0, -L * 0.02, L * 0.25, 0,
  ], 3));
  dorsal.computeVertexNormals();
  return mergeGeoms([body, tail, dorsal]);
}

function buildBike(scene, tex) {
  const root = new THREE.Group();
  const bike = new THREE.Group();
  root.add(bike);

  const M = {
    frame: new THREE.MeshStandardMaterial({ color: 0x16414a, roughness: 0.34, metalness: 0.35 }),
    fork: new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.30, metalness: 0.20 }),
    accent: new THREE.MeshStandardMaterial({ color: 0xff6a45, roughness: 0.40, metalness: 0.10 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.92 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.26, metalness: 0.88 }),
    spoke: new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.22, metalness: 0.92 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9aa1a9, roughness: 0.30, metalness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.55, metalness: 0.40 }),
    grip: new THREE.MeshStandardMaterial({ color: 0xd8503a, roughness: 0.85 }),
    saddle: new THREE.MeshStandardMaterial({ color: 0x7a4a30, roughness: 0.66 }),
    wicker: new THREE.MeshStandardMaterial({ color: 0xc79a5c, roughness: 0.88, side: THREE.DoubleSide }),
    brass: new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.28, metalness: 0.85 }),
    lens: new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffd79a, emissiveIntensity: 0.4, roughness: 0.2 }),
    fish: new THREE.MeshStandardMaterial({ color: 0x59b7c9, roughness: 0.35, metalness: 0.30, side: THREE.DoubleSide }),
    fender: new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.32, metalness: 0.35, side: THREE.DoubleSide }),
  };

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const off = (v, x, y, z) => V(v.x + x, v.y + y, v.z + z);
  const P = BIKE;

  /* ---------------------------------------------------------- frame */
  const tubes = [];
  const tube = (a, b, r, r2, rad = 10) => tubes.push(tubeGeo(a, b, r, r2 ?? r, rad));
  tube(P.BB, P.ST, 0.0215);
  tube(P.BB, P.HB, 0.0245);
  tube(P.ST, P.HT, 0.0195);
  tube(P.HT, P.HB, 0.0270, 0.0270, 14);
  for (const s of [-1, 1]) {
    tube(off(P.BB, 0, 0, 0.030 * s), off(P.rearHub, 0, 0, 0.058 * s), 0.0125);
    tube(off(P.ST, 0, -0.02, 0.020 * s), off(P.rearHub, 0, 0, 0.056 * s), 0.0105);
    const mid = V(0.505, 0.470, 0.050 * s);
    tube(off(P.HB, 0, 0, 0.046 * s), mid, 0.0125);
    tube(mid, off(P.frontHub, 0, 0, 0.048 * s), 0.0125);
  }
  tube(off(P.BB, 0, 0, 0.048), off(P.BB, 0, 0, -0.048), 0.016, 0.016, 10);
  tube(off(P.HB, 0, 0, 0.050), off(P.HB, 0, 0, -0.050), 0.018, 0.018, 10);
  const frame = new THREE.Mesh(mergeGeoms(tubes), M.frame);
  frame.castShadow = true;
  bike.add(frame);

  /* seat post + saddle */
  const post = new THREE.Mesh(tubeGeo(off(P.ST, 0, -0.01, 0), V(P.saddle.x - 0.01, P.saddle.y - 0.035, 0), 0.0135), M.steel);
  bike.add(post);
  const saddleGeo = loft(smoothSections([
    { p: V(-0.155, 0, 0), rx: 0.016, ry: 0.012 },
    { p: V(-0.095, 0.004, 0), rx: 0.030, ry: 0.016 },
    { p: V(-0.030, 0.002, 0), rx: 0.058, ry: 0.021 },
    { p: V(0.030, -0.004, 0), rx: 0.076, ry: 0.022 },
    { p: V(0.078, -0.014, 0), rx: 0.070, ry: 0.016 },
    { p: V(0.100, -0.024, 0), rx: 0.046, ry: 0.010 },
  ], 14), 12);
  const saddle = new THREE.Mesh(saddleGeo, M.saddle);
  saddle.position.copy(P.saddle);
  saddle.castShadow = true;
  bike.add(saddle);

  /* stem + handlebar */
  const cockpit = [];
  cockpit.push(tubeGeo(off(P.HT, 0, 0.005, 0), P.barC, 0.0135));
  const barPts = [
    V(0.278, 0.958, -0.232), V(0.300, 0.960, -0.170), V(0.322, 0.958, -0.088),
    V(0.332, 0.954, 0),
    V(0.322, 0.958, 0.088), V(0.300, 0.960, 0.170), V(0.278, 0.958, 0.232),
  ];
  for (let i = 0; i < barPts.length - 1; i++) cockpit.push(tubeGeo(barPts[i], barPts[i + 1], 0.0115));
  const bar = new THREE.Mesh(mergeGeoms(cockpit), M.steel);
  bar.castShadow = true;
  bike.add(bar);
  for (const s of [-1, 1]) {
    const grip = new THREE.Mesh(tubeGeo(V(0.293, 0.959, 0.196 * s), V(0.272, 0.957, 0.244 * s), 0.0165, 0.0155), M.grip);
    bike.add(grip);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0165, 8, 6), M.brass);
    cap.position.set(0.270, 0.957, 0.248 * s);
    bike.add(cap);
  }

  /* bell */
  const bell = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 8, 0, TAU, 0, Math.PI / 2), M.brass);
  const bstem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.022, 6), M.brass);
  bstem.position.y = -0.011;
  bell.add(dome, bstem);
  bell.position.set(0.318, 0.976, -0.150);
  bike.add(bell);

  /* ---------------------------------------------------------- wheels */
  const makeWheel = () => {
    const g = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.303, 0.0335, 12, 44), M.tire);
    tire.castShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.272, 0.0135, 8, 44), M.rim);
    const rimIn = new THREE.Mesh(new THREE.CylinderGeometry(0.268, 0.268, 0.020, 40, 1, true), M.rim);
    rimIn.rotation.x = Math.PI / 2;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.098, 12), M.steel);
    hub.rotation.x = Math.PI / 2;
    const fl1 = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.006, 12), M.steel);
    fl1.rotation.x = Math.PI / 2; fl1.position.z = 0.034;
    const fl2 = fl1.clone(); fl2.position.z = -0.034;
    const N = 28;
    const spoke = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0016, 0.0016, 1, 4), M.spoke, N);
    for (let i = 0; i < N; i++) {
      const s = i % 2 ? 1 : -1;
      const a = (i / N) * TAU;
      const cross = i % 4 < 2 ? 1 : -1;
      const hubPt = V(Math.cos(a + cross * 0.42) * 0.028, Math.sin(a + cross * 0.42) * 0.028, 0.034 * s);
      const rimPt = V(Math.cos(a) * 0.268, Math.sin(a) * 0.268, 0);
      spoke.setMatrixAt(i, alignYMatrix(hubPt, rimPt));
    }
    spoke.instanceMatrix.needsUpdate = true;
    spoke.frustumCulled = false;
    g.add(tire, rim, rimIn, hub, fl1, fl2, spoke);
    return g;
  };
  const wheelR = makeWheel(), wheelF = makeWheel();
  wheelR.position.copy(P.rearHub);
  wheelF.position.copy(P.frontHub);
  bike.add(wheelR, wheelF);

  /* fenders */
  const fR = new THREE.Mesh(fenderGeo(0.360, 0.050, 0.28, Math.PI - 0.18), M.fender);
  fR.position.copy(P.rearHub); fR.castShadow = true;
  const fF = new THREE.Mesh(fenderGeo(0.360, 0.048, 0.10, Math.PI - 0.05), M.fender);
  fF.position.copy(P.frontHub); fF.castShadow = true;
  bike.add(fR, fF);
  const stay = [];
  for (const s of [-1, 1]) {
    stay.push(tubeGeo(off(P.rearHub, 0, 0, 0.055 * s), V(P.rearHub.x - 0.02, P.rearHub.y + 0.345, 0.05 * s), 0.0045));
    stay.push(tubeGeo(off(P.frontHub, 0, 0, 0.05 * s), V(P.frontHub.x - 0.02, P.frontHub.y + 0.345, 0.048 * s), 0.0045));
  }
  bike.add(new THREE.Mesh(mergeGeoms(stay), M.steel));

  /* ----------------------------------------------------- drivetrain */
  const crankGrp = new THREE.Group();
  crankGrp.position.copy(P.BB);
  bike.add(crankGrp);

  /* chainring with teeth */
  const ringParts = [];
  ringParts.push(new THREE.TorusGeometry(P.ringR - 0.006, 0.007, 6, 40).translate(0, 0, P.driveZ));
  ringParts.push(new THREE.CylinderGeometry(P.ringR - 0.012, P.ringR - 0.012, 0.004, 32)
    .rotateX(Math.PI / 2).translate(0, 0, P.driveZ));
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU;
    const t = new THREE.BoxGeometry(0.008, 0.010, 0.005);
    t.translate(0, P.ringR, P.driveZ);
    t.rotateZ(a);
    ringParts.push(t);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const arm = new THREE.BoxGeometry(0.020, P.ringR - 0.02, 0.006);
    arm.translate(0, (P.ringR - 0.02) / 2 + 0.012, P.driveZ);
    arm.rotateZ(a);
    ringParts.push(arm);
  }
  const ring = new THREE.Mesh(mergeGeoms(ringParts), M.steel);
  ring.castShadow = true;
  crankGrp.add(ring);

  /* rear cog + crank arms + pedals */
  const cogParts = [new THREE.CylinderGeometry(P.cogR - 0.004, P.cogR - 0.004, 0.005, 20)
    .rotateX(Math.PI / 2).translate(0, 0, P.driveZ)];
  for (let i = 0; i < 16; i++) {
    const t = new THREE.BoxGeometry(0.007, 0.009, 0.005);
    t.translate(0, P.cogR, P.driveZ);
    t.rotateZ((i / 16) * TAU);
    cogParts.push(t);
  }
  const cog = new THREE.Mesh(mergeGeoms(cogParts), M.steel);
  cog.position.copy(P.rearHub);
  bike.add(cog);

  const pedals = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.026, P.crank, 0.016), M.steel);
    arm.geometry.translate(0, -P.crank / 2, 0);
    const armG = new THREE.Group();
    armG.add(arm);
    const pedal = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.016, 0.070), M.dark);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.100, 0.006, 0.014), M.accent);
    lip.position.set(0, 0.011, 0.030);
    const lip2 = lip.clone(); lip2.position.z = -0.030;
    pedal.add(body, lip, lip2);
    const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, P.pedalZ * s * 0.5, 6), M.steel);
    spindle.rotation.x = Math.PI / 2;
    spindle.position.set(0, -P.crank, P.pedalZ * s * 0.24);
    armG.add(spindle);
    pedal.position.set(0, -P.crank, P.pedalZ * s * 0.48);
    armG.add(pedal);
    armG.position.set(0, 0, P.pedalZ * s * 0.52);
    crankGrp.add(armG);
    pedals.push(pedal);
  }

  /* chain: external tangents + wrap arcs, links placed by arc length */
  const c1 = P.BB, c2 = P.rearHub, r1 = P.ringR, r2 = P.cogR;
  const dvec = new THREE.Vector3().subVectors(c2, c1);
  const dist = dvec.length();
  const alpha = Math.atan2(dvec.y, dvec.x);
  const beta = Math.acos(clamp((r1 - r2) / dist, -1, 1));
  const thA = alpha - beta, thB = alpha + beta;
  const pathPts = [];
  const push = (x, y) => pathPts.push(new THREE.Vector3(x, y, P.driveZ));
  const arc = (c, r, a0, a1, n) => {
    for (let i = 1; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      push(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
    }
  };
  push(c1.x + Math.cos(thA) * r1, c1.y + Math.sin(thA) * r1);
  push(c2.x + Math.cos(thA) * r2, c2.y + Math.sin(thA) * r2);
  arc(c2, r2, thA, thB, 8);
  push(c1.x + Math.cos(thB) * r1, c1.y + Math.sin(thB) * r1);
  arc(c1, r1, thB, thA, 14);

  const cum = [0];
  for (let i = 1; i < pathPts.length; i++) cum.push(cum[i - 1] + pathPts[i].distanceTo(pathPts[i - 1]));
  const chainLen = cum[cum.length - 1] + pathPts[0].distanceTo(pathPts[pathPts.length - 1]);
  const LINKS = 62;
  const chain = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0075, 0.019, 0.0075), M.dark, LINKS);
  chain.frustumCulled = false;
  const sampleChain = (s) => {
    s = ((s % chainLen) + chainLen) % chainLen;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    return new THREE.Vector3().lerpVectors(pathPts[i - 1], pathPts[i], t);
  };
  bike.add(chain);
  const chainStep = (dist) => {
    const off = (dist / chainLen) * LINKS;
    for (let i = 0; i < LINKS; i++) {
      const p = sampleChain((i / LINKS) * chainLen + off);
      const q = sampleChain((i / LINKS) * chainLen + off + 0.02);
      chain.setMatrixAt(i, alignYMatrix(p, q, 1));
    }
    chain.instanceMatrix.needsUpdate = true;
  };
  chainStep(0);

  /* --------------------------------------------------------- basket */
  const basket = new THREE.Group();
  const bw = 0.145, bh = 0.115, bt = 0.125;
  const bars = [];
  for (const yy of [0, 0.5, 1]) {
    const w = lerp(bw, bt, yy), d = lerp(0.10, 0.088, yy), y = yy * bh * 2;
    const c = [[-w, -d], [w, -d], [w, d], [-w, d]];
    for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4];
      bars.push(tubeGeo(V(a[0], y, a[1]), V(b[0], y, b[1]), 0.0055));
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = [[-bw, -0.10], [bw, -0.10], [bw, 0.10], [-bw, 0.10]][i];
    const b = [[-bt, -0.088], [bt, -0.088], [bt, 0.088], [-bt, 0.088]][i];
    bars.push(tubeGeo(V(a[0], 0, a[1]), V(b[0], bh * 2, b[1]), 0.005));
  }
  for (let s = -1; s <= 1; s += 2) for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    bars.push(tubeGeo(V(i * bw * 0.4, 0, 0.10 * s), V(i * bt * 0.38, bh * 2, 0.088 * s), 0.0035));
    bars.push(tubeGeo(V(0.145 * s, 0, i * 0.032), V(0.125 * s, bh * 2, i * 0.028), 0.0035));
  }
  const basketMesh = new THREE.Mesh(mergeGeoms(bars), M.wicker);
  basketMesh.castShadow = true;
  basket.add(basketMesh);
  basket.position.set(0.665, 0.735, 0);
  bike.add(basket);
  /* basket struts down to the fork crown */
  const strut = [];
  for (const s of [-1, 1]) strut.push(tubeGeo(V(0.665, 0.745, 0.10 * s), V(0.470, 0.640, 0.045 * s), 0.005));
  strut.push(tubeGeo(V(0.665, 0.735, -0.09), V(0.665, 0.735, 0.09), 0.004));
  bike.add(new THREE.Mesh(mergeGeoms(strut), M.steel));

  const fishMat = M.fish;
  const basketFish = [];
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(fishGeo(0.24), fishMat);
    f.position.set(rand(-0.04, 0.04), 0.055 + i * 0.028, rand(-0.05, 0.05));
    f.rotation.set(rand(-0.3, 0.3), rand(0, TAU), rand(-0.5, 0.5));
    basket.add(f);
    basketFish.push({ m: f, ph: rand(0, TAU), home: f.position.clone() });
  }

  /* -------------------------------------------------------- headlamp */
  const lamp = new THREE.Group();
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.046, 0.070, 16), M.brass);
  can.rotation.z = -Math.PI / 2;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.038, 16), M.lens);
  lens.position.x = 0.036;
  lens.rotation.y = Math.PI / 2;
  const bracket = new THREE.Mesh(tubeGeo(V(0, -0.03, 0), V(0, -0.075, 0), 0.008), M.steel);
  lamp.add(can, lens, bracket);
  lamp.position.set(0.372, 1.002, 0);
  bike.add(lamp);
  const spot = new THREE.SpotLight(0xfff0cc, 0, 22, 0.46, 0.62, 1.0);
  spot.position.set(0.40, 1.00, 0);
  spot.target.position.set(14, -0.3, 0);
  bike.add(spot, spot.target);

  const beamU = { uCol: { value: new THREE.Color(0xffe6b0) }, uStr: { value: 0 }, uTime: { value: 0 } };
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, 11, 22, 1, true),
    new THREE.ShaderMaterial({
      vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, uniforms: beamU,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    }));
  beam.geometry.translate(0, -5.5, 0);
  beam.geometry.rotateZ(Math.PI / 2);
  beam.position.set(0.42, 1.00, 0);
  beam.frustumCulled = false;
  bike.add(beam);

  /* ------------------------------------------------- rack + pennant */
  const rack = [];
  for (const s of [-1, 1]) {
    rack.push(tubeGeo(V(-0.300, 0.775, 0.070 * s), V(-0.655, 0.775, 0.070 * s), 0.0055));
    rack.push(tubeGeo(V(-0.300, 0.775, 0.070 * s), V(-0.300, 0.602, 0.052 * s), 0.005));
    rack.push(tubeGeo(V(-0.640, 0.775, 0.070 * s), V(-0.510, 0.375, 0.056 * s), 0.005));
  }
  for (let i = 0; i < 3; i++) {
    const x = lerp(-0.32, -0.63, i / 2);
    rack.push(tubeGeo(V(x, 0.775, -0.070), V(x, 0.775, 0.070), 0.005));
  }
  bike.add(new THREE.Mesh(mergeGeoms(rack), M.steel));

  const flagU = {
    uMap: { value: tex.flag }, uFogCol: { value: new THREE.Color(0xffffff) },
    uFogD: { value: 0.02 }, uTime: { value: 0 }, uSpeed: { value: 0 }, uLight: { value: 1 },
  };
  const flagMat = new THREE.ShaderMaterial({
    vertexShader: FLAG_VERT, fragmentShader: FLAG_FRAG, uniforms: flagU,
    transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false,
  });
  const pole = new THREE.Mesh(tubeGeo(V(-0.660, 0.775, 0), V(-0.660, 1.290, 0), 0.0055, 0.004), M.steel);
  bike.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17, 18, 3), flagMat);
  flag.geometry.translate(0.17, 0, 0);
  flag.rotation.y = Math.PI;
  flag.position.set(-0.660, 1.205, 0);
  bike.add(flag);

  /* a small parcel lashed to the rack */
  const parcel = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.10, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xd9c39a, roughness: 0.95 }));
  parcel.position.set(-0.470, 0.836, 0);
  parcel.rotation.y = 0.12;
  parcel.castShadow = true;
  bike.add(parcel);
  for (const z of [-0.045, 0.045]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.225, 0.108, 0.008), M.accent);
    strap.position.set(-0.470, 0.836, z);
    strap.rotation.y = 0.12;
    bike.add(strap);
  }

  /* -------------------------------------------------------- brakes */
  for (const [hub, ang] of [[P.rearHub, 0], [P.frontHub, 0]]) {
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(tubeGeo(
        V(hub.x - 0.02, hub.y + 0.26, 0.052 * s), V(hub.x + 0.02, hub.y + 0.10, 0.030 * s), 0.007), M.dark);
      bike.add(arm);
    }
  }

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });

  return {
    root, bike, M, wheelR, wheelF, ring, cog, crankGrp, pedals, chain, chainStep,
    basket, basketFish, lamp, lens, spot, beam, beamU, flag, flagU, bell, dome, scene,
    setNight(k) {
      beam.visible = k > 0.02;
      M.lens.emissiveIntensity = 0.25 + k * 5.0;
      spot.intensity = k * 42.0;
      beamU.uStr.value = k * 0.26;
      flagU.uLight.value = 1 - k * 0.55;
    },
  };
}
