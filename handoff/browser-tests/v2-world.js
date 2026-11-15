// Version 2.0, the long pole and lead time (SPEC.md, "Real-world elements"): the Build bars and the readiness review name the
// slowest part in one short line ("Longest part: <name>, N months. Without it: M months."), from getSchedule only; the
// part preview shows "Lead time: ~N months to arrive". Part 1 (step 3, 1958 parts) and Part 2 (Normal, a solar contract),
// at 1366x768 and 390 wide.
// Usage (from a scratch folder, never the repo): REPO=<worktree> node v2-world.js [shots dir]
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();
const { waitHead } = T;

const SIZES = [['1366x768', { width: 1366, height: 768 }], ['390 wide', { width: 390, height: 844 }]];
const LINE = /^Longest part: .+, \d+ months?\.( Without it: \d+ months?\.)?$/;

// The line the back end's own numbers say, built here only to compare with the page.
function expected(p, ids) {
  return p.evaluate(ids => {
    const d = newDesign('training'); ids.forEach(id => addPart(d, id));
    const s = getSchedule(d); const m = n => n + (n === 1 ? ' month' : ' months');
    return { text: 'Longest part: ' + s.long_pole + ', ' + m(s.long_pole_months) + '.' + (s.next_months > 0 ? ' Without it: ' + m(s.next_months) + '.' : ''), total: s.total_months };
  }, ids);
}
const lineText = p => p.locator('.long-pole').first().innerText().then(t => t.replace(/\s+/g, ' ').trim()).catch(() => '');

async function check(p, label, ids, extra) {
  const want = await expected(p, ids);
  const got = await lineText(p);
  ok(LINE.test(got), `${label}: the line has the right shape: ${got}`);
  ok(got === want.text, `${label}: it matches getSchedule: ${want.text}`);
  ok(await p.locator('.long-pole').count() === 1, `${label}: it is shown once`);
  ok(got.split(/\s+/).length <= 22, `${label}: it is short (${got.split(/\s+/).length} words)`);
  ok(await T.noScroll(p), `${label}: no sideways scroll`);
  return want;
}

(async () => {
  for (const [size, viewport] of SIZES) {
    const phone = viewport.width < 500;
    // ------------------------------------------------------------------ Part 1, step 3
    console.log(`[Part 1, ${size}]`);
    let b = await chromium.launch(); let p = await b.newPage({ viewport });
    let errors = T.watchErrors(p);
    await T.noFonts(p);
    await p.goto(url); await p.evaluate(() => localStorage.clear());
    await p.evaluate(() => localStorage.setItem('gravitron-walkthrough-v1', JSON.stringify({ done: { 1: 1, 2: 1 } })));
    await p.reload();
    await p.click('[data-key="part1-go"]'); await T.throughBeats(p);
    await waitHead(p, 'BASE MAP');
    await p.click('[data-key="blip-briefing"]'); await waitHead(p, 'BRIEFING');
    await p.click('[data-key="obj-radiation"]'); await p.click('.nav-row .btn.primary'); await waitHead(p, 'ORBIT');
    await p.click('[data-key="orbit-leo"]'); await p.click('.nav-row .btn.primary'); ok(await waitHead(p, 'BUILD'), 'Build opens');
    ok(await p.locator('.long-pole').count() === 0, 'no parts yet: no long-pole line');
    const parts = ['explorer-body', 'spin-stabilised', 'cosmic-ray-counter', 'mercury-battery', 'silicon-cells', 'minitrack-beacon', 'command-timer'];
    await T.addParts(p, parts.slice(0, 1));
    const one = await lineText(p);
    ok(/^Longest part: Explorer-style cylinder, 2 months\.$/.test(one), 'one part: no "Without it" (nothing else to take over): ' + one);
    await T.addParts(p, parts.slice(1));
    await p.mouse.move(0, 0);
    const built = await check(p, 'Build', parts);
    ok(/Longest part: Early silicon solar cells, 3 months\. Without it: 2 months\./.test(await lineText(p)), 'the silicon cells set the pace, the next part takes 2');
    if (!phone) {
      await p.click('[data-key="bin-instrument"]');
      await p.locator('[data-key="part-cosmic-ray-counter"]').hover();
      const prev = await p.locator('#preview').innerText().then(t => t.replace(/\s+/g, ' '));
      ok(/Lead time: ~2 months to arrive/.test(prev), 'the preview shows the part\'s lead time: ' + prev.slice(-60));
      ok((prev.match(/Lead time/g) || []).length === 1, 'the lead time is one line');
      await p.mouse.move(0, 0);
    }
    await p.screenshot({ path: path.join(shots, `v2world-p1-${phone ? 'phone' : 'desk'}-build.png`) });
    await p.click('.nav-row .btn.primary'); await waitHead(p, 'LAUNCH VEHICLE');
    await p.click('[data-key="rocket-juno-1"]'); await p.click('.nav-row .btn.primary'); ok(await waitHead(p, 'READINESS'), 'Readiness opens');
    await check(p, 'Readiness', parts);
    const time = await p.locator('.facts').innerText().then(t => t.replace(/\s+/g, ' '));
    ok(new RegExp('Time ' + built.total + ' months to build').test(time), `the Time row still says ${built.total} months (dev_months): ${time.slice(-40)}`);
    await p.mouse.move(0, 0);
    await p.screenshot({ path: path.join(shots, `v2world-p1-${phone ? 'phone' : 'desk'}-review.png`) });
    ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await b.close();

    // ------------------------------------------------------------------ Part 2, Normal, the solar contract
    console.log(`[Part 2, ${size}]`);
    b = await chromium.launch(); p = await b.newPage({ viewport });
    errors = T.watchErrors(p);
    await T.noFonts(p);
    await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
    await T.startComeback(p, 'standard');
    const c = T.CONTRACT.solar;
    await p.click('[data-key="fly-solar"]'); await waitHead(p, 'BASE MAP');
    await p.click('[data-key="blip-orbit"]'); await waitHead(p, 'ORBIT');
    if (await p.locator(`button[data-key="orbit-${c.orbit}"]:not([disabled])`).count()) await p.click(`[data-key="orbit-${c.orbit}"]`);
    await p.click('.nav-row .btn.primary'); ok(await waitHead(p, 'BUILD'), 'Build opens');
    await T.addParts(p, c.parts);
    await p.mouse.move(0, 0);
    await check(p, 'Build', c.parts);
    await p.screenshot({ path: path.join(shots, `v2world-p2-${phone ? 'phone' : 'desk'}-build.png`) });
    await p.click('.nav-row .btn.primary'); await waitHead(p, 'LAUNCH VEHICLE');
    await p.click(`[data-key="rocket-${c.launcher}"]`);
    await p.click('.nav-row .btn.primary'); ok(await waitHead(p, 'READINESS'), 'Readiness opens');
    await check(p, 'Readiness', c.parts);
    await p.mouse.move(0, 0);
    await p.screenshot({ path: path.join(shots, `v2world-p2-${phone ? 'phone' : 'desk'}-review.png`) });
    ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await b.close();
  }
  done();
})();
