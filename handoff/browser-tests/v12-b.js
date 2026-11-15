// v1.2 builder B: the Build screen (verdict slot, progress count, ranked problems, card limit, laptop fold, preview first line).
// Usage: REPO=<repo> node v12-b.js <shots dir>   (run from outside the repo)
// Each size and mode is a fresh page: Part 1 step 1 (full help) and Part 2 on Normal and on Hard (a fixed seed).
const { chromium } = require('playwright');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();

const SIZES = [[1366, 768], [1280, 800], [390, 844]];
// the seeded Part 2 contract each mode flies (lib.js SEEDS: Normal and Hard open on seed 20)
const TOPIC = { normal: 'solar', hard: 'wildfire', easy: 'ionosphere' };
const text = (p, sel) => p.locator(sel).first().innerText().then(t => t.replace(/\s+/g, ' ').trim());

async function open(b, w, h, mode) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
  if (mode === 'p1') {
    await p.click('[data-key="part1-go"]'); await T.throughBeats(p); await T.waitHead(p, 'BASE MAP');
    await p.click('[data-key="blip-build"]');
  } else {
    await T.startComeback(p, mode === 'hard' ? 'expert' : mode === 'easy' ? 'training' : 'standard');
    const key = TOPIC[mode];
    await p.click(`[data-key="fly-${key}"]`); await T.waitHead(p, 'BASE MAP');
    await p.click('[data-key="blip-orbit"]'); await T.waitHead(p, 'ORBIT');
    const orbit = T.CONTRACT[key].orbit;
    if (await p.locator(`button[data-key="orbit-${orbit}"]:not([disabled])`).count()) await p.click(`[data-key="orbit-${orbit}"]`);
    await p.click('.nav-row .btn.primary');
  }
  await T.waitHead(p, 'BUILD');
  await p.waitForTimeout(400);
  return { p, ctx, errors };
}

(async () => {
  const b = await chromium.launch();
  for (const [w, h] of SIZES) {
    for (const mode of ['p1', 'normal', 'hard']) {
      const tag = `${mode} ${w}x${h}`;
      console.log(`[${tag}]`);
      const { p, ctx, errors } = await open(b, w, h, mode);
      const slot = p.locator('[data-key="verdict-slot"].vstrip-slot');
      ok(await slot.count() === 1, 'the verdict slot is in the bench column');
      ok(await slot.evaluate(n => n.childNodes.length === 0 && getComputedStyle(n).display === 'none'), 'the empty slot takes no room');
      ok(await p.evaluate(() => typeof window.StarlineUI.verdictSlot === 'function' && window.StarlineUI.verdictSlot() !== null), 'StarlineUI.verdictSlot() finds it');

      // progress count: required bins only
      ok(await text(p, '[data-key="progress-count"]') === '0 of 6 needed', 'count starts at "0 of 6 needed": ' + await text(p, '[data-key="progress-count"]'));
      ok(await p.locator('.bin-sub.need').count() === 6, 'six bins carry .bin-sub.need');
      // problems, ranked: blockers first and big, then warnings; every row has an icon and a word, not colour alone
      await p.screenshot({ path: `${shots}/v12b-${mode}-${w}x${h}-start.png` });
      const rank = await p.evaluate(() => {
        const rows = [...document.querySelectorAll('.workshop .checks > li.check')];
        const kinds = rows.map(r => r.classList.contains('bad') ? 'bad' : 'warn');
        const size = k => { const r = rows.find(x => x.classList.contains(k)); return r ? parseFloat(getComputedStyle(r).fontSize) : null; };
        return { kinds, bigBad: size('bad'), smallWarn: size('warn'), icons: rows.every(r => r.querySelector('svg.icon')),
          words: rows.every(r => /NO GO|WARN|ADD|FIX/.test(r.innerText)), oneLine: rows.every(r => r.getBoundingClientRect().height < 80), heights: rows.map(r => Math.round(r.getBoundingClientRect().height)).join(),
          heads: [...document.querySelectorAll('.workshop .stack .panel > h2')].map(n => n.innerText) };
      });
      ok(rank.kinds.length > 0 && rank.kinds.join().indexOf('warn,bad') === -1, 'blockers before warnings: ' + rank.kinds.join(' '));
      ok(rank.icons && rank.words, 'every problem has an icon and a word (NO GO, WARN, ADD or FIX)');
      ok(rank.oneLine, 'one line each (under 80px tall): ' + rank.heights);
      ok(rank.bigBad >= 21 && (rank.smallWarn === null || rank.smallWarn < rank.bigBad), 'blockers are bigger than warnings: ' + rank.bigBad + ' / ' + rank.smallWarn);
      ok(rank.heads[0] === 'PROBLEMS' && /MISSION OVERVIEW/.test(rank.heads.join()), 'PROBLEMS lead the right column: ' + rank.heads.join(' > '));
      const addN = await p.locator('button.add-part').count();
      const fixN = await p.locator('.workshop button.fix').count();
      if (mode === 'p1') {
        ok(addN > 0, 'Easy, Part 1: blockers for empty bins offer ADD (' + addN + ')');
        const bin = (await p.locator('button.add-part').first().getAttribute('data-key')).replace('add-', '');
        await p.locator('button.add-part').first().click();
        ok(await p.locator(`[data-key="bin-${bin}"][aria-pressed="true"]`).count() === 1, 'ADD opens that bin: ' + bin);
      } else ok(addN === 0 && fixN === 0, 'Normal and Hard: no ADD or FIX words before the problem (' + addN + ', ' + fixN + ')');
      const parts = mode === 'p1' ? T.WALK[1].parts : T.CONTRACT[TOPIC[mode]].parts;
      await T.addParts(p, parts.slice(0, 2));
      ok(/^\d of 6 needed$/.test(await text(p, '[data-key="progress-count"]')), 'count moves with parts: ' + await text(p, '[data-key="progress-count"]'));
      const propulsionNeed = await p.locator('[data-key="bin-propulsion"] .bin-sub.need').count();
      ok(propulsionNeed === 0, 'the optional propulsion bin is never counted or marked Needed');
      await T.addParts(p, parts.slice(2));
      ok(await text(p, '[data-key="progress-count"]') === '6 of 6 needed' && await p.locator('.bin-sub.need').count() === 0, 'all six: "6 of 6 needed", no bin marked');
      const none = await p.locator('[data-key="no-problems"]').count();
      ok(none ? await text(p, '[data-key="no-problems"]') === 'No problems' : await p.locator('.workshop .checks .check.bad').count() === 0, 'a full design says "No problems" or has no blocker, only warnings: ' + await text(p, '.workshop .stack .panel'));
      ok(await T.noScroll(p), 'no sideways scroll');
      ok(errors.length === 0, 'no page errors ' + errors.join('|'));
      await p.screenshot({ path: `${shots}/v12b-${mode}-${w}x${h}.png` });
      await ctx.close();
    }
  }
  await b.close();
  done();
})();
