/*
 * lp-parts-body.js - satellite bodies and the attitude and propulsion parts, for lowpoly.js.
 *
 * Plain ES5, loaded with a script tag after lowpoly.js. Creates no globals: it only fills
 *   LowPoly.models.body  explorer-body, drum-body, smallsat-bus, nimbus-bus, cubesat-12u
 *   LowPoly.models.part  spin-stabilised, reaction-wheels, prop-green-small, prop-green-large, prop-ion
 *
 * Scale: one unit is about the size of the engine's placeholder body (1.2 x 1.4 x 1.2). Bodies are
 * 0.8 to 2.2 units; the parts here are 0.24 to 0.58 units, like the placeholder part (0.36 x 0.44).
 *
 * Bodies are centred on the origin, body axis Y: nadir (toward Earth) -Y, zenith +Y, aft +Z.
 * Ports: { instrument|power|comms|computer|propulsion|attitude: [{pos, normal, roll}, ...] }.
 *   pos     a point on the body's skin (flush with the facet it sits on);
 *   normal  the outward normal of that facet: LowPoly.place turns the part's +Y onto it;
 *   roll    chosen so that the part's +Z ("the face that looks somewhere") points at:
 *           instrument nadir (-Y), or aft (+Z) when the port itself is on the nadir face;
 *           power aft (+Z), so solar panels on the side walls show their cells to the default camera;
 *           comms aft on the top and bottom faces, nadir on side walls;
 *           computer, attitude, propulsion zenith (+Y), or aft on the top and bottom faces.
 *   Order: best slot first. The first N ports of a kind are the body's N real slots (data/parts.js
 *   "slots"); any further ports are spares for over-full designs. Every body has at least one port of
 *   every kind, even where it has no slot of that kind (Explorer and the drum have no propulsion slot).
 *   Ports of different kinds never share a spot: a design using every slot at once does not collide
 *   (checked with 0.36 x 0.44 x 0.36 probe parts).
 *
 * Parts: attachment point at the origin, the part grows along +Y. Thrusters fire along +Y (nozzles
 * and the ion grid are at the outer, +Y end). Only the ion grid is emissive.
 */
(function (L) {
  'use strict';
  if (!L || !L.models || !L.models.body || !L.models.part) return;

  var DEG = Math.PI / 180;
  var NADIR = [0, -1, 0], ZENITH = [0, 1, 0], AFT = [0, 0, 1];

  // ---------------------------------------------------------------- small vector helpers
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a) { return Math.sqrt(dot(a, a)); }
  function unit(a) { var l = len(a); return l > 1e-12 ? mul(a, 1 / l) : [0, 1, 0]; }
  function r4(x) { var v = Math.round(x * 1e4) / 1e4; return v === 0 ? 0 : v; }   // no -0

  // Direction at angle a (degrees) round the Y axis, the same way the engine builds rings:
  // 0 = +X, 90 = -Z, 180 = -X, 270 = +Z (counter-clockwise seen from above).
  function radial(a) { return [Math.cos(a * DEG), 0, -Math.sin(a * DEG)]; }
  function angleOf(p) { var a = Math.atan2(-p[2], p[0]) / DEG; return a < 0 ? a + 360 : a; }

  function nameOf(part, d) { return (part && typeof part.name === 'string' && part.name) ? part.name : d; }

  // ---------------------------------------------------------------- mesh helpers
  // Recolour triangles: fn(centroid, normal, tri) returns a colour, or nothing to keep the old one.
  function paint(m, fn) {
    var out = [], i;
    for (i = 0; i < m.tris.length; i++) {
      var t = m.tris[i], v = t.v;
      var c = [(v[0][0] + v[1][0] + v[2][0]) / 3, (v[0][1] + v[1][1] + v[2][1]) / 3, (v[0][2] + v[1][2] + v[2][2]) / 3];
      var n = unit(cross(sub(v[1], v[0]), sub(v[2], v[0])));
      var col = fn(c, n, t);
      out.push({ v: [v[0].slice(), v[1].slice(), v[2].slice()], c: col || t.c, e: t.e ? 1 : 0 });
    }
    return { tris: out };
  }
  // Index of the facet (0..sides-1) a point lies in, for a ring built with this many sides and phase.
  function facetOf(p, sides, phase) {
    var a = angleOf(p) - (phase || 0);
    a = ((a % 360) + 360) % 360;
    return Math.floor(a / (360 / sides) + 1e-6) % sides;
  }
  // A round bar from p0 to p1 (no end caps unless asked).
  function strut(p0, p1, r, sides, c, caps) {
    var d = sub(p1, p0), l = len(d);
    var m = L.move(L.cylinder(r, r, l, sides, c, { capTop: !!caps, capBottom: !!caps, phase: 0 }), 0, l / 2, 0);
    return L.place(m, { pos: p0, normal: d, roll: 0 });
  }
  // A crinkled foil face: a grid from corner o along edge vectors u and v (u x v = outward normal).
  // Only inner vertices move, so the edges stay straight and meet the frame without cracks.
  function foil(o, u, v, nu, nv, amp, seed, c) {
    var rnd = L.rng(seed), n = unit(cross(u, v)), uu = unit(u), vv = unit(v), P = [], t = [], i, j;
    for (j = 0; j <= nv; j++) {
      P[j] = [];
      for (i = 0; i <= nu; i++) {
        var p = add(o, add(mul(u, i / nu), mul(v, j / nv)));
        if (i > 0 && i < nu && j > 0 && j < nv) {
          p = add(p, mul(n, (rnd() - 0.5) * 2 * amp));
          p = add(p, mul(uu, (rnd() - 0.5) * amp));
          p = add(p, mul(vv, (rnd() - 0.5) * amp));
        }
        P[j][i] = p;
      }
    }
    for (j = 0; j < nv; j++) {
      for (i = 0; i < nu; i++) {
        var a = P[j][i], b = P[j][i + 1], cc = P[j + 1][i + 1], d = P[j + 1][i];
        if ((i + j) % 2) { t.push(tri(a, b, cc, c)); t.push(tri(a, cc, d, c)); }
        else { t.push(tri(a, b, d, c)); t.push(tri(b, cc, d, c)); }
      }
    }
    return { tris: t };
  }
  function tri(a, b, c, col) { return { v: [a.slice(), b.slice(), c.slice()], c: col, e: 0 }; }
  // A flat rectangle centred at p on a face with outward normal n; u is its first edge direction.
  function plate(p, n, u, w, h, c) {
    n = unit(n); u = unit(u);
    var v = cross(n, u), hu = mul(u, w / 2), hv = mul(v, h / 2);
    return L.quad(sub(sub(p, hu), hv), sub(add(p, hu), hv), add(add(p, hu), hv), add(sub(p, hu), hv), c);
  }
  // A nozzle bell: a frustum from the narrow throat (at y=0) to the wide exit (at y=h), open at the
  // exit so the dark plate behind it shows inside.
  function bell(rThroat, rExit, h, sides, c) {
    return L.move(L.cylinder(rExit, rThroat, h, sides, c, { capTop: false, capBottom: false }), 0, h / 2, 0);
  }

  // ---------------------------------------------------------------- ports
  var PROBE = { tris: [{ v: [[0, 0, 0], [0, 0, 1], [0, 1, 0]], c: 'steel', e: 0 }] };
  // A port at pos with outward normal; roll is worked out so the part's +Z ends up as close to
  // "look" as the normal allows (the engine's own place() is the reference, so -Y is handled).
  function port(pos, normal, look) {
    var n = unit(normal), roll = 0;
    var z1 = L.place(PROBE, { pos: [0, 0, 0], normal: n, roll: 0 }).tris[0].v[1];
    if (look) {
      var d = sub(look, mul(n, dot(look, n)));
      if (len(d) > 1e-6) {
        d = unit(d);
        roll = Math.atan2(dot(n, cross(z1, d)), dot(z1, d)) / DEG;
      }
    }
    roll = Math.round(roll * 10) / 10;
    if (roll <= -180) roll += 360;
    if (roll === 0) roll = 0;
    return { pos: [r4(pos[0]), r4(pos[1]), r4(pos[2])], normal: [r4(n[0]), r4(n[1]), r4(n[2])], roll: roll };
  }
  // Where each kind of part should look (see the header).
  function lookFor(kind, normal) {
    var n = unit(normal), vertical = Math.abs(n[1]) > 0.9, facingZ = Math.abs(n[2]) > 0.9;
    if (kind === 'instrument') return vertical ? AFT : NADIR;
    if (kind === 'power') return facingZ ? ZENITH : AFT;
    if (kind === 'comms') return vertical ? AFT : NADIR;
    return vertical ? AFT : ZENITH;   // computer, attitude, propulsion
  }
  // Build the ports object from a list of [kind, pos, normal] in best-first order per kind.
  function makePorts(list) {
    var ports = { instrument: [], power: [], comms: [], computer: [], propulsion: [], attitude: [] }, i;
    for (i = 0; i < list.length; i++) {
      var k = list[i][0];
      ports[k].push(port(list[i][1], list[i][2], lookFor(k, list[i][2])));
    }
    return ports;
  }
  // Centre the body's bounding box on the origin and move the ports by the same amount.
  function finishBody(mesh, ports, label) {
    var b = L.bounds(mesh), c = b.center, k, i;
    if (Math.abs(c[0]) + Math.abs(c[1]) + Math.abs(c[2]) > 1e-9) {
      mesh = L.move(mesh, -c[0], -c[1], -c[2]);
      for (k in ports) {
        if (!Object.prototype.hasOwnProperty.call(ports, k)) continue;
        for (i = 0; i < ports[k].length; i++) {
          var p = ports[k][i].pos;
          ports[k][i].pos = [r4(p[0] - c[0]), r4(p[1] - c[1]), r4(p[2] - c[2])];
        }
      }
      b = L.bounds(mesh);
    }
    return { mesh: mesh, size: [r4(b.size[0]), r4(b.size[1]), r4(b.size[2])], ports: ports, label: label };
  }
  function finishPart(mesh, label) {
    var b = L.bounds(mesh);
    return { mesh: mesh, size: [r4(b.size[0]), r4(b.size[1]), r4(b.size[2])], label: label };
  }

  // =====================================================================================
  // BODIES
  // =====================================================================================

  // ---- Explorer 1 (1958): a slim striped steel tube on its spent rocket motor, four whip aerials.
  // One lathe, 12 sides, turned so facet centres sit at 0, 30, 60 ... degrees (+X, +Z, -X, -Z are facets).
  function explorerBody(part) {
    var N = 12, R = 0.2, AP = R * Math.cos(15 * DEG);
    var Y = { exit: -1.12, throat: -1.0, dome: -0.9, band0: -0.16, band1: -0.05, nose0: 0.5, nose1: 0.86, tip: 1.04 };
    var hull = L.lathe([
      [0.12, Y.exit], [0.065, Y.throat], [R, Y.dome], [R, Y.band0], [R, Y.band1], [R, Y.nose0], [0.13, Y.nose1], [0, Y.tip]
    ], N, 'steel');
    hull = L.rotate(hull, 0, -15, 0);
    hull = paint(hull, function (c) {
      var y = c[1], i = facetOf(c, N, -15);
      if (y < Y.throat) return 'graphite';                 // nozzle bell
      if (y < Y.dome) return 'metalDark';                  // motor aft dome
      if (y < Y.band0) return 'steel';                     // motor case
      if (y < Y.band1) return 'silver';                    // joint band
      if (y > Y.nose1 + 0.05) return 'silver';             // nose tip
      return (i % 2) ? 'white' : 'graphite';               // the famous stripes
    });
    // The nozzle exit, dark, facing -Y (the bell is a single-sided shell, this closes it).
    var throat = L.rotate(L.move(L.mirror(L.disc(0.12, N, 'black'), 'y'), 0, Y.exit - 0.001, 0), 0, -15, 0);
    // Four whip aerials on the diagonals, swept down a little.
    var whips = [], k;
    for (k = 0; k < 4; k++) {
      var d = radial(45 + 90 * k);
      var p0 = add(mul(d, R * 0.9), [0, -0.1, 0]);
      var p1 = add(mul(d, R + 0.56), [0, -0.36, 0]);
      whips.push(strut(p0, p1, 0.024, 3, 'silver'));
    }
    var mesh = L.merge([hull, throat].concat(whips));

    // Ports: three rings of four (+Z, +X, -X, -Z) plus the nose tip.
    var yA = 0.26, yB = -0.5, yC = -0.8;   // B is a wing's height below A, so a large panel clears it
    function side(a, y) { return [mul(radial(a), AP)[0], y, mul(radial(a), AP)[2]]; }
    var ports = makePorts([
      ['comms', [0, Y.tip, 0], ZENITH],
      ['instrument', side(270, yA), radial(270)],
      ['power', side(0, yA), radial(0)],
      ['power', side(180, yA), radial(180)],
      ['comms', side(90, yA), radial(90)],
      ['computer', side(270, yB), radial(270)],
      ['computer', side(90, yB), radial(90)],
      ['attitude', side(0, yB), radial(0)],
      ['propulsion', side(180, yB), radial(180)],
      ['instrument', side(270, yC), radial(270)],
      ['computer', side(90, yC), radial(90)],
      ['power', side(0, yC), radial(0)],
      ['attitude', side(180, yC), radial(180)]
    ]);
    return finishBody(mesh, ports, nameOf(part, 'Explorer-style cylinder') + ': a slim striped steel tube on its rocket motor, with four whip aerials');
  }

  // ---- TIROS (1960): a squat 18-sided drum, solar cells on the sides and top, a hub on top.
  function drumBody(part) {
    var N = 18, PH = -10, R = 0.85, AP = R * Math.cos(10 * DEG), H = 0.42;
    var o = function (top, bottom) { return { capTop: top, capBottom: bottom, phase: PH }; };
    var bottomRim = L.move(L.cylinder(R, R, 0.09, N, 'silver', o(false, true)), 0, -H + 0.045, 0);
    bottomRim = paint(bottomRim, function (c, n) { return n[1] < -0.9 ? 'metalDark' : null; });
    var cells = L.move(L.cylinder(R, R, 2 * H - 0.16, N, 'cell', o(false, false)), 0, 0.01, 0);
    cells = paint(cells, function (c) { return facetOf(c, N, PH) % 3 === 1 ? 'cellEdge' : null; });
    var topRim = L.move(L.cylinder(R, R, 0.07, N, 'silver', o(false, false)), 0, H - 0.035, 0);
    var topCone = L.move(L.cylinder(0, R, 0.05, N, 'cell', o(false, false)), 0, H + 0.025, 0);
    topCone = paint(topCone, function (c) { return facetOf(c, N, PH) % 2 ? 'cellEdge' : null; });
    var hub = L.move(L.cylinder(0.14, 0.16, 0.07, 9, 'silver', { capTop: true, capBottom: false }), 0, H + 0.07, 0);
    var mesh = L.merge([bottomRim, cells, topRim, topCone, hub]);

    var HUB = H + 0.105, YS = -0.1;   // side ports sit a little below the middle of the wall
    function side(a) { var d = mul(radial(a), AP); return [d[0], YS, d[2]]; }
    function under(a, r) { var d = mul(radial(a), r); return [d[0], -H, d[2]]; }
    function onTop(a, r) { var d = mul(radial(a), r); return [d[0], H + 0.05 - 0.05 * r / R, d[2]]; }
    // Side wall: wings on +X and -X, the two instruments front and back (looking down at Earth, far
    // enough apart for a 1.7 m radar), a third power slot front-left. Computers on the top, attitude
    // and thruster underneath.
    var ports = makePorts([
      ['instrument', side(280), radial(280)],
      ['instrument', side(100), radial(100)],
      ['instrument', side(40), radial(40)],
      ['power', side(0), radial(0)],
      ['power', side(180), radial(180)],
      ['power', side(220), radial(220)],
      ['comms', [0, HUB, 0], ZENITH],
      ['comms', onTop(90, 0.55), ZENITH],
      ['comms', onTop(30, 0.55), ZENITH],
      ['computer', onTop(300, 0.52), ZENITH],
      ['computer', onTop(240, 0.52), ZENITH],
      ['computer', onTop(150, 0.55), ZENITH],
      ['attitude', [0, -H, 0], NADIR],
      ['attitude', under(270, 0.5), NADIR],
      ['propulsion', under(90, 0.5), NADIR]
    ]);
    return finishBody(mesh, ports, nameOf(part, 'TIROS-style drum') + ': a squat 18-sided drum covered in solar cells');
  }

  // ---- Modern smallsat bus: a gold-foil box between silver decks, a white radiator on the back.
  function smallsatBus(part) {
    var X = 0.6, Z = 0.55, Y = 0.6, DT = 0.06, IN = Y - DT / 2;   // IN: where the foil meets the decks
    var top = L.move(L.box(2 * X + 0.06, DT, 2 * Z + 0.06, 'silver'), 0, Y, 0);
    var bottom = L.move(L.box(2 * X + 0.06, DT, 2 * Z + 0.06, 'white'), 0, -Y, 0);
    var posts = [], k;
    for (k = 0; k < 4; k++) {
      posts.push(L.move(L.cylinder(0.057, 0.057, 2 * IN, 4, 'steel', { capTop: false, capBottom: false, phase: 45 }),
        (k & 1 ? 1 : -1) * X, 0, (k & 2 ? 1 : -1) * Z));
    }
    var fx = foil([X, -IN, Z], [0, 0, -2 * Z], [0, 2 * IN, 0], 3, 4, 0.018, 11, 'gold');      // +X
    var fmx = foil([-X, -IN, -Z], [0, 0, 2 * Z], [0, 2 * IN, 0], 3, 4, 0.018, 23, 'gold');    // -X
    var fz = foil([-X, -IN, Z], [2 * X, 0, 0], [0, 2 * IN, 0], 3, 4, 0.018, 37, 'gold');      // +Z
    var rad = L.quad([X, -IN, -Z], [-X, -IN, -Z], [-X, IN, -Z], [X, IN, -Z], 'white');        // -Z radiator
    var seams = [];
    for (k = -1; k <= 1; k += 2) seams.push(plate([0, k * 0.2, -Z - 0.003], [0, 0, -1], [1, 0, 0], 2 * X - 0.1, 0.03, 'silver'));
    var mesh = L.merge([top, bottom, rad].concat(seams, [fx, fmx, fz], posts));

    var YT = Y + DT / 2, YB = -Y - DT / 2;
    // Instruments low in the middle of the aft face (+Z, toward the default camera) and of the back
    // face, looking down at Earth (a 1.7 m radar fits either), computers above the front one. Top deck:
    // attitude in front, aerials behind. Thruster under the middle.
    var ports = makePorts([
      ['instrument', [0, -0.27, Z], [0, 0, 1]],
      ['instrument', [0, -0.27, -Z], [0, 0, -1]],
      ['computer', [-0.3, 0.27, Z], [0, 0, 1]],
      ['computer', [0.3, 0.27, Z], [0, 0, 1]],
      ['computer', [0.3, YB, 0.25], NADIR],
      ['power', [X, 0.05, 0], [1, 0, 0]],
      ['power', [-X, 0.05, 0], [-1, 0, 0]],
      ['power', [0, 0.27, -Z], [0, 0, -1]],
      ['comms', [-0.3, YT, -0.33], ZENITH],
      ['comms', [0.3, YT, -0.33], ZENITH],
      ['comms', [-0.3, YB, 0.25], NADIR],
      ['attitude', [-0.3, YT, 0.33], ZENITH],
      ['attitude', [0.3, YT, 0.33], ZENITH],
      ['propulsion', [0, YB, -0.25], NADIR]
    ]);
    return finishBody(mesh, ports, nameOf(part, 'Modern smallsat bus') + ': a gold-foil box between silver decks, with a white radiator on the back');
  }

  // ---- Nimbus (1964): a sensory ring below, a truss, the control housing on top with two paddle arms.
  function nimbusBus(part) {
    var RN = 12, RPH = -15, RR = 0.85, RAP = RR * Math.cos(15 * DEG), RY0 = -1.15, RY1 = -0.85;
    var ring = L.move(L.cylinder(RR, RR, RY1 - RY0, RN, 'silver', { capTop: true, capBottom: true, phase: RPH }), 0, (RY0 + RY1) / 2, 0);
    ring = paint(ring, function (c, n) {
      if (n[1] < -0.9) return 'metalDark';
      if (n[1] > 0.9) return null;
      return facetOf(c, RN, RPH) % 2 ? 'white' : null;
    });
    var hole = L.move(L.disc(0.42, RN, 'graphite'), 0, RY1 + 0.002, 0);
    // Housing: octagon with facets on +X, -Z, -X, +Z.
    var HN = 8, HPH = -22.5, HR = 0.42, HAP = HR * Math.cos(22.5 * DEG), HY0 = 0.6, HY1 = 1.05, HYM = (HY0 + HY1) / 2;
    var housing = L.move(L.cylinder(HR, HR, HY1 - HY0, HN, 'gold', { capTop: true, capBottom: true, phase: HPH }), 0, HYM, 0);
    housing = paint(housing, function (c, n) {
      if (n[1] > 0.9) return 'white';
      if (n[1] < -0.9) return 'metalDark';
      return facetOf(c, HN, HPH) % 2 ? 'silver' : null;
    });
    // Truss: six struts zig-zagging from the ring to the housing.
    var struts = [], k;
    var lows = [290, 10, 50, 130, 170, 250], highs = [310, 350, 70, 110, 190, 230];
    for (k = 0; k < 6; k++) {
      var a = mul(radial(lows[k]), 0.6), b = mul(radial(highs[k]), 0.27);
      struts.push(strut([a[0], RY1, a[2]], [b[0], HY0, b[2]], 0.035, 3, 'steel'));
    }
    // Paddle arms on +X and -X, with a hinge flange at the end where the solar paddle mounts.
    var ARM = 0.27, arms = [], ends = [];
    for (k = -1; k <= 1; k += 2) {
      var p0 = [k * (HAP - 0.02), HYM, 0], p1 = [k * (HAP + ARM), HYM, 0];
      arms.push(strut(p0, p1, 0.045, 6, 'steel'));
      arms.push(L.move(L.box(0.05, 0.16, 0.16, 'graphite'), k * (HAP + ARM + 0.025), HYM, 0));
      ends.push([k * (HAP + ARM + 0.05), HYM, 0]);
    }
    var mesh = L.merge([ring, hole, housing, mesh0(struts), mesh0(arms)]);

    function under(a, r) { var d = mul(radial(a), r); return [d[0], RY0, d[2]]; }
    function ringSide(a) { var d = mul(radial(a), RAP); return [d[0], (RY0 + RY1) / 2, d[2]]; }
    // Sensory ring wall every 60 degrees: instruments 120 degrees apart (front, back-right, back-left,
    // looking down at Earth; far enough apart for a 1.7 m radar), a second aerial front-right. Under the
    // ring: the third power slot (a battery) in the middle, computers and the thruster around it.
    // Housing: paddles on the arms, attitude control on its front and back faces, the main aerial on top.
    var ports = makePorts([
      ['instrument', ringSide(270), radial(270)],
      ['instrument', ringSide(30), radial(30)],
      ['instrument', ringSide(150), radial(150)],
      ['instrument', ringSide(210), radial(210)],
      ['power', ends[1], [1, 0, 0]],
      ['power', ends[0], [-1, 0, 0]],
      ['power', [0, RY0, 0], NADIR],
      ['comms', [0, HY1, 0], ZENITH],
      ['comms', ringSide(330), radial(330)],
      ['comms', ringSide(90), radial(90)],
      ['computer', under(330, 0.5), NADIR],
      ['computer', under(210, 0.5), NADIR],
      ['computer', under(270, 0.5), NADIR],
      ['propulsion', under(90, 0.5), NADIR],
      ['attitude', [0, HYM, HAP], [0, 0, 1]],
      ['attitude', [0, HYM, -HAP], [0, 0, -1]]
    ]);
    return finishBody(mesh, ports, nameOf(part, 'Nimbus-class bus') + ': a sensory ring joined by a truss to the control housing, with two arms for solar paddles');
  }
  function mesh0(list) { return L.merge(list); }

  // ---- 12U CubeSat: a 2 x 2 x 3 unit box, gold corner rails standing proud of both ends.
  function cubesat12u(part) {
    var U = 0.4, X = U - 0.01, Y = 1.5 * U, RAIL = 0.04, RX = U - 0.02, OFF = 0.003;
    var core = L.box(2 * X, 2 * Y, 2 * X, 'silver');
    var rails = [], panels = [], k, i, j;
    for (k = 0; k < 4; k++) {
      rails.push(L.move(L.cylinder(RAIL * Math.SQRT2, RAIL * Math.SQRT2, 2 * Y + 0.08, 4, 'gold', { phase: 45 }),
        (k & 1 ? 1 : -1) * RX, 0, (k & 2 ? 1 : -1) * RX));
    }
    // Long faces: 2 x 3 dark panels with silver seams between them.
    var faces = [[[1, 0, 0], [0, 0, -1]], [[-1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0]], [[0, 0, -1], [-1, 0, 0]]];
    for (k = 0; k < faces.length; k++) {
      var n = faces[k][0], u = faces[k][1];
      for (i = -1; i <= 1; i += 2) {
        for (j = -1; j <= 1; j++) {
          var p = add(mul(n, X + OFF), add(mul(u, i * 0.165), [0, j * U, 0]));
          panels.push(plate(p, n, u, 0.29, 0.36, 'metalDark'));
        }
      }
    }
    // Ends: 2 x 2 panels.
    for (k = -1; k <= 1; k += 2) {
      for (i = -1; i <= 1; i += 2) {
        for (j = -1; j <= 1; j += 2) {
          panels.push(plate([i * 0.165, k * (Y + OFF), j * 0.165], [0, k, 0], [1, 0, 0], 0.27, 0.27, 'metalDark'));
        }
      }
    }
    var mesh = L.merge([core].concat(panels, rails));

    // Aft face (+Z): computer on the top row, instrument on the bottom row looking down at Earth (the
    // middle row stays clear for a 0.65 m camera). Attitude on the back face (-Z), wings on +X and -X,
    // aerial on the top end, thruster on the bottom end, spares on -Z.
    var ports = makePorts([
      ['instrument', [0, -U, X], [0, 0, 1]],
      ['instrument', [0, -U, -X], [0, 0, -1]],
      ['power', [X, 0, 0], [1, 0, 0]],
      ['power', [-X, 0, 0], [-1, 0, 0]],
      ['comms', [0, Y, 0], ZENITH],
      ['comms', [0, U, -X], [0, 0, -1]],
      ['computer', [0, U, X], [0, 0, 1]],
      ['attitude', [0, 0, -X], [0, 0, -1]],
      ['propulsion', [0, -Y, 0], NADIR]
    ]);
    return finishBody(mesh, ports, nameOf(part, '12U CubeSat frame') + ': a 2 x 2 x 3 unit box with gold corner rails');
  }

  // =====================================================================================
  // PARTS (attachment at the origin, growing along +Y)
  // =====================================================================================

  // ---- Spin stabilisation: a spinner banded in light and dark segments (so it reads as turning),
  // with two small gas jets on the rim pointing round the spin direction.
  function spinPart(part) {
    var N = 8, R = 0.2;
    var prof = [[0, 0], [0.11, 0], [R, 0.05], [R, 0.115], [R, 0.18], [0.12, 0.24], [0, 0.265]];
    var body = L.lathe(prof, N, 'steel');
    body = paint(body, function (c) {
      var y = c[1], i = facetOf(c, N, 0);
      if (y < 0.05) return 'graphite';
      if (y < 0.115) return i % 2 ? 'white' : 'red';
      if (y < 0.18) return i % 2 ? 'red' : 'white';
      return 'silver';
    });
    var jets = [], k;
    for (k = 0; k < 2; k++) {
      var a = 22.5 + 180 * k, d = radial(a), tdir = [-Math.sin(a * DEG), 0, -Math.cos(a * DEG)];  // +angle direction
      var base = add(mul(d, R + 0.02), [0, 0.115, 0]);
      jets.push(L.place(bell(0.022, 0.05, 0.11, 6, 'copper'), { pos: base, normal: mul(tdir, -1), roll: 0 }));
    }
    var mesh = L.merge([body].concat(jets));
    return finishPart(mesh, nameOf(part, 'Spin stabilisation') + ': a banded spinner with two small gas jets on its rim');
  }

  // ---- Reaction wheels: three flywheels on three axes inside an open cage (posts and top
  // rails on a floor plate). Wheels are 8-sided discs: dark rims, silver faces.
  function wheelsPart(part) {
    var S = 0.2, H = 0.42, PR = 0.03, C = S - 0.012;
    var floor = L.quad([-S, 0.002, S], [S, 0.002, S], [S, 0.002, -S], [-S, 0.002, -S], 'metalDark', true);
    var posts = [], k;
    for (k = 0; k < 4; k++) {
      // triangular posts with one flat side facing out of the cage
      var px = (k & 1 ? 1 : -1) * C, pz = (k & 2 ? 1 : -1) * C;
      posts.push(L.move(L.cylinder(PR, PR, H, 3, 'steel', { capTop: false, capBottom: false, phase: angleOf([px, 0, pz]) + 180 }), px, H / 2, pz));
    }
    // top rails along the front and back edges, tying the posts together
    var frame = L.merge([
      strut([-C, H - 0.02, C], [C, H - 0.02, C], 0.026, 3, 'steel'),
      strut([-C, H - 0.02, -C], [C, H - 0.02, -C], 0.026, 3, 'steel')
    ]);
    function wheel(r, t, rot, pos, noBottom) {
      var pts = [], i;
      for (i = 0; i < 8; i++) pts.push([r * Math.cos((i * 45 + 22.5) * DEG), r * Math.sin((i * 45 + 22.5) * DEG)]);
      var w = paint(L.prism(pts, t, 'graphite'), function (c, n) { return Math.abs(n[1]) > 0.9 ? 'silver' : null; });
      if (noBottom) w = { tris: w.tris.filter(function (tr) { return tr.v[0][1] > -t / 2 + 1e-9 || tr.v[1][1] > -t / 2 + 1e-9 || tr.v[2][1] > -t / 2 + 1e-9; }) };
      w = L.rotate(w, rot[0], rot[1], rot[2]);
      return L.move(w, pos[0], pos[1], pos[2]);
    }
    var wheels = [
      wheel(0.14, 0.05, [0, 0, 0], [0, 0.1, 0], true),         // axis Y (its underside faces the floor)
      wheel(0.12, 0.05, [0, 0, 90], [-0.105, 0.275, 0.03]),     // axis X
      wheel(0.12, 0.05, [90, 0, 0], [0.06, 0.275, -0.105])      // axis Z
    ];
    var mesh = L.merge([floor, frame].concat(posts, wheels));
    return finishPart(mesh, nameOf(part, 'Reaction wheels') + ': three flywheels on three axes in an open cage');
  }

  // ---- Small green thruster pack (3U MiPS): a slim white module, green band, four tiny nozzles.
  function propGreenSmall(part) {
    var W = 0.24, H = 0.28;
    var box = L.move(L.box(W, H, W, 'white'), 0, H / 2, 0);
    box = paint(box, function (c, n) { return n[1] > 0.9 ? 'metalDark' : null; });
    var band = [], k, nozzles = [];
    var sides = [[[1, 0, 0], [0, 0, -1]], [[-1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0]], [[0, 0, -1], [-1, 0, 0]]];
    for (k = 0; k < 4; k++) band.push(plate(add(mul(sides[k][0], W / 2 + 0.002), [0, 0.13, 0]), sides[k][0], sides[k][1], W, 0.06, 'green'));
    for (k = 0; k < 4; k++) nozzles.push(L.move(bell(0.018, 0.036, 0.07, 6, 'graphite'), (k & 1 ? 1 : -1) * 0.062, H, (k & 2 ? 1 : -1) * 0.062));
    var mesh = L.merge([box].concat(band, nozzles));
    return finishPart(mesh, nameOf(part, 'Small green thruster pack') + ': a slim module with a green band and four small nozzles');
  }

  // ---- Large green thruster pack (11U MiPS): a wide module, a domed tank, four big 1 N nozzles.
  function propGreenLarge(part) {
    var W = 0.44, D = 0.36, H = 0.3;
    var box = L.move(L.box(W, H, D, 'white'), 0, H / 2, 0);
    box = paint(box, function (c, n) { return n[1] > 0.9 ? 'metalDark' : null; });
    var band = [], k, nozzles = [];
    var sides = [[[1, 0, 0], [0, 0, -1], D], [[-1, 0, 0], [0, 0, 1], D], [[0, 0, 1], [1, 0, 0], W], [[0, 0, -1], [-1, 0, 0], W]];
    for (k = 0; k < 4; k++) {
      var half = (sides[k][0][0] ? W : D) / 2;
      band.push(plate(add(mul(sides[k][0], half + 0.002), [0, 0.14, 0]), sides[k][0], sides[k][1], sides[k][2], 0.07, 'green'));
    }
    var dome = L.lathe([[0.135, H - 0.01], [0.1, H + 0.085], [0, H + 0.115]], 8, 'silver');
    for (k = 0; k < 4; k++) nozzles.push(L.move(bell(0.03, 0.062, 0.1, 8, 'steel'), (k & 1 ? 1 : -1) * 0.15, H, (k & 2 ? 1 : -1) * 0.11));
    var mesh = L.merge([box, dome].concat(band, nozzles));
    return finishPart(mesh, nameOf(part, 'Large green thruster pack') + ': a wide module with a domed tank, a green band and four big nozzles');
  }

  // ---- Iodine ion thruster (BIT-3 class): a block with a round head, a copper RF coil and a glowing grid.
  function propIon(part) {
    var W = 0.3, H = 0.18, GR = 0.115, N = 10;
    var block = L.move(L.box(W, H, W, 'steel'), 0, H / 2, 0);
    block = paint(block, function (c, n) { return n[1] > 0.9 ? 'graphite' : null; });
    var foilBand = [], k;
    var sides = [[[1, 0, 0], [0, 0, -1]], [[-1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0]], [[0, 0, -1], [-1, 0, 0]]];
    for (k = 0; k < 4; k++) foilBand.push(plate(add(mul(sides[k][0], W / 2 + 0.002), [0, 0.06, 0]), sides[k][0], sides[k][1], W, 0.07, 'gold'));
    var coil = L.move(L.cylinder(GR + 0.022, GR + 0.022, 0.035, N, 'copper', { capTop: false, capBottom: false }), 0, H + 0.025, 0);
    var head = L.move(L.cylinder(GR + 0.01, GR + 0.018, 0.09, N, 'graphite', { capTop: false, capBottom: false }), 0, H + 0.045, 0);
    var top = H + 0.09;
    var grid = L.emit(L.move(L.disc(GR, N, 'glowCool'), 0, top - 0.004, 0));
    var bars = [];
    for (k = -1; k <= 1; k++) {
      var z = k * 0.05, half = Math.sqrt(GR * GR - z * z) * 0.97;
      bars.push(L.quad([-half, top - 0.002, z + 0.007], [half, top - 0.002, z + 0.007], [half, top - 0.002, z - 0.007], [-half, top - 0.002, z - 0.007], 'graphite'));
      bars.push(L.quad([z - 0.007, top - 0.002, half], [z + 0.007, top - 0.002, half], [z + 0.007, top - 0.002, -half], [z - 0.007, top - 0.002, -half], 'graphite'));
    }
    var mesh = L.merge([block, head, coil, grid].concat(foilBand, bars));
    return finishPart(mesh, nameOf(part, 'Iodine ion thruster') + ': a block with a round thruster head and a glowing ion grid');
  }

  // =====================================================================================
  // Registration
  // =====================================================================================
  var B = L.models.body, P = L.models.part;
  B['explorer-body'] = explorerBody;
  B['drum-body'] = drumBody;
  B['smallsat-bus'] = smallsatBus;
  B['nimbus-bus'] = nimbusBus;
  B['cubesat-12u'] = cubesat12u;
  P['spin-stabilised'] = spinPart;
  P['reaction-wheels'] = wheelsPart;
  P['prop-green-small'] = propGreenSmall;
  P['prop-green-large'] = propGreenLarge;
  P['prop-ion'] = propIon;
})(typeof LowPoly !== 'undefined' ? LowPoly : null);
