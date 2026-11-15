// Full playthrough of the real game from file://, on the repo's real data, using the base map.
// Usage: node play.js <repo dir> <shots dir>      (FONTS=1 lets the web fonts load)
const { chromium } = require('playwright');
const path = require('path');
const repo = process.argv[2], shots = process.argv[3];
const url = 'file://' + path.join(repo, 'index.html');

let failures = 0;
function ok(cond, msg) { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) failures++; }
const head = (p, text) => p.locator('.screen-head h1', { hasText: text });
const waitHead = (p, text) => head(p, text).waitFor({ timeout: 8000 }).then(() => true, () => false);

async function run(viewport, label) {
  console.log(`[${label}]`);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|services\.swpc\.noaa\.gov|eonet\.gsfc\.nasa\.gov|cwfis\.cfs\.nrcan\.gc\.ca/.test((m.location() || {}).url || '')) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  if (!process.env.FONTS) await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(url);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  const shot = n => page.screenshot({ path: path.join(shots, `${label}-${n}.png`), fullPage: true });

  // Tier select
  ok(await page.locator('.big-title').isVisible(), 'title screen shows');
  ok(await page.locator('.era').count() === 4, 'four eras on tier select');
  ok(await page.locator('.era .tier-btn:not([disabled])').count() === 1, 'only the first era and first tier open at first');
  ok(await page.locator('#minimap').isHidden(), 'no minimap on the title screen');
  await shot('0-title');
  // Open every era (as if earlier eras were won) and play the modern one, where every part exists.
  await page.evaluate(() => localStorage.setItem('smdg-progress-v1', JSON.stringify({ best_stars: {}, best_score: {}, best_stars_by_era: { igy: 3, nimbus: 3, eos: 3 } })));
  await page.reload();
  ok(await page.locator('.era.locked').count() === 0, 'saved progress opens all four eras');
  await page.click('[data-key="start-new-space-training"]');
  // The story's intro: one beat at a time, NEXT to the last, START to the map (the tutorial is Austin's chapter)
  ok(await page.locator('.intro').waitFor({ timeout: 3000 }).then(() => true, () => false), 'the story intro shows before the map');
  ok(await page.locator('.intro .say').count() === 1, 'one beat at a time');
  const beat1 = await page.locator('.intro .say-text').innerText();
  console.log('     intro: ' + beat1.replace(/\n/g, ' | ').slice(0, 160));
  ok(/AUSTIN|GRAVITRON/i.test(await page.locator('.intro').innerText()), 'tutorial intro is Austin\'s story');
  let beats = 1;
  while (/NEXT/.test(await page.locator('.intro .btn.primary').innerText()) && beats < 12) { await page.click('.intro .btn.primary'); beats++; }
  ok(beats >= 2 && beats <= 5, `${beats} short beats`);
  await shot('0b-intro');
  await page.click('.intro .btn.primary');   // START

  // Base map
  ok(await waitHead(page, 'BASE MAP'), 'picking a tier opens the base map');
  ok(await page.locator('.blip').count() === 5, 'five place markers');
  ok(await page.locator('[data-key="blip-briefing"].next').count() === 1, 'Mission Control is the next marker');
  ok(await page.locator('.blip.locked').count() === 4, 'the other four are locked');
  ok((await page.locator('#objective').innerText()).includes('Mission Control'), 'objective line points to Mission Control');
  ok((await page.locator('.map-route').getAttribute('points')).split(' ').length >= 2, 'gold route drawn');
  await shot('1-map');
  // A locked place cannot be entered
  await page.click('[data-key="blip-launcher"]');
  await page.waitForTimeout(2500);
  ok(/locked/i.test(await page.locator('.map-prompt-text').innerText()), 'walking to a locked place says it is locked');
  ok(await head(page, 'BASE MAP').count() === 1, '...and stays on the map');
  // Keyboard: E follows the route, E again goes in
  await page.keyboard.press('e');
  await page.waitForTimeout(2500);
  ok(/MISSION CONTROL/.test(await page.locator('.map-prompt-text').innerText()), 'E follows the route to Mission Control');
  await page.keyboard.press('e');

  // 1 Briefing
  ok(await waitHead(page, 'BRIEFING'), 'E again goes into Mission Control (briefing)');
  ok(await page.locator('#minimap').isVisible(), 'minimap shows inside a place');
  ok(await page.locator('.nav-row .btn.primary').isDisabled(), 'GO TO is disabled until an objective is picked');
  await page.click('[data-key="obj-sea-ice"]');
  await shot('2-briefing');
  await page.click('.nav-row .btn.primary');

  // 2 Orbit (walked there)
  ok(await waitHead(page, 'ORBIT'), 'GO TO walks to the Tracking Station (orbit)');
  ok(await page.locator('[data-key="orbit-geo"] .tag.bad').count() === 1, 'GEO marked cannot see target for sea ice');
  await page.click('[data-key="orbit-sso"]');
  await page.click('.nav-row .btn.primary');

  // 3 Build: the spec's sea-ice example
  ok(await waitHead(page, 'BUILD'), 'GO TO walks to the Workshop (build)');
  const add = async (bin, part) => { await page.click(`[data-key="bin-${bin}"]`); await page.click(`[data-key="part-${part}"]`); };
  await page.click('[data-key="bin-instrument"]');
  await page.hover('[data-key="part-sar-radar"]');
  ok((await page.locator('#preview').innerText()).includes('ADD SYNTHETIC APERTURE RADAR'), 'hover preview names the part');
  await add('instrument', 'sar-radar');
  await add('power', 'solar-large');
  await add('comms', 'radio-xband');
  await add('computer', 'obc-basic');
  await add('power', 'battery-28v');
  await add('propulsion', 'prop-green-large');
  if (process.env.BODY) {   // with structure and attitude required
    ok(await page.locator('.bin-sub.need').count() === 2, 'two bins still marked Needed: structure and attitude');
    await add('structure', 'smallsat-bus');
    await add('attitude', 'reaction-wheels');
    ok(await page.locator('.body-card').count() === 1, 'body card shows');
    console.log('     body: ' + (await page.locator('.body-card').innerText()).replace(/\n/g, ' | '));
    console.log('     bins: ' + (await page.locator('.bins').innerText()).replace(/\n/g, ' | '));
  }
  const bars = (await page.locator('.bars').first().innerText()).replace(/\n/g, ' | ');
  console.log('     bars: ' + bars);
  if (!process.env.BODY) ok(/MASS \| 73\.8 KG/.test(bars), 'mass 73.8 kg (spec table: 74)');
  if (!process.env.BODY) ok(bars.includes('265 / 365 W'), 'power 265 / 365 W (spec table)');
  ok(bars.includes('10 / 10 GB/DAY'), 'data home 10 / 10 (spec table)');
  await page.mouse.move(0, 0);
  await shot('3-build');
  // M opens the map from inside a place; markers reflect progress
  await page.keyboard.press('m');
  ok(await waitHead(page, 'BASE MAP'), 'M opens the map from the Workshop');
  ok(await page.locator('[data-key="blip-build"].here').count() === 1, 'player stands at the Workshop');
  ok(await page.locator('.blip.done').count() === 3, 'three places done');
  ok(await page.locator('[data-key="blip-launcher"].next').count() === 1, 'Rocket Yard is next');
  await page.click('[data-key="blip-launcher"]');

  // 4 Launch vehicle
  ok(await waitHead(page, 'LAUNCH VEHICLE'), 'clicking the next marker walks there and goes in');
  ok(await page.locator('[data-key="rocket-rideshare"] .tag.bad', { hasText: 'TOO SMALL' }).count() === 1, 'rideshare too small');
  await page.click('[data-key="rocket-small"]');
  const b2 = (await page.locator('.bars').first().innerText()).replace(/\n/g, ' ');
  ok(b2.includes('/ 200 KG'), 'mass bar now has the rocket limit');
  if (!process.env.BODY) ok(b2.includes('$16.1M'), 'budget includes the rocket ($16.1M, spec table)');
  await shot('4-launcher');
  await page.click('.nav-row .btn.primary');

  // 5 Readiness
  ok(await waitHead(page, 'READINESS'), 'GO TO walks to the Launch Pad (review)');
  const launchBtn = page.locator('.btn.big');
  ok(!(await launchBtn.isDisabled()), 'launch enabled with no blockers');
  ok(await page.locator('.verdict.ok').count() === 1, 'all systems go, shown once');
  await shot('5-review');
  await launchBtn.click();

  // 6 Mission
  ok(await waitHead(page, 'MISSION'), 'mission screen shows');
  ok(await page.locator('#minimap').isHidden(), 'no minimap during the mission');
  await page.keyboard.press('m');
  ok(await head(page, 'MISSION').count() === 1, 'M does nothing during the mission');
  await page.click('button[aria-label="Fast forward"]');
  let events = 0;
  for (let i = 0; i < 400; i++) {
    if (await head(page, 'DEBRIEF').count()) break;
    if (await page.locator('[role="alertdialog"]').count()) {
      events++;
      if (events === 1) await shot('6-event');
      await page.locator('.choices .btn').first().click();
    }
    await page.waitForTimeout(50);
  }
  ok(events >= 1, `answered ${events} event(s)`);

  // 7 Debrief
  ok(await head(page, 'DEBRIEF').count() === 1, 'debrief shows');
  const report = (await page.locator('.paper').innerText()).replace(/\n/g, ' | ');
  console.log('     report: ' + report);
  ok(/SCORE \| \d+/.test(report), 'score shown');
  ok((await page.locator('.try').innerText()).startsWith('TRY THIS'), 'suggestion shown');
  await shot('7-debrief');
  console.log('     unlock banner: ' + ((await page.locator('.banner').count()) ? await page.locator('.banner').innerText() : 'none'));

  // Redesign returns to Build with the same parts; every place open on the map
  await page.click('text=REDESIGN');
  ok(await waitHead(page, 'BUILD'), 'redesign returns to Build');
  ok(await page.locator('.bin-sub', { hasText: /on board|slots/ }).count() >= 4, 'same design loaded');
  await page.keyboard.press('Escape');
  ok(await waitHead(page, 'BASE MAP'), 'Esc opens the map');
  ok(await page.locator('.blip.locked').count() === 0, 'no place locked after a flight');
  await page.click('[data-key="blip-review"]');
  ok(await waitHead(page, 'READINESS'), 'clicking marker 5 walks to the Launch Pad');
  const noScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  ok(noScroll, 'no sideways scroll');

  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await browser.close();
}

(async () => {
  await run({ width: 1280, height: 800 }, 'desktop');
  await run({ width: 390, height: 844 }, 'phone');
  console.log(failures ? `FAILED ${failures}` : 'PASSED');
  process.exit(failures ? 1 : 0);
})();
