/*
 * lp-pad.js - the seven launchers and the launch pad scene for the LowPoly engine.
 * Plain ES5, loaded after lowpoly.js. Creates no globals: it only adds to
 * LowPoly.models.launcher and LowPoly.scenes.
 *
 * LAUNCHERS  LowPoly.models.launcher[id](launcherData?) -> {mesh, size, label, ...extras}
 *   ids: juno-1, vanguard-rocket, thor-able, thor-agena, rideshare, small, heavy.
 *   Frame: like LowPoly.fallback('launcher'), the mesh is CENTRED on the origin (bounding box
 *   centre at 0,0,0), the rocket axis is the Y axis, nose up. To stand one on the ground at
 *   height g use pos y = g + size[1] / 2 (or LowPoly.base(mesh)).
 *   Scale: 1 unit = 10 m, so heights are in true proportion (Juno I 21.2 m = 2.12 units,
 *   medium-lift 70 m = 7 units). launcherData (a LAUNCHERS row) is optional: only its name is used.
 *   Extras: era ("early" | "modern"), height_m, diameter_m, radius (core radius, units),
 *   profile ([[y, r], ...] body radius by height, model units, bottom to top),
 *   nozzles ([{pos:[x,y,z], r}] engine exits, model units).
 *
 * SCENE  LowPoly.scenes.pad({launcherId, launcher, ready, t, play}) -> wrapper
 *   launcherId  any id; an unknown one uses LowPoly.fallback('launcher').
 *   launcher    optional LAUNCHERS row (for the name in the label).
 *   ready       true: all systems go (status lamps green, yellow tower arms folded back into
 *               the tower); false (default): not ready (arms reach the rocket, lamps red).
 *               The lamps are palette green / red drawn emissive (--lp-green, --lp-red).
 *   t           launch clock in seconds. Missing or null: waiting on the pad. A number poses the
 *               launch sequence at that moment: 0 on the pad, ~0.4 ignition glow, 0.4-3 thrust
 *               builds and smoke billows, 3 lift-off, then the rocket climbs and the camera pulls
 *               back; it ends at wrapper.duration (12 s) and holds the last frame.
 *   play        when t is a number: true (default) lets update() advance the clock by dt;
 *               false holds the pose at t (a still).
 *   wrapper = {scene, update(t, dt), label, duration, launch(), setTime(t), setReady(ready),
 *              time(), ready(), launcher}
 *     update(t, dt)  for LowPoly.view (it registers it automatically). Advances the launch clock
 *                    by dt (the view's t is ignored); returns false when nothing changed. It also
 *                    keeps the camera above the ground (raises pitch if a drag would put the eye
 *                    underground) and moves the sun's glint on the sea to stay under the sun.
 *     launch()       start the sequence from t = 0 (played by update).
 *     setTime(t)     pose at launch time t (null = back on the pad, waiting) and stop playing.
 *     setReady(b)    switch between ready and not ready (lamp colour, arms, label).
 *   Under prefers-reduced-motion the sequence does not animate: launch() shows one still frame
 *   of the climb (t = 7 s) and holds it.
 *   Only camera.dist and camera.target are written while launching; yaw and pitch stay the
 *   viewer's. Default camera: yaw 30, pitch -2, fov 35, framed for a 4:3 canvas (wider is fine).
 *   The scene: a coastal pad at dusk, sea and a low sun ahead, scrub and hills inland, a lattice
 *   tower (red 1950s gantry with a hammerhead crane, or a grey modern tower), a dome blockhouse
 *   (1950s) or a bermed control building (modern), stars. About 1230 to 1320 triangles waiting on
 *   the pad, 2070 at most during the launch (smoke clouds and plume visible).
 */
(function (root) {
  'use strict';
  var L = root && root.LowPoly;
  if (!L || !L.models || !L.scenes) return;

  var DEG = Math.PI / 180, EPS = 1e-9;
  var S = 0.1;              // model units per metre (1 unit = 10 m)

  // ------------------------------------------------------------------ small mesh helpers
  function P(r, y, a) { return [r * Math.cos(a), y, -r * Math.sin(a)]; }
  function tri(a, b, c, col) { return { v: [a.slice(), b.slice(), c.slice()], c: col, e: 0 }; }
  function colAt(col, i) { return (typeof col === 'string') ? col : col[i % col.length]; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function round1(v) { return Math.round(v * 10) / 10; }

  // Body of revolution from rings [radius, y, colourOfTheBandAbove] listed bottom to top.
  // A band colour may be an array: one colour per facet, cycled (roll patterns, soot streaks).
  // o: {phase (deg), capBottom: colour | false, capTop: colour | false}
  function revolve(rings, sides, o) {
    o = o || {};
    var t = [], ph = (o.phase || 0) * DEG, i, k, n = rings.length, a0, a1;
    for (k = 0; k < n - 1; k++) {
      var A = rings[k], B = rings[k + 1], r0 = A[0], y0 = A[1], r1 = B[0], y1 = B[1];
      if (r0 < EPS && r1 < EPS) continue;
      for (i = 0; i < sides; i++) {
        a0 = ph + 2 * Math.PI * i / sides; a1 = ph + 2 * Math.PI * (i + 1) / sides;
        var c = colAt(A[2], i);
        var b0 = P(r0, y0, a0), b1 = P(r0, y0, a1), t0 = P(r1, y1, a0), t1 = P(r1, y1, a1);
        if (r0 < EPS) t.push(tri(b0, t1, t0, c));
        else if (r1 < EPS) t.push(tri(b0, b1, t0, c));
        else { t.push(tri(b0, b1, t1, c)); t.push(tri(b0, t1, t0, c)); }
      }
    }
    var f = rings[0], l = rings[n - 1];
    for (i = 0; i < sides; i++) {
      a0 = ph + 2 * Math.PI * i / sides; a1 = ph + 2 * Math.PI * (i + 1) / sides;
      if (o.capBottom !== false && f[0] > EPS) t.push(tri([0, f[1], 0], P(f[0], f[1], a1), P(f[0], f[1], a0), o.capBottom || colAt(f[2], i)));
      if (o.capTop !== false && l[0] > EPS) t.push(tri([0, l[1], 0], P(l[0], l[1], a0), P(l[0], l[1], a1), o.capTop || 'steel'));
    }
    return { tris: t };
  }

  // A fin (or folded leg, strake) in the radial plane: profile [[radius, y], ...], thickness
  // across, turned to angle ang (deg) about the rocket axis.
  function fin(profile, thick, col, ang) {
    var m = L.prism(profile, thick, col);       // polygon in XZ, extruded along Y
    m = L.rotate(m, -90, 0, 0);                 // its z becomes height y, thickness lies along z
    return L.rotate(m, 0, ang, 0);
  }
  function at(m, x, y, z) { return L.move(m, x, y, z); }
  function boxAt(w, h, d, c, x, y, z) { return L.move(L.box(w, h, d, c), x, y, z); }
  // Engine bell: exit radius re at y0, throat rt at y0 + h, black inside (glows at ignition).
  function bell(re, rt, h, sides, x, y0, z, col) {
    return at(revolve([[re, 0, col || 'metalDark'], [rt, h]], sides, { capBottom: 'black', capTop: false }), x, y0, z);
  }

  // per-facet colour cycles for 12-sided bodies
  var CHK_A = ['black', 'black', 'black', 'white', 'white', 'white'];
  var CHK_B = ['white', 'white', 'white', 'black', 'black', 'black'];

  var NAMES = {
    'juno-1': 'Juno I', 'vanguard-rocket': 'Vanguard', 'thor-able': 'Thor-Able', 'thor-agena': 'Thor-Agena',
    rideshare: 'Rideshare slot', small: 'Small dedicated launcher', heavy: 'Medium-lift rocket'
  };

  // Scale metres to units, centre on the origin, add the extras.
  function finish(id, data, parts, spec) {
    var m = L.merge(parts), b = L.bounds(m);
    var hM = b.max[1] - b.min[1], off = -(b.min[1] + hM / 2);
    m = L.move(L.scale(m, S), 0, off * S, 0);
    var name = (data && typeof data.name === 'string' && data.name) || NAMES[id] || 'Rocket';
    var prof = [], i;
    for (i = 0; i < spec.rings.length; i++) prof.push([(spec.rings[i][1] + off) * S, spec.rings[i][0] * S]);
    var noz = [];
    for (i = 0; i < spec.nozzles.length; i++) {
      var q = spec.nozzles[i];
      noz.push({ pos: [q[0] * S, (q[1] + off) * S, q[2] * S], r: q[3] * S });
    }
    return {
      mesh: m, size: L.bounds(m).size,
      label: name + ', ' + spec.desc,
      era: spec.era, height_m: round1(hM), diameter_m: spec.dia, radius: spec.core * S,
      profile: prof, nozzles: noz
    };
  }

  // ------------------------------------------------------------------ 1958-1964 rockets
  // Juno I (1958): 21.2 m, 1.78 m. Elongated Redstone with four tail fins and the black and white
  // roll pattern, the spinning "tub" of small solid rockets, Explorer 1 on top as a slim pencil.
  function junoI(data) {
    var rings = [
      [0.89, 0.45, CHK_A], [0.89, 2.9, 'white'], [0.89, 12.2, 'black'], [0.89, 12.9, CHK_B],
      [0.89, 14.6, 'white'], [0.62, 16.4, 'black'], [0.5, 16.4, 'black'], [0.5, 16.7, 'steel'], [0.5, 18.4]
    ];
    // Explorer 1 and its last stage: a thin pencil with a dark band, fewer facets
    var top = [[0.1, 18.4, 'silver'], [0.1, 19.5, 'graphite'], [0.1, 19.85, 'silver'], [0.1, 20.6, 'silver'], [0, 21.2]];
    var parts = [revolve(rings, 12, { capBottom: 'graphite', capTop: 'graphite' }), revolve(top, 6, { capBottom: false }),
      bell(0.42, 0.3, 0.6, 8, 0, 0, 0)];
    var k, f = [[0.8, 0.45], [1.9, 0.45], [1.9, 1.25], [0.8, 3.2]];
    for (k = 0; k < 4; k++) parts.push(fin(f, 0.16, 'white', 45 + 90 * k));
    return finish('juno-1', data, parts, {
      desc: 'a slim 21 m rocket from 1958: a Redstone missile with fins, a checkered roll pattern and a cluster of small solid rockets on top',
      era: 'early', dia: 1.78, core: 0.89, rings: rings.concat(top), nozzles: [[0, 0, 0, 0.42]]
    });
  }

  // Vanguard (1957-59): 21.9 m, 1.14 m, no fins (gimballed engines), three slim stages.
  function vanguard(data) {
    var rings = [
      [0.5, 0.4, 'steel'], [0.57, 1.3, 'white'], [0.57, 10.2, CHK_A], [0.57, 11.4, CHK_B], [0.57, 12.6, 'white'],
      [0.57, 13.4, 'steel'], [0.4, 14.2, 'silver'], [0.4, 18.8, 'graphite'], [0.4, 19.5, 'white'],
      [0.37, 20.3, 'white'], [0.25, 21.1, 'white'], [0.09, 21.7, 'white'], [0, 21.9]
    ];
    var parts = [revolve(rings, 12, { capBottom: 'graphite' }), bell(0.34, 0.22, 0.55, 10, 0, 0, 0)];
    // two small roll-control nozzles at the base
    parts.push(boxAt(0.16, 0.5, 0.16, 'metalDark', 0.6, 0.85, 0), boxAt(0.16, 0.5, 0.16, 'metalDark', -0.6, 0.85, 0));
    return finish('vanguard-rocket', data, parts, {
      desc: 'a pencil-thin 22 m Navy rocket from 1958 with no fins and three stages',
      era: 'early', dia: 1.14, core: 0.57, rings: rings, nozzles: [[0, 0, 0, 0.34]]
    });
  }

  // Thor first stage (DM-18/21): 2.44 m, cylinder then a long taper; main engine plus two verniers.
  function thorRings(top) {
    var r = [[1.02, 0.95, 'steel'], [1.22, 2.0, 'silver'], [1.22, 9.7, 'graphite'],
      [1.22, 10.5, 'silver'], [0.82, 18.6, 'steel']];
    return r.concat(top);
  }
  function thorParts(rings) {
    var parts = [revolve(rings, 10, { capBottom: 'graphite' }), bell(0.62, 0.36, 1.1, 8, 0, 0, 0)];
    var s;
    // two vernier engines on the sides of the engine section
    for (s = -1; s <= 1; s += 2) parts.push(bell(0.2, 0.12, 0.6, 6, s * 1.28, 0.8, 0));
    return parts;
  }
  // Thor-Able (1958-60): 27.4 m. Skinny Able stage and a bulbous shroud (TIROS needed 1.07 m).
  function thorAble(data) {
    var rings = thorRings([[0.46, 19.6, 'white'], [0.46, 23.6, 'graphite'], [0.46, 24.2, 'white'],
      [0.64, 24.7, 'white'], [0.64, 25.9, 'white'], [0.44, 26.8, 'white'], [0.15, 27.3, 'white'], [0, 27.4]]);
    return finish('thor-able', data, thorParts(rings), {
      desc: 'a stubby 27 m rocket from 1959: a tapered Thor missile with a thin Able upper stage and a round nose',
      era: 'early', dia: 2.44, core: 1.22, rings: rings, nozzles: [[0, 0, 0, 0.62], [1.28, 0.8, 0, 0.2], [-1.28, 0.8, 0, 0.2]]
    });
  }
  // Thor-Agena B (1960s): 31 m (the 1959 Agena A was 28 m). A fat Agena stage, a blunt shroud.
  function thorAgena(data) {
    var rings = thorRings([[0.76, 19.4, 'graphite'], [0.76, 20.4, 'white'], [0.76, 26.2, 'graphite'],
      [0.76, 27.3, 'white'], [0.76, 28.2, 'white'], [0.56, 29.6, 'white'], [0.22, 30.75, 'white'], [0, 31.0]]);
    var parts = thorParts(rings);
    // Agena's engine stub and two gas bottles at the adapter
    parts.push(boxAt(0.34, 0.6, 0.34, 'metalDark', 0.86, 19.8, 0), boxAt(0.34, 0.6, 0.34, 'metalDark', -0.86, 19.8, 0));
    return finish('thor-agena', data, parts, {
      desc: 'a stubby 31 m rocket from the 1960s: a tapered Thor with the long, fat Agena stage on top',
      era: 'early', dia: 2.44, core: 1.22, rings: rings, nozzles: [[0, 0, 0, 0.62], [1.28, 0.8, 0, 0.2], [-1.28, 0.8, 0, 0.2]]
    });
  }

  // ------------------------------------------------------------------ modern rockets
  // Small dedicated launcher (Electron class): 18 m, 1.2 m, dark carbon body, nine small engines.
  function small(data) {
    var rings = [
      [0.56, 0.4, 'graphite'], [0.6, 0.85, 'graphite'], [0.6, 11.5, 'steel'], [0.6, 12.0, 'graphite'],
      [0.6, 13.0, 'steel'], [0.6, 13.3, 'graphite'], [0.6, 15.0, 'white'], [0.6, 16.2, 'white'],
      [0.52, 16.9, 'white'], [0.33, 17.55, 'white'], [0.1, 17.93, 'white'], [0, 18.0]
    ];
    var parts = [revolve(rings, 10, { capBottom: 'black' }), bell(0.13, 0.08, 0.42, 6, 0, 0, 0)];
    var noz = [[0, 0, 0, 0.13]], k;
    for (k = 0; k < 4; k++) {
      var a = (45 + 90 * k) * DEG, x = 0.34 * Math.cos(a), z = -0.34 * Math.sin(a);
      parts.push(bell(0.13, 0.08, 0.42, 6, x, 0, z));
      noz.push([x, 0, z, 0.13]);
    }
    return finish('small', data, parts, {
      desc: 'a small modern 18 m rocket with a dark carbon body and a white nose fairing',
      era: 'modern', dia: 1.2, core: 0.6, rings: rings, nozzles: noz
    });
  }

  // Medium-lift (Falcon 9 class): 70 m, 3.7 m core, 5.2 m fairing, folded legs and grid fins.
  // The rideshare slot rides the same class of rocket (data/launchers.js cites the same vehicle),
  // so it shares the outline; it is drawn as a reflown, soot-streaked booster with a banded fairing.
  var SOOT = ['white', 'steel', 'white', 'metalDark', 'steel', 'white', 'steel', 'white', 'metalDark', 'steel'];
  function mediumLift(id, data, reflown) {
    var s1 = reflown
      ? [[1.83, 1.4, 'white'], [1.83, 22.0, SOOT], [1.83, 41.2, 'steel']]
      : [[1.83, 1.4, 'white'], [1.83, 41.2, 'graphite']];
    var rings = [[1.7, 0.75, 'graphite']].concat(s1, [[1.83, 47.0, 'white'], [1.83, 57.0, reflown ? 'graphite' : 'white'],
      [2.6, 58.3, 'white'], [2.6, 63.6, 'white'], [2.38, 65.9, 'white'], [1.86, 67.9, 'white'], [1.05, 69.3, 'white'], [0, 70.0]]);
    var parts = [revolve(rings, 10, { capBottom: 'black' }), bell(0.5, 0.3, 0.8, 6, 0, 0, 0)];
    var noz = [[0, 0, 0, 0.5]], k;
    for (k = 0; k < 4; k++) {
      var ang = 45 + 90 * k, a = ang * DEG, x = 1.15 * Math.cos(a), z = -1.15 * Math.sin(a);
      parts.push(bell(0.5, 0.3, 0.8, 6, x, 0, z));
      noz.push([x, 0, z, 0.5]);
      // folded landing leg: a dark strake along the base
      parts.push(fin([[1.7, 0.4], [2.25, 0.4], [1.75, 10.6]], 0.75, 'graphite', ang));
      // grid fin, stowed against the interstage
      parts.push(L.rotate(boxAt(0.45, 1.5, 1.4, 'metalDark', 2.05, 45.6, 0), 0, ang + 45, 0));
    }
    return finish(id, data, parts, {
      desc: reflown
        ? 'a seat on a 70 m medium-lift rocket shared with other satellites; the booster is reflown and soot-streaked'
        : 'a 70 m two-stage modern rocket with a wide nose fairing, folded landing legs and grid fins',
      era: 'modern', dia: 3.7, core: 1.83, rings: rings, nozzles: noz
    });
  }

  var LM = L.models.launcher;
  LM['juno-1'] = junoI;
  LM['vanguard-rocket'] = vanguard;
  LM['thor-able'] = thorAble;
  LM['thor-agena'] = thorAgena;
  LM.small = small;
  LM.heavy = function (data) { return mediumLift('heavy', data, false); };
  LM.rideshare = function (data) { return mediumLift('rideshare', data, true); };

  // ------------------------------------------------------------------ pad scene pieces
  // A strip (girder) between points a and b, lying in the plane with normal n, both sides.
  function strip(a, b, n, w, c) {
    var d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    var s = [n[1] * d[2] - n[2] * d[1], n[2] * d[0] - n[0] * d[2], n[0] * d[1] - n[1] * d[0]];
    var l = Math.sqrt(s[0] * s[0] + s[1] * s[1] + s[2] * s[2]) || 1, h = w / 2 / l;
    s = [s[0] * h, s[1] * h, s[2] * h];
    return L.quad([a[0] - s[0], a[1] - s[1], a[2] - s[2]], [b[0] - s[0], b[1] - s[1], b[2] - s[2]],
      [b[0] + s[0], b[1] + s[1], b[2] + s[2]], [a[0] + s[0], a[1] + s[1], a[2] + s[2]], c, true);
  }

  // Square lattice tower standing on y = 0, centred on x = z = 0.
  function lattice(w, h, levels, legR, bw, colLeg, colBrace) {
    var parts = [], i, f, hw = w / 2;
    var corners = [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]];
    for (i = 0; i < 4; i++) parts.push(at(L.cylinder(legR, legR * 1.25, h, 4, colLeg, { capTop: false, capBottom: false, phase: 45 }), corners[i][0], h / 2, corners[i][1]));
    // faces: +Z, +X, -Z, -X (each from corner f to corner f+1 walking round)
    var faces = [[3, 2, [0, 0, 1]], [2, 1, [1, 0, 0]], [1, 0, [0, 0, -1]], [0, 3, [-1, 0, 0]]];
    var bay = h / levels;
    for (f = 0; f < 4; f++) {
      var A = corners[faces[f][0]], B = corners[faces[f][1]], n = faces[f][2];
      for (i = 1; i <= levels; i++) {
        var y0 = (i - 1) * bay, y1 = i * bay;
        parts.push(strip([A[0], y1, A[1]], [B[0], y1, B[1]], n, bw, colBrace));
        if (i % 2) parts.push(strip([A[0], y0, A[1]], [B[0], y1, B[1]], n, bw * 0.8, colBrace));
        else parts.push(strip([B[0], y0, B[1]], [A[0], y1, A[1]], n, bw * 0.8, colBrace));
      }
    }
    return L.merge(parts);
  }

  // Ragged flat patch on the ground (grass, scorch): a fan facing +Y.
  function blob(cx, cz, r, n, seed, c, y) {
    var rnd = L.rng(seed), pts = [], t = [], i;
    for (i = 0; i < n; i++) pts.push(P(r * (0.65 + 0.5 * rnd()), y || 0, 2 * Math.PI * i / n));
    for (i = 0; i < n; i++) {
      var p0 = pts[i], p1 = pts[(i + 1) % n];
      t.push(tri([cx, y || 0, cz], [p0[0] + cx, p0[1], p0[2] + cz], [p1[0] + cx, p1[1], p1[2] + cz], c));
    }
    return { tris: t };
  }

  // A band on a circle of radius R between angles aFrom and aTo (deg, ringPt convention), facing
  // the centre (seen from inside). Heights per vertex from hMin to hMax: jagged hills, or flat
  // (hMin == hMax) for a sky glow band. The ends taper to the ground.
  function ridge(R, aFrom, aTo, hMin, hMax, n, seed, c, y0) {
    var rnd = L.rng(seed), hs = [], t = [], i, by = (y0 === undefined) ? -R * 0.01 : y0;
    for (i = 0; i <= n; i++) hs.push(hMin + (hMax - hMin) * Math.pow(rnd(), 1.6));
    if (hMin !== hMax) { hs[0] = by; hs[n] = by; }
    for (i = 0; i < n; i++) {
      var a0 = (aFrom + (aTo - aFrom) * i / n) * DEG, a1 = (aFrom + (aTo - aFrom) * (i + 1) / n) * DEG;
      var b0 = P(R, by, a0), b1 = P(R, by, a1), t0 = P(R, hs[i], a0), t1 = P(R, hs[i + 1], a1);
      // facing inward: the reverse of the outward winding
      if (hs[i] > by + EPS) t.push(tri(b0, t0, t1, c));
      if (hs[i + 1] > by + EPS) t.push(tri(b0, t1, b1, c));
    }
    return { tris: t };
  }

  // Flat convex polygon at height y facing +Y, from [[x, z], ...] in either order.
  function flat(pts, c, y) {
    var area = 0, i, n = pts.length, t = [];
    for (i = 0; i < n; i++) area += pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1];
    // seen from +Y with x right and z toward the viewer, counter-clockwise has negative area in x,z
    if (area > 0) pts = pts.slice().reverse();
    for (i = 1; i < n - 1; i++) t.push(tri([pts[0][0], y, pts[0][1]], [pts[i][0], y, pts[i][1]], [pts[i + 1][0], y, pts[i + 1][1]], c));
    return { tris: t };
  }

  // Low concrete dome blockhouse (1950s) or a bermed control building (modern), on y = 0, door to +Z.
  function blockhouse(early, s) {
    var parts = [];
    if (early) {
      parts.push(L.lathe([[s, 0], [s * 0.93, s * 0.36], [s * 0.64, s * 0.7], [0, s * 0.84]], 10, 'concrete'));
      parts.push(boxAt(s * 0.5, s * 0.42, s * 0.5, 'concrete', 0, s * 0.21, s * 0.9));
      parts.push(boxAt(s * 0.26, s * 0.3, s * 0.02, 'black', 0, s * 0.15, s * 1.155));
      parts.push(boxAt(s * 0.05, s * 0.5, s * 0.05, 'steel', s * 0.25, s * 1.0, -s * 0.1));
      parts.push(boxAt(s * 0.04, s * 0.04, s * 0.5, 'steel', s * 0.25, s * 1.22, -s * 0.1));
    } else {
      parts.push(L.prism([[-s, -s * 0.55], [s, -s * 0.55], [s * 1.25, s * 0.55], [-s * 1.25, s * 0.55]], s * 0.1, 'ground'));
      parts[0] = L.move(parts[0], 0, s * 0.05, 0);
      parts.push(boxAt(s * 1.6, s * 0.42, s * 0.8, 'concrete', 0, s * 0.31, 0));
      parts.push(boxAt(s * 1.3, s * 0.08, s * 0.02, 'graphite', 0, s * 0.38, s * 0.41));
      parts.push(boxAt(s * 0.22, s * 0.26, s * 0.02, 'black', s * 0.55, s * 0.23, s * 0.41));
      parts.push(boxAt(s * 0.05, s * 0.8, s * 0.05, 'steel', -s * 0.6, s * 0.9, -s * 0.2));
    }
    return L.merge(parts);
  }

  // Exhaust plume, authored with its top at y = 0 pointing down to y = -1, radius 1.
  var PLUME_OUT = L.jitter(L.lathe([[0, -1], [0.62, -0.62], [0.98, -0.25], [0.88, -0.05], [0.7, 0]], 9, 'glow'), 0.05, 5);
  var PLUME_CORE = L.lathe([[0, -0.62], [0.42, -0.34], [0.55, -0.08], [0.45, 0]], 7, 'cloud');
  PLUME_OUT = L.emit(PLUME_OUT); PLUME_CORE = L.emit(PLUME_CORE);
  var CLOUDS = [];
  var CLOUDS_LIT = [];   // the same clouds with a warm, fire-lit lower band
  (function () {
    var i, j;
    for (i = 0; i < 8; i++) {
      var m = L.jitter(L.sphere(1, 1, i % 3 ? 'cloud' : 'white'), 0.2, 31 + i), lit = L.merge([m]);
      for (j = 0; j < lit.tris.length; j++) {
        var v = lit.tris[j].v, cy = (v[0][1] + v[1][1] + v[2][1]) / 3;
        if (cy < -0.05) { lit.tris[j].c = cy < -0.4 ? 'orange' : 'glow'; lit.tris[j].e = 1; }
      }
      CLOUDS.push(m); CLOUDS_LIT.push(lit);
    }
  })();
  var GLOW_DISC = L.emit(L.disc(1, 10, 'glow'));

  // RETRACT: arms swing back about their hinge (through the -Z side) until they fold into the tower
  var DURATION = 12, LIFT_T = 3, STILL_T = 7, RETRACT = 172, BH_ROT = -20;
  var LAMP = { ready: 'green', hold: 'red' };
  // names that read as a rocket in a sentence ("The rideshare rocket lifting off ...")
  var SCENE_NAMES = { rideshare: 'rideshare rocket', small: 'small dedicated launcher', heavy: 'medium-lift rocket' };

  function padScene(opts) {
    opts = opts || {};
    var id = opts.launcherId;
    var model = L.model('launcher', id, opts.launcher);
    var mesh = model.mesh, bb = L.bounds(mesh);
    var H = bb.size[1] > 1e-6 ? bb.size[1] : 4;
    var baseOff = -bb.min[1];
    var Rmax = Math.max(Math.abs(bb.min[0]), bb.max[0], Math.abs(bb.min[2]), bb.max[2], 1e-3);
    var core = model.radius > 0 ? model.radius : Rmax * 0.75;
    var early = model.era === 'early';
    var prof = model.profile && model.profile.length > 1 ? model.profile : null;
    var name = SCENE_NAMES[id] || (opts.launcher && opts.launcher.name) || NAMES[id] || 'rocket';
    var ready = !!opts.ready;

    function radiusAt(yl) {
      if (!prof) return core;
      var i, best = 0;
      for (i = 0; i < prof.length - 1; i++) {
        var a = prof[i], b = prof[i + 1];
        if (yl >= a[0] && yl <= b[0]) {
          var u = b[0] - a[0] > 1e-9 ? (yl - a[0]) / (b[0] - a[0]) : 1;
          best = Math.max(best, a[1] + (b[1] - a[1]) * u);
        }
      }
      return best > 0 ? best : core;
    }

    // ---- layout (units; H = rocket height)
    var hm = H * (early ? 0.045 : 0.05);                    // launch table height
    var tw = H * (early ? 0.24 : 0.12), th = H * (early ? 1.1 : 1.05);
    var gap = Math.max(Rmax, core * 1.6) + H * (early ? 0.11 : 0.09);   // tower face to rocket axis
    var tx = -(gap + tw / 2);
    var bs = H * (early ? 0.15 : 0.12);                    // blockhouse size
    var bx = H * 0.64, bz = H * 0.1;
    var nozzles = model.nozzles && model.nozzles.length ? model.nozzles : [{ pos: [0, bb.min[1], 0], r: Rmax * 0.6 }];
    var plumeR = 0, nozY = Infinity, i;
    for (i = 0; i < nozzles.length; i++) {
      var np = nozzles[i].pos;
      plumeR = Math.max(plumeR, Math.sqrt(np[0] * np[0] + np[2] * np[2]) + nozzles[i].r);
      nozY = Math.min(nozY, np[1]);
    }
    plumeR = Math.max(plumeR, core * 0.6);

    // ---- static ground, sea, pad, blockhouse, hills, sun
    // The default camera looks along F (ring angle 120 deg) with R to its right (30 deg): the
    // coast and a low sun lie ahead, scrubland and hills behind and to the sides.
    var F = [-0.5, -0.866], RT = [0.866, -0.5];
    function fr(a, b) { return [F[0] * a + RT[0] * b, F[1] * a + RT[1] * b]; }
    var env = [];
    env.push(L.disc(H * 40, 24, 'land'));
    env.push(blob(-H * 0.9, H * 0.9, H * 0.5, 9, 3, 'grass'), blob(H * 1.5, H * 0.8, H * 0.6, 9, 4, 'grass'),
      blob(-H * 1.6, -H * 1.0, H * 0.7, 9, 5, 'grass'), blob(H * 0.5, -H * 1.4, H * 0.5, 9, 6, 'sand'),
      blob(H * 2.2, -H * 0.4, H * 0.7, 9, 7, 'grass'), blob(-H * 0.3, H * 2.0, H * 0.7, 9, 8, 'grass'),
      blob(-H * 1.4, H * 0.1, H * 0.35, 8, 9, 'sand'), blob(H * 0.9, H * 1.6, H * 0.5, 8, 10, 'sand'));
    // beach and sea toward the low sun
    env.push(flat([fr(2.75 * H, -40 * H), fr(2.75 * H, 40 * H), fr(3.4 * H, 40 * H), fr(3.4 * H, -40 * H)], 'sand', 0));
    env.push(flat([fr(3.25 * H, -70 * H), fr(3.25 * H, 70 * H), fr(70 * H, 70 * H), fr(70 * H, -70 * H)], 'sea', 0));
    var sunA = 104 * DEG, sunV = [Math.cos(sunA), -Math.sin(sunA)], sunD = H * 80;
    // road from the pad to the blockhouse
    env.push(L.quad([H * 0.2, 0, H * 0.06], [bx, 0, bz + H * 0.06], [bx, 0, bz - H * 0.06], [H * 0.2, 0, -H * 0.06], 'graphite'));
    // apron and flame trench
    env.push(L.rotate(L.disc(H * (early ? 0.42 : 0.36), 8, 'concrete'), 0, 22.5, 0));
    env.push(L.quad([-H * 0.07, 0, H * 0.04], [H * 0.07, 0, H * 0.04], [H * 0.07, 0, -H * 0.4], [-H * 0.07, 0, -H * 0.4], 'black'));
    // launch table: raised pad, a square ring on four legs, a flame deflector under it
    var ri = Math.max(plumeR * 1.05, core * 0.7), ro = Math.max(core * 1.55, ri + H * 0.02), tk = H * 0.012;
    var ringW = ro - ri, rc = (ro + ri) / 2;
    env.push(boxAt(ro * 2.6, H * 0.012, ro * 2.6, 'concrete', 0, H * 0.006, 0));
    env.push(boxAt(ro * 2, tk, ringW, 'steel', 0, hm - tk / 2, rc), boxAt(ro * 2, tk, ringW, 'steel', 0, hm - tk / 2, -rc),
      boxAt(ringW, tk, ri * 2, 'steel', rc, hm - tk / 2, 0), boxAt(ringW, tk, ri * 2, 'steel', -rc, hm - tk / 2, 0));
    var lg = Math.max(H * 0.014, ringW * 0.5), k;
    for (k = 0; k < 4; k++) {
      var sx = k % 2 ? 1 : -1, sz = k < 2 ? 1 : -1;
      env.push(boxAt(lg, hm, lg, 'metalDark', sx * (ro - lg / 2), hm / 2, sz * (ro - lg / 2)));
    }
    env.push(L.move(L.rotate(L.prism([[-ri * 0.9, 0], [ri * 0.9, 0], [0, hm * 0.75]], ri * 1.6, 'graphite'), -90, 0, 0), 0, H * 0.012, 0));
    // blockhouse
    env.push(L.move(L.rotate(blockhouse(early, bs), 0, BH_ROT, 0), bx, 0, bz));
    // hills inland (away from the sea), and the low sun sitting on the sea horizon
    env.push(ridge(H * 13, 207, 393, H * 0.15, H * 0.9, 26, 11, 'graphite'));
    env.push(ridge(H * 17, 200, 400, H * 0.4, H * 1.7, 20, 12, 'metalDark'));
    var sunPos = [sunV[0] * sunD, H * 0.45, sunV[1] * sunD];
    env.push(L.move(L.emit(L.sphere(H * 2.0, 1, 'glow')), sunPos[0], sunPos[1], sunPos[2]));
    var envMesh = L.merge(env);

    // ---- tower
    var levels = Math.max(6, Math.min(12, Math.round(th / (tw * (early ? 1.1 : 1.3)))));
    var towerCol = early ? 'red' : 'steel', braceCol = early ? 'red' : 'metalDark';
    var tparts = [lattice(tw, th, levels, Math.max(tw * 0.045, H * 0.005), Math.max(tw * 0.05, H * 0.004), towerCol, braceCol)];
    tparts.push(boxAt(tw * 1.25, H * 0.02, tw * 1.25, 'concrete', 0, H * 0.01, 0));
    var armFr = early ? [0.88, 0.62, 0.34] : [0.8, 0.52, 0.22];
    for (k = 0; k < armFr.length; k++) tparts.push(boxAt(tw * 1.08, H * 0.01, tw * 1.08, 'steel', 0, hm + armFr[k] * H - H * 0.022, 0));
    var topY = th;
    if (early) {
      // hammerhead crane on top
      tparts.push(boxAt(tw * 1.1, H * 0.03, tw * 1.1, 'steel', 0, th + H * 0.015, 0));
      tparts.push(boxAt(tw * 2.1, H * 0.035, tw * 0.22, towerCol, tw * 0.45, th + H * 0.05, 0));
      tparts.push(boxAt(tw * 0.3, H * 0.05, tw * 0.3, 'steel', -tw * 0.35, th + H * 0.06, 0));
      topY = th + H * 0.085;
    } else {
      tparts.push(boxAt(tw * 1.1, H * 0.015, tw * 1.1, 'steel', 0, th + H * 0.0075, 0));
      tparts.push(at(L.cylinder(H * 0.003, H * 0.006, H * 0.12, 4, 'steel', { capBottom: false }), tw * 0.3, th + H * 0.06, tw * 0.3));
      topY = th + H * 0.015;
    }
    var towerMesh = L.move(L.merge(tparts), tx, 0, 0);

    // ---- status lamps: a beacon on the tower and a panel on the blockhouse
    function statusMesh(col) {
      var lr = H * 0.032, lx = tx + tw * 0.22, lz = tw * 0.22;
      var beacon = L.merge([
        boxAt(lr * 1.3, lr * 0.6, lr * 1.3, 'graphite', lx, topY + lr * 0.3, lz),
        L.emit(L.move(L.cylinder(lr, lr, lr * 1.6, 8, col), lx, topY + lr * 1.4, lz)),
        boxAt(lr * 2.3, lr * 0.3, lr * 2.3, 'graphite', lx, topY + lr * 2.35, lz)
      ]);
      var pw = bs * (early ? 0.36 : 0.5), panel;
      if (early) panel = boxAt(pw, bs * 0.08, bs * 0.03, col, 0, bs * 0.36, bs * 1.16);
      else panel = boxAt(pw, bs * 0.12, bs * 0.03, col, -bs * 0.35, bs * 0.25, bs * 0.41);
      panel = L.move(L.rotate(L.emit(panel), 0, BH_ROT, 0), bx, 0, bz);
      return L.merge([beacon, panel]);
    }
    var lampMeshes = { ready: statusMesh(LAMP.ready), hold: statusMesh(LAMP.hold) };

    // ---- swing arms (hinged on the tower face, extended = pointing +X at the rocket)
    var arms = [];
    for (k = 0; k < armFr.length; k++) {
      var ya = hm + armFr[k] * H;
      var len = Math.max(H * 0.02, gap - radiusAt(ya - hm - baseOff) - H * 0.004);
      var ah = H * 0.03, aw = H * (early ? 0.04 : 0.03);
      var am = L.merge([
        L.move(L.rotate(L.box(len, ah, ah, 'yellow'), 45, 0, 0), len / 2, 0, 0),   // diamond section: a lit face shows
        boxAt(H * 0.016, ah * 1.7, aw * 1.5, 'graphite', len - H * 0.008, 0, 0)
      ]);
      arms.push({ mesh: am, pos: [-gap, ya, 0], rot: [0, 0, 0] });
    }

    // ---- items
    var rocket = { mesh: mesh, pos: [0, hm + baseOff, 0] };
    var lamp = { mesh: ready ? lampMeshes.ready : lampMeshes.hold };
    var plumeOut = { mesh: PLUME_OUT, pos: [0, 0, 0], scale: [1, 1, 1], hidden: true, alpha: 0.78 };
    var plumeCore = { mesh: PLUME_CORE, pos: [0, 0, 0], scale: [1, 1, 1], hidden: true };
    var groundGlow = { mesh: GLOW_DISC, pos: [0, H * 0.0125, 0], scale: [1, 1, 1], hidden: true, alpha: 0.35 };
    var clouds = [];
    var CLOUD_DIR = [90, 180, 0, 115, 65, 155, 25, -150];
    for (k = 0; k < CLOUDS.length; k++) clouds.push({ mesh: CLOUDS[k], pos: [0, 0, 0], scale: 1, rot: [0, k * 41, 0], hidden: true });
    var glint = { mesh: { tris: [] }, hidden: true };
    var items = [{ mesh: envMesh }, glint, { mesh: towerMesh }, lamp].concat(arms, [rocket, plumeCore, plumeOut, groundGlow], clouds);

    var tg0 = [tx * 0.25, H * 0.54, 0], d0 = H * 2.5;
    var sun = [0.863, 0.388, 0.324];      // low warm key from the front right
    var scene = {
      items: items,
      camera: { yaw: 30, pitch: -2, dist: d0, target: tg0.slice(), fov: 35 },
      light: { dir: sun, key: '#d9ab7c', ambient: '#4f5c7a', hemi: 0.3, steps: 0 },
      background: { color: 'space', stars: true, seed: 19 },
      label: ''
    };

    var clock = (typeof opts.t === 'number' && opts.t === opts.t) ? Math.max(0, opts.t) : null;
    var playing = clock !== null && opts.play !== false;
    var stillShown = false;

    var mql = null;
    try { mql = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null; } catch (e) { mql = null; }
    function reduced() { return !!(mql && mql.matches); }

    function labelFor(T) {
      if (T !== null && T >= LIFT_T) return 'The ' + name + ' lifting off from the launch pad on a column of fire, climbing into the dusk sky.';
      if (T !== null && T > 0.3) return 'The ' + name + ' igniting on the launch pad, smoke billowing from the flame trench.';
      return ready
        ? 'The ' + name + ' on the launch pad at dusk. Tower arms swung back, status lights green: all systems go.'
        : 'The ' + name + ' on the launch pad at dusk. Tower arms still against the rocket, status lights red: not ready.';
    }

    function pose(T) {
      var launching = T !== null && T >= 0, t = launching ? T : 0, j;
      // arms: retracted when ready; during a launch they always swing clear in the first second
      var a = ready ? RETRACT : 0;
      if (launching) a = a + (RETRACT - a) * smooth(t / 1.2);
      for (j = 0; j < arms.length; j++) arms[j].rot = [0, a, 0];
      lamp.mesh = ready ? lampMeshes.ready : lampMeshes.hold;
      // thrust and climb
      var ign = launching ? smooth((t - 0.35) / 1.9) : 0;
      var u = launching ? Math.max(0, t - LIFT_T) : 0;
      var rise = 0.06 * H * u * u;
      rocket.pos = [0, hm + baseOff + rise, 0];
      var flick = 1 + 0.07 * Math.sin(t * 41.0) + 0.05 * Math.sin(t * 17.3 + 1.1);
      var len = H * (0.06 + 0.2 * ign + 0.34 * smooth(u / 4)) * flick;
      var wid = plumeR * (0.9 + 0.7 * ign + 0.9 * smooth(u / 5)) * (1 + 0.04 * Math.sin(t * 29.0));
      var py = hm + baseOff + nozY + rise;
      plumeOut.hidden = plumeCore.hidden = !(ign > 0.01);
      plumeOut.pos = [0, py, 0]; plumeOut.scale = [wid, len, wid];
      plumeCore.pos = [0, py, 0]; plumeCore.scale = [wid * 0.8, len * 0.85, wid * 0.8];
      // light spill on the pad while the rocket is low
      var spill = ign * (1 - smooth((rise - H * 0.4) / (H * 0.8)));
      groundGlow.hidden = !(spill > 0.02);
      groundGlow.alpha = 0.38 * spill;
      var gr = H * (0.22 + 0.25 * ign);
      groundGlow.scale = [gr, 1, gr];
      // smoke and steam from the flame trench, lit from below by the fire while the rocket is low
      var fire = ign > 0.25 && rise < H * 0.3;
      for (j = 0; j < clouds.length; j++) {
        var t0 = 0.55 + 0.22 * j, age = t - t0, c = clouds[j];
        if (!launching || age <= 0) { c.hidden = true; continue; }
        var ang = CLOUD_DIR[j] * DEG, grow = 1 - Math.exp(-age / 2.2);
        var dist = H * (0.12 + 0.55 * grow + 0.02 * j);
        var sc = H * (0.05 + 0.14 * grow + 0.012 * (j % 3));
        c.hidden = false;
        c.mesh = fire ? CLOUDS_LIT[j] : CLOUDS[j];
        c.pos = [Math.cos(ang) * dist, sc * 0.55 + H * 0.03 * grow * (j % 2), -Math.sin(ang) * dist];
        c.scale = [sc * 1.25, sc, sc * 1.25];
      }
      // camera follows the climb and pulls back
      var cam = scene.camera;
      cam.target = [tg0[0] * (1 - smooth(rise / H)), tg0[1] + rise * 0.82, 0];
      cam.dist = d0 + rise * 0.75;
      updateGlint();
      scene.label = labelFor(launching ? t : null);
      wrapper.label = scene.label;
    }

    // The sun's glint on the water lies on the line from the eye to the sun, so it is rebuilt
    // whenever the camera moves. Its width grows with distance: a narrow column on screen.
    var glintKey = '';
    function updateGlint() {
      var cam = scene.camera, tg = cam.target || tg0, d = cam.dist > 0 ? cam.dist : d0;
      var yw = (typeof cam.yaw === 'number' ? cam.yaw : 30) * DEG, pt = (typeof cam.pitch === 'number' ? cam.pitch : 0) * DEG;
      var key = [yw, pt, d, tg[0], tg[1], tg[2]].join(',');
      if (key === glintKey) return false;
      glintKey = key;
      var E = [tg[0] + Math.sin(yw) * Math.cos(pt) * d, tg[2] + Math.cos(yw) * Math.cos(pt) * d];
      var g = [sunV[0] * sunD - E[0], sunV[1] * sunD - E[1]], gl = Math.sqrt(g[0] * g[0] + g[1] * g[1]) || 1;
      var gu = [g[0] / gl, g[1] / gl], gp = [-gu[1], gu[0]];
      var gF = gu[0] * F[0] + gu[1] * F[1], eF = E[0] * F[0] + E[1] * F[1];
      var s1 = gF > 0.05 ? Math.max(H * 0.5, (3.7 * H - eF) / gF) : 0, s2 = gF > 0.05 ? (68 * H - eF) / gF : 0;
      if (!(s2 > s1 + H)) { glint.hidden = true; return true; }
      // Broken streaks of glitter, not one solid strip (a solid strip under the half-sunk sun read as a
      // mushroom on a stick): bands spaced evenly in perspective, widest under the sun, narrow near shore.
      function gpt(s, side, k) { var w = s * k * side; return [E[0] + gu[0] * s + gp[0] * w, E[1] + gu[1] * s + gp[1] * w]; }
      var bands = [], N = 13, j;
      for (j = 0; j < N; j += 2) {
        var a = s1 * Math.pow(s2 / s1, j / N), b = s1 * Math.pow(s2 / s1, (j + 0.55) / N);
        var k = 0.004 + 0.016 * Math.pow(j / (N - 1), 1.5);
        bands.push(flat([gpt(a, 1, k), gpt(b, 1, k), gpt(b, -1, k), gpt(a, -1, k)], 'copper', 0));
      }
      glint.mesh = L.emit(L.merge(bands));
      glint.hidden = false;
      return true;
    }

    // keep the eye above the ground whatever the drag does
    function keepAboveGround() {
      var cam = scene.camera, tg = cam.target || tg0, d = cam.dist > 0 ? cam.dist : d0;
      var s = (H * 0.03 - tg[1]) / d;
      if (s <= -1) return false;
      var minP = Math.asin(Math.min(1, s)) / DEG;
      if (typeof cam.pitch === 'number' && cam.pitch < minP) { cam.pitch = minP; return true; }
      return false;
    }

    function update(t, dt) {
      var moved = keepAboveGround();
      if (updateGlint()) moved = true;
      if (clock === null || !playing) return moved;
      if (reduced()) {
        if (!stillShown) { stillShown = true; clock = Math.max(clock, STILL_T); pose(clock); return true; }
        return moved;
      }
      if (clock >= DURATION) return moved;
      clock = Math.min(DURATION, clock + ((typeof dt === 'number' && dt > 0) ? dt : 0));
      pose(clock);
      return true;
    }

    var wrapper = {
      scene: scene,
      update: update,
      label: '',
      duration: DURATION,
      launcher: model,
      launch: function () { clock = 0; playing = true; stillShown = false; pose(0); return wrapper; },
      setTime: function (T) {
        clock = (typeof T === 'number' && T === T) ? Math.max(0, T) : null;
        playing = false; stillShown = false; pose(clock); return wrapper;
      },
      setReady: function (r) { ready = !!r; pose(clock); return wrapper; },
      time: function () { return clock; },
      ready: function () { return ready; }
    };
    pose(clock);
    return wrapper;
  }

  L.scenes.pad = padScene;
})(typeof window !== 'undefined' ? window : this);
