/* ============================================================================
   A · CORE — three.js bootstrap, palette, world constants
   ========================================================================== */
let THREE;
try {
  THREE = await import('three');
} catch (e) {
  THREE = await import('https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js');
}

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/* Palette — warm coastal dusk against deep ink. One accent, one support. */
const PAL = {
  ink:        0x080d14,
  paper:      0xf7f2e7,
  accent:     0xff6a45,   // pelican beak / primary accent
  teal:       0x3fc9c0,   // sea / secondary
  butter:     0xffd48a,   // sun / highlight
  plum:       0x2b2140,
};

/* World metrics (metres). The bike stays at the origin; the coast slides past. */
const W = {
  wheelR:      0.335,
  roadW:       4.30,
  seaY:       -0.74,
  shoreZ:     6.60,      // where sand meets water
  fogDensity:  0.0255,
  wrapFar:     78,        // props recycle past this
  span:        168,       // prop recycling period
};

/* Day / night presets, cross-faded by the ☀ toggle. */
const SKY = {
  day: {
    top:     new THREE.Color(0x1d5f9e),
    mid:     new THREE.Color(0x6fb6d8),
    horizon: new THREE.Color(0xdfeef0),
    ground:  new THREE.Color(0x9fb6b4),
    sun:     new THREE.Color(0xfff4dc),
    sunDir:  new THREE.Vector3(0.26, 0.60, -0.76).normalize(),
    sunI:    3.05,
    ambI:    0.78,
    ambC:    new THREE.Color(0x9fc4e8),
    sea:     new THREE.Color(0x1a6f8c),
    seaDeep: new THREE.Color(0x0a3a55),
    fog:     new THREE.Color(0xcfe4ea),
    fogD:    0.0128,
    sunSize: 0.021,
    starA:   0.0,
  },
  dusk: {
    top:     new THREE.Color(0x2a2f6b),
    mid:     new THREE.Color(0x9a5a8e),
    horizon: new THREE.Color(0xff9d5c),
    ground:  new THREE.Color(0x6b4a52),
    sun:     new THREE.Color(0xffb066),
    sunDir:  new THREE.Vector3(0.86, 0.115, 0.50).normalize(),
    sunI:    2.35,
    ambI:    0.62,
    ambC:    new THREE.Color(0xc98fb0),
    sea:     new THREE.Color(0x2a5f7a),
    seaDeep: new THREE.Color(0x12304a),
    fog:     new THREE.Color(0xf0a578),
    fogD:    0.0165,
    sunSize: 0.036,
    starA:   0.12,
  },
  night: {
    top:     new THREE.Color(0x05070f),
    mid:     new THREE.Color(0x0b1430),
    horizon: new THREE.Color(0x1d2b4f),
    ground:  new THREE.Color(0x0a1020),
    sun:     new THREE.Color(0xcfe0ff),
    sunDir:  new THREE.Vector3(-0.30, 0.62, 0.72).normalize(),
    sunI:    0.55,
    ambI:    0.46,
    ambC:    new THREE.Color(0x5c82bc),
    sea:     new THREE.Color(0x0a1c30),
    seaDeep: new THREE.Color(0x040a14),
    fog:     new THREE.Color(0x111c33),
    fogD:    0.0205,
    sunSize: 0.026,
    starA:   1.0,
  },
};
