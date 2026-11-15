// The low-poly art in the game screens: the Build bench, portraits, the Readiness pad, the lift-off, the mission
// Earth and the base map. Each check runs at desktop and phone width, then again with js/lowpoly.js blocked (the
// old pixel art must come back) and with reduced motion (every scene still, no lift-off).
// Usage: node lowpoly.js <repo dir> <shots dir>      (run it from outside the repo: screenshots go to <shots dir>)
// It opens each screen straight from a design built with the back end's own calls, so it does not depend on the title.
const { chromium } = require('playwright');
const path = require('path');
const repo = process.argv[2] || process.cwd(), shots = process.argv[3] || require('os').tmpdir();
const url = 'file://' + path.join(repo, 'index.html');

let failures = 0;
function ok(cond, msg) { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) failures++; }
const IGNORE = /fonts\.(googleapis|gstatic)|services\.swpc\.noaa\.gov|eonet\.gsfc\.nasa\.gov|cwfis\.cfs\.nrcan\.gc\.ca/;
const PARTS = ['smallsat-bus', 'reaction-wheels', 'sar-radar', 'solar-large', 'radio-xband', 'obc-basic', 'battery-28v', 'prop-green-large'];

async function open(viewport, mode) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: mode === 'reduce' ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  // With the engine blocked on purpose, its own failed request is expected; nothing else is.
  page.on('console', m => { const u = (m.location() || {}).url || ''; if (m.type() === 'error' && !IGNORE.test(u) && !(mode === 'block' && /\/js\/lowpoly\.js$/.test(u))) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  if (mode === 'block') await page.route(/\/js\/lowpoly\.js$/, r => r.abort());
  await page.goto(url);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  return { browser, page, errors };
}
// A design in the 2026 era, sea ice from a polar orbit, opened on a screen. parts / launcher are optional.
function show(page, screen, parts, launcher) {
  return page.evaluate(([screen, parts, launcher]) => {
    const d = newDesign('training'); setEra(d, 'new-space'); setObjective(d, 'sea-ice'); setOrbit(d, 'sso');
    parts.forEach(id => addPart(d, id));
    if (launcher) setLauncher(d, launcher);
    window.showDesignScreen(screen, d);
  }, [screen, parts || [], launcher || null]);
}
const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const head = (page, text) => page.locator('.screen-head h1', { hasText: text }).waitFor({ timeout: 8000 }).then(() => true, () => false);
// A fingerprint of a canvas's pixels (changes when anything moves).
const pixels = (page, sel) => page.locator(sel).first().evaluate(c => { try { const s = c.toDataURL(); let h = 0; for (let i = 0; i < s.length; i += 7) h = (h * 31 + s.charCodeAt(i)) | 0; return h; } catch (e) { return null; } });

async function lowPolyOn(viewport, label) {
  console.log(`[${label}: low-poly]`);
  const { browser, page, errors } = await open(viewport, '');
  const cat = {}; (await page.evaluate(() => PARTS.map(p => [p.id, p.category]))).forEach(([id, c]) => { cat[id] = c; });

  // Build: an empty cradle, then parts clicked on one by one.
  await show(page, 'build', []);
  ok(await head(page, 'BUILD'), 'Build screen');
  const bench = page.locator('.bench canvas.sat.lp-sat');
  ok(await bench.count() === 1, 'the bench draws the satellite in one low-poly canvas (.bench canvas.sat)');
  ok(/cradle/i.test(await bench.getAttribute('aria-label')), 'an empty design is an assembly cradle in the label');
  const click = async id => { await page.click(`[data-key="bin-${cat[id]}"]`); await page.click(`[data-key="part-${id}"]`); };
  for (const id of PARTS) await click(id);
  await click('optical-camera'); await click('solar-small'); await click('radio-sband'); await click('obc-radtol');
  const lab = await page.locator('.bench canvas').getAttribute('aria-label');
  ok(/Modern smallsat bus/.test(lab) && /Synthetic aperture radar/.test(lab) && /12 parts/.test(lab), 'the label names the body and the parts (12 parts)');
  ok(await page.locator('.bench .sat-tag').count() === 1 && /\+ RADIATION-TOLERANT COMPUTER/.test(await page.locator('.bench .sat-tag').innerText()), 'the part just added gets its name tag');
  ok(await page.locator('.bench canvas').evaluate(c => c.width > 0 && c.height > 0), 'the canvas was drawn');
  await page.mouse.move(0, 0);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(shots, `lowpoly-${label}-build.png`), fullPage: true });
  ok(await noSideScroll(page), 'Build: no sideways scroll');
  // 15 quick clicks on one card (add, remove, add...): the page must keep drawing frames.
  await page.click('[data-key="bin-power"]');
  const burst = await page.evaluate(() => new Promise(res => {
    const stamps = [], handler = []; let n = 0;
    (function f(t) { stamps.push(t); if (stamps.length < 120) requestAnimationFrame(f); })(performance.now());
    const iv = setInterval(() => {
      const t0 = performance.now(); document.querySelector('[data-key="part-n-on-p-cells"], [data-key="part-solar-small"]').click(); handler.push(performance.now() - t0);
      if (++n >= 15) { clearInterval(iv); setTimeout(() => { let g = 0; for (let i = 1; i < stamps.length; i++) g = Math.max(g, stamps[i] - stamps[i - 1]); res({ gap: g, slowest: Math.max(...handler) }); }, 500); }
    }, 70);
  }));
  console.log(`     15 quick clicks: slowest click ${burst.slowest.toFixed(1)} ms (screen rebuilt, satellite scene built), longest gap between frames ${burst.gap.toFixed(1)} ms`);
  ok(burst.gap < 150 && burst.slowest < 150, 'the bench stays responsive through 15 quick clicks');
  ok(await page.locator('.bench canvas').count() === 1, '...and still shows one canvas');
  const a = await pixels(page, '.bench canvas'); await page.waitForTimeout(400); const b = await pixels(page, '.bench canvas');
  ok(a !== null && a !== b, 'the satellite turns slowly on the bench');

  // Portraits: the story speaker as a low-poly bust (an <img class="portrait">).
  const face = page.locator('.say img.portrait').first();
  ok(await face.count() === 1 && (await face.getAttribute('alt')).length > 10, 'speaker portrait is a low-poly picture with alt text');

  // Readiness review: the chosen rocket on the pad, the small satellite.
  await show(page, 'review', PARTS, 'small');
  ok(await head(page, 'READINESS'), 'Readiness review');
  ok(await page.locator('.pad canvas.scene.lp-pad').count() === 1, 'the pad is a low-poly canvas');
  ok(/small dedicated launcher/i.test(await page.locator('.pad canvas.lp-pad').getAttribute('aria-label')), '...with the chosen rocket in its label');
  ok(await page.locator('.sat-small canvas').count() === 1, 'the small satellite is a low-poly canvas');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shots, `lowpoly-${label}-review.png`), fullPage: true });
  ok(await noSideScroll(page), 'Readiness: no sideways scroll');

  // LAUNCH: the lift-off for a moment, then the mission screen.
  const t0 = Date.now();
  await page.click('.btn.big');
  ok(await page.locator('.launch-show').count() === 1, 'LAUNCH shows the lift-off');
  ok(await page.locator('.screen-head h1', { hasText: 'READINESS' }).count() === 1, '...over the Readiness review (the screen has not changed yet)');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(shots, `lowpoly-${label}-liftoff.png`) });
  ok(await head(page, 'MISSION'), 'then the mission screen');
  const took = Date.now() - t0;
  console.log(`     lift-off lasted ${took} ms`);
  ok(took > 1800 && took < 3200, 'the lift-off ends by itself in about 2.5 s');
  ok(await page.locator('.launch-show').count() === 0, '...and is gone');
  ok(await page.locator('.mission-earth').count() === 1, 'the mission screen shows a small Earth with the orbit');
  await page.click('button[aria-label="Pause the mission"]');
  await page.screenshot({ path: path.join(shots, `lowpoly-${label}-mission.png`), fullPage: true });
  ok(await noSideScroll(page), 'Mission: no sideways scroll');

  // A click skips the lift-off.
  await show(page, 'review', PARTS, 'small');
  await head(page, 'READINESS');
  const t1 = Date.now();
  await page.click('.btn.big');
  await page.waitForTimeout(200);
  await page.mouse.click(viewport.width / 2, 100);
  ok(await head(page, 'MISSION') && Date.now() - t1 < 1500, 'a click skips the lift-off');
  // So does a key, and M cannot open the map: the design is locked from the click on.
  await show(page, 'review', PARTS, 'small');
  await head(page, 'READINESS');
  const t2 = Date.now();
  await page.click('.btn.big');
  await page.waitForTimeout(200);
  await page.keyboard.press('m');
  ok(await head(page, 'MISSION') && Date.now() - t2 < 1500 && await page.locator('.screen-head h1', { hasText: 'BASE MAP' }).count() === 0, 'a key skips it too, and M does not open the map');

  // The base map, when it is low-poly: the canvas sits under the markers, which keep their places.
  await show(page, 'map', PARTS);
  await head(page, 'BASE MAP');
  await page.waitForTimeout(400);
  // Every marker's centre against the scene's own project(x, y) for that canvas size, in CSS pixels.
  const alignment = () => page.evaluate(() => {
    const map = document.getElementById('map'), c = map.querySelector('canvas.map-lp');
    if (!c) return null;
    const cr = c.getBoundingClientRect(), s = LowPoly.scenes.base({ width: c.clientWidth, height: c.clientHeight });
    const nodes = { briefing: [40, 40], orbit: [100, 40], review: [160, 40], build: [40, 86], launcher: [100, 86] };
    let worst = 0;
    map.querySelectorAll('.blip').forEach(b => {
      const r = b.getBoundingClientRect(), n = nodes[b.dataset.key.slice(5)], p = s.project(n[0], n[1]);
      worst = Math.max(worst, Math.abs(r.left + r.width / 2 - cr.left - p[0]), Math.abs(r.top + r.height / 2 - cr.top - p[1]));
    });
    return { worst, same: c.clientWidth === map.clientWidth && c.clientHeight === map.clientHeight, drawn: map.classList.contains('lp-on') };
  });
  const al = await alignment();
  ok(!!al && al.drawn, 'the base map is a low-poly canvas under the markers');
  if (al) {
    console.log(`     markers are within ${al.worst.toFixed(2)} px of the scene's project(x, y)`);
    ok(al.same && al.worst <= 1, 'the canvas fills the map box and every marker sits on its place (within 1 px)');
    ok(await page.locator('.map canvas').getAttribute('aria-hidden') === 'true', 'the low-poly map is decoration (aria-hidden)');
    ok(await page.locator('.blip').count() === 5 && (await page.locator('.map .map-route').getAttribute('points')).split(' ').length >= 2, 'markers and the gold route stay on top');
    ok(await page.locator('#minimap').isHidden() || await page.locator('#minimap image').count() === 1, 'the header minimap, when shown, is the low-poly picture');
    // A new window size gives the map box a new shape: the scene is built again and still lines up.
    await page.setViewportSize({ width: viewport.width === 1280 ? 1000 : 360, height: viewport.height });
    await page.waitForTimeout(400);
    const al2 = await alignment();
    ok(!!al2 && al2.same && al2.worst <= 1, `after a resize the markers still line up (within ${al2 ? al2.worst.toFixed(2) : '?'} px)`);
    await page.setViewportSize(viewport);
  }
  await page.screenshot({ path: path.join(shots, `lowpoly-${label}-map.png`), fullPage: true });
  ok(await noSideScroll(page), 'Map: no sideways scroll');
  // The minimap inside a place.
  await page.click('[data-key="legend-briefing"]');
  ok(await head(page, 'BRIEFING') && await page.locator('#minimap image').count() === 1, 'the header minimap is the low-poly picture, drawn once and kept');

  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await browser.close();
}

async function lowPolyBlocked(viewport, label) {
  console.log(`[${label}: js/lowpoly.js blocked]`);
  const { browser, page, errors } = await open(viewport, 'block');
  ok(await page.evaluate(() => typeof LowPoly === 'undefined'), 'the engine did not load');
  await show(page, 'build', PARTS);
  ok(await head(page, 'BUILD'), 'Build screen');
  ok(await page.locator('.bench svg.sat').count() === 1 && await page.locator('.bench canvas').count() === 0, 'the bench shows the pixel satellite');
  ok(await page.locator('.say svg.portrait').count() >= 1 && await page.locator('img.portrait').count() === 0, 'portraits are pixel art');
  await show(page, 'review', PARTS, 'small');
  ok(await page.locator('.pad svg.scene').count() === 1, 'the Readiness review shows the pixel pad');
  await page.click('.btn.big');
  ok(await page.locator('.launch-show').count() === 0, 'LAUNCH goes straight on, no lift-off');
  ok(await head(page, 'MISSION'), 'mission screen');
  ok(await page.locator('.mission-earth').count() === 0, 'no Earth canvas on the mission screen');
  await show(page, 'map', PARTS);
  ok(await head(page, 'BASE MAP') && await page.locator('.map svg.map-art').count() === 1, 'the base map is the pixel map');
  ok(await noSideScroll(page), 'no sideways scroll');
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await browser.close();
}

async function reducedMotion(viewport, label) {
  console.log(`[${label}: reduced motion]`);
  const { browser, page, errors } = await open(viewport, 'reduce');
  await show(page, 'build', PARTS.slice(0, 5));
  await head(page, 'BUILD');
  await page.click('[data-key="bin-power"]'); await page.click('[data-key="part-battery-28v"]');
  await page.waitForTimeout(150);
  const a = await pixels(page, '.bench canvas'); await page.waitForTimeout(700); const b = await pixels(page, '.bench canvas');
  ok(a !== null && a === b, 'the bench satellite holds still (no spin, no fly-in)');
  await show(page, 'review', PARTS, 'small');
  await head(page, 'READINESS');
  const c = await pixels(page, '.pad canvas'); await page.waitForTimeout(700); const d = await pixels(page, '.pad canvas');
  ok(c !== null && c === d, 'the pad holds still');
  await page.click('.btn.big');
  ok(await page.locator('.launch-show').count() === 0, 'no lift-off under reduced motion');
  ok(await head(page, 'MISSION'), 'LAUNCH opens the mission screen at once');
  await page.click('button[aria-label="Pause the mission"]');
  const e = await pixels(page, '.mission-earth'); await page.waitForTimeout(700); const f = await pixels(page, '.mission-earth');
  ok(e !== null && e === f, 'the mission Earth holds still');
  await show(page, 'map', PARTS);
  await head(page, 'BASE MAP');
  await page.waitForTimeout(300);
  const g = await pixels(page, '.map canvas'); await page.waitForTimeout(700); const h = await pixels(page, '.map canvas');
  ok(g !== null && g === h, 'the base map holds still (no dish slew, no blinking beacons)');
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await browser.close();
}

(async () => {
  for (const [viewport, label] of [[{ width: 1280, height: 800 }, 'desktop'], [{ width: 390, height: 844 }, 'phone']]) {
    await lowPolyOn(viewport, label);
    await lowPolyBlocked(viewport, label);
    await reducedMotion(viewport, label);
  }
  console.log(failures ? `FAILED ${failures}` : 'PASSED');
  process.exit(failures ? 1 : 0);
})();
