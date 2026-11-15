// Ajay's chapter: the intro, then the calibration event with the notebook line and the reply after the choice.
const { chromium } = require('playwright'); const path = require('path');
const repo = process.argv[2], shots = process.argv[3]; const url = 'file://' + path.join(repo, 'index.html');
let failures = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) failures++; };
(async () => {
  for (const [vp, label] of [[{ width: 1280, height: 800 }, 'desktop'], [{ width: 390, height: 844 }, 'phone']]) {
    const b = await chromium.launch(); const p = await b.newPage({ viewport: vp });
    const errors = []; p.on('pageerror', e => errors.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !/fonts|swpc|eonet|cwfis/.test((m.location() || {}).url || '')) errors.push(m.text()); });
    await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await p.goto(url); await p.evaluate(() => localStorage.setItem('smdg-progress-v1', JSON.stringify({ best_stars: { training: 3 }, best_score: { training: 97 }, best_stars_by_era: { igy: 3, nimbus: 3, eos: 3 } })));
    await p.reload();
    // only the calibration event can fire
    await p.evaluate(() => { const c = EVENTS.filter(e => e.id === 'calibration-drift'); EVENTS.length = 0; c.forEach(e => EVENTS.push(e)); });
    await p.click('[data-key="start-new-space-standard"]');
    ok(await p.locator('.intro').waitFor({ timeout: 3000 }).then(() => true, () => false), 'Ajay intro shows');
    const t = await p.locator('.intro').innerText(); console.log('     ' + t.replace(/\n/g, ' | ').slice(0, 230));
    ok(/AJAY|PART 2/i.test(t), 'it is Ajay\'s chapter');
    let n = 1; while (/NEXT/.test(await p.locator('.intro .btn.primary').innerText()) && n < 12) { await p.click('.intro .btn.primary'); n++; }
    console.log('     beats: ' + n); ok(n <= 6, 'at most 6 beats');
    await p.click('.intro .btn.primary');
    const head = async h => p.locator('.screen-head h1', { hasText: h }).waitFor({ timeout: 8000 }).then(() => true, () => false);
    ok(await head('BASE MAP'), 'map after the intro');
    await p.keyboard.press('e'); await p.waitForTimeout(2500); await p.keyboard.press('e');
    ok(await head('BRIEFING'), 'briefing'); await p.click('[data-key="obj-sea-ice"]'); await p.click('.nav-row .btn.primary');
    ok(await head('ORBIT'), 'orbit'); await p.click('[data-key="orbit-sso"]'); await p.click('.nav-row .btn.primary');
    ok(await head('BUILD'), 'build');
    const add = async (bin, part) => { await p.click(`[data-key="bin-${bin}"]`); await p.click(`[data-key="part-${part}"]`); };
    await add('instrument', 'sar-radar'); await add('power', 'solar-large'); await add('comms', 'radio-xband'); await add('computer', 'obc-basic'); await add('power', 'battery-28v'); await add('propulsion', 'prop-green-large');
    ok(await p.locator('.sat').count() >= 1 || await p.locator('.bench svg').count() >= 1, 'satellite drawn on the bench');
    await p.keyboard.press('m'); await p.click('[data-key="blip-launcher"]'); ok(await head('LAUNCH VEHICLE'), 'launcher');
    await p.click('[data-key="rocket-small"]'); await p.click('.nav-row .btn.primary'); ok(await head('READINESS'), 'review');
    await p.click('.btn.big'); ok(await head('MISSION'), 'mission'); await p.click('button[aria-label="Fast forward"]');
    let seen = false;
    for (let i = 0; i < 400; i++) {
      if (await p.locator('[role="alertdialog"]').count()) {
        const txt = (await p.locator('[role="alertdialog"]').innerText()).replace(/\n/g, ' | '); console.log('     event: ' + txt);
        seen = /CALIBRATION/i.test(txt); await p.screenshot({ path: path.join(shots, `${label}-calib-event.png`) });
        ok(/NOTEBOOK/i.test(txt), 'the notebook line is in the event'); 
        await p.locator('.choices .btn').first().click(); await p.waitForTimeout(300);
        console.log('     log: ' + (await p.locator('.log').innerText()).replace(/\n/g, ' | ').slice(0, 300));
        break;
      }
      await p.waitForTimeout(50);
    }
    ok(seen, 'calibration event appears');
    ok(errors.length === 0, 'no errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await b.close();
  }
  console.log(failures ? 'FAILED ' + failures : 'PASSED'); process.exit(failures ? 1 : 0);
})();
