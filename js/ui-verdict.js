// js/ui-verdict.js — the Build screen's verdict strip, ranked problem list and "what blocks the next button" line
// (docs/ui-review.md; SPEC.md, "UI review items built in 2.1"). Every number comes from the back end (previewPayout,
// previewScience, previewProfit, getTotals, flightMonths, getComeback, runChecks); this file only compares and draws.
// What each Help level may see (SPEC.md, "Difficulty: how much help"; Hard never gains a hidden aid):
//   Easy    the gauges, their verdict and their numbers        (assist "full")
//   Normal  the gauges and their verdict; numbers only to a screen reader   ("some")
//   Hard    the contract's terms and the design's amounts as facts: no verdict, no colour, no icon   ("minimal")
// The pure part (judge, gauges) never touches the page and is tested in tests/verdict.js.
(function () {
  "use strict";

  var CARD_LIMIT = 6;   // cards a bin shows before SHOW LATER PARTS (Part 2 and the duel; ui-design.js drawBuild)
  var THIN = 0.1;   // a margin under a tenth of the limit is "thin": the line the bars use too (barClass in ui-design.js)

  function isNum(v) { return typeof v === "number" && isFinite(v); }

  // ---- pure: one gauge's verdict. "none" until the design has a part; "bad" only when the flight cannot work.
  // DATA is a floor (the contract's points): nothing at all is "bad", short of the points is "thin".
  function judgeFloor(have, need, empty) {
    if (empty || !isNum(have) || !isNum(need)) return "none";
    if (!(have > 0)) return "bad";
    return have >= need ? "ok" : "thin";
  }
  // COST and TIME are ceilings. `strict` is the deadline: landing on it is already too late (runChecks' "deadline").
  function judgeCeiling(have, limit, strict, empty) {
    if (empty || !isNum(have) || !isNum(limit)) return "none";
    if (strict ? have >= limit : have > limit) return "bad";
    return limit - have < THIN * limit ? "thin" : "ok";
  }

  // The three gauges of a Part 2 design, or null (no comeback, no contract). `api` holds the back-end functions: window in
  // the page, the loaded game in the tests.
  function gauges(api, design) {
    if (!design || !design.comeback || typeof api.getComeback !== "function" || typeof api.previewPayout !== "function") return null;
    var info = api.getComeback(), pay = api.previewPayout(design), k = pay && pay.contract;
    if (!info || !k) return null;
    var empty = !(design.parts && design.parts.length);
    var sci = api.previewScience(design), prof = api.previewProfit ? api.previewProfit(design) : null, totals = api.getTotals(design);
    var cost = prof && isNum(prof.cost_musd) ? prof.cost_musd : totals.cost_musd;
    var months = api.flightMonths(design);
    var data = { id: "data", have: sci ? sci.total : 0, limit: k.min_science, state: judgeFloor(sci ? sci.total : 0, k.min_science, empty) };
    if (!empty && pay.topic_complete && !(pay.new_data > 0)) data.state = "bad";   // nothing new is left to collect: the contract pays nothing
    var money = { id: "cost", have: cost, limit: info.cash_musd, state: judgeCeiling(cost, info.cash_musd, false, empty) };
    var time = { id: "time", have: months, limit: info.months_left, state: judgeCeiling(months, info.months_left, true, empty) };
    [data, money, time].forEach(function (g) {
      g.fill = !isNum(g.have) || !(g.limit > 0) ? 0 : Math.max(0, Math.min(1, g.have / g.limit));
    });
    return [data, money, time];
  }

  // ---- pure: the blockers (and warnings) of a design, in the order the strip ranks them.
  function ranked(api, design, skip) {
    var checks = api.runChecks(design), out = [];
    (checks.blockers || []).forEach(function (c) { if (!skip || skip.indexOf(c.id) === -1) out.push({ c: c, kind: "bad" }); });
    (checks.warnings || []).forEach(function (c) { out.push({ c: c, kind: "warn" }); });
    return out;
  }

  // One action word (or two) for a blocker: what to do, never where (no FIX link) and never a number.
  var ACTION = {
    "mass": "LIGHTEN IT", "budget": "CUT COST", "power": "ADD POWER", "delta-v": "ADD THRUST", "body-count": "KEEP ONE BODY",
    "body-payload": "LIGHTEN OR GET A BIGGER BODY", "body-slots": "REMOVE A PART", "data": "ADD A RADIO", "battery": "ADD A BATTERY",
    "no-match": "SWAP THE INSTRUMENT", "orbit-fit": "CHANGE ORBIT", "too-late": "CHOOSE A QUICKER PART",
    "contract-topic": "CHANGE THE JOB", "contract-orbit": "CHANGE THE ORBIT", "deadline": "BUILD FASTER"
  };
  function action(id) {
    id = String(id || "");
    if (ACTION[id]) return ACTION[id];
    if (id.indexOf("empty-") === 0) return "ADD ONE";
    if (id.indexOf("resolution-") === 0) return "PICK A SHARPER ONE";
    if (id.indexOf("smear-") === 0) return "ADD POINTING";
    return "";
  }

  // ---- drawing (needs StarlineUI from js/ui-design.js, loaded first)
  var W = typeof window !== "undefined" ? window : null;
  var UI = W && W.StarlineUI;
  var reduced = function () { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); };
  var seen = {};   // gauge id -> { fill, state } of the last draw: a bar grows from it and a changed verdict flashes once

  var WORDS = {
    data: { ok: "ENOUGH", thin: "SHORT", bad: "NONE" },
    cost: { ok: "FITS", thin: "TIGHT", bad: "OVER CASH" },
    time: { ok: "IN TIME", thin: "TIGHT", bad: "TOO LATE" }
  };
  var NAMES = { data: "DATA", cost: "COST", time: "TIME" };
  var ICON_OF = { ok: "ok", thin: "warning", bad: "blocker" };

  // The numbers, as facts: the design's amount against the contract's term. Money and months from the back end's own values.
  function amounts(g) {
    var m = UI.money, n = UI.num;
    if (g.id === "data") return { have: n(g.have, 0), limit: n(g.limit, 0) + " PTS", head: "NEEDS" };
    if (g.id === "cost") return { have: m(g.have), limit: m(g.limit), head: "CASH" };
    return { have: n(g.have, 0) + " MO", limit: n(g.limit, 0) + " MO", head: "LEFT" };
  }

  function gauge(g, level) {
    var facts = level === "minimal", numbers = level !== "some";   // Easy and Hard show numbers; Normal keeps them for a screen reader
    var state = facts ? "fact" : g.state, a = amounts(g);
    var word = !facts && WORDS[g.id][g.state] ? WORDS[g.id][g.state] : "";
    var pct = Math.round(g.fill * 100);
    var prev = seen[g.id];
    var grow = prev && prev.fill !== pct && !reduced();
    var fill = UI.el("div", { class: "vg-fill", style: "width: " + (grow ? prev.fill : pct) + "%" });
    if (grow) window.requestAnimationFrame(function () { fill.style.width = pct + "%"; });
    var flash = !!prev && prev.state !== state && !facts;
    seen[g.id] = { fill: pct, state: state };
    var label = NAMES[g.id] + (word ? ": " + word : "") + ". Design " + a.have + ", " + a.head.toLowerCase() + " " + a.limit + ".";
    return UI.el("div", { class: "vgauge " + state + (flash ? " flash" : ""), "data-key": "vg-" + g.id, "data-state": state, role: "group", "aria-label": label }, [
      UI.el("div", { class: "vg-top" }, [
        UI.el("span", { class: "vg-name", text: NAMES[g.id] }),
        word ? UI.el("span", { class: "vg-state" }, [UI.icon(ICON_OF[g.state]), word]) : null
      ]),
      facts ? null : UI.el("div", { class: "vg-track", role: "presentation" }, [fill]),
      UI.el("div", { class: "vg-num" + (numbers ? "" : " sr-only") },
        facts ? [UI.el("span", { class: "vg-have", text: a.have }), " · " + a.head + " " + a.limit]
              : g.state === "none" ? "" : a.have + " / " + a.limit)
    ]);
  }

  // The strip under the satellite (Part 2 only). Null when there is no contract to compare with.
  function strip(design) {
    if (!UI) return null;
    var gs = gauges(window, design);
    if (!gs) return null;
    var level = UI.assist(design);
    return UI.el("div", { class: "vstrip assist-" + level, "data-key": "vstrip", role: "group", "aria-label": "This design against the contract" },
      gs.map(function (g) { return gauge(g, level); }));
  }

  // The PROBLEMS list on Build: blockers first and big, one line each (a cross, the label, an action word on Easy and Normal),
  // then the warnings smaller (a triangle). Nothing wrong: one line, "No problems".
  function problems(design, skip) {
    var rows = ranked(window, design, skip);
    if (!rows.length) return UI.el("p", { class: "preview-line fix no-problems", "data-key": "no-problems" }, [UI.icon("ok"), "No problems"]);
    var help = UI.assist(design) !== "minimal";   // an action word is a nudge: Hard keeps the plain label
    return UI.el("ul", { class: "checks ranked" }, rows.map(function (row) {
      var label = UI.checkLabel(row.c), act = help && row.kind === "bad" ? action(row.c.id) : "";
      return UI.el("li", { class: "check " + row.kind }, [
        UI.el("span", { class: "check-text" }, [
          UI.el("span", { class: "check-line" }, [UI.icon(row.kind === "bad" ? "blocker" : "warning", row.kind === "bad" ? "No go" : "Warning"),
            UI.el("strong", { text: label }), act ? UI.el("span", { class: "check-do", text: act }) : null]),
          label !== row.c.text ? UI.el("details", { class: "more why" }, [UI.el("summary", { text: "Why" }), UI.el("span", { text: row.c.text })]) : null])
      ]);
    }));
  }

  // The line beside the next button: how many NO GO are left. The button stays enabled; this only says why to stop.
  function nextWhy(design, skip) {
    if (!UI) return null;
    var n = ranked(window, design, skip).filter(function (r) { return r.kind === "bad"; }).length;
    if (!n) return null;
    return UI.el("span", { class: "next-why", "data-key": "next-why", role: "status" }, [UI.icon("blocker"), n + " NO GO to fix"]);
  }

  // ---- diegetic (stretch): on Easy and Normal the stage under the satellite carries the state; Hard sees none of it. Pure: what
  // is wrong, from the back end's own checks and totals. A panel with too little power glows red at its edge (the "power"
  // blocker); a part that causes a blocker gets a small cross (the parts that do not fit the body's slots); an antenna with no
  // downlink shows broken waves (instruments make data and none reaches the ground).
  function stateOf(api, design, parts) {
    var checks = api.runChecks(design), blockers = {};
    (checks.blockers || []).forEach(function (c) { blockers[c.id] = true; });
    var t = api.getTotals(design), body = t.body, used = {}, crossed = [];
    (design.parts || []).forEach(function (id) {
      var p = null;
      for (var i = 0; i < parts.length; i++) if (parts[i].id === id) p = parts[i];
      var slot = p && body && body.slots ? body.slots[p.category] : null;
      if (!p || !slot) return;
      used[p.category] = (used[p.category] || 0) + 1;
      if (blockers["body-slots"] && used[p.category] > slot.max) crossed.push({ id: p.id, name: p.name });
    });
    return { power: !!blockers.power, link: t.data_gb_day > 0 && !(t.data_returned_gb_day > 0), crossed: crossed };
  }

  function brokenWaves() {
    var NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg"), waves = document.createElementNS(NS, "path"), slash = document.createElementNS(NS, "path");
    svg.setAttribute("viewBox", "0 0 16 16"); svg.setAttribute("class", "icon"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
    waves.setAttribute("d", "M1.5 10.5q2.2-4.6 4.4 0M6.9 10.5q2.2-4.6 4.4 0M12.3 10.5q1.1-2.3 2.2 0"); waves.setAttribute("stroke-dasharray", "2 2");
    slash.setAttribute("d", "M2 2.5l12 11");
    svg.appendChild(waves); svg.appendChild(slash);
    return svg;
  }

  // Adds the state to the bench the Build screen just made: a class on the stage and small icon chips over its lower edge
  // (the words are in each chip's label; the PROBLEMS list says them in full).
  function mark(bench, design) {
    if (!UI || !bench || !design || UI.assist(design) === "minimal") return;   // Hard never gains an aid
    var st = stateOf(window, design, UI.data("PARTS")), stage = bench.querySelector(".sat-bench") || bench, chips = [];
    function chip(key, label, glyph) { return UI.el("span", { class: "sat-mark " + key.split("-")[1], "data-key": key, role: "img", "aria-label": label, title: label }, [glyph]); }
    if (st.power) { stage.classList.add("low-power"); chips.push(chip("mark-power", "Too little power", UI.icon("power"))); }
    if (st.link) chips.push(chip("mark-link", "No downlink: the data cannot get home", brokenWaves()));
    st.crossed.forEach(function (c) { chips.push(chip("mark-part", "No room on the body for " + c.name, UI.icon("blocker"))); });
    if (chips.length) stage.appendChild(UI.el("div", { class: "sat-marks" }, chips));
  }

  var api = { judgeFloor: judgeFloor, judgeCeiling: judgeCeiling, gauges: gauges, ranked: ranked, stateOf: stateOf, action: action, THIN: THIN, CARD_LIMIT: CARD_LIMIT };
  if (UI) { api.strip = strip; api.problems = problems; api.nextWhy = nextWhy; api.mark = mark; window.StarlineVerdict = api; }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
