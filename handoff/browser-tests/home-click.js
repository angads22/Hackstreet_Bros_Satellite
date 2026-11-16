// A click ANYWHERE on a home mode panel opens that mode, not only on the button's words. The panel's own click handler
// does it (so it does not depend on the stretched hit area of the button's CSS): the test turns that CSS off, then
// clicks the panel's title, its empty padding, its step line, and checks the JOURNAL button is left alone.
// Usage: node home-click.js [shots dir]   or   node home-click.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const T = require('./lib');
const { url } = T.args();
const { ok, done } = T.checker();

(async () => {
  const b = await chromium.launch();
  for (const [label, viewport] of [['desktop', { width: 1366, height: 768 }], ['phone', { width: 390, height: 844 }]]) {
    console.log(`[${label}]`);
    const fresh = async () => {
      const p = await b.newPage({ viewport });
      const errors = T.watchErrors(p);
      await T.noFonts(p);
      await p.goto(url); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await p.reload();
      await p.addStyleTag({ content: '.mode-go .btn::after { display: none !important; }' });   // only the panel's own handler can answer
      return { p, errors };
    };
    // Part 1: its title, then its padding (the top-left corner inside the cut), then its step line
    for (const where of ['h2', 'padding', 'steps']) {
      const { p, errors } = await fresh();
      const card = p.locator('[data-key="mode-part1"]');
      if (where === 'padding') { const bx = await card.boundingBox(); await p.mouse.click(bx.x + 40, bx.y + 6); }
      else await p.click(where === 'h2' ? '[data-key="mode-part1"] h2' : '[data-key="mode-part1"] .mode-steps');
      const opened = await p.locator('.intro, .screen-head h1').first().waitFor({ timeout: 4000 }).then(() => true, () => false);
      ok(opened && await p.locator('[data-key="mode-part1"]').count() === 0, `Part 1: a click on the panel's ${where} opens Part 1`);
      ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
      await p.close();
    }
    // Part 2: the same
    for (const where of ['h2', 'padding']) {
      const { p, errors } = await fresh();
      const card = p.locator('[data-key="mode-part2"]');
      if (where === 'padding') { const bx = await card.boundingBox(); await p.mouse.click(bx.x + 40, bx.y + 6); }
      else await p.click('[data-key="mode-part2"] h2');
      ok(await p.locator('.cb-level').first().waitFor({ timeout: 4000 }).then(() => true, () => false) && await p.locator('.cb-level').count() === 3,
        `Part 2: a click on the panel's ${where} opens the difficulty picker`);
      ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
      await p.close();
    }
    // Quick mode (the third card): the same, and it opens the QUICK MODE menu
    for (const where of ['h2', 'padding']) {
      const { p, errors } = await fresh();
      const card = p.locator('[data-key="mode-quick"]');
      if (where === 'padding') { const bx = await card.boundingBox(); await p.mouse.click(bx.x + 40, bx.y + 6); }
      else await p.click('[data-key="mode-quick"] h2');
      ok(await p.locator('[data-key="quick-menu"]').waitFor({ timeout: 4000 }).then(() => true, () => false),
        `Quick mode: a click on the panel's ${where} opens the QUICK MODE menu`);
      ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
      await p.close();
    }
    // The button itself still works once (one press, not two)
    {
      const { p } = await fresh();
      await p.evaluate(() => { window.__starts = 0; const o = window.showComebackStart; window.showComebackStart = function () { window.__starts++; return o.apply(this, arguments); }; });
      await p.click('[data-key="part2-go"]');
      await p.waitForTimeout(300);
      ok(await p.evaluate(() => window.__starts) === 1, 'pressing the button itself starts the mode once (not twice)');
      await p.close();
    }
    // JOURNAL, when it shows, is its own button: it opens the journal, not the mode
    {
      const p = await b.newPage({ viewport });
      await T.noFonts(p);
      await p.goto(url); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await p.reload();
      const has = await p.locator('[data-key^="journal-mode-part"]').count();
      if (has) {
        await p.click('[data-key^="journal-mode-part"]');
        ok(await p.locator('[data-key="mode-part1"]').count() === 0 && await p.locator('.cb-level').count() === 0, 'JOURNAL opens the journal, not a mode');
      } else console.log('     (no JOURNAL on a fresh home page: nothing to check)');
      await p.close();
    }
  }
  await b.close();
  done();
})();
