/* ============================================================================
   D · POST — hand-rolled HDR post chain (no addons):
   MSAA HDR target → bright pass → 2-level separable blur → ACES composite
   with radial speed blur, chromatic aberration, grain, vignette and grade.
   ========================================================================== */

const FS_VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT_FRAG = `
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThresh, uKnee;
varying vec2 vUv;
void main(){
  vec3 c = vec3(0.0);
  c += texture2D(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(uTex, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  c += texture2D(uTex, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  c += texture2D(uTex, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  c *= 0.25;
  /* NaN / negative guard: one poisoned texel would otherwise smear across the
     whole blur kernel and read as a black block. */
  c = mix(vec3(0.0), c, greaterThanEqual(c, vec3(0.0)));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float s = clamp((l - uThresh + uKnee) / (2.0 * uKnee), 0.0, 1.0);
  float w = max(s * s * uKnee, l - uThresh) / max(l, 1e-4);
  gl_FragColor = vec4(c * w, 1.0);
}`;

const BLUR_FRAG = `
uniform sampler2D uTex; uniform vec2 uDir;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(uTex, vUv).rgb * 0.2270270270;
  c += texture2D(uTex, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(uTex, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(uTex, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(uTex, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

const COMP_FRAG = `
uniform sampler2D uScene, uB1, uB2;
uniform float uBloom, uSpeed, uTime, uGrain, uVig, uCA, uExposure, uPop, uSat, uNight;
uniform vec2 uRes;
varying vec2 vUv;

vec3 aces(vec3 x){
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
float h21(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p + 19.19); return fract(p.x * p.y); }
vec3 lin2srgb(vec3 c){
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

void main(){
  vec2 uv = vUv;
  vec2 d = uv - 0.5;
  float r = length(d);

  /* radial speed streaks grow from the edges only */
  float amt = uSpeed * smoothstep(0.34, 0.92, r) * 0.020;
  vec3 base = vec3(0.0);
  if (amt > 0.0004){
    for (int i = 0; i < 6; i++){
      float t = float(i) / 5.0;
      base += texture2D(uScene, uv - d * amt * t).rgb;
    }
    base /= 6.0;
  } else {
    base = texture2D(uScene, uv).rgb;
  }

  /* chromatic aberration, radial */
  float ca = uCA * smoothstep(0.34, 0.95, r) * 0.0022;
  base.r = texture2D(uScene, uv - d * ca).r;
  base.b = texture2D(uScene, uv + d * ca).b;

  vec3 bloom = texture2D(uB1, uv).rgb * 0.62 + texture2D(uB2, uv).rgb * 0.38;
  bloom = mix(vec3(0.0), bloom, greaterThanEqual(bloom, vec3(0.0)));
  base = mix(vec3(0.0), base, greaterThanEqual(base, vec3(0.0)));
  vec3 col = base + bloom * uBloom;

  col += vec3(1.0, 0.55, 0.35) * uPop * (0.16 + 0.5 * smoothstep(0.15, 0.72, r));

  col = aces(col * uExposure);

  /* grade: cool the shadows, warm the highlights, gentle saturation lift */
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);
  col += vec3(-0.010, 0.002, 0.022) * (1.0 - smoothstep(0.0, 0.42, l)) * (1.0 + uNight);
  col += vec3(0.020, 0.008, -0.010) * smoothstep(0.55, 1.0, l);
  col *= mix(vec3(1.0), vec3(0.90, 0.96, 1.10), uNight);

  col *= 1.0 - uVig * smoothstep(0.32, 0.98, r);

  float g = h21(uv * uRes + fract(uTime) * 137.0) - 0.5;
  col += g * uGrain * (1.0 - 0.55 * smoothstep(0.0, 0.7, l));

  gl_FragColor = vec4(lin2srgb(col), 1.0);
}`;

class Post {
  constructor(renderer) {
    this.r = renderer;
    const opt = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.rtScene = new THREE.WebGLRenderTarget(2, 2, { ...opt, samples: 4, depthBuffer: true, stencilBuffer: false });
    this.rtA = new THREE.WebGLRenderTarget(2, 2, opt);
    this.rtB = new THREE.WebGLRenderTarget(2, 2, opt);
    this.rtC = new THREE.WebGLRenderTarget(2, 2, opt);
    this.rtD = new THREE.WebGLRenderTarget(2, 2, opt);
    for (const t of [this.rtA, this.rtB, this.rtC, this.rtD]) { t.texture.colorSpace = THREE.LinearSRGBColorSpace; t.depthBuffer = false; }
    this.rtScene.texture.colorSpace = THREE.LinearSRGBColorSpace;

    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.quad.frustumCulled = false;

    const mk = (frag, uniforms) => new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false,
    });
    this.mBright = mk(BRIGHT_FRAG, {
      uTex: { value: null }, uTexel: { value: new THREE.Vector2() },
      uThresh: { value: 1.05 }, uKnee: { value: 0.62 },
    });
    this.mBlur = mk(BLUR_FRAG, { uTex: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.mComp = mk(COMP_FRAG, {
      uScene: { value: this.rtScene.texture }, uB1: { value: this.rtA.texture }, uB2: { value: this.rtC.texture },
      uBloom: { value: 0.72 }, uSpeed: { value: 0 }, uTime: { value: 0 }, uGrain: { value: 0.035 },
      uVig: { value: 0.46 }, uCA: { value: 1.0 }, uExposure: { value: 1.0 }, uPop: { value: 0 },
      uSat: { value: 1.08 }, uNight: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    });
  }

  setSize(w, h) {
    this.rtScene.setSize(w, h);
    const h2 = [Math.max(2, w >> 1), Math.max(2, h >> 1)];
    const h4 = [Math.max(2, w >> 2), Math.max(2, h >> 2)];
    this.rtA.setSize(h2[0], h2[1]); this.rtB.setSize(h2[0], h2[1]);
    this.rtC.setSize(h4[0], h4[1]); this.rtD.setSize(h4[0], h4[1]);
    this.mComp.uniforms.uRes.value.set(w, h);
  }

  blit(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.quadScene, this.cam);
  }

  render(scene, camera) {
    const r = this.r;
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(scene, camera);

    const bu = this.mBright.uniforms;
    bu.uTex.value = this.rtScene.texture;
    bu.uTexel.value.set(1 / this.rtA.width, 1 / this.rtA.height);
    this.blit(this.mBright, this.rtA);

    const blur = (src, dst, dx, dy) => {
      this.mBlur.uniforms.uTex.value = src.texture;
      this.mBlur.uniforms.uDir.value.set(dx / dst.width, dy / dst.height);
      this.blit(this.mBlur, dst);
    };
    blur(this.rtA, this.rtB, 1, 0);
    blur(this.rtB, this.rtA, 0, 1);
    blur(this.rtA, this.rtC, 1, 0);
    blur(this.rtC, this.rtD, 0, 1);
    blur(this.rtD, this.rtC, 1.7, 0);
    blur(this.rtC, this.rtD, 0, 1.7);
    this.mComp.uniforms.uB2.value = this.rtD.texture;

    r.setRenderTarget(null);
    this.blit(this.mComp, null);
  }
}
