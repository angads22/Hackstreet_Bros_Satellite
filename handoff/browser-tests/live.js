// The LIVE DATA / SNAPSHOT badge and the debrief "right now" line, offline and with live data faked in.
const { chromium } = require('playwright'); const path = require('path');
const REPO = process.env.REPO || '/home/user/Hackstreet_Bros_Satellite'; const shots = process.argv[2];
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const ALL = { best_stars: {}, best_score: {}, best_stars_by_era: { igy: 3, nimbus: 3, eos: 3 } };
(async () => {
  for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    console.log(`[live ${label}]`);
    const b = await chromium.launch(); const p = await b.newPage({ viewport });
    const errors = []; p.on('pageerror', e => errors.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.|Failed to load resource|ERR_/.test(m.text() + ((m.location() || {}).url || ''))) errors.push(m.text()); });
    await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const wait = t => p.locator('.screen-head h1', { hasText: t }).waitFor({ timeout: 8000 }).then(() => true, () => false);
    await p.goto('file://' + REPO + '/index.html');
    await p.evaluate(a => localStorage.setItem('smdg-progress-v1', JSON.stringify(a)), ALL); await p.reload();
    ok(await p.locator('#data-badge:not([hidden])').count() === 1, 'the badge shows');
    // Offline (the sandbox cannot reach the services) it settles on SNAPSHOT within the 8 second limit.
    await p.waitForFunction(() => document.getElementById('data-badge').textContent !== 'CHECKING DATA', null, { timeout: 15000 }).catch(() => {});
    const settled = await p.locator('#data-badge').innerText(); console.log('     badge after fetch attempt: ' + settled);
    ok(['SNAPSHOT', 'LIVE DATA', 'PARTLY LIVE'].includes(settled), 'badge settles on a real state');
    // Fake a finished live fetch: the badge must follow the livedata event.
    await p.evaluate(() => {
      EARTH.live.status = 'live'; EARTH.live.fetched_at = '2026-11-14T22:30:00.000Z';
      EARTH.live.sources = EARTH.live.sources.map(s => ({ ...s, ok: true }));
      EARTH.live.sea_ice_now = { events: [], text: 'NASA EONET is tracking 3 open sea and lake ice events right now; the latest is Test Ice Event (2026-11-14).' };
      window.dispatchEvent(new Event('livedata'));
    });
    ok(await p.locator('#data-badge').innerText() === 'LIVE DATA', 'badge reads LIVE DATA after the event');
    ok((await p.locator('#data-badge').getAttribute('title')).includes('Fetched 2026-11-14 22:30 UTC'), 'tooltip says when it was fetched');
    await p.evaluate(() => { EARTH.live.status = 'partial'; EARTH.live.sources[0].ok = false; window.dispatchEvent(new Event('livedata')); });
    ok(await p.locator('#data-badge').innerText() === 'PARTLY LIVE', 'badge reads PARTLY LIVE');
    await p.evaluate(() => { EARTH.live.status = 'live'; EARTH.live.sources[0].ok = true; window.dispatchEvent(new Event('livedata')); });
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll with the badge');
    await p.screenshot({ path: path.join(shots, `live-${label}-0-title.png`) });
    // A sea-ice mission: the debrief shows the live "right now" line.
    await p.click('[data-key="start-new-space-training"]'); await p.locator('.intro').waitFor({timeout:3000}).then(()=>p.click('text=SKIP'),()=>{}); /*SKIPINTRO*/ await wait('BASE MAP');
    await p.click('[data-key="blip-briefing"]'); await wait('BRIEFING'); await p.click('[data-key="obj-sea-ice"]'); await p.click('.nav-row .btn.primary'); await wait('ORBIT');
    await p.click('[data-key="orbit-sso"]'); await p.click('.nav-row .btn.primary'); await wait('BUILD');
    const add = async (bin, part) => { await p.click(`[data-key="bin-${bin}"]`); await p.click(`[data-key="part-${part}"]`); };
    for (const [bin, part] of [['instrument','sar-radar'],['power','solar-large'],['comms','radio-xband'],['computer','obc-basic'],['power','battery-28v'],['propulsion','prop-green-large'],['structure','smallsat-bus'],['attitude','reaction-wheels']]) await add(bin, part);
    await p.click('.nav-row .btn.primary'); await wait('LAUNCH VEHICLE'); await p.click('[data-key="rocket-small"]'); await p.click('.nav-row .btn.primary'); await wait('READINESS');
    await p.locator('.btn.big').click(); await wait('MISSION'); await p.click('button[aria-label="Fast forward"]');
    for (let i = 0; i < 400; i++) { if (await p.locator('.screen-head h1', { hasText: 'DEBRIEF' }).count()) break;
      if (await p.locator('[role="alertdialog"]').count()) await p.locator('.choices .btn').first().click(); await p.waitForTimeout(50); }
    ok(await p.locator('.screen-head h1', { hasText: 'DEBRIEF' }).count() === 1, 'debrief shows');
    const rn = await p.locator('.right-now').innerText().catch(() => '');
    console.log('     ' + rn.slice(0, 150));
    ok(/^RIGHT NOW: NASA EONET is tracking 3 open sea and lake ice events/.test(rn), 'debrief shows the right-now line from live data');
    await p.screenshot({ path: path.join(shots, `live-${label}-7-debrief.png`), fullPage: true });
    // Without live data the line is simply absent
    await p.evaluate(() => { EARTH.live.sea_ice_now = null; EARTH.live.status = 'snapshot'; window.dispatchEvent(new Event('livedata')); });
    ok(await p.locator('#data-badge').innerText() === 'SNAPSHOT', 'badge back to SNAPSHOT');
    ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await b.close();
  }
  console.log(fails ? 'FAILED ' + fails : 'PASSED'); process.exit(fails ? 1 : 0);
})();
