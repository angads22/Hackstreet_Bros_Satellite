// The clarity fixes (v1.1), in the page: the WHY box on a part that does not count (and never on one that does), the
// PROFIT line in Part 2's Build screen and debrief (green above zero, red below, absent in Part 1), a part's explainer
// on select (a tap on a phone) as one short line with its animation, and the structure card that leads with what it
// CARRIES. Every expectation is read from the back end at test time, never typed in.
// Usage: node clarity.js [shots dir]   or   node clarity.js <repo dir> <shots dir>
const { chromium, devices } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();
const KEY = 'smdg-campaign';

const colour = (p, sel) => p.locator(sel).evaluate(n => getComputedStyle(n).color);
const cssVar = (p, name) => p.evaluate(n => { const s = document.createElement('i'); s.style.color = 'var(' + n + ')'; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; }, name);
const inView = (p, sel) => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.height > 0; }, sel);
const profitOf = (p, sel) => p.locator(sel).evaluate(n => ({ musd: parseFloat(n.getAttribute('data-musd')), cls: n.className, text: n.innerText.replace(/\s+/g, ' ') }));
const near = (a, b) => Math.abs(a - b) < 0.0011;
const parseM = t => { const m = /(-?)\+?\$([\d,.]+)M/.exec(t.replace('+', '')); return m ? (m[1] ? -1 : 1) * parseFloat(m[2].replace(/,/g, '')) : NaN; };

async function open(b, opts) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  await p.goto(url); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await p.reload();
  await T.seedRuns(p);
  return { p, errors, ctx };
}
// Part 1, step 1: the story beats, then Build (the step's presets: radiation, low orbit, the Juno rocket).
async function part1Build(p, touch) {
  const press = sel => touch ? p.tap(sel) : p.click(sel);
  await press('[data-key="part1-go"]');
  for (let i = 0; i < 12 && await p.locator('.intro').count(); i++) await press('.intro .btn.primary');
  await T.waitHead(p, 'BASE MAP');
  await press('[data-key="blip-build"]');
  await T.waitHead(p, 'BUILD');
}
// A Part 2 contract's Build screen (the solar contract, low orbit: lib.js CONTRACT.solar).
async function part2Build(p, topic) {
  await T.startComeback(p, 'standard');
  const c = T.CONTRACT[topic];
  await p.click(`[data-key="fly-${topic}"]`); await T.waitHead(p, 'BASE MAP');
  await p.click('[data-key="blip-orbit"]'); await T.waitHead(p, 'ORBIT');
  if (await p.locator(`button[data-key="orbit-${c.orbit}"]:not([disabled])`).count()) await p.click(`[data-key="orbit-${c.orbit}"]`);
  await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'BUILD');
}

(async () => {
  const b = await chromium.launch();

  // ================================================================ Part 1 at 1366x768
  console.log('[Part 1, step 1, 1366x768]');
  let { p, errors, ctx } = await open(b, { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  await part1Build(p);
  await p.click('[data-key="bin-instrument"]');
  // Step 1 offers two instruments, and both count for radiation: no WHY anywhere, and no money.
  const cards = await p.evaluate(() => [...document.querySelectorAll('.part:not(.locked)')].map(c => ({ key: c.getAttribute('data-key'), note: (c.querySelector('.part-note') || {}).innerText || '' })));
  ok(cards.length >= 2 && cards.every(c => !c.note), 'Part 1 step 1: every instrument on offer counts for radiation (' + cards.map(c => c.key.replace('part-', '')).join(', ') + ')');
  const good = cards[0], goodId = good.key.replace('part-', '');
  for (const c of cards) { await p.locator(`[data-key="${c.key}"]`).hover(); await p.waitForTimeout(100); if (await p.locator('#preview .part-why').count()) ok(false, 'WHY shown for ' + c.key); }
  ok(await p.locator('#preview .part-why').count() === 0, 'WHY: not shown in Part 1 for a part that counts');
  await p.click(`[data-key="${good.key}"]`); await p.waitForTimeout(200);
  ok(await p.locator('.part-why').count() === 0, 'WHY: not shown after a part that counts is placed');
  // No money in Part 1.
  ok(await p.locator('.profit, [data-key="profit-line"], [data-key="contract-pay"]').count() === 0 && !/PROFIT/.test(await p.evaluate(() => document.body.innerText)), 'Part 1 Build: no PROFIT line');

  // The structure card: it leads with what it CARRIES, and its own weight is the smaller WEIGHS line.
  await p.click('[data-key="bin-structure"]');
  const body = await p.evaluate(() => { const b = PARTS.find(x => x.category === 'structure' && isPartAvailable(x.id)) || PARTS.filter(x => x.category === 'structure')[0]; return { id: b.id, payload: b.payload_kg, mass: b.mass_kg }; });
  const bodyCard = p.locator(`[data-key="part-${body.id}"]`);
  const cardText = (await bodyCard.innerText()).replace(/\s+/g, ' ');
  const lead = (await p.locator(`[data-key="carries-${body.id}"]`).innerText()).replace(/\s+/g, ' ');
  ok(new RegExp('^CARRIES ' + body.payload + ' KG$').test(lead), 'structure card: leads with CARRIES ' + body.payload + ' KG (' + lead + ')');
  ok(new RegExp('WEIGHS ' + body.mass + ' KG', 'i').test(cardText), 'structure card: its own weight reads WEIGHS ' + body.mass + ' KG (' + cardText + ')');
  ok(cardText.indexOf('CARRIES') < cardText.indexOf('WEIGHS'), 'structure card: CARRIES comes before WEIGHS');
  ok(await p.evaluate(id => { const c = document.querySelector('[data-key="carries-' + id + '"]'), w = document.querySelector('[data-key="part-' + id + '"] .part-stats.small'); return !!w && parseFloat(getComputedStyle(c).fontSize) > parseFloat(getComputedStyle(w).fontSize); }, body.id), 'structure card: the WEIGHS line is smaller than the CARRIES line');
  const others = await p.evaluate(() => [...document.querySelectorAll('.part:not(.locked)')].filter(c => !c.querySelector('.part-carry')).length);
  ok(others === 0, 'structure bin: every body card says CARRIES');
  await bodyCard.click(); await p.waitForTimeout(150);
  const barName = (await p.locator('.body-card .bar-name').innerText()).trim();
  const barVal = (await p.locator('.body-card .bar-top span').last().innerText()).replace(/\s+/g, ' ');
  ok(barName === 'CARRIES' && new RegExp('/ ' + body.payload + ' KG$').test(barVal), 'the body bar uses the same word and number: ' + barName + ' ' + barVal);
  await p.screenshot({ path: path.join(shots, 'clarity-p1-structure-1366.png') });
  ok(errors.length === 0, 'no console errors in Part 1 Build ' + errors.join(' | '));
  await ctx.close();

  // ================================================================ Part 1 on a phone: tap to select
  console.log('[Part 1, step 1, 390x844, tapping]');
  ({ p, errors, ctx } = await open(b, { ...devices['iPhone 13'], deviceScaleFactor: 1 }));
  await part1Build(p, true);
  await p.tap('[data-key="bin-instrument"]');
  const sel = `[data-key="${good.key}"]`;
  await p.locator(sel).scrollIntoViewIfNeeded();
  await p.tap(sel); await p.waitForTimeout(200);
  const ex = await p.evaluate(() => { const f = document.querySelector('#preview figure.explainer'); if (!f) return null; const cap = f.querySelector('figcaption');
    return { part: f.getAttribute('data-part'), lines: cap.children.length, hook: !!cap.querySelector('.ex-hook'), trade: !!cap.querySelector('.ex-trade'), text: cap.innerText, words: (cap.innerText.match(/\S+/g) || []).length,
      moving: f.querySelector('svg').getAnimations({ subtree: true }).filter(a => a.playState === 'running').length }; });
  ok(!!ex && ex.part === goodId, 'tap: selecting a part shows its explainer (no hover on a phone)');
  ok(!!ex && ex.lines === 1 && !ex.hook && !ex.trade, 'tap: the explainer is one line (' + (ex && ex.text) + ')');
  ok(!!ex && ex.words <= 21, 'tap: that line is short (' + (ex && ex.words) + ' words)');
  ok(!!ex && ex.moving > 0, 'tap: the mini animation runs');
  ok(await inView(p, '#preview'), 'tap: the explainer is on screen');
  ok(await p.locator(sel).getAttribute('aria-pressed') === 'false' && /TAP AGAIN TO ADD/.test(await p.locator(sel).innerText()), 'tap: the first tap does not place the part (it says TAP AGAIN TO ADD)');
  await p.tap(sel); await p.waitForTimeout(200);
  ok(await p.locator(sel).getAttribute('aria-pressed') === 'true', 'tap: a second tap places it (the explainer does not block it)');
  ok(await p.locator('#preview figure.explainer').count() === 1, 'tap: the explainer stays after the part is placed');
  ok(await T.noScroll(p), 'phone Build: no sideways scroll');
  await p.screenshot({ path: path.join(shots, 'clarity-p1-tap-390.png') });
  ok(errors.length === 0, 'no console errors on the phone ' + errors.join(' | '));
  await ctx.close();

  // ================================================================ Part 2, Normal, 1366x768
  console.log('[Part 2, Normal, 1366x768]');
  ({ p, errors, ctx } = await open(b, { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 }));
  await part2Build(p, 'solar');
  const good2 = T.CONTRACT.solar.parts;
  // Empty design: only a rocket to pay for, so the profit is negative and red.
  let line = await profitOf(p, '[data-key="profit-line"]');
  ok(/^PROFIT -\$/.test(line.text) && /\bneg\b/.test(line.cls), 'Build: a design that only costs shows PROFIT in the negative class (' + line.text + ')');
  const red = await cssVar(p, '--bad'), green = await cssVar(p, '--info-ink');
  ok(await colour(p, '[data-key="profit-line"] .profit-amount') === red, 'Build: a negative profit is red');
  await p.screenshot({ path: path.join(shots, 'clarity-p2-build-neg-1366.png') });
  // ---- WHY, on Part 2's Build (the solar contract wants solar and radiation instruments)
  await p.click('[data-key="bin-instrument"]');
  const cards2 = await p.evaluate(() => [...document.querySelectorAll('.part:not(.locked)')].map(c => ({ key: c.getAttribute('data-key'), note: (c.querySelector('.part-note') || {}).innerText || '' })));
  const bad = cards2.find(c => /Does not count/.test(c.note)), count2 = cards2.find(c => !c.note);
  ok(!!bad && !!count2, 'Part 2 Build has an instrument that does not count for the solar job and one that does');
  const badId = bad.key.replace('part-', ''), count2Id = count2.key.replace('part-', '');
  await p.locator(`[data-key="${count2.key}"]`).scrollIntoViewIfNeeded();
  await p.locator(`[data-key="${count2.key}"]`).hover(); await p.waitForTimeout(150);
  ok(await p.locator('#preview .part-why').count() === 0, 'WHY: not shown for a part that counts (' + count2Id + ')');
  await p.locator(`[data-key="${bad.key}"]`).hover(); await p.waitForTimeout(150);
  const whyText = (await p.locator('#preview [data-key="why-' + badId + '"]').innerText()).replace(/\s+/g, ' ');
  const wants = await p.evaluate(() => getObjective('solar').wants.join(' or '));
  const reads = await p.evaluate(id => getPart(id).tags.join(' and '), badId);
  ok(/^WHY\?/.test(whyText) && whyText.includes('Job wants ' + wants) && whyText.includes(reads), 'WHY: what the job wants against what the part is (' + whyText + ')');
  ok(T.words(whyText.replace(/^WHY\?\s*/, '')) <= 12, 'WHY: about 12 words or fewer');
  ok(await colour(p, '#preview .part-why') === await cssVar(p, '--accent-ink'), 'WHY: in the existing warning colour');
  ok(await p.evaluate(() => { const s = getComputedStyle(document.querySelector('#preview .part-why')); return s.boxShadow === 'none' && s.backgroundImage === 'none' && s.borderTopWidth !== '0px'; }), 'WHY: flat (a border, no shadow, no gradient)');
  ok(await p.evaluate(() => { const box = document.getElementById('preview'), r = box.querySelector('.part-why').getBoundingClientRect(), br = box.getBoundingClientRect(); return r.top >= br.top && r.bottom <= br.bottom; }), 'WHY: visible in the preview without scrolling');
  await p.screenshot({ path: path.join(shots, 'clarity-p2-why-1366.png') });
  // Place it: the WHY stays on Build (preview and the science panel), so the player sees why the bar did not move.
  await p.click(`[data-key="${bad.key}"]`); await p.waitForTimeout(200);
  ok(await p.locator(`[data-key="${bad.key}"]`).getAttribute('aria-pressed') === 'true', 'the part that does not count can still be placed');
  ok(await p.locator('#preview [data-key="why-' + badId + '"]').count() === 1, 'WHY: still shown in the preview after the part is placed');
  ok(await p.locator('.stack [data-key="why-' + badId + '"]').count() === 1, 'WHY: listed with the science preview once the part is on board');
  const sciText = (await p.locator('.stack [data-key="why-' + badId + '"]').innerText()).replace(/\s+/g, ' ');
  ok(sciText.includes(await p.evaluate(id => getPart(id).name, badId)), 'WHY (science panel): names the part (' + sciText + ')');
  await p.screenshot({ path: path.join(shots, 'clarity-p2-placed-1366.png') });
  await p.click(`[data-key="${bad.key}"]`); await p.waitForTimeout(200);   // take it off again: the flight below is the proof design
  ok(await p.locator('.stack .part-why').count() === 0, 'WHY: gone from the science panel once the part is off the satellite');
  await T.addParts(p, good2);
  line = await profitOf(p, '[data-key="profit-line"]');
  ok(/^PROFIT \+\$/.test(line.text) && /\bpos\b/.test(line.cls) && line.musd > 0, 'Build: a design that pays shows PROFIT +$ in the positive class (' + line.text + ')');
  ok(await colour(p, '[data-key="profit-line"] .profit-amount') === green && green !== red, 'Build: a positive profit is green (the UI\'s good colour)');
  ok(Math.abs(parseM(line.text) - line.musd) < 0.051, 'Build: the shown amount is the back end\'s number (' + line.text + ' for ' + line.musd + ')');
  const pay = (await p.locator('[data-key="contract-pay"] .payout-line').innerText()).replace(/\s+/g, ' ');
  ok(/Pays \$/.test(pay) && /costs \$/.test(pay) && /with the cheapest rocket/.test(pay) && !/net /.test(pay), 'Build: one short line under PROFIT with pay and cost (' + pay + ')');
  ok(await inView(p, '[data-key="profit-line"]'), 'Build 1366x768: PROFIT is in the first screen');
  await p.screenshot({ path: path.join(shots, 'clarity-p2-build-pos-1366.png') });
  // The same profit once the rocket is chosen.
  const before = line.musd;
  await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'LAUNCH VEHICLE');
  await p.click(`[data-key="rocket-${T.CONTRACT.solar.launcher}"]`);
  line = await profitOf(p, '[data-key="profit-line"]');
  ok(near(line.musd, before), 'Rocket Yard: the same profit with the rocket chosen (' + line.musd + ' vs ' + before + ')');
  await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'READINESS');
  await p.locator('.btn.big').click(); await T.waitHead(p, 'MISSION');
  await T.fly(p, 'first');
  ok(await T.waitHead(p, 'DEBRIEF'), 'the flight reaches its debrief');
  await p.waitForTimeout(1500);
  const rows = await p.locator('[data-key="cash-ledger"] .cb-row').evaluateAll(r => r.map(x => parseFloat(x.getAttribute('data-musd'))));
  const cashBefore = rows[0], cashNow = rows[rows.length - 1];
  line = await profitOf(p, '[data-key="debrief-profit-line"]');
  ok(near(line.musd, cashNow - cashBefore), 'debrief: PROFIT equals the cash now minus the cash before the launch (' + line.musd + ' vs ' + (cashNow - cashBefore) + ')');
  ok(/^PROFIT \+\$/.test(line.text) && /\bpos\b/.test(line.cls) && await colour(p, '[data-key="debrief-profit-line"] .profit-amount') === green, 'debrief: a profit is green (' + line.text + ')');
  ok(await p.evaluate(() => { const r = document.querySelector('[data-key="debrief-profit"]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), 'debrief 1366x768: PROFIT is in the first screen');
  const sub = (await p.locator('[data-key="debrief-profit"] .nasa-line').innerText()).replace(/\s+/g, ' ');
  ok(/^Paid \$/.test(sub) && /cost \$/.test(sub), 'debrief: one short line with what it paid and what it cost (' + sub + ')');
  await p.screenshot({ path: path.join(shots, 'clarity-p2-debrief-pos-1366.png') });
  ok(errors.length === 0, 'no console errors in Part 2 ' + errors.join(' | '));
  await ctx.close();

  // A flight that earns nothing: the debrief's PROFIT is red and negative (the topic is already fully known, so no client pays).
  console.log('[Part 2, a flight that does not pay]');
  ({ p, errors, ctx } = await open(b, { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 }));
  await T.startComeback(p, 'standard');
  await p.evaluate(key => { const c = JSON.parse(localStorage.getItem(key)); c.knowledge_science.solar = 1e6; localStorage.setItem(key, JSON.stringify(c)); }, KEY);
  await T.launchContract(p, 'solar', { review: true });
  await p.keyboard.press('m'); await T.waitHead(p, 'BASE MAP'); await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
  line = await profitOf(p, '[data-key="profit-line"]');
  ok(/^PROFIT -\$/.test(line.text) && /\bneg\b/.test(line.cls) && /Nothing new is left to collect/.test(await p.locator('[data-key="contract-pay"] .payout-line').innerText()), 'Build: nothing new to collect, so PROFIT is negative (' + line.text + ')');
  await p.keyboard.press('m'); await T.waitHead(p, 'BASE MAP'); await p.click('[data-key="blip-review"]'); await T.waitHead(p, 'READINESS');
  await p.locator('.btn.big').click(); await T.waitHead(p, 'MISSION');
  await T.fly(p, 'first');
  ok(await T.waitHead(p, 'DEBRIEF'), 'the unpaid flight reaches its debrief');
  await p.waitForTimeout(1500);
  const rows2 = await p.locator('[data-key="cash-ledger"] .cb-row').evaluateAll(r => r.map(x => parseFloat(x.getAttribute('data-musd'))));
  line = await profitOf(p, '[data-key="debrief-profit-line"]');
  ok(line.musd < 0 && near(line.musd, rows2[rows2.length - 1] - rows2[0]) && /^PROFIT -\$/.test(line.text), 'debrief: an unpaid flight shows a negative PROFIT equal to the cash change (' + line.text + ')');
  ok(await colour(p, '[data-key="debrief-profit-line"] .profit-amount') === red && /\bneg\b/.test(line.cls), 'debrief: a loss is red');
  await p.screenshot({ path: path.join(shots, 'clarity-p2-debrief-neg-1366.png') });
  await ctx.close();

  // ================================================================ Part 2 on a phone
  console.log('[Part 2, Normal, 390x844]');
  ({ p, errors, ctx } = await open(b, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }));
  await part2Build(p, 'solar');
  await T.addParts(p, good2);
  line = await profitOf(p, '[data-key="profit-line"]');
  ok(/^PROFIT \+\$/.test(line.text) && await colour(p, '[data-key="profit-line"] .profit-amount') === green, 'phone Build: PROFIT is shown and green (' + line.text + ')');
  await p.evaluate(() => window.scrollTo(0, 0));
  ok(await inView(p, '[data-key="profit-line"]'), 'phone Build: PROFIT is on the first screen, above the bins');
  ok(await T.noScroll(p), 'phone Part 2 Build: no sideways scroll');
  await p.screenshot({ path: path.join(shots, 'clarity-p2-build-390.png') });
  // The same Part 2 Build: an instrument that does not count shows WHY.
  await p.click('[data-key="bin-instrument"]');
  const wrong = await p.evaluate(() => [...document.querySelectorAll('.part:not(.locked)')].map(c => ({ key: c.getAttribute('data-key'), note: (c.querySelector('.part-note') || {}).innerText || '' })).find(c => /Does not count/.test(c.note)));
  if (wrong) {
    await p.locator(`[data-key="${wrong.key}"]`).scrollIntoViewIfNeeded();
    await p.tap(`[data-key="${wrong.key}"]`); await p.waitForTimeout(200);
    const wt = (await p.locator('#preview .part-why').innerText()).replace(/\s+/g, ' ');
    const solarWants = await p.evaluate(() => getObjective('solar').wants.join(' or '));
    ok(wt.includes('Job wants ' + solarWants), 'phone Part 2: WHY names what the contract wants (' + wt + ')');
  } else ok(false, 'phone Part 2: an instrument that does not count for the solar job');
  ok(errors.length === 0, 'no console errors on the Part 2 phone ' + errors.join(' | '));
  await ctx.close();

  await b.close();
  done();
})().catch(e => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });
