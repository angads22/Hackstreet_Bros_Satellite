// cap5.js: more GIFs: a failing flight (realism), the part explainer, Quick mode, the Part 2 debrief result moment, a phone build.
const R = require('./rec.js');
const T = require(R.GAME + '/handoff/browser-tests/lib.js');
const only = process.argv[2];
const want = n => !only || only.split(',').includes(n);
const sleep = (p, ms) => p.waitForTimeout(ms);
const gif = (id, o) => { try { const r = R.makeGif(id, o); console.log(id, r.kb + 'KB', 'lite', r.liteKb + 'KB', r.frames + ' frames'); R.sheet(id, { n: 9, cols: 3, cell: 440 }); } catch (e) { console.log('gif fail', id, e.message.slice(0, 200)); } };
const guard = async (name, fn) => { try { await fn(); } catch (e) { console.log('FAILED', name, String(e).slice(0, 300)); } };

(async () => {
  // ---- a failing flight: batteries only, the satellite goes silent (realism)
  if (want('fail')) await guard('fail', async () => {
    const s = await R.open({ name: 'p1-fail-gif', height: 800 });
    const p = s.page;
    await p.click('[data-key="part1-go"]'); await T.throughBeats(p);
    await T.waitHead(p, 'BASE MAP'); await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
    await T.addParts(p, T.BATTERY_ONLY);
    await p.keyboard.press('m'); await T.waitHead(p, 'BASE MAP');
    await p.click('[data-key="blip-review"]'); await T.waitHead(p, 'READINESS');
    await sleep(p, 600);
    await p.locator('.btn.big').click(); await T.waitHead(p, 'MISSION');
    await R.park(p);
    const cap = R.startCapture(p, 'p1-fail-gif', { fps: 10, clip: { x: 0, y: 0, width: 1280, height: 800 } });
    await p.click('button[aria-label="Fast forward"]');
    for (let i = 0; i < 700; i++) {
      if (await T.head(p, 'DEBRIEF').count()) break;
      if (await p.locator('[role="alertdialog"]').count()) { await sleep(p, 900); await p.locator('[role="alertdialog"] .choices .btn').last().click(); }
      await sleep(p, 60);
    }
    await sleep(p, 3800); await R.park(p);
    const info = await cap.stop();
    await R.still(p, 'p1-fail-gif', 'poster');
    console.log('fail frames', info.frames, info.seconds + 's');
    await s.close();
    gif('p1-fail-gif', { width: 860, colors: 56, speed: 1.3, holdLast: 0.6 });
  });

  // ---- the part explainer
  if (want('explainer')) await guard('explainer', async () => {
    const s = await R.open({ name: 'explainer', height: 800 });
    const p = s.page;
    await p.click('[data-key="part1-go"]'); await T.throughBeats(p);
    await T.waitHead(p, 'BASE MAP'); await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
    await sleep(p, 1200);
    await p.click('[data-key="bin-power"]'); await sleep(p, 500);
    await p.evaluate(() => window.scrollTo(0, 260)); await sleep(p, 500); await R.park(p);
    const cap = R.startCapture(p, 'explainer', { fps: 10, clip: { x: 0, y: 0, width: 1280, height: 800 } });
    await sleep(p, 600);
    await p.hover('[data-key="part-mercury-battery"]'); await sleep(p, 2600);
    await p.hover('[data-key="part-silicon-cells"]'); await sleep(p, 2800);
    await cap.stop();
    await R.still(p, 'explainer', 'poster');
    await s.close();
    gif('explainer', { width: 860, colors: 56, holdLast: 0.4 });
  });

  // ---- Quick mode
  if (want('quick')) await guard('quick', async () => {
    const s = await R.open({ name: 'quick-gif', height: 800 });
    const p = s.page;
    await R.park(p);
    const cap = R.startCapture(p, 'quick-gif', { fps: 10, clip: { x: 0, y: 0, width: 1280, height: 800 } });
    await sleep(p, 1200);
    await p.click('[data-key="quick-go"]'); await R.park(p); await sleep(p, 2200);
    await p.locator('button:has-text("QUICK FLIGHT")').first().click(); await R.park(p);
    await sleep(p, 4200);
    console.log('quick screen:', (await R.text(p)).slice(0, 260));
    await cap.stop();
    await R.still(p, 'quick-gif', 'poster');
    await s.close();
    gif('quick-gif', { width: 860, colors: 56, holdLast: 0.5 });
  });

  // ---- Part 2 debrief: the result moment (stars land, the stamp)
  if (want('debrief')) await guard('debrief', async () => {
    const s = await R.open({ name: 'p2-debrief-gif', height: 940 });
    const q = s.page;
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
    const cap = R.startCapture(q, 'p2-debrief-gif', { fps: 10, clip: { x: 0, y: 0, width: 1280, height: 940 } });
    await q.click('button[aria-label="Fast forward"]');
    for (let i = 0; i < 800; i++) {
      if (await T.head(q, 'DEBRIEF').count()) break;
      if (await q.locator('[role="alertdialog"]').count()) await q.locator('[role="alertdialog"] .choices .btn').first().click();
      await sleep(q, 40);
    }
    const at = cap.count();
    await sleep(q, 5200); await R.park(q);
    const info = await cap.stop();
    await R.still(q, 'p2-debrief-gif', 'poster');
    console.log('debrief reached at frame', at, 'of', info.frames);
    await s.close();
    gif('p2-debrief-gif', { width: 880, colors: 56, from: Math.max(1, at - 3), holdLast: 0.6 });
  });

  // ---- phone build
  if (want('phone')) await guard('phone', async () => {
    const s = await R.open({ name: 'phone-gif', phone: true, scale: 1 });
    const p = s.page;
    await p.tap('[data-key="part1-go"]');
    await p.locator('.intro').waitFor({ timeout: 4000 });
    await T.throughBeats(p);
    await T.waitHead(p, 'BASE MAP');
    await p.tap('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
    await sleep(p, 1200); await R.park(p);
    const cap = R.startCapture(p, 'phone-gif', { fps: 10 });
    await sleep(p, 800);
    for (const part of ['explorer-body', 'cosmic-ray-counter', 'silicon-cells']) {
      await p.tap('[data-key="bin-' + T.BIN[part] + '"]'); await sleep(p, 700);
      await p.tap('[data-key="part-' + part + '"]'); await sleep(p, 600);
      await p.tap('[data-key="part-' + part + '"]'); await sleep(p, 1300);
    }
    await sleep(p, 800);
    await cap.stop();
    await R.still(p, 'phone-gif', 'poster');
    console.log('phone text:', (await R.text(p)).slice(0, 160));
    await s.close();
    gif('phone-gif', { width: 330, colors: 48, holdLast: 0.5, liteWidth: 260 });
  });
})().catch(e => { console.error('CAP5 ERROR', e); process.exit(1); });
