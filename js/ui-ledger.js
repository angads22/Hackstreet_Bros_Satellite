// js/ui-ledger.js — v1.2 ledger strip (builder C): three tiles, CASH, DEBT and MONTHS LEFT, at the top of every Part 2
// screen. Plain script, no import; every call is guarded, so the game works without this file.
//   StarlineLedger.strip(info, opts)  builds the strip for a getComeback() result. The workshop puts it in its own
//                                      markup (opts.workshop); the other screens get the one mounted below.
//   StarlineLedger.refresh()          redraws the mounted strip for the screen that is up (the observer calls it).
// Every amount comes from getComeback() (cash, debt, months left, next_interest_musd) or getTotals() (the design's cost);
// nothing is worked out here. A tile that changed flashes once (css/ledger.css, only without reduced motion): flash and
// bar growth only, never counted up, and nothing waits for it. Real state only: no pulse, no countdown, no sound.
(function () {
  "use strict";

  var UI = window.StarlineUI;
  if (!UI) return;   // ui-design.js failed to load; nothing to draw with
  var el = UI.el, num = UI.num, money = UI.money;

  var QUARTER = 0.25;   // MONTHS LEFT turns amber with this share of the deadline or less left (as the workshop always did)
  // The Part 2 screens that carry the mounted strip (the workshop draws its own, inside its markup).
  var SCREENS = { map: 1, briefing: 1, orbit: 1, build: 1, launcher: 1, review: 1, mission: 1, debrief: 1 };
  var COSTS = { build: 1, launcher: 1, review: 1 };   // where the design's cost so far is worth a line
  var RESET = { title: 1, "comeback-start": 1 };      // a new run starts here: its first numbers are not "changes"

  var seen = {};          // the text each piece showed last, so a change (and only a change) flashes
  var lateMemo = { key: null, value: false };
  var design = null;      // the design in hand, caught as the screens are opened (the design screens keep theirs private)

  function info() {
    try { return typeof getComeback === "function" ? getComeback() : null; } catch (e) { return null; }
  }

  // Did this piece of text change since the strip last showed it? The first time it is seen, it did not.
  function changed(key, text) {
    var was = seen[key];
    seen[key] = text;
    return was !== undefined && was !== text;
  }

  // True when even the quickest possible satellite would land on or after the deadline (the workshop's own check, kept
  // per month and per set of contracts: it builds a probe design).
  function tooLate(c) {
    var probe = window.StarlineComeback && window.StarlineComeback.noFlightInTime;
    if (typeof probe !== "function") return false;
    var key = c.month + "|" + c.flights + "|" + UI.list(c.contracts).map(function (k) { return k.id; }).join(",");
    if (lateMemo.key !== key) lateMemo = { key: key, value: !!probe(c) };
    return lateMemo.value;
  }

  // The design's cost so far, for the CASH tile on the design screens: a fact from getTotals(), or null.
  function designCost(screen) {
    try {
      var d = typeof UI.design === "function" ? UI.design() : design;
      if (!COSTS[screen] || !d || !d.comeback || typeof getTotals !== "function") return null;
      var t = getTotals(d);
      return t && t.cost_musd > 0 ? t.cost_musd : null;
    } catch (e) { return null; }
  }

  // One tile: label, value, and small lines beside or under it. The ids are the ones the workshop and its tests use.
  function tile(key, id, label, value, extra, cls) {
    var flash = changed("v:" + key, value);
    return el("div", { class: "lt" + (cls ? " " + cls : ""), "data-key": key }, [
      el("span", { class: "lt-label", text: label }),
      el("strong", { class: "lt-value" + (flash ? " lt-flash" : ""), id: id, text: value })
    ].concat(extra || []));
  }

  // c: a getComeback() result. opts.workshop: in the workshop's own markup, which also says the deadline cue in words.
  function strip(c, opts) {
    opts = opts || {};
    if (!c) return null;
    var workshop = !!opts.workshop;

    // CASH, and on the design screens what this design costs so far.
    var cost = designCost(opts.screen);
    var cashExtra = [];
    if (cost !== null) {
      var costText = "DESIGN " + money(cost);
      cashExtra.push(el("span", { class: "lt-sub" + (changed("s:cost", costText) ? " lt-flash" : ""), "data-key": "ledger-design", text: costText }));
    } else changed("s:cost", "");

    // DEBT, and next month's interest: real state from the back end; it changes only when the debt does.
    var debtExtra = [];
    if (c.debt_musd > 0 && c.next_interest_musd > 0) {
      var tickText = "+" + money(c.next_interest_musd) + " INTEREST";
      debtExtra.push(el("span", { class: "lt-sub lt-tick" + (changed("s:tick", tickText) ? " lt-flash" : ""), "data-key": "ledger-interest",
        title: "Added to the debt next month", text: tickText }));
    } else changed("s:tick", "");

    // MONTHS LEFT, and the deadline cue: icon + word + colour, nothing that moves and nothing to hear.
    var late = c.months_left <= c.deadline_month * QUARTER;
    var tooLateNow = !c.finished && tooLate(c);
    var cue = tooLateNow ? "bad" : late ? "warn" : "";
    var monthsExtra = [];
    if (cue) {
      monthsExtra.push(el("span", { class: "lt-sub lt-cue " + cue, "data-key": "ledger-cue" },
        [UI.icon(tooLateNow ? "blocker" : "warning"), el("span", { text: tooLateNow ? "TOO LATE" : "LATE" })]));
    }
    if (workshop && tooLateNow) monthsExtra.push(el("span", { class: "lt-note", role: "alert", text: "No flight can land before the deadline." }));
    else if (workshop && late && opts.lateText) monthsExtra.push(el("span", { class: "lt-note", text: opts.lateText }));

    return el("div", { class: "lstrip" + (workshop ? " in-screen" : ""), role: "group", "aria-label": "Cash, debt and months left", "data-key": "ledger-strip" }, [
      tile("stat-cash", "cb-cash", "CASH", money(c.cash_musd), cashExtra, "lt-cash"),
      tile("stat-debt", "cb-debt", "DEBT", money(c.debt_musd), debtExtra, "lt-debt"),
      tile("stat-months", "cb-months", "MONTHS LEFT", num(c.months_left, 0), monthsExtra, "lt-months" + (cue ? " warn" + (cue === "bad" ? " bad" : "") : ""))
    ]);
  }

  // ---------------------------------------------------------------- the strip on the other Part 2 screens
  // One node before #app (the screens redraw into #app and leave it alone). A header hook (#lstrip-slot) is used when
  // the shell provides one. Redrawn whenever #app gets new content, which is every click that redraws a screen.
  var host = null;

  function mountPoint() {
    if (host && document.body.contains(host)) return host;
    host = document.getElementById("lstrip-slot");
    if (host) return host;
    var app = document.getElementById("app");
    if (!app || !app.parentNode) return null;
    host = el("div", { id: "lstrip-slot", class: "lstrip-host" });
    host.hidden = true;
    app.parentNode.insertBefore(host, app);
    return host;
  }

  function refresh() {
    try {
      var app = document.getElementById("app");
      var screen = app ? app.getAttribute("data-screen") : null;
      if (screen && RESET[screen]) { seen = {}; lateMemo = { key: null, value: false }; }
      var slot = mountPoint();
      if (!slot) return;
      var c = screen && SCREENS[screen] && document.body.dataset.era !== "1958" ? info() : null;
      if (!c || c.finished) {
        if (!slot.hidden) { while (slot.firstChild) slot.removeChild(slot.firstChild); slot.hidden = true; }
        return;
      }
      var node = strip(c, { screen: screen });
      while (slot.firstChild) slot.removeChild(slot.firstChild);
      slot.appendChild(node);
      slot.hidden = false;
    } catch (e) { /* the strip is an extra: the screens work without it */ }
  }

  // The design screens keep their design private. Part 2's flights all open through showDesignScreen(name, design), so
  // the strip learns the design there. (A StarlineUI.design() export, when the shell has one, is used instead.)
  var open = window.showDesignScreen;
  if (typeof open === "function") {
    window.showDesignScreen = function (name, d) {
      if (d) design = d;
      if (name === "title") design = null;
      return open.apply(this, arguments);
    };
  }

  function start() {
    var app = document.getElementById("app");
    if (!app) return;
    mountPoint();
    if (typeof MutationObserver === "function") new MutationObserver(refresh).observe(app, { childList: true });
    refresh();
  }

  window.StarlineLedger = { strip: strip, refresh: refresh };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
