// A quick smoke test: home page, Part 1 step 1, the map, E to walk and E to go in, Build.
// Usage: node smoke.js [shots dir]   or   node smoke.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
  ok(await p.locator('.mode-card').count() === 3, 'home page: three modes');
  await p.click('[data-key="part1-go"]'); await T.throughBeats(p);
  ok(await T.waitHead(p, 'BASE MAP'), 'the map');
  await p.screenshot({ path: path.join(shots, 'smoke-map.png') });
  console.log('     prompt: ' + await p.locator('.map-prompt-text').innerText());
  await p.keyboard.press('e'); await p.waitForTimeout(2500);
  console.log('     after E: ' + await p.locator('.map-prompt-text').innerText());
  await p.keyboard.press('e');
  ok(await T.waitHead(p, 'BUILD'), 'E, E: into the Workshop');
  ok(errors.length === 0, 'no errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await b.close();
  done();
})();
