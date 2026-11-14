// js/ui-design.js — owned by Design screens.
// The shared layout (header, minimap, objective line, hints), the base map that
// players walk around to reach each screen, and the screens before launch:
// Tier select, 1 Briefing, 2 Orbit, 3 Build, 4 Launch vehicle, 5 Readiness review.
// Every number shown comes from a game.js / mission.js call or a plain data field;
// this file only formats numbers and draws the page.
//
// Everything lives inside one function so no name here can clash with the
// back end's globals. Two names are shared on purpose:
//   showDesignScreen(name, design)  — used by ui-mission.js for Redesign / New mission
//   StarlineUI                      — small drawing helpers ui-mission.js reuses
(function () {
  "use strict";

  // ---------------------------------------------------------------- setup
  var DESIGN_STEPS = ["briefing", "orbit", "build", "launcher", "review"];

  // The Build screen's bins, in display order, come from the back end: getCategories().
  // This list is only the fallback if that function is missing.
  var FALLBACK_CATEGORIES = [
    { id: "instrument", name: "INSTRUMENTS", sub: "What the mission sees", required: true },
    { id: "power",      name: "POWER",       sub: "Panels and batteries",  required: true },
    { id: "comms",      name: "RADIO",       sub: "Send data home",        required: true },
    { id: "computer",   name: "COMPUTER",    sub: "Runs the spacecraft",   required: true },
    { id: "propulsion", name: "PROPULSION",  sub: "Speed change, optional", required: false }
  ];
  function categories() {
    var c = typeof getCategories === "function" ? list(getCategories()) : [];
    return c.length ? c : FALLBACK_CATEGORIES;
  }

  // Shown under the header when the tier's hints are on (or on request).
  var HINTS = {
    title:    "Earn 2 stars on a tier to unlock the next one.",
    map:      "Walk with the arrow keys or WASD, press E to go in. Or click a marker and you walk there yourself. The gold route leads to your next job.",
    briefing: "Decide the goal before the hardware. The objective says which instruments count.",
    orbit:    "Where you fly changes everything else: detail, ground contact, lifetime and launch cost.",
    build:    "Every part costs something in all four bars. Hover a part to see what it would change before you click.",
    launcher: "A bigger rocket solves mass and eats the budget.",
    review:   "Blockers stop the launch. Warnings do not, but thin margins make events hit harder.",
    mission:  "Designs get tested by things you did not plan. Pick one answer per event.",
    debrief:  "Change the one thing that limited you, then fly the same design again."
  };

  // This file's screen names -> the screen names getHints uses.
  var HINT_KEYS = { hub: "hub", briefing: "briefing", orbit: "orbit", build: "build", launcher: "launch",
                    review: "readiness", mission: "mission", debrief: "debrief" };

  // Where each readiness check is fixed (SPEC: "Where each check is fixed").
  var FIX_SCREEN = {
    "no-objective": "briefing",
    "no-orbit": "orbit", "orbit-fit": "orbit",
    "no-launcher": "launcher", "launcher-reach": "launcher", "mass": "launcher",
    "mass-margin": "launcher", "budget": "launcher"
  };

  // ---------------------------------------------------------------- the base map
  // Each design screen is a place on the map. The map is 200 x 120 units; roads
  // join the nodes below, and the player walks from node to node.
  var PLACES = [
    { id: "briefing", num: 1, name: "MISSION CONTROL",  does: "Pick a job for the satellite" },
    { id: "orbit",    num: 2, name: "TRACKING STATION", does: "Choose where it flies" },
    { id: "build",    num: 3, name: "WORKSHOP",         does: "Build the spacecraft" },
    { id: "launcher", num: 4, name: "ROCKET YARD",      does: "Pick a rocket" },
    { id: "review",   num: 5, name: "LAUNCH PAD",       does: "Readiness review and launch" }
  ];
  var MAP_W = 200, MAP_H = 120;
  var NODES = {
    gate: { x: 10, y: 63 },  j1: { x: 40, y: 63 },  j2: { x: 100, y: 63 }, j3: { x: 160, y: 63 },
    briefing: { x: 40, y: 40 }, orbit: { x: 100, y: 40 }, review: { x: 160, y: 40 },
    build: { x: 40, y: 86 },    launcher: { x: 100, y: 86 }, ground: { x: 160, y: 86 }
  };
  var EDGES = [["gate", "j1"], ["j1", "j2"], ["j2", "j3"], ["j1", "briefing"], ["j1", "build"],
               ["j2", "orbit"], ["j2", "launcher"], ["j3", "review"], ["j3", "ground"]];
  var GO_TEXT = {
    briefing: "Go to Mission Control and pick a job.",
    orbit:    "Go to the Tracking Station and choose an orbit.",
    build:    "Go to the Workshop and build the satellite.",
    launcher: "Go to the Rocket Yard and pick a rocket.",
    review:   "Go to the Launch Pad for the readiness review."
  };
  var DO_TEXT = {
    briefing: "Pick a job for the satellite.",
    orbit:    "Choose an orbit that can see the target.",
    build:    "Fit an instrument, power, a radio and a computer.",
    launcher: "Pick a rocket that can lift your satellite.",
    review:   "Clear every NO GO line, then launch."
  };
  var WALK_MS = 9;   // milliseconds per map unit walked (0 if the player asks for less motion)
  var KEY_DIRS = { ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
                   ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0] };

  var state = {
    design: null,        // the one design object
    screen: "title",
    player: "gate",      // map node the player stands on
    walking: false,      // true while the player arrow is moving
    stepping: false,     // ...and that walk is one arrow-key step
    queued: null,        // one arrow key pressed during a step, played when it ends
    swappedAt: 0,        // when the screen last changed (to drop the 2nd click of a double-click)
    lastClickAt: 0,      // when the last click that was let through started
    walkTimer: null,
    mapNote: "",         // one-off message on the map ("Locked: ...")
    map: null,           // live map elements, while the map is showing
    reached: 0,          // furthest design step visited, as an index into DESIGN_STEPS
    bin: null,           // which parts bin is open on Build (null = the first one)
    hover: null,         // part id being previewed on Build
    hintOpen: false,
    avail: null,         // getAvailability(design) for the screen being drawn
    touch: false,        // last press on a part card was a finger
    armed: false,        // that part was already previewed when the finger went down
    locked: false        // true from launch until the debrief buttons
  };

  // STORY-BEGIN  (everything between these two markers is the director's lines; Story rewrites the text freely)
  // storyLine(key, design, extra) -> one short line for the director to say, or "".
  // Keys: intro (returns STORY.intro, a list of short beats), map, briefing, orbit, build,
  // launcher, review, mission-start, mission-end, debrief (extra = the getDebrief result).
  var STORY = { intro: [] };
  function storyLine(key, design, extra) { return key === "intro" ? STORY.intro : ""; }
  // STORY-END

  // ---------------------------------------------------------------- small helpers
  function list(x) { return Array.isArray(x) ? x : []; }
  function byId(items, id) {
    var found = null;
    list(items).forEach(function (item) { if (item && item.id === id) found = item; });
    return found;
  }
  function data(name) {
    // Reads a data global without throwing if its file is missing.
    // (The data files use `const`, which is not on `window`, hence the typeof checks.)
    switch (name) {
      case "PARTS":      return typeof PARTS !== "undefined" ? list(PARTS) : [];
      case "ORBITS":     return typeof ORBITS !== "undefined" ? list(ORBITS) : [];
      case "LAUNCHERS":  return typeof LAUNCHERS !== "undefined" ? list(LAUNCHERS) : [];
      case "OBJECTIVES": return typeof OBJECTIVES !== "undefined" ? list(OBJECTIVES) : [];
      case "TIERS":      return typeof TIERS !== "undefined" ? list(TIERS) : [];
      case "EVENTS":     return typeof EVENTS !== "undefined" ? list(EVENTS) : [];
      default:           return [];
    }
  }
  function isNum(v) { return typeof v === "number" && isFinite(v); }

  function num(v, places) {
    if (!isNum(v)) return "–";
    return v.toLocaleString("en-US", { maximumFractionDigits: places === undefined ? 1 : places });
  }
  function money(v) { return isNum(v) ? "$" + num(v, v < 1 ? 2 : 1) + "M" : "–"; }
  function signed(v, places) { return (v > 0 ? "+" : "") + num(v, places); }
  function starsText(n) {
    n = isNum(n) ? n : 0;
    var s = "";
    for (var i = 0; i < 3; i++) s += i < n ? "★" : "☆";
    return s;
  }

  // Builds an element. `kids` may be strings (as text) or nodes.
  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.indexOf("on") === 0) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    });
    (Array.isArray(kids) ? kids : [kids]).forEach(function (kid) {
      if (kid === null || kid === undefined || kid === false) return;
      node.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  // Draws pixel art from [x, y, w, h, colour] rows. Static art only, never data text.
  function art(viewBox, rects, label, className) {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", viewBox);
    svg.setAttribute("shape-rendering", "crispEdges");
    if (className) svg.setAttribute("class", className);
    if (label) { svg.setAttribute("role", "img"); svg.setAttribute("aria-label", label); }
    else svg.setAttribute("aria-hidden", "true");
    rects.forEach(function (r) {
      var rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", r[0]); rect.setAttribute("y", r[1]);
      rect.setAttribute("width", r[2]); rect.setAttribute("height", r[3]);
      if (String(r[4]).indexOf("--") === 0) rect.style.fill = "var(" + r[4] + ")";
      else rect.setAttribute("fill", r[4]);
      if (r[5] !== undefined) rect.setAttribute("opacity", r[5]);
      svg.appendChild(rect);
    });
    return svg;
  }

  function facts(rows) {
    return el("dl", { class: "facts" }, rows.filter(Boolean).map(function (r) {
      return el("div", null, [el("dt", { text: r[0] }), el("dd", { text: r[1] })]);
    }));
  }

  function button(label, onClick, opts) {
    opts = opts || {};
    return el("button", { type: "button", class: "btn" + (opts.primary ? " primary" : "") + (opts.big ? " big" : ""),
      disabled: !!opts.disabled, onclick: onClick, "aria-label": opts.aria }, label);
  }

  // ---------------------------------------------------------------- pixel art
  // Pixel-art colours are CSS custom properties (see :root in css/style.css), so the
  // colour scheme lives in one place. art() turns a "--name" into var(--name).
  var PAL = { ink: "--pal-white", muted: "--pal-metal", line: "--pal-frame", gold: "--pal-light", cyan: "--pal-glass",
              red: "--pal-red", blue: "--pal-cell", navy: "--pal-cell-dark", sky: "--pal-dark", skin: "--pal-skin",
              hair: "--pal-hair", mouth: "--pal-mouth", portrait: "--pal-portrait", night: "--pal-night" };

  // SAT-BEGIN  (everything between these two markers draws the satellite)
  // satelliteArt(design, change) -> an element showing the satellite built so far.
  // `change` is optional: { id: partId, kind: "add" | "remove" }, the click that just happened.
  // The satellite on the bench grows as each category gets a part.
  function satelliteArt(design, change) {
    var has = {};
    list(design.parts).forEach(function (id) {
      var p = byId(data("PARTS"), id);
      if (p) has[p.category] = true;
    });
    var r = [];
    // Body: an outline until a computer is in, then solid.
    if (has.computer) {
      r.push([9, 3, 6, 6, PAL.ink], [9, 8, 6, 1, PAL.muted], [14, 3, 1, 6, PAL.muted]);
    } else {
      r.push([9, 3, 6, 1, PAL.line], [9, 8, 6, 1, PAL.line], [9, 3, 1, 6, PAL.line], [14, 3, 1, 6, PAL.line]);
    }
    if (has.power) {
      r.push([1, 4, 7, 4, PAL.blue], [16, 4, 7, 4, PAL.blue], [1, 4, 7, 1, PAL.cyan], [16, 4, 7, 1, PAL.cyan],
             [3, 4, 1, 4, PAL.navy], [5, 4, 1, 4, PAL.navy], [18, 4, 1, 4, PAL.navy], [20, 4, 1, 4, PAL.navy],
             [8, 5, 1, 2, PAL.muted], [15, 5, 1, 2, PAL.muted]);
    }
    if (has.comms) r.push([11, 1, 1, 2, PAL.muted], [10, 0, 3, 1, PAL.gold]);
    if (has.instrument) {
      r.push([11, 5, 2, 2, PAL.sky], [10, 4, 4, 1, PAL.red], [10, 7, 4, 1, PAL.red], [10, 5, 1, 2, PAL.red], [13, 5, 1, 2, PAL.red]);
    }
    if (has.propulsion) r.push([10, 9, 1, 2, PAL.muted], [13, 9, 1, 2, PAL.muted], [10, 11, 4, 1, PAL.line]);
    var label = "Pixel drawing of your satellite: " +
      categories().map(function (c) { return (has[c.id] ? "" : "no ") + c.name.toLowerCase(); }).join(", ");
    return art("0 0 24 13", r, label, "sat");
  }
  // SAT-END

  // Mission control, who briefs the player.
  function directorArt() {
    return art("0 0 16 16", [
      [0, 0, 16, 16, PAL.portrait],
      [5, 2, 6, 3, PAL.hair], [4, 3, 1, 4, PAL.hair], [11, 3, 1, 4, PAL.hair],
      [5, 5, 6, 6, PAL.skin], [6, 7, 1, 1, PAL.sky], [9, 7, 1, 1, PAL.sky], [7, 9, 2, 1, PAL.mouth],
      [3, 5, 1, 3, PAL.line], [3, 4, 2, 1, PAL.line], [12, 5, 1, 3, PAL.line], [11, 4, 2, 1, PAL.line],
      [12, 8, 1, 2, PAL.line], [10, 10, 3, 1, PAL.cyan],
      [3, 12, 10, 4, PAL.navy], [6, 12, 4, 4, PAL.ink], [7, 12, 2, 2, PAL.cyan]
    ], "Portrait of the mission director wearing a headset", "portrait");
  }

  // Rocket on the pad at night.
  function padArt(ready) {
    var r = [
      [0, 0, 187, 152, PAL.night],
      [14, 12, 1, 1, PAL.ink], [52, 30, 1, 1, PAL.muted], [70, 10, 2, 2, PAL.ink], [110, 22, 1, 1, PAL.ink],
      [146, 40, 1, 1, PAL.muted], [170, 14, 2, 2, PAL.gold], [160, 74, 1, 1, PAL.ink], [30, 66, 1, 1, PAL.ink],
      [22, 20, 14, 14, PAL.ink], [26, 24, 3, 3, PAL.muted], [31, 29, 2, 2, PAL.muted],
      [0, 136, 187, 16, PAL.line], [0, 136, 187, 1, PAL.line], [60, 132, 76, 4, PAL.line],
      [124, 60, 4, 72, PAL.line], [114, 78, 10, 2, PAL.line], [114, 104, 10, 2, PAL.line],
      [125, 56, 2, 2, ready ? PAL.cyan : PAL.red]
    ];
    var rocket = [
      [5, 0, 2, 2, PAL.red], [4, 2, 4, 2, PAL.ink], [3, 4, 6, 16, PAL.ink], [8, 4, 1, 16, PAL.muted],
      [5, 7, 2, 2, PAL.cyan], [3, 12, 6, 1, PAL.red], [1, 17, 2, 5, PAL.red], [9, 17, 2, 5, PAL.red], [4, 20, 4, 2, PAL.line]
    ];
    rocket.forEach(function (q) { r.push([78 + q[0] * 3, 66 + q[1] * 3, q[2] * 3, q[3] * 3, q[4]]); });
    r.push([66, 126, 8, 6, PAL.muted, 0.5], [118, 124, 10, 8, PAL.muted, 0.5]);
    return art("0 0 187 152", r, ready ? "A rocket on the pad, tower light green" : "A rocket on the pad, tower light red", "scene");
  }

  // Small 8x8 icons for the parts bins.
  var BIN_ICONS = {
    instrument: [[0, 2, 8, 5, PAL.ink], [2, 1, 2, 1, PAL.ink], [3, 3, 3, 3, PAL.sky], [4, 4, 1, 1, PAL.cyan]],
    power:      [[0, 1, 8, 6, PAL.blue], [2, 1, 1, 6, PAL.sky], [5, 1, 1, 6, PAL.sky], [0, 4, 8, 1, PAL.sky]],
    comms:      [[3, 4, 2, 4, PAL.muted], [3, 2, 2, 2, PAL.gold], [0, 1, 1, 3, PAL.cyan], [7, 1, 1, 3, PAL.cyan], [1, 0, 1, 1, PAL.cyan], [6, 0, 1, 1, PAL.cyan]],
    computer:   [[1, 1, 6, 6, PAL.sky], [2, 2, 4, 4, PAL.ink], [3, 3, 2, 2, PAL.sky], [0, 2, 1, 1, PAL.muted], [7, 5, 1, 1, PAL.muted]],
    propulsion: [[3, 0, 2, 5, PAL.ink], [2, 4, 1, 2, PAL.red], [5, 4, 1, 2, PAL.red], [3, 6, 2, 2, PAL.gold]],
    structure:  [[1, 1, 6, 6, PAL.muted], [2, 2, 4, 4, PAL.sky], [1, 1, 6, 1, PAL.ink], [1, 6, 6, 1, PAL.line]],
    attitude:   [[3, 3, 2, 2, PAL.ink], [1, 1, 2, 1, PAL.cyan], [1, 1, 1, 2, PAL.cyan], [5, 6, 2, 1, PAL.cyan], [6, 5, 1, 2, PAL.cyan],
                 [5, 1, 1, 1, PAL.gold], [2, 6, 1, 1, PAL.gold]],
    fallback:   [[2, 2, 4, 4, PAL.muted]]
  };

  // ---------------------------------------------------------------- shell: header, objective line, minimap, hints
  function tier() { return state.design ? byId(data("TIERS"), state.design.tier) : null; }

  function setStatus(text) {
    var node = document.getElementById("status");
    if (node) node.textContent = text;
  }

  function designStatus() {
    var t = tier();
    if (!t) return "Space Mission Design Game";
    var totals = getTotals(state.design);
    if (inCampaign()) {
      var info = hubInfo();
      return "CAMPAIGN" + (info ? " · " + info.year : "") + " · SPENT " + money(totals.cost_musd) + " OF " + money(totals.budget_musd);
    }
    return t.name.toUpperCase() + (state.design.year ? " · " + state.design.year : "") + " · SPENT " + money(totals.cost_musd) + " OF " + money(totals.budget_musd);
  }

  // The header shows the current objective and a minimap (instead of a step bar).
  function setStep(screen) {
    var line = document.getElementById("objective");
    var mini = document.getElementById("minimap");
    var text = "";
    if (screen === "mission") text = "Keep the satellite alive.";
    else if (screen === "debrief") text = "Read what limited you, then fly again.";
    else if (state.design && screen !== "title" && screen !== "hub") {
      var next = waypoint();
      text = next === screen ? doText(screen) : GO_TEXT[next];
    }
    if (line) {
      line.textContent = text ? "OBJECTIVE: " + text : "";
      line.hidden = !text;
    }
    if (mini) {
      while (mini.firstChild) mini.removeChild(mini.firstChild);
      var show = !!state.design && DESIGN_STEPS.indexOf(screen) !== -1 && !state.locked;
      mini.hidden = !show;
      if (show) {
        mini.appendChild(mapSvg(true, screen));
        mini.appendChild(el("span", { class: "minimap-key", text: "MAP [M]" }));
      }
    }
  }

  function setHint(screen) {
    var box = document.getElementById("hint");
    var btn = document.getElementById("help-btn");
    if (!box || !btn) return;
    var mode = tier() ? tier().hints : "on";
    var text = HINTS[screen] || "";
    // Story's hints come from getHints (data/hints.js): the tutorial line, then the first tip.
    var key = HINT_KEYS[screen];
    if (key && typeof getHints === "function" && (state.design || key === "hub")) {
      var h = getHints(key, state.design);
      mode = h.mode || mode;
      var lines = [h.tutorial].concat(list(h.tips).slice(0, 1)).filter(Boolean);
      if (lines.length) text = lines.join(" ");
    }
    btn.hidden = !(mode === "request" && text);
    btn.setAttribute("aria-expanded", state.hintOpen ? "true" : "false");
    box.hidden = !text || mode === "off" || (mode === "request" && !state.hintOpen);
    box.textContent = text;
  }

  function mount(screen, node) {
    state.screen = screen;
    var app = document.getElementById("app");
    while (app.firstChild) app.removeChild(app.firstChild);
    app.appendChild(node);
    setStep(screen);
    setHint(screen);
  }

  // Redraws the current screen and keeps keyboard focus on the same control.
  function redraw() {
    var active = document.activeElement;
    var key = active && active.getAttribute ? active.getAttribute("data-key") : null;
    draw(state.screen);
    if (key) {
      var again = document.querySelector('[data-key="' + key + '"]');
      if (again) again.focus();
    }
  }

  function go(screen) {
    var i = DESIGN_STEPS.indexOf(screen);
    if (i > state.reached) state.reached = i;
    if (i !== -1) state.player = screen;   // you are standing in that building
    stopWalking();
    state.swappedAt = Date.now();
    state.hover = null;
    state.hintOpen = false;
    draw(screen);
    var app = document.getElementById("app");
    if (app) app.focus();
    window.scrollTo(0, 0);
    // On short landscape screens, bring the map itself into view.
    var board = document.getElementById("map");
    if (screen === "map" && board && window.innerHeight <= 500) board.scrollIntoView({ block: "start" });
  }

  function draw(screen) {
    if (screen === "title" || !state.design) return mount("title", drawTitle());
    state.screen = screen;   // set first: the check list reads it while drawing
    setStatus(designStatus());
    if (screen === "map") { mount(screen, drawMap()); return updateMap(true); }
    if (screen === "briefing") return mount(screen, drawBriefing());
    if (screen === "orbit") return mount(screen, drawOrbit());
    if (screen === "build") return mount(screen, drawBuild());
    if (screen === "launcher") return mount(screen, drawLauncher());
    if (screen === "review") return mount(screen, drawReview());
    return mount("title", drawTitle());
  }

  function head(title, text) {
    return el("div", { class: "screen-head" }, [el("h1", { text: title }), text ? el("p", { text: text }) : null]);
  }

  // Every place has a way out to the map. CONTINUE walks you to the next place.
  function navRow(nextTo, nextOk) {
    // The button follows the gold route, forwards or back (after a redesign, a FIX link or a new NO GO).
    var gps = waypoint();
    if (nextTo && gps !== state.screen) nextTo = gps;
    var next = byId(PLACES, nextTo);
    return el("div", { class: "nav-row" }, [
      button(["< ", "MAP [M]"], openMap, { aria: "Map: back to the base map" }),
      next ? button(["GO TO " + next.name, " >"], function () { travel(nextTo); },
        { primary: true, disabled: !nextOk, aria: "Go to " + next.name.toLowerCase() }) : null
    ]);
  }

  // ---------------------------------------------------------------- the four resource bars
  function barClass(m) { return !isNum(m) ? "" : m < 0 ? " bad" : m < 0.1 ? " warn" : ""; }

  function bar(name, right, fill, cls, note) {
    var pct = isNum(fill) ? Math.max(0, Math.min(1, fill)) * 100 : 0;
    return el("div", { class: "bar" + (cls || "") }, [
      el("div", { class: "bar-top" }, [el("span", { text: name }), el("span", { text: right })]),
      el("div", { class: "bar-track", role: "presentation" }, [el("div", { class: "bar-fill", style: "width: " + pct + "%" })]),
      note ? el("div", { class: "bar-note", text: note }) : null
    ]);
  }

  function resourceBars(design) {
    var t = getTotals(design);
    var m = t.margins || {};
    var massRight = t.capacity_kg ? num(t.mass_kg) + " / " + num(t.capacity_kg, 0) + " KG" : num(t.mass_kg) + " KG";
    var dataLost = t.data_gb_day > t.data_returned_gb_day;
    return el("div", { class: "bars" }, [
      bar("MASS", massRight, isNum(m.mass) ? 1 - m.mass : null, barClass(m.mass),
          t.capacity_kg ? null : "Pick a rocket to see the limit"),
      bar("POWER", num(t.power_draw_w, 0) + " / " + num(t.power_gen_w, 0) + " W",
          isNum(m.power) ? 1 - m.power : (t.power_draw_w > 0 ? 1 : 0), isNum(m.power) ? barClass(m.power) : (t.power_draw_w > 0 ? " bad" : ""),
          t.power_gen_w ? null : "Nothing makes power yet"),
      bar("BUDGET", money(t.cost_musd) + " / " + money(t.budget_musd), isNum(m.budget) ? 1 - m.budget : null, barClass(m.budget)),
      // For data a full bar is good: it is the share of data that reaches the ground.
      bar("DATA HOME", num(t.data_returned_gb_day) + " / " + num(t.data_gb_day) + " GB/DAY",
          t.data_gb_day > 0 ? t.data_returned_gb_day / t.data_gb_day : 0,
          dataLost ? (t.data_returned_gb_day > 0 ? " warn" : " bad") : "",
          !design.orbit ? "Pick an orbit to see ground contact" : null)
    ]);
  }

  function checkList(design, opts) {
    opts = opts || {};
    var checks = runChecks(design);
    var rows = [];
    checks.blockers.forEach(function (c) {
      if (opts.skip && opts.skip.indexOf(c.id) !== -1) return;
      rows.push({ c: c, kind: "bad", status: opts.short ? "[X]" : "NO GO" });
    });
    checks.warnings.forEach(function (c) { rows.push({ c: c, kind: "warn", status: opts.short ? "[!]" : "WARN" }); });
    if (!rows.length) return opts.short ? el("p", { class: "preview-line fix", text: "No problems right now." }) : null;
    return el("ul", { class: "checks" }, rows.map(function (row) {
      var target = FIX_SCREEN[row.c.id] || "build";
      return el("li", { class: "check " + row.kind }, [
        el("span", { text: row.c.text }),
        opts.fix && target !== state.screen
          ? el("button", { type: "button", class: "fix", onclick: function () { go(target); },
              "aria-label": "Fix on the " + target + " screen: " + row.c.text }, "FIX >")
          : el("span", { class: "status", text: row.status })
      ]);
    }));
  }

  // ---------------------------------------------------------------- tier select (title)
  // What a design may use in its era: { parts, launchers, objectives }, each id -> { available, year, reason }.
  // One call per screen refresh. Without eras everything is available.
  function availability(d) {
    var a = typeof getAvailability === "function" && d ? getAvailability(d) : null;
    return a || { parts: {}, launchers: {}, objectives: {} };
  }
  function lockReason(map, id) {
    var x = map ? map[id] : null;
    return x && x.available === false ? (x.reason || "Not available yet") : null;
  }

  // ---- campaign: the same screens between visits to the Campaign hub (js/ui-campaign.js)
  function inCampaign() { return !!(state.design && state.design.campaign); }
  function hubInfo() { return typeof getHubInfo === "function" ? getHubInfo() : null; }

  // "Expected payout $X M, cost $Y M, net $Z M": all three numbers from previewPayout().
  function payoutLine(d) {
    if (!d || !d.campaign || typeof previewPayout !== "function") return null;
    var p = previewPayout(d);
    if (!p) return null;
    return el("p", { class: "nasa-line payout-line", text: "Expected payout " + money(p.expected_payout_musd) +
      ", cost " + money(p.cost_musd) + ", net " + (p.net_musd < 0 ? "-" : "") + money(Math.abs(p.net_musd)) });
  }

  function campaignPanel(tiers) {
    if (typeof newCampaign !== "function" || typeof window.showCampaignHub !== "function") return null;
    var info = hubInfo();
    return el("div", { class: "panel campaign-panel" }, [
      el("h2", { text: "CAMPAIGN" }),
      el("p", { class: "card-blurb", text: "Start in 1957. Money and knowledge carry from one satellite to the next, and research opens new parts." }),
      info ? button(["CONTINUE: " + info.year + ", " + money(info.treasury_musd), " >"], function () { window.showCampaignHub(); },
        { primary: true, aria: "Continue the campaign" }) : null,
      el("div", { class: "tier-list row" }, tiers.map(function (t) {
        return el("button", {
          type: "button", class: "tier-btn", "data-key": "campaign-" + t.id,
          "aria-label": "New campaign, " + t.name,
          onclick: function () {
            if (info && !window.confirm("Start a new campaign? It replaces the one you have saved.")) return;
            newCampaign(t.id);
            window.showCampaignHub();
          }
        }, [el("span", { class: "tier-name", text: "NEW: " + t.name.toUpperCase() }),
            el("span", { class: "tier-facts", text: "Treasury " + money(t.budget_musd) + " · " + num(t.events, 0) + (t.events === 1 ? " event" : " events") + " a mission" })]);
      }))
    ]);
  }

  function startMissionDesign(tierId, eraId) {
    state.design = newDesign(tierId);
    if (eraId && typeof setEra === "function") setEra(state.design, eraId);
    state.reached = 0;
    state.player = "gate";
    go("map");
  }

  function tierButton(t, i, tiers, era, eraOpen, eraLockText) {
    var tierOpen = typeof isTierUnlocked === "function" ? isTierUnlocked(t.id) : true;
    var open = tierOpen && eraOpen;
    var why = !eraOpen ? "Locked" : !tierOpen ? "Earn 2 stars on " + (tiers[i - 1] ? tiers[i - 1].name : "the previous tier") : null;
    return el("button", {
      type: "button", class: "tier-btn" + (open ? "" : " locked"), disabled: !open,
      "data-key": era ? "start-" + era.id + "-" + t.id : "tier-" + t.id,
      "aria-label": (era ? era.name + " " + era.year + ", " : "") + t.name + (why ? ". Locked: " + (eraOpen ? why : eraLockText) : ""),
      onclick: function () { startMissionDesign(t.id, era ? era.id : null); }
    }, [
      el("span", { class: "tier-name", text: t.name.toUpperCase() }),
      el("span", { class: "tier-facts", text: why ? why : money(t.budget_musd) + " · " + num(t.events, 0) + (t.events === 1 ? " event" : " events") })
    ]);
  }

  // Tier select: eras across, tiers (maturity levels) down. All numbers come from getEras(), TIERS and getProgress().
  function drawTitle() {
    setStatus("Space Mission Design Game");
    state.locked = false;
    var tiers = data("TIERS");
    var eras = typeof getEras === "function" ? list(getEras()) : [];
    var progress = typeof getProgress === "function" ? getProgress() : { best_stars: {} };
    var missions = typeof MISSIONS !== "undefined" ? list(MISSIONS) : [];

    var grid;
    if (eras.length) {
      grid = el("div", { class: "eras" }, eras.map(function (e, i) {
        var lockText = e.unlocked ? null : "Earn 2 stars in " + (eras[i - 1] ? eras[i - 1].name : "the previous era");
        var real = list(e.real_missions).map(function (id) { var m = byId(missions, id); return m ? m.name : null; }).filter(Boolean);
        return el("div", { class: "era" + (e.unlocked ? "" : " locked"), "data-key": "era-" + e.id }, [
          el("div", { class: "era-year", text: String(e.year) }),
          el("div", { class: "card-title" }, [el("h3", { text: String(e.name).toUpperCase() }),
            el("span", { class: "stars", text: starsText(e.best_stars), "aria-label": (e.best_stars || 0) + " of 3 stars" })]),
          el("p", { class: "card-blurb", text: e.unlocked ? e.blurb : lockText }),
          real.length ? el("p", { class: "bar-note", text: "Real missions: " + real.join(", ") }) : null,
          el("div", { class: "tier-list" }, tiers.map(function (t, j) { return tierButton(t, j, tiers, e, e.unlocked, lockText); }))
        ]);
      }));
    } else {
      // No eras in the data: the three tiers alone, everything available.
      grid = el("div", { class: "eras" }, [el("div", { class: "era" }, [
        el("div", { class: "tier-list" }, tiers.map(function (t, j) { return tierButton(t, j, tiers, null, true, null); }))])]);
    }

    var best = el("p", { class: "bar-note", text: tiers.map(function (t) {
      return t.name + " " + starsText((progress.best_stars || {})[t.id] || 0);
    }).join("   ") });

    return el("section", { class: "title" }, [
      el("div", { class: "kicker", text: "A SPACE MISSION DESIGN GAME" }),
      el("h1", { class: "big-title", text: "STARLINE" }),
      el("p", { class: "tagline", text: "Pick a job for a satellite. Build it under hard limits. Launch it, and learn why it worked or failed." }),
      el("h2", { class: "subhead", text: eras.length ? "CHOOSE AN ERA AND A LEVEL" : "CHOOSE A LEVEL" }),
      tiers.length ? grid : el("p", { class: "empty", text: "No tiers in the data yet." }),
      tiers.length ? best : null,
      tiers.length ? campaignPanel(tiers) : null,
      el("div", null, [button("RESET PROGRESS", function () {
        if (typeof resetProgress === "function" && window.confirm("Forget every star you have earned?")) { resetProgress(); draw("title"); }
      })])
    ]);
  }

  // ---------------------------------------------------------------- 1 Briefing
  function wantsLine(objective) {
    // Instrument names whose tags match; the first wanted type counts fully, the others half.
    var parts = data("PARTS").filter(function (p) { return p.category === "instrument"; });
    return list(objective.wants).map(function (tag, i) {
      var names = parts.filter(function (p) { return list(p.tags).indexOf(tag) !== -1; }).map(function (p) { return p.name; });
      return (names.length ? names.join(" or ") : tag) + (i === 0 ? " (counts fully)" : " (counts half)");
    }).join("; ");
  }

  function drawBriefing() {
    var d = state.design;
    var objectives = data("OBJECTIVES");
    var chosen = byId(objectives, d.objective);
    var avail = availability(d);
    var info = inCampaign() ? hubInfo() : null;
    if (info) objectives = objectives.filter(function (o) { return !lockReason(avail.objectives, o.id); });
    var cards = objectives.map(function (o) {
      var locked = lockReason(avail.objectives, o.id);
      var topic = info ? byId(list(info.topics), o.id) : null;
      if (locked) {
        return el("button", { type: "button", class: "card locked", disabled: true, "data-key": "obj-" + o.id }, [
          el("div", { class: "card-title" }, [el("h3", { text: o.name.toUpperCase() }), el("span", { class: "tag bad", text: locked.toUpperCase() })])
        ]);
      }
      return el("button", {
        type: "button", class: "card", "aria-pressed": d.objective === o.id ? "true" : "false", "data-key": "obj-" + o.id,
        onclick: function () { setObjective(d, o.id); redraw(); }
      }, [
        el("div", { class: "card-title" }, [el("h3", { text: o.name.toUpperCase() }),
          d.objective === o.id ? el("span", { class: "tag on", text: "CHOSEN" }) : null]),
        el("p", { text: o.briefing }),
        facts([["Science target", num(o.science_target, 0) + " points"], ["What counts", wantsLine(o)],
          topic ? ["Pays about", money(topic.next_payout_estimate_musd)] : null])
      ]);
    });
    return el("section", { class: "screen" }, [
      head("1 · BRIEFING", "Decide the goal before the hardware."),
      el("div", { class: "dialogue" }, [
        directorArt(),
        el("div", null, [
          el("div", { class: "speaker" }, [el("h2", { text: "MISSION DIRECTOR" }), el("span", { text: "Ground control" })]),
          el("p", { class: "speech", text: chosen
            ? chosen.name + ". Good. Now find an orbit that can actually see it."
            : "Two jobs on the board today. Pick one, and I will find you a budget." })
        ])
      ]),
      objectives.length ? el("div", { class: "grid" }, cards) : el("p", { class: "empty", text: "No objectives in the data yet." }),
      navRow("orbit", !!d.objective)
    ]);
  }

  // ---------------------------------------------------------------- 2 Orbit
  // "In view: 69% of the world's fire detections (NASA FIRMS 2025)": the share comes from getOrbitFacts.
  // (The badge beside it is about how often the orbit looks, which is a different thing.)
  function inViewText(objectiveId, share) {
    var e = typeof EARTH !== "undefined" && EARTH ? EARTH[objectiveId] : null;
    var what = objectiveId === "wildfire" ? "of the world's fire detections" : objectiveId === "sea-ice" ? "of the Arctic sea ice" : "of the target";
    var src = e && e.source ? " (" + (objectiveId === "wildfire" ? "NASA FIRMS" : objectiveId === "sea-ice" ? "NSIDC Sea Ice Index" : "NASA data") + (e.year ? " " + e.year : "") + ")" : "";
    return "In view: " + Math.round(share * 100) + "% " + what + src;
  }
  function drawOrbit() {
    var d = state.design;
    var objective = byId(data("OBJECTIVES"), d.objective);
    var cards = data("ORBITS").map(function (o) {
      var probe = newDesign(d.tier);
      setObjective(probe, d.objective);
      setOrbit(probe, o.id);
      var f = getOrbitFacts(probe);
      var fit = objective && objective.orbit_fit ? objective.orbit_fit[o.id] : undefined;
      var badge = !isNum(fit) ? null
        : fit === 0 ? el("span", { class: "tag bad", text: "CANNOT SEE TARGET" })
        : fit < 1 ? el("span", { class: "tag warn", text: "PARTIAL VIEW" })
        : el("span", { class: "tag good", text: "GOOD VIEW" });
      return el("button", {
        type: "button", class: "card" + (fit === 0 ? " dim" : ""), "aria-pressed": d.orbit === o.id ? "true" : "false",
        "data-key": "orbit-" + o.id, onclick: function () { setOrbit(d, o.id); redraw(); }
      }, [
        el("div", { class: "card-title" }, [el("h3", { text: o.name.toUpperCase() }), badge]),
        el("p", { class: "card-blurb", text: o.blurb }),
        facts([
          ["Altitude", num(o.altitude_km, 0) + " km"],
          ["One lap", num(f.period_min) + " min"],
          ["Laps a day", num(f.laps_per_day)],
          ["In Earth's shadow", num(f.eclipse_min) + " min a lap"],
          ["Mission lifetime", num(o.lifetime_months, 0) + " months"]
        ]),
        isNum(f.target_in_view) ? el("p", { class: "nasa-line", text: inViewText(d.objective, f.target_in_view) }) : null
      ]);
    });
    return el("section", { class: "screen" }, [
      head("2 · ORBIT", objective ? "Where should a satellite for " + objective.name.toLowerCase() + " fly?" : "Where you fly changes everything else."),
      cards.length ? el("div", { class: "grid" }, cards) : el("p", { class: "empty", text: "No orbits in the data yet." }),
      navRow("build", !!d.orbit)
    ]);
  }

  // ---------------------------------------------------------------- 3 Build
  function partStats(p) {
    var bits = [];
    if (p.mass_kg) bits.push(num(p.mass_kg) + " kg");
    if (p.power_draw_w) bits.push(num(p.power_draw_w, 0) + " W draw");
    if (p.data_gb_day) bits.push(num(p.data_gb_day) + " GB/day made");
    if (p.downlink_gb_day) bits.push(num(p.downlink_gb_day) + " GB/day radio");
    if (p.battery_wh) bits.push(num(p.battery_wh, 0) + " Wh");
    return bits.join(" · ");
  }

  function partCard(p) {
    var d = state.design;
    var on = list(d.parts).indexOf(p.id) !== -1;
    var locked = lockReason(state.avail ? state.avail.parts : null, p.id);
    if (locked && !on) {
      return el("button", { type: "button", class: "part locked", disabled: true, "data-key": "part-" + p.id }, [
        el("div", { class: "part-head" }, [el("span", { class: "part-name", text: p.name })]),
        el("span", { class: "part-note", text: locked })
      ]);
    }
    var f = getPartFacts(d, p.id) || {};
    var extra = [];
    if (f.power_gen_w) extra.push("Makes " + num(f.power_gen_w, 0) + " W in sunlight");
    if (isNum(f.science_per_month)) extra.push(num(f.science_per_month) + " science a month");
    if (isNum(f.resolution_m)) extra.push("Sees " + num(f.resolution_m) + " m detail");
    var note = f.counts === false ? "Does not count for this objective"
      : f.sharp_enough === false ? "Too blurry from this orbit" : null;
    function preview() { state.hover = p.id; refreshPreview(); }
    return el("button", {
      type: "button", class: "part" + (note ? " dim" : ""), "aria-pressed": on ? "true" : "false", "data-key": "part-" + p.id,
      onpointerdown: function (e) {
        // Read before the tap focuses the card (focus also previews).
        state.touch = e.pointerType === "touch";
        state.armed = state.hover === p.id;
      },
      onclick: function () {
        // On touch screens there is no hover: the first tap previews, a second tap toggles.
        if (state.touch && !state.armed) { preview(); state.armed = true; return; }
        if (on) removePart(d, p.id); else addPart(d, p.id);
        redraw();
      },
      onfocus: preview,
      // Real mouse only: a phone tap also fires mouse enter/leave, which would undo the tap preview.
      onpointerenter: function (e) { if (e.pointerType === "mouse") preview(); },
      onpointerleave: function (e) { if (e.pointerType === "mouse") { state.hover = null; refreshPreview(); } }
    }, [
      el("div", { class: "part-head" }, [el("span", { class: "part-name", text: p.name }), el("span", { class: "part-cost", text: money(p.cost_musd) })]),
      el("span", { class: "part-stats", text: partStats(p) }),
      extra.length ? el("span", { class: "part-stats", text: extra.join(" · ") }) : null,
      el("span", { class: "part-stats", text: p.blurb }),
      note ? el("span", { class: "part-note", text: note }) : null,
      on ? el("span", { class: "tag on", text: "ON BOARD" }) : null
    ]);
  }

  // What clicking the hovered part would change (previewToggle), drawn in place.
  function drawPreview() {
    var box = el("div", { class: "panel preview", id: "preview", "aria-live": "polite" }, [el("h2", { text: "IF YOU CLICK" })]);
    if (!state.hover) {
      box.appendChild(el("p", { class: "preview-empty", text: "Point at a part to see what it would change." }));
      return box;
    }
    var p = byId(data("PARTS"), state.hover);
    var t = previewToggle(state.design, state.hover);
    var dl = t.delta || {};
    var bits = [];
    if (dl.mass_kg) bits.push(signed(dl.mass_kg) + " kg");
    if (dl.power_draw_w) bits.push(signed(dl.power_draw_w, 0) + " W draw");
    if (dl.power_gen_w) bits.push(signed(dl.power_gen_w, 0) + " W made");
    if (dl.cost_musd) bits.push((dl.cost_musd > 0 ? "+" : "-") + money(Math.abs(dl.cost_musd)));
    if (dl.data_returned_gb_day) bits.push("data home " + signed(dl.data_returned_gb_day) + " GB/day");
    if (dl.delta_v_ms) bits.push(signed(dl.delta_v_ms, 0) + " m/s");
    if (dl.battery_wh) bits.push(signed(dl.battery_wh, 0) + " Wh");
    if (dl.science_total) bits.push("science " + signed(dl.science_total, 0));
    box.appendChild(el("h3", { text: (t.adding ? "ADD " : "REMOVE ") + (p ? p.name.toUpperCase() : "") }));
    box.appendChild(el("p", { class: "preview-line", text: bits.length ? bits.join(", ") : "No change to the bars." }));
    list(t.fixes).forEach(function (x) { box.appendChild(el("p", { class: "preview-line fix", text: "Fixes: " + x.text })); });
    list(t.causes).forEach(function (x) { box.appendChild(el("p", { class: "preview-line cause", text: "Causes: " + x.text })); });
    return box;
  }

  function refreshPreview() {
    var old = document.getElementById("preview");
    if (old) old.parentNode.replaceChild(drawPreview(), old);
  }

  function sciencePanel(design) {
    var s = previewScience(design);
    var rows = list(s.instruments).map(function (i) {
      return el("div", null, [el("dt", { text: i.name }), el("dd", { text: i.counts === false ? "does not count" : num(i.per_month) + " a month" })]);
    });
    return el("div", { class: "panel" }, [
      el("h2", { text: "SCIENCE PREVIEW" }),
      el("p", { text: "About " + num(s.total, 0) + " of " + num(s.target, 0) + " over " + num(s.months, 0) + " months, if nothing goes wrong." }),
      rows.length ? el("dl", { class: "facts" }, rows) : null
    ]);
  }

  // The satellite's body: what it can carry (payload) against what is fitted. All numbers from getTotals().body.
  function bodyCard(body) {
    if (!body) return null;
    var over = body.payload_used_kg > body.payload_kg;
    return el("div", { class: "body-card" }, [
      el("h2", { class: "divided", text: "BODY: " + String(body.name || "").toUpperCase() }),
      bar("PAYLOAD", num(body.payload_used_kg) + " / " + num(body.payload_kg, 0) + " KG",
          body.payload_kg > 0 ? body.payload_used_kg / body.payload_kg : 0, over ? " bad" : "")
    ]);
  }

  function drawBuild() {
    var d = state.design;
    var parts = data("PARTS");
    var count = {};
    list(d.parts).forEach(function (id) { var p = byId(parts, id); if (p) count[p.category] = (count[p.category] || 0) + 1; });

    state.avail = availability(d);   // one call per screen refresh; partCard reads it
    var cats = categories();
    var cat = byId(cats, state.bin) || cats[0];   // the open bin
    var body = getTotals(d).body || null;   // { name, payload_kg, payload_used_kg, slots: { category: { used, max } } } or null
    var bins = el("div", { class: "panel bins" }, [el("h2", { text: "PARTS BINS" })].concat(cats.map(function (c) {
      var n = count[c.id] || 0;
      var need = c.required && !n;
      // With a body fitted, each bin shows how many of its slots are used ("2 / 3").
      var slot = body && body.slots ? body.slots[c.id] : null;
      if (slot && !slot.max && !slot.used) slot = null;   // no slots at all on this body
      var noRoom = !!body && !slot && c.id !== "structure";
      var over = !!slot && slot.used > slot.max;
      var sub = need ? "Needed" : slot ? slot.used + " / " + slot.max + " slots" : noRoom ? (n ? n + " on board, no room" : "No room on this body")
        : n ? n + " on board" : c.sub;
      return el("button", {
        type: "button", class: "bin", "aria-pressed": cat.id === c.id ? "true" : "false", "data-key": "bin-" + c.id,
        onclick: function () { state.bin = c.id; state.hover = null; redraw(); }
      }, [
        art("0 0 8 8", BIN_ICONS[c.id] || BIN_ICONS.fallback, null),
        el("span", { class: "bin-text" }, [
          el("span", { class: "bin-name", text: c.name }),
          el("span", { class: "bin-sub" + (need || over || (noRoom && n) ? " need" : ""), text: sub })
        ])
      ]);
    })));

    var built = cats.filter(function (c) { return count[c.id]; }).length;
    var bench = el("div", { class: "bench" }, [
      el("div", { class: "bench-label" }, [el("strong", { text: "YOUR SATELLITE" }),
        el("span", { text: list(d.parts).length + " parts · " + built + " of " + cats.length + " systems" })]),
      satelliteArt(d),
      drawPreview()
    ]);

    var overview = el("div", { class: "panel" }, [
      el("h2", { text: "MISSION OVERVIEW" }),
      resourceBars(d),
      bodyCard(body),
      el("h2", { class: "divided", text: "PROBLEMS" }),
      checkList(d, { short: true, skip: ["no-launcher"] })
    ]);

    var shelfParts = parts.filter(function (p) { return p.category === cat.id; });
    // What exists in this era first; what arrives later after it, greyed out.
    shelfParts = shelfParts.filter(function (p) { return !lockReason(state.avail.parts, p.id); })
      .concat(shelfParts.filter(function (p) { return !!lockReason(state.avail.parts, p.id); }));
    var shelf = el("div", { class: "panel" }, [
      el("h2", { text: "AVAILABLE " + cat.name }),
      shelfParts.length ? el("div", { class: "shelf" }, shelfParts.map(partCard))
        : el("p", { class: "empty", text: "No parts in this bin yet." })
    ]);

    return el("section", { class: "screen" }, [
      head("3 · BUILD", "Click a part to add it, click again to remove it. Several parts per bin are allowed."),
      el("div", { class: "workshop" }, [bins, bench, el("div", { class: "stack" }, [overview, sciencePanel(d)])]),
      payoutLine(d),
      shelf,
      navRow("launcher", true)
    ]);
  }

  // ---------------------------------------------------------------- 4 Launch vehicle
  function drawLauncher() {
    var d = state.design;
    var totals = getTotals(d);
    var orbit = byId(data("ORBITS"), d.orbit);
    var avail = availability(d);
    var cards = data("LAUNCHERS").map(function (l) {
      var locked = lockReason(avail.launchers, l.id);
      if (locked && d.launcher !== l.id) {
        return el("button", { type: "button", class: "card locked", disabled: true, "data-key": "rocket-" + l.id }, [
          el("div", { class: "card-title" }, [el("h3", { text: l.name.toUpperCase() }), el("span", { class: "tag bad", text: locked.toUpperCase() })])
        ]);
      }
      var cap = orbit && l.capacity_kg ? l.capacity_kg[orbit.id] : null;
      var reach = isNum(cap) && cap > 0;
      var fits = reach && cap >= totals.mass_kg;
      var tag = !orbit ? null
        : !reach ? el("span", { class: "tag bad", text: "CANNOT REACH" })
        : fits ? el("span", { class: "tag good", text: "FITS" })
        : el("span", { class: "tag bad", text: "TOO SMALL" });
      return el("button", {
        type: "button", class: "card" + (orbit && !reach ? " locked" : ""), disabled: !!(orbit && !reach),
        "aria-pressed": d.launcher === l.id ? "true" : "false", "data-key": "rocket-" + l.id,
        onclick: function () { setLauncher(d, l.id); redraw(); }
      }, [
        el("div", { class: "card-title" }, [el("h3", { text: l.name.toUpperCase() }), tag]),
        el("p", { class: "card-blurb", text: l.blurb }),
        facts([
          ["Price", money(l.cost_musd)],
          orbit ? ["Lifts to " + orbit.name.toLowerCase(), reach ? num(cap, 0) + " kg" : "cannot reach"] : null,
          ["Your spacecraft", num(totals.mass_kg) + " kg"]
        ])
      ]);
    });
    return el("section", { class: "screen" }, [
      head("4 · LAUNCH VEHICLE", "A bigger rocket solves mass and eats the budget."),
      el("div", { class: "pad" }, [
        cards.length ? el("div", { class: "grid" }, cards) : el("p", { class: "empty", text: "No rockets in the data yet." }),
        el("div", { class: "panel" }, [el("h2", { text: "MISSION OVERVIEW" }), resourceBars(d), payoutLine(d)])
      ]),
      navRow("review", true)
    ]);
  }

  // ---------------------------------------------------------------- 5 Readiness review (launch control)
  function drawReview() {
    var d = state.design;
    var totalsNow = getTotals(d);
    var checks = runChecks(d);
    var blocked = checks.blockers.length > 0;
    var warned = checks.warnings.length > 0;
    var names = function (ids, items) {
      return list(ids).map(function (id) { var x = byId(items, id); return x ? x.name : id; }).join(", ");
    };
    var objective = byId(data("OBJECTIVES"), d.objective);
    var orbit = byId(data("ORBITS"), d.orbit);
    var rocket = byId(data("LAUNCHERS"), d.launcher);
    var control = el("div", { class: "panel" }, [
      el("span", { class: "countdown-label", text: "T-MINUS" }),
      el("span", { class: "countdown", text: blocked ? "HOLD" : "00:00:10" }),
      el("p", { class: "verdict " + (blocked ? "bad" : warned ? "warn" : "ok"),
        text: blocked ? "NO GO. " + checks.blockers.length + " TO FIX." : warned ? "GO, WITH " + checks.warnings.length + " WARNING" + (checks.warnings.length > 1 ? "S" : "") : "ALL SYSTEMS GO" }),
      checkList(d, { fix: true }),
      facts([
        ["Objective", objective ? objective.name : "not chosen"],
        ["Orbit", orbit ? orbit.name : "not chosen"],
        ["Parts", list(d.parts).length ? names(d.parts, data("PARTS")) : "none"],
        ["Rocket", rocket ? rocket.name : "not chosen"],
        isNum(totalsNow.dev_months) ? ["Time", num(totalsNow.dev_months, 0) + " months to build"] : null
      ]),
      button(blocked ? "LAUNCH" : warned ? "LAUNCH ANYWAY" : "LAUNCH", launch, { primary: true, big: true, disabled: blocked }),
      blocked ? el("p", { class: "bar-note", text: "Fix the NO GO lines to unlock launch." }) : null
    ]);
    return el("section", { class: "screen" }, [
      head("5 · READINESS REVIEW", "Go or no-go. Blockers stop the launch; warnings cost points."),
      el("div", { class: "pad" }, [
        el("div", { class: "stack" }, [padArt(!blocked), el("div", { class: "panel" }, [el("h2", { text: "MISSION OVERVIEW" }), resourceBars(d)])]),
        control
      ]),
      navRow(null)
    ]);
  }

  // ---------------------------------------------------------------- the base map: rules
  function neighbours(id) {
    var out = [];
    EDGES.forEach(function (e) { if (e[0] === id) out.push(e[1]); else if (e[1] === id) out.push(e[0]); });
    return out;
  }

  // Shortest road route between two nodes (breadth-first search over the road graph).
  function route(from, to) {
    var prev = {}, queue = [from], seen = {};
    seen[from] = true;
    while (queue.length) {
      var at = queue.shift();
      if (at === to) break;
      neighbours(at).forEach(function (n) { if (!seen[n]) { seen[n] = true; prev[n] = at; queue.push(n); } });
    }
    if (!seen[to]) return [from];
    var path = [to];
    while (path[0] !== from) path.unshift(prev[path[0]]);
    return path;
  }

  function hasRequiredParts(d) {
    var have = {};
    list(d.parts).forEach(function (id) { var p = byId(data("PARTS"), id); if (p) have[p.category] = true; });
    return categories().every(function (c) { return !c.required || have[c.id]; });
  }

  // Where a NO GO line is fixed. Mass and budget belong to the rocket once one is chosen,
  // and to the parts before that.
  function fixPlace(check, d) {
    if ((check.id === "mass" || check.id === "budget") && !d.launcher) return "build";
    return FIX_SCREEN[check.id] || "build";
  }

  function blockedAt(d) {
    var at = {};
    runChecks(d).blockers.forEach(function (c) { at[fixPlace(c, d)] = true; });
    return at;
  }

  // The GPS target: the first place with something left to do, judged by runChecks.
  function waypoint() {
    var d = state.design;
    if (!d || !d.objective) return "briefing";
    if (!d.orbit) return "orbit";
    var at = blockedAt(d);
    if (!hasRequiredParts(d) || at.build) return at.orbit ? "orbit" : "build";
    if (!d.launcher) return "launcher";
    for (var i = 0; i < DESIGN_STEPS.length - 1; i++) if (at[DESIGN_STEPS[i]]) return DESIGN_STEPS[i];
    return "review";
  }

  // The objective line while you stand where the GPS points.
  function doText(screen) {
    var d = state.design;
    if (screen === "build" && hasRequiredParts(d)) return "Clear the [X] problems under the bars.";
    if (screen === "launcher" && d.launcher && blockedAt(d).launcher) return "Still NO GO: try another rocket, or cut mass or cost at the Workshop.";
    if (screen === "review" && !runChecks(d).blockers.length) return "Launch when ready.";
    return DO_TEXT[screen];
  }

  // A place opens once you have reached the one before it and made the choice it needs.
  function placeOpen(id) {
    var d = state.design, i = DESIGN_STEPS.indexOf(id);
    if (!d || i === -1) return false;
    if (id === "orbit" && !d.objective) return false;
    if (id === "build" && !d.orbit) return false;
    return i <= state.reached + 1;
  }

  function placeDone(id) {
    var d = state.design;
    if (!d) return false;
    var at = blockedAt(d);
    if (id === "briefing") return !!d.objective;
    if (id === "orbit") return !!d.orbit && !at.orbit;
    if (id === "build") return hasRequiredParts(d) && !at.build;
    if (id === "launcher") return !!d.launcher && !at.launcher;
    return false;
  }

  function placeStatus(id) {
    if (!placeOpen(id)) return "locked";
    if (id === waypoint()) return "next";
    return placeDone(id) ? "done" : "open";
  }

  var STATUS_TEXT = { locked: "LOCKED", next: "NEXT", done: "DONE", open: "OPEN" };

  function lockedReason(id) {
    if (id === "orbit" && !state.design.objective) return "Pick a job at Mission Control first.";
    if (id === "build" && !state.design.orbit) return "Choose an orbit at the Tracking Station first.";
    var before = PLACES[DESIGN_STEPS.indexOf(id) - 1];
    return before ? "Visit the " + before.name.toLowerCase() + " first." : "";
  }

  // ---------------------------------------------------------------- the base map: drawing
  function mapRects() {
    var C = { ground: "--map-ground", lot: "--map-lot", road: "--map-road", dash: "--map-dash", sea: "--map-sea",
              wave: "--map-wave", shore: "--map-shore" };
    var r = [
      [0, 0, MAP_W, MAP_H, C.ground],
      // sea along the east coast, with a few waves
      [184, 0, 16, MAP_H, C.sea], [182, 0, 2, MAP_H, C.shore],
      [188, 14, 6, 1, C.wave], [190, 46, 7, 1, C.wave], [187, 78, 6, 1, C.wave], [191, 104, 6, 1, C.wave],
      // building lots
      [20, 8, 40, 30, C.lot], [80, 8, 40, 30, C.lot], [146, 6, 34, 32, C.lot],
      [18, 90, 44, 24, C.lot], [78, 90, 44, 24, C.lot], [144, 90, 34, 24, C.lot],
      // roads: the main road and three side roads
      [0, 60, 182, 7, C.road], [37, 37, 7, 54, C.road], [97, 37, 7, 54, C.road], [157, 37, 7, 54, C.road]
    ];
    for (var x = 2; x < 180; x += 8) r.push([x, 63, 4, 1, C.dash]);
    r.push(
      // main gate: booth and barrier
      [2, 51, 7, 7, PAL.line], [3, 52, 5, 2, PAL.cyan], [9, 57, 10, 1, PAL.gold],
      // Mission Control: long building, window rows, roof aerial
      [24, 14, 32, 22, PAL.muted], [24, 14, 32, 3, PAL.line],
      [27, 20, 4, 3, PAL.cyan], [33, 20, 4, 3, PAL.cyan], [43, 20, 4, 3, PAL.cyan], [49, 20, 4, 3, PAL.cyan],
      [27, 26, 4, 3, PAL.cyan], [33, 26, 4, 3, PAL.cyan], [43, 26, 4, 3, PAL.cyan], [49, 26, 4, 3, PAL.cyan],
      [38, 31, 5, 5, PAL.gold], [50, 8, 1, 6, PAL.ink], [49, 7, 3, 1, PAL.red],
      // Tracking Station: two dishes on a low block
      [84, 28, 32, 8, PAL.line], [86, 14, 10, 2, PAL.ink], [85, 16, 12, 3, PAL.ink], [87, 19, 8, 2, PAL.muted],
      [90, 21, 2, 7, PAL.muted], [104, 10, 12, 2, PAL.ink], [103, 12, 14, 4, PAL.ink], [105, 16, 10, 2, PAL.muted],
      [109, 18, 2, 10, PAL.muted], [98, 31, 5, 5, PAL.gold],
      // Launch Pad: pad, tower, rocket
      [150, 12, 28, 24, C.road], [150, 12, 28, 1, PAL.line], [150, 35, 28, 1, PAL.line],
      [170, 8, 3, 27, PAL.line], [166, 14, 4, 1, PAL.line], [166, 24, 4, 1, PAL.line], [171, 6, 1, 2, PAL.red],
      [160, 9, 4, 3, PAL.red], [159, 12, 6, 20, PAL.ink], [163, 12, 2, 20, PAL.muted], [160, 17, 2, 2, PAL.cyan],
      [157, 28, 2, 5, PAL.red], [165, 28, 2, 5, PAL.red],
      // Workshop: hangar with a striped roof and a big door
      [22, 92, 36, 20, PAL.muted], [22, 92, 36, 2, PAL.ink],
      [22, 96, 36, 1, PAL.line], [22, 100, 36, 1, PAL.line], [32, 104, 16, 8, PAL.line], [33, 105, 14, 7, PAL.gold],
      // Rocket Yard: fence and three rockets of three sizes
      [82, 92, 36, 1, PAL.line], [82, 112, 36, 1, PAL.line], [82, 92, 1, 21, PAL.line], [117, 92, 1, 21, PAL.line],
      [86, 102, 2, 8, PAL.ink], [86, 100, 2, 2, PAL.red],
      [96, 98, 3, 12, PAL.ink], [96, 96, 3, 2, PAL.red],
      [107, 94, 5, 16, PAL.ink], [111, 94, 1, 16, PAL.muted], [107, 92, 5, 2, PAL.red], [105, 106, 2, 4, PAL.red], [112, 106, 2, 4, PAL.red],
      // Ground station: one big dish
      [150, 94, 22, 3, PAL.ink], [148, 97, 26, 4, PAL.ink], [152, 101, 18, 3, PAL.muted], [160, 104, 2, 8, PAL.muted],
      // street lights
      [24, 58, 1, 1, PAL.gold], [70, 58, 1, 1, PAL.gold], [130, 58, 1, 1, PAL.gold], [176, 58, 1, 1, PAL.gold],
      [24, 68, 1, 1, PAL.gold], [70, 68, 1, 1, PAL.gold], [130, 68, 1, 1, PAL.gold], [176, 68, 1, 1, PAL.gold]
    );
    return r;
  }

  function routePoints(path) {
    return path.map(function (id) { return NODES[id].x + "," + NODES[id].y; }).join(" ");
  }

  // The map art. `mini` = the header minimap, with the player and the route drawn in.
  function mapSvg(mini, here) {
    var svg = art("0 0 " + MAP_W + " " + MAP_H, mapRects(),
      mini ? null : "Pixel map of the space centre: Mission Control, the Tracking Station, the Workshop, the Rocket Yard and the Launch Pad, joined by roads",
      mini ? "minimap-art" : "map-art");
    var NS = "http://www.w3.org/2000/svg";
    var line = document.createElementNS(NS, "polyline");
    line.setAttribute("class", "map-route");
    line.setAttribute("fill", "none");
    svg.appendChild(line);
    if (mini) {
      var at = NODES[here] || NODES[state.player] || NODES.gate;
      var next = NODES[waypoint()];
      line.setAttribute("points", routePoints(route(here in NODES ? here : state.player, waypoint())));
      [[next.x - 4, next.y - 4, 8, 8, PAL.gold], [at.x - 3, at.y - 3, 6, 6, PAL.ink], [at.x - 2, at.y - 2, 4, 4, PAL.sky]].forEach(function (q) {
        var rect = document.createElementNS(NS, "rect");
        rect.setAttribute("x", q[0]); rect.setAttribute("y", q[1]);
        rect.setAttribute("width", q[2]); rect.setAttribute("height", q[3]); rect.setAttribute("fill", q[4]);
        svg.appendChild(rect);
      });
    }
    return svg;
  }

  function pct(node) { return { left: (node.x / MAP_W * 100) + "%", top: (node.y / MAP_H * 100) + "%" }; }

  function drawMap() {
    var refs = { markers: {}, legend: {} };
    var board = el("div", { class: "map", id: "map", role: "group", tabindex: "0", "aria-label": "Base map. Arrow keys or WASD to walk, E to go in." });
    refs.svg = mapSvg(false);
    refs.route = refs.svg.querySelector(".map-route");
    board.appendChild(refs.svg);

    PLACES.forEach(function (p) {
      var at = pct(NODES[p.id]);
      var b = el("button", {
        type: "button", class: "blip", "data-key": "blip-" + p.id, style: "left: " + at.left + "; top: " + at.top,
        onclick: function () { walkTo(p.id, true); }
      }, [el("span", { class: "blip-num", text: String(p.num) }), el("span", { class: "blip-name", text: p.name })]);
      refs.markers[p.id] = b;
      board.appendChild(b);
    });
    ["gate", "ground"].forEach(function (id) {
      var at = pct(NODES[id]);
      board.appendChild(el("span", { class: "map-label map-label-" + id, style: "left: " + at.left + "; top: " + at.top,
        text: id === "gate" ? "MAIN GATE" : "GROUND STATION", "aria-hidden": "true" }));
    });

    refs.player = el("div", { class: "player", "aria-hidden": "true" }, [art("0 0 7 7",
      [[3, 0, 1, 1, PAL.ink], [2, 1, 3, 1, PAL.ink], [1, 2, 5, 1, PAL.ink], [0, 3, 7, 2, PAL.ink], [2, 5, 3, 2, PAL.ink],
       [3, 2, 1, 3, PAL.red]], null)]);
    board.appendChild(refs.player);

    refs.promptText = el("span", { class: "map-prompt-text" });
    refs.enter = el("button", { type: "button", class: "btn primary", onclick: act, "data-key": "map-enter" }, "ENTER [E]");
    // Below the map, never on top of it, so it cannot cover a marker.
    refs.prompt = el("div", { class: "map-prompt", "aria-live": "polite" }, [refs.promptText, refs.enter]);

    var legend = el("ul", { class: "legend" }, PLACES.map(function (p) {
      var status = el("span", { class: "tag" });
      var does = el("span", { class: "legend-does", text: p.does });
      // No aria-label: the button's name is its visible text, which updateMap keeps current.
      var item = el("li", null, [el("button", {
        type: "button", class: "legend-item", "data-key": "legend-" + p.id, onclick: function () { walkTo(p.id, true); }
      }, [el("span", { class: "blip-num", text: String(p.num) }),
          el("span", { class: "legend-text" }, [el("span", { text: p.name }), does]),
          status])]);
      refs.legend[p.id] = { status: status, does: does };
      return item;
    }));

    refs.objective = el("p", { class: "map-objective" });
    state.map = refs;
    return el("section", { class: "screen" }, [
      head("BASE MAP", null),
      el("div", { class: "map-layout" }, [
        el("div", { class: "stack" }, [board, refs.prompt]),
        el("aside", { class: "panel" }, [
          el("h2", { text: "OBJECTIVE" }), refs.objective,
          el("h2", { class: "divided", text: "PLACES" }), legend,
          el("h2", { class: "divided", text: "CONTROLS" }),
          el("p", { class: "bar-note", text: "Arrow keys or WASD: walk. E or Enter: go in, or follow the gold route. Click a marker: walk there. M or Esc: back inside." }),
          el("div", null, [inCampaign()
            ? button("BACK TO THE HUB", function () { window.showCampaignHub(); })
            : button("CHANGE TIER", function () { showDesignScreen("title"); })])
        ])
      ])
    ]);
  }

  function placePlayer(nodeId, ms, from) {
    var refs = state.map;
    if (!refs) return;
    var to = NODES[nodeId], at = pct(to);
    if (from) {
      var dx = to.x - from.x, dy = to.y - from.y;
      var angle = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 90 : -90) : (dy > 0 ? 180 : 0);
      refs.player.style.setProperty("--face", angle + "deg");
    }
    refs.player.style.transitionDuration = ms + "ms";
    if (ms) void refs.player.offsetWidth;   // commit the start point so the move animates
    refs.player.style.left = at.left;
    refs.player.style.top = at.top;
  }

  // Refreshes markers, route, prompt and legend in place (the map is not redrawn while you walk).
  function updateMap(snap) {
    var refs = state.map;
    if (!refs || state.screen !== "map") return;
    if (snap) placePlayer(state.player, 0);
    var next = waypoint();
    PLACES.forEach(function (p) {
      var st = placeStatus(p.id);
      refs.markers[p.id].className = "blip " + st + (state.player === p.id ? " here" : "");
      var line = st === "locked" ? lockedReason(p.id) : p.does + ".";
      refs.markers[p.id].setAttribute("aria-label", p.num + ". " + p.name + ", " + STATUS_TEXT[st].toLowerCase() + ". " + line);
      refs.legend[p.id].does.textContent = st === "locked" ? lockedReason(p.id) : p.does;
      refs.legend[p.id].status.className = "tag " + (st === "next" ? "warn" : st === "done" ? "good" : st === "locked" ? "bad" : "");
      refs.legend[p.id].status.textContent = STATUS_TEXT[st];
    });
    refs.route.setAttribute("points", routePoints(route(state.player, next)));
    refs.objective.textContent = GO_TEXT[next];

    var here = byId(PLACES, state.player);
    var openHere = !!here && placeOpen(here.id);
    var canEnter = openHere && !state.walking;
    var text;
    if (state.mapNote) text = state.mapNote;
    else if (state.walking) text = "Walking...";
    else if (openHere) text = here.name + ": " + here.does + ".";
    else if (here) text = here.name + " is locked. " + lockedReason(here.id);
    else text = "Follow the gold route. " + GO_TEXT[next];
    refs.promptText.textContent = text;
    refs.enter.textContent = canEnter ? "ENTER [E]" : "FOLLOW ROUTE [E]";
    // Never disabled while walking: that would drop keyboard focus to the page.
    refs.enter.disabled = !!here && !openHere && here.id === next;
    setStep("map");
  }

  function stopWalking() {
    if (state.walkTimer) clearTimeout(state.walkTimer);
    state.walkTimer = null;
    state.walking = false;
    state.stepping = false;
    state.queued = null;
  }

  // Walks the player along a list of nodes, one road at a time, then calls done().
  function walkPath(path, done) {
    stopWalking();
    state.walking = true;
    state.mapNote = "";
    var i = 1;
    function next() {
      if (i >= path.length || state.screen !== "map") { state.walking = false; state.walkTimer = null; updateMap(); if (done) done(); return; }
      var from = NODES[path[i - 1]], to = NODES[path[i]];
      var ms = (Math.abs(to.x - from.x) + Math.abs(to.y - from.y)) * WALK_MS;
      state.player = path[i];
      placePlayer(path[i], ms, from);
      i++;
      state.walkTimer = setTimeout(next, ms);
    }
    updateMap();
    next();
  }

  function enterPlace(id) {
    if (!placeOpen(id)) {
      state.mapNote = byId(PLACES, id).name + " is locked. " + lockedReason(id);
      updateMap();
      state.mapNote = "";
      // Arm the double-click guard first: the scroll moves the list under the pointer.
      if (state.map) { state.swappedAt = Date.now(); state.map.prompt.scrollIntoView({ block: "nearest" }); }
      return;
    }
    go(id);
  }

  function walkTo(id, enterOnArrival) {
    if (state.walking) return;
    if (enterOnArrival && !placeOpen(id)) return enterPlace(id);   // say why now, no wasted walk
    walkPath(route(state.player, id), function () { if (enterOnArrival) enterPlace(id); });
  }

  // E / Enter on the map: go into the building you stand at, or follow the route.
  function act() {
    if (state.walking) return;
    var here = byId(PLACES, state.player);
    if (here && placeOpen(here.id)) return go(here.id);
    walkTo(waypoint(), false);
  }

  // Returns true if the key did something (so the page should not scroll).
  function stepToward(dir, repeat) {
    // A held key keeps walking but is never queued, so the arrow stops where you let go.
    if (state.walking) { if (state.stepping && !repeat) state.queued = dir; return true; }
    var at = NODES[state.player], best = null, bestScore = 0.5;
    neighbours(state.player).forEach(function (n) {
      var dx = NODES[n].x - at.x, dy = NODES[n].y - at.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      var score = (dx * dir[0] + dy * dir[1]) / len;
      if (score > bestScore) { bestScore = score; best = n; }
    });
    if (!best) return false;
    walkPath([state.player, best], function () {
      var q = state.queued;
      state.stepping = false;
      state.queued = null;
      if (q && state.screen === "map") stepToward(q);
    });
    state.stepping = true;   // after walkPath, which resets it
    return true;
  }

  function openMap() {
    if (state.locked || !state.design) return;
    if (DESIGN_STEPS.indexOf(state.screen) !== -1) state.player = state.screen;
    go("map");
  }

  // CONTINUE: step outside, walk the road to the next place and go in.
  function travel(id) {
    openMap();
    walkTo(id, true);
  }

  function onKey(e) {
    if (e.altKey || e.ctrlKey || e.metaKey || !state.design || state.locked) return;
    var k = e.key, active = document.activeElement;
    var onMap = state.screen === "map";
    if (onMap && KEY_DIRS[k]) { if (stepToward(KEY_DIRS[k], e.repeat) || e.repeat) e.preventDefault(); return; }
    if (onMap && (k === "m" || k === "M" || k === "Escape")) {
      e.preventDefault();
      if (!e.repeat && !state.walking && placeOpen(state.player)) go(state.player);   // back inside
      return;
    }
    if (onMap && (k === "e" || k === "E")) { e.preventDefault(); return act(); }
    // Enter is left to a focused button; otherwise it acts on the map.
    if (onMap && k === "Enter" && !(active && active.tagName === "BUTTON")) { e.preventDefault(); return act(); }
    if (!onMap && DESIGN_STEPS.indexOf(state.screen) !== -1 && (k === "m" || k === "M" || k === "Escape")) {
      e.preventDefault();
      if (!e.repeat) openMap();
    }
  }

  function launch() {
    if (runChecks(state.design).blockers.length) return;
    if (typeof window.showMissionScreen === "function") {
      state.locked = true;
      window.showMissionScreen(state.design);
    }
  }

  // ---------------------------------------------------------------- start-up and shared names
  function showDesignScreen(screenName, design) {
    if (design) state.design = design;
    state.locked = false;
    if (screenName === "title") { state.design = null; state.reached = 0; state.player = "gate"; }
    var i = DESIGN_STEPS.indexOf(screenName);
    if (i !== -1 && i > state.reached) state.reached = i;
    // A fresh design starts over at the gate; coming back to redesign, every place is open.
    if (design && (screenName === "briefing" || screenName === "map")) { state.reached = 0; state.player = "gate"; }
    else if (design) state.reached = DESIGN_STEPS.length - 1;
    go(screenName || "briefing");
  }

  window.showDesignScreen = showDesignScreen;
  window.StarlineUI = {
    el: el, art: art, facts: facts, button: button, num: num, money: money, starsText: starsText,
    byId: byId, data: data, list: list, directorArt: directorArt,
    setStep: setStep, setHint: setHint, setStatus: setStatus,
    lock: function () { state.locked = true; },
    bar: bar,
    // Leaving the design and mission screens for the Campaign hub: no design in hand, nothing locked.
    leaveMission: function () { stopWalking(); state.design = null; state.locked = false; state.reached = 0; state.player = "gate"; },
    mount: function (screen, node) {
      state.screen = screen;
      state.swappedAt = Date.now();
      var app = document.getElementById("app");
      while (app.firstChild) app.removeChild(app.firstChild);
      app.appendChild(node);
      setStep(screen);
      setHint(screen);
      app.focus();
      window.scrollTo(0, 0);
    },
    tierName: function () { var t = tier(); return t ? t.name.toUpperCase() : ""; }
  };

  function start() {
    var help = document.getElementById("help-btn");
    if (help) help.addEventListener("click", function () { state.hintOpen = !state.hintOpen; setHint(state.screen); });
    var mini = document.getElementById("minimap");
    if (mini) mini.addEventListener("click", openMap);
    document.addEventListener("keydown", onKey);
    // A double-click whose first click changed the screen must not also click
    // whatever appeared under the pointer. Later clicks on the new screen are fine.
    document.addEventListener("click", function (e) {
      if (e.detail > 1 && state.lastClickAt <= state.swappedAt && Date.now() - state.swappedAt < 600) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      state.lastClickAt = Date.now();
    }, true);
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) WALK_MS = 0;
    draw("title");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
