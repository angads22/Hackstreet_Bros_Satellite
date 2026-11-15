// The design screens' sweep fixes (Build preview and bins, bars, Readiness forecast, base map, orbit badge, header):
// each check is a bug that was seen, so a FAIL here means it came back.
// Usage: node design-screens.js [shots dir]   or   node design-screens.js <repo dir> <shots dir>
// Most designs are built in the page with the back end's own calls (a 2026 design stands in for Part 2's parts);
// Part 1, step 1 is played by clicking and by tapping.
const { chromium, devices } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();

const NS = { era: 'new-space', objective: 'wildfire', orbit: 'leo' };
const IGY = { era: 'igy', objective: 'radiation', orbit: 'leo' };
async function page(b, opts) {
  const ctx = await b.newContext(opts || { viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
  return { p, errors };
}
// A standalone design, opened on a screen.
function show(p, screen, spec) {
  return p.evaluate(([screen, spec]) => {
    const d = newDesign(spec.tier || 'training');
    if (spec.era) setEra(d, spec.era);
    if (spec.objective) setObjective(d, spec.objective);
    if (spec.orbit) setOrbit(d, spec.orbit);
    (spec.parts || []).forEach(id => addPart(d, id));
    if (spec.launcher) setLauncher(d, spec.launcher);
    window.__d = d;
    window.showDesignScreen(screen, d);
  }, [screen, spec]).then(() => p.waitForTimeout(100));
}
const text = (p, sel) => p.locator(sel).innerText().then(t => t.replace(/\s+/g, ' '));
const barText = (p, name) => p.evaluate(n => { const x = [...document.querySelectorAll('.bar')].find(b => b.querySelector('.bar-name') && b.querySelector('.bar-name').innerText.includes(n)); return x ? x.className + ' | ' + x.innerText.replace(/\s+/g, ' ') : ''; }, name);

(async () => {
  const b = await chromium.launch();
  let { p, errors } = await page(b);

  console.log('[Build preview, desktop]');
  await show(p, 'build', { ...NS, parts: ['cubesat-12u', 'spin-stabilised', 'optical-camera', 'solar-small', 'radio-uhf', 'obc-basic'] });
  await p.click('[data-key="bin-instrument"]');
  const card = p.locator('[data-key="part-sar-radar"]');
  await card.scrollIntoViewIfNeeded();
  const before = await card.boundingBox();
  const live = await p.evaluateHandle(() => document.getElementById('preview'));
  await card.hover();
  ok(JSON.stringify(before) === JSON.stringify(await card.boundingBox()), 'hovering a card does not move it');
  const order = await p.evaluate(() => [...document.querySelectorAll('#preview > *')].map(n => n.className || n.tagName).join(','));
  // The part's animated explainer (js/ui-parts.js) now tells the story, above the effect lines, and replaces the blurb line.
  ok(/^H2,H3,explainer[^,]*(,preview-line( fix| cause)?)+$/.test(order) && /cause/.test(order) && !/blurb/.test(order), 'the preview lists the explainer, then Fixes and Causes (the blurb is dropped): ' + order);
  // Without the module the old order stands: Causes, then the part's story last.
  await p.evaluate(() => { window.__pe = PartExplainer; window.PartExplainer = undefined; });
  await p.hover('[data-key="part-optical-camera"]');
  const order2 = await p.evaluate(() => [...document.querySelectorAll('#preview > *')].map(n => n.className || n.tagName).join(','));
  ok(/cause.*blurb$/.test(order2), 'without PartExplainer the preview lists Causes before the part\'s story: ' + order2);
  await p.evaluate(() => { window.PartExplainer = window.__pe; });
  await card.hover();
  const box = await p.locator('#preview').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
  ok(/ADD SYNTHETIC APERTURE RADAR/.test(await text(p, '#preview')), 'moving the pointer onto the preview keeps it');
  await p.mouse.wheel(0, 300); await p.waitForTimeout(150);
  const sc = await p.evaluate(() => { const n = document.getElementById('preview'); return { top: n.scrollTop, room: n.scrollHeight - n.clientHeight }; });
  ok(sc.room <= 0 || sc.top > 0, 'the wheel scrolls the preview to its hidden lines');
  await card.click();
  ok(await live.evaluate(n => n.isConnected && n === document.getElementById('preview')), 'one preview box (its aria-live region) survives hovers and the redraw after a click');

  // A second BODY FULL (another kind of part) shows up in the preview, both ways.
  await show(p, 'build', { ...NS, parts: ['cubesat-12u', 'optical-camera', 'thermal-imager', 'radio-uhf'] });
  await p.click('[data-key="bin-comms"]'); await p.hover('[data-key="part-radio-sband"]');
  ok(/Causes:[^\n]*comms part/.test(await p.locator('#preview').innerText()), 'a new comms BODY FULL is a Cause while an instrument BODY FULL is already there');
  await p.click('[data-key="part-radio-sband"]'); await p.click('[data-key="bin-instrument"]'); await p.hover('[data-key="part-thermal-imager"]');
  const rem = await p.locator('#preview').innerText();
  ok(/Fixes:[^\n]*1 instrument/.test(rem) && !/comms part/.test(rem), 'removing an instrument Fixes its BODY FULL, and says nothing about the comms one');
  // 1958, sun-synchronous: the era waives the thruster, so no hover says it is needed.
  await show(p, 'build', { ...IGY, orbit: 'sso', launcher: 'vanguard-rocket', parts: ['explorer-body', 'spin-stabilised', 'cosmic-ray-counter', 'minitrack-beacon'] });
  await p.click('[data-key="bin-computer"]'); await p.hover('[data-key="part-command-timer"]');
  ok(!/thrust/.test(await p.locator('#preview').innerText()), '1958 polar orbit: no "needs m/s of thrust" Cause');

  console.log('[Bins and bars]');
  await show(p, 'build', { ...IGY, parts: [] });
  ok(/STRUCTURE/.test(await text(p, '.bin[aria-pressed="true"]')), 'Build opens on the first empty bin (structure)');
  await p.click('[data-key="part-explorer-body"]');
  ok(/STRUCTURE/.test(await text(p, '.bin[aria-pressed="true"]')), '...and stays there after a click');
  await show(p, 'build', { ...IGY, parts: ['explorer-body', 'spin-stabilised', 'cosmic-ray-counter', 'mercury-battery', 'minitrack-beacon', 'command-timer'] });
  ok(/1 \/ 1 slot$/.test(await text(p, '[data-key="bin-instrument"] .bin-sub')), 'one slot reads "1 / 1 slot"');
  const pw = await barText(p, 'POWER');
  ok(/warn/.test(pw) && !/bad/.test(pw) && /Battery only/.test(pw), 'a battery-only design: an amber POWER bar that says so: ' + pw);
  await show(p, 'build', { ...NS, parts: ['explorer-body', 'prop-green-small', 'prop-green-large'] });
  ok(/2 on board, no room/.test(await text(p, '[data-key="bin-propulsion"] .bin-sub')), 'parts the body has no slot for: "2 on board, no room"');
  await show(p, 'launcher', { ...NS, objective: 'weather', orbit: 'sso', launcher: 'thor-able', parts: ['smallsat-bus', 'optical-camera'] });
  ok(/Thor-Able cannot reach this orbit/.test(await barText(p, 'MASS')), 'the MASS note names the chosen rocket that cannot reach the orbit');

  console.log('[Readiness review]');
  await show(p, 'review', { ...NS, launcher: 'small', parts: ['thermal-imager'] });
  await p.locator('.check', { hasText: 'NO POWER' }).locator('button.fix').click();
  ok(await T.waitHead(p, 'BUILD') && /POWER/.test(await text(p, '.bin[aria-pressed="true"]')), 'FIX on NO POWER opens Build on the POWER bin');
  await show(p, 'review', { ...IGY, launcher: 'juno-1', parts: ['explorer-body', 'scintillation-counter', 'mercury-battery', 'minitrack-beacon', 'command-timer', 'spin-stabilised'] });
  const sci = await barText(p, 'SCIENCE FORECAST');
  const want = await p.evaluate(() => { const s = previewScience(window.__d); return Math.round(s.total) + ' / ' + s.target; });
  ok(sci.includes(want + ' PTS') && /warn/.test(sci) && /Short of the target/.test(sci), 'the forecast against the target, amber when short: ' + sci);
  ok(/LAUNCH ANYWAY/.test(await text(p, '.btn.big')) && await p.locator('.btn.big').evaluate(n => n.getBoundingClientRect().bottom <= innerHeight), 'LAUNCH ANYWAY is on screen at 1280x800');

  console.log('[Orbit and Briefing]');
  await show(p, 'orbit', { ...NS, orbit: null });
  ok(!/VIEW/.test(await p.evaluate(() => [...document.querySelectorAll('.card .tag')].map(t => t.innerText).join(' '))), 'no orbit badge says VIEW (the In view line is the view)');
  await show(p, 'briefing', { era: 'new-space' });
  ok(/½: counts half/.test(await text(p, '#app')), 'the Briefing says what the ½ means');

  console.log('[Base map, Part 1 step 1]');
  await p.evaluate(() => window.StarlineUI.home());
  await p.click('[data-key="part1-go"]'); await T.throughBeats(p); await T.waitHead(p, 'BASE MAP'); await p.waitForTimeout(300);
  ok(await p.locator('.map-layout aside h2', { hasText: 'OBJECTIVE' }).count() === 0, 'no second OBJECTIVE box beside the map');
  ok(/GO TO WORKSHOP/.test(await text(p, '[data-key="map-enter"]')), 'the button under the map says where the route goes');
  ok(/M back inside/.test(await text(p, '.keys')) && await p.locator('.keys').getAttribute('aria-label') === null, 'KEYS: "M back inside", as plain text');
  await p.click('[data-key="map-enter"]'); await p.waitForTimeout(2500); await p.keyboard.press('e');
  ok(await T.waitHead(p, 'BUILD') && /LAUNCH PAD/.test(await text(p, '.nav-row .btn.primary')), 'with the rocket preset, GO TO on Build points to the Launch Pad');
  ok(errors.length === 0, 'no errors (desktop)' + (errors.length ? ': ' + errors.join(' / ') : ''));

  console.log('[Phone: iPhone 13, Part 1 step 1 by tapping]');
  ({ p, errors } = await page(b, { ...devices['iPhone 13'] }));
  await p.tap('[data-key="part1-go"]');
  for (let i = 0; i < 6 && await p.locator('.intro').count(); i++) await p.tap('.intro .btn.primary');
  await T.waitHead(p, 'BASE MAP');
  ok(/tap/i.test(await text(p, '#hint')) && await p.locator('.keys-box').isHidden(), 'the map hint says to tap; no keyboard keys on a touch screen');
  ok(await p.evaluate(() => { const m = document.getElementById('map').getBoundingClientRect(); return [...document.querySelectorAll('.blip-name')].filter(n => n.offsetParent).every(n => { const r = n.getBoundingClientRect(); return r.left >= m.left && r.right <= m.right; }); }), 'every place name shown on the map is inside it');
  await p.tap('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
  await p.tap('[data-key="bin-instrument"]');
  const c = '[data-key="part-cosmic-ray-counter"]';
  ok(await p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }, c), 'a bin tap brings its parts into view');
  await p.tap(c);
  const tap = await p.evaluate(s => { const pr = document.getElementById('preview').getBoundingClientRect(), r = document.querySelector(s).getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, Math.min(innerHeight - 2, r.top + r.height / 2));
    return { preview: pr.top >= 0 && pr.bottom <= innerHeight, card: !!hit && document.querySelector(s).contains(hit), armed: (document.querySelector(s + ' .part-tap') || {}).innerText || '' }; }, c);
  ok(tap.preview && /ADD GEIGER/.test(await text(p, '#preview')), 'the first tap shows its preview on screen');
  ok(tap.card && /TAP AGAIN TO ADD/.test(tap.armed), 'the tapped card stays tappable and says TAP AGAIN TO ADD');
  await p.tap(c);
  ok(await p.locator(c).getAttribute('aria-pressed') === 'true', 'the second tap adds it');
  ok(await T.noScroll(p), 'Build: no sideways scroll');
  await p.screenshot({ path: path.join(shots, 'design-screens-phone-build.png') });
  ok(errors.length === 0, 'no errors (phone)' + (errors.length ? ': ' + errors.join(' / ') : ''));

  console.log('[Zoom and narrow screens]');
  ({ p, errors } = await page(b, { viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 }));
  await p.locator('[data-key="part1-go"]').scrollIntoViewIfNeeded(); await p.click('[data-key="part1-go"]');
  ok(await p.evaluate(() => scrollY === 0 && document.querySelector('.intro .kicker').getBoundingClientRect().top >= 0), '200% zoom: a story beat opens at the top');
  ok(errors.length === 0, 'no errors (200% zoom)' + (errors.length ? ': ' + errors.join(' / ') : ''));
  ({ p, errors } = await page(b, { viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 }));
  await show(p, 'briefing', { tier: 'standard', era: 'new-space', objective: 'sea-ice' });
  await p.focus('.nav-row .btn.primary');
  let covered = 0;
  for (let i = 0; i < 10; i++) {
    await p.keyboard.press('Shift+Tab');
    covered = Math.max(covered, await p.evaluate(() => { const a = document.activeElement, t = document.querySelector('.topbar');
      if (t.contains(a) || getComputedStyle(t).position !== 'sticky') return 0; return Math.max(0, t.getBoundingClientRect().bottom - a.getBoundingClientRect().top); }));
  }
  ok(covered === 0, '960x540: the sticky header never covers the focused card (' + Math.round(covered) + ' px)');
  ok(errors.length === 0, 'no errors (960x540)' + (errors.length ? ': ' + errors.join(' / ') : ''));
  ({ p, errors } = await page(b, { viewport: { width: 390, height: 844 } }));
  await p.evaluate(() => { newCampaign('training'); const d = newCampaignDesign(); setObjective(d, 'radiation'); setOrbit(d, 'leo'); window.showDesignScreen('launcher', d); });
  await T.waitHead(p, 'LAUNCH VEHICLE');
  ok(await T.noScroll(p), '390px: locked rocket tags wrap, no sideways scroll');
  await p.evaluate(() => { window.getLiveData = () => ({ status: 'loading', sources: [{ name: 'NOAA', ok: false }] }); window.dispatchEvent(new Event('livedata')); });
  ok(/Checking/.test(await p.locator('#data-badge').getAttribute('title')), 'while loading, the badge says it is checking');
  ok(errors.length === 0, 'no errors (390px)' + (errors.length ? ': ' + errors.join(' / ') : ''));

  await b.close();
  done();
})();
