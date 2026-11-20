// Renders stills at the given times: node scripts/stills.js <outdir> <scale> t1 t2 ... (prints per-frame timings)
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [out, scale, ...ts] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('[pageerror]', e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text().slice(0, 300)); });
  const t0 = Date.now(); await p.goto(`http://127.0.0.1:8767/render/index.html?scale=${scale}`); await p.waitForFunction('window.READY===true', null, { timeout: 300000 });
  console.log('ready', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  for (const t of ts) {
    const a = Date.now(); await p.evaluate(t => window.renderFrame(t), +t); const r = Date.now();
    await p.screenshot({ path: `${out}/t${String(t).padStart(6, '0')}.jpg`, type: 'jpeg', quality: 88 });
    console.log('t', t, 'render', r - a, 'ms', 'shot', Date.now() - r, 'ms');
  }
  await b.close();
})();
