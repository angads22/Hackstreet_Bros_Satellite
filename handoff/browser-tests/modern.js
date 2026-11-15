// The shared design screens with present-day parts, entered the way Part 2 will enter them (no button on the page
// yet): a design in the 2026 era on the Trade Space tier, handed to showDesignScreen('map', d). Checks that the
// Part 1 changes to the shared screens (routes, FIX links, orbit notes, number formatting, the debrief) still work
// when thrusters, a second rocket and GB-sized data exist, and that a later tier still gets Ajay's lines.
// Usage: node modern.js [shots dir]   or   node modern.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();
const { waitHead } = T;
const fixTargets = p => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.checks .check')].map(li =>
  [li.querySelector('strong').innerText, ((li.querySelector('button.fix') || { getAttribute: () => '' }).getAttribute('aria-label').match(/Fix on the (\w+) screen/) || [])[1] || null])));
async function toMap(p) { if (!(await T.head(p, 'BASE MAP').count())) { await p.keyboard.press('m'); await waitHead(p, 'BASE MAP'); } }

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => { const d = newDesign('standard'); setEra(d, 'new-space'); window.showDesignScreen('map', d); });
  ok(await waitHead(p, 'BASE MAP'), 'a 2026 design opens on the map');
  ok((await p.locator('#status').innerText()).startsWith('TRADE SPACE · 2026'), 'header: TRADE SPACE · 2026');
  ok(/PARTNER|CUSTOMER/.test(await p.locator('.say-name').first().innerText()), "a later tier speaks with Ajay's chapter (" + await p.locator('.say-name').first().innerText() + ')');
  ok(await p.locator('.preset-note').count() === 0 && await p.locator('.blip.locked').count() === 4, 'no presets: only Mission Control open');
  await p.click('[data-key="blip-briefing"]'); await waitHead(p, 'BRIEFING');
  await p.click('[data-key="obj-sea-ice"]'); await p.click('.nav-row .btn.primary'); await waitHead(p, 'ORBIT');
  ok(await p.locator('[data-key="orbit-geo"] .part-note').count() === 0, 'geostationary: a 2026 rocket can reach it, so no note');
  await p.click('[data-key="orbit-sso"]'); await p.click('.nav-row .btn.primary'); await waitHead(p, 'BUILD');
  await T.addParts(p, ['smallsat-bus', 'reaction-wheels', 'sar-radar', 'solar-large', 'radio-xband', 'obc-basic', 'battery-28v', 'prop-green-large']);
  const bars = (await p.locator('.bars').first().innerText()).replace(/\n/g, ' | ');
  console.log('     bars: ' + bars);
  ok(bars.includes('10 / 10 GB/DAY'), 'data bar: 10 / 10 GB/DAY');
  ok(/POWER \| \d+ \/ \d+ W/.test(bars), 'power bar in whole watts');
  await p.click('.nav-row .btn.primary'); await waitHead(p, 'LAUNCH VEHICLE');
  await p.click('[data-key="rocket-rideshare"]');
  await toMap(p); await p.click('[data-key="blip-review"]'); await waitHead(p, 'READINESS');
  const f1 = await fixTargets(p); console.log('     ' + JSON.stringify(f1));
  ok(f1['TOO HEAVY'] === 'launcher', 'too heavy for the chosen rocket: FIX goes to the Rocket Yard');
  // An orbit the chosen rocket cannot reach, while another rocket can: fixed at the Rocket Yard, not the orbit
  await toMap(p); await p.click('[data-key="blip-launcher"]'); await waitHead(p, 'LAUNCH VEHICLE');
  await p.click('[data-key="rocket-small"]');
  await toMap(p); await p.click('[data-key="blip-orbit"]'); await waitHead(p, 'ORBIT');
  ok(/Small dedicated launcher cannot reach it/.test(await p.locator('[data-key="orbit-geo"]').innerText()), 'orbit card: the chosen rocket cannot reach geostationary');
  await p.click('[data-key="orbit-geo"]');
  ok(!(await p.locator('.nav-row .btn.primary').isDisabled()), 'GO TO stays enabled (another rocket can reach it)');
  await toMap(p); await p.click('[data-key="blip-review"]'); await waitHead(p, 'READINESS');
  const f2 = await fixTargets(p); console.log('     ' + JSON.stringify(f2));
  ok(f2['ROCKET CANNOT REACH'] === 'launcher', 'cannot reach: FIX goes to the Rocket Yard');
  ok(f2['NOT ENOUGH THRUST'] === 'build', 'not enough thrust: FIX goes to the Workshop (thrusters exist in 2026)');
  await toMap(p); await p.click('[data-key="blip-orbit"]'); await waitHead(p, 'ORBIT'); await p.click('[data-key="orbit-sso"]');
  await toMap(p);
  ok(await p.locator('[data-key="blip-review"].next').count() === 1, 'fixed: the route points to the Launch Pad');
  await p.click('[data-key="blip-review"]'); await waitHead(p, 'READINESS');
  ok(!(await p.locator('.btn.big').isDisabled()), 'launch enabled');
  await p.locator('.btn.big').click(); await waitHead(p, 'MISSION'); await T.fly(p, 'first');
  ok(await T.head(p, 'DEBRIEF').count() === 1, 'debrief');
  const btns = await p.locator('.limit .choices .btn').allInnerTexts();
  console.log('     buttons: ' + btns.join(' | ') + ' | banners: ' + (await p.locator('.banner').allInnerTexts()).join(' | '));
  ok(/REDESIGN/.test(btns[0]) && /NEW MISSION/.test(btns[1]) && /HOME/.test(btns[2]) && btns.length === 3, 'a standalone mission: REDESIGN, NEW MISSION, HOME');
  ok(await p.locator('.walk-result').count() === 0, 'no Part 1 step result');
  ok(/PARTNER|CUSTOMER/.test((await p.locator('.say-name').allInnerTexts()).join(' ')), "Ajay's chapter on the debrief");
  await p.screenshot({ path: path.join(shots, 'modern-debrief.png'), fullPage: true });
  await p.click('.limit .choices .btn >> text=HOME');
  ok(await p.locator('.mode-card').count() === 2, 'HOME returns to the two modes');
  ok(errors.length === 0, 'no errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await b.close();
  done();
})();
