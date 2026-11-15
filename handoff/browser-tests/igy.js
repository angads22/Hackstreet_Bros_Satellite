// The 1958 era from a fresh start: only what existed then is offered; a winning design opens the next era.
const { chromium } = require('playwright'); const path = require('path');
const REPO = process.env.REPO || '/home/user/Hackstreet_Bros_Satellite'; const shots = process.argv[2];
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
(async () => {
  for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    console.log(`[igy ${label}]`);
    const b = await chromium.launch(); const p = await b.newPage({ viewport });
    const errors = []; p.on('pageerror', e => errors.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|services\.swpc\.noaa\.gov|eonet\.gsfc\.nasa\.gov|cwfis\.cfs\.nrcan\.gc\.ca/.test((m.location() || {}).url || '')) errors.push(m.text()); });
    if (!process.env.FONTS) await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const wait = t => p.locator('.screen-head h1', { hasText: t }).waitFor({ timeout: 8000 }).then(() => true, () => false);
    await p.goto('file://' + REPO + '/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
    ok(await p.locator('.era').count() === 4 && await p.locator('.era.locked').count() === 3, 'four eras, three locked');
    ok((await p.locator('[data-key="era-nimbus"]').innerText()).includes('Earn 2 stars in International Geophysical Year'), 'locked era says how to open it');
    await p.screenshot({ path: path.join(shots, `igy-${label}-0-title.png`), fullPage: true });
    await p.click('[data-key="start-igy-training"]'); await p.locator('.intro').waitFor({timeout:3000}).then(()=>p.click('text=SKIP'),()=>{}); /*SKIPINTRO*/ ok(await wait('BASE MAP'), 'starts on the map');
    ok((await p.locator('#status').innerText()).includes('1958'), 'header shows the year 1958');
    await p.click('[data-key="blip-briefing"]'); await wait('BRIEFING');
    ok(await p.locator('button.card:not([disabled])').count() === 1, 'one topic offered in 1958');
    ok((await p.locator('[data-key="obj-wildfire"]').innerText()).toUpperCase().includes('ARRIVES IN 1999'), 'wildfire greyed out: arrives in 1999');
    await p.screenshot({ path: path.join(shots, `igy-${label}-1-briefing.png`), fullPage: true });
    await p.click('[data-key="obj-radiation"]'); await p.click('.nav-row .btn.primary'); await wait('ORBIT');
    await p.click('[data-key="orbit-leo"]'); await p.click('.nav-row .btn.primary'); await wait('BUILD');
    const add = async (bin, part) => { await p.click(`[data-key="bin-${bin}"]`); await p.click(`[data-key="part-${part}"]`); };
    await p.click('[data-key="bin-instrument"]');
    ok(await p.locator('[data-key="part-sar-radar"]').isDisabled(), 'radar greyed out in 1958');
    ok((await p.locator('[data-key="part-sar-radar"]').innerText()).includes('Arrives in'), 'radar card says when it arrives');
    await add('structure', 'explorer-body'); await add('attitude', 'spin-stabilised'); await add('instrument', 'cosmic-ray-counter');
    await add('power', 'mercury-battery'); await add('power', 'silicon-cells'); await add('comms', 'minitrack-beacon'); await add('computer', 'command-timer');
    console.log('     bins: ' + (await p.locator('.bins').innerText()).replace(/\n/g, ' | '));
    console.log('     body: ' + (await p.locator('.body-card').innerText()).replace(/\n/g, ' | '));
    await p.mouse.move(0, 0);
    await p.screenshot({ path: path.join(shots, `igy-${label}-3-build.png`), fullPage: true });
    await p.click('.nav-row .btn.primary'); await wait('LAUNCH VEHICLE');
    ok(await p.locator('button.card:not([disabled])').count() === 2, 'two rockets offered in 1958');
    await p.click('[data-key="rocket-vanguard-rocket"]'); await p.click('.nav-row .btn.primary'); ok(await wait('READINESS'), 'reaches the readiness review');
    ok(!(await p.locator('.btn.big').isDisabled()), 'launch enabled');
    await p.locator('.btn.big').click(); await wait('MISSION'); await p.click('button[aria-label="Fast forward"]');
    for (let i = 0; i < 400; i++) { if (await p.locator('.screen-head h1', { hasText: 'DEBRIEF' }).count()) break;
      if (await p.locator('[role="alertdialog"]').count()) await p.locator('.choices .btn').first().click(); await p.waitForTimeout(50); }
    ok(await p.locator('.screen-head h1', { hasText: 'DEBRIEF' }).count() === 1, 'debrief shows');
    const banners = (await p.locator('.banner').allInnerTexts()).join(' | '); console.log('     banners: ' + banners + ' | ' + await p.locator('.stamp').getAttribute('aria-label'));
    ok(/NEW ERA: NIMBUS \(1964\)/.test(banners), 'banner: new era Nimbus (1964)');
    await p.screenshot({ path: path.join(shots, `igy-${label}-7-debrief.png`), fullPage: true });
    await p.click('text=NEW MISSION'); await wait('BASE MAP');
    ok((await p.locator('#status').innerText()).includes('1958'), 'New mission stays in 1958');
    await p.click('text=CHANGE TIER');
    ok(await p.locator('.era.locked').count() === 2, 'tier select: Nimbus is now open');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll on tier select');
    await p.screenshot({ path: path.join(shots, `igy-${label}-8-title.png`), fullPage: true });
    ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await b.close();
  }
  console.log(fails ? 'FAILED ' + fails : 'PASSED'); process.exit(fails ? 1 : 0);
})();
