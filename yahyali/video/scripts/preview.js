// node preview.js out.png t1 t2 ... -> contact sheet of frames (each 640x360) for quick inspection
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [out, ...ts] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto('http://127.0.0.1:8765/render/index.html'); await p.waitForFunction('window.READY===true || window.INIT_ERROR', null, { timeout: 60000 });
  const err = await p.evaluate('window.INIT_ERROR'); if (err) { console.log('INIT_ERROR', err); process.exit(1); }
  const shots = [];
  for (const t of ts.map(Number)) { await p.evaluate(t => window.renderFrame(t), t); shots.push(await p.screenshot({ type: 'png' })); }
  // compose sheet in page
  const cols = Math.min(3, shots.length), rows = Math.ceil(shots.length / cols);
  const html = `<body style="margin:0;background:#222"><div style="display:grid;grid-template-columns:repeat(${cols},640px);gap:4px">${shots.map((s, i) => `<div style="position:relative"><img src="data:image/png;base64,${s.toString('base64')}" style="width:640px;height:360px;display:block"><span style="position:absolute;left:6px;top:4px;color:#ff0;font:bold 18px sans-serif;text-shadow:0 0 4px #000">${ts[i]}s</span></div>`).join('')}</div></body>`;
  const q = await b.newPage({ viewport: { width: cols * 644, height: rows * 364 } }); await q.setContent(html); await q.waitForTimeout(300);
  await q.screenshot({ path: out }); await b.close(); console.log('wrote', out);
})();
