// Renderer, post-processing and the deterministic frame entry point: window.renderFrame(t).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { buildWorld, applyTOD, TOD, lerpTOD } from './world.js';
import { buildPerson } from './person.js';
import { makeShots } from './shots.js';

const W_ = 1920, H_ = 804, q = new URLSearchParams(location.search), SCALE = +(q.get('scale') || 1);
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(Math.round(W_ * SCALE), Math.round(H_ * SCALE), false);
canvas.style.width = W_ + 'px'; canvas.style.height = H_ + 'px';
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;

const W = buildWorld(renderer); const scene = W.scene;
const camera = new THREE.PerspectiveCamera(40, W_ / H_, 0.1, 9000); scene.add(camera);
const person = buildPerson(); scene.add(person.root); W.person = person;

const composer = new EffectComposer(renderer);
composer.setSize(Math.round(W_ * SCALE), Math.round(H_ * SCALE));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(Math.round(W_ * SCALE / 4), Math.round(H_ * SCALE / 4)), 0.5, 0.6, 0.82); composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1 }, uCon: { value: 1 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uLift: { value: new THREE.Vector3() },
    uVig: { value: 0.35 }, uGrain: { value: 0.04 }, uFade: { value: 0 }, uFlash: { value: new THREE.Vector3() }, uSepia: { value: 0 }, uSeed: { value: 0 },
    uRedVig: { value: 0 }, uExp: { value: 1 }, uRes: { value: new THREE.Vector2(W_, H_) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat, uCon, uVig, uGrain, uFade, uSepia, uSeed, uRedVig, uExp; uniform vec3 uTint, uLift, uFlash; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
    vec3 kaRRT(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 kaAces(vec3 color){ const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      color *= uExp / 0.6; color = ACESInputMat * color; color = kaRRT(color); color = ACESOutputMat * color; return clamp(color, 0.0, 1.0); }
    vec3 toSRGB(vec3 c){ return mix(c * 12.92, pow(c, vec3(0.41666)) * 1.055 - 0.055, step(0.0031308, c)); }
    void main(){ vec3 c = toSRGB(kaAces(texture2D(tDiffuse, vUv).rgb));
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat);
      vec3 sep = vec3(l) * vec3(1.12, 0.98, 0.78); c = mix(c, sep, uSepia);
      c = (c - 0.5) * uCon + 0.5; c = c * uTint + uLift;
      vec2 d = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 0.62; float v = smoothstep(0.85, 0.15, length(d));
      c *= mix(1.0, v, uVig); c = mix(c, c * vec3(1.0, 0.25, 0.22) + vec3(0.06, 0.0, 0.0) * (1.0 - v), uRedVig * (1.0 - v));
      float g = h(vUv * uRes + fract(uSeed * 13.7)) - 0.5; c += g * uGrain * (0.6 + 0.4 * (1.0 - l));
      c += uFlash; c *= (1.0 - uFade);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); }`,
});
composer.addPass(grade);

W.starMat.uniforms.uScale.value = SCALE; W.emberMat.uniforms.uScale.value = SCALE;
const shots = makeShots(W, THREE);
const ov = { title: document.getElementById('title'), chapter: document.getElementById('chapter'), note: document.getElementById('note'), tag: document.getElementById('tag') };
const DEF = { sat: 1, con: 1, tint: [1, 1, 1], lift: [0, 0, 0], vig: 0.35, grain: 0.035, fade: 0, flash: [0, 0, 0], sepia: 0, redVig: 0, exp: 1, bloom: 0.5 };
window.renderFrame = (t) => {
  const s = shots.at(t);                                  // {cam, tod, grade, state, person, overlay}
  W.WIND.uTime.value = t; W.WIND.uWind.value = s.state.wind ?? 1;
  camera.position.copy(s.cam.pos); camera.up.set(0, 1, 0); camera.lookAt(s.cam.look); if (s.cam.roll) camera.rotateZ(s.cam.roll);
  camera.fov = s.cam.fov ?? 40; camera.updateProjectionMatrix();
  W.fireOn = s.state.fire ?? 1; W.mistOpacity = s.state.mist ?? 0.5; W.logs.visible = s.state.logs !== false; W.bare.visible = !W.logs.visible;
  W.starMat.uniforms.uRot.value = s.state.starRot ?? 0; W.rollMist = s.state.roll ?? 0; W.shadowFocus = s.state.focus || null; W.mistLight = s.state.mistLight ?? 1; W.moonDir = s.state.moonDir || null; W.moonScale = s.state.moonScale ?? 1;
  person.update(s.person, t);
  const tod = typeof s.tod === 'string' ? TOD[s.tod] : s.tod;
  applyTOD(W, tod, camera, t);
  W.key.shadow.camera.updateProjectionMatrix();
  const g = Object.assign({}, DEF, s.grade || {}); const u = grade.uniforms;
  u.uSat.value = g.sat; u.uCon.value = g.con; u.uTint.value.set(...g.tint); u.uLift.value.set(...g.lift); u.uVig.value = g.vig; u.uGrain.value = g.grain;
  u.uFade.value = g.fade; u.uFlash.value.set(...g.flash); u.uSepia.value = g.sepia; u.uRedVig.value = g.redVig; u.uSeed.value = (t * 30 % 1000) * 0.37;
  u.uExp.value = g.exp * (tod.exp ?? 1); bloom.strength = g.bloom;
  if (window.__hide) scene.traverse(o => { if (window.__hide.includes(o.name) || window.__hide.includes(o.type)) o.visible = false; });
  if (s.black) { renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1); renderer.clear(); } else composer.render();
  for (const k of Object.keys(ov)) { const o = (s.overlay || {})[k]; ov[k].style.opacity = o ? o.a.toFixed(3) : '0'; ov[k].style.transform = o && o.tf ? o.tf : 'none'; if (o && o.ls) ov[k].style.letterSpacing = o.ls; }
  return true;
};
window.SHOTS = shots; window.__W = W; window.__scene = scene;
// profiling helper: render frame t n times with optional toggles and return ms per frame (synchronised with a 1-pixel read)
window.prof = (t, n = 3, toggles = {}) => {
  const gl = renderer.getContext(), px = new Uint8Array(4); const saved = [];
  const hide = [];
  for (const [name, on] of Object.entries(toggles)) { if (name === 'shadows') { saved.push(() => { renderer.shadowMap.enabled = true; }); renderer.shadowMap.enabled = on; } else if (name === 'bloom') { saved.push(() => { bloom.enabled = true; }); bloom.enabled = on; } else if (name === 'fireLight') { W.fireLight.intensityScale = on ? 1 : 0; } else if (name === 'everything') { scene.children.forEach(o => { if (o !== camera) hide.push(o); }); } else scene.traverse(o => { if (o.name === name || o === W[name]) hide.push(o); }); }
  const _rf = window.renderFrame; const rf = (t) => { _rf(t); }; window.renderFrame = (t) => { scene.traverse(()=>{}); hide.forEach(o => { o.userData._v = true; }); const r = _rf(t); return r; };
  const vis = () => hide.forEach(o => { o.visible = false; }); const unvis = () => hide.forEach(o => { o.visible = true; });
  const _render = composer.render.bind(composer); composer.render = (...a) => { vis(); _render(...a); unvis(); }; saved.push(() => { composer.render = _render; window.renderFrame = _rf; });
  window.renderFrame(t); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const a = performance.now(); for (let i = 0; i < n; i++) { window.renderFrame(t); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
  const ms = (performance.now() - a) / n; saved.forEach(f => f()); return ms;
};
document.fonts.ready.then(() => { window.renderFrame(+(q.get('t') || 0)); window.READY = true; });
