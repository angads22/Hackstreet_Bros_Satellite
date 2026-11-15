// The 1958 era (igy), reached through Part 1, step 3 (nothing preset): only what existed in 1958 is offered,
// and a design of 1958 parts flies. The era grid and the "NEW ERA" banner are gone from the page: eras are no
// longer chosen there (Part 1 is 1958, Part 2 is today).
// Usage: node igy.js [shots dir]   or   node igy.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();
const { waitHead } = T;

(async () => {
  for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    console.log(`[igy ${label}]`);
    const b = await chromium.launch(); const p = await b.newPage({ viewport });
    const errors = T.watchErrors(p);
    await T.noFonts(p);
    await p.goto(url); await p.evaluate(() => localStorage.clear());
    await p.evaluate(() => localStorage.setItem('gravitron-walkthrough-v1', JSON.stringify({ done: { 1: 1, 2: 1 } })));
    await p.reload();
    ok(/CONTINUE: STEP 3/.test(await p.locator('[data-key="part1-go"]').innerText()), 'home: CONTINUE: STEP 3');
    await p.click('[data-key="part1-go"]'); await T.throughBeats(p);
    ok(await waitHead(p, 'BASE MAP'), 'starts on the map');
    ok((await p.locator('#status').innerText()).includes('1958'), 'header shows the year 1958');
    await p.click('[data-key="blip-briefing"]'); await waitHead(p, 'BRIEFING');
    ok(await p.locator('button.card:not([disabled])').count() === 1, 'one topic offered in 1958');
    ok((await p.locator('[data-key="obj-wildfire"]').innerText()).toUpperCase().includes('ARRIVES IN 1999'), 'wildfire greyed out: arrives in 1999');
    await p.screenshot({ path: path.join(shots, `igy-${label}-1-briefing.png`), fullPage: true });
    await p.click('[data-key="obj-radiation"]'); await p.click('.nav-row .btn.primary'); await waitHead(p, 'ORBIT');
    await p.click('[data-key="orbit-leo"]'); await p.click('.nav-row .btn.primary'); await waitHead(p, 'BUILD');
    await p.click('[data-key="bin-instrument"]');
    ok(await p.locator('[data-key="part-sar-radar"]').isDisabled(), 'radar greyed out in 1958');
    ok((await p.locator('[data-key="part-sar-radar"]').innerText()).includes('Arrives in'), 'radar card says when it arrives');
    await p.click('[data-key="bin-propulsion"]');
    ok(await p.locator('[data-key^="part-"]:not([disabled])').count() === 0, 'no thruster exists in 1958');
    await T.addParts(p, ['explorer-body', 'spin-stabilised', 'cosmic-ray-counter', 'mercury-battery', 'silicon-cells', 'minitrack-beacon', 'command-timer']);
    console.log('     bins: ' + (await p.locator('.bins').innerText()).replace(/\n/g, ' | '));
    console.log('     body: ' + (await p.locator('.body-card').innerText()).replace(/\n/g, ' | '));
    await p.mouse.move(0, 0);
    await p.screenshot({ path: path.join(shots, `igy-${label}-3-build.png`), fullPage: true });
    await p.click('.nav-row .btn.primary'); await waitHead(p, 'LAUNCH VEHICLE');
    ok(await p.locator('button.card:not([disabled])').count() === 2, 'two rockets offered in 1958');
    await p.click('[data-key="rocket-vanguard-rocket"]'); await p.click('.nav-row .btn.primary'); ok(await waitHead(p, 'READINESS'), 'reaches the readiness review');
    ok(!(await p.locator('.btn.big').isDisabled()), 'launch enabled');
    await p.locator('.btn.big').click(); await waitHead(p, 'MISSION'); await T.fly(p, 'first');
    ok(await T.head(p, 'DEBRIEF').count() === 1, 'debrief shows');
    const banners = (await p.locator('.banner').allInnerTexts()).join(' | ');
    console.log('     banners: ' + banners + ' | ' + await p.locator('.stamp').getAttribute('aria-label'));
    ok(!/NEW ERA|UNLOCKED/.test(banners), 'no era or tier banner (eras are not chosen on the page)');
    ok(await T.stars(p) >= 1, 'the 1958 design passes');
    await p.screenshot({ path: path.join(shots, `igy-${label}-7-debrief.png`), fullPage: true });
    ok(await T.noScroll(p), 'no sideways scroll');
    ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await b.close();
  }
  done();
})();
