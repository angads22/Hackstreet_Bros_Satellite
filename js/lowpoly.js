/*
 * lowpoly.js - a small software 3D renderer for flat-shaded "PS3 low poly" models.
 *
 * One global only: LowPoly. Plain ES5, no import, no fetch, no libraries.
 * Other files add to LowPoly.models and LowPoly.scenes and create no globals.
 * Full reference: API.md next to this folder.
 *
 * How it draws: every frame the triangles are transformed, back faces are culled,
 * each face is lit once (flat shading), then filled into a colour buffer with a
 * depth buffer (so meshes that cut through each other are correct). If the pixel
 * budget allows, the frame is drawn 2x or 3x larger and averaged down, which keeps
 * edges crisp. The result goes to the canvas with putImageData, so the output is
 * identical on every machine.
 */
(function (root) {
  'use strict';

  var LowPoly = {};
  LowPoly.version = '1.0';

  // ---------------------------------------------------------------------------
  // Tunable numbers
  // ---------------------------------------------------------------------------
  var DEG = Math.PI / 180;
  var BUDGET = 600000;       // canvas backing store never exceeds about this many pixels
  var SS_LIMIT = 1000000;    // supersampled internal buffer never exceeds about this many pixels
  var MAX_DPR = 2;           // device pixel ratio is capped here
  var DEPTH_BIAS = 3e-5;     // relative depth tolerance: later coplanar faces (decals) win ties
  var HEMI = 0.25;           // faces looking up get a bit more ambient, faces looking down less
  var DRAG_DEG_PER_PX = 0.45;
  var KEY_STEP_DEG = 6;
  var TOUCH_SLOP = 8;        // pixels a finger must travel before we decide between turning and page scroll
  var LITTLE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  var SR = LITTLE ? 0 : 24, SG = LITTLE ? 8 : 16, SB = LITTLE ? 16 : 8, SA = LITTLE ? 24 : 0;

  // ---------------------------------------------------------------------------
  // Palette: names are fixed, hex values are the defaults.
  // Each one can be overridden by the CSS custom property --lp-<name>.
  // ---------------------------------------------------------------------------
  var palette = {
    white: '#e6e4dc', cream: '#d8cba8', silver: '#aeb4ba', steel: '#7d8791',
    graphite: '#444a52', black: '#1c1f24',
    gold: '#c79a3e', copper: '#b1704a',
    cell: '#22365a', cellEdge: '#4d6a92',
    red: '#b24231', orange: '#cc7a2e', yellow: '#d1ac3a', teal: '#2e8a86', green: '#5a8a4c',
    glow: '#f6c775', glowCool: '#9fd6ec',
    sea: '#2b5f8a', land: '#70854f', sand: '#c3a874', ice: '#dde8ee', cloud: '#f2f4f5',
    skin1: '#e2b595', skin2: '#b9825a', skin3: '#7b4f34',
    hair1: '#2b2119', hair2: '#7d5230', hair3: '#b9a57c',
    shirt1: '#587a9a', shirt2: '#6b8a6a', shirt3: '#9c8366', tie: '#8b3030',
    ground: '#6c6a5f', concrete: '#9b9a92', grass: '#5d7a40', metalDark: '#555c65',
    sky: '#8db3cf', space: '#0b0f16', star: '#e3e8ee'
  };
  LowPoly.palette = palette;

  var DEFAULT_LIGHT = { dir: [-0.45, 0.8, 0.6], key: '#c0b498', ambient: '#5f6d85', steps: 0 };
  LowPoly.defaults = { fov: 35, yaw: 25, pitch: 15, light: DEFAULT_LIGHT };

  var warned = {};
  function warnOnce(msg) {
    if (warned[msg]) return;
    warned[msg] = true;
    try { if (root.console && root.console.warn) root.console.warn('LowPoly: ' + msg); } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------
  function num(v, d) { return (typeof v === 'number' && v === v) ? v : d; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function now() { return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }
  var imul = Math.imul || function (a, b) {
    var ah = (a >>> 16) & 0xffff, al = a & 0xffff, bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
    return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0) | 0);
  };

  // Seeded random numbers (mulberry32). rng(seed) returns a function giving [0,1).
  function rng(seed) {
    var a = (seed | 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = imul(a ^ (a >>> 15), 1 | a);
      t = (t + imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  LowPoly.rng = rng;

  // Colour text -> [r,g,b] (0..255) or null. Accepts #rgb, #rrggbb, rgb(), rgba().
  function parseColor(s) {
    if (typeof s !== 'string') return null;
    s = s.replace(/^\s+|\s+$/g, '');
    var m;
    if ((m = /^#([0-9a-f]{6})$/i.exec(s))) {
      var n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    if ((m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s))) {
      return [parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16), parseInt(m[3] + m[3], 16)];
    }
    if ((m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s))) {
      return [clamp(Math.round(+m[1]), 0, 255), clamp(Math.round(+m[2]), 0, 255), clamp(Math.round(+m[3]), 0, 255)];
    }
    return null;
  }

  var probeCtx = null;
  function parseAnyColor(s) {
    var c = parseColor(s);
    if (c) return c;
    // Other CSS colour words: let the browser normalise them.
    try {
      if (!probeCtx && root.document) probeCtx = root.document.createElement('canvas').getContext('2d');
      if (probeCtx) {
        // an invalid colour leaves fillStyle unchanged, so try two different starting points
        probeCtx.fillStyle = '#010203';
        probeCtx.fillStyle = s;
        var v1 = probeCtx.fillStyle;
        probeCtx.fillStyle = '#040506';
        probeCtx.fillStyle = s;
        var v2 = probeCtx.fillStyle;
        return v1 === v2 ? parseColor(v1) : null;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function hex2(n) { n = clamp(Math.round(n), 0, 255); return (n < 16 ? '0' : '') + n.toString(16); }
  function toHex(rgb) { return '#' + hex2(rgb[0]) + hex2(rgb[1]) + hex2(rgb[2]); }

  // Returns a function name -> [r,g,b] that honours --lp-<name> custom properties.
  function makeResolver(el) {
    var cs = null, cache = {};
    try {
      var target = (el && el.isConnected) ? el : (root.document && root.document.documentElement);
      if (target && root.getComputedStyle) cs = root.getComputedStyle(target);
    } catch (e) { cs = null; }
    var resolve = function (name) {
      var hit = cache[name];
      if (hit) return hit;
      var rgb = null;
      if (typeof name === 'string') {
        if (name.charAt(0) === '#') rgb = parseColor(name);
        else {
          if (cs) {
            var raw = cs.getPropertyValue('--lp-' + name);
            if (raw) rgb = parseAnyColor(raw);
          }
          if (!rgb && palette.hasOwnProperty(name)) rgb = parseColor(palette[name]);
        }
      }
      if (!rgb) {
        warnOnce('unknown colour "' + name + '", using steel');
        rgb = parseColor(palette.steel);
      }
      cache[name] = rgb;
      return rgb;
    };
    // An optional page-wide CSS colour (--lp-light-key, --lp-light-ambient): [r,g,b] or null when the page does not set it.
    resolve.page = function (prop) {
      try { var raw = cs ? String(cs.getPropertyValue(prop)).replace(/^\s+|\s+$/g, '') : ''; return raw ? parseAnyColor(raw) : null; }
      catch (e) { return null; }
    };
    return resolve;
  }

  // The final #rrggbb for a palette name, including any --lp-<name> override on el (default: the page).
  LowPoly.colorOf = function (name, el) {
    return toHex(makeResolver(el || null)(name));
  };

  // ---------------------------------------------------------------------------
  // Meshes: plain data {tris:[{v:[[x,y,z],[x,y,z],[x,y,z]], c:"name", e:0|1}]}
  // Counter-clockwise (seen from outside) is the front face.
  // ---------------------------------------------------------------------------
  function mkTri(a, b, c, col, e) {
    return { v: [[a[0], a[1], a[2]], [b[0], b[1], b[2]], [c[0], c[1], c[2]]], c: col, e: e ? 1 : 0 };
  }
  function mesh(tris) { return { tris: tris }; }
  function colOr(c, d) { return (typeof c === 'string' && c) ? c : d; }

  // quad p0,p1,p2,p3 counter-clockwise seen from the front
  function pushQuad(out, p0, p1, p2, p3, col) {
    out.push(mkTri(p0, p1, p2, col, 0));
    out.push(mkTri(p0, p2, p3, col, 0));
  }

  function box(w, h, d, c) {
    w = num(w, 1); h = num(h, 1); d = num(d, 1); c = colOr(c, 'silver');
    var x = w / 2, y = h / 2, z = d / 2, t = [];
    pushQuad(t, [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], c);         // +Z
    pushQuad(t, [x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], c);     // -Z
    pushQuad(t, [x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], c);         // +X
    pushQuad(t, [-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], c);     // -X
    pushQuad(t, [-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], c);         // +Y
    pushQuad(t, [-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], c);     // -Y
    return mesh(t);
  }

  // Ring point at angle a (radians), counter-clockwise seen from above (+Y).
  function ringPt(r, y, a) { return [r * Math.cos(a), y, -r * Math.sin(a)]; }

  function cylinder(rTop, rBottom, h, sides, c, o) {
    rTop = Math.max(0, num(rTop, 0.5)); rBottom = Math.max(0, num(rBottom, 0.5)); h = num(h, 1);
    sides = Math.max(3, Math.round(num(sides, 8))); c = colOr(c, 'silver');
    o = o || {};
    var capTop = o.capTop !== false, capBottom = o.capBottom !== false;
    var phase = num(o.phase, 0) * DEG;
    var yt = h / 2, yb = -h / 2, t = [], i;
    var eps = 1e-9;
    for (i = 0; i < sides; i++) {
      var a0 = phase + 2 * Math.PI * i / sides, a1 = phase + 2 * Math.PI * (i + 1) / sides;
      var b0 = ringPt(rBottom, yb, a0), b1 = ringPt(rBottom, yb, a1);
      var t0 = ringPt(rTop, yt, a0), t1 = ringPt(rTop, yt, a1);
      if (rBottom < eps && rTop < eps) continue;
      if (rBottom < eps) t.push(mkTri(b0, t1, t0, c, 0));
      else if (rTop < eps) t.push(mkTri(b0, b1, t0, c, 0));
      else { t.push(mkTri(b0, b1, t1, c, 0)); t.push(mkTri(b0, t1, t0, c, 0)); }
      if (capTop && rTop >= eps) t.push(mkTri([0, yt, 0], t0, t1, c, 0));
      if (capBottom && rBottom >= eps) t.push(mkTri([0, yb, 0], b1, b0, c, 0));
    }
    return mesh(t);
  }

  function cone(r, h, sides, c) { return cylinder(0, num(r, 0.5), num(h, 1), sides, c, {}); }

  // Flat polygon in the XZ plane at y=0, facing +Y (and -Y too if doubleSided).
  function disc(r, sides, c, doubleSided) {
    r = num(r, 1); sides = Math.max(3, Math.round(num(sides, 12))); c = colOr(c, 'silver');
    var t = [], i;
    for (i = 0; i < sides; i++) {
      var a0 = 2 * Math.PI * i / sides, a1 = 2 * Math.PI * (i + 1) / sides;
      var p0 = ringPt(r, 0, a0), p1 = ringPt(r, 0, a1);
      t.push(mkTri([0, 0, 0], p0, p1, c, 0));
      if (doubleSided) t.push(mkTri([0, 0, 0], p1, p0, c, 0));
    }
    return mesh(t);
  }

  // Icosphere with a vertex on each pole. detail 0..3 gives 20, 80, 320, 1280 triangles.
  function sphere(r, detail, c) {
    r = num(r, 1); c = colOr(c, 'silver');
    detail = clamp(Math.round(num(detail, 1)), 0, 3);
    var s5 = Math.sqrt(5), hgt = 1 / s5, rad = 2 / s5, V = [[0, 1, 0]], i;
    for (i = 0; i < 5; i++) V.push([rad * Math.cos(i * 2 * Math.PI / 5), hgt, -rad * Math.sin(i * 2 * Math.PI / 5)]);
    for (i = 0; i < 5; i++) V.push([rad * Math.cos((i + 0.5) * 2 * Math.PI / 5), -hgt, -rad * Math.sin((i + 0.5) * 2 * Math.PI / 5)]);
    V.push([0, -1, 0]);
    var F = [];
    for (i = 0; i < 5; i++) {
      var j = (i + 1) % 5;
      F.push([0, 1 + i, 1 + j]);              // top cap
      F.push([1 + i, 6 + i, 1 + j]);          // upper band, point down
      F.push([6 + i, 6 + j, 1 + j]);          // lower band, point up
      F.push([11, 6 + j, 6 + i]);             // bottom cap
    }
    var level, k;
    for (level = 0; level < detail; level++) {
      var cache = {}, G = [];
      var mid = function (a, b) {
        var key = a < b ? a * 100000 + b : b * 100000 + a;
        if (cache[key] !== undefined) return cache[key];
        var p = [(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2, (V[a][2] + V[b][2]) / 2];
        var l = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
        V.push([p[0] / l, p[1] / l, p[2] / l]);
        cache[key] = V.length - 1;
        return cache[key];
      };
      for (k = 0; k < F.length; k++) {
        var a = F[k][0], b = F[k][1], cc = F[k][2];
        var ab = mid(a, b), bc = mid(b, cc), ca = mid(cc, a);
        G.push([a, ab, ca], [b, bc, ab], [cc, ca, bc], [ab, bc, ca]);
      }
      F = G;
    }
    var t = [];
    for (k = 0; k < F.length; k++) {
      var p0 = V[F[k][0]], p1 = V[F[k][1]], p2 = V[F[k][2]];
      // make sure it faces outward (the icosphere is convex around the origin)
      var nx = (p1[1] - p0[1]) * (p2[2] - p0[2]) - (p1[2] - p0[2]) * (p2[1] - p0[1]);
      var ny = (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]);
      var nz = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
      if (nx * (p0[0] + p1[0] + p2[0]) + ny * (p0[1] + p1[1] + p2[1]) + nz * (p0[2] + p1[2] + p2[2]) < 0) { var sw = p1; p1 = p2; p2 = sw; }
      t.push(mkTri([p0[0] * r, p0[1] * r, p0[2] * r], [p1[0] * r, p1[1] * r, p1[2] * r], [p2[0] * r, p2[1] * r, p2[2] * r], c, 0));
    }
    return mesh(t);
  }

  // Ear clipping for a simple polygon. q = [[x,y],...] counter-clockwise (y up). Returns index triples.
  function earClip(q) {
    var idx = [], out = [], i, n = q.length;
    for (i = 0; i < n; i++) idx.push(i);
    var guard = n * n + 10;
    function inTri(p, a, b, c) {
      var d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      var d2 = (c[0] - b[0]) * (p[1] - b[1]) - (c[1] - b[1]) * (p[0] - b[0]);
      var d3 = (a[0] - c[0]) * (p[1] - c[1]) - (a[1] - c[1]) * (p[0] - c[0]);
      return d1 >= -1e-12 && d2 >= -1e-12 && d3 >= -1e-12;
    }
    while (idx.length > 3 && guard-- > 0) {
      var found = false, m = idx.length;
      for (i = 0; i < m; i++) {
        var ia = idx[(i + m - 1) % m], ib = idx[i], ic = idx[(i + 1) % m];
        var a = q[ia], b = q[ib], c = q[ic];
        var cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        if (cr <= 1e-12) continue;
        var ok = true;
        for (var j = 0; j < m; j++) {
          var kk = idx[j];
          if (kk === ia || kk === ib || kk === ic) continue;
          var pk = q[kk];
          if ((pk[0] === a[0] && pk[1] === a[1]) || (pk[0] === b[0] && pk[1] === b[1]) || (pk[0] === c[0] && pk[1] === c[1])) continue;
          if (inTri(pk, a, b, c)) { ok = false; break; }
        }
        if (!ok) continue;
        out.push([ia, ib, ic]);
        idx.splice(i, 1);
        found = true;
        break;
      }
      if (!found) break;
    }
    if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
    else if (idx.length > 3) for (i = 1; i < idx.length - 1; i++) out.push([idx[0], idx[i], idx[i + 1]]);
    return out;
  }

  // Extrude a polygon given as [[x,z],...] (XZ plane) along Y, centred on y=0 (from -h/2 to +h/2).
  function prism(points, h, c) {
    h = num(h, 1); c = colOr(c, 'silver');
    var P = [], i;
    if (!points || points.length < 3) return mesh([]);
    for (i = 0; i < points.length; i++) {
      var p = points[i];
      var x = p.length !== undefined ? p[0] : p.x, z = p.length !== undefined ? p[1] : p.z;
      if (P.length && P[P.length - 1][0] === x && P[P.length - 1][1] === z) continue;
      P.push([x, z]);
    }
    if (P.length > 1 && P[0][0] === P[P.length - 1][0] && P[0][1] === P[P.length - 1][1]) P.pop();
    var n = P.length;
    if (n < 3) return mesh([]);
    // counter-clockwise seen from above means counter-clockwise in (x,-z)
    var area = 0;
    for (i = 0; i < n; i++) { var A = P[i], B = P[(i + 1) % n]; area += A[0] * (-B[1]) - B[0] * (-A[1]); }
    if (area < 0) P.reverse();
    var yt = h / 2, yb = -h / 2, t = [];
    for (i = 0; i < n; i++) {
      var a = P[i], b = P[(i + 1) % n];
      pushQuad(t, [a[0], yb, a[1]], [b[0], yb, b[1]], [b[0], yt, b[1]], [a[0], yt, a[1]], c);
    }
    var q = [];
    for (i = 0; i < n; i++) q.push([P[i][0], -P[i][1]]);
    var cap = earClip(q);
    for (i = 0; i < cap.length; i++) {
      var u = P[cap[i][0]], v = P[cap[i][1]], w = P[cap[i][2]];
      t.push(mkTri([u[0], yt, u[1]], [v[0], yt, v[1]], [w[0], yt, w[1]], c, 0));
      t.push(mkTri([u[0], yb, u[1]], [w[0], yb, w[1]], [v[0], yb, v[1]], c, 0));
    }
    return mesh(t);
  }

  function quad(p0, p1, p2, p3, c, doubleSided) {
    c = colOr(c, 'silver');
    var t = [];
    pushQuad(t, p0, p1, p2, p3, c);
    if (doubleSided) pushQuad(t, p0, p3, p2, p1, c);
    return mesh(t);
  }

  // Donut in the XZ plane (axis Y): big radius R, tube radius r.
  function torus(R, r, segments, sides, c) {
    R = num(R, 1); r = num(r, 0.25); c = colOr(c, 'silver');
    segments = Math.max(3, Math.round(num(segments, 12))); sides = Math.max(3, Math.round(num(sides, 6)));
    var t = [], i, j;
    function P(si, sj) {
      var u = 2 * Math.PI * (si % segments) / segments, v = 2 * Math.PI * (sj % sides) / sides;
      var rr = R + r * Math.cos(v);
      return [rr * Math.cos(u), r * Math.sin(v), -rr * Math.sin(u)];
    }
    for (i = 0; i < segments; i++) {
      for (j = 0; j < sides; j++) {
        var p00 = P(i, j), p10 = P(i + 1, j), p11 = P(i + 1, j + 1), p01 = P(i, j + 1);
        t.push(mkTri(p00, p10, p11, c, 0));
        t.push(mkTri(p00, p11, p01, c, 0));
      }
    }
    return mesh(t);
  }

  // Revolve a profile [[radius,y],...] around the Y axis. Walk the profile bottom to top and the
  // faces point away from the axis. doubleSided makes a thin shell visible from both sides.
  function lathe(profile, sides, c, doubleSided) {
    c = colOr(c, 'silver');
    sides = Math.max(3, Math.round(num(sides, 10)));
    var t = [], i, k, eps = 1e-9;
    if (!profile || profile.length < 2) return mesh(t);
    for (k = 0; k < profile.length - 1; k++) {
      var r0 = Math.max(0, profile[k][0]), y0 = profile[k][1], r1 = Math.max(0, profile[k + 1][0]), y1 = profile[k + 1][1];
      for (i = 0; i < sides; i++) {
        var a0 = 2 * Math.PI * i / sides, a1 = 2 * Math.PI * (i + 1) / sides;
        var b0 = ringPt(r0, y0, a0), b1 = ringPt(r0, y0, a1), t0 = ringPt(r1, y1, a0), t1 = ringPt(r1, y1, a1);
        if (r0 < eps && r1 < eps) continue;
        if (r0 < eps) { t.push(mkTri(b0, t1, t0, c, 0)); if (doubleSided) t.push(mkTri(b0, t0, t1, c, 0)); }
        else if (r1 < eps) { t.push(mkTri(b0, b1, t0, c, 0)); if (doubleSided) t.push(mkTri(b0, t0, b1, c, 0)); }
        else {
          t.push(mkTri(b0, b1, t1, c, 0)); t.push(mkTri(b0, t1, t0, c, 0));
          if (doubleSided) { t.push(mkTri(b0, t1, b1, c, 0)); t.push(mkTri(b0, t0, t1, c, 0)); }
        }
      }
    }
    return mesh(t);
  }

  // --- transforms (never mutate; always return a new mesh) ---

  function copyTri(T) {
    return { v: [[T.v[0][0], T.v[0][1], T.v[0][2]], [T.v[1][0], T.v[1][1], T.v[1][2]], [T.v[2][0], T.v[2][1], T.v[2][2]]], c: T.c, e: T.e ? 1 : 0 };
  }
  function merge(list) {
    var t = [], i, j;
    if (!list) return mesh(t);
    for (i = 0; i < list.length; i++) {
      var m = list[i];
      if (!m || !m.tris) continue;
      for (j = 0; j < m.tris.length; j++) t.push(copyTri(m.tris[j]));
    }
    return mesh(t);
  }
  function mapVerts(m, fn, flip) {
    var t = [], i, k;
    for (i = 0; i < m.tris.length; i++) {
      var T = m.tris[i], v = [];
      for (k = 0; k < 3; k++) v.push(fn(T.v[k][0], T.v[k][1], T.v[k][2]));
      if (flip) { var s = v[1]; v[1] = v[2]; v[2] = s; }
      t.push({ v: v, c: T.c, e: T.e ? 1 : 0 });
    }
    return mesh(t);
  }
  function move(m, x, y, z) {
    x = num(x, 0); y = num(y, 0); z = num(z, 0);
    return mapVerts(m, function (a, b, c) { return [a + x, b + y, c + z]; }, false);
  }
  // Rotation matrix (row-major, 9 numbers): about X, then Y, then Z, all about fixed world axes
  // (v' = Rz * Ry * Rx * v). Angles in degrees, right-handed.
  function rotMat(rx, ry, rz) {
    var ax = rx * DEG, ay = ry * DEG, az = rz * DEG;
    var cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), cz = Math.cos(az), sz = Math.sin(az);
    return [
      cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
      sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
      -sy, cy * sx, cy * cx
    ];
  }
  function applyMat(R, x, y, z) {
    return [R[0] * x + R[1] * y + R[2] * z, R[3] * x + R[4] * y + R[5] * z, R[6] * x + R[7] * y + R[8] * z];
  }
  function rotate(m, rx, ry, rz) {
    var R = rotMat(num(rx, 0), num(ry, 0), num(rz, 0));
    return mapVerts(m, function (a, b, c) { return applyMat(R, a, b, c); }, false);
  }
  function scale(m, sx, sy, sz) {
    sx = num(sx, 1);
    sy = (sy === undefined) ? sx : num(sy, 1);
    sz = (sz === undefined) ? sx : num(sz, 1);
    var flip = (sx * sy * sz) < 0;
    return mapVerts(m, function (a, b, c) { return [a * sx, b * sy, c * sz]; }, flip);
  }
  function mirror(m, axis) {
    axis = axis || 'x';
    return scale(m, axis === 'x' ? -1 : 1, axis === 'y' ? -1 : 1, axis === 'z' ? -1 : 1);
  }
  function recolor(m, c) {
    var t = [], i;
    for (i = 0; i < m.tris.length; i++) { var T = copyTri(m.tris[i]); T.c = c; t.push(T); }
    return mesh(t);
  }
  function emit(m, on) {
    var t = [], i, e = (on === false) ? 0 : 1;
    for (i = 0; i < m.tris.length; i++) { var T = copyTri(m.tris[i]); T.e = e; t.push(T); }
    return mesh(t);
  }
  function bounds(m) {
    var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity], i, k, any = false;
    if (m && m.tris) {
      for (i = 0; i < m.tris.length; i++) {
        for (k = 0; k < 3; k++) {
          var p = m.tris[i].v[k];
          any = true;
          if (p[0] < mn[0]) mn[0] = p[0]; if (p[1] < mn[1]) mn[1] = p[1]; if (p[2] < mn[2]) mn[2] = p[2];
          if (p[0] > mx[0]) mx[0] = p[0]; if (p[1] > mx[1]) mx[1] = p[1]; if (p[2] > mx[2]) mx[2] = p[2];
        }
      }
    }
    if (!any) { mn = [0, 0, 0]; mx = [0, 0, 0]; }
    return { min: mn, max: mx, size: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]], center: [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2] };
  }
  function count(m) { return (m && m.tris) ? m.tris.length : 0; }
  // Lowest point to y=0 (a part standing on its attachment point).
  function base(m) { var b = bounds(m); return move(m, 0, -b.min[1], 0); }
  // Bounding-box centre to the origin.
  function center(m) { var b = bounds(m); return move(m, -b.center[0], -b.center[1], -b.center[2]); }

  // Take a part authored pointing along +Y and make it point along `normal`, spin it `roll` degrees
  // about that normal, then move it to `pos`. normal exactly -Y turns the part 180 degrees about Z.
  function place(m, o) {
    o = o || {};
    var pos = o.pos || [0, 0, 0], n = o.normal || [0, 1, 0], roll = num(o.roll, 0);
    var nx = num(n[0], 0), ny = num(n[1], 1), nz = num(n[2], 0);
    var len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (!(len > 1e-12)) { nx = 0; ny = 1; nz = 0; len = 1; }
    nx /= len; ny /= len; nz /= len;
    // R1 takes (0,1,0) to n. k = up x n = (nz, 0, -nx).
    var kx = nz, kz = -nx, s2 = kx * kx + kz * kz, R1;
    if (s2 < 1e-16) {
      R1 = ny > 0 ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : [-1, 0, 0, 0, -1, 0, 0, 0, 1];
    } else {
      var f = (1 - ny) / s2;
      // I + K + K^2 * f with K = [k]x, k = (kx, 0, kz)
      var K = [0, -kz, 0, kz, 0, -kx, 0, kx, 0];
      var K2 = [
        K[0] * K[0] + K[1] * K[3] + K[2] * K[6], K[0] * K[1] + K[1] * K[4] + K[2] * K[7], K[0] * K[2] + K[1] * K[5] + K[2] * K[8],
        K[3] * K[0] + K[4] * K[3] + K[5] * K[6], K[3] * K[1] + K[4] * K[4] + K[5] * K[7], K[3] * K[2] + K[4] * K[5] + K[5] * K[8],
        K[6] * K[0] + K[7] * K[3] + K[8] * K[6], K[6] * K[1] + K[7] * K[4] + K[8] * K[7], K[6] * K[2] + K[7] * K[5] + K[8] * K[8]
      ];
      R1 = [1 + K[0] + K2[0] * f, K[1] + K2[1] * f, K[2] + K2[2] * f,
        K[3] + K2[3] * f, 1 + K[4] + K2[4] * f, K[5] + K2[5] * f,
        K[6] + K2[6] * f, K[7] + K2[7] * f, 1 + K[8] + K2[8] * f];
    }
    var R = R1;
    if (roll !== 0) {
      var cr = Math.cos(roll * DEG), sr = Math.sin(roll * DEG), q = 1 - cr;
      var R2 = [
        cr + nx * nx * q, nx * ny * q - nz * sr, nx * nz * q + ny * sr,
        ny * nx * q + nz * sr, cr + ny * ny * q, ny * nz * q - nx * sr,
        nz * nx * q - ny * sr, nz * ny * q + nx * sr, cr + nz * nz * q
      ];
      R = [
        R2[0] * R1[0] + R2[1] * R1[3] + R2[2] * R1[6], R2[0] * R1[1] + R2[1] * R1[4] + R2[2] * R1[7], R2[0] * R1[2] + R2[1] * R1[5] + R2[2] * R1[8],
        R2[3] * R1[0] + R2[4] * R1[3] + R2[5] * R1[6], R2[3] * R1[1] + R2[4] * R1[4] + R2[5] * R1[7], R2[3] * R1[2] + R2[4] * R1[5] + R2[5] * R1[8],
        R2[6] * R1[0] + R2[7] * R1[3] + R2[8] * R1[6], R2[6] * R1[1] + R2[7] * R1[4] + R2[8] * R1[7], R2[6] * R1[2] + R2[7] * R1[5] + R2[8] * R1[8]
      ];
    }
    var px = num(pos[0], 0), py = num(pos[1], 0), pz = num(pos[2], 0);
    return mapVerts(m, function (a, b, c) {
      var r = applyMat(R, a, b, c);
      return [r[0] + px, r[1] + py, r[2] + pz];
    }, false);
  }

  // Seeded wobble. Vertices at the same position (to 1e-5) get the same offset, so nothing cracks,
  // and the same position gets the same wobble in different meshes with the same seed.
  function jitter(m, amount, seed) {
    amount = num(amount, 0.05); seed = (seed | 0);
    function h01(ix, iy, iz, k) {
      var h = (imul(ix, 374761393) + imul(iy, 668265263) + imul(iz, 1274126177) + imul(seed, 1103515245) + imul(k, 362437)) | 0;
      h = imul(h ^ (h >>> 13), 1274126177);
      h = h ^ (h >>> 16);
      h = imul(h, 2246822519);
      h = h ^ (h >>> 13);
      return (h >>> 0) / 4294967296;
    }
    var cache = {};
    return mapVerts(m, function (x, y, z) {
      var ix = Math.round(x * 1e5), iy = Math.round(y * 1e5), iz = Math.round(z * 1e5);
      var key = ix + ',' + iy + ',' + iz;
      var o = cache[key];
      if (!o) {
        o = [(h01(ix, iy, iz, 1) - 0.5) * 2 * amount, (h01(ix, iy, iz, 2) - 0.5) * 2 * amount, (h01(ix, iy, iz, 3) - 0.5) * 2 * amount];
        cache[key] = o;
      }
      return [x + o[0], y + o[1], z + o[2]];
    }, false);
  }

  LowPoly.box = box; LowPoly.cylinder = cylinder; LowPoly.cone = cone; LowPoly.sphere = sphere;
  LowPoly.prism = prism; LowPoly.quad = quad; LowPoly.disc = disc; LowPoly.torus = torus; LowPoly.lathe = lathe;
  LowPoly.merge = merge; LowPoly.move = move; LowPoly.rotate = rotate; LowPoly.scale = scale; LowPoly.mirror = mirror;
  LowPoly.recolor = recolor; LowPoly.emit = emit; LowPoly.place = place; LowPoly.bounds = bounds;
  LowPoly.jitter = jitter; LowPoly.count = count; LowPoly.base = base; LowPoly.center = center;
  LowPoly.rotationMatrix = rotMat;

  // ---------------------------------------------------------------------------
  // Registries and placeholders. Plain objects: an unknown id is simply missing.
  // Use LowPoly.model(kind, id, arg) to look one up safely.
  // ---------------------------------------------------------------------------
  LowPoly.models = { body: {}, part: {}, launcher: {}, person: {} };
  LowPoly.scenes = {};

  var PORT_KINDS = ['instrument', 'power', 'comms', 'computer', 'propulsion', 'attitude'];

  function fallbackBody() {
    var m = merge([
      box(1.2, 1.4, 1.2, 'metalDark'),
      move(box(1.24, 0.08, 1.24, 'orange'), 0, 0.5, 0),
      move(box(0.3, 0.3, 0.05, 'orange'), 0, 0, 0.62)
    ]);
    var faces = [
      { pos: [0.6, 0.15, 0], normal: [1, 0, 0] }, { pos: [-0.6, 0.15, 0], normal: [-1, 0, 0] },
      { pos: [0, 0.75, 0], normal: [0, 1, 0] }, { pos: [0, -0.75, 0], normal: [0, -1, 0] },
      { pos: [0, 0.15, -0.6], normal: [0, 0, -1] }, { pos: [0, 0.15, 0.6], normal: [0, 0, 1] },
      { pos: [0.6, -0.35, 0], normal: [1, 0, 0] }, { pos: [-0.6, -0.35, 0], normal: [-1, 0, 0] }
    ];
    var ports = {}, i, k;
    for (k = 0; k < PORT_KINDS.length; k++) {
      ports[PORT_KINDS[k]] = [];
      for (i = 0; i < faces.length; i++) ports[PORT_KINDS[k]].push({ pos: faces[i].pos.slice(), normal: faces[i].normal.slice(), roll: 0 });
    }
    return { mesh: m, size: [1.2, 1.4, 1.2], ports: ports, label: 'Placeholder satellite body' };
  }
  function fallbackPart() {
    var m = merge([base(cylinder(0.14, 0.18, 0.34, 6, 'metalDark')), move(base(cylinder(0.1, 0.1, 0.1, 6, 'orange')), 0, 0.34, 0)]);
    return { mesh: m, size: [0.36, 0.44, 0.36], label: 'Placeholder part' };
  }
  function fallbackLauncher() {
    var m = merge([
      base(cylinder(0.3, 0.3, 4, 8, 'silver')),
      move(base(cone(0.3, 0.8, 8, 'steel')), 0, 4, 0),
      move(base(cylinder(0.32, 0.32, 0.12, 8, 'orange')), 0, 1.5, 0)
    ]);
    return { mesh: center(m), size: [0.6, 4.8, 0.6], label: 'Placeholder rocket' };
  }
  function fallbackPerson() {
    var m = merge([
      move(box(0.5, 0.6, 0.3, 'shirt1'), 0, 0.3, 0),
      move(sphere(0.2, 1, 'skin2'), 0, 0.85, 0),
      move(box(0.5, 0.06, 0.3, 'metalDark'), 0, 0.03, 0)
    ]);
    return { mesh: m, label: 'Placeholder person' };
  }
  function fallbackScene() {
    var f = fallbackPart();
    return {
      scene: {
        items: [{ mesh: f.mesh, pos: [0, -0.2, 0] }],
        camera: { yaw: 25, pitch: 15, dist: 2.2, target: [0, 0.1, 0], fov: 35 },
        light: DEFAULT_LIGHT,
        background: { color: 'space', stars: true, seed: 3 },
        label: 'Placeholder scene'
      },
      update: null,
      label: 'Placeholder scene'
    };
  }

  // A plain placeholder model for a kind: "body", "part", "launcher", "person" or "scene".
  LowPoly.fallback = function (kind) {
    if (kind === 'body') return fallbackBody();
    if (kind === 'launcher') return fallbackLauncher();
    if (kind === 'person') return fallbackPerson();
    if (kind === 'scene') return fallbackScene();
    return fallbackPart();
  };
  LowPoly.has = function (kind, id) {
    var reg = (kind === 'scene') ? LowPoly.scenes : LowPoly.models[kind];
    return !!reg && Object.prototype.hasOwnProperty.call(reg, id) && typeof reg[id] === 'function';
  };
  // Safe lookup: returns the model for kind/id, or the placeholder if the id is unknown or the builder throws.
  LowPoly.model = function (kind, id, arg) {
    var reg = (kind === 'scene') ? LowPoly.scenes : LowPoly.models[kind];
    if (reg && Object.prototype.hasOwnProperty.call(reg, id) && typeof reg[id] === 'function') {
      try {
        var out = reg[id](arg);
        if (out && (out.mesh || out.scene)) return out;
      } catch (e) { warnOnce('model ' + kind + '.' + id + ' threw: ' + (e && e.message)); }
    }
    return LowPoly.fallback(kind);
  };

  // ---------------------------------------------------------------------------
  // Rasteriser
  // ---------------------------------------------------------------------------
  var cb = null;               // colour buffer in use (Uint32)
  var zb = new Float32Array(0);// depth buffer (closeness: bigger is nearer)
  var scratchC = new Uint32Array(0);
  var IW = 0, IH = 0;          // internal buffer size
  var BIAS = 1;
  var MT = new Float64Array(12);   // per-item matrix: 3x3 (view * model) then translation
  var POLY = new Float64Array(24); // clipped polygon: x,y,w triples
  var G = {                    // per-frame camera/light settings
    persp: true, near: 0.01, f: 1, sc: 1, cx: 0, cy: 0,
    Lx: 0, Ly: 1, Lz: 0, Ux: 0, Uy: 1, Uz: 0,
    ambR: 0.3, ambG: 0.3, ambB: 0.3, keyR: 0.8, keyG: 0.8, keyB: 0.8, steps: 0, hemi: HEMI,
    resolve: null
  };
  var trisDrawn = 0;

  function ensureBuffers(n) {
    if (zb.length < n) zb = new Float32Array(n + (n >> 3));
  }

  function packRGB(r, g, b) {
    return ((255 << SA) | (b << SB) | (g << SG) | (r << SR)) >>> 0;
  }

  // Opaque flat triangle fill. Screen coordinates are in internal pixels (y down); c is "closeness".
  function fillTri(x0, y0, c0, x1, y1, c1, x2, y2, c2, col) {
    var d = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (d === 0 || d !== d) return;
    var minY = y0 < y1 ? (y0 < y2 ? y0 : y2) : (y1 < y2 ? y1 : y2);
    var maxY = y0 > y1 ? (y0 > y2 ? y0 : y2) : (y1 > y2 ? y1 : y2);
    var iy0 = Math.ceil(minY - 0.5), iy1 = Math.ceil(maxY - 0.5);
    if (iy0 < 0) iy0 = 0;
    if (iy1 > IH) iy1 = IH;
    if (iy0 >= iy1) return;
    var minX = x0 < x1 ? (x0 < x2 ? x0 : x2) : (x1 < x2 ? x1 : x2);
    var maxX = x0 > x1 ? (x0 > x2 ? x0 : x2) : (x1 > x2 ? x1 : x2);
    if (maxX < 0 || minX > IW) return;
    var inv = 1 / d;
    var dcdx = ((c1 - c0) * (y2 - y0) - (y1 - y0) * (c2 - c0)) * inv;
    var dcdy = ((x1 - x0) * (c2 - c0) - (c1 - c0) * (x2 - x0)) * inv;
    var ax = x0, ay = y0, bx = x1, by = y1, cx = x2, cy = y2, t;
    if (ay > by) { t = ax; ax = bx; bx = t; t = ay; ay = by; by = t; }
    if (by > cy) { t = bx; bx = cx; cx = t; t = by; by = cy; cy = t; }
    if (ay > by) { t = ax; ax = bx; bx = t; t = ay; ay = by; by = t; }
    var sAC = (cx - ax) / (cy - ay);
    var sAB = by > ay ? (bx - ax) / (by - ay) : 0;
    var sBC = cy > by ? (cx - bx) / (cy - by) : 0;
    var W = IW, zbuf = zb, cbuf = cb, kb = BIAS;
    for (var iy = iy0; iy < iy1; iy++) {
      var yc = iy + 0.5;
      var xa = ax + (yc - ay) * sAC;
      var xb = yc < by ? ax + (yc - ay) * sAB : bx + (yc - by) * sBC;
      var xl, xr;
      if (xa < xb) { xl = xa; xr = xb; } else { xl = xb; xr = xa; }
      var ix0 = Math.ceil(xl - 0.5), ix1 = Math.ceil(xr - 0.5);
      if (ix0 < 0) ix0 = 0;
      if (ix1 > W) ix1 = W;
      if (ix0 >= ix1) continue;
      var z = c0 + (ix0 + 0.5 - x0) * dcdx + (yc - y0) * dcdy;
      var i = iy * W + ix0, e = iy * W + ix1;
      for (; i < e; i++, z += dcdx) {
        if (z > zbuf[i] * kb) { zbuf[i] = z; cbuf[i] = col; }
      }
    }
  }

  // Alpha-blended triangle: depth tested, no depth write.
  function fillTriBlend(x0, y0, c0, x1, y1, c1, x2, y2, c2, r, g, b, a) {
    var d = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (d === 0 || d !== d) return;
    var minY = y0 < y1 ? (y0 < y2 ? y0 : y2) : (y1 < y2 ? y1 : y2);
    var maxY = y0 > y1 ? (y0 > y2 ? y0 : y2) : (y1 > y2 ? y1 : y2);
    var iy0 = Math.ceil(minY - 0.5), iy1 = Math.ceil(maxY - 0.5);
    if (iy0 < 0) iy0 = 0;
    if (iy1 > IH) iy1 = IH;
    if (iy0 >= iy1) return;
    var inv = 1 / d;
    var dcdx = ((c1 - c0) * (y2 - y0) - (y1 - y0) * (c2 - c0)) * inv;
    var dcdy = ((x1 - x0) * (c2 - c0) - (c1 - c0) * (x2 - x0)) * inv;
    var ax = x0, ay = y0, bx = x1, by = y1, cx = x2, cy = y2, t;
    if (ay > by) { t = ax; ax = bx; bx = t; t = ay; ay = by; by = t; }
    if (by > cy) { t = bx; bx = cx; cx = t; t = by; by = cy; cy = t; }
    if (ay > by) { t = ax; ax = bx; bx = t; t = ay; ay = by; by = t; }
    var sAC = (cx - ax) / (cy - ay);
    var sAB = by > ay ? (bx - ax) / (by - ay) : 0;
    var sBC = cy > by ? (cx - bx) / (cy - by) : 0;
    var W = IW, zbuf = zb, cbuf = cb, kb = BIAS;
    var a255 = Math.round(a * 255), ia = 1 - a;
    var srcA = (((a255 << SA) | (b << SB) | (g << SG) | (r << SR)) >>> 0);
    for (var iy = iy0; iy < iy1; iy++) {
      var yc = iy + 0.5;
      var xa = ax + (yc - ay) * sAC;
      var xb = yc < by ? ax + (yc - ay) * sAB : bx + (yc - by) * sBC;
      var xl, xr;
      if (xa < xb) { xl = xa; xr = xb; } else { xl = xb; xr = xa; }
      var ix0 = Math.ceil(xl - 0.5), ix1 = Math.ceil(xr - 0.5);
      if (ix0 < 0) ix0 = 0;
      if (ix1 > W) ix1 = W;
      if (ix0 >= ix1) continue;
      var z = c0 + (ix0 + 0.5 - x0) * dcdx + (yc - y0) * dcdy;
      var i = iy * W + ix0, e = iy * W + ix1;
      for (; i < e; i++, z += dcdx) {
        if (z > zbuf[i] * kb) {
          var dst = cbuf[i], da = (dst >>> SA) & 255;
          if (da === 0) { cbuf[i] = srcA; }
          else if (da === 255) {
            cbuf[i] = packRGB(
              Math.round(((dst >>> SR) & 255) * ia + r * a),
              Math.round(((dst >>> SG) & 255) * ia + g * a),
              Math.round(((dst >>> SB) & 255) * ia + b * a));
          } else {
            var dA = da / 255, oA = a + dA * ia, wd = dA * ia / oA, ws = a / oA;
            cbuf[i] = ((Math.round(oA * 255) << SA) |
              (Math.round(((dst >>> SB) & 255) * wd + b * ws) << SB) |
              (Math.round(((dst >>> SG) & 255) * wd + g * ws) << SG) |
              (Math.round(((dst >>> SR) & 255) * wd + r * ws) << SR)) >>> 0;
          }
        }
      }
    }
  }

  var CR = 0, CG = 0, CB = 0;   // current triangle colour for the blend pass

  // Project and fill a view-space polygon (n vertices as x,y,w triples in POLY), fanned from vertex 0.
  function fillPolygon(n, col, mode, alpha) {
    var persp = G.persp, f = G.f, sc = G.sc, cx = G.cx, cy = G.cy;
    var sx = [0, 0, 0, 0], sy = [0, 0, 0, 0], sz = [0, 0, 0, 0], i;
    for (i = 0; i < n; i++) {
      var x = POLY[i * 3], y = POLY[i * 3 + 1], w = POLY[i * 3 + 2];
      if (persp) { var k = f / w; sx[i] = cx + x * k; sy[i] = cy - y * k; sz[i] = 1 / w; }
      else { sx[i] = cx + x * sc; sy[i] = cy - y * sc; sz[i] = -w; }
    }
    for (i = 1; i < n - 1; i++) {
      trisDrawn++;
      if (mode === 0) fillTri(sx[0], sy[0], sz[0], sx[i], sy[i], sz[i], sx[i + 1], sy[i + 1], sz[i + 1], col);
      else fillTriBlend(sx[0], sy[0], sz[0], sx[i], sy[i], sz[i], sx[i + 1], sy[i + 1], sz[i + 1], CR, CG, CB, alpha);
    }
  }

  // Draw every triangle of one item. M holds the view*model matrix; flip is true for mirrored items.
  function drawItem(tris, flip, mode, alpha) {
    var m00 = MT[0], m01 = MT[1], m02 = MT[2], m10 = MT[3], m11 = MT[4], m12 = MT[5], m20 = MT[6], m21 = MT[7], m22 = MT[8];
    var tx = MT[9], ty = MT[10], tz = MT[11];
    var persp = G.persp, near = G.near, f = G.f, sc = G.sc, cx = G.cx, cy = G.cy;
    var Lx = G.Lx, Ly = G.Ly, Lz = G.Lz, Ux = G.Ux, Uy = G.Uy, Uz = G.Uz;
    var ambR = G.ambR, ambG = G.ambG, ambB = G.ambB, keyR = G.keyR, keyG = G.keyG, keyB = G.keyB, steps = G.steps, hemi = G.hemi;
    var resolve = G.resolve;
    var n = tris.length, i;
    for (i = 0; i < n; i++) {
      var T = tris[i], v = T.v, a = v[0], b = v[1], c = v[2];
      var ax = a[0], ay = a[1], az = a[2], bx = b[0], by = b[1], bz = b[2], cx3 = c[0], cy3 = c[1], cz3 = c[2];
      var x0 = m00 * ax + m01 * ay + m02 * az + tx, y0 = m10 * ax + m11 * ay + m12 * az + ty, z0 = m20 * ax + m21 * ay + m22 * az + tz;
      var x1 = m00 * bx + m01 * by + m02 * bz + tx, y1 = m10 * bx + m11 * by + m12 * bz + ty, z1 = m20 * bx + m21 * by + m22 * bz + tz;
      var x2 = m00 * cx3 + m01 * cy3 + m02 * cz3 + tx, y2 = m10 * cx3 + m11 * cy3 + m12 * cz3 + ty, z2 = m20 * cx3 + m21 * cy3 + m22 * cz3 + tz;
      var ux = x1 - x0, uy = y1 - y0, uz = z1 - z0, wx = x2 - x0, wy = y2 - y0, wz = z2 - z0;
      var nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      if (flip) { nx = -nx; ny = -ny; nz = -nz; }
      // back-face culling (view space: the camera looks down -z)
      if (persp) { if (nx * x0 + ny * y0 + nz * z0 >= 0) continue; }
      else if (nz <= 0) continue;
      var nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nl < 1e-14) continue;
      // depth along the view axis
      var w0 = -z0, w1 = -z1, w2 = -z2;
      var in0 = w0 >= near, in1 = w1 >= near, in2 = w2 >= near;
      if (!in0 && !in1 && !in2) continue;
      // colour
      var rgb = resolve(T.c), r, g, bl;
      if (T.e) { r = rgb[0]; g = rgb[1]; bl = rgb[2]; }
      else {
        var ndl = (nx * Lx + ny * Ly + nz * Lz) / nl;
        if (ndl < 0) ndl = 0;
        if (steps > 1) ndl = Math.round(ndl * (steps - 1)) / (steps - 1);
        var hf = 1 + hemi * ((nx * Ux + ny * Uy + nz * Uz) / nl);
        r = rgb[0] * (ambR * hf + keyR * ndl); if (r > 255) r = 255;
        g = rgb[1] * (ambG * hf + keyG * ndl); if (g > 255) g = 255;
        bl = rgb[2] * (ambB * hf + keyB * ndl); if (bl > 255) bl = 255;
        r = (r + 0.5) | 0; g = (g + 0.5) | 0; bl = (bl + 0.5) | 0;
      }
      var col = 0;
      if (mode === 0) col = ((255 << SA) | (bl << SB) | (g << SG) | (r << SR)) >>> 0;
      else { CR = r; CG = g; CB = bl; }
      if (in0 && in1 && in2) {
        var s0, s1, s2, q0, q1, q2, ox0, oy0, ox1, oy1, ox2, oy2;
        if (persp) {
          s0 = f / w0; s1 = f / w1; s2 = f / w2;
          ox0 = cx + x0 * s0; oy0 = cy - y0 * s0; q0 = 1 / w0;
          ox1 = cx + x1 * s1; oy1 = cy - y1 * s1; q1 = 1 / w1;
          ox2 = cx + x2 * s2; oy2 = cy - y2 * s2; q2 = 1 / w2;
        } else {
          ox0 = cx + x0 * sc; oy0 = cy - y0 * sc; q0 = -w0;
          ox1 = cx + x1 * sc; oy1 = cy - y1 * sc; q1 = -w1;
          ox2 = cx + x2 * sc; oy2 = cy - y2 * sc; q2 = -w2;
        }
        trisDrawn++;
        if (mode === 0) fillTri(ox0, oy0, q0, ox1, oy1, q1, ox2, oy2, q2, col);
        else fillTriBlend(ox0, oy0, q0, ox1, oy1, q1, ox2, oy2, q2, r, g, bl, alpha);
      } else {
        // clip against the near plane (Sutherland-Hodgman), at most 4 vertices result
        var px = [x0, x1, x2], py = [y0, y1, y2], pw = [w0, w1, w2], k, cnt = 0;
        for (k = 0; k < 3; k++) {
          var k2 = (k + 1) % 3;
          var wa = pw[k], wb = pw[k2], ina = wa >= near, inb = wb >= near;
          if (ina) { POLY[cnt * 3] = px[k]; POLY[cnt * 3 + 1] = py[k]; POLY[cnt * 3 + 2] = wa; cnt++; }
          if (ina !== inb) {
            var tt = (near - wa) / (wb - wa);
            POLY[cnt * 3] = px[k] + (px[k2] - px[k]) * tt;
            POLY[cnt * 3 + 1] = py[k] + (py[k2] - py[k]) * tt;
            POLY[cnt * 3 + 2] = near;
            cnt++;
          }
        }
        if (cnt >= 3) fillPolygon(cnt, col, mode, alpha);
      }
    }
  }

  // ---- scene helpers ----

  function normalize3(a) {
    var l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
    return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 1, 0];
  }

  // Per-item matrix pieces: R*S (3x3 row-major) and the scale triple.
  function itemLocal(item) {
    var rot = item.rot || [0, 0, 0];
    var R = rotMat(num(rot[0], 0), num(rot[1], 0), num(rot[2], 0));
    var s = item.scale, sx = 1, sy = 1, sz = 1;
    if (typeof s === 'number') { sx = sy = sz = s; }
    else if (s && s.length) { sx = num(s[0], 1); sy = num(s[1], sx); sz = num(s[2], sx); }
    var M = [R[0] * sx, R[1] * sy, R[2] * sz, R[3] * sx, R[4] * sy, R[5] * sz, R[6] * sx, R[7] * sy, R[8] * sz];
    return { M: M, flip: (sx * sy * sz) < 0 };
  }

  function visibleItems(scene) {
    var out = [], items = scene.items || [], i;
    for (i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || !it.mesh || !it.mesh.tris || it.hidden) continue;
      var al = (it.alpha === undefined || it.alpha === null) ? 1 : it.alpha;
      if (!(al > 0)) continue;
      out.push(it);
    }
    return out;
  }

  // Bounding sphere (centre, radius) of all items in world space, around `around` if given.
  function fitSphere(items, around) {
    var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity], i, j, k, any = false;
    var locals = [];
    for (i = 0; i < items.length; i++) {
      var L = itemLocal(items[i]), M = L.M, p = items[i].pos || [0, 0, 0], tr = items[i].mesh.tris;
      locals.push(L);
      for (j = 0; j < tr.length; j++) {
        for (k = 0; k < 3; k++) {
          var q = tr[j].v[k];
          var x = M[0] * q[0] + M[1] * q[1] + M[2] * q[2] + num(p[0], 0);
          var y = M[3] * q[0] + M[4] * q[1] + M[5] * q[2] + num(p[1], 0);
          var z = M[6] * q[0] + M[7] * q[1] + M[8] * q[2] + num(p[2], 0);
          any = true;
          if (x < mn[0]) mn[0] = x; if (y < mn[1]) mn[1] = y; if (z < mn[2]) mn[2] = z;
          if (x > mx[0]) mx[0] = x; if (y > mx[1]) mx[1] = y; if (z > mx[2]) mx[2] = z;
        }
      }
    }
    if (!any) return { c: [0, 0, 0], r: 1 };
    var c = around || [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    // radius: farthest bounding-box corner from the centre (cheap and safe)
    var dx = Math.max(Math.abs(mn[0] - c[0]), Math.abs(mx[0] - c[0]));
    var dy = Math.max(Math.abs(mn[1] - c[1]), Math.abs(mx[1] - c[1]));
    var dz = Math.max(Math.abs(mn[2] - c[2]), Math.abs(mx[2] - c[2]));
    var r = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return { c: c, r: r > 1e-6 ? r : 1 };
  }

  // Stars: deterministic from the seed, in screen-relative coordinates, so a resize does not reshuffle them.
  function drawStars(bgRGB, starRGB, seed, ss) {
    var rnd = rng((seed | 0) + 7919);
    var ow = IW / ss, oh = IH / ss;
    var n = clamp(Math.round(ow * oh / 2400), 12, 420), k, x, y;
    for (k = 0; k < n; k++) {
      var u = rnd(), v = rnd(), br = rnd(), sz = rnd();
      var big = sz > 0.965, bright = big ? 0.75 + 0.25 * br : (sz > 0.8 ? 0.7 + 0.3 * br : 0.28 + 0.5 * br);
      var size = big ? 2 : 1;
      var r = Math.round(bgRGB[0] + (starRGB[0] - bgRGB[0]) * bright);
      var g = Math.round(bgRGB[1] + (starRGB[1] - bgRGB[1]) * bright);
      var b = Math.round(bgRGB[2] + (starRGB[2] - bgRGB[2]) * bright);
      var col = packRGB(r, g, b);
      var px = Math.floor(u * (ow - size)) * ss, py = Math.floor(v * (oh - size)) * ss;
      if (px < 0 || py < 0) continue;
      var span = size * ss;
      for (y = py; y < py + span && y < IH; y++) for (x = px; x < px + span && x < IW; x++) cb[y * IW + x] = col;
    }
  }

  // Average ss*ss blocks of the internal buffer into the output buffer.
  function downsample(src, dst, W, H, ss, opaque) {
    var x, y, sx, sy, n2 = ss * ss, SW = W * ss;
    if (opaque && ss === 2 && LITTLE) {
      // fast path: average four opaque pixels with two lanes at a time (red+blue, green)
      for (y = 0; y < H; y++) {
        var p0 = (y * 2) * SW, p1 = p0 + SW, o = y * W;
        for (x = 0; x < W; x++, p0 += 2, p1 += 2) {
          var a = src[p0], b = src[p0 + 1], c = src[p1], d = src[p1 + 1];
          var rb = (((a & 0xFF00FF) + (b & 0xFF00FF) + (c & 0xFF00FF) + (d & 0xFF00FF) + 0x020002) >> 2) & 0xFF00FF;
          var gg = (((a & 0xFF00) + (b & 0xFF00) + (c & 0xFF00) + (d & 0xFF00) + 0x0200) >> 2) & 0xFF00;
          dst[o + x] = (0xFF000000 | rb | gg) >>> 0;
        }
      }
      return;
    }
    if (opaque) {
      var inv = 1 / n2;
      for (y = 0; y < H; y++) {
        for (x = 0; x < W; x++) {
          var r = 0, g = 0, b = 0, p = (y * ss) * SW + x * ss;
          for (sy = 0; sy < ss; sy++, p += SW) {
            for (sx = 0; sx < ss; sx++) {
              var c = src[p + sx];
              r += (c >>> SR) & 255; g += (c >>> SG) & 255; b += (c >>> SB) & 255;
            }
          }
          dst[y * W + x] = ((255 << SA) | (((b * inv + 0.5) | 0) << SB) | (((g * inv + 0.5) | 0) << SG) | (((r * inv + 0.5) | 0) << SR)) >>> 0;
        }
      }
      return;
    }
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        var rr = 0, gg = 0, bb = 0, aa = 0, pp = (y * ss) * SW + x * ss;
        for (sy = 0; sy < ss; sy++, pp += SW) {
          for (sx = 0; sx < ss; sx++) {
            var cc = src[pp + sx], ca = (cc >>> SA) & 255;
            if (ca) { rr += ((cc >>> SR) & 255) * ca; gg += ((cc >>> SG) & 255) * ca; bb += ((cc >>> SB) & 255) * ca; aa += ca; }
          }
        }
        if (aa === 0) dst[y * W + x] = 0;
        else dst[y * W + x] = ((((aa / n2 + 0.5) | 0) << SA) | (((bb / aa + 0.5) | 0) << SB) | (((gg / aa + 0.5) | 0) << SG) | (((rr / aa + 0.5) | 0) << SR)) >>> 0;
      }
    }
  }

  // Hidden per-canvas state (ImageData, last size).
  function stateOf(canvas) {
    var s = canvas.__lowpoly;
    if (!s) {
      s = { w: 0, h: 0, img: null, u32: null, ctx: null, cssW: 0, cssH: 0 };
      try { Object.defineProperty(canvas, '__lowpoly', { value: s, enumerable: false, writable: true }); }
      catch (e) { canvas.__lowpoly = s; }
    }
    return s;
  }

  // Work out logical (CSS) size, backing-store size and supersample factor. Returns null if nothing can be drawn.
  function planSize(canvas, opts) {
    var cw = num(opts.width, 0), ch = num(opts.height, 0), dpr;
    var connected = !!canvas.isConnected;
    var detached = false;
    if (!(cw > 0 && ch > 0)) {
      cw = canvas.clientWidth; ch = canvas.clientHeight;
      if (!(cw > 0 && ch > 0)) {
        if (connected) return null;                 // display:none or collapsed
        cw = canvas.width; ch = canvas.height;      // detached canvas: draw at its own size
        detached = true;
        if (!(cw > 0 && ch > 0)) return null;
      }
    }
    var quality = opts.quality || 'auto';
    dpr = detached ? 1 : num(opts.pixelRatio, 0) || Math.min(root.devicePixelRatio || 1, MAX_DPR);
    if (quality === 'low') dpr = Math.min(dpr, 1);
    dpr = clamp(dpr, 0.25, 4);
    var budget = quality === 'low' ? 300000 : num(opts.maxPixels, BUDGET);
    var W = Math.max(1, Math.round(cw * dpr)), H = Math.max(1, Math.round(ch * dpr));
    if (W * H > budget) {
      var fct = Math.sqrt(budget / (W * H));
      W = Math.max(1, Math.floor(W * fct)); H = Math.max(1, Math.floor(H * fct));
    }
    var ss = 1;
    if (opts.ss > 0) ss = clamp(Math.round(opts.ss), 1, 4);
    else if (quality !== 'low') {
      var maxSS = quality === 'high' ? 4 : 3, s;
      for (s = maxSS; s >= 2; s--) { if (W * H * s * s <= SS_LIMIT) { ss = s; break; } }
    }
    if (W * H * ss * ss > 4000000) ss = 1;
    return { cw: cw, ch: ch, W: W, H: H, ss: ss, detached: detached };
  }

  // ---------------------------------------------------------------------------
  // LowPoly.render(canvas, scene, opts): draw one frame.
  // ---------------------------------------------------------------------------
  var stats = { frames: 0, lastMs: 0, lastW: 0, lastH: 0, lastSS: 1, lastTris: 0 };
  LowPoly.stats = stats;

  function render(canvas, scene, opts) {
    var t0 = now();
    opts = opts || {};
    scene = scene || {};
    if (!canvas || typeof canvas.getContext !== 'function') return null;
    var plan = planSize(canvas, opts);
    if (!plan) return null;
    var st = stateOf(canvas);
    var W = plan.W, H = plan.H, ss = plan.ss;
    if (!plan.detached) {
      var changed = false;
      if (canvas.width !== W) { canvas.width = W; changed = true; }
      if (canvas.height !== H) { canvas.height = H; changed = true; }
      if (changed && canvas.isConnected && (Math.abs(canvas.clientWidth - plan.cw) > 1 || Math.abs(canvas.clientHeight - plan.ch) > 1)) {
        // Layout followed the backing store (no CSS size): pin the size the page had before.
        if (!canvas.style.width) canvas.style.width = plan.cw + 'px';
        if (!canvas.style.height) canvas.style.height = plan.ch + 'px';
      }
    } else {
      W = canvas.width; H = canvas.height;
      if (W * H * ss * ss > 4000000) ss = 1;
    }
    var ctx = st.ctx || (st.ctx = canvas.getContext('2d'));
    if (!ctx) return null;
    if (!st.img || st.w !== W || st.h !== H) {
      st.img = ctx.createImageData(W, H);
      st.u32 = new Uint32Array(st.img.data.buffer);
      st.w = W; st.h = H;
    }
    IW = W * ss; IH = H * ss;
    var n = IW * IH;
    ensureBuffers(n);
    if (ss > 1) {
      if (scratchC.length < n) scratchC = new Uint32Array(n + (n >> 3));
      cb = scratchC;
    } else cb = st.u32;

    var resolve = makeResolver(canvas);
    var scn = scene;

    // background
    var bg = scn.background, opaque = false;
    cb.fill(0, 0, n);
    zb.fill(-Infinity, 0, n);
    if (bg) {
      if (typeof bg === 'string') bg = { color: bg };
      var bgRGB = resolve(bg.color || 'space');
      cb.fill(packRGB(bgRGB[0], bgRGB[1], bgRGB[2]), 0, n);
      opaque = true;
      if (bg.stars) drawStars(bgRGB, resolve('star'), bg.seed || 1, ss);
    }

    // camera
    var items = visibleItems(scn);
    var cam = scn.camera || {};
    var aspect = IW / IH;
    var ortho = !!cam.ortho;
    var fov = (cam.fov > 0 && cam.fov < 170) ? cam.fov : LowPoly.defaults.fov;
    var yaw = num(cam.yaw, LowPoly.defaults.yaw) * DEG, pitch = clamp(num(cam.pitch, LowPoly.defaults.pitch), -89.9, 89.9) * DEG;
    var tgt = cam.target, dist = cam.dist, size = cam.size;
    if (!(dist > 0) || !tgt || (ortho && !(size > 0))) {
      var fit = fitSphere(items, tgt || (dist > 0 ? [0, 0, 0] : null));
      if (!tgt) tgt = fit.c;
      if (!(dist > 0)) {
        if (ortho) dist = fit.r * 4;
        else {
          var vh = Math.tan(fov * DEG / 2), hh = vh * aspect;
          dist = fit.r * 1.08 / Math.sin(Math.atan(Math.min(vh, hh)));
        }
      }
      if (ortho && !(size > 0)) size = 2 * fit.r * 1.08 * (aspect < 1 ? 1 / aspect : 1);
    }
    var cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    var bx = syw * cp, by = sp, bz = cyw * cp;                       // back vector (eye - target)
    var rx = cyw, ry = 0, rz = -syw;                                 // right
    var ux = -sp * syw, uy = cp, uz = -sp * cyw;                     // up
    var ex = tgt[0] + bx * dist, ey = tgt[1] + by * dist, ez = tgt[2] + bz * dist;
    G.persp = !ortho;
    G.near = ortho ? 1e-3 : Math.max(dist * 0.02, 1e-3);
    G.f = (IH / 2) / Math.tan(fov * DEG / 2);
    G.sc = ortho ? IH / size : 1;
    G.cx = IW / 2; G.cy = IH / 2;
    BIAS = ortho ? 1 + DEPTH_BIAS : 1 - DEPTH_BIAS;   // closeness is 1/w (positive) in perspective and -w (negative) in ortho

    // light
    var lt = scn.light || {};
    var Ld = normalize3(lt.dir || DEFAULT_LIGHT.dir);
    // The page may set the light colours for every scene (--lp-light-key, --lp-light-ambient: the 1958 look is a warm sepia
    // print); unset, the scene's own colours apply and nothing changes.
    var keyC = resolve.page('--lp-light-key') || parseAnyColor(lt.key || DEFAULT_LIGHT.key) || parseColor(DEFAULT_LIGHT.key);
    var ambC = resolve.page('--lp-light-ambient') || parseAnyColor(lt.ambient || DEFAULT_LIGHT.ambient) || parseColor(DEFAULT_LIGHT.ambient);
    if (lt.space === 'camera') { G.Lx = Ld[0]; G.Ly = Ld[1]; G.Lz = Ld[2]; }
    else {
      G.Lx = Ld[0] * rx + Ld[1] * ry + Ld[2] * rz;
      G.Ly = Ld[0] * ux + Ld[1] * uy + Ld[2] * uz;
      G.Lz = Ld[0] * bx + Ld[1] * by + Ld[2] * bz;
    }
    G.Ux = ry; G.Uy = uy; G.Uz = by;          // world up (0,1,0) in view space
    G.keyR = keyC[0] / 255; G.keyG = keyC[1] / 255; G.keyB = keyC[2] / 255;
    G.ambR = ambC[0] / 255; G.ambG = ambC[1] / 255; G.ambB = ambC[2] / 255;
    G.steps = (lt.steps >= 3) ? Math.min(8, Math.round(lt.steps)) : 0;
    G.hemi = lt.hemi === undefined ? HEMI : num(lt.hemi, HEMI);
    G.resolve = resolve;

    // items: opaque first, then translucent far to near
    trisDrawn = 0;
    var i, blend = [];
    for (i = 0; i < items.length; i++) {
      var it = items[i], al = (it.alpha === undefined || it.alpha === null) ? 1 : it.alpha;
      if (al < 1) { blend.push(it); continue; }
      setItemMatrix(it, rx, ry, rz, ux, uy, uz, bx, by, bz, ex, ey, ez);
      drawItem(it.mesh.tris, itemFlip, 0, 1);
    }
    if (blend.length) {
      var order = [];
      for (i = 0; i < blend.length; i++) {
        // sort by the view depth of the centre of each item's bounding box (world space)
        var bc = bounds(blend[i].mesh).center, Lm = itemLocal(blend[i]).M, p = blend[i].pos || [0, 0, 0];
        var wx = Lm[0] * bc[0] + Lm[1] * bc[1] + Lm[2] * bc[2] + num(p[0], 0);
        var wy = Lm[3] * bc[0] + Lm[4] * bc[1] + Lm[5] * bc[2] + num(p[1], 0);
        var wz = Lm[6] * bc[0] + Lm[7] * bc[1] + Lm[8] * bc[2] + num(p[2], 0);
        order.push({ it: blend[i], d: (wx - ex) * -bx + (wy - ey) * -by + (wz - ez) * -bz });
      }
      order.sort(function (a, b) { return b.d - a.d; });
      for (i = 0; i < order.length; i++) {
        setItemMatrix(order[i].it, rx, ry, rz, ux, uy, uz, bx, by, bz, ex, ey, ez);
        drawItem(order[i].it.mesh.tris, itemFlip, 1, clamp(order[i].it.alpha, 0, 1));
      }
    }

    if (ss > 1) downsample(cb, st.u32, W, H, ss, opaque);
    ctx.putImageData(st.img, 0, 0);

    // accessibility
    var label = scn.label || opts.label;
    if (!canvas.getAttribute('role')) canvas.setAttribute('role', 'img');
    if (label && canvas.getAttribute('aria-label') !== label) canvas.setAttribute('aria-label', label);

    var ms = now() - t0;
    stats.frames++; stats.lastMs = ms; stats.lastW = W; stats.lastH = H; stats.lastSS = ss; stats.lastTris = trisDrawn;
    return { width: W, height: H, ss: ss, tris: trisDrawn, ms: ms, cssWidth: plan.cw, cssHeight: plan.ch };
  }

  var itemFlip = false;
  // Fill MT with view*model for an item: rows of the view matrix are right, up, back.
  function setItemMatrix(it, rx, ry, rz, ux, uy, uz, bx, by, bz, ex, ey, ez) {
    var L = itemLocal(it), M = L.M, p = it.pos || [0, 0, 0];
    var j;
    for (j = 0; j < 3; j++) {
      MT[j] = rx * M[j] + ry * M[3 + j] + rz * M[6 + j];
      MT[3 + j] = ux * M[j] + uy * M[3 + j] + uz * M[6 + j];
      MT[6 + j] = bx * M[j] + by * M[3 + j] + bz * M[6 + j];
    }
    var dx = num(p[0], 0) - ex, dy = num(p[1], 0) - ey, dz = num(p[2], 0) - ez;
    MT[9] = rx * dx + ry * dy + rz * dz;
    MT[10] = ux * dx + uy * dy + uz * dz;
    // view space has the camera looking down -z, so z_view = dot(P - eye, back)
    MT[11] = bx * dx + by * dy + bz * dz;
    itemFlip = L.flip;
  }

  LowPoly.render = render;

  // Render a scene once into a new (detached) canvas of exactly w x h pixels.
  LowPoly.toCanvas = function (scene, w, h, opts) {
    var c = root.document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    render(c, scene, opts || {});
    return c;
  };

  // ---------------------------------------------------------------------------
  // LowPoly.view(canvas, scene, opts): a live, draggable view.
  // ---------------------------------------------------------------------------
  var views = [];
  var visHooked = false;
  function hookVisibility() {
    if (visHooked || !root.document) return;
    visHooked = true;
    root.document.addEventListener('visibilitychange', function () {
      var list = views.slice(), i;
      for (i = 0; i < list.length; i++) list[i]._vis();
    });
  }

  function view(canvas, scene, opts) {
    opts = opts || {};
    var wrapperUpdate = null, wrapperLabel = null;
    if (scene && !scene.items && scene.scene) { wrapperUpdate = scene.update; wrapperLabel = scene.label; scene = scene.scene; }
    scene = scene || { items: [] };
    if (!scene.camera) scene.camera = {};
    if (canvas && canvas.__lowpolyView) { try { canvas.__lowpolyView.stop(); } catch (e0) { /* ignore */ } }

    var spin = num(opts.spin, 0);
    var interval = 1000 / clamp(num(opts.fps, 30), 1, 120);
    var dragOn = opts.drag !== false;
    var keysOn = opts.keys !== false;
    var frameFns = [];
    if (typeof wrapperUpdate === 'function') frameFns.push(wrapperUpdate);

    var stopped = false, raf = 0, dirty = true, hiddenTab = false, offscreen = false;
    var dragId = null, lastX = 0, lastY = 0, startX = 0, startY = 0, dragMode = 1;
    var created = now(), everConnected = !!canvas.isConnected, lastProc = null, startTs = null;
    var mql = null, io = null, ro = null;
    try { mql = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null; } catch (e1) { mql = null; }

    var ctl = {};

    function reduced() { return !!(mql && mql.matches); }
    function setAria() {
      try {
        canvas.setAttribute('role', 'img');
        var label = scene.label || wrapperLabel || opts.label;
        if (label) canvas.setAttribute('aria-label', label);
        else if (!canvas.getAttribute('aria-label')) canvas.setAttribute('aria-label', '3D model');
      } catch (e) { /* ignore */ }
    }
    function connected() { return !!canvas.isConnected; }
    function runnable() { return !stopped && !(root.document && root.document.hidden) && !offscreen; }
    function wake() {
      if (stopped || raf || !runnable()) return;
      raf = root.requestAnimationFrame(tick);
    }
    function draw() {
      dirty = false;
      render(canvas, scene, opts);
    }
    function animating() { return (spin !== 0 && !reduced() && dragId === null) || frameFns.length > 0; }

    function tick(ts) {
      raf = 0;
      if (stopped) return;
      if (!connected()) {
        if (everConnected || now() - created > 3000) { ctl.stop(); return; }
        raf = root.requestAnimationFrame(tick);
        return;
      }
      everConnected = true;
      if (!runnable()) { lastProc = null; return; }     // paused; visibility / intersection wakes us
      if (lastProc !== null && ts - lastProc < interval - 2 && !dirty) { raf = root.requestAnimationFrame(tick); return; }
      if (startTs === null) startTs = ts;
      var dt = lastProc === null ? 0 : Math.min((ts - lastProc) / 1000, 0.1);
      lastProc = ts;
      var cam = scene.camera;
      if (spin !== 0 && !reduced() && dragId === null) {
        cam.yaw = num(cam.yaw, LowPoly.defaults.yaw) - spin * dt;
        if (cam.yaw < -360 || cam.yaw > 360) cam.yaw %= 360;
        dirty = true;
      }
      var t = (ts - startTs) / 1000, i;
      for (i = 0; i < frameFns.length; i++) {
        try { if (frameFns[i](t, dt) !== false) dirty = true; }
        catch (e) { warnOnce('onFrame callback threw: ' + (e && e.message)); }
      }
      if (dirty) draw();
      if (animating()) raf = root.requestAnimationFrame(tick);
      else lastProc = null;
    }

    function resume() { dirty = true; wake(); }

    // --- input ---
    function onDown(e) {
      if (dragId !== null) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragId = e.pointerId; lastX = e.clientX; lastY = e.clientY;
      // A finger may be starting a page scroll: wait until the direction is clear before turning anything.
      dragMode = e.pointerType === 'touch' ? 0 : 1; startX = e.clientX; startY = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers cannot be captured */ }
      canvas.style.cursor = 'grabbing';
    }
    function onMove(e) {
      if (dragId === null || e.pointerId !== dragId) return;
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (dragMode === 0) {
        var tx = e.clientX - startX, ty = e.clientY - startY;
        if (tx * tx + ty * ty < TOUCH_SLOP * TOUCH_SLOP) return;
        dragMode = Math.abs(tx) >= Math.abs(ty) ? 1 : 2;     // 1 = turn the model, 2 = vertical: leave it to the page
        if (dragMode === 1) { dx = tx; dy = ty; }
      }
      lastX = e.clientX; lastY = e.clientY;
      if (dragMode === 2) return;
      var cam = scene.camera;
      cam.yaw = num(cam.yaw, LowPoly.defaults.yaw) - dx * DRAG_DEG_PER_PX;
      cam.pitch = clamp(num(cam.pitch, LowPoly.defaults.pitch) + dy * DRAG_DEG_PER_PX, -85, 85);
      dirty = true; wake();
    }
    function onUp(e) {
      if (dragId === null || e.pointerId !== dragId) return;
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      dragId = null;
      canvas.style.cursor = 'grab';
      wake();
    }
    function onKey(e) {
      var k = e.key, cam = scene.camera, step = KEY_STEP_DEG * (e.shiftKey ? 2.5 : 1);
      if (k === 'ArrowLeft') cam.yaw = num(cam.yaw, LowPoly.defaults.yaw) + step;
      else if (k === 'ArrowRight') cam.yaw = num(cam.yaw, LowPoly.defaults.yaw) - step;
      else if (k === 'ArrowUp') cam.pitch = clamp(num(cam.pitch, LowPoly.defaults.pitch) - step, -85, 85);
      else if (k === 'ArrowDown') cam.pitch = clamp(num(cam.pitch, LowPoly.defaults.pitch) + step, -85, 85);
      else return;
      e.preventDefault();
      dirty = true; wake();
    }
    function onDragStart(e) { e.preventDefault(); }

    // --- public object ---
    ctl.set = function (s) {
      // forget the previous wrapper's update and label, then adopt the new wrapper's (if it is one)
      if (wrapperUpdate) { var wi = frameFns.indexOf(wrapperUpdate); if (wi >= 0) frameFns.splice(wi, 1); }
      wrapperUpdate = null; wrapperLabel = null;
      if (s && !s.items && s.scene) {
        wrapperLabel = s.label || null;
        if (typeof s.update === 'function') { wrapperUpdate = s.update; frameFns.push(wrapperUpdate); }
        s = s.scene;
      }
      scene = s || { items: [] };
      if (!scene.camera) scene.camera = {};
      setAria(); dirty = true; wake();
      return ctl;
    };
    ctl.redraw = function () { if (!stopped) draw(); return ctl; };
    ctl.stop = function () {
      if (stopped) return;
      stopped = true;
      if (raf) { try { root.cancelAnimationFrame(raf); } catch (e) { /* ignore */ } raf = 0; }
      try {
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('keydown', onKey);
        canvas.removeEventListener('dragstart', onDragStart);
      } catch (e2) { /* ignore */ }
      if (ro) { try { ro.disconnect(); } catch (e3) { /* ignore */ } ro = null; }
      if (io) { try { io.disconnect(); } catch (e4) { /* ignore */ } io = null; }
      var ix = views.indexOf(ctl);
      if (ix >= 0) views.splice(ix, 1);
      try { if (canvas.__lowpolyView === ctl) canvas.__lowpolyView = null; } catch (e5) { /* ignore */ }
    };
    ctl.onFrame = function (fn) {
      if (typeof fn !== 'function') return function () {};
      frameFns.push(fn);
      wake();
      return function () { var j = frameFns.indexOf(fn); if (j >= 0) frameFns.splice(j, 1); };
    };
    ctl._vis = function () {
      // called on visibilitychange; also prunes views whose canvas was removed
      if (stopped) return;
      if (everConnected && !connected()) { ctl.stop(); return; }
      if (root.document && root.document.hidden) { if (raf) { root.cancelAnimationFrame(raf); raf = 0; } lastProc = null; }
      else resume();
    };
    Object.defineProperty(ctl, 'scene', { get: function () { return scene; }, enumerable: true });
    Object.defineProperty(ctl, 'stopped', { get: function () { return stopped; }, enumerable: true });
    Object.defineProperty(ctl, 'yaw', {
      get: function () { return num(scene.camera.yaw, LowPoly.defaults.yaw); },
      set: function (v) { scene.camera.yaw = num(v, 0); dirty = true; wake(); },
      enumerable: true
    });
    Object.defineProperty(ctl, 'pitch', {
      get: function () { return num(scene.camera.pitch, LowPoly.defaults.pitch); },
      set: function (v) { scene.camera.pitch = clamp(num(v, 0), -89.9, 89.9); dirty = true; wake(); },
      enumerable: true
    });

    // --- wire up ---
    setAria();
    try { canvas.__lowpolyView = ctl; } catch (e6) { /* ignore */ }
    if (dragOn) {
      canvas.style.touchAction = 'pan-y';
      canvas.style.cursor = 'grab';
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
      canvas.addEventListener('dragstart', onDragStart);
    }
    if (keysOn) {
      if (!canvas.hasAttribute('tabindex')) canvas.setAttribute('tabindex', '0');
      canvas.addEventListener('keydown', onKey);
    }
    if (typeof root.ResizeObserver === 'function') {
      var lastRW = canvas.clientWidth, lastRH = canvas.clientHeight;
      ro = new root.ResizeObserver(function () {
        var w = canvas.clientWidth, h = canvas.clientHeight;
        if (Math.abs(w - lastRW) <= 1 && Math.abs(h - lastRH) <= 1) return;
        lastRW = w; lastRH = h;
        dirty = true; wake();
      });
      ro.observe(canvas);
    }
    if (typeof root.IntersectionObserver === 'function') {
      io = new root.IntersectionObserver(function (entries) {
        var en = entries[entries.length - 1];
        var off = !en.isIntersecting;
        if (off === offscreen) return;
        offscreen = off;
        if (off) { if (raf) { root.cancelAnimationFrame(raf); raf = 0; } lastProc = null; }
        else resume();
      });
      io.observe(canvas);
    }
    hookVisibility();
    // forget views whose canvas is gone before adding a new one
    var vi;
    for (vi = views.length - 1; vi >= 0; vi--) if (views[vi]._vis) views[vi]._vis();
    views.push(ctl);
    if (connected() || canvas.width > 0) draw();
    wake();
    return ctl;
  }
  LowPoly.view = view;

  root.LowPoly = LowPoly;
})(this);
