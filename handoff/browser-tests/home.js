// The home page on its own: without the low-poly art (js/lowpoly.js blocked), with a broken walkthrough record,
// RESET PROGRESS, and the Part 2 hooks (window.showComebackStart, getComeback) present or missing.
// Usage: node home.js [shots dir]   or   node home.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();
const KEY = 'gravitron-walkthrough-v1';

(async () => {
  const b = await chromium.launch();

  // ---- js/lowpoly.js blocked: no hero, everything else works (the aborted request itself is the one allowed error)
  for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    console.log(`[no low-poly art, ${label}]`);
    const p = await b.newPage({ viewport });
    const errors = T.watchErrors(p, /lowpoly\.js/);
    await T.noFonts(p);
    await p.route(/\/js\/lowpoly\.js$/, r => r.abort());
    await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
    ok(await p.evaluate(() => typeof LowPoly === 'undefined'), 'LowPoly is missing');
    ok(await p.locator('canvas.lp-hero').count() === 0, 'no hero canvas');
    ok(await p.locator('.big-title').isVisible() && await p.locator('.mode-card').count() === 2, 'title and both mode cards show');
    ok(await T.noScroll(p), 'no sideways scroll');
    await p.screenshot({ path: path.join(shots, `home-nolowpoly-${label}.png`), fullPage: true });
    await p.click('[data-key="part1-go"]');
    await T.throughBeats(p);
    ok(await T.waitHead(p, 'BASE MAP'), 'Part 1 still starts and reaches the map');
    ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await p.close();
  }

  console.log('[record, reset and Part 2 hooks]');
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  p.on('dialog', d => d.accept());
  await p.goto(url);
  // A broken record is ignored, never trusted
  for (const junk of ['not json', '{"done":{"1":"three","2":99,"9":3}}', '[]', 'null']) {
    await p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, junk]);
    await p.reload();
    ok(/^START/.test(await p.locator('[data-key="part1-go"]').innerText()) && await p.locator('.mode-steps li.passed').count() === 0,
      'broken record ' + JSON.stringify(junk) + ': home shows START and no passed step');
  }
  await p.evaluate(k => localStorage.setItem(k, JSON.stringify({ done: { 1: 2, 2: 3 } })), KEY);
  await p.reload();
  ok(/CONTINUE: STEP 3/.test(await p.locator('[data-key="part1-go"]').innerText()), 'a saved record: CONTINUE: STEP 3');
  ok(await p.locator('.mode-steps li.passed').count() === 2 && (await p.locator('[data-key="walk-step-2"] .stars').getAttribute('aria-label')) === '3 of 3 stars',
    'passed steps show their best stars');
  // RESET PROGRESS clears the stars and the walkthrough record
  await p.evaluate(() => localStorage.setItem('smdg-progress-v1', JSON.stringify({ best_stars: { training: 3 }, best_score: { training: 90 }, best_stars_by_era: { igy: 3 } })));
  await p.click('[data-key="reset-progress"]');
  const after = await p.evaluate(k => [localStorage.getItem(k), JSON.parse(localStorage.getItem('smdg-progress-v1'))], KEY);
  ok(after[0] === null, 'RESET PROGRESS removes the walkthrough record');
  ok(after[1] && Object.keys(after[1].best_stars).length === 0 && Object.keys(after[1].best_stars_by_era || {}).length === 0, 'RESET PROGRESS clears the saved stars');
  ok(/^START/.test(await p.locator('[data-key="part1-go"]').innerText()) && await p.locator('[data-key="mode-part1"] .tag', { hasText: 'START HERE' }).count() === 1,
    'after reset: START and the START HERE tag');

  // Part 2 hooks: missing -> disabled; present -> START, or CONTINUE when a comeback is saved; both buttons call it
  ok(await p.locator('[data-key="part2-go"]').isDisabled(), 'no Part 2 screens: the button is disabled');
  await p.addInitScript(() => { window.__calls = 0; window.showComebackStart = function () { window.__calls++; }; });
  await p.reload();
  ok(!(await p.locator('[data-key="part2-go"]').isDisabled()) && /^START/.test(await p.locator('[data-key="part2-go"]').innerText()), 'with showComebackStart: Part 2 reads START');
  await p.click('[data-key="part2-go"]');
  ok(await p.evaluate(() => window.__calls) === 1, 'the Part 2 button calls window.showComebackStart()');
  await p.addInitScript(() => { window.getComeback = function () { return { finished: false, months_left: 20 }; }; });
  await p.reload();
  ok(/^CONTINUE/.test(await p.locator('[data-key="part2-go"]').innerText()), 'a saved comeback: Part 2 reads CONTINUE');
  await p.addInitScript(() => { window.getComeback = function () { throw new Error('not ready'); }; });
  await p.reload();
  ok(/^START/.test(await p.locator('[data-key="part2-go"]').innerText()), 'a getComeback that throws: START, no crash');
  // The epilogue's last button goes to Part 2 when it exists
  await p.evaluate(() => window.StarlineUI.showEpilogue());
  for (let i = 0; i < 6 && !/CONTINUE TO PART 2/.test(await p.locator('.intro .btn.primary').innerText()); i++) await p.click('.intro .btn.primary');
  await p.click('.intro .btn.primary');
  ok(await p.evaluate(() => window.__calls) === 1, 'CONTINUE TO PART 2 calls window.showComebackStart() (a fresh page: 1 call)');
  // SKIP in the epilogue goes to its last beat, not away
  await p.evaluate(() => window.StarlineUI.showEpilogue());
  await p.click('.intro .btn', { hasText: 'SKIP' });
  ok(/grandson Ajay/.test(await p.locator('.intro .say-text p').innerText()), 'SKIP in the epilogue shows the last beat');
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await b.close();
  done();
})();
