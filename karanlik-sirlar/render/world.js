// "Kanlı Ardıç" world: highland plateau, five ancient junipers with a makam, lichen rocks, a Yörük tent with a
// campfire and a log pile, the Taurus range, sky with sun/moon/stars/clouds, fog and ground mist. Deterministic.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

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
const sc = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);        // sRGB triplet -> linear colour

// ---------------------------------------------------------------- layout
export const SPOTS = {
  grove: new THREE.Vector3(0, 0, 0),          // centre of the five junipers (makam)
  tent: new THREE.Vector3(22, 0, 14),         // opens toward the grove (rotation TENT_ROT)
  fire: new THREE.Vector3(19.2, 0, 11.0),
  logs: new THREE.Vector3(18.6, 0, 17.05),
  chop: new THREE.Vector3(8.2, 0, 4.6),
};
export const TENT_ROT = -2.14;
// camera spots that scattered trees and rocks must keep clear of: [x, z, radius]
export const KEEP_CLEAR = [[2, 29, 8], [0.8, 23, 5], [9, 16.5, 4], [8, 30, 6], [11, 40, 7], [14, 50, 7], [-3, 15, 4], [-3.5, 33, 7], [28, 4, 7], [30, 4, 6], [26, 9, 4], [-14, 18, 4], [13.4, 1.6, 3], [6.6, -6.2, 3], [1.2, -8.5, 3]];
const clearOf = (x, z, pad = 0) => KEEP_CLEAR.every(([cx, cz, r]) => Math.hypot(x - cx, z - cz) > r + pad);
export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  let h = 2.0 * fbm(x / 55, z / 55, 4, 1) + 0.6 * fbm(x / 13, z / 13, 3, 2) - 1.3;
  h += 3.4 * Math.exp(-(x * x + z * z) / (2 * 15 * 15));                                   // the juniper knoll
  const camp = Math.exp(-((x - 21) ** 2 + (z - 13) ** 2) / (2 * 8 * 8)); h = h * (1 - 0.75 * camp) + camp * 0.9;
  const m = smoothstep(150, 620, r), south = smoothstep(0.1, -0.85, z / Math.max(r, 1));
  h += m * (30 + (300 + 170 * south) * Math.pow(ridged(x / 280 + 3.1, z / 280 - 1.7, 6, 3), 1.7) + 70 * fbm(x / 90, z / 90, 4, 4));
  h += smoothstep(70, 200, r) * 9 * fbm(x / 40, z / 40, 3, 6);
  return h;
}
for (const k of Object.keys(SPOTS)) SPOTS[k].y = heightAt(SPOTS[k].x, SPOTS[k].z);

// ---------------------------------------------------------------- height fog
// Replaces FogExp2 for every built-in material: dense near the plateau floor, thinning with height (mountains rise
// out of it), plus a faint distance haze for aerial perspective.
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying float vFogDepth; varying vec3 vFogWorld;\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n vFogDepth = - mvPosition.z; vFogWorld = transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz);\n#endif';
THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\n uniform vec3 fogColor; varying float vFogDepth; varying vec3 vFogWorld;\n #ifdef FOG_EXP2\n uniform float fogDensity;\n #else\n uniform float fogNear; uniform float fogFar;\n #endif\n#endif';
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float kF = 1.0 / 16.0; float hC = max(cameraPosition.y - 1.0, 0.0), hP = max(vFogWorld.y - 1.0, 0.0), dH = hP - hC;
    float hFac = abs(dH) < 0.05 ? exp(-kF * hC) : (exp(-kF * hC) - exp(-kF * hP)) / (kF * dH);
    float fDist = length(vFogWorld - cameraPosition); float fDe = fogDensity * fDist * hFac, fHz = fDist * mix(0.0006, 0.0003, smoothstep(0.001, 0.004, fogDensity));
    float fogFactor = 1.0 - exp(-(fDe * fDe + fHz * fHz));
  #else
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif`;

// ---------------------------------------------------------------- material helpers
const WIND = { uTime: { value: 0 }, uWind: { value: 1 } };
// wind sway (amp metres per metre of object-space height above `start`) and/or keep custom normals on double-sided cards
function patch(mat, opts = {}) {
  const { amp = 0, start = 0, keepNormals = false } = opts;
  mat.onBeforeCompile = sh => {
    if (amp) {
      sh.uniforms.uTime = WIND.uTime; sh.uniforms.uWind = WIND.uWind;
      sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <project_vertex>', `
        vec4 wp = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
        #endif
        wp = modelMatrix * wp;
        float hgt = max(0.0, position.y - ${start.toFixed(2)});
        #ifdef USE_INSTANCING
          ${opts.camFade ? `{ vec3 ip = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; float cd = distance(ip, cameraPosition);
            float k = smoothstep(${opts.camFade[0].toFixed(1)}, ${opts.camFade[1].toFixed(1)}, cd) * (1.0 - smoothstep(${opts.camFade[2].toFixed(1)}, ${opts.camFade[3].toFixed(1)}, cd));
            wp.xyz = mix(ip, wp.xyz, k); }` : ''}
        #endif
        float sway = sin(uTime * 1.3 + wp.x * 0.35 + wp.z * 0.21) + 0.5 * sin(uTime * 2.9 + wp.x * 0.9 + wp.z * 0.4);
        wp.x += sway * ${amp.toFixed(4)} * uWind * hgt;
        wp.z += cos(uTime * 1.1 + wp.z * 0.3 + wp.x * 0.13) * ${(amp * 0.6).toFixed(4)} * uWind * hgt;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`);
    }
    if (keepNormals) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  mat.customProgramCacheKey = () => `p${amp}-${start}-${keepNormals}-${opts.camFade || ''}`;
  return mat;
}
function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true, wrap = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.repeat.set(...repeat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 1; return t;
}
function displaced(geo, amt, freq, seed) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = fbm(v.x * freq + seed, v.y * freq + v.z * freq * 0.7, 4, seed);
    v.multiplyScalar(1 + (n - 0.5) * amt); p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals(); return geo;
}
// tube along a curve with tapering radius and fibrous bark vertex colours
function branchGeo(points, r0, r1, seed, radial = 9, dead = false) {
  const curve = new THREE.CatmullRomCurve3(points); const segs = Math.max(6, Math.round(curve.getLength() * 5));
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false); const p = g.attributes.position, cols = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, c = curve.getPointAt(t), r = THREE.MathUtils.lerp(r0, r1, Math.pow(t, 0.8));
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j; const x = p.getX(k) - c.x, y = p.getY(k) - c.y, z = p.getZ(k) - c.z;
      const knob = 1 + 0.22 * (fbm(t * 6 + seed, j * 0.7, 2, seed) - 0.5);
      p.setXYZ(k, c.x + x * r * knob, c.y + y * r * knob, c.z + z * r * knob);
      const stripe = 0.7 + 0.45 * fbm(j * 1.9 + seed, t * 30, 3, seed + 1);
      const col = dead ? sc(0.52 * stripe, 0.5 * stripe, 0.47 * stripe) : sc(0.36 * stripe, 0.26 * stripe, 0.2 * stripe);
      cols.push(col.r, col.g, col.b);
    }
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); return g;
}
// foliage cards: crossed quads around each clump with normals blended between clump and crown spheres (soft volume shading)
function foliageGeo(clumps, R, cards) {
  const pos = [], nor = [], uv = [], col = [], idx = []; let v = 0;
  const q = new THREE.Quaternion(), e = new THREE.Euler(), tmp = new THREE.Vector3(), cc = new THREE.Vector3();
  clumps.forEach(c => cc.add(new THREE.Vector3(c[0], c[1], c[2]))); cc.multiplyScalar(1 / clumps.length);
  let crownR = 0.1; clumps.forEach(c => { crownR = Math.max(crownR, Math.hypot(c[0] - cc.x, (c[1] - cc.y) * 1.4, c[2] - cc.z)); });
  for (const [x, y, z, s] of clumps) {
    const tint = 0.8 + R() * 0.35, cen = new THREE.Vector3(x, y, z);
    for (let k = 0; k < cards; k++) {
      e.set(R() * Math.PI, R() * Math.PI * 2, R() * Math.PI); q.setFromEuler(e);
      const cx = x + (R() - 0.5) * s * 0.8, cy = y + (R() - 0.5) * s * 0.5, cz = z + (R() - 0.5) * s * 0.8, w = s * (0.9 + R() * 0.6);
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        tmp.set(a * w * 0.5, b * w * 0.5, 0).applyQuaternion(q).add(new THREE.Vector3(cx, cy, cz)); pos.push(tmp.x, tmp.y, tmp.z);
        const n1 = tmp.clone().sub(cen).normalize(), n2 = tmp.clone().sub(cc).normalize();
        const n = n1.multiplyScalar(0.5).add(n2.multiplyScalar(0.5)).add(new THREE.Vector3(0, 0.3, 0)).normalize(); nor.push(n.x, n.y, n.z);
        uv.push((a + 1) / 2, (b + 1) / 2);
        const ao = (0.42 + 0.58 * smoothstep(0.0, 1.0, tmp.distanceTo(cc) / crownR)) * (0.75 + 0.25 * smoothstep(-2, 2, tmp.y - cc.y)) * tint;
        col.push(ao, ao, ao);
      }
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); return g;
}


// instanced items split into spatial cells so frustum culling skips what is off screen
function chunked(geo, mat, items, cell, opts = {}) {
  const grp = new THREE.Group(), cells = new Map();
  for (const it of items) { const key = Math.floor(it.x / cell) + ',' + Math.floor(it.z / cell); if (!cells.has(key)) cells.set(key, []); cells.get(key).push(it); }
  for (const list of cells.values()) {
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { inst.setMatrixAt(i, it.m); inst.setColorAt(i, it.c); });
    inst.computeBoundingSphere(); inst.receiveShadow = !!opts.receive; inst.castShadow = !!opts.cast; inst.name = opts.name || ''; grp.add(inst);
  }
  grp.name = opts.name || ''; return grp;
}

// the same, baked into one merged mesh per cell (much faster than instancing on a software rasteriser)
function baked(geo, mat, items, cell, opts = {}) {
  const grp = new THREE.Group(), cells = new Map(), v = new THREE.Vector3();
  for (const it of items) { const key = Math.floor(it.x / cell) + ',' + Math.floor(it.z / cell); if (!cells.has(key)) cells.set(key, []); cells.get(key).push(it); }
  const gp = geo.attributes.position, gn = geo.attributes.normal, gu = geo.attributes.uv, gi = geo.index ? geo.index.array : null, nv = gp.count;
  for (const list of cells.values()) {
    const pos = new Float32Array(list.length * nv * 3), nor = new Float32Array(list.length * nv * 3), uv = new Float32Array(list.length * nv * 2), col = new Float32Array(list.length * nv * 3);
    const hh = opts.wind ? new Float32Array(list.length * nv) : null, root = opts.wind ? new Float32Array(list.length * nv * 3) : null, idx = [];
    const nm = new THREE.Matrix3();
    list.forEach((it, j) => { nm.getNormalMatrix(it.m); const rp = new THREE.Vector3().setFromMatrixPosition(it.m), sy = new THREE.Vector3().setFromMatrixColumn(it.m, 1).length();
      for (let i = 0; i < nv; i++) { const o = j * nv + i; v.fromBufferAttribute(gp, i); if (hh) hh[o] = Math.max(0, v.y) * sy; v.applyMatrix4(it.m); pos.set([v.x, v.y, v.z], o * 3);
        v.fromBufferAttribute(gn, i); if (!opts.upNormals) v.applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], o * 3); if (gu) uv.set([gu.getX(i), gu.getY(i)], o * 2); col.set([it.c.r, it.c.g, it.c.b], o * 3); if (root) root.set([rp.x, rp.y, rp.z], o * 3); }
      if (gi) for (const a of gi) idx.push(a + j * nv); else for (let i = 0; i < nv; i++) idx.push(i + j * nv); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (hh) { g.setAttribute('aH', new THREE.BufferAttribute(hh, 1)); g.setAttribute('aRoot', new THREE.BufferAttribute(root, 3)); }
    g.setIndex(idx); g.computeBoundingSphere(); const m = new THREE.Mesh(g, mat); m.receiveShadow = !!opts.receive; m.name = opts.name || ''; grp.add(m);
  }
  grp.name = opts.name || ''; return grp;
}
function grassMat(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = WIND.uTime; sh.uniforms.uWind = WIND.uWind;
    sh.vertexShader = 'uniform float uTime; uniform float uWind; attribute float aH; attribute vec3 aRoot;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      vec4 wp = modelMatrix * vec4( transformed, 1.0 );
      float sway = sin(uTime * 1.3 + wp.x * 0.35 + wp.z * 0.21) + 0.5 * sin(uTime * 2.9 + wp.x * 0.9 + wp.z * 0.4);
      wp.x += sway * 0.32 * uWind * aH; wp.z += cos(uTime * 1.1 + wp.z * 0.3 + wp.x * 0.13) * 0.19 * uWind * aH;
      float cd = distance(aRoot, cameraPosition); float kf = smoothstep(1.6, 3.2, cd) * (1.0 - smoothstep(48.0, 60.0, cd));
      wp.xyz = mix(aRoot, wp.xyz, kf);
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  mat.customProgramCacheKey = () => 'grassBaked'; return mat;
}

// ---------------------------------------------------------------- builders
function makeJuniper(seed, scale, barkMat, foliageMat, cards) {
  const R = rng(seed), group = new THREE.Group(), clumps = [], barkGeos = [];
  const stems = 1 + Math.floor(R() * 3);
  for (let s = 0; s < stems; s++) {
    const ang = R() * Math.PI * 2, lean = 0.15 + R() * 0.35, H = (3.6 + R() * 2.4) * scale;
    const pts = []; let x = 0, z = 0;
    for (let i = 0; i <= 6; i++) {
      const t = i / 6; x += Math.cos(ang + t * 2.2 + R() * 0.6) * lean * 0.55 * scale; z += Math.sin(ang + t * 2.2 + R() * 0.6) * lean * 0.55 * scale;
      pts.push(new THREE.Vector3(x + (R() - 0.5) * 0.15, t * H, z + (R() - 0.5) * 0.15));
    }
    pts[0].y = -0.3;
    barkGeos.push(branchGeo(pts, (0.32 + R() * 0.12) * scale, 0.07 * scale, seed + s * 31));
    const trunk = new THREE.CatmullRomCurve3(pts), nb = 5 + Math.floor(R() * 4);
    for (let b = 0; b < nb; b++) {
      const t = 0.28 + R() * 0.62, base = trunk.getPointAt(t), dir = R() * Math.PI * 2, L = (1.4 + R() * 2.4) * scale * (1.1 - t * 0.5);
      const dead = R() < 0.18, bp = [base.clone()];
      for (let i = 1; i <= 4; i++) { const k = i / 4; bp.push(new THREE.Vector3(base.x + Math.cos(dir + k * 0.5) * L * k, base.y + L * k * (0.3 + R() * 0.4) - k * k * 0.35, base.z + Math.sin(dir + k * 0.5) * L * k)); }
      barkGeos.push(branchGeo(bp, 0.11 * scale * (1.2 - t * 0.6), 0.025 * scale, seed + b * 7 + s * 101, 7, dead));
      if (dead) continue;                                                        // bare silver branch, no foliage
      const tip = bp[bp.length - 1];
      for (let c = 0; c < 4; c++) clumps.push([tip.x + (R() - 0.5) * 1.3 * scale, tip.y + (R() - 0.3) * 0.8 * scale, tip.z + (R() - 0.5) * 1.3 * scale, (0.75 + R() * 0.8) * scale]);
      clumps.push([(base.x + tip.x) / 2, (base.y + tip.y) / 2 + 0.3 * scale, (base.z + tip.z) / 2, (0.6 + R() * 0.6) * scale]);
    }
    const top = pts[pts.length - 1];
    for (let c = 0; c < 6; c++) clumps.push([top.x + (R() - 0.5) * 1.7 * scale, top.y - R() * 1.8 * scale, top.z + (R() - 0.5) * 1.7 * scale, (0.8 + R() * 0.9) * scale]);
  }
  const bark = new THREE.Mesh(mergeGeometries(barkGeos), barkMat); bark.castShadow = bark.receiveShadow = true; group.add(bark);
  const fol = new THREE.Mesh(foliageGeo(clumps, R, cards), foliageMat); fol.castShadow = true; fol.receiveShadow = false; group.add(fol);
  group.userData.clumps = clumps; return group;
}
function makeRock(seed, size, mat, detailLevel = 4) {
  let g = new THREE.IcosahedronGeometry(1, detailLevel); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  { const p = g.attributes.position, v = new THREE.Vector3(), uv = [];
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = fbm(v.x * 1.6 + seed, v.y * 1.6 + v.z * 1.1, 4, seed), n2 = fbm(v.x * 5 + seed, v.z * 5 + v.y * 3, 3, seed + 3);
      v.multiplyScalar(1 + (n - 0.5) * 0.6 + (n2 - 0.5) * 0.12); v.y = Math.max(v.y, -0.3 - 0.1 * n2); p.setXYZ(i, v.x, v.y, v.z);
      uv.push(Math.atan2(v.z, v.x) / 6.283 + 0.5, v.y * 0.5 + 0.5); }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); }
  const R = rng(seed), p = g.attributes.position, cols = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), base = 0.62 + 0.25 * fbm(x * 3 + seed, z * 3 + y, 3, seed);
    let c = sc(base, base * 0.98, base * 0.95);
    const lich = fbm(x * 4 + seed * 2, y * 4 + z * 3, 3, seed + 9);
    if (lich > 0.66) c = sc(base * 1.05, base * 0.92, base * 0.66); else if (lich < 0.3) c = sc(base * 0.9, base * 0.95, base * 0.82);
    c.multiplyScalar(0.55 + 0.45 * smoothstep(-0.35, 0.3, y));
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(g, mat); m.scale.set(size * (0.9 + R() * 0.5), size * (0.55 + R() * 0.4), size * (0.9 + R() * 0.5)); m.rotation.y = R() * 6;
  m.castShadow = m.receiveShadow = true; return m;
}

export function buildWorld(renderer) {
  const scene = new THREE.Scene(); const W = {};
  // ---- terrain: near (1 m grid) + far (11 m grid), detail map + bump
  const detail = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = 'rgb(214,214,214)'; g.fillRect(0, 0, w, h); const R = rng(31);
    for (let i = 0; i < 9000; i++) { const v = 150 + R() * 105 | 0; g.fillStyle = `rgba(${v},${v},${v},${0.35 + R() * 0.5})`; const x = R() * w, y = R() * h; g.fillRect(x, y, 1 + R() * 3, 1 + R() * 2); }
    for (let i = 0; i < 2600; i++) { const v = 120 + R() * 70 | 0; g.strokeStyle = `rgba(${v},${v},${v},0.6)`; g.lineWidth = 1; const x = R() * w, y = R() * h, a = R() * 6.28, l = 3 + R() * 7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    for (let i = 0; i < 60; i++) { const x = R() * w, y = R() * h, r = 8 + R() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(160,160,160,0.25)'); gr.addColorStop(1, 'rgba(160,160,160,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  }, { srgb: false, repeat: [15, 15] });
  const detailFar = detail.clone(); detailFar.repeat.set(55, 55); detailFar.needsUpdate = true;
  function terrainTile(cx, cz, size, segs, sink, map) {
    const g = new THREE.PlaneGeometry(size, size, segs, segs); g.rotateX(-Math.PI / 2); g.translate(cx, 0, cz); const p = g.attributes.position, cols = [], nor = [], e = size / segs;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i); let h = heightAt(x, z); const hx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), hz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
      const nv = new THREE.Vector3(-hx, 1, -hz).normalize(); nor.push(nv.x, nv.y, nv.z);
      if (sink && Math.abs(x) < 118 && Math.abs(z) < 118) h -= 1.5;
      p.setY(i, h);
      const n = fbm(x / 18, z / 18, 3, 7), n2 = fbm(x / 5, z / 5, 3, 8), slope = Math.hypot(hx, hz);
      let c = [0.44 + 0.1 * n, 0.46 + 0.07 * n, 0.25 + 0.04 * n2];                                // olive-green yayla meadow
      const gold = smoothstep(0.5, 0.75, n) * 0.7; c = c.map((v, k) => v * (1 - gold) + [0.58, 0.5, 0.31][k] * gold);
      const green = smoothstep(0.55, 0.72, n2) * 0.8; c = c.map((v, k) => v * (1 - green) + [0.32, 0.42, 0.2][k] * green);
      const soil = smoothstep(0.62, 0.8, fbm(x / 7 + 40, z / 7, 2, 9)) * 0.7; c = c.map((v, k) => v * (1 - soil) + [0.42, 0.34, 0.26][k] * soil);
      const strata = 0.82 + 0.3 * fbm(x / 9, h / 3.5, 3, 12); const rock = Math.min(1, smoothstep(0.45, 0.95, slope) * 0.95 + smoothstep(80, 150, h) * 0.7); c = c.map((v, k) => v * (1 - rock) + [0.5, 0.48, 0.46][k] * strata * rock);
      const snow = smoothstep(230 + 50 * n, 290 + 50 * n, h) * (1 - smoothstep(1.3, 2.4, slope) * 0.75); c = c.map((v, k) => v * (1 - snow) + [0.93, 0.95, 0.98][k] * snow);
      const col = sc(...c); cols.push(col.r, col.g, col.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, map === detail ? nearMat : farMat); m.receiveShadow = true; return m;
  }
  const nearMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: detail, bumpMap: detail, bumpScale: 1.2 });
  const EXPQ = new URLSearchParams(location.search).get('exp') || '';
  const farMat = EXPQ === 'farbasic' ? new THREE.MeshBasicMaterial({ vertexColors: true }) : EXPQ === 'farnobump' ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: detailFar }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: detailFar, bumpMap: detailFar, bumpScale: 1.2 });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const t = terrainTile(-90 + i * 60, -90 + j * 60, 60, 60, false, detail); t.name = 'terrainNear'; scene.add(t); }
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const cx = -1750 + i * 500, cz = -1750 + j * 500, near = Math.hypot(cx, cz) < 1100; const t = terrainTile(cx, cz, 500, near ? 96 : 40, true, detailFar); t.name = 'terrainFar'; scene.add(t); }

  // ---- sky (gradient, sun, moon glow, procedural clouds)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, moonDir: { value: new THREE.Vector3() },
      sunColor: { value: new THREE.Color() }, sunGlow: { value: 1 }, moonGlow: { value: 1 }, clouds: { value: 0.4 }, cloudCol: { value: new THREE.Color() }, uTime: WIND.uTime },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top, horizon, sunDir, moonDir, sunColor, cloudCol; uniform float sunGlow, moonGlow, clouds, uTime; varying vec3 vDir;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float nn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
      float fb(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { s += a * nn(p); p = p * 2.07 + 13.1; a *= 0.5; } return s; }
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 c = mix(horizon, top, pow(clamp(h / 0.5, 0.0, 1.0), 0.6));
        c = mix(c, horizon * 0.5, smoothstep(0.0, -0.25, h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += sunColor * (pow(s, 5.0) * 0.3 + pow(s, 40.0) * 0.5) * sunGlow;
        float m = max(dot(d, normalize(moonDir)), 0.0);
        c += vec3(0.5, 0.6, 0.8) * (pow(m, 10.0) * 0.08 + pow(m, 90.0) * 0.18) * moonGlow;
        if (h > 0.0 && clouds > 0.0) {
          vec2 cp = d.xz / (h + 0.1) * 1.3 + vec2(uTime * 0.004, 0.0);
          float f = fb(cp); float cl = smoothstep(0.56, 0.86, f) * clouds * smoothstep(0.08, 0.42, h);
          float lit = pow(s, 4.0) * sunGlow + pow(m, 6.0) * moonGlow * 0.5;
          vec3 cc = cloudCol * (0.75 + 0.5 * (f - 0.5)) + sunColor * lit * 0.35;
          c = mix(c, cc, cl * 0.9);
        }
        c += sunColor * pow(s, 1800.0) * 14.0 * sunGlow;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  W.sky = new THREE.Mesh(new THREE.SphereGeometry(4500, 48, 24), skyMat); W.sky.renderOrder = -10; W.sky.frustumCulled = false; scene.add(W.sky);
  // stars (rotate about the celestial pole for timelapses)
  { const R = rng(99), pos = [], ph = [], sz = [];
    for (let i = 0; i < 6500; i++) { const u = R(), a = R() * Math.PI * 2, y = 0.02 + u * 0.98, rr = Math.sqrt(1 - y * y); pos.push(Math.cos(a) * rr * 4000, y * 4000, Math.sin(a) * rr * 4000); ph.push(R() * 6.28); sz.push(R() < 0.05 ? 3.6 : 1.4 + R() * 1.3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('phase', new THREE.Float32BufferAttribute(ph, 1)); g.setAttribute('sz', new THREE.Float32BufferAttribute(sz, 1));
    W.starMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, uniforms: { uTime: WIND.uTime, uOpacity: { value: 1 }, uRot: { value: 0 }, uScale: { value: 1 } },
      vertexShader: `attribute float phase; attribute float sz; uniform float uTime, uRot, uScale; varying float vA;
        vec3 rotA(vec3 p, vec3 ax, float a){ return p * cos(a) + cross(ax, p) * sin(a) + ax * dot(ax, p) * (1.0 - cos(a)); }
        void main(){ vec3 p = rotA(position, normalize(vec3(0.0, 0.616, 0.788)), uRot);
          vA = 0.65 + 0.35 * sin(uTime * 2.3 + phase * 7.0); gl_PointSize = sz * uScale; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform float uOpacity; varying float vA; void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); if (d > 0.5) discard; gl_FragColor = vec4(vec3(0.86, 0.9, 1.0), (1.0 - d * 2.0) * vA * uOpacity); }` });
    W.stars = new THREE.Points(g, W.starMat); W.stars.renderOrder = -9; W.stars.frustumCulled = false; scene.add(W.stars); }
  // moon
  const moonTex = canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(118, 116, 0, 128, 128, 128); gr.addColorStop(0, '#fbf9f0'); gr.addColorStop(0.85, '#e9e6da'); gr.addColorStop(1, '#d6d2c6');
    g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill(); const R = rng(5);
    for (let i = 0; i < 46; i++) { g.fillStyle = `rgba(110,108,104,${0.06 + R() * 0.16})`; g.beginPath(); g.arc(30 + R() * 196, 30 + R() * 196, 3 + R() * 24, 0, 7); g.fill(); }
  }, { wrap: false });
  W.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, depthWrite: false, transparent: true })); W.moon.renderOrder = -8; scene.add(W.moon);
  const glowTex = canvasTex(256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.2, 'rgba(200,215,255,0.16)'); gr.addColorStop(0.55, 'rgba(170,190,255,0.04)'); gr.addColorStop(1, 'rgba(160,180,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }, { wrap: false });
  W.moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending })); W.moonGlow.renderOrder = -8; scene.add(W.moonGlow);

  // ---- lights
  W.hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 0.5); scene.add(W.hemi);
  W.key = new THREE.DirectionalLight(0xffffff, 1); W.key.castShadow = true; W.key.shadow.mapSize.set(2048, 2048);
  Object.assign(W.key.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 10, far: 900 }); W.key.shadow.bias = -0.0005; W.key.shadow.normalBias = 0.05; W.key.shadow.radius = 2;
  scene.add(W.key); scene.add(W.key.target);
  W.fireLight = new THREE.PointLight(0xff8a3c, 0, 30, 1.7); W.fireLight.position.copy(SPOTS.fire).add(new THREE.Vector3(0, 0.9, 0)); scene.add(W.fireLight);
  scene.fog = new THREE.FogExp2(0x000000, 0.01);

  // ---- junipers: the five at the makam + scattered ones
  const barkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const folTex = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); const R = rng(12);
    for (let b = 0; b < 30; b++) {
      const a = R() * 6.28, x0 = w / 2 + Math.cos(a) * 14 * R(), y0 = h / 2 + Math.sin(a) * 14 * R(), len = 55 + R() * 55, curl = (R() - 0.5) * 0.02;
      for (let i = 0; i < len; i += 2.2) {
        const aa = a + curl * i, x = x0 + Math.cos(aa) * i, y = y0 + Math.sin(aa) * i; if (Math.hypot(x - w / 2, y - h / 2) > 118) break;
        const k = R(), sh = 0.8 + 0.5 * R(); const r = (54 + 36 * k) * sh, gg = (80 + 50 * k) * sh, bb = (54 + 30 * k) * sh;
        g.fillStyle = `rgb(${r | 0},${gg | 0},${bb | 0})`;
        for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + Math.cos(aa + s * 1.2) * 3.5, y + Math.sin(aa + s * 1.2) * 3.5, 4.2 + R() * 2.5, 1.7 + R() * 1.2, aa + s * 0.7, 0, 7); g.fill(); }
        if (R() < 0.04) { g.fillStyle = 'rgb(58,66,84)'; g.beginPath(); g.arc(x + (R() - 0.5) * 8, y + (R() - 0.5) * 8, 2.6, 0, 7); g.fill(); }   // berries
      }
    }
  }, { wrap: false });
  const foliageMat = patch(new THREE.MeshLambertMaterial({ map: folTex, alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true }), { amp: 0.018, start: 1.2, keepNormals: true });
  foliageMat.shadowSide = THREE.DoubleSide;
  W.foliageDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: folTex, alphaTest: 0.42, side: THREE.DoubleSide });
  W.grove = [];
  [[-4.6, -2.8, 1.45, 11], [3.8, -4.4, 1.3, 23], [5.6, 2.6, 1.55, 37], [-1.2, 5.4, 1.25, 41], [-6.2, 2.4, 1.35, 53]].forEach(([x, z, s, seed]) => {
    const t = makeJuniper(seed, s, barkMat, foliageMat, 6); t.position.set(x, heightAt(x, z) - 0.05, z); t.children[1].customDepthMaterial = W.foliageDepth; t.name = 'tree'; scene.add(t); W.grove.push(t);
  });
  { const R = rng(7); let n = 0; while (n < 52) { const a = R() * Math.PI * 2, r = 30 + R() * 130, x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.hypot(x - 21, z - 13) < 15 || !clearOf(x, z, 3)) continue;
      const t = makeJuniper(100 + n, 0.55 + R() * 0.6, barkMat, foliageMat, 3); t.position.set(x, heightAt(x, z) - 0.05, z); t.children[1].customDepthMaterial = W.foliageDepth; t.name = 'tree'; scene.add(t); n++; } }
  // ---- rocks (lichen) + pebbles
  const rockTex = canvasTex(512, 512, (g, w, h) => { const R = rng(71); g.fillStyle = '#b9b6ae'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) { const x = R() * w, y = R() * h, r = 6 + R() * 50, v = 150 + R() * 70 | 0; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${v},${v - 4},${v - 10},0.5)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
      for (let i = 0; i < 9000; i++) { const v = 90 + R() * 140 | 0; g.fillStyle = `rgba(${v},${v},${v - 6},0.5)`; g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); }
      g.lineCap = 'round'; for (let i = 0; i < 45; i++) { let x = R() * w, y = R() * h, a = R() * 6.28; g.strokeStyle = `rgba(70,66,60,${0.15 + R() * 0.25})`; g.lineWidth = 0.6 + R() * 1.4; g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 14; k++) { a += (R() - 0.5) * 0.9; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); } g.stroke(); }
      for (let i = 0; i < 160; i++) { const x = R() * w, y = R() * h, r = 2 + R() * 9; g.fillStyle = R() < 0.6 ? `rgba(196,176,112,${0.35 + R() * 0.3})` : `rgba(150,160,128,${0.35 + R() * 0.3})`; g.beginPath(); for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28, rr = r * (0.6 + R() * 0.6); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); }
    }, { repeat: [2, 1] });
  W.rockTex = rockTex;
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, map: rockTex, bumpMap: rockTex, bumpScale: 3.0 });
  { const R = rng(17); const near = [[-9, 6, 1.4], [10.5, -3, 1.1], [-3, -10, 1.7], [13, 7, 0.8], [-12, -4, 1.2], [6, 12, 0.9], [-1, 13, 1.3], [15, -9, 1.5], [9.6, 8.9, 0.7], [27, 6, 1.0], [14.5, 19.5, 0.7], [-2.6, 18.6, 1.1], [-10.2, 7.8, 0.8], [-7.6, 4.4, 0.6]];
    near.forEach(([x, z, s], i) => { const r = makeRock(300 + i, s, rockMat); r.name = 'rock'; r.position.set(x, heightAt(x, z) + s * 0.12, z); scene.add(r); });
    for (let i = 0; i < 80; i++) { const a = R() * 6.28, rr = 18 + R() * 120, x = Math.cos(a) * rr, z = Math.sin(a) * rr; if (Math.hypot(x - 21, z - 13) < 9 || !clearOf(x, z, 1)) continue; const s = 0.4 + R() * 1.9; const r = makeRock(400 + i, s, rockMat, 3); r.name = 'rock'; r.position.set(x, heightAt(x, z) + s * 0.08, z); scene.add(r); }
    const pg = displaced(new THREE.IcosahedronGeometry(1, 0), 0.5, 2.0, 3), items = [], q = new THREE.Quaternion();
    for (let i = 0; i < 4000; i++) { const a = R() * 6.28, rr = Math.pow(R(), 0.7) * 60, x = Math.cos(a) * rr + 8, z = Math.sin(a) * rr + 6; const s = 0.03 + Math.pow(R(), 3) * 0.22;
      q.setFromEuler(new THREE.Euler(R() * 6, R() * 6, R() * 6)); const m = new THREE.Matrix4().compose(new THREE.Vector3(x, heightAt(x, z) + s * 0.2, z), q, new THREE.Vector3(s, s * 0.6, s)); const v = 0.45 + R() * 0.25;
      items.push({ x, z, m, c: sc(v, v * 0.97, v * 0.92) }); }
    W.pebbles = baked(pg.index ? pg : pg, new THREE.MeshLambertMaterial({ vertexColors: true }), items, 15, { receive: true, name: 'pebbles' }); scene.add(W.pebbles); }
  // ---- grass tufts: crossed alpha cards, up-facing normals, wind
  { const tuftTex = canvasTex(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); const R = rng(8);
      for (let i = 0; i < 70; i++) { const x0 = w / 2 + (R() - 0.5) * 30, a = -Math.PI / 2 + (R() - 0.5) * 1.3, l = 50 + R() * 70, k = R(); const cx = x0 + Math.cos(a) * l * 0.5 + (R() - 0.5) * 20, cy = h + Math.sin(a) * l * 0.5;
        const c = k < 0.4 ? [160 + R() * 30, 146 + R() * 26, 92 + R() * 20] : k < 0.85 ? [104 + R() * 26, 124 + R() * 24, 66 + R() * 16] : [86, 80, 58];
        g.strokeStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; g.lineWidth = 1.2 + R() * 1.3; g.beginPath(); g.moveTo(x0, h); g.quadraticCurveTo(cx, cy, x0 + Math.cos(a) * l, h + Math.sin(a) * l); g.stroke(); } }, { wrap: false });
    const quad = (rot) => { const g = new THREE.PlaneGeometry(0.6, 0.45); g.translate(0, 0.225, 0);     // trapezoid: narrow at the root
      const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.01) { p.setX(i, p.getX(i) * 0.3); uv.setX(i, 0.5 + (uv.getX(i) - 0.5) * 0.3); }
      g.rotateY(rot); return g; };
    const tuft = mergeGeometries([quad(0), quad(Math.PI / 2)]); const nz = tuft.attributes.normal; for (let i = 0; i < nz.count; i++) nz.setXYZ(i, 0, 1, 0);
    const gm = grassMat(new THREE.MeshLambertMaterial({ map: tuftTex, alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true }));
    const N = 30000, items = [], R = rng(23), q = new THREE.Quaternion(); let k = 0;
    while (k < N) { const near = R() < 0.55; const a = R() * 6.28, rr = near ? Math.pow(R(), 0.8) * 22 : Math.pow(R(), 0.6) * 62; const cx = near ? (R() < 0.5 ? 0 : 17) : 6, cz = near ? (R() < 0.5 ? 2 : 12) : 5;
      const x = Math.cos(a) * rr + cx, z = Math.sin(a) * rr + cz; if (Math.hypot(x - SPOTS.tent.x, z - SPOTS.tent.z) < 3.4 || Math.hypot(x - SPOTS.fire.x, z - SPOTS.fire.z) < 1.2 || Math.hypot(x - SPOTS.logs.x, z - SPOTS.logs.z) < 1.1 || Math.hypot(x - 0.4, z + 0.3) < 1.6) continue;
      q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.25, R() * 6.28, (R() - 0.5) * 0.25)); const s = 0.55 + R() * 0.9;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, heightAt(x, z) - 0.03, z), q, new THREE.Vector3(s, s * (0.7 + R() * 0.6), s));
      const v = 0.75 + R() * 0.35; items.push({ x, z, m, c: new THREE.Color(v, v * (0.95 + R() * 0.08), v * 0.92) }); k++; }
    W.grass = baked(tuft, gm, items, 10, { name: 'grass', wind: true, upNormals: true }); scene.add(W.grass); }
  // ---- makam: stone enclosure, mound, headstones; cloth strips on the junipers
  { const R = rng(61), st = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, color: 0x8c8a86, map: W.rockTex, bumpMap: W.rockTex, bumpScale: 2.5 }); W.makam = new THREE.Group(); W.makam.position.set(0.4, heightAt(0.4, -0.3), -0.3); W.makam.rotation.y = 1.97;   // headstone faces the moon
    for (let i = 0; i < 18; i++) { const t = i / 18, x = Math.cos(t * 6.28) * 1.3, z = Math.sin(t * 6.28) * 0.75; const r = makeRock(700 + i, 0.17 + R() * 0.08, st, 2); r.position.set(x, 0.07, z); W.makam.add(r); }
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, 6.29, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: sc(0.3, 0.25, 0.19), roughness: 1, bumpMap: detail, bumpScale: 3 })); mound.scale.set(1.05, 0.24, 0.56); W.makam.add(mound);
    const stoneMat = new THREE.MeshStandardMaterial({ color: sc(0.62, 0.6, 0.56), roughness: 0.9, map: W.rockTex, bumpMap: W.rockTex, bumpScale: 2.0 });
    const head = new THREE.Mesh(displaced(new THREE.BoxGeometry(0.42, 0.9, 0.12, 4, 6, 2), 0.1, 3, 5), stoneMat); head.position.set(-1.15, 0.4, 0); head.rotation.set(0.05, 1.57, 0.07); W.makam.add(head);
    const foot = head.clone(); foot.scale.set(0.6, 0.55, 1); foot.position.set(1.15, 0.22, 0); W.makam.add(foot);
    W.makam.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); scene.add(W.makam);
    W.cloths = []; const cols = [[0.6, 0.1, 0.1], [0.9, 0.88, 0.8], [0.18, 0.42, 0.22], [0.48, 0.07, 0.07], [0.8, 0.7, 0.4], [0.24, 0.35, 0.55]];
    W.grove.forEach((tree, ti) => { const cl = tree.userData.clumps.filter(c => c[1] > 1.4 && c[1] < 3.6); for (let k = 0; k < 7 && cl.length; k++) {
      const c = cl[Math.floor(R() * cl.length)]; const piv = new THREE.Group(); piv.position.set(tree.position.x + c[0] * 0.75, tree.position.y + c[1] - 0.3, tree.position.z + c[2] * 0.75);
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.45, 1, 4), new THREE.MeshStandardMaterial({ color: sc(...cols[(ti * 7 + k) % cols.length]), roughness: 0.9, side: THREE.DoubleSide })); strip.position.y = -0.22; piv.add(strip);
      piv.rotation.y = R() * 6.28; piv.userData.ph = R() * 6.28; scene.add(piv); W.cloths.push(piv); } }); }
  // ---- Yörük goat-hair tent
  { const T = SPOTS.tent, grp = new THREE.Group(); grp.position.copy(T); grp.rotation.y = TENT_ROT; W.tent = grp;
    const hairTex = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#1d1814'; g.fillRect(0, 0, w, h); const R = rng(3); for (let y = 0; y < h; y += 16) { g.fillStyle = `rgba(${44 + R() * 25},${36 + R() * 20},${30 + R() * 14},0.8)`; g.fillRect(0, y, w, 7 + R() * 5); } for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.4})`; g.fillRect(R() * w, R() * h, 1, 3); } }, { repeat: [3, 2] });
    const fab = new THREE.MeshStandardMaterial({ map: hairTex, roughness: 1, side: THREE.DoubleSide });
    const roof = new THREE.PlaneGeometry(7, 4.6, 28, 18), rp = roof.attributes.position;
    for (let i = 0; i < rp.count; i++) { const x = rp.getX(i), z = rp.getY(i); const ridge = 2.15 - 0.25 * Math.sin(Math.PI * (x + 3.5) / 3.5) ** 2; const y = ridge - 1.0 * Math.pow(Math.abs(z) / 2.3, 1.5) - 0.12 * Math.sin(x * 2.1) * (Math.abs(z) / 2.3); rp.setXYZ(i, x, y, z); }
    roof.computeVertexNormals(); const rm = new THREE.Mesh(roof, fab); rm.castShadow = rm.receiveShadow = true; grp.add(rm);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.2, 14, 2), fab); back.position.set(0, 0.58, -2.3); back.castShadow = true; grp.add(back);
    const val = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.4, 14, 2), fab); val.position.set(0, 1.0, 2.3); val.castShadow = true; grp.add(val);
    for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.2, 8, 2), fab); side.rotation.y = Math.PI / 2; side.position.set(3.5 * s, 0.6, 0); side.castShadow = true; grp.add(side); }
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 1.8), new THREE.MeshBasicMaterial({ color: 0x060504 })); dark.position.set(0, 0.88, -1.0); grp.add(dark);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshStandardMaterial({ color: sc(0.45, 0.12, 0.1), roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0.4, 0.03, 0.8); grp.add(rug);
    const pole = new THREE.MeshStandardMaterial({ color: sc(0.36, 0.26, 0.17), roughness: 0.9 });
    for (const x of [-2.4, 0, 2.4]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 8), pole); p.position.set(x, 1.05, 0); grp.add(p); }
    const rope = new THREE.MeshStandardMaterial({ color: sc(0.55, 0.48, 0.36), roughness: 1 });
    for (const x of [-3.2, -1.2, 1.2, 3.2]) for (const s of [-1, 1]) { const a = new THREE.Vector3(x, 1.2, 2.25 * s), b = new THREE.Vector3(x * 1.15, 0, 3.6 * s); const len = a.distanceTo(b); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 4), rope); r.position.copy(a).add(b).multiplyScalar(0.5); r.lookAt(b); r.rotateX(Math.PI / 2); grp.add(r); }
    scene.add(grp); }
  // ---- campfire: stones, logs, flames, embers
  { const F = SPOTS.fire, grp = new THREE.Group(); grp.position.copy(F); W.fire = grp; const st = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, color: 0x3a3632, map: W.rockTex });
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, r = makeRock(800 + i, 0.17, st, 2); r.position.set(Math.cos(a) * 0.55, 0.05, Math.sin(a) * 0.55); grp.add(r); }
    const wood = new THREE.MeshStandardMaterial({ color: sc(0.17, 0.11, 0.07), roughness: 0.9, emissive: new THREE.Color(0xff5a10), emissiveIntensity: 0 }); W.fireWood = wood;
    for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 7), wood); l.rotation.set(Math.PI / 2 - 0.3, i * 0.8, 0); l.position.y = 0.12; grp.add(l); }
    const ash = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshStandardMaterial({ color: sc(0.12, 0.11, 0.1), roughness: 1 })); ash.rotation.x = -Math.PI / 2; ash.position.y = 0.02; grp.add(ash);
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
          gl_FragColor = vec4(c * a * 2.2, a); }` });
    W.flameMat = flameMat; W.flames = [];
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.15), flameMat); f.position.y = 0.6; f.rotation.y = i * Math.PI / 4; grp.add(f); W.flames.push(f); }
    const R = rng(9), pos = [], ph = []; for (let i = 0; i < 70; i++) { pos.push((R() - 0.5) * 0.5, 0, (R() - 0.5) * 0.5); ph.push(R()); }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); eg.setAttribute('ph', new THREE.Float32BufferAttribute(ph, 1));
    W.emberMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: WIND.uTime, uInt: { value: 1 }, uScale: { value: 1 } },
      vertexShader: `attribute float ph; uniform float uTime, uScale; varying float vA; void main(){ float t = fract(uTime * 0.35 + ph); vec3 p = position;
        p.y += t * 3.2; p.x += sin(uTime * 2.0 + ph * 20.0) * 0.3 * t; p.z += cos(uTime * 1.7 + ph * 13.0) * 0.3 * t; vA = (1.0 - t);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = 60.0 * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'uniform float uInt; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(1.0, 0.55, 0.15, vA * uInt * (1.0 - d * 2.0)); }' });
    const embers = new THREE.Points(eg, W.emberMat); embers.position.y = 0.3; grp.add(embers);
    scene.add(grp); }
  // ---- log pile beside the tent, and the bare ground when it is gone
  { const L = SPOTS.logs, grp = new THREE.Group(); grp.position.copy(L); grp.rotation.y = TENT_ROT; W.logs = grp;
    const bark = new THREE.MeshStandardMaterial({ color: sc(0.32, 0.25, 0.19), roughness: 0.95, bumpMap: detail, bumpScale: 3 }), end = new THREE.MeshStandardMaterial({ color: sc(0.72, 0.56, 0.38), roughness: 0.8 });
    const R = rng(77); const rows = [6, 5, 4, 3, 2];
    rows.forEach((n, row) => { for (let i = 0; i < n; i++) { const r = 0.08 + R() * 0.035, len = 1.2 + R() * 0.35; const lg = new THREE.Group();
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, len, 10), [bark, end, end]); c.rotation.z = Math.PI / 2; lg.add(c);
      lg.position.set((R() - 0.5) * 0.14, r + row * 0.165, (i - (n - 1) / 2) * 0.19 + (row % 2) * 0.05); lg.rotation.y = (R() - 0.5) * 0.18; grp.add(lg); } });
    grp.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); scene.add(grp);
    const bare = new THREE.Group(); bare.position.copy(L); bare.rotation.y = TENT_ROT; W.bare = bare;
    const patchTex = canvasTex(512, 384, (g, w, h) => { const Q = rng(19); g.clearRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) { const x = 40 + Q() * (w - 80), y = 40 + Q() * (h - 80); const edge = Math.min(x - 40, w - 40 - x, y - 40, h - 40 - y); const a = Math.min(1, edge / 30 + (Q() - 0.5) * 0.6);
        if (a <= 0) continue; const v = Q(); g.strokeStyle = v < 0.7 ? `rgba(${176 + Q() * 40 | 0},${158 + Q() * 34 | 0},${104 + Q() * 26 | 0},${a})` : `rgba(${92 + Q() * 30 | 0},${78 + Q() * 24 | 0},${58 + Q() * 16 | 0},${a})`;
        g.lineWidth = 1 + Q() * 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10 + Q() * 24, y + (Q() - 0.5) * 5); g.stroke(); }
      for (let i = 0; i < 26; i++) { const x = 60 + Q() * (w - 120), y = 60 + Q() * (h - 120), r = 8 + Q() * 22; g.fillStyle = `rgba(70,56,40,${0.3 + Q() * 0.3})`; g.beginPath(); g.ellipse(x, y, r * 1.6, r * 0.6, 0, 0, 7); g.fill(); }
    }, { wrap: false });
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.3), new THREE.MeshStandardMaterial({ map: patchTex, roughness: 1, transparent: true, depthWrite: false })); pm.rotation.x = -Math.PI / 2; pm.position.y = 0.03; bare.add(pm);
    for (let i = 0; i < 24; i++) { const chip = new THREE.Mesh(new THREE.BoxGeometry(0.04 + R() * 0.04, 0.01, 0.02 + R() * 0.02), end); chip.position.set((R() - 0.5) * 2.0, 0.035, (R() - 0.5) * 1.4); chip.rotation.set(R() * 0.3, R() * 6, R() * 0.3); bare.add(chip); }
    for (let i = 0; i < 6; i++) { const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.3 + R() * 0.3, 5), bark); tw.rotation.set(Math.PI / 2, 0, R() * 6); tw.position.set((R() - 0.5) * 1.3, 0.03, (R() - 0.5) * 0.7); bare.add(tw); }
    scene.add(bare); }
  // ---- chopping block + fallen branch near the grove
  { const C = SPOTS.chop, grp = new THREE.Group(); grp.position.copy(C); W.chopSite = grp;
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.33, 0.45, 12), new THREE.MeshStandardMaterial({ color: sc(0.38, 0.29, 0.22), roughness: 0.95 })); stump.position.y = 0.2; grp.add(stump);
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), new THREE.MeshStandardMaterial({ color: sc(0.68, 0.53, 0.36), roughness: 0.8 })); top.rotation.x = -Math.PI / 2; top.position.y = 0.43; grp.add(top);
    const br = new THREE.Mesh(branchGeo([new THREE.Vector3(-0.6, 0.15, -1.6), new THREE.Vector3(0.2, 0.2, -1.2), new THREE.Vector3(1.0, 0.18, -0.9), new THREE.Vector3(2.0, 0.25, -1.1)], 0.13, 0.06, 99), barkMat); grp.add(br);
    grp.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); scene.add(grp); }
  // ---- ground mist sprites (drifting; each fades out when close to the camera)
  { const mistTex = canvasTex(256, 128, (g) => { const R = rng(4); g.clearRect(0, 0, 256, 128); for (let i = 0; i < 46; i++) { const x = 30 + R() * 196, y = 44 + R() * 40, r = 18 + R() * 42; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128); } }, { wrap: false });
    W.mistMat = new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0.5, fog: true }); W.mist = []; const R = rng(55);
    for (let i = 0; i < 110; i++) { const s = new THREE.Sprite(W.mistMat.clone()); const a = R() * 6.28, r = 4 + Math.pow(R(), 0.8) * 80; s.userData = { a, r, y: 0.35 + R() * 1.8, sp: 0.2 + R() * 0.6, sc: 8 + R() * 20 }; s.scale.set(s.userData.sc, s.userData.sc * 0.28, 1); s.name = 'mist'; scene.add(s); W.mist.push(s); }
    W.rollMat = W.mistMat.clone(); W.roll = []; const R2 = rng(91);
    for (let i = 0; i < 18; i++) { const s = new THREE.Sprite(W.mistMat.clone()); s.userData = { a: R2() * 6.28, r: 0.6 + R2() * 3.2, y: 0.15 + R2() * 0.6, sp: 0.6 + R2() * 0.8, sc: 2.5 + R2() * 3 }; s.scale.set(s.userData.sc, s.userData.sc * 0.35, 1); scene.add(s); W.roll.push(s); } }

  W.scene = scene; W.WIND = WIND; return W;
}

// ---------------------------------------------------------------- time of day
const C = c => new THREE.Color(c);
export const TOD = {
  day:    { top: C('#3a6aa8'), hor: C('#b4c9da'), sunEl: 40, sunAz: 205, sunCol: C('#fff0d8'), keyI: 2.8, hemiSky: C('#b8cfe8'), hemiGr: C('#5d5233'), hemiI: 0.85, fog: C('#a9bccc'), fogD: 0.0009, stars: 0, moon: 0, sunGlow: 1, fire: 0, clouds: 0.45, cloudCol: C('#f2efe8'), exp: 1.0 },
  golden: { top: C('#38507c'), hor: C('#e99a58'), sunEl: 6, sunAz: 300, sunCol: C('#ffb067'), keyI: 2.5, hemiSky: C('#8a97bd'), hemiGr: C('#56402a'), hemiI: 0.5, fog: C('#c4946e'), fogD: 0.0022, stars: 0, moon: 0, sunGlow: 1.2, fire: 0.3, clouds: 0.5, cloudCol: C('#e9a27c'), exp: 1.0 },
  dusk:   { top: C('#121a36'), hor: C('#7a4c60'), sunEl: -4, sunAz: 300, sunCol: C('#ff8a5a'), keyI: 0.4, hemiSky: C('#434b77'), hemiGr: C('#1c1818'), hemiI: 0.32, fog: C('#30334c'), fogD: 0.005, stars: 0.4, moon: 0.45, sunGlow: 0.6, fire: 1, clouds: 0.35, cloudCol: C('#4a4062'), exp: 1.1 },
  night:  { top: C('#03070f'), hor: C('#15233d'), sunEl: -30, sunAz: 300, sunCol: C('#000000'), keyI: 1.45, hemiSky: C('#2a4068'), hemiGr: C('#08090d'), hemiI: 0.42, fog: C('#131d30'), fogD: 0.009, stars: 1, moon: 1, sunGlow: 0, fire: 1, clouds: 0.22, cloudCol: C('#24324e'), exp: 1.55 },
  dawn:   { top: C('#22305a'), hor: C('#c09090'), sunEl: -2, sunAz: 258, sunCol: C('#ffc2a0'), keyI: 0.7, hemiSky: C('#8794bb'), hemiGr: C('#2c2830'), hemiI: 0.85, fog: C('#5e6582'), fogD: 0.008, stars: 0.12, moon: 0.3, sunGlow: 0.7, fire: 0.15, clouds: 0.5, cloudCol: C('#a58a96'), exp: 1.55 },
};
export const MOON_DIR = new THREE.Vector3(-0.42, 0.45, -1).normalize();
export function lerpTOD(a, b, k) {
  const o = {}; for (const key of Object.keys(a)) { const x = a[key], y = b[key] ?? x; o[key] = x.isColor ? x.clone().lerp(y, k) : x + (y - x) * k; } return o;
}
const _c = new THREE.Color(), MOONCOL = new THREE.Color('#9db4e6'), MISTLIGHT = new THREE.Color('#c8d2e0');
export function applyTOD(W, s, camera, t) {
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - s.sunEl), THREE.MathUtils.degToRad(s.sunAz));
  const u = W.sky.material.uniforms; u.top.value.copy(s.top); u.horizon.value.copy(s.hor); u.sunDir.value.copy(sunDir); u.moonDir.value.copy(MOON_DIR); u.sunColor.value.copy(s.sunCol);
  const MD = W.moonDir || MOON_DIR;
  u.sunGlow.value = s.sunGlow; u.moonGlow.value = s.moon; u.clouds.value = s.clouds ?? 0.4; u.cloudCol.value.copy(s.cloudCol ?? s.hor); u.moonDir.value.copy(MD);
  W.sky.position.copy(camera.position); W.stars.position.copy(camera.position);
  const moonPos = camera.position.clone().addScaledVector(MD, 3600); W.moon.position.copy(moonPos); W.moon.scale.setScalar(250 * (W.moonScale ?? 1)); W.moon.material.opacity = Math.min(1, s.moon * 1.2);
  W.moonGlow.position.copy(moonPos); W.moonGlow.scale.setScalar(1500 * Math.sqrt(W.moonScale ?? 1)); W.moonGlow.material.opacity = s.moon * 0.85;
  W.starMat.uniforms.uOpacity.value = s.stars;
  // key light follows the brighter of sun / moon
  const sunUp = s.sunEl > -1, dir = sunUp ? sunDir : MD;
  W.key.color.copy(sunUp ? s.sunCol : MOONCOL); W.key.intensity = sunUp ? s.keyI : s.keyI * s.moon;
  const focus = W.shadowFocus || SPOTS.grove;
  W.key.position.copy(dir).multiplyScalar(400).add(focus); W.key.target.position.copy(focus);
  W.hemi.color.copy(s.hemiSky); W.hemi.groundColor.copy(s.hemiGr); W.hemi.intensity = s.hemiI;
  W.scene.fog.color.copy(s.fog); W.scene.fog.density = s.fogD * 1.25;
  // fire
  const fl = s.fire * (W.fireOn ?? 1);
  const flick = 0.75 + 0.15 * Math.sin(t * 13.1) + 0.1 * Math.sin(t * 7.3 + 1.3) + 0.08 * Math.sin(t * 23.7);
  W.fireLight.intensity = 30 * fl * flick; W.flameMat.uniforms.uInt.value = Math.min(1, fl * 1.2); W.emberMat.uniforms.uInt.value = fl; W.fireWood.emissiveIntensity = 1.4 * fl * flick;
  W.flames.forEach(f => { f.visible = fl > 0.03; f.scale.set(1, 0.4 + 0.6 * Math.min(1, fl), 1); });
  // mist drifts; sprites fade near the camera
  const mo = W.mistOpacity ?? 0.5; _c.copy(s.fog).multiplyScalar(1.4).lerp(MISTLIGHT, (0.06 + 0.06 * s.moon) * (W.mistLight ?? 1));
  W.mist.forEach((m, i) => { const d = m.userData, a = d.a + t * d.sp * 0.004, x = Math.cos(a) * d.r + 6 + Math.sin(t * 0.05 + i) * 3, z = Math.sin(a) * d.r + 5;
    m.position.set(x, heightAt(x, z) + d.y, z); const dist = m.position.distanceTo(camera.position);
    m.material.opacity = mo * 0.5 * smoothstep(2.5, 10, dist); m.material.color.copy(_c); m.visible = m.material.opacity > 0.004; });
  // rolling mist around the log pile (opacity from W.rollMist)
  const rm = W.rollMist ?? 0;
  W.roll.forEach(m => { const d = m.userData, a = d.a + t * d.sp * 0.5; m.position.set(SPOTS.logs.x + Math.cos(a) * d.r, SPOTS.logs.y + d.y, SPOTS.logs.z + Math.sin(a) * d.r);
    m.material.opacity = rm * 0.55 * smoothstep(1.5, 4.0, m.position.distanceTo(camera.position)); m.material.color.copy(s.fog).multiplyScalar(2.2); m.visible = m.material.opacity > 0.004; });
  // cloth strips flutter
  W.cloths.forEach(c => { c.rotation.x = 0.25 * Math.sin(t * 2.2 + c.userData.ph) * W.WIND.uWind.value + 0.05; c.rotation.z = 0.2 * Math.sin(t * 3.1 + c.userData.ph * 1.7) * W.WIND.uWind.value; });
}
