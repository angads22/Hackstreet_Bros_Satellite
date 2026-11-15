// Usage: node shot.js page.html out.png [width height dpr selector]
var pw = require('playwright'), path = require('path');
(async function () {
  var browser = await pw.chromium.launch();
  var w = +process.argv[4] || 1100, h = +process.argv[5] || 800, dpr = +process.argv[6] || 1;
  var ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  var page = await ctx.newPage();
  page.on('pageerror', function (e) { console.log('PAGE ERROR', e.message); });
  page.on('console', function (m) { if (m.type() !== 'log') console.log('CONSOLE', m.type(), m.text()); });
  await page.goto('file://' + path.resolve(process.argv[2]));
  await page.waitForTimeout(400);
  await page.screenshot({ path: process.argv[3], fullPage: true });
  await browser.close();
})();
