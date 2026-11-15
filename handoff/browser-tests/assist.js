// The help ladder (SPEC.md, "Difficulty: how much help"): what Easy, Normal and Hard show before a problem happens, and
// what they all show after it. Usage: REPO=<repo> node assist.js <shots dir>   (the shots dir is unused; kept for the other scripts)
const { chromium } = require('playwright');
const path = require('path');
const REPO = process.env.REPO || path.join(__dirname, '..', '..');
const T = require(path.join(__dirname, 'lib.js'));
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

function check(o) {
  const L = o.level, hint = { training: 'Full', standard: 'Less', expert: 'None' }[L];
  ok(o.card.includes('Help ' + hint), L + ': the picker card says "Help: ' + hint + '"');
  ok(o.errors.length === 0, L + ': no page errors');
  if (!o.hover) return;
  ok(o.hover.numbers, L + ': the hover preview always shows the part\'s numbers');
  ok(o.hover.fixes === (L === 'training') && o.hover.causes === (L === 'training'), L + ': Fixes and Causes lines only on Easy');
  if (o.ready && L !== 'training') ok(o.ready.fixLinks === 0, L + ': no FIX links above Easy');
  if (o.ready) ok(o.ready.forecast === (L !== 'expert'), L + ': science forecast on Easy and Normal, not Hard');
  ok(/Pays up to/.test(o.pay || '') === (L === 'expert'), L + ': the pay line is a forecast, or on Hard the contract\'s terms only');
  if (o.events && o.events.length) {
    const risky = o.events.filter(t => /chance of losing/.test(t));
    ok(risky.every(t => L === 'expert' ? /a (small|real|likely) chance/i.test(t) && !/\d+%/.test(t) : /\d+% chance/.test(t)), L + ': risks are numbers, or bands on Hard');
  }
  if (o.debrief) ok(o.debrief.some(t => /TRY THIS/.test(t)) || o.debrief.length === 0, L + ': the debrief still names what limited the flight');
}
(async () => {
  const b = await chromium.launch();
  for (const level of ['training', 'standard', 'expert']) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    await p.goto('file://' + REPO + '/index.html');
    await p.waitForTimeout(700);
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await T.seedRuns(p); await p.click('[data-key="part2-go"]');
    const card = (await p.locator('[data-key="level-' + level + '"]').innerText()).replace(/\n+/g, ' ');
    await p.click('[data-key="level-' + level + '"]');
    await T.pastScenes(p);
    await T.waitHead(p, 'WORKSHOP');
    // Make sure a contract with a proof design is on the table (the seed decides which three open).
    await p.evaluate(() => {
      const c = getCampaign();
      for (let i = 0; i < 40 && !c.offers.some(o => o.topic === 'wildfire' && !o.done); i++) { c.flights = (c.flights || 0) + 1; c.offers = []; makeContracts(c); }
      c.treasury_musd = 30;
      saveCampaign(c);
      window.showComebackHub();
    });
    await p.waitForTimeout(400);
    const keys = await p.$$eval('[data-key^="fly-"]', es => es.map(e => e.dataset.key.slice(4)));
    const topic = keys.find(k => T.CONTRACT[k]);
    const out = { level, card: card.slice(-140), topic };
    if (topic) {
      const c = T.CONTRACT[topic];
      await p.click('[data-key="fly-' + topic + '"]');
      await T.waitHead(p, 'BASE MAP');
      if (c.orbit) {
        await p.click('[data-key="blip-orbit"]');
        await T.waitHead(p, 'ORBIT');
        await p.click('[data-key="orbit-' + c.orbit + '"]');
        await p.click('.nav-row .btn.primary');
      } else await p.click('[data-key="blip-build"]');
      await T.waitHead(p, 'BUILD');
      const inst = c.parts.find(x => T.BIN[x] === 'instrument');
      await p.click('[data-key="bin-instrument"]');
      await p.hover('[data-key="part-' + inst + '"]');
      await p.waitForTimeout(250);
      const prev = await p.locator('#preview, .part-picker').first().innerText().catch(() => '');
      out.hover = { fixes: /Fixes:/.test(prev), causes: /Causes:/.test(prev), numbers: /ADD /.test(prev) };
      await T.addParts(p, c.parts);
      out.pay = (await p.locator('[data-key="contract-pay"]').innerText()).slice(0, 120);
      await p.click('.nav-row .btn.primary');
      await T.waitHead(p, 'LAUNCH VEHICLE');
      await p.click('[data-key="rocket-' + c.launcher + '"]');
      await p.click('.nav-row .btn.primary');
      await T.waitHead(p, 'READINESS');
      const rd = await p.innerText('body');
      out.ready = { forecast: /SCIENCE FORECAST/.test(rd), fixLinks: await p.locator('button.fix').count() };
      if (await p.locator('.btn.big').isDisabled()) {
        out.blocked = rd.split('\n').filter(l => /NO GO|TOO|NEEDS|CASH|BUDGET|HEAVY|ORBIT/i.test(l)).slice(0, 4);
        out.errors = errs;
        console.log(JSON.stringify(out));
        check(out);
        await p.close();
        continue;
      }
      await p.locator('.btn.big').click();
      await T.waitHead(p, 'MISSION');
      await p.click('button[aria-label="Fast forward"]');
      const seen = [];
      for (let i = 0; i < 300; i++) {
        const ch = await p.$$('.dialogue .choices button');
        if (ch.length) {
          for (const x of ch) seen.push((await x.innerText()).replace(/\n+/g, ' ').slice(0, 90));
          await ch[0].click();
          await p.waitForTimeout(250);
          continue;
        }
        if (await p.locator('.screen-head h1', { hasText: 'DEBRIEF' }).count()) break;
        await p.waitForTimeout(120);
      }
      out.events = seen.filter(t => /chance|Protected|Costs|lose|science/i.test(t)).slice(0, 4);
      await p.waitForTimeout(400);
      out.debrief = (await p.innerText('body')).split('\n').filter(l => /LIMITED|TRY THIS/.test(l)).map(l => l.slice(0, 70));
    }
    out.errors = errs;
    console.log(JSON.stringify(out));
    check(out);
    await p.close();
  }
  await b.close();
  console.log(fails ? 'FAILED ' + fails : 'all ok');
  process.exit(fails ? 1 : 0);
})();
