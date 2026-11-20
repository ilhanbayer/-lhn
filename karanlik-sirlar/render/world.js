// "Kanlı Ardıç" world: highland plateau, five ancient junipers with a makam, lichen rocks, a Yörük tent with a
// campfire and a log pile, the Taurus range, sky with sun/moon/stars, fog and ground mist. Deterministic.
import * as THREE from 'three';

// ---------------------------------------------------------------- noise
export const rng = s => () => ((s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5 | 0, ((s ^ (s >>> 14)) >>> 0) / 4294967296));
const hash = (x, y, s) => { let h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); };
const sstep = t => t * t * (3 - 2 * t);
export function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), u = sstep(x - xi), v = sstep(y - yi);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
}
export function fbm(x, y, o = 5, s = 0) { let t = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { t += a * vnoise(x * f, y * f, s + i * 13); n += a; a *= 0.5; f *= 2.03; } return t / n; }
function ridged(x, y, o = 5, s = 0) { let t = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { const v = 1 - Math.abs(2 * vnoise(x * f, y * f, s + i * 7) - 1); t += a * v * v; n += a; a *= 0.5; f *= 2.1; } return t / n; }
export const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- layout
export const SPOTS = {
  grove: new THREE.Vector3(0, 0, 0),          // centre of the five junipers (makam)
  tent: new THREE.Vector3(22, 0, 14),
  fire: new THREE.Vector3(18.6, 0, 10.6),
  logs: new THREE.Vector3(24.2, 0, 10.6),
  chop: new THREE.Vector3(8.2, 0, 4.6),
};
export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  let h = 2.0 * fbm(x / 55, z / 55, 4, 1) + 0.6 * fbm(x / 13, z / 13, 3, 2) - 1.3;
  h += 3.4 * Math.exp(-(x * x + z * z) / (2 * 15 * 15));                                   // the juniper knoll
  const camp = Math.exp(-((x - 21) ** 2 + (z - 12) ** 2) / (2 * 8 * 8)); h = h * (1 - 0.75 * camp) + camp * 0.9;
  const m = smoothstep(150, 620, r);
  h += m * (30 + 300 * Math.pow(ridged(x / 280 + 3.1, z / 280 - 1.7, 5, 3), 1.7) + 70 * fbm(x / 90, z / 90, 4, 4));
  h += smoothstep(70, 200, r) * 9 * fbm(x / 40, z / 40, 3, 6);
  return h;
}
for (const k of Object.keys(SPOTS)) SPOTS[k].y = heightAt(SPOTS[k].x, SPOTS[k].z);

// ---------------------------------------------------------------- materials helpers
const WIND = { uTime: { value: 0 }, uWind: { value: 1 } };
function windify(mat, amp = 0.12, start = 1.0) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = WIND.uTime; sh.uniforms.uWind = WIND.uWind;
    sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      vec4 wp = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        wp = instanceMatrix * wp;
      #endif
      wp = modelMatrix * wp;
      float hgt = max(0.0, wp.y - ${start.toFixed(2)});
      float sway = sin(uTime * 1.3 + wp.x * 0.35 + wp.z * 0.21) + 0.5 * sin(uTime * 2.9 + wp.x * 0.9);
      wp.x += sway * ${amp.toFixed(3)} * uWind * hgt * 0.25;
      wp.z += cos(uTime * 1.1 + wp.z * 0.3) * ${(amp * 0.6).toFixed(3)} * uWind * hgt * 0.25;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => 'wind' + amp + start;
  return mat;
}
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function displaced(geo, amt, freq, seed) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = fbm(v.x * freq + seed, v.y * freq + v.z * freq * 0.7, 4, seed);
    v.multiplyScalar(1 + (n - 0.5) * amt); p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals(); return geo;
}
// tube along a curve with tapering radius and bark vertex colours
function branchGeo(points, r0, r1, seed, radial = 9) {
  const curve = new THREE.CatmullRomCurve3(points); const segs = Math.max(6, Math.round(curve.getLength() * 5));
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false); const p = g.attributes.position, cols = [];
  const R = rng(seed);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, c = curve.getPointAt(t), r = THREE.MathUtils.lerp(r0, r1, Math.pow(t, 0.8));
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j; const x = p.getX(k) - c.x, y = p.getY(k) - c.y, z = p.getZ(k) - c.z;
      const knob = 1 + 0.18 * (fbm(t * 6 + seed, j * 0.7, 2, seed) - 0.5);
      p.setXYZ(k, c.x + x * r * knob, c.y + y * r * knob, c.z + z * r * knob);
      const stripe = 0.75 + 0.35 * fbm(j * 1.7 + seed, t * 24, 3, seed + 1);
      cols.push(0.33 * stripe, 0.28 * stripe, 0.24 * stripe);
    }
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); return g;
}

// ---------------------------------------------------------------- builders
function makeJuniper(seed, scale, barkMat, foliageMat, clumpGeo) {
  const R = rng(seed), group = new THREE.Group(), clumps = [];
  const stems = 1 + Math.floor(R() * 3);
  for (let s = 0; s < stems; s++) {
    const ang = R() * Math.PI * 2, lean = 0.15 + R() * 0.35, H = (3.6 + R() * 2.4) * scale;
    const pts = []; let x = 0, z = 0;
    for (let i = 0; i <= 6; i++) {
      const t = i / 6; x += Math.cos(ang + t * 2.2 + R() * 0.6) * lean * 0.55 * scale; z += Math.sin(ang + t * 2.2 + R() * 0.6) * lean * 0.55 * scale;
      pts.push(new THREE.Vector3(x + (R() - 0.5) * 0.15, t * H, z + (R() - 0.5) * 0.15));
    }
    group.add(new THREE.Mesh(branchGeo(pts, (0.32 + R() * 0.12) * scale, 0.07 * scale, seed + s * 31), barkMat));
    const nb = 4 + Math.floor(R() * 4);
    for (let b = 0; b < nb; b++) {
      const t = 0.32 + R() * 0.6, base = new THREE.CatmullRomCurve3(pts).getPointAt(t), dir = R() * Math.PI * 2, L = (1.4 + R() * 2.4) * scale * (1.1 - t * 0.5);
      const bp = [base.clone()];
      for (let i = 1; i <= 4; i++) { const k = i / 4; bp.push(new THREE.Vector3(base.x + Math.cos(dir + k * 0.5) * L * k, base.y + L * k * (0.35 + R() * 0.4) - k * k * 0.3, base.z + Math.sin(dir + k * 0.5) * L * k)); }
      group.add(new THREE.Mesh(branchGeo(bp, 0.11 * scale * (1.2 - t * 0.6), 0.03 * scale, seed + b * 7 + s * 101, 7), barkMat));
      const tip = bp[bp.length - 1];
      for (let c = 0; c < 4; c++) clumps.push([tip.x + (R() - 0.5) * 1.2 * scale, tip.y + (R() - 0.3) * 0.8 * scale, tip.z + (R() - 0.5) * 1.2 * scale, (0.7 + R() * 0.8) * scale]);
      clumps.push([(base.x + tip.x) / 2, (base.y + tip.y) / 2 + 0.3 * scale, (base.z + tip.z) / 2, (0.6 + R() * 0.6) * scale]);
    }
    const top = pts[pts.length - 1];
    for (let c = 0; c < 6; c++) clumps.push([top.x + (R() - 0.5) * 1.6 * scale, top.y - R() * 1.6 * scale, top.z + (R() - 0.5) * 1.6 * scale, (0.8 + R() * 0.9) * scale]);
  }
  const inst = new THREE.InstancedMesh(clumpGeo, foliageMat, clumps.length); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  clumps.forEach(([x, y, z, s], i) => {
    e.set(R() * 6, R() * 6, R() * 6); q.setFromEuler(e); m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s * 1.15, s * 0.72, s * 1.15)); inst.setMatrixAt(i, m);
    col.setHSL(0.27 + R() * 0.07, 0.25 + R() * 0.15, 0.12 + R() * 0.07); inst.setColorAt(i, col);
  });
  inst.castShadow = true; inst.receiveShadow = true; group.add(inst);
  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.userData.clumps = clumps; return group;
}
function makeRock(seed, size, mat) {
  const g = displaced(new THREE.IcosahedronGeometry(1, 4), 0.55, 1.6, seed); const R = rng(seed), p = g.attributes.position, cols = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), base = 0.36 + 0.12 * fbm(x * 3 + seed, z * 3 + y, 3, seed);
    let c = [base, base * 0.97, base * 0.93];
    const lich = fbm(x * 5.5 + seed * 2, y * 5.5 + z * 3, 3, seed + 9);
    if (lich > 0.62) c = [0.62, 0.38, 0.16]; else if (lich < 0.3) c = [0.52, 0.55, 0.36];
    cols.push(...c);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(g, mat); m.scale.set(size * (0.9 + R() * 0.5), size * (0.55 + R() * 0.4), size * (0.9 + R() * 0.5)); m.rotation.y = R() * 6;
  m.castShadow = m.receiveShadow = true; return m;
}

export function buildWorld(renderer) {
  const scene = new THREE.Scene(); const W = {};
  // terrain: near (1 m) + far (10 m)
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  function terrain(size, segs, sink) {
    const g = new THREE.PlaneGeometry(size, size, segs, segs); g.rotateX(-Math.PI / 2); const p = g.attributes.position, cols = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i); let h = heightAt(x, z); if (sink && Math.abs(x) < 118 && Math.abs(z) < 118) h -= 1.5;
      p.setY(i, h);
      const n = fbm(x / 18, z / 18, 3, 7), n2 = fbm(x / 4, z / 4, 2, 8), hx = heightAt(x + 1, z) - h, hz = heightAt(x, z + 1) - h, slope = Math.hypot(hx, hz);
      let c = [0.36 + 0.18 * n, 0.36 + 0.12 * n, 0.18 + 0.06 * n2];               // dry steppe grass
      if (n2 > 0.6) c = [0.26, 0.33, 0.15];                                         // green patches
      const rock = smoothstep(0.55, 1.1, slope) * 0.85 + smoothstep(80, 140, h) * 0.6;
      c = c.map((v, k) => v * (1 - rock) + [0.42, 0.4, 0.38][k] * rock);
      const snow = smoothstep(200 + 40 * n, 240 + 40 * n, h) * (1 - smoothstep(1.4, 2.2, slope) * 0.7);
      c = c.map((v, k) => v * (1 - snow) + [0.9, 0.92, 0.95][k] * snow);
      cols.push(...c);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, terrainMat); m.receiveShadow = true; return m;
  }
  scene.add(terrain(240, 240, false)); scene.add(terrain(3600, 320, true));

  // sky
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, moonDir: { value: new THREE.Vector3() },
      sunColor: { value: new THREE.Color() }, sunGlow: { value: 1 }, moonGlow: { value: 1 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top, horizon, sunDir, moonDir, sunColor; uniform float sunGlow, moonGlow; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 c = mix(horizon, top, pow(clamp(h / 0.55, 0.0, 1.0), 0.65));
        c = mix(c, horizon * 0.55, smoothstep(0.0, -0.2, h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += sunColor * (pow(s, 6.0) * 0.35 + pow(s, 48.0) * 0.6 + pow(s, 1500.0) * 12.0) * sunGlow;
        float m = max(dot(d, normalize(moonDir)), 0.0);
        c += vec3(0.55, 0.65, 0.85) * (pow(m, 12.0) * 0.10 + pow(m, 120.0) * 0.22) * moonGlow;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), skyMat); sky.renderOrder = -10; scene.add(sky);
  // stars
  { const R = rng(99), pos = [], ph = [], sz = [];
    for (let i = 0; i < 5000; i++) { const u = R() * 2 - 1, a = R() * Math.PI * 2, y = Math.abs(u) * 0.98 + 0.02, rr = Math.sqrt(1 - y * y); pos.push(Math.cos(a) * rr * 3500, y * 3500, Math.sin(a) * rr * 3500); ph.push(R() * 6.28); sz.push(R() < 0.04 ? 3.2 : 1.1 + R() * 1.4); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('phase', new THREE.Float32BufferAttribute(ph, 1)); g.setAttribute('sz', new THREE.Float32BufferAttribute(sz, 1));
    W.starMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, uniforms: { uTime: WIND.uTime, uOpacity: { value: 1 }, uRot: { value: 0 } },
      vertexShader: `attribute float phase; attribute float sz; uniform float uTime; uniform float uRot; varying float vA;
        void main(){ float c = cos(uRot), s = sin(uRot); vec3 p = vec3(c * position.x - s * position.y, s * position.x + c * position.y, position.z);
          vA = 0.6 + 0.4 * sin(uTime * 2.0 + phase * 7.0); gl_PointSize = sz; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform float uOpacity; varying float vA; void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); if (d > 0.5) discard; gl_FragColor = vec4(vec3(0.85, 0.9, 1.0), (1.0 - d * 2.0) * vA * uOpacity); }` });
    W.stars = new THREE.Points(g, W.starMat); W.stars.renderOrder = -9; scene.add(W.stars); }
  // moon
  const moonTex = canvasTex(256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, '#f6f4ea'); gr.addColorStop(0.9, '#e8e6dc'); gr.addColorStop(1, '#d9d6cc');
    g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill(); const R = rng(5);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,118,112,${0.08 + R() * 0.16})`; g.beginPath(); g.arc(30 + R() * 196, 30 + R() * 196, 4 + R() * 22, 0, 7); g.fill(); }
  });
  W.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, depthWrite: false, transparent: true })); W.moon.renderOrder = -8; scene.add(W.moon);
  const glowTex = canvasTex(256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.25, 'rgba(200,215,255,0.18)'); gr.addColorStop(1, 'rgba(160,180,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); });
  W.moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending })); W.moonGlow.renderOrder = -8; scene.add(W.moonGlow);

  // lights
  W.hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 0.5); scene.add(W.hemi);
  W.key = new THREE.DirectionalLight(0xffffff, 1); W.key.castShadow = true; W.key.shadow.mapSize.set(2048, 2048);
  Object.assign(W.key.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 10, far: 900 }); W.key.shadow.bias = -0.0006; W.key.shadow.normalBias = 0.04;
  scene.add(W.key); scene.add(W.key.target);
  W.fireLight = new THREE.PointLight(0xff8a3c, 0, 26, 1.6); W.fireLight.position.copy(SPOTS.fire).add(new THREE.Vector3(0, 0.8, 0)); scene.add(W.fireLight);
  scene.fog = new THREE.FogExp2(0x000000, 0.01);

  // junipers: the five at the makam + scattered ones
  const barkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const foliageMat = windify(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), 0.12, 1.5);
  const clumpGeo = displaced(new THREE.IcosahedronGeometry(1, 2), 0.7, 2.3, 4);
  W.grove = [];
  [[-4.6, -2.8, 1.45, 11], [3.8, -4.4, 1.3, 23], [5.6, 2.6, 1.55, 37], [-1.2, 5.4, 1.25, 41], [-6.2, 2.4, 1.35, 53]].forEach(([x, z, s, seed]) => {
    const t = makeJuniper(seed, s, barkMat, foliageMat, clumpGeo); t.position.set(x, heightAt(x, z) - 0.15, z); scene.add(t); W.grove.push(t);
  });
  { const R = rng(7); for (let i = 0; i < 46; i++) { const a = R() * Math.PI * 2, r = 32 + R() * 120, x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.hypot(x - 21, z - 12) < 14) continue;
      const t = makeJuniper(100 + i, 0.55 + R() * 0.55, barkMat, foliageMat, clumpGeo); t.position.set(x, heightAt(x, z) - 0.1, z); scene.add(t); } }
  // rocks (lichen)
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  { const R = rng(17); const near = [[-9, 6, 1.4], [10.5, -3, 1.1], [-3, -10, 1.7], [13, 7, 0.8], [-12, -4, 1.2], [6, 12, 0.9], [-1, 13, 1.3], [15, -9, 1.5], [9.2, 8.6, 0.7], [27, 6, 1.0], [16, 17, 0.7]];
    near.forEach(([x, z, s], i) => { const r = makeRock(300 + i, s, rockMat); r.position.set(x, heightAt(x, z) + s * 0.15, z); scene.add(r); });
    for (let i = 0; i < 70; i++) { const a = R() * 6.28, rr = 18 + R() * 110, x = Math.cos(a) * rr, z = Math.sin(a) * rr; const s = 0.4 + R() * 1.8; const r = makeRock(400 + i, s, rockMat); r.position.set(x, heightAt(x, z) + s * 0.1, z); scene.add(r); } }
  // grass (instanced blades with wind)
  { const blade = new THREE.PlaneGeometry(0.05, 0.42, 1, 3); blade.translate(0, 0.21, 0); const bp = blade.attributes.position; for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setX(i, bp.getX(i) * (1 - y / 0.45)); bp.setZ(i, y * y * 0.35); }
    const gm = windify(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, side: THREE.DoubleSide }), 0.35, -50);
    const N = 26000, inst = new THREE.InstancedMesh(blade, gm, N), R = rng(23), m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(); let k = 0;
    while (k < N) { const a = R() * 6.28, rr = Math.pow(R(), 0.6) * 46, x = Math.cos(a) * rr + 6, z = Math.sin(a) * rr + 5; if (Math.hypot(x, z) < 2.2) continue;
      q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.4, R() * 6.28, (R() - 0.5) * 0.4)); const s = 0.6 + R() * 1.1;
      m.compose(new THREE.Vector3(x, heightAt(x, z) - 0.02, z), q, new THREE.Vector3(s, s * (0.7 + R() * 0.8), s)); inst.setMatrixAt(k, m);
      col.setRGB(0.42 + R() * 0.2, 0.4 + R() * 0.12, 0.2 + R() * 0.06); inst.setColorAt(k, col); k++; }
    inst.receiveShadow = true; scene.add(inst); }
  // makam: stone enclosure, mound, headstone; cloth strips on the junipers
  { const g = SPOTS.grove, R = rng(61), st = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }); W.makam = new THREE.Group(); W.makam.position.set(0.4, heightAt(0.4, -0.3), -0.3); W.makam.rotation.y = 0.35;
    for (let i = 0; i < 16; i++) { const t = i / 16, x = Math.cos(t * 6.28) * 1.25, z = Math.sin(t * 6.28) * 0.7; const r = makeRock(700 + i, 0.18 + R() * 0.08, st); r.position.set(x, 0.08, z); W.makam.add(r); }
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, 6.29, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3e3326, roughness: 1 })); mound.scale.set(1.05, 0.22, 0.55); W.makam.add(mound);
    const head = new THREE.Mesh(displaced(new THREE.BoxGeometry(0.42, 0.85, 0.12, 4, 6, 2), 0.12, 3, 5), new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: 0.9 })); head.position.set(-1.15, 0.38, 0); head.rotation.set(0.04, 1.57, 0.06); W.makam.add(head);
    const foot = head.clone(); foot.scale.set(0.6, 0.55, 1); foot.position.set(1.15, 0.22, 0); W.makam.add(foot);
    W.makam.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); scene.add(W.makam);
    W.cloths = []; const cols = [0x9b1b1b, 0xe8e2d0, 0x2f6b3a, 0x7a1414, 0xc9b26a, 0x3c5a8a];
    W.grove.forEach((tree, ti) => { for (let k = 0; k < 7; k++) {
      const a = R() * 6.28, rr = 0.9 + R() * 1.6, y = 1.7 + R() * 1.3; const piv = new THREE.Group(); piv.position.set(tree.position.x + Math.cos(a) * rr, tree.position.y + y, tree.position.z + Math.sin(a) * rr);
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.42, 1, 4), new THREE.MeshStandardMaterial({ color: cols[(ti * 7 + k) % cols.length], roughness: 0.9, side: THREE.DoubleSide })); strip.position.y = -0.21; piv.add(strip);
      piv.rotation.y = R() * 6.28; piv.userData.ph = R() * 6.28; scene.add(piv); W.cloths.push(piv); } }); }
  // Yörük goat-hair tent
  { const T = SPOTS.tent, grp = new THREE.Group(); grp.position.copy(T); grp.rotation.y = -0.65; W.tent = grp;
    const hairTex = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#1b1613'; g.fillRect(0, 0, w, h); const R = rng(3); for (let y = 0; y < h; y += 16) { g.fillStyle = `rgba(${40 + R() * 25},${32 + R() * 20},${26 + R() * 14},0.8)`; g.fillRect(0, y, w, 7 + R() * 5); } for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.4})`; g.fillRect(R() * w, R() * h, 1, 3); } }, [3, 2]);
    const fab = new THREE.MeshStandardMaterial({ map: hairTex, roughness: 1, side: THREE.DoubleSide });
    const roof = new THREE.PlaneGeometry(7, 4.6, 28, 18), rp = roof.attributes.position;
    for (let i = 0; i < rp.count; i++) { const x = rp.getX(i), z = rp.getY(i); const ridge = 2.15 - 0.25 * Math.pow(Math.sin(Math.PI * (x + 3.5) / 3.5) ** 2, 1); const y = ridge - 1.0 * Math.pow(Math.abs(z) / 2.3, 1.5) - 0.12 * Math.sin(x * 2.1) * (Math.abs(z) / 2.3); rp.setXYZ(i, x, y, z); }
    roof.computeVertexNormals(); const rm = new THREE.Mesh(roof, fab); rm.castShadow = rm.receiveShadow = true; grp.add(rm);
    for (const s of [-1, 1]) { const wall = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.15, 14, 2), fab); wall.position.set(0, 0.57, 2.3 * s * (s < 0 ? 1 : 1)); if (s > 0) { wall.scale.y = 0.35; wall.position.y = 0.95; } wall.castShadow = true; grp.add(wall); }
    for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.2, 8, 2), fab); side.rotation.y = Math.PI / 2; side.position.set(3.5 * s, 0.6, 0); side.castShadow = true; grp.add(side); }
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 1.7), new THREE.MeshBasicMaterial({ color: 0x050403 })); dark.position.set(0, 0.85, -1.2); grp.add(dark);
    const pole = new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 0.9 });
    for (const x of [-2.4, 0, 2.4]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 8), pole); p.position.set(x, 1.05, 0); grp.add(p); }
    const rope = new THREE.MeshStandardMaterial({ color: 0x8c7a5c, roughness: 1 });
    for (const x of [-3.2, -1.2, 1.2, 3.2]) for (const s of [-1, 1]) { const a = new THREE.Vector3(x, 1.2, 2.25 * s), b = new THREE.Vector3(x * 1.15, 0, 3.6 * s); const len = a.distanceTo(b); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 4), rope); r.position.copy(a).add(b).multiplyScalar(0.5); r.lookAt(b); r.rotateX(Math.PI / 2); grp.add(r); }
    scene.add(grp); }
  // campfire: stones, logs, flames, embers, smoke
  { const F = SPOTS.fire, grp = new THREE.Group(); grp.position.copy(F); W.fire = grp; const st = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, r = makeRock(800 + i, 0.17, st); r.position.set(Math.cos(a) * 0.55, 0.05, Math.sin(a) * 0.55); grp.add(r); }
    const wood = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.9, emissive: 0x401000, emissiveIntensity: 0 }); W.fireWood = wood;
    for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 7), wood); l.rotation.set(Math.PI / 2 - 0.3, i * 0.8, 0); l.position.y = 0.12; grp.add(l); }
    const flameMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: WIND.uTime, uInt: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; uniform float uInt; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){ vec2 uv = vUv; float t = uTime * 2.2;
          float f = n(vec2(uv.x * 5.0, uv.y * 3.0 - t * 2.0)) * 0.6 + n(vec2(uv.x * 11.0, uv.y * 7.0 - t * 3.5)) * 0.4;
          float shape = (1.0 - uv.y) * smoothstep(0.5, 0.0, abs(uv.x - 0.5) * (1.2 + uv.y * 1.8));
          float a = clamp(shape * 1.6 - f * (0.6 + uv.y), 0.0, 1.0) * uInt;
          vec3 c = mix(vec3(1.0, 0.85, 0.45), vec3(1.0, 0.35, 0.06), uv.y + f * 0.3);
          gl_FragColor = vec4(c * a * 1.8, a); }` });
    W.flameMat = flameMat; W.flames = [];
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.15), flameMat); f.position.y = 0.6; f.rotation.y = i * Math.PI / 4; grp.add(f); W.flames.push(f); }
    const R = rng(9), pos = [], ph = []; for (let i = 0; i < 70; i++) { pos.push((R() - 0.5) * 0.5, 0, (R() - 0.5) * 0.5); ph.push(R()); }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); eg.setAttribute('ph', new THREE.Float32BufferAttribute(ph, 1));
    W.emberMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: WIND.uTime, uInt: { value: 1 } },
      vertexShader: `attribute float ph; uniform float uTime; varying float vA; void main(){ float t = fract(uTime * 0.35 + ph); vec3 p = position;
        p.y += t * 3.2; p.x += sin(uTime * 2.0 + ph * 20.0) * 0.3 * t; p.z += cos(uTime * 1.7 + ph * 13.0) * 0.3 * t; vA = (1.0 - t);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = 6.0 / -mv.z * 10.0; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'uniform float uInt; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(1.0, 0.55, 0.15, vA * uInt * (1.0 - d * 2.0)); }' });
    const embers = new THREE.Points(eg, W.emberMat); embers.position.y = 0.3; grp.add(embers);
    scene.add(grp); }
  // log pile beside the tent (and the bare ground when it is gone)
  { const L = SPOTS.logs, grp = new THREE.Group(); grp.position.copy(L); grp.rotation.y = -0.65; W.logs = grp;
    const bark = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.95 }), end = new THREE.MeshStandardMaterial({ color: 0xb08a5c, roughness: 0.8 });
    const R = rng(77); const rows = [5, 4, 3, 2];
    rows.forEach((n, row) => { for (let i = 0; i < n; i++) { const r = 0.09 + R() * 0.03, len = 1.3 + R() * 0.3; const lg = new THREE.Group();
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, len, 10), [bark, end, end]); c.rotation.z = Math.PI / 2; lg.add(c);
      lg.position.set((R() - 0.5) * 0.12, r + row * 0.17, (i - (n - 1) / 2) * 0.2 + (row % 2) * 0.05); lg.rotation.y = (R() - 0.5) * 0.18; grp.add(lg); } });
    grp.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); scene.add(grp);
    const bare = new THREE.Group(); bare.position.copy(L); bare.rotation.y = -0.65; W.bare = bare;
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshStandardMaterial({ color: 0x2e261d, roughness: 1, transparent: true, opacity: 0.85 })); patch.rotation.x = -Math.PI / 2; patch.position.y = 0.03; patch.scale.set(1, 0.55, 1); bare.add(patch);
    for (let i = 0; i < 26; i++) { const chip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.03), end); chip.position.set((R() - 0.5) * 1.4, 0.04, (R() - 0.5) * 0.8); chip.rotation.set(R(), R() * 6, R()); bare.add(chip); }
    scene.add(bare); }
  // chopping block + fallen branch near the grove
  { const C = SPOTS.chop, grp = new THREE.Group(); grp.position.copy(C); W.chopSite = grp;
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.33, 0.45, 12), new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.95 })); stump.position.y = 0.2; grp.add(stump);
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), new THREE.MeshStandardMaterial({ color: 0xa88458, roughness: 0.8 })); top.rotation.x = -Math.PI / 2; top.position.y = 0.43; grp.add(top);
    const br = new THREE.Mesh(branchGeo([new THREE.Vector3(-0.6, 0.15, -1.6), new THREE.Vector3(0.2, 0.2, -1.2), new THREE.Vector3(1.0, 0.18, -0.9), new THREE.Vector3(2.0, 0.25, -1.1)], 0.13, 0.06, 99), barkMat); grp.add(br);
    grp.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); scene.add(grp); }
  // ground mist sprites (drifting)
  { const mistTex = canvasTex(256, 128, (g) => { const R = rng(4); g.clearRect(0, 0, 256, 128); for (let i = 0; i < 40; i++) { const x = 30 + R() * 196, y = 40 + R() * 48, r = 20 + R() * 45; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128); } });
    W.mistMat = new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0.5, fog: true }); W.mist = []; const R = rng(55);
    for (let i = 0; i < 70; i++) { const s = new THREE.Sprite(W.mistMat); const a = R() * 6.28, r = 6 + R() * 90; s.userData = { a, r, y: 0.6 + R() * 2.6, sp: 0.2 + R() * 0.6, sc: 14 + R() * 26 }; s.scale.set(s.userData.sc, s.userData.sc * 0.35, 1); scene.add(s); W.mist.push(s); } }

  W.scene = scene; W.WIND = WIND; return W;
}

// ---------------------------------------------------------------- time of day
const C = c => new THREE.Color(c);
export const TOD = {
  day:    { top: C('#3f73b8'), hor: C('#bcd3e2'), sunEl: 48, sunAz: 205, sunCol: C('#fff4e2'), keyI: 3.2, hemiSky: C('#cfe2ff'), hemiGr: C('#6a6d3f'), hemiI: 1.15, fog: C('#b7c9d6'), fogD: 0.0016, stars: 0, moon: 0, sunGlow: 1, fire: 0, exp: 1.0 },
  golden: { top: C('#3d5a8a'), hor: C('#f0a660'), sunEl: 5, sunAz: 300, sunCol: C('#ffae62'), keyI: 2.6, hemiSky: C('#8fa2c8'), hemiGr: C('#5c4630'), hemiI: 0.55, fog: C('#d39a72'), fogD: 0.0035, stars: 0, moon: 0, sunGlow: 1.3, fire: 0.3, exp: 1.0 },
  dusk:   { top: C('#151d3b'), hor: C('#8a5466'), sunEl: -4, sunAz: 300, sunCol: C('#ff8a5a'), keyI: 0.35, hemiSky: C('#47507a'), hemiGr: C('#1f1a1a'), hemiI: 0.35, fog: C('#3a3a52'), fogD: 0.006, stars: 0.35, moon: 0.4, sunGlow: 0.6, fire: 1, exp: 1.0 },
  night:  { top: C('#03050c'), hor: C('#14223a'), sunEl: -30, sunAz: 300, sunCol: C('#000000'), keyI: 0.95, hemiSky: C('#26385a'), hemiGr: C('#08090c'), hemiI: 0.28, fog: C('#141d2e'), fogD: 0.011, stars: 1, moon: 1, sunGlow: 0, fire: 1, exp: 1.0 },
  dawn:   { top: C('#1d2948'), hor: C('#b58a88'), sunEl: -2, sunAz: 80, sunCol: C('#ffc2a0'), keyI: 0.45, hemiSky: C('#7f8db0'), hemiGr: C('#262326'), hemiI: 0.5, fog: C('#59607a'), fogD: 0.009, stars: 0.15, moon: 0.25, sunGlow: 0.7, fire: 0.15, exp: 1.0 },
};
export const MOON_DIR = new THREE.Vector3(-0.42, 0.24, -1).normalize();
export function lerpTOD(a, b, k) {
  const o = {}; for (const key of Object.keys(a)) { const x = a[key], y = b[key]; o[key] = x.isColor ? x.clone().lerp(y, k) : x + (y - x) * k; } return o;
}
export function applyTOD(W, s, camera, t) {
  const sky = W.scene.children.find(o => o.material && o.material.uniforms && o.material.uniforms.top);
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - s.sunEl), THREE.MathUtils.degToRad(s.sunAz));
  const u = sky.material.uniforms; u.top.value.copy(s.top); u.horizon.value.copy(s.hor); u.sunDir.value.copy(sunDir); u.moonDir.value.copy(MOON_DIR); u.sunColor.value.copy(s.sunCol); u.sunGlow.value = s.sunGlow; u.moonGlow.value = s.moon;
  sky.position.copy(camera.position); W.stars.position.copy(camera.position);
  const moonPos = camera.position.clone().addScaledVector(MOON_DIR, 3000); W.moon.position.copy(moonPos); W.moon.scale.setScalar(230); W.moon.material.opacity = Math.min(1, s.moon * 1.2);
  W.moonGlow.position.copy(moonPos); W.moonGlow.scale.setScalar(1300); W.moonGlow.material.opacity = s.moon * 0.8;
  W.starMat.uniforms.uOpacity.value = s.stars;
  // key light follows the brighter of sun / moon
  const sunUp = s.sunEl > -1, dir = sunUp ? sunDir : MOON_DIR;
  W.key.color.copy(sunUp ? s.sunCol : new THREE.Color('#9db4e6')); W.key.intensity = sunUp ? s.keyI : s.keyI * s.moon;
  W.key.position.copy(dir).multiplyScalar(400).add(SPOTS.grove); W.key.target.position.copy(SPOTS.grove);
  W.hemi.color.copy(s.hemiSky); W.hemi.groundColor.copy(s.hemiGr); W.hemi.intensity = s.hemiI;
  W.scene.fog.color.copy(s.fog); W.scene.fog.density = s.fogD;
  // fire
  const fl = s.fire * (W.fireOn ?? 1);
  const flick = 0.75 + 0.15 * Math.sin(t * 13.1) + 0.1 * Math.sin(t * 7.3 + 1.3) + 0.08 * Math.sin(t * 23.7);
  W.fireLight.intensity = 22 * fl * flick; W.flameMat.uniforms.uInt.value = fl; W.emberMat.uniforms.uInt.value = fl; W.fireWood.emissiveIntensity = 0.6 * fl;
  W.flames.forEach(f => { f.visible = fl > 0.02; });
  // mist drifts
  W.mist.forEach((m, i) => { const d = m.userData, a = d.a + t * d.sp * 0.004; m.position.set(Math.cos(a) * d.r + 6 + Math.sin(t * 0.05 + i) * 3, heightAt(Math.cos(a) * d.r, Math.sin(a) * d.r) + d.y, Math.sin(a) * d.r + 5); });
  W.mistMat.color.copy(s.fog).lerp(new THREE.Color('#c8d2e0'), 0.35); W.mistMat.opacity = W.mistOpacity ?? 0.5;
  // cloth strips flutter
  W.cloths.forEach(c => { c.rotation.x = 0.25 * Math.sin(t * 2.2 + c.userData.ph) * (W.WIND.uWind.value) + 0.05; c.rotation.z = 0.2 * Math.sin(t * 3.1 + c.userData.ph * 1.7) * W.WIND.uWind.value; });
}
