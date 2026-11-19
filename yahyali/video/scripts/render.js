// Deterministic frame-by-frame render: renderFrame(t) -> JPEG screenshot -> ffmpeg stdin.
const { chromium } = require('playwright'); const { spawn } = require('child_process');
(async () => {
  const out = process.argv[2], fs = require('fs'), path = require('path');
  const wp = path.join(__dirname, '..', 'warp.json'); const warp = fs.existsSync(wp) ? JSON.parse(fs.readFileSync(wp, 'utf8')) : null;
  const fps = 30, N = warp ? warp.frames_old.length : fps * 60; const T = f => warp ? warp.frames_old[f] : f / fps;  // frame -> designed-timeline time
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto('http://127.0.0.1:8765/render/index.html'); await p.waitForFunction('window.READY===true', null, { timeout: 120000 });
  const t0 = Date.now();
  for (let f = 0; f < N; f++) {
    await p.evaluate(t => window.renderFrame(t), T(f));
    const buf = await p.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 150 === 0) console.log('frame', f, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close(); console.log('done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
})();
