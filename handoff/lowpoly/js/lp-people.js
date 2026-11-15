/* lp-people.js: the story speakers as faceted low-poly busts, and LowPoly.portrait().
 * Plain ES5, loaded after lowpoly.js with a script tag. Creates no globals: it only fills
 * LowPoly.models.person, LowPoly.scenes.portrait and LowPoly.portrait.
 *
 * Registered people (LowPoly.models.person[who](opts) -> {mesh, label}):
 *   team      two NASA colleagues, 1958: white shirtsleeves and a red tie, and a teal coat
 *   partner   the engineering partner: hair in a bun, goggles pushed up, a red work shirt
 *   customer  the customer: a wide-brimmed field hat, a mustard vest, a radio on the shoulder
 *   notebook  Austin's notebook: no face, an open worn notebook with notes, a sketch and a pencil
 *   director  the mission director: white shirt, dark tie, a headset with a boom microphone
 *
 * Model frame (the same as a part): the mesh stands on y = 0, centred in x and z, grows
 * up +Y and looks along +Z, so LowPoly.place() can stand it on any port.
 * One bust is about 1 unit tall. Every face uses the same geometry; only the skin tone,
 * hair and clothes change.
 */
(function () {
  if (typeof LowPoly === 'undefined' || !LowPoly.models) return;
  var L = LowPoly;
  var RAD = Math.PI / 180;
  var LIFT = 0.006;          // decals sit this far off their surface (head units)
  var S = 0.5;               // head units to model units: a bust is about 2 head heights tall

  // ------------------------------------------------------------------ small vector helpers
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function unit(a) { var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function T(a, b, c, col, e) { return { v: [a.slice(), b.slice(), c.slice()], c: col, e: e ? 1 : 0 }; }
  function mesh(tris) { return { tris: tris || [] }; }
  function face(a, b, c, n, col, e) {      // a triangle wound so that it looks along n
    return dot(cross(sub(b, a), sub(c, a)), n) >= 0 ? T(a, b, c, col, e) : T(a, c, b, col, e);
  }

  // ------------------------------------------------------------------ loft: rings of points
  // A ring is {y, rx, zf, zb, zo, xo}: a closed loop at height y, half width rx, reaching zf
  // forward and zb back from its centre zo. Point k sits at angle phase + 360 k / n from +Z
  // toward +X. colour is a name or fn(band, column, half) (half 0 is the triangle on the
  // band's lower edge, 1 the one on its upper edge; band is 'top' or 'bottom' for caps).
  // top / bottom: an [x,y,z] apex (a fan), true (a flat cap) or falsy (open).
  function ringPts(r, n, phase) {
    var pts = [], k, t, s, c;
    for (k = 0; k < n; k++) {
      t = (phase + 360 * k / n) * RAD; s = Math.sin(t); c = Math.cos(t);
      if (Math.abs(s) < 1e-9) s = 0;
      if (Math.abs(c) < 1e-9) c = 0;
      pts.push([(r.xo || 0) + r.rx * s, r.y, (r.zo || 0) + (c >= 0 ? r.zf : r.zb) * c]);
    }
    return pts;
  }
  function loft(rings, n, phase, colour, top, bottom) {
    var col = typeof colour === 'function' ? colour : function () { return colour; };
    var P = [], tris = [], i, k;
    for (i = 0; i < rings.length; i++) P.push(ringPts(rings[i], n, phase));
    for (i = 0; i < rings.length - 1; i++) {
      for (k = 0; k < n; k++) {
        var a = P[i][k], b = P[i][(k + 1) % n], c = P[i + 1][(k + 1) % n], d = P[i + 1][k];
        tris.push(T(a, b, c, col(i, k, 0)), T(a, c, d, col(i, k, 1)));
      }
    }
    var lo = P[0], hi = P[P.length - 1];
    for (k = 0; k < n; k++) {
      if (bottom === true) { if (k > 0 && k < n - 1) tris.push(T(lo[0], lo[k + 1], lo[k], col('bottom', k, 0))); }
      else if (bottom) tris.push(T(bottom, lo[(k + 1) % n], lo[k], col('bottom', k, 0)));
      if (top === true) { if (k > 0 && k < n - 1) tris.push(T(hi[0], hi[k], hi[k + 1], col('top', k, 0))); }
      else if (top) tris.push(T(top, hi[k], hi[(k + 1) % n], col('top', k, 0)));
    }
    return mesh(tris);
  }

  // ------------------------------------------------------------------ sticking details onto a surface
  // Cast a ray and return the nearest front face it meets: {p, n}.
  function rayHit(m, o, d) {
    var best = null, i;
    for (i = 0; i < m.tris.length; i++) {
      var v = m.tris[i].v, e1 = sub(v[1], v[0]), e2 = sub(v[2], v[0]), n = cross(e1, e2);
      if (dot(n, d) >= 0) continue;
      var p = cross(d, e2), det = dot(e1, p);
      if (Math.abs(det) < 1e-12) continue;
      var inv = 1 / det, s = sub(o, v[0]), u = dot(s, p) * inv;
      if (u < -1e-7 || u > 1 + 1e-7) continue;
      var q = cross(s, e1), w = dot(d, q) * inv;
      if (w < -1e-7 || u + w > 1 + 1e-7) continue;
      var t = dot(e2, q) * inv;
      if (t > 0 && (!best || t < best.t)) best = { t: t, p: add(o, mul(d, t)), n: unit(n) };
    }
    return best;
  }
  // Points are given as they are seen from one side: 'front' [x,y], 'right' (+X) [z,y],
  // 'left' (-X) [z,y], 'top' [x,z]. Each is projected onto the surface and lifted off it.
  function stick(surf, view, pts, lift) {
    var out = [], i, o, d, h, q;
    for (i = 0; i < pts.length; i++) {
      q = pts[i];
      if (view === 'top') { o = [q[0], 20, q[1]]; d = [0, -1, 0]; }
      else if (view === 'right') { o = [20, q[1], q[0]]; d = [-1, 0, 0]; }
      else if (view === 'left') { o = [-20, q[1], q[0]]; d = [1, 0, 0]; }
      else { o = [q[0], q[1], 20]; d = [0, 0, -1]; }
      h = rayHit(surf, o, d);
      if (!h) return null;
      out.push({ p: add(h.p, mul(h.n, lift)), n: h.n });
    }
    return out;
  }
  // A flat coloured patch (eye, tie, pocket) on a surface: a convex polygon, any winding.
  function decal(surf, view, pts, col, lift, e) {
    var h = stick(surf, view, pts, lift === undefined ? LIFT : lift), tris = [], i, n = [0, 0, 0];
    if (!h) return mesh();
    for (i = 0; i < h.length; i++) n = add(n, h[i].n);
    for (i = 1; i < h.length - 1; i++) tris.push(face(h[0].p, h[i].p, h[i + 1].p, n, col, e));
    return mesh(tris);
  }
  // Mirror a list of 2D front-view points across x = 0.
  function flipX(pts) { var o = [], i; for (i = pts.length - 1; i >= 0; i--) o.push([-pts[i][0], pts[i][1]]); return o; }
  function pair(surf, pts, col, lift) { return L.merge([decal(surf, 'front', pts, col, lift), decal(surf, 'front', flipX(pts), col, lift)]); }
  // A small three-sided pyramid (nose, ear, collar point): its base is stuck on the
  // surface, its apex pushed out by height (plus shift). The base face is left out.
  function bump(surf, view, pts, height, col, shift) {
    var h = stick(surf, view, pts, -0.003), i, c = [0, 0, 0], n = [0, 0, 0];
    if (!h) return mesh();
    for (i = 0; i < 3; i++) { c = add(c, h[i].p); n = add(n, h[i].n); }
    c = mul(c, 1 / 3); n = unit(n);
    var tip = add(add(c, mul(n, height)), shift || [0, 0, 0]);
    var g = mul(add(add(h[0].p, h[1].p), add(h[2].p, tip)), 0.25), tris = [];
    for (i = 0; i < 3; i++) {
      var a = h[i].p, b = h[(i + 1) % 3].p, m = mul(add(add(a, b), tip), 1 / 3);
      tris.push(face(a, b, tip, sub(m, g), col));
    }
    return mesh(tris);
  }
  // A straight rod from a to b (an antenna, a boom), sides 3 or more, no caps.
  function rod(a, b, r, sides, col) {
    var d = sub(b, a), len = Math.sqrt(dot(d, d));
    var m = L.cylinder(r, r, len, sides || 3, col, { capTop: false, capBottom: false });
    return L.place(m, { pos: mul(add(a, b), 0.5), normal: d });
  }

  // Recolour faces by their normal: fn(normal) -> a colour, or null to keep it.
  function paintBy(m, fn) {
    return mesh(m.tris.map(function (t) {
      var c = fn(unit(cross(sub(t.v[1], t.v[0]), sub(t.v[2], t.v[0]))));
      return c ? T(t.v[0], t.v[1], t.v[2], c, t.e) : T(t.v[0], t.v[1], t.v[2], t.c, t.e);
    }));
  }
  // Recolour the faces that look along +Y (the top cap of a cylinder).
  function paintCaps(m, col) { return paintBy(m, function (n) { return n[1] > 0.99 ? col : null; }); }

  // ------------------------------------------------------------------ the shared bust
  // Head units: chin at y 0, crown at y 1, face toward +Z. Eight columns around, a vertex
  // on the front centre line (the nose ridge). Columns: 0 front right, 1 right cheek,
  // 2 behind the right ear, 3 back right, 4 back left, 5 behind the left ear, 6 left cheek,
  // 7 front left. Bands: 0 chin to mouth, 1 mouth to cheekbone, 2 the eyes, 3 the forehead.
  var HEAD_RINGS = [
    { y: 0.03, rx: 0.16, zo: 0.12, zf: 0.22, zb: 0.12 },   // chin
    { y: 0.25, rx: 0.325, zo: 0.03, zf: 0.38, zb: 0.31 },  // jaw and mouth
    { y: 0.45, rx: 0.36, zo: 0.00, zf: 0.43, zb: 0.42 },   // cheekbones, nose base
    { y: 0.66, rx: 0.37, zo: 0.00, zf: 0.44, zb: 0.45 },   // brow line
    { y: 0.86, rx: 0.34, zo: -0.02, zf: 0.36, zb: 0.46 }   // top of the forehead
  ];
  var HEAD_TOP = [0, 1.0, -0.06];   // the crown; left open in the models, where hair or a hat always covers it

  // Which head facets are hair, for a hair style. Returns fn(band, col, half).
  function headPaint(skin, hair, style) {
    return function (band, col, half) {
      if (band === 'top') return hair;
      if (band === 'bottom') return skin;
      var back = col >= 2 && col <= 5, nape = col === 3 || col === 4;
      if (style === 'none') return skin;
      if (band === 3) return (col === 0 || col === 7) ? skin : hair;
      if (band === 2) {
        if (back) return hair;
        if (col === 1) return half === 0 ? hair : skin;   // a short sideburn in front of the ear
        if (col === 6) return half === 1 ? hair : skin;
        return skin;
      }
      if (band === 1) return (style === 'bob' ? back : nape) ? hair : skin;
      return skin;
    };
  }
  var MOUTH = { skin1: 'copper', skin2: 'skin3', skin3: 'hair1' };

  // The head with its face. o: {skin, hair, style, ears (default true), brows}
  function head(o) {
    var skin = o.skin, hair = o.hair;
    var shell = loft(HEAD_RINGS, 8, 0, headPaint(skin, hair, o.style), false, true);
    var parts = [shell];
    // nose: a wedge from the bridge to a tip below the cheekbone line
    parts.push(bump(shell, 'front', [[-0.06, 0.39], [0.06, 0.39], [0, 0.565]], 0.07, skin, [0, -0.02, 0.015]));
    // eyes, brows, mouth (left and right halves, so nothing crosses the nose ridge)
    parts.push(pair(shell, [[0.085, 0.525], [0.185, 0.525], [0.18, 0.575], [0.09, 0.58]], 'black'));
    parts.push(pair(shell, [[0.06, 0.62], [0.215, 0.605], [0.215, 0.635], [0.065, 0.652]], o.brows || hair));
    parts.push(pair(shell, [[0.004, 0.272], [0.088, 0.278], [0.085, 0.298], [0.004, 0.298]], MOUTH[skin] || 'copper', 0.004));
    if (o.ears !== false) {
      parts.push(bump(shell, 'right', [[0.04, 0.6], [0.03, 0.42], [-0.13, 0.52]], 0.06, skin, [0, 0, -0.04]));
      parts.push(bump(shell, 'left', [[0.04, 0.6], [0.03, 0.42], [-0.13, 0.52]], 0.06, skin, [0, 0, -0.04]));
    }
    return { mesh: L.merge(parts), surf: shell };
  }

  // Hair blocks that sit over the head shell. The front of each lower ring is buried
  // inside the face, so only the sides, back and the fringe show.
  function hairBlock(style, hair) {
    if (style === 'none') return mesh();
    var rings;
    if (style === 'bob') {
      rings = [
        { y: 0.22, rx: 0.37, zo: -0.12, zf: 0.24, zb: 0.36 },
        { y: 0.58, rx: 0.42, zo: -0.07, zf: 0.30, zb: 0.47 },
        { y: 0.92, rx: 0.39, zo: -0.03, zf: 0.42, zb: 0.50 }
      ];
    } else if (style === 'bun') {
      rings = [
        { y: 0.60, rx: 0.38, zo: -0.08, zf: 0.30, zb: 0.43 },
        { y: 0.91, rx: 0.36, zo: -0.03, zf: 0.40, zb: 0.47 }
      ];
    } else {
      rings = [
        { y: 0.60, rx: 0.385, zo: -0.08, zf: 0.30, zb: 0.44 },
        { y: 0.91, rx: 0.37, zo: -0.03, zf: 0.42, zb: 0.49 }
      ];
    }
    var parts = [loft(rings, 8, 0, hair, [0, 1.09, -0.07], false)];
    if (style === 'bun') parts.push(L.move(L.rotate(L.scale(L.sphere(0.16, 0, hair), 1, 0.85, 1), -30, 0, 0), 0, 1.1, -0.3));
    return L.merge(parts);
  }

  // Torso: a chest and shoulders with a flat front facet (column 0) for ties and vests.
  // Columns: 0 front, 1 front right, 2 right arm, 3 back right, 4 back, 5 back left, 6 left arm, 7 front left.
  // Bands: 0 the chest, 1 the shoulder slope up to the collar.
  var TORSO_RINGS = [
    { y: 0.00, rx: 0.98, zo: 0.0, zf: 0.50, zb: 0.44 },
    { y: 0.55, rx: 1.03, zo: 0.0, zf: 0.50, zb: 0.44 },
    { y: 0.80, rx: 0.40, zo: -0.02, zf: 0.30, zb: 0.26 }
  ];
  function torso(colour) { return loft(TORSO_RINGS, 8, -22.5, colour, true, true); }

  var HEAD_AT = [0, 0.89, 0.04];   // where the head's chin sits on the torso

  // A whole bust in model units. o: {skin, hair, style, ears, brows, torso (colour or fn),
  // dress: fn(torsoSurf) -> mesh, extra: fn(headSurf, hairMesh) -> mesh}
  function bust(o) {
    var h = head(o);
    var body = torso(o.torso);
    var neck = L.move(L.cylinder(0.165, 0.175, 0.46, 6, o.skin, { capTop: false, capBottom: false }), 0, 0.9, -0.02);
    var hair = o.hat ? mesh() : hairBlock(o.style, o.hair);
    var top = L.merge([h.mesh, hair, o.extra ? o.extra(h.surf, hair) : mesh()]);
    var parts = [body, neck, L.move(top, HEAD_AT[0], HEAD_AT[1], HEAD_AT[2])];
    if (o.dress) parts.push(o.dress(body));
    return L.scale(L.merge(parts), S);
  }

  // ------------------------------------------------------------------ clothes
  function collarPoints(body, col) {
    return L.merge([
      bump(body, 'front', [[0.0, 0.79], [0.2, 0.775], [0.075, 0.6]], 0.05, col),
      bump(body, 'front', [[0.0, 0.79], [-0.075, 0.6], [-0.2, 0.775]], 0.05, col)
    ]);
  }
  // A tie on the flat front: knot and upper part on the shoulder slope, blade on the chest.
  function tie(body, col, w) {
    w = w || 0.075;
    return L.merge([
      decal(body, 'front', [[-0.05, 0.775], [0.05, 0.775], [0.035, 0.7], [-0.035, 0.7]], col),
      decal(body, 'front', [[-0.03, 0.7], [0.03, 0.7], [w * 0.75, 0.56], [-w * 0.75, 0.56]], col),
      decal(body, 'front', [[-w, 0.545], [w, 0.545], [w * 1.1, 0.12], [0, 0.04], [-w * 1.1, 0.12]], col)
    ]);
  }

  // ------------------------------------------------------------------ the speakers
  function shirtSleeves(skin, hair, tieCol) {       // Austin's colleague: white shirt, red tie, pens in the pocket
    return bust({
      skin: skin, hair: hair, style: 'short', torso: 'white',
      dress: function (b) {
        return L.merge([
          collarPoints(b, 'white'), tie(b, tieCol),
          decal(b, 'front', [[0.15, 0.22], [0.33, 0.22], [0.33, 0.42], [0.15, 0.42]], 'cream'),
          decal(b, 'front', [[0.19, 0.4], [0.215, 0.4], [0.215, 0.47], [0.19, 0.47]], 'sea', 0.012),
          decal(b, 'front', [[0.245, 0.4], [0.27, 0.4], [0.27, 0.46], [0.245, 0.46]], 'red', 0.012)
        ]);
      }
    });
  }
  function tealCoat(skin, hair) {                    // the second colleague: a teal coat over a white shirt
    return bust({
      skin: skin, hair: hair, style: 'bob', torso: 'teal', ears: false,
      dress: function (b) {
        return L.merge([
          decal(b, 'front', [[-0.145, 0.78], [0.145, 0.78], [0.0, 0.56]], 'white'),
          decal(b, 'front', [[-0.07, 0.545], [0.07, 0.545], [0.0, 0.2]], 'white'),
          decal(b, 'front', [[-0.03, 0.75], [0.03, 0.75], [0.02, 0.6], [-0.02, 0.6]], 'graphite', 0.011),
          bump(b, 'front', [[0.17, 0.79], [0.36, 0.77], [0.0, 0.555]], 0.04, 'teal'),
          bump(b, 'front', [[-0.17, 0.79], [0.0, 0.555], [-0.36, 0.77]], 0.04, 'teal')
        ]);
      }
    });
  }

  var PEOPLE = {};

  PEOPLE.team = function () {
    var front = shirtSleeves('skin1', 'hair2', 'red');
    var back = tealCoat('skin3', 'hair1');
    var m = L.merge([
      L.move(L.scale(back, 0.95), 0.22, 0.05, -0.34),
      L.move(front, -0.18, 0, 0.12)
    ]);
    return { mesh: frame(m), label: 'Portrait of your NASA team: two colleagues, one in shirtsleeves and a red tie, one in a teal coat' };
  };

  PEOPLE.partner = function () {
    var m = bust({
      skin: 'skin2', hair: 'hair1', style: 'bun', torso: 'red',
      extra: function (hs) {
        // goggles pushed up on the forehead: a strap round the head and two lenses
        var strap = loft([
          { y: 0.80, rx: 0.395, zo: -0.02, zf: 0.43, zb: 0.5 },
          { y: 0.87, rx: 0.39, zo: -0.025, zf: 0.42, zb: 0.5 }
        ], 8, 0, 'graphite', false, false);
        var parts = [strap];
        [-1, 1].forEach(function (sx) {
          var lens = paintCaps(L.cylinder(0.085, 0.095, 0.07, 6, 'gold', { capTop: true, capBottom: false, phase: 30 }), 'cellEdge');
          parts.push(L.place(lens, { pos: [sx * 0.135, 0.85, 0.385], normal: [sx * 0.15, 0.62, 0.77] }));
        });
        return L.merge(parts);
      },
      dress: function (b) {
        return L.merge([
          collarPoints(b, 'cream'),
          decal(b, 'front', [[-0.022, 0.6], [0.022, 0.6], [0.022, 0.556], [-0.022, 0.556]], 'tie'),
          decal(b, 'front', [[-0.022, 0.545], [0.022, 0.545], [0.022, 0.0], [-0.022, 0.0]], 'tie'),
          decal(b, 'front', [[0.17, 0.4], [0.29, 0.4], [0.29, 0.5], [0.17, 0.5]], 'gold')
        ]);
      }
    });
    return { mesh: frame(m), label: 'Portrait of your engineering partner, goggles pushed up on the head' };
  };

  PEOPLE.customer = function () {
    var m = bust({
      skin: 'skin3', hair: 'hair3', style: 'short', hat: true,
      torso: function (band, col) { return (col === 2 || col === 6 || band === 'top') ? 'shirt1' : 'gold'; },
      extra: function () {
        var crown = loft([
          { y: 0.74, rx: 0.4, zo: -0.05, zf: 0.45, zb: 0.5 },
          { y: 0.82, rx: 0.395, zo: -0.05, zf: 0.44, zb: 0.49 },
          { y: 1.06, rx: 0.32, zo: -0.05, zf: 0.34, zb: 0.38 }
        ], 8, 0, function (band) { return band === 0 ? 'graphite' : 'shirt3'; }, true, false);
        var brim = L.lathe([[0.8, -0.06], [0.42, 0.02]], 8, 'shirt3', true);
        brim = L.move(L.scale(brim, 1, 1, 1.08), 0, 0.76, -0.04);
        return L.merge([crown, brim]);
      },
      dress: function (b) {
        return L.merge([
          decal(b, 'front', [[-0.145, 0.78], [0.145, 0.78], [0.06, 0.556], [-0.06, 0.556]], 'shirt1'),
          decal(b, 'front', [[-0.06, 0.545], [0.06, 0.545], [0.06, 0.0], [-0.06, 0.0]], 'shirt1'),
          decal(b, 'front', [[-0.2, 0.12], [-0.34, 0.12], [-0.34, 0.26], [-0.2, 0.26]], 'copper'),
          decal(b, 'front', [[0.2, 0.12], [0.34, 0.12], [0.34, 0.26], [0.2, 0.26]], 'copper'),
          // a field radio clipped on the left shoulder strap
          L.move(L.box(0.13, 0.2, 0.08, 'metalDark'), 0.5, 0.52, 0.42),
          rod([0.53, 0.6, 0.42], [0.53, 0.86, 0.4], 0.012, 3, 'black'),
          L.quad([0.455, 0.57, 0.461], [0.485, 0.57, 0.461], [0.485, 0.6, 0.461], [0.455, 0.6, 0.461], 'red')
        ]);
      }
    });
    return { mesh: frame(m), label: 'Portrait of the customer in a field hat and vest' };
  };

  PEOPLE.director = function () {
    var m = bust({
      skin: 'skin2', hair: 'hair1', style: 'short', torso: 'white', ears: true,
      extra: function (hs, hair) {
        // a headset: a band hugging the hair from ear to ear, one ear cup on the left,
        // a boom microphone, and a pad over the right ear
        var parts = [], j, n = 6, w = 0.045, pts = [], c = [0, 0.52, -0.04], both = L.merge([hs, hair]);
        for (j = 0; j <= n; j++) {
          var a = Math.PI * j / n, dir = [Math.cos(a), Math.sin(a), 0];
          var hit = rayHit(both, add(c, mul(dir, 2)), mul(dir, -1));
          pts.push(hit ? add(hit.p, mul(dir, 0.03)) : add(c, mul(dir, 0.45)));
        }
        for (j = 0; j < n; j++) {
          var p = pts[j], q = pts[j + 1], out = unit([p[0] + q[0], p[1] + q[1] - 2 * c[1], 0]);
          parts.push(face([p[0], p[1], p[2] - w], [q[0], q[1], q[2] - w], [q[0], q[1], q[2] + w], out, 'metalDark'));
          parts.push(face([p[0], p[1], p[2] - w], [q[0], q[1], q[2] + w], [p[0], p[1], p[2] + w], out, 'metalDark'));
        }
        var band = mesh(parts);
        var cup = L.place(paintCaps(L.cylinder(0.12, 0.12, 0.07, 6, 'graphite', { capTop: true, capBottom: false, phase: 30 }), 'metalDark'), { pos: [0.4, 0.52, -0.03], normal: [1, 0, 0] });
        var boom = rod([0.42, 0.47, 0.03], [0.17, 0.27, 0.39], 0.016, 3, 'black');
        var mic = L.place(L.cylinder(0.035, 0.035, 0.07, 4, 'graphite', { phase: 45 }), { pos: [0.15, 0.265, 0.4], normal: [-0.6, -0.4, 0.7] });
        var pad = L.place(L.cylinder(0.06, 0.07, 0.05, 4, 'metalDark', { capTop: true, capBottom: false, phase: 45 }), { pos: [-0.4, 0.52, -0.04], normal: [-1, 0, 0] });
        return L.merge([band, cup, boom, mic, pad]);
      },
      dress: function (b) { return L.merge([collarPoints(b, 'white'), tie(b, 'black', 0.06)]); }
    });
    return { mesh: frame(m), label: 'Portrait of the mission director wearing a headset' };
  };

  PEOPLE.notebook = function () {
    // Austin's notebook lying open, propped up toward the viewer. Built flat (pages up, +Y),
    // then tilted back so the pages face +Z. Spine along Z at x = 0.
    var W = 0.62, D = 0.86;                        // one page: width (x) and depth (z)
    var parts = [];
    // worn leather cover, a touch wider than the pages, slightly lumpy
    parts.push(L.jitter(L.move(L.box(W * 2 + 0.1, 0.04, D + 0.08, 'hair2'), 0, -0.02, 0), 0.008, 11));
    // two page blocks that dip toward the spine
    [-1, 1].forEach(function (sx) {
      var sec = [[0.02, 0], [W, 0], [W, 0.065], [0.07, 0.065], [0.03, 0.035]];
      if (sx < 0) sec = sec.map(function (p) { return [-p[0], p[1]]; });
      var blk = L.rotate(L.prism(sec, D, 'cream'), -90, 0, 0);
      parts.push(paintBy(blk, function (n) { return n[1] > 0.6 ? null : 'sand'; }));   // page edges
    });
    // page surfaces for the decals
    var pages = L.merge(parts.slice(1));
    function onPage(pts, col, lift) { return decal(pages, 'top', pts, col, lift === undefined ? 0.004 : lift); }
    // notes on the left page
    var lines = [[-0.54, -0.3, -0.12], [-0.54, -0.18, -0.2], [-0.54, -0.06, -0.1], [-0.54, 0.06, -0.24], [-0.54, 0.18, -0.16], [-0.54, 0.3, -0.3]];
    lines.forEach(function (l) {
      parts.push(onPage([[l[0], l[1] - 0.014], [l[2], l[1] - 0.014], [l[2], l[1] + 0.014], [l[0], l[1] + 0.014]], 'steel'));
    });
    // a sketch of a satellite on the right page: a body, two panel wings, a star
    parts.push(onPage([[0.27, -0.09], [0.37, -0.09], [0.37, 0.03], [0.27, 0.03]], 'graphite'));
    parts.push(onPage([[0.1, -0.06], [0.24, -0.06], [0.24, 0.0], [0.1, 0.0]], 'cellEdge'));
    parts.push(onPage([[0.4, -0.06], [0.54, -0.06], [0.54, 0.0], [0.4, 0.0]], 'cellEdge'));
    parts.push(onPage([[0.31, -0.2], [0.33, -0.2], [0.33, -0.09], [0.31, -0.09]], 'graphite'));
    parts.push(onPage([[0.45, -0.3], [0.49, -0.3], [0.49, -0.26], [0.45, -0.26]], 'gold'));
    // dog-eared corner of the right page
    parts.push(L.quad([W - 0.13, 0.067, -D / 2], [W, 0.067, -D / 2 + 0.13], [W - 0.1, 0.08, -D / 2 + 0.1], [W - 0.115, 0.075, -D / 2 + 0.05], 'sand', true));
    // a red ribbon marker running down the spine and over the bottom edge
    parts.push(L.quad([-0.025, 0.04, -0.1], [0.025, 0.04, -0.1], [0.025, 0.04, D / 2 + 0.02], [-0.025, 0.04, D / 2 + 0.02], 'red', true));
    parts.push(L.quad([-0.025, 0.04, D / 2 + 0.02], [0.025, 0.04, D / 2 + 0.02], [0.04, -0.16, D / 2 + 0.06], [-0.01, -0.16, D / 2 + 0.06], 'red', true));
    // a pencil lying across the lower right page
    var pencil = L.merge([
      L.cylinder(0.026, 0.026, 0.5, 6, 'yellow', { capTop: false, capBottom: true }),
      L.move(L.cylinder(0.027, 0.027, 0.05, 6, 'silver', { capTop: false, capBottom: false }), 0, -0.27, 0),
      L.move(L.cylinder(0.024, 0.024, 0.04, 6, 'red', { capTop: false, capBottom: true }), 0, -0.315, 0),
      L.move(L.cylinder(0.008, 0.026, 0.08, 6, 'cream', { capTop: false, capBottom: false }), 0, 0.29, 0),
      L.move(L.cone(0.008, 0.025, 6, 'graphite'), 0, 0.3425, 0)
    ]);
    parts.push(L.move(L.rotate(L.rotate(pencil, 0, 0, -90), 0, 20, 0), 0.3, 0.093, 0.25));
    var book = L.merge(parts);
    // tilt it back: pages turn from facing +Y to facing up and forward
    book = L.rotate(book, 62, 0, 0);
    return { mesh: frame(book), label: "Austin's open notebook, with a sketch of a satellite" };
  };

  // Stand a mesh on y = 0, centred in x and z.
  function frame(m) {
    var b = L.bounds(m);
    return L.move(m, -b.center[0], -b.min[1], -b.center[2]);
  }

  // Register the speakers. A built model is kept, since meshes are never changed after
  // they are made; every call still returns a fresh {mesh, label} object.
  var reg = L.models.person, built = {};
  Object.keys(PEOPLE).forEach(function (who) {
    reg[who] = function (opts) {
      var m = built[who] || (built[who] = PEOPLE[who]());
      return { mesh: m.mesh, label: (opts && opts.label) ? String(opts.label) : m.label };
    };
  });

  // ------------------------------------------------------------------ portraits
  // How each speaker is framed: the vertical window [bottom, top] in model units, and the
  // backdrop colour. Unknown speakers are fitted whole.
  var FRAMES = {
    team: { lo: 0.02, hi: 1.3, shift: 0.0, back: 'sky' },
    partner: { lo: 0.16, hi: 1.16, back: 'teal' },
    customer: { lo: 0.16, hi: 1.16, back: 'green' },
    director: { lo: 0.16, hi: 1.16, back: 'steel' },
    notebook: { lo: null, hi: null, back: 'sea', key: '#ab9e82' }
  };
  var DEFAULT_YAW = 28, DEFAULT_PITCH = 6;

  // LowPoly.scenes.portrait({who, yaw, pitch, backdrop, aspect}) -> {scene, label, who}
  function portraitScene(o) {
    o = o || {};
    var who = o.who || 'team', model = L.model('person', who, o.model);
    var fr = FRAMES[who] || {}, b = L.bounds(model.mesh);
    var yaw = typeof o.yaw === 'number' ? o.yaw : DEFAULT_YAW;
    var pitch = typeof o.pitch === 'number' ? o.pitch : DEFAULT_PITCH;
    var aspect = o.aspect > 0 ? o.aspect : 1;
    var lo = fr.lo, hi = fr.hi, size, cy, cx = b.center[0], cz = b.center[2];
    if (lo === null || lo === undefined || hi === null || hi === undefined) {
      var r = Math.sqrt(dot(b.size, b.size)) / 2;
      size = 2 * r * 1.02; cy = b.center[1];
    } else { size = hi - lo; cy = (hi + lo) / 2; }
    if (aspect < 1) size = size / aspect;
    var target = [cx + Math.cos(yaw * RAD) * (fr.shift || 0), cy, cz - Math.sin(yaw * RAD) * (fr.shift || 0)];
    var cyw = Math.cos(yaw * RAD), syw = Math.sin(yaw * RAD), cp = Math.cos(pitch * RAD), sp = Math.sin(pitch * RAD);
    var back = [syw * cp, sp, cyw * cp];                  // from the target toward the eye
    var dist = 6 + size * 4;
    var items = [{ mesh: model.mesh, pos: [0, 0, 0] }];
    var bd = o.backdrop === undefined ? (fr.back || 'steel') : o.backdrop;
    if (bd) {
      var rad = 0.5 * size * Math.min(1, aspect) * 0.96;
      var disc = L.emit(L.disc(rad, 32, bd));
      items.unshift({ mesh: L.place(disc, { pos: sub(target, mul(back, 2.5 + size)), normal: back }) });
    }
    var label = model.label || 'Portrait';
    return {
      scene: {
        items: items,
        camera: { ortho: true, size: size, yaw: yaw, pitch: pitch, dist: dist, target: target },
        light: o.light || { dir: [-0.42, 0.6, 0.68], key: fr.key || '#c4b596', ambient: '#76829a', space: 'camera', hemi: 0.25 },
        background: o.background || null,
        label: label
      },
      label: label,
      who: who
    };
  }
  L.scenes.portrait = portraitScene;

  // LowPoly.portrait(canvas, who, opts): one still frame of a speaker's bust at a
  // three-quarter angle on a flat backdrop disc. Never throws. Returns render()'s result
  // (or null). opts: {yaw, pitch, backdrop (palette name, or null for none), background,
  // label, width, height, pixelRatio, quality}.
  L.portrait = function (canvas, who, opts) {
    opts = opts || {};
    try {
      if (!canvas || !canvas.setAttribute) return null;
      var w = opts.width || canvas.clientWidth || canvas.width || 1;
      var h = opts.height || canvas.clientHeight || canvas.height || 1;
      var o = {}, k;
      for (k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
      o.who = who; o.aspect = w / h;
      var ps = portraitScene(o);
      var label = opts.label || ps.label;
      ps.scene.label = label;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', label);
      var ro = { label: label };
      if (opts.width) ro.width = opts.width;
      if (opts.height) ro.height = opts.height;
      if (opts.pixelRatio) ro.pixelRatio = opts.pixelRatio;
      if (opts.quality) ro.quality = opts.quality;
      if (opts.ss) ro.ss = opts.ss;
      return L.render(canvas, ps.scene, ro);
    } catch (e) {
      return null;
    }
  };
})();
