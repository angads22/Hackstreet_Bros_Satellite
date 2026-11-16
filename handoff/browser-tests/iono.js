// The Canadian ionosphere topic (Alouette 1) in Part 2: Easy opens with an ionosphere contract from polar orbit. Its
// cheapest launchable design (lib.js CONTRACT.ionosphere, on the small launcher) costs more than Easy's starting cash,
// so this test RAISES THE CASH in the saved campaign ("smdg-campaign") before flying it. Then: the contract card, the
// orbit card's in-view line, the monthly soundings line in flight, and the debrief's comparison with Alouette's record.
// Usage: node iono.js [shots dir]   or   node iono.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();

(async () => {
  for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    console.log(`[ionosphere ${label}]`);
    const b = await chromium.launch(); const p = await b.newPage({ viewport });
    const errors = T.watchErrors(p);
    await T.noFonts(p);
    await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
    await T.startComeback(p, 'training');
    const k = await p.evaluate(() => (getComeback().contracts || []).find(x => x.topic === 'ionosphere') || null);
    ok(!!k && await p.locator('[data-key="job-ionosphere"]').count() === 1, 'Easy opens with an ionosphere contract on the job board');
    if (!k) { await b.close(); continue; }
    ok(k.orbit === T.CONTRACT.ionosphere.orbit, `the client wants it from ${k.orbit_name}`);
    // A comeback flight rolls for a launch failure (SPEC.md, "Launch failures"). The roll is seeded by the run, the design and the flight
    // number, so the same run replays the same way: with the seed lib.js fixes, this design's FIRST flight fails at launch, every time.
    // That is the game working (it flies no month, so there is no soundings line). Each try starts again from the same save with the next
    // flight number, which is a new roll; a try that fails is checked for what the debrief says, then the next one is made.
    const fresh = await p.evaluate(() => localStorage.getItem('smdg-campaign'));
    let launched = false;
    for (let flight = 1; flight <= 5 && !launched; flight++) {
      // The design costs more than Easy's starting cash: give the save enough cash for it.
      await p.evaluate(([raw, n]) => { const c = JSON.parse(raw); c.treasury_musd = 20; c.flights = n; localStorage.setItem('smdg-campaign', JSON.stringify(c)); }, [fresh, flight - 1]);
      await p.evaluate(() => window.showComebackHub());
      await T.pastScenes(p);   // after a flight the workshop may open on a story scene first
      await p.click('[data-key="fly-ionosphere"]'); await T.waitHead(p, 'BASE MAP');
      await p.click('[data-key="blip-orbit"]'); await T.waitHead(p, 'ORBIT');
      if (flight === 1) {
        const sso = await p.locator(`[data-key="orbit-${k.orbit}"] .nasa-line`).innerText(); console.log('     ' + sso);
        ok(/In view: \d+% of Alouette's soundings \(Canadian Space Agency \d{4}\)/.test(sso), "orbit card: the share of Alouette's soundings in view");
        ok(/Set by the contract/.test(await p.locator('#app').innerText()), 'the orbit is set by the contract');
        await p.screenshot({ path: path.join(shots, `iono-${label}-2-orbit.png`), fullPage: true });
      }
      await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'BUILD');
      await T.addParts(p, T.CONTRACT.ionosphere.parts);
      await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'LAUNCH VEHICLE');
      await p.click(`[data-key="rocket-${T.CONTRACT.ionosphere.launcher}"]`);
      await p.click('.nav-row .btn.primary'); const review = await T.waitHead(p, 'READINESS');
      if (flight === 1) { ok(review, 'readiness review'); ok(await p.locator('.btn.big').isEnabled(), 'it can launch: ' + (await p.locator('.verdict').innerText())); }
      await p.locator('.btn.big').click(); await T.waitHead(p, 'MISSION');   // the lift-off plays first
      // A lost rocket goes on to the debrief within moments; a flight that launched takes much longer (no fast forward yet).
      launched = !(await T.head(p, 'DEBRIEF').waitFor({ timeout: 4000 }).then(() => true, () => false));
      if (!launched) ok(/The rocket failed at launch/.test(await p.locator('#app').innerText()), 'flight ' + flight + ': the rocket failed at launch, and the debrief says so');
    }
    ok(launched, 'a flight launched');
    await p.waitForFunction(() => /soundings/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
    const line = await p.locator('.nasa-line').first().innerText().catch(() => ''); console.log('     ' + line);
    ok(/Alouette heard [\d,]+ soundings \(Canadian Space Agency\)/.test(line), 'mission: the real soundings line each month');
    await T.fly(p, 'first');
    ok(await T.waitHead(p, 'DEBRIEF'), 'debrief shows');
    const nasa = await p.locator('.nasa-box').filter({ hasText: 'AGAINST THE REAL EARTH' }).innerText().catch(() => '');
    console.log('     ' + nasa.replace(/\n/g, ' | ').slice(0, 220));
    ok(/Alouette 1 swept the ionosphere/.test(nasa), 'debrief: the comparison with the real Alouette record');
    ok(await p.locator('[data-key="contract-result"]').count() === 1, "debrief: the contract's money");
    await p.screenshot({ path: path.join(shots, `iono-${label}-7-debrief.png`), fullPage: true });
    ok(await T.noScroll(p), 'no sideways scroll');
    ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await b.close();
  }
  done();
})();
