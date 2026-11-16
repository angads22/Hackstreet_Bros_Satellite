// The journal, STORY SO FAR (js/ui-story.js, css/story.css, STORY.journal in js/ui-design.js): what the player has learned,
// as short entries with a face; an entry not reached yet is a dim "???". It is read only and opens from the base map, the
// Part 2 workshop and the home page cards, and BACK or Esc return to where the player was.
// Checks, with the real back end and a fixed seed (T.seedRuns, T.pastScenes):
//   - the text: every entry short, no digits, $ or %, never "AI", a known speaker, a known unlock moment;
//   - nothing unlocked, no button on the home cards; Part 1 steps unlock rules as they are reached, the discovery, Voss and the box when step 3 passes;
//   - Part 2: a new run knows the lenders, Mara and the disowning; the parents' house after flight 1 (flown for real); the offer and what the player chose
//     (REFUSE keeps SOLD locked, SELL shows it and the run's end); the stakes and the next step come from getComeback();
//   - the 0.9 saves in tests/fixtures/player-0.9.json show a sensible journal without replaying a scene and without writing anything;
//   - opens from the map (Part 1 and Part 2 designs) and the workshop and returns; Esc and BACK; keyboard reachable with a visible focus;
//   - no sideways scroll at 1366x768 and 390x844; the era follows the part; reduced motion;
//   - nothing is written to storage by opening, switching part or closing it; no console errors;
//   - with js/lowpoly.js blocked the faces are still drawn; with js/ui-story.js blocked the buttons are absent and the game runs.
// Usage: node journal.js [shots dir]   or   node journal.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const T = require('./lib');
const { repo, url, shots } = T.args();
const { ok, done } = T.checker();
const fx = JSON.parse(fs.readFileSync(path.join(repo, 'tests', 'fixtures', 'player-0.9.json'), 'utf8'));
const PROGRESS = fx.progress['smdg-progress-v1'], WALK = fx.progress['gravitron-walkthrough-v1'];
const DESK = { width: 1366, height: 768 }, PHONE = { width: 390, height: 844 };

async function page(b, viewport, store, opts) {
  opts = opts || {};
  const p = await b.newPage({ viewport, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  const errors = T.watchErrors(p, opts.allow);
  await T.noFonts(p);
  for (const re of opts.block || []) await p.route(re, r => r.abort());
  await p.goto(url);
  await p.evaluate(s => { localStorage.clear(); Object.keys(s || {}).forEach(k => localStorage.setItem(k, s[k])); }, store || {});
  await p.reload();
  await T.seedRuns(p);
  await p.waitForTimeout(150);
  return { p, errors };
}
const storage = p => p.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
const known = p => p.evaluate(() => [...document.querySelectorAll('.jr-entry.known')].map(e => e.getAttribute('data-key').replace('journal-', '')));
const locked = p => p.evaluate(() => [...document.querySelectorAll('.jr-entry.locked')].map(e => e.getAttribute('data-key').replace('journal-', '')));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const tab = (p, n) => p.click(`[data-key="journal-tab-${n}"]`);
const inJournal = p => p.locator('[data-key="journal"]').count().then(n => n === 1);
// Open the journal with the part's tab on and wait for it.
async function openFrom(p, key, part) {
  await p.click(`[data-key="${key}"]`);
  await p.locator('[data-key="journal"]').waitFor({ timeout: 5000 });
  if (part) { await tab(p, part); await p.waitForTimeout(50); }
}

(async () => {
  const b = await chromium.launch();

  // ---------------------------------------------------------------- the text
  console.log('[the text]');
  {
    const { p, errors } = await page(b, DESK);
    const J = await p.evaluate(() => { const s = window.StarlineUI.story(); return { j: s.journal, speakers: Object.keys(s.speakers) }; });
    const WHEN = ['start', 'step-1', 'step-2', 'step-3', 'after-1', 'after-3', 'offer', 'refused', 'sold'];
    ok(J.j && Array.isArray(J.j.part1) && Array.isArray(J.j.part2), 'STORY.journal has part1 and part2 lists');
    const all = J.j.part1.concat(J.j.part2);
    ok(all.every(e => typeof e.id === 'string' && J.speakers.includes(e.who) && typeof e.text === 'string' && WHEN.includes(e.when)),
      `${all.length} entries, each { id, who, text, when } with a known speaker and unlock moment`);
    ok(new Set(all.map(e => e.id)).size === all.length, 'every entry id is different');
    const long = all.filter(e => e.text.length > 72);
    ok(long.length === 0, 'no entry over 72 characters (one or two short lines)' + long.map(e => '\n      ' + e.id + ': ' + e.text.length).join(''));
    const strings = all.map(e => e.text).concat(Object.values(J.j.next), [J.j.title, J.j.locked]);
    ok(strings.every(s => !/[0-9$%]/.test(s)), 'no digit, $ or % in the journal text (the numbers come from the back end)');
    ok(strings.every(s => !/\bAI\b/.test(s)), 'the word "AI" never appears');
    ok(J.j.part1.length >= 6 && J.j.part2.length >= 6, 'Part 1 and Part 2 each have a list worth keeping');
    ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await p.close();
  }

  // ---------------------------------------------------------------- nothing unlocked: no button on the cards
  console.log('[a new player]');
  {
    const { p, errors } = await page(b, DESK);
    ok(await p.locator('[data-key^="journal-mode"]').count() === 0, 'nothing unlocked: no JOURNAL button on either home card');
    ok(await p.evaluate(() => typeof window.StarlineStory.openJournal === 'function'), 'the journal is there (StarlineStory.openJournal)');
    ok(errors.length === 0, 'no console errors');
    await p.close();
  }

  // ---------------------------------------------------------------- Part 1: from the map, as steps are reached and passed
  for (const [label, viewport] of [['desktop', DESK], ['phone', PHONE]]) {
    console.log(`[Part 1 from the map, ${label}]`);
    const { p, errors } = await page(b, viewport);
    await p.click('[data-key="part1-go"]'); await T.throughBeats(p); await T.waitHead(p, 'BASE MAP'); await p.waitForTimeout(300);
    ok(await p.locator('[data-key="map-journal"]').count() === 1, 'the map has a JOURNAL button');
    const before = await storage(p);
    await openFrom(p, 'map-journal');
    ok(await p.locator('.screen-head h1', { hasText: 'STORY SO FAR' }).count() === 1, 'it opens on STORY SO FAR');
    ok(await p.locator('[data-key="journal-tab-1"][aria-pressed="true"]').count() === 1, 'a Part 1 design opens on the Part 1 list');
    ok(same(await known(p), ['setup', 'rule-1']), 'in step 1: the 1957 setup and rule one are known: ' + JSON.stringify(await known(p)));
    ok(same(await locked(p), ['rule-2', 'rule-3', 'discovery', 'voss', 'box']), 'the rest are locked: ' + JSON.stringify(await locked(p)));
    const dash = await p.locator('.jr-entry.locked .jr-text').allInnerTexts();
    ok(dash.length === 5 && dash.every(t => t.trim() === '???'), 'every locked entry reads ???');
    ok(await p.locator('.jr-entry.known .jr-face').count() === 2 && await p.locator('.jr-entry.known .jr-face img, .jr-entry.known .jr-face svg').count() === 2, 'each known entry has a face');
    ok(/NEXT\s*STEP 1/.test(await p.locator('[data-key="journal-next"]').innerText()), 'what to do next: step 1 (a few words)');
    ok(await p.evaluate(() => document.body.dataset.era) === '1958', 'Part 1 wears the 1958 look');
    ok(await T.noScroll(p), 'no sideways scroll');
    await p.screenshot({ path: path.join(shots, `journal-part1-step1-${label}.png`) });
    // the other part, a new player: Part 2 is all locked, and says where to start
    await tab(p, 2);
    ok((await known(p)).length === 0 && (await locked(p)).length === 9, 'Part 2 before any run: all nine locked');
    ok(/comeback from the home page/i.test(await p.locator('[data-key="journal-next"]').innerText()), 'it says to start the comeback from the home page');
    ok(await p.evaluate(() => document.body.dataset.era) === 'today', 'Part 2 wears the modern look');
    ok(await p.locator('.jr-now .facts').count() === 0, 'no stakes before a run');
    ok(await T.noScroll(p), 'no sideways scroll on the Part 2 list');
    await tab(p, 1);
    // Esc goes back to the map, and the JOURNAL button has the focus
    await p.keyboard.press('Escape');
    ok(await T.waitHead(p, 'BASE MAP'), 'Esc returns to the base map');
    ok(await p.locator('[data-key="map-journal"]').evaluate(e => e === document.activeElement), 'the JOURNAL button has the focus again');
    ok(await storage(p) === before, 'opening, switching part and closing wrote nothing to storage');
    // BACK does the same, and the walk (stepToward) still works after
    await openFrom(p, 'map-journal');
    await p.click('[data-key="journal-back"]');
    ok(await T.waitHead(p, 'BASE MAP') && await p.locator('[data-key="blip-build"]').count() === 1, 'BACK returns to the base map');
    ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await p.close();
  }

  // ---------------------------------------------------------------- Part 1 record: steps passed
  console.log('[Part 1 record]');
  {
    const cases = [
      [{ 1: 2 }, ['setup', 'rule-1'], 'step 1 passed: the setup and rule one (step 2 not reached yet)'],
      [{ 1: 2, 2: 3 }, ['setup', 'rule-1', 'rule-2', 'rule-3'], 'steps 1 and 2 passed: the three rules'],
      [{ 1: 1, 2: 1, 3: 1 }, ['setup', 'rule-1', 'rule-2', 'rule-3', 'discovery', 'voss', 'box'], 'all three passed: the discovery, Voss and the box']
    ];
    for (const [done_, want, what] of cases) {
      const { p, errors } = await page(b, DESK, { 'gravitron-walkthrough-v1': JSON.stringify({ done: done_ }) });
      ok(await p.locator('[data-key="journal-mode-part1"]').count() === 1 && await p.locator('[data-key="journal-mode-part2"]').count() === 0,
        'home: JOURNAL on the Part 1 card only (nothing in Part 2 yet)');
      await openFrom(p, 'journal-mode-part1');
      ok(same(await known(p), want), what + ': ' + JSON.stringify(await known(p)));
      await p.keyboard.press('Escape');
      ok(await p.locator('.big-title').isVisible() && await p.locator('[data-key="journal-mode-part1"]').evaluate(e => e === document.activeElement), 'Esc returns to the home page, JOURNAL focused');
      ok(errors.length === 0, 'no console errors');
      await p.close();
    }
  }

  // ---------------------------------------------------------------- Part 2: a fixed seed, flown for real
  for (const [label, viewport] of [['desktop', DESK], ['phone', PHONE]]) {
    console.log(`[Part 2 live run, seed 20, ${label}]`);
    const { p, errors } = await page(b, viewport);
    await T.startComeback(p, 'standard');
    ok(await p.locator('[data-key="hub-journal"]').count() === 1, 'the workshop has a JOURNAL button');
    const before = await storage(p);
    await openFrom(p, 'hub-journal');
    ok(await p.locator('[data-key="journal-tab-2"][aria-pressed="true"]').count() === 1, 'from the workshop it opens on the Part 2 list');
    ok(same(await known(p), ['lenders', 'girl', 'disowned']), 'a new run knows the lenders, Mara leaving and the parents disowning him: ' + JSON.stringify(await known(p)));
    const stakes = await p.evaluate(() => { const c = getComeback(), U = window.StarlineUI; return { debt: U.money(c.debt_musd), months: U.num(c.months_left, 0) }; });
    const facts = await p.locator('.jr-now .facts').innerText();
    ok(facts.includes(stakes.debt) && facts.includes(stakes.months) && /DEBT/.test(facts) && /MONTHS LEFT/.test(facts), `the stakes come from the back end: ${stakes.debt} and ${stakes.months} months`);
    ok(/Pick a contract/i.test(await p.locator('[data-key="journal-next"]').innerText()), 'what to do next: pick a contract');
    ok(await T.noScroll(p), 'no sideways scroll');
    await p.screenshot({ path: path.join(shots, `journal-part2-new-${label}.png`) });
    await p.click('[data-key="journal-back"]');
    ok(await T.waitHead(p, 'WORKSHOP'), 'BACK returns to the workshop');
    ok(await storage(p) === before, 'nothing written to storage');
    ok(same(await p.evaluate(() => JSON.parse(localStorage.getItem('gravitron-seen-v1'))[String(getComeback().seed)]), ['start']), 'the seen record is the run\'s own, untouched (the lenders)');
    if (label === 'desktop') {
      // the map of a Part 2 design: the journal opens from there and comes back to the map
      await p.click('[data-key="fly-solar"]'); await T.waitHead(p, 'BASE MAP'); await p.waitForTimeout(300);
      await openFrom(p, 'map-journal');
      ok(await p.locator('[data-key="journal-tab-2"][aria-pressed="true"]').count() === 1, 'a Part 2 design opens the Part 2 list');
      await p.click('[data-key="journal-back"]');
      ok(await T.waitHead(p, 'BASE MAP'), 'BACK returns to the Part 2 map');
      await p.keyboard.press('m'); await p.waitForTimeout(100);
      // back to the workshop and fly one contract: the parents' letter comes after flight 1
      await p.click('[data-key="map-workshop"]'); await T.waitHead(p, 'WORKSHOP');
      await T.launchContract(p, 'solar'); await T.fly(p, 'first'); await T.waitHead(p, 'DEBRIEF');
      await p.click('[data-key="debrief-workshop"]');
      await T.pastScenes(p);
      ok(await T.waitHead(p, 'WORKSHOP'), 'after the debrief and the parents\' letter: the workshop');
      await openFrom(p, 'hub-journal');
      ok(same(await known(p), ['lenders', 'girl', 'disowned', 'house']), 'after flight 1 the parents\' house is in the journal: ' + JSON.stringify(await known(p)));
      ok(/DEBT/.test(await p.locator('.jr-now .facts').innerText()), 'the stakes are still shown');
      await p.screenshot({ path: path.join(shots, `journal-part2-after1-${label}.png`) });
      await p.keyboard.press('Escape');
      ok(await T.waitHead(p, 'WORKSHOP'), 'Esc returns to the workshop');
    }
    ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await p.close();
  }

  // ---------------------------------------------------------------- the buyout: what the player chose is reflected
  console.log('[the buyout]');
  {
    // A comeback after two flights with Iron Eclipse's offer open (a saved 1.0 run: the 0.9 fixture with the offer made and the run still going).
    const base = JSON.parse(fx.saves['two-flights-normal'].raw);
    base.finished = false; base.won = false; base.buyout = 'offered'; base.treasury_musd = 8; base.seed = 4242;
    const store = { 'smdg-progress-v1': PROGRESS, 'gravitron-walkthrough-v1': WALK, 'smdg-campaign': JSON.stringify(base) };
    // REFUSE
    {
      const { p, errors } = await page(b, DESK, store);
      ok(await p.evaluate(() => getComeback().buyout) === 'offered', 'the saved run has the offer open');
      await openFrom(p, 'journal-mode-part2');
      ok(!(await known(p)).includes('offer') && !(await known(p)).includes('refused') && (await known(p)).includes('house'),
        'before the offer is seen: the house is known, the offer and the answer are not: ' + JSON.stringify(await known(p)));
      ok(/Answer Iron Eclipse/i.test(await p.locator('[data-key="journal-next"]').innerText()), 'it says to answer Iron Eclipse first');
      await p.click('[data-key="journal-back"]');
      await p.click('[data-key="part2-go"]');
      await p.locator('.intro .btn.primary').waitFor();
      for (let i = 0; i < 12 && !(await p.locator('.story-offer').count()); i++) await p.click('.intro .btn.primary');
      await p.locator('.story-offer').waitFor();
      await p.click('[data-key="offer-refuse"]');
      await T.pastScenes(p);   // the "refused" scene, then the workshop
      ok(await T.waitHead(p, 'WORKSHOP'), 'REFUSE plays on: the workshop');
      ok(await p.evaluate(() => getComeback().buyout) === 'refused', 'the back end says refused');
      await openFrom(p, 'hub-journal');
      const k = await known(p);
      ok(k.includes('iron-eclipse') && k.includes('offer') && k.includes('refused') && !k.includes('sold'), 'REFUSE shows the offer and the answer, and SOLD stays locked: ' + JSON.stringify(k));
      ok((await locked(p)).includes('sold') && (await locked(p)).includes('last-page'), 'SOLD and Austin\'s last page are still ???');
      await p.screenshot({ path: path.join(shots, 'journal-part2-refused.png') });
      ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
      await p.close();
    }
    // SELL
    {
      const { p, errors } = await page(b, DESK, store);
      await p.click('[data-key="part2-go"]');
      await p.locator('.intro .btn.primary').waitFor();
      for (let i = 0; i < 12 && !(await p.locator('.story-offer').count()); i++) await p.click('.intro .btn.primary');
      await p.click('[data-key="offer-sell"]');
      await p.locator('[data-key="ending-title"]').waitFor();
      ok(await p.evaluate(() => getComeback().buyout) === 'accepted', 'the back end says accepted (SOLD OUT)');
      await p.click('[data-key="end-home"]');
      ok(await p.locator('[data-key="journal-mode-part2"]').count() === 1, 'home: JOURNAL on the Part 2 card');
      const before = await storage(p);
      await openFrom(p, 'journal-mode-part2');
      const k = await known(p);
      ok(k.includes('sold') && k.includes('offer') && !k.includes('refused'), 'SELL shows the answer SOLD, and REFUSED stays locked: ' + JSON.stringify(k));
      ok(/Sold out/i.test(await p.locator('[data-key="journal-next"]').innerText()) && await p.locator('.jr-ended').count() === 1, 'the run is over: what to do next says so, with the ending');
      ok(await p.locator('.jr-now .facts').innerText().then(t => !/MONTHS LEFT/.test(t)), 'a finished run shows no months left');
      await p.keyboard.press('Escape');
      ok(await p.locator('.big-title').isVisible(), 'Esc returns to the home page');
      ok(await storage(p) === before, 'nothing written to storage');
      ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
      await p.close();
    }
  }

  // Austin's last page: a run that refused the offer and has seen that scene (a seen record exists for its seed).
  console.log('[Austin\'s last page, a seen record]');
  {
    const base = JSON.parse(fx.saves['two-flights-normal'].raw);
    base.finished = false; base.won = false; base.buyout = 'refused'; base.treasury_musd = 8; base.seed = 4242;
    const seen = JSON.stringify({ 4242: ['start', 'after-1', 'offer', 'refused', 'after-3'] });
    const { p, errors } = await page(b, DESK, { 'smdg-progress-v1': PROGRESS, 'gravitron-walkthrough-v1': WALK, 'smdg-campaign': JSON.stringify(base), 'gravitron-seen-v1': seen });
    const before = await storage(p);
    await openFrom(p, 'journal-mode-part2');
    ok(same(await known(p), ['lenders', 'girl', 'disowned', 'house', 'iron-eclipse', 'offer', 'refused', 'last-page']), 'with the last page seen: it is known, SOLD stays locked: ' + JSON.stringify(await known(p)));
    ok((await locked(p)).join() === 'sold', 'only SOLD is still ???');
    await p.click('[data-key="journal-back"]');
    ok(await storage(p) === before, 'nothing written to storage');
    // a scene the record has not marked is not shown, whatever the run has done: the record wins when it exists
    const { p: q } = await page(b, DESK, { 'smdg-progress-v1': PROGRESS, 'gravitron-walkthrough-v1': WALK, 'smdg-campaign': JSON.stringify(base), 'gravitron-seen-v1': JSON.stringify({ 4242: ['start'] }) });
    await openFrom(q, 'journal-mode-part2');
    ok(!(await known(q)).includes('house') && !(await known(q)).includes('last-page'), 'a seen record that lacks a scene keeps it locked: ' + JSON.stringify(await known(q)));
    await q.close();
    ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await p.close();
  }

  // The faces wear the era they are drawn in: the lenders' face is the same whether the journal opened on Part 2 or was switched to it.
  console.log('[the faces and the era]');
  {
    const { p: a } = await page(b, DESK, { 'smdg-progress-v1': PROGRESS, 'gravitron-walkthrough-v1': WALK, 'smdg-campaign': fx.saves['one-flight-normal'].raw });
    await openFrom(a, 'journal-mode-part2');
    const direct = await a.locator('[data-key="journal-lenders"] .jr-face .portrait').getAttribute('data-face').catch(() => null);
    await a.close();
    const { p: c } = await page(b, DESK, { 'smdg-progress-v1': PROGRESS, 'gravitron-walkthrough-v1': WALK, 'smdg-campaign': fx.saves['one-flight-normal'].raw });
    await openFrom(c, 'journal-mode-part1');
    await tab(c, 2); await c.waitForTimeout(100);
    const switched = await c.locator('[data-key="journal-lenders"] .jr-face .portrait').getAttribute('data-face').catch(() => null);
    ok(!!direct && direct === switched, 'the face drawn after switching from Part 1 is the one drawn when opened on Part 2');
    await c.close();
  }

  // ---------------------------------------------------------------- the 0.9 saves
  console.log('[existing 0.9 saves]');
  for (const [label, viewport] of [['desktop', DESK], ['phone', PHONE]]) {
    for (const name of Object.keys(fx.saves)) {
      const raw = fx.saves[name].raw;
      const { p, errors } = await page(b, viewport, { 'smdg-progress-v1': PROGRESS, 'gravitron-walkthrough-v1': WALK, 'smdg-campaign': raw });
      const c = await p.evaluate(() => { const c = getComeback(); return { flights: c.flights, buyout: c.buyout, finished: c.finished, won: c.won }; });
      const before = await storage(p);
      ok(await p.locator('[data-key="journal-mode-part1"]').count() === 1 && await p.locator('[data-key="journal-mode-part2"]').count() === 1, `[${label}] ${name}: JOURNAL on both cards without opening the workshop`);
      await openFrom(p, 'journal-mode-part1');
      ok(same(await known(p), ['setup', 'rule-1', 'rule-2', 'rule-3']), `[${label}] ${name}: Part 1 (steps one and two passed) shows the setup and the three rules`);
      await tab(p, 2);
      const k = await known(p), want = ['lenders', 'girl', 'disowned'].concat(c.flights >= 1 ? ['house'] : []);
      ok(same(k, want), `[${label}] ${name}: Part 2 shows ${want.join(', ')} from the run itself (${c.flights} flights): ${JSON.stringify(k)}`);
      ok(!(await p.locator('.jr-entry.known', { hasText: '???' }).count()), 'no known entry reads ???');
      if (name === 'deadline-hard') ok(/cheap and sure/i.test(await p.locator('[data-key="journal-next"]').innerText()), 'no months left: what to do next says time is short, not "pick a contract"');
      if (c.finished) ok(await p.locator('.jr-ended').count() === 1 && !/MONTHS LEFT/.test(await p.locator('.jr-now .facts').innerText()), 'a finished run: its ending, no months left');
      else ok(/MONTHS LEFT/.test(await p.locator('.jr-now .facts').innerText()), 'a run in progress: debt and months left');
      ok(await T.noScroll(p), `[${label}] no sideways scroll`);
      if (name === 'one-flight-normal') await p.screenshot({ path: path.join(shots, `journal-fixture-${label}.png`) });
      await p.click('[data-key="journal-back"]');
      ok(await storage(p) === before, 'opening the journal wrote nothing (no scene was marked seen, none replays)');
      ok(await p.evaluate(() => localStorage.getItem('gravitron-seen-v1')) === null, 'there is still no seen record: the workshop\'s own backfill is left to run');
      ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
      await p.close();
    }
  }

  // ---------------------------------------------------------------- keyboard, focus, reduced motion
  console.log('[keyboard and reduced motion]');
  {
    const { p, errors } = await page(b, DESK, { 'gravitron-walkthrough-v1': WALK }, { reduce: true });
    await p.keyboard.press('Tab');
    await p.focus('[data-key="journal-mode-part1"]');
    await p.keyboard.press('Enter');
    await p.locator('[data-key="journal"]').waitFor();
    ok(await p.evaluate(() => document.activeElement.getAttribute('data-key')) === 'journal-tab-1', 'opened by keyboard: the part toggle has the focus');
    let reachedBack = false, ring = false;
    for (let i = 0; i < 8 && !reachedBack; i++) {
      await p.keyboard.press('Tab');
      reachedBack = await p.evaluate(() => document.activeElement.getAttribute('data-key') === 'journal-back');
    }
    ok(reachedBack, 'Tab reaches BACK');
    ring = await p.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; });
    ok(ring, 'the focus ring is visible on BACK');
    await p.keyboard.press('Enter');
    ok(await p.locator('.big-title').isVisible(), 'Enter on BACK returns to the home page');
    ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await p.close();
  }

  // ---------------------------------------------------------------- the art and the story file blocked
  console.log('[js/lowpoly.js blocked]');
  {
    const { p, errors } = await page(b, DESK, { 'gravitron-walkthrough-v1': WALK }, { block: [/js\/lowpoly\.js/], allow: /lowpoly\.js|ERR_FAILED/ });
    await openFrom(p, 'journal-mode-part1');
    ok(same(await known(p), ['setup', 'rule-1', 'rule-2', 'rule-3']), 'the same entries are known');
    ok(await p.locator('.jr-entry.known .jr-face svg, .jr-entry.known .jr-face img').count() === 4, 'the pixel faces are drawn instead');
    ok(await T.noScroll(p), 'no sideways scroll');
    ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await p.close();
  }
  console.log('[js/ui-story.js blocked]');
  {
    const { p, errors } = await page(b, DESK, { 'gravitron-walkthrough-v1': WALK }, { block: [/js\/ui-story\.js/], allow: /ui-story\.js|ERR_FAILED/ });
    ok(await p.locator('.big-title').isVisible(), 'the home page still loads');
    ok(await p.locator('[data-key^="journal-"]').count() === 0, 'no JOURNAL button on the home cards');
    await p.click('[data-key="part1-go"]'); await T.throughBeats(p); await T.waitHead(p, 'BASE MAP');
    ok(await p.locator('[data-key="map-journal"]').count() === 0, 'no JOURNAL button on the map');
    ok(await p.locator('[data-key="blip-build"]').count() === 1, 'the map works without it');
    ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await p.close();
  }

  await b.close();
  done();
})();
