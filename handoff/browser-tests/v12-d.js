// v1.2, builder D (feedback: flight, gauges, satellite), in the page at 1366x768, 1280x800 and a 390 phone, Part 1 and Part 2:
//  - the debrief leads with the answer (the verdict strip: stamp, PROFIT, debt, months left; Part 1: stars and the step), then
//    what limited you and TRY THIS, with everything else folded under Details and the way on in one place (.next-bar);
//  - the Mission screen's science bar has a tick at the contract's minimum (every level) and a faint expected-finish line
//    (Easy and Normal, and Part 1, never Hard);
//  - the Build screen's verdict strip (.vstrip): DATA, COST and TIME gauges from the back end; amber only when thin, red with
//    a cross only when it cannot fly; Hard gets facts and the contract's terms, never a forecast; the pay line is in the strip;
//  - the satellite on the bench carries the state (Easy and Normal): glow, a cross on the culprit, broken waves (see satstate).
// No literal money: every expectation is read from the back end at test time.
// Usage: node v12-d.js [shots dir]   or   node v12-d.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();
const { waitHead } = T;

const SIZES = [[1366, 768, 'laptop1366'], [1280, 800, 'laptop1280'], [390, 844, 'phone390']];

async function open(viewport, level, reduce) {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: reduce ? 'reduce' : 'no-preference' })).newPage();
  const errors = T.watchErrors(page);
  await T.noFonts(page);
  page.on('dialog', d => d.accept());
  await page.goto(url);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  if (level) await T.startComeback(page, level);
  return { browser, page, errors };
}
const shot = (page, label, name, full) => page.screenshot({ path: path.join(shots, `v12d-${label}-${name}.png`), fullPage: !!full });

// Part 2: the contract on `topic` taken to its Build screen (orbit set when the contract names one).
async function toBuild(page, topic) {
  const c = T.CONTRACT[topic];
  await page.click(`[data-key="fly-${topic}"]`); await waitHead(page, 'BASE MAP');
  if (c.orbit) {
    await page.click('[data-key="blip-orbit"]'); await waitHead(page, 'ORBIT');
    if (await page.locator(`button[data-key="orbit-${c.orbit}"]:not([disabled])`).count()) await page.click(`[data-key="orbit-${c.orbit}"]`);
    await page.click('.nav-row .btn.primary');
  } else await page.click('[data-key="blip-build"]');
  await waitHead(page, 'BUILD');
}
// What the strip must say, from the back end alone (a design rebuilt in the page for the same contract).
const expected = (page, topic) => page.evaluate(([topic, c]) => {
  const info = getComeback(), k = info.contracts.find(x => x.topic === topic);
  const d = newComebackDesign(k.id);
  if (c.orbit && !d.orbit) setOrbit(d, c.orbit);
  c.parts.forEach(id => addPart(d, id));
  setLauncher(d, c.launcher);
  const f = previewProfit(d), p = previewPayout(d), s = previewScience(d), o = OBJECTIVES.find(x => x.id === k.topic);
  const U = StarlineUI;
  return { cost: U.money(f.cost_musd), cash: U.money(info.cash_musd), months: U.num(flightMonths(d), 0), left: U.num(info.months_left, 0),
    min: U.num(p.contract.min_science, 0), have: U.num(s.total, 0), profit: f.profit_musd, target: o.science_target, minRaw: p.contract.min_science,
    haveRaw: s.total, costRaw: f.cost_musd, cashRaw: info.cash_musd, price: U.money(p.contract.price_musd) };
}, [topic, T.CONTRACT[topic]]);
const gaugeStates = page => page.evaluate(() => ['data', 'cost', 'time'].map(k => {
  const g = document.querySelector(`[data-key="vg-${k}"]`);
  return g ? { k, state: g.getAttribute('data-state'), text: g.innerText.replace(/\s+/g, ' ').trim(), icon: !!g.querySelector('.vg-word svg'), word: (g.querySelector('.vg-word') || {}).textContent || '' } : null;
}));
const inFirstScreen = (page, sel) => page.evaluate(s => { const n = document.querySelector(s); if (!n) return false; const r = n.getBoundingClientRect(); return r.bottom <= window.innerHeight + 1 && r.top >= 0; }, sel);

async function partTwoNormal([w, h, label]) {
  console.log(`[Part 2 Normal ${label}]`);
  const { browser, page, errors } = await open({ width: w, height: h }, 'standard');
  // ---- Build: the verdict strip
  await toBuild(page, 'solar');
  ok(await page.locator('[data-key="verdict-slot"] .vstrip').count() === 1, 'Build: the verdict strip is in the slot under the satellite');
  let g = await gaugeStates(page);
  ok(g.every(Boolean) && g.length === 3, 'Build: three gauges, DATA, COST and TIME');
  ok(g.every(x => x.state === 'plain'), 'Build, nothing built: no verdict yet (' + g.map(x => x.state).join(', ') + ')');
  await T.addParts(page, T.CONTRACT.solar.parts);
  await page.waitForTimeout(400);
  const e = await expected(page, 'solar');
  // The rocket is not chosen yet: the cost counts the cheapest rocket that lifts it (previewProfit), like the old pay line.
  g = await gaugeStates(page);
  ok(g[0].text.includes(e.have) && g[0].text.includes(e.min), `DATA gauge: the design's science and the contract's points from the back end (${g[0].text})`);
  ok(g[1].text.includes(e.cash), `COST gauge: against the cash (${g[1].text})`);
  ok(g[2].text.includes(e.left) && /months/.test(g[2].text), `TIME gauge: against the months left (${g[2].text})`);
  ok(g.every(x => x.state === 'ok' && x.icon && x.word), 'a design that fits: every gauge says OK in words with an icon (' + g.map(x => x.state + ' ' + x.word).join(', ') + ')');
  const strip = await page.locator('.vstrip').innerText();
  ok(/PROFIT/.test(strip) && /Pays \$/.test(strip) && /3 stars/.test(strip), 'the pay line is in the strip: PROFIT, what it pays, the 3-star bonus');
  ok(await page.locator('[data-key="contract-pay"]').count() === 1 && await page.locator('.payout').count() === 0, 'one pay line only: the old one is gone from Build');
  const profitText = await page.locator('[data-key="profit-line"]').innerText();
  ok(Math.abs(parseFloat(profitText.replace(/[^0-9.\-]/g, '').replace(/^-?/, '')) - Math.abs(e.profit)) < 0.06, 'PROFIT is the back end\'s (' + profitText.replace(/\s+/g, ' ') + ')');
  ok(await T.noScroll(page), 'Build: no sideways scroll');
  ok(await page.evaluate(() => { const r = document.querySelector('.vstrip').getBoundingClientRect(); return r.right <= window.innerWidth + 1 && r.left >= -1; }), 'the strip stays inside the page');
  await shot(page, label, 'build');
  // ---- Mission: the pace line
  await page.click('.nav-row .btn.primary'); await waitHead(page, 'LAUNCH VEHICLE');
  await page.click(`[data-key="rocket-${T.CONTRACT.solar.launcher}"]`);
  await page.click('.nav-row .btn.primary'); await waitHead(page, 'READINESS');
  await page.locator('.btn.big').click(); await waitHead(page, 'MISSION');
  await page.waitForTimeout(700);
  const pace = await page.evaluate(() => {
    const tick = document.querySelector('[data-key="pace-min"]'), ex = document.querySelector('[data-key="pace-expect"]');
    const track = document.querySelector('.pace-track').getBoundingClientRect();
    const at = n => { if (!n) return null; const r = n.getBoundingClientRect(); return Math.round(((r.left + r.width / 2) - track.left) / track.width * 1000) / 10; };
    return { tick: at(tick), expect: at(ex), note: (document.querySelector('[data-key="pace-note"]') || {}).textContent || '', aria: tick ? tick.getAttribute('aria-hidden') : null };
  });
  const wantTick = Math.round(Math.min(1, e.minRaw / e.target) * 1000) / 10, wantEx = Math.round(Math.min(1, e.haveRaw / e.target) * 1000) / 10;
  ok(pace.tick !== null && Math.abs(pace.tick - wantTick) < 1.5, `Mission: a tick where the contract's minimum sits (${pace.tick}% of the bar, back end ${wantTick}%)`);
  ok(pace.expect !== null && Math.abs(pace.expect - wantEx) < 1.5, `Mission, Normal: a faint line where the design is expected to finish (${pace.expect}%, back end ${wantEx}%)`);
  ok(pace.note.includes(e.min) && pace.note.includes(e.have), 'the pace note says both in words (' + pace.note + ')');
  ok(await T.noScroll(page), 'Mission: no sideways scroll');
  await shot(page, label, 'mission');
  // ---- Debrief: the answer first
  await T.fly(page, 'first');
  ok(await waitHead(page, 'DEBRIEF'), 'the flight reaches the debrief');
  await page.waitForTimeout(1200);
  const order = await page.evaluate(() => {
    const kids = Array.from(document.querySelector('#app .screen').children).map(n => n.getAttribute('data-key') || n.className.split(' ')[0] || n.tagName);
    const d = document.querySelector('[data-key="debrief-details"]');
    return { kids, open: d ? d.open : null, paperInDetails: !!(d && d.querySelector('.paper')), ledgersInDetails: !!(d && d.querySelector('[data-key="cash-ledger"]') && d.querySelector('[data-key="debt-ledger"]')),
      earthInDetails: !!(d && /AGAINST THE REAL EARTH/.test(d.textContent)), nextLast: (() => { const n = document.querySelector('#app .screen').lastElementChild; return n && n.classList.contains('next-bar') && !!n.querySelector('[data-key="debrief-workshop"]'); })() };
  });
  const iv = order.kids.indexOf('contract-result'), il = order.kids.indexOf('panel'), id = order.kids.indexOf('debrief-details');
  ok(iv === 1 && il > iv && id > il, 'Debrief order: the verdict strip first, then what limited you, then Details (' + order.kids.join(' > ') + ')');
  const v = await page.locator('[data-key="contract-result"]').innerText();
  ok(/PAID/.test(v) && /PROFIT/.test(v) && /DEBT/.test(v) && /MONTHS LEFT/.test(v), 'the verdict strip says the stamp, PROFIT, DEBT and MONTHS LEFT in one place (' + v.replace(/\s+/g, ' ').slice(0, 90) + ')');
  const back = await page.evaluate(() => { const c = getComeback(); return { debt: StarlineUI.money(c.debt_musd), months: String(c.months_left) }; });
  ok(v.includes(back.debt) && (await page.locator('[data-key="months-left"] strong').innerText()) === back.months, 'DEBT and MONTHS LEFT are the back end\'s (' + back.debt + ', ' + back.months + ')');
  ok(order.open === false && order.paperInDetails && order.ledgersInDetails && order.earthInDetails, 'everything else is folded under Details, closed by default');
  ok(await page.locator('.limit .try').count() === 1 && await inFirstScreen(page, '.try') === (w >= 700 || true), 'TRY THIS follows what limited you');
  if (w >= 1280) ok(await inFirstScreen(page, '.try'), 'laptop: the verdict and TRY THIS are on the first screen, no scrolling');
  ok(order.nextLast, 'the way on (BACK TO THE WORKSHOP) is in a .next-bar of its own, out of the side panel');
  ok(await page.locator('.limit [data-key="debrief-workshop"]').count() === 0, '...and not in the limit panel');
  ok(await page.locator('.stamp').count() === 1 && await page.locator('.cb-stamp').count() === 1, 'one star stamp, one paid stamp');
  ok(await T.noScroll(page), 'Debrief: no sideways scroll');
  await shot(page, label, 'debrief', true);
  await page.evaluate(() => { document.querySelector('[data-key="debrief-details"]').open = true; });
  ok(await T.noScroll(page), 'Debrief with Details open: no sideways scroll');
  await shot(page, label, 'debrief-open', true);
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await browser.close();
}

// Hard: the contract's terms and the design's own amounts; no forecast. Easy: a red cross where the back end says it cannot fly.
async function levels([w, h, label]) {
  console.log(`[Part 2 Hard and Easy ${label}]`);
  let { browser, page, errors } = await open({ width: w, height: h }, 'expert');
  await toBuild(page, 'solar');
  await T.addParts(page, T.CONTRACT.solar.parts);
  await page.waitForTimeout(400);
  let g = await gaugeStates(page);
  ok(/^DATA Needs/.test(g[0].text) && !g[0].word, `Hard: the DATA gauge shows the contract's terms and no forecast (${g[0].text})`);
  ok(g[0].state === 'plain', 'Hard: no verdict word, no state colour on DATA');
  const strip = await page.locator('.vstrip').innerText();
  ok(/Pays up to/.test(strip) && !/PROFIT/.test(strip), 'Hard: "Pays up to ... for N points" and no PROFIT in the strip');
  ok(g[1].text.includes(await page.evaluate(() => StarlineUI.money(getComeback().cash_musd))), 'Hard: COST still shows the cash (a fact)');
  ok(g.every(x => x.state === 'plain' || x.state === 'bad'), 'Hard: gauges are plain, or red where the back end already blocks the flight (' + g.map(x => x.state).join(', ') + ')');
  await shot(page, label, 'build-hard');
  // The mission: the tick yes, the expected-finish line no.
  await page.click('.nav-row .btn.primary'); await waitHead(page, 'LAUNCH VEHICLE');
  await page.click(`[data-key="rocket-${T.CONTRACT.solar.launcher}"]`);
  await page.click('.nav-row .btn.primary'); await waitHead(page, 'READINESS');
  const bl = await page.locator('.btn.big').isDisabled();
  if (!bl) {
    await page.locator('.btn.big').click(); await waitHead(page, 'MISSION'); await page.waitForTimeout(500);
    ok(await page.locator('[data-key="pace-min"]').count() === 1 && await page.locator('[data-key="pace-expect"]').count() === 0, 'Hard Mission: the contract tick only, no expected-finish line');
    const note = await page.locator('[data-key="pace-note"]').innerText();
    ok(/Contract/.test(note) && !/Expected/.test(note), 'Hard Mission: the note names the contract minimum, not a forecast (' + note + ')');
    await shot(page, label, 'mission-hard');
  } else console.log('     (Hard solar design is blocked at this seed: mission pace on Hard not checked here)');
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await browser.close();

  // Easy: the ionosphere contract costs more than Easy's cash: COST is solid red with a cross, in words and an icon.
  ({ browser, page, errors } = await open({ width: w, height: h }, 'training'));
  await toBuild(page, 'ionosphere');
  await T.addParts(page, T.CONTRACT.ionosphere.parts);
  await page.waitForTimeout(400);
  g = await gaugeStates(page);
  const over = await page.evaluate(() => { const c = getComeback(); return c.cash_musd; });
  ok(g[1].state === 'bad' && g[1].icon && /OVER/.test(g[1].word), `Easy: COST over the cash is red with a cross and the word OVER (${g[1].text}; cash ${over})`);
  ok(await page.evaluate(() => { const n = document.querySelector('[data-key="vg-cost"]'); return getComputedStyle(n).borderTopColor !== getComputedStyle(document.querySelector('[data-key="vg-data"]')).borderTopColor; }), '...and looks different from a good gauge');
  ok(await page.locator('.checks, .problems, #app').first().innerText().then(t => /OVER BUDGET/.test(t)), 'the Problems list says OVER BUDGET too (the strip repeats a fact, it does not invent one)');
  ok(await T.noScroll(page), 'Easy Build: no sideways scroll');
  await shot(page, label, 'build-over');
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await browser.close();
}

// Part 1: no contract, so no gauges and no tick; the full-help expected line; the debrief leads with the stars and the step.
async function partOne([w, h, label]) {
  console.log(`[Part 1 ${label}]`);
  const { browser, page, errors } = await open({ width: w, height: h });
  await page.click('[data-key="part1-go"]');
  await T.throughBeats(page);
  await waitHead(page, 'BASE MAP');
  await page.click('[data-key="blip-build"]'); await waitHead(page, 'BUILD');
  ok(await page.locator('.vstrip').count() === 0, 'Part 1 Build: no verdict strip (no contract, no cash, no deadline)');
  await T.addParts(page, T.WALK[1].parts);
  await page.keyboard.press('m'); await waitHead(page, 'BASE MAP');
  await page.click('[data-key="blip-review"]'); await waitHead(page, 'READINESS');
  await page.locator('.btn.big').click(); await waitHead(page, 'MISSION'); await page.waitForTimeout(600);
  ok(await page.locator('[data-key="pace-min"]').count() === 0 && await page.locator('[data-key="pace-expect"]').count() === 1, 'Part 1 Mission: full help shows the expected finish, and there is no contract tick');
  await shot(page, label, 'p1-mission');
  await T.fly(page, 'first');
  ok(await waitHead(page, 'DEBRIEF'), 'Part 1: step 1 flown to the debrief');
  await page.waitForTimeout(1200);
  const o = await page.evaluate(() => {
    const kids = Array.from(document.querySelector('#app .screen').children).map(n => n.getAttribute('data-key') || n.className.split(' ')[0]);
    const d = document.querySelector('[data-key="debrief-details"]');
    const last = document.querySelector('#app .screen').lastElementChild;
    return { kids, open: d && d.open, paper: !!(d && d.querySelector('.paper')), next: !!(last && last.classList.contains('next-bar') && last.querySelector('[data-key="walk-next"]')),
      verdict: (document.querySelector('[data-key="debrief-verdict"]') || {}).innerText || '' };
  });
  ok(o.kids[1] === 'debrief-verdict', 'Part 1 debrief: the verdict strip comes first (' + o.kids.join(' > ') + ')');
  ok(/STEP 1 PASSED/.test(o.verdict) && await page.locator('[data-key="debrief-verdict"] .stamp').count() === 1, 'Part 1: the stars and "STEP 1 PASSED" in that strip');
  ok(o.open === false && o.paper, 'Part 1: the report is folded under Details');
  ok(o.next, 'Part 1: NEXT STEP is in the .next-bar');
  ok(await page.locator('.try').count() === 1 && /TRY THIS/.test(await page.locator('.try').innerText()), 'Part 1: TRY THIS stays');
  ok(await T.noScroll(page), 'Part 1 debrief: no sideways scroll');
  await shot(page, label, 'p1-debrief', true);
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await browser.close();
}

(async () => {
  for (const s of SIZES) await partTwoNormal(s);
  await levels(SIZES[0]);
  await levels(SIZES[2]);
  for (const s of SIZES) await partOne(s);
  done();
})().catch(e => { console.log('FAIL (crash) ' + (e && e.stack || e)); process.exit(1); });
