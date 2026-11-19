'use strict';
/* Yahyalı — 60 s promo. Deterministic canvas renderer: window.renderFrame(t) draws the frame at time t (seconds). */
const W = 1920, H = 1080;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
ctx.imageSmoothingQuality = 'high';
let TL, MAN = {}, IMG = {}, PROV = [], CARPET = null, SPRITE, GRAIN = [], VIGN, BLURCACHE = {};

// ---------------------------------------------------------------- math
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  lin: t => t,
  inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
const env = (t, a, b, fi = .4, fo = .4) => Math.max(0, Math.min(E.sine(seg(t, a, a + fi)), 1 - E.sine(seg(t, b - fo, b))));
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const GOLD = '#e2b866', GOLD2 = '#f3d79a';

// ---------------------------------------------------------------- text helpers
function setFont(size, fam = 'Montserrat', weight = 500, style = 'normal') { ctx.font = `${style} ${weight} ${size}px "${fam}"`; }
function txt(str, x, y, o = {}) {
  const { size = 40, fam = 'Montserrat', weight = 500, style = 'normal', color = '#fff', align = 'left', base = 'alphabetic',
    track = 0, alpha = 1, shadow = 0.55, blur = 0 } = o;
  if (alpha <= 0.003) return;
  ctx.save(); setFont(size, fam, weight, style); ctx.textAlign = align; ctx.textBaseline = base; ctx.letterSpacing = track + 'px';
  ctx.globalAlpha *= alpha; ctx.fillStyle = color;
  if (shadow) { ctx.shadowColor = `rgba(0,0,0,${shadow})`; ctx.shadowBlur = size * 0.45; ctx.shadowOffsetY = 2; }
  if (blur > 0.3) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.fillText(str, align === 'center' ? x + track / 2 : (align === 'right' ? x + track : x), y);
  ctx.restore();
}
function measure(str, size, fam = 'Montserrat', weight = 500, track = 0, style = 'normal') {
  ctx.save(); setFont(size, fam, weight, style); ctx.letterSpacing = track + 'px'; const w = ctx.measureText(str).width; ctx.restore(); return w;
}
function line(x1, y1, x2, y2, color = GOLD, w = 2, alpha = 1) {
  if (alpha <= 0) return; ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}

// ---------------------------------------------------------------- loading
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
async function init() {
  TL = await (await fetch('../timeline.json')).json();
  try { MAN = await (await fetch('../img/proc/manifest.json', { cache: 'no-store' })).json(); } catch (e) { MAN = {}; }
  for (const [id, m] of Object.entries(MAN)) { try { IMG[id] = await loadImage('../img/proc/' + m.file); } catch (e) { console.warn('img', id, e); } }
  PROV = (await (await fetch('provinces.json')).json()).map(p => ({ ...p, p2d: new Path2D(p.path), c: centroidOf(p.path) }));
  const fams = ['700 80px "Playfair Display"', '400 80px "Playfair Display"', 'italic 400 80px "Playfair Display"', '300 40px Montserrat', '500 40px Montserrat',
    '600 40px Montserrat', '700 40px Montserrat', '400 80px "Bebas Neue"'];
  for (const f of fams) await document.fonts.load(f, 'AaĞğİıŞşÇçÖöÜü0123456789·–');
  await document.fonts.ready;
  buildSprites(); CARPET = buildCarpet(); makeEndBackground();
  window.READY = true;
}
function centroidOf(path) {
  const n = path.match(/-?\d+(\.\d+)?/g).map(Number); let sx = 0, sy = 0, k = 0;
  for (let i = 0; i + 1 < n.length; i += 2) { sx += n[i]; sy += n[i + 1]; k++; } return [sx / k, sy / k];
}
function buildSprites() {
  SPRITE = document.createElement('canvas'); SPRITE.width = SPRITE.height = 128;
  const g = SPRITE.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  for (let k = 0; k < 4; k++) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const gg = c.getContext('2d'); const id = gg.createImageData(256, 256); const r = rng(100 + k);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() + r() + r() - 1.5) * 120; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    gg.putImageData(id, 0, 0); GRAIN.push(ctx.createPattern(c, 'repeat'));
  }
  VIGN = document.createElement('canvas'); VIGN.width = W; VIGN.height = H; const v = VIGN.getContext('2d');
  const vg = v.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.62)'); v.fillStyle = vg; v.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- photos
function pick(list) { for (const id of list) if (IMG[id]) return id; return null; }
function drawCover(img, p, kb, alpha = 1, filter = '') {
  const s = lerp(kb.s[0], kb.s[1], p), px = lerp(kb.x[0], kb.x[1], p), py = lerp(kb.y[0], kb.y[1], p);
  const iw = img.width, ih = img.height, base = Math.max(W / iw, H / ih), sc = base * s;
  const dw = iw * sc, dh = ih * sc, ox = (dw - W) / 2, oy = (dh - H) / 2;
  ctx.save(); ctx.globalAlpha = alpha; if (filter) ctx.filter = filter;
  ctx.drawImage(img, (W - dw) / 2 - px * ox, (H - dh) / 2 - py * oy, dw, dh); ctx.restore();
}
function credit(id, alpha) {
  const m = MAN[id]; if (!m || alpha <= 0.01) return;
  txt(`Fotoğraf: ${m.artist} · ${m.license} · Wikimedia Commons`, W - 34, H - 26, { size: 15, weight: 300, align: 'right', alpha: alpha * 0.8, shadow: 0.9 });
}
// illustrated fallback (used only if a photo could not be fetched)
const ILL = {};
function illustration(kind) {
  if (ILL[kind]) return ILL[kind];
  const c = document.createElement('canvas'); c.width = 2400; c.height = 1350; const g = c.getContext('2d'); const r = rng(kind.length * 97 + 3);
  const pal = { falls: ['#b9cfd0', '#7e9c9a', '#4f6e67', '#2c4a43', '#18302b'], mountains: ['#d9c8b4', '#9fa9b0', '#6f8090', '#495a68', '#2b3742'],
    river: ['#cfd8c8', '#93a88e', '#62806a', '#3e5d4b', '#233a30'], town: ['#e6cfae', '#b49b83', '#8a7766', '#5d5249', '#3a332e'], snow: ['#dfe7ee', '#c3d1dc', '#9fb2c2', '#7a8fa1', '#4b5c6b'] }[kind] || ['#ccc', '#999', '#777', '#555', '#333'];
  const sky = g.createLinearGradient(0, 0, 0, 1350); sky.addColorStop(0, pal[0]); sky.addColorStop(1, '#f1e6d2'); g.fillStyle = sky; g.fillRect(0, 0, 2400, 1350);
  for (let L = 1; L < 5; L++) {
    const base = 520 + L * 170, amp = 260 - L * 40, ph = [r() * 6, r() * 6, r() * 6];
    g.beginPath(); g.moveTo(0, 1350);
    for (let x = 0; x <= 2400; x += 8) { const y = base - amp * (0.55 * Math.sin(x / 260 + ph[0]) + 0.3 * Math.sin(x / 113 + ph[1]) + 0.15 * Math.sin(x / 47 + ph[2])); g.lineTo(x, y); }
    g.lineTo(2400, 1350); g.closePath(); g.fillStyle = pal[L]; g.fill();
  }
  if (kind === 'falls' || kind === 'snow') { g.filter = 'blur(3px)'; for (let i = 0; i < 7; i++) { const x = 700 + i * 140 + r() * 60; g.fillStyle = 'rgba(240,248,250,.8)'; g.fillRect(x, 520 + r() * 120, 14 + r() * 20, 600); } g.filter = 'none'; }
  ILL[kind] = c; return c;
}

// ---------------------------------------------------------------- overlays
function particles(t, t0, alpha, mode) {
  if (alpha <= 0.01) return; const tau = t - t0; ctx.save();
  if (mode === 'snow') {
    const r = rng(77);
    for (let i = 0; i < 380; i++) {
      const d = r(), size = lerp(1.4, 7.5, d * d), sp = lerp(35, 150, d), x0 = r() * W, y0 = r() * H, ph = r() * 6.28, sw = lerp(8, 36, r());
      const y = ((y0 + sp * tau) % (H + 40)) - 20, x = ((x0 + sw * Math.sin(ph + tau * 0.9) + 22 * tau * d) % (W + 40) + (W + 40)) % (W + 40) - 20;
      ctx.globalAlpha = alpha * lerp(0.3, 0.9, d); ctx.drawImage(SPRITE, x - size, y - size, size * 2, size * 2);
    }
  } else if (mode === 'mist') {
    const r = rng(5);
    for (let i = 0; i < 24; i++) {
      const x0 = r() * W, y0 = H * lerp(0.55, 1.15, r()), s = lerp(240, 560, r()), vy = lerp(10, 34, r()), vx = lerp(-14, 14, r());
      ctx.globalAlpha = alpha * lerp(0.05, 0.13, r()); ctx.drawImage(SPRITE, x0 + vx * tau + 30 * Math.sin(tau * 0.3 + i) - s, y0 - vy * tau - s, 2 * s, 2 * s);
    }
    const r2 = rng(9);
    for (let i = 0; i < 160; i++) { // fine spray droplets drifting up
      const x0 = r2() * W, y0 = H * lerp(0.3, 1.0, r2()), sp = lerp(15, 60, r2()), s = lerp(1, 3.2, r2());
      const y = ((y0 - sp * tau) % H + H) % H; ctx.globalAlpha = alpha * lerp(0.15, 0.5, r2()); ctx.drawImage(SPRITE, x0 + 10 * Math.sin(tau + i) - s, y - s, 2 * s, 2 * s);
    }
  } else if (mode === 'dust') {
    const r = rng(21);
    for (let i = 0; i < 70; i++) {
      const x0 = r() * W, y0 = r() * H, s = lerp(1.5, 4.5, r()), vx = lerp(-8, 8, r()), vy = lerp(-10, -2, r());
      ctx.globalAlpha = alpha * (0.25 + 0.25 * Math.sin(tau * 1.3 + i)); ctx.drawImage(SPRITE, x0 + vx * tau - s, y0 + vy * tau - s, 2 * s, 2 * s);
    }
  }
  ctx.restore();
}
function grain(frame, alpha = 0.09) {
  const g = Math.floor(frame / 3); // grain refreshes at 10 Hz: keeps the filmic texture, saves a lot of bitrate
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = alpha; const r = rng(g * 31 + 7);
  ctx.translate(-Math.floor(r() * 256), -Math.floor(r() * 256)); ctx.fillStyle = GRAIN[g % 4]; ctx.fillRect(0, 0, W + 256, H + 256); ctx.restore();
}
function grade(warm = 0.12, teal = 0.10) {
  ctx.save(); ctx.globalCompositeOperation = 'soft-light';
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(40,110,130,${teal})`); g.addColorStop(1, `rgba(255,150,70,${warm})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}
function flash(t, tc, up = 0.07, down = 0.55, peak = 1) {
  const a = t < tc ? seg(t, tc - up, tc) : 1 - E.out(seg(t, tc, tc + down)); if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a * peak; ctx.fillStyle = '#fff8ee'; ctx.fillRect(0, 0, W, H); ctx.restore();
}
function leak(t, tc, dur = 1.4, alpha = 0.55, from = -0.2, to = 1.2) {
  const p = seg(t, tc - 0.2, tc + dur); if (p <= 0 || p >= 1) return; const a = Math.sin(Math.PI * p) * alpha;
  const x = lerp(from, to, p) * W; ctx.save(); ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(x, H * 0.35, 0, x, H * 0.35, W * 0.55);
  g.addColorStop(0, `rgba(255,190,120,${a})`); g.addColorStop(0.4, `rgba(255,120,60,${a * 0.45})`); g.addColorStop(1, 'rgba(255,90,40,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}
function darkBand(alpha, y = H / 2, h = 520) {
  if (alpha <= 0) return; ctx.save(); const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, `rgba(0,0,0,${0.42 * alpha})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, y - h / 2, W, h); ctx.restore();
}
function bottomShade(alpha, h = 420) {
  if (alpha <= 0) return; ctx.save(); const g = ctx.createLinearGradient(0, H - h, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.6 * alpha})`); ctx.fillStyle = g; ctx.fillRect(0, H - h, W, h); ctx.restore();
}

// ---------------------------------------------------------------- titles
function lowerThird(t, t0, t1, title, sub, x = 120, y = H - 170) {
  const a = env(t, t0, t1, 0.35, 0.45); if (a <= 0) return;
  bottomShade(a * 0.9);
  const pl = E.outExpo(seg(t, t0, t0 + 0.6));
  line(x, y - 58, x + 90 * pl, y - 58, GOLD, 3, a);
  const pt = E.out(seg(t, t0 + 0.1, t0 + 0.8));
  ctx.save(); ctx.beginPath(); ctx.rect(x - 10, y - 50, 1400, 70); ctx.clip();
  txt(title, x + lerp(-60, 0, pt), y, { size: 50, weight: 700, track: 7, alpha: a * pt });
  ctx.restore();
  if (sub) txt(sub, x + 2, y + 48, { size: 30, fam: 'Playfair Display', weight: 400, style: 'italic', alpha: a * E.out(seg(t, t0 + 0.35, t0 + 1.0)), color: '#f4ead8' });
}
function bigNumber(t, t0, t1, num, label) {
  const a = env(t, t0, t1, 0.25, 0.45); if (a <= 0) return;
  const p = E.outExpo(seg(t, t0, t0 + 0.9));
  darkBand(a * 0.9, 560, 640);
  ctx.save(); ctx.translate(W / 2, 560); const s = lerp(1.18, 1, p); ctx.scale(s, s);
  txt(num, 0, 70, { size: 400, fam: 'Bebas Neue', weight: 400, align: 'center', alpha: a, blur: (1 - p) * 14, shadow: 0.5 });
  ctx.restore();
  const p2 = E.out(seg(t, t0 + 0.25, t0 + 1.0));
  txt(label, W / 2, 735 + (1 - p2) * 30, { size: 46, weight: 600, track: lerp(10, 26, p2), align: 'center', alpha: a * p2 });
}
function wordsReveal(t, t0, t1, words, times, y = 600) {
  const a = env(t, t0, t1, 0.2, 0.35); if (a <= 0) return;
  darkBand(a * 0.8, y - 20, 420);
  const size = 70, track = 20, gap = 34; const ws = words.map(w => measure(w, size, 'Montserrat', 300, track)); const total = ws.reduce((s, v) => s + v, 0) + gap * (words.length - 1);
  let x = W / 2 - total / 2;
  words.forEach((w, i) => {
    const p = E.out(seg(t, times[i], times[i] + 0.5));
    txt(w, x, y + (1 - p) * 18, { size, weight: 300, track, alpha: a * p, blur: (1 - p) * 10 });
    x += ws[i] + gap;
  });
}
function mainTitle(t, t0, t1) {
  const a = env(t, t0, t1, 0.12, 0.45); if (a <= 0) return;
  darkBand(a, H / 2 + 10, 640);
  const p = E.outExpo(seg(t, t0, t0 + 2.6));
  txt('YAHYALI', W / 2, H / 2 + 50, { size: 190, fam: 'Playfair Display', weight: 700, align: 'center', track: lerp(6, 34, p), alpha: a * E.out(seg(t, t0, t0 + 0.4)), shadow: 0.6 });
  const p2 = E.outExpo(seg(t, t0 + 0.35, t0 + 1.4)); const half = 330 * p2;
  line(W / 2 - 120 - half, H / 2 - 150, W / 2 - 120, H / 2 - 150, GOLD, 2, a); line(W / 2 + 120, H / 2 - 150, W / 2 + 120 + half, H / 2 - 150, GOLD, 2, a);
  txt('KAYSERİ', W / 2, H / 2 - 140, { size: 30, weight: 600, track: 14, align: 'center', alpha: a * p2, color: GOLD2 });
  txt('Toros Dağları\'nın eteğinde', W / 2, H / 2 + 135, { size: 38, fam: 'Playfair Display', style: 'italic', weight: 400, align: 'center', alpha: a * E.out(seg(t, t0 + 0.8, t0 + 1.6)) });
  txt('38°06′ K   ·   35°21′ D', W / 2, H / 2 + 200, { size: 22, weight: 300, track: 6, align: 'center', alpha: a * E.out(seg(t, t0 + 1.1, t0 + 1.9)) * 0.85 });
}
function counter(t, t0, t1, c0, c1) {
  const a = env(t, t0, t1, 0.3, 0.45); if (a <= 0) return;
  const done = seg(t, c0, c1) >= 1, p = done ? 1 : E.outExpo(seg(t, c0, c1)); const v = done ? 3700 : Math.min(3690, Math.round(3700 * p / 10) * 10);
  const x = W - 150, y = 610;
  ctx.save(); const g = ctx.createRadialGradient(W - 120, 520, 40, W - 120, 520, 820); g.addColorStop(0, `rgba(0,0,0,${0.5 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  txt('ZİRVELER', x, y - 230, { size: 26, weight: 600, track: 14, align: 'right', alpha: a, color: GOLD2 });
  txt(v.toLocaleString('tr-TR') + (done ? '+' : ''), x, y, { size: 230, fam: 'Bebas Neue', weight: 400, align: 'right', alpha: a });
  txt('METRE', x, y + 60, { size: 30, weight: 500, track: 18, align: 'right', alpha: a * 0.9 });
  // altitude ruler
  const rx = W - 90, top = 330, bot = 700; line(rx, bot, rx, lerp(bot, top, p), GOLD, 3, a);
  for (let k = 0; k <= 8; k++) { const yy = lerp(bot, top, k / 8); if (yy >= lerp(bot, top, p) - 1) line(rx - (k % 2 ? 10 : 18), yy, rx, yy, GOLD, 2, a); }
}
function sectionTitle(t, t0, t1, title, sub) {
  const a = env(t, t0, t1, 0.25, 0.5); if (a <= 0) return;
  darkBand(a, H / 2, 560);
  const p = E.outExpo(seg(t, t0, t0 + 1.8));
  txt(title, W / 2, H / 2 + 40, { size: 150, fam: 'Playfair Display', weight: 700, align: 'center', track: lerp(4, 22, p), alpha: a * E.out(seg(t, t0, t0 + 0.5)), blur: (1 - E.out(seg(t, t0, t0 + 0.5))) * 12 });
  const p2 = E.out(seg(t, t0 + 0.4, t0 + 1.1));
  txt(sub, W / 2, H / 2 + 120, { size: 40, weight: 600, track: lerp(12, 30, p2), align: 'center', alpha: a * p2, color: GOLD2 });
}
function chips(t, t0, t1, items, coord) {
  const a = env(t, t0, t1, 0.3, 0.45); if (a <= 0) return;
  bottomShade(a); let x = 120; const y = H - 130;
  txt(coord, 122, y - 44, { size: 22, weight: 300, track: 6, alpha: a * E.out(seg(t, t0, t0 + 0.6)) });
  items.forEach((it, i) => {
    const p = E.outBack(seg(t, t0 + 0.15 + i * 0.22, t0 + 0.65 + i * 0.22)); if (p <= 0) return;
    const w = measure(it, 24, 'Montserrat', 600, 4) + 44;
    ctx.save(); ctx.globalAlpha = a * clamp(p); ctx.translate(x + w / 2, y); ctx.scale(lerp(0.85, 1, clamp(p)), lerp(0.85, 1, clamp(p)));
    ctx.fillStyle = 'rgba(10,20,22,0.45)'; ctx.strokeStyle = 'rgba(243,215,154,0.9)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.roundRect(-w / 2, -30, w, 56, 28); ctx.fill(); ctx.stroke(); ctx.restore();
    txt(it, x + 22, y + 8, { size: 24, weight: 600, track: 4, alpha: a * clamp(p), shadow: 0 });
    x += w + 18;
  });
}
function riverLine(t, t0, t1) {
  const a = env(t, t0, t1, 0.3, 0.5); if (a <= 0) return; const p = E.inOut(seg(t, t0, t0 + 1.6));
  ctx.save(); ctx.globalAlpha = a * 0.9; ctx.lineWidth = 4; ctx.lineCap = 'round';
  const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(160,220,235,0)'); g.addColorStop(0.2, 'rgba(160,220,235,.95)'); g.addColorStop(1, 'rgba(230,250,255,.95)');
  ctx.strokeStyle = g; ctx.beginPath(); const x1 = 120 + 760 * p;
  for (let x = 120; x <= x1; x += 6) { const y = H - 250 + 12 * Math.sin(x / 70 + t * 1.5) * Math.sin(x / 300); x === 120 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.stroke(); ctx.restore();
}
function giantWord(t, t0, t1, word) {
  const a = Math.min(E.out(seg(t, t0, t0 + 0.08)), 1 - E.sine(seg(t, t1 - 0.15, t1))); if (a <= 0) return;
  ctx.save(); ctx.fillStyle = `rgba(0,0,0,${0.35 * a})`; ctx.fillRect(0, 0, W, H); ctx.restore();
  const p = E.outExpo(seg(t, t0, t0 + 0.6));
  ctx.save(); ctx.translate(W / 2, H / 2); const s = lerp(1.3, 1.0, p); ctx.scale(s, s);
  txt(word, 0, 110, { size: 330, fam: 'Playfair Display', weight: 700, align: 'center', track: 30, alpha: a, shadow: 0.6 });
  ctx.restore();
}

// ---------------------------------------------------------------- map
// turkey-map-react SVG space -> geo: bbox fit (Gökçeada 25.67E ... Iğdır 44.82E, Hatay 35.81N ... Sinop 42.10N)
const GEO = { lon0: 25.67, x0: 21.942, kx: (1029.006 - 21.942) / (44.82 - 25.67), lat0: 42.10, y0: 144.003, ky: (587.588 - 144.003) / (42.10 - 35.81) };
const geo = (lat, lon) => [GEO.x0 + (lon - GEO.lon0) * GEO.kx, GEO.y0 + (GEO.lat0 - lat) * GEO.ky];
const P = { kayseri: geo(38.722, 35.487), yahyali: geo(38.102, 35.358), erciyes: geo(38.531, 35.447), aladag: geo(37.84, 35.17), kapuz: geo(37.78, 35.39) };
function mapCam(t) {
  const full = { x: 525, y: 366, z: 1 }, prov = { x: 538, y: 410, z: 5.2 }, pin = { x: P.yahyali[0], y: P.yahyali[1], z: 26 };
  const p1 = E.inOut(seg(t, 8.5, 10.1)), p2 = E.in(seg(t, 10.95, 11.62));
  let x = lerp(full.x, prov.x, p1), y = lerp(full.y, prov.y, p1), z = Math.exp(lerp(Math.log(full.z), Math.log(prov.z), p1));
  x = lerp(x, pin.x, p2); y = lerp(y, pin.y, p2); z = Math.exp(lerp(Math.log(z), Math.log(pin.z), p2));
  z *= 1 + 0.02 * seg(t, 7.4, 8.5);
  return { x, y, z };
}
function drawMap(t, alpha) {
  if (alpha <= 0) return;
  const cam = mapCam(t), k = 1.62 * cam.z;
  ctx.save(); ctx.globalAlpha = alpha;
  const bg = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.75); bg.addColorStop(0, '#12302f'); bg.addColorStop(1, '#071312');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(k, 0, 0, k, W / 2 - cam.x * k, H / 2 - cam.y * k);
  // graticule
  ctx.lineWidth = 0.8 / k; ctx.strokeStyle = 'rgba(160,200,190,0.10)';
  for (let lon = 26; lon <= 45; lon += 1) { const a = geo(43, lon), b = geo(35, lon); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  for (let lat = 35; lat <= 43; lat += 1) { const a = geo(lat, 24), b = geo(lat, 46); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  const kc = PROV.find(p => p.id === 'kayseri').c;
  for (const pr of PROV) {
    const d = Math.hypot(pr.c[0] - kc[0], pr.c[1] - kc[1]) / 520;
    const ap = E.out(seg(t, 7.45 + d * 0.75, 7.45 + d * 0.75 + 0.4)); if (ap <= 0) continue;
    const isK = pr.id === 'kayseri';
    ctx.globalAlpha = alpha * ap;
    ctx.fillStyle = isK ? '#1f4a45' : '#173634'; ctx.fill(pr.p2d);
    if (isK) { const hk = E.out(seg(t, 8.25, 8.8)); ctx.globalAlpha = alpha * hk * 0.85; const gg = ctx.createLinearGradient(494, 354, 607, 459); gg.addColorStop(0, '#c8963e'); gg.addColorStop(1, '#8a5f22'); ctx.fillStyle = gg; ctx.fill(pr.p2d); ctx.globalAlpha = alpha * ap; }
    ctx.lineWidth = (isK ? 2.2 : 1.0) / k; ctx.strokeStyle = isK ? GOLD2 : 'rgba(170,215,205,0.35)'; ctx.stroke(pr.p2d);
  }
  ctx.globalAlpha = alpha;
  // route Kayseri -> Yahyalı (gently curved, road-like)
  const A = P.kayseri, B = P.yahyali, C = [A[0] - 9, (A[1] + B[1]) / 2 + 2];
  const bez = u => [(1 - u) * (1 - u) * A[0] + 2 * (1 - u) * u * C[0] + u * u * B[0], (1 - u) * (1 - u) * A[1] + 2 * (1 - u) * u * C[1] + u * u * B[1]];
  const rp = E.inOut(seg(t, 9.25, 10.5));
  if (rp > 0) {
    ctx.lineWidth = 3.2 / k; ctx.strokeStyle = GOLD2; ctx.lineCap = 'round'; ctx.setLineDash([9 / k, 7 / k]); ctx.beginPath();
    for (let i = 0; i <= 60; i++) { const u = rp * i / 60, q = bez(u); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const S = q => [W / 2 + (q[0] - cam.x) * k, H / 2 + (q[1] - cam.y) * k];
  // sea labels (wide view only)
  const sl = env(t, 7.7, 9.0, 0.4, 0.5) * alpha;
  txt('K A R A D E N İ Z', ...S(geo(42.75, 34.5)), { size: 22, weight: 300, track: 8, align: 'center', alpha: sl * 0.7, shadow: 0 });
  txt('A K D E N İ Z', ...S(geo(35.4, 31.0)), { size: 22, weight: 300, track: 8, align: 'center', alpha: sl * 0.7, shadow: 0 });
  txt('E G E', ...S(geo(38.6, 25.4)), { size: 20, weight: 300, track: 8, align: 'center', alpha: sl * 0.6, shadow: 0 });
  txt('TÜRKİYE', ...S(geo(39.6, 33.0)), { size: 34, weight: 600, track: 22, align: 'center', alpha: sl * 0.85 });
  // Kayseri marker
  const km = E.outBack(seg(t, 8.55, 8.95)); const sK = S(P.kayseri);
  if (km > 0) {
    const ring = seg(t, 8.55, 9.6);
    ctx.save(); ctx.globalAlpha = alpha * (1 - ring) * 0.9; ctx.strokeStyle = GOLD2; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sK[0], sK[1], 8 + ring * 60, 0, 7); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sK[0], sK[1], 7 * km, 0, 7); ctx.fill(); ctx.restore();
    txt('KAYSERİ', sK[0] + 20, sK[1] - 14, { size: 28, weight: 700, track: 6, alpha: alpha * clamp(km) * (1 - seg(t, 11.0, 11.3)) });
  }
  // Erciyes + Aladağlar + Kapuzbaşı glyphs
  const ga = E.out(seg(t, 9.7, 10.3)) * alpha * (1 - seg(t, 11.0, 11.3));
  const tri = (q, s, a) => { const p = S(q); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(240,230,210,0.9)'; ctx.beginPath(); ctx.moveTo(p[0], p[1] - s); ctx.lineTo(p[0] + s * 0.9, p[1] + s * 0.55); ctx.lineTo(p[0] - s * 0.9, p[1] + s * 0.55); ctx.closePath(); ctx.fill(); ctx.restore(); return p; };
  if (ga > 0) {
    const e = tri(P.erciyes, 13, ga); txt('Erciyes', e[0] + 18, e[1] + 8, { size: 22, fam: 'Playfair Display', style: 'italic', weight: 400, alpha: ga });
    const al = S(P.aladag); for (const [dx, dy, s] of [[-26, 6, 12], [0, -4, 17], [24, 8, 12], [12, 22, 10]]) tri([P.aladag[0] + dx / k, P.aladag[1] + dy / k], s, ga);
    txt('ALADAĞLAR', al[0] - 30, al[1] + 58, { size: 22, weight: 600, track: 6, align: 'center', alpha: ga, color: GOLD2 });
  }
  // distance label
  if (rp > 0.05) { const mid = S(bez(0.5)); const v = Math.round(80 * E.out(seg(t, 9.3, 10.4)));
    txt(`≈ ${v} km`, mid[0] - 26, mid[1] + 8, { size: 30, fam: 'Bebas Neue', weight: 400, track: 2, align: 'right', alpha: alpha * E.out(seg(t, 9.35, 9.7)) * (1 - seg(t, 11.0, 11.3)), color: GOLD2 }); }
  // moving head dot
  if (rp > 0 && rp < 1) { const h = S(bez(rp)); ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(SPRITE, h[0] - 22, h[1] - 22, 44, 44); ctx.restore(); }
  // Yahyalı pin
  const yp = seg(t, 10.45, 10.85); const sY = S(P.yahyali);
  if (yp > 0) {
    const drop = (1 - E.outBack(yp)) * -60;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(sY[0], sY[1] + drop);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, -34, 16, Math.PI * 0.85, Math.PI * 2.15); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b8862f'; ctx.beginPath(); ctx.arc(0, -34, 6.5, 0, 7); ctx.fill(); ctx.restore();
    const ring = seg(t, 10.85, 11.6); ctx.save(); ctx.globalAlpha = alpha * (1 - ring); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(sY[0], sY[1], 10 + ring * 70, (10 + ring * 70) * 0.45, 0, 0, 7); ctx.stroke(); ctx.restore();
    txt('YAHYALI', sY[0] + 26, sY[1] - 30, { size: 40, weight: 700, track: 8, alpha: alpha * E.out(seg(t, 10.6, 10.9)) * (1 - seg(t, 11.15, 11.45)) });
  }
  ctx.restore();
}

// ---------------------------------------------------------------- carpet (procedural Anatolian village rug)
function buildCarpet() {
  const cols = 45, rows = 67, s = 12, Wc = cols * s, Hc = rows * s;
  const C = { brown: [59, 36, 22], red: [155, 34, 38], dred: [109, 26, 29], indigo: [34, 51, 92], ivory: [239, 226, 196], gold: [211, 155, 42], green: [79, 107, 58], blue: [95, 143, 176] };
  const cx = (cols - 1) / 2, cy = (rows - 1) / 2; const grid = [];
  for (let r = 0; r < rows; r++) {
    grid.push([]);
    for (let c = 0; c < cols; c++) {
      const bx = Math.min(c, cols - 1 - c), by = Math.min(r, rows - 1 - r), b = Math.min(bx, by);
      let col;
      if (b === 0) col = C.brown;
      else if (b === 1) col = C.gold;
      else if (b <= 6) { // main border: ivory with alternating diamonds
        const along = (bx < by) ? r : c, mid = 3.5, k = ((along + 3) % 8) - 3.5, d = Math.abs(k) + Math.abs(b - mid);
        col = d <= 1.6 ? (Math.floor((along + 3) / 8) % 2 ? C.indigo : C.red) : (d <= 2.6 ? C.dred : C.ivory);
      } else if (b === 7) col = C.gold;
      else if (b === 8) col = C.brown;
      else { // field
        const u = Math.abs(c - cx), v = Math.abs(r - cy), dm = u / 14 + v / 22;
        col = C.red;
        if (dm <= 1.0) { col = C.indigo; if (dm > 0.9) col = C.ivory; else if (dm <= 0.62) { col = C.red; if (dm > 0.55) col = C.ivory; if (dm <= 0.32) { col = C.gold; if (u + v <= 2) col = C.indigo; } } }
        // ram's-horn hooks on the medallion edge
        if (dm > 1.0 && dm < 1.18 && ((Math.round(v) % 4) === 0) && u > 2) col = C.indigo;
        // corner spandrels
        const su = Math.min(c - 9, cols - 10 - c), sv = Math.min(r - 9, rows - 10 - r);
        if (su >= 0 && sv >= 0 && su + sv * 0.7 < 6) col = (su + sv * 0.7 < 4.6) ? C.indigo : C.ivory;
        // 8-point stars in the field
        for (const [sxs, sys] of [[cx, 12.5], [cx, rows - 13.5], [13, cy], [cols - 14, cy]]) { const du = Math.abs(c - sxs), dv = Math.abs(r - sys); if ((du <= 2.2 && dv <= 0.6) || (dv <= 2.2 && du <= 0.6) || (du + dv <= 2)) col = (du + dv <= 0.6) ? C.gold : C.ivory; }
      }
      grid[r].push(col);
    }
  }
  const cvs = document.createElement('canvas'); cvs.width = Wc; cvs.height = Hc; const g = cvs.getContext('2d'); const r = rng(42);
  for (let y = 0; y < rows; y++) {
    const abrash = 0.93 + 0.1 * Math.sin(y * 0.37) + 0.04 * Math.sin(y * 1.7);
    for (let x = 0; x < cols; x++) {
      const [R, G, B] = grid[y][x], j = abrash * (0.95 + 0.1 * r());
      g.fillStyle = `rgb(${R * j | 0},${G * j | 0},${B * j | 0})`; g.fillRect(x * s, y * s, s, s);
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x * s + 1, y * s + 1, s - 3, 2);        // wool highlight
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x * s, y * s + s - 2, s, 2);                 // knot row line
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x * s + s - 1, y * s, 1, s);
    }
  }
  return { cvs, cols, rows, s, Wc, Hc };
}
function drawWeaving(t, alpha, t0) {
  if (alpha <= 0) return; const Cp = CARPET;
  ctx.save(); ctx.globalAlpha = alpha;
  const bg = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7); bg.addColorStop(0, '#3a2418'); bg.addColorStop(1, '#120a06'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const tw = t - t0; const zoom = lerp(1.32, 1.12, E.sine(seg(tw, 0, 3.4))); const rot = lerp(-0.035, 0, E.sine(seg(tw, 0, 3.4)));
  ctx.translate(W / 2, H / 2 + 20); ctx.rotate(rot); ctx.scale(zoom, zoom); ctx.translate(-Cp.Wc / 2, -Cp.Hc / 2);
  const prog = E.sine(seg(tw, 0.15, 3.3)) * Cp.rows; const full = Math.floor(prog), frac = prog - full;
  const yTop = Cp.Hc - full * Cp.s;
  // warp threads (upper, unwoven part) + loom bars
  ctx.fillStyle = '#5a3b22'; ctx.fillRect(-40, -46, Cp.Wc + 80, 26); ctx.fillRect(-40, Cp.Hc + 18, Cp.Wc + 80, 26);
  ctx.strokeStyle = 'rgba(236,224,196,0.75)'; ctx.lineWidth = 1.4;
  for (let i = 0; i <= Cp.cols * 2; i++) { const x = i * Cp.s / 2; ctx.beginPath(); ctx.moveTo(x, -20); ctx.lineTo(x, yTop); ctx.stroke(); }
  // woven part
  ctx.drawImage(Cp.cvs, 0, yTop, Cp.Wc, full * Cp.s, 0, yTop, Cp.Wc, full * Cp.s);
  if (full < Cp.rows) { const kw = Math.floor(frac * Cp.cols) * Cp.s; ctx.drawImage(Cp.cvs, 0, yTop - Cp.s, kw, Cp.s, 0, yTop - Cp.s, kw, Cp.s); }
  // comb (kirkit) beating on each row
  const beat = (tw * 3) % 1, by = yTop - Cp.s - 8 + (beat < 0.25 ? Math.sin(beat / 0.25 * Math.PI) * 8 : 0);
  if (full < Cp.rows) { ctx.fillStyle = '#2a1a10'; ctx.fillRect(-10, by - 10, Cp.Wc + 20, 12); ctx.fillStyle = 'rgba(255,220,170,0.25)'; ctx.fillRect(-10, by - 10, Cp.Wc + 20, 2); }
  ctx.restore();
  // warm light
  ctx.save(); ctx.globalCompositeOperation = 'screen'; const lg = ctx.createRadialGradient(W * 0.25, H * 0.15, 0, W * 0.25, H * 0.15, W * 0.6);
  lg.addColorStop(0, `rgba(255,190,120,${0.22 * alpha})`); lg.addColorStop(1, 'rgba(255,190,120,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H); ctx.restore();
}
function drawRugShowcase(t, alpha, t0) {
  if (alpha <= 0) return; ctx.save(); ctx.globalAlpha = alpha;
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#24140c'); bg.addColorStop(1, '#0d0805'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const tw = t - t0, z = lerp(1.0, 1.06, E.sine(seg(tw, 0, 3.6)));
  const id = null; const img = CARPET.cvs;
  const hh = 820 * z, ww = hh * img.width / img.height, x = W * 0.70 - ww / 2, y = H / 2 - hh / 2;
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 20; ctx.drawImage(img, x, y, ww, hh); ctx.shadowColor = 'transparent';
  ctx.restore();
  const a = alpha * env(t, t0 + 0.3, t0 + 3.6, 0.5, 0.4);
  const p = E.out(seg(t, t0 + 0.3, t0 + 1.1));
  line(150, 380, 150 + 90 * p, 380, GOLD, 3, a);
  txt('YAHYALI', 150, 470, { size: 96, fam: 'Playfair Display', weight: 700, track: 6, alpha: a * p });
  txt('HALISI', 150, 565, { size: 96, fam: 'Playfair Display', weight: 700, track: 6, alpha: a * p });
  const l1 = E.out(seg(t, t0 + 0.9, t0 + 1.5)), l2 = E.out(seg(t, t0 + 1.2, t0 + 1.8));
  txt('Tescilli coğrafi işaret · 1996', 152, 650, { size: 30, weight: 500, alpha: a * l1, color: GOLD2 });
  txt('%100 yün · el dokuması', 152, 700, { size: 30, weight: 500, alpha: a * l2, color: '#f2e6d0' });
  if (id) credit(id, alpha);
}

// ---------------------------------------------------------------- end card
function makeEndBackground() {
  // render the final scene once (before any frame is drawn) and keep a blurred, darkened copy
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  drawLand('final', 55.0, 1, CAM(1.0, 1.0, 0, 0, 0, 0), 1);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.filter = 'blur(22px) brightness(0.62) saturate(1.1)'; g.drawImage(cv, -40, -30, W + 80, H + 60); BLURCACHE.end = c;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
}
function endCard(t, t0, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha; const z = lerp(1.0, 1.05, seg(t, t0, 60)); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.drawImage(BLURCACHE.end, -W / 2, -H / 2); ctx.restore();
  ctx.save(); ctx.globalAlpha = alpha * 0.35; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore();
  const p = E.outExpo(seg(t, t0 + 0.2, t0 + 2.4)), a = alpha;
  txt('YAHYALI', W / 2, H / 2 + 20, { size: 170, fam: 'Playfair Display', weight: 700, track: lerp(10, 30, p), align: 'center', alpha: a * E.out(seg(t, t0 + 0.2, t0 + 0.9)), blur: (1 - E.out(seg(t, t0 + 0.2, t0 + 0.9))) * 14 });
  const p2 = E.outExpo(seg(t, t0 + 0.7, t0 + 1.7)); line(W / 2 - 300 * p2, H / 2 + 70, W / 2 + 300 * p2, H / 2 + 70, GOLD, 2, a);
  txt('Dağ  ·  Su  ·  Emek', W / 2, H / 2 + 140, { size: 44, fam: 'Playfair Display', style: 'italic', weight: 400, align: 'center', alpha: a * E.out(seg(t, t0 + 1.0, t0 + 1.8)) });
  txt('KAYSERİ  ·  TÜRKİYE', W / 2, H / 2 - 150, { size: 24, weight: 600, track: 14, align: 'center', alpha: a * E.out(seg(t, t0 + 0.5, t0 + 1.3)), color: GOLD2 });
  const ca = a * E.out(seg(t, t0 + 1.6, t0 + 2.4)) * 0.85;
  txt('Görseller: özgün dijital illüstrasyon ve animasyon   ·   Harita verisi: turkey-map-react (MIT)', W / 2, H - 92, { size: 16, weight: 300, align: 'center', alpha: ca });
  txt('Müzik ve ses efektleri: özgün sentez', W / 2, H - 62, { size: 16, weight: 300, align: 'center', alpha: ca });
}

// ---------------------------------------------------------------- shot list (illustrated scenes from land.js)
const CAM = (z0, z1, x0 = 0, x1 = 0, y0 = 0, y1 = 0, ease = 'lin') => ({ z: [z0, z1], x: [x0, x1], y: [y0, y1], ease });
const SHOTS = [
  { t0: 0.0, t1: 4.35, scene: 'hook_falls', cam: CAM(1.0, 1.12, 0, 0, 60, -30), fade: 1.4, mode: 'mist' },
  { t0: 4.05, t1: 7.75, scene: 'panorama', cam: CAM(1.03, 1.1, 170, -170), fade: 0.6, mode: 'dust' },
  { t0: 7.35, t1: 11.62, special: 'map', fade: 0.45 },
  { t0: 11.6, t1: 15.0, scene: 'town', cam: CAM(1.2, 1.03, -80, 60, 20, 0), fade: 0 },
  { t0: 14.63, t1: 18.95, scene: 'aladag_tilt', cam: CAM(1.04, 1.08, 0, 40, -600, 1250, 'inOut'), fade: 0.5, mode: 'dust' },
  { t0: 18.65, t1: 21.95, scene: 'peaks_clouds', cam: CAM(1.05, 1.15, -150, 150), fade: 0.55 },
  { t0: 21.7, t1: 25.45, scene: 'winter', cam: CAM(1.05, 1.15, 0, 0, 40, -20), fade: 0.6, mode: 'snow', modeEnd: 24.6 },
  { t0: 25.3, t1: 28.5, scene: 'kapuz', cam: CAM(1.22, 1.05), fade: 0, mode: 'mist' },
  { t0: 28.2, t1: 31.3, scene: 'kapuz_close', cam: CAM(1.06, 1.16, 160, -130), fade: 0.5, mode: 'mist' },
  { t0: 31.0, t1: 34.05, scene: 'canyon', cam: CAM(1.16, 1.05, -170, 120), fade: 0.3 },
  { t0: 33.75, t1: 39.9, scene: 'river', cam: CAM(1.04, 1.16, -130, 170), fade: 0.6 },
  { t0: 39.4, t1: 41.6, scene: 'yayla', cam: CAM(1.04, 1.12, 110, -90), fade: 0.45, mode: 'dust' },
  { t0: 41.3, t1: 44.95, special: 'weave', fade: 0.45 },
  { t0: 44.6, t1: 48.2, special: 'rug', fade: 0.45 },
  { t0: 48.6, t1: 49.6, scene: 'peaks_clouds', cam: CAM(1.32, 1.18, 0, 0, 40, 30), fade: 0 },
  { t0: 49.6, t1: 50.6, scene: 'kapuz_close', cam: CAM(1.3, 1.16), fade: 0, mode: 'mist' },
  { t0: 50.6, t1: 51.95, special: 'carpetClose', fade: 0 },
  { t0: 51.9, t1: 55.5, scene: 'final', cam: CAM(1.18, 1.0, 0, 0, 30, 0), fade: 0.4 },
  { t0: 55.0, t1: 60.0, special: 'end', fade: 0.6 },
];
function shotAlpha(sh, t) {
  if (t < sh.t0 || t > sh.t1) return 0;
  return sh.fade > 0 ? E.sine(seg(t, sh.t0, sh.t0 + sh.fade)) : 1;
}
function drawShot(sh, t, a) {
  const p = seg(t, sh.t0, sh.t1);
  if (sh.special === 'map') return drawMap(t, a);
  if (sh.special === 'weave') return drawWeaving(t, a, sh.t0);
  if (sh.special === 'rug') return drawRugShowcase(t, a, sh.t0);
  if (sh.special === 'end') return endCard(t, sh.t0, a);
  if (sh.special === 'carpetClose') {
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#140b06'; ctx.fillRect(0, 0, W, H);
    const z = lerp(3.4, 2.9, p), c = CARPET; ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.drawImage(c.cvs, -c.Wc / 2, -c.Hc / 2); ctx.restore(); return;
  }
  const pe = sh.cam.ease === 'inOut' ? E.inOut(p) : p;
  drawLand(sh.scene, t, pe, sh.cam, a);
  if (sh.mode) particles(t, sh.t0, a * env(t, sh.t0, sh.modeEnd || sh.t1, 0.6, 0.6), sh.mode);
}

// ---------------------------------------------------------------- frame
window.renderFrame = function (t) {
  const frame = Math.round(t * 30);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const credits = [];
  for (const sh of SHOTS) {
    const a = shotAlpha(sh, t); if (a <= 0) continue;
    const id = drawShot(sh, t, a); if (id && typeof id === 'string') credits.push([id, a * env(t, sh.t0, sh.t1, 0.5, 0.3)]);
  }
  // whip-pan motion blur around 31.0
  const wp = 1 - Math.abs(t - 31.0) / 0.2;
  if (wp > 0) { const snap = document.createElement('canvas'); snap.width = W; snap.height = H; snap.getContext('2d').drawImage(cv, 0, 0);
    ctx.save(); for (let i = 1; i <= 8; i++) { ctx.globalAlpha = 0.16 * wp; ctx.drawImage(snap, (i - 4.5) * 34 * wp, 0); } ctx.restore(); }
  // map zoom-rush blur into title
  const zr = seg(t, 11.2, 11.6);
  if (zr > 0 && t < 11.6) { const snap = document.createElement('canvas'); snap.width = W; snap.height = H; snap.getContext('2d').drawImage(cv, 0, 0);
    ctx.save(); for (let i = 1; i <= 6; i++) { const s = 1 + i * 0.03 * zr; ctx.globalAlpha = 0.2 * zr; ctx.drawImage(snap, W / 2 - W * s / 2, H / 2 - H * s / 2, W * s, H * s); } ctx.restore(); }
  // grade + vignette (photo sections)
  if (!(t >= 7.4 && t < 11.6)) grade();
  ctx.drawImage(VIGN, 0, 0);
  // texts
  bigNumber(t, 2.25, 4.15, '7', 'ŞELALE');
  txt('TOROS DAĞLARI\'NIN ETEĞİNDE', W / 2, 520, { size: 24, weight: 500, track: 10, align: 'center', alpha: env(t, 4.5, 7.3, 0.5, 0.35) * 0.95 });
  wordsReveal(t, 5.75, 7.35, ['SAKLI', 'BİR', 'CENNET'], [5.95, 6.25, 6.5], 610);
  mainTitle(t, 11.6, 14.75);
  lowerThird(t, 15.3, 18.6, 'ALADAĞLAR', 'Aladağlar Milli Parkı · Toros Dağları');
  counter(t, 18.75, 21.65, 19.15, 20.6);
  lowerThird(t, 22.3, 25.2, 'DEREBAĞ ŞELALESİ', 'Kışın biriken kar suya dönüşür');
  sectionTitle(t, 25.65, 28.25, 'KAPUZBAŞI', 'ŞELALELERİ');
  chips(t, 28.45, 31.0, ['7 ŞELALE', '30–76 m', 'ALADAĞLAR MİLLİ PARKI'], '37°46′ K  ·  35°23′ D');
  lowerThird(t, 31.55, 39.2, 'ZAMANTI IRMAĞI', 'Seyhan\'ın en büyük kolu'); riverLine(t, 31.55, 39.2);
  lowerThird(t, 39.65, 41.2, 'YAYLALAR', 'Kıl çadırlar, serin yaz meraları');
  txt('İ L M E K', 330, 500, { size: 46, weight: 300, track: 8, align: 'center', alpha: env(t, 41.9, 44.6, 0.6, 0.4) });
  txt('İ L M E K', 330, 570, { size: 46, weight: 300, track: 8, align: 'center', alpha: env(t, 42.3, 44.6, 0.6, 0.4) });
  giantWord(t, 48.6, 49.6, 'DAĞ'); giantWord(t, 49.6, 50.6, 'SU'); giantWord(t, 50.6, 51.9, 'EMEK');
  // photo credits
  for (const [id, a] of credits) credit(id, a);
  // flashes / leaks
  flash(t, 11.6, 0.08, 0.7, 1); flash(t, 25.3, 0.05, 0.45, 0.85); for (const tc of [48.6, 49.6, 50.6]) flash(t, tc, 0.03, 0.3, 0.55);
  leak(t, 11.75, 1.6, 0.5); leak(t, 25.4, 1.4, 0.45, 1.2, -0.2); leak(t, 51.9, 2.2, 0.35); leak(t, 55.0, 2.5, 0.3, 1.1, -0.1);
  // fade from/to black
  const fb = Math.max(1 - seg(t, 0, 1.1), seg(t, 59.0, 60.0), (t >= 48.2 && t < 48.6) ? 1 : 0);
  if (fb > 0) { ctx.save(); ctx.globalAlpha = fb; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  grain(frame, 0.035);
};
init().catch(e => { console.error(e); window.INIT_ERROR = String(e); });
