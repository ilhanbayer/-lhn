// Shot list for "Kanlı Ardıç". Times follow timeline.json (narration line starts); every shot is a pure
// function of time, so any frame can be rendered alone.
import { heightAt, SPOTS, TOD, lerpTOD, MOON_DIR, TENT_ROT, smoothstep } from './world.js';
import { walkPose, chopPose, carryPose, standPose, fearPose } from './person.js';

export function makeShots(W, THREE) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const G = (x, z, h = 0) => V(x, heightAt(x, z) + h, z);            // point h metres above the ground
  const ease = u => u * u * (3 - 2 * u), easeOut = u => 1 - Math.pow(1 - u, 3), easeIn = u => u * u * u;
  const clamp01 = u => Math.min(1, Math.max(0, u));
  const lin = (a, b, u) => a + (b - a) * u;
  const lv = (a, b, u) => a.clone().lerp(b, u);
  const curve = pts => { const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); return u => c.getPoint(clamp01(u)); };
  const fadeIn = (t, t0, d) => 1 - clamp01((t - t0) / d), fadeOut = (t, t1, d) => clamp01((t - (t1 - d)) / d);
  const tod = (name, over) => Object.assign({}, TOD[name], over || {});
  const todMix = (a, b, k, over) => Object.assign(lerpTOD(TOD[a], TOD[b], clamp01(k)), over || {});
  const handheld = (t, amp = 0.02, f = 1) => V(Math.sin(t * 1.3 * f) * amp + Math.sin(t * 2.9 * f + 1) * amp * 0.4, Math.sin(t * 1.7 * f + 2) * amp * 0.7, Math.sin(t * 1.1 * f + 4) * amp * 0.5);
  const fire = SPOTS.fire, logs = SPOTS.logs, tent = SPOTS.tent, chop = SPOTS.chop;
  const tf = V(Math.sin(TENT_ROT), 0, Math.cos(TENT_ROT)), ts = V(Math.cos(TENT_ROT), 0, -Math.sin(TENT_ROT)); // tent front / side
  const tentDoor = tent.clone().addScaledVector(tf, 2.6);
  // ------------------------------------------------------------ grades
  const GD = { sat: 1.06, con: 1.04, tint: [1.02, 1.0, 0.96], vig: 0.28, grain: 0.03, exp: 1.0, bloom: 0.35 };
  const GN = { sat: 0.72, con: 1.12, tint: [0.88, 0.97, 1.1], lift: [0.0, 0.004, 0.014], vig: 0.55, grain: 0.045, exp: 1.0, bloom: 0.6 };
  const GF = { sat: 0.62, sepia: 0.42, con: 1.06, tint: [1.06, 0.98, 0.86], lift: [0.025, 0.015, 0.0], vig: 0.62, grain: 0.075, exp: 1.0, bloom: 0.55 };
  const gmix = (a, b, k) => { const o = {}; for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = a[key] ?? (Array.isArray(b[key]) ? [0, 0, 0] : 0), y = b[key] ?? (Array.isArray(a[key]) ? [0, 0, 0] : 0);
      o[key] = Array.isArray(x) ? x.map((v, i) => lin(v, y[i], k)) : lin(x, y, k); } return o; };
  const flick = t => 1 + 0.025 * Math.sin(t * 37.1) + 0.02 * Math.sin(t * 23.3 + 1.1);     // projector flicker for the flashback
  const GFt = (t, extra) => Object.assign({}, GF, { exp: flick(t) }, extra || {});
  // ------------------------------------------------------------ the woodcutter
  const STRIDE = 1.45;
  const walker = (pts, u, opts = {}) => {                              // walk along a polyline (xz) at constant speed
    const segs = []; let L = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); L += d; }
    let d = clamp01(u) * L, i = 0; while (i < segs.length - 1 && d > segs[i]) { d -= segs[i]; i++; }
    const a = pts[i], b = pts[i + 1], k = segs[i] ? d / segs[i] : 0, x = lin(a[0], b[0], k), z = lin(a[1], b[1], k);
    const ph = (clamp01(u) * L) / STRIDE + (opts.ph0 || 0);
    return { x, z, heading: Math.atan2(b[0] - a[0], b[1] - a[1]), pose: opts.carry ? carryPose(ph, 1) : walkPose(ph, opts.amt ?? 1), axe: !!opts.axe, bundle: !!opts.carry };
  };
  const chopper = (t, at, heading, extra = {}) => {                     // chopping in place; impact at phase 0.6 of a 1.25 s stroke
    const P = 1.25, ph = ((t % P) + P) % P / P; const since = ph >= 0.62 ? (ph - 0.62) * P : ph * P + (1 - 0.62) * P;
    const imp = V(at[0] + Math.sin(heading) * 0.75, heightAt(at[0], at[1]) + 0.45, at[1] + Math.cos(heading) * 0.75);
    return Object.assign({ x: at[0], z: at[1], heading, pose: chopPose(ph), axe: true, chips: { x: imp.x, y: imp.y, z: imp.z, since } }, extra);
  };
  // chop stance: the man stands beside the chopping block, seen in profile against the low sun
  const CH_HEAD = -2.62, CH_AT = [chop.x - Math.sin(CH_HEAD) * 0.75, chop.z - Math.cos(CH_HEAD) * 0.75];
  // ------------------------------------------------------------ shots
  const list = [];
  const shot = (t0, t1, fn) => list.push({ t0, t1, fn });
  const black = { black: true };

  // 0 – 3.6: black, the wind rises
  shot(0, 3.6, () => black);
  // A + B (3.6 – 9.45): "Gündüzü cennet... Ama gecesi..." the sunny plateau, then the day collapses into night
  { const p = curve([G(-44, 50, 6.5), G(-38, 43, 5.8), G(-32, 36, 5.2)]);
    shot(3.6, 9.456, (u, t) => { const k = clamp01((t - 7.15) / 2.1);
      const todS = k < 0.45 ? todMix('day', 'golden', k / 0.45) : k < 0.75 ? todMix('golden', 'dusk', (k - 0.45) / 0.3) : todMix('dusk', 'night', (k - 0.75) / 0.25);
      return { cam: { pos: p(ease(u)), look: G(14, -40, 9).add(V(0, -1.5 * u, 0)), fov: 42 }, tod: todS, grade: Object.assign(gmix(GD, GN, ease(k)), { fade: fadeIn(t, 3.6, 1.6) }),
        state: { fire: 1, mist: lin(0.0, 0.6, k), starRot: k * 0.25, wind: 1 + k } }; }); }
  // C (9.456 – 16.3): "Bambaşka bir âlem!" — night among the junipers against the moon, craning up to the plateau; main title
  { const p = curve([G(9.0, 16.5, 1.0), G(9.4, 19, 3.5), G(10, 23, 8), G(11, 28, 14)]); const moonC = V(-0.316, 0.545, -0.777).normalize();
    shot(9.456, 16.3, (u, t) => { const e = easeOut(u); const c = p(e);
      return { cam: { pos: c, look: lv(c.clone().add(V(-0.443, 0.342, -0.828).multiplyScalar(10)), G(-2, -30, 6), ease(u)), fov: lin(40, 46, e) }, tod: tod('night', { fogD: 0.014 }),
        grade: Object.assign({}, GN, { flash: [0.06 * fadeIn(t, 9.456, 0.5), 0.07 * fadeIn(t, 9.456, 0.5), 0.09 * fadeIn(t, 9.456, 0.5)] }), state: { fire: 1, mist: 0.75, wind: 1.7, moonDir: moonC },
        overlay: { title: { a: smoothstep(11.0, 12.4, t) * (1 - smoothstep(15.0, 16.1, t)), tf: `scale(${1 + 0.03 * (t - 11) / 5})` } } }; }); }
  // E (16.3 – 19.3): "Burada her kayanın bir hikâyesi..." lichen rocks, low dolly
  shot(16.3, 19.3, (u, t) => ({ cam: { pos: lv(G(-7.6, 0.4, 1.0), G(-10.2, 0.8, 1.1), ease(u)), look: G(-9.0, 6.4, 0.9), fov: 44 }, tod: tod('night', { fogD: 0.014 }), grade: GN, state: { mist: 0.55, wind: 1.3 } }));
  // F (19.3 – 21.6): "Her ağacın bir sırrı..." tilt up the largest juniper
  shot(19.3, 21.6, (u, t) => { const e = ease(u); return { cam: { pos: lv(G(6.6, -6.2, 1.0), G(6.3, -4.8, 1.3), e), look: lv(G(5.6, 2.6, 1.6), G(5.4, 2.6, 6.8), e), fov: 44 }, tod: tod('night', { fogD: 0.012 }), grade: GN, state: { mist: 0.45, wind: 1.3 } }; });
  // G (21.6 – 26.6): "Ve bazı gecelerin..." push through the fog toward a distant fire glow
  shot(21.6, 26.6, (u, t) => ({ cam: { pos: lv(G(4.5, 1.0, 1.7), G(9.5, 4.6, 1.6), ease(u)).add(handheld(t, 0.025)), look: fire.clone().add(V(0, 1.2, 0)), fov: 38 }, tod: tod('night', { fogD: 0.034 }),
    grade: GN, state: { mist: 0.9, wind: 1.1, fire: 1 } }));
  // H (26.6 – 33.0): "Kimi gördüğünü anlatamamış... Kimi yaşadıklarına..." a lone figure at the edge of the fog
  shot(26.6, 33.0, (u, t) => { const turn = smoothstep(29.4, 30.6, t) * (1 - smoothstep(31.8, 32.8, t));
    return { cam: { pos: lv(G(1.4, -7.4, 1.6), G(0.9, -9.6, 1.55), ease(u)), look: G(-1.2, -20, 2.4), fov: 36 }, tod: tod('night', { fogD: 0.02 }), grade: GN, state: { mist: 0.8, wind: 1.2 },
      person: { x: -1.0, z: -20, heading: Math.PI - 0.2, pose: standPose(t), headYaw: 1.1 * turn } }; });
  // I (33.0 – 38.9): "Ama bazı hikâyeler var ki... unutulmamış!" star timelapse over the junipers
  shot(33.0, 38.9, (u, t) => ({ cam: { pos: G(-3.0, 15.0, 0.5), look: G(-4, 60, 24), fov: 56 }, tod: tod('night', { fogD: 0.01 }), grade: Object.assign({}, GN, { fade: fadeOut(t, 38.9, 0.7) }),
    state: { mist: 0.5, wind: 1.0, starRot: (t - 33) * 0.09 } }));
  // chapter card (38.9 – 41.6) over black
  shot(38.9, 41.6, (u, t) => Object.assign({}, black, { overlay: { chapter: { a: smoothstep(39.1, 40.0, t) * (1 - smoothstep(41.0, 41.6, t)), ls: `${0.32 + 0.04 * u}em` } } }));
  // J (41.6 – 47.312): "Yahyalı'nın yaylalarında... Beş büyük ardıcın gölgesinde..." crane up behind a rock to reveal the five
  { const p = curve([G(-2.6, 19.5, 0.7), G(-2.4, 21, 3.5), G(-1.8, 23, 8.5)]);
    shot(41.6, 47.312, (u, t) => ({ cam: { pos: p(ease(u)), look: lv(G(0, 0, 1.5), G(0, 0, 3.2), ease(u)), fov: 40 }, tod: tod('night', { fogD: 0.012 }), grade: Object.assign({}, GN, { fade: fadeIn(t, 41.6, 1.2) }),
      state: { mist: 0.65, wind: 1.4 } })); }
  // K (47.312 – 49.9): "Kanlı Ardıç!" a juniper against the enormous moon
  { const cam0 = G(2.0, 14.0, 0.6), top = V(-1.2, new THREE.Box3().setFromObject(W.grove[3]).max.y - 1.2, 5.4), toTop = top.clone().sub(cam0).normalize();
    const hz = V(toTop.x, 0, toTop.z).normalize(), side = V(-hz.z, 0, hz.x), el = Math.asin(toTop.y) + 0.19;
    const moonK = hz.clone().addScaledVector(side, -0.06).normalize().multiplyScalar(Math.cos(el)).add(V(0, Math.sin(el), 0)).normalize();
    shot(47.312, 49.9, (u, t) => { const c = cam0.clone().add(V(0, 0.25 * u, 0)); const look = c.clone().add(toTop.clone().lerp(moonK, 0.42).normalize().multiplyScalar(100));
      return { cam: { pos: c, look, fov: lin(31, 27, easeOut(u)) }, tod: tod('night', { fogD: 0.004 }),
        grade: Object.assign({}, GN, { redVig: 0.55 * fadeIn(t, 47.32, 1.6), flash: [0.12 * fadeIn(t, 47.312, 0.25), 0.03 * fadeIn(t, 47.312, 0.25), 0.02 * fadeIn(t, 47.312, 0.25)] }), state: { mist: 0.4, wind: 1.5, moonDir: moonK, moonScale: 1.8 } }; }); }
  // L (49.9 – 53.95): "Burası sıradan bir ağaçlık değil... Bir makam..." orbit around the grave and the cloth strips
  shot(49.9, 53.95, (u, t) => { const m = W.makam.position; const p = lv(V(5.9, 0, 10.2), V(3.4, 0, 5.9), ease(u));
    return { cam: { pos: G(p.x, p.z, 1.75), look: m.clone().add(V(0, 0.5, 0)), fov: 40 }, tod: tod('night', { fogD: 0.014 }), grade: GN, state: { mist: 0.7, wind: 1.5 } }; });
  // M (53.95 – 56.9): "Burada yatanın Süme olduğu söylenir." the headstone
  { W.makam.updateMatrixWorld(true); const hs = W.makam.localToWorld(V(-1.15, 0.45, 0)); const mh = V(MOON_DIR.x, 0, MOON_DIR.z).normalize(), side = V(-mh.z, 0, mh.x);
    shot(53.95, 56.9, (u, t) => { const base = hs.clone().addScaledVector(mh, lin(2.5, 1.85, ease(u))).addScaledVector(side, 0.55);
      return { cam: { pos: V(base.x, heightAt(base.x, base.z) + 0.65, base.z), look: hs.clone().add(V(0, -0.05, 0)), fov: 34 }, tod: tod('night', { fogD: 0.014 }), grade: GN, state: { mist: 0.6, wind: 1.3 } }; }); }
  // N (56.9 – 62.2): "Ama burayı asıl gizemli yapan şey... Hakkında anlatılanlar!" push into the dark between the trees
  shot(56.9, 62.2, (u, t) => { const snap = smoothstep(59.6, 60.2, t);
    return { cam: { pos: lv(G(7, 12, 1.6), G(1.2, 2.6, 1.7), ease(u) * 0.85 + 0.15 * snap), look: G(-3.5, -7, 1.6), fov: lin(42, 36, snap) }, tod: tod('night', { fogD: 0.03 }),
      grade: Object.assign({}, GN, { flash: [0.9, 0.82, 0.66].map(c => c * smoothstep(61.75, 62.2, t)) }), state: { mist: 0.9, wind: 1.6 } }; });
  // ---------------------------------------------------------- the legend (warm, faded "memory" grade)
  const flashIn = (t, t0) => [0.9, 0.82, 0.66].map(c => c * (1 - smoothstep(t0, t0 + 0.55, t)));
  // O (62.2 – 64.7): "Rivayete göre..." golden hour; the woodcutter walks up to the grove with his axe
  shot(62.2, 64.7, (u, t) => { const w = walker([[-1.5, 13.5], [CH_AT[0], CH_AT[1]]], lin(0.08, 0.42, u), { axe: true });
    return { cam: { pos: lv(G(-14, 18, 2.2), G(-12.8, 16.6, 2.4), u), look: lv(G(2, 8, 1.8), G(4, 7, 1.8), u), fov: 36 }, tod: tod('golden'), grade: GFt(t, { flash: flashIn(t, 62.2) }), state: { fire: 0.4, mist: 0.2, wind: 0.8 }, person: w }; });
  // P (64.7 – 67.7): "Bir gün bir adam bu ağaçlardan odun keser." chopping, silhouetted against the low sun
  shot(64.7, 67.7, (u, t) => { const c = V(CH_AT[0], 0, CH_AT[1]); const back = V(0.86, 0, -0.5);
    const pos = G(c.x + back.x * 6.5 + 1.0 * u, c.z + back.z * 6.5 - 0.6 * u, 0.9);
    return { cam: { pos, look: G(c.x, c.z, 1.3), fov: 36 }, tod: tod('golden'), grade: GFt(t), state: { fire: 0.4, mist: 0.15, wind: 0.8 }, person: chopper(t - 64.7 + 0.3, CH_AT, CH_HEAD) }; });
  // Q (67.7 – 70.6): "Topladığı odunları çadırına taşır." carrying the logs toward the tent
  shot(67.7, 70.6, (u, t) => { const w = walker([[11.5, 7.6], [15.6, 10.4]], u, { carry: true });
    return { cam: { pos: G(w.x + 3.6, w.z - 4.8, 1.2), look: G(w.x + 1.2, w.z + 1.0, 1.3), fov: 40 }, tod: tod('golden', { sunAz: 285 }), grade: GFt(t), state: { fire: 0.5, mist: 0.15, wind: 0.8 }, person: w }; });
  // R (70.6 – 74.95): "Gece olur... Dağ sessizliğe bürünür..." the camp, locked off, day sinks into night; the fire dies down
  shot(70.6, 74.95, (u, t) => { const k = clamp01((t - 70.6) / 2.2);
    const todS = k < 0.5 ? todMix('golden', 'dusk', k / 0.5) : todMix('dusk', 'night', (k - 0.5) / 0.5);
    return { cam: { pos: G(8.5, 8.6, 2.4), look: G(19.5, 14.2, 1.6), fov: 40 }, tod: Object.assign(todS, { fogD: 0.008 }), grade: gmix(GFt(t), GN, 0.35),
      state: { fire: lin(1, 0.15, smoothstep(72.8, 74.9, t)), mist: lin(0.1, 0.4, k), starRot: (t - 70.6) * 0.12, wind: 0.6, focus: tent } }; });
  // S (74.95 – 78.669): "Sabah uyandığında ise..." dawn; he steps out of the tent, the camera drifts toward the woodpile
  shot(74.95, 78.669, (u, t) => { const out = clamp01((t - 75.2) / 2.0);
    const p = tentDoor.clone().addScaledVector(tf, lin(-0.4, 1.6, ease(out)));
    const pr = { x: p.x, z: p.z, heading: Math.atan2(tf.x, tf.z) + 0.9 * smoothstep(77.0, 78.4, t), pose: out < 1 ? walkPose((t - 75.2) / 0.6 * 0.5 + 0.25, 0.8) : standPose(t) };
    const camBase = tentDoor.clone().addScaledVector(tf, 6.5).addScaledVector(ts, -2.5);
    return { cam: { pos: V(camBase.x, heightAt(camBase.x, camBase.z) + 1.5, camBase.z), look: lv(G(p.x, p.z, 1.3), G(logs.x, logs.z, 0.8), smoothstep(76.4, 78.6, t) * 0.55), fov: 40 },
      tod: tod('dawn', { fogD: 0.012 }), grade: GFt(t, { sat: 0.55 }), state: { fire: 0.12, mist: 0.6, wind: 0.5, logs: true }, person: pr }; });
  // T (78.669 – 81.3): "Odunlar yoktur!" snap push onto the bare ground
  shot(78.669, 81.3, (u, t) => { const k = easeOut(clamp01((t - 78.669) / 0.35));
    const off = tf.clone().multiplyScalar(lin(4.6, 2.6, k)).addScaledVector(ts, lin(2.4, 1.3, k)); const c = G(logs.x + off.x, logs.z + off.z, lin(2.3, 1.8, k));
    return { cam: { pos: c.add(handheld(t, 0.03, 1.6)), look: G(logs.x, logs.z, 0.1), fov: lin(42, 34, k) - 1.2 * u }, tod: tod('dawn', { fogD: 0.012 }),
      grade: GFt(t, { sat: 0.5, flash: [0.1, 0.09, 0.08].map(c => c * fadeIn(t, 78.669, 0.3)) }), state: { fire: 0.0, mist: 0.6, wind: 0.6, logs: false } }; });
  // U (81.3 – 83.05): "Önce şaşırır..." he looks around, bewildered
  shot(81.3, 83.05, (u, t) => { const at = logs.clone().addScaledVector(ts, 1.3).addScaledVector(tf, 0.5);
    const cp = logs.clone().addScaledVector(ts, -1.2).addScaledVector(tf, 2.4); return { cam: { pos: G(cp.x, cp.z, 1.3), look: G(at.x, at.z, 1.45), fov: 38 }, tod: tod('dawn', { fogD: 0.012 }), grade: GFt(t, { sat: 0.55 }), state: { fire: 0, mist: 0.5, logs: false },
      person: { x: at.x, z: at.z, heading: Math.atan2(logs.x - at.x, logs.z - at.z), pose: Object.assign(standPose(t), { lsp: 0.35, rsp: 0.4, le: 0.9, re: 0.8, lsr: 0.25, rsr: 0.25 }), headYaw: 0.75 * Math.sin((t - 81.3) * 2.6) } }; });
  // V (83.05 – 86.6): "Sonra aynı ağaçlardan yeniden odun keser." chopping again: close, then wide
  shot(83.05, 84.8, (u, t) => { const imp = V(chop.x, heightAt(chop.x, chop.z) + 0.45, chop.z);
    return { cam: { pos: G(chop.x + 1.6, chop.z - 1.9, 0.75), look: imp.clone().add(V(0, 0.3, 0)), fov: 38 }, tod: tod('golden', { sunEl: 7 }), grade: GFt(t), state: { fire: 0.4, mist: 0.1, logs: false }, person: chopper(t - 83.05 + 0.5, CH_AT, CH_HEAD) }; });
  shot(84.8, 86.6, (u, t) => ({ cam: { pos: G(chop.x + 7.5 - u, chop.z - 7.5, 1.2), look: G(chop.x - 2, chop.z + 1, 2.6), fov: 42 }, tod: tod('golden', { sunEl: 7 }), grade: GFt(t), state: { fire: 0.4, mist: 0.1, logs: false },
    person: chopper(t - 84.8 + 0.2, CH_AT, CH_HEAD) }));
  // W (86.6 – 88.95): "Çadırına taşır." carrying again, from behind, toward the tent
  shot(86.6, 88.95, (u, t) => { const w = walker([[13.2, 9.6], [16.9, 13.3]], u, { carry: true, ph0: 0.3 });
    return { cam: { pos: G(w.x - 3.4, w.z - 3.0, 1.7), look: G(w.x + 2.2, w.z + 2.4, 1.2), fov: 44 }, tod: tod('golden', { sunAz: 280, sunEl: 3 }), grade: GFt(t), state: { fire: 0.6, mist: 0.15, logs: true }, person: w }; });
  // X (88.95 – 90.938): "Ama ertesi sabah..." dawn mist at the camp
  shot(88.95, 90.938, (u, t) => ({ cam: { pos: lv(G(9.5, 20.5, 2.2), G(10.5, 20.0, 2.0), u), look: G(19, 14.5, 1.1), fov: 40 }, tod: tod('dawn', { fogD: 0.02 }), grade: GFt(t, { sat: 0.5 }), state: { fire: 0.05, mist: 0.85, wind: 0.5, logs: true },
    person: { x: tentDoor.x + tf.x * 1.2, z: tentDoor.z + tf.z * 1.2, heading: Math.atan2(tf.x, tf.z) + 0.6, pose: standPose(t) } }));
  // Y (90.938 – 95.466): "Yine aynı manzara! Odunlar ortadan kaybolmuştur!" high angle on the empty ground, then he steps in
  shot(90.938, 95.466, (u, t) => { const off = tf.clone().multiplyScalar(lin(4.8, 4.3, ease(u))).addScaledVector(ts, lin(1.7, 1.4, ease(u))); const c = G(logs.x + off.x, logs.z + off.z, lin(1.5, 1.4, ease(u)));
    const enter = clamp01((t - 92.4) / 1.6); const at = lv(logs.clone().addScaledVector(ts, 2.6).addScaledVector(tf, 0.3), logs.clone().addScaledVector(ts, 0.95).addScaledVector(tf, 0.55), ease(enter));
    const lk = logs.clone().addScaledVector(ts, 0.5); return { cam: { pos: c, look: G(lk.x, lk.z, 0.35), fov: 40 }, tod: tod('dawn', { fogD: 0.014 }), grade: GFt(t, { sat: 0.5, flash: [0.09, 0.08, 0.07].map(c => c * fadeIn(t, 90.938, 0.3)) }),
      state: { fire: 0, mist: 0.55, logs: false }, person: t > 92.4 ? { x: at.x, z: at.z, heading: Math.atan2(-ts.x, -ts.z), pose: enter < 1 ? walkPose(enter * 1.1, 0.7) : Object.assign(standPose(t), { hp: 0.35 }) } : null }; });
  // Z (95.466 – 97.15): "Üçüncü kez dener..." fast: chop, then carry
  shot(95.466, 96.3, (u, t) => ({ cam: { pos: G(chop.x + 2.6, chop.z - 1.6, 1.0), look: G(chop.x + 0.2, chop.z + 0.5, 0.9), fov: 40 }, tod: tod('golden', { sunEl: 6 }), grade: GFt(t), state: { logs: false, fire: 0.4 }, person: chopper(t - 95.466 + 0.35, CH_AT, CH_HEAD) }));
  shot(96.3, 97.15, (u, t) => { const w = walker([[15.2, 12.3], [17.0, 14.7]], u, { carry: true, ph0: 0.6 });
    return { cam: { pos: G(14.0, 17.2, 1.3), look: G(w.x, w.z, 1.2), fov: 38 }, tod: tod('golden', { sunAz: 280, sunEl: 3 }), grade: GFt(t), state: { logs: true, fire: 0.6 }, person: w }; });
  // AA (97.15 – 98.95): "Ve yine..." night; mist rolls over the woodpile, the fire gutters
  shot(97.15, 98.95, (u, t) => ({ cam: { pos: lv(G(logs.x - 4.6, logs.z - 2.8, 1.2), G(logs.x - 4.0, logs.z - 2.3, 1.1), u), look: G(logs.x, logs.z, 0.6), fov: 40 }, tod: tod('night', { fogD: 0.014 }),
    grade: gmix(GFt(t), GN, 0.4), state: { logs: true, fire: lin(0.35, 0.0, u), mist: 0.5, roll: smoothstep(0, 0.7, u), wind: 2.4 } }));
  // AB (98.95 – 101.7): "Hiçbir şey kalmamıştır!" morning; straight down on the empty ground, slowly turning
  shot(98.95, 101.7, (u, t) => { const off = tf.clone().multiplyScalar(lin(-2.6, -2.2, u)).addScaledVector(ts, 0.35); const lk = logs.clone().addScaledVector(tf, 9);
    return { cam: { pos: G(logs.x + off.x, logs.z + off.z, 0.65), look: G(lk.x, lk.z, 0.6), fov: 38 }, tod: tod('dawn', { fogD: 0.012, sunEl: 2 }),
      grade: GFt(t, { sat: 0.48, flash: [0.1, 0.09, 0.08].map(c => c * fadeIn(t, 99.005, 0.3)) }), state: { logs: false, fire: 0, mist: 0.5 } }; });
  // AC (101.7 – 104.0): "İşte o zaman korkuya kapılır..." seen from among the junipers, he backs away
  shot(101.7, 104.0, (u, t) => { const k = ease(u); const at = [11.5 + 1.4 * k, 9.0 + 0.9 * k];
    return { cam: { pos: G(4.0, 4.4, 1.5).add(handheld(t, 0.015)), look: G(at[0], at[1], 1.3), fov: 32 }, tod: tod('dawn', { fogD: 0.007, sunEl: 3 }), grade: GFt(t, { sat: 0.5 }), state: { logs: false, fire: 0, mist: 0.3, wind: 1.6 },
      person: { x: at[0], z: at[1], heading: Math.atan2(-at[0], -at[1]), pose: Object.assign(fearPose(smoothstep(0, 0.4, u)), walkPose(-u * 1.2, 0.35 * smoothstep(0.2, 0.5, u)), { tp: -0.2, lsp: 0.6, rsp: 0.7, le: 1.1, re: 1.0 }) } }; });
  // AD (104.0 – 110.6): "Bir daha o ağaçlardan tek bir dal bile almaya cesaret edemez." he walks away and looks back; long pause
  shot(104.0, 110.6, (u, t) => { const lookB = smoothstep(106.2, 106.9, t) * (1 - smoothstep(107.6, 108.4, t));
    const k = clamp01(((t - 104.0) - 0.55 * clamp01((t - 106.2) / 2.2) * 2.2) / 5.3); const w = walker([[12.8, 9.6], [20.0, 17.0]], k, {});
    w.pose = walkPose((k * 10.3) / STRIDE, 1 - lookB * 0.75); w.headYaw = 2.3 * lookB;
    const leave = smoothstep(108.6, 110.6, t);
    return { cam: { pos: lv(G(1.5, 7.5, 1.6), G(2.4, 8.4, 1.6), ease(u)), look: G(w.x, w.z, 1.25), fov: 34 }, tod: lerpTOD(tod('dawn', { fogD: 0.008, sunEl: 3 }), tod('night', { fogD: 0.03 }), leave),
      grade: Object.assign(gmix(GFt(t, { sat: 0.5 }), GN, leave), { fade: 0.6 * smoothstep(109.6, 110.6, t) }), state: { logs: false, fire: 0, mist: lin(0.3, 1, leave), wind: 1.2 }, person: w }; });
  // ---------------------------------------------------------- back to the present night
  // AE (110.6 – 113.4): "Şimdi bir düşünün..." drifting through fog
  shot(110.6, 113.4, (u, t) => ({ cam: { pos: lv(G(20, -8, 2.2), G(15, -4, 2.0), u), look: G(0, 4, 3), fov: 44 }, tod: tod('night', { fogD: 0.05 }), grade: Object.assign({}, GN, { fade: 0.6 * fadeIn(t, 110.6, 1.0) }), state: { mist: 1, wind: 1.0 } }));
  // AF (113.4 – 120.6): "Gece yarısı... Torosların ortasında... Etrafınızda kimseden eser yok..." first-person walk through the fog
  { const p = curve([G(30, 4, 1.65), G(26, 9, 1.65), G(22.5, 6.5, 1.65), G(19, 7.5, 1.65)]);
    shot(113.4, 120.6, (u, t) => { const pos = p(u); const bob = Math.abs(Math.sin((t - 113.4) * 3.6)) * 0.04;
      const yaw = -2.3 + 0.35 * smoothstep(115.2, 116.8, t) - 0.35 * smoothstep(116.8, 117.6, t) + 1.05 * Math.sin(clamp01((t - 117.6) / 2.6) * Math.PI) * 0.9;
      const pitch = 0.04 + 0.22 * smoothstep(115.3, 116.2, t) * (1 - smoothstep(116.8, 117.6, t));
      const look = pos.clone().add(V(Math.sin(yaw), Math.sin(pitch), Math.cos(yaw)).multiplyScalar(10));
      return { cam: { pos: pos.add(V(0, bob, 0)).add(handheld(t, 0.03, 1.4)), look, fov: 46 }, tod: tod('night', { fogD: 0.026 }), grade: GN, state: { mist: 0.9, wind: 1.4, fire: 0.2 } }; }); }
  // AG (120.6 – 122.6): "Ve sabaha karşı..." pre-dawn blue over the camp
  shot(120.6, 122.6, (u, t) => ({ cam: { pos: G(28, 4, 1.6).add(handheld(t, 0.012)), look: G(0, 1.5, lin(5.6, 6.0, u)), fov: 30 }, tod: Object.assign(lerpTOD(tod('night', { fogD: 0.014 }), tod('dawn', { fogD: 0.012 }), 0.6 + 0.1 * u), { sunAz: 250, sunGlow: 0.9 }), grade: gmix(GN, { sat: 0.65 }, 0.3), state: { mist: 0.6, fire: 0.05 } }));
  // AH (122.6 – 126.45): "Bir gece önce kendi ellerinizle topladığınız odunlar..." first person, turning slowly toward the woodpile
  const POV = tent.clone().addScaledVector(tf, 5.6).addScaledVector(ts, 1.2);
  shot(122.6, 126.45, (u, t) => { const pos = G(POV.x, POV.z, 1.62); const a0 = Math.atan2(tf.x, tf.z) - 0.25, a1 = Math.atan2(logs.x - pos.x, logs.z - pos.z) - 0.1;
    const yaw = lin(a0, a1, ease(u)); const look = pos.clone().add(V(Math.sin(yaw), -0.18, Math.cos(yaw)).multiplyScalar(10));
    return { cam: { pos: pos.add(handheld(t, 0.02, 1.2)), look, fov: 46 }, tod: lerpTOD(tod('night', { fogD: 0.016 }), tod('dawn', { fogD: 0.012 }), 0.8), grade: gmix(GN, { sat: 0.6 }, 0.3), state: { mist: 0.6, logs: false, fire: 0.0 } }; });
  // AI (126.45 – 128.95): "Yok!" the empty ground, hard push
  shot(126.45, 128.95, (u, t) => { const k = easeOut(clamp01((t - 126.47) / 0.3)); const pp = lv(POV, logs.clone().addScaledVector(ts, 1.6).addScaledVector(tf, 1.6), lin(0.0, 0.5, k)); const pos = G(pp.x, pp.z, lin(1.62, 1.5, k));
    return { cam: { pos: pos.add(handheld(t, 0.025, 1.6)), look: G(logs.x, logs.z, 0), fov: lin(40, 32, k) }, tod: Object.assign(lerpTOD(tod('night', { fogD: 0.016 }), tod('dawn', { fogD: 0.012 }), 0.85), { exp: 1.8 }),
      grade: Object.assign(gmix(GN, { sat: 0.6 }, 0.3), { flash: [0.1, 0.1, 0.12].map(c => c * fadeIn(t, 126.47, 0.3)) }), state: { mist: 0.6, logs: false, fire: 0 } }; });
  // AJ (128.95 – 133.9): "Peki... Sizce o odunları kim aldı?" a slow push into the darkest gap between the junipers
  shot(128.95, 133.9, (u, t) => ({ cam: { pos: lv(G(3.5, 12, 1.5), G(1.6, 6.5, 1.55), u), look: G(-1.0, -3, 1.4), fov: lin(36, 31, u) }, tod: tod('night', { fogD: 0.04 }), grade: Object.assign({}, GN, { exp: 0.85, vig: 0.7 }), state: { mist: 1, wind: 0.5 } }));
  // AK (133.9 – end): "Belki de Kanlı Ardıç'ın sırrı... Hâlâ çözülmeyi bekliyordur!" final wide under the moon; titles; fade out
  const MOON_END = V(-0.16, 0.5, -0.82).normalize();
  { const p = curve([G(6, 22, 1.8), G(8, 30, 4.5), G(11, 40, 9)]);
    shot(133.9, 147, (u, t) => { const k = clamp01((t - 133.9) / 9.5);
      return { cam: { pos: p(ease(k)), look: lv(G(-1, 0, 7.5), G(-3, -12, 21), ease(k)), fov: lin(38, 44, ease(k)) }, tod: tod('night', { fogD: 0.012 }),
        grade: Object.assign({}, GN, { fade: Math.max(fadeIn(t, 133.9, 0.8) * 0.8, smoothstep(144.6, 146.5, t)) }), state: { mist: 0.7, wind: 1.2, starRot: (t - 133.9) * 0.01, moonDir: MOON_END, moonScale: 1.3 },
        overlay: { title: { a: smoothstep(139.9, 141.4, t) * (1 - smoothstep(144.6, 146.2, t)), tf: 'translateY(-60px)' }, note: { a: smoothstep(141.2, 142.4, t) * (1 - smoothstep(144.6, 146.2, t)) } } }; }); }

  const q = new URLSearchParams(location.search);
  return {
    list,
    at(t) {
      let s = null; for (const sh of list) if (t >= sh.t0 && t < sh.t1) { s = sh; } if (!s) s = list[list.length - 1];
      const u = (t - s.t0) / (s.t1 - s.t0); const r = s.fn(u, t) || {};
      if (r.black) return Object.assign({ cam: { pos: V(0, 10, 30), look: V(0, 0, 0) }, tod: TOD.night, grade: { fade: 1 }, state: {}, person: null }, r);
      r.state = r.state || {}; r.person = r.person || null; return r;
    },
  };
}
