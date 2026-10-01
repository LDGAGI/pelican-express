/* ============================================================================
   H · FX — GPU point-sprite pools, jumping fish, tyre spray, catch burst
   ========================================================================== */

const PT_VERT = `
attribute float aSize; attribute float aLife; attribute vec3 aColor;
varying float vLife; varying vec3 vColor;
void main(){
  vLife = aLife; vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (260.0 / max(-mv.z, 0.1)) * (0.35 + aLife * 0.65);
  gl_Position = projectionMatrix * mv;
}`;

const PT_FRAG = `
uniform float uSoft;
varying float vLife; varying vec3 vColor;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d) * 4.0;
  if (r > 1.0) discard;
  float a = pow(1.0 - r, uSoft) * vLife;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor, a);
}`;

class Particles {
  constructor(scene, n, additive, soft = 1.6) {
    this.n = n; this.head = 0;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.size = new Float32Array(n);
    this.col = new Float32Array(n * 3);
    this.grav = new Float32Array(n);
    this.drag = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: PT_VERT, fragmentShader: PT_FRAG,
      uniforms: { uSoft: { value: soft } },
      transparent: true, depthWrite: false, fog: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, size, life, col, grav = -6, drag = 0.6) {
    const i = this.head; this.head = (this.head + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.size[i] = size; this.max[i] = life; this.life[i] = 1;
    this.col[i * 3] = col[0]; this.col[i * 3 + 1] = col[1]; this.col[i * 3 + 2] = col[2];
    this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt / this.max[i];
      if (this.life[i] <= 0) { this.life[i] = 0; continue; }
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 2] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k + this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aLife.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
  }
}

const FX = {
  build(scene, pelican) {
    this.spray = new Particles(scene, 420, false, 1.5);
    this.spark = new Particles(scene, 260, true, 2.2);
    this.fishMat = new THREE.MeshStandardMaterial({
      color: 0x7fd0dd, roughness: 0.25, metalness: 0.45, side: THREE.DoubleSide,
      emissive: 0x1a4a52, emissiveIntensity: 0.5,
    });
    this.jumpers = [];
    const fg = fishGeo(0.30);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(fg, this.fishMat);
      m.visible = false;
      scene.add(m);
      this.jumpers.push({ m, t: -1, x: 0, y: 0, z: 0, vy: 0, vx: 0, spin: 0 });
    }
    this.jumpT = 2;
    this.pelican = pelican;
    this.dustT = 0;
    this.pop = 0;
    return this;
  },

  splash(x, y, z, power = 1, col = [0.92, 0.97, 1.0]) {
    const n = Math.round(16 * power);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = (0.8 + Math.random() * 2.4) * power;
      this.spray.spawn(x, y, z,
        Math.cos(a) * sp, (1.6 + Math.random() * 3.4) * power, Math.sin(a) * sp,
        0.9 + Math.random() * 1.6, 0.5 + Math.random() * 0.7, col, -8.5, 0.5);
    }
  },

  burst(v, n = 26) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, e = Math.random() * Math.PI - Math.PI / 2;
      const sp = 1.4 + Math.random() * 3.2;
      this.spray.spawn(v.x, v.y, v.z,
        Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 1.4, Math.sin(a) * Math.cos(e) * sp,
        0.7 + Math.random() * 1.2, 0.4 + Math.random() * 0.5, [1.0, 0.72, 0.42], -7, 0.7);
    }
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * TAU;
      this.spark.spawn(v.x, v.y, v.z,
        Math.cos(a) * 2.2, Math.random() * 2.4, Math.sin(a) * 2.2,
        1.1 + Math.random() * 1.4, 0.45, [1.0, 0.85, 0.55], -3, 1.2);
    }
    this.pop = 1;
  },

  update(dt, t, s, camPos) {
    this.spray.update(dt);
    this.spark.update(dt);
    this.pop = Math.max(0, this.pop - dt * 3.2);

    /* spray off the rear tyre, scaling with speed */
    this.dustT -= dt;
    if (s.running > 0.2 && this.dustT <= 0) {
      this.dustT = 0.035;
      const n = 1 + Math.floor(s.speed * 0.5);
      for (let i = 0; i < n; i++) {
        const wet = Math.random() < 0.35;
        this.spray.spawn(
          BIKE.rearHub.x + rand(-0.05, 0.05), 0.02, BIKE.rearHub.z + rand(-0.05, 0.05),
          -s.speed * rand(0.15, 0.45) + rand(-0.4, 0.4), rand(0.6, 2.0) * s.running, rand(-0.5, 0.5),
          wet ? 0.6 : 1.1, wet ? 0.35 : 0.6,
          wet ? [0.86, 0.92, 0.98] : [0.78, 0.72, 0.62], -5.5, 1.1);
      }
    }

    /* leaping fish */
    this.jumpT -= dt;
    if (this.jumpT <= 0) {
      this.jumpT = rand(2.2, 6.5);
      const f = this.jumpers.find((j) => j.t < 0);
      if (f) {
        f.t = 0;
        f.x = rand(6, 30); f.z = W.shoreZ + rand(1.5, 16); f.y = W.seaY;
        f.vy = 3.6 + Math.random() * 2.4;
        f.vx = -rand(2, 5);
        f.spin = rand(-6, 6);
        f.m.visible = true;
      }
    }
    for (const f of this.jumpers) {
      if (f.t < 0) continue;
      f.t += dt;
      f.vy -= 11 * dt;
      f.y += f.vy * dt;
      f.x += f.vx * dt;
      f.m.position.set(f.x, f.y, f.z);
      f.m.rotation.set(0, 0.4, -f.vx * 0.16);
      f.m.rotation.z += f.spin * dt * 0.4;
      if (f.y < W.seaY) {
        this.splash(f.x, W.seaY, f.z, 1.3);
        f.t = -1; f.m.visible = false;
      }
      if (f.x < -W.wrapFar) { f.t = -1; f.m.visible = false; }
    }

    /* night sparkle over the water */
    if (s.night > 0.35 && Math.random() < dt * 26) {
      const x = camPos.x + rand(-28, 28), z = W.shoreZ + rand(0, 26);
      this.spark.spawn(x, W.seaY + rand(0.1, 0.7), z, rand(-0.2, 0.2), rand(0.05, 0.3), rand(-0.2, 0.2),
        0.9 + Math.random(), 0.9, [0.75, 0.92, 1.0], 0, 0.4);
    }
  },
};
