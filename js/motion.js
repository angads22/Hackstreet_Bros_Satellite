// js/motion.js: motion for the whole game, so it feels alive. One global, GravMotion.
// Plain ES5, no dependencies, never throws. It touches only the page (classes, spans, custom properties); the CSS
// that does the moving is the "MOTION" block at the end of css/style.css, all of it inside
// @media (prefers-reduced-motion: no-preference). Here every helper starts with reduced(): with reduced motion the
// page is left exactly as the screens built it (no spans, no classes), so it is static and shows all text at once.
//
// Rules this file keeps:
//  - Text is always whole in the DOM. A line is cut into word spans (the text nodes between them are kept), and the
//    CSS reveals the spans with opacity and transform only. textContent, innerText and screen readers see the same line.
//  - The screens are rebuilt on every click. mounted() remembers the last screen, so the entry animations play only
//    when the screen CHANGES, never on a redraw. A story line animates again only when its own key changes (each beat
//    of the story is its own key).
//  - Numbers are never counted up. A changed number flashes, a changed bar grows from its previous width.
//  - Nothing waits for an animation: no pointer-events or timers are changed, and none lasts much over a second.
var GravMotion = (function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var last = { screen: null, say: null };   // the screen drawn last, and its story key
  var seen = {};                            // per key: the last bar width and text shown (the "Map" of previous values)
  var CAP = 10;                             // at most this many staggered blocks per screen entry
  var STEP_MS = 45;                         // stagger between blocks
  var WORD_MS = 28;                         // stagger between words, shrunk so a whole line is revealed in about 0.7 s
  var WORD_SPAN = 700;
  // Screens that start a new story: their numbers are not compared with the last screen's. Bars belong to one design
  // (forgotten on these); the comeback's cash, debt and months belong to the whole comeback (forgotten only when a
  // new one starts), so the workshop after a flight shows what the flight changed.
  var FORGET_BARS = { title: 1, intro: 1, mission: 1, debrief: 1, "comeback-start": 1, "comeback-end": 1 };
  var FORGET_ALL = { title: 1, "comeback-start": 1 };

  // Blocks that slide up a little, and blocks that only fade (a transform would move the cards inside them, and the
  // tests measure those right after a screen appears).
  var UP_SEL = ".screen-head, .say, .kicker, .cb-stat, .cb-level";
  var FADE_SEL = ".panel, .bench, .map, .scene, .sat-bench, .cb-board, .map-prompt";
  var ENTER_SEL = UP_SEL + ", " + FADE_SEL;

  function reduced() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
  }

  function all(root, sel) {
    try { return Array.prototype.slice.call(root.querySelectorAll(sel)); } catch (e) { return []; }
  }

  function setVar(node, name, value) { try { node.style.setProperty(name, value); } catch (e) {} }

  // ---------------------------------------------------------------- the one hook: a screen was mounted
  // app: the #app element, already holding the new screen. screen: its name. sayKey: what the story is showing on it
  // (the story beats pass "intro:2"); it defaults to the screen name.
  function mounted(app, screen, sayKey) {
    try {
      if (!app) return false;
      var key = sayKey || screen;
      var changed = screen !== last.screen;
      var sayChanged = changed || key !== last.say;
      last.screen = screen;
      last.say = key;
      app.setAttribute("data-screen", screen);
      if (changed) fxClear();   // an effect of the Build screen must not float over the next screen
      if (reduced()) return changed;
      // A node kept across redraws (the part preview) is put back into the new screen with its old entry class, and
      // would play it again: on a redraw every entry class is taken off before the browser can start it.
      if (!changed) all(app, ".gm-up, .gm-fade, .gm-drop, .gm-rise, .gm-flash, .gm-slam").forEach(strip);
      if (changed && FORGET_ALL[screen]) seen = {};
      else if (changed && FORGET_BARS[screen]) Object.keys(seen).forEach(function (k) { if (k.indexOf("bar:") === 0) delete seen[k]; });
      if (changed) enter(app, screen);
      if (sayChanged) says(app, changed ? 120 : 0);
      numbers(app, changed);
      return changed;
    } catch (e) { return false; }
  }

  var ENTRY = /^gm-(up|fade|drop|rise|flash|flip|slam)$/;
  function strip(node) {
    try { ["gm-up", "gm-fade", "gm-drop", "gm-rise", "gm-flash", "gm-slam"].forEach(function (c) { node.classList.remove(c); }); } catch (e) {}
  }
  // Once an entry animation has ended its class goes (the animation would otherwise play again if the node is moved).
  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("animationend", function (e) {
      try { if (e.target && e.target.classList && ENTRY.test(e.animationName)) e.target.classList.remove(e.animationName); } catch (err) {}
    }, true);
  }

  // ---------------------------------------------------------------- screen entry
  // Only the outermost match: a panel inside a panel is not staggered on its own.
  function outermost(app, sel) {
    return all(app, sel).filter(function (n) {
      var up = n.parentNode && n.parentNode.closest ? n.parentNode.closest(sel) : null;
      return !(up && up !== app && app.contains(up));
    });
  }

  function enter(app, screen) {
    if (screen === "title") { title(app); return; }
    var n = 0;
    outermost(app, ENTER_SEL).forEach(function (node) {
      if (n >= CAP) return;
      node.classList.add(node.matches(UP_SEL) ? "gm-up" : "gm-fade");
      setVar(node, "--gm-i", String(n));
      n++;
    });
    all(app, ".cb-stamp").forEach(function (s) { slam(s, screen === "debrief" ? 480 : 200); });
    if (screen === "debrief") debrief(app);
  }

  // The home page: the logotype letters rise in one by one, then the tagline, then the two menu entries drop in.
  function title(app) {
    var logo = app.querySelector(".big-title .logo");
    var paths = logo ? all(logo, "path") : [];
    paths.forEach(function (p, i) {
      // The letter keeps its place on a group, so its own transform is free to move.
      var g = document.createElementNS(NS, "g");
      var t = p.getAttribute("transform");
      if (t) { g.setAttribute("transform", t); p.removeAttribute("transform"); }
      p.parentNode.insertBefore(g, p);
      g.appendChild(p);
      p.setAttribute("class", "gm-letter");
      setVar(p, "--gm-i", String(i));
    });
    var base = paths.length ? paths.length * 40 + 120 : 0;
    var tag = app.querySelector(".tagline");
    if (tag) { tag.classList.add("gm-fade"); setVar(tag, "--gm-base", base + "ms"); }
    all(app, ".mode-card").forEach(function (c, i) {
      c.classList.add("gm-drop");
      setVar(c, "--gm-base", (base + 120) + "ms");
      setVar(c, "--gm-i", String(i));
    });
    var foot = app.querySelector(".title-foot");
    if (foot) { foot.classList.add("gm-fade"); setVar(foot, "--gm-base", (base + 320) + "ms"); }
  }

  // ---------------------------------------------------------------- story lines, word by word
  // Each word becomes an inline span (the spaces stay text nodes between them). The CSS shows the spans one after
  // another: a typewriter with a block cursor in Part 1 (body[data-era="1958"]), a quick slide-up and fade in Part 2.
  function says(app, base) {
    all(app, ".say p, .chron-epilogue, .cb-epilogue").forEach(function (p) {
      if (p.getAttribute("data-gm") || !p.firstChild || p.childNodes.length !== 1 || p.firstChild.nodeType !== 3) return;
      wordify(p, base);
    });
  }
  function wordify(p, base) {
    var parts = p.textContent.split(/(\s+)/);
    var count = parts.filter(function (s) { return s && !/^\s+$/.test(s); }).length;
    if (!count) return;
    var step = Math.max(6, Math.min(WORD_MS, Math.floor(WORD_SPAN / count)));
    var frag = document.createDocumentFragment();
    var i = 0;
    parts.forEach(function (s) {
      if (!s) return;
      if (/^\s+$/.test(s)) { frag.appendChild(document.createTextNode(s)); return; }
      var w = document.createElement("span");
      w.className = "gm-w";
      w.style.animationDelay = (base + i * step) + "ms";
      w.style.setProperty("--gm-d", (base + i * step) + "ms");   // the Part 1 cursor, after the last word, starts with it
      w.appendChild(document.createTextNode(s));
      frag.appendChild(w);
      i++;
    });
    p.textContent = "";
    p.appendChild(frag);
    p.className += (p.className ? " " : "") + "gm-words";
    p.setAttribute("data-gm", "words");
  }

  // ---------------------------------------------------------------- the debrief
  function slam(node, delay) {
    node.classList.add("gm-slam");
    node.style.animationDelay = delay + "ms";
  }

  function debrief(app) {
    // The stars land one by one, each with a small thud. The text stays "★★☆" (the spans are inside it).
    var stamp = app.querySelector(".ledger-head .stamp");
    var starsWon = 0;
    if (stamp && stamp.childNodes.length === 1 && stamp.firstChild.nodeType === 3) {
      var chars = stamp.textContent.split("");
      stamp.textContent = "";
      chars.forEach(function (c, i) {
        var s = document.createElement("span");
        s.className = c === "★" ? "gm-star on" : "gm-star";
        s.style.animationDelay = (150 + i * 150) + "ms";
        s.appendChild(document.createTextNode(c));
        stamp.appendChild(s);
        if (c === "★") starsWon++;
      });
    }
    // Sound (js/audio.js): a note per star as it lands, a thud for the stamp, then a win chord or a low fall.
    if (window.GravAudio && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      // The stars as the debrief draws them: the big stamp's own glyphs (2.1's verdict-first layout, .stamp-star.on) or the
      // ledger head's stamp animated above. A debrief that shows no stamp at all (an ending screen) makes no result sound.
      var soundStars = Math.max(starsWon, app.querySelectorAll(".stamp-star.on").length);
      var hasStamp = !!(stamp || app.querySelector(".stamp, .stamp-star"));
      var paidNow = !!app.querySelector(".cb-result.paid");
      for (var k = 0; k < soundStars; k++) (function (i) { setTimeout(function () { GravAudio.sfx("star", i); }, 150 + i * 150); })(k);
      if (paidNow || soundStars > 0) setTimeout(function () { GravAudio.sfx("stamp"); }, 480);
      if (soundStars === 3 || paidNow) setTimeout(function () { GravAudio.sfx("win"); }, 620);
      else if (hasStamp && soundStars === 0) setTimeout(function () { GravAudio.sfx("fail"); }, 400);
    }
    // The ledger rows (the score, or the money and the debt) come in order, after the stars.
    all(app, ".paper .row, .paper .total, .cb-row").forEach(function (r, i) {
      r.classList.add("gm-rise");
      setVar(r, "--gm-base", "260ms");
      setVar(r, "--gm-i", String(Math.min(i, 12)));
    });
    // 3 stars, or the contract paid in full: a short flourish of flat squares.
    var paid = app.querySelector(".cb-result.paid");
    if (starsWon === 3 && stamp) burst(stamp, 520);
    else if (paid) { var st = paid.querySelector(".cb-stamp"); if (st) burst(st, 420); }
  }

  var BITS = [[-46, -30, 40], [-30, 34, -70], [-8, -50, 120], [20, 40, -30], [44, -26, 80], [52, 12, -110], [-52, 6, 60], [10, -40, -90]];
  var BIT_COLORS = ["var(--accent)", "var(--info)", "var(--paper)", "var(--pal-light)"];
  function burst(anchor, delay) {
    anchor.classList.add("gm-anchor");
    var box = document.createElement("span");
    box.className = "gm-burst";
    box.setAttribute("aria-hidden", "true");
    BITS.forEach(function (b, i) {
      var bit = document.createElement("i");
      bit.style.setProperty("--dx", b[0] + "px");
      bit.style.setProperty("--dy", b[1] + "px");
      bit.style.setProperty("--r", b[2] + "deg");
      bit.style.setProperty("--c", BIT_COLORS[i % BIT_COLORS.length]);
      bit.style.animationDelay = (delay + (i % 3) * 40) + "ms";
      box.appendChild(bit);
    });
    anchor.appendChild(box);
  }

  // ---------------------------------------------------------------- numbers that change
  // The previous value of each bar and number is remembered per key. When a rebuilt screen shows a different one it
  // flashes once, and a bar grows from where it was. Never counted through values. A first sight changes nothing.
  function numbers(app, changed) {
    var screen = last.screen;
    if (screen !== "mission") {
      all(app, ".bar").forEach(function (bar) {
        var name = bar.querySelector(".bar-name");
        var fills = all(bar, ".bar-fill");
        var right = bar.querySelector(".bar-top > span:last-child");
        if (!name || fills.length !== 1 || !right) return;
        var key = "bar:" + name.textContent.replace(/\s+/g, " ").trim();
        var width = parseFloat(fills[0].style.width);
        var text = right.textContent;
        var was = seen[key];
        seen[key] = { w: width, t: text };
        if (!was) return;
        if (was.t !== text) { flash(right); if (screen === "build" && !reduced()) right.classList.add("fx-pop"); }   // on Build the number pops harder
        if (isFinite(width) && isFinite(was.w) && Math.abs(was.w - width) > 0.05) grow(fills[0], was.w, width);
      });
    }
    all(app, ".cb-stat-value").forEach(function (v) {
      var key = "stat:" + (v.id || v.parentNode.getAttribute("data-key") || "");
      var was = seen[key];
      seen[key] = { t: v.textContent };
      if (was && was.t !== v.textContent) flash(v);
    });
    // The header's line (spent of budget, cash and debt) pulses when it changes on the same screen.
    var status = document.getElementById("status");
    if (status) {
      var s = seen.status;
      seen.status = { t: status.textContent };
      if (s && !changed && screen !== "mission" && s.t !== status.textContent) flash(status);
    }
  }

  function flash(node) {
    if (!node || reduced()) return;
    node.classList.remove("gm-flash");
    void node.offsetWidth;
    node.classList.add("gm-flash");
  }

  // Starts a bar at its old width and moves it to the new one on the next frame.
  function grow(fill, from, to) {
    fill.classList.add("gm-grow");
    fill.style.width = from + "%";
    var go = function () { fill.style.width = to + "%"; };
    if (window.requestAnimationFrame) window.requestAnimationFrame(function () { window.requestAnimationFrame(go); });
    else go();
    if (to > from && last.screen === "build") lit(fill, from, to);
  }

  // ---------------------------------------------------------------- adding a part on Build
  // A click on a part card: a flat tile lifts off the card and flies to the satellite (the other way on a removal), a
  // ring and a few squares mark where it docks and the picture thumps once, and a chip floats off every bar the part
  // changed. ui-design.js passes what the page knows (rec: kind, the card's rect, the icon, the chips' text from the
  // back end's own numbers, the satellite point); this file only moves things. All of it lives in one layer on the
  // body, because the screen under it is rebuilt on every click; a new click wipes the last effect (one tile in flight
  // at a time) and a timer clears whatever is left. Nothing takes pointer events, nothing waits for it. Does nothing
  // under reduced motion (the numbers still change, as the screen draws them).
  var FX_LIFE = 1500;   // everything is cleared by now (the longest piece, a chip with its delay, ends near 1.3 s)
  var DOCK_AT = 420;    // ms: the ring and squares start as the flight (450 ms in the CSS, 300 ms back) ends
  var fxLayer = null, fxTimer = 0;

  // The flying pieces only (a new click wipes the last effect). The bars' own marks (the lit stretch, the pop) were put
  // on the freshly drawn screen a moment ago and are left to finish.
  function fxWipe() {
    try {
      if (fxTimer) { clearTimeout(fxTimer); fxTimer = 0; }
      if (fxLayer) while (fxLayer.firstChild) fxLayer.removeChild(fxLayer.firstChild);
    } catch (e) {}
  }
  // Everything, once the effect is over or the screen changes: nothing is left on the page.
  function fxClear() {
    fxWipe();
    try {
      all(document, ".fx-lit").forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      all(document, ".fx-dock, .fx-star, .fx-pop").forEach(function (n) { n.classList.remove("fx-dock", "fx-star", "fx-pop"); });
    } catch (e) {}
  }
  function fxBox() {
    if (!fxLayer || fxLayer.parentNode !== document.body) {
      fxLayer = document.createElement("div");
      fxLayer.id = "gm-fx";
      fxLayer.setAttribute("aria-hidden", "true");
      document.body.appendChild(fxLayer);
    }
    return fxLayer;
  }
  function fxNode(cls, x, y, parent) {
    var n = document.createElement("span");
    n.className = cls;
    if (x !== undefined) { n.style.left = Math.round(x) + "px"; n.style.top = Math.round(y) + "px"; }
    (parent || fxLayer).appendChild(n);
    return n;
  }
  function clampTo(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // The lighter segment on a bar between its old and new width, then it fades (the bar grows under it).
  function lit(fill, from, to) {
    var track = fill.parentNode;
    if (!track) return;
    var seg = document.createElement("span");
    seg.className = "fx-lit";
    seg.setAttribute("aria-hidden", "true");
    seg.style.left = from + "%";
    seg.style.width = (to - from) + "%";
    track.appendChild(seg);
  }

  // Bring a bar into view inside its own scrolling column (the pinned side column on a wide Build screen), never by
  // scrolling the page. The bottom 80px of the column sit under the pinned next button.
  function showInColumn(node) {
    try {
      var sc = node.parentNode;
      while (sc && sc.nodeType === 1) {
        var oy = getComputedStyle(sc).overflowY;
        if ((oy === "auto" || oy === "scroll") && sc.scrollHeight > sc.clientHeight + 4) break;
        sc = sc.parentNode;
      }
      if (!sc || sc.nodeType !== 1 || sc === document.body || sc === document.documentElement) return;
      var b = node.getBoundingClientRect(), c = sc.getBoundingClientRect();
      if (b.bottom > c.bottom - 80) sc.scrollTop += b.bottom - (c.bottom - 80);
      else if (b.top < c.top + 4) sc.scrollTop -= c.top + 4 - b.top;
    } catch (e) { /* stays where it is */ }
  }

  function barOf(app, name) {
    return all(app, ".bar").filter(function (b) {
      var n = b.querySelector(".bar-name");
      return n && n.textContent.replace(/\s+/g, " ").trim() === name;
    })[0] || null;
  }

  // rec: { kind: "add" | "remove", card: rect | null, sat: {x, y} | null, icon: node | null,
  //        items: [{ bar, text, good }], star: bool (a body was fitted: the CARRIES bar is the star of the click) }
  function buildFx(rec) {
    try {
      if (reduced() || !rec || !document.body) return false;
      var app = document.getElementById("app") || document.body;
      fxWipe();
      fxBox();
      var vw = window.innerWidth || 800, vh = window.innerHeight || 600;
      var back = rec.kind === "remove";
      var pic = app.querySelector(".bench .sat-bench");

      // the tile: from the card to the satellite (the other way on a removal)
      var card = rec.card, sat = rec.sat;
      if (!sat) {   // no point known: the middle of the picture on the bench
        var pr = pic ? pic.getBoundingClientRect() : null;
        if (pr && pr.width) sat = { x: pr.left + pr.width / 2, y: pr.top + pr.height / 2 };
      }
      if (card && sat && card.width) {
        var c = { x: card.left + card.width / 2, y: card.top + card.height / 2 };
        var a = back ? sat : c, b = back ? c : sat;
        // a point off the screen is clamped to its edge: the tile still flies toward it
        var bx = clampTo(b.x, 24, vw - 24), by = clampTo(b.y, 24, vh - 24);
        var ax = clampTo(a.x, 24, vw - 24), ay = clampTo(a.y, 24, vh - 24);
        var fly = fxNode("fx-fly" + (back ? " back" : ""), ax, ay);
        fly.style.setProperty("--dx", Math.round(bx - ax) + "px");
        fly.style.setProperty("--dy", Math.round(by - ay) + "px");
        var rise = fxNode("fx-rise", undefined, undefined, fly);
        var tile = fxNode("fx-tile", undefined, undefined, rise);
        if (rec.icon) tile.appendChild(rec.icon);
        // where it docks: a ring and a few flat squares, and the picture thumps once
        if (!back && sat.x > 0 && sat.x < vw && sat.y > 0 && sat.y < vh) {
          var spot = fxNode("fx-spot", sat.x, sat.y);
          fxNode("fx-ring", undefined, undefined, spot);
          var anchor = fxNode("fx-bits", undefined, undefined, spot);
          burst(anchor, DOCK_AT);
          anchor.classList.remove("gm-anchor");
        }
      }
      if (!back && pic) pic.classList.add("fx-dock");

      // the chips: out of the number of every bar that changed, one after another
      var n = 0, rows = {}, hb = app.ownerDocument.querySelector(".topbar");
      var head = hb && getComputedStyle(hb).position === "sticky" ? hb.getBoundingClientRect().bottom : 0;
      (rec.items || []).forEach(function (it) {
        var bar = barOf(app, it.bar);
        var num = bar && bar.querySelector(".bar-top > span:last-child");
        if (!num || !it.text) return;
        if (it.star) showInColumn(bar);   // fitting a body: its CARRIES bar may be below the fold of the pinned side column
        var r = num.getBoundingClientRect();
        if (r.bottom < head || r.top > vh) return;   // out of sight (or under the sticky header): nothing to point at
        // the chip floats up out of the number; with no room above it (the header) it floats down instead
        var below = r.top - 26 < head, row = rows[it.bar] || 0;
        rows[it.bar] = row + 1;   // a second chip on the same bar (power drawn and made) sits one row further out
        var wrap = fxNode("fx-chip-at", Math.min(r.right, vw - 6), (below ? r.bottom - 2 + row * 22 : r.top + 2 - row * 22));
        var chip = fxNode("fx-chip " + (it.good ? "good" : "warn") + (it.star ? " star" : "") + (below ? " below" : ""), undefined, undefined, wrap);
        chip.textContent = it.text;
        wrap.setAttribute("data-bar", it.bar);
        chip.style.setProperty("--i", String(n++));
      });

      // the CARRIES bar is the star when a body is fitted: its track swells and its number lands with an overshoot
      if (rec.star) {
        var pay = barOf(app, "CARRIES");
        if (pay) {
          pay.classList.add("fx-star");
          var pn = pay.querySelector(".bar-top > span:last-child");
          if (pn) pn.classList.add("fx-pop");
          var pf = pay.querySelector(".bar-fill");
          if (pf && parseFloat(pf.style.width) > 0) lit(pf, 0, parseFloat(pf.style.width));
        }
      }
      fxTimer = setTimeout(fxClear, FX_LIFE);
      return true;
    } catch (e) { return false; }
  }

  // The month ticker on the mission screen flips when the month changes (not while fast-forwarding).
  function flip(node) {
    if (!node || reduced()) return;
    node.classList.remove("gm-flip");
    void node.offsetWidth;
    node.classList.add("gm-flip");
  }

  return { mounted: mounted, reduced: reduced, flash: flash, flip: flip, grow: grow, buildFx: buildFx };
})();
