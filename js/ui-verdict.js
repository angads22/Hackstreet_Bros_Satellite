/* v1.2 ui-verdict: owned by builder D. Plain script, no import; every export is guarded so the game works without this file.
   The Build screen's verdict strip (.vstrip): three gauges that each put THIS DESIGN against THE NEED, and the pay line.
     DATA  the design's science against the contract's points
     COST  what the design costs (the rocket included) against the cash
     TIME  the months the flight takes against the months left
   js/ui-design.js drawBuild makes an empty slot under the satellite and calls StarlineUI.fillVerdict(slot, design) on every
   draw. Part 2 only: Part 1 has no contract, no cash to spend and no deadline.
   Help levels (SPEC.md, "Difficulty: how much help"): the gauges show FACTS on every level (the contract's need, the design's
   cost, the cash, the months). What the game works out for the player shows only on Easy and Normal: the DATA gauge's
   forecast (previewScience), the words MET / SHORT / THIN, and amber for a thin margin. A red cross shows on every level
   only where the back end already blocks the flight (a "budget" blocker, a "deadline" warning), so Hard gains no hidden aid.
   Every number comes from the back end (previewPayout, previewProfit, previewScience, flightMonths, getComeback, getTotals). */
(function () {
  "use strict";
  var UI = window.StarlineUI;
  if (!UI) return;
  var el = UI.el, num = UI.num, money = UI.money;
  var THIN = 0.1;   // amber when under a tenth of the limit is left (the resource bars' own "thin" rule)

  function isNum(x) { return typeof x === "number" && isFinite(x); }
  function ids(items) { return UI.list(items).map(function (c) { return c && c.id; }); }
  function share(value, limit) { return limit > 0 && isNum(value) ? Math.max(0, Math.min(1, value / limit)) : value > 0 ? 1 : 0; }

  // Everything the strip shows, as plain facts and states. null when there is nothing to show (not Part 2, no contract).
  function facts(d) {
    if (!d || !d.comeback || typeof previewPayout !== "function" || typeof getComeback !== "function") return null;
    var info = getComeback(), p = previewPayout(d), k = p && p.contract;
    if (!info || !k) return null;
    var hard = UI.assist(d) === "minimal", built = UI.list(d.parts).length > 0;
    var checks = typeof runChecks === "function" ? runChecks(d) : { blockers: [], warnings: [] };
    var blocked = ids(checks.blockers), warned = ids(checks.warnings);
    var f = typeof previewProfit === "function" ? previewProfit(d) : null;
    var totals = typeof getTotals === "function" ? getTotals(d) : {};
    var objective = UI.byId(UI.data("OBJECTIVES"), d.objective), scale = objective && objective.science_target > 0 ? objective.science_target : k.min_science;
    var nothingNew = !!(p.topic_complete && !(p.new_data > 0));

    // DATA: the contract's points are a fact. The design's science is previewScience: a forecast, not on Hard.
    var sci = !hard && typeof previewScience === "function" ? previewScience(d) : null;
    var have = sci && isNum(sci.total) ? sci.total : null;
    var data = { key: "vg-data", name: "DATA", need: k.min_science, have: have, tick: share(k.min_science, scale),
      fill: have === null ? null : share(have, scale), state: "", word: "",
      text: have === null ? "Needs " + num(k.min_science, 0) + " pts" : num(have, 0) + " / " + num(k.min_science, 0) + " pts" };
    if (have !== null && built) {
      if (nothingNew || !(have > 0)) { data.state = "bad"; data.word = nothingNew ? "NO PAY" : "NONE"; }
      else if (have < k.min_science) { data.state = "warn"; data.word = "SHORT"; }
      else if (have < k.min_science * (1 + THIN)) { data.state = "warn"; data.word = "THIN"; }
      else { data.state = "ok"; data.word = "MET"; }
    }

    // COST: what it costs against the cash. The cost counts the cheapest rocket that lifts it until one is chosen.
    var cash = info.cash_musd, rocketCost = f && isNum(f.cost_musd), cost = rocketCost ? f.cost_musd : totals.cost_musd;
    var costG = { key: "vg-cost", name: "COST", fill: share(cost, cash), tick: null, state: "", word: "",
      text: money(cost) + " / " + money(cash),
      note: !rocketCost && !d.launcher ? "+ a rocket" : f && f.launch_estimated ? "cheapest rocket" : "" };
    if (built) {
      if (blocked.indexOf("budget") !== -1 || !hard && cost > cash) { costG.state = "bad"; costG.word = "OVER"; }
      else if (!hard && cost > cash * (1 - THIN)) { costG.state = "warn"; costG.word = "THIN"; }
      else if (!hard) { costG.state = "ok"; costG.word = "OK"; }
    }

    // TIME: the months this flight takes (build and launch) against the months left before the lenders' deadline.
    var months = typeof flightMonths === "function" ? flightMonths(d) : null, left = info.months_left;
    var timeG = { key: "vg-time", name: "TIME", fill: share(months, left), tick: null, state: "", word: "",
      text: num(months, 0) + " / " + num(left, 0) + " months" };
    if (built && isNum(months)) {
      if (warned.indexOf("deadline") !== -1 || !hard && months >= left) { timeG.state = "bad"; timeG.word = "LATE"; }
      else if (!hard && months > left * (1 - THIN)) { timeG.state = "warn"; timeG.word = "TIGHT"; }
      else if (!hard) { timeG.state = "ok"; timeG.word = "OK"; }
    }

    // The pay line, merged: PROFIT (not on Hard) and the contract's terms in one short line.
    var pay;
    if (nothingNew) pay = "Nothing new is left to collect on this topic: the client pays nothing.";
    else if (hard) pay = "Pays up to " + money(k.price_musd) + " for " + num(k.min_science, 0) + " points · 3 stars +" + money(k.bonus_musd);
    else pay = "Pays " + money(p.expected_payout_musd) + (k.met ? "" : " of " + money(k.price_musd)) + " · 3 stars +" + money(k.bonus_musd);
    return { gauges: [data, costG, timeG], hard: hard, profit: hard ? null : f && isNum(f.profit_musd) ? f.profit_musd : null, pay: pay };
  }

  var STATE_ICON = { bad: "blocker", warn: "warning", ok: "ok" };
  function gauge(g) {
    var mark = STATE_ICON[g.state] ? UI.icon(STATE_ICON[g.state]) : null;
    return el("div", { class: "vgauge" + (g.state ? " " + g.state : ""), "data-key": g.key, "data-state": g.state || "plain" }, [
      el("div", { class: "vg-top" }, [el("span", { class: "vg-name", text: g.name }),
        g.word ? el("span", { class: "vg-word" }, [mark, g.word]) : null]),
      el("div", { class: "vg-track", role: "presentation" }, [
        g.fill !== null ? el("span", { class: "vg-fill", style: "width: " + Math.round(g.fill * 1000) / 10 + "%" }) : null,
        g.tick !== null ? el("span", { class: "vg-tick", style: "left: " + Math.round(g.tick * 1000) / 10 + "%" }) : null]),
      el("div", { class: "vg-num" }, [el("span", { text: g.text }), g.note ? el("span", { class: "vg-note", text: g.note }) : null])
    ]);
  }

  // Called by drawBuild on every draw: the strip goes into the empty slot under the satellite.
  UI.fillVerdict = function (slot, d) {
    while (slot.firstChild) slot.removeChild(slot.firstChild);
    var f = facts(d);
    if (!f) return;
    slot.appendChild(el("div", { class: "vstrip", role: "group", "aria-label": "Does this design meet the contract?" }, [
      el("div", { class: "vgauges" }, f.gauges.map(gauge)),
      el("div", { class: "vstrip-pay", "data-key": "contract-pay" }, [
        f.profit !== null ? UI.profitLine(f.profit) : null,
        el("p", { class: "nasa-line payout-line", text: f.pay })])
    ]));
  };
})();
