// v1.2 builder C, the money screens: the ledger strip (CASH, DEBT, MONTHS LEFT) on every Part 2 screen, next month's
// interest under the debt, the deadline cue, the workshop that fits its first screen, and the contract board's order and
// "best pay" mark by level (Easy sorts and marks, Normal sorts, Hard keeps the back end's order). Every number is read
// from the back end at test time. At 1366x768, 1280x800 and 390 wide (and 320 for sideways scroll), reduced motion too.
// Usage: node v12-c.js [shots dir]   or   node v12-c.js <repo dir> <shots dir>   (run from outside the repo)
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();
const KEY = 'smdg-campaign';
const money = v => '$' + (Math.round(v * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: v < 1 ? 2 : 1 }) + 'M';
const editSave = (p, body) => p.evaluate(([key, body]) => {
  const c = JSON.parse(localStorage.getItem(key)); new Function('c', body)(c); localStorage.setItem(key, JSON.stringify(c));
}, [KEY, body]);

async function fresh(b, viewport, opts) {
  const p = await b.newPage(Object.assign({ viewport }, opts || {}));
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  p.on('dialog', d => d.accept());
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload(); await T.seedRuns(p);
  return { p, errors };
}
async function stripTexts(p) {
  return p.evaluate(() => {
    const t = k => { const n = document.querySelector('.lstrip [data-key="' + k + '"]'); return n ? n.innerText.replace(/\s+/g, ' ').trim() : null; };
    return { cash: (document.querySelector('.lstrip #cb-cash') || {}).innerText, debt: (document.querySelector('.lstrip #cb-debt') || {}).innerText,
      months: (document.querySelector('.lstrip #cb-months') || {}).innerText, interest: t('ledger-interest'), design: t('ledger-design'), cue: t('ledger-cue'),
      count: document.querySelectorAll('.lstrip').length, ids: document.querySelectorAll('#cb-debt, #cb-cash, #cb-months').length };
  });
}

// The board: the order of the cards and the BEST PAY mark, for one level.
async function board(viewport, label, tier, expect) {
  console.log(`[board ${label} ${tier}]`);
  const b = await chromium.launch();
  const { p, errors } = await fresh(b, viewport);
  await T.startComeback(p, tier);
  const h = await p.evaluate(() => getComeback());
  const order = await p.$$eval('.cb-job', es => es.map(e => e.getAttribute('data-key').replace('job-', '')));
  const backEnd = h.contracts.map(k => k.topic);
  const byNet = h.contracts.slice().sort((a, c) => (c.net_musd - a.net_musd)).map(k => k.topic);
  const labels = await p.locator('[data-key="best-pay"]').count();
  console.log(`     back end: ${backEnd.join(', ')}   nets: ${h.contracts.map(k => k.net_musd).join(', ')}   shown: ${order.join(', ')}`);
  if (expect === 'easy') {
    ok(order.join() === byNet.join(), 'Easy: the cards are sorted by net, the most first');
    const strictly = h.contracts.slice().sort((a, c) => c.net_musd - a.net_musd);
    const want = strictly[0].net_musd > strictly[1].net_musd ? 1 : 0;
    ok(labels === want, `Easy: ${want ? 'one BEST PAY' : 'no BEST PAY (a tie)'} (${labels})`);
    if (want) ok(await p.locator('.cb-job').first().locator('[data-key="best-pay"]').count() === 1, 'Easy: BEST PAY is on the first card');
  } else if (expect === 'normal') {
    ok(order.join() === byNet.join(), 'Normal: the cards are sorted by net');
    ok(labels === 0, 'Normal: no BEST PAY label');
  } else {
    ok(order.join() === backEnd.join(), "Hard: the cards keep the back end's order, so Hard still decides");
    ok(labels === 0, 'Hard: no BEST PAY label');
    ok(!/\bnet\b/i.test(await p.locator('.cb-board').innerText()), 'Hard: no net on the board');
  }
  // the strip in the workshop: the back end's numbers, one strip, unique ids; interest is a fact on every level
  const s = await stripTexts(p);
  ok(s.count === 1 && s.ids === 3, `workshop: one strip, one of each id (${s.count} strips, ${s.ids} ids)`);
  ok(s.cash === money(h.cash_musd) && s.debt === money(h.debt_musd) && s.months === String(h.months_left), 'workshop strip: CASH, DEBT, MONTHS LEFT from getComeback()');
  ok(s.interest === '+' + money(h.next_interest_musd) + ' INTEREST', `workshop strip: next month's interest from the back end (${s.interest})`);
  // the first screen holds the three FLY THIS buttons
  const bottoms = await p.$$eval('[data-key^="fly-"]', es => es.map(e => Math.round(e.getBoundingClientRect().bottom)));
  if (viewport.width >= 1000) ok(bottoms.length === 3 && bottoms.every(x => x <= viewport.height), `workshop: the FLY THIS buttons end at ${bottoms.join(', ')} of ${viewport.height}`);
  ok(await T.noScroll(p), 'workshop: no sideways scroll');
  ok(await p.locator('.screen-head h1').count() === 1 && /WORKSHOP/.test(await p.locator('.screen-head h1').textContent()), 'workshop: the title stays in the page (for screen readers)');
  ok(await p.locator('.screen-head h1').evaluate(n => n.getBoundingClientRect().width <= 2), 'workshop: the title is visually hidden');
  await p.screenshot({ path: path.join(shots, `v12c-${label}-${tier}-workshop.png`) });
  ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));
  await b.close();
}

// The strip on the design screens, the mission and the debrief; the DESIGN line moves when a part is added.
async function screens(viewport, label) {
  console.log(`[screens ${label}]`);
  const b = await chromium.launch();
  const { p, errors } = await fresh(b, viewport);
  await T.startComeback(p, 'standard');
  const shot = n => p.screenshot({ path: path.join(shots, `v12c-${label}-${n}.png`) });
  await p.click('[data-key="fly-solar"]'); ok(await T.waitHead(p, 'BASE MAP'), 'FLY THIS opens the base map');
  let h = await p.evaluate(() => getComeback());
  let s = await stripTexts(p);
  ok(s.count === 1 && s.ids === 3 && s.cash === money(h.cash_musd) && s.debt === money(h.debt_musd) && s.months === String(h.months_left), 'map: the strip shows CASH, DEBT, MONTHS LEFT (back end)');
  ok(s.interest === '+' + money(h.next_interest_musd) + ' INTEREST', 'map: next month\'s interest under the debt');
  ok(s.design === null, 'map: no design cost yet');
  ok(await p.evaluate(() => !document.querySelector('#app .lstrip') && document.querySelector('#lstrip-slot + #app, .lstrip-host + #app') !== null), 'the strip sits above the screen, outside #app');
  await shot('1-map');
  await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
  await p.click('[data-key="bin-structure"]'); await p.click('[data-key="part-drum-body"]');
  s = await stripTexts(p);
  ok(/^DESIGN \$/.test(s.design || ''), `build: after a part, the strip says what the design costs (${s.design})`);
  const first = s.design;
  const flashed = await p.locator('.lstrip [data-key="ledger-design"]').evaluate(n => n.classList.contains('lt-flash'));
  await p.click('[data-key="bin-instrument"]'); await p.click('[data-key="part-oso-xray-spectrometer"]');
  s = await stripTexts(p);
  ok(s.design !== first && /^DESIGN \$/.test(s.design), `build: the design line moves when a part is added (${first} to ${s.design})`);
  ok(await p.locator('.lstrip [data-key="ledger-design"]').evaluate(n => n.classList.contains('lt-flash')), 'build: the changed line flashes (a class, no counting)');
  ok(s.cash === money(h.cash_musd), 'build: CASH is still the cash (a fact), not minus the design');
  ok(await T.noScroll(p), 'build: no sideways scroll');
  await shot('2-build');
  await b.close();
  ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));
}

// The deadline cue: amber triangle and LATE near the deadline; TOO LATE when no flight can land; on every Part 2 screen.
async function cue(viewport, label) {
  console.log(`[deadline cue ${label}]`);
  const b = await chromium.launch();
  const { p, errors } = await fresh(b, viewport);
  await T.startComeback(p, 'standard');
  ok(await p.locator('[data-key="ledger-cue"]').count() === 0, 'plenty of time: no cue');
  await editSave(p, 'c.month = Math.ceil(c.deadline_month * 0.8); c.offers.forEach(function (k) { if (!k.done) k.expires_month = c.month + 12; });');
  await p.reload(); await T.seedRuns(p); await p.click('[data-key="part2-go"]'); await T.pastScenes(p); await T.waitHead(p, 'WORKSHOP');
  let h = await p.evaluate(() => getComeback());
  const c1 = p.locator('.lstrip [data-key="ledger-cue"]');
  const near = h.months_left <= h.deadline_month * 0.25;
  ok(near && await c1.count() === 1, `near the deadline (${h.months_left} of ${h.deadline_month} left): a cue`);
  const cls = await p.locator('[data-key="stat-months"]').getAttribute('class');
  ok(/warn/.test(cls) && /LATE/.test(await c1.innerText()) && await c1.locator('svg').count() === 1, `the cue is a colour, a triangle and the word (${await c1.innerText()})`);
  ok(await c1.evaluate(n => getComputedStyle(n).animationName === 'none'), 'the cue does not move (no pulse)');
  await p.screenshot({ path: path.join(shots, `v12c-${label}-late.png`) });
  const k = h.contracts[0];
  await p.click(`[data-key="fly-${k.topic}"]`); await T.waitHead(p, 'BASE MAP');
  ok(await p.locator('.lstrip [data-key="ledger-cue"]').count() === 1, 'the cue shows on the map screen too (not only the workshop)');
  await editSave(p, 'c.month = c.deadline_month - 1; c.offers.forEach(function (k) { if (!k.done) k.expires_month = c.month + 12; });');
  await p.reload(); await T.seedRuns(p); await p.click('[data-key="part2-go"]'); await T.pastScenes(p); await T.waitHead(p, 'WORKSHOP');
  const t = await p.locator('[data-key="stat-months"]').innerText();
  ok(/TOO LATE/.test(t) && /No flight can land before the deadline/.test(t) && /bad/.test(await p.locator('[data-key="stat-months"]').getAttribute('class')), 'no flight can land: TOO LATE, in words and in red');
  ok(await T.noScroll(p), 'no sideways scroll');
  await b.close();
  ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));
}

// Reduced motion: the strip shows the same and nothing animates.
async function reduced() {
  console.log('[reduced motion]');
  const b = await chromium.launch();
  const { p, errors } = await fresh(b, { width: 1280, height: 800 }, { reducedMotion: 'reduce' });
  await T.startComeback(p, 'standard');
  await p.click('[data-key="fly-solar"]'); await T.waitHead(p, 'BASE MAP');
  await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
  await p.click('[data-key="bin-structure"]'); await p.click('[data-key="part-drum-body"]');
  await p.click('[data-key="bin-instrument"]'); await p.click('[data-key="part-oso-xray-spectrometer"]');
  ok(/^DESIGN \$/.test((await stripTexts(p)).design || ''), 'reduced motion: the strip still shows the design cost');
  ok(await p.$$eval('.lstrip *', es => es.every(e => getComputedStyle(e).animationName === 'none')), 'reduced motion: nothing in the strip animates');
  await b.close();
  ok(!errors.length, 'no page errors');
}

// A phone and a very narrow phone: nothing pushes the page sideways, the strip wraps.
async function narrow(w) {
  console.log(`[narrow ${w}]`);
  const b = await chromium.launch();
  const { p, errors } = await fresh(b, { width: w, height: 844 });
  await T.startComeback(p, 'standard');
  ok(await T.noScroll(p), `${w}: workshop, no sideways scroll`);
  const r = await p.evaluate(() => { const n = document.querySelector('.lstrip').getBoundingClientRect(); return [Math.round(n.left), Math.round(n.right), Math.round(n.height)]; });
  ok(r[0] >= 0 && r[1] <= w, `${w}: the strip is inside the screen (${r.join(', ')})`);
  await p.screenshot({ path: path.join(shots, `v12c-${w}-workshop.png`) });
  await p.click('[data-key="fly-solar"]'); await T.waitHead(p, 'BASE MAP');
  ok(await T.noScroll(p) && await p.locator('.lstrip').count() === 1, `${w}: map, the strip, no sideways scroll`);
  await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
  await p.click('[data-key="bin-structure"]'); await p.click('[data-key="part-drum-body"]');
  ok(await T.noScroll(p), `${w}: build, no sideways scroll`);
  await p.screenshot({ path: path.join(shots, `v12c-${w}-build.png`) });
  await b.close();
  ok(!errors.length, 'no page errors');
}

const only = process.env.ONLY || '';   // ONLY=cue,reduced,narrow runs just those (board, screens, cue, reduced, narrow)
const want = n => !only || only.split(',').includes(n);
(async () => {
  if (want('board')) for (const [vp, label] of [[{ width: 1366, height: 768 }, '1366x768'], [{ width: 1280, height: 800 }, '1280x800']]) {
    await board(vp, label, 'training', 'easy');
    await board(vp, label, 'standard', 'normal');
    await board(vp, label, 'expert', 'hard');
  }
  if (want('board')) await board({ width: 390, height: 844 }, '390', 'training', 'easy');
  if (want('screens')) { await screens({ width: 1366, height: 768 }, '1366x768'); await screens({ width: 390, height: 844 }, '390'); }
  if (want('cue')) await cue({ width: 1280, height: 800 }, '1280x800');
  if (want('reduced')) await reduced();
  if (want('narrow')) { await narrow(390); await narrow(320); }
  done();
})().catch(e => { console.error(e); process.exit(1); });
