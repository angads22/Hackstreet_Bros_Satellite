// The calibration event ("calibration-drift") in both chapters. Part 1 (Austin): it can fire on the radiation topic and
// shows no notebook line. Part 2 (Ajay's comeback, started from the home page): Ajay's intro, then on a contract flight
// the event carries a line from Austin's notebook, and the log has the notebook's reply after the choice.
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

  // ---- Part 2: Ajay's chapter, at desktop and phone width
  for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    console.log(`[Ajay's chapter, ${label}]`);
    const b2 = await chromium.launch(); const q = await b2.newPage({ viewport });
    const errs = T.watchErrors(q);
    await T.noFonts(q);
    await q.goto(url); await q.evaluate(() => localStorage.clear()); await q.reload();
    await q.evaluate(() => { const c = EVENTS.filter(e => e.id === 'calibration-drift'); EVENTS.length = 0; c.forEach(e => EVENTS.push(e)); });
    const beats = await T.startComeback(q, 'standard');
    console.log('     intro: ' + beats.join(' | ').slice(0, 200));
    ok(beats.length >= 1 && beats.length <= 6 && /Ajay|Albert Orbital/.test(beats.join(' ')), `Ajay's intro (${beats.length} beats)`);
    ok(await waitHead(q, 'WORKSHOP'), 'the workshop after the intro');
    await T.launchContract(q, 'solar');
    await q.click('button[aria-label="Fast forward"]');
    let event = '';
    for (let i = 0; i < 400 && !event; i++) {
      if (await q.locator('[role="alertdialog"]').count()) event = (await q.locator('[role="alertdialog"]').innerText()).replace(/\n/g, ' | ');
      else await q.waitForTimeout(50);
    }
    console.log('     event: ' + event);
    ok(/CALIBRATION/i.test(event), 'the calibration event fires on a contract flight');
    ok(/Austin's notebook:/i.test(event), "the event carries a line from Austin's notebook");
    await q.screenshot({ path: path.join(shots, `calib-ajay-${label}-event.png`) });
    if (event) await q.locator('[role="alertdialog"] .choices .btn').first().click();
    await q.waitForTimeout(200);
    const log = (await q.locator('.log').innerText()).replace(/\n/g, ' | ');
    console.log('     log: ' + log.slice(0, 240));
    ok(/Austin's notebook: .*month lost/i.test(log), "after the choice, the notebook's reply is in the log");
    ok(errs.length === 0, 'no errors' + (errs.length ? ': ' + errs.join(' / ') : ''));
    await b2.close();
  }
  if (count()) { console.log('FAILED ' + count()); process.exit(1); }
  console.log('PASSED');
})();
