// cap1.js: home, Part 1 story, Part 1 build (add-part moment), launch, mission, debrief, a failing flight.
const R = require('./rec.js');
const T = require(R.GAME + '/handoff/browser-tests/lib.js');
const only = process.argv[2];
const want = n => !only || only.split(',').includes(n);
const sleep = (p, ms) => p.waitForTimeout(ms);
const gif = (id, o) => { try { console.log(id, JSON.stringify(R.makeGif(id, o))); R.sheet(id, { n: 9, cols: 3, cell: 520 }); } catch (e) { console.log('gif fail', id, e.message.slice(0, 200)); } };

(async () => {
  // ---- home
  if (want('home')) {
    const s = await R.open({ name: 'home' });
    await R.park(s.page);
    const cap = R.startCapture(s.page, 'home', { fps: 10 });
    await sleep(s.page, 4200);
    await cap.stop();
    await R.still(s.page, 'home', 'poster');
    await s.close();
    gif('home', { width: 820, colors: 48, holdLast: 0.3 });
  }

  // ---- Part 1: story beats typing in
  if (want('p1')) {
    const s = await R.open({ name: 'p1-story', height: 800 });
    const p = s.page;
    await p.click('[data-key="part1-go"]');
    await p.locator('.intro').waitFor({ timeout: 4000 });
    await R.park(p);
    const cap = R.startCapture(p, 'p1-story', { fps: 10, clip: { x: 0, y: 0, width: 1280, height: 560 } });
    await sleep(p, 2800);
    await p.click('.intro .btn.primary'); await sleep(p, 2600);
    await p.click('.intro .btn.primary'); await sleep(p, 2200);
    await cap.stop();
    await R.still(p, 'p1-story', 'poster', { x: 0, y: 0, width: 1280, height: 560 });
    await s.close();
    gif('p1-story', { width: 860, colors: 48, holdLast: 0.4 });
  }

  // ---- Part 1: build, launch, mission, debrief
  if (want('p1')) {
    const s = await R.open({ name: 'p1-build', height: 940 });
    const p = s.page;
    await p.click('[data-key="part1-go"]');
    await p.locator('.intro').waitFor({ timeout: 4000 });
    await T.throughBeats(p);
    await T.waitHead(p, 'BASE MAP');
    await p.click('[data-key="blip-build"]');
    await T.waitHead(p, 'BUILD');
    await sleep(p, 1500);
    await R.park(p);
    const cap = R.startCapture(p, 'p1-build', { fps: 10, clip: { x: 0, y: 0, width: 1280, height: 940 } });
    await sleep(p, 900);
    const order = ['explorer-body', 'cosmic-ray-counter', 'silicon-cells', 'minitrack-beacon', 'command-timer', 'spin-stabilised'];
    for (const part of order) {
      await p.click('[data-key="bin-' + T.BIN[part] + '"]'); await sleep(p, 350);
      await p.click('[data-key="part-' + part + '"]'); await R.park(p);
      await sleep(p, 1000);
    }
    await sleep(p, 900);
    await cap.stop();
    await R.still(p, 'p1-build', 'poster');
    gif('p1-build', { width: 880, colors: 56, holdLast: 0.6 });

    // to the readiness review
    await p.click('.nav-row .btn.primary');
    await T.waitHead(p, 'READINESS');
    await sleep(p, 1200); await R.park(p);
    await R.still(p, 'p1-launch', 'review');
    // LAUNCH: the whole lift-off, then the mission until its first event
    const capL = R.startCapture(p, 'p1-launch', { fps: 10, clip: { x: 0, y: 0, width: 1280, height: 800 } });
    await p.locator('.btn.big').click();
    await T.waitHead(p, 'MISSION');
    const nL = capL.count();
    await capL.stop();
    await R.still(p, 'p1-launch', 'poster');
    gif('p1-launch', { width: 860, colors: 56, speed: 1.6, holdLast: 0.3 });
    // mission: months tick to the first event
    const capM = R.startCapture(p, 'p1-mission', { fps: 10, clip: { x: 0, y: 0, width: 1280, height: 800 } });
    await p.click('button[aria-label="Fast forward"]');
    for (let i = 0; i < 400; i++) {
      if (await p.locator('[role="alertdialog"]').count()) break;
      if (await T.head(p, 'DEBRIEF').count()) break;
      await sleep(p, 50);
    }
    await sleep(p, 1400);
    await capM.stop();
    await R.still(p, 'p1-mission', 'poster');
    gif('p1-mission', { width: 860, colors: 56, holdLast: 0.6 });
    // finish: answer events, debrief
    for (let i = 0; i < 600; i++) {
      if (await T.head(p, 'DEBRIEF').count()) break;
      if (await p.locator('[role="alertdialog"]').count()) await p.locator('[role="alertdialog"] .choices .btn').first().click();
      await sleep(p, 50);
    }
    await sleep(p, 3500); await R.park(p);
    await R.still(p, 'p1-debrief', 'poster');
    await p.evaluate(() => window.scrollTo(0, 0));
    console.log('debrief text:', (await R.text(p)).slice(0, 400));
    console.log('errors', s.errors.length);
    await s.close();
  }

  // ---- Part 1 failing flight: batteries only (Explorer 1 as flown)
  if (want('fail')) {
    const s = await R.open({ name: 'p1-fail', height: 800 });
    const p = s.page;
    await p.click('[data-key="part1-go"]'); await T.throughBeats(p);
    await T.waitHead(p, 'BASE MAP'); await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
    await T.addParts(p, T.BATTERY_ONLY);
    await p.keyboard.press('m'); await T.waitHead(p, 'BASE MAP');
    await p.click('[data-key="blip-review"]'); await T.waitHead(p, 'READINESS');
    await sleep(p, 1000); await R.park(p);
    await R.still(p, 'p1-fail', 'review-hold');
    await p.locator('.btn.big').click(); await T.waitHead(p, 'MISSION');
    await T.fly(p, 'last', true);
    await sleep(p, 3500); await R.park(p);
    await R.still(p, 'p1-fail', 'poster');
    console.log('fail text:', (await R.text(p)).slice(0, 300));
    await s.close();
  }
})().catch(e => { console.error('CAP1 ERROR', e); process.exit(1); });
