// Usage: node shot-el.js page.html out.png selector [width height dpr]
var pw = require('playwright'), path = require('path');
(async function () {
  var browser = await pw.chromium.launch();
  var ctx = await browser.newContext({ viewport: { width: +process.argv[5] || 1000, height: +process.argv[6] || 700 }, deviceScaleFactor: +process.argv[7] || 1 });
  var page = await ctx.newPage();
  page.on('pageerror', function (e) { console.log('PAGE ERROR', e.message); });
  await page.goto('file://' + path.resolve(process.argv[2]));
  await page.waitForTimeout(300);
  await page.locator(process.argv[4]).screenshot({ path: process.argv[3] });
  await browser.close();
})();
