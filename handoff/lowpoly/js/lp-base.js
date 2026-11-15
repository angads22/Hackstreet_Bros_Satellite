/*
 * lp-base.js: the space centre base map as a low-poly diorama, and the walking avatar.
 * Load after lowpoly.js. Plain ES5, no globals (everything hangs off LowPoly).
 *
 * Registers
 *   LowPoly.scenes.base(opts)          the base map diorama (replaces the pixel map art)
 *   LowPoly.scenes.minimap(opts)       the same layout with less detail, for the header minimap
 *   LowPoly.models.person.walker(opts) the player: a small faceted astronaut-engineer
 *
 * opts for base and minimap (all optional):
 *   width, height  canvas size in CSS px (default 1000 x 600, minimap 168 x 101). Only the ASPECT
 *                  matters to the picture; project() returns pixels for this size.
 *   places         the game's PLACES array ([{id, name, ...}]), default: the five design places
 *   nodes          the game's NODES object ({id: {x, y}}), default: the game's nodes
 *   edges          the game's EDGES array ([[a, b], ...]), default: the game's roads
 *   pitch          camera tilt in degrees (default 50, clamped to 50..80: lower, the pad tower
 *                  would rise past the top edge)
 *   detail         "high" (default for base) or "low" (default for minimap: no trees, fence, lamps)
 *   animate        false: no dish slew or beacon blink (update always returns false)
 *
 * THE MAPPING (why the existing DOM markers need no change)
 *   The game's map is 200 x 120 units and the DOM puts markers and the player at
 *   left = x / 200 * 100 %, top = y / 120 * 100 %. The scene uses an orthographic camera at yaw 0,
 *   tilted down by `pitch`, and lays the ground out so that the ground point at map (x, y) is drawn
 *   at exactly that place on the canvas:
 *       size = 200 * H / W            (vertical world extent of the view, 120 at 5:3)
 *       kz   = size / (120 * sin(pitch))
 *       world X = x - 100,  world Y = height,  world Z = (y - 60) * kz
 *   so project(x, y) = [x / 200 * W, y / 120 * H] for every ground point. Something h world units
 *   above the ground is drawn h * cos(pitch) * W / 200 px higher: project(x, y, h).
 *   The canvas must keep the aspect width:height that was passed (default 5:3, the same as the
 *   .map box's aspect-ratio). Any size with that aspect works, so a responsive canvas is fine:
 *   use projectPct(x, y, h) for CSS percentages. Verified at 5:3, 4:3 and 16:9 and pitch 50 to 80:
 *   nothing rises past the top edge and nothing solid covers a node; project() is within 0.5 px of
 *   the rendered pixels at 900, 360, 168 and 104 px wide, at device pixel ratio 1 and 2.
 *
 * USE IN THE GAME: LowPoly.view(canvas, LowPoly.scenes.base({...}), {drag: false, keys: false}).
 *   drag and keys MUST be off: the map owns the arrow keys and WASD, and a turned camera would move
 *   every building away from its marker. update() slews the tracking dish and blinks two beacons
 *   (about 8 redraws a second) and holds still under prefers-reduced-motion or animate: false.
 *   The canvas is decoration under the DOM markers: give it aria-hidden="true" (the .map group and
 *   its marker buttons carry the meaning). The header minimap needs one LowPoly.render, no view.
 *   Buildings stand on their lots behind their door node (Mission Control, Tracking Station and
 *   Launch Pad north of their node, Workshop, Rocket Yard and Ground Station south of it), so each
 *   numbered marker sits on its building's door, as in the pixel map. Nothing tall covers a node.
 *
 * Extras returned by LowPoly.scenes.base / minimap besides {scene, project, update, label}:
 *   projectPct(x, y, h) -> [left%, top%]      toWorld(x, y, h) -> [X, Y, Z]
 *   aspect (W / H), pitch, width, height, tris (triangle count), counts (triangles per part),
 *   lots: {placeId: {rect: [x0, y0, x1, y1] map units, center: [x, y], world: [X, 0, Z]}}
 *   walker: {scene(face, stride), aspect, anchor:[ax, ay], cssHeight}  (see walkerSprite below)
 *
 * THE WALKER in the DOM: put a canvas of cssHeight x round(cssHeight * aspect) CSS px inside .player
 *   instead of the arrow, drop the CSS rotate and use
 *   transform: translate(-anchor[0] * 100%, -anchor[1] * 100%) so the feet stand on the node. Call
 *   LowPoly.render(canvas, base.walker.scene(face, stride)) when placePlayer changes the facing
 *   (face is the same angle as --face: 0 north, 90 east, 180 south, -90 west), and while walking a
 *   few times a second with stride = Math.sin(t * 9) for a walk cycle (stride 0 when standing or
 *   under reduced motion).
 */
(function (root) {
  'use strict';
  var LP = root && root.LowPoly;
  if (!LP) return;
  LP.models = LP.models || {};
  LP.models.person = LP.models.person || {};
  LP.scenes = LP.scenes || {};

  var DEG = Math.PI / 180;
  var MAP_W = 200, MAP_H = 120;
  var PITCH = 50;
  var TRI_BUDGET = 2470;   // the whole base scene stays under the 2500 scene budget
  var LIGHT = { dir: [-0.5, 0.82, 0.62], key: '#c6b896', ambient: '#5f6d85', steps: 0 };

  // The game's base map (js/ui-design.js), used when the caller passes nothing.
  var DEF_PLACES = [
    { id: 'briefing', num: 1, name: 'MISSION CONTROL' },
    { id: 'orbit', num: 2, name: 'TRACKING STATION' },
    { id: 'build', num: 3, name: 'WORKSHOP' },
    { id: 'launcher', num: 4, name: 'ROCKET YARD' },
    { id: 'review', num: 5, name: 'LAUNCH PAD' }
  ];
  var DEF_NODES = {
    gate: { x: 10, y: 63 }, j1: { x: 40, y: 63 }, j2: { x: 100, y: 63 }, j3: { x: 160, y: 63 },
    briefing: { x: 40, y: 40 }, orbit: { x: 100, y: 40 }, review: { x: 160, y: 40 },
    build: { x: 40, y: 86 }, launcher: { x: 100, y: 86 }, ground: { x: 160, y: 86 }
  };
  var DEF_EDGES = [['gate', 'j1'], ['j1', 'j2'], ['j2', 'j3'], ['j1', 'briefing'], ['j1', 'build'],
                   ['j2', 'orbit'], ['j2', 'launcher'], ['j3', 'review'], ['j3', 'ground']];

  // Lot sizes in map units: w across, d along the side road, gap from the node to the lot edge,
  // dx shifts the lot sideways (the pad lot sits a little east of its node, as in the pixel map).
  var LOTS = {
    briefing: { w: 40, d: 30, gap: 2, dx: 0 },
    orbit: { w: 40, d: 30, gap: 2, dx: 0 },
    review: { w: 36, d: 32, gap: 2, dx: 2 },
    build: { w: 44, d: 24, gap: 4, dx: 0 },
    launcher: { w: 44, d: 24, gap: 4, dx: 0 },
    ground: { w: 34, d: 24, gap: 4, dx: 1 },
    other: { w: 28, d: 22, gap: 3, dx: 0 }
  };

  // ------------------------------------------------------------------ small helpers
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function vlen(a) { return Math.sqrt(dot(a, a)); }
  function tri(a, b, c, col, e) { return { v: [a.slice(), b.slice(), c.slice()], c: col, e: e ? 1 : 0 }; }
  function M(list) { return LP.merge(list); }
  function mv(m, x, y, z) { return LP.move(m, x, y, z); }

  // A flat convex polygon, turned so that its front faces `want`.
  function face(pts, col, want, e) {
    var n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
    if (want && dot(n, want) < 0) pts = pts.slice().reverse();
    var t = [], i;
    for (i = 1; i < pts.length - 1; i++) t.push(tri(pts[0], pts[i], pts[i + 1], col, e));
    return { tris: t };
  }
  // A rectangle facing +Z (a decal on a front wall), from (x0, y0) to (x1, y1) at depth z.
  function front(x0, y0, x1, y1, z, col, e) {
    return face([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], col, [0, 0, 1], e);
  }
  // Both windings of a triangle (a fin, a thin plate).
  function plate(a, b, c, col) { return { tris: [tri(a, b, c, col), tri(a, c, b, col)] }; }
  // A double-sided strip from p to q in the plane z = p[2] (lattice bracing).
  function strip(p, q, t, col) {
    var dx = q[0] - p[0], dy = q[1] - p[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / l * t / 2, ny = dx / l * t / 2, z = p[2];
    var a = [p[0] + nx, p[1] + ny, z], b = [p[0] - nx, p[1] - ny, z], c = [q[0] - nx, q[1] - ny, z], d = [q[0] + nx, q[1] + ny, z];
    return { tris: [tri(a, b, c, col), tri(a, c, d, col), tri(a, c, b, col), tri(a, d, c, col)] };
  }
  function triN(t) {
    var n = cross(sub(t.v[1], t.v[0]), sub(t.v[2], t.v[0])), l = vlen(n) || 1;
    return [n[0] / l, n[1] / l, n[2] / l];
  }
  function triC(t) {
    return [(t.v[0][0] + t.v[1][0] + t.v[2][0]) / 3, (t.v[0][1] + t.v[1][1] + t.v[2][1]) / 3, (t.v[0][2] + t.v[1][2] + t.v[2][2]) / 3];
  }
  // Recolour triangles: fn(normal, centroid) returns a colour, or nothing to keep the old one.
  function paint(m, fn) {
    var out = [], i;
    for (i = 0; i < m.tris.length; i++) {
      var t = m.tris[i], c = fn(triN(t), triC(t), i);
      out.push({ v: [t.v[0].slice(), t.v[1].slice(), t.v[2].slice()], c: c || t.c, e: t.e ? 1 : 0 });
    }
    return { tris: out };
  }
  // A box standing on y (its bottom at y), centred on x, z.
  function boxAt(w, h, d, col, x, y, z) { return mv(LP.box(w, h, d, col), x || 0, (y || 0) + h / 2, z || 0); }
  // An open tube (no caps) from y0 to y1 about the Y axis, optionally spun by phase degrees.
  function tube(r0, r1, y0, y1, n, col, phase) {
    var m = LP.lathe([[r0, y0], [r1, y1]], n, col);
    return phase ? LP.rotate(m, 0, phase, 0) : m;
  }
  // A cylinder standing on y with its top capped.
  function post(r0, r1, h, n, col, x, y, z, phase) {
    return mv(LP.cylinder(r1, r0, h, n, col, { capBottom: false, phase: phase || 0 }), x || 0, (y || 0) + h / 2, z || 0);
  }
  // A thin rod from p to q (3-sided, open).
  function rod(p, q, r, col, n) {
    var d = sub(q, p), l = vlen(d);
    return LP.place(LP.lathe([[r, 0], [r, l]], n || 3, col), { pos: p, normal: d });
  }
  // A square beam from p to q.
  function beam(p, q, w, col) {
    var d = sub(q, p), l = vlen(d);
    return LP.place(mv(LP.box(w, l, w, col), 0, l / 2, 0), { pos: p, normal: d });
  }

  // ------------------------------------------------------------------ shared props
  // A dish bowl opening along +Y, vertex at the origin: light inside, darker back.
  function bowl(R, depth, n, inner, outer) {
    var prof = [[0, 0], [R * 0.52, depth * 0.27], [R, depth]];
    return M([LP.lathe(prof, n, outer), LP.lathe(prof.slice().reverse(), n, inner)]);
  }
  // A steerable dish: yoke on a turntable, bowl tilted to `elev` degrees toward +Z, feed struts.
  // Origin = the azimuth bearing (put it on top of a pedestal). Spin it about Y to slew.
  function dishHead(o) {
    var R = o.R, depth = o.depth || R * 0.32, f = R * 0.72, legs = o.legs || 3, i;
    var head = [bowl(R, depth, o.sides || 10, o.inner || 'white', o.outer || 'silver')];
    for (i = 0; i < legs; i++) {
      var a = (90 + i * 360 / legs) * DEG;
      head.push(rod([R * 0.9 * Math.cos(a), depth * 0.92, -R * 0.9 * Math.sin(a)], [0, f, 0], Math.max(0.08, R * 0.022), 'steel', 3));
    }
    head.push(mv(LP.cylinder(R * 0.06, R * 0.09, R * 0.16, 4, 'graphite', { capBottom: false, phase: 45 }), 0, f, 0));
    if (o.sub) head.push(mv(LP.disc(R * 0.17, 6, o.inner || 'white', true), 0, f + R * 0.09, 0));
    var tilted = mv(LP.rotate(M(head), 90 - o.elev, 0, 0), 0, o.axle, 0);
    var arm = R * 0.24, yc = o.yoke || 'steel';
    return M([
      mv(LP.cylinder(R * 0.36, R * 0.36, 0.5, 6, yc, { capBottom: false }), 0, 0.25, 0),
      boxAt(0.5, o.axle, 1.1, yc, -arm, 0.4, 0),
      boxAt(0.5, o.axle, 1.1, yc, arm, 0.4, 0),
      tilted
    ]);
  }
  // A small fixed dish on a stub post (roof dishes): bowl, one feed rod, a post.
  function miniDish(R, elev, az, col) {
    var head = M([
      LP.lathe([[0, 0], [R, R * 0.35]], 8, 'silver'),
      LP.lathe([[R, R * 0.35], [0, 0]], 8, col || 'white'),
      rod([0, 0, 0], [0, R * 0.8, 0], R * 0.05, 'steel', 3)
    ]);
    return M([
      post(0.18, 0.18, R * 0.7, 4, 'steel', 0, 0, 0, 45),
      mv(LP.rotate(head, 90 - elev, az, 0), 0, R * 0.75, 0)
    ]);
  }
  // A rocket standing on y = 0 from rings [[r, y, colourOfTheBandBelow], ...], bottom to top.
  function rocket(rings, n, fins) {
    var parts = [], i;
    for (i = 1; i < rings.length; i++) {
      parts.push(LP.lathe([[rings[i - 1][0], rings[i - 1][1]], [rings[i][0], rings[i][1]]], n, rings[i][2]));
    }
    if (fins) {
      for (i = 0; i < 4; i++) {
        var a = (45 + 90 * i) * DEG, ux = Math.cos(a), uz = -Math.sin(a), r = fins.r;
        parts.push(plate([ux * r, fins.y1, uz * r], [ux * r, fins.y0, uz * r],
          [ux * (r + fins.span), fins.y0 - fins.drop, uz * (r + fins.span)], fins.c));
      }
    }
    return M(parts);
  }
  function pine(h, r) {
    return M([
      tube(r * 0.13, r * 0.1, 0, h * 0.3, 3, 'hair2', 30),
      LP.lathe([[r, h * 0.22], [0, h * 0.72]], 6, 'grass'),
      LP.lathe([[r * 0.72, h * 0.48], [0, h]], 6, 'grass')
    ]);
  }
  function bush(r, seed) {
    return mv(LP.jitter(LP.scale(LP.sphere(r, 0, 'green'), 1, 0.62, 1), r * 0.16, seed), 0, r * 0.42, 0);
  }

  // ------------------------------------------------------------------ shadows
  // The key light comes from the south-west (LIGHT.dir), so a point h units up throws its shadow
  // h * SH_X east and h * SH_Z north. A shadow is the convex hull of a footprint and its offset copy
  // (or only the offset copy for something in the air), clipped to the lot, drawn as a ground decal.
  var SH_X = -LIGHT.dir[0] / LIGHT.dir[1], SH_Z = -LIGHT.dir[2] / LIGHT.dir[1];
  function hull(pts) {
    pts = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function crs(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], hi = [], i;
    for (i = 0; i < pts.length; i++) {
      while (lo.length >= 2 && crs(lo[lo.length - 2], lo[lo.length - 1], pts[i]) <= 0) lo.pop();
      lo.push(pts[i]);
    }
    for (i = pts.length - 1; i >= 0; i--) {
      while (hi.length >= 2 && crs(hi[hi.length - 2], hi[hi.length - 1], pts[i]) <= 0) hi.pop();
      hi.push(pts[i]);
    }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  }
  function clipPoly(pts, x0, z0, x1, z1) {
    function clip(list, inside, cut) {
      var out = [], i;
      for (i = 0; i < list.length; i++) {
        var a = list[i], b = list[(i + 1) % list.length], ia = inside(a), ib = inside(b);
        if (ia) out.push(a);
        if (ia !== ib) out.push(cut(a, b));
      }
      return out;
    }
    function atX(x) { return function (a, b) { var t = (x - a[0]) / (b[0] - a[0]); return [x, a[1] + (b[1] - a[1]) * t]; }; }
    function atZ(z) { return function (a, b) { var t = (z - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, z]; }; }
    pts = clip(pts, function (p) { return p[0] >= x0; }, atX(x0));
    if (pts.length) pts = clip(pts, function (p) { return p[0] <= x1; }, atX(x1));
    if (pts.length) pts = clip(pts, function (p) { return p[1] >= z0; }, atZ(z0));
    if (pts.length) pts = clip(pts, function (p) { return p[1] <= z1; }, atZ(z1));
    return pts;
  }
  function ring(x, z, r, n) {
    var out = [], i;
    for (i = 0; i < (n || 8); i++) { var a = (i + 0.5) / (n || 8) * Math.PI * 2; out.push([x + r * Math.cos(a), z + r * Math.sin(a)]); }
    return out;
  }
  function rect(x0, z0, x1, z1) { return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]; }
  // shadow spec: [footprint points [[x, z], ...], height, floating]
  function shadowPoly(spec) {
    var foot = spec[0], h = spec[1], pts = [], i;
    for (i = 0; i < foot.length; i++) {
      if (!spec[2]) pts.push(foot[i]);
      pts.push([foot[i][0] + h * SH_X, foot[i][1] + h * SH_Z]);
    }
    return hull(pts);
  }

  // ------------------------------------------------------------------ the mapping
  function mapping(W, H, pitch) {
    var p = pitch * DEG, sp = Math.sin(p), cp = Math.cos(p);
    var size = MAP_W * H / W, kz = size / (MAP_H * sp), ppu = W / MAP_W;
    return {
      W: W, H: H, pitch: pitch, sp: sp, cp: cp, size: size, kz: kz, ppu: ppu,
      X: function (mx) { return mx - MAP_W / 2; },
      Z: function (my) { return (my - MAP_H / 2) * kz; },
      toWorld: function (mx, my, h) { return [mx - MAP_W / 2, num(h, 0), (my - MAP_H / 2) * kz]; },
      project: function (mx, my, h) { return [mx / MAP_W * W, my / MAP_H * H - num(h, 0) * cp * ppu]; },
      projectPct: function (mx, my, h) { return [mx / MAP_W * 100, (my / MAP_H - num(h, 0) * cp * ppu / H) * 100]; },
      camera: function () { return { ortho: true, yaw: 0, pitch: pitch, size: size, dist: 260, target: [0, 0, 0] }; }
    };
  }

  // ------------------------------------------------------------------ ground
  function groundBuilder(mp) {
    var parts = [];
    function g(pts, col, lift) {
      var w = pts.map(function (q) { return [mp.X(q[0]), lift, mp.Z(q[1])]; });
      parts.push(face(w, col, [0, 1, 0]));
    }
    return {
      parts: parts,
      rect: function (x0, y0, x1, y1, col, lift) { g([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], col, lift); },
      poly: function (pts, col, lift) { g(pts, col, lift); },
      // a strip of half-width hw along a segment, stretched by `ext` past both ends
      seg: function (ax, ay, bx, by, hw, col, lift, ext) {
        var dx = bx - ax, dy = by - ay, l = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / l, uy = dy / l;
        ext = ext || 0;
        ax -= ux * ext; ay -= uy * ext; bx += ux * ext; by += uy * ext;
        g([[ax - uy * hw, ay + ux * hw], [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw], [ax + uy * hw, ay - ux * hw]], col, lift);
      }
    };
  }

  // ------------------------------------------------------------------ buildings
  // Each builder gets the lot in world units: {cx, cz, w, d} (local +z = south, toward the camera)
  // and returns {mesh, dish?, beacon?} in LOCAL coordinates (the caller moves it to the lot).
  // F = half the lot depth (the south edge is at z = +F, the north edge at -F).

  function missionControl(L, low) {
    var F = L.d / 2, zf = F - 2.6, p = [];
    var foot = [[-16, zf - 14], [16, zf - 14], [16, zf - 1.8], [14.2, zf], [-14.2, zf], [-16, zf - 1.8]];
    p.push(paint(mv(LP.prism(foot, 8, 'cream'), 0, 4, 0), function (n) { return n[1] > 0.9 ? 'silver' : null; }));
    // operations wing behind, rising above the main roof
    p.push(paint(boxAt(15, 13, 12, 'white', 5, 0, zf - 14), function (n) { return n[1] > 0.9 ? 'silver' : null; }));
    // entrance canopy and doors
    p.push(boxAt(7.4, 0.5, 3, 'white', 0, 3.1, zf + 1.5));
    p.push(front(-2.2, 0, 2.2, 2.8, zf + 0.03, 'graphite'));
    if (!low) {
      var rows = [[1.5, 3.1], [4.6, 6.2]], cols = [[-13.4, -10.4], [-9.6, -6.6], [-5.8, -3.2], [3.2, 5.8], [6.6, 9.6], [10.4, 13.4]];
      rows.forEach(function (r) { cols.forEach(function (c) { p.push(front(c[0], r[0], c[1], r[1], zf + 0.03, 'cell')); }); });
      [[-1.4, 1.6], [2.2, 5.2], [5.8, 8.8], [9.4, 11.6]].forEach(function (c) { p.push(front(c[0], 9.3, c[1], 11.6, zf - 8 + 0.03, 'cell')); });
      p.push(boxAt(2.6, 1.2, 2, 'steel', -4, 8, zf - 10));
      // small roof dish
      p.push(mv(miniDish(2.2, 40, -25), -10, 8, zf - 8));
    } else {
      p.push(front(-13.4, 1.5, -3.2, 6.2, zf + 0.03, 'cell'));
      p.push(front(3.2, 1.5, 13.4, 6.2, zf + 0.03, 'cell'));
      p.push(front(-1.4, 9.3, 11.6, 11.6, zf - 8 + 0.03, 'cell'));
    }
    // aerial mast on the operations wing, with a beacon on top
    var mx = 9.5, mz = zf - 17;
    p.push(LP.rotate(tube(0.45, 0.14, 13, 22, 4, 'steel'), 0, 45, 0));
    p[p.length - 1] = mv(p[p.length - 1], mx, 0, mz);
    p.push(boxAt(3.4, 0.25, 0.25, 'steel', mx, 18.5, mz));
    p.push(boxAt(2.2, 0.25, 0.25, 'steel', mx, 20.6, mz));
    return { mesh: M(p), beacon: [mx, 22, mz],
      shadows: [[foot, 8], [rect(-2.5, zf - 20, 12.5, zf - 8), 13], [ring(mx, mz, 0.4, 4), 22]] };
  }

  function trackingStation(L, low) {
    var F = L.d / 2, zf = F - 2.6, p = [];
    p.push(paint(boxAt(18, 5, 9, 'white', 0, 0, zf - 4.5), function (n) { return n[1] > 0.9 ? 'silver' : null; }));
    p.push(front(-1.3, 0, 1.3, 2.6, zf + 0.03, 'graphite'));
    if (!low) {
      [[-7.6, -5], [-4.4, -1.8], [1.8, 4.4], [5, 7.6]].forEach(function (c) { p.push(front(c[0], 1.8, c[1], 3.6, zf + 0.03, 'cell')); });
      p.push(boxAt(2.4, 1, 2, 'steel', 4.5, 5, zf - 5));
    } else {
      p.push(front(-7.6, 1.8, -1.8, 3.6, zf + 0.03, 'cell'));
      p.push(front(1.8, 1.8, 7.6, 3.6, zf + 0.03, 'cell'));
    }
    // radome on a drum, back left
    var rx = -11, rz = zf - 15;
    p.push(post(3.3, 3.3, 3, 8, 'concrete', rx, 0, rz));
    p.push(mv(LP.sphere(4.2, 1, 'white'), rx, 3 + 2.7, rz));
    // big dish, back right: the pedestal is static, the head slews (an item of its own)
    var dx = 10, dz = zf - 17, ped = 4.6;
    p.push(post(2.4, 1.9, ped, 8, 'concrete', dx, 0, dz));
    var head = dishHead({ R: 7, elev: 38, axle: 3.3, sides: 10, inner: 'white', outer: 'silver', yoke: 'steel' });
    return { mesh: M(p), dish: { mesh: head, pos: [dx, ped, dz], az: -12, swing: 22 },
      shadows: [[rect(-9, zf - 9, 9, zf), 5], [ring(rx, rz, 3.9), 8], [ring(dx, dz, 2.2), ped], [ring(dx, dz + 2.5, 5.2), 11, true]] };
  }

  function workshop(L, low) {
    var F = L.d / 2, p = [];
    // arched hangar, its big door facing south (the camera)
    var hw = 13, wall = 6, rise = 5, cx = -7, z0 = -9, z1 = F - 1.2, segs = 6, prof = [[-hw, 0], [hw, 0]], i;
    for (i = 0; i <= segs; i++) {
      var a = Math.PI * i / segs;
      prof.push([hw * Math.cos(a), wall + rise * Math.sin(a)]);
    }
    var pts = prof.map(function (q) { return [q[0], -q[1]]; });
    var hangar = LP.rotate(LP.prism(pts, z1 - z0, 'cream'), 90, 0, 0);
    hangar = paint(hangar, function (n) {
      if (n[1] < 0.2) return null;
      var k = Math.round(Math.atan2(n[1], n[0]) / (Math.PI / segs) - 0.5);
      return k % 2 ? 'steel' : 'silver';
    });
    p.push(mv(hangar, cx, 0, (z0 + z1) / 2));
    var zd = z1 + 0.03;
    p.push(front(cx - 6.4, 0, cx - 0.8, 7.4, zd, 'steel'));
    p.push(front(cx + 0.8, 0, cx + 6.4, 7.4, zd, 'steel'));
    p.push(front(cx - 0.8, 0, cx + 0.8, 7.4, zd, 'black'));
    p.push(front(cx - 0.6, 1.3, cx + 0.6, 4.2, zd + 0.03, 'gold'));
    p.push(front(cx - 6.9, 7.4, cx + 6.9, 8.2, zd, 'yellow'));
    if (!low) {
      [-4.6, -2.6, 2.6, 4.6].forEach(function (x) { p.push(front(cx + x - 0.12, 0, cx + x + 0.12, 7.4, zd + 0.03, 'graphite')); });
      p.push(front(cx - 12, 3.4, cx - 9, 5, zd, 'cell'));
      p.push(front(cx + 9, 3.4, cx + 12, 5, zd, 'cell'));
    }
    // gantry crane over the yard east of the hangar
    var gx0 = 9.5, gx1 = 19.5, gz = 1.5, top = 12, yc = 'yellow';
    [gx0, gx1].forEach(function (x) {
      p.push(boxAt(0.9, 0.8, 7.5, 'graphite', x, 0, gz));
      p.push(beam([x, 0.8, gz - 3.2], [x, top, gz], 0.8, yc));
      p.push(beam([x, 0.8, gz + 3.2], [x, top, gz], 0.8, yc));
    });
    p.push(boxAt(gx1 - gx0 + 3, 1.3, 1.4, yc, (gx0 + gx1) / 2, top, gz));
    var tx = (gx0 + gx1) / 2 + 0.5;
    p.push(boxAt(2.2, 1, 1.9, 'graphite', tx, top + 1.3, gz));
    p.push(boxAt(0.14, 4.4, 0.14, 'black', tx, top - 4.4, gz));
    p.push(boxAt(0.8, 0.7, 0.8, 'orange', tx, top - 5.1, gz));
    // the satellite on the hook: gold body, two blue wings
    p.push(boxAt(2, 2.2, 2, 'gold', tx, top - 7.4, gz));
    p.push(boxAt(2.4, 1.7, 0.12, 'cell', tx - 2.3, top - 7, gz));
    p.push(boxAt(2.4, 1.7, 0.12, 'cell', tx + 2.3, top - 7, gz));
    return { mesh: M(p), rails: [[gx0, -F + 4, gx0, F - 1], [gx1, -F + 4, gx1, F - 1]],
      shadows: [[rect(cx - hw, z0, cx + hw, z1), 9], [rect(gx0 - 1.5, gz - 0.7, gx1 + 1.5, gz + 0.7), 12.6, true],
        [rect(gx0 - 0.4, gz - 0.4, gx0 + 0.4, gz + 0.4), 12], [rect(gx1 - 0.4, gz - 0.4, gx1 + 0.4, gz + 0.4), 12],
        [rect(tx - 3.5, gz - 1, tx + 3.5, gz + 1), 6.5, true]] };
  }

  function rocketYard(L, low) {
    var p = [], n = 6;
    // small 1958 stick: a slim rocket with a roll-pattern band and a tiny upper stage
    p.push(mv(M([
      mv(rocket([[0.7, 0, ''], [0.45, 0.8, 'graphite'], [0.85, 0.8, 'graphite'], [0.85, 4.8, 'white'], [0.85, 6, 'black'],
        [0.85, 8.6, 'white'], [0.55, 9.1, 'white'], [0, 12.2, 'red']], n,
        { r: 0.85, y0: 0.9, y1: 3, span: 0.8, drop: 0.3, c: 'graphite' }), 0, 0, 0)
    ]), -15, 0, 6));
    // stubby 1960s booster
    p.push(mv(M([
      mv(rocket([[1.0, 0, ''], [0.65, 1, 'graphite'], [1.45, 1, 'graphite'], [1.45, 7.6, 'white'], [1.45, 8.8, 'black'],
        [1.05, 9.5, 'white'], [1.05, 11.8, 'white'], [0, 14.2, 'silver']], n), 0, 0, 0)
    ]), -7, 0, 2.5));
    // modern rocket with a payload fairing
    p.push(mv(M([
      mv(rocket([[1.1, 0, ''], [0.75, 1, 'graphite'], [1.55, 1, 'graphite'], [1.55, 11, 'white'], [1.55, 12.4, 'graphite'],
        [1.55, 15.4, 'white'], [1.95, 16.2, 'white'], [1.95, 18.6, 'white'], [0, 21.4, 'cream']], n), 0, 0, 0)
    ]), 14, 0, 5));
    // a stage lying on a transporter, front centre
    var stage = LP.rotate(M([
      LP.cylinder(1.2, 1.2, 11, n, 'white'),
      mv(LP.cylinder(1.22, 1.22, 1.2, n, 'orange', { capTop: false, capBottom: false }), 0, 3.2, 0),
      mv(LP.lathe([[1.05, 0], [0.6, 1.2]], n, 'graphite'), 0, -6.7, 0)
    ]), 0, 0, 90);
    p.push(mv(stage, 1, 2.4, 11.5));
    p.push(boxAt(12.5, 1.2, 2.6, 'metalDark', 1, 0, 11.5));
    p.push(boxAt(3, 2.6, 2.6, 'orange', -7.6, 0, 11.5));
    if (!low) p.push(front(-8.8, 1.4, -6.4, 2.3, 11.5 + 1.3 + 0.03, 'cell'));
    return { mesh: M(p), shadows: [[ring(-15, 6, 0.85, 6), 12.2], [ring(-7, 2.5, 1.45, 6), 14.2], [ring(14, 5, 1.6, 6), 21.4],
      [rect(-9.1, 10.2, 7.5, 12.8), 3.6]] };
  }

  function launchPad(L, low) {
    var p = [], rx = -2, pad = 1.4, i;
    // octagonal pad with a ramp down to the road and a flame trench running north
    var oct = [];
    for (i = 0; i < 8; i++) { var a = (22.5 + 45 * i) * DEG; oct.push([rx + 9.5 * Math.cos(a), -9.5 * Math.sin(a)]); }
    p.push(paint(mv(LP.prism(oct, pad, 'concrete'), 0, pad / 2, 0), function (n) { return n[1] > 0.9 ? 'cream' : null; }));
    var r0 = 8.7, r1 = 14.5, hw = 2.6;
    p.push(face([[rx - hw, pad, r0], [rx + hw, pad, r0], [rx + hw, 0, r1], [rx - hw, 0, r1]], 'concrete', [0, 1, 0.3]));
    p.push(face([[rx + hw, pad, r0], [rx + hw, 0, r0], [rx + hw, 0, r1]], 'concrete', [1, 0, 0]));
    p.push(face([[rx - hw, pad, r0], [rx - hw, 0, r0], [rx - hw, 0, r1]], 'concrete', [-1, 0, 0]));
    p.push(face([[rx - 1.6, pad + 0.03, -9], [rx + 1.6, pad + 0.03, -9], [rx + 1.6, pad + 0.03, -2.2], [rx - 1.6, pad + 0.03, -2.2]], 'black', [0, 1, 0]));
    p.push(boxAt(4.6, 1.3, 4.6, 'graphite', rx, pad, 0));
    // the rocket
    var base = pad + 1.3;
    p.push(mv(rocket([[1.05, 0, ''], [0.6, 1, 'graphite'], [1.6, 1, 'graphite'], [1.6, 10.5, 'white'], [1.6, 11.8, 'black'],
      [1.6, 16.6, 'white'], [1.9, 17.4, 'white'], [1.9, 20.6, 'white'], [1.15, 22.4, 'red'], [0, 23.6, 'red']], 6,
      { r: 1.6, y0: 1.2, y1: 4.6, span: 1.4, drop: 0.5, c: 'red' }), rx, base, 0));
    // lattice service tower east of the rocket: corner posts, girts, one diagonal per bay
    var tx = 6.6, s = 1.7, th = 26.5, ty = pad, tc = 'red';
    [[-s, -s], [s, -s], [s, s], [-s, s]].forEach(function (c) { p.push(boxAt(0.5, th, 0.5, tc, tx + c[0], ty, c[1])); });
    var bays = 6, bh = th / bays, zF = s + 0.26;
    for (i = 0; i <= bays; i++) p.push(strip([tx - s, ty + i * bh, zF], [tx + s, ty + i * bh, zF], 0.32, tc));
    for (i = 0; i < bays; i++) {
      p.push(strip([tx + (i % 2 ? s : -s), ty + i * bh, zF], [tx + (i % 2 ? -s : s), ty + (i + 1) * bh, zF], 0.26, tc));
    }
    p.push(boxAt(4.4, 0.5, 4.4, 'graphite', tx, ty + th, 0));
    // swing arms reaching the rocket
    p.push(boxAt(tx - s - rx - 1.2, 0.6, 1, 'steel', (tx - s + rx + 1.2) / 2, base + 13.2, 0));
    p.push(boxAt(tx - s - rx - 1.4, 0.6, 1, 'steel', (tx - s + rx + 1.4) / 2, base + 18.6, 0));
    if (!low) {
      // a squat blockhouse on the lot corner
      p.push(paint(mv(LP.prism([[-15.5, 12], [-9.5, 12], [-9.5, 17], [-15.5, 17]], 2.6, 'concrete'), 0, 1.3, 0), function (n) { return n[1] > 0.9 ? 'silver' : null; }));
      p.push(front(-13.6, 0, -12, 1.8, 17.03, 'graphite'));
    }
    return { mesh: M(p), beacon: [tx, ty + th + 0.5, 0],
      shadows: [[oct, pad], [ring(rx, 0, 1.6, 6), base + 23.6], [rect(tx - s, -s, tx + s, s), ty + th]].concat(low ? [] : [[rect(-15.5, 12, -9.5, 17), 2.6]]) };
  }

  function groundStation(L, low) {
    var p = [];
    var ped = 5.4;
    p.push(post(3.3, 2.5, ped, 8, 'concrete', 3, 0, 2));
    p.push(mv(LP.rotate(dishHead({ R: 8.6, elev: 58, axle: 3.6, sides: 10, inner: 'silver', outer: 'steel', yoke: 'graphite', legs: 3, sub: true }), 0, 24, 0), 3, ped, 2));
    p.push(paint(boxAt(6.4, 3.2, 4.6, 'white', -10.5, 0, 9), function (n) { return n[1] > 0.9 ? 'steel' : null; }));
    p.push(front(-11.4, 0, -9.8, 2.2, 9 + 2.3 + 0.03, 'graphite'));
    if (!low) p.push(front(-8.8, 1.2, -7.8, 2.3, 9 + 2.3 + 0.03, 'cell'));
    return { mesh: M(p), shadows: [[ring(3, 2, 3), ped], [ring(4.5, 4.5, 7), 12, true], [rect(-13.7, 6.7, -7.3, 11.3), 3.2]] };
  }

  function genericBuilding(L, low) {
    var F = L.d / 2, zf = F - 2;
    var p = [paint(boxAt(14, 6, 10, 'cream', 0, 0, zf - 5), function (n) { return n[1] > 0.9 ? 'silver' : null; })];
    p.push(front(-1.2, 0, 1.2, 2.6, zf + 0.03, 'graphite'));
    if (!low) p.push(front(-5.6, 2.8, -2.4, 4.4, zf + 0.03, 'cell'), front(2.4, 2.8, 5.6, 4.4, zf + 0.03, 'cell'));
    return { mesh: M(p) };
  }

  var BUILDERS = { briefing: missionControl, orbit: trackingStation, build: workshop, launcher: rocketYard, review: launchPad, ground: groundStation };

  // ------------------------------------------------------------------ the scene
  function neighbours(edges, id) {
    var out = [];
    edges.forEach(function (e) { if (e[0] === id) out.push(e[1]); else if (e[1] === id) out.push(e[0]); });
    return out;
  }

  function rectsHit(list, x, y, pad) {
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (x > r[0] - pad && x < r[2] + pad && y > r[1] - pad && y < r[3] + pad) return true;
    }
    return false;
  }

  function buildBase(opts, low) {
    opts = opts || {};
    if (opts.detail === 'low') low = true;
    else if (opts.detail === 'high') low = false;
    var W = num(opts.width, low ? 168 : 1000), H = num(opts.height, low ? 101 : 600);
    if (!(W > 0) || !(H > 0)) { W = 1000; H = 600; }
    var pitch = clamp(num(opts.pitch, PITCH), 50, 80);
    var places = (Array.isArray(opts.places) && opts.places.length) ? opts.places : DEF_PLACES;
    // copy the nodes into a prototype-free map: only own entries with numeric x and y count
    var srcNodes = (opts.nodes && typeof opts.nodes === 'object') ? opts.nodes : DEF_NODES, nodes = Object.create(null);
    Object.keys(srcNodes).forEach(function (k) {
      var n = srcNodes[k];
      if (n && isFinite(n.x) && isFinite(n.y)) nodes[k] = { x: +n.x, y: +n.y };
    });
    var edges = (Array.isArray(opts.edges) ? opts.edges : DEF_EDGES).filter(function (e) {
      return e && nodes[e[0]] && nodes[e[1]];
    });
    var mp = mapping(W, H, pitch);
    var gb = groundBuilder(mp);
    var solid = [], items = [], lots = [], roads = [], beaconPts = [], counts = {}, i;
    function tally(key, m) { counts[key] = (counts[key] || 0) + LP.count(m); return m; }

    // ground, sea and shore
    gb.rect(-4, -4, MAP_W + 4, MAP_H + 4, 'land', 0);
    var seaX = 184;
    gb.rect(seaX, -4, MAP_W + 4, MAP_H + 4, 'sea', 0.03);
    gb.rect(seaX - 3, -4, seaX, MAP_H + 4, 'sand', 0.03);
    if (!low) {
      [[188, 14, 6], [190, 46, 7], [187, 78, 6], [191, 104, 6]].forEach(function (w) { gb.rect(w[0], w[1], w[0] + w[2], w[1] + 0.8, 'ice', 0.05); });
      // scrub patches (roads and lots are drawn over them)
      var rnd = LP.rng(7);
      for (i = 0; i < 10; i++) {
        var px = 8 + rnd() * 170, py = 6 + rnd() * 108, rr = 5 + rnd() * 6, pts = [], k;
        for (k = 0; k < 7; k++) {
          var ang = k / 7 * Math.PI * 2, q = rr * (0.7 + rnd() * 0.45);
          pts.push([px + Math.cos(ang) * q * 1.3, py + Math.sin(ang) * q * 0.7]);
        }
        gb.poly(pts, 'grass', 0.015);
      }
    }

    // roads along the edges, plus the road out through the gate
    edges.forEach(function (e) {
      var a = nodes[e[0]], b = nodes[e[1]];
      roads.push([a.x, a.y, b.x, b.y]);
    });
    if (nodes.gate) {
      var gn = neighbours(edges, 'gate')[0], ga = nodes.gate, gt = gn ? nodes[gn] : { x: ga.x + 1, y: ga.y };
      var ddx = ga.x - gt.x, ddy = ga.y - gt.y, dl = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      roads.push([ga.x, ga.y, ga.x + ddx / dl * 30, ga.y + ddy / dl * 30]);
    }

    // places: each on a lot behind its door node, away from the road
    var built = Object.create(null);
    function lotFor(id, kind) {
      var n = nodes[id], nb = neighbours(edges, id)[0], dx = 0, dy = n.y < MAP_H / 2 ? -1 : 1;
      if (nb && nodes[nb]) {
        var vx = n.x - nodes[nb].x, vy = n.y - nodes[nb].y, vl = Math.sqrt(vx * vx + vy * vy);
        if (vl > 0) { dx = vx / vl; dy = vy / vl; }
      }
      var spec = has(LOTS, kind) ? LOTS[kind] : LOTS.other;
      var horizontal = Math.abs(dx) > Math.abs(dy);
      var along = horizontal ? spec.w : spec.d, across = horizontal ? spec.d : spec.w;
      var cxm = n.x + dx * (spec.gap + along / 2) + (horizontal ? 0 : spec.dx);
      var cym = n.y + dy * (spec.gap + along / 2);
      var wm = horizontal ? along : across, dm = horizontal ? across : along;
      return { x0: cxm - wm / 2, y0: cym - dm / 2, x1: cxm + wm / 2, y1: cym + dm / 2, cx: mp.X(cxm), cz: mp.Z(cym), w: wm, d: dm * mp.kz, mx: cxm, my: cym };
    }
    function addBuilding(id, kind) {
      var L = lotFor(id, kind), fn = has(BUILDERS, kind) ? BUILDERS[kind] : genericBuilding, out = fn(L, low);
      lots.push([L.x0, L.y0, L.x1, L.y1]);
      gb.rect(L.x0, L.y0, L.x1, L.y1, 'concrete', 0.04);
      solid.push(tally(id, mv(out.mesh, L.cx, 0, L.cz)));
      var F = L.d / 2;
      (out.shadows || []).forEach(function (sp) {
        var poly = clipPoly(shadowPoly(sp), -L.w / 2, -F, L.w / 2, F);
        if (poly.length < 3) return;
        gb.parts.push(tally('shadows', face(poly.map(function (q) { return [L.cx + q[0], 0.05, L.cz + q[1]]; }), 'steel', [0, 1, 0])));
      });
      if (out.rails) {
        out.rails.forEach(function (r) {
          var a = [L.cx + r[0], L.cz + r[1]], b = [L.cx + r[2], L.cz + r[3]];
          gb.parts.push(face([[a[0] - 0.3, 0.07, a[1]], [a[0] + 0.3, 0.07, a[1]], [b[0] + 0.3, 0.07, b[1]], [b[0] - 0.3, 0.07, b[1]]], 'graphite', [0, 1, 0]));
        });
      }
      if (out.dish) {
        var d = out.dish;
        items.push({ mesh: tally(id, d.mesh), pos: [L.cx + d.pos[0], d.pos[1], L.cz + d.pos[2]], rot: [0, d.az, 0], _dish: d });
      }
      if (out.beacon) beaconPts.push([L.cx + out.beacon[0], out.beacon[1], L.cz + out.beacon[2]]);
      built[id] = L;
    }
    places.forEach(function (pl) {
      if (pl && nodes[pl.id] && !built[pl.id]) addBuilding(pl.id, pl.id);
    });
    if (nodes.ground && !built.ground) addBuilding('ground', 'ground');

    // road surfaces (over the lots), lane dashes on the long roads
    roads.forEach(function (r) { gb.seg(r[0], r[1], r[2], r[3], 3.5, 'graphite', 0.06, 3.5); });
    if (!low) {
      roads.forEach(function (r) {
        var dx = r[2] - r[0], dy = r[3] - r[1], l = Math.sqrt(dx * dx + dy * dy);
        if (l < 25) return;
        var ux = dx / l, uy = dy / l, s;
        for (s = 6; s + 3 < l - 5; s += 8) gb.seg(r[0] + ux * s, r[1] + uy * s, r[0] + ux * (s + 3.4), r[1] + uy * (s + 3.4), 0.45, 'cream', 0.08, 0);
      });
    }

    // the main gate: booth, barrier arm and two pillars
    var gateStart = LP.count(M(solid));
    if (nodes.gate) {
      var g = nodes.gate, gx = mp.X(g.x), gz = mp.Z(g.y), rz = 3.5 * mp.kz;
      solid.push(paint(boxAt(5, 3.4, 4.6, 'white', gx - 3, 0, gz - rz - 4.4), function (n) { return n[1] > 0.9 ? 'silver' : null; }));
      solid.push(boxAt(6, 0.45, 5.6, 'red', gx - 3, 3.4, gz - rz - 4.4));
      solid.push(front(gx - 5, 1.5, gx - 1, 2.8, gz - rz - 2.1 + 0.03, 'cell'));
      // the barrier arm across the road, just outside the gate node (the player starts on the node)
      var bx = mp.X(Math.max(g.x - 4, 5));
      solid.push(boxAt(0.7, 1.6, 0.7, 'graphite', bx, 0, gz - rz - 0.9));
      solid.push(boxAt(0.4, 0.4, 2 * rz, 'white', bx, 1.2, gz));
      [-2, 0, 2].forEach(function (k) {   // red bands on the top and both sides of the arm
        var z0 = gz + (k - 0.5) * rz / 3, z1 = gz + (k + 0.5) * rz / 3;
        solid.push(face([[bx - 0.2, 1.62, z0], [bx + 0.2, 1.62, z0], [bx + 0.2, 1.62, z1], [bx - 0.2, 1.62, z1]], 'red', [0, 1, 0]));
        solid.push(face([[bx + 0.22, 1.2, z0], [bx + 0.22, 1.6, z0], [bx + 0.22, 1.6, z1], [bx + 0.22, 1.2, z1]], 'red', [1, 0, 0]));
        solid.push(face([[bx - 0.22, 1.2, z0], [bx - 0.22, 1.6, z0], [bx - 0.22, 1.6, z1], [bx - 0.22, 1.2, z1]], 'red', [-1, 0, 0]));
      });
      if (!low) {
        solid.push(boxAt(1.4, 3.4, 1.4, 'concrete', gx - 6, 0, gz - rz - 1));
        solid.push(boxAt(1.4, 3.4, 1.4, 'concrete', gx - 6, 0, gz + rz + 1));
      }
    }

    counts.gate = LP.count(M(solid)) - gateStart;

    // beacons (blink in update)
    function beaconMesh(on) {
      return M(beaconPts.map(function (b) {
        var m = boxAt(0.9, 0.8, 0.9, 'red', b[0], b[1], b[2]);
        return on ? LP.emit(m) : m;
      }));
    }
    var beaconOn = beaconMesh(true), beaconOff = beaconMesh(false);

    // fence, street lamps and trees (full detail only)
    if (!low) {
      var fy0 = 2.5, fy1 = 117.5, fx0 = 4, fx1 = seaX - 4;
      var gateY0 = nodes.gate ? nodes.gate.y - 6.5 : null, gateY1 = nodes.gate ? nodes.gate.y + 6.5 : null;
      var runs = [[fx0, fy0, fx1, fy0], [fx0, fy1, fx1, fy1]];
      if (nodes.gate) { runs.push([fx0, fy0, fx0, gateY0], [fx0, gateY1, fx0, fy1]); }
      else runs.push([fx0, fy0, fx0, fy1]);
      runs.forEach(function (r) {
        var a = mp.toWorld(r[0], r[1]), b = mp.toWorld(r[2], r[3]), d = sub(b, a), l = vlen(d), nposts = Math.max(1, Math.round(l / 24)), j;
        for (j = 0; j <= nposts; j++) {
          var t = j / nposts;
          solid.push(tally('fence', tube(0.24, 0.2, 0, 2.6, 3, 'steel', -30)));
          solid[solid.length - 1] = mv(solid[solid.length - 1], a[0] + d[0] * t, 0, a[2] + d[2] * t);
        }
        solid.push(tally('fence', rod([a[0], 2.2, a[2]], [b[0], 2.2, b[2]], 0.16, 'steel', 3)));
      });
      // a street lamp beside the middle of each long road, alternating sides
      var nLamp = 0;
      edges.forEach(function (e) {
        var A = nodes[e[0]], B = nodes[e[1]], dx = B.x - A.x, dy = B.y - A.y, l = Math.sqrt(dx * dx + dy * dy);
        if (l < 25) return;
        var side = nLamp++ % 2 ? 5.6 : -5.6, w = mp.toWorld((A.x + B.x) / 2 - dy / l * side, (A.y + B.y) / 2 + dx / l * side);
        solid.push(tally('lamps', mv(tube(0.16, 0.12, 0, 4.2, 3, 'graphite', 30), w[0], 0, w[2])));
        solid.push(tally('lamps', LP.emit(boxAt(1.1, 0.4, 0.6, 'glow', w[0], 4.2, w[2]))));
      });
    }

    var solidMesh = M(solid);
    var groundMesh = M(gb.parts);
    var used = LP.count(solidMesh) + LP.count(groundMesh) + LP.count(beaconOn);
    items.forEach(function (it) { used += LP.count(it.mesh); });

    // groves of pines and bushes in free ground, as many as the triangle budget allows
    if (!low) {
      var keep = lots.slice(), rndT = LP.rng(11), trees = [], budget = TRI_BUDGET - used;
      roads.forEach(function (r) { keep.push([Math.min(r[0], r[2]) - 3.5, Math.min(r[1], r[3]) - 3.5, Math.max(r[0], r[2]) + 3.5, Math.max(r[1], r[3]) + 3.5]); });
      if (nodes.gate) keep.push([nodes.gate.x - 10, nodes.gate.y - 14, nodes.gate.x + 2, nodes.gate.y + 8]);
      places.forEach(function (pl) { var nd = pl && nodes[pl.id]; if (nd) keep.push([nd.x - 17, nd.y - 6, nd.x + 17, nd.y + 9]); });
      var free = function (x, y, pad) {
        if (x < 7 || x > seaX - 7 || y < 6 || y > MAP_H - 4) return false;
        if (rectsHit(keep, x, y, pad)) return false;
        for (var id in nodes) {
          if (Object.prototype.hasOwnProperty.call(nodes, id) && Math.abs(nodes[id].x - x) < 9 && Math.abs(nodes[id].y - y) < 9) return false;
        }
        return true;
      };
      var centres = [], gxp, gyp;
      for (gyp = 8; gyp < 116; gyp += 11) {
        for (gxp = 10; gxp < seaX - 8; gxp += 12) {
          var jx = gxp + (rndT() - 0.5) * 7, jy = gyp + (rndT() - 0.5) * 6;
          if (free(jx, jy, 4)) centres.push([jx, jy, rndT()]);
        }
      }
      centres.sort(function (a, b) { return a[2] - b[2]; });
      var placed = [];
      for (i = 0; i < centres.length && budget > 20; i++) {
        var cc = centres[i], nIn = 2 + Math.floor(cc[2] * 3 * 7) % 3, k2;
        for (k2 = 0; k2 < nIn && budget > 20; k2++) {
          var ang2 = (k2 / nIn + cc[2]) * Math.PI * 2, rad = k2 ? 3.6 : 0;
          var tx2 = cc[0] + Math.cos(ang2) * rad * 1.2, ty2 = cc[1] + Math.sin(ang2) * rad * 0.8;
          if (!free(tx2, ty2, 2)) continue;
          var clash = false;
          placed.forEach(function (q) { if (Math.abs(q[0] - tx2) < 3 && Math.abs(q[1] - ty2) < 2.2) clash = true; });
          if (clash) continue;
          var w = mp.toWorld(tx2, ty2), sz = rndT(), m;
          if ((i + k2) % 3) m = pine(6.4 + sz * 2.6, 2.1 + sz * 0.6);
          else m = bush(2.0 + sz * 0.8, 3 + i * 7 + k2);
          if (LP.count(m) > budget) break;
          budget -= LP.count(m);
          placed.push([tx2, ty2]);
          trees.push(tally('trees', mv(m, w[0], 0, w[2])));
        }
      }
      if (trees.length) { solidMesh = M([solidMesh].concat(trees)); }
    }

    var lotInfo = {};
    Object.keys(built).forEach(function (id) {
      var L = built[id];
      if (!L || L.cx === undefined) return;
      lotInfo[id] = { rect: [L.x0, L.y0, L.x1, L.y1], center: [L.mx, L.my], world: [L.cx, 0, L.cz] };
    });
    var beaconItem = { mesh: beaconOn };
    var allItems = [{ mesh: groundMesh }, { mesh: solidMesh }].concat(items).concat(beaconPts.length ? [beaconItem] : []);
    var tris = 0;
    allItems.forEach(function (it) { tris += LP.count(it.mesh); });
    counts.ground = LP.count(groundMesh) - (counts.shadows || 0);
    counts.beacons = LP.count(beaconOn);
    counts.total = tris;
    var label = low
      ? 'Minimap of the space centre'
      : 'The space centre in low-poly 3D: Mission Control, the Tracking Station, the Workshop, the Rocket Yard and the Launch Pad, joined by roads, with the main gate in the west and the sea in the east';
    var scene = {
      items: allItems.map(function (it) { var o = { mesh: it.mesh }; if (it.pos) o.pos = it.pos; if (it.rot) o.rot = it.rot; return o; }),
      camera: mp.camera(),
      light: { dir: LIGHT.dir.slice(), key: LIGHT.key, ambient: LIGHT.ambient, steps: LIGHT.steps },
      background: { color: 'land', stars: false },
      label: label
    };
    var dishIdx = [], it2;
    for (i = 0; i < allItems.length; i++) { it2 = allItems[i]; if (it2._dish) dishIdx.push([scene.items[i], it2._dish]); }
    var beaconSceneItem = beaconPts.length ? scene.items[scene.items.length - 1] : null;
    var animate = opts.animate !== false && !low;
    var mql = null;
    try { mql = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null; } catch (e) { mql = null; }
    var lastOn = true;

    function update(t) {
      if (!animate || (mql && mql.matches)) return false;
      var changed = false;
      t = num(t, 0);
      dishIdx.forEach(function (pair) {
        var d = pair[1], az = d.az + Math.round(d.swing * Math.sin(t * 2 * Math.PI / 36) * 2) / 2;
        if (pair[0].rot[1] !== az) { pair[0].rot = [0, az, 0]; changed = true; }
      });
      var on = (t % 2) < 1.1;
      if (beaconSceneItem && on !== lastOn) { beaconSceneItem.mesh = on ? beaconOn : beaconOff; lastOn = on; changed = true; }
      return changed;
    }

    return {
      scene: scene,
      update: update,
      label: label,
      project: mp.project,
      projectPct: mp.projectPct,
      toWorld: mp.toWorld,
      width: W, height: H, aspect: W / H, pitch: pitch, tris: tris, counts: counts,
      lots: lotInfo,
      walker: walkerSprite(pitch)
    };
  }

  // ------------------------------------------------------------------ the walker
  // A small faceted astronaut-engineer: white suit, orange high-visibility bands, gold visor.
  // Feet at the origin, standing along +Y, facing +Z. opts.stride (-1..1) swings arms and legs.
  function walkerMesh(o) {
    o = o || {};
    var s = clamp(num(o.stride, 0), -1, 1), suit = o.suit || 'white', acc = o.accent || 'orange', dark = 'graphite';
    var legSwing = 26 * s, armSwing = -22 * s, hip = 0.72, sh = 1.16, hs = 1.28;
    function leg(side, ang) {
      var m = M([
        LP.rotate(tube(0.105, 0.12, 0.12, hip, 4, suit), 0, 45, 0),
        boxAt(0.22, 0.15, 0.32, dark, 0, 0, 0.04)
      ]);
      return mv(LP.rotate(mv(m, 0, -hip, 0), ang, 0, 0), side * 0.12, hip, 0);
    }
    function arm(side, ang) {
      var m = LP.rotate(M([
        LP.lathe([[0.09, 0], [0.075, 0.36]], 4, suit),
        LP.lathe([[0.075, 0.36], [0.088, 0.52]], 4, acc)
      ]), 180, 45, 0);
      return mv(LP.rotate(m, ang, 0, side * 9), side * 0.32, sh, 0);
    }
    var torso = M([
      LP.lathe([[0.21, hip - 0.06], [0.225, hip + 0.06]], 6, dark),
      LP.lathe([[0.225, hip + 0.06], [0.265, sh + 0.02]], 6, suit),
      LP.lathe([[0.265, sh + 0.02], [0.13, sh + 0.1]], 6, suit)
    ]);
    // a big helmet (it carries the read at 40 px): six facets round, the three facing forward
    // carry the gold visor
    var prof = [[0, -0.02], [0.17, 0.02], [0.225, 0.16], [0.21, 0.3], [0.11, 0.39], [0, 0.42]].map(function (q) { return [q[0] * hs, q[1] * hs]; });
    var helmet = paint(LP.lathe(prof, 6, suit), function (n, c) {
      return (n[2] > 0.4 && c[1] > 0.05 * hs && c[1] < 0.33 * hs) ? 'gold' : null;
    });
    return M([
      leg(-1, legSwing), leg(1, -legSwing),
      torso,
      boxAt(0.2, 0.15, 0.08, acc, 0, 0.9, 0.22),
      boxAt(0.4, 0.46, 0.18, 'silver', 0, 0.74, -0.29),
      boxAt(0.42, 0.08, 0.2, acc, 0, 1.13, -0.29),
      arm(-1, armSwing), arm(1, -armSwing),
      mv(helmet, 0, sh + 0.04, 0)
    ]);
  }

  LP.models.person.walker = function (opts) {
    var mesh = walkerMesh(opts);
    return { mesh: mesh, size: LP.bounds(mesh).size, label: 'The player: an astronaut-engineer in a white suit with orange bands and a gold visor' };
  };

  // The walker as a sprite for its own small canvas, drawn with the base map's camera tilt.
  // scene(face, stride): face is the DOM's --face angle (0 north / up the map, 90 east, 180 south,
  // -90 west). Size the canvas cssHeight x round(cssHeight * aspect) CSS px and put its pixel
  // (anchor[0] * width, anchor[1] * height) on project(x, y) (the feet stand there).
  var spriteCache = {};
  function walkerSprite(pitch) {
    if (spriteCache[pitch]) return spriteCache[pitch];
    var p = pitch * DEG, cp = Math.cos(p), sp = Math.sin(p);
    var ymin = Infinity, ymax = -Infinity, xmax = 0;
    [0, 90, 180, 270].forEach(function (ry) {
      [-1, 0, 1].forEach(function (s) {
        var m = LP.rotate(walkerMesh({ stride: s }), 0, ry, 0);
        m.tris.forEach(function (t) {
          t.v.forEach(function (v) {
            var yv = v[1] * cp - v[2] * sp;
            if (yv < ymin) ymin = yv;
            if (yv > ymax) ymax = yv;
            if (Math.abs(v[0]) > xmax) xmax = Math.abs(v[0]);
          });
        });
      });
    });
    var size = (ymax - ymin) * 1.1, aspect = (2 * xmax * 1.1) / size, ty = (ymax + ymin) / 2 / cp;
    var out = {
      aspect: aspect,
      anchor: [0.5, 0.5 + (ymax + ymin) / 2 / size],
      cssHeight: 44,
      scene: function (faceDeg, stride) {
        var ry = 180 - num(faceDeg, 180);
        return {
          items: [{ mesh: walkerMesh({ stride: stride }), rot: [0, ry, 0] }],
          camera: { ortho: true, yaw: 0, pitch: pitch, size: size, dist: 20, target: [0, ty, 0] },
          light: { dir: LIGHT.dir.slice(), key: LIGHT.key, ambient: LIGHT.ambient, steps: LIGHT.steps },
          background: null,
          label: 'You, the astronaut-engineer'
        };
      }
    };
    spriteCache[pitch] = out;
    return out;
  }

  LP.scenes.base = function (opts) { return buildBase(opts, false); };
  LP.scenes.minimap = function (opts) { return buildBase(opts, true); };
})(typeof window !== 'undefined' ? window : this);
