// Touch: on a phone (iPhone 13 emulation) the home page and Part 1 work by tapping, and on Build a first tap on a
// part card previews it and a second tap adds it.
// Usage: node touch.js [shots dir]   or   node touch.js <repo dir> <shots dir>
const { chromium, devices } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();
const { waitHead } = T;

(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.tap('[data-key="part1-go"]');
  for (let i = 0; i < 6 && await p.locator('.intro').count(); i++) await p.tap('.intro .btn.primary');
  ok(await waitHead(p, 'BASE MAP'), 'tapping through the story beats reaches the map');
  await p.tap('[data-key="blip-build"]');
  ok(await waitHead(p, 'BUILD'), 'tapping the Workshop marker walks there and goes in');
  await p.tap('[data-key="bin-instrument"]');
  const card = '[data-key="part-cosmic-ray-counter"]';
  await p.tap(card);
  const pressed1 = await p.locator(card).getAttribute('aria-pressed');
  const preview1 = (await p.locator('#preview').innerText()).split('\n').filter(Boolean)[1] || '';
  await p.tap(card);
  const pressed2 = await p.locator(card).getAttribute('aria-pressed');
  console.log('     first tap: pressed=' + pressed1 + ' preview="' + preview1 + '" | second tap: pressed=' + pressed2);
  ok(pressed1 === 'false' && /ADD/.test(preview1), 'first tap previews the part without adding it');
  ok(pressed2 === 'true', 'second tap adds it');
  ok(await T.noScroll(p), 'no sideways scroll');
  await p.screenshot({ path: path.join(shots, 'touch-build.png') });
  ok(errors.length === 0, 'no errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await b.close();
  done();
})();
