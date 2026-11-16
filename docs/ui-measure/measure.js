// docs/ui-measure/measure.js: scroll depth, task cost, hover/tap behaviour, target sizes, overlap, layout shift and
// an axe audit for Gravitron's screens, at three viewports. Nothing here edits the game.
//
//   node measure.js --repo <path to a checkout> --label before --out before.json [--overlay overlay.css] [--shots dir] [--axe <axe.min.js>]
//
// Needs Playwright (preinstalled in the cloud container). axe-core is optional (--axe path to axe.min.js).
// The repo's handoff/browser-tests/lib.js supplies the proof designs (CONTRACT, WALK) and helpers.
// What it counts, and how:
//  * One scroll = one mouse-wheel gesture of 0.8 viewport heights. Playwright scrolls targets into view silently, so this
//    script checks each target against the viewport first (with elementFromPoint, so the sticky header counts as covering)
//    and counts the scrolls itself. A hover is a hover over an element to read something; a click is a click.
//  * "Visible without scrolling" means the top of the element (up to 40 px of it) is on screen and not covered.
//  * Live-data hosts are blocked so every run draws the same events; real fonts are loaded (document.fonts.ready).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const arg = n => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : null; };
const REPO = path.resolve(arg('repo') || '.'), LABEL = arg('label') || 'run', OUT = arg('out') || 'measure.json';
const OVERLAY = arg('overlay') ? fs.readFileSync(arg('overlay'), 'utf8') : '', SHOTS = arg('shots'), AXE = arg('axe');
const T = require(path.join(REPO, 'handoff/browser-tests/lib.js'));
const VIEWPORTS = (arg('only') ? [{ '1920': { name: '1920x1080', w: 1920, h: 1080, touch: false }, '1366': { name: '1366x768', w: 1366, h: 768, touch: false }, '390': { name: '390x844', w: 390, h: 844, touch: true } }[arg('only')]] : [{ name: '1920x1080', w: 1920, h: 1080, touch: false }, { name: '1366x768', w: 1366, h: 768, touch: false }, { name: '390x844', w: 390, h: 844, touch: true }]);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const f = path.join(REPO, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
      fs.readFile(f, (e, buf) => { if (e) { rsp.writeHead(404); rsp.end(); } else { rsp.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); rsp.end(buf); } });
    }).listen(0, () => res({ srv, url: 'http://localhost:' + srv.address().port + '/' }));
  });
}

// Always-visible sets per screen: what the player needs while doing the screen's job. Missing selector = loud failure.
const KEYS = {
  home: { 'start Part 1': '[data-key="part1-go"]', 'start Part 2': '[data-key="part2-go"]' },
  picker: { 'level cards': '.cb-levels', 'back': '[data-key="picker-home"]' },
  workshop: { 'debt/cash/months': '.cb-stakes', 'contract cards': '.cb-board', 'first FLY THIS': '[data-key^="fly-"]' },
  map: { 'route to the next place': '[data-key="map-enter"], .map-layout button.primary, .map-layout .btn.primary' },
  build: { 'status (cash/debt)': '#status', 'part bins': '.bins', 'satellite': '.bench', 'part cards': '[data-key^="part-"]',
    'pay line': '[data-key="contract-pay"], .payout-line', 'four bars': '.bars', 'science preview': '.science-total', 'next button': '.nav-row .btn.primary' },
  rocket: { 'rocket cards': '[data-key^="rocket-"]', 'next button': '.nav-row .btn.primary' },
  readiness: { 'verdict': '.verdict', 'LAUNCH': '.btn.big', 'checks or forecast': '.launch-control' },
  mission: { 'month': '.mission-head', 'science bar': '.mission-head ~ .panel', 'speed controls': 'button[aria-label="Fast forward"]' },
  event: { 'event choices': '.dialogue .choices' },
  debrief: { 'verdict stamp': '.stamp', 'what limited you': '.limit h2', 'TRY THIS': '.try', 'result / money box': '.nasa-box', 'back/next button': '.choices .btn.primary' },
  part1_build: { 'status': '#status', 'part bins': '.bins', 'part cards': '[data-key^="part-"]', 'four bars': '.bars', 'next button': '.nav-row .btn.primary' }
};

const PAGE_METRICS = ({ keys, touch }) => {
  const vw = innerWidth, vh = innerHeight;
  const vis = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
  const covered = (e, r) => { const x = Math.min(Math.max(r.left + Math.min(r.width, 60) / 2, 1), vw - 1), y = Math.min(r.top + Math.min(r.height, 40) / 2, vh - 1); const t = document.elementFromPoint(x, y); return !(t && (e.contains(t) || t.contains(e))); };
  const out = { pageH: document.documentElement.scrollHeight, vh, vw, hOverflow: document.documentElement.scrollWidth > vw + 1, keys: {}, missing: [] };
  out.ratio = +(out.pageH / vh).toFixed(2);
  for (const [name, sel] of Object.entries(keys)) {
    const e = [...document.querySelectorAll(sel)].find(vis);
    if (!e) { out.missing.push(name + ' (' + sel + ')'); continue; }
    const r = e.getBoundingClientRect();
    const inView = r.top >= 0 && r.top + Math.min(r.height, 40) <= vh;
    out.keys[name] = { top: Math.round(r.top), inView, covered: inView ? covered(e, r) : null, onScreen: inView && !covered(e, r) };
  }
  // words on screen at scroll 0: text nodes whose box is inside the viewport
  let words = 0; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const p = n.parentElement; if (!p || !vis(p) || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.tagName)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect();
    if (r.height && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw) words += (n.textContent.match(/\S+/g) || []).length;
  }
  out.wordsInView = words; out.wordsTotal = (document.body.innerText.match(/\S+/g) || []).length;
  // interactive targets
  const sel = 'button, a[href], summary, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
  const need = touch ? 44 : 24; const small = []; let inter = 0, interAbove = 0;
  document.querySelectorAll(sel).forEach(e => {
    if (!vis(e) || e.disabled) return; const r = e.getBoundingClientRect(); if (!r.width || !r.height) return; inter++;
    if (r.top >= 0 && r.top < vh) interAbove++;
    if (Math.min(r.width, r.height) < need) small.push((e.dataset.key || e.id || e.className.toString().split(' ')[0] || e.tagName.toLowerCase()) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  out.interactive = inter; out.interactiveAboveFold = interAbove; out.smallTargets = small.length; out.smallExamples = [...new Set(small)].slice(0, 6); out.minTarget = need;
  // overlap: visible blocks/controls whose boxes intersect without one containing the other
  // sticky and fixed bars (the pinned next button, the header) cover content by design, so they are left out of the count
  const pinned = e => { for (let x = e; x && x !== document.body; x = x.parentElement) { const ps = getComputedStyle(x).position; if (ps === 'sticky' || ps === 'fixed') return true; } return false; };
  const els = [...document.querySelectorAll('button, h1, h2, h3, p, li, canvas, .panel, .part, .bar, summary, .tag, .stamp, .btn')].filter(e => vis(e) && e.getBoundingClientRect().width > 8 && !pinned(e) && !(e.closest('#preview') && e.matches('p')));
  const boxes = els.map(e => [e, e.getBoundingClientRect()]); const ov = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, A] = boxes[i], [b, B] = boxes[j]; if (a.contains(b) || b.contains(a)) continue;
    const ix = Math.min(A.right, B.right) - Math.max(A.left, B.left), iy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
    if (ix > 4 && iy > 4) ov.push((a.dataset.key || a.className.toString().split(' ')[0] || a.tagName) + ' x ' + (b.dataset.key || b.className.toString().split(' ')[0] || b.tagName));
  }
  out.overlaps = ov.length; out.overlapExamples = [...new Set(ov)].slice(0, 4);
  // title-only tooltips: a title attribute on something that is not a button or link (no keyboard or tap equivalent)
  out.titleOnly = [...document.querySelectorAll('[title]')].filter(e => vis(e) && !/^(BUTTON|A|SUMMARY|INPUT)$/.test(e.tagName) && !e.matches('[tabindex]')).map(e => (e.className.toString().split(' ')[0] || e.tagName) + ':' + e.title.slice(0, 24)).slice(0, 5);
  return out;
};

async function run(vp, base) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.touch, isMobile: false, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  await p.route(/services\.swpc\.noaa\.gov|eonet\.gsfc\.nasa\.gov|cwfis\.cfs\.nrcan\.gc\.ca/, r => r.abort());
  const res = { viewport: vp.name, states: {}, tasks: {}, hover: {}, errors };
  const ctr = { scrolls: 0, clicks: 0, hovers: 0 };
  const fonts = () => p.evaluate(() => document.fonts.ready.then(() => document.fonts.size));
  const style = async () => { if (OVERLAY) await p.addStyleTag({ content: OVERLAY }); };

  async function capture(name, keyset) {
    await fonts(); await p.waitForTimeout(450);
    const m = await p.evaluate(PAGE_METRICS, { keys: KEYS[keyset || name], touch: vp.touch });
    if (m.missing.length) {
      if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `FAIL_${LABEL}_${vp.name}_${name}.png`) });
      throw new Error(`[${LABEL} ${vp.name}] ${name}: missing ${m.missing.join(', ')} | page says: ${(await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 200)}`);
    }
    if (AXE && vp.name === '1366x768') {
      await p.addScriptTag({ path: AXE });
      m.axe = await p.evaluate(() => axe.run(document, { resultTypes: ['violations'] }).then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, where: v.nodes.slice(0, 3).map(n => n.target.join(' ').slice(0, 60)), why: (v.nodes[0].any[0] || v.nodes[0].all[0] || {}).message || '' }))));
    }
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${LABEL}_${vp.name}_${name}.png`) });
    res.states[name] = m;
  }
  // Bring a target into view the way a player would (wheel), counting scrolls, then act on it.
  async function reach(sel, kind) {
    let reached = false;
    // a target inside a sideways-scrolling strip (the phone's bins) needs a swipe first; it counts as one scroll
    const swiped = await p.evaluate(s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length); if (!e) return false;
      for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { if (a.scrollWidth > a.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(a).overflowX)) {
        const A = a.getBoundingClientRect(), r = e.getBoundingClientRect(); if (r.left < A.left || r.right > A.right) { a.scrollLeft += (r.left + r.width / 2) - (A.left + A.width / 2); return true; } return false; } } return false; }, sel);
    if (swiped) { ctr.scrolls++; await p.waitForTimeout(120); }
    for (let i = 0; i < 6; i++) {
      const st = await p.evaluate(s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length); if (!e) return { missing: true }; const r = e.getBoundingClientRect(), vh = innerHeight;
        const x = Math.min(Math.max(r.left + Math.min(r.width, 60) / 2, 1), innerWidth - 1), y = Math.min(r.top + Math.min(r.height, 40) / 2, vh - 1), t = document.elementFromPoint(x, y);
        return { ok: r.top >= 0 && r.top + Math.min(r.height, 40) <= vh && t && (e.contains(t) || t.contains(e)), top: r.top, vh }; }, sel);
      if (st.missing) throw new Error(`[${LABEL} ${vp.name}] cannot reach ${sel}`);
      if (st.ok) { reached = true; break; }
      const delta = st.top - 0.55 * st.vh; ctr.scrolls += Math.max(1, Math.ceil(Math.abs(delta) / (0.8 * st.vh))); await p.mouse.wheel(0, delta); await p.waitForTimeout(160);
    }
    if (!reached) { ctr.unreachable = (ctr.unreachable || 0) + 1; if (process.env.DEBUG) { const w = await p.evaluate(s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length); if (!e) return 'none'; const r = e.getBoundingClientRect(), t = document.elementFromPoint(Math.min(r.left + 20, innerWidth - 1), Math.min(Math.max(r.top + 20, 1), innerHeight - 1)); return `top ${Math.round(r.top)} h ${Math.round(r.height)} covered by ${t ? t.tagName + '.' + t.className : 'nothing'}`; }, sel); console.error(`  unreachable ${sel}: ${w}`); } }   // still covered or off screen after six scrolls
    // act on the part of the element that was checked as visible (its top 24 px), not on its centre
    const at = { position: { x: 24, y: 20 }, force: true };
    if (kind === 'hover') { ctr.hovers++; await p.locator(sel).first().hover(at); }
    else if (kind === 'click') { ctr.clicks++; await p.locator(sel).first().click(at); }
  }
  // 2.1: a bin shows its first six cards; a later part needs SHOW LATER PARTS first (a reach and a click, counted)
  const later = async part => { if (!(await p.locator(`[data-key="part-${part}"]`).count()) && await p.locator('[data-key^="later-"][aria-expanded="false"]').count()) await reach('[data-key^="later-"][aria-expanded="false"]', 'click'); };
  const task = async (name, fn) => { const s = { ...ctr }; await fn(); res.tasks[name] = { scrolls: ctr.scrolls - s.scrolls, clicks: ctr.clicks - s.clicks, hovers: ctr.hovers - s.hovers, unreachable: (ctr.unreachable || 0) - (s.unreachable || 0) }; };

  await p.goto(base); await style(); await fonts(); await p.waitForTimeout(800);
  await capture('home');
  // ---- Part 1, step 1 (the "start here" path)
  await p.click('[data-key="part1-go"]'); await T.pastScenes(p); await T.waitHead(p, 'BASE MAP');
  await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
  await capture('part1_build_empty', 'part1_build');
  await task('P1 step 1: build the satellite and go on', async () => {
    for (const part of T.WALK[1].parts) { await reach(`[data-key="bin-${T.BIN[part]}"]`, 'click'); await reach(`[data-key="part-${part}"]`, 'click'); }
    await reach('.science-total, .bars', null); await reach('.nav-row .btn.primary', null);
  });
  await capture('part1_build_full', 'part1_build');
  // ---- Part 2
  // 2.1: a reload keeps the place, so go home first (that forgets the place), then clear the save
  await p.evaluate(() => { if (window.StarlineUI && window.StarlineUI.home) window.StarlineUI.home(); localStorage.clear(); try { sessionStorage.clear(); } catch (e) {} }); await p.goto(base); await style(); await p.waitForTimeout(600);
  await T.seedRuns(p); await p.click('[data-key="part2-go"]'); await capture('picker');
  await p.click('[data-key="level-standard"]'); await T.pastScenes(p); await T.waitHead(p, 'WORKSHOP');
  await capture('workshop');
  const topic = await p.evaluate(() => (document.querySelector('[data-key^="fly-"]') || {}).dataset?.key);
  const c = T.CONTRACT.solar;
  await task('P2: read the contracts and take one', async () => { await reach('[data-key^="fly-"]', null); await reach('[data-key="fly-solar"]', 'click'); });
  await T.waitHead(p, 'BASE MAP'); await capture('map');
  await reach('[data-key="blip-build"]', 'click'); await T.waitHead(p, 'BUILD');
  await capture('build_empty', 'build');
  const inst = c.parts.find(x => T.BIN[x] === 'instrument');
  await task('P2: build a design and read whether it is good', async () => {
    await reach('[data-key="bin-instrument"]', 'click'); await later(inst); await reach(`[data-key="part-${inst}"]`, 'hover');
    for (const part of c.parts) { await reach(`[data-key="bin-${T.BIN[part]}"]`, 'click'); await later(part); await reach(`[data-key="part-${part}"]`, 'click');
      if (process.env.DEBUG) console.error('  added', part, await p.evaluate(s => { const e = document.querySelector(s); return e ? e.getAttribute('aria-pressed') + ' scrollY ' + Math.round(scrollY) + ' top ' + Math.round(e.getBoundingClientRect().top) : 'gone'; }, `[data-key="part-${part}"]`)); }
    await p.mouse.move(2, 2);
    await reach('[data-key="contract-pay"], .payout-line', null); await reach('.science-total', null); await reach('.bars', null);
  });
  await capture('build_full', 'build');
  await reach('.nav-row .btn.primary', 'click'); await T.waitHead(p, 'LAUNCH VEHICLE');
  await capture('rocket');
  await task('P2: pick the rocket and go on', async () => { await reach(`[data-key="rocket-${c.launcher}"]`, 'click'); await reach('.nav-row .btn.primary', 'click'); });
  await T.waitHead(p, 'READINESS'); await capture('readiness');
  await task('P2: read the readiness verdict and launch', async () => { await reach('.verdict', null); await reach('.btn.big', 'click'); });
  await T.waitHead(p, 'MISSION'); await p.click('button:has-text("PAUSE")'); await capture('mission'); await p.click('button:has-text("RESUME")');   // paused so every run captures month 0
  await p.click('button[aria-label="Fast forward"]');
  let ev = false;
  for (let i = 0; i < 400; i++) {
    if ((await p.$$('.dialogue .choices button')).length) {
      if (!ev) { ev = true; await capture('event'); await task('P2: answer an event', async () => { await reach('.dialogue .choices button', 'click'); }); }
      else await (await p.$$('.dialogue .choices button'))[0].click();
      await p.waitForTimeout(250); continue;
    }
    if (await p.locator('.screen-head h1', { hasText: 'DEBRIEF' }).count()) break;
    await p.waitForTimeout(100);
  }
  await p.waitForTimeout(500); await p.evaluate(() => scrollTo(0, 0));
  await capture('debrief');
  // Order-free: how many scrolls bring the verdict (paid or not), what limited the flight, the advice, the money and the way on
  // into view, in any order a player likes. 0 when they all sit in the first screen.
  {
    const span = await p.evaluate(() => { const sels = ['.cb-result, .stamp', '.limit h2', '.try', '.limit .nasa-box, .nasa-box', '.choices .btn.primary'];
      const r = sels.map(s => [...document.querySelectorAll(s)].find(e => e.getClientRects().length)).filter(Boolean).map(e => e.getBoundingClientRect());
      const vh = innerHeight, top = Math.min(...r.map(x => x.top + scrollY)), bottom = Math.max(...r.map(x => x.bottom + scrollY));
      return { vh, top, bottom, found: r.length }; });
    const needBottom = span.bottom <= span.vh ? 0 : Math.ceil((span.bottom - span.vh) / (0.8 * span.vh));
    const needSpan = Math.max(0, Math.ceil((span.bottom - span.top) / (0.9 * span.vh)) - 1);
    res.tasks['P2: bring the debrief\'s verdict, limit, advice, money and next button into view'] = { scrolls: Math.max(needBottom, needSpan), clicks: 0, hovers: 0, unreachable: 5 - span.found };
  }
  // ---- hover / icon behaviour, on Build (a fresh Part 2 build screen)
  await p.evaluate(() => localStorage.clear()); await p.goto(base); await style(); await T.seedRuns(p); await p.click('[data-key="part2-go"]'); await p.click('[data-key="level-standard"]'); await T.pastScenes(p); await T.waitHead(p, 'WORKSHOP');
  await p.click('[data-key="fly-solar"]'); await T.waitHead(p, 'BASE MAP'); await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
  await p.evaluate(() => { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: false }); });
  await p.click(`[data-key="bin-${T.BIN[inst]}"]`); await p.waitForTimeout(300);
  const card = `[data-key="part-${inst}"]`, FIND = "[...document.querySelectorAll('h2')].find(h => /IF YOU/.test(h.textContent))", prevText = () => p.evaluate(`(${FIND} || {closest(){return null}}).closest('div') ? ${FIND}.closest('div').innerText : ''`);
  const h = res.hover;
  if (!vp.touch) {
    await p.locator(card).hover(); await p.waitForTimeout(250); h.hoverOpens = /ADD|REMOVE/.test(await prevText());
    await p.mouse.move(2, 2); await p.waitForTimeout(200);
    await p.locator(card).focus(); await p.waitForTimeout(250); h.focusOpens = /ADD|REMOVE/.test(await prevText());
  } else {
    await p.locator(card).tap(); await p.waitForTimeout(250); h.firstTapPreviews = /ADD|REMOVE/.test(await prevText());
    h.firstTapAddedPart = await p.evaluate(s => document.querySelector(s).getAttribute('aria-pressed') === 'true', card);
  }
  // put the card where a player would have it (a bit below the middle), hover it, and see what the pointer would hit
  await p.evaluate(c => { const e = document.querySelector(c); window.scrollTo(0, window.scrollY + e.getBoundingClientRect().top - 0.6 * innerHeight); }, card); await p.waitForTimeout(200);
  if (!vp.touch) await p.locator(card).hover({ force: true });
  await p.waitForTimeout(250);
  const geo = await p.evaluate(c => { const hd = [...document.querySelectorAll('h2')].find(x => /IF YOU/.test(x.textContent)), k = document.querySelector(c); if (!hd || !k) return null;
    const A = hd.closest('div').getBoundingClientRect(), K = k.getBoundingClientRect(), x = K.left + K.width / 2, y = Math.min(Math.max(K.top + K.height / 2, 1), innerHeight - 1), t = document.elementFromPoint(x, y);
    return { previewFullyOnScreen: A.top >= 0 && A.bottom <= innerHeight && A.left >= 0 && A.right <= innerWidth, previewShareOfViewport: +(A.height / innerHeight).toFixed(2),
      cardOnScreen: K.top >= 0 && K.bottom <= innerHeight, cardCoveredAtPointer: !(t && (k.contains(t) || t.contains(k))) }; }, card);
  h.previewGeometry = geo;
  const why = await p.locator('details.why summary, details summary').first();
  if (await why.count()) { await why.focus(); await p.keyboard.press('Enter'); h.whyOpensByKeyboard = await p.evaluate(() => !!document.querySelector('details[open]')); }
  const help = p.locator('#help-btn'); if (await help.count() && await help.isVisible()) { await help.focus(); await p.keyboard.press('Enter'); h.helpOpensByKeyboard = await p.evaluate(() => { const x = document.getElementById('hint'); return !!x && !x.hidden; }); }
  await p.locator(card).click(); await p.waitForTimeout(300);
  h.layoutShift = +(await p.evaluate(() => window.__cls)).toFixed(4);
  h.titleOnly = (await p.evaluate(PAGE_METRICS, { keys: {}, touch: vp.touch })).titleOnly;
  res.counters = { ...ctr };
  await b.close();
  return res;
}

(async () => {
  const { srv, url } = await serve();
  const all = { label: LABEL, repo: REPO, overlay: !!OVERLAY, when: new Date().toISOString(), runs: [] };
  try { for (const vp of VIEWPORTS) { all.runs.push(await run(vp, url)); process.stderr.write(`done ${LABEL} ${vp.name}\n`); } }
  finally { srv.close(); }
  fs.writeFileSync(OUT, JSON.stringify(all, null, 1));
  console.log('wrote ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
