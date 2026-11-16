// rec.js: shared helper for recording GIFs and stills of the GRAVITRON game with Playwright.
// The game under test is a read-only export of the release/v2.1 branch (never edit it):
//   GAME = <scratchpad>/v21/game21     (override with env GAME)
// Everything a clip produces goes under <scratchpad>/v21/clips/<name>/.
//
// Usage (see the bottom of this file for a worked example):
//   const R = require('/abs/path/to/v21/tools/rec.js');
//   const s = await R.open({ name: 'home' });            // desktop 1280x800, fresh localStorage, game loaded
//   const cap = R.startCapture(s.page, 'home', { clip: { x: 0, y: 0, width: 1280, height: 800 }, fps: 10 });
//   ... drive the page (clicks, keys, waits) ...
//   const info = await cap.stop();                        // { frames, seconds, fps, dir }
//   await R.still(s.page, 'home', 'poster');              // clips/home/poster.jpg (viewport, quality 90)
//   await s.close();
//   const g = R.makeGif('home', { width: 900 });          // clips/home/home.gif + home-lite.gif, returns sizes
//
// Notes
// - Frames are lossless PNG screenshots of a clip rectangle, taken in a loop while your code drives the page,
//   so text stays crisp. Expect 7 to 11 frames a second at 1280x800; the real rate is measured and used for the GIF.
// - Keep clips short: 3 to 9 seconds of the interesting part only. Trim with { from, to } (frame numbers) in makeGif.
// - Move the mouse off the content before capturing (R.park(page)) unless the hover IS the point.
// - The page plays sound through WebAudio; headless Chromium is silent. Nothing to do.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GAME = process.env.GAME || path.join(ROOT, 'game21');
const CLIPS = path.join(ROOT, 'clips');
const URL = 'file://' + path.join(GAME, 'index.html');
const sleep = (page, ms) => page.waitForTimeout(ms);

// Opens the game. opts: { name, phone (390x844 touch), width, height, storage: {key: value} set before load,
// keepStorage (do not clear), query ('?offline=1'), scale (deviceScaleFactor for stills, default 1) }.
async function open(opts) {
  opts = opts || {};
  const dir = path.join(CLIPS, opts.name || 'misc');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext(opts.phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: opts.scale || 2, isMobile: true, hasTouch: true }
    : { viewport: { width: opts.width || 1280, height: opts.height || 800 }, deviceScaleFactor: opts.scale || 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => { errors.push(String(e)); console.log('PAGE ERROR', String(e).slice(0, 300)); });
  const url = URL + (opts.query || '');
  await page.goto(url);
  if (!opts.keepStorage) {
    await page.evaluate(s => { localStorage.clear(); sessionStorage.clear(); for (const k in (s || {})) localStorage.setItem(k, s[k]); }, opts.storage || null);
    await page.goto(url);
  }
  await sleep(page, 2500);   // fonts, the low-poly scenes and the entry animation
  return { browser, ctx, page, dir, errors, url, close: async () => { await ctx.close(); await browser.close(); } };
}

const park = async page => { const v = page.viewportSize(); await page.mouse.move(v.width - 2, v.height - 2); };
const text = async page => (await page.innerText('body')).replace(/\s+/g, ' ').trim();
const keys = async (page, re) => page.$$eval('[data-key]', (els, src) => els.map(e => e.getAttribute('data-key')).filter(k => !src || new RegExp(src).test(k)), re ? re.source : null);
const buttons = async page => page.$$eval('button', els => els.filter(e => e.offsetParent !== null).map(e => (e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim() + (e.disabled ? ' [disabled]' : '')).filter(Boolean));

// Takes frames of `clip` (default: the viewport) in a loop until stop() is called. Run your page actions meanwhile.
function startCapture(page, name, opts) {
  opts = opts || {};
  const dir = path.join(CLIPS, name, opts.sub || 'frames');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const gap = 1000 / (opts.fps || 10);
  let on = true, n = 0;
  const t0 = Date.now();
  const stamps = [];
  const loop = (async () => {
    while (on) {
      const t = Date.now();
      try {
        await page.screenshot({ path: path.join(dir, 'f' + String(++n).padStart(4, '0') + '.png'), clip: opts.clip, animations: 'allow', caret: 'initial' });
        stamps.push(Date.now() - t0);
      } catch (e) { n--; if (!on) break; }
      const spent = Date.now() - t;
      if (spent < gap) await new Promise(r => setTimeout(r, gap - spent));
    }
  })();
  return {
    dir,
    count: () => n,
    stop: async () => {
      on = false; await loop;
      const seconds = (Date.now() - t0) / 1000;
      const info = { frames: n, seconds: +seconds.toFixed(2), fps: +(n / seconds).toFixed(2), dir, stamps };
      fs.writeFileSync(path.join(dir, '..', (opts.sub || 'frames') + '.json'), JSON.stringify(info));
      return info;
    }
  };
}

// A JPEG still. what: undefined (viewport), a clip {x,y,width,height}, or a selector string (that element).
async function still(page, name, file, what, quality) {
  const out = path.join(CLIPS, name, file + '.jpg');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (typeof what === 'string') await page.locator(what).first().screenshot({ path: out, type: 'jpeg', quality: quality || 90 });
  else await page.screenshot({ path: out, type: 'jpeg', quality: quality || 90, clip: what || undefined });
  return out;
}

// Builds clips/<name>/<out>.gif (width px, 64 colours) and <out>-lite.gif (560 px, 40 colours, every 2nd frame).
// opts: { sub ('frames'), out (name), from, to (1-based frame numbers, inclusive), width (900), colors (64), speed (1 = real time,
// 2 = twice as fast), holdLast (seconds the last frame is held, default 1.2), lite: false to skip }.
function makeGif(name, opts) {
  opts = opts || {};
  const base = path.join(CLIPS, name);
  const sub = opts.sub || 'frames';
  const info = JSON.parse(fs.readFileSync(path.join(base, sub + '.json'), 'utf8'));
  const from = opts.from || 1, to = Math.min(opts.to || info.frames, info.frames);
  const tmp = path.join(base, sub + '-cut');
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
  let k = 0;
  for (let i = from; i <= to; i++) fs.copyFileSync(path.join(base, sub, 'f' + String(i).padStart(4, '0') + '.png'), path.join(tmp, 'c' + String(++k).padStart(4, '0') + '.png'));
  const hold = Math.round((opts.holdLast == null ? 1.2 : opts.holdLast) * info.fps);
  for (let h = 0; h < hold; h++) fs.copyFileSync(path.join(tmp, 'c' + String(k).padStart(4, '0') + '.png'), path.join(tmp, 'c' + String(k + 1 + h).padStart(4, '0') + '.png'));
  const rate = (info.fps * (opts.speed || 1)).toFixed(3);
  const outName = opts.out || name;
  const run = (file, width, colors, pick) => {
    const vf = (pick ? "select='not(mod(n\\," + pick + "))',setpts=N/(" + rate + "/" + pick + ")/TB," : '') +
      'scale=' + width + ':-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=' + colors + ':stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle';
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', rate, '-i', path.join(tmp, 'c%04d.png'), '-vf', vf,
      ...(pick ? ['-r', (rate / pick).toFixed(3)] : []), '-loop', '0', file]);
    return Math.round(fs.statSync(file).size / 1024);
  };
  const full = path.join(base, outName + '.gif'), lite = path.join(base, outName + '-lite.gif');
  const res = { gif: full, kb: run(full, opts.width || 900, opts.colors || 64, 0), frames: k + hold, fps: +rate };
  if (opts.lite !== false) { res.lite = lite; res.liteKb = run(lite, opts.liteWidth || 560, opts.liteColors || 40, 2); }
  fs.rmSync(tmp, { recursive: true, force: true });
  return res;
}

// A contact sheet (JPEG) of evenly spaced frames, for checking a clip by eye: clips/<name>/<out>-sheet.jpg
function sheet(name, opts) {
  opts = opts || {};
  const base = path.join(CLIPS, name), sub = opts.sub || 'frames';
  const info = JSON.parse(fs.readFileSync(path.join(base, sub + '.json'), 'utf8'));
  const from = opts.from || 1, to = Math.min(opts.to || info.frames, info.frames), n = opts.n || 12;
  const picks = [];
  for (let i = 0; i < n; i++) picks.push(Math.round(from + (to - from) * i / Math.max(1, n - 1)));
  const out = path.join(base, (opts.out || name) + '-sheet.jpg');
  const inputs = [...new Set(picks)].map(i => path.join(base, sub, 'f' + String(i).padStart(4, '0') + '.png'));
  execFileSync('convert', [...inputs, '-resize', (opts.cell || 640) + 'x', '-background', '#222', '-bordercolor', '#222', '-border', '4',
    '-append', '-quality', '82', out + '.tmp.jpg']);
  // montage in a grid of `cols` columns
  execFileSync('montage', [...inputs, '-tile', (opts.cols || 3) + 'x', '-geometry', (opts.cell || 640) + 'x+6+6', '-background', '#222', '-quality', '82', out]);
  fs.rmSync(out + '.tmp.jpg', { force: true });
  return out;
}

module.exports = { ROOT, GAME, CLIPS, URL, open, sleep, park, text, keys, buttons, startCapture, still, makeGif, sheet };

// Worked example: node rec.js   -> clips/_smoke/_smoke.gif
if (require.main === module) {
  (async () => {
    const s = await open({ name: '_smoke' });
    console.log('title:', await s.page.title());
    console.log('data-keys:', (await keys(s.page)).join(' '));
    console.log('buttons:', (await buttons(s.page)).join(' | '));
    await park(s.page);
    const cap = startCapture(s.page, '_smoke', { fps: 10 });
    await sleep(s.page, 3000);
    const info = await cap.stop();
    await still(s.page, '_smoke', 'poster');
    await s.close();
    console.log('capture', info.frames, 'frames in', info.seconds, 's =', info.fps, 'fps');
    console.log(makeGif('_smoke', { width: 900 }));
    console.log(sheet('_smoke', { n: 6, cols: 3, cell: 420 }));
    console.log('errors:', s.errors.length);
  })().catch(e => { console.error(e); process.exit(1); });
}
