// js/ui-comeback.js — Part 2, Ajay's comeback: the difficulty picker, the workshop (the hub, with the contracts
// and PAY BACK) and the ending. Every amount, month and count comes from the back end (getComeback, newComeback,
// newComebackDesign, payDebt, getComebackEnding) or from CAMPAIGN.comeback; every story line from the STORY block in
// js/ui-design.js. This file only draws, with the helpers of js/ui-design.js (StarlineUI).
// Shared names: showComebackStart() (the home page's Part 2 button and the end of Part 1), showComebackHub(),
// showComebackEnding(), and StarlineComeback (contractCard, meter) for the Briefing and the debrief.
(function () {
  "use strict";

  var UI = window.StarlineUI;
  if (!UI) return;   // ui-design.js failed to load; nothing to draw with
  var el = UI.el, num = UI.num, money = UI.money;

  var QUARTER = 0.25;             // the countdown turns to the accent colour with this share of the months left
  var PAY_SHARES = [0.25, 0.5, 0.75];   // PAY BACK buttons: these shares of the most that is safe to pay, rounded down
  var COMEBACK = { comeback: true };    // stands in for a design when the story is asked for Ajay's lines
  var hub = { note: "", bad: false, fresh: false, debtFrom: null };   // the last payment's message, and the meter before it

  function info() {
    try { return typeof getComeback === "function" ? getComeback() : null; } catch (e) { return null; }
  }
  function line(key, extra) { return UI.storyLine ? UI.storyLine(key, COMEBACK, extra) : ""; }
  function say(l) { return l && UI.sayEl ? UI.sayEl(l) : null; }
  function levelName(tierId) { return UI.levelName ? UI.levelName(tierId) : String(tierId).toUpperCase(); }
  function kicker() { return UI.modes && UI.modes.part2 ? UI.modes.part2.kicker : "PART 2"; }
  function title() { return UI.modes && UI.modes.part2 ? UI.modes.part2.name : "AJAY'S COMEBACK"; }
  function tierRow(id) { return UI.byId(UI.data("TIERS"), id); }
  function config() { return typeof CAMPAIGN !== "undefined" && CAMPAIGN && CAMPAIGN.comeback ? CAMPAIGN.comeback : null; }
  function months(n) { return num(n, 0) + (n === 1 ? " MONTH" : " MONTHS"); }

  // ---------------------------------------------------------------- the debt meter
  // The track is the starting debt (or the debt, if interest has pushed it higher). Red: the debt left. Teal, from
  // the left: the cash, so the player sees how much of the debt the cash could clear. With `from` values the fills
  // start there and move (a payment, a paid contract); under reduced motion the CSS makes the move instant.
  function meter(now, from, label) {
    var top = Math.max(now.start || 0, now.debt || 0, from ? from.debt || 0 : 0) || 1;
    var share = function (v) { return Math.max(0, Math.min(1, (v || 0) / top)) * 100 + "%"; };
    var debt = el("div", { class: "cb-meter-debt", style: "width: " + share(from ? from.debt : now.debt) });
    var cash = el("div", { class: "cb-meter-cash", style: "width: " + share(from ? from.cash : now.cash) });
    if (from) {
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        debt.style.width = share(now.debt); cash.style.width = share(now.cash);
      }); });
    }
    return el("div", { class: "cb-meter", role: "img", "aria-label": label }, [debt, cash]);
  }

  // ---------------------------------------------------------------- a contract card (the job board, and the Briefing)
  // opts.brief: on the Briefing (no button and no reason: the client says it above the card); opts.counts: which
  // instruments count, as the Briefing's topic card says it; opts.onFly: the FLY THIS button.
  function contractCard(k, opts) {
    opts = opts || {};
    var terms = [num(k.min_science, 0) + " POINTS OF DATA", k.orbit_name ? "FROM " + String(k.orbit_name).toUpperCase() : null]
      .filter(Boolean).join(" · ");
    return el("article", { class: "cb-job" + (opts.brief ? " brief" : ""), "data-key": "job-" + k.topic }, [
      el("div", { class: "cb-job-top" }, [
        el("h3", null, [UI.icon(k.topic), String(k.topic_name).toUpperCase()]),
        el("span", { class: "cb-tag", text: months(k.months_left) + " LEFT" })
      ]),
      opts.brief ? null : el("p", { class: "cb-client", text: k.client }),
      opts.brief ? null : el("p", { class: "cb-reason", text: k.reason }),
      el("div", { class: "cb-price" }, [el("strong", { text: money(k.price_musd) }),
        el("span", { text: "+" + money(k.bonus_musd) + " FOR ★★★" })]),
      el("p", { class: "cb-terms", text: "NEEDS " + terms }),
      opts.counts ? el("p", { class: "cb-terms", text: "COUNTS: " + opts.counts }) : null,
      opts.onFly ? UI.button(["FLY THIS", " >"], opts.onFly, { primary: true, key: "fly-" + k.topic, aria: "Fly this: " + k.topic_name + " for " + k.client }) : null
    ]);
  }

  // What the level takes away (UI.assist): the help before a problem; the facts stay on every level.
  function helpText(row) {
    var h = row && row.hints;
    return h === "off" ? "None: no forecasts, risks as bands" : h === "request" ? "Less: no part hints, no FIX links" : "Full";
  }

  // ---------------------------------------------------------------- the difficulty picker
  function showPicker() {
    UI.leaveMission();
    var cfg = config();
    var running = info();
    UI.setStatus(kicker());
    var cards = ["training", "standard", "expert"].map(function (id) {
      var t = cfg && cfg.tiers ? cfg.tiers[id] : null, row = tierRow(id);
      if (!t) return null;
      return el("button", { type: "button", class: "cb-level", "data-key": "level-" + id, onclick: function () { start(id); } }, [
        el("span", { class: "cb-level-name", text: levelName(id) }),
        el("span", { class: "cb-level-tier", text: row ? String(row.name).toUpperCase() : "" }),
        UI.facts([["Cash", money(t.cash_musd)], ["Debt", money(t.debt_musd)], ["Deadline", num(t.deadline_months, 0) + " months"],
          ["Help", helpText(row)]])
      ]);
    });
    UI.mount("comeback-start", el("section", { class: "screen cb" }, [
      el("div", { class: "screen-head" }, [el("span", { class: "kicker", text: kicker() }), el("h1", { text: title() })]),
      el("div", { class: "cb-levels" }, cards),
      el("div", { class: "nav-row" }, [
        UI.button(["< ", "HOME"], function () { UI.home(); }, { key: "picker-home" }),
        running && !running.finished ? UI.button("BACK TO THE WORKSHOP", showComebackHub, { key: "picker-workshop" }) : null
      ])
    ]));
  }

  function start(tierId) {
    var c = typeof newComeback === "function" ? newComeback(tierId) : null;
    if (!c) { showPicker(); return; }
    hub.note = ""; hub.debtFrom = null;
    if (typeof window.nextInterlude === "function" && window.nextInterlude({ fresh: true })) { window.showInterlude(showComebackHub); return; }   // js/ui-story.js
    UI.showBeats(line("intro"), kicker() + " · " + levelName(c.tier), showComebackHub, { doneLabel: "TO THE WORKSHOP" });
  }

  // The home page's Part 2 button and the end of Part 1: the workshop if a comeback is running, else the picker.
  function showComebackStart() {
    var c = info();
    if (c && !c.finished) showComebackHub(); else showPicker();
  }

  // ---------------------------------------------------------------- the workshop (the hub)
  // True only when even the quickest possible satellite (the quickest part of every required kind) would land on or
  // after the deadline: then no flight can. The back end's own deadline check decides, on that probe design.
  function noFlightInTime(c) {
    try {
      var k = UI.list(c.contracts)[0];
      if (!k || typeof newComebackDesign !== "function" || typeof runChecks !== "function" || typeof getCategories !== "function") return false;
      var d = newComebackDesign(k.id);
      if (!d) return false;
      var avail = typeof getAvailability === "function" ? getAvailability(d) : null;
      UI.list(getCategories()).filter(function (cat) { return cat.required; }).forEach(function (cat) {
        var best = null;
        UI.data("PARTS").forEach(function (p) {
          var a = avail && avail.parts ? avail.parts[p.id] : null;
          if (p.category !== cat.id || (a && a.available === false)) return;
          if (!best || (p.build_months || 0) < (best.build_months || 0)) best = p;
        });
        if (best) addPart(d, best.id);
      });
      return UI.list(runChecks(d).warnings).some(function (w) { return w.id === "deadline"; });
    } catch (e) { return false; }
  }

  // PAY BACK amounts: shares of the most that is safe to pay now, rounded down (whole millions from $4M, else tenths),
  // never the whole safe amount: that would leave only the cheapest launch, a satellite that earns almost nothing.
  function payAmounts(c) {
    var safe = c.safe_pay_max_musd || 0, out = [];
    var step = safe >= 4 ? 1 : 0.1;
    PAY_SHARES.forEach(function (s) {
      var v = Math.floor(safe * s / step + 1e-9) * step;
      v = Math.round(v * 10) / 10;
      if (v > 0 && v < safe && out.indexOf(v) === -1) out.push(v);
    });
    return out;
  }

  function pay(amount, c) {
    var r = typeof payDebt === "function" ? payDebt(amount) : { ok: false, reason: "Paying back is not available." };
    if (r && r.ok && r.won) { showComebackEnding(); return; }
    hub.debtFrom = r && r.ok ? { debt: c.debt_musd, cash: c.cash_musd, start: c.start_debt_musd } : null;
    hub.note = r && r.ok ? "Paid " + money(r.paid_musd) + ". Debt now " + money(r.debt_musd) + "." : (r && r.reason) || "That payment did not go through.";
    hub.bad = !(r && r.ok);
    hub.fresh = true;   // the message is shown on the next draw only
    var y = window.scrollY;
    showComebackHub();
    window.scrollTo(0, y);   // stay at PAY BACK: the message is next to the buttons
    var msg = document.getElementById("pay-note");
    if (msg) msg.focus();
  }

  function payPanel(c) {
    var all = c.cash_musd >= c.debt_musd && c.debt_musd > 0;
    var buttons = payAmounts(c).map(function (v) {
      return UI.button(money(v), function () { pay(v, c); }, { key: "pay-" + v, aria: "Pay back " + money(v) });
    });
    if (all) buttons.push(UI.button(["PAY ALL " + money(c.debt_musd), " >"], function () { pay(c.debt_musd, c); }, { primary: true, key: "pay-all" }));
    return el("div", { class: "panel cb-pay", "data-key": "pay-panel" }, [
      el("h2", { text: "PAY BACK" }),
      buttons.length ? el("div", { class: "cb-pay-row" }, buttons)
        : el("p", { class: "cb-note", text: "Keep the cash for the next launch." }),
      hub.note ? el("p", { class: "cb-note" + (hub.bad ? " bad" : " good"), id: "pay-note", tabindex: "-1", role: hub.bad ? "alert" : "status", text: hub.note }) : null
    ]);
  }

  function flightLog(c) {
    var objectives = UI.data("OBJECTIVES");
    var rows = UI.list(c.missions).slice(-4).reverse().map(function (m) {
      var o = UI.byId(objectives, m.objective);
      return el("li", { class: m.payout_musd > 0 ? "good" : "bad" }, [
        el("span", { text: "G-" + num(m.flight, 0) + " " + (o ? o.name : m.objective) }),
        el("span", { class: "cb-log-end", text: UI.starsText(m.stars) + " " + money(m.payout_musd) })
      ]);
    });
    return rows.length ? el("div", { class: "panel" }, [el("h2", { text: "FLIGHTS" }), el("ul", { class: "log cb-log" }, rows)]) : null;
  }

  function showComebackHub() {
    var c = info();
    if (!c) { showPicker(); return; }
    if (c.finished) { showComebackEnding(); return; }
    if (typeof window.nextInterlude === "function" && window.nextInterlude()) { window.showInterlude(showComebackHub); return; }   // js/ui-story.js
    UI.leaveMission();
    UI.setStatus(title());
    if (!hub.fresh) { hub.note = ""; hub.debtFrom = null; }
    hub.fresh = false;
    var late = c.months_left <= c.deadline_month * QUARTER;
    var tooLate = noFlightInTime(c);
    var last = UI.list(c.missions)[UI.list(c.missions).length - 1];
    var from = hub.debtFrom; hub.debtFrom = null;

    var stakes = el("div", { class: "cb-stakes" }, [
      el("div", { class: "cb-stat cb-debt", "data-key": "stat-debt" }, [
        el("span", { class: "cb-stat-label", text: "DEBT" }),
        el("strong", { class: "cb-stat-value", id: "cb-debt", text: money(c.debt_musd) }),
        meter({ debt: c.debt_musd, cash: c.cash_musd, start: c.start_debt_musd }, from,
          "Debt " + money(c.debt_musd) + " of " + money(c.start_debt_musd) + " at the start; cash " + money(c.cash_musd)),
        el("span", { class: "cb-note" }, "INTEREST " + num(c.interest_per_month * 100, 2) + "% A MONTH" +
          (c.debt_paid_musd > 0 ? " · PAID BACK " + money(c.debt_paid_musd) : ""))
      ]),
      el("div", { class: "cb-stat", "data-key": "stat-cash" }, [
        el("span", { class: "cb-stat-label", text: "CASH" }),
        el("strong", { class: "cb-stat-value cash", id: "cb-cash", text: money(c.cash_musd) })
      ]),
      el("div", { class: "cb-stat" + (late || tooLate ? " warn" : ""), "data-key": "stat-months" }, [
        el("span", { class: "cb-stat-label", text: "MONTHS LEFT" }),
        el("strong", { class: "cb-stat-value", id: "cb-months", text: num(c.months_left, 0) }),
        tooLate ? el("span", { class: "cb-note", role: "alert", text: "No flight can land before the deadline." })
          : late ? el("span", { class: "cb-note", text: (line("hub", "late") || {}).text || "" }) : null
      ])
    ]);

    var situation = !c.flights ? line("hub", "start") : c.debt_musd < c.start_debt_musd / 2 ? line("hub", "halfway")
      : last && last.payout_musd > 0 ? line("hub", "paid") : null;
    var jobs = UI.list(c.contracts).map(function (k) {
      return contractCard(k, { onFly: function () {
        var d = typeof newComebackDesign === "function" ? newComebackDesign(k.id) : null;
        hub.note = "";
        if (d) window.showDesignScreen("map", d); else showComebackHub();
      } });
    });

    UI.mount("comeback", el("section", { class: "screen cb" }, [
      el("div", { class: "screen-head" }, [el("span", { class: "kicker", text: "PART 2 · " + levelName(c.tier) }), el("h1", { text: "THE WORKSHOP" })]),
      stakes,
      say(line("why", c.flights)),
      el("div", { class: "panel cb-board" }, [
        el("h2", { text: "CONTRACTS" }),
        situation && situation.text ? el("p", { class: "cb-note", text: situation.text }) : null,
        jobs.length ? el("div", { class: "cb-jobs" }, jobs) : el("p", { class: "cb-note", text: "No contracts are open." })
      ]),
      payPanel(c),
      flightLog(c),
      el("div", { class: "nav-row" }, [
        UI.button(["< ", "HOME"], function () { UI.home(); }, { key: "hub-home" }),
        UI.button("NEW COMEBACK", function () {
          if (window.confirm("Start a new comeback? This one is lost.")) showPicker();
        }, { quiet: true, key: "hub-new" })
      ])
    ]));
  }

  // ---------------------------------------------------------------- the ending
  function showComebackEnding() {
    if (window.StarlineStory) { window.StarlineStory.showEnding(); return; }   // js/ui-story.js draws the seven endings
    var e = typeof getComebackEnding === "function" ? getComebackEnding() : null;
    if (!e) { showPicker(); return; }
    var c = info();
    UI.leaveMission();
    UI.setStatus(title());
    var kind = e.won ? "won" : e.lost_reason === "cash" ? "cash" : "deadline";
    var t = e.totals || {};
    var scene = e.won && UI.lpCanvas ? UI.lpCanvas(function (L) {
      return typeof L.scenes.title === "function" ? L.scenes.title({}) : null;
    }, "cb-scene") : null;
    var beats = UI.list(line("ending", kind)).map(say);
    var stat = function (v, label) { return el("div", null, [el("strong", { text: v }), el("span", { text: label })]); };
    UI.mount("comeback-end", el("section", { class: "screen cb" }, [
      el("div", { class: "screen-head" }, [el("span", { class: "kicker", text: "PART 2" + (c ? " · " + levelName(c.tier) : "") }),
        el("h1", { text: String(e.title).toUpperCase() })]),
      el("div", { class: "panel cb-end " + kind }, [
        scene ? scene.canvas : null,
        el("p", { class: "cb-stamp " + (e.won ? "pass" : "fail"), text: e.won ? "PAID OFF" : "KEYS TAKEN" }),
        el("h2", { class: "cb-headline", text: e.headline }),
        el("div", { class: "chron-stats" }, [
          stat(num(t.flights, 0), "FLIGHTS"), stat(money(t.earned_musd), "EARNED"),
          stat(money(t.paid_musd), "PAID BACK"), stat(money(t.interest_musd), "INTEREST"), stat(num(t.months, 0), "MONTHS")
        ])
      ]),
      el("div", { class: "stack" }, beats),
      e.epilogue ? el("p", { class: "chron-epilogue cb-epilogue", text: e.epilogue }) : null,
      UI.list(e.timeline).length ? el("details", { class: "more" }, [el("summary", { text: "How it went" }),
        el("ol", { class: "log cb-timeline" }, UI.list(e.timeline).map(function (x) {
          return el("li", null, "Month " + num(x.month, 0) + ": " + x.title);
        }))]) : null,
      el("div", { class: "nav-row" }, [
        UI.button(["< ", "HOME"], function () { UI.home(); }, { key: "end-home" }),
        UI.button(["TRY AGAIN", " >"], showPicker, { primary: true, key: "end-again" })
      ])
    ]));
  }

  window.showComebackStart = showComebackStart;
  window.showComebackHub = showComebackHub;
  window.showComebackEnding = showComebackEnding;
  window.StarlineComeback = { contractCard: contractCard, meter: meter, showPicker: showPicker };
})();
