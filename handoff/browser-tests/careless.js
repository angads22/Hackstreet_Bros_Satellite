// A careless player in Part 1: the presets never leave a place locked or the gold route on a place already done,
// and every FIX link and route leads somewhere the problem can be fixed (no dead end at a preset Rocket Yard, and
// back to the Tracking Station for an orbit no 1958 rocket can reach).
// Usage: node careless.js [shots dir]   or   node careless.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();
const { waitHead } = T;

const nextPlace = p => p.evaluate(() => { const n = document.querySelector('.blip.next'); return n ? n.getAttribute('data-key').replace('blip-', '') : null; });
const fixTargets = p => p.evaluate(() => [...document.querySelectorAll('button.fix')].map(b => (b.getAttribute('aria-label').match(/Fix on the (\w+) screen/) || [])[1]));
async function toMap(p) { if (!(await T.head(p, 'BASE MAP').count())) { await p.keyboard.press('m'); await waitHead(p, 'BASE MAP'); } }

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();

  console.log('[step 1: rocket and orbit preset]');
  await p.click('[data-key="part1-go"]'); await T.throughBeats(p); await waitHead(p, 'BASE MAP');
  ok(await nextPlace(p) === 'build', 'at the start the route points to the Workshop, not a preset place');
  await p.click('[data-key="blip-build"]'); await waitHead(p, 'BUILD');
  await T.addParts(p, ['cosmic-ray-counter']);
  console.log('     build problems: ' + (await p.locator('.workshop .checks').innerText()).replace(/\n/g, ' | '));
  await toMap(p);
  ok(await p.locator('[data-key="blip-review"].locked').count() === 0, 'after the Workshop the Launch Pad is open (no detour to the preset Rocket Yard)');
  ok(await nextPlace(p) === 'build', 'parts still missing: the route stays on the Workshop');
  await p.click('[data-key="blip-review"]');
  ok(await waitHead(p, 'READINESS'), 'the Launch Pad opens straight away');
  console.log('     review: ' + await p.locator('.verdict').innerText() + ' | launch disabled: ' + await p.locator('.btn.big').isDisabled());
  ok(await p.locator('.btn.big').isDisabled(), 'NO GO: launch disabled');
  const t1 = await fixTargets(p);
  console.log('     FIX links go to: ' + t1.join(', '));
  ok(t1.length > 0 && t1.every(t => t === 'build'), 'every FIX link goes to the Workshop (the rocket is preset)');
  await p.locator('button.fix').first().click();
  ok(await waitHead(p, 'BUILD'), 'the first FIX opens Build');
  await T.addParts(p, ['explorer-body', 'spin-stabilised', 'mercury-battery', 'minitrack-beacon', 'command-timer']);
  await toMap(p);
  ok(await nextPlace(p) === 'review' && await p.locator('[data-key="blip-launcher"].done').count() === 1, 'built: the route points to the Launch Pad; the Rocket Yard is done');
  await p.click('[data-key="blip-review"]'); await waitHead(p, 'READINESS');
  await p.locator('.btn.big').click(); await waitHead(p, 'MISSION'); await T.fly(p, 'first');
  ok(/NOT YET/.test(await p.locator('.walk-result').innerText()), 'batteries only: step 1 not passed');
  await p.click('[data-key="walk-retry"]'); await waitHead(p, 'BUILD');
  await toMap(p);
  ok(await p.locator('.blip.locked').count() === 0 && await nextPlace(p) === 'review', 'after TRY AGAIN: nothing locked, the route on the Launch Pad');
  await p.screenshot({ path: path.join(shots, 'careless-map.png') });

  console.log('[step 2: an orbit the preset rocket cannot reach]');
  await p.click('[data-key="map-home"]');
  await p.evaluate(() => localStorage.setItem('gravitron-walkthrough-v1', JSON.stringify({ done: { 1: 1 } })));
  await p.reload();
  await p.click('[data-key="part1-go"]'); await T.throughBeats(p); await waitHead(p, 'BASE MAP');
  ok(await nextPlace(p) === 'orbit', 'step 2 starts at the Tracking Station');
  await p.click('[data-key="blip-orbit"]'); await waitHead(p, 'ORBIT');
  await p.click('[data-key="orbit-sso"]');
  ok(await p.locator('.nav-row .btn.primary').isDisabled(), 'an orbit Vanguard cannot reach: GO TO is disabled');
  await toMap(p); await p.click('[data-key="blip-build"]');   // the careless player walks on anyway
  ok(await waitHead(p, 'BUILD'), 'the Workshop is still open on the map');
  await T.addParts(p, T.WALK[2].parts);
  await toMap(p);
  ok(await nextPlace(p) === 'orbit', 'the route goes back to the Tracking Station');
  await p.click('[data-key="blip-review"]'); await waitHead(p, 'READINESS');
  const t2 = await fixTargets(p);
  console.log('     FIX links go to: ' + t2.join(', ') + ' | ' + (await p.locator('.checks').innerText()).replace(/\n/g, ' | '));
  ok(t2.length > 0 && t2.every(t => t === 'orbit'), 'FIX goes to the orbit, not the preset Rocket Yard');

  console.log('[step 3: an orbit no 1958 rocket can reach]');
  await p.keyboard.press('m'); await waitHead(p, 'BASE MAP'); await p.click('[data-key="map-home"]');
  await p.evaluate(() => localStorage.setItem('gravitron-walkthrough-v1', JSON.stringify({ done: { 1: 1, 2: 1 } })));
  await p.reload();
  await p.click('[data-key="part1-go"]'); await T.throughBeats(p); await waitHead(p, 'BASE MAP');
  await p.click('[data-key="blip-briefing"]'); await waitHead(p, 'BRIEFING');
  await p.click('[data-key="obj-radiation"]'); await p.click('.nav-row .btn.primary'); await waitHead(p, 'ORBIT');
  await p.click('[data-key="orbit-sso"]');
  ok(/rocket can reach/.test(await p.locator('#objective').innerText()), 'the objective line asks for an orbit a rocket can reach');
  ok(await p.locator('.nav-row .btn.primary').isDisabled(),
    'GO TO is disabled until the orbit can be reached');
  await p.click('[data-key="orbit-leo"]');
  ok(/WORKSHOP/.test(await p.locator('.nav-row .btn.primary').innerText()), 'low orbit: GO TO the Workshop');
  ok(errors.length === 0, 'no errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await b.close();
  done();
})();
