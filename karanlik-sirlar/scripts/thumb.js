// Renders the 1280x720 YouTube thumbnail: node scripts/thumb.js <out.jpg> [k] [s] [n] [font-size]
const { chromium } = require('playwright');
(async () => {
  const [out, k, s, n, ks] = process.argv.slice(2);
  const q = new URLSearchParams({ img: '/out/thumb_bg.jpg', pos: '58% 20%' }); if (k !== undefined) q.set('k', k); if (s !== undefined) q.set('s', s); if (n !== undefined) q.set('n', n);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await p.goto('http://127.0.0.1:8768/render/thumb/index.html?' + q.toString());
  if (ks) await p.evaluate(v => document.documentElement.style.setProperty('--ks', v), ks);
  await p.waitForFunction('window.READY===true'); await p.waitForTimeout(300);
  await p.screenshot({ path: out, type: 'jpeg', quality: 92 }); await b.close();
})();
