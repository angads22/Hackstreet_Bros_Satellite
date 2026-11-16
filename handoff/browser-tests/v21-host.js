// The game as the team's host serves it (ONLINE.md, "Hosted on Pitstop"): from a path with a token in it, inside a sandboxed
// frame with no storage of its own, with nothing loaded from another website. Checks: every file the page asks for is
// under its own folder (relative URLs only), nothing 404s, no other host is asked for a script, style, font or image, the
// game boots and plays in the sandboxed frame with no localStorage at all, a reload keeps the place when only the host's
// localStorage exists (no sessionStorage), an old place is forgotten, the saves stay far under the host's 512 KB limit,
// and the server module still exports what the host's wrapper imports.
// Usage: node v21-host.js [shots dir]   or   node v21-host.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const T = require('./lib');
const { repo } = T.args();
const { ok, done } = T.checker();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const PREFIX = '/hack/app/tok123/';

function serve() {
  const seen = [];
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    seen.push({ path: u.pathname, status: 0 });
    const rec = seen[seen.length - 1];
    if (u.pathname === '/frame.html') { rec.status = 200; res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><title>host</title><iframe id="g" sandbox="allow-scripts" src="${PREFIX}" style="width:1366px;height:768px;border:0"></iframe>`); }
    if (!u.pathname.startsWith(PREFIX)) { rec.status = 404; res.writeHead(404); return res.end('outside the game folder'); }
    let rel = decodeURIComponent(u.pathname.slice(PREFIX.length)) || 'index.html';
    const file = path.join(repo, rel);
    if (!file.startsWith(repo) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { rec.status = 404; res.writeHead(404); return res.end('no'); }
    rec.status = 200;
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'access-control-allow-origin': '*' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, seen, origin: 'http://127.0.0.1:' + srv.address().port })));
}

(async () => {
  const { srv, seen, origin } = await serve();
  const b = await chromium.launch();

  // ---- 1. served from a token path: relative URLs only, nothing from other websites
  {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = T.watchErrors(p), other = [];
    p.on('request', r => { const u = new URL(r.url()); if (u.origin !== origin && !/^(data|blob|about):/.test(r.url())) other.push(r.resourceType() + ' ' + u.host); });
    await p.goto(origin + PREFIX);
    await p.locator('.big-title').waitFor({ timeout: 15000 });
    await p.waitForTimeout(1500);
    const bad = seen.filter(s => s.status !== 200);
    ok(bad.length === 0, 'every file the page asks for is inside its own folder and is found' + (bad.length ? ': ' + bad.slice(0, 5).map(s => s.path).join(', ') : ` (${seen.length} requests)`));
    const assets = other.filter(o => !/^(fetch|xhr) /.test(o));
    ok(assets.length === 0, 'no script, style, font or image comes from another website' + (assets.length ? ': ' + [...new Set(assets)].join(', ') : ''));
    ok(/^GRAVITRON v\d+(\.\d+)*( beta| alpha| rc)?$/.test((await p.locator('.foot').evaluate(n => [...n.childNodes].filter(c => c.nodeType === 3).map(c => c.textContent).join('').trim()))), 'the footer still reads GRAVITRON v<number> (the host reads it)');
    ok(await p.evaluate(() => typeof ONLINE === 'object' && ONLINE.endpoint === ''), 'ONLINE.endpoint is empty in the repo (the host fills it in)');
    ok(errors.filter(e => !/Failed to load resource|ERR_|net::/.test(e)).length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' / ') : ''));
    await p.close();
  }

  // ---- 2. inside a sandboxed frame with no storage at all: the game boots and plays
  {
    const p = await b.newPage({ viewport: { width: 1400, height: 800 } });
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.goto(origin + '/frame.html');
    const f = p.frameLocator('#g');
    ok(await f.locator('.big-title').waitFor({ timeout: 15000 }).then(() => true, () => false), 'sandboxed frame: the home page shows');
    ok(await f.locator('.mode-card').count() >= 2, 'sandboxed frame: the mode cards show');
    await f.locator('[data-key="part1-go"]').click();
    ok(await f.locator('.intro, .screen-head h1').first().waitFor({ timeout: 8000 }).then(() => true, () => false), 'sandboxed frame: Part 1 starts with no storage');
    ok(errs.length === 0, 'sandboxed frame: no uncaught errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' / ') : ''));
    await p.close();
  }

  // ---- 3. a reload keeps the place when there is no sessionStorage (the host gives the game a localStorage only)
  {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
    await ctx.addInitScript(() => { Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }); });
    let p = await ctx.newPage();
    const errors = T.watchErrors(p);
    await T.noFonts(p);
    await p.goto(origin + PREFIX); await p.evaluate(() => localStorage.clear()); await p.reload();
    await p.click('[data-key="part1-go"]'); await T.throughBeats(p); await T.waitHead(p, 'BASE MAP');
    await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
    await T.addParts(p, T.WALK[1].parts.slice(0, 3));
    const before = await p.evaluate(() => [...document.querySelectorAll('.part[aria-pressed="true"]')].length);
    await p.reload();
    ok(await T.waitHead(p, 'BUILD').catch(() => false), 'no sessionStorage: a reload on Build comes back to Build');
    const kept = await p.evaluate(() => { try { return JSON.parse(JSON.parse(localStorage.getItem('gravitron-session-v1')).rec).design.parts.length; } catch (e) { return -1; } });
    ok(kept === 3 && before >= 1, `...with the same parts (${kept} kept)`);
    // an old place is forgotten (the page writes the place again as it is left, so age it in a new page before the game reads it)
    await p.close();
    const p2 = await ctx.newPage();
    await T.noFonts(p2);
    await p2.addInitScript(() => { try { const o = JSON.parse(localStorage.getItem('gravitron-session-v1')); if (o && o.at) { o.at = Date.now() - 4 * 60 * 60 * 1000; localStorage.setItem('gravitron-session-v1', JSON.stringify(o)); } } catch (e) {} });
    await p2.goto(origin + PREFIX);
    ok(await p2.locator('.big-title').waitFor({ timeout: 8000 }).then(() => true, () => false), 'a place older than three hours is forgotten: the title screen');
    p = p2;
    // the saves are small (the host refuses more than 512 KB)
    const bytes = await p.evaluate(() => { let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += k.length + (localStorage.getItem(k) || '').length; } return n; });
    ok(bytes < 60000, `the saves are far under the host's 512 KB (${bytes} bytes now)`);
    const fx = JSON.parse(fs.readFileSync(path.join(repo, 'tests', 'fixtures', 'player-0.9.json'), 'utf8'));
    const biggest = Math.max(...Object.values(fx.saves).map(v => v.raw.length));
    ok(biggest < 100000, `a real saved comeback is small too (${biggest} bytes for the biggest test save)`);
    ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' / ') : ''));
    await ctx.close();
  }

  // ---- 4. the server module is what the host's wrapper imports
  {
    const S = require(path.join(repo, 'server', 'server.js'));
    ok(S && typeof S.createServer === 'function', 'server/server.js exports createServer');
    const src = fs.readFileSync(path.join(repo, 'server', 'server.js'), 'utf8');
    ok(/require\.main === module/.test(src) && !/require\(["'](?!http|https|fs|path|url|crypto|os)[^"']+["']\)/.test(src), 'it listens only when run directly and needs no package');
    ok(/opts\.dataFile/.test(src) && /opts\.trustProxy/.test(src) && /opts\.rateLimit/.test(src), 'it takes dataFile, trustProxy and rateLimit');
  }

  await b.close(); srv.close();
  done();
})();
