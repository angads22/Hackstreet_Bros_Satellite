// The part explainers (js/part-story.js, js/ui-parts.js): every part has its words and a picture, motion stops under
// reduced motion while all the text stays, and the Build preview shows the explainer without losing its other lines.
// Usage: node parts.js [shots dir]   or   node parts.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const T = require('./lib');
const { repo, url, shots } = T.args();
const { ok, done } = T.checker();
const gallery = 'file://' + path.join(repo, 'handoff', 'lowpoly', 'parts-gallery.html');
const KINDS_OK = k => typeof k === 'string' && k.length > 0;

(async () => {
  // 1. The words, in Node: shape and limits, for every part.
  console.log('[PART_STORY]');
  const P = new Function(fs.readFileSync(path.join(repo, 'data/parts.js'), 'utf8').replace(/^const PARTS/m, 'var PARTS') + ';return PARTS')();
  const S = new Function(fs.readFileSync(path.join(repo, 'js/part-story.js'), 'utf8') + ';return PART_STORY')();
  ok(P.length === 41, '41 parts in data/parts.js (' + P.length + ')');
  const limits = { hook: 12, does: 24, trade: 14 };
  let shapeBad = [], limitBad = [], charBad = [];
  P.forEach(p => {
    const s = S[p.id];
    if (!s || Object.keys(s).sort().join() !== 'does,hook,kind,trade' || !KINDS_OK(s.kind)) { shapeBad.push(p.id); return; }
    Object.keys(limits).forEach(f => {
      if (typeof s[f] !== 'string' || T.words(s[f]) < 1 || T.words(s[f]) > limits[f]) limitBad.push(p.id + '.' + f + '=' + T.words(s[f]));
      if (/[0-9$%]/.test(s[f]) || /\bAI\b/.test(s[f])) charBad.push(p.id + '.' + f);
    });
  });
  ok(!shapeBad.length, 'every part has { kind, hook, does, trade } ' + shapeBad.join(','));
  ok(!limitBad.length, 'hook <= 12, does <= 24, trade <= 14 words ' + limitBad.join(','));
  ok(!charBad.length, 'no digits, $, % or "AI" in the text ' + charBad.join(','));
  ok(Object.keys(S).every(id => P.some(p => p.id === id)), 'PART_STORY has no entry for an unknown part');

  const b = await chromium.launch();
  async function open(opts, u) {
    const ctx = await b.newContext(opts);
    const p = await ctx.newPage();
    const errors = T.watchErrors(p);
    await T.noFonts(p);
    await p.goto(u);
    await p.waitForTimeout(300);
    return { p, errors, ctx };
  }

  // 2. The pictures, in the gallery page (normal motion).
  console.log('[gallery, motion on]');
  let g = await open({ viewport: { width: 1366, height: 768 } }, gallery);
  const info = await g.p.evaluate(() => {
    const out = { has: PartExplainer.has('nope'), nul: PartExplainer.element('nope'), kinds: PartExplainer.kinds.length, figs: [] };
    PARTS.forEach(p => {
      let fig = null, threw = false;
      try { fig = PartExplainer.element(p.id); } catch (e) { threw = true; }
      const svg = fig && fig.querySelector('svg');
      out.figs.push({ id: p.id, threw, fig: !!fig, svg: !!svg && svg.getAttribute('aria-hidden') === 'true', cap: fig && fig.querySelector('figcaption') ? fig.querySelector('figcaption').textContent : '' });
    });
    return out;
  });
  ok(info.has === false && info.nul === null, 'an unknown part id: has() is false, element() is null');
  ok(info.kinds >= 18, 'PartExplainer.kinds lists the animation kinds (' + info.kinds + ')');
  ok(info.figs.every(f => !f.threw && f.fig && f.svg), 'element() renders for all 41 parts without throwing, with an aria-hidden svg');
  const run = await g.p.evaluate(() => [...document.querySelectorAll('figure.explainer')].map(f => ({ id: f.getAttribute('data-part'), n: f.querySelector('svg').getAnimations({ subtree: true }).filter(a => a.playState === 'running').length })));
  ok(run.length === 41 && run.every(r => r.n > 0), 'with motion on, every figure has a running animation' + run.filter(r => !r.n).map(r => ' ' + r.id).join(''));
  const word = await g.p.evaluate(() => PARTS.map(p => { const c = document.querySelector('figure[data-part="' + p.id + '"] figcaption'); return c && c.textContent.indexOf(PART_STORY[p.id].hook) === 0 && c.textContent.indexOf(PART_STORY[p.id].does) > 0 && c.textContent.indexOf(PART_STORY[p.id].trade) > 0; }));
  ok(word.every(Boolean), 'each figcaption holds the hook, the does line and the trade line as plain text');
  ok(g.errors.length === 0, 'no console errors in the gallery ' + g.errors.join(' | '));
  await g.p.screenshot({ path: path.join(shots, 'gallery-1366.png'), fullPage: true });
  await g.ctx.close();

  // 3. Reduced motion: nothing runs, every word is there at once.
  console.log('[gallery, reduced motion]');
  g = await open({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' }, gallery);
  const still = await g.p.evaluate(() => {
    const figs = [...document.querySelectorAll('figure.explainer')];
    return { n: figs.length, running: figs.reduce((t, f) => t + f.querySelector('svg').getAnimations({ subtree: true }).filter(a => a.playState === 'running').length, 0),
      shown: figs.every(f => { const c = f.querySelector('figcaption'); const r = c.getBoundingClientRect(); return r.height > 0 && getComputedStyle(c).visibility !== 'hidden' && c.textContent.trim().length > 20; }) };
  });
  ok(still.n === 41 && still.running === 0, 'reduced motion: no running animations (' + still.running + ')');
  ok(still.shown, 'reduced motion: all the text is shown at once');
  await g.ctx.close();

  // 4. Phone-width gallery: no sideways scroll.
  g = await open({ viewport: { width: 390, height: 844 } }, gallery + '?compact');
  ok(await T.noScroll(g.p), 'the gallery does not scroll sideways at 390');
  await g.p.screenshot({ path: path.join(shots, 'gallery-390.png'), fullPage: false });
  await g.ctx.close();

  // 5. The real Build screen.
  for (const vp of [{ width: 1366, height: 768, name: 'desktop' }, { width: 390, height: 844, name: 'phone' }]) {
    console.log('[Build preview, ' + vp.name + ']');
    const c = await open({ viewport: { width: vp.width, height: vp.height } }, url);
    const { p, errors } = c;
    await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(200);
    await p.evaluate(() => {
      const d = newDesign('training'); setEra(d, 'new-space'); setObjective(d, 'wildfire'); setOrbit(d, 'leo');
      ['cubesat-12u', 'spin-stabilised', 'optical-camera', 'solar-small', 'radio-uhf', 'obc-basic'].forEach(id => addPart(d, id));
      window.__d = d; window.showDesignScreen('build', d);
    });
    await p.waitForTimeout(200);
    await p.click('[data-key="bin-instrument"]');
    const emptyH = (await p.locator('#preview').boundingBox()).height;
    const card = p.locator('[data-key="part-sar-radar"]');
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await p.waitForTimeout(150);
    const r = await p.evaluate(() => {
      const box = document.getElementById('preview'), fig = box.querySelector('figure.explainer');
      const kids = [...box.children].map(n => n.tagName.toLowerCase() + '.' + (n.className || ''));
      return { fig: !!fig, part: fig && fig.getAttribute('data-part'), live: box.getAttribute('aria-live'), blurb: !!box.querySelector('.blurb'), fixes: box.querySelectorAll('.preview-line.fix, .preview-line.cause').length,
        order: kids.join(' '), h3: box.querySelector('h3') && box.querySelector('h3').textContent, text: box.innerText, over: box.scrollWidth - box.clientWidth, docOver: document.documentElement.scrollWidth - window.innerWidth,
        height: box.getBoundingClientRect().height, ptr: fig ? getComputedStyle(fig.querySelector('svg')).pointerEvents : '' };
    });
    ok(r.fig && r.part === 'sar-radar', 'hovering a part card shows its explainer in the preview');
    ok(r.live === 'polite', 'the preview keeps aria-live="polite"');
    ok(/ADD SYNTHETIC APERTURE RADAR/.test(r.h3 || ''), 'the heading is still first: ' + r.h3);
    ok(r.fixes > 0 && /Causes:|Fixes:/.test(r.text), 'the preview keeps its Fixes and Causes lines (' + r.fixes + ')');
    ok(!r.blurb, 'the blurb line is dropped when the explainer shows');
    ok(/^h2[^ ]* h3[^ ]* figure\.explainer/.test(r.order.replace(/\.(?= )/g, '').replace(/\.$/, '')) || r.order.indexOf('figure') > r.order.indexOf('h3'), 'the explainer sits above the effect lines: ' + r.order);
    ok(r.over <= 0 && r.docOver <= 0, 'the preview does not overflow sideways at ' + vp.width + ' (' + r.over + ', page ' + r.docOver + ')');
    ok(Math.abs(r.height - emptyH) < 1, 'the preview keeps its height (' + emptyH + ' -> ' + r.height + ')');
    ok(r.ptr === 'none', 'the animation never takes the pointer');
    await p.screenshot({ path: path.join(shots, 'build-' + vp.name + '.png') });
    // focus (keyboard) shows another part's explainer too
    await p.focus('[data-key="part-thermal-imager"]'); await p.waitForTimeout(100);
    ok(await p.evaluate(() => { const f = document.querySelector('#preview figure.explainer'); return !!f && f.getAttribute('data-part') === 'thermal-imager'; }), 'focusing a card shows its explainer');
    // without the module the old blurb comes back
    await p.evaluate(() => { window.__pe = PartExplainer; window.PartExplainer = undefined; });
    await p.hover('[data-key="part-optical-camera"]'); await p.waitForTimeout(100);
    ok(await p.evaluate(() => !document.querySelector('#preview figure') && !!document.querySelector('#preview .blurb')), 'without PartExplainer the preview shows the blurb as before');
    ok(errors.length === 0, 'no console errors on Build ' + errors.join(' | '));
    await c.ctx.close();
  }
  await b.close();
  done();
})().catch(e => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });
