// Motion (js/motion.js and the MOTION block at the end of css/style.css): the game feels alive, and stays honest.
//  - every story line (.say) reads exactly the same with the animation as without it (compared with a reduced-motion
//    run of the same screens), and is whole in the DOM at once;
//  - with reduced motion nothing runs (document.getAnimations() is empty) and all text is shown at once;
//  - a redraw (a click on Build) plays no entry or story-line animation, a screen change does;
//  - an animation never lasts long (a screen entry is under 1.5 s in all), none of ours is infinite, and frames stay cheap;
//  - Part 1's typewriter (body[data-era="1958"]) is checked by setting the attribute here, since another branch sets it.
// Usage: node motion.js [shots dir]   or   node motion.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();

const SPEC = { era: 'igy', objective: 'radiation', orbit: 'leo', launcher: 'juno-1', parts: T.WALK[1].parts };
const screenOf = spec => p => p.evaluate(spec => {
  const d = newDesign('training'); setEra(d, spec.era);
  if (spec.objective) setObjective(d, spec.objective);
  if (spec.orbit) setOrbit(d, spec.orbit);
  (spec.parts || []).forEach(id => addPart(d, id));
  if (spec.launcher) setLauncher(d, spec.launcher);
  window.__d = d;
}, spec);

async function open(b, opts, extra) {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 800 } }, opts || {}));
  const p = await ctx.newPage();
  const errors = T.watchErrors(p, extra && extra.noLowPoly ? /lowpoly\.js/ : null);
  await T.noFonts(p);
  if (extra && extra.noLowPoly) await p.route(/\/js\/lowpoly\.js/, r => r.abort());
  // Every CSS animation that starts, by name (a transition is not one: it fires transitionrun).
  await p.addInitScript(() => { window.__gm = []; document.addEventListener('animationstart', e => window.__gm.push(e.animationName), true); });
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
  return { ctx, p, errors };
}

// What is running now: finite animations with the time they take in all (delay + duration), infinite ones by name.
const running = p => p.evaluate(() => {
  const finite = [], infinite = [];
  document.getAnimations().forEach(a => {
    const t = a.effect.getComputedTiming(), name = a.animationName || ('transition:' + a.transitionProperty);
    if (t.endTime === Infinity) infinite.push(name); else finite.push({ name, end: t.endTime });
  });
  return { finite, infinite, max: finite.reduce((m, x) => Math.max(m, x.end), 0), count: document.getAnimations().length };
});
const says = p => p.evaluate(() => [...document.querySelectorAll('.say')].map(n => n.innerText));
const sayInfo = p => p.evaluate(() => [...document.querySelectorAll('.say p')].map(n => ({
  words: n.querySelectorAll('.gm-w').length, text: n.textContent, inner: n.innerText, ok: n.textContent === n.innerText.replace(/\n/g, ' ') })));
const settle = (p, ms) => p.waitForTimeout(ms || 1500);

let flown = 0;   // the events the flight asked about
// The screens, in the order they are reached. Each returns once the screen is up.
const STEPS = [
  ['home', async p => { await p.reload(); await p.waitForSelector('.mode-card'); }],
  ['intro', async p => { await p.evaluate(() => StarlineUI.startWalkStep(1)); }],
  ['map', async p => { await screenOf(SPEC)(p); await p.evaluate(() => window.showDesignScreen('map', window.__d)); }],
  ['build', async p => { await p.evaluate(() => window.showDesignScreen('build', window.__d)); }],
  ['review', async p => { await p.evaluate(() => window.showDesignScreen('review', window.__d)); }],
  ['mission', async p => { await p.evaluate(() => window.showMissionScreen(window.__d)); }],
  ['debrief', async p => { flown = await T.fly(p, 'first'); }],
  ['hub', async p => { await p.evaluate(() => { newComeback('standard'); window.showComebackStart(); }); }]
];

// Walks every screen. Per screen: the story lines right at once, the animations running just after it appeared, and
// whether they have all ended 1.6 s later. With reduced motion the same walk must show no animation at all.
async function walk(p, reducedMotion) {
  const out = {};
  for (const [name, go] of STEPS) {
    await go(p);
    if (name === 'debrief') await p.waitForTimeout(40);
    const first = { says: await says(p), info: await sayInfo(p), run: await running(p) };
    await settle(p, 1600);
    const later = await running(p);
    const tr = await p.evaluate(() => [...document.querySelectorAll('.gm-w, .gm-star, .gm-rise, .gm-up, .gm-fade, .gm-drop, .gm-letter, .gm-slam')]
      .filter(n => getComputedStyle(n).opacity !== '1').length);
    out[name] = { first, later, notWhole: tr };
    if (!reducedMotion) await p.screenshot({ path: path.join(shots, 'motion-' + name + '.png') });
  }
  return out;
}

// CPU cost per frame while a screen enters: the main thread's task time over 1.3 s, divided by the frames drawn.
async function frameCost(p, act) {
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Performance.enable');
  const task = async () => (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'TaskDuration').value;
  await p.evaluate(() => { window.__frames = 0; (function f() { window.__frames++; requestAnimationFrame(f); })(); });
  const t0 = await task(), f0 = await p.evaluate(() => window.__frames);
  await act();
  await p.waitForTimeout(1300);
  const t1 = await task(), f1 = await p.evaluate(() => window.__frames);
  await cdp.detach();
  return (t1 - t0) * 1000 / Math.max(1, f1 - f0);
}

(async () => {
  const b = await chromium.launch();

  console.log('[reduced motion: the reference walk]');
  const R = await open(b, { reducedMotion: 'reduce' });
  const red = await walk(R.p, true);
  for (const [name] of STEPS) {
    ok(red[name].later.count === 0 && red[name].first.run.count === 0, name + ': no animation runs (' + red[name].first.run.count + ' at once, ' + red[name].later.count + ' later)');
    ok(red[name].notWhole === 0 && red[name].first.info.every(i => i.words === 0 && i.ok), name + ': all text shown at once, no word spans');
  }
  ok(R.errors.length === 0, 'reduced motion: no console or page errors' + (R.errors.length ? ': ' + R.errors.join(' / ') : ''));
  await R.ctx.close();

  console.log('[animated walk]');
  const A = await open(b, {});
  const p = A.p;
  // The home page is the first screen of the page load: look at it again as an entry.
  const anim = await walk(p, false);
  let worst = 0;
  for (const [name] of STEPS) {
    const a = anim[name], r = red[name];
    ok(JSON.stringify(a.first.says) === JSON.stringify(r.first.says), name + ': every .say reads the same as without animation (' + a.first.says.length + ' lines)');
    ok(a.first.info.every(i => i.ok && i.text === i.inner.replace(/\n/g, ' ')), name + ': the line is whole at once (words cut into ' + a.first.info.map(i => i.words).join(',') + ' spans, text unchanged)');
    ok(a.later.finite.length === 0 || a.later.max < 1500, name + ': everything has ended 1.6 s later (' + a.later.finite.map(x => x.name).join(',') + ')');
    ok(a.first.run.max < 1500, name + ': the entry takes ' + Math.round(a.first.run.max) + ' ms in all (under 1.5 s), ' + a.first.run.finite.length + ' animations');
    ok(a.first.run.infinite.filter(n => /^gm-/.test(n)).length === 0, name + ': none of ours loops forever');
    worst = Math.max(worst, a.first.run.max);
  }
  ok(anim.home.first.run.finite.some(x => x.name === 'gm-letter'), 'home: the logotype letters rise in');
  ok(anim.home.first.run.finite.some(x => x.name === 'gm-drop'), 'home: the menu drops in');
  ok(anim.intro.first.info.some(i => i.words > 3), 'intro: the story line is cut into word spans (' + anim.intro.first.info.map(i => i.words).join(',') + ')');
  ok(anim.intro.first.run.finite.some(x => x.name === 'gm-word'), 'intro: the words slide up (Part 2 style, no era set)');
  ok(anim.build.first.run.finite.some(x => x.name === 'gm-fade' || x.name === 'gm-up'), 'build: the screen enters');
  ok(anim.mission.first.run.finite.some(x => x.name === 'gm-up' || x.name === 'gm-fade'), 'mission: the screen enters');
  ok(anim.debrief.first.run.finite.some(x => x.name === 'gm-star') && anim.debrief.first.run.finite.some(x => x.name === 'gm-rise'), 'debrief: the stars land and the rows come in order');
  ok(anim.hub.first.run.finite.some(x => x.name === 'gm-up'), 'Part 2 hub: the screen enters');
  const seenNames = await p.evaluate(() => window.__gm.slice());
  ok(seenNames.indexOf('gm-log') !== -1 && seenNames.indexOf('gm-flip') !== -1, 'mission: log lines slide in and the month flips (' + seenNames.filter(n => n === 'gm-log').length + ' log lines, ' + seenNames.filter(n => n === 'gm-flip').length + ' flips)');
  ok(flown === 0 || seenNames.indexOf('gm-drop') !== -1, 'mission: the event card drops in (' + flown + ' events asked)');
  console.log('     longest entry: ' + Math.round(worst) + ' ms');

  console.log('[a redraw replays nothing, a screen change does]');
  await p.evaluate(() => window.showDesignScreen('build', window.__d)); await settle(p, 1600);
  await p.evaluate(() => { window.__gm.length = 0; });
  await p.click('[data-key="bin-instrument"]'); await p.click('[data-key="part-scintillation-counter"]'); await p.waitForTimeout(600);
  const redraw = await p.evaluate(() => window.__gm.slice());
  const replay = redraw.filter(n => /^gm-(word|type|cursor|up|fade|drop|letter|rise|star|slam)$/.test(n));
  ok(replay.length === 0, 'clicking a part on Build plays no story-line or entry animation (' + (replay.join(',') || 'none') + ')');
  ok(redraw.indexOf('gm-flash') !== -1, 'a changed number flashes (' + redraw.filter(n => n === 'gm-flash').length + ' flashes after adding a part)');
  const wordsAfter = await p.evaluate(() => document.querySelectorAll('.gm-w').length);
  ok(wordsAfter === 0, 'the redrawn story line is plain text (no word spans)');
  await p.evaluate(() => { window.__gm.length = 0; });
  await p.click('[data-key="bin-instrument"]'); await p.waitForTimeout(600);   // same bin again: nothing changes
  const same = await p.evaluate(() => window.__gm.slice());
  ok(same.length === 0, 'a redraw that changes nothing starts no animation at all (' + (same.join(',') || 'none') + ')');
  // A bar grows from its old width: a part that adds mass moves the MASS bar from where it was.
  await p.evaluate(() => { window.__w = null; });
  const before = await p.evaluate(() => { const b = [...document.querySelectorAll('.bar')].find(x => /MASS/.test(x.innerText)); return b.querySelector('.bar-fill').style.width; });
  await p.evaluate(() => { new MutationObserver(() => {}); });
  await p.click('[data-key="part-silicon-cells"]').catch(() => {});
  await p.click('[data-key="bin-power"]'); await p.click('[data-key="part-silicon-cells"]'); await p.waitForTimeout(80);
  const growing = await p.evaluate(() => [...document.querySelectorAll('.bar-fill.gm-grow')].length);
  ok(growing >= 1, 'a bar that changed grows from its old width (' + growing + ' bars marked, MASS was ' + before + ')');
  await settle(p, 600);
  await p.evaluate(() => { window.__gm.length = 0; });
  await p.click('.nav-row .btn');   // MAP [M]: a screen change
  await T.waitHead(p, 'BASE MAP'); await p.waitForTimeout(450);
  const change = await p.evaluate(() => window.__gm.slice());
  ok(change.some(n => /^gm-(up|fade)$/.test(n)) && change.indexOf('gm-word') !== -1, 'a screen change plays the entry and the story line (' + [...new Set(change)].join(',') + ')');

  console.log('[Part 2: paying back flashes the numbers that changed, and plays no entry]');
  await p.evaluate(() => { newComeback('standard'); window.showComebackStart(); }); await settle(p, 1500);
  const payKey = await p.evaluate(() => { const b = document.querySelector('[data-key="pay-panel"] .btn'); return b ? b.innerText : null; });
  ok(!!payKey, 'the workshop offers a PAY BACK amount (' + payKey + ')');
  if (payKey) {
    const debt0 = await p.locator('#cb-debt').innerText();
    await p.evaluate(() => { window.__gm.length = 0; });
    await p.locator('[data-key="pay-panel"] .btn').first().click(); await p.waitForTimeout(600);
    const paid = await p.evaluate(() => window.__gm.slice());
    ok(await p.locator('#cb-debt').innerText() !== debt0, 'the debt changed (' + debt0 + ' to ' + await p.locator('#cb-debt').innerText() + ')');
    ok(paid.filter(n => n === 'gm-flash').length >= 2, 'the debt and the cash flash once each (' + paid.filter(n => n === 'gm-flash').length + ' flashes)');
    ok(!paid.some(n => /^gm-(up|fade|drop|word|rise)$/.test(n)), 'the redrawn workshop plays no entry (' + [...new Set(paid)].join(',') + ')');
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('.cb-meter-debt')).transitionDuration) !== '0s', 'the debt meter moves from its old width');
  }

  console.log('[story beats: each beat types again, the rest of the screen does not]');
  await p.evaluate(() => StarlineUI.startWalkStep(1)); await settle(p, 1500);
  await p.evaluate(() => { window.__gm.length = 0; });
  await p.click('.intro .btn.primary'); await p.waitForTimeout(150);
  const beat = await p.evaluate(() => window.__gm.slice());
  ok(beat.indexOf('gm-word') !== -1, 'the next beat reveals its words');
  ok(!beat.some(n => /^gm-(up|fade|drop)$/.test(n)), 'and the kicker and the buttons stay put (' + [...new Set(beat)].join(',') + ')');
  const beats = await p.evaluate(() => document.querySelector('.intro .say-text p').innerText);
  ok(beats.length > 10 && T.words(beats) > 3, 'the beat is whole text at once: "' + beats.slice(0, 40) + '..."');

  console.log('[Part 1: the typewriter and its block cursor]');
  await p.evaluate(() => { document.body.dataset.era = '1958'; StarlineUI.startWalkStep(2); }); await p.waitForTimeout(60);
  const tw = await p.evaluate(() => { const w = document.querySelector('.say p .gm-w'), pe = document.querySelector('.say p'), lw = pe.querySelector('.gm-w:last-child'), cs = getComputedStyle(lw, '::after');
    return { name: getComputedStyle(w).animationName, disp: getComputedStyle(w).display, cursor: cs.animationName, cdur: cs.animationDuration, count: cs.animationIterationCount,
      room: cs.position, text: pe.innerText === pe.textContent }; });
  ok(tw.name === 'gm-type' && tw.disp === 'inline', 'words appear one after another, no sliding (' + tw.name + ', ' + tw.disp + ')');
  ok(tw.cursor === 'gm-cursor' && tw.count === '2' && tw.room === 'absolute', 'a block cursor blinks twice after the last word and takes no room (' + tw.cursor + ', ' + tw.cdur + ' x ' + tw.count + ', ' + tw.room + ')');
  const twr = await running(p);
  ok(twr.max < 1500 && twr.infinite.filter(n => /^gm-/.test(n)).length === 0, 'typewriter and cursor end within ' + Math.round(twr.max) + ' ms');
  await p.evaluate(() => { delete document.body.dataset.era; });

  ok(A.errors.length === 0, 'no console or page errors' + (A.errors.length ? ': ' + A.errors.join(' / ') : ''));
  const wide = await T.noScroll(p);
  ok(wide, 'no sideways scroll');
  await A.ctx.close();

  console.log('[frame cost on a desktop, js/lowpoly.js blocked: main-thread ms per frame over a screen entry]');
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const C = await open(b, { reducedMotion }, { noLowPoly: true });
    const q = C.p;
    const costs = {};
    costs.home = await frameCost(q, () => q.evaluate(() => window.showDesignScreen('title')));
    await screenOf(SPEC)(q);
    costs.build = await frameCost(q, () => q.evaluate(() => window.showDesignScreen('build', window.__d)));
    costs.redraw = await frameCost(q, async () => { await q.click('[data-key="bin-instrument"]'); await q.click('[data-key="part-scintillation-counter"]'); });
    await screenOf(SPEC)(q);
    costs.debrief = await frameCost(q, async () => { await q.evaluate(() => window.showMissionScreen(window.__d)); await T.fly(q, 'first'); });
    const line = Object.keys(costs).map(k => k + ' ' + costs[k].toFixed(2)).join(', ');
    console.log('     ' + reducedMotion + ': ' + line + ' ms/frame');
    if (reducedMotion === 'no-preference') ok(Object.keys(costs).every(k => costs[k] < 8), 'frame cost stays under 8 ms per frame (' + line + ')');
    ok(C.errors.length === 0, 'blocking lowpoly.js: no console or page errors' + (C.errors.length ? ': ' + C.errors.join(' / ') : ''));
    await C.ctx.close();
  }

  console.log('[phone 390 x 844: no sideways scroll while the entries play]');
  const M = await open(b, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  let sideways = 0;
  for (const [name, go] of STEPS.slice(0, 5)) { await go(M.p); for (const t of [60, 250, 600]) { await M.p.waitForTimeout(t); if (!(await T.noScroll(M.p))) sideways++; } }
  ok(sideways === 0, 'the entry animations never widen the page on a phone (' + sideways + ' checks failed)');
  await M.p.screenshot({ path: path.join(shots, 'motion-phone.png') });
  ok(M.errors.length === 0, 'phone: no console or page errors' + (M.errors.length ? ': ' + M.errors.join(' / ') : ''));
  await M.ctx.close();

  await b.close();
  done();
})();
