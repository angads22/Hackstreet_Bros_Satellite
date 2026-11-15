// Part 2, Ajay's comeback, in the page at desktop 1280 and phone 390: the difficulty picker, Ajay's intro, the workshop
// (stakes, contracts, words), one contract flown with a design the back end proves (lib.js CONTRACT.solar), the debrief's
// money checked against the back end (and against the same flight run in Node), PAY BACK, then a loss by the deadline
// (a flight that lands too late, after editing the saved campaign) and a loss by cash (an edited save), and a win
// (PAY ALL with enough cash). No literal money: every expectation is read from the back end at test time.
// Usage: node comeback.js [shots dir]   or   node comeback.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { repo, url, shots } = T.args();
const { ok, done } = T.checker();
const KEY = 'smdg-campaign';

// The same first flight in Node, with the back end of the same repo: what the debrief must show.
function nodeFlight(tierId, topic) {
  const load = require(path.join(repo, 'tests', 'load.js'));
  const G = load({ storage: load.memoryStorage() });
  const start = G.newComeback(tierId, T.SEEDS[tierId]);
  const k = start.contracts.find(x => x.topic === topic);
  if (!k) return null;
  const d = G.newComebackDesign(k.id);
  if (T.CONTRACT[topic].orbit && !d.orbit) G.setOrbit(d, T.CONTRACT[topic].orbit);
  T.CONTRACT[topic].parts.forEach(id => G.addPart(d, id));
  G.setLauncher(d, T.CONTRACT[topic].launcher);
  const m = G.startMission(d);
  let s, n = 0;
  do { s = G.stepMonth(m); if (s.event) G.chooseEvent(m, 0); n++; } while (!s.ended && n < 400);
  return G.recordResult(m);
}
const editSave = (p, body) => p.evaluate(([key, body]) => {
  const c = JSON.parse(localStorage.getItem(key)); new Function('c', body)(c); localStorage.setItem(key, JSON.stringify(c));
}, [KEY, body]);
const money = v => '$' + (Math.round(v * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: v < 1 ? 2 : 1 }) + 'M';
const near = (a, b) => Math.abs(a - b) < 1e-6;
const parseM = t => { const m = /(-?)\$([\d,.]+)M/.exec(t); return m ? (m[1] ? -1 : 1) * parseFloat(m[2].replace(/,/g, '')) : NaN; };

async function ledger(p, key) {
  return p.locator(`[data-key="${key}"] .cb-row`).evaluateAll(rows => rows.map(r => ({
    musd: parseFloat(r.getAttribute('data-musd')), text: r.innerText.replace(/\n/g, ' '), total: r.classList.contains('cb-total') })));
}
function addsUp(rows) {
  const items = rows.filter(r => !r.total), total = rows.find(r => r.total);
  const raw = items.reduce((a, r) => a + r.musd, 0);
  const shown = items.reduce((a, r) => a + parseM(r.text), 0);
  return { raw: near(Math.round(raw * 1000) / 1000, total.musd), shown: Math.abs(shown - parseM(total.text)) < 0.005, total };
}

async function run(viewport, label) {
  console.log(`[comeback ${label}]`);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport });
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  p.on('dialog', d => d.accept());
  const shot = n => p.screenshot({ path: path.join(shots, `comeback-${label}-${n}.png`), fullPage: true });
  const hub = () => p.evaluate(() => getComeback());
  const bodyWords = () => p.evaluate(() => document.body.innerText).then(T.words);
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload(); await T.seedRuns(p);

  // ---- the picker: three difficulties, each with its cash, debt and deadline from CAMPAIGN.comeback
  ok(/^START/.test(await p.locator('[data-key="part2-go"]').innerText()), 'home: Part 2 reads START');
  await p.click('[data-key="part2-go"]');
  const tiers = await p.evaluate(() => CAMPAIGN.comeback.tiers);
  for (const [id, name] of [['training', 'EASY'], ['standard', 'NORMAL'], ['expert', 'HARD']]) {
    const t = await p.locator(`[data-key="level-${id}"]`).innerText();
    ok(t.includes(name) && t.includes(money(tiers[id].cash_musd)) && t.includes(money(tiers[id].debt_musd)) && t.includes(tiers[id].deadline_months + ' months'),
      `picker: ${name} shows its cash, debt and deadline (${t.replace(/\n/g, ' ')})`);
  }
  ok(await T.noScroll(p), 'picker: no sideways scroll');
  console.log('     picker words: ' + await bodyWords());
  await shot('1-picker');

  // ---- Ajay's intro, then the workshop
  await p.click('[data-key="level-standard"]');
  const beats = await T.throughBeats(p);
  console.log('     intro: ' + beats.join(' | '));
  ok(beats.length >= 4 && beats.length <= 6 && /Albert Orbital/.test(beats.join(' ')) && /workshop/.test(beats.join(' ')), `Ajay's intro: ${beats.length} beats, the debt and the workshop`);
  ok(await T.waitHead(p, 'WORKSHOP'), 'the intro ends at the workshop');
  let h = await hub();
  ok(h && h.tier === 'standard' && h.flights === 0, 'a Normal comeback is running');
  ok(await p.locator('#cb-debt').innerText() === money(h.debt_musd) && await p.locator('#cb-cash').innerText() === money(h.cash_musd) &&
     await p.locator('#cb-months').innerText() === String(h.months_left), 'workshop: DEBT, CASH and MONTHS LEFT from getComeback()');
  ok(await p.locator('.cb-job').count() === h.contracts.length && h.contracts.length === 3, 'workshop: one card per open contract (3)');
  for (const k of h.contracts) {
    const t = await p.locator(`[data-key="job-${k.topic}"]`).innerText();
    ok(t.includes(k.client) && t.includes(money(k.price_musd)) && t.includes(money(k.bonus_musd)) && t.includes(k.min_science + ' POINTS') &&
      (!k.orbit_name || t.toUpperCase().includes(k.orbit_name.toUpperCase())), `contract card ${k.topic}: client, price, bonus, minimum${k.orbit_name ? ', orbit' : ''}`);
  }
  const say = await p.locator('.cb .say').first().innerText();
  ok(/YOUR PARTNER/.test(say) && await p.locator('.cb .say .portrait').count() === 1, 'workshop: one line from the partner, with a portrait');
  const pays = await p.locator('[data-key="pay-panel"] .btn').allInnerTexts();
  ok(pays.every(x => parseM(x) > 0 && parseM(x) < h.safe_pay_max_musd) && !pays.some(x => /PAY ALL/.test(x)),
    `PAY BACK: amounts under the safe most (${h.safe_pay_max_musd}), never all of it, no PAY ALL while cash < debt: ${pays.join(', ')}`);
  const total = await bodyWords();
  const cards = await p.locator('.cb-job').evaluateAll(els => els.map(e => e.innerText).join(' ')).then(T.words);
  console.log(`     workshop words: ${total} on the page, ${cards} on the contract cards, ${total - cards} the rest`);
  ok(total - cards <= 65, `workshop: about 60 words besides the contract cards (${total - cards})`);
  ok(await T.noScroll(p), 'workshop: no sideways scroll');
  ok(await p.locator('#hint').isHidden(), 'workshop: no hint bar');
  await shot('2-workshop');

  // ---- fly the solar contract with the proof design
  const k = h.contracts.find(x => x.topic === 'solar');
  ok(!!k, 'Normal opens with a solar contract');
  if (!k) { await b.close(); return; }
  const cashBefore = h.cash_musd, debtBefore = h.debt_musd;
  await p.click('[data-key="fly-solar"]');
  ok(await T.waitHead(p, 'BASE MAP'), 'FLY THIS opens the base map');
  ok(/MONTH 0\/\d+ · CASH .* · DEBT /.test(await p.locator('#status').innerText()), 'header: month / deadline, cash and debt (' + await p.locator('#status').innerText() + ')');
  ok(await p.locator('[data-key="map-workshop"]').innerText() === 'BACK TO THE WORKSHOP', 'map: BACK TO THE WORKSHOP');
  await p.click('[data-key="blip-briefing"]'); await T.waitHead(p, 'BRIEFING');
  const brief = await p.locator('#app').innerText();
  ok(brief.includes(k.client.toUpperCase()) && brief.includes(k.reason) && await p.locator('.cb-job.brief').count() === 1, 'briefing: the client says its reason, and the contract card');
  ok(await p.locator('button[data-key^="obj-"]').count() === 0 && /Set by the contract/.test(brief), 'briefing: the topic is set by the contract (nothing to click)');
  ok(await T.noScroll(p), 'briefing: no sideways scroll');
  await shot('3-briefing');
  await p.keyboard.press('m'); await T.waitHead(p, 'BASE MAP');
  await p.click('[data-key="blip-build"]'); ok(await T.waitHead(p, 'BUILD'), 'the Workshop is open (the orbit is set by the contract)');
  await T.addParts(p, T.CONTRACT.solar.parts);
  const line = await p.locator('[data-key="contract-pay"]').innerText();
  console.log('     pay line: ' + line.replace(/\n/g, ' | '));
  ok(/with the cheapest rocket/.test(line) && /PROFIT/.test(line), 'Build pay line counts the cheapest rocket and leads with PROFIT');
  await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'LAUNCH VEHICLE');
  await p.click(`[data-key="rocket-${T.CONTRACT.solar.launcher}"]`);
  const line2 = await p.locator('[data-key="contract-pay"]').innerText();
  ok(parseM(line2.split('PROFIT')[1]) === parseM(line.split('PROFIT')[1]), `the PROFIT on Build equals the PROFIT with the rocket chosen (${line2.replace(/\n/g, ' | ')})`);
  await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'READINESS');
  ok(await p.locator('[data-key="deadline-banner"]').count() === 0, 'review: no deadline banner when it lands in time');
  ok(await T.noScroll(p), 'review: no sideways scroll');
  await p.locator('.btn.big').click(); await T.waitHead(p, 'MISSION');
  ok(/^PART 2 · MONTH 0\/\d+ · CASH /.test(await p.locator('#status').innerText()), 'mission header: the comeback\'s clock, cash and debt');
  await T.fly(p, 'first');
  ok(await T.waitHead(p, 'DEBRIEF'), 'debrief');
  await p.waitForTimeout(400);

  // ---- the debrief's money: it adds up, it matches the back end, and it matches the same flight in Node
  h = await hub();
  const expect = nodeFlight('standard', 'solar');
  const cash = await ledger(p, 'cash-ledger'), debt = await ledger(p, 'debt-ledger');
  console.log('     cash: ' + cash.map(r => r.text).join(' | '));
  console.log('     debt: ' + debt.map(r => r.text).join(' | '));
  const c1 = addsUp(cash), d1 = addsUp(debt);
  ok(c1.raw && c1.shown, 'CASH: before + launch + paid + bonus - events = CASH NOW (raw values, and as shown)');
  ok(d1.raw && d1.shown, 'DEBT: before + interest = DEBT NOW (raw values, and as shown)');
  ok(near(cash[0].musd, cashBefore) && near(debt[0].musd, debtBefore), 'the ledger starts from the cash and debt the workshop showed');
  ok(near(c1.total.musd, h.cash_musd) && near(d1.total.musd, h.debt_musd), 'CASH NOW and DEBT NOW are the back end\'s after the flight');
  const paidRow = cash.find(r => /PAID/.test(r.text)), bonusRow = cash.find(r => /BONUS/.test(r.text));
  ok(expect && near(paidRow.musd, expect.contract_paid_musd) && near(bonusRow ? bonusRow.musd : 0, expect.contract_bonus_musd) &&
     near(h.cash_musd, expect.cash_musd) && near(h.debt_musd, expect.debt_musd),
    `the same flight in Node pays the same (paid ${expect && expect.contract_paid_musd}, bonus ${expect && expect.contract_bonus_musd}, cash ${expect && expect.cash_musd})`);
  ok(await p.locator('[data-key="months-left"] strong').innerText() === String(h.months_left), 'MONTHS LEFT from the back end');
  ok(/^PAID$/.test(await p.locator('.cb-stamp').innerText()) && await p.locator('.cb-meter').count() === 1, 'a PAID stamp and the debt meter');
  ok(await p.locator('[data-key="debrief-workshop"]').count() === 1 && await p.locator('.btn', { hasText: 'REBUILD' }).count() === 0, 'one way on: BACK TO THE WORKSHOP (no REBUILD)');
  ok(/Pleasure doing business/.test(await p.locator('.screen > .say').last().innerText()), "the client's last word: paid");
  ok(/MONTH \d+\/\d+ · CASH/.test(await p.locator('#status').innerText()) && !/SCORE/.test(await p.locator('#status').innerText()), 'debrief header: the comeback, not a score');
  ok(await T.noScroll(p), 'debrief: no sideways scroll');
  await p.waitForTimeout(700);   // the stamp has landed
  await shot('4-debrief');

  // ---- back at the workshop: the flight log, then PAY BACK
  await p.click('[data-key="debrief-workshop"]');
  const after1 = await p.evaluate(() => StarlineUI.story().ajay.interludes['after-1'].map(b => b.text));
  ok(await p.locator('.intro').count() === 1 && /MUM/.test(await p.locator('.intro .say-name').innerText()), 'after the first flight: Mum calls before the workshop (an interlude)');
  ok((await T.throughBeats(p)).join('|') === after1.join('|'), "Mum's scene is the story text, beat by beat (" + after1.length + ' beats)');
  await T.waitHead(p, 'WORKSHOP');
  await shot('4b-after-mum');
  ok(await p.locator('.intro').count() === 0 && await p.locator('.cb-log li').count() === 1 && await p.locator('#cb-cash').innerText() === money(h.cash_musd), 'workshop: one flight in the log, the new cash');
  const first = p.locator('[data-key="pay-panel"] .btn').first();
  const amount = parseM(await first.innerText());
  await first.click(); await p.waitForTimeout(300);
  const h2 = await hub();
  ok(near(h2.debt_musd, Math.round((h.debt_musd - amount) * 1000) / 1000) && near(h2.cash_musd, Math.round((h.cash_musd - amount) * 1000) / 1000),
    `PAY BACK ${money(amount)}: the debt and the cash both drop by it`);
  ok(new RegExp('Paid ' + money(amount).replace('$', '\\$')).test(await p.locator('#pay-note').innerText()) && await p.locator('#cb-debt').innerText() === money(h2.debt_musd),
    'the workshop says what was paid and shows the new debt');
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id) === 'pay-note' && await p.evaluate(() => scrollY) > 0, 'after paying, the page stays at PAY BACK');
  await shot('5-paid');
  await p.click('[data-key="hub-home"]'); await p.click('[data-key="part2-go"]'); await T.waitHead(p, 'WORKSHOP');
  ok(await p.locator('#pay-note').count() === 0, 'the payment message does not come back on a later visit');

  // ---- a payment the back end refuses (the cash changed under the open workshop): its own reason is shown
  const cashNow = (await hub()).cash_musd;
  await editSave(p, 'c.treasury_musd = 0.05;');
  const tryAmount = parseM(await p.locator('[data-key="pay-panel"] .btn').first().innerText());
  await p.locator('[data-key="pay-panel"] .btn').first().click();
  const reason = await p.evaluate(a => payDebt(a).reason, tryAmount);
  ok(!!reason && await p.locator('#pay-note.bad').innerText() === reason, 'a refused payment shows payDebt\'s reason: ' + reason);
  await editSave(p, 'c.treasury_musd = ' + cashNow + ';');
  await p.evaluate(() => window.showComebackHub());

  // ---- a contract that names no orbit: the Tracking Station is the next stop and its cards can be chosen
  const free = (await hub()).contracts.find(x => !x.orbit);
  if (free) {
    await p.click(`[data-key="fly-${free.topic}"]`); await T.waitHead(p, 'BASE MAP');
    ok(/NEXT/.test(await p.locator('[data-key="legend-orbit"]').innerText()) && /Tracking Station/i.test(await p.locator('#objective').innerText()),
      `${free.topic} (no orbit named): the Tracking Station is next`);
    await p.click('[data-key="blip-orbit"]'); await T.waitHead(p, 'ORBIT');
    ok(await p.locator('.preset-note').count() === 0 && await p.locator('button.card[data-key^="orbit-"]:not([disabled])').count() > 0, 'its orbit cards can be chosen');
    await p.locator('button.card[data-key^="orbit-"]:not([disabled]):not(.dim)').first().click();
    await p.click('.nav-row .btn.primary');
    ok(await T.waitHead(p, 'BUILD'), 'an orbit chosen: on to the Workshop');
    await p.keyboard.press('m'); await T.waitHead(p, 'BASE MAP');
    await p.click('[data-key="map-workshop"]'); await T.waitHead(p, 'WORKSHOP');
  } else console.log('     (every open contract names an orbit: the free-orbit check is skipped)');

  // ---- a topic with nothing new left (the save says it is fully known): Build says so, the debrief says NOT PAID and why
  const nothing = (await hub()).contracts.find(x => T.CONTRACT[x.topic] && (!x.orbit || x.orbit === T.CONTRACT[x.topic].orbit));
  if (nothing) {
    await editSave(p, 'c.knowledge_science["' + nothing.topic + '"] = 1e6;');
    await T.launchContract(p, nothing.topic, { review: true });
    await p.keyboard.press('m'); await T.waitHead(p, 'BASE MAP'); await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
    ok(/Nothing new is left to collect/.test(await p.locator('.payout-line').innerText()), `Build: nothing new to collect on ${nothing.topic}, the client pays nothing`);
    await p.keyboard.press('m'); await T.waitHead(p, 'BASE MAP'); await p.click('[data-key="blip-review"]'); await T.waitHead(p, 'READINESS');
    await p.locator('.btn.big').click(); await T.waitHead(p, 'MISSION');
    await T.fly(p, 'first'); await T.waitHead(p, 'DEBRIEF');
    const res = await p.locator('[data-key="contract-result"]').innerText();
    ok(/NOT PAID/.test(await p.locator('.cb-stamp').innerText()) && /Nothing new/.test(res), 'debrief: NOT PAID, and why (nothing new)');
    ok(/can't pay for it/.test(await p.locator('.screen > .say').last().innerText()), "the client's last word: nothing paid");
    const c2 = addsUp(await ledger(p, 'cash-ledger'));
    ok(c2.raw && c2.shown, 'NOT PAID: the cash still adds up');
    await p.waitForTimeout(700);
    await shot('5b-not-paid');
    await p.click('[data-key="debrief-workshop"]'); await T.pastScenes(p); await T.waitHead(p, 'WORKSHOP');   // the second flight brings Iron Eclipse's offer: refused here
  } else console.log('     (no open contract has a proof design here: the NOT PAID check is skipped)');

  // ---- a flight that lands after the deadline (the saved campaign moved close to it, and the solar contract flown
  // first opened again, with the back end's own terms): the TOO LATE banner, then the lost ending
  await editSave(p, 'c.month = c.deadline_month - 3; c.offers.forEach(function (k) { if (!k.done) k.expires_month = c.month + 12; });' +
    'var s = c.offers.filter(function (k) { return k.topic === "solar"; })[0];' +
    'if (s && !c.offers.some(function (k) { return k.topic === "solar" && !k.done; })) c.offers.push(Object.assign({}, s, { id: s.id + "-again", done: false, expires_month: c.month + 12 }));' +
    'c.knowledge_science.solar = 0;');
  await p.reload(); await T.seedRuns(p); await p.click('[data-key="part2-go"]'); await T.pastScenes(p); await T.waitHead(p, 'WORKSHOP');
  ok(/No flight can land before the deadline/.test(await p.locator('[data-key="stat-months"]').innerText()) &&
     /warn/.test(await p.locator('[data-key="stat-months"]').getAttribute('class')), 'workshop: the countdown warns that no flight can land in time');
  ok(await p.locator('[data-key="fly-solar"]').count() === 1, 'a solar contract is open (opened again if needed)');
  await T.launchContract(p, 'solar', { review: true });
  ok(await p.locator('[data-key="deadline-banner"]').isVisible() && /TOO LATE/.test(await p.locator('[data-key="deadline-banner"]').innerText()),
    'review: a prominent TOO LATE banner for a flight that lands after the deadline');
  ok(/LAUNCH ANYWAY/.test(await p.locator('.btn.big').innerText()), 'review: it is a warning (LAUNCH ANYWAY), not a blocker');
  await shot('6-too-late');
  await p.locator('.btn.big').click(); await T.waitHead(p, 'MISSION');
  await T.fly(p, 'first'); await T.waitHead(p, 'DEBRIEF');
  ok(/THE DEADLINE HAS PASSED/.test(await p.locator('[data-key="contract-result"]').innerText()) && await p.locator('[data-key="debrief-ending"]').count() === 1,
    'debrief: the comeback is over, and the one button goes to the ending');
  await p.click('[data-key="debrief-ending"]');
  await T.waitHead(p, 'OUT OF TIME');
  let e = await p.evaluate(() => getComebackEnding());
  ok(e && !e.won && e.lost_reason === 'deadline' && (await p.locator('.cb-end').innerText()).includes(e.headline), 'the lost ending (by time): its headline');
  const timeoutText = await p.evaluate(() => StarlineUI.story().ajay.endings.timeout);
  const lostPage = await p.locator('#app').innerText();
  ok(lostPage.includes(timeoutText.title.toUpperCase()) && lostPage.includes(timeoutText.line) && /KEYS TAKEN/.test(await p.locator('.cb-stamp').innerText()),
    'lost: the story\'s ending for a missed deadline (its title and closing line) and the stamp');
  ok(/ENDINGS \d \/ 7/.test(await p.locator('.cb-end-bar').innerText()), 'lost: the found-endings counter is on the screen');
  ok(await p.locator('[data-key="end-again"]').count() === 1 && await p.locator('[data-key="end-home"]').count() === 1, 'lost: TRY AGAIN and HOME');
  ok(await T.noScroll(p), 'ending: no sideways scroll');
  console.log('     ending words: ' + await bodyWords());
  await shot('7-lost-time');
  await p.click('[data-key="end-home"]');
  ok(/^START/.test(await p.locator('[data-key="part2-go"]').innerText()), 'home after a finished comeback: START');

  // ---- lost on cash (an edited save): the workshop's own route goes to the ending
  await p.click('[data-key="part2-go"]'); await p.click('[data-key="level-standard"]'); await T.throughBeats(p); await T.waitHead(p, 'WORKSHOP');
  await editSave(p, 'c.treasury_musd = 0.01; c.finished = true; c.won = false;');
  await p.evaluate(() => window.showComebackHub());
  ok(await T.waitHead(p, 'OUT OF MONEY'), 'lost by cash: the ending says so');
  const brokeText = await p.evaluate(() => StarlineUI.story().ajay.endings.broke);
  ok((await p.locator('#app').innerText()).includes(brokeText.line), 'lost by cash: the story\'s closing line');
  await shot('8-lost-cash');

  // ---- a win: enough cash to pay it all
  await p.click('[data-key="end-again"]');
  ok(await p.locator('.cb-level').count() === 3, 'TRY AGAIN opens the picker');
  await p.click('[data-key="level-training"]'); await T.throughBeats(p); await T.waitHead(p, 'WORKSHOP');
  await editSave(p, 'c.treasury_musd = c.debt_musd + 1;');
  await p.reload(); await T.seedRuns(p);
  ok(/^CONTINUE/.test(await p.locator('[data-key="part2-go"]').innerText()), 'home: a comeback running reads CONTINUE');
  await p.click('[data-key="part2-go"]'); await T.waitHead(p, 'WORKSHOP');
  ok(await p.locator('[data-key="pay-all"]').count() === 1, 'PAY ALL appears once the cash covers the debt');
  await p.click('[data-key="pay-all"]');
  ok(await T.waitHead(p, 'WORKSHOP IS YOURS'), 'PAY ALL wins: the workshop is yours');
  e = await p.evaluate(() => getComebackEnding());
  ok(e.won && (await p.locator('.cb-end').innerText()).includes(e.headline) && /PAID OFF/.test(await p.locator('.cb-stamp').innerText()), 'the won ending: headline and stamp');
  ok(e.epilogue && (await p.locator('.cb-epilogue').innerText()) === e.epilogue, 'the epilogue from the back end');
  ok(await T.noScroll(p), 'won ending: no sideways scroll');
  await shot('9-won');
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await b.close();
}

// Reduced motion: the stamp and the debt meter do not move.
async function reduced() {
  console.log('[comeback, reduced motion]');
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload(); await T.seedRuns(p);
  await T.startComeback(p, 'training');
  await editSave(p, 'c.treasury_musd = c.debt_musd + 1;');
  await p.evaluate(() => window.showComebackHub());
  const tr = await p.locator('.cb-meter-debt').evaluate(n => getComputedStyle(n).transitionDuration);
  ok(tr === '0s', 'reduced motion: the meter does not slide (' + tr + ')');
  await p.click('[data-key="pay-all"]'); await T.waitHead(p, 'WORKSHOP IS YOURS');
  const an = await p.locator('.cb-stamp').evaluate(n => getComputedStyle(n).animationName);
  ok(an === 'none', 'reduced motion: the stamp does not animate (' + an + ')');
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await b.close();
}

(async () => {
  await run({ width: 1280, height: 800 }, 'desktop');
  await run({ width: 390, height: 844 }, 'phone');
  await reduced();
  done();
})();
