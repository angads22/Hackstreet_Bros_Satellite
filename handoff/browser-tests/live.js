// The LIVE DATA / SNAPSHOT badge on the home page, offline and with live data faked in.
// PART 2 NEEDED for the rest: the debrief's "RIGHT NOW" line comes with sea-ice and wildfire missions, and those
// topics do not exist in 1958 (Part 1). The next agent: fly a sea-ice contract in Part 2 with the live data faked
// in as below, and check that the debrief shows "RIGHT NOW: NASA EONET is tracking 3 open sea and lake ice events".
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
  if (count()) { console.log('FAILED ' + count()); process.exit(1); }
  console.log('PASSED (badge)');
  T.skipped('the debrief "RIGHT NOW" line needs a sea-ice or wildfire mission: Part 2');
})();
