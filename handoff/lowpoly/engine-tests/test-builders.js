// Node-side numeric tests for the builders: winding, closed volume, place, jitter, immutability.
// Run: node test-builders.js
var vm = require('vm'), fs = require('fs'), path = require('path');
var ctx = vm.createContext({ console: console });
var before = Object.keys(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js/lowpoly.js'), 'utf8'), ctx);
var L = ctx.LowPoly;
var fails = 0, passes = 0;
function ok(cond, msg) { if (cond) passes++; else { fails++; console.log('FAIL: ' + msg); } }

function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function signedVolume(m) {
  var v = 0;
  m.tris.forEach(function (t) { v += dot(t.v[0], cross(t.v[1], t.v[2])) / 6; });
  return v;
}
function allFinite(m) { return m.tris.every(function (t) { return t.v.every(function (p) { return p.every(isFinite); }); }); }
function degenerate(m) {
  return m.tris.filter(function (t) { var n = cross(sub(t.v[1], t.v[0]), sub(t.v[2], t.v[0])); return Math.sqrt(dot(n, n)) < 1e-9; }).length;
}
// Every edge of a closed mesh must be shared by exactly two triangles, once in each direction.
function closedManifold(m) {
  var map = {}, bad = 0;
  function key(p) { return p.map(function (x) { return Math.round(x * 1e6); }).join(','); }
  m.tris.forEach(function (t) {
    for (var k = 0; k < 3; k++) {
      var a = key(t.v[k]), b = key(t.v[(k + 1) % 3]);
      map[a + '>' + b] = (map[a + '>' + b] || 0) + 1;
    }
  });
  Object.keys(map).forEach(function (e) {
    var parts = e.split('>'), rev = parts[1] + '>' + parts[0];
    if (map[e] !== 1 || map[rev] !== 1) bad++;
  });
  return bad;
}

var closed = {
  box: L.box(1, 2, 3, 'steel'),
  cylinder: L.cylinder(0.5, 0.8, 2, 8, 'steel'),
  cylinderPhase: L.cylinder(0.5, 0.5, 2, 4, 'steel', { phase: 45 }),
  cone: L.cone(1, 2, 7, 'steel'),
  sphere0: L.sphere(1, 0, 'steel'), sphere1: L.sphere(1, 1, 'steel'), sphere2: L.sphere(1, 2, 'steel'), sphere3: L.sphere(1, 3, 'steel'),
  prismTri: L.prism([[0, 0], [1, 0], [0, 1]], 1, 'steel'),
  prismCW: L.prism([[0, 0], [0, 1], [1, 0]], 1, 'steel'),
  prismL: L.prism([[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]], 1, 'steel'),   // concave
  prismHex: L.prism((function () { var p = []; for (var i = 0; i < 6; i++) p.push([Math.cos(i * Math.PI / 3), Math.sin(i * Math.PI / 3)]); return p; })(), 0.4, 'steel'),
  torus: L.torus(1, 0.3, 12, 6, 'steel'),
  latheClosed: L.lathe([[0, -1], [0.6, -1], [0.6, 1], [0, 1]], 8, 'steel'),
  scaleMirror: L.scale(L.box(1, 2, 3), -1, 1, 1),
  mirror: L.mirror(L.cone(1, 2, 6), 'x'),
  rotated: L.rotate(L.box(1, 2, 3), 30, 40, 50),
  moved: L.move(L.cylinder(1, 1, 1, 6), 3, 2, 1),
  jittered: L.jitter(L.sphere(1, 2), 0.03, 5)
};
Object.keys(closed).forEach(function (k) {
  var m = closed[k];
  ok(allFinite(m), k + ' finite');
  var vol = signedVolume(m);
  ok(vol > 1e-6, k + ' signed volume positive (' + vol.toFixed(4) + ') - winding outward');
  ok(degenerate(m) === 0, k + ' no degenerate triangles (' + degenerate(m) + ')');
  if (k !== 'jittered') ok(closedManifold(m) === 0, k + ' closed manifold (' + closedManifold(m) + ' bad edges)');
});

// Analytic volumes
function near(a, b, tol) { return Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)); }
ok(near(signedVolume(closed.box), 6, 1e-9), 'box volume 6');
ok(near(signedVolume(closed.prismL), 3, 1e-9), 'concave L prism volume 3 (ear clipping)');
ok(near(signedVolume(closed.prismCW), 0.5, 1e-9), 'clockwise-given prism is fixed');
var tv = signedVolume(closed.torus); ok(near(tv, 2 * Math.PI * Math.PI * 1 * 0.09, 0.25), 'torus volume close to analytic (' + tv.toFixed(3) + ' vs 1.777, low-res)'); 
ok(near(signedVolume(L.cylinder(0.5, 0.5, 2, 4, 'steel')), 2 * 0.5 * 0.5 * 2, 1e-9), 'square-ish cylinder volume');

// Triangle counts
ok(L.count(L.sphere(1, 0)) === 20 && L.count(L.sphere(1, 1)) === 80 && L.count(L.sphere(1, 2)) === 320 && L.count(L.sphere(1, 3)) === 1280, 'sphere counts 20/80/320/1280');
ok(L.count(L.box()) === 12, 'box 12 tris');
ok(L.count(L.cylinder(1, 1, 1, 8)) === 32, 'cylinder 8 sides = 32 tris: ' + L.count(L.cylinder(1, 1, 1, 8)));
ok(L.count(L.cone(1, 1, 8)) === 16, 'cone 8 sides = 16 tris');
ok(L.count(L.quad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], 'steel')) === 2, 'quad 2 tris');
ok(L.count(L.quad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], 'steel', true)) === 4, 'double-sided quad 4 tris');

// Normals: quad p0,p1,p2,p3 counter-clockwise faces +Z here
(function () {
  var q = L.quad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], 'steel');
  var n = cross(sub(q.tris[0].v[1], q.tris[0].v[0]), sub(q.tris[0].v[2], q.tris[0].v[0]));
  ok(n[2] > 0, 'quad CCW faces +Z');
  var d = L.disc(1, 8, 'steel'), nd = cross(sub(d.tris[0].v[1], d.tris[0].v[0]), sub(d.tris[0].v[2], d.tris[0].v[0]));
  ok(nd[1] > 0, 'disc faces +Y');
  var cyl = L.cylinder(1, 1, 2, 8, 'steel');
  var upCap = cyl.tris.filter(function (t) { return t.v.every(function (p) { return p[1] === 1; }); });
  ok(upCap.length === 8, 'cylinder top cap present');
  ok(upCap.every(function (t) { return cross(sub(t.v[1], t.v[0]), sub(t.v[2], t.v[0]))[1] > 0; }), 'cylinder top cap faces +Y');
})();

// Bounds / base / center
(function () {
  var b = L.bounds(L.box(2, 4, 6));
  ok(near(b.size[0], 2, 1e-12) && near(b.size[1], 4, 1e-12) && near(b.size[2], 6, 1e-12), 'bounds size');
  var bb = L.bounds(L.base(L.box(2, 4, 6)));
  ok(near(bb.min[1], 0, 1e-12) && near(bb.max[1], 4, 1e-12), 'base puts min y at 0');
  var e = L.bounds({ tris: [] }); ok(e.size[0] === 0, 'empty bounds');
  ok(L.count(L.merge([L.box(), L.box()])) === 24, 'merge counts');
})();

// Immutability
(function () {
  var a = L.box(1, 1, 1, 'steel'), snap = JSON.stringify(a);
  L.move(a, 1, 2, 3); L.rotate(a, 10, 20, 30); L.scale(a, 2, 3, 4); L.recolor(a, 'red'); L.emit(a); L.jitter(a, 0.1, 1); L.place(a, { pos: [1, 1, 1], normal: [1, 0, 0] }); L.merge([a, a]);
  ok(JSON.stringify(a) === snap, 'builders do not mutate their input');
  var r = L.recolor(a, 'red'), e = L.emit(a);
  ok(r.tris.every(function (t) { return t.c === 'red'; }) && e.tris.every(function (t) { return t.e === 1; }) && a.tris.every(function (t) { return t.e === 0 && t.c === 'steel'; }), 'recolor/emit');
})();

// Rotation conventions: +90 about Y takes +Z to +X; +90 about X takes +Y to +Z; +90 about Z takes +X to +Y
(function () {
  function tip(m) { return m.tris[0].v[0]; }
  var one = { tris: [{ v: [[0, 0, 1], [0, 0, 1], [0, 0, 1]], c: 'steel', e: 0 }] };
  var p = tip(L.rotate(one, 0, 90, 0)); ok(near(p[0], 1, 1e-9) && near(p[2], 0, 1e-9), 'rotate Y 90: +Z -> +X ' + p);
  var o2 = { tris: [{ v: [[0, 1, 0], [0, 1, 0], [0, 1, 0]], c: 's', e: 0 }] };
  p = tip(L.rotate(o2, 90, 0, 0)); ok(near(p[2], 1, 1e-9) && near(p[1], 0, 1e-9), 'rotate X 90: +Y -> +Z ' + p);
  var o3 = { tris: [{ v: [[1, 0, 0], [1, 0, 0], [1, 0, 0]], c: 's', e: 0 }] };
  p = tip(L.rotate(o3, 0, 0, 90)); ok(near(p[1], 1, 1e-9) && near(p[0], 0, 1e-9), 'rotate Z 90: +X -> +Y ' + p);
  // order: X first then Y then Z
  var o4 = { tris: [{ v: [[0, 1, 0], [0, 1, 0], [0, 1, 0]], c: 's', e: 0 }] };
  p = tip(L.rotate(o4, 90, 90, 0)); // +Y -> +Z by X, then +Z -> +X by Y
  ok(near(p[0], 1, 1e-9) && near(p[1], 0, 1e-9) && near(p[2], 0, 1e-9), 'rotate order X,Y,Z ' + p);
})();

// place(): +Y onto any normal
(function () {
  var rod = { tris: [{ v: [[0, 0, 0], [0, 1, 0], [0, 1, 0]], c: 's', e: 0 }, { v: [[0.1, 0.5, 0], [0.1, 0.5, 0], [0.1, 0.5, 0]], c: 's', e: 0 }] };
  var normals = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [1, 1, 1], [-1, -1, -1], [0, -1, 1e-9], [1e-9, -1, 0], [1e-5, -1, 0], [0, -1, -1e-12], [0.3, -0.9, 0.1], [5, 0, 0], [0, 0, 0]];
  normals.forEach(function (n, i) {
    var roll = [0, 33, -90, 180][i % 4];
    var m = L.place(rod, { pos: [1, 2, 3], normal: n, roll: roll });
    var finite = m.tris.every(function (t) { return t.v.every(function (p) { return p.every(isFinite); }); });
    ok(finite, 'place finite for normal ' + JSON.stringify(n));
    var len = Math.sqrt(dot(n, n)), nn = len > 1e-12 ? [n[0] / len, n[1] / len, n[2] / len] : [0, 1, 0];
    var tipP = m.tris[0].v[1], baseP = m.tris[0].v[0];
    var d = [tipP[0] - baseP[0], tipP[1] - baseP[1], tipP[2] - baseP[2]];
    ok(near(d[0], nn[0], 1e-9) && near(d[1], nn[1], 1e-9) && near(d[2], nn[2], 1e-9), 'place maps +Y to ' + JSON.stringify(n) + ' got ' + d.map(function (x) { return x.toFixed(6); }));
    ok(near(baseP[0], 1, 1e-12) && near(baseP[1], 2, 1e-12) && near(baseP[2], 3, 1e-12), 'place origin goes to pos');
  });
  // exactly opposite normal is a fixed, documented result: 180 deg about Z (so +X -> -X, +Z stays +Z)
  var side = { tris: [{ v: [[1, 0, 0], [1, 0, 0], [1, 0, 0]], c: 's', e: 0 }, { v: [[0, 0, 1], [0, 0, 1], [0, 0, 1]], c: 's', e: 0 }] };
  var m2 = L.place(side, { normal: [0, -1, 0] });
  ok(near(m2.tris[0].v[0][0], -1, 1e-12) && near(m2.tris[1].v[0][2], 1, 1e-12), 'place normal -Y: 180 deg about Z, +Z stays +Z');
  // roll spins about the normal, right-handed: normal +Y, roll 90 takes +Z to +X (rotation about +Y)
  var m3 = L.place({ tris: [{ v: [[0, 0, 1], [0, 0, 1], [0, 0, 1]], c: 's', e: 0 }] }, { normal: [0, 1, 0], roll: 90 });
  ok(near(m3.tris[0].v[0][0], 1, 1e-9) && near(m3.tris[0].v[0][2], 0, 1e-9), 'roll 90 about +Y: +Z -> +X');
  // rotation preserves the winding: a placed closed mesh keeps positive volume
  var bx = L.place(L.box(1, 2, 3), { normal: [0.2, -0.7, 0.4], roll: 40, pos: [5, 5, 5] });
  ok(signedVolume(bx) > 0, 'place keeps winding (volume ' + signedVolume(bx).toFixed(3) + ')');
})();

// jitter: no cracks. Vertices at the same position must still share a position afterwards.
(function () {
  [L.sphere(1, 2), L.box(1, 1, 1), L.torus(1, 0.3, 10, 6), L.merge([L.box(1, 1, 1), L.move(L.box(1, 1, 1), 1, 0, 0)])].forEach(function (m, idx) {
    var j = L.jitter(m, 0.05, 42), map = {}, cracks = 0, moved = 0, n = 0;
    function key(p) { return p.map(function (x) { return Math.round(x * 1e5); }).join(','); }
    for (var i = 0; i < m.tris.length; i++) for (var k = 0; k < 3; k++) {
      var a = key(m.tris[i].v[k]), b = j.tris[i].v[k];
      if (map[a] === undefined) map[a] = b; else if (map[a][0] !== b[0] || map[a][1] !== b[1] || map[a][2] !== b[2]) cracks++;
      if (Math.abs(b[0] - m.tris[i].v[k][0]) + Math.abs(b[1] - m.tris[i].v[k][1]) > 1e-6) moved++;
      n++;
    }
    ok(cracks === 0, 'jitter mesh #' + idx + ' leaves no cracks (' + cracks + ')');
    ok(moved > n / 2, 'jitter mesh #' + idx + ' actually moves vertices (' + moved + '/' + n + ')');
    var j2 = L.jitter(m, 0.05, 42), j3 = L.jitter(m, 0.05, 43);
    ok(JSON.stringify(j2) === JSON.stringify(j), 'jitter deterministic for a seed');
    ok(JSON.stringify(j3) !== JSON.stringify(j), 'jitter differs for another seed');
    ok(L.count(j) === L.count(m), 'jitter keeps triangle count');
    var amt = 0;
    for (i = 0; i < m.tris.length; i++) for (k = 0; k < 3; k++) for (var c = 0; c < 3; c++) amt = Math.max(amt, Math.abs(j.tris[i].v[k][c] - m.tris[i].v[k][c]));
    ok(amt <= 0.05 + 1e-12, 'jitter stays within amount (' + amt.toFixed(4) + ')');
  });
  // two meshes jittered separately agree on shared positions
  var A = L.jitter(L.box(1, 1, 1), 0.05, 9), B = L.jitter(L.move(L.box(1, 1, 1), 1, 0, 0), 0.05, 9);
  var shared = A.tris.map(function (t) { return t.v; });
  var ptsA = {}; A.tris.forEach(function (t) { t.v.forEach(function (p) { ptsA[p.map(function (x) { return x.toFixed(9); }).join()] = 1; }); });
  var ma = L.box(1, 1, 1), mb = L.move(L.box(1, 1, 1), 1, 0, 0);
  var posJ = {}; // original position -> jittered position, from A
  ma.tris.forEach(function (t, i) { t.v.forEach(function (p, k) { posJ[p.join()] = A.tris[i].v[k]; }); });
  var agree = 0, tot = 0;
  mb.tris.forEach(function (t, i) { t.v.forEach(function (p, k) { var o = posJ[p.join()]; if (o) { tot++; var q = B.tris[i].v[k]; if (o[0] === q[0] && o[1] === q[1] && o[2] === q[2]) agree++; } }); });
  ok(tot > 0 && agree === tot, 'separately jittered neighbours agree on shared vertices (' + agree + '/' + tot + ')');
})();

// fallbacks & registries
(function () {
  ['body', 'part', 'launcher', 'person', 'scene', 'unknown', undefined].forEach(function (k) {
    var f = L.fallback(k);
    ok(f && (f.mesh || f.scene), 'fallback(' + k + ') returns a model');
    if (f.mesh) ok(f.mesh.tris.length > 0 && allFinite(f.mesh), 'fallback(' + k + ') has a finite mesh');
  });
  var b = L.fallback('body'); ok(['instrument', 'power', 'comms', 'computer', 'propulsion', 'attitude'].every(function (c) { return b.ports[c].length >= 6; }), 'fallback body has ports');
  ok(L.model('part', 'nope', {}).mesh && L.model('body', 'nope', {}).ports && L.model('launcher', 'nope', {}).mesh && L.model('person', 'nope', {}).mesh && L.model('scene', 'nope', {}).scene, 'LowPoly.model never throws on unknown ids');
  L.models.part.boom = function () { throw new Error('x'); };
  L.models.part.fine = function () { return { mesh: L.box(), size: [1, 1, 1], label: 'fine' }; };
  ok(L.model('part', 'boom', {}).label === 'Placeholder part', 'LowPoly.model survives a throwing builder');
  ok(L.model('part', 'fine', {}).label === 'fine' && L.has('part', 'fine') && !L.has('part', 'nope'), 'LowPoly.model/has');
  ok(L.models.part.nope === undefined && L.models.part.hasOwnProperty('fine'), 'registries are plain objects');
  delete L.models.part.boom; delete L.models.part.fine;
})();

// Hex colour helper (no DOM needed for defaults)
ok(L.colorOf('gold') === L.palette.gold, 'colorOf default');
ok(L.colorOf('#abc') === '#aabbcc', 'colorOf short hex');

// Palette completeness: names are fixed by the contract
var NAMES = 'white cream silver steel graphite black gold copper cell cellEdge red orange yellow teal green glow glowCool sea land sand ice cloud skin1 skin2 skin3 hair1 hair2 hair3 shirt1 shirt2 shirt3 tie ground concrete grass metalDark sky space star'.split(' ');
ok(NAMES.every(function (n) { return /^#[0-9a-f]{6}$/i.test(L.palette[n] || ''); }), 'all 39 palette names present with #rrggbb');
ok(Object.keys(L.palette).length === NAMES.length, 'palette has exactly the contract names (' + Object.keys(L.palette).length + ')');

// globals: the script created only LowPoly
var after = Object.keys(ctx).filter(function (k) { return before.indexOf(k) < 0; });
ok(after.length === 1 && after[0] === 'LowPoly', 'only global is LowPoly: ' + after.join(','));

console.log(fails ? ('FAILED ' + fails + ' of ' + (fails + passes)) : ('all ' + passes + ' builder checks passed'));
process.exit(fails ? 1 : 0);
