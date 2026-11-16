// Accessibility on every main screen (version 2.1): axe-core runs on each screen after it has settled, and the test fails on
// any serious or critical violation. It also walks the home page, the Quick menu, Build, the workshop and the debrief by
// keyboard only (Tab reaches the controls, Enter and Space activate, Escape closes the preview, focus is always visible).
//
// axe-core is not in the repo: pass its path in AXE (default /tmp/axe/package/axe.min.js, or node_modules/axe-core). No axe = SKIPPED.
// Usage: node v21-a11y.js [shots dir]   or   node v21-a11y.js <repo dir> <shots dir>      ALL=1 prints the moderate and minor findings too.
const fs = require('fs');
const path = require('path');
const T = require('./lib');
let chromium;
try { chromium = require('playwright').chromium; } catch (e) { T.skipped('Playwright is not installed'); }
const AXE = [process.env.AXE, '/tmp/axe/package/axe.min.js', path.join(__dirname, 'node_modules/axe-core/axe.min.js')].filter(Boolean).find(f => fs.existsSync(f));
if (!AXE) T.skipped('axe-core not found (set AXE=<path to axe.min.js>)');
const { url } = T.args();
const { ok, done } = T.checker();
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const seen = {};

// One audit: wait for the entry animations (a mid-fade reading reports false contrast failures), then run axe.
// label-content-name-mismatch (off by default in axe) is on: an aria-label must contain the words on the button (voice control).
async function audit(p, name) {
  await p.waitForTimeout(1500);
  // the story's lines fade in one after another (css/story.css): wait for every animation that ends, up to 12 s
  await p.evaluate(() => Promise.race([new Promise(r => setTimeout(r, 12000)), Promise.all(document.getAnimations().filter(a => a.effect && a.effect.getComputedTiming().endTime !== Infinity).map(a => a.finished.catch(() => 0)))]));
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
  const v = await p.evaluate(() => axe.run(document, { resultTypes: ['violations'], preload: false, rules: { 'label-content-name-mismatch': { enabled: true } } }).then(r => r.violations.map(x => ({
    id: x.id, impact: x.impact, nodes: x.nodes.length,
    where: x.nodes.slice(0, 4).map(n => n.target.join(' ').slice(0, 90) + ' :: ' + (n.html || '').slice(0, 110)),
    why: ((x.nodes[0].any[0] || x.nodes[0].all[0] || x.nodes[0].none[0] || {}).message || '').slice(0, 200) }))));
  const bad = v.filter(x => x.impact === 'serious' || x.impact === 'critical');
  const rest = v.filter(x => bad.indexOf(x) === -1);
  ok(!bad.length, name + ': no serious or critical violation' + (rest.length ? ' (' + rest.map(x => x.id).join(', ') + ' are moderate or minor)' : ''));
  for (const x of (process.env.ALL ? v : bad)) {
    const k = x.id + '|' + x.where[0];
    console.log('       ' + x.impact + ' ' + x.id + ' x' + x.nodes + (seen[k] ? ' (as on ' + seen[k] + ')' : ': ' + x.why));
    if (!seen[k]) x.where.forEach(w => console.log('         ' + w));
    seen[k] = seen[k] || name;
  }
}
// Keyboard: Tab from the top of the page until focus returns to the body or repeats; the data-keys (or text) of what took focus,
// and whether each focused control showed a focus mark (an outline or a box-shadow change).
async function tabOrder(p, max) {
  await p.evaluate(() => { if (document.activeElement) document.activeElement.blur(); scrollTo(0, 0); window.__tabRound = (window.__tabRound || 0) + 1; });
  const out = [];
  for (let i = 0, off = 0; i < (max || 80); i++) {
    await p.keyboard.press('Tab');
    const f = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null;
      if (e.__tabRound === window.__tabRound) return 'again';   // once round the page
      e.__tabRound = window.__tabRound;
      const ring = s => s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
      const s = getComputedStyle(e), a = getComputedStyle(e, '::after'), kid = e.querySelector('.blip-num');   // the home buttons draw the ring on ::after, a map blip on its number
      return { key: e.getAttribute('data-key') || e.id || (e.textContent || '').trim().slice(0, 24) || e.tagName, mark: ring(s) || ring(a) || s.boxShadow !== 'none' || !!(kid && getComputedStyle(kid).boxShadow !== 'none') }; });
    if (f === 'again') break;
    if (!f) { if (++off > 2) break; continue; }   // Tab left the page (the browser's own bar) and comes back at the top
    out.push(f);
  }
  return out;
}
const reaches = (order, keys) => keys.filter(k => !order.some(f => typeof k === 'string' ? f.key === k : k.test(f.key)));
const marked = order => order.filter(f => !f.mark).map(f => f.key);
async function fresh(b, opts) {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 }, opts || {}));
  const p = await ctx.newPage();
  await T.noFonts(p);
  await p.route(/services\.swpc\.noaa\.gov|eonet\.gsfc\.nasa\.gov|cwfis\.cfs\.nrcan\.gc\.ca/, r => r.abort());
  p.__errors = T.watchErrors(p); at = p;
  await p.goto(url); await p.locator('.big-title').waitFor({ timeout: 15000 });
  return p;
}
// Fly to the first event (audited), then on to the debrief.
async function flight(p, tag) {
  await p.click('button:has-text("PAUSE")'); await audit(p, tag + ' mission'); await p.click('button:has-text("RESUME")');
  await p.click('button[aria-label="Fast forward"]');
  let ev = false;
  for (let i = 0; i < 900; i++) {
    if (await T.head(p, 'DEBRIEF').count()) break;
    if (await p.locator('[role="alertdialog"] .choices .btn').count()) {
      if (!ev) { ev = true; await audit(p, tag + ' event'); }
      await p.locator('[role="alertdialog"] .choices .btn').first().click();
    }
    await p.waitForTimeout(50);
  }
  ok(await T.waitHead(p, 'DEBRIEF'), tag + ': the flight reaches the debrief');
  await p.evaluate(() => scrollTo(0, 0));
  await audit(p, tag + ' debrief (DETAILS closed)');
  await p.evaluate(() => { const d = document.querySelector('[data-key="debrief-details"]'); if (d) d.open = true; });
  await audit(p, tag + ' debrief (DETAILS open)');
}
let at = null;   // the page of the section that is running, for the note on a failure
const section = async (name, fn) => { if (ONLY && ONLY.indexOf(name) === -1) return; console.log('-- ' + name);
  try { await fn(); } catch (e) { const where = at ? await at.evaluate(() => (document.querySelector('.screen-head h1') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 80)).catch(() => '') : '';
    ok(false, name + ': ' + String(e).split('\n').slice(0, 3).join(' ').slice(0, 300) + ' [on: ' + where + ']'); } };

(async () => {
  const b = await chromium.launch();
  try {
    // ---------------------------------------------------------------- Part 1 (the 1958 look)
    await section('part1', async () => {
      const p = await fresh(b);
      await audit(p, 'home (new player)');
      const order = await tabOrder(p);
      ok(!reaches(order, ['part1-go', 'part2-go', 'quick-go']).length, 'keyboard, home: Tab reaches the three start buttons (' + order.map(f => f.key).join(' ') + ')');
      ok(!marked(order).length, 'keyboard, home: every focused control shows a focus mark' + (marked(order).length ? ' (not: ' + marked(order).join(', ') + ')' : ''));
      await p.focus('[data-key="part1-go"]'); await p.keyboard.press('Enter');
      ok(await p.locator('.intro').count() === 1, 'keyboard, home: Enter on the Part 1 button starts the story');
      await audit(p, 'Part 1 story beat');
      await T.pastScenes(p); await T.waitHead(p, 'BASE MAP');
      await audit(p, 'Part 1 base map');
      await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
      await audit(p, 'Part 1 Build (empty)');
      await p.click('[data-key="bin-power"]');
      await audit(p, 'Part 1 Build (a bin open)');
      // keyboard: a bin, then a card, with Space and Enter; Escape closes the preview and focus stays on the card
      await p.focus('[data-key="bin-structure"]'); await p.keyboard.press('Space');
      await p.focus('[data-key="part-explorer-body"]'); await p.keyboard.press('Enter');
      ok(await p.getAttribute('[data-key="part-explorer-body"]', 'aria-pressed') === 'true', 'keyboard, Build: Space opens a bin and Enter fits a part');
      ok(await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-key')) === 'part-explorer-body', 'keyboard, Build: focus stays on the card that was fitted');
      await p.keyboard.press('Escape');
      ok(await T.waitHead(p, 'BASE MAP'), 'keyboard, Build: Escape goes back to the base map');
      await p.keyboard.press('Escape');
      ok(await T.waitHead(p, 'BUILD'), 'keyboard, base map: Escape goes back inside');
      await T.addParts(p, T.WALK[1].parts.filter(x => x !== 'explorer-body'));
      await audit(p, 'Part 1 Build (with parts)');
      const bo = await tabOrder(p, 120);
      ok(!reaches(bo, [/^bin-/, /^part-/]).length, 'keyboard, Build: Tab reaches the bins, the cards and the next button (' + bo.length + ' stops: ' + bo.map(f => f.key).join(' ').slice(0, 400) + ')');
      ok(!marked(bo).length, 'keyboard, Build: every focused control shows a focus mark' + (marked(bo).length ? ' (not: ' + marked(bo).join(', ') + ')' : ''));
      await p.click('.nav-row .btn.primary');   // step 1 presets the rocket, so the next screen is the Readiness review
      await p.locator('.screen-head h1').filter({ hasText: /LAUNCH VEHICLE|READINESS/ }).waitFor({ timeout: 20000 });
      if (await T.head(p, 'LAUNCH VEHICLE').count()) { await audit(p, 'Part 1 Rocket Yard'); await p.click('.nav-row .btn.primary'); }
      await T.waitHead(p, 'READINESS');
      await audit(p, 'Part 1 Readiness (READY)');
      await p.locator('.btn.big').click(); await T.waitHead(p, 'MISSION');
      await flight(p, 'Part 1');
      const dk = await tabOrder(p, 60);
      ok(dk.some(f => /debrief|redesign|next|again/i.test(f.key)) && !marked(dk).length, 'keyboard, debrief: Tab reaches its buttons, each with a focus mark (' + dk.map(f => f.key).join(' ') + ')');
      await T.reopen(p);
      await audit(p, 'home (returning player)');
      if (await p.locator('[data-key^="journal"]').count()) {
        await p.locator('[data-key^="journal"]').first().click(); await p.locator('[data-key="journal"]').waitFor({ timeout: 5000 });
        await audit(p, 'journal');
        await p.keyboard.press('Escape');
        ok(await p.locator('[data-key="journal"]').count() === 0, 'keyboard, journal: Escape closes it');
      }
      await p.evaluate(() => window.showChronicle && window.showChronicle());
      await audit(p, 'Part 1 ending screen');
      ok(!p.__errors.length, 'Part 1: no page error' + (p.__errors.length ? ': ' + p.__errors[0] : ''));
      await p.context().close();
    });
    // ---------------------------------------------------------------- Part 2 on Normal (the modern look)
    await section('part2', async () => {
      const p = await fresh(b);
      await T.seedRuns(p); await p.click('[data-key="part2-go"]');
      await audit(p, 'Part 2 picker');
      await p.click('[data-key="level-standard"]');
      await audit(p, 'Part 2 story beat');
      await T.pastScenes(p); await T.waitHead(p, 'WORKSHOP');
      await audit(p, 'workshop (with the ledger strip)');
      const wo = await tabOrder(p, 120);
      ok(!reaches(wo, [/^borrow-/, /^fly-/, 'credit-why']).length || !reaches(wo, [/^borrow-/, /^fly-/]).length, 'keyboard, workshop: Tab reaches BORROW and FLY THIS (' + wo.length + ' stops)');
      ok(!marked(wo).length, 'keyboard, workshop: every focused control shows a focus mark' + (marked(wo).length ? ' (not: ' + marked(wo).join(', ') + ')' : ''));
      await p.locator('[data-key="credit-why"] summary').focus(); await p.keyboard.press('Enter');
      ok(await p.evaluate(() => document.querySelector('[data-key="credit-why"]').open), 'keyboard, workshop: Enter opens the credit WHY');
      await audit(p, 'workshop (credit WHY open)');
      await p.locator('button[data-key^="borrow-"]').first().focus(); await p.keyboard.press('Space');
      await p.locator('#borrow-note').waitFor({ timeout: 5000 });
      await audit(p, 'workshop (after a loan)');
      await p.click('[data-key="fly-solar"]'); await T.waitHead(p, 'BASE MAP');
      await audit(p, 'Part 2 base map');
      await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
      await p.click('[data-key="bin-instrument"]');
      await audit(p, 'Part 2 Build on Normal (unbought cards)');
      await T.buyInfo(p, ['oso-xray-spectrometer']);
      await audit(p, 'Part 2 Build on Normal (paid-info cards)');
      await T.addParts(p, T.CONTRACT.solar.parts);
      await p.mouse.move(2, 2);
      await audit(p, 'Part 2 Build on Normal (with parts, verdict gauges)');
      const bo = await tabOrder(p, 160);
      ok(!reaches(bo, [/^bin-/, /^part-/, /^ask-/]).length, 'keyboard, Part 2 Build: Tab reaches the bins, the cards and the ASK buttons (' + bo.length + ' stops: ' + bo.map(f => f.key).join(' ').slice(0, 400) + ')');
      ok(!marked(bo).length, 'keyboard, Part 2 Build: every focused control shows a focus mark' + (marked(bo).length ? ' (not: ' + marked(bo).join(', ') + ')' : ''));
      if (await p.locator('[data-key^="later-"]').count()) {
        const later = p.locator('[data-key^="later-"]').first(); await later.focus(); const was = await later.getAttribute('aria-expanded'); await p.keyboard.press('Enter');
        ok(await p.locator('[data-key^="later-"]').first().getAttribute('aria-expanded') !== was, 'keyboard, Part 2 Build: Enter works SHOW LATER PARTS');
      }
      await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'LAUNCH VEHICLE');
      await p.click('[data-key="rocket-rideshare"]');
      await audit(p, 'Part 2 Rocket Yard');
      await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'READINESS');
      await audit(p, 'Part 2 Readiness');
      await p.locator('.btn.big').click(); await T.waitHead(p, 'MISSION');
      await flight(p, 'Part 2');
      // an ending screen
      await p.evaluate(() => { const c = getCampaign(); c.finished = true; c.won = true; c.debt_musd = 0; saveCampaign(c); showComebackEnding(); });
      await audit(p, 'Part 2 ending screen');
      ok(!p.__errors.length, 'Part 2: no page error' + (p.__errors.length ? ': ' + p.__errors[0] : ''));
      await p.context().close();
    });
    // ---------------------------------------------------------------- Part 2 Build on Easy and on Hard, and a HOLD
    for (const tier of ['training', 'expert']) {
      await section(tier, async () => {
        const p = await fresh(b);
        await T.startComeback(p, tier);
        await p.locator('button[data-key^="fly-"]').first().click(); await T.waitHead(p, 'BASE MAP');
        await p.click('[data-key="blip-build"]');   // a contract that names no orbit sends the player to the Tracking Station first
        if (!(await T.head(p, 'BUILD').waitFor({ timeout: 2500 }).then(() => true, () => false))) {
          await p.click('[data-key="blip-orbit"]'); await T.waitHead(p, 'ORBIT');
          await audit(p, 'Part 2 orbit screen');
          const leo = p.locator('button[data-key="orbit-leo"]:not([disabled])'); if (await leo.count()) await leo.click();
          await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'BUILD');
        }
        await p.click('[data-key="bin-instrument"]');
        if (tier === 'expert') await T.buyBin(p, ['sheet']);
        await T.addParts(p, ['cubesat-12u', 'spin-stabilised']);
        await p.mouse.move(2, 2);
        await audit(p, 'Part 2 Build on ' + (tier === 'expert' ? 'Hard (paid-info cards)' : 'Easy'));
        if (tier === 'expert') {   // an unfinished design: the Readiness review holds
          await p.click('.nav-row .btn.primary');
          if (await T.waitHead(p, 'LAUNCH VEHICLE')) { await p.click('.nav-row .btn.primary'); if (await T.waitHead(p, 'READINESS')) await audit(p, 'Readiness (HOLD)'); }
        }
        await p.context().close();
      });
    }
    // ---------------------------------------------------------------- Quick mode, the leaderboard and the duel with online off
    await section('quick', async () => {
      const p = await fresh(b);
      await p.focus('[data-key="quick-go"]'); await p.keyboard.press('Enter');
      await p.locator('[data-key="quick-menu"]').waitFor({ timeout: 5000 });
      await audit(p, 'Quick menu (online off)');
      const order = await tabOrder(p);
      ok(!reaches(order, ['quick-flight', 'online-home']).length && !marked(order).length, 'keyboard, Quick menu: Tab reaches QUICK FLIGHT and HOME, each with a focus mark (' + order.map(f => f.key).join(' ') + ')');
      await p.evaluate(() => window.StarlineOnline.showLeaderboard());
      await audit(p, 'leaderboard (online off)');
      await p.evaluate(() => window.StarlineOnline.showDuel());
      await audit(p, 'duel (online off)');
      await p.evaluate(() => window.StarlineOnline.showQuickMenu());
      await p.focus('[data-key="quick-flight"]'); await p.keyboard.press('Space');
      await p.locator('[data-key="quick-job"]').waitFor({ timeout: 5000 });
      await audit(p, 'Quick flight (the job)');
      await p.context().close();
    });
    // ---------------------------------------------------------------- a phone: 390 wide with touch
    await section('phone', async () => {
      const p = await fresh(b, { viewport: { width: 390, height: 844 }, hasTouch: true });
      const small = () => p.evaluate(() => [...document.querySelectorAll('button, a[href], summary, input, select')].filter(e => e.getClientRects().length && !e.disabled).map(e => [e, e.getBoundingClientRect()])
        .filter(x => x[1].width && (x[1].height < 43.5 || x[1].width < 43.5)).map(x => (x[0].getAttribute('data-key') || x[0].textContent.trim().slice(0, 20) || x[0].tagName) + ' ' + Math.round(x[1].width) + 'x' + Math.round(x[1].height)));
      const size = async name => { const s = await small(); ok(!s.length, name + ': every control is at least 44px to a side' + (s.length ? ' (not: ' + [...new Set(s)].slice(0, 8).join(', ') + ')' : '')); };
      await audit(p, 'phone home'); await size('phone home');
      await T.startComeback(p, 'standard');
      await audit(p, 'phone workshop'); await size('phone workshop');
      await p.click('[data-key="fly-solar"]'); await T.waitHead(p, 'BASE MAP');
      await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
      await p.click('[data-key="bin-instrument"]');
      await audit(p, 'phone Build'); await size('phone Build');
      await p.context().close();
    });
  } finally { await b.close(); }
  done();
})().catch(e => { console.error(e); process.exit(1); });
