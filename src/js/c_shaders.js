/* ============================================================================
   C · SHADERS — hand-written GLSL: sky dome, Gerstner ocean, cloth, beams
   ========================================================================== */

const GLSL_NOISE = `
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = p * 2.03 + vec2(3.1, 1.7); a *= 0.5; }
  return v;
}
float ridge(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ v += a * (1.0 - abs(vnoise(p) * 2.0 - 1.0)); p = p * 2.11; a *= 0.5; }
  return v;
}
vec3 skyTint(vec3 d, vec3 top, vec3 mid, vec3 hor){
  float h = d.y;
  vec3 c = mix(hor, mid, smoothstep(-0.01, 0.26, h));
  c = mix(c, top, smoothstep(0.20, 0.82, h));
  return c;
}
`;

/* ------------------------------------------------------------------ SKY */
const SKY_VERT = `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = GLSL_NOISE + `
uniform vec3 uTop, uMid, uHor, uGround, uSunCol, uSunDir;
uniform float uTime, uStars, uSunSize, uMoon, uCloud, uFlash;
varying vec3 vDir;

void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = skyTint(d, uTop, uMid, uHor);
  col = mix(uGround, col, smoothstep(-0.22, 0.005, h));

  float sd = dot(d, normalize(uSunDir));

  /* --- clouds: project the ray onto a slab so they compress at the horizon */
  float cy = max(h, 0.045);
  vec2 cp = d.xz / cy * 0.42 + vec2(uTime * 0.0055, uTime * 0.0022);
  float base = fbm(cp * 0.9);
  float det  = fbm(cp * 2.7 + base * 1.4);
  float mass = base * 0.68 + det * 0.32;
  float cover = smoothstep(0.50 - uCloud * 0.22, 0.80, mass);
  cover *= smoothstep(0.015, 0.20, h);
  float shade = smoothstep(0.42, 0.78, det + (0.34 - abs(sd)) * 0.25);
  vec3 lit = mix(uHor * 0.72, uSunCol, 0.45) * 1.22;
  vec3 dark = mix(uMid, uTop, 0.45) * 0.86;
  vec3 cloud = mix(dark, lit, shade);
  cloud += uSunCol * pow(max(sd, 0.0), 12.0) * 0.55 * (1.0 - shade) * cover;
  col = mix(col, cloud, cover * 0.94);

  /* --- stars */
  if (uStars > 0.001){
    vec2 sp = vec2(atan(d.z, d.x) * 1.6, d.y * 2.2);
    vec2 g = sp * 190.0, id = floor(g), f = fract(g) - 0.5;
    float r = hash21(id);
    float tw = 0.55 + 0.45 * sin(uTime * 2.3 + r * 130.0);
    float star = smoothstep(0.085, 0.0, length(f)) * step(0.9825, r) * tw;
    col += vec3(0.82, 0.88, 1.0) * star * uStars * 2.6 * smoothstep(0.02, 0.3, h);
  }

  /* --- sun / moon */
  float ang = acos(clamp(sd, -1.0, 1.0));
  float disc = 1.0 - smoothstep(uSunSize * 0.82, uSunSize * 1.12, ang);
  float halo = pow(max(sd, 0.0), mix(950.0, 320.0, uMoon));
  float wide = pow(max(sd, 0.0), mix(9.0, 5.0, uMoon)) * 0.30;
  float speck = pow(max(sd, 0.0), 42.0) * 0.55;
  if (uMoon > 0.5){
    /* craters: cheap 2D value noise over the disc's own screen-space frame */
    float cr = 0.76 + 0.24 * vnoise(vec2(atan(d.z, d.x), d.y) * 96.0);
    col += uSunCol * disc * cr * 2.6;
  } else {
    col += uSunCol * disc * 7.0;
  }
  col += uSunCol * (halo * 2.2 + wide + speck) * mix(1.0, 0.22, uMoon);
  col += uSunCol * uFlash * 0.9 * pow(max(sd, 0.0), 3.0);

  gl_FragColor = vec4(col, 1.0);
}`;

/* ------------------------------------------------------------------ SEA */
const SEA_VERT = `
uniform float uTime, uScroll, uDetail, uShoreZ;
varying vec3 vWorld;
varying vec3 vNrm;
varying float vCrest;

const vec4 W0 = vec4( 0.97,  0.24, 72.0, 0.30);
const vec4 W1 = vec4( 0.84, -0.54, 36.0, 0.26);
const vec4 W2 = vec4( 0.60,  0.80, 18.0, 0.22);
const vec4 W3 = vec4( 0.33, -0.94,  9.0, 0.18);
const vec4 W4 = vec4(-0.75,  0.66,  4.5, 0.14);

void gerstner(vec2 p, float t, out vec3 disp, out vec3 nrm, out float crest, float off){
  disp = vec3(0.0); crest = 0.0;
  vec3 B = vec3(0.0, 0.0, 1.0), T = vec3(1.0, 0.0, 0.0);
  for (int i = 0; i < 5; i++){
    vec4 w = i == 0 ? W0 : i == 1 ? W1 : i == 2 ? W2 : i == 3 ? W3 : W4;
    vec2 D = normalize(w.xy);
    float L = w.z, k = 6.28318530718 / L;
    float att = mix(0.22, 1.0, smoothstep(0.0, 46.0, off));
    float A = w.w * 1.55 * att, Q = w.w * 0.60 * att;
    float om = sqrt(9.81 * k);
    float th = k * dot(D, p) - om * t;
    float s = sin(th), c = cos(th);
    disp.x += Q * A * D.x * c;
    disp.z += Q * A * D.y * c;
    disp.y += A * s;
    crest += A * s;
    float ka = k * A;
    B.x -= Q * ka * D.x * D.x * s;
    B.y += D.x * ka * c;
    B.z -= Q * ka * D.x * D.y * s;
    T.x -= Q * ka * D.x * D.y * s;
    T.y += D.y * ka * c;
    T.z -= Q * ka * D.y * D.y * s;
  }
  nrm = normalize(cross(T, B));
}

void main(){
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  vec2 p = vec2(wp.x - uScroll, wp.z);
  vec3 disp = vec3(0.0), nrm = vec3(0.0, 1.0, 0.0);
  float crest = 0.0;
  if (uDetail > 0.5) gerstner(p, uTime, disp, nrm, crest, wp.z - uShoreZ);
  vWorld = wp + disp;
  vNrm = nrm;
  vCrest = crest;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const SEA_FRAG = GLSL_NOISE + `
uniform vec3 uSea, uSeaDeep, uSunCol, uSunDir, uFogCol, uHor, uMid, uTop;
uniform float uTime, uScroll, uFogD, uShoreZ, uNight;
varying vec3 vWorld;
varying vec3 vNrm;
varying float vCrest;

void main(){
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNrm);

  /* fine ripple detail folded into the normal (cheap, no extra geometry) */
  vec2 q = vec2(vWorld.x - uScroll, vWorld.z) * 0.55;
  float e = 0.35;
  float n0 = fbm(q), nx = fbm(q + vec2(e, 0.0)), nz = fbm(q + vec2(0.0, e));
  float amp = 0.55 * smoothstep(0.0, 24.0, vWorld.z - uShoreZ);
  N = normalize(N + vec3(-(nx - n0), 0.0, -(nz - n0)) * amp * 5.0);
  N = normalize(mix(vec3(0.0, 1.0, 0.0), N, 0.92));

  float depth = smoothstep(0.0, 30.0, vWorld.z - uShoreZ);
  vec3 base = mix(uSea, uSeaDeep, depth);
  base = mix(base, uSea * 1.22, clamp(vCrest * 0.42 + 0.12, 0.0, 0.6));

  /* fresnel sky reflection */
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  vec3 sky = skyTint(R, uTop, uMid, uHor);
  float F = 0.024 + 0.976 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.6);
  vec3 col = mix(base, sky, F * 0.84);

  /* sun specular + glitter road */
  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);
  float nh = max(dot(N, H), 0.0);
  col += uSunCol * pow(nh, 620.0) * 26.0;
  col += uSunCol * pow(nh, 46.0) * 0.42;
  float glit = smoothstep(0.72, 1.0, vnoise(vec2(vWorld.x - uScroll, vWorld.z) * 2.3 + uTime * 0.35));
  col += uSunCol * glit * pow(nh, 12.0) * 1.6 * (1.0 - uNight * 0.55);

  /* foam: crests + surf line along the shore */
  float shoreFoam = smoothstep(3.4, 0.0, vWorld.z - uShoreZ) * (0.55 + 0.45 * sin(vWorld.z * 1.4 - uTime * 0.9));
  float crestFoam = smoothstep(0.52, 1.05, vCrest);
  float fn = fbm(vec2(vWorld.x * 0.9 - uScroll, vWorld.z * 1.4) + uTime * 0.22);
  float foam = clamp(shoreFoam * 0.95 + crestFoam * 0.55, 0.0, 1.0) * smoothstep(0.30, 0.75, fn);
  col = mix(col, vec3(0.94, 0.97, 0.99), foam * 0.72);

  float dist = length(cameraPosition - vWorld);
  float fg = 1.0 - exp(-pow(dist * uFogD, 2.0));
  col = mix(col, uFogCol, clamp(fg, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
}`;

/* --------------------------------------------- wind sway for instanced grass */
function swayMaterial(mat, height = 0.5, amount = 1.0) {
  mat.userData.uTime = { value: 0 };
  mat.userData.uWind = { value: 1 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = mat.userData.uTime;
    sh.uniforms.uWind = mat.userData.uWind;
    sh.uniforms.uH = { value: height };
    sh.uniforms.uA = { value: amount };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uWind; uniform float uH; uniform float uA;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec3 ip = instanceMatrix[3].xyz;
          float b = pow(clamp(transformed.y / uH, 0.0, 1.0), 1.8);
          float w = sin(uTime * 1.9 + ip.x * 0.42 + ip.z * 0.31)
                  + 0.45 * sin(uTime * 3.7 + ip.x * 1.1 + ip.z * 0.8);
          transformed.x += w * 0.13 * b * uA * uWind;
          transformed.z += w * 0.055 * b * uA * uWind;
        }`);
  };
  mat.customProgramCacheKey = () => 'sway' + amount;
  return mat;
}

/* ------------------------------------------------------------- fish pennant */
const FLAG_VERT = `
uniform float uTime; uniform float uSpeed;
varying vec2 vUv; varying float vSh;
void main(){
  vUv = uv;
  vec3 p = position;
  float t = uv.x;
  float w = sin(t * 7.0 - uTime * 7.0) * 0.055 * t
          + sin(t * 12.0 - uTime * 11.0 + uv.y * 2.0) * 0.028 * t;
  p.z += w * (0.35 + uSpeed * 0.55);
  p.y += sin(t * 5.0 - uTime * 6.0) * 0.018 * t;
  vSh = w;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const FLAG_FRAG = `
uniform sampler2D uMap; uniform vec3 uFogCol; uniform float uFogD; uniform float uLight;
varying vec2 vUv; varying float vSh;
void main(){
  vec4 c = texture2D(uMap, vUv);
  if (c.a < 0.35) discard;
  vec3 col = c.rgb * (0.72 + uLight * 0.55) + vec3(0.35, 0.42, 0.5) * max(vSh, 0.0) * 2.2;
  gl_FragColor = vec4(col, c.a);
}`;

/* ------------------------------------------------------------ headlamp beam */
const BEAM_VERT = `
varying float vY; varying vec3 vN;
void main(){
  vY = uv.y; vN = normalMatrix * normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const BEAM_FRAG = `
uniform vec3 uCol; uniform float uStr; uniform float uTime;
varying float vY; varying vec3 vN;
void main(){
  float a = pow(clamp(1.0 - clamp(vY, 0.0, 1.0), 0.0, 1.0), 2.1) * uStr;
  a = clamp(a, 0.0, 1.0) * (0.78 + 0.22 * sin(uTime * 9.0 + vY * 6.0));
  gl_FragColor = vec4(uCol * a * 2.2, a * 0.55);
}`;
