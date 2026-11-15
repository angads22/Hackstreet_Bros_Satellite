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
        if (was.t !== text) flash(right);
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
  }

  // The month ticker on the mission screen flips when the month changes (not while fast-forwarding).
  function flip(node) {
    if (!node || reduced()) return;
    node.classList.remove("gm-flip");
    void node.offsetWidth;
    node.classList.add("gm-flip");
  }

  return { mounted: mounted, reduced: reduced, flash: flash, flip: flip, grow: grow };
})();
