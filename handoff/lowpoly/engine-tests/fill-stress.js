var pw = require('playwright'), path = require('path');
(async function () {
  var b = await pw.chromium.launch(), p = await b.newPage({ viewport: { width: 820, height: 620 } });
  await p.goto('file://' + path.join(__dirname, 'perf.html'));
  var r = await p.evaluate(function () {
    var L = LowPoly, c = document.getElementById('c'), out = [];
    [1, 5, 10, 20].forEach(function (layers) {
      var items = [];
      // full-screen quads facing the camera, drawn far to near so every pixel passes the depth test
      for (var i = 0; i < layers; i++) items.push({ mesh: L.quad([-4, -3, 0], [4, -3, 0], [4, 3, 0], [-4, 3, 0], ['steel', 'silver', 'cream', 'copper'][i % 4]), pos: [0, 0, -i * 0.1] });
      var sc = { items: items, camera: { yaw: 0, pitch: 0, dist: 8.5, target: [0, 0, 0], fov: 35 }, background: { color: 'space' } };
      for (var k = 0; k < 10; k++) L.render(c, sc, {});
      var t = [];
      for (k = 0; k < 40; k++) { var t0 = performance.now(); L.render(c, sc, {}); t.push(performance.now() - t0); }
      t.sort(function (a, b) { return a - b; });
      out.push({ layers: layers, tris: layers * 2, median: +t[20].toFixed(2), p95: +t[38].toFixed(2) });
    });
    return out;
  });
  console.log(JSON.stringify(r)); await b.close();
})();
