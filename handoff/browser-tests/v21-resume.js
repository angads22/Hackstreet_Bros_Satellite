// Reload keeps your place (SPEC.md, "Reload keeps your place"): the screen and the design in hand come back after F5, in the
// same browser tab (sessionStorage gravitron-session-v1). A new tab, HOME and RESET EVERYTHING open on the title screen.
//   Part 1 step 1: the map, Build with parts placed, the Rocket Yard, Readiness, a flight reloaded mid-mission, a debrief.
//   Part 2: the workshop, Build with a design, Readiness, a flight reloaded mid-mission (cash paid once), a debrief (recorded once).
//   Also: a new page and a new context, HOME, a damaged or stale record, the Quick menu hook, no console errors; 1366x768 and 390.
// Usage: node v21-resume.js [shots dir]   or   node v21-resume.js <repo dir> <shots dir>   (the mid-mission checks run at 1366 only)
const { chromium } = require('playwright');
const T = require('./lib');
const { url } = T.args();
const { ok, done } = T.checker();
const { waitHead } = T;
const KEY = 'gravitron-session-v1';

const place = p => p.evaluate(k => { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return 'bad'; } }, KEY);
// What is on the satellite: the bench's own count and every bin's line ("2 on board", "Needed"), and the open bin.
const picked = async p => (await p.locator('.bench-label').innerText()) + ' | ' + (await p.locator('.bins').innerText()) + ' | ' + (await p.locator('.bin[aria-pressed="true"]').getAttribute('data-key'));
const nParts = async p => parseInt((/(\d+) parts/.exec(await p.locator('.bench-label').innerText()) || [])[1], 10);
const shelf = p => p.$$eval('.part', es => es.map(e => e.dataset.key));
const status = p => p.locator('#status').innerText();
const comeback = p => p.evaluate(() => { const c = getComeback(); return { cash: c.cash_musd, flights: c.flights, missions: c.missions.length, month: c.month, debt: c.debt_musd }; });
const walkRec = p => p.evaluate(() => localStorage.getItem('gravitron-walkthrough-v1'));
const onTitle = p => p.locator('.big-title').isVisible().catch(() => false);
// LAUNCH plays the lift-off; any key skips it.
async function launch(p) {
  await p.locator('.btn.big').click();
  await p.waitForTimeout(400);
  await p.keyboard.press('Space');
  return waitHead(p, 'MISSION');
}
async function fresh(b, viewport) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  p.on('dialog', d => d.accept());
  await p.addInitScript(k => { if (window.name.indexOf('plant:') === 0) { sessionStorage.setItem(k, window.name.slice(6)); window.name = ''; } }, KEY);
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
  return { ctx, p, errors };
}

(async () => {
  const b = await chromium.launch();
  for (const [label, viewport, full] of [['1366x768', { width: 1366, height: 768 }, true], ['390', { width: 390, height: 844 }, false]]) {
    // ================================================================ Part 1
    console.log(`[${label}: Part 1, step 1]`);
    let { ctx, p, errors } = await fresh(b, viewport);
    ok(await onTitle(p) && (await place(p)) === null, 'a fresh tab: the title, and no place kept');
    await p.click('[data-key="part1-go"]'); await T.throughBeats(p);
    ok(await waitHead(p, 'BASE MAP'), 'step 1: the base map');
    ok((await place(p) || {}).mode === 'part1' && (await place(p)).screen === 'map', 'the map is remembered as part1');
    const mapStatus = await status(p);
    await p.reload();
    ok(await waitHead(p, 'BASE MAP') && !(await onTitle(p)), 'reload on the map: the map, not the title');
    ok(await status(p) === mapStatus && /STEP 1/.test(mapStatus), 'the same step (' + mapStatus + ')');
    ok(await p.locator('[data-key="blip-briefing"].done').count() === 1 && await p.locator('[data-key="blip-build"].next').count() === 1, 'the map keeps the step\'s presets: the Workshop is next');
    ok(await T.noScroll(p), 'no sideways scroll on the map');

    await p.click('[data-key="blip-build"]'); await waitHead(p, 'BUILD');
    await T.addParts(p, T.WALK[1].parts);
    const parts1 = await picked(p), shelf1 = await shelf(p);
    ok(await nParts(p) === T.WALK[1].parts.length, `Build: ${await nParts(p)} parts placed`);
    await p.reload();
    ok(await waitHead(p, 'BUILD'), 'reload on Build: Build');
    ok(await picked(p) === parts1, 'the same parts are on the satellite');
    ok(JSON.stringify(await shelf(p)) === JSON.stringify(shelf1), 'the same parts bin is open');
    ok(await T.noScroll(p), 'no sideways scroll on Build');

    // A second page of the same context is a new tab: it has no place kept
    const tab = await ctx.newPage();
    await T.noFonts(tab);
    await tab.goto(url);
    ok(await onTitle(tab) && (await place(tab)) === null, 'a new tab (same browser, save kept): the title');
    await tab.close();

    // Step 1 presets the rocket: the Rocket Yard is visited from the map (the Build button goes on to the Launch Pad)
    await p.keyboard.press('m'); ok(await waitHead(p, 'BASE MAP'), 'M: the map');
    await p.click('[data-key="blip-launcher"]'); ok(await waitHead(p, 'LAUNCH VEHICLE'), 'the Rocket Yard');
    await p.reload();
    ok(await waitHead(p, 'LAUNCH VEHICLE') && !(await onTitle(p)), 'reload in the Rocket Yard: the Rocket Yard');
    ok(await p.locator('[data-key="rocket-juno-1"].chosen').count() === 1, 'the step\'s own rocket is still chosen');
    await p.keyboard.press('m'); await waitHead(p, 'BASE MAP');
    ok(await p.locator('.blip.locked').count() === 0, 'the map keeps every place open that was open');
    await p.click('[data-key="blip-review"]'); ok(await waitHead(p, 'READINESS'), 'the Launch Pad: Readiness');
    const ready1 = await p.locator('#app').innerText();
    await p.reload();
    ok(await waitHead(p, 'READINESS'), 'reload at Readiness: Readiness');
    ok(await p.locator('#app').innerText() === ready1, 'Readiness reads the same (the same design)');
    ok(await p.locator('.btn.big').count() === 1 && !(await p.locator('.btn.big').isDisabled()), 'and LAUNCH is open');

    if (full) {
      ok(await launch(p), 'LAUNCH: the Mission screen');
      ok((await place(p) || {}).screen === 'mission', 'the flight in the air is remembered');
      await p.reload();
      ok(await waitHead(p, 'READINESS') && !(await onTitle(p)), 'reload mid-mission: back at Readiness (the flight was not recorded)');
      ok(await p.locator('#app').innerText() === ready1, 'the same design is on Readiness');
      const before = await walkRec(p);
      ok(await launch(p), 'launch again'); await T.fly(p, 'first');
      ok(await waitHead(p, 'DEBRIEF'), 'the flight ends at its debrief');
      const recorded = await walkRec(p);
      ok(recorded !== before && JSON.parse(recorded).done['1'] >= 1, 'step 1 passed and was recorded');
      await p.reload();
      ok(await waitHead(p, 'BASE MAP') && !(await onTitle(p)), 'reload on the debrief: the map');
      ok(await walkRec(p) === recorded, 'the step was not recorded twice (the record is as it was)');
    }

    // HOME forgets the place
    if (await p.locator('[data-key="map-home"]').count() === 0) { await p.keyboard.press('m'); await waitHead(p, 'BASE MAP'); }
    await p.click('[data-key="map-home"]');
    ok(await onTitle(p) && (await place(p)) === null, 'HOME: the title, and the place is forgotten');
    await p.reload();
    ok(await onTitle(p), 'reload on the title: the title');

    // A new context (a new browser session) opens the title whatever was open before
    await p.click('[data-key="part1-go"]');
    await T.throughBeats(p);
    await waitHead(p, 'BASE MAP');
    const ctx2 = await b.newContext({ viewport, deviceScaleFactor: 1 });
    const q = await ctx2.newPage(); await T.noFonts(q); await q.goto(url);
    ok(await onTitle(q), 'a new context: the title');
    await ctx2.close();
    ok(errors.length === 0, 'Part 1: no console errors' + (errors.length ? ' ' + errors.join(' | ') : ''));
    await ctx.close();

    // ================================================================ Part 2
    console.log(`[${label}: Part 2]`);
    ({ ctx, p, errors } = await fresh(b, viewport));
    await T.startComeback(p, 'standard');
    ok((await place(p) || {}).mode === 'part2' && (await place(p)).screen === 'comeback', 'the workshop is remembered as part2');
    const c0 = await comeback(p);
    await p.reload();
    ok(await waitHead(p, 'WORKSHOP') && !(await onTitle(p)), 'reload in the workshop: the workshop');
    ok(JSON.stringify(await comeback(p)) === JSON.stringify(c0), 'and the money and months are as they were');
    ok(await p.locator('.intro').count() === 0, 'no story scene replays');
    ok(await T.noScroll(p), 'no sideways scroll in the workshop');

    // the contract's design: Build, then Readiness
    const k = T.CONTRACT.solar;
    await p.click('[data-key="fly-solar"]'); ok(await waitHead(p, 'BASE MAP'), 'FLY THIS: the base map');
    await p.reload();
    ok(await waitHead(p, 'BASE MAP') && !(await onTitle(p)), 'reload on the contract\'s map: the map');
    await p.click('[data-key="blip-orbit"]'); await waitHead(p, 'ORBIT');
    if (await p.locator(`button[data-key="orbit-${k.orbit}"]:not([disabled])`).count()) await p.click(`[data-key="orbit-${k.orbit}"]`);
    await p.click('.nav-row .btn.primary'); await waitHead(p, 'BUILD');
    await T.addParts(p, k.parts);
    const parts2 = await picked(p), shelf2 = await shelf(p);
    ok(await nParts(p) === k.parts.length, `Build: ${await nParts(p)} parts placed`);
    await p.reload();
    ok(await waitHead(p, 'BUILD'), 'reload on Build: Build');
    ok(await picked(p) === parts2, 'the same parts are on the satellite');
    ok(JSON.stringify(await shelf(p)) === JSON.stringify(shelf2), 'the same parts bin is open');
    ok(/PART 2/.test(await status(p)), 'the Part 2 header is back (' + (await status(p)) + ')');
    await p.click('.nav-row .btn.primary'); await waitHead(p, 'LAUNCH VEHICLE');
    await p.reload();
    ok(await waitHead(p, 'LAUNCH VEHICLE'), 'reload in the Rocket Yard: the Rocket Yard');
    await p.click(`[data-key="rocket-${k.launcher}"]`);
    await p.click('.nav-row .btn.primary'); ok(await waitHead(p, 'READINESS'), 'NEXT: Readiness');
    const ready2 = await p.locator('#app').innerText();
    await p.reload();
    ok(await waitHead(p, 'READINESS'), 'reload at Readiness: Readiness');
    ok(await p.locator('#app').innerText() === ready2, 'Readiness reads the same (the same design, rocket and cash)');
    ok(JSON.stringify(await comeback(p)) === JSON.stringify(c0), 'nothing was paid by looking');

    if (full) {
      ok(await launch(p), 'LAUNCH: the Mission screen');
      const paid = await comeback(p);
      ok(paid.cash < c0.cash && paid.flights === 1, `the launch is paid once (cash ${c0.cash} to ${paid.cash})`);
      await p.reload();
      ok(await waitHead(p, 'READINESS') && !(await onTitle(p)), 'reload mid-mission: back at Readiness');
      const back = await comeback(p);
      ok(back.cash === c0.cash && back.flights === 0 && back.missions === 0, `the lost flight's cost came back once (cash ${back.cash}, flights ${back.flights})`);
      ok(await p.locator('#app').innerText() === ready2, 'the same design is on Readiness');
      ok(await launch(p), 'launch again');
      const again = await comeback(p);
      ok(again.cash === paid.cash && again.flights === 1, `the second launch pays the same once (cash ${again.cash})`);
      await T.fly(p, 'first');
      ok(await waitHead(p, 'DEBRIEF'), 'the flight ends at its debrief');
      const settled = await comeback(p);
      ok(settled.missions === 1 && settled.flights === 1, 'one flight is recorded');
      await p.reload();
      await T.pastScenes(p);   // the scene that is due between a debrief and the workshop (shown once, by js/ui-story.js)
      ok(await waitHead(p, 'WORKSHOP') && !(await onTitle(p)), 'reload on the debrief: the workshop (after any story scene that is due)');
      const after = await comeback(p);
      ok(JSON.stringify(after) === JSON.stringify(settled), `no second payment or record (cash ${after.cash}, flights ${after.flights}, recorded ${after.missions})`);
      ok(await p.locator('.cb-log li').count() === 1, 'the flight log shows the one flight, once');
    }

    // HOME forgets the place; the save stays (Part 2 reads CONTINUE)
    if (await p.locator('[data-key="hub-home"]').count() === 0) {
      await p.evaluate(() => window.showComebackHub()); await waitHead(p, 'WORKSHOP');
    }
    await p.click('[data-key="hub-home"]');
    ok(await onTitle(p) && (await place(p)) === null, 'HOME: the title, and the place is forgotten');
    await p.reload();
    ok(await onTitle(p), 'reload on the title: the title');
    ok(/^CONTINUE/.test(await p.locator('[data-key="part2-go"]').innerText()), 'the comeback itself is saved: Part 2 reads CONTINUE');
    const tab2 = await ctx.newPage(); await T.noFonts(tab2); await tab2.goto(url);
    await tab2.evaluate(() => { try { sessionStorage.clear(); } catch (e) {} });
    ok(await onTitle(tab2), 'a new tab: the title');
    await tab2.close();

    // RESET EVERYTHING forgets the place too
    await p.click('[data-key="part2-go"]'); await waitHead(p, 'WORKSHOP');
    ok((await place(p) || {}).screen === 'comeback', 'back in the workshop: remembered');
    await p.evaluate(() => window.StarlineUI.home());
    await p.click('[data-key="reset-progress"]'); await p.click('[data-key="reset-progress"]');   // the first press asks, the second confirms (twoStep: window.confirm is blocked in a sandboxed frame)
    ok(await onTitle(p) && (await place(p)) === null, 'RESET EVERYTHING: the title and no place kept');
    ok(errors.length === 0, 'Part 2: no console errors' + (errors.length ? ' ' + errors.join(' | ') : ''));
    await ctx.close();

    // ================================================================ a record that cannot be put back
    console.log(`[${label}: damaged and stale records]`);
    ({ ctx, p, errors } = await fresh(b, viewport));
    const junk = [
      ['not json', 'not json'],
      ['an unknown screen', JSON.stringify({ mode: 'part1', screen: 'nowhere', step: 1, design: { parts: [] } })],
      ['an unknown part', JSON.stringify({ mode: 'part1', screen: 'build', step: 1, design: { tier: 'training', parts: ['no-such-part'] } })],
      ['a step that does not exist', JSON.stringify({ mode: 'part1', screen: 'map', step: 9, design: { parts: [] } })],
      ['no design', JSON.stringify({ mode: 'part1', screen: 'build', step: 1 })],
      ['a mode that is not put back', JSON.stringify({ mode: 'other', screen: 'online-leaderboard' })],
      ['a Part 2 design with no run saved', JSON.stringify({ mode: 'part2', screen: 'build', design: { contract: 't-rad', parts: [] } })],
      ['the workshop with no run saved', JSON.stringify({ mode: 'part2', screen: 'comeback' })],
      ['a debrief with no run saved', JSON.stringify({ mode: 'part2', screen: 'debrief', design: { contract: 't-rad', parts: [] } })]
    ];
    for (const [what, raw] of junk) {
      // The page forgets its place when it is hidden on the title, so the record is planted by the next load (window.name survives it).
      await p.evaluate(v => { window.name = 'plant:' + v; }, raw);
      await p.reload();
      ok(await onTitle(p), `${what}: the title, silently`);
    }
    // the picker itself comes back (no run is saved yet, and the player was choosing a difficulty)
    await p.evaluate(() => { window.name = 'plant:' + JSON.stringify({ mode: 'part2', screen: 'comeback-start' }); });
    await p.reload();
    ok(await p.locator('.cb-level').count() === 3, 'the difficulty picker comes back');
    await p.evaluate(() => window.StarlineUI.home());
    // storage that cannot be used: the game still opens on the title
    await p.addInitScript(() => { try { Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('blocked'); } }); } catch (e) { /* ignore */ } });
    await p.reload();
    ok(await onTitle(p), 'sessionStorage blocked: the title');
    ok(errors.length === 0, 'records: no console errors' + (errors.length ? ' ' + errors.join(' | ') : ''));
    await ctx.close();

    // ================================================================ the Quick menu hook (Quick mode is built apart; this is its stub)
    console.log(`[${label}: the Quick menu]`);
    ({ ctx, p, errors } = await fresh(b, viewport));
    await p.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        window.StarlineOnline = window.StarlineOnline || {};
        window.StarlineOnline.showQuickMenu = () => {
          const s = document.createElement('section'); s.className = 'screen';
          s.innerHTML = '<div class="screen-head"><h1>PICK ONE</h1></div>';
          window.StarlineUI.mount('online-quick-menu', s);
        };
      });
    });
    await p.reload();
    await p.evaluate(() => window.StarlineOnline.showQuickMenu());
    ok((await place(p) || {}).mode === 'quick', 'the Quick menu is remembered as quick');
    await p.reload();
    ok(await waitHead(p, 'PICK ONE'), 'reload on the Quick menu: the Quick menu');
    await p.evaluate(() => window.StarlineUI.home());
    await p.reload();
    ok(await onTitle(p), 'HOME, then reload: the title');
    ok(errors.length === 0, 'Quick: no console errors' + (errors.length ? ' ' + errors.join(' | ') : ''));
    await ctx.close();
  }
  await b.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
