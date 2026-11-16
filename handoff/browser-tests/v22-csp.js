// The game under a STRICT content security policy, as the team's host serves it (ONLINE.md, "Hosted on Pitstop"):
// scripts, styles, images, fonts and fetch only from the site itself, so NO inline style attribute and NO data: image.
// A tour (home, Part 1 map, Build with parts, Rocket Yard, the Part 2 workshop, the title again) must raise no violation
// other than the live NASA and NOAA calls (connect-src to another host, which the game answers with its snapshot), every
// step must work (the map markers are positioned by style, so a blocked style makes them unreachable), and the portraits
// and the minimap picture must be drawn.
// Usage: node v22-csp.js [shots dir]   or   node v22-csp.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const Tc = require('./lib');
const { ok, done } = Tc.checker();
const http = require('http'), fs = require('fs'), path = require('path');
const { repo: REPO } = Tc.args();
const T = Tc;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; media-src 'self'";
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let rel = decodeURIComponent(u.pathname).replace(/^\/hack\/app\/tok\//, '') || 'index.html';
  const file = path.join(REPO, rel);
  if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'content-security-policy': CSP });
  fs.createReadStream(file).pipe(res);
});
srv.listen(0, '127.0.0.1', async () => {
  const origin = 'http://127.0.0.1:' + srv.address().port, base = origin + '/hack/app/tok/';
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const viol = {};
  await p.exposeFunction('__viol', (d, uri, where) => { const k = d + ' | ' + (uri || '').replace(origin, '').slice(0, 60) + ' | ' + where; viol[k] = (viol[k] || 0) + 1; });
  await p.addInitScript(() => { document.addEventListener('securitypolicyviolation', e => window.__viol(e.violatedDirective, e.blockedURI, (e.sourceFile || '').split('/').pop() + ':' + e.lineNumber)); });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(base); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.locator('.big-title').waitFor({ timeout: 15000 }).catch(() => console.log('NO HOME'));
  await p.waitForTimeout(1500);
  const step = async (name, fn) => { let good = true; try { await fn(); } catch (e) { good = false; console.log('     ' + String(e).slice(0, 100)); } ok(good, 'tour step works under the strict policy: ' + name); await p.waitForTimeout(600); };
  await step('part1', async () => { await p.click('[data-key="part1-go"]'); await T.throughBeats(p); await T.waitHead(p, 'BASE MAP'); });
  await step('build', async () => { await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD'); await T.addParts(p, T.WALK[1].parts); });
  await step('rocket', async () => { await p.keyboard.press('m'); await T.waitHead(p, 'BASE MAP'); await p.click('[data-key="blip-launcher"]'); await T.waitHead(p, 'LAUNCH VEHICLE'); });
  await step('part2', async () => { await p.evaluate(() => { newComeback('standard', 5); window.showComebackHub(); }); await p.waitForTimeout(800); for (let i = 0; i < 6 && !(await p.locator('.screen-head h1', { hasText: 'WORKSHOP' }).count()); i++) { const n = p.locator('.btn.primary:visible').first(); if (!(await n.count())) break; await n.click().catch(() => {}); await p.waitForTimeout(300); } await p.waitForTimeout(1200); });
  await step('quick', async () => { await p.evaluate(() => window.StarlineUI.home()); await p.waitForTimeout(800); });
  const bad = Object.entries(viol).filter(([k]) => !/^connect-src \| https?:/.test(k));
  ok(bad.length === 0, 'no policy violation except the live-data calls to other hosts' + (bad.length ? ': ' + bad.slice(0, 4).map(([k, n]) => n + 'x ' + k).join(' ; ') : ''));
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' / ') : ''));
  await p.evaluate(() => window.StarlineUI.home()); await p.waitForTimeout(300);
  await p.click('[data-key="part1-go"]'); await T.throughBeats(p); await T.waitHead(p, 'BASE MAP');
  ok(await p.locator('#minimap foreignObject canvas').count() === 1 || await p.locator('#minimap').isHidden(), 'the header minimap picture is drawn (a canvas, not a data: image)');
  ok(await p.locator('.say canvas.portrait, .say svg.portrait').count() >= 1, 'a speaker portrait is drawn');
  await b.close(); srv.close(); done();
});
