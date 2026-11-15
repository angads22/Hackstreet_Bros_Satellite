// Playwright proofs for the LowPoly engine. Run: node test-browser.js [section ...]
// Sections: render winding perf loop input size globals css palette decals fill
var pw = require('playwright'), path = require('path'), fs = require('fs');
var PAGE = 'file://' + path.join(__dirname, 'testpage.html');
var BARE = 'file://' + path.join(__dirname, 'bare.html');
var SHOTS = path.join(__dirname, 'shots');
var results = [], section = '';
function check(name, cond, detail) {
  results.push({ section: section, name: name, ok: !!cond, detail: detail === undefined ? '' : detail });
  console.log((cond ? '  ok   ' : '  FAIL ') + '[' + section + '] ' + name + (detail !== undefined && detail !== '' ? '  -> ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''));
}
var only = process.argv.slice(2);
function want(s) { return !only.length || only.indexOf(s) >= 0; }

async function newPage(browser, opts) {
  var ctx = await browser.newContext(opts || { viewport: { width: 900, height: 700 } });
  var page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', function (e) { page.errors.push(e.message); console.log('PAGE ERROR', e.message); });
  page.on('console', function (m) { if (m.type() === 'error') { page.errors.push(m.text()); console.log('CONSOLE ERROR', m.text()); } });
  return { ctx: ctx, page: page };
}

(async function () {
  var browser = await pw.chromium.launch();
  var h;

  // ------------------------------------------------------------------ (1) render basics
  if (want('render')) {
    section = '1 render';
    h = await newPage(browser); await h.page.goto(PAGE);
    var r = await h.page.evaluate(function () {
      var L = LowPoly, out = {};
      // (a) lit cube: top lighter than the left side, right side (away from light) darkest. light from upper left front.
      var c = T.mkCanvas(200, 200);
      L.render(c, { items: [{ mesh: L.box(1, 1, 1, 'white') }], camera: { yaw: 35, pitch: 30, dist: 5, target: [0, 0, 0], fov: 35 }, light: { dir: [-0.5, 0.8, 0.6], key: '#ffffff', ambient: '#303030' }, background: null }, {});
      out.cubeTop = T.px(c.width ? c : c, 100, 70); out.cubeLeft = T.px(c, 80, 120); out.cubeRight = T.px(c, 125, 120);
      out.cubeSize = [c.width, c.height];
      // (b) light.dir [0,1,0] lights top faces
      var c2 = T.mkCanvas(200, 200);
      var sc = { items: [{ mesh: L.box(1, 1, 1, 'white') }], camera: { yaw: 0, pitch: 35, dist: 5, target: [0, 0, 0] }, light: { dir: [0, 1, 0], key: '#ffffff', ambient: '#000000', hemi: 0 }, background: null };
      L.render(c2, sc, { ss: 1 });
      out.upTop = T.px(c2, 100, 80); out.upFront = T.px(c2, 100, 130);
      sc.light.dir = [0, -1, 0]; L.render(c2, sc, { ss: 1 });
      out.downTop = T.px(c2, 100, 80);
      // (c) camera yaw 0 pitch 0 shows +Z face
      var m = L.merge([L.box(1, 1, 1, 'steel'), L.move(L.box(0.5, 0.5, 0.05, 'red'), 0, 0, 0.5)]);
      var c3 = T.mkCanvas(100, 100);
      L.render(c3, { items: [{ mesh: m }], camera: { yaw: 0, pitch: 0, dist: 5, target: [0, 0, 0] }, background: null }, { ss: 1 });
      out.frontCenter = T.px(c3, 50, 50);
      L.render(c3, { items: [{ mesh: m }], camera: { yaw: 180, pitch: 0, dist: 5, target: [0, 0, 0] }, background: null }, { ss: 1 });
      out.backCenter = T.px(c3, 50, 50);
      // (d) +X is to the right: red box at +X appears on the right half
      var c4 = T.mkCanvas(100, 100);
      L.render(c4, { items: [{ mesh: L.box(0.4, 0.4, 0.4, 'red'), pos: [1, 0, 0] }, { mesh: L.box(0.4, 0.4, 0.4, 'teal'), pos: [-1, 0, 0] }, { mesh: L.box(0.4, 0.4, 0.4, 'green'), pos: [0, 1, 0] }], camera: { yaw: 0, pitch: 0, dist: 8, target: [0, 0, 0] }, light: { dir: [0, 0, 1], key: '#ffffff', ambient: '#202020' }, background: null }, { ss: 1 });
      out.right = T.px(c4, 70, 50); out.left = T.px(c4, 30, 50); out.top = T.px(c4, 50, 30);
      return out;
    });
    var bright = function (p) { return p[0] + p[1] + p[2]; };
    check('cube: top face lighter than left face, left lighter than the right (shadow) face', bright(r.cubeTop) > bright(r.cubeLeft) && bright(r.cubeLeft) > bright(r.cubeRight), { top: r.cubeTop, left: r.cubeLeft, right: r.cubeRight });
    check('cube canvas is 200x200 (DPR 1, 1:1)', r.cubeSize[0] === 200 && r.cubeSize[1] === 200, r.cubeSize);
    check('light.dir [0,1,0] lights top faces (top bright, front black)', r.upTop[0] > 200 && r.upFront[0] < 10, { top: r.upTop, front: r.upFront });
    check('light.dir [0,-1,0] leaves the top dark', r.downTop[0] < 10, r.downTop);
    check('yaw 0 pitch 0 looks at the +Z face (red decal seen), yaw 180 sees the back (grey)', r.frontCenter[0] > r.frontCenter[2] + 40 && Math.abs(r.backCenter[0] - r.backCenter[2]) < 30, { front: r.frontCenter, back: r.backCenter });
    check('+X is screen right, +Y is screen up', r.right[0] > r.right[1] + 40 && r.left[2] > r.left[0] && r.top[1] > r.top[0] + 20, { right: r.right, left: r.left, top: r.top });
    check('no page errors', h.page.errors.length === 0, h.page.errors);
    await h.ctx.close();

    // depth buffer: two thin slabs crossing. Seen from yaw 45 (ortho), the right half of the overlap must be slab A (red), the left half slab B (teal).
    h = await newPage(browser); await h.page.goto(PAGE);
    var d = await h.page.evaluate(function () {
      var L = LowPoly, A = L.box(2, 2, 0.1, 'red'), B = L.box(0.1, 2, 2, 'teal');
      function shot(items) {
        var c = T.mkCanvas(200, 200);
        L.render(c, { items: items, camera: { yaw: 45, pitch: 0, ortho: true, size: 3, dist: 10, target: [0, 0, 0] }, light: { dir: [0, 0, 1], key: '#ffffff', ambient: '#ffffff', hemi: 0 }, background: null }, { ss: 1 });
        return c;
      }
      var c1 = shot([{ mesh: A }, { mesh: B }]), c2 = shot([{ mesh: B }, { mesh: A }]);
      var a1 = T.data(c1), a2 = T.data(c2);
      var res = { orderDiff: T.diffCount(a1, a2, 0), samples: [] };
      [-40, -30, -10, 10, 30, 40].forEach(function (dx) { res.samples.push([dx, T.px(c1, 100 + dx, 100), T.px(c2, 100 + dx, 100)]); });
      // same in one merged mesh, with opposite triangle order
      var c3 = shot([{ mesh: L.merge([A, B]) }]), c4 = shot([{ mesh: L.merge([B, A]) }]);
      res.mergeDiff = T.diffCount(T.data(c3), T.data(c4), 0);
      return res;
    });
    var okDepth = d.samples.every(function (s) { var right = s[0] > 0; var p = s[1], q = s[2]; return right ? (p[0] > p[2] + 40 && q[0] > q[2] + 40) : (p[2] > p[0] + 20 && q[2] > q[0] + 20); });
    check('interpenetrating slabs: right of the cut is slab A, left is slab B, for both draw orders', okDepth, d.samples.map(function (s) { return s[0] + ':' + s[1].slice(0, 3); }));
    check('draw order does not change the image (0 differing pixels, separate items and one merged mesh)', d.orderDiff === 0 && d.mergeDiff === 0, { items: d.orderDiff, merged: d.mergeDiff });
    await h.ctx.close();
  }

  // ------------------------------------------------------------------ (2) winding, culling
  if (want('winding')) {
    section = '2 winding';
    h = await newPage(browser); await h.page.goto(PAGE);
    var w = await h.page.evaluate(function () {
      var L = LowPoly, res = { rows: [], neg: {} };
      var angles = [[0, 0], [60, 25], [130, -30], [200, 35], [270, -20], [330, 75], [20, -75], [95, 10]];
      var c = T.mkCanvas(128, 128);
      T.closedBuilders().forEach(function (b) {
        var bad = 0;
        angles.forEach(function (a) {
          var cam = { yaw: a[0], pitch: a[1], fov: 35 };
          L.render(c, { items: [{ mesh: b[1] }], camera: cam, background: null }, { ss: 1 });
          var A = T.data(c); A = new Uint8ClampedArray(A);
          L.render(c, { items: [{ mesh: L.merge([T.rev(b[1]), b[1]]) }], camera: cam, background: null }, { ss: 1 });
          bad += T.diffCount(A, T.data(c), 0);
        });
        res.rows.push([b[0], bad]);
      });
      // negative control: an inside-out mesh must NOT equal the double-sided picture
      ['box', 'sphere2'].forEach(function (n) {
        var m = n === 'box' ? L.box(1, 1.4, 0.8, 'steel') : L.sphere(0.7, 2, 'steel'), cam = { yaw: 60, pitch: 25 }, bad = 0;
        L.render(c, { items: [{ mesh: T.rev(m) }], camera: cam, background: null }, { ss: 1 });
        var A = new Uint8ClampedArray(T.data(c));
        L.render(c, { items: [{ mesh: L.merge([T.rev(m), m]) }], camera: cam, background: null }, { ss: 1 });
        res.neg[n] = T.diffCount(A, T.data(c), 0);
      });
      // single-sided open shapes vanish from behind, double-sided do not
      var q = L.quad([-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0], 'red'), qd = L.quad([-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0], 'red', true);
      function cover(m, yaw) { L.render(c, { items: [{ mesh: m }], camera: { yaw: yaw, pitch: 0, dist: 6, target: [0, 0, 0] }, background: null }, { ss: 1 }); var d = T.data(c), n = 0; for (var i = 3; i < d.length; i += 4) if (d[i]) n++; return n; }
      res.quad = [cover(q, 0), cover(q, 180), cover(qd, 0), cover(qd, 180)];
      var di = L.disc(1, 12, 'red'), dd = L.disc(1, 12, 'red', true);
      function coverP(m, pitch) { L.render(c, { items: [{ mesh: m }], camera: { yaw: 0, pitch: pitch, dist: 6, target: [0, 0, 0] }, background: null }, { ss: 1 }); var d = T.data(c), n = 0; for (var i = 3; i < d.length; i += 4) if (d[i]) n++; return n; }
      res.disc = [coverP(di, 50), coverP(di, -50), coverP(dd, 50), coverP(dd, -50)];
      return res;
    });
    w.rows.forEach(function (row) { check('culled render == double-sided render, 8 angles: ' + row[0], row[1] === 0, row[1] + ' differing pixels'); });
    check('negative control: inside-out meshes are detected (box, sphere differ from double-sided)', w.neg.box > 100 && w.neg.sphere2 > 100, w.neg);
    check('single-sided quad: seen from the front, gone from behind; double-sided: both', w.quad[0] > 1000 && w.quad[1] === 0 && w.quad[2] > 1000 && w.quad[3] > 1000, w.quad);
    check('single-sided disc: seen from above only; double-sided from both', w.disc[0] > 500 && w.disc[1] === 0 && w.disc[2] > 500 && w.disc[3] > 500, w.disc);
    await h.ctx.close();
  }

  // ------------------------------------------------------------------ (3) frame time
  if (want('perf')) {
    section = '3 perf';
    var sizes = [[800, 600, 1]];
    for (var si = 0; si < sizes.length; si++) {
      var s = sizes[si];
      h = await newPage(browser, { viewport: { width: s[0] + 20, height: s[1] + 20 }, deviceScaleFactor: s[2] });
      await h.page.goto('file://' + path.join(__dirname, 'perf.html'));
      for (var n of [600, 1500]) {
        var pr = await h.page.evaluate(function (n) { var a = timeFrames(n, 100, false), b = timeFrames(n, 100, true); return { a: a, b: b }; }, n);
        var limit = n === 600 ? 12 : 25;
        check(n + '-triangle scene at 800x600, 100 frames: mean ' + pr.a.mean.toFixed(2) + ' ms, median ' + pr.a.median.toFixed(2) + ', p95 ' + pr.a.p95.toFixed(2) + ', max ' + pr.a.max.toFixed(2) + ' (limit ' + limit + ' ms)', pr.a.p95 <= limit, { tris: pr.a.tris, drawnAfterCulling: pr.a.info.tris, buffer: pr.a.info.width + 'x' + pr.a.info.height, ss: pr.a.info.ss });
        check(n + ' tris with the canvas read back every frame (forces the upload): mean ' + pr.b.mean.toFixed(2) + ' ms, p95 ' + pr.b.p95.toFixed(2), pr.b.p95 <= limit, '');
      }
      await h.ctx.close();
    }
    // and the sizes people will actually see
    var other = [[480, 360, 1], [480, 480, 2], [96, 96, 2]];
    for (var oi = 0; oi < other.length; oi++) {
      var o = other[oi];
      h = await newPage(browser, { viewport: { width: o[0] + 20, height: o[1] + 20 }, deviceScaleFactor: o[2] });
      await h.page.goto('file://' + path.join(__dirname, 'perf.html'));
      await h.page.evaluate(function (o) { var c = document.getElementById('c'); c.style.width = o[0] + 'px'; c.style.height = o[1] + 'px'; }, o);
      var po = await h.page.evaluate(function () { return timeFrames(1500, 100, true); });
      check('1500 tris at ' + o[0] + 'x' + o[1] + ' DPR ' + o[2] + ': mean ' + po.mean.toFixed(2) + ' ms, p95 ' + po.p95.toFixed(2), po.p95 <= 25, { buffer: po.info.width + 'x' + po.info.height, ss: po.info.ss });
      await h.ctx.close();
    }
  }

  // ------------------------------------------------------------------ (4) loop
  if (want('loop')) {
    section = '4 loop';
    // a) removal stops the loop; hidden pauses it; resume works
    h = await newPage(browser); await h.page.goto(PAGE);
    var lp = await h.page.evaluate(async function () {
      var L = LowPoly, out = {};
      window.__raf = 0;
      var orig = window.requestAnimationFrame;
      window.requestAnimationFrame = function (f) { window.__raf++; return orig.call(window, f); };
      var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
      var c = T.mkCanvas(200, 150);
      var v = L.view(c, { items: [{ mesh: L.box(1, 1, 1, 'steel') }], camera: { dist: 5 }, background: { color: 'space' } }, { spin: 60 });
      await sleep(400);
      out.spinMoved = Math.abs(v.yaw - 25) > 5; out.frames1 = L.stats.frames;
      // hidden
      Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return true; } });
      document.dispatchEvent(new Event('visibilitychange'));
      await sleep(80);
      var f0 = L.stats.frames, r0 = window.__raf, y0 = v.yaw;
      await sleep(500);
      out.hidden = { frames: L.stats.frames - f0, raf: window.__raf - r0, yawMoved: v.yaw !== y0 };
      Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return false; } });
      document.dispatchEvent(new Event('visibilitychange'));
      await sleep(400);
      out.resumed = { frames: L.stats.frames - f0, yawMoved: v.yaw !== y0 };
      // removal
      c.remove();
      await sleep(120);
      var r1 = window.__raf, f1 = L.stats.frames;
      await sleep(600);
      out.removed = { raf: window.__raf - r1, frames: L.stats.frames - f1, stopped: v.stopped };
      // a static view uses no animation frames at all
      var c2 = T.mkCanvas(200, 150);
      var r2 = window.__raf;
      var v2 = L.view(c2, { items: [{ mesh: L.box(1, 1, 1, 'steel') }], camera: { dist: 5 } }, {});
      await sleep(500);
      out.staticRaf = window.__raf - r2; v2.stop();
      // a canvas created first and attached later keeps working
      var c3 = document.createElement('canvas'); c3.style.cssText = 'display:block;width:100px;height:100px';
      var v3 = L.view(c3, { items: [{ mesh: L.box(1, 1, 1, 'steel') }], camera: { dist: 5 } }, { spin: 40 });
      await sleep(200); document.body.appendChild(c3); await sleep(500);
      out.lateAttach = { stopped: v3.stopped, yawMoved: Math.abs(v3.yaw - 25) > 3 }; v3.stop();
      return out;
    });
    check('spin turns the model', lp.spinMoved, lp.frames1 + ' frames in 400 ms');
    check('document.hidden: zero frames, zero requestAnimationFrame calls, yaw frozen', lp.hidden.frames === 0 && lp.hidden.raf === 0 && !lp.hidden.yawMoved, lp.hidden);
    check('document visible again: drawing and spinning resume', lp.resumed.frames > 3 && lp.resumed.yawMoved, lp.resumed);
    check('canvas removed from the document: loop stops (requestAnimationFrame calls after removal, counted over 600 ms after a 120 ms settle)', lp.removed.raf === 0 && lp.removed.frames === 0 && lp.removed.stopped, lp.removed);
    check('static view schedules no animation frames', lp.staticRaf <= 1, lp.staticRaf);
    check('a canvas attached after view() is created keeps running', !lp.lateAttach.stopped && lp.lateAttach.yawMoved, lp.lateAttach);
    await h.ctx.close();

    // b) reduced motion
    h = await newPage(browser, { viewport: { width: 900, height: 700 }, reducedMotion: 'reduce' }); await h.page.goto(PAGE);
    var rm = await h.page.evaluate(async function () {
      var L = LowPoly, sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
      var c = T.mkCanvas(200, 150);
      var v = L.view(c, { items: [{ mesh: L.box(1, 1, 1, 'steel') }], camera: { dist: 5, yaw: 10 } }, { spin: 90 });
      var f0 = L.stats.frames;
      await sleep(600);
      var r = { matches: matchMedia('(prefers-reduced-motion: reduce)').matches, yaw: v.yaw, frames: L.stats.frames - f0 };
      v.yaw = 77; await sleep(100); r.afterSet = L.stats.frames - f0;
      return r;
    });
    check('prefers-reduced-motion: reduce -> no auto-spin (yaw stays 10, no extra frames)', rm.matches && rm.yaw === 10 && rm.frames === 0, rm);
    check('reduced motion: it still draws on request (setting yaw redraws)', rm.afterSet >= 1, rm.afterSet);
    var box = await h.page.evaluate(function () { var r = document.querySelector('canvas').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
    await h.page.mouse.move(box[0] + 100, box[1] + 75); await h.page.mouse.down(); await h.page.mouse.move(box[0] + 140, box[1] + 75, { steps: 4 }); await h.page.mouse.up();
    var yawAfter = await h.page.evaluate(function () { return document.querySelector('canvas').__lowpolyView.yaw; });
    check('reduced motion: still draggable (yaw changed from 77 by dragging right 40 px)', yawAfter < 77 - 10, yawAfter);
    await h.ctx.close();

    // c) off-screen pause
    h = await newPage(browser, { viewport: { width: 900, height: 600 } }); await h.page.goto(PAGE);
    var os = await h.page.evaluate(async function () {
      var L = LowPoly, sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
      var c = T.mkCanvas(200, 150);
      var sp = document.createElement('div'); sp.style.height = '2500px'; document.body.appendChild(sp);
      var v = L.view(c, { items: [{ mesh: L.box(1, 1, 1, 'steel') }], camera: { dist: 5 } }, { spin: 60 });
      var out = {};
      await sleep(300); var f = L.stats.frames; await sleep(300); out.visibleFrames = L.stats.frames - f;
      window.scrollTo(0, 2000);          // the canvas is now far above the viewport
      await sleep(400);
      f = L.stats.frames; var y = v.yaw; await sleep(500);
      out.offFrames = L.stats.frames - f; out.offYawMoved = v.yaw !== y;
      window.scrollTo(0, 0); await sleep(500);
      f = L.stats.frames; await sleep(400); out.backFrames = L.stats.frames - f;
      return out;
    });
    check('canvas off screen: no frames; back on screen: drawing resumes', os.visibleFrames > 3 && os.offFrames === 0 && !os.offYawMoved && os.backFrames > 3, os);
    await h.ctx.close();
  }

  // ------------------------------------------------------------------ (5) input
  if (want('input')) {
    section = '5 input';
    h = await newPage(browser, { viewport: { width: 700, height: 600 }, hasTouch: true }); await h.page.goto(PAGE);
    await h.page.evaluate(function () {
      var L = LowPoly;
      var sp = document.createElement('div'); sp.style.cssText = 'height:80px'; document.body.appendChild(sp);
      var c = T.mkCanvas(300, 240); c.id = 'cv';
      var sp2 = document.createElement('div'); sp2.style.cssText = 'height:2500px;background:#1a2230'; document.body.appendChild(sp2);
      window.__v = L.view(c, { items: [{ mesh: L.box(1, 1, 1, 'steel') }], camera: { dist: 5, yaw: 0, pitch: 0 }, label: 'Drag test cube' }, {});
    });
    var bb = await h.page.evaluate(function () { var r = document.getElementById('cv').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
    var cx = bb[0] + bb[2] / 2, cy = bb[1] + bb[3] / 2;
    var meta = await h.page.evaluate(function () { var c = document.getElementById('cv'); return { role: c.getAttribute('role'), label: c.getAttribute('aria-label'), tab: c.getAttribute('tabindex'), ta: getComputedStyle(c).touchAction }; });
    check('canvas has role=img, aria-label from scene.label, tabindex 0, touch-action pan-y', meta.role === 'img' && meta.label === 'Drag test cube' && meta.tab === '0' && meta.ta === 'pan-y', meta);
    async function yp() { return await h.page.evaluate(function () { return [__v.yaw, __v.pitch]; }); }
    // mouse
    await h.page.evaluate(function () { __v.yaw = 0; __v.pitch = 0; });
    var picBefore = await h.page.evaluate(function () { return document.getElementById('cv').toDataURL(); });
    await h.page.mouse.move(cx, cy); await h.page.mouse.down(); await h.page.mouse.move(cx + 60, cy + 40, { steps: 5 }); await h.page.mouse.up();
    var m1 = await yp();
    check('mouse drag right 60 px, down 40 px: yaw decreases (~-27), pitch increases (~+18)', m1[0] < -20 && m1[0] > -35 && m1[1] > 12 && m1[1] < 24, m1);
    var picAfter = await h.page.evaluate(function () { return document.getElementById('cv').toDataURL(); });
    check('mouse drag changes the picture (the canvas pixels differ before and after the drag)', picBefore !== picAfter, '');
    // mouse move without button does nothing
    await h.page.mouse.move(cx, cy); await h.page.mouse.move(cx + 80, cy, { steps: 3 });
    var m2 = await yp(); check('mouse move without a button does not rotate', m2[0] === m1[0] && m2[1] === m1[1], m2);
    // synthetic touch pointer events
    await h.page.evaluate(function () { __v.yaw = 0; __v.pitch = 0; });
    await h.page.evaluate(function () {
      var c = document.getElementById('cv'), r = c.getBoundingClientRect();
      function ev(type, x, y) { c.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: r.x + x, clientY: r.y + y, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 })); }
      ev('pointerdown', 100, 100); ev('pointermove', 130, 100); ev('pointermove', 160, 100); ev('pointerup', 160, 100);
    });
    var t1 = await yp();
    check('synthetic touch pointer events (pointerType touch) drag right 60 px: yaw ~ -27 (setPointerCapture failure is tolerated)', t1[0] < -20 && t1[0] > -35, t1);
    // second pointer is ignored while the first drags
    await h.page.evaluate(function () { __v.yaw = 0; __v.pitch = 0; });
    await h.page.evaluate(function () {
      var c = document.getElementById('cv'), r = c.getBoundingClientRect();
      function ev(id, type, x, y) { c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: r.x + x, clientY: r.y + y, bubbles: true, button: 0 })); }
      ev(1, 'pointerdown', 100, 100); ev(2, 'pointerdown', 50, 50); ev(2, 'pointermove', 250, 50); ev(1, 'pointermove', 120, 100); ev(1, 'pointerup', 120, 100); ev(2, 'pointerup', 250, 50);
    });
    var t2 = await yp(); check('a second finger does not fight the first (yaw ~ -9)', t2[0] < -6 && t2[0] > -12, t2);
    // keys
    await h.page.evaluate(function () { __v.yaw = 0; __v.pitch = 0; window.scrollTo(0, 0); });
    await h.page.click('#cv', { position: { x: 150, y: 120 } });
    await h.page.evaluate(function () { __v.yaw = 0; __v.pitch = 0; });
    var sy0 = await h.page.evaluate(function () { return scrollY; });
    await h.page.keyboard.press('ArrowLeft'); var k1 = await yp();
    await h.page.keyboard.press('ArrowRight'); await h.page.keyboard.press('ArrowRight'); var k2 = await yp();
    await h.page.keyboard.press('ArrowDown'); var k3 = await yp();
    await h.page.keyboard.press('ArrowUp'); await h.page.keyboard.press('ArrowUp'); var k4 = await yp();
    var sy1 = await h.page.evaluate(function () { return scrollY; });
    check('arrow keys: Left yaw +6, Right -6 twice, Down pitch +6, Up -6 twice', k1[0] === 6 && k2[0] === -6 && k3[1] === 6 && k4[1] === -6, [k1, k2, k3, k4]);
    check('arrow keys do not scroll the page (preventDefault)', sy0 === sy1, [sy0, sy1]);
    var pngA = await h.page.evaluate(function () { return document.getElementById('cv').toDataURL(); });
    await h.page.keyboard.press('ArrowLeft'); await h.page.waitForTimeout(80);
    var pngB = await h.page.evaluate(function () { return document.getElementById('cv').toDataURL(); });
    check('key press redraws the canvas (picture changed)', pngA !== pngB, '');

    // real touch gestures through CDP so touch-action is actually exercised
    var cdp = await h.ctx.newCDPSession(h.page);
    async function swipe(x0, y0, x1, y1, steps) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
      for (var i = 1; i <= steps; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps, id: 1 }] });
        await h.page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await h.page.waitForTimeout(250);
    }
    await h.page.evaluate(function () { window.scrollTo(0, 0); __v.yaw = 0; __v.pitch = 0; });
    var tb = await h.page.evaluate(function () { var r = document.getElementById('cv').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await swipe(tb[0] - 50, tb[1], tb[0] + 50, tb[1], 10);
    var cd1 = await yp(), sc1 = await h.page.evaluate(function () { return scrollY; });
    check('real touch swipe right 100 px across the canvas rotates it (yaw ~ -45) and the page does not scroll', cd1[0] < -30 && sc1 === 0, { yp: cd1, scrollY: sc1 });
    await h.page.evaluate(function () { __v.yaw = 0; __v.pitch = 0; });
    await swipe(tb[0], tb[1] + 60, tb[0], tb[1] - 100, 12);
    var cd2 = await yp(), sc2 = await h.page.evaluate(function () { return scrollY; });
    check('real touch vertical swipe over the canvas scrolls the page (touch-action pan-y)', sc2 > 40, { scrollY: sc2, yp: cd2 });
    check('...and does not tumble the model while scrolling (pitch within 5 degrees of 0)', Math.abs(cd2[1]) < 5, cd2);
    // control: with touch-action auto a vertical swipe would be taken by the drag; verify the style is what makes the difference
    await h.page.evaluate(function () { window.scrollTo(0, 0); document.getElementById('cv').style.touchAction = 'none'; });
    await swipe(tb[0], tb[1] + 60, tb[0], tb[1] - 100, 12);
    var sc3 = await h.page.evaluate(function () { return scrollY; });
    check('control: with touch-action none the same swipe does NOT scroll (so pan-y is what lets the page scroll)', sc3 < sc2 / 2, { scrollY: sc3 });
    check('no page errors', h.page.errors.length === 0, h.page.errors);
    await h.ctx.close();
  }

  // ------------------------------------------------------------------ (6) DPR, size, budget
  if (want('size')) {
    section = '6 size';
    for (var dpr of [1, 2, 3]) {
      h = await newPage(browser, { viewport: { width: 900, height: 700 }, deviceScaleFactor: dpr }); await h.page.goto(PAGE);
      var sz = await h.page.evaluate(function () {
        var L = LowPoly, out = {};
        function sat() { return L.merge([L.box(1.2, 1.4, 1.2, 'silver'), L.move(L.box(1.26, 0.06, 1.26, 'gold'), 0, 0.3, 0), L.move(L.box(3.4, 0.04, 1, 'cell'), 0, 0, 0), L.move(L.cylinder(0.3, 0.45, 0.4, 10, 'graphite'), 0, 0.9, 0)]); }
        [[96, 96], [200, 150], [480, 360], [480, 480], [800, 600]].forEach(function (s) {
          var c = T.mkCanvas(s[0], s[1]);
          var r = L.render(c, { items: [{ mesh: sat() }], camera: { yaw: 30, pitch: 20 }, background: { color: 'space', stars: true, seed: 3 } }, {});
          var rect = c.getBoundingClientRect();
          out[s[0] + 'x' + s[1]] = { backing: [c.width, c.height], pixels: c.width * c.height, ss: r.ss, css: [rect.width, rect.height], dpr: devicePixelRatio, ms: +r.ms.toFixed(2) };
        });
        return out;
      });
      Object.keys(sz).forEach(function (k) {
        var e = sz[k], oneToOne = e.backing[0] === Math.round(e.css[0] * Math.min(dpr, 2)) && e.backing[1] === Math.round(e.css[1] * Math.min(dpr, 2));
        var within = e.pixels <= 600000;
        check('DPR ' + dpr + ', canvas ' + k + ': backing ' + e.backing.join('x') + ' (' + e.pixels + ' px), ss ' + e.ss + (oneToOne ? ', 1:1 with device pixels (DPR capped at 2)' : ', scaled to the 600k budget'), within && e.css[0] === +k.split('x')[0] && e.css[1] === +k.split('x')[1], { css: e.css, ms: e.ms });
      });
      if (dpr === 2) await h.page.screenshot({ path: path.join(SHOTS, 'dpr2-sizes.png'), fullPage: true });
      await h.ctx.close();
    }
    // sizing behaviour
    h = await newPage(browser, { viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 }); await h.page.goto(PAGE);
    var sb = await h.page.evaluate(async function () {
      var L = LowPoly, out = {}, sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
      var sc = function () { return { items: [{ mesh: L.box(1, 1, 1, 'steel') }], camera: { dist: 5 }, background: { color: 'space' } }; };
      // bare canvas, no CSS: must not grow
      var bare = document.createElement('canvas'); bare.width = 300; bare.height = 200; document.body.appendChild(bare);
      var r0 = bare.getBoundingClientRect();
      L.render(bare, sc(), {}); L.render(bare, sc(), {}); L.render(bare, sc(), {});
      var r1 = bare.getBoundingClientRect();
      out.bare = { before: [r0.width, r0.height], after: [r1.width, r1.height], backing: [bare.width, bare.height], style: bare.style.cssText };
      // responsive canvas width:100% height:auto, aspect from attributes
      var wrap = document.createElement('div'); wrap.style.cssText = 'width:600px'; document.body.appendChild(wrap);
      var resp = document.createElement('canvas'); resp.width = 400; resp.height = 300; resp.style.cssText = 'display:block;width:100%;height:auto'; wrap.appendChild(resp);
      var sizes = [];
      for (var i = 0; i < 3; i++) { L.render(resp, sc(), {}); var rr = resp.getBoundingClientRect(); sizes.push([resp.width, resp.height, rr.width, rr.height]); }
      out.resp = sizes;
      // and as a live view with ResizeObserver: must settle, not loop
      var f0 = L.stats.frames;
      var v = L.view(resp, sc(), {});
      await sleep(600);
      var rr2 = resp.getBoundingClientRect();
      out.respView = { frames: L.stats.frames - f0, size: [resp.width, resp.height, rr2.width, rr2.height] };
      wrap.style.width = '400px'; await sleep(400);
      var rr3 = resp.getBoundingClientRect();
      out.resized = { frames: L.stats.frames - f0, size: [resp.width, resp.height, rr3.width, rr3.height] };
      f0 = L.stats.frames; await sleep(500); out.idleAfterResize = L.stats.frames - f0;
      v.stop();
      // zero-size canvases
      var errs = [], zero = {};
      function tryIt(name, fn) { try { zero[name] = fn(); } catch (e) { errs.push(name + ': ' + e.message); } }
      var z1 = document.createElement('canvas'); z1.width = 0; z1.height = 0; document.body.appendChild(z1);
      tryIt('attr 0x0 in page', function () { return L.render(z1, sc(), {}); });
      var z2 = document.createElement('canvas'); z2.style.display = 'none'; document.body.appendChild(z2);
      tryIt('display none', function () { return L.render(z2, sc(), {}); });
      var z3 = document.createElement('canvas'); z3.width = 0; z3.height = 0;
      tryIt('detached 0x0', function () { return L.render(z3, sc(), {}); });
      var z4 = document.createElement('canvas'); z4.style.cssText = 'width:0;height:0'; document.body.appendChild(z4);
      tryIt('css 0x0', function () { return L.render(z4, sc(), {}); });
      tryIt('view on 0x0', function () { var vv = L.view(z1, sc(), { spin: 30 }); vv.redraw(); vv.stop(); return 1; });
      tryIt('null scene', function () { return L.render(bare, null, {}) && 1; });
      tryIt('empty scene', function () { return L.render(bare, {}, {}) && 1; });
      tryIt('not a canvas', function () { return L.render({}, sc(), {}); });
      tryIt('mesh with no tris', function () { return L.render(bare, { items: [{ mesh: { tris: [] } }, { mesh: null }, null, { mesh: L.box(), hidden: true }] }, {}) && 1; });
      tryIt('NaN camera', function () { return L.render(bare, { items: [{ mesh: L.box() }], camera: { yaw: NaN, pitch: undefined, dist: -5, fov: 0 } }, {}) && 1; });
      out.zero = zero; out.zeroErrors = errs;
      // display:none then shown: a live view draws after it appears
      var hid = document.createElement('div'); hid.style.display = 'none'; document.body.appendChild(hid);
      var hc = document.createElement('canvas'); hc.style.cssText = 'width:120px;height:90px'; hid.appendChild(hc);
      var hv = L.view(hc, sc(), {});
      await sleep(100); var before = L.stats.frames;
      hid.style.display = 'block'; await sleep(300);
      var pxd = hc.getContext('2d').getImageData(60, 45, 1, 1).data;
      out.shown = { drew: L.stats.frames > before, centre: [pxd[0], pxd[1], pxd[2], pxd[3]], backing: [hc.width, hc.height] }; hv.stop();
      return out;
    });
    check('bare <canvas width=300 height=200> at DPR 2 does not grow on the page (stays 300x200 CSS, backing 600x400)', sb.bare.after[0] === 300 && sb.bare.after[1] === 200 && sb.bare.backing[0] === 600 && sb.bare.backing[1] === 400, sb.bare);
    var stable = sb.resp.every(function (e) { return e[0] === sb.resp[0][0] && e[1] === sb.resp[0][1] && e[2] === 600; });
    check('width:100% height:auto canvas: three renders give identical backing and layout sizes', stable, sb.resp);
    check('live view on it: ResizeObserver settles (a few frames, no loop) and the size is unchanged', sb.respView.frames <= 4 && sb.respView.size[2] === 600, sb.respView);
    check('resizing the container redraws at the new size (400 CSS wide), then goes idle', sb.resized.size[2] === 400 && sb.resized.size[0] === 800 && sb.idleAfterResize === 0, { resized: sb.resized, idleFrames: sb.idleAfterResize });
    check('0x0, display:none, detached 0x0, css 0x0, null/empty scene, non-canvas, NaN camera: nothing throws', sb.zeroErrors.length === 0, sb.zeroErrors.length ? sb.zeroErrors : Object.keys(sb.zero).length + ' cases');
    check('canvas in a display:none parent draws once it is shown', sb.shown.drew && sb.shown.centre[3] === 255 && sb.shown.backing[0] === 240, sb.shown);
    check('no page errors', h.page.errors.length === 0, h.page.errors);
    await h.ctx.close();
  }

  // ------------------------------------------------------------------ (7) globals
  if (want('globals')) {
    section = '7 globals';
    h = await newPage(browser); await h.page.goto(BARE);
    var g0 = await h.page.evaluate(function () { return Object.getOwnPropertyNames(window); });
    await h.page.goto(PAGE);
    var g1 = await h.page.evaluate(function () {
      var L = LowPoly, c = document.createElement('canvas'); c.style.cssText = 'width:100px;height:100px'; document.body.appendChild(c);
      var v = L.view(c, { items: [{ mesh: L.sphere(1, 2, 'gold') }] }, { spin: 30 }); v.redraw(); v.stop();
      L.render(c, { items: [{ mesh: L.merge([L.box(), L.torus(), L.lathe([[0, 0], [1, 1]], 6), L.prism([[0, 0], [1, 0], [0, 1]], 1)]) }], background: { color: 'space', stars: true } }, {});
      L.model('part', 'nothing', {}); L.fallback('body'); L.toCanvas({ items: [] }, 10, 10);
      return Object.getOwnPropertyNames(window);
    });
    // helpers.js adds T; the bare page has no helpers, so compare against a page with only lowpoly.js
    h.page.errors.length = 0;
    await h.page.goto('file://' + path.join(__dirname, 'onlyengine.html'));
    var g2 = await h.page.evaluate(function () {
      var L = LowPoly, c = document.createElement('canvas'); c.style.cssText = 'width:100px;height:100px'; document.body.appendChild(c);
      var v = L.view(c, { items: [{ mesh: L.sphere(1, 2, 'gold') }] }, { spin: 30 }); v.redraw(); v.stop();
      L.render(c, { items: [{ mesh: L.merge([L.box(), L.torus(), L.lathe([[0, 0], [1, 1]], 6), L.prism([[0, 0], [1, 0], [0, 1]], 1)]) }], background: { color: 'space', stars: true } }, {});
      L.model('part', 'nothing', {}); L.fallback('body'); L.toCanvas({ items: [] }, 10, 10);
      return Object.getOwnPropertyNames(window);
    });
    var added = g2.filter(function (n) { return g0.indexOf(n) < 0; });
    check('loading lowpoly.js, creating views, rendering and using every helper adds exactly one global: LowPoly', added.length === 1 && added[0] === 'LowPoly', added);
    var props = await h.page.evaluate(function () { return Object.keys(LowPoly).sort().join(' '); });
    check('LowPoly.models has body/part/launcher/person and LowPoly.scenes exists', await h.page.evaluate(function () { return !!(LowPoly.models.body && LowPoly.models.part && LowPoly.models.launcher && LowPoly.models.person && LowPoly.scenes); }), props.length + ' chars of API names');
    await h.ctx.close();
  }

  // ------------------------------------------------------------------ (9) CSS custom property
  if (want('css')) {
    section = '9 css';
    h = await newPage(browser); await h.page.goto(PAGE);
    var cs = await h.page.evaluate(function () {
      var L = LowPoly, out = {};
      function face() { var c = T.mkCanvas(60, 60); L.render(c, { items: [{ mesh: L.box(2, 2, 0.2, 'gold') }], camera: { yaw: 0, pitch: 0, ortho: true, size: 1.5, dist: 6, target: [0, 0, 0] }, light: { dir: [0, 0, 1], key: '#ffffff', ambient: '#000000', hemi: 0 }, background: null }, { ss: 1 }); var p = T.px(c, 30, 30); c.remove(); return p; }
      out.def = face(); out.defHex = L.colorOf('gold');
      document.documentElement.style.setProperty('--lp-gold', '#ff0000'); out.red = face(); out.redHex = L.colorOf('gold');
      document.documentElement.style.setProperty('--lp-gold', 'rgb(0, 200, 0)'); out.green = face();
      document.documentElement.style.setProperty('--lp-gold', ' teal '); out.teal = face();
      document.documentElement.style.setProperty('--lp-gold', 'nonsense'); out.bad = face();
      document.documentElement.style.removeProperty('--lp-gold'); out.back = face();
      // per-canvas override beats :root
      var wrap = document.createElement('div'); wrap.style.setProperty('--lp-gold', '#0000ff'); document.body.appendChild(wrap);
      var c = document.createElement('canvas'); c.style.cssText = 'width:60px;height:60px'; wrap.appendChild(c);
      L.render(c, { items: [{ mesh: L.box(2, 2, 0.2, 'gold') }], camera: { yaw: 0, pitch: 0, ortho: true, size: 1.5, dist: 6, target: [0, 0, 0] }, light: { dir: [0, 0, 1], key: '#ffffff', ambient: '#000000', hemi: 0 }, background: null }, { ss: 1 });
      out.scoped = T.px(c, 30, 30);
      // background colour name also follows the override
      document.documentElement.style.setProperty('--lp-space', '#00ff00');
      L.render(c, { items: [], background: { color: 'space' } }, { ss: 1 }); out.bg = T.px(c, 5, 5);
      document.documentElement.style.removeProperty('--lp-space');
      return out;
    });
    check('default gold renders as #c79a3e (full light)', Math.abs(cs.def[0] - 0xc7) <= 1 && Math.abs(cs.def[1] - 0x9a) <= 1 && Math.abs(cs.def[2] - 0x3e) <= 1 && cs.defHex === '#c79a3e', cs.def);
    check('--lp-gold:#ff0000 on :root changes the gold to red', cs.red[0] === 255 && cs.red[1] === 0 && cs.red[2] === 0 && cs.redHex === '#ff0000', cs.red);
    check('--lp-gold as rgb() works', cs.green[0] === 0 && cs.green[1] === 200 && cs.green[2] === 0, cs.green);
    check('--lp-gold as a colour word (teal) works', cs.teal[0] === 0 && cs.teal[1] === 128 && cs.teal[2] === 128, cs.teal);
    check('an unparseable value falls back to the default', Math.abs(cs.bad[0] - 0xc7) <= 1, cs.bad);
    check('removing the property restores the default', cs.back[0] === cs.def[0] && cs.back[1] === cs.def[1], cs.back);
    check('a custom property set on an ancestor of the canvas applies to that canvas only', cs.scoped[2] === 255 && cs.scoped[0] === 0, cs.scoped);
    check('background colour names follow --lp-<name> too', cs.bg[0] === 0 && cs.bg[1] === 255 && cs.bg[2] === 0, cs.bg);
    await h.ctx.close();
  }

  // ------------------------------------------------------------------ extra: decals (no shimmer) and fill rule (no cracks)
  if (want('decals')) {
    section = 'x decals';
    h = await newPage(browser); await h.page.goto(PAGE);
    var dc = await h.page.evaluate(function () {
      var L = LowPoly, c = T.mkCanvas(120, 120), out = { later: 0, earlier: 0, frames: 0, off: 0 }, rnd = L.rng(5), FLAT = { key: '#000000', ambient: '#ffffff', hemi: 0 };
      function body(decalAfter) {
        var base = L.box(2, 1, 1, 'silver');
        var stripe = L.quad([-0.8, -0.3, 0.5], [0.8, -0.3, 0.5], [0.8, 0.3, 0.5], [-0.8, 0.3, 0.5], 'red');   // exactly coplanar with the +Z face
        var led = L.move(L.emit(L.box(0.1, 0.1, 0.0001, 'glow')), 0, 0, 0.5);                                // a hair thick, centred on the face
        return decalAfter ? L.merge([base, stripe, led]) : L.merge([stripe, led, base]);
      }
      var ma = body(true), mb = body(false);
      for (var i = 0; i < 400; i++) {
        var yaw = (rnd() - 0.5) * 120, pitch = (rnd() - 0.5) * 100, dist = 4 + rnd() * 16;
        // face centre is at (0,0,0.5): aim the camera at it so it lands on pixel 60,60
        var cam = { yaw: yaw, pitch: pitch, dist: dist, target: [0, 0.07, 0.5], fov: 35 };
        L.render(c, { items: [{ mesh: ma }], camera: cam, background: null, light: FLAT }, { ss: 1 });
        var p = T.px(c, 60, 60), q;
        // (60,60) is just above the LED (target y 0.07 is over it) -> stripe red or glow; both are decals
        var isDecal = p[0] > 150 && p[2] < 150;
        out.frames++; if (isDecal) out.later++;
        L.render(c, { items: [{ mesh: mb }], camera: cam, background: null, light: FLAT }, { ss: 1 });
        q = T.px(c, 60, 60);
        if (q[0] < 200 && Math.abs(q[0] - q[2]) < 40) out.earlier++;  // silver base wins when it is drawn after
      }
      // the offset case: decal 0.003 in front of the face, any order, must show
      var off = L.merge([L.box(2, 1, 1, 'silver'), L.move(L.quad([-0.5, -0.2, 0], [0.5, -0.2, 0], [0.5, 0.2, 0], [-0.5, 0.2, 0], 'red'), 0, 0, 0.503)]);
      var off2 = L.merge([L.move(L.quad([-0.5, -0.2, 0], [0.5, -0.2, 0], [0.5, 0.2, 0], [-0.5, 0.2, 0], 'red'), 0, 0, 0.503), L.box(2, 1, 1, 'silver')]);
      [off, off2].forEach(function (m) { for (var j = 0; j < 100; j++) { var cam = { yaw: (rnd() - 0.5) * 120, pitch: (rnd() - 0.5) * 100, dist: 4 + rnd() * 20, target: [0, 0, 0.5] }; L.render(c, { items: [{ mesh: m }], camera: cam, background: null, light: FLAT }, { ss: 1 }); var p2 = T.px(c, 60, 60); if (!(p2[0] > 150 && p2[2] < 150)) out.off++; } });
      return out;
    });
    check('exactly coplanar decals listed after the base show in ' + dc.later + '/' + dc.frames + ' random views (yaw +-60, pitch +-50, distance 4..20)', dc.later === dc.frames, dc);
    check('listed before the base, the base wins deterministically in all views (documented rule: later wins)', dc.earlier === dc.frames, dc.earlier + '/' + dc.frames);
    check('a decal offset 0.003 units in front shows in any order (0 misses in 200 views)', dc.off === 0, dc.off);
    await h.ctx.close();
  }

  if (want('fill')) {
    section = 'x fill';
    h = await newPage(browser); await h.page.goto(PAGE);
    var fl = await h.page.evaluate(function () {
      var L = LowPoly, out = { holes: 0, shapes: 0, renders: 0, worst: 0 };
      // Flood fill the background from the border; any background pixel left over is a hole inside the silhouette.
      function holes(c) {
        var W = c.width, H = c.height, d = T.data(c), seen = new Uint8Array(W * H), stack = [], i, n = 0;
        function isBg(p) { return d[p * 4] === 255 && d[p * 4 + 1] === 0 && d[p * 4 + 2] === 255; }
        for (i = 0; i < W; i++) { stack.push(i, (H - 1) * W + i); }
        for (i = 0; i < H; i++) { stack.push(i * W, i * W + W - 1); }
        while (stack.length) {
          var p = stack.pop(); if (seen[p] || !isBg(p)) continue; seen[p] = 1;
          var x = p % W, y = (p - x) / W;
          if (x > 0) stack.push(p - 1); if (x < W - 1) stack.push(p + 1); if (y > 0) stack.push(p - W); if (y < H - 1) stack.push(p + W);
        }
        for (i = 0; i < W * H; i++) if (!seen[i] && isBg(i)) n++;
        return n;
      }
      var shapes = [];
      for (var s = 0; s < 6; s++) shapes.push(L.jitter(L.sphere(1, 2, 'steel'), 0.12, s));
      shapes.push(L.jitter(L.sphere(1, 3, 'steel'), 0.05, 9), L.jitter(L.box(1.4, 1, 1, 'steel'), 0.1, 2), L.jitter(L.cylinder(0.7, 0.9, 1.6, 12, 'steel'), 0.07, 8), L.sphere(1, 3, 'steel'), L.jitter(L.cone(1, 2, 9, 'steel'), 0.08, 5), L.jitter(L.merge([L.box(1, 1, 1, 'red'), L.move(L.sphere(0.8, 2, 'teal'), 0.5, 0.5, 0.5)]), 0.05, 6));
      var sizes = [[64, 64], [97, 83], [200, 200], [331, 211]], rnd = L.rng(11);
      shapes.forEach(function (m) {
        out.shapes++;
        sizes.forEach(function (sz) {
          var c = T.mkCanvas(sz[0], sz[1]);
          for (var k = 0; k < 6; k++) {
            L.render(c, { items: [{ mesh: m }], camera: { yaw: rnd() * 360, pitch: (rnd() - 0.5) * 140, fov: 20 + rnd() * 40 }, background: { color: '#ff00ff' } }, { ss: 1 });
            var hcount = holes(c); out.renders++; out.holes += hcount; if (hcount > out.worst) out.worst = hcount;
          }
          c.remove();
        });
      });
      return out;
    });
    check('jittered spheres, box, cylinder, cone, merged shapes and smooth spheres over a magenta background: no background pixel inside any silhouette (' + fl.renders + ' renders, ss 1)', fl.holes === 0, fl);
    await h.ctx.close();
  }

  if (want('rot')) {
    section = 'x rot';
    h = await newPage(browser); await h.page.goto(PAGE);
    var rr = await h.page.evaluate(function () {
      var L = LowPoly, c = T.mkCanvas(160, 160), base = L.merge([L.box(1, 0.5, 0.3, 'steel'), L.move(L.box(0.2, 0.2, 0.2, 'red'), 0.5, 0.2, 0.2)]), res = [];
      [[10, 20, 30], [90, 0, 0], [0, 90, 0], [0, 0, 90], [35, -50, 70], [-120, 45, 15]].forEach(function (a) {
        var cam = { yaw: 30, pitch: 20, dist: 5, target: [0, 0, 0] };
        L.render(c, { items: [{ mesh: base, rot: a }], camera: cam, background: { color: 'space' } }, { ss: 1 });
        var A = new Uint8ClampedArray(T.data(c));
        L.render(c, { items: [{ mesh: L.rotate(base, a[0], a[1], a[2]) }], camera: cam, background: { color: 'space' } }, { ss: 1 });
        res.push([a.join(','), T.diffCount(A, T.data(c), 8)]);
      });
      // scale and position as well
      var cam2 = { yaw: 30, pitch: 20, dist: 8, target: [0, 0, 0] };
      L.render(c, { items: [{ mesh: base, rot: [10, 20, 30], scale: [2, 1, 0.5], pos: [1, 0.5, -0.5] }], camera: cam2, background: { color: 'space' } }, { ss: 1 });
      var B = new Uint8ClampedArray(T.data(c));
      L.render(c, { items: [{ mesh: L.move(L.rotate(L.scale(base, 2, 1, 0.5), 10, 20, 30), 1, 0.5, -0.5) }], camera: cam2, background: { color: 'space' } }, { ss: 1 });
      res.push(['scale+rot+pos', T.diffCount(B, T.data(c), 8)]);
      // mirrored item: winding repaired (same silhouette as the baked mirror)
      L.render(c, { items: [{ mesh: base, scale: [-1, 1, 1] }], camera: cam2, background: { color: 'space' } }, { ss: 1 });
      var M1 = new Uint8ClampedArray(T.data(c));
      L.render(c, { items: [{ mesh: L.scale(base, -1, 1, 1) }], camera: cam2, background: { color: 'space' } }, { ss: 1 });
      res.push(['mirror item vs baked', T.diffCount(M1, T.data(c), 8)]);
      return res;
    });
    rr.forEach(function (e) { check('item rot/scale/pos equals the baked mesh transform: ' + e[0] + ' (pixels differing by >8 levels: ' + e[1] + ')', e[1] <= 8, e[1]); });
    await h.ctx.close();
  }

  if (want('alpha')) {
    section = 'x alpha';
    h = await newPage(browser); await h.page.goto(PAGE);
    var al = await h.page.evaluate(function () {
      var L = LowPoly, FLAT = { key: '#000000', ambient: '#ffffff', hemi: 0 }, out = {};
      var cam = { yaw: 0, pitch: 0, ortho: true, size: 3, dist: 10, target: [0, 0, 0] };
      function q(col, z, size) { var h = size || 2; return L.quad([-h, -h, z], [h, -h, z], [h, h, z], [-h, h, z], col); }
      function shot(items, bg) { var c = T.mkCanvas(60, 60); LowPoly.render(c, { items: items, camera: cam, light: FLAT, background: bg === undefined ? { color: 'black' } : bg }, { ss: 1 }); var p = T.px(c, 30, 30); c.remove(); return p; }
      out.steel = LowPoly.palette.steel; out.red = LowPoly.palette.red; out.teal = LowPoly.palette.teal;
      out.front = shot([{ mesh: q('steel', 0) }, { mesh: q('red', 1), alpha: 0.5 }]);                       // translucent in front of opaque
      out.frontListedFirst = shot([{ mesh: q('red', 1), alpha: 0.5 }, { mesh: q('steel', 0) }]);          // order in the list does not matter
      out.overNull = shot([{ mesh: q('red', 1), alpha: 0.5 }], null);                                      // over a transparent canvas
      out.behind = shot([{ mesh: q('steel', 0) }, { mesh: q('red', -1), alpha: 0.5 }]);                    // translucent behind opaque: invisible
      out.zero = shot([{ mesh: q('steel', 0) }, { mesh: q('red', 1), alpha: 0 }]);                          // alpha 0 draws nothing
      out.stackAB = shot([{ mesh: q('steel', 0) }, { mesh: q('teal', 1), alpha: 0.5 }, { mesh: q('red', 2), alpha: 0.5 }]);
      out.stackBA = shot([{ mesh: q('red', 2), alpha: 0.5 }, { mesh: q('steel', 0) }, { mesh: q('teal', 1), alpha: 0.5 }]);
      out.quarter = shot([{ mesh: q('steel', 0) }, { mesh: q('red', 1), alpha: 0.25 }]);
      // intersecting translucent against opaque with depth: the part of the glass behind the wall is hidden
      var c = T.mkCanvas(80, 80);
      L.render(c, { items: [{ mesh: L.box(1, 1, 0.2, 'steel') }, { mesh: L.rotate(q('red', 0, 1.5), 0, 60, 0), alpha: 0.5 }], camera: { yaw: 0, pitch: 0, dist: 8, target: [0, 0, 0] }, light: FLAT, background: { color: 'black' } }, { ss: 1 });
      out.glassLeft = T.px(c, 25, 40); out.glassRight = T.px(c, 55, 40); out.wallMid = T.px(c, 40, 40);
      // supersampled alpha edge over a transparent canvas stays premultiplied-correct (colour not darkened)
      var c2 = T.mkCanvas(40, 40); L.render(c2, { items: [{ mesh: q('red', 0, 0.62), alpha: 1 }], camera: cam, light: FLAT, background: null }, { ss: 3 });
      var edge = null, d = T.data(c2); for (var i = 0; i < d.length; i += 4) if (d[i + 3] >= 80 && d[i + 3] <= 200) { edge = [d[i], d[i + 1], d[i + 2], d[i + 3]]; break; }   // the browser stores premultiplied 8-bit, so low alphas lose colour precision
      out.edge = edge;
      return out;
    });
    function near3(p, e, tol) { return Math.abs(p[0] - e[0]) <= tol && Math.abs(p[1] - e[1]) <= tol && Math.abs(p[2] - e[2]) <= tol; }
    function hx(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
    var S = hx(al.steel), R = hx(al.red), Tl = hx(al.teal);
    var blend = function (d, sr, a) { return [d[0] * (1 - a) + sr[0] * a, d[1] * (1 - a) + sr[1] * a, d[2] * (1 - a) + sr[2] * a]; };
    check('alpha 0.5 red in front of opaque steel = the 50/50 blend ' + blend(S, R, 0.5).map(Math.round) + ' (got ' + al.front.slice(0, 3) + '), alpha channel 255', near3(al.front, blend(S, R, 0.5), 1) && al.front[3] === 255, al.front);
    check('the same when the translucent item is listed first', near3(al.frontListedFirst, al.front, 0), al.frontListedFirst);
    check('alpha 0.25 gives the 75/25 blend', near3(al.quarter, blend(S, R, 0.25), 1), al.quarter);
    check('alpha 0.5 over a transparent canvas: output alpha 127-128, colour is the item colour (' + R + ')', al.overNull[3] >= 127 && al.overNull[3] <= 128 && near3(al.overNull, R, 2), al.overNull);
    check('translucent behind an opaque item is invisible (exact opaque colour)', near3(al.behind, S, 0), al.behind);
    check('alpha 0 draws nothing', near3(al.zero, S, 0), al.zero);
    check('two translucent layers composite far to near, independent of list order: ((steel,teal 50%),red 50%) = ' + blend(blend(S, Tl, 0.5), R, 0.5).map(Math.round), near3(al.stackAB, blend(blend(S, Tl, 0.5), R, 0.5), 2) && near3(al.stackAB, al.stackBA, 0), { ab: al.stackAB, ba: al.stackBA });
    check('a translucent pane crossing an opaque wall: only the part in front of the wall tints it', near3(al.wallMid, S, 120) && al.glassLeft[0] > 0 && al.glassRight[0] > 0, { left: al.glassLeft, right: al.glassRight, wall: al.wallMid });
    check('supersampled edge over a transparent canvas keeps the colour (not darkened): partial-alpha pixel (alpha 80-200) ' + JSON.stringify(al.edge), al.edge && near3(al.edge, R, 3), al.edge);
    await h.ctx.close();
  }

  if (want('onframe')) {
    section = 'x onFrame';
    h = await newPage(browser); await h.page.goto(PAGE);
    var of = await h.page.evaluate(async function () {
      var L = LowPoly, out = {}, sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
      window.__raf = 0; var orig = window.requestAnimationFrame; window.requestAnimationFrame = function (f) { window.__raf++; return orig.call(window, f); };
      var sc = function () { return { items: [{ mesh: L.box(1, 1, 1, 'steel') }], camera: { dist: 5 }, background: { color: 'space' } }; };
      // a) cadence, dt, t
      var c = T.mkCanvas(160, 120), calls = [], v = L.view(c, sc(), { fps: 30 });
      var perf0 = null, perf1 = null, f0 = L.stats.frames;
      v.onFrame(function (t, dt) { var n = performance.now(); if (perf0 === null) perf0 = n; perf1 = n; calls.push([t, dt]); });
      await sleep(500);
      var dts = calls.slice(1).map(function (e) { return e[1]; }), sum = dts.reduce(function (a, b) { return a + b; }, 0);
      out.cadence = { calls: calls.length, frames: L.stats.frames - f0, firstDt: calls[0][0 + 1], dtSum: sum, elapsed: (perf1 - perf0) / 1000, tMonotonic: calls.every(function (e, i) { return i === 0 || e[0] > calls[i - 1][0]; }), maxDt: Math.max.apply(null, dts) };
      v.stop();
      // b) returning false means "nothing changed": the callback keeps running, nothing is drawn
      var c2 = T.mkCanvas(160, 120), n2 = 0, v2 = L.view(c2, sc(), {});
      var fr = L.stats.frames; v2.onFrame(function () { n2++; return false; });
      await sleep(400);
      out.falseCb = { calls: n2, frames: L.stats.frames - fr };
      v2.stop();
      // c) the remover stops the loop
      var c3 = T.mkCanvas(160, 120), n3 = 0, v3 = L.view(c3, sc(), {});
      var off = v3.onFrame(function () { n3++; });
      await sleep(300); var calledBefore = n3; off(); await sleep(150);
      var r0 = window.__raf, n3a = n3; await sleep(400);
      out.remover = { calledBefore: calledBefore, extraCalls: n3 - n3a, rafAfter: window.__raf - r0 };
      v2.stop(); v3.stop();
      // d) scene wrappers: view() registers update, set() swaps it, a plain scene drops it, labels follow
      var aN = 0, bN = 0, c4 = T.mkCanvas(120, 90);
      var A = { scene: sc(), update: function () { aN++; }, label: 'Scene A' }, B = { scene: sc(), update: function () { bN++; }, label: 'Scene B' };
      var v4 = L.view(c4, A, {});
      await sleep(250); out.wrapA = { a: aN, b: bN, label: c4.getAttribute('aria-label') };
      v4.set(B); aN = 0; bN = 0; await sleep(300);
      out.wrapB = { a: aN, b: bN, label: c4.getAttribute('aria-label') };
      var plain = sc(); plain.label = 'Plain scene'; v4.set(plain); aN = 0; bN = 0; await sleep(300);
      out.plain = { a: aN, b: bN, label: c4.getAttribute('aria-label') };
      var plain2 = sc(); v4.set(plain2); await sleep(50);
      out.plain2Label = c4.getAttribute('aria-label');
      v4.stop();
      return out;
    });
    var cd = of.cadence;
    check('onFrame at 30 fps: ' + cd.calls + ' calls in about 500 ms (expect 12-18), t strictly increasing, one draw per call', cd.calls >= 12 && cd.calls <= 18 && cd.tMonotonic && Math.abs(cd.frames - cd.calls) <= 1, cd);
    check('onFrame dt: first call dt is 0, the dt values add up to the elapsed time (' + cd.dtSum.toFixed(3) + ' s vs ' + cd.elapsed.toFixed(3) + ' s), none above 0.1', cd.firstDt === 0 && Math.abs(cd.dtSum - cd.elapsed) < 0.06 && cd.maxDt <= 0.1, cd);
    check('onFrame returning false: the callback keeps running (' + of.falseCb.calls + ' calls) but no frame is drawn', of.falseCb.calls >= 8 && of.falseCb.frames === 0, of.falseCb);
    check('the function returned by onFrame removes it and the loop stops (no calls, no requestAnimationFrame afterwards)', of.remover.calledBefore >= 5 && of.remover.extraCalls === 0 && of.remover.rafAfter === 0, of.remover);
    check('scene wrapper: view() registers its update and label; set(wrapperB) swaps to B only (A silent); a plain scene silences both and takes its own label; a plain scene without a label falls back to the previous label or the generic one',
      of.wrapA.a >= 4 && of.wrapA.b === 0 && of.wrapA.label === 'Scene A' && of.wrapB.a === 0 && of.wrapB.b >= 4 && of.wrapB.label === 'Scene B' && of.plain.a === 0 && of.plain.b === 0 && of.plain.label === 'Plain scene' && of.plain2Label === 'Plain scene', of);
    await h.ctx.close();
  }

  if (want('steps')) {
    section = 'x steps';
    h = await newPage(browser); await h.page.goto(PAGE);
    var stp = await h.page.evaluate(function () {
      var L = LowPoly, c = T.mkCanvas(200, 200), out = {};
      function distinct(steps) {
        L.render(c, { items: [{ mesh: L.sphere(1, 3, 'white') }], camera: { yaw: 0, pitch: 0, dist: 4, target: [0, 0, 0] }, light: { dir: [0.4, 0.6, 0.7], key: '#ffffff', ambient: '#000000', hemi: 0, steps: steps }, background: null }, { ss: 1 });
        var d = T.data(c), set = {}, n = 0;
        for (var i = 0; i < d.length; i += 4) if (d[i + 3] === 255) { var k = d[i] + ',' + d[i + 1] + ',' + d[i + 2]; if (!set[k]) { set[k] = 1; n++; } }
        return { n: n, levels: Object.keys(set).map(function (k) { return +k.split(',')[0]; }).sort(function (a, b) { return a - b; }) };
      }
      out.s0 = distinct(0); out.s3 = distinct(3); out.s4 = distinct(4); out.s6 = distinct(6);
      return out;
    });
    check('light.steps 0: smooth flat shading gives many shades (' + stp.s0.n + ' distinct colours on a 1280-face sphere)', stp.s0.n > 40, stp.s0.n);
    check('light.steps 3/4/6: at most 3/4/6 distinct lit colours (' + stp.s3.n + '/' + stp.s4.n + '/' + stp.s6.n + '), evenly spaced levels', stp.s3.n <= 3 && stp.s3.n >= 2 && stp.s4.n <= 4 && stp.s4.n >= 3 && stp.s6.n <= 6 && stp.s6.n >= 4, { s4: stp.s4.levels, s6: stp.s6.levels });
    await h.ctx.close();
  }

  if (want('clip')) {
    section = 'x clip';
    h = await newPage(browser); await h.page.goto(PAGE);
    var cl = await h.page.evaluate(function () {
      var L = LowPoly, FLAT = { key: '#000000', ambient: '#ffffff', hemi: 0 }, out = { errors: [] };
      var cam = { yaw: 0, pitch: 15, dist: 4, target: [0, 0, 0], fov: 35 };
      function ground(z0, z1) { return L.quad([-100, 0, z1], [100, 0, z1], [100, 0, z0], [-100, 0, z0], 'ground'); }
      function shot(mesh, camera, persp) { var c = T.mkCanvas(120, 90); try { L.render(c, { items: [{ mesh: mesh }], camera: camera || cam, light: FLAT, background: { color: 'sky' } }, { ss: 1 }); } catch (e) { out.errors.push(e.message); } var d = new Uint8ClampedArray(T.data(c)); c.remove(); return d; }
      function px(d, x, y) { var i = (y * 120 + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; }
      var big = shot(ground(-100, 100));
      // eye = target + dist * (0, sin15, cos15) = (0, 1.035, 3.864): z in [-100, 100] runs far behind the camera.
      // The part of the ground within 1.0 of the eye (horizontally) is below the bottom of the screen, so cutting there changes nothing visible.
      var split = shot(ground(-100, 3.864 - 1.0));
      var diff = 0, nan = 0; for (var i = 0; i < big.length; i += 4) { if (big[i] !== split[i] || big[i + 1] !== split[i + 1] || big[i + 2] !== split[i + 2]) diff++; }
      out.diff = diff; out.bottom = px(big, 60, 88); out.bottomLeft = px(big, 3, 88); out.top = px(big, 60, 3); out.sky = L.palette.sky; out.ground = L.palette.ground;
      // a count of pixels that are neither sky nor ground = 0 means no garbage from the clipper
      var sky = [0x8d, 0xb3, 0xcf], gr = [0x6c, 0x6a, 0x5f], other = 0;
      for (i = 0; i < big.length; i += 4) { var p = [big[i], big[i + 1], big[i + 2]]; if (!(p.join() === sky.join() || p.join() === gr.join())) other++; }
      out.other = other;
      // camera inside a big box: every face crosses the near plane or is behind: must not throw or fill with garbage
      var inside = shot(L.box(50, 50, 50, 'steel'), { yaw: 20, pitch: 10, dist: 0.5, target: [0, 0, 0] });
      out.insideOk = out.errors.length === 0;
      // wall that passes through the camera plane, camera very close
      var wall = shot(L.box(0.2, 20, 20, 'steel'), { yaw: 90, pitch: 0, dist: 0.3, target: [0, 0, 0] });
      out.wallCentre = px(wall, 60, 45);
      // ortho with items behind the eye plane
      var c = T.mkCanvas(60, 60); L.render(c, { items: [{ mesh: L.box(1, 1, 1, 'steel'), pos: [0, 0, 20] }, { mesh: L.box(1, 1, 1, 'red') }], camera: { yaw: 0, pitch: 0, ortho: true, size: 3, dist: 5, target: [0, 0, 0] }, light: FLAT, background: { color: 'sky' } }, { ss: 1 });
      out.orthoCentre = T.px(c, 30, 30);
      return out;
    });
    check('ground quad 200 x 200 passing behind the camera: no exception, only sky and ground colours in the picture (' + cl.other + ' other pixels)', cl.errors.length === 0 && cl.other === 0, cl);
    check('bottom-centre pixel is ground, top-centre is sky', cl.bottom.slice(0, 3).join() === '108,106,95' && cl.top.slice(0, 3).join() === '141,179,207', { bottom: cl.bottom, top: cl.top });
    check('the clipped ground is pixel-identical to the same ground pre-split in front of the camera (' + cl.diff + ' differing pixels)', cl.diff === 0, cl.diff);
    check('camera inside a huge box, and next to a wall: no exception', cl.insideOk && cl.errors.length === 0, cl.errors);
    check('ortho: an item behind the eye plane is clipped away, the one at the target is drawn (centre pixel red)', cl.orthoCentre[0] > 150 && cl.orthoCentre[1] < 100, cl.orthoCentre);
    await h.ctx.close();
  }

  if (want('palette')) {
    section = '10 palette';
    h = await newPage(browser); await h.page.goto('file://' + path.join(__dirname, 'palette.html'));
    var ps = await h.page.evaluate(function () { return PALETTE_STATS; });
    var purple = ps.filter(function (c) { return c.h >= 255 && c.h <= 345 && c.s > 0.12; }).map(function (c) { return c.name; });
    var neon = ps.filter(function (c) { return c.name !== 'glow' && c.name !== 'glowCool' && c.s >= 0.7 && c.l > 0.35 && c.l < 0.7; }).map(function (c) { return c.name; });
    var maxS = ps.filter(function (c) { return c.name !== 'glow' && c.name !== 'glowCool'; }).reduce(function (m, c) { return c.s > m.s ? c : m; }, { s: 0 });
    var emis = ps.filter(function (c) { return c.name === 'glow' || c.name === 'glowCool'; }).map(function (c) { return c.name + ' s' + Math.round(c.s * 100) + ' l' + Math.round(c.l * 100); });
    var mean = ps.reduce(function (a, c) { return a + c.s; }, 0) / ps.length;
    check('swatch page shows all 39 names', ps.length === 39, ps.length);
    check('no purple or pink anywhere (hue 255-345 with any real saturation): ' + (purple.join(',') || 'none'), purple.length === 0, purple);
    check('no neon: no non-emissive colour with saturation >= 70% at mid lightness (most saturated: ' + maxS.name + ' s' + Math.round(maxS.s * 100) + '%, mean saturation ' + Math.round(mean * 100) + '%); emissives: ' + emis.join(', '), neon.length === 0 && maxS.s < 0.7, neon);
    check('no page errors', h.page.errors.length === 0, h.page.errors);
    await h.ctx.close();
  }

  if (want('stars')) {
    section = 'x stars';
    h = await newPage(browser); await h.page.goto(PAGE);
    var st = await h.page.evaluate(function () {
      var L = LowPoly, a = T.mkCanvas(300, 200), b = T.mkCanvas(300, 200), c = T.mkCanvas(300, 200), d = T.mkCanvas(150, 100);
      var bg = function (seed) { return { items: [], background: { color: 'space', stars: true, seed: seed } }; };
      L.render(a, bg(7), {}); L.render(b, bg(7), {}); L.render(c, bg(8), {}); L.render(d, bg(7), {});
      var da = T.data(a), db = T.data(b), dc = T.data(c), dd = T.data(d), stars = 0, i;
      for (i = 0; i < da.length; i += 4) if (da[i] > 60) stars++;
      var starsSmall = 0; for (i = 0; i < dd.length; i += 4) if (dd[i] > 60) starsSmall++;
      var off = L.render(a, { items: [], background: { color: 'space', stars: false } }, {}); var d0 = T.data(a), none = 0; for (i = 0; i < d0.length; i += 4) if (d0[i] > 60) none++;
      return { same: T.diffCount(da, db, 0), seedDiff: T.diffCount(da, dc, 0), stars: stars, starsSmall: starsSmall, none: none };
    });
    check('stars: the same seed gives the identical image, another seed a different one', st.same === 0 && st.seedDiff > 20, st);
    check('stars exist (' + st.stars + ' lit pixels at 300x200, ' + st.starsSmall + ' at 150x100) and stars:false has none', st.stars > 15 && st.starsSmall > 5 && st.none === 0, st);
    await h.ctx.close();
  }

  await browser.close();
  var failed = results.filter(function (r) { return !r.ok; });
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 1));
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed' + (failed.length ? ', FAILED: ' + failed.map(function (f) { return '[' + f.section + '] ' + f.name; }).join(' | ') : ''));
  process.exit(failed.length ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(2); });
