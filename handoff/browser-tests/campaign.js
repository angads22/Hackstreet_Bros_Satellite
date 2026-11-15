// The campaign in the browser: hub, lab (research and upgrades), one mission, payouts, science, save codes.
const { chromium } = require('playwright'); const path = require('path');
const REPO = process.env.REPO || '/home/user/Hackstreet_Bros_Satellite'; const shots = process.argv[2];
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

// A save with eight flown missions, made in Node with the real back end, imported through the page's IMPORT box.
function makeSave() {
  const G = require(REPO + '/tests/load')();
  G.newCampaign('training');
  for (let i = 0; i < 8; i++) {
    const d = G.newCampaignDesign(); G.setObjective(d, 'radiation'); G.setOrbit(d, 'leo');
    ['explorer-body', 'spin-stabilised', 'cosmic-ray-counter', 'mercury-battery', 'minitrack-beacon', 'command-timer'].forEach(p => G.addPart(d, p));
    G.setLauncher(d, 'juno-1'); const m = G.startMission(d); let s, n = 0;
    do { s = G.stepMonth(m); if (s.event) G.chooseEvent(m, 0); n++; } while (!s.ended && n < 300);
    G.recordResult(m);
  }
  return G.exportSave();
}

(async () => {
  const code8 = makeSave();
  for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    console.log(`[campaign ${label}]`);
    const b = await chromium.launch(); const p = await b.newPage({ viewport });
    const errors = []; p.on('pageerror', e => errors.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|services\.swpc\.noaa\.gov|eonet\.gsfc\.nasa\.gov|cwfis\.cfs\.nrcan\.gc\.ca/.test((m.location() || {}).url || '')) errors.push(m.text()); });
    if (!process.env.FONTS) await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    p.on('dialog', d => d.accept());
    const wait = t => p.locator('.screen-head h1', { hasText: t }).waitFor({ timeout: 8000 }).then(() => true, () => false);
    const shot = n => p.screenshot({ path: path.join(shots, `campaign-${label}-${n}.png`), fullPage: true });
    const noScroll = () => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    const txt = sel => p.locator(sel).innerText();
    await p.goto('file://' + REPO + '/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
    ok(await p.locator('.campaign-panel').count() === 1, 'title has a campaign panel');
    ok(await p.locator('.campaign-panel .btn.primary').count() === 0, 'no Continue button without a save');
    await p.click('[data-key="campaign-training"]');
    ok(await wait('CAMPAIGN HUB'), 'new campaign opens the hub');
    ok(await txt('#hub-year') === '1957' && await txt('#hub-treasury') === '$90M' && await txt('#hub-science') === '0', 'year 1957, $90M, 0 science');
    ok(await p.locator('#hub-archive').count() === 0, 'no archive line before any mission');
    ok(await p.locator('[data-key^="topic-"]').count() === 6 && await p.locator('[data-key^="topic-"].locked').count() === 5, 'six topics, five locked');
    ok((await txt('[data-key="topic-sea-ice"]')).includes('Needs Imaging radar'), 'locked topic gives its reason');
    ok(/0 research and 0 upgrades can be bought now/.test(await txt('#lab-summary')), 'the hub says nothing can be bought yet');
    ok(await p.locator('#objective').isHidden() && await p.locator('#minimap').isHidden(), 'no objective line or minimap on the hub');
    ok(await noScroll(), 'hub: no sideways page scroll');
    await shot('0-hub');

    // ---- the lab, research tab
    await p.click('text=OPEN THE LAB'); ok(await wait('THE LAB'), 'the lab opens');
    ok(await p.locator('.tree-node').count() === 17 && await p.locator('.tree-line').count() === 20, '17 research boxes joined by 20 lines');
    ok(await p.locator('[data-key="tab-research"][aria-pressed="true"]').count() === 1, 'research tab is open');
    await p.click('[data-key="node-solar-cells"]');
    const d0 = await txt('#research-detail');
    ok(/SILICON SOLAR CELLS/.test(d0) && /\$2M · 4 science/.test(d0), 'the box shows its cost in both currencies');
    ok(/Needs 4 science points \(you have 0\)/.test(d0), 'it says how much science is missing');
    ok(await p.locator('#research-detail .btn').isDisabled(), 'Buy is disabled until it can be bought');
    await shot('1-lab');
    await p.click('[data-key="tab-upgrades"]');
    ok(await p.locator('[data-key="node-scintillation-counter"]').count() === 1 && await p.locator('.tree-node').count() >= 8, 'the upgrades tab draws parts and their successors');
    await p.click('[data-key="node-scintillation-counter"]');
    const u0 = await txt('#upgrade-detail'); console.log('     ' + u0.replace(/\n/g, ' | ').slice(0, 260));
    ok(/Replaces Geiger counter package/.test(u0) && /Science 4 to 6/.test(u0), 'an upgrade says what it replaces and what changes');
    ok(await p.locator('#upgrade-detail .gains li.good').count() >= 1 && await p.locator('#upgrade-detail .gains li.bad').count() >= 1, 'better and worse lines are coloured');
    ok(await p.locator('#upgrade-detail .btn').isDisabled(), 'Upgrade is disabled until it can be bought');
    await shot('2-upgrades');
    await p.click('text=BACK TO THE HUB'); await wait('CAMPAIGN HUB');

    // ---- one mission in the browser
    await p.click('text=START A MISSION'); ok(await wait('BRIEFING'), 'Start a mission opens the Briefing');
    ok(await p.locator('button.card').count() === 1, 'only the available topic is listed');
    ok((await txt('[data-key="obj-radiation"]')).includes('Pays'), 'the topic shows its expected payout');
    ok((await txt('#status')).startsWith('CAMPAIGN') && (await txt('#status')).includes('SCIENCE'), 'header says CAMPAIGN with the science balance');
    await p.click('[data-key="obj-radiation"]'); await p.click('.nav-row .btn.primary'); await wait('ORBIT');
    await p.click('[data-key="orbit-leo"]'); await p.click('.nav-row .btn.primary'); await wait('BUILD');
    const add = async (bin, part) => { await p.click(`[data-key="bin-${bin}"]`); await p.click(`[data-key="part-${part}"]`); };
    await p.click('[data-key="bin-power"]');
    ok((await txt('[data-key="part-silicon-cells"]')).includes('Needs research'), 'a part locked by research says which research');
    await add('structure', 'explorer-body'); await add('attitude', 'spin-stabilised'); await add('instrument', 'cosmic-ray-counter');
    await add('power', 'mercury-battery'); await add('comms', 'minitrack-beacon'); await add('computer', 'command-timer');
    const pay = await p.locator('.payout-line').first().innerText(); console.log('     ' + pay);
    ok(/Expected payout \$[\d.]+M, cost \$[\d.]+M, net -?\$[\d.]+M/.test(pay), 'payout line on Build');
    await p.mouse.move(0, 0); await shot('3-build');
    await p.click('.nav-row .btn.primary'); await wait('LAUNCH VEHICLE');
    await p.click('[data-key="rocket-juno-1"]'); await p.click('.nav-row .btn.primary'); ok(await wait('READINESS'), 'readiness review');
    ok((await txt('.btn.big')).includes('LAUNCH ANYWAY'), 'battery-only is a warning: LAUNCH ANYWAY');
    await p.locator('.btn.big').click(); await wait('MISSION'); await p.click('button[aria-label="Fast forward"]');
    for (let i = 0; i < 400; i++) { if (await p.locator('.screen-head h1', { hasText: 'DEBRIEF' }).count()) break;
      if (await p.locator('[role="alertdialog"]').count()) await p.locator('.choices .btn').first().click(); await p.waitForTimeout(50); }
    ok(await p.locator('.screen-head h1', { hasText: 'DEBRIEF' }).count() === 1, 'debrief shows');
    const box = (await txt('.payout-box')).replace(/\n/g, ' | '); console.log('     ' + box.slice(0, 380));
    ok(/PAYOUT \$/.test(box) && /KNOWLEDGE OF THIS TOPIC/.test(box) && /Treasury now \$/.test(box), 'payout, knowledge and treasury on the debrief');
    ok(/Science points: \+8/.test(box), 'the debrief shows the science points earned');
    ok(await p.locator('text=NEW MISSION').count() === 0 && await p.locator('text=REBUILD THIS SATELLITE').count() === 1, 'campaign buttons replace the standalone ones');
    await shot('7-debrief');
    await p.click('text=REBUILD THIS SATELLITE'); ok(await wait('BUILD'), 'Rebuild opens Build');
    ok(await p.locator('.bin-sub', { hasText: /on board|slots/ }).count() >= 5, 'the same satellite is loaded');
    await p.keyboard.press('m'); await wait('BASE MAP');
    await p.click('text=BACK TO THE HUB'); ok(await wait('CAMPAIGN HUB'), 'the map has a way back to the hub');
    ok(await txt('#hub-missions') === '1' && await txt('#hub-year') === '1958', 'one mission flown, year 1958');
    ok(await txt('#hub-science') === '8.8', 'science 8.8 after one flight');
    ok(/Archive: \+0\.8 science a year/.test(await txt('#hub-archive')), 'the archive line appears');
    await p.click('text=OPEN THE LAB'); await p.click('[data-key="tab-research"]'); await p.click('[data-key="node-solar-cells"]');
    ok(!(await p.locator('#research-detail .btn').isDisabled()), 'one flight (8.8 science) now pays for solar cells (4)');
    await p.click('text=BACK TO THE HUB');

    // ---- a save with eight missions: buy research and an upgrade
    await p.fill('#import-box', code8); await p.click('text=IMPORT');
    ok(await p.locator('#import-error').count() === 0, 'the Node-made save imports');
    ok(await txt('#hub-year') === '1965' && await txt('#hub-missions') === '8' && await txt('#hub-science') === '92.8', 'hub: 1965, 8 missions, 92.8 science');
    const sum = await txt('#lab-summary'); console.log('     ' + sum);
    ok(/[1-9]\d* research and [1-9]\d* upgrades? can be bought now/.test(sum), 'the hub counts what can be bought');
    const treasury0 = await txt('#hub-treasury');
    await p.click('text=OPEN THE LAB'); await p.click('[data-key="tab-research"]'); await p.click('[data-key="node-solar-cells"]');
    ok(!(await p.locator('#research-detail .btn').isDisabled()), 'Buy is enabled');
    await p.locator('#research-detail .btn').click();
    ok(await p.locator('[data-key="node-solar-cells"].owned').count() === 1, 'bought: the box is owned');
    ok(await txt('#hub-science') === '88.8', 'buying research spent 4 science');
    ok(await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-key')) === 'node-solar-cells', 'focus stays on the box after buying');
    await p.click('[data-key="tab-upgrades"]'); await p.click('[data-key="node-scintillation-counter"]');
    ok(!(await p.locator('#upgrade-detail .btn').isDisabled()), 'the upgrade can be bought');
    await p.locator('#upgrade-detail .btn').click();
    ok(await p.locator('[data-key="node-scintillation-counter"].owned').count() === 1, 'upgrade bought: its box is owned');
    ok(await p.locator('[data-key="node-cosmic-ray-counter"].locked').count() === 1 && /replaced/.test(await txt('[data-key="node-cosmic-ray-counter"]')), 'the old part reads "replaced"');
    ok(await txt('#hub-science') === '48.8', 'the upgrade spent 40 science');
    ok(await txt('#hub-treasury') !== treasury0, 'both currencies are spent');
    await shot('8-lab');
    await p.click('text=BACK TO THE HUB'); await p.click('text=START A MISSION'); await wait('BRIEFING');
    await p.click('[data-key="obj-radiation"]'); await p.click('.nav-row .btn.primary'); await wait('ORBIT'); await p.click('[data-key="orbit-leo"]'); await p.click('.nav-row .btn.primary'); await wait('BUILD');
    await p.click('[data-key="bin-instrument"]');
    ok(await p.locator('[data-key="part-cosmic-ray-counter"]').isDisabled() && (await txt('[data-key="part-cosmic-ray-counter"]')).includes('Replaced by'), 'Build: the old part is greyed out "Replaced by ..."');
    ok(!(await p.locator('[data-key="part-scintillation-counter"]').isDisabled()), 'Build: the successor can be picked');
    await p.keyboard.press('m'); await wait('BASE MAP'); await p.click('text=BACK TO THE HUB'); await wait('CAMPAIGN HUB');

    // ---- save codes
    await p.click('text=EXPORT'); const code = await p.locator('#export-box').inputValue();
    ok(code.length > 50, 'export gives a save code (' + code.length + ' characters)');
    await p.fill('#import-box', 'nope'); await p.click('text=IMPORT');
    ok((await txt('#import-error')).includes('not a save code'), 'a bad code shows the error and changes nothing');
    ok(await txt('#hub-missions') === '8', '...the campaign is untouched');
    await p.fill('#import-box', code); await p.click('text=IMPORT');
    ok(await p.locator('#import-error').count() === 0 && await txt('#hub-science') === '48.8', 'a good code imports');
    ok(await noScroll(), 'hub after play: no sideways page scroll');
    await p.reload();
    ok(await p.locator('.campaign-panel .btn.primary').count() === 1, 'after a reload the title offers Continue');
    await p.click('.campaign-panel .btn.primary'); ok(await wait('CAMPAIGN HUB'), 'Continue opens the hub');
    await p.click('text=OPEN THE LAB'); ok(await noScroll(), 'lab: no sideways page scroll');
    await p.click('text=BACK TO THE HUB'); await p.click('text=TITLE'); await p.click('[data-key="start-igy-training"]'); await p.locator('.intro').waitFor({timeout:3000}).then(()=>p.click('text=SKIP'),()=>{}); /*SKIPINTRO*/
    ok(await wait('BASE MAP'), 'a standalone mission still starts');
    ok(!(await txt('#status')).startsWith('CAMPAIGN'), '...and is not a campaign mission');
    ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await b.close();
  }
  console.log(fails ? 'FAILED ' + fails : 'PASSED'); process.exit(fails ? 1 : 0);
})();
