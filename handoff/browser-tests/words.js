// Counts the words a player sees on each screen (visible text only), at 1280x800 and 390x844, along Part 1:
// the home page, step 1 from the first story beat to the debrief, and the epilogue's last beat.
// PART 2 NEEDED for the rest: the old version also counted the campaign hub and the lab; the next agent can add the
// comeback hub here once window.showComebackStart exists.
// Usage: node words.js [shots dir] [out.json]   or   node words.js <repo dir> <shots dir> [out.json]
const { chromium } = require('playwright');
const fs = require('fs');
const T = require('./lib');
const { url } = T.args();
const { ok, done } = T.checker();
const outFile = process.argv.slice(2).find(a => /\.json$/.test(a));

(async () => {
  const out = {};
  for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    const b = await chromium.launch(); const p = await b.newPage({ viewport });
    await T.noFonts(p);
    const count = async name => { out[name] = out[name] || {}; out[name][label] = T.words(await p.evaluate(() => document.body.innerText)); };
    await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
    await count('1 home');
    await p.click('[data-key="part1-go"]'); await count('2 story beat');
    await T.throughBeats(p); await T.waitHead(p, 'BASE MAP'); await p.waitForTimeout(300); await count('3 map');
    await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD'); await p.click('[data-key="bin-instrument"]'); await count('4 build (empty)');
    await T.addParts(p, T.WALK[1].parts); await p.mouse.move(0, 0); await count('5 build (full)');
    await p.keyboard.press('m'); await T.waitHead(p, 'BASE MAP'); await p.click('[data-key="blip-launcher"]'); await T.waitHead(p, 'LAUNCH VEHICLE'); await count('6 rocket (preset)');
    await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'READINESS'); await count('7 review');
    await p.locator('.btn.big').click(); await T.waitHead(p, 'MISSION'); await p.click('button[aria-label="Fast forward"]');
    let did = false;
    for (let i = 0; i < 400; i++) {
      if (await T.head(p, 'DEBRIEF').count()) break;
      if (await p.locator('[role="alertdialog"]').count()) { if (!did) { await count('8 mission (event)'); did = true; } await p.locator('.choices .btn').first().click(); }
      await p.waitForTimeout(50);
    }
    await count('9 debrief');
    await p.evaluate(() => window.StarlineUI.showEpilogue());
    for (let i = 0; i < 6 && !/CONTINUE TO PART 2/.test(await p.locator('.intro .btn.primary').innerText()); i++) await p.click('.intro .btn.primary');
    await count('10 epilogue (last beat)');
    await b.close();
  }
  let td = 0, tp = 0;
  Object.keys(out).forEach(k => { console.log(k.padEnd(24), String(out[k].desktop).padStart(5), String(out[k].phone).padStart(6)); td += out[k].desktop; tp += out[k].phone; });
  console.log('TOTAL'.padEnd(24), String(td).padStart(5), String(tp).padStart(6));
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
  ok(Object.keys(out).length === 10, 'every screen counted');
  done();
})();
