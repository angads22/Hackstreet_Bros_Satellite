// Helpers loaded by test pages (not by the engine).
window.T = (function () {
  var L = LowPoly;
  function mkCanvas(w, h, style, attrs) {
    var c = document.createElement('canvas');
    if (attrs) { c.width = attrs[0]; c.height = attrs[1]; }
    c.style.cssText = 'display:block;' + (w ? 'width:' + w + 'px;height:' + h + 'px;' : '') + (style || '');
    document.body.appendChild(c);
    return c;
  }
  function data(c) { var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; return d; }
  function px(c, x, y) { var d = c.getContext('2d').getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2], d[3]]; }
  function diffCount(a, b, thr) {
    if (a.length !== b.length) return -1;
    var n = 0, i;
    for (i = 0; i < a.length; i += 4) {
      if (Math.abs(a[i] - b[i]) > thr || Math.abs(a[i + 1] - b[i + 1]) > thr || Math.abs(a[i + 2] - b[i + 2]) > thr || Math.abs(a[i + 3] - b[i + 3]) > thr) n++;
    }
    return n;
  }
  function rev(m) { return { tris: m.tris.map(function (t) { return { v: [t.v[0].slice(), t.v[2].slice(), t.v[1].slice()], c: t.c, e: t.e }; }) }; }
  function ringPoly(n, r) { var p = []; for (var i = 0; i < n; i++) p.push([r * Math.cos(i * 2 * Math.PI / n), r * Math.sin(i * 2 * Math.PI / n)]); return p; }
  function closedBuilders() {
    return [
      ['box', L.box(1, 1.4, 0.8, 'steel')], ['cylinder', L.cylinder(0.4, 0.4, 1.2, 8, 'steel')], ['frustum', L.cylinder(0.25, 0.55, 1.2, 7, 'steel')],
      ['cone', L.cone(0.55, 1.2, 8, 'steel')], ['sphere0', L.sphere(0.7, 0, 'steel')], ['sphere1', L.sphere(0.7, 1, 'steel')], ['sphere2', L.sphere(0.7, 2, 'steel')],
      ['prismHex', L.prism(ringPoly(6, 0.6), 0.8, 'steel')], ['prismL', L.prism([[-0.6, -0.6], [0.6, -0.6], [0.6, 0], [0, 0], [0, 0.6], [-0.6, 0.6]], 0.6, 'steel')],
      ['torus', L.torus(0.6, 0.18, 14, 7, 'steel')], ['latheVase', L.lathe([[0, -0.6], [0.4, -0.5], [0.5, 0], [0.25, 0.4], [0.2, 0.6], [0, 0.6]], 10, 'steel')],
      ['mirrorCone', L.mirror(L.move(L.cone(0.4, 1, 6, 'steel'), 0.5, 0, 0), 'x')], ['placed', L.place(L.box(0.5, 1.2, 0.3, 'steel'), { normal: [0.3, -0.8, 0.4], roll: 33, pos: [0.1, 0.2, 0.3] })]
    ];
  }
  return { mkCanvas: mkCanvas, data: data, px: px, diffCount: diffCount, rev: rev, closedBuilders: closedBuilders, ringPoly: ringPoly };
})();
