// The LIVE DATA / SNAPSHOT badge on the home page, offline and with live data faked in, and the debrief's "RIGHT NOW"
// line: a wildfire contract flown in Part 2 (Normal opens with one) with today's NASA EONET wildfire count faked in.
// Usage: node live.js [shots dir]   or   node live.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, count } = T.checker();

(async () => {
  for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    console.log(`[live ${label}]`);
    const b = await chromium.launch(); const p = await b.newPage({ viewport });
    const errors = T.watchErrors(p, /Failed to load resource|ERR_/);
    await T.noFonts(p);
    await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
    ok(await p.locator('#data-badge:not([hidden])').count() === 1, 'the badge shows on the home page');
    // Offline (the sandbox cannot reach the services) it settles on SNAPSHOT within the 8 second limit.
    await p.waitForFunction(() => document.getElementById('data-badge').textContent !== 'CHECKING DATA', null, { timeout: 15000 }).catch(() => {});
    const settled = await p.locator('#data-badge').innerText(); console.log('     badge after fetch attempt: ' + settled);
    ok(['SNAPSHOT', 'LIVE DATA', 'PARTLY LIVE'].includes(settled), 'badge settles on a real state');
    await p.evaluate(() => {
      EARTH.live.status = 'live'; EARTH.live.fetched_at = '2026-11-14T22:30:00.000Z';
      EARTH.live.sources = EARTH.live.sources.map(s => ({ ...s, ok: true }));
      window.dispatchEvent(new Event('livedata'));
    });
    ok(await p.locator('#data-badge').innerText() === 'LIVE DATA', 'badge reads LIVE DATA after the event');
    ok((await p.locator('#data-badge').getAttribute('title')).includes('Fetched 2026-11-14 22:30 UTC'), 'tooltip says when it was fetched');
    await p.evaluate(() => { EARTH.live.status = 'partial'; EARTH.live.sources[0].ok = false; window.dispatchEvent(new Event('livedata')); });
    ok(await p.locator('#data-badge').innerText() === 'PARTLY LIVE', 'badge reads PARTLY LIVE');
    ok(await T.noScroll(p), 'no sideways scroll with the badge');
    await p.screenshot({ path: path.join(shots, `live-${label}-0-home.png`) });
    // The badge follows the player into Part 1
    await p.click('[data-key="part1-go"]'); await T.throughBeats(p); await T.waitHead(p, 'BASE MAP');
    ok(await p.locator('#data-badge').innerText() === 'PARTLY LIVE', 'the badge stays in the header on the map');
    await p.evaluate(() => { EARTH.live.status = 'snapshot'; window.dispatchEvent(new Event('livedata')); });
    ok(await p.locator('#data-badge').innerText() === 'SNAPSHOT', 'badge back to SNAPSHOT');
    ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await b.close();
  }
  // ---- Part 2: a wildfire contract, with live data faked in: the debrief shows the RIGHT NOW line; without it, none
  for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    console.log(`[right now, ${label}]`);
    const b = await chromium.launch(); const p = await b.newPage({ viewport });
    const errors = T.watchErrors(p, /Failed to load resource|ERR_/);
    await T.noFonts(p);
    await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
    await T.startComeback(p, 'standard');
    ok(await p.locator('[data-key="job-wildfire"]').count() === 1, 'Normal opens with a wildfire contract');
    await p.evaluate(() => {
      EARTH.live.status = 'live'; EARTH.live.fetched_at = '2026-11-14T22:30:00.000Z';
      EARTH.live.sources = EARTH.live.sources.map(s => ({ ...s, ok: true }));
      EARTH.live.wildfire_now = { events: [], text: 'NASA EONET is tracking 5 open wildfire events right now; the latest is Test Fire (2026-11-14).' };
      window.dispatchEvent(new Event('livedata'));
    });
    await T.launchContract(p, 'wildfire');
    await p.waitForFunction(() => /fire detections/.test((document.querySelector('.nasa-line') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
    const real = await p.locator('.nasa-line').first().innerText().catch(() => '');
    console.log('     mission: ' + real);
    ok(/fire detections worldwide \(NASA FIRMS/.test(real), 'mission: the real NASA FIRMS line each month');
    await T.fly(p, 'first'); await T.waitHead(p, 'DEBRIEF');
    const rn = await p.locator('.right-now').innerText().catch(() => '');
    console.log('     ' + rn.slice(0, 150));
    ok(/^RIGHT NOW: NASA EONET is tracking 5 open wildfire events/.test(rn), 'debrief: the right-now line from live data');
    ok(/NASA's MODIS/.test(await p.locator('.nasa-box').filter({ hasText: 'AGAINST THE REAL EARTH' }).innerText()), 'debrief: against the real Earth (NASA FIRMS)');
    ok(await T.noScroll(p), 'debrief: no sideways scroll');
    await p.waitForTimeout(700);   // the PAID IN PART stamp has landed
    await p.screenshot({ path: path.join(shots, `live-${label}-7-debrief.png`), fullPage: true });
    ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await b.close();
  }
  if (count()) { console.log('FAILED ' + count()); process.exit(1); }
  console.log('PASSED');
})();
