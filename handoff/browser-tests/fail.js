// Fail leg in Part 1, step 1: batteries only (Explorer 1 as flown), LAUNCH ANYWAY, risky choices, a 0-star debrief
// that says NOT YET and offers TRY AGAIN; then the fix (solar cells) passes the step. Also checks sideways scroll at
// in-between widths on Build, the Readiness review and the map.
// Not covered any more: the help button on the Standard tier (Trade Space). Tiers are chosen when a comeback starts,
// so that check needs Part 2 (the next agent can add it once window.showComebackStart exists).
// Usage: node fail.js [shots dir]   or   node fail.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();
const { waitHead } = T;

async function visit(p, place, title) {
  if (!(await T.head(p, 'BASE MAP').count())) { await p.keyboard.press('m'); await waitHead(p, 'BASE MAP'); }
  await p.click(`[data-key="blip-${place}"]`);
  return waitHead(p, title);
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
  console.log('[fail leg]');
  await p.click('[data-key="part1-go"]'); await T.throughBeats(p);
  ok(await visit(p, 'build', 'BUILD'), 'step 1: the Workshop');
  await T.addParts(p, T.BATTERY_ONLY);
  ok(/BATTERY ONLY/.test(await p.locator('.workshop .checks').innerText()), 'Build warns: BATTERY ONLY');
  ok(await visit(p, 'review', 'READINESS'), 'the Launch Pad');
  const btn = p.locator('.btn.big');
  ok(!(await btn.isDisabled()) && /LAUNCH ANYWAY/.test(await btn.innerText()), 'warnings only: LAUNCH ANYWAY');
  await btn.click();
  await waitHead(p, 'MISSION');
  const events = await T.fly(p, 'last');
  ok(await T.head(p, 'DEBRIEF').count() === 1, `reached the debrief (${events} event(s), risky choice)`);
  const s = await T.stars(p);
  const limit = await p.locator('.limit h2').first().innerText();
  console.log('     ' + s + ' stars | ' + limit + ' | ' + (await p.locator('.try').innerText()));
  ok(s === 0, '0 stars');
  ok(!/NOTHING/.test(limit), 'limiting factor named');
  ok(/STEP 1: NOT YET/.test(await p.locator('.walk-result').innerText()), 'banner: STEP 1: NOT YET');
  ok(/TRY AGAIN/.test(await p.locator('[data-key="walk-retry"]').innerText()) && await p.locator('[data-key="walk-next"]').count() === 0, 'TRY AGAIN offered, no NEXT STEP');
  ok(await p.evaluate(() => localStorage.getItem('gravitron-walkthrough-v1')) === null, 'a failed step is not recorded');
  await p.screenshot({ path: path.join(shots, 'fail-debrief.png'), fullPage: true });
  await p.click('[data-key="walk-retry"]');
  ok(await waitHead(p, 'BUILD'), 'TRY AGAIN returns to Build');
  ok(await p.locator('.bin-sub.need').count() === 0, '...with the same design');
  await T.addParts(p, ['silicon-cells']);
  await p.click('.nav-row .btn.primary');
  ok(await waitHead(p, 'READINESS'), 'GO TO goes straight to the Launch Pad (the preset rocket is done)');
  await p.locator('.btn.big').click(); await waitHead(p, 'MISSION'); await T.fly(p, 'last');
  const s2 = await T.stars(p);
  ok(s2 >= 1 && /STEP 1 PASSED/.test(await p.locator('.walk-result').innerText()), `with solar cells step 1 passes (${s2} stars)`);
  // A replay that falls short: the step stays passed and NEXT STEP stays open
  await p.click('[data-key="walk-redesign"]'); await waitHead(p, 'BUILD');
  await p.click('[data-key="bin-power"]'); await p.click('[data-key="part-silicon-cells"]');   // off again: batteries only
  await p.click('.nav-row .btn.primary'); await waitHead(p, 'READINESS');
  await p.locator('.btn.big').click(); await waitHead(p, 'MISSION'); await T.fly(p, 'last');
  ok(await T.stars(p) === 0 && /NOT THIS TIME: STEP 1 STAYS PASSED/.test(await p.locator('.walk-result').innerText()), 'a 0-star replay: NOT THIS TIME, STEP 1 STAYS PASSED');
  ok(await p.locator('[data-key="walk-retry"].primary').count() === 1 && await p.locator('[data-key="walk-next"]').count() === 1, '...TRY AGAIN first, NEXT STEP still offered');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('gravitron-walkthrough-v1')).done['1']) === s2, 'the record keeps the best stars');
  await p.click('[data-key="walk-home"]');
  ok(/CONTINUE: STEP 2/.test(await p.locator('[data-key="part1-go"]').innerText()), 'HOME: CONTINUE: STEP 2');

  console.log('[widths]');
  await p.click('[data-key="part1-go"]'); await p.waitForTimeout(100);
  // Step 2 with a careless build, then every width on three screens
  for (let i = 0; i < 4 && await p.locator('.intro').count(); i++) await p.click('.intro .btn.primary');
  await visit(p, 'orbit', 'ORBIT'); await p.click('[data-key="orbit-leo"]');
  await p.click('.nav-row .btn.primary'); await waitHead(p, 'BUILD');
  await T.addParts(p, ['cosmic-ray-counter', 'mercury-battery', 'tape-recorder']);
  for (const w of [700, 761, 820, 900, 1000, 1100]) {
    await p.setViewportSize({ width: w, height: 800 });
    for (const step of ['build', 'review', 'map']) {
      if (step === 'map') { await p.keyboard.press('m'); await waitHead(p, 'BASE MAP'); }
      else await visit(p, step, step === 'build' ? 'BUILD' : 'READINESS');
      const good = await T.noScroll(p);
      if (!good) {
        const culprits = await p.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 4).map(e => e.tagName + '.' + e.className));
        console.log('     overflow at ' + w + ' on ' + step + ': ' + culprits.join(', '));
      }
      ok(good, `no sideways scroll at ${w}px on ${step}`);
    }
  }
  await p.screenshot({ path: path.join(shots, 'width-1000-review.png') });
  ok(errors.length === 0, 'no errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await b.close();
  done();
})();
