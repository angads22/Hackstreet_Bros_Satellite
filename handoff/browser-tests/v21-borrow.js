// Version 2.1, BORROW from anywhere: the CASH tile of the ledger strip is a button on every Part 2 screen. It opens the borrow
// panel (amount, fee, rate, credit score and band, BORROW and CLOSE); a loan raises the cash and the debt by the back end's
// figures (the save's loan entry), the strip flashes and the screen in hand follows with the design kept; a refused loan shows
// the back end's reason; Esc closes and the focus returns to the tile; the flight waits while the panel is open. Part 1 has no tile.
// Every number is read from the back end at test time.
// Usage: REPO=<repo> node v21-borrow.js <shots dir>     (run from outside the repo)
const { chromium } = require('playwright');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();
const KEY = 'smdg-campaign';
const near = (a, b) => Math.abs(a - b) < 0.0006;

const errLists = [];
(async () => {
  const b = await chromium.launch();
  const open = async (w, h) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); p.errors = T.watchErrors(p); errLists.push(p.errors); await T.noFonts(p);
    await p.goto(url); await p.waitForSelector('[data-key="part2-go"]');
    return p;
  };
  const ledger = p => p.evaluate(() => getLedger());
  const hub = p => p.evaluate(() => getComeback());
  const save = p => p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  const money = (p, v) => p.evaluate(x => StarlineUI.money(x), v);
  const cashText = (p, v) => p.evaluate(x => StarlineLedger.cashText(x), v);
  const tile = p => p.locator('.lstrip button.lt-cash');
  const dialog = p => p.locator('[data-key="borrow-dialog"]');
  const onTile = p => p.evaluate(() => !!document.activeElement && document.activeElement.classList.contains('lt-cash'));
  const openPanel = async p => { await tile(p).click(); await dialog(p).waitFor({ timeout: 4000 }); };
  // Opens the panel, takes the first amount and checks the money against the save's loan entry. null when nothing is on offer.
  const loanVia = async (p, where) => {
    const L0 = await ledger(p);
    await openPanel(p);
    if (!(await p.locator('.bp-amounts .btn').count())) { await p.keyboard.press('Escape'); console.log('     ' + where + ': no amount on offer'); return null; }
    await p.click('[data-key="bp-go"]');
    const flash = await p.evaluate(() => document.querySelectorAll('.lstrip .lt-cash.lt-flash, .lstrip .lt-debt.lt-flash').length);
    const L1 = await ledger(p), c = await save(p), e = c.log[c.log.length - 1];
    ok(e.kind === 'loan' && near(L1.cash_musd - L0.cash_musd, e.musd) && near(L1.debt_musd - L0.debt_musd, e.musd + e.fee_musd),
      `${where}: a loan raises the cash by ${e.musd} and the debt by ${e.musd} + ${e.fee_musd} (the back end's figures)`);
    ok(await dialog(p).count() === 0 && await onTile(p), where + ': the panel closes and the focus is back on the CASH tile');
    ok(await p.locator('.lstrip .lt-cash .lt-value').innerText() === await cashText(p, L1.cash_musd) && flash === 2, where + ': the strip shows the new cash; CASH and DEBT flash');
    return { L0, L1, e };
  };

  // ---- Easy at 1366x768: the workshop
  let p = await open(1366, 768);
  await T.startComeback(p, 'training');
  let H = await hub(p);
  ok(await tile(p).count() === 1 && /BORROW/.test(await tile(p).innerText()) && await p.locator('.lstrip .lt').count() === 3, 'workshop: the CASH tile is a button that says BORROW');
  ok(await p.locator('#cb-cash').innerText() === await cashText(p, H.cash_musd), 'workshop: the tile still shows the cash alone in its value');
  await tile(p).focus(); await p.keyboard.press('Enter');
  ok(await dialog(p).count() === 1, 'workshop: Enter on the tile opens the borrow panel');
  const amounts = await p.evaluate(() => StarlineLedger.borrowAmounts(getComeback()));
  const shown = await p.$$eval('.bp-amounts .btn', es => es.map(e => e.textContent));
  ok(amounts.length > 0 && shown.join('|') === (await Promise.all(amounts.map(v => money(p, v)))).join('|'), 'panel: the same amounts the workshop offers (' + shown.join(', ') + ')');
  ok(await p.locator('[data-key="bp-fee"] strong').innerText() === Math.round(H.loan_fee * 100) + '%', 'panel: the fee from getComeback().loan_fee');
  ok(await p.locator('[data-key="bp-score"] strong').innerText() === H.credit_score + ' ' + H.credit_band, 'panel: the score and band from getComeback()');
  ok((await p.locator('[data-key="bp-rate"] strong').innerText()).indexOf(String(Math.round(H.interest_per_month * 1000) / 10)) === 0, 'panel: the monthly rate from getComeback().interest_per_month');
  ok(await p.locator('[data-key="bp-go"]').count() === 1 && await p.locator('[data-key="bp-close"]').count() === 1, 'panel: BORROW and CLOSE');
  await p.screenshot({ path: shots + '/borrow-workshop.png' });
  if (amounts.length > 1) {
    await p.click('.bp-amounts .btn >> nth=1');
    ok((await p.locator('[data-key="bp-go"]').innerText()).indexOf(await money(p, amounts[1])) !== -1, 'panel: picking an amount puts it on the BORROW button');
    await p.click('.bp-amounts .btn >> nth=0');
  }
  await p.keyboard.press('Escape');
  ok(await dialog(p).count() === 0 && await onTile(p) && await T.head(p, 'WORKSHOP').count() === 1, 'workshop: Esc closes the panel; the focus returns to the tile');
  const w1 = await loanVia(p, 'workshop');
  ok(!!w1 && /Borrowed/.test(await p.locator('#borrow-note').innerText()), 'workshop: its own note tells the loan');
  // the workshop's own BORROW buttons go through the same function
  {
    const L0 = await ledger(p);
    const own = p.locator('[data-key="borrow-panel"] .cb-pay-row .btn').first();
    if (await own.count()) {
      await own.click();
      const L1 = await ledger(p), c = await save(p), e = c.log[c.log.length - 1];
      ok(near(L1.cash_musd - L0.cash_musd, e.musd) && near(L1.debt_musd - L0.debt_musd, e.musd + e.fee_musd) && await dialog(p).count() === 0, 'workshop: its own BORROW button lends by the same rules');
    }
  }

  // ---- the base map
  const topic = 'ionosphere', C = T.CONTRACT[topic];
  await p.click(`[data-key="fly-${topic}"]`); await T.waitHead(p, 'BASE MAP');
  ok(await p.locator('#lstrip-host button.lt-cash').count() === 1, 'map: the CASH tile is a button');
  await openPanel(p);
  await p.keyboard.press('Escape');
  ok(await dialog(p).count() === 0 && await T.head(p, 'BASE MAP').count() === 1 && await onTile(p), 'map: the panel opens; Esc closes it and the map stays');

  // ---- Build, with parts placed
  await p.click('[data-key="blip-orbit"]'); await T.waitHead(p, 'ORBIT');
  if (await p.locator(`button[data-key="orbit-${C.orbit}"]:not([disabled])`).count()) await p.click(`[data-key="orbit-${C.orbit}"]`);
  await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'BUILD');
  await T.addParts(p, C.parts);
  const build = async () => ({
    status: await p.locator('#status').innerText(),
    bin: await p.locator('.bin[aria-pressed="true"]').first().getAttribute('data-key'),
    budget: await p.evaluate(() => { const e = [].find.call(document.querySelectorAll('.bar'), x => /BUDGET/.test(x.textContent)); return e ? e.querySelector('.bar-top').lastChild.textContent + '|' + e.querySelector('.bar-fill').style.width : ''; }),
    gauge: await p.locator('[data-key="vg-cost"]').first().getAttribute('aria-label').catch(() => ''),
    parts: await p.evaluate(() => document.querySelectorAll('.part[aria-pressed="true"]').length)
  });
  const cost = x => x.budget.split(' / ')[0];
  const b0 = await build();
  await openPanel(p); await p.keyboard.press('Escape');
  ok(await T.head(p, 'BUILD').count() === 1 && await dialog(p).count() === 0, 'Build: Esc closes the panel and does not leave for the map');
  const lb = await loanVia(p, 'Build');
  const b1 = await build();
  if (lb) {
    const now = await money(p, lb.L1.cash_musd);
    ok(await T.head(p, 'BUILD').count() === 1 && cost(b1) === cost(b0) && parseFloat(cost(b0).slice(1)) > 0 && b1.parts === b0.parts,
      'Build: the design is kept (cost ' + cost(b1) + ' before and after, ' + b1.parts + ' part cards pressed)');
    ok(b1.bin === b0.bin, 'Build: the open bin is kept (' + b1.bin + ')');
    ok(b1.status.indexOf('CASH ' + await cashText(p, lb.L1.cash_musd)) !== -1 && b1.budget.indexOf('/ ' + now) !== -1 && b1.budget !== b0.budget,
      'Build: the header and the BUDGET bar follow the new cash (' + b0.budget + ' -> ' + b1.budget + ')');
    ok(!b1.gauge || b1.gauge.indexOf(now) !== -1, 'Build: the cost gauge reads the new cash');
  }
  await p.screenshot({ path: shots + '/borrow-build.png' });

  // ---- Readiness
  await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'LAUNCH VEHICLE');
  await p.click(`[data-key="rocket-${C.launcher}"]`);
  await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'READINESS');
  await openPanel(p);
  ok(await p.locator('.bp-fact').count() === 3, 'Readiness: the panel opens with its three facts');
  await p.click('[data-key="bp-close"]');
  ok(await dialog(p).count() === 0 && await T.head(p, 'READINESS').count() === 1 && await onTile(p), 'Readiness: CLOSE closes it; the review stays');

  ok(await T.noScroll(p), '1366x768: no sideways scroll');
  await p.context().close();

  // ---- Normal: the mission keeps flying (it waits while the panel is open and is not started again), then the debrief
  p = await open(1366, 768);
  await T.startComeback(p, 'standard');
  await T.launchContract(p, 'solar');
  await openPanel(p);
  const m0 = await p.locator('.side-counter').innerText();
  await p.waitForTimeout(1200);
  ok(await p.locator('.side-counter').innerText() === m0, 'mission: the flight waits while the panel is open');
  await p.keyboard.press('Escape');
  let moved = false;
  for (let i = 0; i < 60 && !moved; i++) { await p.waitForTimeout(100); moved = await p.locator('.side-counter').innerText() !== m0 || await p.locator('[role="alertdialog"]').count() > 0; }
  ok(moved && await T.head(p, 'MISSION').count() === 1, 'mission: it goes on when the panel closes');

  // ---- the debrief: the strip only
  await T.fly(p, 'first', true); await T.waitHead(p, 'DEBRIEF'); await p.waitForTimeout(300);
  const lead = await p.locator('[data-key="debrief-lead"]').innerText();
  const ld = await loanVia(p, 'debrief');
  if (!ld) { await openPanel(p); ok(await p.locator('#bp-note').count() === 1, 'debrief: the panel opens (nothing left to lend: the reason shows)'); await p.keyboard.press('Escape'); }
  ok(await T.head(p, 'DEBRIEF').count() === 1 && await p.locator('[data-key="debrief-lead"]').innerText() === lead, 'debrief: the report stays as it was');

  // ---- a refused loan: the back end's reason, in the panel
  await openPanel(p);
  if (await p.locator('[data-key="bp-go"]').count()) {
    await p.evaluate(() => { for (let n = 0; n < 30 && getComeback().max_borrow_musd > 0; n++) borrow(getComeback().max_borrow_musd); });   // the lenders' limit, behind the panel's back
    await p.click('[data-key="bp-go"]');
    const why = await p.locator('#bp-note').innerText().catch(() => '');
    ok(await dialog(p).count() === 1 && why.length > 10, 'a refused loan keeps the panel open with the reason (' + why + ')');
    await p.keyboard.press('Escape');
  } else await p.keyboard.press('Escape');
  const L9 = await ledger(p);
  await openPanel(p);
  const reason = await p.evaluate(() => borrow(getComeback().max_borrow_musd + 1).reason);
  ok(await p.locator('#bp-note').innerText() === reason && await p.locator('[data-key="bp-go"]').count() === 0 && await p.locator('.bp-amounts .btn').count() === 0,
    'nothing left to lend: the panel shows the back end\'s reason and no BORROW (' + reason + ')');
  const L10 = await ledger(p);
  ok(L9.cash_musd === L10.cash_musd && L9.debt_musd === L10.debt_musd, 'asking why moves no money');
  await p.keyboard.press('Escape');
  await p.context().close();

  // ---- Hard: the same facts, nothing more
  p = await open(1366, 768);
  await T.startComeback(p, 'expert');
  await openPanel(p);
  ok(await p.locator('.bp-fact').count() === 3 && await p.locator('.bp p').count() === 0, 'Hard: the panel holds the three facts and no advice');
  await p.keyboard.press('Escape');
  await p.context().close();

  // ---- a phone (390): the tile is big enough to tap, the panel fits
  p = await open(390, 844);
  await T.startComeback(p, 'training');
  let box = await tile(p).boundingBox();
  ok(box.height >= 44 && box.width >= 44, `phone workshop: the tile is ${Math.round(box.width)} by ${Math.round(box.height)} px`);
  await openPanel(p);
  box = await dialog(p).boundingBox();
  ok(box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844 && await T.noScroll(p), 'phone: the panel fits the screen');
  const small = await p.$$eval('.bp button', es => es.filter(e => e.getBoundingClientRect().height < 44).length);
  ok(small === 0, 'phone: every button in the panel is at least 44 px tall');
  await p.screenshot({ path: shots + '/borrow-390.png' });
  await p.keyboard.press('Escape');
  await loanVia(p, 'phone workshop');
  await p.click(`[data-key="fly-${topic}"]`); await T.waitHead(p, 'BASE MAP');
  box = await tile(p).boundingBox();
  ok(box.height >= 44 && await T.noScroll(p), 'phone map: the tile is at least 44 px tall, no sideways scroll');
  await loanVia(p, 'phone map');
  ok(await T.head(p, 'BASE MAP').count() === 1, 'phone map: the map stays after a loan');
  await p.context().close();

  // ---- Part 1 has no tile
  p = await open(1366, 768);
  await p.click('[data-key="part1-go"]'); await T.throughBeats(p);
  ok(await p.locator('.lt-cash').count() === 0 || !(await p.locator('#lstrip-host').isVisible()), 'Part 1: no CASH tile, no borrowing');
  await p.context().close();

  const errors = [].concat(...errLists);
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await b.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
