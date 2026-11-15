// lp-parts-instruments.js: low-poly models for the twelve instruments in data/parts.js.
// Registers LowPoly.models.part[id](part) -> {mesh, size, label}. Creates no globals.
//
// Part frame (API.md section 1): the attachment point is the origin, the part extends outward
// along +Y, and anything that looks somewhere (a lens, a detector window, a collimator, the radar
// array face) looks along +Z. Nothing goes below y = 0.
// Scale: the engine's placeholder body is 1.2 x 1.4 x 1.2 units, so roughly 1 unit = 1 metre.
// The 1958-1964 instruments are 0.2 to 0.45 units, the modern ones up to 0.6, the radar array
// 1.7 wide and the sounder booms about 1.4 long (stylised: the real ones were tens of metres).
(function () {
  'use strict';
  var L = (typeof LowPoly !== 'undefined') ? LowPoly : null;
  if (!L || !L.models || !L.models.part) return;
  var REG = L.models.part;
  var TAU = Math.PI * 2, DEG = Math.PI / 180;

  // ---------------------------------------------------------------- local helpers
  // Box with its bottom face at y0, centred on x, z.
  function boxAt(w, h, d, c, x, y0, z) { return L.move(L.box(w, h, d, c), x || 0, (y0 || 0) + h / 2, z || 0); }

  // Upright cylinder (or frustum) from y0 to y1 at (x, z). rBot at y0, rTop at y1.
  function tubeY(rBot, rTop, y0, y1, sides, c, x, z, o) {
    return L.move(L.cylinder(rTop, rBot, y1 - y0, sides, c, o), x || 0, (y0 + y1) / 2, z || 0);
  }

  // Cylinder lying along Z from z0 (back, radius rBack) to z1 (front, radius rFront), axis at (x, y).
  // A Y cylinder turned +90 degrees about X: its top cap becomes the front (+Z) cap and a ring
  // point at angle a lands on (r cos a, r sin a), so sides = 6 or phase = 180/sides gives a flat underside.
  function tubeZ(rBack, rFront, z0, z1, sides, c, x, y, o) {
    var m = L.rotate(L.cylinder(rFront, rBack, z1 - z0, sides, c, o), 90, 0, 0);
    return L.move(m, x || 0, y || 0, (z0 + z1) / 2);
  }

  // Flat polygon facing +Z at depth z, centred on (x, y), matching tubeZ's facets (same phase).
  function discZ(r, sides, c, x, y, z, phase) {
    var t = [], i, p = (phase || 0) * DEG;
    x = x || 0; y = y || 0;
    for (i = 0; i < sides; i++) {
      var a0 = p + TAU * i / sides, a1 = p + TAU * (i + 1) / sides;
      t.push({ v: [[x, y, z], [x + r * Math.cos(a0), y + r * Math.sin(a0), z], [x + r * Math.cos(a1), y + r * Math.sin(a1), z]], c: c, e: 0 });
    }
    return { tris: t };
  }

  // Rectangle decal facing +Z (or -Z when back is true) in the plane z.
  function rectZ(x0, y0, x1, y1, z, c, back) {
    return back ? L.quad([x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], c)
                : L.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], c);
  }

  // Open shell along Z (both windings, so it reads from inside and out). zf(a) gives the front edge
  // depth at ring angle a, so a hood can be cut on a slant.
  function shellZ(rBack, rFront, z0, zf, sides, c, x, y, phase) {
    var t = [], i, p = (phase || 0) * DEG;
    x = x || 0; y = y || 0;
    function P(r, a, z) { return [x + r * Math.cos(a), y + r * Math.sin(a), z]; }
    for (i = 0; i < sides; i++) {
      var a0 = p + TAU * i / sides, a1 = p + TAU * (i + 1) / sides;
      var b0 = P(rBack, a0, z0), b1 = P(rBack, a1, z0), f0 = P(rFront, a0, zf(a0)), f1 = P(rFront, a1, zf(a1));
      t.push({ v: [b0, b1, f1], c: c, e: 0 }, { v: [b0, f1, f0], c: c, e: 0 });   // outside
      t.push({ v: [b0, f1, b1], c: c, e: 0 }, { v: [b0, f0, f1], c: c, e: 0 });   // inside
    }
    return { tris: t };
  }

  // A thin square rod from the origin along +Y, len long, capped at the far end.
  function rod(len, r, c) { return tubeY(r, r, 0, len, 4, c, 0, 0, { capBottom: false, phase: 45 }); }

  function register(id, name, build) {
    REG[id] = function (part) {
      var mesh = build(part || {});
      var b = L.bounds(mesh);
      return { mesh: mesh, size: [b.size[0], b.size[1], b.size[2]], label: (part && typeof part.name === 'string' && part.name) ? part.name : name };
    };
  }

  // ================================================================ 1958-1964: small tubes and boxes

  // Explorer 1 (1958). One Geiger-Muller tube standing on its little amplifier box: a pencil on a block.
  register('cosmic-ray-counter', 'Geiger counter package', function () {
    return L.merge([
      boxAt(0.24, 0.025, 0.18, 'graphite', 0, 0, 0),
      boxAt(0.18, 0.09, 0.13, 'silver', 0, 0.025, 0),
      tubeY(0.05, 0.05, 0.115, 0.15, 6, 'graphite', 0, 0, { capBottom: false }),
      tubeY(0.036, 0.036, 0.15, 0.38, 6, 'silver', 0, 0, { capBottom: false, capTop: false }),
      tubeY(0.043, 0.043, 0.215, 0.235, 6, 'graphite', 0, 0, { capBottom: false, capTop: false }),   // clamp bands
      tubeY(0.043, 0.043, 0.31, 0.33, 6, 'graphite', 0, 0, { capBottom: false, capTop: false }),
      tubeY(0.036, 0.026, 0.38, 0.41, 6, 'gold', 0, 0, { capBottom: false })   // mica end window
    ]);
  });

  // Explorer 4 (1958). A scintillation crystal on a photomultiplier tube: a fat-headed bottle lying on
  // its electronics box, the crystal window looking +Z.
  register('scintillation-counter', 'Scintillation counter (Explorer 4)', function () {
    var yc = 0.07 + 0.866 * 0.072;   // the 6-sided can rests flat on the box
    return L.merge([
      boxAt(0.2, 0.07, 0.3, 'steel', 0, 0, 0),
      boxAt(0.07, 0.03, 0.05, 'graphite', 0, 0.065, -0.07),                         // saddle under the tube
      tubeZ(0.042, 0.042, -0.15, 0.02, 6, 'graphite', 0, yc, { capTop: false }),     // photomultiplier
      tubeZ(0.042, 0.072, 0.02, 0.05, 6, 'steel', 0, yc, { capTop: false, capBottom: false }),
      tubeZ(0.072, 0.072, 0.05, 0.15, 6, 'silver', 0, yc, { capTop: false, capBottom: false }),
      discZ(0.072, 6, 'cream', 0, yc, 0.15)                                          // crystal window
    ]);
  });

  // Vanguard 2 (1959). Two photocells in short tubes, splayed apart like a pair of eyes, with a
  // shading vane between them.
  register('cloud-photocell', 'Cloud-cover photocells', function () {
    var r = 0.045, yc = 0.05 + 0.866 * r;
    function cell(side) {
      var m = L.merge([
        tubeZ(r, r, -0.06, 0.05, 6, 'copper', 0, 0, { capTop: false }),
        discZ(r, 6, 'graphite', 0, 0, 0.05),
        discZ(0.03, 6, 'cell', 0, 0, 0.05)
      ]);
      return L.move(L.rotate(m, 0, side * 28, 0), side * 0.085, yc, 0.01);
    }
    return L.merge([
      boxAt(0.32, 0.05, 0.17, 'silver', 0, 0, 0),
      cell(-1), cell(1),
      L.quad([0, 0.05, -0.07], [0, 0.05, 0.07], [0, 0.17, 0.05], [0, 0.17, -0.04], 'steel', true)   // vane
    ]);
  });

  // TIROS 1 (1960). Two cylindrical vidicon cameras side by side on a cradle: one wide (short flared
  // hood), one narrow (long thin lens).
  register('vidicon-camera', 'Vidicon TV cameras', function () {
    var r = 0.065, yc = 0.03 + 0.866 * r, xa = -0.085, xb = 0.085;
    return L.merge([
      boxAt(0.34, 0.03, 0.27, 'steel', 0, 0, 0),
      // wide-angle camera
      tubeZ(r, r, -0.13, 0.07, 6, 'cream', xa, yc),
      discZ(0.045, 6, 'cell', xa, yc, 0.07),
      shellZ(0.045, 0.072, 0.07, function () { return 0.115; }, 6, 'black', xa, yc),
      // narrow-angle camera
      tubeZ(r, r, -0.13, 0.07, 6, 'cream', xb, yc),
      tubeZ(0.034, 0.034, 0.07, 0.17, 6, 'black', xb, yc, { capTop: false, capBottom: false }),
      discZ(0.034, 6, 'cell', xb, yc, 0.17)
    ]);
  });

  // SOLRAD 1 (1960). One ionization chamber on a post, looking +Z through a flared gold sun hood:
  // a small periscope.
  register('solar-xray-photometer', 'Solar X-ray photometer', function () {
    var r = 0.06, yc = 0.15 + 0.866 * r;
    return L.merge([
      boxAt(0.16, 0.03, 0.18, 'graphite', 0, 0, 0),
      tubeY(0.022, 0.022, 0.03, 0.16, 4, 'steel', 0, 0, { capTop: false, capBottom: false, phase: 45 }),
      tubeZ(r, r, -0.1, 0.06, 6, 'silver', 0, yc, { capTop: false }),
      discZ(r, 6, 'graphite', 0, yc, 0.06),
      discZ(0.035, 6, 'black', 0, yc, 0.06),                                    // beryllium window
      shellZ(r, 0.088, 0.06, function () { return 0.12; }, 6, 'gold', 0, yc)   // sun hood
    ]);
  });

  // Alouette 1 (1962). The sounder's box with two boom reels and a pair of long STEM booms in a V.
  register('topside-sounder', 'Topside sounder (Alouette 1)', function () {
    var len = 1.25, tilt = 26, out = [
      boxAt(0.38, 0.15, 0.3, 'steel', 0, 0, 0),
      rectZ(-0.14, 0.035, 0.14, 0.115, 0.15, 'cream')                           // front panel
    ];
    [-1, 1].forEach(function (s) {
      out.push(tubeY(0.062, 0.062, 0.15, 0.24, 6, 'copper', s * 0.1, 0, { capBottom: false }));
      out.push(L.move(L.rotate(rod(len, 0.026, 'silver'), 0, 0, -s * tilt), s * 0.1, 0.23, 0));
    });
    return L.merge(out);
  });

  // Alouette 2 (1965). Built from Alouette 1's backup: a hexagonal sounder with two long booms and a
  // second, shorter crossed pair, so it reads as a cross rather than a V.
  register('alouette-2-sounder', 'Improved topside sounder (Alouette 2)', function () {
    var out = [
      tubeY(0.21, 0.21, 0, 0.15, 6, 'steel', 0, 0, { phase: 30 }),
      boxAt(0.2, 0.09, 0.2, 'copper', 0, 0.15, 0)                              // boom reels
    ];
    [-1, 1].forEach(function (s) {
      out.push(L.move(L.rotate(rod(1.35, 0.026, 'silver'), 0, 0, -s * 24), s * 0.06, 0.22, 0));  // long pair in X
      out.push(L.move(L.rotate(rod(0.72, 0.024, 'silver'), s * 34, 0, 0), 0, 0.22, s * 0.06));  // short pair in Z
    });
    return L.merge(out);
  });

  // OSO 1 (1962). A pointed instrument: a long box on trunnions in a fork, tilted up toward the Sun,
  // with a collimator grid over its whole front face and gold insulation on its back half.
  register('oso-xray-spectrometer', 'X-ray spectrometer (OSO 1)', function () {
    var w = 0.26, h = 0.16, d = 0.4, z = d / 2, cells = [], i, j;
    var cw = 0.05, ch = 0.055, gx = 0.012, gy = 0.014;
    for (i = 0; i < 4; i++) {
      for (j = 0; j < 2; j++) {
        var x0 = -2 * cw - 1.5 * gx + i * (cw + gx), y0 = -ch - gy / 2 + j * (ch + gy);
        cells.push(rectZ(x0, y0, x0 + cw, y0 + ch, z, 'black'));
      }
    }
    var head = L.merge([
      L.box(w, h, d, 'white'),
      L.move(L.box(w + 0.01, h + 0.01, 0.17, 'gold'), 0, 0, -0.11),
      rectZ(-w / 2, -h / 2, w / 2, h / 2, z, 'steel'),
      L.rotate(L.cylinder(0.035, 0.035, 0.36, 6, 'graphite'), 0, 0, 90)          // trunnion axle
    ].concat(cells));
    head = L.move(L.rotate(head, -18, 0, 0), 0, 0.215, 0);
    return L.merge([
      boxAt(0.22, 0.04, 0.2, 'graphite', 0, 0, 0),
      boxAt(0.36, 0.03, 0.08, 'steel', 0, 0.04, 0),
      boxAt(0.03, 0.22, 0.08, 'steel', -0.165, 0.04, 0),
      boxAt(0.03, 0.22, 0.08, 'steel', 0.165, 0.04, 0),
      head
    ]);
  });

  // Nimbus 1 (1964). Three box cameras fanned across track on a trapezoid mount.
  register('avcs-camera', 'Advanced vidicon camera system (Nimbus 1)', function () {
    function cam() {
      return L.merge([
        L.box(0.13, 0.13, 0.2, 'cream'),
        rectZ(-0.065, -0.065, 0.065, 0.065, -0.1, 'graphite', true),               // back plate
        tubeZ(0.05, 0.05, 0.1, 0.17, 6, 'black', 0, 0, { capTop: false, capBottom: false }),
        discZ(0.05, 6, 'cell', 0, 0, 0.17)
      ]);
    }
    var y = 0.05 + 0.065;
    return L.merge([
      L.move(L.prism([[-0.32, -0.11], [0.32, -0.11], [0.22, 0.13], [-0.22, 0.13]], 0.05, 'steel'), 0, 0.025, 0),
      L.move(cam(), 0, y, 0.01),
      L.move(L.rotate(cam(), 0, -35, 0), -0.2, y, -0.03),
      L.move(L.rotate(cam(), 0, 35, 0), 0.2, y, -0.03)
    ]);
  });

  // ================================================================ modern instruments

  // Thermal infrared imager. A stubby gold-wrapped housing with a fat 25 cm germanium lens and a
  // finned radiator for the detector cooler on top.
  register('thermal-imager', 'Thermal infrared imager', function () {
    var yc = 0.16, out = [
      boxAt(0.38, 0.03, 0.42, 'graphite', 0, 0, 0),
      boxAt(0.32, 0.26, 0.34, 'gold', 0, 0.03, -0.03),
      tubeZ(0.125, 0.125, 0.14, 0.24, 8, 'graphite', 0, yc, { capTop: false, capBottom: false, phase: 22.5 }),
      discZ(0.125, 8, 'steel', 0, yc, 0.24, 22.5),
      discZ(0.095, 8, 'black', 0, yc, 0.24, 22.5),
      boxAt(0.3, 0.015, 0.3, 'white', 0, 0.29, -0.03)
    ];
    [-0.1, 0, 0.1].forEach(function (x) { out.push(boxAt(0.016, 0.07, 0.26, 'silver', x, 0.305, -0.03)); });
    return L.merge(out);
  });

  // Optical camera (a Dove-class telescope). A long white barrel on a saddle with a black band, the
  // lens deep inside a hood cut on a slant (longer on top to shade the lens).
  register('optical-camera', 'Optical camera', function () {
    var r = 0.11, ph = 22.5, yc = 0.05 + r * Math.cos(ph * DEG), zb = 0.22;
    return L.merge([
      boxAt(0.22, 0.05, 0.34, 'graphite', 0, 0, -0.04),
      tubeZ(r, r, -0.26, 0.1, 8, 'white', 0, yc, { capTop: false, phase: ph }),
      tubeZ(r, r, 0.1, 0.14, 8, 'black', 0, yc, { capTop: false, capBottom: false, phase: ph }),
      tubeZ(r, r, 0.14, zb, 8, 'white', 0, yc, { capTop: false, capBottom: false, phase: ph }),
      discZ(r, 8, 'black', 0, yc, zb, ph),
      discZ(0.07, 8, 'cell', 0, yc, zb, ph),
      shellZ(r, r, zb, function (a) { return zb + 0.08 + 0.09 * (Math.sin(a) + 1) / 2; }, 8, 'graphite', 0, yc, ph)
    ]);
  });

  // Synthetic aperture radar (ICEYE-class). A long flat phased array on two struts: four hinged
  // segments of patch tiles on the +Z face, gold insulation on the back.
  register('sar-radar', 'Synthetic aperture radar', function () {
    var W = 1.7, H = 0.44, D = 0.05, y0 = 0.14, zf = D / 2, out, s, i, j;
    out = [
      boxAt(0.5, 0.04, 0.12, 'graphite', 0, 0, 0),
      boxAt(0.05, 0.1, 0.05, 'steel', -0.18, 0.04, 0),
      boxAt(0.05, 0.1, 0.05, 'steel', 0.18, 0.04, 0),
      boxAt(W, H, D, 'white', 0, y0, 0),
      rectZ(-W / 2, y0, W / 2, y0 + H, zf, 'graphite'),
      rectZ(-W / 2 + 0.02, y0 + 0.02, W / 2 - 0.02, y0 + H - 0.02, -zf, 'gold', true)
    ];
    var segW = W / 4, m = 0.025, g = 0.018, cols = 3, rows = 2;
    var tw = (segW - 2 * m - (cols - 1) * g) / cols, th = (H - 2 * m - (rows - 1) * g) / rows;
    for (s = 0; s < 4; s++) {
      var sx = -W / 2 + s * segW;
      for (i = 0; i < cols; i++) {
        for (j = 0; j < rows; j++) {
          var x0 = sx + m + i * (tw + g), yy = y0 + m + j * (th + g);
          out.push(rectZ(x0, yy, x0 + tw, yy + th, zf, 'silver'));
        }
      }
      if (s > 0) out.push(rectZ(sx - 0.006, y0, sx + 0.006, y0 + H, -zf, 'steel', true));   // hinge lines
    }
    return L.merge(out);
  });
})();
