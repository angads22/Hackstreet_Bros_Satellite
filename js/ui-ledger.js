// js/ui-ledger.js — the ledger strip (version 2.1, UI review item "ledger-strip"): three tiles, CASH, DEBT and MONTHS LEFT,
// at the top of every Part 2 screen. A tile flashes for about 0.6 s when an action moved it (never counts up); the debt
// tile carries the interest tick and the months tile the deadline cue. Every number comes from getLedger() (js/mission.js).
// Part 1 and the home page get nothing. The workshop draws the strip itself (StarlineLedger.strip, with the debt meter
// inside the debt tile); on the other Part 2 screens one persistent strip sits above the screen.
(function () {
  "use strict";

  var UI = window.StarlineUI;
  if (!UI) return;
  var el = UI.el, num = UI.num, money = UI.money;
  var FLASH_MS = 600;
  var last = null;      // the values the last strip showed: a tile whose value moved since then flashes
  var outer = null;     // the persistent strip's node (one, above #app)
  var outerSig = "";

  function facts() {
    try { return typeof getLedger === "function" ? getLedger() : null; } catch (e) { return null; }
  }
  // The cash keeps its hundredths when it has them: the engineers' fees are a few cents each.
  function cashText(v) {
    return typeof v === "number" && Math.abs(v * 10 - Math.round(v * 10)) > 1e-6 ? "$" + num(v, 2) + "M" : money(v);
  }
  function tickText(f) { return "+" + money(f.interest_month_musd) + " INTEREST A MONTH"; }

  // opts.ids: the workshop's ids and keys (cb-cash, stat-cash, ...); opts.debtExtra / opts.monthsExtra: nodes the
  // workshop adds inside those tiles (the debt meter, the "no flight can land" note); opts.facts: for tests.
  function strip(opts) {
    opts = opts || {};
    var f = opts.facts || facts();
    if (!f) return null;
    var now = { cash: f.cash_musd, debt: f.debt_musd, months: f.months_left };
    var moved = {};
    if (last) Object.keys(now).forEach(function (k) { if (last[k] !== now[k]) moved[k] = true; });
    last = now;
    var pre = opts.ids ? "cb-" : "ls-";
    var near = !!f.deadline_near;
    var tiles = [];

    function tile(kind, label, value, cls, extra, key) {
      var attrs = { class: "lt lt-" + kind + (cls ? " " + cls : ""), "data-tile": kind };
      if (opts.ids) attrs["data-key"] = key;
      var node = el("div", attrs, [
        el("span", { class: "lt-label", text: label }),
        el("strong", { class: "lt-value", id: pre + (kind === "months" ? "months" : kind), text: value })
      ].concat(extra || []));
      tiles.push(node);
      if (moved[kind]) {
        node.classList.add("lt-flash");
        setTimeout(function () { node.classList.remove("lt-flash"); }, FLASH_MS);
      }
      return node;
    }

    var debtExtra = [f.debt_musd > 0 ? el("span", { class: "lt-sub lt-tick", "data-key": "interest-tick", text: tickText(f) }) : null]
      .concat(opts.debtExtra || []);
    var monthsExtra = [near ? el("span", { class: "lt-sub lt-cue", "data-key": "deadline-cue" }, [UI.icon("warning"), "DEADLINE NEAR"]) : null]
      .concat(opts.monthsExtra || []);
    var node = el("div", { class: "lstrip", role: "group", "aria-label": "Cash, debt and months left" }, [
      tile("cash", "CASH", cashText(f.cash_musd), "", null, "stat-cash"),
      tile("debt", "DEBT", money(f.debt_musd), "", debtExtra, "stat-debt"),
      tile("months", "MONTHS LEFT", num(f.months_left, 0), near || opts.warn ? "warn" : "", monthsExtra, "stat-months")
    ]);
    return node;
  }

  // ---- the persistent strip: above #app on every Part 2 screen except the workshop (which draws its own)
  function isPart2() {
    if (document.body && document.body.classList.contains("is-home")) return false;   // the home page never shows it
    var name = UI.tierName ? UI.tierName() : "";
    return /^PART 2/.test(name);
  }
  function refresh() {
    var app = document.getElementById("app");
    if (!app || !app.parentNode) return;
    if (!outer) {
      outer = el("div", { class: "lstrip-host", id: "lstrip-host" });
      outer.hidden = true;
      app.parentNode.insertBefore(outer, app);
    }
    var f = isPart2() ? facts() : null;
    if (!f) { outer.hidden = true; outerSig = ""; return; }
    var sig = JSON.stringify(f);
    if (!outer.hidden && sig === outerSig) return;   // nothing moved: leave a flashing tile alone
    outerSig = sig;
    while (outer.firstChild) outer.removeChild(outer.firstChild);
    outer.appendChild(strip({ facts: f }));
    outer.hidden = false;
  }

  function start() {
    var app = document.getElementById("app");
    if (!app || typeof MutationObserver === "undefined") return;
    new MutationObserver(refresh).observe(app, { childList: true });
    // An action that changes a number without drawing the screen again (buying part information, a swap): look again.
    document.addEventListener("click", function () { setTimeout(refresh, 0); }, true);
    refresh();
  }

  window.StarlineLedger = { strip: strip, refresh: refresh, cashText: cashText, facts: facts, reset: function () { last = null; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
