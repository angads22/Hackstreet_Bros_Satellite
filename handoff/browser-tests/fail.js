// Fail leg: careless design, LAUNCH ANYWAY, risky choices, 0-star debrief, then NEW MISSION and CHANGE TIER.
// Also checks sideways scroll at in-between widths on the Standard tier (help button shown).
const { chromium } = require('playwright');
const path = require('path');
const shots = process.argv[2];
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const URL = 'file://' + (process.env.REPO || '/home/user/Hackstreet_Bros_Satellite') + '/index.html';
const noScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const waitHead = (p, t) => p.locator('.screen-head h1', { hasText: t }).waitFor({ timeout: 8000 }).then(() => true, () => false);
async function visit(p, place, title) {
  if (!(await p.locator('.screen-head h1', { hasText: 'BASE MAP' }).count())) { await p.keyboard.press('m'); await waitHead(p, 'BASE MAP'); } await p.click(`[data-key="blip-${place}"]`); return waitHead(p, title); }

async function careless(p, tierKey) {
  await p.click(`[data-key="start-new-space-${tierKey}"]`); await p.locator('.intro').waitFor({timeout:3000}).then(()=>p.click('text=SKIP'),()=>{}); /*SKIPINTRO*/ await waitHead(p, 'BASE MAP');
  await p.click('[data-key="blip-briefing"]'); await waitHead(p, 'BRIEFING');
  await p.click('[data-key="obj-wildfire"]');
  await p.click('.nav-row .btn.primary'); await waitHead(p, 'ORBIT'); await p.click('[data-key="orbit-leo"]');
  await p.click('.nav-row .btn.primary'); await waitHead(p, 'BUILD');
  for (const [bin, part] of [['instrument','optical-camera'],['power','solar-small'],['comms','radio-uhf'],['computer','obc-basic']]) {
    await p.click(`[data-key="bin-${bin}"]`); await p.click(`[data-key="part-${part}"]`);
  }
  await p.click('.nav-row .btn.primary'); await waitHead(p, 'LAUNCH VEHICLE'); await p.click('[data-key="rocket-rideshare"]');
  await p.click('.nav-row .btn.primary'); await waitHead(p, 'READINESS');
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|services\.swpc\.noaa\.gov|eonet\.gsfc\.nasa\.gov|cwfis\.cfs\.nrcan\.gc\.ca/.test((m.location() || {}).url || '')) errors.push(m.text()); });
  await p.goto(URL); await p.evaluate(() => localStorage.setItem('smdg-progress-v1', JSON.stringify({ best_stars: {}, best_score: {}, best_stars_by_era: { igy: 3, nimbus: 3, eos: 3 } }))); await p.reload();
  console.log('[fail leg]');
  await careless(p, 'training');
  const btn = p.locator('.btn.big');
  ok(!(await btn.isDisabled()), 'careless design can launch');
  ok((await btn.innerText()).includes('LAUNCH ANYWAY'), 'button reads LAUNCH ANYWAY with warnings only');
  await btn.click();
  await p.click('button[aria-label="Fast forward"]');
  let events = 0;
  for (let i = 0; i < 400; i++) {
    if (await p.locator('h1', { hasText: 'DEBRIEF' }).count()) break;
    if (await p.locator('[role="alertdialog"]').count()) { events++; await p.locator('.choices .btn').last().click(); }
    await p.waitForTimeout(50);
  }
  ok(await p.locator('h1', { hasText: 'DEBRIEF' }).count() === 1, `reached debrief (${events} event(s), risky choice)`);
  const stamp = await p.locator('.stamp').getAttribute('aria-label');
  const limit = await p.locator('.limit h2').first().innerText();
  console.log('     ' + stamp + ' | ' + limit + ' | ' + (await p.locator('.try').innerText()));
  ok(stamp.startsWith('0 of 3'), '0 stars');
  ok(!/NOTHING/.test(limit), 'limiting factor named');
  await p.screenshot({ path: path.join(shots, 'fail-debrief.png'), fullPage: true });
  await p.click('text=NEW MISSION');
  ok(await waitHead(p, 'BASE MAP'), 'NEW MISSION opens the base map');
  ok(await p.locator('.blip.locked').count() === 4 && await p.locator('[data-key="blip-briefing"].next').count() === 1, 'fresh design: only Mission Control open');
  await p.click('[data-key="blip-briefing"]'); await waitHead(p, 'BRIEFING');
  ok(await p.locator('[data-key="obj-wildfire"][aria-pressed="true"]').count() === 0, 'fresh design: no objective chosen');
  await p.click('[data-key="obj-wildfire"]'); await p.click('.nav-row .btn.primary'); await waitHead(p, 'ORBIT');
  await p.click('[data-key="orbit-leo"]'); await p.click('.nav-row .btn.primary'); await waitHead(p, 'BUILD');
  ok(await p.locator('.bin-sub.need').count() === 4, 'Build starts empty (4 needed bins)');
  await p.keyboard.press('m'); await waitHead(p, 'BASE MAP');
  await p.click('text=CHANGE TIER');
  ok(await p.locator('.big-title').count() === 1, 'CHANGE TIER on the map returns to tier select');

  // Unlock Standard via the good design, then width checks with the help button showing
  console.log('[widths, Standard tier]');
  await p.evaluate(() => localStorage.setItem('smdg-progress-v1', JSON.stringify({ best_stars: { training: 3 }, best_score: { training: 97 }, best_stars_by_era: { igy: 3, nimbus: 3, eos: 3 } })));
  await p.reload();
  ok(await p.locator('[data-key="start-new-space-standard"]:not([disabled])').count() === 1, 'Standard unlocked by saved progress');
  await careless(p, 'standard');
  ok(await p.locator('#help-btn:not([hidden])').count() === 1, 'hint button shown on Standard');
  for (const w of [700, 761, 820, 900, 1000, 1100]) {
    await p.setViewportSize({ width: w, height: 800 });
    for (const step of ['Step 3: build', 'Step 5: review', 'map']) {
      if (step === 'map') { await p.keyboard.press('m'); await waitHead(p, 'BASE MAP'); }
      else await visit(p, step.includes('build') ? 'build' : 'review', step.includes('build') ? 'BUILD' : 'READINESS');
      const good = await noScroll(p);
      if (!good) {
        const culprits = await p.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 4).map(e => e.tagName + '.' + e.className));
        console.log('     overflow at ' + w + ' on ' + step + ': ' + culprits.join(', '));
      }
      ok(good, `no sideways scroll at ${w}px on ${step.replace('Step ', '')}`);
    }
  }
  await p.screenshot({ path: path.join(shots, 'width-1000-review.png') });
  ok(errors.length === 0, 'no errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await b.close();
  console.log(fails ? 'FAILED ' + fails : 'PASSED'); process.exit(fails ? 1 : 0);
})();
