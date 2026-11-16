// cap2.js: Part 2 on Normal: picker, workshop, borrow and credit, build with paid facts, rockets, review, mission, debrief.
const R = require('./rec.js');
const T = require(R.GAME + '/handoff/browser-tests/lib.js');
const sleep = (p, ms) => p.waitForTimeout(ms);
const gif = (id, o) => { try { console.log(id, JSON.stringify(R.makeGif(id, o))); R.sheet(id, { n: 9, cols: 3, cell: 520 }); } catch (e) { console.log('gif fail', id, e.message.slice(0, 200)); } };
(async () => {
  const s = await R.open({ name: 'p2-picker', height: 900 });
  const p = s.page;
  await T.noFonts && 0;
  await T.seedRuns(p);
  await p.click('[data-key="part2-go"]');
  await sleep(p, 1500); await R.park(p);
  await R.still(p, 'p2-picker', 'poster');
  console.log('picker keys:', (await R.keys(p, /level|home/)).join(' '));
  await p.click('[data-key="level-standard"]');
  await T.throughBeats(p);
  await T.waitHead(p, 'WORKSHOP');
  await sleep(p, 1800); await R.park(p);
  await R.still(p, 'p2-workshop', 'poster');
  console.log('workshop keys:', (await R.keys(p, /borrow|credit|fly|journal|ledger/)).join(' '));
  // contracts view
  await p.evaluate(() => { const e = document.querySelector('[data-key="fly-solar"]'); if (e) e.scrollIntoView({ block: 'center' }); });
  await sleep(p, 700); await R.park(p);
  await R.still(p, 'p2-workshop', 'contracts');
  await p.evaluate(() => window.scrollTo(0, 0)); await sleep(p, 400);

  // borrow + credit
  const bkeys = await R.keys(p, /^borrow-\d/);
  console.log('borrow buttons:', bkeys.join(' '));
  await p.evaluate(() => { const e = document.querySelector('[data-key="stat-credit"]'); if (e) window.scrollTo(0, Math.max(0, e.getBoundingClientRect().top + window.scrollY - 180)); });
  await sleep(p, 500); await R.park(p);
  const capB = R.startCapture(p, 'p2-borrow', { fps: 10, clip: { x: 0, y: 0, width: 1280, height: 900 } });
  await sleep(p, 1200);
  if (bkeys[0]) { await p.click('[data-key="' + bkeys[bkeys.length > 1 ? 1 : 0] + '"]'); await R.park(p); }
  await sleep(p, 2200);
  await p.evaluate(() => { const d = document.querySelector('[data-key="credit-why"]'); if (d) d.open = true; });
  await sleep(p, 2600);
  await capB.stop();
  await R.still(p, 'p2-borrow', 'poster');
  gif('p2-borrow', { width: 860, colors: 56, holdLast: 0.5 });
  console.log('borrow text:', (await R.text(p)).slice(0, 500));

  // journal
  if (await p.locator('[data-key="journal"], [data-key="open-journal"], button:has-text("JOURNAL")').count()) {
    await p.locator('[data-key="journal"], [data-key="open-journal"], button:has-text("JOURNAL")').first().click();
    await sleep(p, 1500); await R.park(p);
    await R.still(p, 'p2-journal', 'poster');
    await p.keyboard.press('Escape'); await sleep(p, 500);
  }
  await s.close();

  // ---- build, rockets, review, mission, debrief on a fresh Normal run
  const s2 = await R.open({ name: 'p2-build', height: 940 });
  const q = s2.page;
  await T.startComeback(q, 'standard');
  await q.click('[data-key="fly-solar"]'); await T.waitHead(q, 'BASE MAP');
  await q.click('[data-key="blip-orbit"]'); await T.waitHead(q, 'ORBIT');
  if (await q.locator('button[data-key="orbit-leo"]:not([disabled])').count()) await q.click('[data-key="orbit-leo"]');
  await q.click('.nav-row .btn.primary');
  await T.waitHead(q, 'BUILD');
  await sleep(q, 1200); await R.park(q);
  const parts = T.CONTRACT.solar.parts;
  const capK = R.startCapture(q, 'p2-build', { fps: 10, clip: { x: 0, y: 0, width: 1280, height: 940 } });
  await sleep(q, 700);
  // ASK THE ENGINEERS for the first instrument, then fit the parts
  await q.click('[data-key="bin-structure"]'); await sleep(q, 300);
  await T.openLater(q, parts[0]);
  await q.hover('[data-key="part-' + parts[0] + '"]'); await sleep(q, 900);
  const ask = q.locator('[data-key^="ask-"]');
  console.log('ask buttons:', await ask.count());
  if (await ask.count()) { await ask.first().click(); await sleep(q, 1300); }
  for (const part of parts) {
    await q.click('[data-key="bin-' + T.BIN[part] + '"]'); await sleep(q, 300);
    await T.openLater(q, part);
    await q.click('[data-key="part-' + part + '"]'); await R.park(q); await sleep(q, 850);
  }
  await sleep(q, 1200);
  await capK.stop();
  await R.still(q, 'p2-build', 'poster');
  gif('p2-build', { width: 900, colors: 56, holdLast: 0.6 });
  console.log('build text:', (await R.text(q)).match(/Longest part[^.]*\.[^.]*\./) || 'no long-pole line');

  await q.click('.nav-row .btn.primary'); await T.waitHead(q, 'LAUNCH VEHICLE');
  await sleep(q, 1200); await R.park(q);
  await R.still(q, 'p2-rockets', 'poster');
  await q.click('[data-key="rocket-' + T.CONTRACT.solar.launcher + '"]');
  await q.click('.nav-row .btn.primary'); await T.waitHead(q, 'READINESS');
  await sleep(q, 1500); await R.park(q);
  await R.still(q, 'p2-review', 'poster');
  await q.locator('.btn.big').click();
  await T.waitHead(q, 'MISSION');
  await sleep(q, 800); await R.park(q);
  const capM = R.startCapture(q, 'p2-mission', { fps: 10, clip: { x: 0, y: 0, width: 1280, height: 940 } });
  await q.click('button[aria-label="Fast forward"]');
  let gotEvent = false;
  for (let i = 0; i < 400; i++) {
    if (await q.locator('[role="alertdialog"]').count()) { gotEvent = true; break; }
    if (await T.head(q, 'DEBRIEF').count()) break;
    await sleep(q, 50);
  }
  await sleep(q, 1500);
  await capM.stop();
  await R.still(q, 'p2-mission', 'poster');
  console.log('p2 event reached:', gotEvent);
  gif('p2-mission', { width: 900, colors: 56, holdLast: 0.6 });
  for (let i = 0; i < 700; i++) {
    if (await T.head(q, 'DEBRIEF').count()) break;
    if (await q.locator('[role="alertdialog"]').count()) await q.locator('[role="alertdialog"] .choices .btn').first().click();
    await sleep(q, 50);
  }
  await sleep(q, 3500); await R.park(q);
  await R.still(q, 'p2-debrief', 'poster');
  await q.evaluate(() => { const d = document.querySelector('[data-key="debrief-details"]'); if (d) d.open = true; });
  await sleep(q, 700);
  await q.evaluate(() => { const d = document.querySelector('[data-key="debrief-details"]'); if (d) window.scrollTo(0, Math.max(0, d.getBoundingClientRect().top + window.scrollY - 140)); });
  await sleep(q, 600); await R.park(q);
  await R.still(q, 'p2-debrief', 'details');
  console.log('debrief text:', (await R.text(q)).slice(0, 420));
  console.log('errors', s.errors.length, s2.errors.length);
  await s2.close();
})().catch(e => { console.error('CAP2 ERROR', e); process.exit(1); });
