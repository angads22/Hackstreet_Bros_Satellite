// Counts the words a player sees on each screen (visible text only), at 1280x800 and 390x844.
const { chromium } = require('playwright');
const REPO = process.env.REPO || '/home/user/Hackstreet_Bros_Satellite';
const ALL = { best_stars: {}, best_score: {}, best_stars_by_era: { igy: 3, nimbus: 3, eos: 3 } };
const words = t => (t.match(/\S+/g) || []).length;
(async () => {
  const out = {};
  for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    const b = await chromium.launch(); const p = await b.newPage({ viewport });
    await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    p.on('dialog', d => d.accept());
    const wait = t => p.locator('.screen-head h1', { hasText: t }).waitFor({ timeout: 8000 }).then(() => true, () => false);
    // visible text only: words the browser actually renders (innerText skips hidden and collapsed content)
    const count = async name => { out[name] = out[name] || {}; out[name][label] = words(await p.evaluate(() => document.body.innerText)); };
    await p.goto('file://' + REPO + '/index.html'); await p.evaluate(a => localStorage.setItem('smdg-progress-v1', JSON.stringify(a)), ALL); await p.reload();
    await count('1 title');
    await p.click('[data-key="start-new-space-training"]'); await p.locator('.intro').waitFor({timeout:3000}).then(()=>p.click('text=SKIP'),()=>{}); /*SKIPINTRO*/ await wait('BASE MAP'); await p.waitForTimeout(300); await count('2 map');
    await p.click('[data-key="blip-briefing"]'); await wait('BRIEFING'); await count('3 briefing');
    await p.click('[data-key="obj-sea-ice"]'); await p.click('.nav-row .btn.primary'); await wait('ORBIT'); await count('4 orbit');
    await p.click('[data-key="orbit-sso"]'); await p.click('.nav-row .btn.primary'); await wait('BUILD');
    const add = async (bin, part) => { await p.click(`[data-key="bin-${bin}"]`); await p.click(`[data-key="part-${part}"]`); };
    await p.click('[data-key="bin-instrument"]'); await count('5 build (empty)');
    for (const [bin, part] of [['structure','smallsat-bus'],['attitude','reaction-wheels'],['instrument','sar-radar'],['power','solar-large'],['comms','radio-xband'],['computer','obc-basic'],['power','battery-28v'],['propulsion','prop-green-large']]) await add(bin, part);
    await p.mouse.move(0, 0); await count('6 build (full)');
    await p.click('.nav-row .btn.primary'); await wait('LAUNCH VEHICLE'); await count('7 rocket');
    await p.click('[data-key="rocket-small"]'); await p.click('.nav-row .btn.primary'); await wait('READINESS'); await count('8 review');
    await p.locator('.btn.big').click(); await wait('MISSION'); await p.click('button[aria-label="Fast forward"]');
    let did = false;
    for (let i = 0; i < 400; i++) {
      if (await p.locator('.screen-head h1', { hasText: 'DEBRIEF' }).count()) break;
      if (await p.locator('[role="alertdialog"]').count()) { if (!did) { await count('9 mission (event)'); did = true; } await p.locator('.choices .btn').first().click(); }
      await p.waitForTimeout(50);
    }
    await count('10 debrief');
    await p.click('text=CHANGE TIER'); await p.click('[data-key="campaign-training"]'); await wait('CAMPAIGN HUB'); await count('11 campaign hub');
    await p.click('text=OPEN THE LAB'); await wait('THE LAB'); await count('12 lab');
    await b.close();
  }
  let td = 0, tp = 0;
  Object.keys(out).forEach(k => { console.log(k.padEnd(20), String(out[k].desktop).padStart(5), String(out[k].phone).padStart(6)); td += out[k].desktop; tp += out[k].phone; });
  console.log('TOTAL'.padEnd(20), String(td).padStart(5), String(tp).padStart(6));
  require('fs').writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(out, null, 1));
})();
