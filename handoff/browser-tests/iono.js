// The Canadian ionosphere topic (Alouette 1) in the 1964 era: the topic card, the in-view line, the monthly soundings line and the debrief.
const { chromium } = require('playwright'); const path = require('path');
const REPO = process.env.REPO || '/home/user/Hackstreet_Bros_Satellite'; const shots = process.argv[2];
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
(async () => {
  for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    console.log(`[ionosphere ${label}]`);
    const b = await chromium.launch(); const p = await b.newPage({ viewport });
    const errors = []; p.on('pageerror', e => errors.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|services\.swpc\.noaa\.gov|eonet\.gsfc\.nasa\.gov|cwfis\.cfs\.nrcan\.gc\.ca/.test((m.location() || {}).url || '')) errors.push(m.text()); });
    await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const wait = t => p.locator('.screen-head h1', { hasText: t }).waitFor({ timeout: 8000 }).then(() => true, () => false);
    await p.goto('file://' + REPO + '/index.html');
    await p.evaluate(() => localStorage.setItem('smdg-progress-v1', JSON.stringify({ best_stars: {}, best_score: {}, best_stars_by_era: { igy: 3 } }))); await p.reload();
    await p.click('[data-key="start-nimbus-training"]'); await p.locator('.intro').waitFor({timeout:3000}).then(()=>p.click('text=SKIP'),()=>{}); /*SKIPINTRO*/ await wait('BASE MAP');
    await p.click('[data-key="blip-briefing"]'); await wait('BRIEFING');
    ok(await p.locator('[data-key="obj-ionosphere"]:not([disabled])').count() === 1, 'the ionosphere topic is offered in 1964');
    await p.click('[data-key="obj-ionosphere"]'); await p.click('.nav-row .btn.primary'); await wait('ORBIT');
    const leo = (await p.locator('[data-key="orbit-leo"] .nasa-line').innerText()); console.log('     ' + leo);
    ok(/In view: 42% of Alouette's soundings \(Canadian Space Agency 1963\)/.test(leo), 'orbit card: the share of Alouette soundings in view');
    await p.screenshot({ path: path.join(shots, `iono-${label}-2-orbit.png`), fullPage: true });
    await p.click('[data-key="orbit-leo"]'); await p.click('.nav-row .btn.primary'); await wait('BUILD');
    const add = async (bin, part) => { await p.click(`[data-key="bin-${bin}"]`); await p.click(`[data-key="part-${part}"]`); };
    for (const [bin, part] of [['structure','drum-body'],['attitude','spin-stabilised'],['instrument','topside-sounder'],['power','silicon-cells'],['power','silver-zinc-battery'],['comms','vhf-telemetry'],['computer','command-timer']]) await add(bin, part);
    await p.click('.nav-row .btn.primary'); await wait('LAUNCH VEHICLE'); await p.click('[data-key="rocket-thor-able"]'); await p.click('.nav-row .btn.primary'); ok(await wait('READINESS'), 'readiness review');
    await p.locator('.btn.big').click(); await wait('MISSION');
    await p.waitForFunction(() => /soundings/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
    const line = await p.locator('.nasa-line').first().innerText().catch(() => ''); console.log('     ' + line);
    ok(/January: Alouette heard 18,682 soundings \(Canadian Space Agency\)/.test(line), 'mission: the real soundings line each month');
    await p.click('button[aria-label="Fast forward"]');
    for (let i = 0; i < 400; i++) { if (await p.locator('.screen-head h1', { hasText: 'DEBRIEF' }).count()) break;
      if (await p.locator('[role="alertdialog"]').count()) await p.locator('.choices .btn').first().click(); await p.waitForTimeout(50); }
    ok(await p.locator('.screen-head h1', { hasText: 'DEBRIEF' }).count() === 1, 'debrief shows');
    const nasa = await p.locator('.nasa-box').first().innerText(); console.log('     ' + nasa.replace(/\n/g, ' | ').slice(0, 220));
    ok(/Alouette 1 swept the ionosphere/.test(nasa), 'debrief: the comparison with the real Alouette record');
    await p.screenshot({ path: path.join(shots, `iono-${label}-7-debrief.png`), fullPage: true });
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll');
    ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await b.close();
  }
  console.log(fails ? 'FAILED ' + fails : 'PASSED'); process.exit(fails ? 1 : 0);
})();
