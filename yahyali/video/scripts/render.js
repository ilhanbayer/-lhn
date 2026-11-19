// Deterministic frame-by-frame render: renderFrame(t) -> JPEG screenshot -> ffmpeg stdin.
const { chromium } = require('playwright'); const { spawn } = require('child_process');
(async () => {
  const out = process.argv[2], fps = 30, dur = 60, N = fps * dur;
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto('http://127.0.0.1:8765/render/index.html'); await p.waitForFunction('window.READY===true', null, { timeout: 120000 });
  const t0 = Date.now();
  for (let f = 0; f < N; f++) {
    await p.evaluate(t => window.renderFrame(t), f / fps);
    const buf = await p.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 150 === 0) console.log('frame', f, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close(); console.log('done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
})();
