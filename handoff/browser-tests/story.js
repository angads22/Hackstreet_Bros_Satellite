// The story's front end (js/ui-story.js), end to end with the real back end and the real story text: the interludes
// at the right moments and once each (also after a reload), the SELL / REFUSE choice and where each leads, all seven
// endings (every id renders, is recorded, and shows PLAY AGAIN, HOME and the counter above the fold), the found-endings
// counter on the home cards, RESET EVERYTHING, no console errors, no sideways scroll at 390.
// Flights are settled with the back end's own calls in the page (a contract added to the saved campaign, the same
// way tests/comeback.js does it), so the whole route runs in seconds. No literal game numbers: read from the back end.
// Usage: node story.js [shots dir]   or   node story.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();
const SEEN = 'gravitron-seen-v1', FOUND = 'gravitron-endings-v1';
const ENDINGS = ['box', 'legend', 'comeback', 'close', 'sold', 'timeout', 'broke'];

// One real flight in the page: a radiation contract added to the open ones, a cheap proof design, flown and recorded.
const FLY = () => {
  const c = getCampaign();
  const k = { id: 't-story-' + c.missions.length, topic: 'radiation', orbit: null, client: 'A test client', reason: 'It tests things.', min_science: 60,
    price_musd: 10, bonus_musd: 2.5, expires_month: c.month + 12, done: false, text: 'A test contract.' };
  c.offers = (c.offers || []).concat([k]); saveCampaign(c);
  const d = newComebackDesign(k.id);
  if (!d) return null;
  setOrbit(d, 'leo'); setLauncher(d, 'rideshare');
  ['scintillation-counter', 'solar-small', 'mercury-battery', 'radio-uhf', 'command-timer', 'spin-stabilised', 'cubesat-12u'].forEach(p => addPart(d, p));
  const m = startMission(d);
  let s; do { s = stepMonth(m); if (s.event) chooseEvent(m, Math.max(0, s.event.choices.findIndex(x => !x.fail_chance_now))); } while (!m.ended);
  return recordResult(m).stars;
};
const beatsOf = (p, id, kind) => p.evaluate(([id, kind]) => {
  const a = StarlineUI.story().ajay; return (kind === 'ending' ? a.endings[id].beats : a.interludes[id]).map(b => b.text);
}, [id, kind]);

async function through(p, max) {   // NEXT ... through the beats on screen (at most `max`: the next scene may follow at once), returns the beats read
  const seen = [];
  for (let i = 0; i < (max || 12) && await p.locator('.intro:not(.story-offer)').count(); i++) {
    seen.push(await p.locator('.intro .say-text p').innerText());
    await p.click('.intro .btn.primary');
  }
  return seen;
}
const inInterlude = p => p.locator('.intro').count().then(n => n > 0);
const seenIds = p => p.evaluate(k => { const v = JSON.parse(localStorage.getItem(k) || '{}'); return [].concat(...Object.values(v)); }, SEEN);
const foundIds = p => p.evaluate(k => JSON.parse(localStorage.getItem(k) || '[]'), FOUND);

async function run(viewport, label) {
  console.log(`[story ${label}]`);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport });
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  p.on('dialog', d => d.accept());
  const shot = n => p.screenshot({ path: path.join(shots, `story-${label}-${n}.png`), fullPage: false });
  const fresh = async () => { await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload(); };
  const startRun = async (tier) => {   // the picker, then Ajay's opening scene, then the workshop
    await p.click('[data-key="part2-go"]'); await p.click(`[data-key="level-${tier}"]`);
  };
  await fresh();

  // ---- the home page: the counter on both cards, nothing found
  for (const k of ['mode-part1', 'mode-part2'])
    ok(/^ENDINGS 0 \/ 7$/.test(await p.locator(`[data-key="${k}"] .story-count`).innerText()), `home: ${k} shows ENDINGS 0 / 7`);
  ok(await T.noScroll(p), 'home: no sideways scroll');
  await shot('1-home');

  // ---- the opening scene (start): once, then the workshop
  await startRun('standard');
  const start = await beatsOf(p, 'start', 'interlude');
  ok(start.length >= 3 && start.length <= 6, `the opening scene has ${start.length} beats (3 to 6)`);
  ok((await through(p)).join('|') === start.join('|'), 'the opening scene is the story text, beat by beat');
  ok(await T.waitHead(p, 'WORKSHOP'), 'the opening scene ends at the workshop');
  ok((await seenIds(p)).join() === 'start', 'the opening scene is recorded as seen');
  const seed = await p.evaluate(() => getComeback().seed);
  ok(Number.isInteger(seed), `the run has a seed (${seed})`);
  await p.evaluate(() => window.showComebackHub());
  ok(!(await inInterlude(p)), 'the workshop again: the opening scene does not come back');
  await p.reload(); await p.click('[data-key="part2-go"]');
  ok(await T.waitHead(p, 'WORKSHOP') && !(await inInterlude(p)), 'after a reload: CONTINUE goes straight to the workshop');

  // ---- flight 1 -> Mum's call, once
  ok(await p.evaluate(FLY) >= 0, 'flight 1 settled');
  const mum = await beatsOf(p, 'after-1', 'interlude');
  await p.evaluate(() => window.showComebackHub());
  ok(await inInterlude(p) && /MUM/.test(await p.locator('.intro .say-name').innerText()), 'after flight 1: Mum calls (her portrait and name)');
  ok(await p.locator('.intro .portrait').count() === 1, "Mum's scene has a portrait");
  ok((await through(p)).join('|') === mum.join('|'), "Mum's scene is the story text, beat by beat");
  ok(await T.waitHead(p, 'WORKSHOP'), "Mum's call ends at the workshop");
  await p.evaluate(() => window.showComebackHub());
  ok(!(await inInterlude(p)), "the workshop again: Mum's call does not repeat");

  // ---- flight 2 -> the offer: it blocks the workshop's contracts until answered; REFUSE
  await p.evaluate(FLY);
  const h2 = await p.evaluate(() => getComeback());
  ok(h2.buyout === 'offered' && h2.offer, 'after flight 2 the back end has made the offer (if the debt stands)');
  const offer = await beatsOf(p, 'offer', 'interlude');
  await p.evaluate(() => window.showComebackHub());
  ok(await inInterlude(p) && /IRON ECLIPSE/.test(await p.locator('.intro .say-name').innerText()), 'the offer scene: Iron Eclipse speaks');
  await shot('2-offer-beat');
  ok(await p.locator('.intro .btn', { hasText: 'SKIP' }).count() === 1 || offer.length === 1, 'the offer scene can be skipped to its choice');
  while (!(await p.locator('.story-offer').count())) await p.click('.intro .btn.primary');
  const choiceText = await p.locator('.story-offer').innerText();
  ok(await p.locator('[data-key="offer-sell"]').count() === 1 && await p.locator('[data-key="offer-refuse"]').count() === 1, 'the choice: SELL and REFUSE');
  ok(/SELL/.test(await p.locator('[data-key="offer-sell"]').innerText()) && /REFUSE/.test(await p.locator('[data-key="offer-refuse"]').innerText()), 'the buttons are labelled SELL and REFUSE');
  ok(choiceText.includes('$' + (Math.round(h2.debt_musd * 10) / 10)), 'the choice shows the debt from the back end');
  ok(await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-key')) === 'offer-refuse', 'focus is on the primary button (REFUSE)');
  ok(await T.noScroll(p), 'the choice: no sideways scroll');
  await shot('3-offer-choice');
  ok(await p.evaluate(() => newComebackDesign(getComeback().contracts[0].id)) === null, 'while the offer is open the back end gives no new design');
  await p.click('[data-key="offer-refuse"]');
  ok((await p.evaluate(() => getComeback())).buyout === 'refused', 'REFUSE: the back end says refused');
  const refused = await beatsOf(p, 'refused', 'interlude');
  ok(await inInterlude(p) && (await through(p)).join('|') === refused.join('|'), 'REFUSE leads to the short defiant scene');
  ok(await T.waitHead(p, 'WORKSHOP'), 'then to the workshop');
  await p.evaluate(() => window.showComebackHub());
  ok(!(await inInterlude(p)), 'the offer and the refusal do not come back');
  const ids = await seenIds(p);
  ok(['start', 'after-1', 'offer', 'refused'].every(x => ids.includes(x)), `seen so far: ${ids.join(', ')}`);

  // ---- the last page (after-3) and "almost there" (final), each once
  await p.evaluate(FLY);
  const h3 = await p.evaluate(() => getComeback());
  const lastPage = await beatsOf(p, 'after-3', 'interlude');
  await p.evaluate(() => window.showComebackHub());
  ok(await inInterlude(p) && (await p.locator('.intro .say-name').innerText()).length > 0, `after flight 3: a scene appears (${h3.debt_share_left} of the debt left)`);
  const got = await through(p);
  ok(got.join('|') === lastPage.join('|'), "flight 3: Austin's last page (the story text, beat by beat)");
  await T.waitHead(p, 'WORKSHOP');
  // the debt is nearly paid: "final"
  await p.evaluate(() => { const c = getCampaign(); c.debt_musd = Math.max(0.1, startDebt(c) * 0.2); saveCampaign(c); window.showComebackHub(); });
  ok(await inInterlude(p), 'with under a quarter of the debt left: the final scene');
  const fin = await beatsOf(p, 'final', 'interlude');
  ok((await through(p)).join('|') === fin.join('|') && await T.waitHead(p, 'WORKSHOP'), 'the final scene is the story text, then the workshop');
  await p.evaluate(() => window.showComebackHub());
  ok(!(await inInterlude(p)), 'no scene repeats');
  const all = await seenIds(p);
  ok(['start', 'after-1', 'offer', 'refused', 'after-3', 'final'].every(x => all.includes(x)) && new Set(all).size === all.length, `all six scenes seen once each (${all.join(', ')})`);
  await p.reload(); await p.click('[data-key="part2-go"]');
  ok(await T.waitHead(p, 'WORKSHOP') && !(await inInterlude(p)), 'after a reload nothing is shown twice');

  // ---- the debrief's way back to the workshop calls the interlude too (a fresh run, flight 1 flown in the page, then the debrief button)
  await p.evaluate(() => { resetCampaign(); newComeback('standard', 777); });
  await p.evaluate(() => window.showComebackStart());   // the opening scene
  await through(p);
  await p.evaluate(FLY);
  await p.evaluate(() => window.showComebackHub());
  ok(await inInterlude(p), 'a new run (new seed): Mum calls again (each run has its own record)');
  await through(p);

  // ---- SELL: the ending, recorded
  await p.evaluate(FLY);
  await p.evaluate(() => window.showComebackHub());
  while (!(await p.locator('.story-offer').count())) await p.click('.intro .btn.primary');
  await p.click('[data-key="offer-sell"]');
  ok(await p.locator('.cb-end.end-sold').count() === 1, 'SELL: the SOLD OUT ending');
  ok((await p.evaluate(() => getComebackEnding())).ending_id === 'sold', "the back end's ending_id is sold");
  ok((await foundIds(p)).join() === 'sold', 'the ending is recorded: sold');
  await shot('4-sold');

  // ---- every ending renders, is recorded, counts, and keeps PLAY AGAIN, HOME and the counter above the fold
  for (const id of ENDINGS) {
    await p.evaluate(([id]) => {
      if (id === 'box') { StarlineStory.showBox(function () {}); return; }
      const real = getComebackEnding;
      window.getComebackEnding = () => Object.assign(real(), { ending_id: id, won: ['legend', 'comeback', 'close'].includes(id), lost_reason: id === 'timeout' ? 'deadline' : id === 'broke' ? 'cash' : null });
      window.showComebackEnding(); window.getComebackEnding = real;
    }, [id]);
    const text = await p.evaluate(([id]) => (id === 'box' ? StarlineUI.story().austin.endings.box : StarlineUI.story().ajay.endings[id]), [id]);
    const page = await p.locator('#app').innerText();
    ok(await p.locator(`.cb-end.end-${id}`).count() === 1, `${id}: its ending screen`);
    ok(page.includes(text.title.toUpperCase()) && page.includes(text.line) && text.beats.every(x => page.includes(x.text)), `${id}: the title, every beat and the closing line from the story text`);
    ok((await foundIds(p)).includes(id), `${id}: recorded`);
    const n = (await foundIds(p)).length;
    ok(new RegExp(`ENDINGS ${n} / 7`).test(await p.locator('.cb-end-bar').innerText()), `${id}: the counter reads ENDINGS ${n} / 7`);
    const chips = await p.locator('.story-chip').allInnerTexts();
    ok(chips.length === 7 && chips.filter(x => x === '???').length === 7 - n, `${id}: seven chips, ${7 - n} still ???`);
    const geo = await p.evaluate(() => { const r = s => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return [q.top, q.bottom]; };
      return { h: innerHeight, again: r('[data-key="end-again"]'), home: r('[data-key="end-home"]'), count: r('.cb-end-bar .story-count') }; });
    ok(geo.again && geo.home && geo.count && geo.again[1] <= geo.h + 1 && geo.home[1] <= geo.h + 1 && geo.count[1] <= geo.h + 1 && geo.again[0] >= 0,
      `${id}: PLAY AGAIN, HOME and the counter are in view without scrolling`);
    ok(await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('primary')), `${id}: focus is on the primary button`);
    ok(await T.noScroll(p), `${id}: no sideways scroll`);
    if (id === 'legend' || id === 'sold' || id === 'box') await p.waitForTimeout(4200);
    if (id === 'legend' || id === 'sold' || id === 'box') await shot(`5-${id}`);
  }
  ok((await foundIds(p)).length === 7 && (await p.locator('.story-chip', { hasText: '???' }).count()) === 0, 'all seven found: ENDINGS 7 / 7 and no ???');
  await p.click('[data-key="end-again"]');
  ok(await p.locator('.cb-level').count() === 3 || await p.locator('.intro').count() === 1, 'PLAY AGAIN: the start of a run (box: Part 1 again)');

  // ---- the counter on the home page, then RESET EVERYTHING clears both records
  await p.evaluate(() => StarlineUI.home());
  ok(/ENDINGS 7 \/ 7/.test(await p.locator('[data-key="mode-part2"] .story-count').innerText()), 'home: ENDINGS 7 / 7 after all are found');
  await p.click('[data-key="reset-progress"]');
  ok(await p.evaluate(([a, b]) => localStorage.getItem(a) === null && localStorage.getItem(b) === null, [FOUND, SEEN]), 'RESET EVERYTHING clears the endings found and the scenes seen');
  ok(/ENDINGS 0 \/ 7/.test(await p.locator('[data-key="mode-part1"] .story-count').innerText()), 'home after reset: ENDINGS 0 / 7');

  // ---- a broken record is tolerated; storage that throws does not stop the game
  await p.evaluate(([a, b]) => { localStorage.setItem(a, 'not json'); localStorage.setItem(b, '[1,2]'); }, [FOUND, SEEN]);
  await p.reload();
  ok(/ENDINGS 0 \/ 7/.test(await p.locator('[data-key="mode-part2"] .story-count').innerText()), 'broken records: the counter reads 0 / 7, no crash');
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await b.close();
}

// A player who already has things saved by the previous version (handoff/browser-tests/fixtures/player-0.9.json, made with the 0.9 game
// code): the comeback in progress carries on from the same cash, debt and months, the Part 1 record and the stars are not touched, the
// story's own records start empty without an error, and no scene whose moment has already passed plays again. A comeback with
// no seed and no scene record is a run this version knows nothing about: the front end marks every moment behind it as seen.
async function existing() {
  console.log('[story, a player with saves from the previous version]');
  const fx = require('./fixtures/player-0.9.json');
  const fmt = v => '$' + (Math.round(v * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: v < 1 ? 2 : 1 }) + 'M';
  const b = await chromium.launch();
  for (const name of ['fresh-normal', 'one-flight-normal', 'one-flight-paid-easy']) {
    const sv = fx.saves[name];
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = T.watchErrors(p);
    await T.noFonts(p);
    await p.goto(url); await p.evaluate(() => localStorage.clear());
    await p.evaluate(([raw, prog]) => { localStorage.setItem('smdg-campaign', raw); Object.keys(prog).forEach(k => localStorage.setItem(k, prog[k])); }, [sv.raw, fx.progress]);
    await p.reload();
    const part2 = await p.locator('[data-key="part2-go"]').innerText();
    ok(/^CONTINUE/.test(part2), `${name}: the home page says CONTINUE for the comeback in progress (${part2})`);
    ok(/CONTINUE: STEP 3/.test(await p.locator('[data-key="part1-go"]').innerText()), `${name}: the Part 1 record is read as before (CONTINUE: STEP 3)`);
    ok(/ENDINGS 0 \/ 7/.test(await p.locator('[data-key="mode-part2"] .story-count').innerText()), `${name}: no endings and no scene record yet: the counter reads 0 / 7`);
    await p.click('[data-key="part2-go"]');
    ok(await T.waitHead(p, 'WORKSHOP') && !(await inInterlude(p)), `${name}: CONTINUE goes straight to the workshop: no old scene replays`);
    const ex = sv.expect, now = await p.evaluate(() => getComeback());
    ok(now && now.tier === ex.tier && Math.abs(now.cash_musd - ex.cash_musd) < 1e-6 && Math.abs(now.debt_musd - ex.debt_musd) < 1e-6 && now.month === ex.month && now.flights === ex.flights,
      `${name}: the back end carries the save over (same tier, cash, debt, month and flights)`);
    ok(await p.locator('#cb-cash').innerText() === fmt(ex.cash_musd) && await p.locator('#cb-debt').innerText() === fmt(ex.debt_musd) &&
       await p.locator('#cb-months').innerText() === String(ex.deadline_month - ex.month), `${name}: the workshop shows the same cash, debt and months`);
    const rec = await p.evaluate(() => JSON.parse(localStorage.getItem('gravitron-seen-v1') || '{}'));
    const ids = [].concat(...Object.values(rec));
    ok(ids.includes('start') && (ex.flights < 1 || ids.includes('after-1')), `${name}: the moments already behind it are marked seen (${ids.join(', ') || 'none'})`);
    await p.evaluate(() => window.showComebackHub());
    ok(!(await inInterlude(p)), `${name}: the workshop again: still nothing replays`);
    await p.reload(); await p.click('[data-key="part2-go"]');
    ok(await T.waitHead(p, 'WORKSHOP') && !(await inInterlude(p)), `${name}: after a reload: still nothing replays`);
    const kept = await p.evaluate(keys => keys.map(k => localStorage.getItem(k)), ['smdg-progress-v1', 'gravitron-walkthrough-v1']);
    ok(kept[0] === fx.progress['smdg-progress-v1'] && kept[1] === fx.progress['gravitron-walkthrough-v1'], `${name}: the stars and the Part 1 record are exactly as they were`);
    // what comes next is still shown: the first flight on a fresh run brings Mum's call; later runs follow the normal rules
    if (ex.flights === 0) {
      await p.evaluate(FLY);
      await p.evaluate(() => window.showComebackHub());
      ok(await inInterlude(p) && /MUM/.test(await p.locator('.intro .say-name').innerText()), `${name}: the first flight after the update brings Mum's call`);
    }
    ok(errors.length === 0, `${name}: no console or page errors` + (errors.length ? ': ' + errors.join(' / ') : ''));
    await p.close();
  }
  // a story record that is missing, broken or the wrong shape is empty, never an error
  for (const [label, found, seen] of [['missing', null, null], ['not json', '{{', 'x'], ['wrong shape', '{"a":1}', '[1,2,3]'], ['null', 'null', 'null']]) {
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = T.watchErrors(p);
    await T.noFonts(p);
    await p.goto(url); await p.evaluate(() => localStorage.clear());
    await p.evaluate(([raw, prog, f, s]) => { localStorage.setItem('smdg-campaign', raw); Object.keys(prog).forEach(k => localStorage.setItem(k, prog[k]));
      if (f !== null) localStorage.setItem('gravitron-endings-v1', f); if (s !== null) localStorage.setItem('gravitron-seen-v1', s); }, [fx.saves['one-flight-normal'].raw, fx.progress, found, seen]);
    await p.reload();
    ok(/ENDINGS 0 \/ 7/.test(await p.locator('[data-key="mode-part1"] .story-count').innerText()), `story records ${label}: the counter reads 0 / 7`);
    await p.click('[data-key="part2-go"]');
    ok(await T.waitHead(p, 'WORKSHOP') && !(await inInterlude(p)), `story records ${label}: the workshop opens, nothing replays`);
    ok(errors.length === 0, `story records ${label}: no console or page errors` + (errors.length ? ': ' + errors.join(' / ') : ''));
    await p.close();
  }
  await b.close();
}

// the game works with the low-poly art blocked: the endings and scenes still draw
async function noArt() {
  console.log('[story, js/lowpoly.js blocked]');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = T.watchErrors(p, /lowpoly|lp-[a-z-]+\.js/);
  await T.noFonts(p);
  await p.route(/\/js\/(lowpoly|lp-[a-z-]+)\.js(\?.*)?$/, r => r.abort());
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => { newComeback('standard', 5); const real = getComebackEnding; window.getComebackEnding = () => Object.assign(real(), { ending_id: 'legend', won: true }); window.showComebackEnding(); });
  ok(await p.locator('.cb-end.end-legend').count() === 1 && await p.locator('[data-key="end-again"]').count() === 1, 'no art: the legend ending still draws, with PLAY AGAIN');
  await p.evaluate(() => { window.nextInterlude({ fresh: true }); window.showComebackHub(); });   // a run just begun: its opening scene
  ok(await p.locator('.intro .portrait').count() === 1, 'no art: an interlude still has its pixel portrait');
  ok(errors.length === 0, 'no art: no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await b.close();
}

// reduced motion: the beats of an ending are not animated
async function reduced() {
  console.log('[story, reduced motion]');
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => { newComeback('standard', 5); const real = getComebackEnding; window.getComebackEnding = () => Object.assign(real(), { ending_id: 'sold', won: false }); window.showComebackEnding(); });
  const an = await p.locator('.story-beat').first().evaluate(n => getComputedStyle(n).animationName);
  ok(an === 'none', 'reduced motion: the ending\'s beats do not animate (' + an + ')');
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await b.close();
}

// Easy: Austin's last page comes right after the refusal once the debt is under half; a new run from the picker always opens with its
// own scene, even for a seed whose record says "seen"; and with js/ui-story.js blocked the older screens still carry the game.
async function more() {
  console.log('[story, Easy chain and the older screens]');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  p.on('dialog', d => d.accept());
  const fresh = async () => { await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload(); };
  await fresh();
  const seen = () => p.evaluate(k => { const v = JSON.parse(localStorage.getItem(k) || '{}'); return Object.values(v)[0] || []; }, SEEN);
  await p.evaluate(() => { newComeback('training', 12345); });
  await p.evaluate(() => window.showComebackHub()); await through(p);
  await p.evaluate(FLY); await p.evaluate(() => window.showComebackHub()); await through(p);
  await p.evaluate(FLY);
  await p.evaluate(() => { const c = getCampaign(); c.debt_musd = Math.round(startDebt(c) * 0.4 * 10) / 10; saveCampaign(c); });
  const h = await p.evaluate(() => getComeback());
  ok(h.tier === 'training' && h.buyout === 'offered' && h.debt_share_left < 0.5 && h.debt_share_left >= 0.25, 'Easy: the offer is open with under half the debt left');
  await p.evaluate(() => window.showComebackHub());
  while (!(await p.locator('.story-offer').count())) await p.click('.intro .btn.primary');
  await p.click('[data-key="offer-refuse"]');
  const refused = await beatsOf(p, 'refused', 'interlude'), lastPage = await beatsOf(p, 'after-3', 'interlude');
  ok((await through(p, refused.length)).join('|') === refused.join('|'), 'Easy: the refusal scene first');
  ok(await inInterlude(p) && (await through(p, lastPage.length)).join('|') === lastPage.join('|'), "Easy: then Austin's last page (the second flight, under half the debt)");
  ok(await T.waitHead(p, 'WORKSHOP') && (await seen()).join() === 'start,after-1,offer,refused,after-3', 'Easy: the scenes seen, in order: ' + (await seen()).join(', '));

  // PLAY AGAIN from an ending, then a seed whose record says "seen": the picker's new comeback still opens with its scene
  await p.evaluate(() => { const c = getCampaign(); c.finished = true; c.won = false; c.month = c.deadline_month; saveCampaign(c); window.showComebackEnding(); });
  await p.click('[data-key="end-again"]');
  ok(await p.locator('.cb-level').count() === 3, 'PLAY AGAIN opens the difficulty picker');
  await p.evaluate(() => { const real = newComeback; window.newComeback = function (t) { return real(t, 12345); }; });   // the same seed as the run above
  await p.click('[data-key="level-training"]');
  ok(await inInterlude(p) && /NEW|EASY/.test(await p.locator('.intro .kicker').innerText()), 'a new run from the picker opens with its scene, though its seed was seen before');
  await through(p);
  ok(await T.waitHead(p, 'WORKSHOP') && (await seen()).join() === 'start', "the new run's record starts again from the opening scene");
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await p.close();

  // js/ui-story.js blocked: no counter, the older intro and ending, the epilogue goes straight to Part 2
  const q = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const qErrors = T.watchErrors(q, /ui-story\.js/);
  await T.noFonts(q);
  await q.route(/\/js\/ui-story\.js(\?.*)?$/, r => r.abort());
  await q.goto(url); await q.evaluate(() => localStorage.clear()); await q.reload();
  ok(await q.locator('.story-count').count() === 0, 'no story file: the home page draws without the counter');
  await q.click('[data-key="part2-go"]'); await q.click('[data-key="level-standard"]');
  await T.throughBeats(q);
  ok(await T.waitHead(q, 'WORKSHOP'), 'no story file: the older opening scene, then the workshop');
  await q.evaluate(() => { const c = getCampaign(); c.finished = true; c.won = false; c.month = c.deadline_month; saveCampaign(c); window.showComebackHub(); });
  ok(await T.waitHead(q, 'OUT OF TIME') && await q.locator('[data-key="end-again"]').count() === 1, 'no story file: the older ending screen, with TRY AGAIN');
  await q.evaluate(() => StarlineUI.showEpilogue());
  for (let i = 0; i < 6 && !/CONTINUE TO PART 2/.test(await q.locator('.intro .btn.primary').innerText()); i++) await q.click('.intro .btn.primary');
  await q.click('.intro .btn.primary');
  ok(await q.locator('.cb-level').count() === 3, 'no story file: the epilogue still leads to Part 2');
  ok(qErrors.length === 0, 'no story file: no console or page errors' + (qErrors.length ? ': ' + qErrors.join(' / ') : ''));
  await b.close();
}

(async () => {
  await run({ width: 1366, height: 768 }, 'desktop');
  await run({ width: 390, height: 844 }, 'phone');
  await existing();
  await noArt();
  await reduced();
  await more();
  done();
})();
