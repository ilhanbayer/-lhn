// Renders frames [from, to) of the film as JPEGs (resumable): node scripts/render_frames.js <outdir> <scale> <from> <to>
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [out, scale, from, to] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
  const fps = 30, a = +from, z = +to; const name = f => `${out}/f${String(f).padStart(5, '0')}.jpg`;
  const todo = []; for (let f = a; f < z; f++) if (!fs.existsSync(name(f))) todo.push(f);
  console.log('frames to render', todo.length);
  if (!todo.length) return;
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto(`http://127.0.0.1:8767/render/index.html?scale=${scale}`); await p.waitForFunction('window.READY===true', null, { timeout: 300000 });
  const t0 = Date.now(); let n = 0;
  for (const f of todo) {
    await p.evaluate(t => window.renderFrame(t), f / fps);
    const tmp = name(f) + '.part'; await p.screenshot({ path: tmp, type: 'jpeg', quality: 93 }); fs.renameSync(tmp, name(f)); n++;
    if (n % 60 === 0) { const s = (Date.now() - t0) / 1000; console.log(`frame ${f} (${n}/${todo.length}) ${(s / n).toFixed(2)} s/frame, eta ${((todo.length - n) * s / n / 60).toFixed(0)} min`); }
  }
  await b.close(); console.log('done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
})();
