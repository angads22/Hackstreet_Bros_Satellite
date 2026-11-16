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

  var PAY_SHARES = [0.25, 0.5, 0.75];   // PAY BACK buttons: these shares of the most that is safe to pay, rounded down
  var COMEBACK = { comeback: true };    // stands in for a design when the story is asked for Ajay's lines
  var hub = { note: "", bad: false, fresh: false, debtFrom: null, whyOpen: false };   // the last payment's message, and the meter before it (whyOpen: the credit WHY list, credit 2.1)

  function L0() { return window.StarlineLedger || null; }
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
        el("span", { class: "cb-tag", text: months(k.months_left) + " LEFT" }),
        opts.bestPay ? el("span", { class: "cb-best", "data-key": "best-pay", text: "BEST PAY" }) : null   // Easy only (getContractOrder)
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

  // What the level makes the player pay for (CAMPAIGN.comeback.info_free, "Paying engineers for part information").
  function infoText(id) {
    var cfg = config(), free = cfg && cfg.info_free ? cfg.info_free[id] : null;
    if (!free || free.length >= 3) return "Free";
    return free.length ? free[0].charAt(0).toUpperCase() + free[0].slice(1) + " free, rest paid" : "All paid";
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
          ["Help", helpText(row)], ["Part facts", infoText(id)]])
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
    if (window.StarlineLedger) window.StarlineLedger.reset();   // a new run: no tile flashes for the old run's numbers
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
    hub.where = "pay";
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
      hub.note && hub.where !== "borrow" ? el("p", { class: "cb-note" + (hub.bad ? " bad" : " good"), id: "pay-note", tabindex: "-1", role: hub.bad ? "alert" : "status", text: hub.note }) : null
    ]);
  }

  // ---- loans, credit and a name (SPEC.md, "Loans, credit and a name"). Every number comes from getComeback / borrow.
  var BORROW_SHARES = [0.25, 0.5, 1];   // BORROW buttons: these shares of the most the lenders will lend now, rounded down

  function borrowAmounts(c) {
    var max = c.max_borrow_musd || 0, out = [], step = max >= 4 ? 1 : 0.1;
    BORROW_SHARES.forEach(function (sh) {
      var v = Math.floor(max * sh / step + 1e-9) * step;
      v = Math.round(v * 10) / 10;
      if (v > 0 && out.indexOf(v) === -1) out.push(v);
    });
    return out;
  }

  function takeLoan(amount) {
    var r = typeof borrow === "function" ? borrow(amount) : { ok: false, reason: "Borrowing is not available." };
    var after = info();   // credit 2.1: the score and band the loan left, read from the back end
    hub.note = r && r.ok ? "Borrowed " + money(r.borrowed_musd) + " (fee " + money(r.fee_musd) + " added to the debt). Debt now " + money(r.debt_musd) +
      ". Score now " + num(r.credit_score, 0) + (after && after.credit_band ? " " + after.credit_band : "") + "." : (r && r.reason) || "That loan did not go through.";
    hub.bad = !(r && r.ok);
    hub.fresh = true;
    hub.where = "borrow";
    var c = info();
    if (c && c.finished) { showComebackEnding(); return; }
    var y = window.scrollY;
    showComebackHub();
    window.scrollTo(0, y);
    var msg = document.getElementById("borrow-note");
    if (msg) msg.focus();
  }

  // A plain bar from 0 to 100 (or to `top`), with an optional line (the seize line) and a label for screen readers.
  function bar(value, top, line, label, cls) {
    var share = function (v) { return Math.max(0, Math.min(1, v / (top || 1))) * 100 + "%"; };
    return el("div", { class: "cb-bar " + (cls || ""), role: "img", "aria-label": label }, [
      el("div", { class: "cb-bar-fill", style: "width: " + share(value) }),
      line != null ? el("div", { class: "cb-bar-line", style: "left: " + share(line) }) : null
    ]);
  }

  // credit 2.1: CREDIT 712 GOOD. The score and the band name (colour: POOR bad, FAIR warn, the rest good), the bar from 300 to 850 with
  // the seize line, and the five factors folded under WHY. Every number is from getComeback(): nothing here works one out.
  function creditTone(c) { return c.credit_band_id === "poor" ? "bad" : c.credit_band_id === "fair" ? "warn" : "good"; }
  function creditFactorRows(c) {
    return UI.list(c.credit_factors).map(function (f) {
      var share = Math.max(0, Math.min(1, f.value)) * 100;
      return el("li", { class: "cb-factor", "data-key": "factor-" + f.id }, [
        el("span", { class: "cb-factor-name", text: f.name }),
        el("span", { class: "cb-factor-weight", text: num(f.weight * 100, 0) + "%" }),
        el("div", { class: "cb-factor-bar", role: "img", "aria-label": f.name + " " + num(f.value * 100, 0) + " of 100" }, [
          el("div", { class: "cb-factor-fill", style: "width: " + share + "%" })])
      ]);
    });
  }
  function creditStat(c) {
    var range = config() && config().score;   // the score runs from min to max (data/campaign.js)
    if (typeof c.credit_score !== "number" || !range) return null;
    var tone = creditTone(c), danger = c.credit_band_id === "poor";
    var why = el("details", { class: "cb-why", "data-key": "credit-why" }, [
      el("summary", { text: "WHY" }),
      el("ul", { class: "cb-factors" }, creditFactorRows(c))
    ]);
    why.open = !!hub.whyOpen;
    why.addEventListener("toggle", function () { hub.whyOpen = why.open; });
    return el("div", { class: "cb-stat cb-credit tone-" + tone + (danger ? " warn" : ""), "data-key": "stat-credit" }, [
      el("span", { class: "cb-stat-label", text: "CREDIT" }),
      el("div", { class: "cb-credit-row" }, [
        el("strong", { class: "cb-stat-value", id: "cb-credit", text: num(c.credit_score, 0) }),
        el("span", { class: "cb-band " + tone, id: "cb-band", text: c.credit_band })
      ]),
      bar(c.credit_score - range.min, range.max - range.min, c.seize_score - range.min, "Credit score " + num(c.credit_score, 0) + " of " + num(range.max, 0) + ", " + c.credit_band + "; the lenders take everything at " + num(c.seize_score, 0), "credit"),
      el("span", { class: "cb-note", role: danger ? "alert" : null,
        text: danger ? "THE LENDERS TAKE EVERYTHING AT " + num(c.seize_score, 0) : "BELOW " + num(c.seize_score, 0) + " THEY TAKE EVERYTHING" }),
      why
    ]);
  }

  function nameStat(c) {
    if (typeof c.reputation !== "number" || !(c.reputation_goal > 0)) return null;
    return el("div", { class: "cb-stat cb-name", "data-key": "stat-name" }, [
      el("span", { class: "cb-stat-label", text: "YOUR NAME" }),
      el("strong", { class: "cb-stat-value cash", id: "cb-name", text: num(c.reputation, 0) + " / " + num(c.reputation_goal, 0) }),
      bar(c.reputation, c.reputation_goal, null, "Reputation " + num(c.reputation, 0) + " of " + num(c.reputation_goal, 0) + " needed to win", "name"),
      el("span", { class: "cb-note", text: c.debt_musd <= 0 && c.reputation < c.reputation_goal ? "DEBT PAID. NOW MAKE A NAME: FLY WELL." : "STARS MAKE A NAME. PAY THE DEBT AND REACH IT TO WIN" })
    ]);
  }

  function borrowPanel(c) {
    if (typeof c.max_borrow_musd !== "number") return null;
    var amounts = borrowAmounts(c);
    var buttons = amounts.map(function (v) {
      return UI.button(money(v), function () { takeLoan(v); }, { key: "borrow-" + v, aria: "Borrow " + money(v) });
    });
    var fee = Math.round((c.loan_fee || 0) * 100);
    return el("div", { class: "panel cb-pay cb-borrow", "data-key": "borrow-panel" }, [
      el("h2", { text: "BORROW" }),
      el("p", { class: "cb-note", "data-key": "credit-limit", text: amounts.length   // credit 2.1: the band's limit
        ? c.credit_band + " lends up to " + money(c.max_borrow_musd) + ". A " + fee + "% fee goes on the debt, and a loan lowers your score."
        : c.credit_band_id === "poor" ? c.credit_band + ": the lenders lend nothing." : c.credit_band + ": the lenders will lend no more." }),
      buttons.length ? el("div", { class: "cb-pay-row" }, buttons) : null,
      hub.note && hub.where === "borrow" ? el("p", { class: "cb-note" + (hub.bad ? " bad" : " good"), id: "borrow-note", tabindex: "-1", role: hub.bad ? "alert" : "status", text: hub.note }) : null
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

  // What struck since the last flight (back end: getComeback().complications): one line each, a colour tag first.
  var COMPLICATION_WORDS = { "client-left": "CLIENT GONE", "price-up": "PRICE UP", "price-down": "PRICE DOWN", delay: "DELAY" };
  function complicationLines(c) {
    return UI.list(c.complications).filter(function (e) { return e.flight === c.flights; }).map(function (e) {
      var kind = e.tag === "good" || e.tag === "bad" ? e.tag : "warn";
      return el("p", { class: "cb-complication", "data-key": "complication-" + e.id }, [
        el("span", { class: "tag " + kind, text: COMPLICATION_WORDS[e.id] || "NEWS" }), " " + e.text]);
    });
  }

  function showComebackHub() {
    var c = info();
    if (!c) { showPicker(); return; }
    if (c.finished) { showComebackEnding(); return; }
    if (typeof window.nextInterlude === "function" && window.nextInterlude()) { window.showInterlude(showComebackHub); return; }   // js/ui-story.js
    UI.leaveMission();
    UI.setStatus(title());
    var borrowedNow = hub.fresh && hub.where === "borrow" && !hub.bad;   // the line after a loan
    if (!hub.fresh) { hub.note = ""; hub.debtFrom = null; }
    hub.fresh = false;
    var led = L0() ? L0().facts() : null;
    var late = !!(led && led.deadline_near);
    var tooLate = noFlightInTime(c);
    var last = UI.list(c.missions)[UI.list(c.missions).length - 1];
    var from = hub.debtFrom; hub.debtFrom = null;

    // UI REVIEW (2.1, ledger-strip, interest-tick, deadline-cue): the three tiles are the ledger strip (js/ui-ledger.js); the debt
    // meter and the "no flight" note ride inside their tiles. The cash, debt and months come from getLedger().
    var L = L0();
    var lateNote = tooLate ? el("span", { class: "cb-note", role: "alert", text: "No flight can land before the deadline." })
      : late ? el("span", { class: "cb-note", text: (line("hub", "late") || {}).text || "" }) : null;
    var stakes = L.strip({ ids: true, warn: tooLate,
      debtExtra: [meter({ debt: c.debt_musd, cash: c.cash_musd, start: c.start_debt_musd }, from,
        "Debt " + money(c.debt_musd) + " of " + money(c.start_debt_musd) + " at the start; cash " + money(c.cash_musd)),
        c.debt_paid_musd > 0 ? el("span", { class: "cb-note" }, "PAID BACK " + money(c.debt_paid_musd)) : null],
      monthsExtra: [lateNote] });

    var lowCredit = c.credit_band_id === "poor";   // credit 2.1: POOR is the warning
    var needName = typeof c.reputation === "number" && c.debt_musd <= 0 && c.reputation < c.reputation_goal;
    var situation = lowCredit ? line("hub", "credit") : needName ? line("hub", "name") : borrowedNow ? line("hub", "loaned")
      : !c.flights ? line("hub", "start") : c.debt_musd < c.start_debt_musd / 2 ? line("hub", "halfway")
      : last && last.payout_musd > 0 ? line("hub", "paid") : null;
    // UI REVIEW (2.1, contract-sort-best-pay): the back end orders the offers (Easy and Normal by net; Hard as they came)
    // and names the best pay on Easy only.
    var order = typeof getContractOrder === "function" ? getContractOrder() : null;
    var offers = UI.list(c.contracts).slice();
    if (order) offers.sort(function (a, b) { return order.ids.indexOf(a.id) - order.ids.indexOf(b.id); });
    var jobs = offers.map(function (k) {
      return contractCard(k, { bestPay: !!order && order.best_id === k.id, onFly: function () {
        var d = typeof newComebackDesign === "function" ? newComebackDesign(k.id) : null;
        hub.note = "";
        if (d) window.showDesignScreen("map", d); else showComebackHub();
      } });
    });

    UI.mount("comeback", el("section", { class: "screen cb" }, [
      el("div", { class: "screen-head" }, [el("span", { class: "kicker", text: "PART 2 · " + levelName(c.tier) }), el("h1", { text: "THE WORKSHOP" })]),
      stakes,
      typeof c.credit_score === "number" ? el("div", { class: "cb-stakes cb-stakes-2" }, [creditStat(c), nameStat(c)]) : null,
      say(line("why", c.flights)),
      el("div", { class: "panel cb-board" }, [
        el("h2", { text: "CONTRACTS" }),
        situation && situation.text ? el("p", { class: "cb-note", text: situation.text }) : null,
        el("div", { class: "cb-complications" }, complicationLines(c)),
        jobs.length ? el("div", { class: "cb-jobs" }, jobs) : el("p", { class: "cb-note", text: "No contracts are open." })
      ]),
      payPanel(c),
      borrowPanel(c),
      flightLog(c),
      el("div", { class: "nav-row" }, [
        UI.button(["< ", "HOME"], function () { UI.home(); }, { key: "hub-home" }),
        window.StarlineStory && window.StarlineStory.journalButton ? window.StarlineStory.journalButton({ part: 2, back: showComebackHub, key: "hub-journal" }) : null,   // js/ui-story.js
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
    var kind = e.won ? "won" : (e.lost_reason === "cash" || e.lost_reason === "seized" || e.lost_reason === "name") ? e.lost_reason : "deadline";
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
        el("p", { class: "cb-stamp " + (e.won ? "pass" : "fail"), text: e.won ? "PAID OFF" : e.lost_reason === "name" ? "NO NAME" : "KEYS TAKEN" }),
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
