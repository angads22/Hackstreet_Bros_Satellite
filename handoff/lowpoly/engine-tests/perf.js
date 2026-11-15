// Usage: node perf.js [cssW cssH dpr]
var pw = require('playwright'), path = require('path');
(async function () {
  var browser = await pw.chromium.launch();
  var sizes = process.argv[2] ? [[+process.argv[2], +process.argv[3], +process.argv[4] || 1]] : [[800, 600, 1], [480, 360, 1], [480, 480, 2], [96, 96, 2]];
  var out = [];
  for (var s of sizes) {
    var ctx = await browser.newContext({ viewport: { width: s[0] + 20, height: s[1] + 20 }, deviceScaleFactor: s[2] });
    var page = await ctx.newPage();
    page.on('pageerror', function (e) { console.log('PAGE ERROR', e.message); });
    await page.goto('file://' + path.join(__dirname, 'perf.html'));
    await page.evaluate(function (s) { var c = document.getElementById('c'); c.style.width = s[0] + 'px'; c.style.height = s[1] + 'px'; }, s);
    for (var n of [600, 1500, 2500]) {
      var r = await page.evaluate(function (a) { return timeFrames(a[0], 100, a[1]); }, [n, !!process.env.FLUSH]);
      var row = { css: s[0] + 'x' + s[1], dpr: s[2], tris: r.tris, buf: r.info.width + 'x' + r.info.height, ss: r.info.ss, drawn: r.info.tris, mean: +r.mean.toFixed(2), median: +r.median.toFixed(2), p95: +r.p95.toFixed(2), max: +r.max.toFixed(2) };
      out.push(row); console.log(JSON.stringify(row));
    }
    await ctx.close();
  }
  await browser.close();
})();
