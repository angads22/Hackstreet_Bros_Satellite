// Version 2.1, the UI review items (money screens, debrief and mission): the ledger strip (CASH, DEBT, MONTHS LEFT, the interest
// tick, the deadline cue, the flash), contracts sorted by net with BEST PAY on Easy only, the workshop's first FLY THIS on screen
// at 1366x768, the debrief that leads with the verdict and the money (DETAILS folded), and the mission's pace line.
// Every number is read from the back end at test time. Part 1 shows no strip.
// Usage: REPO=<repo> node v21-uib.js <shots dir>     (run from outside the repo)
const { chromium } = require('playwright');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();
const KEY = 'smdg-campaign';
const money = v => '$' + (Math.round(v * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: v < 1 ? 2 : 1 }) + 'M';
const editSave = (p, body) => p.evaluate(([key, body]) => {
  const c = JSON.parse(localStorage.getItem(key)); new Function('c', body)(c); localStorage.setItem(key, JSON.stringify(c));
}, [KEY, body]);

const errLists = [], allErrors = [];
(async () => {
  const b = await chromium.launch();
  const open = async (w, h, opts) => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }, opts || {}));
    const p = await ctx.newPage(); allErrors.push(...[]); p.errors = T.watchErrors(p); errLists.push(p.errors); await T.noFonts(p);
    await p.goto(url); await p.waitForSelector('[data-key="part2-go"]');
    return p;
  };
  const ledger = p => p.evaluate(() => getLedger());
  const hub = p => p.evaluate(() => getComeback());
  const inView = (p, sel) => p.evaluate(s => {
    const e = document.querySelector(s); if (!e) return false;
    const r = e.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.top >= 0 && r.bottom <= innerHeight && !!top && (top === e || e.contains(top));
  }, sel);

  // ---- Easy: the workshop at 1366x768
  let p = await open(1366, 768);
  await T.startComeback(p, 'training');
  let L = await ledger(p), H = await hub(p);
  ok(await p.locator('.lstrip').count() === 1 && await p.locator('.lstrip .lt').count() === 3, 'workshop: one ledger strip with three tiles');
  ok(await p.locator('#cb-cash').innerText() === await p.evaluate(v => StarlineLedger.cashText(v), L.cash_musd), 'CASH from getLedger()');
  ok(await p.locator('#cb-debt').innerText() === money(L.debt_musd) && await p.locator('#cb-months').innerText() === String(L.months_left), 'DEBT and MONTHS LEFT from getLedger()');
  const tick = await p.locator('[data-key="interest-tick"]').innerText();
  ok(tick === '+' + await p.evaluate(v => StarlineUI.money(v), L.interest_month_musd) + ' INTEREST A MONTH' && L.interest_month_musd > 0, 'interest tick from the back end (' + tick + ')');
  ok(await p.locator('[data-key="deadline-cue"]').count() === 0, 'no deadline cue at the start (the deadline is far)');
  ok(await inView(p, '.cb-job .btn[data-key^="fly-"]'), 'workshop at 1366x768: the first FLY THIS is on screen, not under the pinned bar');
  const pg = await p.evaluate(() => document.documentElement.scrollHeight / innerHeight);
  console.log('     workshop height at 1366x768: ' + pg.toFixed(2) + ' screens');
  ok(pg < 1.7, 'workshop is shorter than the 1.86 screens it was (' + pg.toFixed(2) + ')');
  let order = await p.evaluate(() => getContractOrder());
  const cards = await p.$$eval('.cb-job', es => es.map(e => e.dataset.key.slice(4)));
  const ids = H.contracts.slice().sort((a, c) => order.ids.indexOf(a.id) - order.ids.indexOf(c.id)).map(k => k.topic);
  ok(cards.join() === ids.join(), 'Easy: cards in the back end\'s order (' + cards.join(' ') + ')');
  const best = await p.$$eval('[data-key="best-pay"]', es => es.map(e => e.closest('.cb-job').dataset.key));
  ok(best.length === (order.best_id ? 1 : 0) && (!order.best_id || best[0] === 'job-' + cards[0] && best[0] === 'job-' + H.contracts.find(k => k.id === order.best_id).topic), 'Easy: BEST PAY on the first card only');
  ok(await T.noScroll(p), 'workshop: no sideways scroll');
  await p.screenshot({ path: shots + '/uib-workshop-1366.png' });

  // ---- a payment moves DEBT: the tile flashes (no counting), then settles
  const payBtn = p.locator('.cb-pay-row .btn[data-key^="pay-"]').first();
  if (await payBtn.count()) {
    await payBtn.click();
    ok(await p.locator('[data-tile="debt"]').evaluate(n => n.classList.contains('lt-flash')), 'PAY BACK: the debt tile flashes');
    L = await ledger(p);
    ok(await p.locator('#cb-debt').innerText() === money(L.debt_musd), 'the debt tile reads the new debt at once (no counting up)');
    await p.waitForTimeout(900);
    ok(!(await p.locator('[data-tile="debt"]').evaluate(n => n.classList.contains('lt-flash'))), 'the flash is gone after about 0.6 s');
  } else ok(false, 'a PAY BACK button');

  // ---- the deadline cue: real state only
  await editSave(p, 'c.month = Math.ceil(c.deadline_month * 0.8);');
  await p.evaluate(() => showComebackHub());
  const cue = p.locator('[data-key="deadline-cue"]');
  ok(await cue.count() === 1 && /DEADLINE NEAR/.test(await cue.innerText()) && await cue.locator('svg').count() === 1, 'deadline near: icon and word');
  ok(/warn/.test(await p.locator('[data-tile="months"]').getAttribute('class')), 'deadline near: the months tile takes the warning colour');
  await editSave(p, 'c.month = 0;');
  await p.evaluate(() => showComebackHub());
  ok(await p.locator('[data-key="deadline-cue"]').count() === 0, 'back to far: the cue is gone');

  // ---- reduced motion: the flash is a plain highlight, no keyframes
  const rm = await open(390, 844, { reducedMotion: 'reduce' });
  await T.startComeback(rm, 'training');
  await rm.locator('.cb-pay-row .btn[data-key^="pay-"]').first().click();
  ok(await rm.locator('[data-tile="debt"]').evaluate(n => n.classList.contains('lt-flash') && getComputedStyle(n).animationName === 'none'), 'reduced motion: the flash is a highlight with no animation');
  await rm.context().close();

  // ---- phone widths: no sideways scroll, the three tiles still there
  for (const w of [390, 320]) {
    const ph = await open(w, 800);
    await T.startComeback(ph, 'standard');
    ok(await T.noScroll(ph) && await ph.locator('.lstrip .lt').count() === 3, `workshop at ${w}: three tiles, no sideways scroll`);
    if (w === 390) await ph.screenshot({ path: shots + '/uib-workshop-390.png' });
    await ph.context().close();
  }

  // ---- Normal: sorted, no BEST PAY; Hard: the order they came in
  await p.context().close();
  p = await open(1366, 768);
  await T.startComeback(p, 'standard');
  H = await hub(p); order = await p.evaluate(() => getContractOrder());
  ok(await p.locator('[data-key="best-pay"]').count() === 0 && order.best_id === null, 'Normal: no BEST PAY');
  const nCards = await p.$$eval('.cb-job', es => es.map(e => e.dataset.key.slice(4)));
  ok(nCards.join() === order.ids.map(id => H.contracts.find(k => k.id === id).topic).join(), 'Normal: sorted by net (' + nCards.join(' ') + ')');

  // ---- Normal: fly solar. The strip is on every Part 2 screen; buying part information moves CASH (hundredths)
  const k = H.contracts.find(x => x.topic === 'solar');
  await p.click('[data-key="fly-solar"]'); await T.waitHead(p, 'BASE MAP');
  ok(await p.locator('#lstrip-host .lstrip').count() === 1 && await p.locator('#lstrip-host').isVisible(), 'base map: the strip sits above the screen');
  await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
  const before = (await ledger(p)).cash_musd;
  await T.buyInfo(p, ['solar-small']);
  await p.waitForTimeout(150);
  L = await ledger(p);
  ok(L.cash_musd < before && await p.locator('#ls-cash').innerText() === await p.evaluate(v => StarlineLedger.cashText(v), L.cash_musd), 'an engineer\'s fee moves CASH, shown with its hundredths (' + await p.locator('#ls-cash').innerText() + ')');
  ok(await T.noScroll(p), 'build: no sideways scroll with the strip');
  await T.addParts(p, T.CONTRACT.solar.parts.filter(x => x !== 'solar-small'));
  await T.addParts(p, ['solar-small']);
  await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'LAUNCH VEHICLE');
  await p.click(`[data-key="rocket-${T.CONTRACT.solar.launcher}"]`);
  await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'READINESS');
  ok(await p.locator('#lstrip-host .lstrip').count() === 1, 'readiness: the strip is there');
  await p.locator('.btn.big').click(); await T.waitHead(p, 'MISSION');
  ok(await p.locator('#lstrip-host .lstrip').count() === 1, 'mission: the strip is there');

  // ---- the pace line (Normal: the minimum tick and the expected finish)
  const target = await p.evaluate(() => OBJECTIVES.find(o => o.id === 'solar').science_target);
  const minLeft = await p.locator('[data-key="pace-min"]').evaluate(n => parseFloat(n.style.left));
  ok(await p.locator('[data-key="pace-min"]').count() === 1 && Math.abs(minLeft - Math.round(Math.min(1, k.min_science / target) * 1000) / 10) < 0.11, 'pace line: a tick at the contract\'s minimum (' + minLeft + '%)');
  ok(await p.locator('[data-key="pace-exp"]').count() === 1, 'pace line (Normal): the expected-finish line');
  ok(await p.locator('.side-counter .month').count() === 1 && await p.locator('.mission-earth, .orbit-row canvas').count() >= 1, 'the big orbit and the side month counter are still there');
  await p.screenshot({ path: shots + '/uib-mission.png' });
  await T.fly(p, 'first', true);
  ok(await T.waitHead(p, 'DEBRIEF'), 'debrief');
  await p.waitForTimeout(400);

  // ---- the debrief: verdict and money first, then what limited the flight, TRY THIS, then DETAILS
  H = await hub(p);
  const lead = await p.locator('[data-key="debrief-lead"]').innerText();
  ok(/^(PAID|PAID IN PART|NOT PAID)(: .*)?$/.test(lead.replace(/\n/g, '')) && lead.includes('debt ' + money(H.debt_musd)), 'debrief: one line, the verdict and the money (' + lead.replace(/\n/g, '') + ')');
  const pos = await p.evaluate(() => {
    const at = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY : null; };
    return { lead: at('[data-key="debrief-lead"]'), profit: at('[data-key="debrief-profit"]'), limit: at('.limit h2'), tryThis: at('.limit .try'), details: at('[data-key="debrief-details"]'), ledger: at('[data-key="cash-ledger"]'),
      open: document.querySelector('[data-key="debrief-details"]').open };
  });
  ok(pos.open === false, 'DETAILS is folded when the debrief opens (a win included)');
  ok(pos.lead < pos.limit && pos.limit < pos.tryThis && pos.tryThis < pos.details, 'debrief order: verdict and money, what limited you, TRY THIS, DETAILS');
  ok(pos.profit !== null && pos.profit < pos.limit, 'the PROFIT line is kept, right under the verdict');
  ok(await p.locator('[data-key="debrief-details"] [data-key="cash-ledger"]').count() === 1 && await p.locator('[data-key="debrief-details"] [data-key="debt-ledger"]').count() === 1, 'the money ledgers are under DETAILS');
  ok(await p.locator('.limit [data-key="debrief-workshop"]').count() === 1, 'the way on (BACK TO THE WORKSHOP) comes right after TRY THIS');
  ok(await inView(p, '.limit .try') && await inView(p, '[data-key="debrief-lead"]'), 'debrief at 1366x768: the verdict and TRY THIS are on screen without scrolling');
  ok(await p.locator('#ls-cash').innerText() === await p.evaluate(v => StarlineLedger.cashText(v), H.cash_musd), 'debrief: the strip shows the cash after the flight');
  ok(await T.noScroll(p), 'debrief: no sideways scroll');
  await p.screenshot({ path: shots + '/uib-debrief.png' });
  await p.context().close();

  // ---- a phone (390): the mission and the debrief with the strip, the pace line and the lead line; the strip never leaks to the workshop twice or to the home page
  {
    const ph = await open(390, 844);
    await T.startComeback(ph, 'standard');
    await T.launchContract(ph, 'solar');
    ok(await T.noScroll(ph) && await ph.locator('[data-key="pace-min"]').count() === 1 && await ph.locator('#lstrip-host .lstrip .lt').count() === 3, 'phone mission: three tiles and the pace tick, no sideways scroll');
    await ph.screenshot({ path: shots + '/uib-mission-390.png' });
    await T.fly(ph, 'first', true);
    await T.waitHead(ph, 'DEBRIEF'); await ph.waitForTimeout(400);
    ok(await T.noScroll(ph) && await ph.locator('[data-key="debrief-lead"]').count() === 1 && await ph.locator('#lstrip-host .lstrip').count() === 1, 'phone debrief: the lead line and the strip, no sideways scroll');
    await ph.screenshot({ path: shots + '/uib-debrief-390.png' });
    await ph.click('[data-key="debrief-workshop"]'); await T.pastScenes(ph); await T.waitHead(ph, 'WORKSHOP');
    ok(await ph.locator('.lstrip:visible').count() === 1, 'back at the workshop: exactly one strip is showing');
    await ph.click('[data-key="hub-home"]'); await ph.waitForSelector('[data-key="part2-go"]');
    ok(await ph.locator('.lstrip:visible').count() === 0, 'home page: no strip');
    await ph.context().close();
  }

  // ---- Hard: the order they came in, no BEST PAY
  p = await open(1366, 768);
  await T.startComeback(p, 'expert');
  H = await hub(p); order = await p.evaluate(() => getContractOrder());
  const hCards = await p.$$eval('.cb-job', es => es.map(e => e.dataset.key.slice(4)));
  ok(hCards.join() === H.contracts.map(k => k.topic).join() && await p.locator('[data-key="best-pay"]').count() === 0 && order.best_id === null, 'Hard: the offers in their original order, no BEST PAY');
  await p.context().close();

  // ---- Part 1 shows nothing new
  p = await open(1366, 768);
  await p.click('[data-key="part1-go"]'); await T.throughBeats(p);
  ok(await p.locator('.lstrip').count() === 0 || !(await p.locator('#lstrip-host').isVisible()), 'Part 1: no ledger strip');
  await p.context().close();

  errLists.forEach(l => allErrors.push(...l));
  ok(!allErrors.length, 'no page errors' + (allErrors.length ? ': ' + allErrors.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
