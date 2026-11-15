// The debrief as a result moment, in a Part 1 step and a Part 2 contract: a win (a step passed, a contract PAID, or
// 3 stars) shows its stars landing one by one and the real discovery open; nothing animates under reduced motion; a
// flight with no star gets no win moment; under 3 stars, a few words say what the next star needs; at 320 px nothing
// scrolls sideways, while the stars land or after.
// Usage: node debrief.js [shots dir]   or   node debrief.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();
const { head, waitHead } = T;

async function open(viewport, reduce) {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: reduce ? 'reduce' : 'no-preference' })).newPage();
  const errors = T.watchErrors(page);
  await T.noFonts(page);
  await page.goto(url);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  return { browser, page, errors };
}
// Part 1, step 1, built with `parts`, flown to the debrief.
async function walkStep1(page, parts) {
  await page.click('[data-key="part1-go"]');
  await T.throughBeats(page);
  await waitHead(page, 'BASE MAP');
  await page.click('[data-key="blip-build"]'); await waitHead(page, 'BUILD');
  await T.addParts(page, parts);
  await page.keyboard.press('m'); await waitHead(page, 'BASE MAP');
  await page.click('[data-key="blip-review"]'); await waitHead(page, 'READINESS');
  await page.locator('.btn.big').click(); await waitHead(page, 'MISSION');
  await T.fly(page, 'first');
  return waitHead(page, 'DEBRIEF');
}
// Part 2: Normal's opening solar contract, flown with the design that is paid in full (lib.js CONTRACT.solar).
async function contractSolar(page) {
  await T.startComeback(page, 'standard');
  await T.launchContract(page, 'solar');
  await T.fly(page, 'first');
  return waitHead(page, 'DEBRIEF');
}
// What the win moment shows: its stars (filled ones animated, with growing delays), and the discovery's text.
const moment = page => page.evaluate(() => {
  const box = document.querySelector('.win-moment');
  if (!box) return null;
  const stars = [...box.querySelectorAll('.win-stars > span')].map(s => ({ on: s.classList.contains('on'), anim: getComputedStyle(s).animationName, delay: parseFloat(getComputedStyle(s).animationDelay) }));
  const disc = box.querySelector('.win-discovery');
  return { stars, discovery: disc ? disc.innerText : '', folded: !!(disc && disc.closest('details')), visible: !!(disc && disc.getBoundingClientRect().height > 20) };
});
const stampAnims = page => page.locator('.stamp .stamp-star.on').evaluateAll(xs => xs.map(s => getComputedStyle(s).animationName));
// Fewer than 3 stars: one line says what the next star needs, in words with no number; 2 stars short of the science
// target (the report's "N of M points") name the target. 3 stars: no such line.
async function nextStar(page, who) {
  const stars = await T.stars(page);
  const line = await page.locator('[data-key="next-star"]').innerText().catch(() => null);
  if (stars >= 3) return ok(line === null, who + ': 3 stars, no next-star line');
  const sci = (await page.locator('.paper .row').first().innerText()).match(/([\d.]+) of ([\d.]+) points/);
  const short = stars === 2 && sci && +sci[1] < +sci[2];
  console.log('     ' + who + ': ' + stars + ' stars, "' + line + '"');
  ok(line && line.startsWith(['First', 'Second', 'Third'][stars] + ' star: ') && !/\d/.test(line) && line.split(/\s+/).length <= 8,
    who + ': a few words say what the next star needs, with no number');
  if (short) ok(/science target/.test(line), who + ': 2 stars short of the science target: the third star needs the target');
}
// No sideways scroll now, while the stars land, and after they have.
async function noScrollThrough(page) {
  const seen = [];
  for (const wait of [0, 250, 400, 1500]) { await page.waitForTimeout(wait); seen.push(await T.noScroll(page)); }
  return seen.every(Boolean);
}

async function landing(label, viewport) {
  console.log(`[${label}]`);
  // ---- Part 1, step 1 passed
  let { browser, page, errors } = await open(viewport);
  ok(await walkStep1(page, T.WALK[1].parts), 'Part 1: step 1 flown to the debrief');
  ok(await noScrollThrough(page), 'Part 1: no sideways scroll while the stars land or after');
  const s1 = await T.stars(page);
  const m1 = await moment(page);
  ok(/STEP 1 PASSED/.test(await page.locator('.walk-result').innerText()), 'Part 1: the step passed (' + s1 + ' stars)');
  ok(m1 && m1.stars.length === 3 && m1.stars.filter(s => s.on).length === s1, 'Part 1: a win moment with the stars the stamp names');
  const on1 = m1 ? m1.stars.filter(s => s.on) : [];
  ok(on1.length > 0 && on1.every((s, i) => s.anim === 'star-land' && (i === 0 || s.delay > on1[i - 1].delay)), 'Part 1: the earned stars land one by one');
  ok((await stampAnims(page)).every(a => a === 'star-land'), "Part 1: the report's stamp stars land too");
  ok(m1 && m1.visible && !m1.folded && /Van Allen/.test(m1.discovery), 'Part 1: the discovery is shown open (' + (m1 ? m1.discovery.replace(/\s+/g, ' ').slice(0, 60) : '') + '...)');
  ok(await page.locator('details summary', { hasText: 'Closest real mission' }).count() === 0, '...and not repeated folded below');
  ok(await page.locator('.stamp').count() === 1, 'one stamp in the report');
  ok(/next step/i.test(await page.locator('#objective').innerText()), 'Part 1: the objective points on to the next step');
  await nextStar(page, 'Part 1');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shots, `debrief-${label}-step1.png`), fullPage: true });
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await browser.close();

  // ---- Part 2, a contract paid in full
  ({ browser, page, errors } = await open(viewport));
  ok(await contractSolar(page), 'Part 2: the solar contract flown to the debrief');
  ok(await noScrollThrough(page), 'Part 2: no sideways scroll while the stars land or after');
  const s2 = await T.stars(page);
  const m2 = await moment(page);
  ok(/^PAID$/.test(await page.locator('.cb-stamp').innerText()), 'Part 2: the contract is PAID (' + s2 + ' stars)');
  ok(m2 && m2.stars.filter(s => s.on).length === s2, 'Part 2: a win moment with the stars the stamp names');
  ok(m2 && m2.visible && !m2.folded && m2.discovery.length > 40, 'Part 2: the discovery is shown open');
  ok(await page.locator('[data-key="debrief-workshop"]').count() === 1, 'Part 2: BACK TO THE WORKSHOP stays the way on');
  await nextStar(page, 'Part 2');
  await page.screenshot({ path: path.join(shots, `debrief-${label}-paid.png`), fullPage: true });
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await browser.close();
}

async function quiet(label, viewport) {
  console.log(`[${label}: reduced motion, and a flight with no star]`);
  let { browser, page, errors } = await open(viewport, true);
  ok(await walkStep1(page, T.WALK[1].parts), 'step 1 flown to the debrief');
  const m = await moment(page);
  ok(m && m.stars.every(s => s.anim === 'none'), 'reduced motion: the win moment\'s stars do not animate');
  ok((await stampAnims(page)).every(a => a === 'none'), "reduced motion: nor do the stamp's");
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await browser.close();
  // The faithful Explorer 1 (batteries only) earns no star: no win moment, the closest mission stays folded.
  ({ browser, page, errors } = await open(viewport));
  ok(await walkStep1(page, T.BATTERY_ONLY), 'battery-only step 1 flown to the debrief');
  ok(await T.stars(page) === 0 && await page.locator('.win-moment').count() === 0, 'no star: no win moment');
  ok(await page.locator('details summary', { hasText: 'Closest real mission' }).count() === 1, '...and the closest mission is still there, folded');
  await nextStar(page, 'battery only');
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await browser.close();
}

(async () => {
  await landing('desktop', { width: 1280, height: 800 });
  await landing('narrow320', { width: 320, height: 640 });
  await quiet('desktop', { width: 1280, height: 800 });
  done();
})();
