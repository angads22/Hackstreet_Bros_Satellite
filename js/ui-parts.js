// js/ui-parts.js: the part explainers. One global, PartExplainer; plain ES5, never throws.
//
//   PartExplainer.element(partId, opts)  a <figure class="explainer"> with a small looping animation (flat SVG,
//                                        decoration only, aria-hidden) and a <figcaption> with the part's hook (bold),
//                                        what it does and its catch, all plain DOM text. null for an unknown part.
//                                        opts.compact: the small variant the Build screen's preview uses: the picture and ONE
//                                        short line (the first sentence of what the part does), no hook and no catch.
//   PartExplainer.has(partId)            true when the part has a story and a picture
//   PartExplainer.kinds                  the animation kinds, in order
//
// The words are in js/part-story.js (PART_STORY). Every picture is drawn here with the game's colour tokens
// (var(--accent) and the --pal-* family, with fallbacks), so a theme set on body[data-era] recolours it.
// The motion is CSS keyframes in the "explainers" block at the end of css/style.css (prefix ex-). Every kind's
// plain, un-animated drawing is its poster frame, the key moment of the story: with prefers-reduced-motion
// nothing moves and that frame stays. Each figure's loop has one length (--t) so its parts stay in step.
var PartExplainer = (function () {
  "use strict";

  // ---------------------------------------------------------------- markup helpers (strings of SVG)
  function attrs(o) {
    var s = "", k;
    if (o) for (k in o) if (Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined && o[k] !== null) s += " " + k + '="' + o[k] + '"';
    return s;
  }
  function tag(name, o, cls, st, inner) {
    return "<" + name + attrs(o) + (cls ? ' class="' + cls + '"' : "") + (st ? ' style="' + st + '"' : "") + (inner === undefined ? "/>" : ">" + inner + "</" + name + ">");
  }
  function R(x, y, w, h, cls, st) { return tag("rect", { x: x, y: y, width: w, height: h }, cls, st); }
  function C(x, y, r, cls, st) { return tag("circle", { cx: x, cy: y, r: r }, cls, st); }
  function L(x1, y1, x2, y2, cls, st, w) { return tag("line", { x1: x1, y1: y1, x2: x2, y2: y2, "stroke-width": w }, cls, st); }
  function P(d, cls, st, w) { return tag("path", { d: d, "stroke-width": w }, cls, st); }
  function G(inner, cls, st, tr) { return tag("g", { transform: tr }, cls, st, inner); }
  function pt(x, y) { return "transform-box:view-box;transform-origin:" + x + "px " + y + "px;"; }   // turn or scale about a point
  function d(name, v) { return "--" + name + ":" + v + ";"; }
  // An animated shape: the poster is its plain state, the class names the keyframes.
  function an(cls) { return "ex-a " + cls; }
  function stars() {
    return R(18, 14, 2, 2, "ex-f-white") + R(74, 30, 2, 2, "ex-f-dim") + R(214, 18, 2, 2, "ex-f-white") + R(160, 10, 2, 2, "ex-f-dim") +
      R(28, 96, 2, 2, "ex-f-dim") + R(226, 84, 2, 2, "ex-f-white") + R(120, 6, 2, 2, "ex-f-dim");
  }
  function bg() { return R(0, 0, 240, 150, "ex-f-night") + stars(); }
  // The little satellite: a body with two solar wings, centred on (x, y).
  function sat(x, y, s, o) {
    o = o || {};
    var w = o.nowings ? "" :
      R(-36, -5, 21, 10, "ex-f-cell") + R(15, -5, 21, 10, "ex-f-cell") + L(-26, -5, -26, 5, "ex-s-celld") + L(-19, -5, -19, 5, "ex-s-celld") +
      L(19, -5, 19, 5, "ex-s-celld") + L(26, -5, 26, 5, "ex-s-celld");
    return G(w + R(-15, -9, 30, 18, "ex-f-metal") + R(-15, -9, 30, 4, "ex-f-dark") + (o.inner || ""), "", "", "translate(" + x + " " + y + ") scale(" + (s || 1) + ")");
  }
  function earth(top) {
    return C(120, top + 160, 160, "ex-f-sea") + tag("circle", { cx: 120, cy: top + 160, r: 160, "stroke-width": 2 }, "ex-s-info");
  }
  function dish(x, y, lampCls) {
    return G(L(0, 0, 0, -8, "ex-s-dark", "", 3) + P("M-11 -15 Q0 5 11 -15", "ex-s-metal", "", 3) + C(0, -19, 3.5, lampCls || "ex-f-light"), "", "", "translate(" + x + " " + y + ")");
  }
  function sun(x, y, r, st) {
    var rays = "", i;
    for (i = 0; i < 8; i++) rays += L(x + Math.cos(i * Math.PI / 4) * (r + 3), y + Math.sin(i * Math.PI / 4) * (r + 3), x + Math.cos(i * Math.PI / 4) * (r + 8), y + Math.sin(i * Math.PI / 4) * (r + 8), "ex-s-light", "", 2);
    return G(C(x, y, r, "ex-f-light") + rays, "", st);
  }
  function meter(x, y, w, h, fillCls, anim, v, vertical) {   // a boxed gauge; its fill is the animated part
    var fill = vertical ? R(x + 2, y + 2, w - 4, h - 4, fillCls + " " + an(anim) + " ex-ob", d("v", v) + d("t", "var(--t)")) : R(x + 2, y + 2, w - 4, h - 4, fillCls + " " + an(anim) + " ex-ol", d("v", v));
    return tag("rect", { x: x, y: y, width: w, height: h }, "ex-s-frame") + fill;
  }

  // ---------------------------------------------------------------- the kinds: each returns the SVG's inner markup
  var DRAW = {};

  // The body: the parts fly in and snap into their slots; the payload gauge fills.
  var BODY = {
    "explorer-body": { x: 92, y: 14, w: 44, h: 118, cols: 1, rows: 4, extra: L(114, 14, 114, 4, "ex-s-dark", "", 2) },
    "drum-body": { x: 66, y: 40, w: 96, h: 72, cols: 3, rows: 2, extra: R(60, 46, 6, 60, "ex-f-cell") + R(162, 46, 6, 60, "ex-f-cell") },
    "smallsat-bus": { x: 70, y: 34, w: 88, h: 80, cols: 2, rows: 3, extra: R(106, 114, 16, 8, "ex-f-dark") },
    "nimbus-bus": { x: 74, y: 28, w: 80, h: 92, cols: 2, rows: 4, extra: R(14, 60, 54, 20, "ex-f-cell") + R(160, 60, 54, 20, "ex-f-cell") + L(68, 70, 74, 70, "ex-s-dark", "", 3) + L(154, 70, 160, 70, "ex-s-dark", "", 3) },
    "cubesat-12u": { x: 88, y: 38, w: 52, h: 72, cols: 2, rows: 3, extra: "" }
  };
  var PCLS = ["ex-f-accent", "ex-f-cell", "ex-f-info", "ex-f-light", "ex-f-metal", "ex-f-red", "ex-f-celll", "ex-f-dark"];
  DRAW.body = function (id) {
    var b = BODY[id] || BODY["smallsat-bus"], s = bg(), i, n = b.cols * b.rows, cw = (b.w - 12) / b.cols, ch = (b.h - 12) / b.rows, col, row, x, y, from;
    s += b.extra + R(b.x, b.y, b.w, b.h, "ex-f-frame") + tag("rect", { x: b.x, y: b.y, width: b.w, height: b.h, "stroke-width": 3 }, "ex-s-metal");
    for (i = 0; i < n; i++) {
      col = i % b.cols; row = Math.floor(i / b.cols);
      x = b.x + 6 + col * cw; y = b.y + 6 + row * ch;
      from = (i % 2 ? 1 : -1) * (46 + (i % 3) * 14);
      s += tag("rect", { x: x + 2, y: y + 2, width: cw - 4, height: ch - 4, "stroke-width": 1.5, "stroke-dasharray": "3 3" }, "ex-s-dark");
      s += R(x + 3, y + 3, cw - 6, ch - 6, PCLS[i % PCLS.length] + " " + an("ex-in" + (1 + i % 3)), d("fx", from + "px") + d("fy", (i % 2 ? -26 : 26) + "px"));
    }
    return s + meter(186, 26, 18, 98, "ex-f-light", "ex-gauge", 1, true);
  };

  // Spin stabilisation: it turns like a top, and its axis keeps pointing at the same star.
  DRAW.spin = function () {
    return bg() + P("M120 38 L120 10", "ex-s-light", "stroke-dasharray:3 4", 2) + R(116, 2, 8, 8, "ex-f-light", "transform:rotate(45deg);transform-box:fill-box;transform-origin:center") +
      R(98, 44, 44, 52, "ex-f-metal") + R(98, 44, 44, 6, "ex-f-dark") + R(98, 90, 44, 6, "ex-f-dark") +
      G(R(100, 56, 8, 26, "ex-f-accent") + R(116, 56, 8, 26, "ex-f-accent") + R(132, 56, 8, 26, "ex-f-accent"), an("ex-whirl"), pt(120, 69)) +
      G(G(tag("circle", { cx: 120, cy: 112, r: 34, "stroke-width": 3 }, "ex-s-info") + C(150, 112, 5, "ex-f-light") + L(120, 112, 150, 112, "ex-s-dim", "", 2), an("ex-spin"), pt(120, 112)), "", "", "") +
      P("M60 108 Q62 126 94 130", "ex-s-light", "", 3) + P("M94 130 L86 124 M94 130 L88 136", "ex-s-light", "", 3);
  };

  // Reaction wheels: the wheel spins one way, the satellite turns the other, then both hold.
  DRAW.wheel = function () {
    var spokes = "", i;
    for (i = 0; i < 6; i++) spokes += L(120, 82, 120 + Math.cos(i * Math.PI / 3) * 16, 82 + Math.sin(i * Math.PI / 3) * 16, "ex-s-dark", "", 3);
    return bg() + earth(118) + R(170, 106, 8, 12, "ex-f-red") + L(150, 40, 172, 104, "ex-s-light", "stroke-dasharray:4 4", 2) +
      G(R(88, 56, 64, 52, "ex-f-metal") + R(88, 56, 64, 8, "ex-f-dark") + R(70, 76, 18, 12, "ex-f-cell") + R(152, 76, 18, 12, "ex-f-cell") +
        R(142, 48, 12, 10, "ex-f-light") +
        tag("circle", { cx: 120, cy: 82, r: 17, "stroke-width": 3 }, "ex-s-frame") + G(spokes + C(120, 82, 3, "ex-f-frame") + C(134, 82, 3.5, "ex-f-accent"), an("ex-spinr"), pt(120, 82)),
        an("ex-turn"), pt(120, 82)) +
      C(204, 24, 6, "ex-f-light", "") + P("M208 36 Q196 52 184 46", "ex-s-light", "", 2);
  };

  // A tick row: a bar that fills in steps, over dark tick marks.
  function ticks(x, y, w, h, n, anim, v) {
    var s = R(x, y, w, h, "ex-f-frame") + R(x, y, w, h, "ex-f-accent " + an(anim) + " ex-ol", d("v", v) + d("n", n)), i;
    for (i = 1; i < n; i++) s += R(x + w * i / n - 1, y, 2, h, "ex-f-night");
    return s + tag("rect", { x: x, y: y, width: w, height: h, "stroke-width": 2 }, "ex-s-metal");
  }
  function particles(list, late) {   // streaks of radiation crossing the picture; the dense group only arrives late in the loop
    var s = "", i, p;
    for (i = 0; i < list.length; i++) {
      p = list[i];
      s += L(p[0] - 6, p[1] - 6, p[0] + 6, p[1] + 6, "ex-s-light " + an("ex-pass"), d("dx", "34px") + d("dy", "34px") + d("dl", p[2] + "s"), 2);
    }
    return late ? G(s, an("ex-late")) : s;
  }
  // Geiger counter: ticks arrive one by one, then the flood swamps it: the row goes solid, the lamp stops blinking.
  DRAW.geiger = function () {
    var s = bg(), i;
    s += R(24, 34, 104, 30, "ex-f-metal") + R(24, 34, 104, 7, "ex-f-dark") + L(30, 56, 122, 56, "ex-s-frame", "", 2) + L(28, 49, 124, 49, "ex-s-frame", "", 1) + R(14, 44, 10, 10, "ex-f-dark") + R(128, 44, 10, 10, "ex-f-dark");
    s += particles([[40, 14, -0.2], [74, 8, -1.4], [108, 10, -2.6]]);
    s += particles([[56, 20, -0.9], [92, 16, -2.0], [126, 14, -3.2], [24, 24, -1.7], [112, 26, -0.5], [68, 28, -2.9]], true);
    s += C(186, 48, 14, "ex-f-frame") + C(186, 48, 10, "ex-f-light " + an("ex-swamp")) + tag("circle", { cx: 186, cy: 48, r: 14, "stroke-width": 2 }, "ex-s-metal");
    s += ticks(24, 94, 192, 22, 12, "ex-bar ex-steps ex-swampbar", 1);
    return s + R(24, 124, 6, 6, "ex-f-dim") + R(36, 124, 6, 6, "ex-f-dim");
  };
  // Scintillation counter: a crystal flashes with every hit; the row keeps counting, and the belt gets mapped.
  DRAW.scint = function () {
    var s = bg();
    s += R(36, 32, 66, 38, "ex-f-celll") + tag("rect", { x: 36, y: 32, width: 66, height: 38, "stroke-width": 3 }, "ex-s-metal") + R(102, 42, 22, 18, "ex-f-dark");
    s += R(44, 40, 50, 22, "ex-f-white " + an("ex-hits"));
    s += particles([[50, 14, -0.2], [86, 10, -1.4], [68, 18, -2.6], [100, 16, -3.1]], true) + particles([[44, 12, -0.8], [78, 8, -2.0]]);
    s += ticks(24, 92, 120, 18, 12, "ex-bar ex-steps", 0.75);
    s += tag("rect", { x: 152, y: 24, width: 68, height: 62, "stroke-width": 2 }, "ex-s-frame") +
      P("M158 80 Q168 76 176 60 Q186 34 196 34 Q206 34 214 80", "ex-s-info " + an("ex-draw"), "stroke-dasharray:400;stroke-dashoffset:0", 3);
    return s + R(24, 122, 6, 6, "ex-f-dim") + R(36, 122, 6, 6, "ex-f-dim");
  };

  // Cloud photocells: a cloud drifts under the satellite and the brightness meter follows it.
  DRAW.cloudcell = function () {
    var cloud = C(0, 0, 14, "ex-f-white") + C(16, 4, 11, "ex-f-white") + C(-16, 5, 10, "ex-f-white") + R(-24, 4, 48, 11, "ex-f-white");
    return bg() + sun(28, 26, 9) + L(34, 38, 100, 86, "ex-s-light", "stroke-dasharray:3 5", 2) +
      earth(112) + sat(120, 28, 0.8, { inner: C(0, 11, 3, "ex-f-light") }) + P("M112 40 L96 100 M128 40 L144 100", "ex-s-light", "stroke-dasharray:3 4", 2) +
      G(G(cloud, an("ex-pass ex-slow"), d("dx", "90px") + d("dy", "0px")), "", "", "translate(120 102)") +
      meter(196, 34, 22, 84, "ex-f-light", "ex-cloudbar", 1, true) + R(196, 122, 22, 4, "ex-f-dim");
  };

  // TV camera: the pictures scan in line by line, and the swath is wide. (Vidicon: two cameras. AVCS: several.)
  DRAW.tvcam = function (id) {
    var n = id === "avcs-camera" ? 3 : 2, s = bg() + earth(120), i, x, beams = "";
    s += sat(70, 30, 0.8, { inner: "" });
    for (i = 0; i < n; i++) {
      x = 70 + (i - (n - 1) / 2) * 12;
      beams += P("M" + x + " 42 L" + (x + (i - (n - 1) / 2) * 26 - (id === "avcs-camera" ? 0 : (i ? -14 : 8))) + " 118", "ex-s-light", "stroke-dasharray:3 4", 2) + R(x - 3, 38, 6, 8, "ex-f-dark");
    }
    s += beams + R(40, 108, 60, 5, "ex-f-white");
    s += R(132, 26, 90, 76, "ex-f-metal") + R(138, 32, 78, 64, "ex-f-night") + C(160, 54, 10, "ex-f-white") + C(176, 60, 12, "ex-f-white") + R(150, 58, 40, 10, "ex-f-white") +
      C(196, 44, 8, "ex-f-white") + R(146, 78, 64, 6, "ex-f-info") + R(160, 86, 40, 4, "ex-f-info");
    s += R(138, 32, 78, 64, "ex-f-night " + an("ex-scan ex-steps ex-ob"), d("n", 8) + d("v", 0));
    return s + R(172, 104, 18, 6, "ex-f-dark") + R(164, 110, 34, 4, "ex-f-dark");
  };

  // Optical camera: the ground strip scrolls by, the shutter flashes, and at night the picture goes dark.
  DRAW.camera = function () {
    var s = bg(), i, strip = "", cols = ["ex-f-sea", "ex-f-cell", "ex-f-celll", "ex-f-celld"];
    for (i = 0; i < 12; i++) strip += R(i * 40, 0, 38, 30, cols[i % 4]) + R(i * 40 + 6, 6, 14, 8, "ex-f-light") + R(i * 40 + 24, 18, 10, 6, "ex-f-white");
    s += sat(120, 24, 0.8, { inner: C(0, 11, 4, "ex-f-night") }) + P("M112 40 L72 96 M128 40 L168 96", "ex-s-light", "stroke-dasharray:3 4", 2);
    s += G(G(strip, an("ex-scroll"), "", ""), "", "", "translate(0 96)") + R(72, 94, 96, 34, "ex-f-white " + an("ex-flash")) + tag("rect", { x: 72, y: 94, width: 96, height: 34, "stroke-width": 3 }, "ex-s-light");
    s += R(0, 96, 240, 30, "ex-f-night " + an("ex-nightfall"));
    s += meter(40, 136, 160, 8, "ex-f-accent", "ex-bar", 1, false);
    return s;
  };

  // Solar X-ray photometer: a flare erupts, X-rays flicker across, the graph spikes.
  DRAW.xray = function () {
    var flare = "", i;
    for (i = 0; i < 7; i++) flare += L(40 + Math.cos(i * 0.9 - 1.4) * 26, 44 + Math.sin(i * 0.9 - 1.4) * 26, 40 + Math.cos(i * 0.9 - 1.4) * 38, 44 + Math.sin(i * 0.9 - 1.4) * 38, "ex-s-accent", "", 4);
    return bg() + G(C(40, 44, 24, "ex-f-light") + G(flare, an("ex-flare"), pt(40, 44)) + C(40, 44, 24, "ex-f-light"), "") +
      P("M70 40 l10 -6 l10 6 l10 -6 l10 6 l10 -6 l10 6", "ex-s-white " + an("ex-pass"), d("dx", "40px") + d("dy", "10px"), 2) +
      P("M70 60 l10 -6 l10 6 l10 -6 l10 6 l10 -6 l10 6", "ex-s-white " + an("ex-pass"), d("dx", "40px") + d("dy", "10px") + d("dl", "-1.4s"), 2) +
      sat(196, 54, 0.7, {}) +
      tag("rect", { x: 20, y: 96, width: 200, height: 44, "stroke-width": 2 }, "ex-s-frame") +
      P("M24 130 L70 128 L96 130 L120 126 L138 70 L150 126 L170 130 L214 128", "ex-s-accent " + an("ex-draw"), "stroke-dasharray:400;stroke-dashoffset:0", 3);
  };

  // X-ray spectrometer: the beam goes through a prism and splits into bands, each with its own bar.
  DRAW.spectro = function () {
    return bg() + sun(30, 48, 14) + L(52, 48, 92, 48, "ex-s-white " + an("ex-beam"), "", 4) + P("M92 28 L92 68 L120 48 Z", "ex-f-celll") +
      tag("path", { d: "M92 28 L92 68 L120 48 Z", "stroke-width": 3 }, "ex-s-metal") +
      L(120, 48, 170, 24, "ex-s-red " + an("ex-beam"), "", 3) + L(120, 48, 170, 40, "ex-s-accent " + an("ex-beam"), d("dl", "-0.4s"), 3) +
      L(120, 48, 170, 56, "ex-s-light " + an("ex-beam"), d("dl", "-0.8s"), 3) + L(120, 48, 170, 72, "ex-s-info " + an("ex-beam"), d("dl", "-1.2s"), 3) +
      R(178, 20, 10, 8, "ex-f-red") + R(178, 36, 10, 8, "ex-f-accent") + R(178, 52, 10, 8, "ex-f-light") + R(178, 68, 10, 8, "ex-f-info") +
      R(190, 20, 34, 8, "ex-f-red " + an("ex-bar ex-ol"), d("v", 0.4)) + R(190, 36, 34, 8, "ex-f-accent " + an("ex-bar ex-ol"), d("v", 1) + d("dl", "-0.5s")) +
      R(190, 52, 34, 8, "ex-f-light " + an("ex-bar ex-ol"), d("v", 0.7) + d("dl", "-1s")) + R(190, 68, 34, 8, "ex-f-info " + an("ex-bar ex-ol"), d("v", 0.25) + d("dl", "-1.5s")) +
      sat(60, 112, 0.7, {}) + L(60, 100, 36, 62, "ex-s-light", "stroke-dasharray:3 4", 2);
  };

  // Thermal imager: smoke drifts over the ground, and the heat of a fire still lights up cell by cell.
  DRAW.thermal = function () {
    var g = "", r, c, heat = { "2,3": "ex-f-light", "2,2": "ex-f-accent", "3,2": "ex-f-red", "3,3": "ex-f-accent", "2,4": "ex-f-light", "1,3": "ex-f-light", "3,4": "ex-f-light" }, k, i = 0;
    for (r = 0; r < 5; r++) for (c = 0; c < 8; c++) g += R(106 + c * 14, 40 + r * 14, 12, 12, "ex-f-celld");
    g += G(G(C(0, 0, 18, "ex-f-dim") + C(22, 4, 14, "ex-f-dim") + C(-20, 6, 12, "ex-f-dim") + R(-26, 4, 56, 14, "ex-f-dim"), an("ex-pass ex-slow ex-smoke"), d("dx", "36px") + d("dy", "0px")), "", "", "translate(150 76)");
    for (k in heat) if (Object.prototype.hasOwnProperty.call(heat, k)) {
      r = +k.split(",")[0]; c = +k.split(",")[1];
      g += R(106 + c * 14, 40 + r * 14, 12, 12, heat[k] + " " + an("ex-pop"), d("dl", (-0.3 * (i++)) + "s"));
    }
    return bg() + sat(46, 30, 0.7, { inner: R(-6, 9, 12, 4, "ex-f-red") }) + P("M46 44 L110 54 M46 44 L110 110", "ex-s-red", "stroke-dasharray:3 4", 2) + g;
  };

  // Radar: pulses go down through the cloud, echoes come back from the ground.
  DRAW.radar = function () {
    var cloud = C(0, 0, 12, "ex-f-white") + C(16, 3, 10, "ex-f-white") + C(-16, 4, 9, "ex-f-white") + R(-24, 3, 46, 9, "ex-f-white");
    return bg() + earth(116) + G(cloud, "", "", "translate(60 78)") + G(cloud, "", "", "translate(170 84)") + G(cloud, "", "", "translate(116 70)") +
      P("M60 126 L72 116 L84 126 Z M150 128 L162 114 L174 128 Z", "ex-f-celld") +
      sat(120, 22, 0.8, { inner: R(-12, 9, 24, 4, "ex-f-accent") }) + P("M114 40 L60 120 M126 40 L180 120", "ex-s-accent", "stroke-dasharray:2 5", 2) +
      P("M96 72 Q120 82 144 72", "ex-s-accent " + an("ex-pass"), d("dx", "0px") + d("dy", "30px"), 4) +
      P("M100 66 Q120 74 140 66", "ex-s-accent " + an("ex-pass"), d("dx", "0px") + d("dy", "30px") + d("dl", "-1.8s"), 3) +
      P("M70 100 Q90 92 110 100", "ex-s-info " + an("ex-pass"), d("dx", "0px") + d("dy", "-34px") + d("dl", "-0.9s"), 3) +
      P("M136 100 Q156 92 176 100", "ex-s-info " + an("ex-pass"), d("dx", "0px") + d("dy", "-34px") + d("dl", "-2.2s"), 3);
  };

  // Topside sounder: a swept signal goes down to the ionosphere, echoes come back; long antennas, a sweep marker.
  DRAW.sounder = function (id) {
    var deep = id === "alouette-2-sounder";
    return bg() + earth(124) + R(0, 70, 240, 16, "ex-f-info", "opacity:.55") + P("M0 70 H240 M0 86 H240", "ex-s-info", "", 2) +
      (deep ? R(0, 100, 240, 7, "ex-f-info", "opacity:.3") : "") +
      L(20, 26, 220, 26, "ex-s-metal", "", 2) + sat(120, 26, 0.6, {nowings: true}) +
      P("M102 42 Q120 52 138 42", "ex-s-light " + an("ex-pass"), d("dx", "0px") + d("dy", "26px"), 4) +
      P("M106 38 Q120 46 134 38", "ex-s-light " + an("ex-pass"), d("dx", "0px") + d("dy", "26px") + d("dl", "-1.3s"), 3) +
      P("M98 78 Q120 68 142 78", "ex-s-white " + an("ex-pass"), d("dx", "0px") + d("dy", "-28px") + d("dl", "-0.7s"), 3) +
      P("M98 78 Q120 68 142 78", "ex-s-white " + an("ex-pass"), d("dx", "0px") + d("dy", "-28px") + d("dl", "-2.0s"), 3) +
      (deep ? P("M96 106 Q120 98 144 106", "ex-s-white " + an("ex-pass"), d("dx", "0px") + d("dy", "-40px") + d("dl", "-1.5s"), 2) : "") +
      tag("rect", { x: 200, y: 38, width: 24, height: 76, "stroke-width": 2 }, "ex-s-frame") + R(204, 56, 16, 5, "ex-f-accent " + an("ex-sweep"), d("sw", deep ? "52px" : "30px"));
  };

  // Solar cells: sunrays charge the panel; then Earth's shadow covers the Sun and the output drops. (n-on-p: a particle storm.)
  var SOLAR = { "silicon-cells": { v: 0.35, size: 1, storm: false }, "solar-small": { v: 0.6, size: 1, storm: false }, "solar-large": { v: 1, size: 1.35, storm: false }, "n-on-p-cells": { v: 0.5, size: 1, storm: true } };
  DRAW.solar = function (id) {
    var o = SOLAR[id] || SOLAR["solar-small"], s = bg(), i, w = 80 * o.size, h = 56 * o.size, x = 112 - w / 2, y = 94 - h / 2, cells = "";
    for (i = 1; i < 5; i++) cells += L(x + w * i / 5, y, x + w * i / 5, y + h, "ex-s-celld", "", 2);
    for (i = 1; i < 3; i++) cells += L(x, y + h * i / 3, x + w, y + h * i / 3, "ex-s-celld", "", 2);
    s += sun(34, 30, 11, "") + G(C(34, 30, 24, "ex-f-night"), an("ex-eclipse"), d("dx", "-60px"), "");
    s += R(x, y, w, h, "ex-f-cell") + cells + tag("rect", { x: x, y: y, width: w, height: h, "stroke-width": 3 }, "ex-s-metal");
    if (o.storm) {
      for (i = 0; i < 4; i++) s += L(150 + i * 14, 20 + (i % 2) * 14, 140 + i * 14, 34 + (i % 2) * 14, "ex-s-red " + an("ex-pass"), d("dx", "14px") + d("dy", "26px") + d("dl", -0.7 * i + "s"), 3);
    } else {
      for (i = 0; i < 3; i++) s += L(46 + i * 16, 42 + i * 4, 78 + i * 16, 74 + i * 4, "ex-s-light " + an("ex-ray"), d("dl", -0.3 * i + "s"), 2);
    }
    return s + meter(190, 24, 24, 100, "ex-f-light", o.storm ? "ex-solarbar2" : "ex-solarbar", o.v, true);
  };

  // Rechargeable battery: it fills in the Sun, drains through the shadow, and the instrument never goes dark.
  DRAW.battery = function (id) {
    var big = id === "battery-28v", w = big ? 72 : 58, x = 120 - w / 2;
    return bg() + sun(34, 30, 11) + G(C(34, 30, 24, "ex-f-night"), an("ex-eclipse ex-eclipse2"), d("dx", "-60px"), "") +
      R(x + w / 2 - 9, 36, 18, 8, "ex-f-metal") + R(x, 44, w, 76, "ex-f-frame") + R(x + 4, 48, w - 8, 68, "ex-f-night") +
      R(x + 6, 50, w - 12, 64, (big ? "ex-f-info" : "ex-f-light") + " " + an("ex-level ex-ob"), d("v", 0.8)) + tag("rect", { x: x, y: 44, width: w, height: 76, "stroke-width": 3 }, "ex-s-metal") +
      P("M60 74 L84 74 M76 66 L84 74 L76 82", "ex-s-light " + an("ex-inarrow"), "", 3) + P("M156 90 L180 90 M172 82 L180 90 L172 98", "ex-s-accent " + an("ex-outarrow"), "", 3) +
      C(204, 90, 10, "ex-f-accent") + tag("circle", { cx: 204, cy: 90, r: 10, "stroke-width": 3 }, "ex-s-metal");
  };

  // One-way battery: the charge only goes down, the radio rings fade, and at empty the satellite falls silent.
  DRAW.drain = function (id) {
    var big = id === "silver-zinc-battery", w = big ? 80 : 50, x = 108 - w / 2;
    return bg() + sat(188, 40, 0.7, { nowings: true, inner: L(0, -9, 0, -18, "ex-s-metal", "", 2) }) +
      G(tag("circle", { cx: 188, cy: 40, r: 40, "stroke-width": 3 }, "ex-s-info " + an("ex-ping"), d("s", 0.7)) + tag("circle", { cx: 188, cy: 40, r: 40, "stroke-width": 3 }, "ex-s-info " + an("ex-ping"), d("s", 0.45) + d("dl", "-1.4s")), an("ex-silence")) +
      R(x + w / 2 - 8, 36, 16, 8, "ex-f-metal") + R(x, 44, w, 76, "ex-f-frame") + R(x + 4, 48, w - 8, 68, "ex-f-night") +
      R(x + 6, 50, w - 12, 64, "ex-f-accent " + an("ex-drainlevel ex-ob"), d("v", 0.25)) + tag("rect", { x: x, y: 44, width: w, height: 76, "stroke-width": 3 }, "ex-s-metal") +
      G(C(0, 0, 11, "ex-f-light") + L(-8, 0, 8, 0, "ex-s-dim", "", 1) , "", "opacity:.35", "translate(40 90)") + L(28, 78, 52, 102, "ex-s-red", "", 4) + L(52, 78, 28, 102, "ex-s-red", "", 4) +
      (big ? R(x + 4, 124, w - 8, 10, "ex-f-dark") : "");
  };

  // Radio: rings spread from the satellite toward the dish, packets stream along the link, the dish lamp lights.
  var RADIO = {
    "minitrack-beacon": { n: 1, w: 1.5, dig: false, rings: 1 }, "vhf-telemetry": { n: 2, w: 3, dig: false, rings: 2 }, "pcm-telemetry": { n: 3, w: 3, dig: true, rings: 2 },
    "radio-uhf": { n: 2, w: 2, dig: false, rings: 2 }, "radio-sband": { n: 4, w: 5, dig: false, rings: 3 }, "radio-xband": { n: 6, w: 8, dig: false, rings: 3 }
  };
  DRAW.radio = function (id) {
    var o = RADIO[id] || RADIO["radio-uhf"], s = bg() + earth(118), i, p, win;
    s += sat(54, 40, 0.8, { inner: L(0, -9, 0, -20, "ex-s-metal", "", 2) + C(0, -22, 3, "ex-f-light") });
    for (i = 0; i < o.rings; i++) s += tag("circle", { cx: 54, cy: 40, r: 70, "stroke-width": 2 }, "ex-s-info " + an("ex-ping"), d("s", 0.9 - i * 0.2) + d("dl", -(i * 1.2) + "s"));
    s += L(66, 48, 176, 108, "ex-s-dim", "stroke-dasharray:2 5", o.w);
    for (i = 0; i < o.n; i++) {
      win = 1 + (i % 4);
      p = R(0, 0, o.dig ? 7 : 6, o.dig ? 7 : 6, (o.dig && i % 2 ? "ex-f-info" : "ex-f-light") + " " + an("ex-send" + win), d("dx", "100px") + d("dy", "56px"), "");
      s += G(p, "", "", "translate(68 46)");
    }
    return s + dish(184, 118, "ex-f-light " + an("ex-view"));
  };

  // Tape recorder: reels turn while the dish is out of reach, then everything is dumped when it comes into view.
  DRAW.tape = function () {
    var spokes = "", i, j;
    for (j = 0; j < 2; j++) {
      var cx = j ? 92 : 40, sp = "";
      for (i = 0; i < 3; i++) sp += L(cx + Math.cos(i * 2.094) * 14, 70 + Math.sin(i * 2.094) * 14, cx - Math.cos(i * 2.094) * 14, 70 - Math.sin(i * 2.094) * 14, "ex-s-dark", "", 3);
      spokes += C(cx, 70, 20, "ex-f-metal") + G(sp + C(cx, 70, 4, "ex-f-frame"), an("ex-spin"), pt(cx, 70));
    }
    return bg() + R(14, 38, 104, 64, "ex-f-frame") + tag("rect", { x: 14, y: 38, width: 104, height: 64, "stroke-width": 3 }, "ex-s-metal") + spokes +
      P("M44 90 L88 90", "ex-s-light", "", 2) + C(26, 48, 4, "ex-f-red " + an("ex-blink")) +
      meter(24, 112, 84, 10, "ex-f-accent", "ex-fillthendump", 0.5, false) +
      L(120, 62, 164, 90, "ex-s-dim", "stroke-dasharray:2 5", 3) + G(R(0, 0, 6, 6, "ex-f-light " + an("ex-send4"), d("dx", "44px") + d("dy", "28px")) + R(-8, -3, 6, 6, "ex-f-light " + an("ex-send3"), d("dx", "44px") + d("dy", "28px")) + R(-16, -6, 6, 6, "ex-f-light " + an("ex-send2"), d("dx", "44px") + d("dy", "28px")), "", "", "translate(124 62)") +
      G(dish(0, 0, "ex-f-light " + an("ex-view")), an("ex-appear"), "", "translate(190 120)");
  };

  // Command timer: a clock hand sweeps and the schedule blocks light as it passes.
  DRAW.timer = function () {
    var ticks12 = "", i;
    for (i = 0; i < 12; i++) ticks12 += L(60 + Math.cos(i * Math.PI / 6) * 28, 74 + Math.sin(i * Math.PI / 6) * 28, 60 + Math.cos(i * Math.PI / 6) * 33, 74 + Math.sin(i * Math.PI / 6) * 33, "ex-s-metal", "", 3);
    var rows = "", r, c, on = { "0,1": 1, "1,3": 1, "2,2": 1, "3,4": 1 };
    for (r = 0; r < 4; r++) {
      rows += R(112, 40 + r * 24, 14, 16, "ex-f-dark") + R(130, 40 + r * 24, 96, 16, "ex-f-frame");
      for (c = 0; c < 5; c++) rows += R(132 + c * 19, 42 + r * 24, 15, 12, (on[r + "," + c] ? "ex-f-light " + an("ex-pop") : "ex-f-celld"), on[r + "," + c] ? d("dl", -(r * 0.9) + "s") : "");
    }
    return bg() + C(60, 74, 38, "ex-f-metal") + tag("circle", { cx: 60, cy: 74, r: 38, "stroke-width": 3 }, "ex-s-dark") + ticks12 + G(L(60, 74, 60, 50, "ex-s-accent", "", 4), an("ex-spin ex-hand"), pt(60, 74)) + C(60, 74, 4, "ex-f-frame") + rows;
  };

  // The computers.
  function chip(x, y, s, bits) {
    var pins = "", i;
    for (i = 0; i < 5; i++) pins += R(x - 6, y + 8 + i * (s - 16) / 4 - 2, 6, 4, "ex-f-dark") + R(x + s, y + 8 + i * (s - 16) / 4 - 2, 6, 4, "ex-f-dark") + R(x + 8 + i * (s - 16) / 4 - 2, y - 6, 4, 6, "ex-f-dark") + R(x + 8 + i * (s - 16) / 4 - 2, y + s, 4, 6, "ex-f-dark");
    return pins + R(x, y, s, s, "ex-f-frame") + tag("rect", { x: x, y: y, width: s, height: s, "stroke-width": 3 }, "ex-s-metal") + (bits || "");
  }
  DRAW.cpu = function () {
    var tasks = "", i;
    for (i = 0; i < 3; i++) tasks += R(24, 44 + i * 22, 48, 10, "ex-f-frame") + R(24, 44 + i * 22, 48, 10, "ex-f-info " + an("ex-bar ex-ol"), d("v", 1) + d("dl", -i * 0.9 + "s"));
    return bg() + tasks + L(74, 49, 100, 74, "ex-s-dim", "", 2) + L(74, 71, 100, 74, "ex-s-dim", "", 2) + L(74, 93, 100, 78, "ex-s-dim", "", 2) +
      chip(100, 52, 44, C(122, 74, 8, "ex-f-light " + an("ex-beat"))) +
      L(150, 74, 176, 48, "ex-s-dim", "", 2) + L(150, 74, 176, 74, "ex-s-dim", "", 2) + L(150, 74, 176, 100, "ex-s-dim", "", 2) +
      R(178, 40, 28, 16, "ex-f-cell " + an("ex-pop"), d("dl", "-0.2s")) + R(178, 66, 28, 16, "ex-f-accent " + an("ex-pop"), d("dl", "-1.2s")) + R(178, 92, 28, 16, "ex-f-light " + an("ex-pop"), d("dl", "-2.2s")) +
      meter(104, 118, 36, 8, "ex-f-light", "ex-bar", 0.15, false);
  };
  DRAW.cpurad = function () {
    var bits = "", r, c;
    for (r = 0; r < 4; r++) for (c = 0; c < 4; c++) bits += (r === 1 && c === 2) ? R(110 + c * 10, 66 + r * 10, 8, 8, "ex-f-red " + an("ex-flip")) : R(110 + c * 10, 66 + r * 10, 8, 8, "ex-f-info");
    return bg() + chip(100, 56, 64, bits) + tag("circle", { cx: 142, cy: 87, r: 9, "stroke-width": 2.5 }, "ex-s-light " + an("ex-flip2")) +
      L(190, 16, 146, 80, "ex-s-red " + an("ex-pass ex-hit"), d("dx", "20px") + d("dy", "26px") + d("dl", "-0.6s"), 4) + L(210, 40, 166, 104, "ex-s-light " + an("ex-pass ex-hit"), d("dx", "18px") + d("dy", "24px") + d("dl", "-1.2s"), 3) +
      P("M24 120 l6 7 l14 -16", "ex-s-info " + an("ex-check"), "", 4);
  };
  DRAW.cpudata = function () {
    var mem = "", r, c, i = 0;
    for (r = 0; r < 4; r++) for (c = 0; c < 6; c++) mem += R(112 + c * 16, 20 + r * 16, 13, 13, (i++ % 3 === 0 ? "ex-f-info " + an("ex-pop") : "ex-f-celld"), i % 3 === 1 ? d("dl", -(i % 4) * 0.8 + "s") : "");
    return bg() + mem + R(14, 64, 24, 24, "ex-f-accent " + an("ex-pass ex-slow"), d("dx", "18px") + d("dy", "0px")) + R(14, 98, 24, 24, "ex-f-accent " + an("ex-pass ex-slow"), d("dx", "18px") + d("dy", "0px") + d("dl", "-1.6s")) +
      chip(62, 92, 40, tag("path", { d: "M72 112 l8 8 l14 -16", "stroke-width": 4 }, "ex-s-info")) +
      R(180, 100, 12, 12, "ex-f-info " + an("ex-pass ex-slow"), d("dx", "24px") + d("dy", "0px")) + R(180, 118, 12, 12, "ex-f-info " + an("ex-pass ex-slow"), d("dx", "24px") + d("dy", "0px") + d("dl", "-1.6s")) +
      dish(222, 130, "ex-f-light " + an("ex-view"));
  };

  // Thrusters: a burn lifts (or lowers) the orbit; the ion one is a gentle, long, blue stream.
  var THRUST = { "prop-green-small": { dir: -1, big: false }, "prop-green-large": { dir: 1, big: true } };
  DRAW.thruster = function (id) {
    var o = THRUST[id] || THRUST["prop-green-large"], r2 = o.dir > 0 ? 62 : 38, flame = o.big ? 26 : 16;
    return bg() + C(120, 78, 22, "ex-f-sea") + tag("circle", { cx: 120, cy: 78, r: 22, "stroke-width": 2 }, "ex-s-info") +
      tag("circle", { cx: 120, cy: 78, r: 50, "stroke-width": 2, "stroke-dasharray": "4 5" }, "ex-s-dim") +
      tag("circle", { cx: 120, cy: 78, r: r2, "stroke-width": 3 }, "ex-s-accent " + an("ex-ringgrow"), d("g0", (50 / r2).toFixed(3))) +
      G(G(R(-9, -5, 18, 10, "ex-f-metal") + R(-3, -9, 6, 4, "ex-f-cell") + R(9, -2, flame, 4, "ex-f-flame " + an("ex-flick ex-ol")) + R(9, -1, flame * 0.6, 2, "ex-f-light " + an("ex-flick ex-ol"), d("dl", "-0.2s")), "", "", "translate(170 78) rotate(-90)"), an("ex-orbit"), pt(120, 78)) +
      (o.dir > 0 ? P("M186 36 L200 22 M200 22 L190 22 M200 22 L200 32", "ex-s-accent", "", 3) : P("M200 36 L186 22 M186 22 L196 22 M186 22 L186 32", "ex-s-accent", "", 3));
  };
  DRAW.ion = function () {
    var dots = "", i;
    for (i = 0; i < 6; i++) dots += C(76 - i * 12, 78 + (i % 2 ? 3 : -3), 2.5, "ex-f-ion " + an("ex-ionpass"), d("dl", -i * 0.5 + "s"));
    return bg() + tag("circle", { cx: 150, cy: 150, r: 74, "stroke-width": 2, "stroke-dasharray": "4 5" }, "ex-s-dim") + tag("circle", { cx: 150, cy: 150, r: 92, "stroke-width": 3 }, "ex-s-ion " + an("ex-ringgrow ex-slowgrow"), d("g0", "0.8")) +
      R(10, 74, 62, 8, "ex-f-ion", "opacity:.35") + dots + sat(120, 78, 0.9, {}) + R(100, 70, 4, 16, "ex-f-dark") +
      meter(24, 24, 100, 8, "ex-f-ion", "ex-bar ex-linear", 0.6, false) + meter(24, 122, 100, 8, "ex-f-accent", "ex-bar", 0.95, false);
  };

  // ---------------------------------------------------------------- the module
  var KINDS = ["body", "spin", "wheel", "geiger", "scint", "cloudcell", "tvcam", "camera", "xray", "spectro", "thermal", "radar", "sounder",
    "solar", "battery", "drain", "radio", "tape", "timer", "cpu", "cpurad", "cpudata", "thruster", "ion"];
  var LENGTH = { body: 5, spin: 3.2, wheel: 4, geiger: 5, scint: 5, cloudcell: 4.5, tvcam: 4, camera: 4.8, xray: 4, spectro: 3.6, thermal: 4, radar: 3.6, sounder: 4, solar: 6, battery: 6,
    drain: 6, radio: 4.2, tape: 6, timer: 4.8, cpu: 3.6, cpurad: 4.2, cpudata: 4.8, thruster: 4.5, ion: 6 };

  function story(id) {
    try { return typeof PART_STORY === "object" && PART_STORY && Object.prototype.hasOwnProperty.call(PART_STORY, id) ? PART_STORY[id] : null; } catch (e) { return null; }
  }
  function has(id) {
    var s = story(id);
    return !!(s && typeof s.kind === "string" && DRAW[s.kind]);
  }
  // One short line from `does`: its first sentence, cut at the first comma when the sentence runs past 12 words.
  function firstSentence(text) {
    var m = /^[^.!?]*[.!?]/.exec(String(text)), t = m ? m[0] : String(text), c = t.indexOf(",");
    if (t.split(/\s+/).length > 12 && c > 0 && t.slice(0, c).split(/\s+/).length >= 4) t = t.slice(0, c) + ".";
    return t;
  }
  function line(cls, label, text) {
    var p = document.createElement("span");
    p.className = cls;
    if (label) { var l = document.createElement("span"); l.className = "ex-tag"; l.textContent = label; p.appendChild(l); }
    p.appendChild(document.createTextNode(text));
    return p;
  }
  function element(id, opts) {
    try {
      if (!has(id) || typeof document !== "object") return null;
      var s = story(id), fig = document.createElement("figure"), cap = document.createElement("figcaption"), holder = document.createElement("div");
      holder.innerHTML = '<svg class="ex-svg" aria-hidden="true" focusable="false" viewBox="0 0 240 150" preserveAspectRatio="xMidYMid meet" style="--t:' + (LENGTH[s.kind] || 4) + 's">' + DRAW[s.kind](id) + "</svg>";
      fig.className = "explainer ex-fig ex-kind-" + s.kind + (opts && opts.compact ? " ex-compact" : "");
      fig.setAttribute("data-part", id);
      fig.appendChild(holder.firstChild);
      if (opts && opts.compact) {
        // The Build screen's preview: the picture and one short line, what the part does (the first sentence of `does`).
        cap.appendChild(line("ex-does", "", firstSentence(s.does)));
      } else {
        var hook = document.createElement("strong");
        hook.className = "ex-hook";
        hook.textContent = s.hook;
        cap.appendChild(hook);
        cap.appendChild(line("ex-does", "", s.does));
        cap.appendChild(line("ex-trade", "The catch: ", s.trade));
        // WORLD: the lead time is part of the dossier; StarlineUI.infoKnown (the paid builder) gates it, always shown until then.
        var pt = typeof getPart === "function" ? getPart(id) : null;
        var known = window.StarlineUI && window.StarlineUI.infoKnown ? window.StarlineUI.infoKnown(id, "dossier") : true;
        if (pt && typeof pt.lead_months === "number" && known) cap.appendChild(line("ex-lead", "", "Lead time: ~" + pt.lead_months + " months to arrive"));
      }
      fig.appendChild(cap);
      return fig;
    } catch (e) { return null; }
  }
  return { element: element, has: has, kinds: KINDS.slice() };
}());
