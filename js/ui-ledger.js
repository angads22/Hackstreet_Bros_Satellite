// js/ui-ledger.js — the ledger strip (version 2.1, UI review item "ledger-strip"): three tiles, CASH, DEBT and MONTHS LEFT,
// at the top of every Part 2 screen. A tile flashes for about 0.6 s when an action moved it (never counts up); the debt
// tile carries the interest tick and the months tile the deadline cue. Every number comes from getLedger() (js/mission.js).
// Part 1 and the home page get nothing. The workshop draws the strip itself (StarlineLedger.strip, with the debt meter
// inside the debt tile); on the other Part 2 screens one persistent strip sits above the screen.
// BORROW from anywhere (version 2.1): the CASH tile is a button that opens the borrow panel on every Part 2 screen. One set of
// rules: loan() is the only caller of borrow() (js/mission.js); the workshop's own BORROW buttons call it too. Every number in
// the panel comes from getComeback() or from what borrow() returns.
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
      var isCash = kind === "cash";   // BORROW from anywhere: the cash tile is the button that opens the borrow panel
      if (isCash) {
        attrs.type = "button"; attrs.onclick = openPanel; attrs["aria-haspopup"] = "dialog";
        attrs["aria-label"] = "Cash " + value + ". Borrow";
        if (!opts.ids) attrs["data-key"] = "ledger-cash";
        extra = [el("span", { class: "lt-sub lt-act", "aria-hidden": "true", text: "+ BORROW" })].concat(extra || []);
      }
      var node = el(isCash ? "button" : "div", attrs, [
        el("span", { class: "lt-label", text: label }),
        el("strong", { class: "lt-value" + (opts.ids ? " cb-stat-value" : ""), id: pre + (kind === "months" ? "months" : kind), text: value })
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

  // ---- BORROW from anywhere (version 2.1): the borrow panel, one for every Part 2 screen
  var BORROW_SHARES = [0.25, 0.5, 1];   // the amounts on offer: these shares of the most the lenders will lend now, rounded down
  var panel = null;                     // the open panel: { node, amount, note }
  var said = null;                      // a line for screen readers after a loan

  function hubFacts() {
    try { return typeof getComeback === "function" ? getComeback() : null; } catch (e) { return null; }
  }
  function borrowAmounts(c) {
    var max = c && c.max_borrow_musd || 0, out = [], step = max >= 4 ? 1 : 0.1;
    BORROW_SHARES.forEach(function (sh) {
      var v = Math.floor(max * sh / step + 1e-9) * step;
      v = Math.round(v * 10) / 10;
      if (v > 0 && out.indexOf(v) === -1) out.push(v);
    });
    return out;
  }
  // The one place a loan is taken. Returns what borrow() returned.
  function loan(amount) {
    var r = null;
    try { r = typeof borrow === "function" ? borrow(amount) : null; } catch (e) { r = null; }
    r = r || { ok: false, reason: "Borrowing is not available." };
    if (r.ok && window.GravAudio && typeof window.GravAudio.sfx === "function") window.GravAudio.sfx("pay");
    return r;
  }
  // Why the lenders lend nothing now, in the back end's words: borrow() refuses more than max_borrow_musd before it changes anything.
  function refusal(c) {
    var r = null;
    try { r = typeof borrow === "function" ? borrow((c.max_borrow_musd || 0) + 1) : null; } catch (e) { r = null; }
    return r && !r.ok && r.reason ? r.reason : "The lenders will lend no more.";
  }
  function cashTile() { return document.querySelector(".lstrip .lt-cash"); }
  function holdMission(on) {
    if (window.StarlineMission && typeof window.StarlineMission.hold === "function") window.StarlineMission.hold(on);
  }

  function drawPanel() {
    var c = hubFacts();
    if (!panel || !c) { closePanel(); return; }
    var amounts = borrowAmounts(c);
    if (amounts.indexOf(panel.amount) === -1) panel.amount = amounts.length ? amounts[0] : null;
    var fact = function (label, value, key) {
      return el("div", { class: "bp-fact", "data-key": key }, [el("span", { class: "lt-label", text: label }), el("strong", { text: value })]);
    };
    var picks = amounts.map(function (v) {
      var b = UI.button(money(v), function () { panel.amount = v; panel.note = ""; drawPanel(); focusKey("bp-amount-" + v); },
        { key: "bp-amount-" + v, aria: "Amount " + money(v) });
      b.setAttribute("aria-pressed", v === panel.amount ? "true" : "false");
      return b;
    });
    var note = panel.note || (amounts.length ? "" : refusal(c));
    var box = el("div", { class: "bp", role: "dialog", "aria-modal": "true", "aria-labelledby": "bp-title", "data-key": "borrow-dialog" }, [
      el("h2", { id: "bp-title", text: "BORROW" }),
      picks.length ? el("div", { class: "bp-amounts", role: "group", "aria-label": "Amount" }, picks) : null,
      el("div", { class: "bp-facts" }, [
        fact("FEE", num((c.loan_fee || 0) * 100, 0) + "%", "bp-fee"),
        fact("RATE", num((c.interest_per_month || 0) * 100, 1) + "% A MONTH", "bp-rate"),
        fact("SCORE", num(c.credit_score, 0) + " " + c.credit_band, "bp-score")
      ]),
      note ? el("p", { class: "cb-note bad", id: "bp-note", role: "alert", text: note }) : null,
      el("div", { class: "bp-actions" }, [
        panel.amount ? UI.button("BORROW " + money(panel.amount), commit, { primary: true, key: "bp-go" }) : null,
        UI.button("CLOSE", function () { closePanel(true); }, { key: "bp-close" })
      ])
    ]);
    while (panel.node.firstChild) panel.node.removeChild(panel.node.firstChild);
    panel.node.appendChild(box);
  }
  function focusKey(key) {
    var n = panel && panel.node.querySelector('[data-key="' + key + '"]');
    if (n) n.focus();
  }
  function openPanel() {
    if (panel || !hubFacts()) return;
    panel = { node: el("div", { class: "bp-scrim", id: "borrow-scrim" }), amount: null, note: "" };
    panel.node.addEventListener("mousedown", function (e) { if (e.target === panel.node) closePanel(true); });
    document.body.appendChild(panel.node);
    document.addEventListener("keydown", onPanelKey, true);
    holdMission(true);   // the flight waits while the panel is open
    drawPanel();
    if (panel) { var first = panel.node.querySelector(".bp-amounts .btn, .bp-actions .btn"); if (first) first.focus(); }
  }
  function closePanel(refocus) {
    if (!panel) return;
    document.removeEventListener("keydown", onPanelKey, true);
    if (panel.node.parentNode) panel.node.parentNode.removeChild(panel.node);
    panel = null;
    holdMission(false);
    if (refocus) { var t = cashTile(); if (t) t.focus(); }
  }
  // While the panel is open the keys belong to it: Esc closes, Tab stays inside, and no screen shortcut (M, the map's
  // arrows) fires underneath. Enter and Space still press the focused button.
  function onPanelKey(e) {
    if (!panel) return;
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); closePanel(true); return; }
    if (e.key !== "Tab") return;
    var all = Array.prototype.slice.call(panel.node.querySelectorAll("button:not([disabled])"));
    if (!all.length) return;
    var at = all.indexOf(document.activeElement), next = e.shiftKey ? at - 1 : at + 1;
    if (at === -1 || next < 0 || next >= all.length) { e.preventDefault(); all[next < 0 ? all.length - 1 : 0].focus(); }
  }
  // BORROW in the panel: the loan, then the screen in hand follows the new cash. A refused loan stays open with the reason.
  function commit() {
    if (!panel || !panel.amount) return;
    var r = loan(panel.amount);
    if (!r.ok) { panel.note = r.reason || "That loan did not go through."; drawPanel(); focusKey("bp-close"); return; }
    closePanel(false);
    follow(r, true);
    if (!said) { said = el("p", { class: "sr-only", role: "status", id: "ledger-said" }); document.body.appendChild(said); }
    said.textContent = "Borrowed " + money(r.borrowed_musd) + ". Fee " + money(r.fee_musd) + ". Debt " + money(r.debt_musd) + ".";
    var t = cashTile();
    if (t) t.focus();
  }
  // After a loan: the workshop draws itself again (its note, its meters); a design screen draws again with the design, the open
  // bin and the scroll kept; the mission and the debrief only get the new strip. The strip flashes CASH and DEBT.
  function follow(r, fromPanel) {
    var C = window.StarlineComeback;
    if (document.querySelector('.screen.cb [data-key="stat-cash"]') && C && typeof C.afterLoan === "function") { C.afterLoan(r, fromPanel); return; }
    if (typeof UI.cashMoved === "function") UI.cashMoved();
    refresh();
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

  window.StarlineLedger = { strip: strip, refresh: refresh, cashText: cashText, facts: facts, reset: function () { last = null; },
    borrowAmounts: borrowAmounts, loan: loan, openBorrow: openPanel, closeBorrow: closePanel };   // BORROW from anywhere
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
