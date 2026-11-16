// QUICK MODE (SPEC.md, "Quick mode"): the third home card, the QUICK MODE menu, one offline quick flight from start to debrief.
//   - the home page has three mode cards (no small online row), the third says QUICK MODE / 1V1 DUEL / ONLINE OFF, the whole
//     card opens the menu, and the page still fits the first screen at 1366x768 and 390 wide, fresh and for a returning player
//   - the menu: QUICK FLIGHT enabled; 1V1 DUEL and LEADERBOARD disabled with the one-line reason on file://, no request leaves the page
//   - QUICK FLIGHT works offline: a seeded job, Build to Debrief, a QUICK SCORE, PLAY AGAIN gives another job, QUICK MENU, HOME
//   - the best score is kept in gravitron-quick-v1 (a worse flight does not lower it) and RESET EVERYTHING clears it
//   - the stars record, the Part 1 record and a comeback in progress are byte for byte what they were
// Usage: node v2-quick.js [shots dir]   or   node v2-quick.js <repo dir> <shots dir>   (run from outside the repo)
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();

const BUS = [['cubesat-12u', 'structure'], ['spin-stabilised', 'attitude'], ['command-timer', 'computer'], ['radio-uhf', 'comms'], ['solar-small', 'power'], ['mercury-battery', 'power']];
const INSTRUMENT = { radiation: 'cosmic-ray-counter', solar: 'solar-xray-photometer', weather: 'vidicon-camera' };
const KEYS = ['smdg-progress-v1', 'gravitron-walkthrough-v1', 'smdg-campaign'];
const PROGRESS = JSON.stringify({ best_stars: { training: 2 }, best_score: { training: 50 }, best_stars_by_era: {} });
const WALK = JSON.stringify({ done: { 1: 3, 2: 3, 3: 3 } });

const stored = p => p.evaluate(keys => keys.map(k => localStorage.getItem(k)), KEYS);
const shape = p => p.evaluate(() => {
  const last = document.querySelector('.mode-card:last-child').getBoundingClientRect(), foot = document.querySelector('.title-foot').getBoundingClientRect();
  return { cards: document.querySelectorAll('.mode-card').length, lastBottom: Math.round(last.bottom), footTop: Math.round(foot.top),
    sh: document.documentElement.scrollHeight, ih: window.innerHeight, sw: document.documentElement.scrollWidth, iw: window.innerWidth };
});
const score = async p => Number((await p.locator('[data-key="quick-score"]').innerText()).replace(/[^\d]/g, ''));

// One quick flight from the intro screen (START) to the debrief: the bus plus the instrument for the topic the seed chose.
async function fly(p) {
  const job = (await p.locator('[data-key="quick-job"]').innerText()).replace(/\s+/g, ' ');
  const topic = await p.evaluate(() => { const t = document.querySelector('[data-key="quick-job"]').innerText; const o = OBJECTIVES.filter(x => t.indexOf(x.name) !== -1)[0]; return o && o.id; });
  ok(!!INSTRUMENT[topic], 'the job is one the data offers: ' + job);
  await p.click('[data-key="quick-start"]');
  ok(await T.waitHead(p, 'BASE MAP'), 'START opens the base map');
  await p.click('[data-key="blip-build"]');
  ok(await T.waitHead(p, 'BUILD'), 'topic and orbit are preset, so the way leads on to Build');
  for (const [part, bin] of BUS.concat([[INSTRUMENT[topic], 'instrument']])) {
    await p.click(`[data-key="bin-${bin}"]`);
    await p.click(`[data-key="part-${part}"]`);
  }
  await p.click('.nav-row .btn.primary'); ok(await T.waitHead(p, 'LAUNCH VEHICLE'), 'the Rocket Yard opens');
  await p.click('[data-key="rocket-small"]');
  await p.click('.nav-row .btn.primary'); ok(await T.waitHead(p, 'READINESS'), 'the Readiness review opens');
  await p.locator('.btn.big').click(); ok(await T.waitHead(p, 'MISSION'), 'the Mission screen opens');
  await T.fly(p, 'first');
  ok(await T.waitHead(p, 'DEBRIEF'), 'the Debrief opens');
  return job;
}

(async () => {
  const b = await chromium.launch();

  // ---------------------------------------------------------------- the home page and the menu, at both sizes
  for (const [label, viewport] of [['1366x768', { width: 1366, height: 768 }], ['390', { width: 390, height: 844 }]]) {
    console.log(`[home and menu, ${label}]`);
    const p = await b.newPage({ viewport, deviceScaleFactor: 1 });
    const errors = T.watchErrors(p);
    await T.noFonts(p);
    const requests = [];
    p.on('request', r => { if (!/^(file:|data:|blob:|about:)|fonts\.(googleapis|gstatic)\.com|services\.swpc\.noaa\.gov|eonet\.gsfc\.nasa\.gov|cwfis\.cfs\.nrcan\.gc\.ca/.test(r.url())) requests.push(r.url()); });
    await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
    await p.waitForSelector('.mode-card'); await p.waitForTimeout(900);
    let s = await shape(p);
    ok(s.cards === 3 && await p.locator('.online-row').count() === 0, 'three mode cards, no small online row');
    ok(await p.locator('.mode-card:nth-child(3)').getAttribute('data-key') === 'mode-quick', 'the third card is the QUICK MODE card');
    const card = (await p.locator('[data-key="mode-quick"]').innerText()).replace(/\s+/g, ' ');
    ok(/QUICK MODE/.test(card) && /1V1 DUEL/.test(card) && /ONLINE OFF/.test(card), 'the card reads QUICK MODE, 1V1 DUEL, ONLINE OFF: "' + card + '"');
    ok(await p.locator('[data-key="mode-quick"] [data-key^="journal"]').count() === 0 && await p.locator('[data-key="mode-quick"] [data-key="endings-count"]').count() === 0, 'it has no JOURNAL button and no endings count');
    ok(await p.locator('[data-key="quick-go"]').isEnabled(), 'its button is always enabled');
    ok(s.lastBottom <= s.footTop && s.sh <= s.ih && s.sw <= s.iw, `a new player's home page fits (last card bottom ${s.lastBottom}, RESET top ${s.footTop}, page ${s.sh}/${s.ih})`);
    // A returning player: Part 1 passed, a comeback saved (the JOURNAL buttons show).
    await p.evaluate(([prog, walk]) => { localStorage.setItem('smdg-progress-v1', prog); localStorage.setItem('gravitron-walkthrough-v1', walk); newComeback('standard', 7); }, [PROGRESS, WALK]);
    await p.reload(); await p.waitForSelector('.mode-card'); await p.waitForTimeout(900);
    s = await shape(p);
    ok(s.cards === 3 && await p.locator('[data-key^="journal"]').count() >= 1, 'a returning player sees the JOURNAL button and three cards');
    ok(s.lastBottom <= s.footTop && s.sh <= s.ih && s.sw <= s.iw, `a returning player's home page fits (last card bottom ${s.lastBottom}, RESET top ${s.footTop}, page ${s.sh}/${s.ih})`);
    await p.screenshot({ path: path.join(shots, `quick-home-returning-${label}.png`) });
    // The whole card is the button: a click on its name opens the menu.
    const hb = await p.locator('[data-key="mode-quick"] h2').boundingBox();
    await p.mouse.click(hb.x + hb.width / 2, hb.y + hb.height / 2);   // the card's own hit area, not the button's centre
    await p.locator('[data-key="quick-menu"]').waitFor({ timeout: 3000 });
    ok(await T.waitHead(p, 'PICK ONE'), 'a click anywhere on the card opens the QUICK MODE menu');
    ok(await p.locator('[data-key="quick-flight"]').isEnabled(), 'QUICK FLIGHT is enabled');
    ok(await p.locator('[data-key="online-duel"]').isDisabled() && await p.locator('[data-key="online-leaderboard"]').isDisabled(), '1V1 DUEL and LEADERBOARD are disabled on a file');
    const reason = (await p.locator('[data-key="online-reason"]').innerText()).trim();
    ok(/ONLINE OFF/.test(reason) && /file/i.test(reason) && T.words(reason) <= 8, 'one short line says why: "' + reason + '"');
    ok(await p.locator('[data-key="quick-best-menu"]').count() === 0, 'no best score yet, none shown');
    ok(await T.noScroll(p), 'the menu has no sideways scroll');
    await p.waitForTimeout(700); await p.screenshot({ path: path.join(shots, `quick-menu-${label}.png`) });
    await p.click('[data-key="online-home"]');
    await p.waitForSelector('[data-key="mode-quick"]');
    ok(true, 'HOME returns to the home page');
    ok(requests.length === 0, 'no request to any server' + (requests.length ? ': ' + requests.join(', ') : ''));
    ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await p.close();
  }

  // ---------------------------------------------------------------- a quick flight, offline, with saves in place
  console.log('[a quick flight, offline, 1366x768]');
  {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
    const errors = T.watchErrors(p);
    await T.noFonts(p);
    p.on('dialog', d => d.accept());
    await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
    await p.evaluate(([prog, walk]) => { localStorage.setItem('smdg-progress-v1', prog); localStorage.setItem('gravitron-walkthrough-v1', walk); newComeback('standard', 7); }, [PROGRESS, WALK]);
    await p.reload(); await p.waitForSelector('[data-key="quick-go"]');
    const before = await stored(p);
    ok(before.every(x => !!x), 'the stars record, the Part 1 record and a comeback are saved before the flight');
    ok(await p.evaluate(() => localStorage.getItem('gravitron-quick-v1')) === null, 'no quick score is saved yet');

    await p.click('[data-key="quick-go"]');
    await p.click('[data-key="quick-flight"]');
    await p.locator('[data-key="quick-job"]').waitFor({ timeout: 3000 });
    ok(await p.locator('[data-key="quick-start"]').count() === 1, 'QUICK FLIGHT shows the job and START');
    await p.screenshot({ path: path.join(shots, 'quick-intro.png') });
    const job1 = await fly(p);
    ok(await p.locator('[data-key="quick-score"]').count() === 1 && /^QUICK SCORE [\d,]+$/.test((await p.locator('[data-key="quick-score"]').innerText()).trim()), 'the debrief shows a QUICK SCORE');
    const s1 = await score(p);
    ok(s1 > 0, 'the quick score is above 0: ' + s1);
    ok(/NEW BEST/.test(await p.locator('[data-key="quick-best"]').innerText()), 'the first flight is a new best');
    ok(await p.evaluate(() => JSON.parse(localStorage.getItem('gravitron-quick-v1')).best) === s1, 'the best is kept in gravitron-quick-v1');
    ok(await p.locator('[data-key="duel-send"]').count() === 0 && await p.locator('[data-key="redesign"]').count() === 0, 'no SEND RESULT and no REDESIGN on a quick flight');
    ok(await p.locator('[data-key="quick-again"]').count() === 1 && await p.locator('[data-key="quick-menu-back"]').count() === 1 && await p.locator('[data-key="quick-home"]').count() === 1, 'PLAY AGAIN, QUICK MENU and HOME are there');
    ok(!/QUICK SCORE.*=|science \/ cost/i.test(await p.locator('body').innerText()), 'the formula is not on screen');
    await p.waitForTimeout(3500);   // the debrief reveals itself first
    const qb = await p.locator('[data-key="quick-best"]').boundingBox();
    ok(qb && qb.y + qb.height <= 768, 'the QUICK SCORE and the best show without scrolling (bottom at ' + (qb && Math.round(qb.y + qb.height)) + ' of 768)');
    await p.screenshot({ path: path.join(shots, 'quick-debrief.png') });
    ok(JSON.stringify(await stored(p)) === JSON.stringify(before), 'the stars record, Part 1 and the comeback are byte for byte the same after the flight');

    // A better score is already on the books: a worse flight does not lower it.
    await p.evaluate(() => localStorage.setItem('gravitron-quick-v1', JSON.stringify({ best: 99999 })));
    await p.click('[data-key="quick-again"]');
    await p.locator('[data-key="quick-job"]').waitFor({ timeout: 3000 });
    const job2 = await fly(p);
    ok(job2 !== job1, 'PLAY AGAIN gives another job: "' + job1 + '" then "' + job2 + '"');
    const s2 = await score(p);
    ok(!/NEW BEST/.test(await p.locator('[data-key="quick-best"]').innerText()) && /99,?999/.test(await p.locator('[data-key="quick-best"]').innerText()), 'a lower score is not a new best, the best stays on screen');
    ok(await p.evaluate(() => JSON.parse(localStorage.getItem('gravitron-quick-v1')).best) === 99999, 'a worse flight leaves the best alone (this flight scored ' + s2 + ')');
    ok(JSON.stringify(await stored(p)) === JSON.stringify(before), 'the saves are still untouched after the second flight');

    await p.click('[data-key="quick-menu-back"]');
    await p.locator('[data-key="quick-menu"]').waitFor({ timeout: 3000 });
    ok(/99,?999/.test(await p.locator('[data-key="quick-best-menu"]').innerText()), 'QUICK MENU shows the best score');
    ok(await p.locator('[data-key="online-duel"]').isDisabled(), 'the online entries are still disabled');
    await p.click('[data-key="online-home"]');
    await p.waitForSelector('[data-key="mode-quick"]');
    ok(JSON.stringify(await stored(p)) === JSON.stringify(before), 'HOME: everything saved is as it was');

    // RESET EVERYTHING also clears the best quick score.
    await p.click('[data-key="reset-progress"]'); await p.click('[data-key="reset-progress"]');   // the first press asks, the second confirms (twoStep: window.confirm is blocked in a sandboxed frame)
    await p.waitForSelector('[data-key="mode-quick"]');
    ok(await p.evaluate(() => localStorage.getItem('gravitron-quick-v1')) === null, 'RESET EVERYTHING clears the best quick score');
    ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await p.close();
  }

  await b.close();
  done();
})();
