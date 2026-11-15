// NEEDS PART 2 for most of it. The calibration event ("calibration-drift") gets a line from Austin's notebook in
// Ajay's chapter only, and Ajay's chapter is Part 2 (the comeback), which has no screens yet. The next agent:
// start a comeback through window.showComebackStart(), then check Ajay's intro, the notebook line in the event and
// the reply after the choice (the old version of this file did that through the Trade Space tier).
// What runs now: in Part 1 (Austin's chapter) the event can fire on the radiation topic and shows no notebook line.
// Usage: node calib.js [shots dir]   or   node calib.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, count } = T.checker();
const { waitHead } = T;

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
  // only the calibration event can fire
  await p.evaluate(() => { const c = EVENTS.filter(e => e.id === 'calibration-drift'); EVENTS.length = 0; c.forEach(e => EVENTS.push(e)); });
  await p.click('[data-key="part1-go"]'); await T.throughBeats(p); await waitHead(p, 'BASE MAP');
  await p.click('[data-key="blip-build"]'); await waitHead(p, 'BUILD');
  await T.addParts(p, T.WALK[1].parts);
  await p.click('.nav-row .btn.primary'); await waitHead(p, 'READINESS');
  await p.locator('.btn.big').click(); await waitHead(p, 'MISSION');
  await p.click('button[aria-label="Fast forward"]');
  let seen = '';
  for (let i = 0; i < 400 && !seen; i++) {
    if (await p.locator('[role="alertdialog"]').count()) seen = (await p.locator('[role="alertdialog"]').innerText()).replace(/\n/g, ' | ');
    else await p.waitForTimeout(50);
  }
  console.log('     event: ' + seen);
  ok(/CALIBRATION/i.test(seen), 'the calibration event can fire in Part 1');
  ok(!/NOTEBOOK/i.test(seen), "Austin's chapter adds no notebook line to it (that is Ajay's)");
  await p.screenshot({ path: path.join(shots, 'calib-part1-event.png') });
  if (seen) await p.locator('[role="alertdialog"] .choices .btn').first().click();
  ok(errors.length === 0, 'no errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await b.close();
  if (count()) { console.log('FAILED ' + count()); process.exit(1); }
  console.log('PASSED (Part 1 check)');
  T.skipped("Ajay's chapter (intro, notebook line, reply after the choice) needs Part 2: no comeback screens yet");
})();
