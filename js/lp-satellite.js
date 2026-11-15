/*
 * lp-satellite.js: the satellite the player is building, as one low-poly scene.
 * Plain ES5, loaded after lowpoly.js and the part and body files (lp-parts-*.js). Creates no
 * globals: it only adds LowPoly.scenes.satellite.
 *
 * LowPoly.scenes.satellite(opts) -> {scene, update(t, dt), label, ids, anchor(id, aspect), tris}
 *   opts.parts   the design's part ids, in the order they were added.
 *   opts.data    the game's PARTS list (for names, categories and the body choice). Read only.
 *   opts.change  null, or {id, kind: "add" | "remove"}: the click that just happened. The part just
 *                added flies in from outside the frame and settles; a part just removed slides out
 *                and fades. It plays once, when this scene is first drawn.
 *   opts.size    "bench" (default) or "small" (the Readiness review: a fixed pose, no spin, no
 *                animation).
 *   opts.spin    degrees per second the camera turns round the satellite (bench only, default 0).
 *   opts.yaw, opts.pitch   start pose of the camera (default 32 and 16).
 *   opts.aspect  width / height of the canvas the scene is drawn in (default 4 / 3), for framing.
 *
 * How it is put together. The first "structure" part is the body (LowPoly.models.body); every
 * other part goes on the body's ports for its category (LowPoly.models.body[...].ports), in the
 * order the player added them. Ports are best slot first; when a category has more parts than
 * ports, the extra part is stacked outward on a port already used, on top of the part there, so
 * two parts never sit inside each other. With no body the parts are mounted on an assembly
 * cradle: an open frame on a pedestal with its own ports, so a half-built design still reads as a
 * build in progress. Unknown ids use the engine's placeholder models (LowPoly.model never throws).
 * The camera is framed on the bounding sphere of the finished satellite, so the model stays in
 * view from any angle and the part flying in starts outside the frame.
 * Under prefers-reduced-motion nothing moves: no spin, no fly-in, no ghost.
 *
 * LowPoly.scenes.satellite.sample(name) -> a copy of a sample design's part ids, or null.
 *   sample.names: "sea-ice", "explorer-1", "tiros-1", "nimbus-1", "cubesat-12u", "careless",
 *   "overfull".
 */
(function () {
  'use strict';
  if (typeof LowPoly === 'undefined' || !LowPoly || !LowPoly.scenes || !LowPoly.models) return;
  var L = LowPoly;
  var DEG = Math.PI / 180;
  var KINDS = ['instrument', 'power', 'comms', 'computer', 'propulsion', 'attitude'];
  var NADIR = [0, -1, 0], ZENITH = [0, 1, 0], AFT = [0, 0, 1];
  var GAP = 0.03;                 // between two parts stacked on one port
  var FLY_S = 0.7, GONE_S = 0.55;  // fly-in and slide-out times, seconds
  var FOV = 30;

  // ---------------------------------------------------------------- small helpers
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a) { return Math.sqrt(dot(a, a)); }
  function unit(a) { var l = len(a); return l > 1e-12 ? mul(a, 1 / l) : [0, 1, 0]; }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function isArr(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  function reduced() {
    try { return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }
  function easeOut(u) { u = Math.max(0, Math.min(1, u)); var v = 1 - u; return 1 - v * v * v; }
  function easeIn(u) { u = Math.max(0, Math.min(1, u)); return u * u; }

  // Built models are kept per id: a scene is made on every click and meshes never change.
  var models = { body: {}, part: {} }, placedCache = {};
  function modelOf(kind, id, part) {
    var c = models[kind];
    if (!c[id]) c[id] = L.model(kind, id, part);
    return c[id];
  }
  function placed(id, mesh, port, off) {
    var key = id + '|' + port.pos.join(',') + '|' + port.normal.join(',') + '|' + port.roll + '|' + off.toFixed(4);
    if (!placedCache[key]) {
      placedCache[key] = L.place(mesh, { pos: add(port.pos, mul(unit(port.normal), off)), normal: port.normal, roll: port.roll });
    }
    return placedCache[key];
  }

  // ---------------------------------------------------------------- the cradle (no body yet)
  // A port, with the roll worked out like the body files do: the part's +Z looks along `look`.
  var PROBE = { tris: [{ v: [[0, 0, 0], [0, 0, 1], [0, 1, 0]], c: 'steel', e: 0 }] };
  function port(pos, normal, look) {
    var n = unit(normal), roll = 0;
    var z1 = L.place(PROBE, { pos: [0, 0, 0], normal: n, roll: 0 }).tris[0].v[1];
    var d = sub(look, mul(n, dot(look, n)));
    if (len(d) > 1e-6) { d = unit(d); roll = Math.atan2(dot(n, cross(z1, d)), dot(z1, d)) / DEG; }
    roll = Math.round(roll * 10) / 10;
    return { pos: pos, normal: n, roll: roll === 0 ? 0 : roll };
  }
  var CRADLE = null;
  function cradle() {
    if (CRADLE) return CRADLE;
    var X = 0.5, Y = 0.55, Z = 0.5, T = 0.05, k, parts = [];
    // The open jig: twelve edges, painted safety yellow, with dark corner blocks.
    var edges = [];
    for (k = 0; k < 4; k++) {
      var sx = k & 1 ? 1 : -1, sz = k & 2 ? 1 : -1;
      edges.push(L.move(L.box(T, 2 * Y, T, 'yellow'), sx * X, 0, sz * Z));
      edges.push(L.move(L.box(2 * X, T, T, 'yellow'), 0, (k & 1 ? 1 : -1) * Y, (k & 2 ? 1 : -1) * Z));
      edges.push(L.move(L.box(T, T, 2 * Z, 'yellow'), (k & 1 ? 1 : -1) * X, (k & 2 ? 1 : -1) * Y, 0));
    }
    for (k = 0; k < 8; k++) edges.push(L.move(L.box(T * 1.5, T * 1.5, T * 1.5, 'graphite'), (k & 1 ? 1 : -1) * X, (k & 2 ? 1 : -1) * Y, (k & 4 ? 1 : -1) * Z));
    // A cross brace under the frame, the pedestal and its foot.
    edges.push(L.move(L.box(2 * X, T, T, 'metalDark'), 0, -Y, 0), L.move(L.box(T, T, 2 * Z, 'metalDark'), 0, -Y, 0));
    parts.push(L.merge(edges));
    parts.push(L.move(L.cylinder(0.07, 0.07, 0.6, 6, 'graphite'), 0, -Y - 0.3, 0));
    parts.push(L.move(L.cylinder(0.12, 0.16, 0.08, 6, 'steel'), 0, -Y - 0.04, 0));
    parts.push(L.move(L.cylinder(0.42, 0.46, 0.07, 8, 'metalDark', { phase: 22.5 }), 0, -Y - 0.635, 0));
    var mesh = L.merge(parts);
    var ports = {
      power: [port([X, 0.05, 0], [1, 0, 0], AFT), port([-X, 0.05, 0], [-1, 0, 0], AFT), port([0, 0.28, -Z], [0, 0, -1], ZENITH)],
      instrument: [port([0, -0.27, Z], [0, 0, 1], NADIR), port([0, -0.27, -Z], [0, 0, -1], NADIR), port([0.27, -0.27, -Z], [0, 0, -1], NADIR)],
      comms: [port([-0.25, Y, -0.25], ZENITH, AFT), port([0.25, Y, -0.25], ZENITH, AFT), port([0, Y, 0], ZENITH, AFT)],
      computer: [port([-0.27, 0.27, Z], [0, 0, 1], ZENITH), port([0.27, 0.27, Z], [0, 0, 1], ZENITH), port([-0.27, 0.28, -Z], [0, 0, -1], ZENITH)],
      attitude: [port([-0.25, Y, 0.25], ZENITH, AFT), port([0.25, Y, 0.25], ZENITH, AFT)],
      propulsion: [port([0.3, -Y, 0.3], NADIR, AFT), port([-0.3, -Y, -0.3], NADIR, AFT)]
    };
    CRADLE = { mesh: mesh, ports: ports, label: 'an assembly cradle' };
    return CRADLE;
  }
  // A small dark mounting plate behind a part fitted to the cradle, so it is held by something.
  var PLATE = null;
  function plateAt(p) {
    if (!PLATE) PLATE = L.move(L.box(0.2, 0.02, 0.2, 'graphite'), 0, -0.01, 0);
    return placed('plate', PLATE, p, 0);
  }

  // ---------------------------------------------------------------- layout
  function partOf(data, id) {
    var i;
    for (i = 0; i < data.length; i++) if (data[i] && data[i].id === id) return data[i];
    return null;
  }
  function kindOf(part) {
    var c = part && part.category;
    return KINDS.indexOf(c) !== -1 ? c : 'computer';
  }

  // ids -> {body: {id, part, model} | null, frame: {mesh, ports, label}, items: [{id, part, kind, mesh, normal, port}]}
  function layout(ids, data) {
    var bodyItem = null, rest = [], i;
    for (i = 0; i < ids.length; i++) {
      var id = String(ids[i]), part = partOf(data, id);
      if (part && part.category === 'structure' && !bodyItem) bodyItem = { id: id, part: part };
      else rest.push({ id: id, part: part });
    }
    var frame;
    if (bodyItem) {
      bodyItem.model = modelOf('body', bodyItem.id, bodyItem.part);
      frame = { mesh: bodyItem.model.mesh, ports: bodyItem.model.ports || {}, label: bodyItem.model.label };
    } else frame = cradle();
    var used = {}, stack = {}, items = [];
    for (i = 0; i < rest.length; i++) {
      var it = rest[i], kind = kindOf(it.part);
      var list = isArr(frame.ports[kind]) && frame.ports[kind].length ? frame.ports[kind] : frame.ports.computer;
      if (!isArr(list) || !list.length) list = [port([0, 0.75, 0], ZENITH, AFT)];
      var n = used[kind] || 0;
      used[kind] = n + 1;
      var pi = n % list.length, p = list[pi], key = kind + pi;
      var m = modelOf('part', it.id, it.part);
      var off = stack[key] || 0;
      stack[key] = off + num(m.size && m.size[1], 0.4) + GAP;
      items.push({ id: it.id, part: it.part, kind: kind, mesh: placed(it.id, m.mesh, p, off), normal: unit(p.normal),
        port: p, stacked: off > 0, plate: !bodyItem && off === 0 ? plateAt(p) : null });
    }
    return { body: bodyItem, frame: frame, items: items };
  }

  // Bounding sphere (centre of the bounding box, radius to the farthest vertex) of some meshes.
  function sphereOf(meshes) {
    var lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], i, j, k, v;
    for (i = 0; i < meshes.length; i++) {
      var b = L.bounds(meshes[i]);
      if (!meshes[i].tris.length) continue;
      for (k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], b.min[k]); hi[k] = Math.max(hi[k], b.max[k]); }
    }
    if (!(lo[0] <= hi[0])) return { c: [0, 0, 0], r: 1 };
    var c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], r2 = 0;
    for (i = 0; i < meshes.length; i++) {
      var t = meshes[i].tris;
      for (j = 0; j < t.length; j++) for (k = 0; k < 3; k++) {
        v = t[j].v[k];
        var dx = v[0] - c[0], dy = v[1] - c[1], dz = v[2] - c[2], d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > r2) r2 = d2;
      }
    }
    return { c: c, r: Math.max(0.3, Math.sqrt(r2)) };
  }

  // ---------------------------------------------------------------- the label
  function nameOf(item) {
    var n = item.part && typeof item.part.name === 'string' && item.part.name ? item.part.name : item.id;
    return String(n).replace(/\s*\(.*?\)/g, '');
  }
  function joinNames(names) {
    if (names.length < 2) return names.join('');
    return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  }
  function labelFor(lay, small) {
    var names = [], i;
    for (i = 0; i < lay.items.length; i++) names.push(nameOf(lay.items[i]));
    var count = lay.items.length + (lay.body ? 1 : 0);
    var where = small ? 'Your satellite' : 'Your satellite on the bench';
    if (!count) return 'An empty assembly cradle on the bench: no parts on board yet.';
    var parts = count + (count === 1 ? ' part.' : ' parts.');
    if (lay.body) {
      var b = nameOf(lay.body);
      return where + ': ' + b + (names.length ? ' with ' + joinNames(names) : ', nothing fitted to it yet') + '. ' + parts;
    }
    return where + ', on an assembly cradle with no body yet: ' + joinNames(names) + '. ' + parts;
  }

  // ---------------------------------------------------------------- the scene
  function satellite(opts) {
    opts = opts || {};
    var ids = isArr(opts.parts) ? opts.parts.slice() : [];
    var data = isArr(opts.data) ? opts.data : [];
    var small = opts.size === 'small';
    var change = !small && opts.change && opts.change.id ? opts.change : null;
    var still = small || reduced();
    var lay = layout(ids, data);

    var items = [], meshes = [lay.frame.mesh], i;
    var bodyEntry = { mesh: lay.frame.mesh, pos: [0, 0, 0] };
    items.push(bodyEntry);
    var entries = {};
    for (i = 0; i < lay.items.length; i++) {
      var it = lay.items[i];
      var e = { mesh: it.mesh, pos: [0, 0, 0] };
      entries[it.id] = { entry: e, item: it };
      items.push(e);
      meshes.push(it.mesh);
      if (it.plate) { items.push({ mesh: it.plate }); meshes.push(it.plate); }
    }
    var fit = sphereOf(meshes);
    var aspect = num(opts.aspect, 4 / 3);
    var camera = { yaw: num(opts.yaw, 32), pitch: num(opts.pitch, small ? 14 : 16), dist: 1, target: fit.c.slice(), fov: FOV };
    // Frame the finished satellite: the closest camera that keeps every vertex in view at this pitch, for
    // every yaw it can turn to (12 samples round the clock on the bench; just this one for "small").
    var verts = [];
    for (i = 0; i < meshes.length; i++) {
      var tr = meshes[i].tris, j, k;
      for (j = 0; j < tr.length; j++) for (k = 0; k < 3; k++) verts.push(sub(tr[j].v[k], fit.c));
    }
    var fitPitch = null;
    function fitDist() {
      var tv = Math.tan(FOV * DEG / 2), th = tv * aspect, pt = num(camera.pitch, 16) * DEG, need = 0, s, q;
      var cp = Math.cos(pt), sp = Math.sin(pt), yaws = small ? [num(camera.yaw, 32)] : [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
      for (s = 0; s < yaws.length; s++) {
        var yw = yaws[s] * DEG, cy = Math.cos(yw), sy = Math.sin(yw);
        for (q = 0; q < verts.length; q++) {
          var v = verts[q];
          var x = v[0] * cy - v[2] * sy, y = -v[0] * sp * sy + v[1] * cp - v[2] * sp * cy, z = v[0] * sy * cp + v[1] * sp + v[2] * cy * cp;
          var d = Math.max(Math.abs(x) / th, Math.abs(y) / tv) + z;
          if (d > need) need = d;
        }
      }
      fitPitch = camera.pitch;
      return Math.max(need * 1.04, fit.r * 1.2);
    }
    camera.dist = fitDist();

    // What moves: the part just added, or the ghost of the part just removed.
    var fly = null, ghost = null;
    if (change && !still && change.kind === 'add') {
      var hit = entries[change.id];
      if (lay.body && lay.body.id === change.id) {
        // A new body: the whole satellite drops onto the bench from above.
        fly = { entries: items.slice(), dir: [0, 1, 0], far: fit.r * 2.4 };
      } else if (hit) {
        fly = { entries: [hit.entry], dir: hit.item.normal, far: fit.r * 2.2 };
      }
    } else if (change && !still && change.kind === 'remove' && ids.indexOf(change.id) === -1) {
      // Where the part was: the design just before the click (opts.before) when the caller knows it,
      // else this design with the part put back last.
      var prev = isArr(opts.before) && opts.before.indexOf(change.id) !== -1 ? opts.before : ids.concat([change.id]);
      var before = layout(prev, data), gone = null;
      if (before.body && before.body.id === change.id && !lay.body) gone = { mesh: before.frame.mesh, dir: [0, -1, 0] };
      else {
        for (i = 0; i < before.items.length; i++) if (before.items[i].id === change.id) gone = { mesh: before.items[i].mesh, dir: before.items[i].normal };
      }
      if (gone) {
        ghost = { entry: { mesh: gone.mesh, pos: [0, 0, 0], alpha: 0.9 }, dir: gone.dir, far: fit.r * 1.4 };
        items.push(ghost.entry);
      }
    }
    function poseFly(u) {
      var k = fly.far * (1 - easeOut(u)), j;
      for (j = 0; j < fly.entries.length; j++) fly.entries[j].pos = mul(fly.dir, k);
    }
    function poseGhost(u) {
      ghost.entry.pos = mul(ghost.dir, ghost.far * easeIn(u));
      ghost.entry.alpha = 0.9 * (1 - u);
      ghost.entry.hidden = u >= 1;
    }
    if (fly) poseFly(0);
    if (ghost) poseGhost(0);

    var label = labelFor(lay, small);
    var scene = { items: items, camera: camera, background: null, label: label };
    var spin = still ? 0 : num(opts.spin, 0);
    var start = null, done = !fly && !ghost;

    function update(t, dt) {
      var moved = false;
      if (camera.pitch !== fitPitch) { camera.dist = fitDist(); moved = true; }   // dragged up or down: frame again
      if (spin && !reduced()) {
        camera.yaw = num(camera.yaw, 32) - spin * num(dt, 0);
        if (camera.yaw < -360 || camera.yaw > 360) camera.yaw %= 360;
        moved = true;
      }
      if (!done) {
        if (reduced()) {   // the setting changed while this was on screen: jump to the end
          if (fly) poseFly(1);
          if (ghost) poseGhost(1);
          done = true;
          return true;
        }
        if (start === null) start = num(t, 0);
        var s = num(t, 0) - start;
        if (fly) poseFly(s / FLY_S);
        if (ghost) poseGhost(s / GONE_S);
        if (s >= Math.max(fly ? FLY_S : 0, ghost ? GONE_S : 0)) done = true;
        moved = true;
      }
      return moved;
    }

    // Where a part sits on the canvas once settled: [x, y] as fractions of the canvas (0..1), the top
    // of its bounding box. For a name tag in the page above the canvas. null for an unknown id.
    function anchor(id, asp) {
      var m = null;
      if (lay.body && lay.body.id === id) m = lay.frame.mesh;
      else if (entries[id]) m = entries[id].item.mesh;
      if (!m) return null;
      var b = L.bounds(m), p = [b.center[0], b.max[1], b.center[2]];
      var a = num(asp, aspect), yw = num(camera.yaw, 32) * DEG, pt = num(camera.pitch, 16) * DEG;
      var back = [Math.sin(yw) * Math.cos(pt), Math.sin(pt), Math.cos(yw) * Math.cos(pt)];
      var right = [Math.cos(yw), 0, -Math.sin(yw)], up = [-Math.sin(pt) * Math.sin(yw), Math.cos(pt), -Math.sin(pt) * Math.cos(yw)];
      var eye = add(camera.target, mul(back, camera.dist)), rel = sub(p, eye), depth = -dot(rel, back);
      if (!(depth > 1e-6)) return null;
      var tv = Math.tan(FOV * DEG / 2);
      return [0.5 + dot(rel, right) / depth / (2 * tv * a), 0.5 - dot(rel, up) / depth / (2 * tv)];
    }

    var tris = 0;
    for (i = 0; i < items.length; i++) tris += items[i].mesh.tris.length;
    var placedIds = [];
    if (lay.body) placedIds.push(lay.body.id);
    for (i = 0; i < lay.items.length; i++) placedIds.push(lay.items[i].id);
    return { scene: scene, update: update, label: label, ids: placedIds, anchor: anchor, tris: tris };
  }

  // ---------------------------------------------------------------- sample designs (for the gallery and tests)
  var SAMPLES = {
    'sea-ice': ['smallsat-bus', 'sar-radar', 'solar-large', 'radio-xband', 'obc-basic', 'battery-28v', 'prop-green-large'],
    'explorer-1': ['explorer-body', 'cosmic-ray-counter', 'mercury-battery', 'minitrack-beacon', 'vhf-telemetry', 'command-timer', 'spin-stabilised'],
    'tiros-1': ['drum-body', 'vidicon-camera', 'silicon-cells', 'nicad-battery', 'vhf-telemetry', 'tape-recorder', 'command-timer', 'spin-stabilised'],
    'nimbus-1': ['nimbus-bus', 'avcs-camera', 'thermal-imager', 'n-on-p-cells', 'nicad-battery', 'pcm-telemetry', 'tape-recorder', 'reaction-wheels'],
    'cubesat-12u': ['cubesat-12u', 'optical-camera', 'solar-small', 'battery-28v', 'radio-uhf', 'obc-basic', 'reaction-wheels', 'prop-ion'],
    'careless': ['optical-camera', 'solar-small', 'radio-sband', 'obc-basic'],
    'overfull': ['smallsat-bus', 'sar-radar', 'optical-camera', 'thermal-imager', 'solar-large', 'solar-small', 'battery-28v',
      'radio-xband', 'radio-sband', 'radio-uhf', 'obc-basic', 'obc-radtol', 'obc-payload', 'prop-green-large', 'reaction-wheels']
  };
  satellite.sample = function (name) { return SAMPLES[name] ? SAMPLES[name].slice() : null; };
  satellite.sample.names = Object.keys(SAMPLES);

  // The finished satellite as ONE mesh, for a scene that flies it (LowPoly.scenes.earth's opts.mesh): every part placed on
  // the body exactly as the bench shows it (panels out), the lot centred on its bounding sphere, nadir -Y as built.
  // opts = {parts, data}. Returns {mesh, radius} (radius: of that sphere), or null when there are no parts.
  satellite.flat = function (opts) {
    opts = opts || {};
    var ids = isArr(opts.parts) ? opts.parts.slice() : [];
    if (!ids.length) return null;
    var lay = layout(ids, isArr(opts.data) ? opts.data : []), meshes = [lay.frame.mesh], i;
    for (i = 0; i < lay.items.length; i++) {
      meshes.push(lay.items[i].mesh);
      if (lay.items[i].plate) meshes.push(lay.items[i].plate);
    }
    var s = sphereOf(meshes);
    return { mesh: L.move(L.merge(meshes), -s.c[0], -s.c[1], -s.c[2]), radius: s.r };
  };

  L.scenes.satellite = satellite;
})();
