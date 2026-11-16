// cap3.js: re-records the Part 2 borrow clip (credit stays on screen) and the Part 2 mission clip (months tick at normal speed, then the event).
const R = require('./rec.js');
const T = require(R.GAME + '/handoff/browser-tests/lib.js');
const sleep = (p, ms) => p.waitForTimeout(ms);
const gif = (id, o) => { try { console.log(id, JSON.stringify(R.makeGif(id, o))); R.sheet(id, { n: 9, cols: 3, cell: 520 }); } catch (e) { console.log('gif fail', id, e.message.slice(0, 200)); } };
(async () => {
  // ---- borrow: the credit score and the ledger stay in view the whole time
  const s = await R.open({ name: 'p2-borrow', height: 760 });
  const p = s.page;
  await T.startComeback(p, 'standard');
  await sleep(p, 1500); await p.evaluate(() => window.scrollTo(0, 0)); await R.park(p);
  const keys = await R.keys(p, /^borrow-\d/);
  const capB = R.startCapture(p, 'p2-borrow', { fps: 10, clip: { x: 0, y: 0, width: 1280, height: 600 } });
  await sleep(p, 1600);
  await p.click('[data-key="' + keys[1] + '"]');
  for (let i = 0; i < 5; i++) { await sleep(p, 120); await p.evaluate(() => window.scrollTo(0, 0)); await R.park(p); }
  await sleep(p, 2200);
  await p.evaluate(() => { const d = document.querySelector('[data-key="credit-why"]'); if (d) d.open = true; window.scrollTo(0, 0); });
  await sleep(p, 2600);
  await capB.stop();
  await R.still(p, 'p2-borrow', 'poster', { x: 0, y: 0, width: 1280, height: 600 });
  gif('p2-borrow', { width: 880, colors: 56, holdLast: 0.5 });
  await s.close();

  // ---- mission at normal speed
  const s2 = await R.open({ name: 'p2-mission', height: 940 });
  const q = s2.page;
  await T.startComeback(q, 'standard');
  await q.click('[data-key="fly-solar"]'); await T.waitHead(q, 'BASE MAP');
  await q.click('[data-key="blip-orbit"]'); await T.waitHead(q, 'ORBIT');
  if (await q.locator('button[data-key="orbit-leo"]:not([disabled])').count()) await q.click('[data-key="orbit-leo"]');
  await q.click('.nav-row .btn.primary'); await T.waitHead(q, 'BUILD');
  await T.addParts(q, T.CONTRACT.solar.parts);
  await q.click('.nav-row .btn.primary'); await T.waitHead(q, 'LAUNCH VEHICLE');
  await q.click('[data-key="rocket-' + T.CONTRACT.solar.launcher + '"]');
  await q.click('.nav-row .btn.primary'); await T.waitHead(q, 'READINESS');
  await q.locator('.btn.big').click(); await T.waitHead(q, 'MISSION');
  await R.park(q);
  const capM = R.startCapture(q, 'p2-mission', { fps: 10, clip: { x: 0, y: 0, width: 1280, height: 940 } });
  let t0 = Date.now(), ev = false;
  for (let i = 0; i < 400; i++) {
    if (await q.locator('[role="alertdialog"]').count()) { ev = true; break; }
    if (await T.head(q, 'DEBRIEF').count()) break;
    if (Date.now() - t0 > 7000 && i % 20 === 0) { const ff = q.locator('button[aria-label="Fast forward"]'); if (await ff.count()) await ff.click().catch(() => {}); }
    await sleep(q, 100);
  }
  await sleep(q, 1800);
  await capM.stop();
  await R.still(q, 'p2-mission', 'poster');
  console.log('event reached', ev, 'seconds', ((Date.now() - t0) / 1000).toFixed(1));
  gif('p2-mission', { width: 900, colors: 56, holdLast: 0.6 });
  await s2.close();
})().catch(e => { console.error('CAP3 ERROR', e); process.exit(1); });
