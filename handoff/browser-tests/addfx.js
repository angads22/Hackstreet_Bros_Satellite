// Adding a part on Build has a moment of its own (js/motion.js buildFx, the "Build: a click on a part card" block of css/style.css, and
// js/ui-design.js fxBefore/fxAfter): a tile lifts off the card and flies to the satellite (back to the card on a removal), a ring and a
// few squares mark the dock, the picture thumps, a chip floats off every bar the part changed, and CARRIES is the star when a body is fitted.
//  - exactly one flying tile at a time, gone within 1.5 s; the layer (#gm-fx) is aria-hidden and takes no pointer events;
//  - the MASS chip shows the back end's own previewToggle delta (read from the page with the same call); a body's chip is its payload_kg;
//  - Hard: a part whose sheet is still "?" gets no mass, power or data chip (only the catalogue price); after ASK it does;
//  - removing plays the reverse; reduced motion plays nothing (no chips, no tile, no running animation) and the numbers still update;
//  - 15 quick clicks leave nothing behind and no errors; a locked card does nothing; a click that goes over the body's slots still plays;
//  - touch: the first tap only previews, the second tap adds and plays; Enter and Space play it; a phone never scrolls sideways;
//  - with js/lowpoly.js blocked (the SVG satellite) or js/motion.js blocked the screen still works with no errors;
//  - the card inside .part-slot (paid-info cards) still adds on a click.
// Usage: node addfx.js [shots dir]   or   node addfx.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();

async function open(b, opts, extra) {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1366, height: 768 } }, opts || {}));
  const p = await ctx.newPage();
  const allowed = extra && extra.block ? new RegExp(extra.block.replace('.', '\\.')) : null;
  const errors = T.watchErrors(p, allowed);
  await T.noFonts(p);
  if (extra && extra.block) await p.route(new RegExp('/js/' + extra.block.replace('.', '\\.')), r => r.abort());
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
  return { ctx, p, errors };
}
// A design on the Build screen: today's parts, sea ice from a polar orbit, with the parts given already on board.
const build = (p, parts, tier, era) => p.evaluate(a => {
  const d = newDesign(a.tier || 'standard'); if (a.era) setEra(d, a.era);
  setObjective(d, a.era ? 'radiation' : 'sea-ice'); setOrbit(d, a.era ? 'leo' : 'sso');
  a.parts.forEach(id => addPart(d, id));
  window.__d = d; window.showDesignScreen('build', d);
}, { parts: parts || [], tier, era });
const BINS = { 'smallsat-bus': 'structure', 'cubesat-12u': 'structure', 'sar-radar': 'instrument', 'optical-camera': 'instrument', 'solar-small': 'power', 'radio-xband': 'comms' };

// What the effect layer holds now.
const fxState = p => p.evaluate(() => {
  const L = document.getElementById('gm-fx');
  const kids = L ? L.querySelectorAll('*').length : 0;
  const chips = L ? [...L.querySelectorAll('.fx-chip')].map(c => ({ bar: c.parentNode.getAttribute('data-bar'), text: c.textContent, cls: c.className })) : [];
  return { layer: !!L, kids, tiles: L ? L.querySelectorAll('.fx-tile').length : 0, flies: L ? L.querySelectorAll('.fx-fly').length : 0,
    back: L ? L.querySelectorAll('.fx-fly.back').length : 0, rings: L ? L.querySelectorAll('.fx-ring').length : 0, bits: L ? L.querySelectorAll('.gm-burst i').length : 0, chips,
    inApp: document.querySelectorAll('#app .fx-chip, #app .fx-tile').length,
    hidden: L ? L.getAttribute('aria-hidden') : null, events: L ? getComputedStyle(L).pointerEvents : null,
    chipEvents: L && L.querySelector('.fx-chip') ? getComputedStyle(L.querySelector('.fx-chip')).pointerEvents : null };
});
const bar = (p, name) => p.evaluate(name => { const b = [...document.querySelectorAll('.bar')].find(x => x.querySelector('.bar-name') && x.querySelector('.bar-name').textContent.trim() === name);
  return b ? b.querySelector('.bar-top > span:last-child').textContent : null; }, name);
const delta = (p, id) => p.evaluate(id => previewToggle(window.__d, id).delta, id);
const num = s => parseFloat(String(s).replace(/[^\d.\-+]/g, ''));
// Same size as the back end's number (the chip writes it with two or fewer figures): within 6%, and the same sign.
const same = (chip, v) => Math.sign(num(chip)) === Math.sign(v) && Math.abs(num(chip) - v) <= Math.abs(v) * 0.06 + 1e-9;
async function openBin(p, bin) { await p.click(`[data-key="bin-${bin}"]`); }
// A real mouse click on a card: the pointer rests on it first (the preview), as a player's does.
async function click(p, id) { await p.hover(`[data-key="part-${id}"]`); await p.waitForTimeout(40); await p.click(`[data-key="part-${id}"]`); }
// Every animation now running that belongs to the effect: how long it takes in all, and whether any loops.
const running = p => p.evaluate(() => {
  const mine = document.getAnimations().filter(a => { const n = a.effect && a.effect.target; return n && (n.closest('#gm-fx') || /fx-|gm-grow/.test(n.className && n.className.baseVal === undefined ? n.className : '')); });
  return { count: document.getAnimations().length, mine: mine.length, max: mine.reduce((m, a) => Math.max(m, a.effect.getComputedTiming().endTime), 0),
    loops: mine.filter(a => a.effect.getComputedTiming().endTime === Infinity).length };
});

(async () => {
  const b = await chromium.launch();

  // ------------------------------------------------------------------------------------------------ desktop, 1366 x 768
  console.log('[desktop 1366 x 768: adding an instrument]');
  const A = await open(b);
  const p = A.p;
  await build(p, ['smallsat-bus', 'solar-small']); await p.waitForTimeout(900);
  await openBin(p, 'instrument');
  const d1 = await delta(p, 'sar-radar'), massBefore = await bar(p, 'MASS');
  await click(p, 'sar-radar');
  await p.waitForTimeout(120);
  let s = await fxState(p);
  ok(s.flies === 1 && s.tiles === 1, 'exactly one flying tile in the air (' + s.flies + ')');
  ok(s.hidden === 'true' && s.events === 'none' && (s.chipEvents === 'none' || s.chipEvents === null) && s.inApp === 0, 'the effect is aria-hidden, takes no pointer events and sits outside the screen (#app)');
  await p.waitForTimeout(250);
  s = await fxState(p);
  const mass = s.chips.find(c => c.bar === 'MASS');
  ok(!!mass && /^\+\d/.test(mass.text) && / KG$/.test(mass.text), 'a chip on MASS reads like the preview, in capitals: "' + (mass && mass.text) + '"');
  ok(!!mass && same(mass.text, d1.mass_kg), 'the MASS chip is the back end\'s own previewToggle delta (' + d1.mass_kg + ' kg, chip ' + (mass && mass.text) + ')');
  const draw = s.chips.find(c => c.bar === 'POWER'), cost = s.chips.find(c => c.bar === 'BUDGET');
  ok(!!draw && / W DRAW$/.test(draw.text) && same(draw.text, d1.power_draw_w), 'POWER: the draw chip matches the delta (' + d1.power_draw_w + ' W, chip ' + (draw && draw.text) + ')');
  ok(!!cost && /^\+\$/.test(cost.text) && same(cost.text.replace(/\$|M/g, ''), d1.cost_musd), 'BUDGET: the cost chip matches the delta ($' + d1.cost_musd + 'M, chip ' + (cost && cost.text) + ')');
  ok(mass && /warn/.test(mass.cls) && draw && /warn/.test(draw.cls), 'more mass and more draw are the warning colour');
  ok(s.chips.every(c => c.bar && ['MASS', 'POWER', 'BUDGET', 'DATA HOME', 'CARRIES'].indexOf(c.bar) !== -1), 'chips only sit on bars (' + s.chips.map(c => c.bar).join(', ') + ')');
  ok(await bar(p, 'MASS') !== massBefore, 'the MASS number still changed (' + massBefore + ' to ' + await bar(p, 'MASS') + ')');
  const r = await running(p);
  ok(r.mine > 3 && r.max <= 1500 && r.loops === 0, 'the effect runs ' + r.mine + ' animations, the longest ' + Math.round(r.max) + ' ms in all, none loops');
  const lit = await p.evaluate(() => document.querySelectorAll('.bar-track .fx-lit').length), pop = await p.evaluate(() => document.querySelectorAll('.bar .fx-pop').length);
  ok(lit >= 1 && pop >= 1, 'the changed bars light their new stretch and pop their number (' + lit + ' lit, ' + pop + ' popped)');
  const tops = await p.evaluate(() => [...document.querySelectorAll('.bar-top')].map(n => n.textContent));
  ok(tops.length >= 4 && tops.every(t => !/[+]/.test(t)), 'the numbers\' own text carries no chip or sign (' + tops.map(t => t.replace(/\s+/g, ' ').trim()).join(' | ') + ')');
  // three moments of the effect, with the timeline stopped on each (the satellite is in view: the page is scrolled to the bench)
  await p.evaluate(() => window.scrollTo(0, 200));
  await openBin(p, 'comms');
  const freeze = t => p.evaluate(t => { document.getAnimations().forEach(a => { try { a.pause(); a.currentTime = t; } catch (e) {} }); }, t);
  await p.evaluate(() => window.scrollTo(0, 200)); await p.waitForTimeout(80);
  await p.evaluate(() => document.querySelector('[data-key="part-radio-xband"]').click());
  await freeze(180); await p.screenshot({ path: path.join(shots, 'addfx-1-flight.png') });
  await freeze(520); await p.screenshot({ path: path.join(shots, 'addfx-2-dock.png') });
  await freeze(760); await p.screenshot({ path: path.join(shots, 'addfx-3-chips.png') });
  const data = (await fxState(p)).chips.find(c => c.bar === 'DATA HOME');
  ok(!!data && /^[+-]\d[\d.]* [GMK]B\/DAY$/.test(data.text) && /good/.test(data.cls), 'a radio adds a DATA HOME chip in the good colour: "' + (data && data.text) + '"');
  await p.waitForTimeout(1700);
  s = await fxState(p);
  ok(s.kids === 0, 'everything is gone 1.7 s later (' + s.kids + ' nodes left)');

  console.log('[desktop: a body is the star]');
  await build(p, []); await p.waitForTimeout(900);
  ok(await bar(p, 'CARRIES') === null, 'no CARRIES bar before a body is fitted');
  await openBin(p, 'structure');
  const cap = await p.evaluate(() => getPart('smallsat-bus').payload_kg);
  await click(p, 'smallsat-bus');
  await p.waitForTimeout(250);
  s = await fxState(p);
  const pay = s.chips.find(c => c.bar === 'CARRIES');
  ok(!!pay && pay.text === '+' + cap + ' KG', 'the CARRIES chip is the body\'s own payload_kg: "' + (pay && pay.text) + '" (data: ' + cap + ')');
  ok(!!pay && /good/.test(pay.cls) && /star/.test(pay.cls), 'in the good colour and bigger than the rest');
  const payText = await bar(p, 'CARRIES');
  ok(payText && payText.indexOf('/ ' + cap + ' KG') !== -1, 'the CARRIES number now shows the capacity (' + payText + ')');
  const star = await p.evaluate(() => ({ swell: document.querySelectorAll('.bar.fx-star').length, anims: document.getAnimations().map(a => a.animationName),
    dock: document.querySelectorAll('.sat-bench.fx-dock').length }));
  ok(star.swell === 1 && star.anims.indexOf('fx-swell') !== -1 && star.anims.indexOf('fx-star-num') !== -1, 'the CARRIES bar swells and its number lands with an overshoot (fx-swell, fx-star-num)');
  ok(star.dock === 1 && star.anims.indexOf('fx-dock') !== -1, 'the bench thumps once as the tile lands (fx-dock)');
  await p.waitForTimeout(1600);
  // another body: the capacity changes, with its own chip
  await click(p, 'smallsat-bus'); await p.waitForTimeout(200);   // removes it
  ok(await bar(p, 'CARRIES') === null, 'removing the body takes the CARRIES bar away');
  const back = await fxState(p);
  ok(back.back === 1 && back.chips.every(c => c.bar !== 'CARRIES'), 'removing plays the reverse (one tile flying back to the card), no carries chip');
  ok(back.chips.some(c => c.bar === 'MASS' && /^-/.test(c.text) && /good/.test(c.cls)), 'less mass is the good colour: "' + (back.chips.find(c => c.bar === 'MASS') || {}).text + '"');
  await p.waitForTimeout(1600);
  const cap2 = await p.evaluate(() => getPart('cubesat-12u').payload_kg);
  await click(p, 'cubesat-12u'); await p.waitForTimeout(250);
  const pay2 = (await fxState(p)).chips.find(c => c.bar === 'CARRIES');
  ok(!!pay2 && pay2.text === '+' + cap2 + ' KG' && cap2 !== cap, 'a different body changes the payload: "' + (pay2 && pay2.text) + '" instead of +' + cap);
  ok(await bar(p, 'CARRIES') !== payText, 'the CARRIES number changed (' + payText + ' to ' + await bar(p, 'CARRIES') + ')');
  await p.waitForTimeout(1600);

  console.log('[desktop: removing a part]');
  await build(p, ['smallsat-bus', 'sar-radar']); await p.waitForTimeout(900);
  await openBin(p, 'instrument');
  const d2 = await delta(p, 'sar-radar');
  await click(p, 'sar-radar'); await p.waitForTimeout(150);
  s = await fxState(p);
  ok(s.back === 1 && s.flies === 1 && s.rings === 0, 'one tile flies back from the satellite to the card, with no dock pulse');
  const m2 = s.chips.find(c => c.bar === 'MASS');
  ok(!!m2 && /^-/.test(m2.text) && same(m2.text, d2.mass_kg) && /good/.test(m2.cls), 'the chips show the removal (' + (m2 && m2.text) + ' for ' + d2.mass_kg + ' kg)');
  await p.waitForTimeout(1700);
  ok((await fxState(p)).kids === 0, 'the reverse leaves nothing behind');

  console.log('[desktop: keyboard, locked card, over the slots]');
  await build(p, ['smallsat-bus']); await p.waitForTimeout(900);
  await openBin(p, 'instrument');
  await p.focus('[data-key="part-optical-camera"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(120);
  ok((await fxState(p)).flies === 1, 'Enter on a card plays the add');
  await p.waitForTimeout(1600);
  await p.focus('[data-key="part-optical-camera"]'); await p.keyboard.press('Space'); await p.waitForTimeout(120);
  ok((await fxState(p)).back === 1, 'Space on a card plays the removal');
  await p.waitForTimeout(1600);
  await build(p, ['smallsat-bus', 'sar-radar', 'optical-camera', 'thermal-imager']); await p.waitForTimeout(900);
  await openBin(p, 'instrument');
  const over = await p.evaluate(() => { const t = getTotals(window.__d).body.slots.instrument; return t.used > t.max; });
  ok(over, 'a design with more instruments than slots is allowed on the screen and flagged (the bin turns red)');
  await p.evaluate(() => { const d = window.__d; removePart(d, 'thermal-imager'); window.showDesignScreen('build', d); });
  await openBin(p, 'instrument'); await p.waitForTimeout(500);
  await click(p, 'thermal-imager'); await p.waitForTimeout(150);
  s = await fxState(p);
  ok(s.flies === 1 && s.chips.length > 0, 'a click that goes over the slots still plays (' + s.chips.length + ' chips)');
  await p.waitForTimeout(1600);
  await build(p, ['explorer-body'], 'training', 'igy'); await p.waitForTimeout(900);
  const locked = await p.evaluate(() => { for (const bin of ['instrument', 'power', 'comms', 'computer']) { document.querySelector('[data-key="bin-' + bin + '"]').click(); const l = document.querySelector('.part.locked'); if (l) return l.getAttribute('data-key'); } return null; });
  if (locked) {
    const before = await p.evaluate(() => window.__d.parts.slice());
    await p.click(`[data-key="${locked}"]`, { force: true }).catch(() => {}); await p.waitForTimeout(120);
    ok((await fxState(p)).kids === 0 && JSON.stringify(before) === JSON.stringify(await p.evaluate(() => window.__d.parts)), 'a click on a locked card does nothing (' + locked + ')');
  } else ok(true, 'no locked card to click in this era');

  console.log('[desktop: 15 quick clicks]');
  await build(p, ['smallsat-bus']); await p.waitForTimeout(900);
  await openBin(p, 'instrument');
  const burst = await p.evaluate(() => new Promise(res => {
    let n = 0, worst = 0, maxKids = 0, maxFly = 0, slow = 0;
    const iv = setInterval(() => {
      const id = n % 2 ? 'sar-radar' : 'optical-camera';
      const t0 = performance.now(); document.querySelector(`[data-key="part-${id}"]`).click(); slow = Math.max(slow, performance.now() - t0);
      const L = document.getElementById('gm-fx');
      if (L) { maxKids = Math.max(maxKids, L.querySelectorAll('*').length); maxFly = Math.max(maxFly, L.querySelectorAll('.fx-fly').length); }
      if (++n >= 15) { clearInterval(iv); res({ slow, maxKids, maxFly }); }
    }, 30);
  }));
  console.log('     slowest click ' + burst.slow.toFixed(1) + ' ms, most nodes at once ' + burst.maxKids + ', most tiles at once ' + burst.maxFly);
  ok(burst.maxFly <= 1, 'never more than one tile in flight (a new click replaces it)');
  ok(burst.maxKids < 40, 'the layer stays small through 15 clicks (' + burst.maxKids + ' nodes at most)');
  ok(burst.slow < 150, 'the click stays quick (' + burst.slow.toFixed(1) + ' ms)');
  await p.waitForTimeout(1800);
  s = await fxState(p);
  ok(s.kids === 0 && s.chips.length === 0, 'no leftover chip or tile 1.8 s after the last click (' + s.kids + ' nodes)');
  ok(await T.noScroll(p), 'no sideways scroll');
  ok(A.errors.length === 0, 'no console or page errors' + (A.errors.length ? ': ' + A.errors.join(' / ') : ''));
  await A.ctx.close();

  // ------------------------------------------------------------------------------------------------ Hard: a "?" sheet gets no number chip
  console.log('[Hard: paid part information stays paid]');
  const H = await open(b, { viewport: { width: 1280, height: 900 } });
  const hp = H.p;
  await T.seedRuns(hp);
  await hp.click('[data-key="part2-go"]'); await hp.click('[data-key="level-expert"]');
  await T.pastScenes(hp); await T.waitHead(hp, 'WORKSHOP');
  const keys = await hp.$$eval('[data-key^="fly-"]', es => es.map(e => e.dataset.key.slice(4)));
  const topic = keys.find(k => T.CONTRACT[k]) || keys[0], cc = T.CONTRACT[topic];
  await hp.click(`[data-key="fly-${topic}"]`); await T.waitHead(hp, 'BASE MAP');
  if (cc && cc.orbit && await hp.locator('[data-key="blip-orbit"]').count()) {
    await hp.click('[data-key="blip-orbit"]'); await T.waitHead(hp, 'ORBIT');
    await hp.click(`[data-key="orbit-${cc.orbit}"]`); await hp.click('.nav-row .btn.primary');
  } else await hp.click('[data-key="blip-build"]');
  await T.waitHead(hp, 'BUILD');
  const radio = 'radio-uhf';
  await hp.click('[data-key="bin-comms"]');
  ok(await hp.locator(`.part-slot:has([data-key="part-${radio}"])`).count() === 1, 'the unpaid card sits in a .part-slot');
  await hp.hover(`[data-key="part-${radio}"]`); await hp.waitForTimeout(60);
  await hp.click(`[data-key="part-${radio}"]`); await hp.waitForTimeout(150);
  ok(await hp.evaluate(id => document.querySelector(`[data-key="part-${id}"]`).getAttribute('aria-pressed') === 'true', radio), 'a click on a card inside .part-slot still adds the part');
  s = await fxState(hp);
  ok(s.flies === 1, 'the tile flies for it');
  ok(s.chips.every(c => c.bar === 'BUDGET') && s.chips.length >= 1, 'Hard, sheet still "?": only the catalogue price floats (' + s.chips.map(c => c.bar + ' ' + c.text).join(', ') + ')');
  await hp.waitForTimeout(1600);
  await hp.click(`[data-key="part-${radio}"]`); await hp.waitForTimeout(100);   // off again
  await hp.waitForTimeout(1600);
  await hp.click(`[data-key="ask-${radio}-sheet"]`); await hp.waitForTimeout(150);
  await hp.hover(`[data-key="part-${radio}"]`); await hp.waitForTimeout(60);
  await hp.click(`[data-key="part-${radio}"]`); await hp.waitForTimeout(250);
  s = await fxState(hp);
  ok(s.chips.some(c => c.bar === 'MASS' || c.bar === 'POWER'), 'after paying for the sheet the number chips float too (' + s.chips.map(c => c.bar).join(', ') + ')');
  await hp.waitForTimeout(1600);
  ok(H.errors.length === 0, 'Hard: no console or page errors' + (H.errors.length ? ': ' + H.errors.join(' / ') : ''));
  await H.ctx.close();

  // ------------------------------------------------------------------------------------------------ reduced motion
  console.log('[reduced motion: nothing moves, the numbers still update]');
  const R = await open(b, { reducedMotion: 'reduce' });
  await build(R.p, ['smallsat-bus']); await R.p.waitForTimeout(900);
  await openBin(R.p, 'instrument');
  const rm0 = await bar(R.p, 'MASS');
  await click(R.p, 'sar-radar'); await R.p.waitForTimeout(100);
  s = await fxState(R.p);
  ok(s.kids === 0 && s.chips.length === 0, 'no tile, no ring, no chip (' + s.kids + ' nodes)');
  ok(await R.p.evaluate(() => document.getAnimations().length) === 0, 'no animation is running');
  ok(await R.p.evaluate(() => document.querySelectorAll('.fx-lit, .fx-pop, .fx-star, #gm-fx').length) === 0, 'no helper node or class was added to the page');
  ok(await bar(R.p, 'MASS') !== rm0, 'the numbers still update (MASS ' + rm0 + ' to ' + await bar(R.p, 'MASS') + ')');
  await click(R.p, 'sar-radar'); await R.p.waitForTimeout(100);
  ok(await R.p.evaluate(() => document.getAnimations().length) === 0 && (await fxState(R.p)).kids === 0, 'removing plays nothing either');
  ok(R.errors.length === 0, 'reduced motion: no console or page errors' + (R.errors.length ? ': ' + R.errors.join(' / ') : ''));
  await R.ctx.close();

  // ------------------------------------------------------------------------------------------------ pixel fallback, no motion.js
  console.log('[js/lowpoly.js blocked: the SVG satellite]');
  const P = await open(b, {}, { block: 'lowpoly.js' });
  await build(P.p, ['smallsat-bus', 'solar-small']); await P.p.waitForTimeout(900);
  ok(await P.p.evaluate(() => !document.querySelector('canvas.lp-sat') && !!document.querySelector('.bench .sat-bench svg')), 'the bench draws the SVG satellite');
  await openBin(P.p, 'instrument');
  await click(P.p, 'sar-radar'); await P.p.waitForTimeout(200);
  s = await fxState(P.p);
  ok(s.flies === 1 && s.chips.some(c => c.bar === 'MASS'), 'the tile still flies and the chips still float (' + s.chips.length + ' chips)');
  await P.p.waitForTimeout(1600);
  ok((await fxState(P.p)).kids === 0, 'and it all cleans up');
  ok(P.errors.length === 0, 'lowpoly.js blocked: no console or page errors' + (P.errors.length ? ': ' + P.errors.join(' / ') : ''));
  await P.ctx.close();

  console.log('[js/motion.js blocked: the screen works as before]');
  const N = await open(b, {}, { block: 'motion.js' });
  await build(N.p, ['smallsat-bus']); await N.p.waitForTimeout(900);
  await openBin(N.p, 'instrument');
  await click(N.p, 'sar-radar'); await N.p.waitForTimeout(150);
  ok(await N.p.evaluate(() => window.__d.parts.indexOf('sar-radar') !== -1) && (await fxState(N.p)).layer === false, 'the part is added, and no effect layer exists');
  ok(N.errors.length === 0, 'motion.js blocked: no console or page errors' + (N.errors.length ? ': ' + N.errors.join(' / ') : ''));
  await N.ctx.close();

  // ------------------------------------------------------------------------------------------------ phone, 390 x 844, touch
  console.log('[phone 390 x 844: touch]');
  const M = await open(b, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await build(M.p, ['smallsat-bus']); await M.p.waitForTimeout(900);
  await M.p.tap('[data-key="bin-instrument"]');
  await M.p.tap('[data-key="part-sar-radar"]'); await M.p.waitForTimeout(150);
  s = await fxState(M.p);
  ok(s.kids === 0 && await M.p.evaluate(() => window.__d.parts.indexOf('sar-radar') === -1), 'the first tap only previews: no flight, nothing added');
  await M.p.tap('[data-key="part-sar-radar"]');
  let side = 0;
  for (const t of [40, 200, 400, 700]) { await M.p.waitForTimeout(t === 40 ? 40 : 160); if (!(await T.noScroll(M.p))) side++; }
  s = await fxState(M.p);
  ok(await M.p.evaluate(() => window.__d.parts.indexOf('sar-radar') !== -1) && s.flies === 1, 'the second tap adds the part and plays the flight (' + s.flies + ' tile)');
  ok(side === 0, 'the chips and the tile never widen the page (' + side + ' checks failed)');
  await M.p.screenshot({ path: path.join(shots, 'addfx-phone.png') });
  await M.p.waitForTimeout(1600);
  ok((await fxState(M.p)).kids === 0, 'the phone effect cleans up too');
  ok(M.errors.length === 0, 'phone: no console or page errors' + (M.errors.length ? ': ' + M.errors.join(' / ') : ''));
  await M.ctx.close();

  await b.close();
  done();
})();
