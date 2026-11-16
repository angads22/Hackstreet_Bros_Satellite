// The home page on its own: without the low-poly art (js/lowpoly.js blocked), with a broken walkthrough record,
// RESET PROGRESS, the Part 2 hook contract (js/ui-comeback.js blocked, window.showComebackStart stubbed), and the real
// Part 2 button (START, CONTINUE while a comeback runs, START once it is finished).
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
    await p.route(/\/js\/lowpoly\.js(\?.*)?$/, r => r.abort());
    await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
    ok(await p.evaluate(() => typeof LowPoly === 'undefined'), 'LowPoly is missing');
    ok(await p.locator('canvas.lp-hero').count() === 0, 'no hero canvas');
    ok(await p.locator('.big-title').isVisible() && await p.locator('.mode-card').count() === 3, 'title and the three mode cards show');
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
  // RESET EVERYTHING clears the stars, the walkthrough record and a saved comeback
  await p.evaluate(() => localStorage.setItem('smdg-progress-v1', JSON.stringify({ best_stars: { training: 3 }, best_score: { training: 90 }, best_stars_by_era: { igy: 3 } })));
  await p.evaluate(() => { newComeback('standard'); });   // a comeback in progress: RESET EVERYTHING clears it too
  ok(await p.evaluate(() => getComeback() !== null && localStorage.getItem('smdg-campaign') !== null), 'a comeback is saved before the reset');
  await p.click('[data-key="reset-progress"]');
  ok(await p.evaluate(() => getComeback() === null && localStorage.getItem('smdg-campaign') === null), 'RESET EVERYTHING clears the saved comeback');
  const after = await p.evaluate(k => [localStorage.getItem(k), JSON.parse(localStorage.getItem('smdg-progress-v1'))], KEY);
  ok(after[0] === null, 'RESET EVERYTHING removes the walkthrough record');
  ok(after[1] && Object.keys(after[1].best_stars).length === 0 && Object.keys(after[1].best_stars_by_era || {}).length === 0, 'RESET EVERYTHING clears the saved stars');
  ok(/^START/.test(await p.locator('[data-key="part1-go"]').innerText()) && await p.locator('[data-key="mode-part1"] .tag', { hasText: 'START HERE' }).count() === 1,
    'after reset: START and the START HERE tag');

  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await p.close();

  // ---- The hook contract (js/ui-comeback.js blocked, so the stubs below stay): missing -> disabled; present -> START;
  // the Part 2 button and the epilogue's CONTINUE TO PART 2 both call window.showComebackStart().
  console.log('[Part 2 hook contract, js/ui-comeback.js blocked]');
  const h = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const hErrors = T.watchErrors(h, /ui-comeback\.js/);
  await T.noFonts(h);
  await h.route(/\/js\/ui-comeback\.js(\?.*)?$/, r => r.abort());
  await h.goto(url); await h.evaluate(() => localStorage.clear()); await h.reload();
  ok(await h.locator('[data-key="part2-go"]').isDisabled() && /COMING NEXT/.test(await h.locator('[data-key="part2-go"]').innerText()),
    'no Part 2 screens: the button is disabled and reads COMING NEXT');
  await h.addInitScript(() => { window.__calls = 0; window.showComebackStart = function () { window.__calls++; }; });
  await h.reload();
  ok(!(await h.locator('[data-key="part2-go"]').isDisabled()) && /^START/.test(await h.locator('[data-key="part2-go"]').innerText()), 'with showComebackStart: Part 2 reads START');
  await h.click('[data-key="part2-go"]');
  ok(await h.evaluate(() => window.__calls) === 1, 'the Part 2 button calls window.showComebackStart()');
  await h.reload();
  await h.evaluate(() => window.StarlineUI.showEpilogue());
  for (let i = 0; i < 6 && !/OPEN THE BOX/.test(await h.locator('.intro .btn.primary').innerText()); i++) await h.click('.intro .btn.primary');
  await h.click('.intro .btn.primary');   // THE BOX (js/ui-story.js), then its way on
  ok(await h.evaluate(() => window.__calls) === 0, 'the last epilogue beat opens THE BOX first: Part 2 is not started yet');
  await h.click('[data-key="end-continue"]');
  ok(await h.evaluate(() => window.__calls) === 1, 'CONTINUE TO PART 2 (on THE BOX) calls window.showComebackStart() (a fresh page: 1 call)');
  // SKIP in the epilogue goes to its last beat, not away
  await h.evaluate(() => window.StarlineUI.showEpilogue());
  await h.click('.intro .btn', { hasText: 'SKIP' });
  ok(/grandson Ajay/.test(await h.locator('.intro .say-text p').innerText()), 'SKIP in the epilogue shows the last beat');
  ok(hErrors.length === 0, 'no other console or page errors' + (hErrors.length ? ': ' + hErrors.join(' / ') : ''));
  await h.close();

  // ---- The real Part 2 (js/ui-comeback.js and the back end's getComeback): START, CONTINUE while a comeback runs,
  // START again once it is finished, and a getComeback that throws does not crash the home page.
  console.log('[Part 2, real screens]');
  const r = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const rErrors = T.watchErrors(r);
  await T.noFonts(r);
  await r.goto(url); await r.evaluate(() => localStorage.clear()); await r.reload();
  ok(/^START/.test(await r.locator('[data-key="part2-go"]').innerText()), 'no comeback saved: Part 2 reads START');
  await r.click('[data-key="part2-go"]');
  ok(await r.locator('.cb-level').count() === 3, 'START opens the difficulty picker (three cards)');
  await r.evaluate(() => newComeback('standard'));
  await r.reload();
  ok(/^CONTINUE/.test(await r.locator('[data-key="part2-go"]').innerText()), 'a comeback running: Part 2 reads CONTINUE');
  await r.click('[data-key="part2-go"]');
  await T.throughBeats(r);   // a comeback not yet begun in the page: Ajay's opening scene comes first, once
  ok(await T.waitHead(r, 'WORKSHOP'), 'CONTINUE opens the workshop');
  await r.evaluate(() => { const c = JSON.parse(localStorage.getItem('smdg-campaign')); c.finished = true; c.won = false; c.month = c.deadline_month; localStorage.setItem('smdg-campaign', JSON.stringify(c)); });
  await r.reload();
  ok(/^START/.test(await r.locator('[data-key="part2-go"]').innerText()), 'a finished comeback: Part 2 reads START');
  await r.evaluate(() => { window.getComeback = function () { throw new Error('not ready'); }; window.StarlineUI.home(); });
  ok(/^START/.test(await r.locator('[data-key="part2-go"]').innerText()), 'a getComeback that throws: START, no crash');
  ok(rErrors.length === 0, 'no console or page errors' + (rErrors.length ? ': ' + rErrors.join(' / ') : ''));
  await r.close();
  await b.close();
  done();
})();
