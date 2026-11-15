// Part 1 end to end, from file://, on the repo's real data, at desktop and phone width: the home page, step 1
// through the base map and all seven screens, then steps 2 and 3 and the epilogue.
// Usage: node play.js [shots dir]   or   node play.js <repo dir> <shots dir>      (FONTS=1 lets the web fonts load)
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();
const { head, waitHead } = T;

async function run(viewport, label) {
  console.log(`[${label}]`);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = T.watchErrors(page);
  await T.noFonts(page);
  await page.goto(url);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  const shot = n => page.screenshot({ path: path.join(shots, `${label}-${n}.png`), fullPage: true });
  const record = () => page.evaluate(() => JSON.parse(localStorage.getItem('gravitron-walkthrough-v1') || 'null'));

  // ---- the home page: two modes and nothing else
  ok(await page.locator('.big-title').isVisible(), 'title shows');
  ok(await page.locator('.mode-card').count() === 2, 'exactly two mode cards');
  ok(await page.locator('.era, .tier-btn, .campaign-panel').count() === 0, 'no era grid, level buttons or campaign panel');
  const p1 = await page.locator('[data-key="mode-part1"]').innerText();
  ok(/PART 1/.test(p1) && /1958/.test(p1) && /AUSTIN'S FIRST SATELLITE/.test(p1) && /START HERE/.test(p1), 'Part 1 card: 1958, Austin, START HERE');
  ok(await page.locator('[data-key="mode-part1"] .mode-steps li').count() === 3, 'Part 1 lists three steps');
  ok(/^START/.test(await page.locator('[data-key="part1-go"]').innerText()), 'Part 1 button reads START');
  const p2 = await page.locator('[data-key="mode-part2"]').innerText();
  ok(/PART 2/.test(p2) && /AJAY'S COMEBACK/.test(p2) && !/\$|\d+ ?M\b/.test(p2), 'Part 2 card: Ajay, no money figures');
  ok(!(await page.locator('[data-key="part2-go"]').isDisabled()) && /^START/.test(await page.locator('[data-key="part2-go"]').innerText()),
    'Part 2 button is open and says START (no comeback saved)');
  const boxes = await page.evaluate(() => ['mode-part1', 'mode-part2'].map(k => document.querySelector(`[data-key="${k}"]`).getBoundingClientRect()).map(r => ({ x: r.x, y: r.y })));
  const vh = await page.evaluate(() => innerHeight), p2go = await page.locator('[data-key="part2-go"]').boundingBox();
  ok(boxes[1].y > boxes[0].y && p2go && p2go.y + p2go.height <= vh, 'the two modes form a menu, Part 2 below Part 1, both on the first screen');
  ok(await page.locator('#minimap').isHidden(), 'no minimap on the home page');
  ok(await T.noScroll(page), 'home: no sideways scroll');
  console.log('     home words: ' + T.words(await page.locator('#app').innerText()) + ' in the page body, ' + T.words(await page.evaluate(() => document.body.innerText)) + ' with header and footer');
  await shot('0-home');

  // ---- step 1: the story beats, then the base map with the step's presets
  await page.click('[data-key="part1-go"]');
  ok(await page.locator('.intro').waitFor({ timeout: 3000 }).then(() => true, () => false), 'Part 1 opens with story beats');
  ok(/STEP 1/.test(await page.locator('.intro .kicker').innerText()), 'the beats are labelled STEP 1');
  ok(await page.locator('.intro .say').count() === 1, 'one beat at a time');
  await shot('0b-beats');
  const beats1 = await T.throughBeats(page);
  console.log('     beats: ' + beats1.join(' | '));
  ok(beats1.length >= 4 && beats1.length <= 6, `${beats1.length} short beats before step 1 (the intro and step 1's opening: a scene is at most six)`);
  ok(!/wildfire|sea ice|Iron Eclipse/i.test(beats1.join(' ')), 'no wildfires, sea ice or Iron Eclipse in 1958');
  ok(await waitHead(page, 'BASE MAP'), 'START opens the base map');
  ok((await page.locator('#status').innerText()).startsWith('PART 1 · STEP 1 · 1958'), 'header: PART 1 · STEP 1 · 1958');
  ok(await page.locator('.blip').count() === 5, 'five place markers');
  ok(await page.locator('[data-key="blip-briefing"].done').count() === 1 && await page.locator('[data-key="blip-orbit"].done').count() === 1,
    'preset topic and orbit: Mission Control and the Tracking Station are done');
  ok(await page.locator('[data-key="blip-build"].next').count() === 1, 'the Workshop is next');
  ok((await page.locator('#objective').innerText()).includes('Workshop'), 'objective line points to the Workshop');
  ok((await page.locator('.map-route').getAttribute('points')).split(' ').length >= 2, 'gold route drawn');
  await shot('1-map');
  await page.click('[data-key="blip-review"]');
  await page.waitForTimeout(400);
  ok(/locked/i.test(await page.locator('.map-prompt-text').innerText()) && await head(page, 'BASE MAP').count() === 1, 'the Launch Pad is locked before the Workshop');
  await page.keyboard.press('e');
  await page.waitForTimeout(2500);
  ok(/WORKSHOP/.test(await page.locator('.map-prompt-text').innerText()), 'E follows the route to the Workshop');
  await page.keyboard.press('e');

  // ---- 3 Build
  ok(await waitHead(page, 'BUILD'), 'E again goes into the Workshop');
  ok(await page.locator('#minimap').isVisible(), 'minimap shows inside a place');
  ok(await page.locator('.bin-sub.need').count() === 6, 'six bins marked Needed: body, instrument, power, radio, computer, attitude');
  await page.click('[data-key="bin-instrument"]');
  ok(await page.locator('[data-key="part-sar-radar"]').isDisabled() && /Arrives in/.test(await page.locator('[data-key="part-sar-radar"]').innerText()), 'radar greyed out: it arrives later');
  await page.hover('[data-key="part-cosmic-ray-counter"]');
  ok((await page.locator('#preview').innerText()).includes('ADD GEIGER COUNTER PACKAGE'), 'hover preview names the part');
  await T.addParts(page, T.WALK[1].parts);
  ok(await page.locator('.bin-sub.need').count() === 0, 'no bin still Needed');
  ok(await page.locator('.workshop .checks .check.bad').count() === 0, 'no NO GO line on Build');
  console.log('     bars: ' + (await page.locator('.bars').first().innerText()).replace(/\n/g, ' | '));
  console.log('     body: ' + (await page.locator('.body-card').innerText()).replace(/\n/g, ' | '));
  await page.mouse.move(0, 0);
  await shot('3-build');
  await page.keyboard.press('m');
  ok(await waitHead(page, 'BASE MAP'), 'M opens the map from the Workshop');
  ok(await page.locator('[data-key="blip-build"].here').count() === 1, 'player stands at the Workshop');
  ok(await page.locator('.blip.locked').count() === 0, 'after the Workshop no place is locked (the preset Rocket Yard counts as visited)');
  ok(await page.locator('[data-key="blip-review"].next').count() === 1, 'the gold route points to the Launch Pad, not a done place');
  ok(await page.locator('[data-key="blip-launcher"].done').count() === 1, 'the Rocket Yard (preset) is done');
  // The preset Rocket Yard is read-only
  await page.click('[data-key="blip-launcher"]');
  ok(await waitHead(page, 'LAUNCH VEHICLE'), 'the Rocket Yard can still be visited');
  ok(await page.locator('[data-key="rocket-juno-1"].chosen').count() === 1 && await page.locator('[data-key="rocket-vanguard-rocket"]').isDisabled(),
    'preset rocket shown as chosen, the other greyed out');
  ok(await page.locator('.preset-note').isVisible(), '"Set for this step." shown');
  await shot('4-launcher');
  // The preset Mission Control and Tracking Station are read-only too
  await page.keyboard.press('m'); await waitHead(page, 'BASE MAP');
  await page.click('[data-key="blip-briefing"]'); await waitHead(page, 'BRIEFING');
  ok(await page.locator('[data-key="obj-radiation"].chosen').count() === 1 && await page.locator('button.card:not([disabled])').count() === 0 && await page.locator('.preset-note').isVisible(),
    'preset topic: radiation shown as chosen, nothing to click');
  await page.keyboard.press('m'); await waitHead(page, 'BASE MAP');
  await page.click('[data-key="blip-orbit"]'); await waitHead(page, 'ORBIT');
  ok(await page.locator('[data-key="orbit-leo"].chosen').count() === 1 && await page.locator('[data-key="orbit-sso"]').isDisabled() && await page.locator('[data-key="orbit-geo"]').isDisabled(),
    'preset orbit: low orbit shown as chosen, the others greyed out');
  ok(/LAUNCH PAD/.test(await page.locator('.nav-row .btn.primary').innerText()), 'GO TO points to the Launch Pad');
  await page.click('.nav-row .btn.primary');

  // ---- 5 Readiness
  ok(await waitHead(page, 'READINESS'), 'GO TO walks to the Launch Pad');
  const launchBtn = page.locator('.btn.big');
  ok(!(await launchBtn.isDisabled()), 'launch enabled with no blockers');
  ok((await page.locator('.verdict').innerText()).startsWith('GO') || /ALL SYSTEMS GO/.test(await page.locator('.verdict').innerText()), 'verdict: ' + await page.locator('.verdict').innerText());
  await shot('5-review');
  await launchBtn.click();

  // ---- 6 Mission
  ok(await waitHead(page, 'MISSION'), 'mission screen shows');
  ok(await page.locator('#minimap').isHidden(), 'no minimap during the mission');
  await page.keyboard.press('m');
  ok(await head(page, 'MISSION').count() === 1, 'M does nothing during the mission');
  const ev1 = await T.fly(page, 'first');
  ok(ev1 >= 1, `answered ${ev1} event(s)`);

  // ---- 7 Debrief
  ok(await head(page, 'DEBRIEF').count() === 1, 'debrief shows');
  const s1 = await T.stars(page);
  ok(s1 >= 1, `step 1 earns ${s1} star(s)`);
  console.log('     report: ' + (await page.locator('.paper').innerText()).replace(/\n/g, ' | '));
  ok((await page.locator('.try').innerText()).startsWith('TRY THIS'), 'suggestion shown');
  const banners = (await page.locator('.banner').allInnerTexts()).join(' | ');
  ok(/STEP 1 PASSED/.test(banners), 'banner: STEP 1 PASSED');
  ok(!/UNLOCKED|NEW ERA/.test(banners), 'no tier or era banner in Part 1 (' + banners + ')');
  ok(/NEXT STEP/.test(await page.locator('[data-key="walk-next"]').innerText()) && await page.locator('[data-key="walk-redesign"]').count() === 1, 'NEXT STEP and REDESIGN offered');
  ok(/It beeps from orbit/.test(await page.locator('.say').last().innerText()), 'step 1 closing beat shown');
  const rec1 = await record();
  ok(rec1 && rec1.done && rec1.done['1'] === s1, 'record: step 1 saved with its stars ' + JSON.stringify(rec1));
  await shot('7-debrief');
  // REDESIGN keeps the same design, every place open
  await page.click('[data-key="walk-redesign"]');
  ok(await waitHead(page, 'BUILD'), 'REDESIGN returns to Build');
  ok(await page.locator('.bin-sub.need').count() === 0, 'same design loaded');
  await page.keyboard.press('Escape');
  ok(await waitHead(page, 'BASE MAP'), 'Esc opens the map');
  ok(await page.locator('.blip.locked').count() === 0, 'no place locked after a flight');
  ok(await T.noScroll(page), 'map: no sideways scroll');
  await page.click('[data-key="map-home"]');
  ok(/CONTINUE: STEP 2/.test(await page.locator('[data-key="part1-go"]').innerText()), 'home: CONTINUE: STEP 2');
  ok(await page.locator('[data-key="walk-step-1"].passed').count() === 1, 'home: step 1 marked passed with its stars');

  // ---- step 2: rocket preset, the player picks the orbit
  await page.click('[data-key="part1-go"]');
  const beats2 = await T.throughBeats(page);
  console.log('     beats: ' + beats2.join(' | '));
  ok(beats2.length >= 2 && beats2.length <= 4, `${beats2.length} beat(s) before step 2`);
  ok(!/SCORE/.test(await page.locator('#status').innerText()), 'the header no longer shows the last score');
  ok(await waitHead(page, 'BASE MAP'), 'step 2 map');
  ok(await page.locator('[data-key="blip-briefing"].done').count() === 1 && await page.locator('[data-key="blip-orbit"].next').count() === 1,
    'step 2: topic preset, the Tracking Station is next');
  await page.click('[data-key="blip-orbit"]');
  ok(await waitHead(page, 'ORBIT'), 'Tracking Station');
  ok(/Vanguard cannot reach it/.test(await page.locator('[data-key="orbit-sso"]').innerText()), 'the orbit card says the preset rocket cannot reach it');
  await page.click('[data-key="orbit-sso"]');
  ok(/rocket can reach/.test(await page.locator('#objective').innerText()), 'an unreachable orbit: the objective says choose one a rocket can reach');
  await shot('s2-orbit');
  await page.click('[data-key="orbit-leo"]');
  await page.click('.nav-row .btn.primary');
  ok(await waitHead(page, 'BUILD'), 'GO TO walks to the Workshop');
  await T.addParts(page, T.WALK[2].parts);
  await page.keyboard.press('m'); await waitHead(page, 'BASE MAP');
  ok(await page.locator('[data-key="blip-review"].next').count() === 1 && await page.locator('.blip.locked').count() === 0, 'step 2: Launch Pad next, nothing locked');
  await page.click('[data-key="blip-review"]');
  ok(await waitHead(page, 'READINESS'), 'step 2 readiness');
  ok(!(await page.locator('.btn.big').isDisabled()), 'step 2 can launch');
  await page.locator('.btn.big').click();
  await waitHead(page, 'MISSION');
  await T.fly(page, 'last');
  const s2 = await T.stars(page);
  ok(s2 >= 1 && /STEP 2 PASSED/.test((await page.locator('.banner').allInnerTexts()).join(' ')), `step 2 passes with ${s2} star(s) (riskiest event choice)`);

  // ---- step 3: nothing preset
  await page.click('[data-key="walk-next"]');
  const beats3 = await T.throughBeats(page);
  ok(beats3.length >= 2 && beats3.length <= 4, `${beats3.length} beat(s) before step 3`);
  ok(await waitHead(page, 'BASE MAP'), 'step 3 map');
  ok(await page.locator('[data-key="blip-briefing"].next').count() === 1 && await page.locator('.blip.locked').count() === 4, 'step 3: nothing preset, only Mission Control open');
  await page.click('[data-key="blip-briefing"]'); await waitHead(page, 'BRIEFING');
  ok(await page.locator('.preset-note').count() === 0, 'no preset note in step 3');
  ok(await page.locator('button.card:not([disabled])').count() === 1 && /ARRIVES IN 1999/.test(await page.locator('[data-key="obj-wildfire"]').innerText()),
    'one topic exists in 1958; wildfire arrives in 1999');
  await page.click(`[data-key="obj-${T.WALK[3].objective}"]`); await page.click('.nav-row .btn.primary');
  ok(await waitHead(page, 'ORBIT'), 'step 3 orbit');
  ok(/No rocket yet can reach it/.test(await page.locator('[data-key="orbit-geo"]').innerText()), 'geostationary: no 1958 rocket reaches it');
  await page.click(`[data-key="orbit-${T.WALK[3].orbit}"]`); await page.click('.nav-row .btn.primary');
  ok(await waitHead(page, 'BUILD'), 'step 3 build');
  await T.addParts(page, T.WALK[3].parts);
  await page.click('.nav-row .btn.primary');
  ok(await waitHead(page, 'LAUNCH VEHICLE'), 'step 3 rocket yard');
  ok(await page.locator('button.card:not([disabled])').count() === 2, 'two rockets in 1958');
  await page.click(`[data-key="rocket-${T.WALK[3].launcher}"]`); await page.click('.nav-row .btn.primary');
  ok(await waitHead(page, 'READINESS'), 'step 3 readiness');
  await page.locator('.btn.big').click();
  await waitHead(page, 'MISSION');
  await T.fly(page, 'first');
  const s3 = await T.stars(page);
  ok(s3 >= 1 && /STEP 3 PASSED/.test((await page.locator('.banner').allInnerTexts()).join(' ')), `step 3 passes with ${s3} star(s)`);
  ok(/EPILOGUE/.test(await page.locator('[data-key="walk-next"]').innerText()), 'after step 3 the debrief offers the epilogue');
  await shot('s3-debrief');

  // ---- the epilogue, then Part 2 (the difficulty picker), and home
  await page.click('[data-key="walk-next"]');
  const epi = [];
  for (let i = 0; i < 8; i++) {
    epi.push(await page.locator('.intro .say-text p').innerText());
    if (/OPEN THE BOX/.test(await page.locator('.intro .btn.primary').innerText())) break;
    await page.click('.intro .btn.primary');
  }
  console.log('     epilogue: ' + epi.join(' | '));
  ok(epi.length >= 5 && epi.length <= 6, `${epi.length} epilogue beats`);
  ok(/lost on the pad/.test(epi.join(' ')) && /Iron Eclipse/.test(epi.join(' ')) && /grandson Ajay opens it/.test(epi[epi.length - 1]),
    'the epilogue: lost on the pad ... Iron Eclipse ... his grandson Ajay opens it');
  ok(await page.locator('.intro .btn', { hasText: 'HOME' }).count() === 1, 'the last beat also offers HOME');
  ok(!/SCORE/.test(await page.locator('#status').innerText()), 'epilogue header: no stale score');
  await shot('8-epilogue');
  await page.click('.intro .btn.primary');
  ok(await T.waitHead(page, 'PART 1 COMPLETE') && await page.locator('.cb-end.end-box').count() === 1, 'the last epilogue beat opens THE BOX, Part 1\'s ending');
  ok(/ENDINGS 1 \/ 7/.test(await page.locator('.cb-end-bar .story-count').innerText()) &&
     await page.evaluate(() => JSON.parse(localStorage.getItem('gravitron-endings-v1')).join() === 'box'), 'THE BOX is recorded: ENDINGS 1 / 7');
  ok(/CONTINUE TO PART 2/.test(await page.locator('[data-key="end-continue"]').innerText()), 'the box ending offers CONTINUE TO PART 2');
  await shot('8b-box');
  await page.click('[data-key="end-continue"]');
  ok(await page.locator('.cb-level').count() === 3, 'CONTINUE TO PART 2 opens Part 2: the difficulty picker');
  await page.click('[data-key="picker-home"]');
  ok(await page.locator('.mode-card').count() === 2, 'HOME from the picker returns to the home page');
  ok(/PLAY AGAIN/.test(await page.locator('[data-key="part1-go"]').innerText()) && await page.locator('[data-key="mode-part1"] .tag').count() === 0,
    'home: PLAY AGAIN and no START HERE tag');
  ok(await page.locator('.mode-steps li.passed').count() === 3, 'home: all three steps passed');
  console.log('     record: ' + JSON.stringify(await record()));
  await shot('9-home-done');
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await browser.close();
}

(async () => {
  await run({ width: 1280, height: 800 }, 'desktop');
  await run({ width: 390, height: 844 }, 'phone');
  done();
})();
