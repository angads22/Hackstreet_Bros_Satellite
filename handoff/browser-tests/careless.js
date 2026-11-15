const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto('file://' + (process.env.REPO || '/home/user/Hackstreet_Bros_Satellite') + '/index.html'); await p.evaluate(() => localStorage.setItem('smdg-progress-v1', JSON.stringify({ best_stars: {}, best_score: {}, best_stars_by_era: { igy: 3, nimbus: 3, eos: 3 } }))); await p.reload();
  const wait = t => p.locator('.screen-head h1', { hasText: t }).waitFor({ timeout: 8000 });
  await p.click('[data-key="start-new-space-training"]'); await p.locator('.intro').waitFor({timeout:3000}).then(()=>p.click('text=SKIP'),()=>{}); /*SKIPINTRO*/ await wait('BASE MAP');
  await p.click('[data-key="blip-briefing"]'); await wait('BRIEFING'); await p.click('[data-key="obj-wildfire"]');
  await p.click('.nav-row .btn.primary'); await wait('ORBIT'); await p.click('[data-key="orbit-leo"]');
  await p.click('.nav-row .btn.primary'); await wait('BUILD');
  await p.click('[data-key="bin-instrument"]'); await p.click('[data-key="part-optical-camera"]');
  console.log('build problems:', (await p.locator('.checks').innerText()).replace(/\n/g, ' | '));
  await p.keyboard.press('m'); await wait('BASE MAP');
  await p.click('[data-key="blip-review"]');
  await p.waitForTimeout(2500);
  if (!(await p.locator('.screen-head h1', { hasText: 'READINESS' }).count())) {   // review locked until the rocket yard is visited
    await p.click('[data-key="blip-launcher"]'); await wait('LAUNCH VEHICLE');
    console.log('GO TO at the Rocket Yard with Workshop blockers:', await p.locator('.nav-row .btn.primary').innerText());
    await p.keyboard.press('m'); await wait('BASE MAP');
    await p.click('[data-key="blip-review"]'); await wait('READINESS');
  }
  console.log('review:', (await p.locator('.verdict').innerText()), '| launch disabled:', await p.locator('.btn.big').isDisabled());
  console.log('lines:', (await p.locator('.checks').innerText()).replace(/\n/g, ' | '));
  await p.locator('button.fix').first().click();
  console.log('first FIX went to:', await p.locator('.screen-head h1').innerText());
  console.log('errors:', errors.length ? errors : 'none');
  await b.close();
})();
