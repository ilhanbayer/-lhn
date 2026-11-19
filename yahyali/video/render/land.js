'use strict';
/* Procedural illustrated landscapes: layered canvases with parallax + animated water, mist, birds, smoke, clouds.
   Uses globals from scene.js (W, H, ctx, rng, lerp, clamp, seg, E, SPRITE). */

// ---------------------------------------------------------------- utils
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function hex2rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function rgba(h, a) { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; }
function mixHex(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join(''); }
function makeNoise(seed) {
  const r = rng(seed), v = new Float32Array(1024); for (let i = 0; i < 1024; i++) v[i] = r();
  return x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return v[i & 1023] * (1 - u) + v[(i + 1) & 1023] * u; };
}
function fbm(n, x, o = 5) { let s = 0, a = 1, nr = 0, f = 1; for (let k = 0; k < o; k++) { s += a * n(x * f + k * 31.7); nr += a; a *= 0.5; f *= 2.01; } return s / nr; }
function ridgedN(n, x, o = 5) { let s = 0, a = 1, nr = 0, f = 1; for (let k = 0; k < o; k++) { const v = 1 - Math.abs(2 * n(x * f + k * 19.1) - 1); s += a * v * v; nr += a; a *= 0.5; f *= 2.03; } return s / nr; }
let LA = 1; // alpha of the shot currently being drawn (animations multiply by it)

// cloud sprite
let CLOUD = null;
function cloudSprite() {
  if (CLOUD) return CLOUD; const [c, g] = mk(640, 240); const r = rng(808);
  for (let k = 0; k < 26; k++) {
    const x = 90 + r() * 460, y = 120 + (r() - 0.5) * 60 - Math.sin((x - 90) / 460 * Math.PI) * 30, s = 40 + r() * 70;
    const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - s, y - s, 2 * s, 2 * s);
  }
  CLOUD = c; return c;
}

// ---------------------------------------------------------------- layer painters
function L_sky(LW, LH, o) {
  const [c, g] = mk(LW, LH); const gr = g.createLinearGradient(0, 0, 0, LH * (o.span || 0.75));
  o.stops.forEach(([p, col]) => gr.addColorStop(p, col)); g.fillStyle = gr; g.fillRect(0, 0, LW, LH);
  if (o.sun) {
    const [sx, sy, sr, col] = o.sun; const sg = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 9);
    sg.addColorStop(0, rgba(col, 1)); sg.addColorStop(0.11, rgba(col, 0.95)); sg.addColorStop(0.14, rgba(col, 0.5)); sg.addColorStop(0.45, rgba(col, 0.14)); sg.addColorStop(1, rgba(col, 0));
    g.fillStyle = sg; g.fillRect(0, 0, LW, LH);
  }
  return { c, depth: o.depth ?? 0.04, anim: o.anim };
}
function ridgeLine(LW, o) {
  const n = makeNoise(o.seed), step = 4, ys = [];
  for (let x = 0; x <= LW; x += step) {
    const u = x * o.freq; const h = lerp(fbm(n, u, 6), ridgedN(n, u, 6), o.sharp ?? 0.55);
    let y = o.base - o.amp * Math.pow(h, o.pow ?? 1.15);
    if (o.peaks) for (const [px, pw, ph] of o.peaks) { const d = (x - px) / pw; y -= ph * Math.exp(-d * d) * (0.75 + 0.5 * h); }
    ys.push(y);
  }
  return { ys, step };
}
function L_range(LW, LH, o) {
  const [c, g] = mk(LW, LH); const { ys, step } = ridgeLine(LW, o); const minY = Math.min(...ys);
  const path = new Path2D(); path.moveTo(0, LH); ys.forEach((y, i) => path.lineTo(i * step, y)); path.lineTo(LW, LH); path.closePath();
  const gr = g.createLinearGradient(0, minY, 0, o.base + 80); gr.addColorStop(0, o.top); gr.addColorStop(1, o.bot); g.fillStyle = gr; g.fill(path);
  g.save(); g.clip(path);
  const r = rng(o.seed + 5), L = o.light ?? -1;
  // smoothed slope -> soft facet shading (lit faces get a warm lift, shadow faces darken)
  const sm = ys.map((_, i) => { let a = 0, k = 0; for (let j = -4; j <= 4; j++) { const q = i + j; if (q >= 0 && q < ys.length - 1) { a += ys[q + 1] - ys[q]; k++; } } return a / k; });
  // snow caps that follow the ridge, with a jagged lower edge
  if (o.snow) {
    const n2 = makeNoise(o.seed + 77), snowLine = minY + o.snow, sp = new Path2D();
    sp.moveTo(0, ys[0]); ys.forEach((y, i) => sp.lineTo(i * step, y));
    for (let i = ys.length - 1; i >= 0; i--) { const above = Math.max(0, snowLine - ys[i]); const d = above > 0 ? above * (0.35 + 0.65 * fbm(n2, i * step / 45, 4)) + 4 : 0; sp.lineTo(i * step, ys[i] + d); }
    sp.closePath(); const sg = g.createLinearGradient(0, minY, 0, snowLine); sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, o.snowCol || '#e3ebf2');
    g.globalAlpha = o.snowA ?? 0.95; g.fillStyle = sg; g.fill(sp); g.globalAlpha = 1;
  }
  // facet shading: find prominent peaks/valleys, then shade each peak's shadow face and lift its lit face
  const sy = ys.map((_, i) => { let a = 0, k = 0; for (let j = -5; j <= 5; j++) { const q = i + j; if (q >= 0 && q < ys.length) { a += ys[q]; k++; } } return a / k; });
  const ext = []; let dir = 0;
  for (let i = 1; i < sy.length; i++) { const d = Math.sign(sy[i] - sy[i - 1]); if (!d) continue; if (dir && d !== dir) ext.push([i - 1, dir < 0 ? 1 : -1]); dir = d; }
  const kept = [[0, ys[0] > ys[1] ? -1 : 1]];
  for (const e of ext) { const le = kept[kept.length - 1]; if (e[1] === le[1]) { if ((e[1] === 1 && sy[e[0]] < sy[le[0]]) || (e[1] === -1 && sy[e[0]] > sy[le[0]])) kept[kept.length - 1] = e; } else if (Math.abs(sy[e[0]] - sy[le[0]]) >= (o.prom ?? 22)) kept.push(e); }
  kept.push([ys.length - 1, -kept[kept.length - 1][1]]);
  const [shc, shg] = mk(LW, LH); const sa = 0.30 * (o.shade ?? 1), la = 0.12 * (o.shade ?? 1), lc = hex2rgb(o.rimCol || '#fff1dc');
  for (let k = 0; k < kept.length; k++) {
    if (kept[k][1] !== 1) continue; const ip = kept[k][0], xp = ip * step, yp = ys[ip];
    for (const side of [1, -1]) {
      const nb = kept[k + side]; if (!nb) continue; const iv = nb[0], xv = iv * step, yv = ys[iv];
      const sx = xp + (xv - xp) * 0.3, syb = Math.min(LH, yv + (o.base - yv) * 0.55 + 80);
      const face = new Path2D(); face.moveTo(xp, yp);
      for (let i = ip; side > 0 ? i <= iv : i >= iv; i += side) face.lineTo(i * step, ys[i]);
      face.lineTo(lerp(xv, sx, 0.55), lerp(yv, syb, 0.85)); face.lineTo(sx, syb); face.closePath();
      const dark = side === -L;
      const fg = shg.createLinearGradient(0, yp, 0, syb);
      if (dark) { fg.addColorStop(0, `rgba(14,18,34,${sa})`); fg.addColorStop(1, 'rgba(14,18,34,0.03)'); }
      else { fg.addColorStop(0, `rgba(${lc[0]},${lc[1]},${lc[2]},${la})`); fg.addColorStop(1, `rgba(${lc[0]},${lc[1]},${lc[2]},0)`); }
      shg.fillStyle = fg; shg.fill(face);
    }
  }
  g.filter = 'blur(2.5px)'; g.drawImage(shc, 0, 0); g.filter = 'none';
  // gully texture oriented along the local fall line
  if (o.rock) for (let k = 0; k < o.rock; k++) {
    const i = Math.floor(r() * (ys.length - 1)), x = i * step, y = ys[i] + 6 + r() * Math.max(10, (o.base - ys[i]) * 0.8), len = 12 + r() * 46, ang = Math.atan(sm[i] / step) * 0.5;
    g.strokeStyle = r() < 0.45 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'; g.lineWidth = 1 + r() * 1.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(ang) * len + (r() - 0.5) * 6, y + Math.cos(ang) * len); g.stroke();
  }
  if (o.haze) { const hg = g.createLinearGradient(0, o.base - (o.hazeH ?? 160), 0, o.base + 120); hg.addColorStop(0, rgba(o.haze, 0)); hg.addColorStop(1, rgba(o.haze, o.hazeA ?? 0.6)); g.fillStyle = hg; g.fillRect(0, 0, LW, LH); }
  g.restore();
  if (o.rim) { g.save(); g.strokeStyle = rgba(o.rimCol || '#fff1dc', o.rim); g.lineWidth = o.rimW || 2; g.beginPath(); ys.forEach((y, i) => i ? g.lineTo(i * step, y) : g.moveTo(0, y)); g.stroke(); g.restore(); }
  if (o.trees) trees(g, ys, step, o.trees);
  return { c, depth: o.depth, ys, step, anim: o.anim };
}

function trees(g, ys, step, o) {
  const r = rng(o.seed || 7);
  for (let i = 0; i < ys.length; i++) {
    if (r() > o.density) continue;
    const x = i * step + (r() - 0.5) * step * 2, y = ys[i] + (o.dy || 0) + r() * (o.jitter || 0), h = o.h[0] + r() * (o.h[1] - o.h[0]);
    g.fillStyle = Array.isArray(o.color) ? o.color[Math.floor(r() * o.color.length)] : o.color;
    if (o.type === 'pine') { for (let k = 0; k < 3; k++) { const hh = h * (1 - k * 0.22), yy = y - k * h * 0.22; g.beginPath(); g.moveTo(x, yy - hh * 0.7); g.lineTo(x + hh * 0.26, yy); g.lineTo(x - hh * 0.26, yy); g.closePath(); g.fill(); } }
    else if (o.type === 'poplar') { g.beginPath(); g.ellipse(x, y - h * 0.5, h * 0.11, h * 0.5, 0, 0, 7); g.fill(); }
    else { g.beginPath(); g.ellipse(x, y - h * 0.45, h * 0.42, h * 0.38, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(x + h * 0.22, y - h * 0.32, h * 0.3, h * 0.28, 0, 0, 7); g.fill(); }
  }
}
// limestone cliff with waterfalls gushing from the rock face
function L_cliff(LW, LH, o) {
  const [c, g] = mk(LW, LH); const n = makeNoise(o.seed), step = 4, ys = [];
  for (let x = 0; x <= LW; x += step) ys.push(o.top + o.topAmp * (fbm(n, x / 210, 5) - 0.5) * 2 + (o.bowl || 0) * Math.pow((x - LW / 2) / (LW / 2), 2));
  const path = new Path2D(); path.moveTo(0, LH); ys.forEach((y, i) => path.lineTo(i * step, y)); path.lineTo(LW, LH); path.closePath();
  const gr = g.createLinearGradient(0, o.top - 120, 0, o.bottom); gr.addColorStop(0, o.rock[0]); gr.addColorStop(1, o.rock[1]); g.fillStyle = gr; g.fill(path);
  g.save(); g.clip(path); const r = rng(o.seed + 1);
  // large soft tonal patches (rock masses)
  const [pc, pg] = mk(LW, LH);
  for (let k = 0; k < 70; k++) { const x = r() * LW, y = o.top + r() * (o.bottom - o.top), s = 60 + r() * 220; pg.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,240,220,0.07)'; pg.beginPath(); pg.ellipse(x, y, s * 0.6, s, 0, 0, 7); pg.fill(); }
  g.filter = 'blur(30px)'; g.drawImage(pc, 0, 0); g.filter = 'none';
  // vertical limestone fluting
  for (let k = 0; k < 650; k++) {
    const x = r() * LW, y = o.top - 60 + r() * (o.bottom - o.top + 60), len = 40 + r() * 260;
    g.strokeStyle = r() < 0.6 ? 'rgba(0,0,0,0.075)' : 'rgba(255,246,232,0.055)'; g.lineWidth = 1.5 + r() * 4;
    g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + (r() - .5) * 12, y + len * 0.3, x + (r() - .5) * 12, y + len * 0.7, x + (r() - .5) * 18, y + len); g.stroke();
  }
  // irregular ledges
  for (let k = 0; k < 36; k++) {
    const x = r() * LW, y = o.top + 30 + r() * (o.bottom - o.top - 60), w = 80 + r() * 320, b = (r() - 0.5) * 20;
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 2 + r() * 3; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y + b, x + w, y + (r() - 0.5) * 10); g.stroke();
    g.strokeStyle = 'rgba(255,240,220,0.08)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 3); g.quadraticCurveTo(x + w / 2, y + b - 3, x + w, y - 3); g.stroke();
  }
  // moss / vegetation clusters on ledges
  if (o.moss) {
    const [mc, mg] = mk(LW, LH);
    for (let k = 0; k < o.moss / 4; k++) {
      const cx = r() * LW, cy = o.top + r() * (o.bottom - o.top), nb = 5 + Math.floor(r() * 12);
      for (let j = 0; j < nb; j++) { const x = cx + (r() - 0.5) * 80, y = cy + (r() - 0.5) * 18 + j * 1.5, s = 2.5 + r() * 9; mg.fillStyle = rgba(o.mossCol, 0.25 + r() * 0.45); mg.beginPath(); mg.ellipse(x, y, s * 1.7, s * 0.75, 0, 0, 7); mg.fill(); }
      if (r() < 0.35) { mg.strokeStyle = rgba(o.mossCol, 0.35); mg.lineWidth = 2; for (let j = 0; j < 4; j++) { const x = cx + (r() - 0.5) * 60; mg.beginPath(); mg.moveTo(x, cy); mg.lineTo(x + (r() - 0.5) * 6, cy + 20 + r() * 50); mg.stroke(); } }
    }
    g.filter = 'blur(1.2px)'; g.drawImage(mc, 0, 0); g.filter = 'none';
  }
  // wet rock behind each fall (soft, tapered) + dark source opening
  g.filter = 'blur(18px)';
  for (const f of o.falls) { const sp = f.spread ?? 0.22; g.fillStyle = o.frozen ? 'rgba(200,220,235,0.25)' : 'rgba(12,20,20,0.42)'; g.beginPath(); g.moveTo(f.x - f.w * 0.6, f.y); g.lineTo(f.x + f.w * 0.6, f.y); g.lineTo(f.x + f.w * (1.0 + sp * 2), f.y + f.len); g.lineTo(f.x - f.w * (1.0 + sp * 2), f.y + f.len); g.closePath(); g.fill(); }
  g.filter = 'none';
  g.filter = 'blur(4px)'; for (const f of o.falls) { g.fillStyle = 'rgba(8,10,10,0.5)'; g.beginPath(); g.ellipse(f.x, f.y + 6, f.w * 0.32, Math.max(4, f.w * 0.09), 0, 0, 7); g.fill(); } g.filter = 'none';
  const sh = g.createLinearGradient(0, 0, LW, 0); sh.addColorStop(0, 'rgba(0,0,0,0.28)'); sh.addColorStop(0.45, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.22)'); g.fillStyle = sh; g.fillRect(0, 0, LW, LH);
  const tg = g.createLinearGradient(0, o.top - 60, 0, o.top + 160); tg.addColorStop(0, 'rgba(255,240,215,0.18)'); tg.addColorStop(1, 'rgba(255,240,215,0)'); g.fillStyle = tg; g.fillRect(0, 0, LW, LH);
  g.restore();
  if (o.frozen) for (const f of o.falls) drawIce(g, f);
  if (o.topTrees) trees(g, ys, step, o.topTrees);
  if (o.pool) {
    const pg2 = g.createLinearGradient(0, o.bottom - 20, 0, LH); pg2.addColorStop(0, o.pool[0]); pg2.addColorStop(1, o.pool[1]);
    g.fillStyle = pg2; g.beginPath(); g.moveTo(0, o.bottom + 10); for (let x = 0; x <= LW; x += 40) g.lineTo(x, o.bottom + 6 * Math.sin(x / 90)); g.lineTo(LW, LH); g.lineTo(0, LH); g.closePath(); g.fill();
  }
  if (o.bushes) { const rb = rng(o.seed + 3); for (let k = 0; k < o.bushes; k++) { const x = rb() * LW, y = o.bottom + rb() * 50 - 14, s = 14 + rb() * 40; g.fillStyle = rb() < 0.5 ? o.bushCol[0] : o.bushCol[1]; g.beginPath(); g.ellipse(x, y, s * 1.5, s, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(x + s * 0.9, y + s * 0.2, s, s * 0.7, 0, 0, 7); g.fill(); } }
  return { c, depth: o.depth, anim: t => { if (!o.frozen) drawFalls(o.falls, t, o); if (o.pool) poolShimmer(t, o, LW); } };
}
function fallPath(f, s, t) {
  const n = f._n || (f._n = makeNoise((f.seed || 1) * 13 + 5)), N = 26, Lp = [], Rp = [], sp = f.spread ?? 0.22;
  for (let i = 0; i <= N; i++) {
    const u = i / N, y = f.y + u * f.len, grow = 0.4 + 0.6 * Math.min(1, u * 5);
    const hw = f.w * 0.5 * s.w * grow * (1 + sp * u * 2);
    const cx = f.x + s.off * f.w * (0.6 + u) + (n(u * 2.5 + s.off * 9 + 3) - 0.5) * f.w * 0.3 * u;
    const wl = (n(u * 7 + t * 0.9 + s.off * 5) - 0.5) * f.w * 0.16 * (0.3 + u), wr = (n(u * 7 + t * 0.9 + s.off * 5 + 40) - 0.5) * f.w * 0.16 * (0.3 + u);
    Lp.push([cx - hw + wl, y]); Rp.push([cx + hw + wr, y]);
  }
  const p = new Path2D(); p.moveTo(Lp[0][0], Lp[0][1]); for (const q of Lp) p.lineTo(q[0], q[1]); for (let i = Rp.length - 1; i >= 0; i--) p.lineTo(Rp[i][0], Rp[i][1]); p.closePath();
  return p;
}
function strandsOf(f) { return f.strands || (f.w > 60 ? [{ off: -0.28, w: 0.62, a: 0.95 }, { off: 0.26, w: 0.6, a: 0.9 }, { off: 0.0, w: 0.4, a: 0.75 }] : [{ off: 0, w: 1, a: 1 }, { off: 0.12, w: 0.45, a: 0.55 }]); }
function drawIce(g, f) {
  for (const s of strandsOf(f)) {
    const p = fallPath(f, s, 0); const gr = g.createLinearGradient(0, f.y, 0, f.y + f.len); gr.addColorStop(0, 'rgba(250,253,255,0.95)'); gr.addColorStop(1, 'rgba(178,208,228,0.85)');
    g.save(); g.globalAlpha = s.a; g.fillStyle = gr; g.fill(p); g.clip(p); const r = rng(f.seed || 3);
    for (let k = 0; k < 26; k++) { const x = f.x - f.w + r() * f.w * 2; g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.7)' : 'rgba(120,160,190,0.35)'; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(x, f.y); g.lineTo(x + (r() - 0.5) * 8, f.y + f.len); g.stroke(); }
    g.restore();
  }
  const r = rng((f.seed || 3) + 9); g.fillStyle = 'rgba(235,245,252,0.9)';
  for (let k = 0; k < 14; k++) { const x = f.x - f.w * 1.3 + r() * f.w * 2.6, y = f.y + r() * f.len * 0.8, h = 14 + r() * 40, w = 3 + r() * 5; g.beginPath(); g.moveTo(x - w, y); g.lineTo(x + w, y); g.lineTo(x, y + h); g.closePath(); g.fill(); }
}

function drawFalls(falls, t, o) {
  for (const f of falls) {
    const fa = (f.alpha ?? 1) * (o.fallAlpha ? o.fallAlpha(t) : 1) * LA; if (fa <= 0.01) continue;
    const v0 = f.speed || 280;
    for (const s of strandsOf(f)) {
      const p = fallPath(f, s, t);
      ctx.save(); ctx.globalAlpha = fa * s.a;
      const bg = ctx.createLinearGradient(0, f.y, 0, f.y + f.len); bg.addColorStop(0, 'rgba(248,253,254,0.96)'); bg.addColorStop(0.5, 'rgba(218,238,244,0.80)'); bg.addColorStop(1, 'rgba(238,249,251,0.62)');
      ctx.fillStyle = bg; ctx.fill(p); ctx.clip(p);
      const r = rng((f.seed || 1) * 7 + Math.round(s.off * 100));
      for (let k = 0; k < (f.streaks || 14); k++) {
        const u = r(), xs = f.x + (u - 0.5) * f.w * 0.6, xe = f.x + (u - 0.5) * f.w * 1.9, v = v0 * (0.75 + 0.5 * r());
        ctx.strokeStyle = r() < 0.6 ? 'rgba(255,255,255,0.9)' : 'rgba(140,182,196,0.5)'; ctx.lineWidth = 1 + r() * Math.min(4.5, Math.max(1.5, f.w / 22)); ctx.lineCap = 'round';
        ctx.setLineDash([24 + r() * 80, 10 + r() * 46]); ctx.lineDashOffset = -(t * v + r() * 700);
        ctx.beginPath(); ctx.moveTo(xs, f.y); ctx.lineTo(xe, f.y + f.len); ctx.stroke();
      }
      ctx.setLineDash([]);
      for (let j = 0; j < 7; j++) { // clumps of water travelling down
        const y = f.y + ((t * v0 * 0.85 + j * f.len / 7 + s.off * 300) % f.len), bh = 14 + f.w * 0.2;
        const cg = ctx.createLinearGradient(0, y - bh, 0, y + bh); cg.addColorStop(0, 'rgba(255,255,255,0)'); cg.addColorStop(0.5, 'rgba(255,255,255,0.22)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = cg; ctx.fillRect(f.x - f.w * 2, y - bh, f.w * 4, bh * 2);
      }
      ctx.restore();
    }
    const r2 = rng(Math.round(f.x));
    for (let k = 0; k < 12; k++) {
      const ph = (t * 0.5 + k / 12) % 1, sx = f.x + (r2() - 0.5) * f.w * 3, sy = f.y + f.len - ph * f.len * 0.2, sz = f.w * (0.5 + ph * 1.6) + 14;
      ctx.globalAlpha = (1 - ph) * 0.36 * fa; ctx.drawImage(SPRITE, sx - sz, sy - sz, 2 * sz, 2 * sz);
    }
    ctx.globalAlpha = 1;
  }
}

function poolShimmer(t, o, LW) {
  ctx.save(); ctx.globalAlpha = 0.5 * LA; ctx.strokeStyle = 'rgba(235,252,255,0.7)'; ctx.lineWidth = 2; const r = rng(55);
  for (let k = 0; k < 60; k++) { const y = o.bottom + 20 + r() * 160, x = ((r() * LW + t * (20 + r() * 30)) % LW), l = 20 + r() * 60; ctx.globalAlpha = LA * (0.2 + 0.4 * Math.abs(Math.sin(t * 2 + k))); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y); ctx.stroke(); }
  ctx.restore();
}
// winding river (centreline points far->near with widths)
function riverGeom(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < 24; k++) {
      const t = k / 24, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), f(p0[2], p1[2], p2[2], p3[2])]);
    }
  }
  out.push(pts[pts.length - 1]);
  const L = [], R = [];
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    L.push([out[i][0] + nx * out[i][2] / 2, out[i][1] + ny * out[i][2] / 2]); R.push([out[i][0] - nx * out[i][2] / 2, out[i][1] - ny * out[i][2] / 2]);
  }
  return { c: out, L, R };
}
function L_river(LW, LH, o) {
  const [c, g] = mk(LW, LH); const G = riverGeom(o.pts);
  if (o.ground) { const gg = g.createLinearGradient(0, o.groundTop, 0, LH); gg.addColorStop(0, o.ground[0]); gg.addColorStop(1, o.ground[1]); g.fillStyle = gg; g.beginPath(); g.moveTo(0, LH); for (let x = 0; x <= LW; x += 20) g.lineTo(x, o.groundTop + 14 * Math.sin(x / 150)); g.lineTo(LW, LH); g.closePath(); g.fill(); }
  if (o.fields) { const r = rng(o.seed || 4); for (let k = 0; k < o.fields; k++) { const y = o.groundTop + 30 + Math.pow(r(), 1.6) * (LH - o.groundTop - 60), x = r() * LW, w = 120 + r() * 380 * (y / LH), h = 10 + 40 * (y / LH); g.fillStyle = o.fieldCols[Math.floor(r() * o.fieldCols.length)]; g.globalAlpha = 0.55; g.beginPath(); g.ellipse(x, y, w, h, 0, 0, 7); g.fill(); } g.globalAlpha = 1; }
  // banks
  g.strokeStyle = o.bank; g.lineWidth = 14; g.lineJoin = 'round';
  for (const side of [G.L, G.R]) { g.beginPath(); side.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); }
  const body = new Path2D(); G.L.forEach((p, i) => i ? body.lineTo(p[0], p[1]) : body.moveTo(p[0], p[1])); for (let i = G.R.length - 1; i >= 0; i--) body.lineTo(G.R[i][0], G.R[i][1]); body.closePath();
  const wg = g.createLinearGradient(0, o.pts[0][1], 0, o.pts[o.pts.length - 1][1]); wg.addColorStop(0, o.water[0]); wg.addColorStop(1, o.water[1]); g.fillStyle = wg; g.fill(body);
  if (o.trees) { const r = rng(9); for (let i = 0; i < G.c.length; i += 3) { if (r() > o.trees.density) continue; const side = r() < 0.5 ? G.L : G.R, p = side[i], s = o.trees.h[0] + (o.trees.h[1] - o.trees.h[0]) * (p[1] / LH); g.fillStyle = o.trees.color[Math.floor(r() * o.trees.color.length)]; g.beginPath(); if (o.trees.type === 'poplar') g.ellipse(p[0] + (r() - .5) * 30, p[1] - s * 0.5, s * 0.11, s * 0.5, 0, 0, 7); else g.ellipse(p[0] + (r() - .5) * 40, p[1] - s * 0.35, s * 0.4, s * 0.35, 0, 0, 7); g.fill(); } }
  return {
    c, depth: o.depth, anim: t => {
      ctx.save(); ctx.clip(body); ctx.lineCap = 'round'; const r = rng(31);
      for (let k = 0; k < 26; k++) {
        const off = (r() - 0.5) * 0.8; ctx.strokeStyle = `rgba(240,252,255,${0.18 + r() * 0.35})`; ctx.lineWidth = 1.5 + r() * 3;
        ctx.setLineDash([10 + r() * 50, 30 + r() * 90]); ctx.lineDashOffset = -(t * (o.speed || 90) * (0.7 + r() * 0.6) + r() * 400);
        ctx.globalAlpha = LA; ctx.beginPath(); G.c.forEach((p, i) => { const q = [lerp(G.L[i][0], G.R[i][0], 0.5 + off), lerp(G.L[i][1], G.R[i][1], 0.5 + off)]; i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke();
      }
      ctx.restore();
    }
  };
}
// canyon wall (left or right side)
function L_canyon(LW, LH, o) {
  const [c, g] = mk(LW, LH); const n = makeNoise(o.seed), pts = [];
  for (let y = 0; y <= LH; y += 6) { const u = y / LH; const x = (o.side < 0 ? o.edge : LW - o.edge) + o.side * (o.slope * (1 - u) * -1) + o.side * -1 * 0 + (fbm(n, y / 140, 5) - 0.5) * o.rough + (o.side < 0 ? 1 : -1) * o.bulge * Math.sin(u * Math.PI); pts.push([x, y]); }
  const path = new Path2D(); if (o.side < 0) { path.moveTo(0, 0); pts.forEach(p => path.lineTo(p[0], p[1])); path.lineTo(0, LH); } else { path.moveTo(LW, 0); pts.forEach(p => path.lineTo(p[0], p[1])); path.lineTo(LW, LH); } path.closePath();
  const gr = g.createLinearGradient(o.side < 0 ? 0 : LW, 0, o.side < 0 ? o.edge : LW - o.edge, 0); gr.addColorStop(0, o.cols[1]); gr.addColorStop(1, o.cols[0]); g.fillStyle = gr; g.fill(path);
  g.save(); g.clip(path); const r = rng(o.seed + 2);
  for (let k = 0; k < 140; k++) { const y = r() * LH, h = 3 + r() * 16; g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,230,200,0.10)'; g.fillRect(0, y, LW, h); } // strata
  for (let k = 0; k < 500; k++) { const x = r() * LW, y = r() * LH, l = 20 + r() * 120; g.strokeStyle = r() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,235,210,0.07)'; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 10, y + l); g.stroke(); }
  for (let k = 0; k < (o.shrubs || 0); k++) { const y = r() * LH, p = pts[Math.min(pts.length - 1, Math.round(y / 6))], x = p[0] - o.side * (10 + r() * 140), s = 6 + r() * 18; g.fillStyle = rgba(o.shrubCol, 0.6 + r() * 0.3); g.beginPath(); g.ellipse(x, y, s * 1.4, s, 0, 0, 7); g.fill(); }
  const sg = g.createLinearGradient(0, 0, 0, LH); sg.addColorStop(0, 'rgba(255,220,170,0.12)'); sg.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = sg; g.fillRect(0, 0, LW, LH);
  g.restore();
  return { c, depth: o.depth };
}
// small town at the mountain foot
function L_town(LW, LH, o) {
  const [c, g] = mk(LW, LH); const n = makeNoise(o.seed); const r = rng(o.seed + 1);
  const baseY = x => o.base + (fbm(n, x / 300, 3) - 0.5) * 40;
  const gg = g.createLinearGradient(0, o.base - 40, 0, LH); gg.addColorStop(0, o.ground[0]); gg.addColorStop(1, o.ground[1]); g.fillStyle = gg;
  g.beginPath(); g.moveTo(0, LH); for (let x = 0; x <= LW; x += 10) g.lineTo(x, baseY(x)); g.lineTo(LW, LH); g.closePath(); g.fill();
  const items = [];
  for (let k = 0; k < o.houses; k++) { const x = o.x0 + Math.pow(r(), 0.9) * (o.x1 - o.x0), y = baseY(x) + 10 + r() * o.spread; items.push({ k: 'h', x, y, w: 26 + r() * 46, h: 20 + r() * 26, c: o.walls[Math.floor(r() * o.walls.length)], roof: o.roofs[Math.floor(r() * o.roofs.length)], flat: r() < 0.35 }); }
  for (let k = 0; k < o.poplars; k++) { const x = o.x0 - 100 + r() * (o.x1 - o.x0 + 200), y = baseY(x) + 6 + r() * o.spread; items.push({ k: 'p', x, y, h: 70 + r() * 90, c: o.treeCols[Math.floor(r() * o.treeCols.length)] }); }
  for (let k = 0; k < (o.bushes || 0); k++) { const x = r() * LW, y = baseY(x) + r() * o.spread * 1.3; items.push({ k: 'b', x, y, h: 26 + r() * 40, c: o.treeCols[Math.floor(r() * o.treeCols.length)] }); }
  if (o.mosque) items.push({ k: 'm', x: o.mosque[0], y: baseY(o.mosque[0]) + o.mosque[1] });
  items.sort((a, b) => a.y - b.y);
  const windows = [];
  for (const it of items) {
    if (it.k === 'h') {
      g.fillStyle = it.c; g.fillRect(it.x - it.w / 2, it.y - it.h, it.w, it.h);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(it.x + it.w * 0.1, it.y - it.h, it.w * 0.4, it.h);
      g.fillStyle = it.roof; g.beginPath();
      if (it.flat) { g.rect(it.x - it.w / 2 - 3, it.y - it.h - 5, it.w + 6, 6); } else { g.moveTo(it.x - it.w / 2 - 5, it.y - it.h); g.lineTo(it.x - it.w * 0.2, it.y - it.h - it.h * 0.55); g.lineTo(it.x + it.w * 0.25, it.y - it.h - it.h * 0.55); g.lineTo(it.x + it.w / 2 + 5, it.y - it.h); g.closePath(); }
      g.fill();
      g.fillStyle = 'rgba(40,32,28,0.55)'; for (let j = 0; j < Math.floor(it.w / 16); j++) { const wx = it.x - it.w / 2 + 6 + j * 16, wy = it.y - it.h * 0.65; g.fillRect(wx, wy, 6, 8); windows.push([wx + 3, wy + 4]); }
    } else if (it.k === 'p') { g.fillStyle = it.c; g.beginPath(); g.ellipse(it.x, it.y - it.h * 0.5, it.h * 0.1, it.h * 0.5, 0, 0, 7); g.fill(); }
    else if (it.k === 'b') { g.fillStyle = it.c; g.beginPath(); g.ellipse(it.x, it.y - it.h * 0.4, it.h * 0.5, it.h * 0.4, 0, 0, 7); g.fill(); }
    else if (it.k === 'm') {
      const x = it.x, y = it.y; g.fillStyle = o.mosqueCol; g.fillRect(x - 70, y - 60, 140, 60); g.beginPath(); g.ellipse(x, y - 60, 46, 40, 0, Math.PI, 0); g.fill();
      g.fillRect(x - 3, y - 112, 6, 12); g.fillRect(x + 92, y - 210, 16, 210); g.beginPath(); g.moveTo(x + 88, y - 210); g.lineTo(x + 100, y - 262); g.lineTo(x + 112, y - 210); g.closePath(); g.fill();
      g.fillRect(x + 86, y - 160, 28, 6); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x - 70, y - 60, 60, 60);
    }
  }
  return { c, depth: o.depth, anim: o.lights ? (t => { const r2 = rng(3); ctx.save(); for (const [x, y] of windows) { if (r2() > 0.45) continue; const a = o.lights(t) * (0.6 + 0.4 * Math.sin(t * 3 + x)) * LA; ctx.globalAlpha = a; ctx.drawImage(SPRITE, x - 9, y - 9, 18, 18); } ctx.restore(); }) : null };
}
// high meadow with goat-hair tents, sheep and smoke
function L_meadow(LW, LH, o) {
  const [c, g] = mk(LW, LH); const n = makeNoise(o.seed), r = rng(o.seed + 2);
  const baseY = x => o.base + (fbm(n, x / 400, 3) - 0.5) * 70;
  const gg = g.createLinearGradient(0, o.base - 50, 0, LH); gg.addColorStop(0, o.grass[0]); gg.addColorStop(1, o.grass[1]); g.fillStyle = gg;
  g.beginPath(); g.moveTo(0, LH); for (let x = 0; x <= LW; x += 10) g.lineTo(x, baseY(x)); g.lineTo(LW, LH); g.closePath(); g.fill();
  for (let k = 0; k < 2600; k++) { const x = r() * LW, y = baseY(x) + 4 + Math.pow(r(), 1.5) * (LH - o.base), l = 3 + 10 * (y / LH); g.strokeStyle = r() < 0.5 ? 'rgba(255,240,190,0.16)' : 'rgba(40,50,20,0.16)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 3, y - l); g.stroke(); }
  for (let k = 0; k < 160; k++) { const x = r() * LW, y = baseY(x) + 10 + r() * (LH - o.base), s = 1.5 + 2.5 * (y / LH); g.fillStyle = ['#f3e9c9', '#e9c25b', '#d97b5a', '#ffffff'][k % 4]; g.globalAlpha = 0.7; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); } g.globalAlpha = 1;
  const smokes = [];
  for (const [x, dy, s] of o.tents) {
    const y = baseY(x) + dy; g.fillStyle = '#1f1a17';
    g.beginPath(); g.moveTo(x - 110 * s, y); g.lineTo(x - 90 * s, y - 42 * s); g.quadraticCurveTo(x - 40 * s, y - 58 * s, x, y - 50 * s); g.quadraticCurveTo(x + 40 * s, y - 58 * s, x + 90 * s, y - 42 * s); g.lineTo(x + 110 * s, y); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.06)'; for (let k = -90; k < 90; k += 14) g.fillRect(x + k * s, y - 45 * s, 2 * s, 45 * s);
    g.fillStyle = '#0d0b0a'; g.fillRect(x - 18 * s, y - 30 * s, 36 * s, 30 * s);
    g.strokeStyle = 'rgba(30,25,20,0.8)'; g.lineWidth = 1.4; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(x + sx * 90 * s, y - 42 * s); g.lineTo(x + sx * 140 * s, y + 4); g.stroke(); }
    smokes.push([x + 30 * s, y - 52 * s, s]);
  }
  for (let k = 0; k < o.sheep; k++) { const x = o.flock[0] + (r() - 0.5) * o.flock[2], y = baseY(x) + o.flock[1] + (r() - 0.5) * 60, s = 1 + (y - o.base) / 600; g.fillStyle = '#efe9dc'; g.beginPath(); g.ellipse(x, y, 9 * s, 6 * s, 0, 0, 7); g.fill(); g.fillStyle = '#3a312a'; g.beginPath(); g.ellipse(x + 9 * s * (r() < 0.5 ? 1 : -1), y - 2 * s, 3 * s, 3 * s, 0, 0, 7); g.fill(); }
  return {
    c, depth: o.depth, anim: t => {
      ctx.save();
      for (const [x, y, s] of smokes) for (let k = 0; k < 16; k++) { const ph = (t * 0.18 + k / 16) % 1, sz = (10 + ph * 70) * s; ctx.globalAlpha = (1 - ph) * 0.22 * LA; ctx.drawImage(SPRITE, x + ph * 90 * s + Math.sin(t + k) * 8 - sz, y - ph * 260 * s - sz, sz * 2, sz * 2); }
      ctx.restore();
    }
  };
}
// band of clouds (sea of clouds / mist layer)
function L_cloudband(LW, LH, o) {
  const [c, g] = mk(LW, LH); const r = rng(o.seed); const cl = cloudSprite();
  for (let k = 0; k < o.n; k++) { const x = r() * LW * 1.1 - 100, y = o.y + (r() - 0.5) * o.h, s = 0.9 + r() * 1.8; g.globalAlpha = o.a * (0.6 + 0.4 * r()); g.drawImage(cl, x - 320 * s, y - 120 * s, 640 * s, 240 * s); }
  g.globalAlpha = 1;
  if (o.tint) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = o.tint; g.fillRect(0, 0, LW, LH); g.globalCompositeOperation = 'source-over'; }
  return { c, depth: o.depth, drift: o.drift || 0 };
}

// ---------------------------------------------------------------- animated helpers in screen space
function birds(t, o) {
  ctx.save(); ctx.strokeStyle = o.color || 'rgba(30,30,35,0.85)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; const r = rng(o.seed || 1);
  for (let i = 0; i < o.n; i++) {
    const dx = (r() - 0.5) * o.spread, dy = (r() - 0.5) * o.spread * 0.4, s = o.size * (0.7 + 0.5 * r());
    const x = o.x + dx + (t - o.t0) * o.vx, y = o.y + dy + (t - o.t0) * (o.vy || 0) + Math.sin(t * 1.3 + i) * 6;
    const f = Math.sin(t * (7 + r() * 3) + i * 1.7);
    ctx.globalAlpha = LA * (o.alpha ?? 1); ctx.beginPath(); ctx.moveTo(x - s, y - f * s * 0.45); ctx.quadraticCurveTo(x - s * 0.45, y - s * 0.25 - f * s * 0.2, x, y); ctx.quadraticCurveTo(x + s * 0.45, y - s * 0.25 - f * s * 0.2, x + s, y - f * s * 0.45); ctx.stroke();
  }
  ctx.restore();
}
function rays(t, x, y, col, a = 0.08, n = 12) {
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.translate(x, y); ctx.rotate(t * 0.03);
  for (let i = 0; i < n; i++) { ctx.rotate(Math.PI * 2 / n); const g = ctx.createLinearGradient(0, 0, 1400, 0); g.addColorStop(0, rgba(col, a * LA)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1500, -60 - 40 * Math.sin(i * 1.7 + t * 0.4)); ctx.lineTo(1500, 60 + 40 * Math.sin(i * 2.3)); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function driftClouds(t, o) {
  const cl = cloudSprite(); ctx.save(); const r = rng(o.seed || 3);
  for (let k = 0; k < o.n; k++) { const s = o.s[0] + r() * (o.s[1] - o.s[0]), x = ((r() * (W + 900) + t * o.v * (0.6 + r() * 0.8)) % (W + 900)) - 450, y = o.y + (r() - 0.5) * o.h; ctx.globalAlpha = LA * o.a * (0.5 + 0.5 * r()); ctx.drawImage(cl, x - 320 * s, y - 120 * s, 640 * s, 240 * s); }
  ctx.restore();
}
function mistBands(t, o) {
  ctx.save(); const r = rng(o.seed || 12);
  for (let k = 0; k < o.n; k++) { const y = o.y + (r() - 0.5) * o.h, s = 300 + r() * 500, x = ((r() * (W + 1200) + t * o.v * (0.5 + r())) % (W + 1200)) - 600; ctx.globalAlpha = LA * o.a * (0.4 + 0.6 * r()); ctx.drawImage(SPRITE, x - s * 1.8, y - s * 0.35, s * 3.6, s * 0.7); }
  ctx.restore();
}

// ---------------------------------------------------------------- scenes
const SCN = {};
SCN.hook_falls = () => {
  const LW = 2400, LH = 1350, falls = [];
  const fx = [540, 760, 950, 1140, 1350, 1560, 1790], fy = [560, 430, 610, 420, 540, 450, 600], fw = [30, 58, 28, 84, 40, 64, 34];
  fx.forEach((x, i) => falls.push({ x, y: fy[i], w: fw[i], len: 1012 - fy[i], speed: 300 + i * 20, streaks: 16, seed: 11 + i }));
  return {
    LW, LH, layers: [
      L_sky(LW, LH, { stops: [[0, '#0d1b24'], [0.55, '#2f4b55'], [1, '#93a8a3']], sun: [1650, 260, 26, '#ffd8a8'] }),
      L_range(LW, LH, { seed: 3, base: 520, amp: 330, freq: 1 / 520, sharp: 0.62, top: '#6f8789', bot: '#4a6164', snow: 120, rim: 0.25, haze: '#9fb4b0', hazeA: 0.7, depth: 0.15 }),
      L_cliff(LW, LH, { seed: 9, top: 360, topAmp: 90, bottom: 1010, rock: ['#6b6d64', '#2e3532'], moss: 260, mossCol: '#4d6b3f', falls, depth: 0.55, pool: ['#3f7f7c', '#173634'], bushes: 70, bushCol: ['#2e4a2c', '#3e5e35'], topTrees: { type: 'pine', density: 0.25, h: [26, 60], color: ['#24382a', '#2d4431'] } }),
    ], anim: (t, cam) => { mistBands(t, { n: 10, y: 940, h: 160, v: 18, a: 0.22 }); }
  };
};
SCN.panorama = () => {
  const LW = 2400, LH = 1350;
  return {
    LW, LH, layers: [
      L_sky(LW, LH, { stops: [[0, '#26344d'], [0.45, '#8c6f78'], [0.8, '#f0a877'], [1, '#ffd29a']], sun: [1180, 640, 34, '#fff1c9'], span: 0.6 }),
      L_range(LW, LH, { seed: 21, base: 640, amp: 300, freq: 1 / 600, sharp: 0.55, top: '#c58e83', bot: '#b9837c', rim: 0.35, rimCol: '#ffe0b0', haze: '#f0b089', hazeA: 0.65, depth: 0.12, peaks: [[700, 160, 120]] }),
      L_range(LW, LH, { seed: 22, base: 760, amp: 300, freq: 1 / 430, sharp: 0.6, top: '#93707a', bot: '#7a5d6b', rim: 0.3, rimCol: '#ffd4a8', haze: '#d99b86', hazeA: 0.6, depth: 0.25, snow: 70 }),
      L_range(LW, LH, { seed: 23, base: 930, amp: 280, freq: 1 / 380, sharp: 0.5, top: '#5c4b5e', bot: '#463a4d', rim: 0.25, rimCol: '#ffc999', haze: '#b07c7a', hazeA: 0.5, depth: 0.45, rock: 300 }),
      L_range(LW, LH, { seed: 24, base: 1150, amp: 260, freq: 1 / 300, sharp: 0.4, top: '#3a3040', bot: '#251f2b', rim: 0.2, rimCol: '#ffb98a', depth: 0.75, trees: { type: 'pine', density: 0.55, h: [30, 80], color: ['#221b27', '#2a2230'], seed: 4 } }),
    ], anim: (t, cam) => { rays(t, W / 2 + cam.x * 0.04, 470, '#ffd9a8', 0.06); birds(t, { n: 7, x: 520, y: 330, spread: 260, size: 16, vx: 55, vy: -6, t0: 4.0, seed: 5, color: 'rgba(40,30,45,0.85)' }); mistBands(t, { n: 8, y: 880, h: 120, v: 22, a: 0.18 }); }
  };
};
SCN.town = () => {
  const LW = 2400, LH = 1350;
  return {
    LW, LH, layers: [
      L_sky(LW, LH, { stops: [[0, '#8fb2c9'], [0.6, '#e6d9c4'], [1, '#f7dfba']], sun: [600, 320, 30, '#fff3d6'] }),
      L_range(LW, LH, { seed: 31, base: 640, amp: 360, freq: 1 / 560, sharp: 0.66, top: '#a8b3bc', bot: '#8a98a2', snow: 160, rim: 0.4, haze: '#d9d6cf', hazeA: 0.75, depth: 0.12, peaks: [[1500, 260, 160]] }),
      L_range(LW, LH, { seed: 32, base: 800, amp: 230, freq: 1 / 420, sharp: 0.5, top: '#7f8a7e', bot: '#6b766a', rim: 0.25, haze: '#cfc8b8', hazeA: 0.6, depth: 0.3, rock: 300 }),
      L_town(LW, LH, { seed: 33, base: 880, x0: 500, x1: 1950, houses: 150, poplars: 70, bushes: 40, spread: 240, walls: ['#efe4d1', '#e3d3bb', '#d8c4a8', '#f4ede0'], roofs: ['#9b4a33', '#7d3b2a', '#a8644a', '#6d6158'], treeCols: ['#3f5a36', '#4d6a3d', '#344a2e'], ground: ['#9b9a6c', '#6e6a45'], mosque: [1180, 150], mosqueCol: '#e9e2d4', depth: 0.6 }),
    ], anim: (t, cam) => { birds(t, { n: 5, x: 1300, y: 300, spread: 200, size: 13, vx: -40, t0: 11.6, seed: 9, color: 'rgba(50,50,60,0.8)' }); }
  };
};
SCN.aladag_tilt = () => {
  const LW = 2400, LH = 2100;
  return {
    LW, LH, layers: [
      L_sky(LW, LH, { stops: [[0, '#4f7fa8'], [0.45, '#a9c6dc'], [1, '#eef2f2']], span: 0.6, sun: [1700, 300, 24, '#ffffff'] }),
      L_range(LW, LH, { seed: 41, base: 1050, amp: 760, freq: 1 / 520, sharp: 0.75, pow: 1.25, top: '#d7dde2', bot: '#8e9aa5', snow: 330, rim: 0.5, rimCol: '#ffffff', haze: '#c9d6df', hazeA: 0.55, depth: 0.25, rock: 900, peaks: [[1200, 220, 260]], light: 1 }),
      L_range(LW, LH, { seed: 42, base: 1500, amp: 480, freq: 1 / 380, sharp: 0.7, top: '#8a96a0', bot: '#5f6c76', snow: 120, rim: 0.3, haze: '#b8c6cf', hazeA: 0.5, depth: 0.45, rock: 700, light: 1 }),
      L_range(LW, LH, { seed: 43, base: 1850, amp: 300, freq: 1 / 300, sharp: 0.45, top: '#4d6650', bot: '#2f4232', depth: 0.75, trees: { type: 'pine', density: 0.8, h: [40, 110], color: ['#203226', '#28402e', '#1b2b20'], seed: 8, jitter: 30 } }),
    ], anim: (t, cam) => { mistBands(t, { n: 12, y: 700 + cam.y * 0.5, h: 260, v: 14, a: 0.25 }); }
  };
};
SCN.peaks_clouds = () => {
  const LW = 2400, LH = 1350;
  return {
    LW, LH, layers: [
      L_sky(LW, LH, { stops: [[0, '#2f4a6b'], [0.5, '#9c9bb0'], [0.85, '#f1c9a4'], [1, '#f7dcb8']], sun: [1950, 560, 30, '#fff0cf'] }),
      L_range(LW, LH, { seed: 51, base: 700, amp: 470, freq: 1 / 640, sharp: 0.8, pow: 1.3, top: '#cfc2c6', bot: '#9c8f9c', snow: 200, rim: 0.55, rimCol: '#ffe2bd', depth: 0.15, peaks: [[1250, 200, 230]], rock: 600, light: 1 }),
      L_cloudband(LW, LH, { seed: 52, n: 46, y: 720, h: 90, a: 0.5, depth: 0.3, tint: 'rgba(255,214,190,0.35)' }),
      L_range(LW, LH, { seed: 53, base: 1010, amp: 330, freq: 1 / 380, sharp: 0.7, top: '#6b6275', bot: '#4a4457', rim: 0.35, rimCol: '#ffcf9e', depth: 0.5, rock: 400, light: 1 }),
      L_cloudband(LW, LH, { seed: 54, n: 26, y: 1120, h: 70, a: 0.35, depth: 0.65, tint: 'rgba(255,205,180,0.3)' }),
    ], anim: (t, cam) => { driftClouds(t, { n: 6, y: 700, h: 140, v: 14, a: 0.35, s: [1.2, 2.2] }); }
  };
};
SCN.winter = (spring) => {
  const LW = 2400, LH = 1350, P = spring ?
    { sky: [[0, '#8fbad3'], [0.6, '#dfe9e6'], [1, '#f4efdf']], r1: ['#a9b8b1', '#91a39a'], r2: ['#7e9a80', '#668467'], r3: ['#557a50', '#3c5c3a'], rock: ['#837f73', '#4c4d45'], snow1: 120, snow2: 0, tree: ['#2f4a2e', '#3b5a36'] } :
    { sky: [[0, '#9fb3c6'], [0.6, '#dfe6ed'], [1, '#f2f5f7']], r1: ['#e3e9ef', '#c4d0db'], r2: ['#c9d4de', '#a9b9c7'], r3: ['#b5c4d1', '#93a6b6'], rock: ['#8f969c', '#5b636a'], snow1: 400, snow2: 260, tree: ['#5b6b6c', '#6f7f80'] };
  const falls = [{ x: 1200, y: 470, w: 70, len: 560, speed: 260, streaks: 18, seed: 61 }, { x: 1060, y: 560, w: 26, len: 470, speed: 240, streaks: 8, seed: 62 }];
  return {
    LW, LH, layers: [
      L_sky(LW, LH, { stops: P.sky }),
      L_range(LW, LH, { seed: 61, base: 560, amp: 300, freq: 1 / 520, sharp: 0.6, top: P.r1[0], bot: P.r1[1], snow: P.snow1, rim: 0.4, rimCol: '#ffffff', haze: '#e6edf1', hazeA: 0.6, depth: 0.15 }),
      L_range(LW, LH, { seed: 62, base: 760, amp: 260, freq: 1 / 400, sharp: 0.5, top: P.r2[0], bot: P.r2[1], snow: P.snow2, rim: 0.3, rimCol: '#ffffff', haze: '#dfe7ec', hazeA: 0.5, depth: 0.3, trees: { type: 'pine', density: 0.35, h: [24, 60], color: P.tree, seed: 3 } }),
      L_cliff(LW, LH, { seed: 63, top: 430, topAmp: 60, bottom: 1060, bowl: -60, rock: P.rock, moss: spring ? 220 : 0, mossCol: '#4f6d3f', falls, depth: 0.55, pool: spring ? ['#4f8c8a', '#1f3c3a'] : ['#cfdde6', '#8fa6b5'], bushes: spring ? 60 : 0, bushCol: ['#2f4a2c', '#3e5e35'], frozen: !spring, fallAlpha: spring ? (t => E.sine(seg(t, 23.6, 24.9))) : null, topTrees: { type: 'pine', density: 0.4, h: [30, 70], color: P.tree, seed: 4 } }),
      L_range(LW, LH, { seed: 64, base: 1250, amp: 160, freq: 1 / 260, sharp: 0.3, top: P.r3[0], bot: P.r3[1], snow: spring ? 0 : 70, depth: 0.85, trees: { type: 'pine', density: 0.6, h: [60, 140], color: P.tree, seed: 5 } }),
    ]
  };
};
SCN.kapuz = () => {
  const LW = 2400, LH = 1350, falls = [];
  [[420, 600, 34], [610, 470, 62], [835, 640, 30], [1060, 430, 92], [1290, 560, 44], [1500, 450, 70], [1765, 610, 38]].forEach(([x, y, w], i) => falls.push({ x, y, w, len: 1008 - y, speed: 330 + i * 15, streaks: 18, seed: 70 + i }));
  return {
    LW, LH, layers: [
      L_sky(LW, LH, { stops: [[0, '#86b4c8'], [0.6, '#d8e6e2'], [1, '#f1efe2']], sun: [1900, 220, 26, '#ffffff'] }),
      L_range(LW, LH, { seed: 71, base: 470, amp: 300, freq: 1 / 560, sharp: 0.7, top: '#b8c4c6', bot: '#97a7a9', snow: 160, rim: 0.4, haze: '#cfdcd9', hazeA: 0.7, depth: 0.12 }),
      L_cliff(LW, LH, { seed: 72, top: 380, topAmp: 70, bottom: 1010, rock: ['#a0988a', '#4d4a43'], moss: 420, mossCol: '#557a3e', falls, depth: 0.55, pool: ['#5bb0ad', '#1d4d4a'], bushes: 120, bushCol: ['#2f5a2c', '#47703a'], topTrees: { type: 'pine', density: 0.3, h: [26, 64], color: ['#2b4530', '#34503a'], seed: 9 } }),
    ], anim: (t, cam) => { mistBands(t, { n: 12, y: 960, h: 140, v: 22, a: 0.28 }); }
  };
};
SCN.kapuz_close = () => {
  const LW = 2400, LH = 1350, falls = [{ x: 1180, y: 300, w: 170, len: 780, speed: 420, streaks: 40, seed: 81, spread: 0.18 }, { x: 760, y: 380, w: 70, len: 700, speed: 360, streaks: 18, seed: 82 }, { x: 1640, y: 340, w: 90, len: 740, speed: 380, streaks: 22, seed: 83 }];
  return {
    LW, LH, layers: [
      L_sky(LW, LH, { stops: [[0, '#9cc3d0'], [1, '#eef1e8']] }),
      L_cliff(LW, LH, { seed: 84, top: 140, topAmp: 60, bottom: 1080, rock: ['#9b9385', '#3f3d38'], moss: 520, mossCol: '#4f7a3a', falls, depth: 0.45, pool: ['#62b3ad', '#1b4744'], bushes: 90, bushCol: ['#2b5229', '#3f6a34'], topTrees: { type: 'round', density: 0.3, h: [40, 80], color: ['#2f5a2c', '#3c6a35'], seed: 10 } }),
      L_range(LW, LH, { seed: 85, base: 1320, amp: 200, freq: 1 / 240, sharp: 0.2, top: '#2f322c', bot: '#1d1f1b', depth: 0.9, rock: 200 }),
    ], anim: (t, cam) => { mistBands(t, { n: 14, y: 1000, h: 200, v: 30, a: 0.34 }); }
  };
};
SCN.canyon = () => {
  const LW = 2400, LH = 1350;
  return {
    LW, LH, layers: [
      L_sky(LW, LH, { stops: [[0, '#7fb0d0'], [0.7, '#e8dcc6'], [1, '#f5e3c4']] }),
      L_range(LW, LH, { seed: 91, base: 520, amp: 200, freq: 1 / 500, sharp: 0.5, top: '#c4a888', bot: '#b29576', haze: '#e8d6bc', hazeA: 0.7, depth: 0.12, snow: 60 }),
      L_river(LW, LH, { seed: 92, pts: [[1180, 560, 30], [1120, 700, 70], [1300, 860, 140], [1050, 1080, 260], [1250, 1400, 420]], water: ['#8cc6c8', '#2f7f84'], bank: 'rgba(60,50,35,0.55)', ground: ['#a98b63', '#6f5638'], groundTop: 540, speed: 120, depth: 0.5 }),
      L_canyon(LW, LH, { seed: 93, side: -1, edge: 760, slope: 0, rough: 120, bulge: 140, cols: ['#c98657', '#6d3c24'], shrubs: 90, shrubCol: '#4c6b33', depth: 0.7 }),
      L_canyon(LW, LH, { seed: 94, side: 1, edge: 720, slope: 0, rough: 140, bulge: 160, cols: ['#b6704a', '#5c311d'], shrubs: 90, shrubCol: '#4c6b33', depth: 0.7 }),
    ], anim: (t, cam) => { birds(t, { n: 3, x: 900, y: 360, spread: 120, size: 14, vx: 40, t0: 31, seed: 2, color: 'rgba(40,30,25,0.8)' }); }
  };
};
SCN.river = () => {
  const LW = 2400, LH = 1350;
  return {
    LW, LH, layers: [
      L_sky(LW, LH, { stops: [[0, '#80b2d6'], [0.65, '#e3e6dc'], [1, '#f6ead1']], sun: [500, 260, 24, '#fff6dc'] }),
      L_range(LW, LH, { seed: 101, base: 560, amp: 300, freq: 1 / 560, sharp: 0.65, top: '#a9b5c0', bot: '#8d9aa6', snow: 150, rim: 0.4, haze: '#dfe3dc', hazeA: 0.7, depth: 0.12 }),
      L_range(LW, LH, { seed: 102, base: 700, amp: 160, freq: 1 / 380, sharp: 0.45, top: '#8f9a78', bot: '#7a8664', haze: '#d8d9c4', hazeA: 0.5, depth: 0.3 }),
      L_river(LW, LH, { seed: 103, pts: [[1500, 660, 18], [1100, 720, 40], [1500, 820, 80], [900, 960, 150], [1400, 1200, 280], [1000, 1420, 420]], water: ['#a8d4dc', '#3f8f9c'], bank: 'rgba(70,80,40,0.5)', ground: ['#a9a666', '#5f6b36'], groundTop: 650, fields: 160, fieldCols: ['#b9b26a', '#8fa257', '#c9b77a', '#7d9450'], trees: { type: 'poplar', density: 0.5, h: [40, 170], color: ['#3e5a2f', '#4b6a36', '#33502a'] }, speed: 100, depth: 0.55 }),
    ], anim: (t, cam) => { birds(t, { n: 6, x: 300, y: 300, spread: 220, size: 14, vx: 70, t0: 33.7, seed: 12, color: 'rgba(40,40,45,0.8)' }); driftClouds(t, { n: 5, y: 260, h: 120, v: 10, a: 0.45, s: [1.0, 1.8] }); }
  };
};
SCN.derebag = () => {
  const LW = 2400, LH = 1350, falls = [{ x: 1220, y: 360, w: 90, len: 640, speed: 300, streaks: 22, seed: 111, spread: 0.3 }];
  return {
    LW, LH, layers: [
      L_sky(LW, LH, { stops: [[0, '#a7cdd8'], [1, '#eef3e6']] }),
      L_range(LW, LH, { seed: 112, base: 520, amp: 240, freq: 1 / 480, sharp: 0.5, top: '#9fbfaa', bot: '#86a892', haze: '#dbe8dc', hazeA: 0.6, depth: 0.15, trees: { type: 'pine', density: 0.4, h: [20, 50], color: ['#6e957a', '#5f8a6c'], seed: 2 } }),
      L_cliff(LW, LH, { seed: 113, top: 300, topAmp: 80, bottom: 1000, bowl: -120, rock: ['#7c7f6c', '#3c4236'], moss: 700, mossCol: '#4d7d3c', falls, depth: 0.5, pool: ['#69b2a3', '#1e4a40'], bushes: 160, bushCol: ['#2c5a2b', '#3f7336'], topTrees: { type: 'round', density: 0.28, h: [36, 130], color: ['#2f6030', '#3c7038', '#285027'], seed: 6 } }),
      L_range(LW, LH, { seed: 114, base: 1300, amp: 260, freq: 1 / 260, sharp: 0.2, top: '#28452a', bot: '#162a18', depth: 0.9, trees: { type: 'round', density: 0.7, h: [80, 200], color: ['#1f3a20', '#2a4a2a'], seed: 7 } }),
    ], anim: (t, cam) => { mistBands(t, { n: 10, y: 940, h: 140, v: 18, a: 0.26 }); }
  };
};
SCN.yayla = () => {
  const LW = 2400, LH = 1350;
  return {
    LW, LH, layers: [
      L_sky(LW, LH, { stops: [[0, '#7ea6c4'], [0.55, '#efd9b4'], [1, '#f8e2bb']], sun: [1900, 380, 32, '#fff1cc'] }),
      L_range(LW, LH, { seed: 121, base: 600, amp: 330, freq: 1 / 560, sharp: 0.7, top: '#b6a7a0', bot: '#9b8d88', snow: 150, rim: 0.45, rimCol: '#ffe6c0', haze: '#ead9bf', hazeA: 0.65, depth: 0.12, light: 1 }),
      L_range(LW, LH, { seed: 122, base: 760, amp: 160, freq: 1 / 420, sharp: 0.45, top: '#a59a6c', bot: '#8c8457', haze: '#e9d7ad', hazeA: 0.5, depth: 0.3 }),
      L_meadow(LW, LH, { seed: 123, base: 820, grass: ['#b9a75c', '#6f6a2f'], tents: [[900, 60, 1.0], [1350, 90, 1.25], [1680, 40, 0.8]], sheep: 70, flock: [1150, 200, 700], depth: 0.6 }),
    ], anim: (t, cam) => { birds(t, { n: 2, x: 600, y: 320, spread: 80, size: 18, vx: 30, t0: 39.4, seed: 4, color: 'rgba(50,40,30,0.85)' }); }
  };
};
SCN.final = () => {
  const LW = 2400, LH = 1350, falls = [[1520, 700, 18], [1580, 690, 14], [1640, 720, 16], [1700, 700, 12]].map(([x, y, w], i) => ({ x, y, w, len: 220, speed: 160, streaks: 6, seed: 130 + i, alpha: 0.75 }));
  return {
    LW, LH, layers: [
      L_sky(LW, LH, { stops: [[0, '#1d2342'], [0.4, '#6d4a6e'], [0.7, '#e2825f'], [0.88, '#f7b779'], [1, '#ffd8a0']], sun: [1000, 760, 40, '#fff0c4'], span: 0.62 }),
      L_range(LW, LH, { seed: 131, base: 720, amp: 380, freq: 1 / 620, sharp: 0.72, pow: 1.2, top: '#c27b7a', bot: '#a3666f', snow: 140, rim: 0.6, rimCol: '#ffd09a', haze: '#f0a27a', hazeA: 0.6, depth: 0.12, peaks: [[1500, 220, 150]] }),
      L_range(LW, LH, { seed: 132, base: 860, amp: 300, freq: 1 / 430, sharp: 0.62, top: '#7f4c66', bot: '#5f3a55', rim: 0.4, rimCol: '#ffb88a', haze: '#c0717a', hazeA: 0.5, depth: 0.3, rock: 300 }),
      L_town(LW, LH, { seed: 134, base: 960, x0: 300, x1: 1300, houses: 120, poplars: 50, bushes: 20, spread: 200, walls: ['#6a4a52', '#5e434c', '#735258'], roofs: ['#3a2733', '#2e2029'], treeCols: ['#2a1f2c', '#33263a'], ground: ['#3d2c3d', '#1c1520'], mosque: [760, 120], mosqueCol: '#5d4352', depth: 0.65, lights: t => E.sine(seg(t, 52.2, 54.2)) }),
    ], anim: (t, cam) => { rays(t, W / 2 - 200 + cam.x * 0.05, 610, '#ffcf96', 0.07); birds(t, { n: 9, x: 380, y: 360, spread: 300, size: 15, vx: 60, vy: -8, t0: 51.9, seed: 21, color: 'rgba(30,20,35,0.85)' }); }
  };
};

// ---------------------------------------------------------------- scene cache + drawing
const SCACHE = new Map();
function getScene(name) {
  if (SCACHE.has(name)) { const s = SCACHE.get(name); SCACHE.delete(name); SCACHE.set(name, s); return s; }
  let s;
  if (name === 'winter') s = { w: SCN.winter(false), s: SCN.winter(true) };
  else s = SCN[name]();
  SCACHE.set(name, s); while (SCACHE.size > 4) SCACHE.delete(SCACHE.keys().next().value);
  return s;
}
function drawLayers(sc, t, cam, alpha) {
  for (const Lr of sc.layers) {
    const d = Lr.depth, s = 1 + (cam.z - 1) * (0.25 + 0.75 * d);
    const ox = W / 2 - sc.LW / 2 * s + cam.x * d, oy = H / 2 - sc.LH / 2 * s + cam.y * (0.15 + 0.85 * d);
    ctx.setTransform(s, 0, 0, s, ox + (Lr.drift ? ((t * Lr.drift) % 400) : 0), oy);
    ctx.globalAlpha = alpha; ctx.drawImage(Lr.c, 0, 0);
    if (Lr.anim) { LA = alpha; Lr.anim(t); }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
}
window.drawLand = function (name, t, p, cd, alpha) {
  const cam = { z: lerp(cd.z[0], cd.z[1], p), x: lerp(cd.x[0], cd.x[1], p), y: lerp(cd.y[0], cd.y[1], p) };
  const sc = getScene(name);
  ctx.save();
  if (name === 'winter') {
    const k = E.sine(seg(t, 23.5, 25.0));
    if (k < 1) drawLayers(sc.w, t, cam, alpha);
    if (k > 0) drawLayers(sc.s, t, cam, alpha * k);
  } else {
    drawLayers(sc, t, cam, alpha);
    if (sc.anim) { LA = alpha; sc.anim(t, cam); }
  }
  ctx.restore();
};
// a still composite of a scene (for the blurred end-card background)
window.landStill = function (name, t, cd) {
  const [c, g] = mk(W, H); const saved = ctx.canvas; // draw into main then copy
  drawLand(name, t, 1, cd, 1); g.drawImage(saved, 0, 0); return c;
};
