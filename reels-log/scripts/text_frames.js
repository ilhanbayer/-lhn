// Renders the animated quote layer as transparent PNG frames: node text_frames.js <cfg.json> <outdir> <seconds> [fps]
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [cfgPath, out, secs, fpsArg] = process.argv.slice(2); const fps = +(fpsArg || 30); fs.mkdirSync(out, { recursive: true });
  const cfg = fs.readFileSync(cfgPath, 'utf8');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.goto('http://127.0.0.1:8770/reels-log/text/index.html?cfg=' + encodeURIComponent(cfg)); await p.waitForFunction('window.READY===true');
  const n = Math.round(+secs * fps);
  for (let f = 0; f < n; f++) { await p.evaluate(t => window.frame(t), f / fps); await p.screenshot({ path: `${out}/t${String(f).padStart(5, '0')}.png`, omitBackground: true }); }
  await b.close(); console.log('text frames', n);
})();
