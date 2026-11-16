// Version 2.1, the Build screen: progress count, ranked problems, card limit, next-button reason, verdict gauges.
// Usage (from OUTSIDE the repo):  REPO=<worktree> node <worktree>/handoff/browser-tests/v21-uia.js <scratch dir>
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();

async function toBuild(page, topic) {
  const c = T.CONTRACT[topic];
  await page.click(`[data-key="fly-${topic}"]`); await T.waitHead(page, 'BASE MAP');
  if (c.orbit) {
    await page.click('[data-key="blip-orbit"]'); await T.waitHead(page, 'ORBIT');
    if (await page.locator(`button[data-key="orbit-${c.orbit}"]:not([disabled])`).count()) await page.click(`[data-key="orbit-${c.orbit}"]`);
    await page.click('.nav-row .btn.primary');
  } else await page.click('[data-key="blip-build"]');
  return T.waitHead(page, 'BUILD');
}
// A contract with a proof design on the table and $30M in the till (the seed decides which three open), as assist.js does.
async function setup(p) {
  await p.evaluate(() => {
    const c = getCampaign();
    for (let i = 0; i < 40 && !c.offers.some(o => o.topic === 'wildfire' && !o.done); i++) { c.flights = (c.flights || 0) + 1; c.offers = []; makeContracts(c); }
    c.treasury_musd = 30; saveCampaign(c); window.showComebackHub();
  });
  await p.waitForTimeout(300);
}
const money = t => parseFloat(String(t).replace(/[^0-9.]/g, ''));
async function fresh(browser, vp, reduced) {
  const ctx = await browser.newContext({ viewport: vp, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = T.watchErrors(page);
  await T.noFonts(page);
  await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload();
  return { ctx, page, errors };
}
const txt = async (p, sel) => (await p.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();
const state = (p, k) => p.locator(`[data-key="vg-${k}"]`).getAttribute('data-state');
// The layout checks, run at each size on the Build screen.
async function layout(p, name) {
  ok(await T.noScroll(p), name + ': no sideways scroll');
  const r = await p.evaluate(() => {
    const s = document.querySelector('.vstrip'); if (!s) return null;
    const box = s.getBoundingClientRect(), small = [...s.querySelectorAll('.vg-top, .vg-num')].map(e => parseFloat(getComputedStyle(e).fontSize));
    const nav = document.querySelector('.nav-row .btn.primary').getBoundingClientRect();
    return { right: box.right, w: window.innerWidth, minFont: Math.min(...small), navBottom: nav.bottom, h: window.innerHeight,
      over: [...s.querySelectorAll('.vgauge')].some(g => g.scrollWidth > g.clientWidth + 1) };
  });
  ok(r && r.right <= r.w + 0.5, name + ': the strip fits the width');
  ok(r && r.minFont >= 18, name + ': gauge text is at least 18 px (' + (r && r.minFont) + ')');
  ok(r && !r.over, name + ': no gauge text spills out of its box');
  ok(r && r.navBottom <= r.h + 0.5, name + ': the next button stays on screen');
}

(async () => {
  const b = await chromium.launch();
  try {
    // ---------------------------------------------------------------- Easy, 1366x768
    let { ctx, page: p, errors } = await fresh(b, { width: 1366, height: 768 });
    await T.startComeback(p, 'training');
    ok(await toBuild(p, 'ionosphere'), 'Easy: Part 2 Build opens');
    ok(/^0 of \d+ needed$/.test(await txt(p, '[data-key="progress-count"]')), 'progress count on an empty design: ' + await txt(p, '[data-key="progress-count"]'));
    const needN = await p.locator('.bin-sub.need').count();
    ok(needN >= 5 && (await p.locator('.bin-sub.need').allInnerTexts()).every(t => !/Needed/i.test(t)), 'the bins no longer repeat "Needed" (' + needN + ' empty bins marked)');
    ok(await p.locator('.vstrip .vgauge').count() === 3, 'the verdict strip has three gauges');
    ok((await state(p, 'data')) === 'none' && (await state(p, 'cost')) === 'none', 'an empty design gets no verdict yet');
    const order = await p.$$eval('.workshop .checks.ranked .check', es => es.map(e => e.classList.contains('bad') ? 'bad' : 'warn'));
    ok(order.length > 0 && order[0] === 'bad' && order.join().indexOf('warn,bad') === -1, 'problems: blockers come before warnings (' + order.join(',') + ')');
    ok(await p.locator('.checks.ranked .check.bad .check-do').count() > 0, 'Easy: blockers name an action word (' + await txt(p, '.checks.ranked .check.bad') + ')');
    ok(await p.locator('.checks.ranked .check.bad svg').count() > 0, 'a blocker has a cross icon, not colour alone');
    const why = await txt(p, '[data-key="next-why"]');
    ok(/^\d+ NO GO to fix$/.test(why), 'beside the next button: "' + why + '"');
    ok(await p.locator('.nav-row .btn.primary').isEnabled(), 'the next button is not disabled');
    // cards: the first bin is trimmed, nothing greyed, SHOW LATER PARTS opens the rest
    await p.click('[data-key="bin-instrument"]');
    const first = await p.locator('.shelf .part').count();
    ok(first <= 6 && await p.locator('.shelf .part.locked').count() === 0, 'instrument bin: at most 6 cards, none greyed (' + first + ')');
    ok(await p.locator('[data-key="later-instrument"]').count() === 1, 'SHOW LATER PARTS is offered');
    await p.click('[data-key="later-instrument"]');
    const all = await p.locator('.shelf .part').count();
    ok(all > first && await p.locator('.shelf .part.locked').count() === 0, 'it opens the rest (' + first + ' -> ' + all + ') and still greys none');
    ok(await p.locator('[data-key="later-instrument"]').getAttribute('aria-expanded') === 'true', 'and says it is open');
    await p.click('[data-key="later-instrument"]');
    ok(await p.locator('.shelf .part').count() === first, 'SHOW FEWER closes it again');
    // the stage carries the state: a bare body with three instruments (the body holds two), no panel, no radio
    const lay = ['smallsat-bus', 'alouette-2-sounder', 'cloud-photocell', 'optical-camera'];
    await p.click('[data-key="bin-structure"]'); await p.click('[data-key="part-smallsat-bus"]');
    await p.click('[data-key="bin-instrument"]');
    for (const id of lay.slice(1)) await p.click(`[data-key="part-${id}"]`);
    ok(await p.locator('.sat-bench.low-power').count() === 1 && await p.locator('[data-key="mark-power"]').count() === 1, 'the stage: too little power glows red at its edge, with a power chip');
    ok(await p.locator('[data-key="mark-link"]').count() === 1 && await p.locator('[data-key="mark-link"] svg').count() === 1, 'the stage: no radio shows broken waves');
    ok(await p.locator('.sat-mark.part').count() === 1, 'the stage: the instrument that does not fit the body gets a cross (' + await p.locator('.sat-mark.part').first().getAttribute('aria-label') + ')');
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('.sat-marks')).pointerEvents) === 'none', 'the chips never take a click or a drag');
    for (const id of lay.slice(1).reverse()) await p.click(`[data-key="part-${id}"]`);
    await p.click('[data-key="bin-structure"]'); await p.click('[data-key="part-smallsat-bus"]');
    ok(await p.locator('.sat-marks').count() === 0, 'the stage: the marks go when the problems do');
    // build it
    await T.addParts(p, T.CONTRACT.ionosphere.parts);
    const need = await txt(p, '[data-key="progress-count"]');
    ok(/^(\d+) of \1 needed$/.test(need), 'progress count when every needed bin is filled: ' + need);
    ok(await p.locator('.bin-sub.need').count() === 0, 'no bin marked empty');
    ok(await p.locator('.checks.ranked .check.bad').count() === 0, 'no NO GO left on Build');
    ok(await p.locator('[data-key="next-why"]').count() === 0, 'no reason line once nothing blocks');
    ok(['ok', 'thin'].includes(await state(p, 'data')) && (await state(p, 'time')) === 'ok', 'the contract design: DATA is ' + await state(p, 'data') + ', TIME ' + await state(p, 'time'));
    const [have, lim] = (await txt(p, '[data-key="vg-cost"] .vg-num')).split('/').map(money);
    ok((await state(p, 'cost')) === (have > lim ? 'bad' : lim - have < 0.1 * lim ? 'thin' : 'ok'), 'COST ' + await state(p, 'cost') + ' agrees with its own numbers (' + have + ' / ' + lim + '): the design plus the cheapest rocket against the cash');
    ok(await p.locator('.vg-num:not(.sr-only)').count() === 3 && /\d/.test(await txt(p, '[data-key="vg-data"] .vg-num')), 'Easy: the gauges say their numbers (' + await txt(p, '[data-key="vg-data"] .vg-num') + ')');
    ok(await p.locator('.vgauge .vg-state svg').count() === 3, 'every verdict has an icon and a word: ' + await txt(p, '.vg-state'));
    // a gauge that is bad is solid, with a cross and a word
    ok((await state(p, 'cost')) === 'bad', 'Easy cash is thin: COST is bad when the design and a rocket cost more than the cash');
    const bad = await p.evaluate(() => { const g = document.querySelector('[data-key="vg-cost"]'), s = getComputedStyle(g); return { bg: s.backgroundColor, cross: !!g.querySelector('.vg-state svg'), text: g.querySelector('.vg-state').innerText }; });
    ok(bad.cross && /OVER/.test(bad.text) && bad.bg !== 'rgba(0, 0, 0, 0)', 'a bad gauge is solid, with a cross and a word (' + bad.text + ', ' + bad.bg + ')');
    await layout(p, 'Easy 1366x768');
    await p.screenshot({ path: path.join(shots, 'uia-easy-1366.png') });
    await p.click('[data-key="bin-instrument"]'); await T.openLater(p, 'alouette-2-sounder'); await p.click('[data-key="part-alouette-2-sounder"]');
    ok(await p.locator('[data-key="vg-data"]').getAttribute('data-state') === 'bad', 'taking the instrument off turns DATA bad: nothing would be measured');
    ok(errors.length === 0, 'Easy: no errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await ctx.close();

    // ---------------------------------------------------------------- Normal, 1280x800: gauges, no numbers on screen; the "?" cards still ask
    ({ ctx, page: p, errors } = await fresh(b, { width: 1280, height: 800 }));
    await T.startComeback(p, 'standard'); await setup(p);
    ok(await toBuild(p, 'wildfire'), 'Normal: Build opens');
    ok(await p.locator('.checks.ranked .check.bad .check-do').count() > 0, 'Normal: blockers keep their action word');
    await p.click('[data-key="bin-instrument"]');
    const asks = await p.locator('.shelf [data-key^="ask-"]').count();
    ok(asks > 0, 'Normal: the cards that show "?" still offer ASK (' + asks + ')');
    const cash0 = T.cashNow ? await T.cashNow(p) : NaN;
    await p.locator('.shelf [data-key^="ask-"]').first().click(); await p.waitForTimeout(100);
    const cash1 = await T.cashNow(p);
    ok(cash1 < cash0, 'and ASK still pays from the cash (' + cash0 + ' -> ' + cash1 + ')');
    await T.addParts(p, T.CONTRACT.wildfire.parts);
    ok(await p.locator('.vgauge.bad').count() === 0 && (await state(p, 'cost')) === 'ok', 'Normal: with the cash in hand, nothing is red (COST ' + await state(p, 'cost') + ')');
    ok(await p.locator('.vg-num.sr-only').count() === 3 && await p.locator('.vg-num:not(.sr-only)').count() === 0, 'Normal: the gauge numbers are not on screen');
    ok(/Design/.test(await p.locator('[data-key="vg-data"]').getAttribute('aria-label')), 'Normal: but they are in the gauge label for a screen reader');
    ok(await p.locator('.vgauge .vg-state').count() === 3, 'Normal: the verdict word shows (' + await txt(p, '.vg-state') + ')');
    await layout(p, 'Normal 1280x800');
    ok(errors.length === 0, 'Normal: no errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await ctx.close();

    // ---------------------------------------------------------------- Hard, 390: facts only
    ({ ctx, page: p, errors } = await fresh(b, { width: 390, height: 844 }));
    await T.startComeback(p, 'expert'); await setup(p);
    ok(await toBuild(p, 'wildfire'), 'Hard: Build opens');
    // Hard never gains an aid: the same bare design that marks the stage on Easy marks nothing here
    await p.click('[data-key="bin-structure"]'); await p.click('[data-key="part-cubesat-12u"]');
    await p.click('[data-key="bin-instrument"]'); await p.click('[data-key="part-thermal-imager"]');
    ok(await p.locator('.sat-marks').count() === 0 && await p.locator('.low-power').count() === 0, 'Hard: the stage carries no state (no power glow, no chips)');
    await p.click('[data-key="part-thermal-imager"]'); await p.click('[data-key="bin-structure"]'); await p.click('[data-key="part-cubesat-12u"]');
    await T.addParts(p, T.CONTRACT.wildfire.parts);
    const facts = await p.$$eval('.vgauge', es => es.map(e => ({ s: e.getAttribute('data-state'), icon: !!e.querySelector('.vg-state'), t: e.innerText.replace(/\s+/g, ' ') })));
    ok(facts.length === 3 && facts.every(f => f.s === 'fact' && !f.icon), 'Hard: three gauges, no verdict word or icon (' + facts.map(f => f.s).join(',') + ')');
    ok(facts.every(f => /\d/.test(f.t) && /NEEDS|CASH|LEFT/.test(f.t)), 'Hard: the contract\'s terms and the design\'s amounts as facts (' + facts.map(f => f.t).join(' | ') + ')');
    ok(await p.locator('.vgauge.thin, .vgauge.bad, .vgauge.flash').count() === 0, 'Hard: nothing is coloured as a verdict');
    ok(await p.locator('.vstrip .vg-track, .vstrip .vg-fill').count() === 0, 'Hard: no bar that does the comparing, only the facts');
    ok(await p.locator('.check-do').count() === 0, 'Hard: no action word on a problem');
    ok(!/PROFIT|NET|EXPECT/i.test(await txt(p, '.vstrip')), 'Hard: no forecast or net in the strip');
    await layout(p, 'Hard 390');
    await p.click('[data-key="bin-instrument"]');
    const laterBox = await p.locator('[data-key="later-instrument"]').boundingBox();
    ok(laterBox && laterBox.height >= 44, 'Hard 390: SHOW LATER PARTS is a 44 px target (' + (laterBox && laterBox.height) + ')');
    await p.screenshot({ path: path.join(shots, 'uia-hard-390.png') });
    ok(errors.length === 0, 'Hard: no errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await ctx.close();

    // ---------------------------------------------------------------- reduced motion: text stays, nothing animates
    ({ ctx, page: p, errors } = await fresh(b, { width: 1366, height: 768 }, true));
    await T.startComeback(p, 'training');
    await toBuild(p, 'ionosphere'); await T.addParts(p, T.CONTRACT.ionosphere.parts);
    const rm = await p.evaluate(() => { const f = document.querySelector('.vg-fill'), g = document.querySelector('.vgauge'); return { tr: getComputedStyle(f).transitionDuration, an: getComputedStyle(g).animationName }; });
    ok(/^0s/.test(rm.tr) && rm.an === 'none', 'reduced motion: no growth transition and no flash (' + rm.tr + ', ' + rm.an + ')');
    ok(/DATA/.test(await txt(p, '.vstrip')) && /\d/.test(await txt(p, '.vstrip')), 'reduced motion: the words and numbers are still in the page');
    await ctx.close();

    // ---------------------------------------------------------------- Part 1 keeps its walkthrough cards
    ({ ctx, page: p, errors } = await fresh(b, { width: 1366, height: 768 }));
    await p.click('[data-key="part1-go"]'); await T.throughBeats(p); await T.waitHead(p, 'BASE MAP');
    await p.keyboard.press('e'); await p.waitForTimeout(2500); await p.keyboard.press('e');
    ok(await T.waitHead(p, 'BUILD'), 'Part 1: Build opens');
    ok(await p.locator('.vstrip').count() === 0 && await p.locator('.later').count() === 0, 'Part 1: no verdict strip and no card limit');
    ok(/^\d+ of \d+ needed$/.test(await txt(p, '[data-key="progress-count"]')), 'Part 1: the progress count shows (' + await txt(p, '[data-key="progress-count"]') + ')');
    ok(errors.length === 0, 'Part 1: no errors');
    await ctx.close();
  } finally { await b.close(); }
  done();
})();
