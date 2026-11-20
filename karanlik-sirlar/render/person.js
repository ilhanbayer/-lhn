// The woodcutter: a simple articulated figure read mostly as a silhouette. Poses are blended joint-angle sets.
import * as THREE from 'three';
import { heightAt } from './world.js';

const cloth = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.95 });
const cloth2 = new THREE.MeshStandardMaterial({ color: 0x241d17, roughness: 0.95 });
const skin = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.8 });
const wood = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.85 });
const steel = new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.45, metalness: 0.7 });
const logBark = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.95 }), logEnd = new THREE.MeshStandardMaterial({ color: 0xb08a5c, roughness: 0.8 });

function limb(len, r0, r1, mat) {           // hangs down from its pivot (-Y)
  const g = new THREE.CapsuleGeometry((r0 + r1) / 2, len - (r0 + r1), 4, 10); g.translate(0, -len / 2, 0);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = -p.getY(i) / len; const s = THREE.MathUtils.lerp(r0, r1, Math.min(1, Math.max(0, k))) / ((r0 + r1) / 2); p.setX(i, p.getX(i) * s); p.setZ(i, p.getZ(i) * s); }
  g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.castShadow = true; return m;
}
export function buildPerson() {
  const root = new THREE.Group(), J = {};
  const hips = new THREE.Group(); hips.position.y = 0.96; root.add(hips); J.hips = hips;
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), cloth); pelvis.scale.set(1.05, 0.7, 0.75); hips.add(pelvis);
  const torso = new THREE.Group(); hips.add(torso); J.torso = torso;
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.195, 0.56, 14), cloth2); chest.position.y = 0.3; chest.scale.z = 0.64; torso.add(chest);
  const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.29, 0.62, 14, 1, true), cloth); jacket.material = cloth.clone(); jacket.material.side = THREE.DoubleSide; jacket.position.y = -0.02; jacket.scale.z = 0.72; torso.add(jacket);
  const sh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 8), cloth2); sh.scale.set(1.18, 0.45, 0.66); sh.position.y = 0.55; torso.add(sh);
  const neck = new THREE.Group(); neck.position.y = 0.6; torso.add(neck); J.neck = neck;
  const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), skin); nk.position.y = 0.04; neck.add(nk);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), skin); head.scale.set(0.92, 1.08, 1); head.position.y = 0.17; neck.add(head);
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), cloth); beard.scale.set(1, 0.8, 0.7); beard.position.set(0, 0.11, 0.05); neck.add(beard);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.118, 14, 8, 0, 6.29, 0, 1.45), cloth); cap.scale.set(1.0, 0.62, 1.08); cap.position.set(0, 0.215, -0.005); cap.rotation.x = -0.1; neck.add(cap);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.012, 10, 1, false, -1.2, 2.4), cloth); brim.position.set(0, 0.235, 0.085); brim.rotation.x = 0.2; neck.add(brim);
  for (const s of [-1, 1]) {
    const sp = new THREE.Group(); sp.position.set(0.24 * s, 0.52, 0); torso.add(sp);
    const up = limb(0.3, 0.072, 0.06, cloth2); sp.add(up);
    const el = new THREE.Group(); el.position.y = -0.3; sp.add(el); el.add(limb(0.27, 0.06, 0.048, cloth2));
    const wr = new THREE.Group(); wr.position.y = -0.27; el.add(wr); const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skin); hand.position.y = -0.04; wr.add(hand);
    J[s < 0 ? 'lSh' : 'rSh'] = sp; J[s < 0 ? 'lEl' : 'rEl'] = el; J[s < 0 ? 'lWr' : 'rWr'] = wr;
    const hp = new THREE.Group(); hp.position.set(0.1 * s, -0.02, 0); hips.add(hp);
    hp.add(limb(0.47, 0.105, 0.078, cloth));
    const kn = new THREE.Group(); kn.position.y = -0.47; hp.add(kn); kn.add(limb(0.44, 0.078, 0.056, cloth));
    const ft = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.24), cloth2); ft.position.set(0, -0.47, 0.05); kn.add(ft);
    J[s < 0 ? 'lHip' : 'rHip'] = hp; J[s < 0 ? 'lKn' : 'rKn'] = kn;
  }
  // axe in the right hand: the handle runs along the forearm direction beyond the fist
  const axe = new THREE.Group(); axe.position.y = -0.05; J.rWr.add(axe); J.axe = axe;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.8, 8), wood); handle.position.y = -0.28; axe.add(handle);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.12, 0.2), steel); blade.position.set(0, -0.62, 0.07); axe.add(blade);
  const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.024, 12, 1, false, 0, Math.PI), steel); edge.rotation.z = Math.PI / 2; edge.rotation.y = Math.PI / 2; edge.position.set(0, -0.62, 0.15); edge.scale.set(0.8, 1, 0.5); axe.add(edge);
  // log bundle carried on the right shoulder
  const bundle = new THREE.Group(); bundle.position.set(0.17, 0.6, -0.02); bundle.rotation.x = -0.38; torso.add(bundle); J.bundle = bundle;
  [[0, 0], [0.1, 0.02], [-0.09, 0.03], [0.04, 0.11]].forEach(([x, y], i) => { const r = 0.065 + (i % 2) * 0.012; const l = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.05 + (i % 3) * 0.08, 9), [logBark, logEnd, logEnd]); l.rotation.x = Math.PI / 2; l.position.set(x, y, 0.1 + (i % 3) * 0.05); l.castShadow = true; bundle.add(l); });
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // wood chips from the axe impact
  const chips = []; const chipG = new THREE.BoxGeometry(0.05, 0.012, 0.03);
  for (let i = 0; i < 14; i++) { const c = new THREE.Mesh(chipG, logEnd); c.visible = false; chips.push(c); }
  const P = { root, J, chips, chipGroup: new THREE.Group() };
  chips.forEach(c => P.chipGroup.add(c));
  P.update = (s, t) => update(P, s, t);
  return P;
}

// ---------------------------------------------------------------- poses
const ZERO = { tp: 0, ty: 0, tr: 0, hy: 0, hp: 0, lsp: 0, lsr: 0.08, le: 0.15, rsp: 0, rsr: 0.08, re: 0.15, rw: 0, lh: 0, lk: 0, rh: 0, rk: 0, bob: 0 };
const mix = (a, b, k) => { const o = {}; for (const key in ZERO) o[key] = (a[key] ?? ZERO[key]) * (1 - k) + (b[key] ?? ZERO[key]) * k; return o; };
export function walkPose(ph, amt = 1) {
  const s = Math.sin(ph * Math.PI * 2), c = Math.cos(ph * Math.PI * 2);
  return { tp: 0.06 * amt, lh: 0.42 * s * amt, rh: -0.42 * s * amt, lk: (0.15 + 0.55 * Math.max(0, -c)) * amt, rk: (0.15 + 0.55 * Math.max(0, c)) * amt,
    lsp: -0.35 * s * amt, rsp: 0.35 * s * amt, le: 0.25 + 0.2 * Math.max(0, -s) * amt, re: 0.25 + 0.2 * Math.max(0, s) * amt, bob: -0.03 * Math.abs(c) * amt, lsr: 0.08, rsr: 0.08 };
}
export function chopPose(ph) {          // ph 0..1 per stroke: wind-up (0..0.55), swing (0.55..0.68), recover
  const k = ph < 0.55 ? THREE.MathUtils.smootherstep(ph / 0.55, 0, 1) : ph < 0.68 ? 1 - Math.pow((ph - 0.55) / 0.13, 1.6) : 0;
  const up = { tp: -0.18, lsp: 2.75, rsp: 2.85, le: 0.7, re: 0.55, rw: 1.5, lsr: -0.1, rsr: -0.15, lh: 0.25, rh: -0.25, lk: 0.1, rk: 0.15, hp: -0.15 };
  const dn = { tp: 0.45, lsp: 0.95, rsp: 1.0, le: 0.1, re: 0.08, rw: 0.15, lsr: -0.25, rsr: -0.3, lh: 0.35, rh: -0.2, lk: 0.35, rk: 0.25, hp: 0.25, bob: -0.08 };
  return mix(dn, up, k);
}
export function carryPose(ph, amt = 1) { const w = walkPose(ph, amt); return Object.assign(w, { rsp: 2.55, rsr: 0.25, re: 2.0, tr: -0.06, tp: 0.12 }); }
export const standPose = (t = 0) => ({ tp: 0.02 + 0.01 * Math.sin(t * 1.6), lsp: 0.05, rsp: 0.05, le: 0.2, re: 0.2 });
export const fearPose = (k) => ({ tp: -0.22 * k, lsp: 0.7 * k, rsp: 0.85 * k, le: 1.2 * k, re: 1.1 * k, lsr: 0.2, rsr: 0.2, lh: 0.25 * k, rh: -0.35 * k, lk: 0.3 * k, rk: 0.1 * k, hp: -0.1 * k, bob: -0.04 * k });

function update(P, s, t) {
  const { root, J } = P;
  if (!s) { root.visible = false; P.chipGroup.visible = false; return; }
  root.visible = true; P.chipGroup.visible = !!s.chips;
  if (!P.chipGroup.parent && root.parent) root.parent.add(P.chipGroup);
  root.position.set(s.x, heightAt(s.x, s.z), s.z); root.rotation.y = s.heading ?? 0;
  const p = Object.assign({}, ZERO, s.pose || {});
  if (s.headYaw) p.hy += s.headYaw;
  J.hips.position.y = 0.96 + p.bob; J.torso.rotation.set(p.tp, p.ty, p.tr); J.neck.rotation.set(p.hp, p.hy, 0);
  J.lSh.rotation.set(-p.lsp, 0, -p.lsr); J.rSh.rotation.set(-p.rsp, 0, p.rsr); J.lEl.rotation.x = -p.le; J.rEl.rotation.x = -p.re; J.rWr.rotation.x = -p.rw;
  J.lHip.rotation.x = -p.lh; J.rHip.rotation.x = -p.rh; J.lKn.rotation.x = p.lk; J.rKn.rotation.x = p.rk;
  J.axe.visible = !!s.axe; J.bundle.visible = !!s.bundle;
  if (s.chips) {   // chips fly from the impact point after each stroke: s.chips = {x,y,z, since}
    P.chips.forEach((c, i) => { const age = s.chips.since - (i % 3) * 0.02; const a = i * 2.39; const v = 1.6 + (i % 5) * 0.35;
      if (age < 0 || age > 0.9) { c.visible = false; return; } c.visible = true;
      c.position.set(s.chips.x + Math.cos(a) * v * 0.5 * age, s.chips.y + v * age - 4.9 * age * age, s.chips.z + Math.sin(a) * v * 0.5 * age); c.rotation.set(age * 9 + i, age * 7, age * 5); });
  }
}
