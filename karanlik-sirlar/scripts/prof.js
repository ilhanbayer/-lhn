const { chromium } = require('playwright');
(async () => {
  const [scale, t, ...names] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }); p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto(`http://127.0.0.1:8767/render/index.html?scale=${scale}&exp=${process.env.EXP || ""}`); await p.waitForFunction('window.READY===true', null, { timeout: 300000 });
  for (const label of ['all', ...names]) {
    const tg = label === 'all' ? {} : Object.fromEntries(label.split('+').map(n => [n, false]));
    console.log(label, (await p.evaluate(([t, tg]) => window.prof(t, 3, tg), [+t, tg])).toFixed(0), 'ms');
  }
  await b.close();
})();
