// Phone width (390 px): no element wider than the screen on the home page or along Part 1, step 1.
// Prints the culprits if anything overflows.
// Usage: node wide.js [shots dir]   or   node wide.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const T = require('./lib');
const { url } = T.args();
const { ok, done } = T.checker();

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await T.noFonts(p);
  const check = async name => {
    const r = await p.evaluate(() => { const W = window.innerWidth; return [document.documentElement.scrollWidth, W,
      [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > W + 1).slice(0, 8)
        .map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right) + ' ' + (e.textContent || '').slice(0, 40))]; });
    ok(r[0] <= r[1], `${name}: page ${r[0]} px wide in a ${r[1]} px window` + (r[2].length ? ' | ' + r[2].join(' / ') : ''));
  };
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
  await check('home');
  await p.click('[data-key="part1-go"]'); await check('story beat');
  await T.throughBeats(p); await T.waitHead(p, 'BASE MAP'); await check('map');
  await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
  await T.addParts(p, T.WALK[1].parts); await check('build');
  await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'READINESS'); await check('review');
  await p.locator('.btn.big').click(); await T.waitHead(p, 'MISSION'); await check('mission');
  await T.fly(p, 'first'); await check('debrief');
  await b.close();
  done();
})();
