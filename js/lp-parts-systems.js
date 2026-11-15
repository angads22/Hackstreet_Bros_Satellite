/*
 * lp-parts-systems.js: LowPoly part models for the power, comms and computer parts.
 * Load after lowpoly.js. Adds keys to LowPoly.models.part only; creates no globals.
 *
 * Part frame (API.md): attachment point at the origin, the part extends outward along +Y
 * (lowest point exactly y = 0), and any face that must look somewhere (a solar panel's
 * cells, a patch, a dish, a clock face, an LED) looks along +Z.
 * Scale: about 1 unit = 1 metre, anchored to a body of about 1.2 x 1.4 x 1.2 units
 * (LowPoly.fallback("body")). Small boxes are drawn larger than life so they read on a
 * satellite; the solar panels are close to their real 0.6 x 1.1 m and 1.07 x 1.1 m.
 */
(function () {
  'use strict';
  if (typeof LowPoly === 'undefined' || !LowPoly || !LowPoly.models || !LowPoly.models.part) return;
  var L = LowPoly;
  var REG = L.models.part;
  var D = 0.003;   // decal offset in front of a face

  // ---------------------------------------------------------------- helpers (local)
  function merge(list) { return L.merge(list); }
  // box centred at x, y, z
  function bxAt(w, h, d, c, x, y, z) { return L.move(L.box(w, h, d, c), x || 0, y || 0, z || 0); }
  // box standing on y0
  function bxOn(w, h, d, c, x, y0, z) { return L.move(L.box(w, h, d, c), x || 0, (y0 || 0) + h / 2, z || 0); }
  // box with chamfered vertical edges, standing on y0
  function cbOn(w, h, d, ch, c, x, y0, z) {
    var a = w / 2, b = d / 2;
    var m = L.prism([[-a + ch, -b], [a - ch, -b], [a, -b + ch], [a, b - ch], [a - ch, b], [-a + ch, b], [-a, b - ch], [-a, -b + ch]], h, c);
    return L.move(m, x || 0, (y0 || 0) + h / 2, z || 0);
  }
  // vertical cylinder (frustum if rb given) standing on y0
  function cyOn(r, h, sides, c, x, y0, z, o, rb) {
    return L.move(L.cylinder(r, rb === undefined ? r : rb, h, sides, c, o || {}), x || 0, (y0 || 0) + h / 2, z || 0);
  }
  // rod (cylinder) from p0 to p1, no caps by default
  function rod(p0, p1, r, sides, c, o) {
    var d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    var len = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
    var m = L.move(L.cylinder(r, r, len, sides || 4, c, o || { capTop: false, capBottom: false, phase: 45 }), 0, len / 2, 0);
    return L.place(m, { pos: p0, normal: d });
  }
  // flat rectangle in a plane z = const, facing +Z (or -Z)
  function qz(x0, y0, x1, y1, z, c) { return L.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], c); }
  function qzBack(x0, y0, x1, y1, z, c) { return L.quad([x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], c); }
  // flat rectangle in a plane y = const, facing +Y
  function qy(x0, z0, x1, z1, y, c) { return L.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], c); }
  // disc facing +Z, centred at x, y, z
  function discZ(r, sides, c, x, y, z) { return L.move(L.rotate(L.disc(r, sides, c), 90, 0, 0), x, y, z); }
  // disc facing +Y
  function discY(r, sides, c, x, y, z) { return L.move(L.disc(r, sides, c), x, y, z); }
  // a small faceted bead (two cones base to base), centred at p
  function bead(r, h, sides, c, p) {
    var up = L.move(L.cylinder(0, r, h / 2, sides, c, { capBottom: false }), 0, h / 4, 0);
    var dn = L.move(L.cylinder(r, 0, h / 2, sides, c, { capTop: false }), 0, -h / 4, 0);
    return L.move(merge([up, dn]), p[0], p[1], p[2]);
  }
  // emissive square on a +Z face
  function ledZ(x, y, z, s, c) { return L.emit(qz(x - s / 2, y - s / 2, x + s / 2, y + s / 2, z, c || 'glow')); }
  // grid lines (as thin strips) over a +Z rectangle: cols x rows cells
  function gridZ(x0, y0, x1, y1, z, cols, rows, lw, c) {
    var out = [], i, t;
    for (i = 1; i < cols; i++) { t = x0 + (x1 - x0) * i / cols; out.push(qz(t - lw / 2, y0, t + lw / 2, y1, z, c)); }
    for (i = 1; i < rows; i++) { t = y0 + (y1 - y0) * i / rows; out.push(qz(x0, t - lw / 2, x1, t + lw / 2, z, c)); }
    return merge(out);
  }
  // a framed cell panel in the XY plane, cells on the +Z face, bottom edge at y0
  function cellPanel(o) {
    var w = o.w, h = o.h, t = o.t || 0.03, m = o.margin || 0.03, y0 = o.y0 || 0;
    var x0 = -w / 2 + m, x1 = w / 2 - m, ya = y0 + m, yb = y0 + h - m, zf = t / 2;
    var parts = [
      bxAt(w, h, t, o.frame || 'silver', 0, y0 + h / 2, 0),
      qz(x0, ya, x1, yb, zf + D, o.cell || 'cell'),
      gridZ(x0, ya, x1, yb, zf + 2 * D, o.cols, o.rows, o.line || 0.014, o.lineColor || 'cellEdge'),
      qzBack(x0, ya, x1, yb, -zf - D, o.back || 'graphite')
    ];
    if (o.braces) {   // back cross-members, so the back reads as a panel too
      var bw = 0.016, my = (ya + yb) / 2;
      parts.push(qzBack(-bw, ya, bw, yb, -zf - 2 * D, o.braces));
      parts.push(qzBack(x0, my - bw, x1, my + bw, -zf - 2 * D, o.braces));
    }
    if (o.extra) parts.push(o.extra(x0, ya, x1, yb, zf + 3 * D));
    return merge(parts);
  }

  // ---------------------------------------------------------------- registration
  function register(id, name, build) {
    REG[id] = function (part) {
      var mesh = build(part || {});
      var b = L.bounds(mesh);
      return {
        mesh: mesh,
        size: [b.size[0], b.size[1], b.size[2]],
        label: (part && typeof part.name === 'string' && part.name) ? part.name : name
      };
    };
  }

  // ================================================================ POWER

  // A deployed solar wing: drive block at the root, a V yoke, a framed panel of cells facing +Z.
  function solarWing(w, h, cols, rows, yokeSpread, seam) {
    var arm = 0.26, yw = yokeSpread / 2;
    return merge([
      bxOn(0.11, 0.07, 0.1, 'metalDark', 0, 0, 0),
      rod([-0.03, 0.06, 0], [-yw, arm + 0.01, 0], 0.014, 4, 'steel'),
      rod([0.03, 0.06, 0], [yw, arm + 0.01, 0], 0.014, 4, 'steel'),
      bxAt(yokeSpread + 0.08, 0.035, 0.04, 'graphite', 0, arm + 0.012, 0),
      cellPanel({
        w: w, h: h, y0: arm, cols: cols, rows: rows, frame: 'silver', back: 'steel', braces: 'silver',
        extra: seam ? function (x0, ya, x1, yb, z) { return qz(-0.011, ya, 0.011, yb, z, 'silver'); } : null
      })
    ]);
  }

  // Small solar panel: 0.6 x 1.1 m, one tall panel, 3 x 6 cells.
  register('solar-small', 'Small solar panel', function () {
    return solarWing(0.6, 1.1, 3, 6, 0.36, false);
  });

  // Large solar panel: 1.07 x 1.1 m, nearly square, 6 x 6 cells in two strings, wider yoke.
  register('solar-large', 'Large solar panel', function () {
    return solarWing(1.07, 1.1, 6, 6, 0.6, true);
  });

  // Early silicon cells (Vanguard, Explorer 6 era): a square paddle on a thin strut.
  register('silicon-cells', 'Early silicon solar cells', function () {
    return merge([
      bxOn(0.08, 0.05, 0.08, 'steel', 0, 0, 0),
      rod([0, 0.04, 0], [0, 0.35, 0], 0.014, 4, 'silver'),
      bxAt(0.1, 0.03, 0.03, 'steel', 0, 0.35, 0),
      cellPanel({ w: 0.42, h: 0.42, y0: 0.34, t: 0.022, margin: 0.025, cols: 4, rows: 5, frame: 'silver', back: 'steel', line: 0.012 })
    ]);
  });

  // Radiation-hard n-on-p cells (1963): a wider landscape panel on a hinge and V yoke, gold frame,
  // lighter cells with a cover-strip along the bottom.
  register('n-on-p-cells', 'Radiation-hard n-on-p solar cells', function () {
    return merge([
      bxOn(0.14, 0.05, 0.07, 'graphite', 0, 0, 0),
      rod([-0.035, 0.04, 0], [-0.2, 0.25, 0], 0.013, 4, 'steel'),
      rod([0.035, 0.04, 0], [0.2, 0.25, 0], 0.013, 4, 'steel'),
      cellPanel({
        w: 0.56, h: 0.36, y0: 0.24, t: 0.024, margin: 0.028, cols: 6, rows: 3, frame: 'gold', back: 'cream',
        cell: 'cellEdge', lineColor: 'cell', line: 0.012
      })
    ]);
  });

  // Mercury batteries (Explorer 1, 1958): a strapped pair of tall round cells with terminals.
  register('mercury-battery', 'Mercury batteries', function () {
    var r = 0.06, h = 0.24, dx = 0.064;
    return merge([
      cyOn(r, h, 6, 'steel', -dx, 0, 0, { capBottom: false, phase: 30 }),
      cyOn(r, h, 6, 'steel', dx, 0, 0, { capBottom: false, phase: 30 }),
      cyOn(0.022, 0.03, 4, 'silver', -dx, h, 0, { capBottom: false, phase: 45 }),
      cyOn(0.022, 0.03, 4, 'silver', dx, h, 0, { capBottom: false, phase: 45 }),
      bxOn(0.268, 0.036, 0.126, 'copper', 0, 0.15, 0),
      bxOn(0.27, 0.035, 0.128, 'graphite', 0, 0, 0)
    ]);
  });

  // Silver-zinc batteries (Sputnik 1): a big, heavy dark case with a lid, three cells marked
  // on the front, and two thick terminal posts.
  register('silver-zinc-battery', 'Silver-zinc batteries', function () {
    var w = 0.44, h = 0.24, d = 0.3, zf = d / 2 + D;
    return merge([
      bxOn(w, h, d, 'steel', 0, 0, 0),
      bxOn(w + 0.03, 0.035, d + 0.03, 'graphite', 0, h, 0),
      qz(-w / 2 + 0.02, 0.06, w / 2 - 0.02, 0.15, zf, 'cream'),
      qz(-w / 6 - 0.008, 0.02, -w / 6 + 0.008, h - 0.02, zf + D, 'black'),
      qz(w / 6 - 0.008, 0.02, w / 6 + 0.008, h - 0.02, zf + D, 'black'),
      qzBack(-w / 2 + 0.02, 0.06, w / 2 - 0.02, 0.15, -zf, 'cream'),
      qzBack(-w / 6 - 0.008, 0.02, -w / 6 + 0.008, h - 0.02, -zf - D, 'black'),
      qzBack(w / 6 - 0.008, 0.02, w / 6 + 0.008, h - 0.02, -zf - D, 'black'),
      cyOn(0.034, 0.06, 6, 'red', -0.13, h + 0.035, 0, { capBottom: false }),
      cyOn(0.034, 0.06, 6, 'steel', 0.13, h + 0.035, 0, { capBottom: false })
    ]);
  });

  // Nickel-cadmium batteries (TIROS, 1960): a block of four flat rechargeable cells side by side,
  // tied with a steel band, a copper tab on each cell.
  register('nicad-battery', 'Nickel-cadmium batteries', function () {
    var cw = 0.068, gap = 0.008, h = 0.19, d = 0.15, out = [], i;
    for (i = 0; i < 4; i++) {
      var x = (i - 1.5) * (cw + gap);
      out.push(bxOn(cw, h, d, i % 2 ? 'white' : 'cream', x, 0, 0));
      out.push(qy(x - 0.018, -0.03, x + 0.018, 0.03, h + D, 'copper'));
    }
    out.push(bxOn(4 * cw + 3 * gap + 0.02, 0.04, d + 0.02, 'steel', 0, 0.075, 0));
    return merge(out);
  });

  // Li-ion battery (modern 28 V modular pack): a dark case showing its cylindrical cell tops,
  // an orange warning band, a connector and a green charge LED.
  register('battery-28v', 'Li-ion battery', function () {
    var w = 0.32, h = 0.15, d = 0.22, zf = d / 2 + D, out = [], i, j;
    out.push(bxOn(w, h, d, 'metalDark', 0, 0, 0));
    out.push(qy(-w / 2 + 0.015, -d / 2 + 0.015, w / 2 - 0.015, d / 2 - 0.015, h + D, 'graphite'));
    for (i = 0; i < 3; i++) for (j = 0; j < 2; j++) out.push(discY(0.036, 6, 'silver', -0.095 + i * 0.095, h + 2 * D, -0.045 + j * 0.09));
    out.push(qz(-w / 2 + 0.01, 0.03, w / 2 - 0.01, 0.06, zf, 'orange'));
    out.push(bxOn(0.07, 0.04, 0.03, 'black', 0.09, 0.08, d / 2));
    out.push(ledZ(-0.11, 0.105, zf, 0.022, 'green'));
    out.push(qzBack(-w / 2 + 0.01, 0.03, w / 2 - 0.01, 0.06, -zf, 'orange'));
    out.push(qzBack(-0.06, 0.08, 0.06, 0.12, -zf, 'graphite'));
    return merge(out);
  });

  // ================================================================ COMMS

  // 108 MHz Minitrack beacon (1958): a small transmitter can with one long whip and a tip bead.
  register('minitrack-beacon', '108 MHz Minitrack beacon', function () {
    return merge([
      cyOn(0.075, 0.1, 6, 'silver', 0, 0, 0),
      cyOn(0.077, 0.025, 6, 'red', 0, 0.06, 0, { capTop: false, capBottom: false }),
      cyOn(0.026, 0.07, 6, 'black', 0, 0.1, 0, { capBottom: false }),
      rod([0, 0.16, 0], [0, 0.86, 0], 0.012, 4, 'silver'),
      bead(0.028, 0.07, 4, 'red', [0, 0.87, 0])
    ]);
  });

  // 235 MHz telemetry (TIROS, 1960): a squat hub with a turnstile of four splayed whips.
  register('vhf-telemetry', '235 MHz telemetry link', function () {
    var out = [cyOn(0.1, 0.1, 6, 'white', 0, 0, 0),
      cyOn(0.102, 0.022, 6, 'graphite', 0, 0.025, 0, { capTop: false, capBottom: false })];
    var i, a, s = Math.sin(Math.PI / 4), c = Math.cos(Math.PI / 4), len = 0.6;
    for (i = 0; i < 4; i++) {
      a = Math.PI / 4 + i * Math.PI / 2;
      var p0 = [0.05 * Math.cos(a), 0.09, 0.05 * Math.sin(a)];
      var dir = [Math.cos(a) * s, c, Math.sin(a) * s];
      var p1 = [p0[0] + dir[0] * len, p0[1] + dir[1] * len, p0[2] + dir[2] * len];
      out.push(rod(p0, p1, 0.012, 3, 'silver'));
      out.push(bead(0.024, 0.06, 3, 'steel', p1));
    }
    return merge(out);
  });

  // PCM digital telemetry (1964): an encoder box with a row of bit lights and a V dipole.
  register('pcm-telemetry', 'PCM digital telemetry', function () {
    var w = 0.26, h = 0.13, d = 0.17, zf = d / 2 + D, out = [], i;
    out.push(bxOn(w, h, d, 'cream', 0, 0, 0));
    out.push(qz(-w / 2 + 0.02, 0.025, w / 2 - 0.02, 0.07, zf, 'graphite'));
    for (i = 0; i < 5; i++) {
      var on = (i === 0 || i === 2 || i === 3);
      var q = qz(-0.09 + i * 0.045 - 0.014, 0.034, -0.09 + i * 0.045 + 0.014, 0.061, zf + D, on ? 'glow' : 'black');
      out.push(on ? L.emit(q) : q);
    }
    out.push(qzBack(-w / 2 + 0.02, 0.025, w / 2 - 0.02, 0.1, -zf, 'graphite'));
    out.push(bxOn(0.07, 0.05, 0.07, 'steel', 0, h, 0));
    var dip = merge([
      rod([-0.02, h + 0.04, 0], [-0.31, h + 0.46, 0], 0.011, 4, 'silver'),
      rod([0.02, h + 0.04, 0], [0.31, h + 0.46, 0], 0.011, 4, 'silver'),
      bead(0.022, 0.055, 4, 'steel', [-0.31, h + 0.46, 0]),
      bead(0.022, 0.055, 4, 'steel', [0.31, h + 0.46, 0])
    ]);
    out.push(L.rotate(dip, 0, 30, 0));
    return merge(out);
  });

  // UHF radio (modern CubeSat transceiver): a small module under a black antenna deployer
  // with four tape-spring antennas swept out in a pinwheel.
  register('radio-uhf', 'UHF radio', function () {
    var out = [bxOn(0.24, 0.09, 0.24, 'silver', 0, 0, 0), bxOn(0.28, 0.035, 0.28, 'black', 0, 0.09, 0)];
    out.push(qz(-0.1, 0.02, 0.03, 0.065, 0.12 + D, 'gold'));
    out.push(ledZ(0.07, 0.045, 0.12 + D, 0.024, 'glowCool'));
    var i, len = 0.3, wd = 0.046, tilt = 18 * Math.PI / 180, y = 0.118;
    for (i = 0; i < 4; i++) {
      var a = i * Math.PI / 2;
      // start near a corner, run along the edge direction and out
      var cx = 0.125, cz = 0.125;
      var sx = Math.cos(a) * cx - Math.sin(a) * cz, sz = Math.sin(a) * cx + Math.cos(a) * cz;
      var dx = -Math.sin(a), dz = Math.cos(a);      // tangent direction
      var nx = Math.cos(a), nz = Math.sin(a);       // across the tape
      var ex = sx + dx * len * Math.cos(tilt), ez = sz + dz * len * Math.cos(tilt), ey = y + len * Math.sin(tilt);
      // tape: a thin double-sided strip from (sx,y,sz) to (ex,ey,ez), width wd across n
      var h2 = wd / 2;
      out.push(L.quad([sx - nx * h2, y, sz - nz * h2], [ex - nx * h2, ey, ez - nz * h2], [ex + nx * h2, ey, ez + nz * h2], [sx + nx * h2, y, sz + nz * h2], 'cream', true));
    }
    return merge(out);
  });

  // S-band transmitter: a silver transmitter box and a square patch antenna standing on it,
  // the patch face looking along +Z.
  register('radio-sband', 'S-band transmitter', function () {
    var bw = 0.24, bh = 0.07, bd = 0.16, tw = 0.26, th = 0.26, tz = 0.04, ty = bh;
    var zt = bd / 2 - tz / 2, zf = zt + tz / 2 + D;
    return merge([
      bxOn(bw, bh, bd, 'silver', 0, 0, 0),
      ledZ(0.08, 0.035, bd / 2 + D, 0.02, 'glow'),
      bxOn(tw, th, tz, 'white', 0, ty, zt),
      qz(-0.07, ty + th / 2 - 0.07, 0.07, ty + th / 2 + 0.07, zf, 'gold'),
      qz(-0.016, ty + th / 2 - 0.016, 0.016, ty + th / 2 + 0.016, zf + D, 'copper'),
      bxOn(0.05, 0.035, 0.05, 'black', -0.07, bh, -0.03)
    ]);
  });

  // X-band transmitter: a small parabolic dish on a mast, looking along +Z, with a feed horn.
  register('radio-xband', 'X-band transmitter', function () {
    var cy = 0.34, cz = 0.05, R = 0.25;
    var prof = [[0, 0], [0.13, 0.028], [R, 0.085]];
    var back = L.lathe(prof, 8, 'steel');
    var inner = L.lathe([[R, 0.085], [0.13, 0.028], [0, 0]], 8, 'white');
    var dish = L.move(L.rotate(merge([back, inner]), 90, 0, 0), 0, cy, cz);
    var feedTip = [0, cy, cz + 0.2];
    return merge([
      bxOn(0.14, 0.04, 0.14, 'graphite', 0, 0, 0),
      rod([0, 0.04, 0], [0, cy, 0], 0.022, 4, 'steel'),
      bxAt(0.08, 0.08, 0.07, 'metalDark', 0, cy, 0.005),
      dish,
      rod([0, cy, cz + 0.02], feedTip, 0.01, 4, 'silver'),
      L.move(L.rotate(L.cylinder(0.035, 0.012, 0.05, 5, 'gold', {}), -90, 0, 0), feedTip[0], feedTip[1], feedTip[2] - 0.01)
    ]);
  });

  // ================================================================ COMPUTERS

  // Clock and command receiver (1958): a small box with a clock face, a relay can and a lamp.
  register('command-timer', 'Clock and command receiver', function () {
    var w = 0.22, h = 0.15, d = 0.14, zf = d / 2 + D, cx = -0.035, cyy = 0.075;
    return merge([
      bxOn(w, h, d, 'silver', 0, 0, 0),
      discZ(0.052, 10, 'cream', cx, cyy, zf),
      qz(cx - 0.005, cyy - 0.004, cx + 0.005, cyy + 0.042, zf + D, 'black'),
      qz(cx - 0.004, cyy - 0.005, cx + 0.03, cyy + 0.005, zf + D, 'black'),
      ledZ(0.065, 0.105, zf, 0.022, 'glow'),
      qz(0.045, 0.03, 0.085, 0.06, zf, 'graphite'),
      qzBack(-0.08, 0.03, 0.08, 0.12, -zf, 'graphite'),
      qzBack(-0.05, 0.05, 0.0, 0.08, -zf - D, 'black'),
      cyOn(0.036, 0.06, 6, 'steel', 0.05, h, -0.02, { capBottom: false })
    ]);
  });

  // Miniature tape recorder (Explorer 3, 1958): a box with two tape reels and a lamp.
  register('tape-recorder', 'Miniature tape recorder', function () {
    var w = 0.28, h = 0.17, d = 0.12, zf = d / 2, ry = 0.1, out = [], i;
    out.push(bxOn(w, h, d, 'steel', 0, 0, 0));
    for (i = -1; i <= 1; i += 2) {
      out.push(L.move(L.rotate(L.cylinder(0.052, 0.052, 0.022, 8, 'black', { capBottom: false, phase: 22.5 }), 90, 0, 0), i * 0.066, ry, zf + 0.011));
      out.push(discZ(0.017, 6, 'silver', i * 0.066, ry, zf + 0.022 + D));
    }
    out.push(qz(-0.066, ry - 0.054, 0.066, ry - 0.044, zf + D, 'copper'));
    out.push(qz(-0.02, 0.025, 0.02, 0.05, zf + D, 'silver'));
    out.push(qzBack(-0.11, 0.03, 0.11, 0.14, -zf - D, 'graphite'));
    out.push(qzBack(0.03, 0.05, 0.09, 0.08, -zf - 2 * D, 'black'));
    out.push(ledZ(0.105, 0.03, zf + D, 0.02, 'glow'));
    return merge(out);
  });

  // Basic flight computer (modern, no hardening): an open green circuit board with chips in a tray.
  register('obc-basic', 'Basic flight computer', function () {
    var by = 0.035, bt = 0.016, top = by + bt;
    return merge([
      bxOn(0.25, by, 0.23, 'silver', 0, 0, 0),
      bxOn(0.23, bt, 0.21, 'green', 0, by, 0),
      bxOn(0.075, 0.018, 0.075, 'black', -0.03, top, 0.01),
      bxOn(0.06, 0.014, 0.035, 'graphite', 0.065, top, -0.04),
      bxOn(0.15, 0.03, 0.028, 'black', -0.02, top, -0.085),
      L.emit(qz(0.07, by + 0.002, 0.095, top - 0.002, 0.105 + D, 'glow')),
      qzBack(-0.08, 0.008, 0.04, 0.028, -0.115 - D, 'black'),
      L.emit(qy(0.07, 0.07, 0.095, 0.095, top + D, 'glow'))
    ]);
  });

  // Radiation-tolerant computer: a heavy dark box wrapped in two steel armour bands,
  // a gold shield plate on top, a connector and a cool status LED.
  register('obc-radtol', 'Radiation-tolerant computer', function () {
    var w = 0.22, h = 0.14, d = 0.18, zf = d / 2 + D;
    return merge([
      bxOn(w, h, d, 'metalDark', 0, 0, 0),
      bxOn(w + 0.016, 0.026, d + 0.016, 'steel', 0, 0.018, 0),
      bxOn(w + 0.016, 0.026, d + 0.016, 'steel', 0, 0.092, 0),
      bxOn(w + 0.03, 0.022, d + 0.03, 'gold', 0, h, 0),
      qz(-0.08, 0.052, 0.0, 0.08, zf, 'black'),
      qzBack(-0.06, 0.052, 0.06, 0.08, -zf, 'black'),
      ledZ(0.06, 0.066, zf, 0.022, 'glowCool')
    ]);
  });

  // Payload data computer (FPGA, big memory): a card cage with four boards, each with a lamp,
  // and heat-sink fins on top.
  register('obc-payload', 'Payload data computer', function () {
    var w = 0.32, h = 0.2, d = 0.22, zf = d / 2 + D, out = [], i;
    out.push(bxOn(w, h, d, 'metalDark', 0, 0, 0));
    for (i = 0; i < 4; i++) {
      var x = -0.105 + i * 0.07;
      out.push(qz(x - 0.029, 0.015, x + 0.029, h - 0.015, zf, 'silver'));
      out.push(L.emit(qz(x - 0.011, h - 0.05, x + 0.011, h - 0.03, zf + D, i % 2 ? 'glowCool' : 'glow')));
      out.push(qz(x - 0.016, 0.03, x + 0.016, 0.05, zf + D, 'black'));
    }
    out.push(qzBack(-w / 2 + 0.02, 0.02, w / 2 - 0.02, h - 0.02, -zf, 'graphite'));
    out.push(qzBack(-0.1, 0.04, 0.0, 0.08, -zf - D, 'black'));
    out.push(qzBack(0.03, 0.04, 0.11, 0.08, -zf - D, 'black'));
    for (i = 0; i < 3; i++) out.push(bxOn(0.026, 0.05, d - 0.02, 'steel', -0.09 + i * 0.09, h, 0));
    return merge(out);
  });
})();
