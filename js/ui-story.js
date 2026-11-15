// js/ui-story.js — the story's front end: Part 2's interlude scenes (nextInterlude, showInterlude), the SELL / REFUSE
// choice, the seven endings screen (showComebackEnding, and Part 1's box ending), the found-endings counter and
// PLAY AGAIN. Every word comes from the STORY block in js/ui-design.js (read through StarlineUI.story()): a missing key
// shows nothing and never throws. Every amount, month and count comes from the back end (getComeback,
// getComebackEnding, acceptBuyout, refuseBuyout). This file only draws, with the helpers of js/ui-design.js.
//
// Shared names: window.nextInterlude(opts), window.showInterlude(done, opts), window.showComebackEnding(), and
// window.StarlineStory { counter, forget, showEnding, showBox, found, ids }.
// Saved on this device: gravitron-endings-v1 (the ending ids found, a list) and gravitron-seen-v1 ({ seed: [interlude ids] }).
(function () {
  "use strict";

  var UI = window.StarlineUI;
  if (!UI) return;   // ui-design.js failed to load; nothing to draw with
  var el = UI.el, money = UI.money, num = UI.num;

  var ENDINGS_KEY = "gravitron-endings-v1";
  var SEEN_KEY = "gravitron-seen-v1";
  var KEEP_SEEDS = 12;            // the seen record keeps the newest runs only
  var IDS = ["box", "legend", "comeback", "close", "sold", "timeout", "broke"];
  // Shown until the story text supplies a title (and for the chips of endings it has no text for).
  var TITLES = { box: "THE BOX", legend: "HIS NAME, RESTORED", comeback: "BACK IN BUSINESS", close: "BY A HAIR",
                 sold: "SOLD OUT", timeout: "THE KEYS ARE TAKEN", broke: "NOTHING LEFT TO LAUNCH" };
  // Which scene and mood each ending gets: sombre endings are the quiet ones.
  var LOOK = { box: { scene: "pad", sombre: true }, legend: { scene: "title" }, comeback: { scene: "orbit" }, close: { scene: "pad" },
               sold: { scene: "earth", sombre: true }, timeout: { scene: "pad", sombre: true }, broke: { scene: "pad", sombre: true } };
  var STAMPS = { legend: ["PAID OFF", true], comeback: ["PAID OFF", true], close: ["PAID OFF", true], sold: ["SOLD", false],
                 timeout: ["KEYS TAKEN", false], broke: ["KEYS TAKEN", false] };
  // The old three kinds, kept as the class names the earlier ending used.
  var KINDS = { legend: "won", comeback: "won", close: "won", sold: "sold", timeout: "deadline", broke: "cash" };
  // Names for speakers the story text may not have named yet.
  var SPEAKER_NAMES = { rival: "IRON ECLIPSE", mum: "MUM", partner: "YOUR PARTNER" };
  var OFFER = { id: "offer", sell: "SELL", refuse: "REFUSE",
                beats: [{ who: "rival", text: "Iron Eclipse will clear the debt today. In return, the workshop." }] };

  // ---------------------------------------------------------------- the story text (read-only, never throws)
  function story() {
    try { return typeof UI.story === "function" ? UI.story() : null; } catch (e) { return null; }
  }
  function chapter(name) { var s = story(); return s && s[name] && typeof s[name] === "object" ? s[name] : null; }
  function isList(x) { return Object.prototype.toString.call(x) === "[object Array]"; }
  function speakerName(who) {
    var s = story();
    return s && s.speakers && s.speakers[who] ? s.speakers[who] : SPEAKER_NAMES[who] || "";
  }
  // A beat: a string, or { who, text }. Returns { who, text, name } or null.
  function beat(b, dflt) {
    if (typeof b === "string") b = { text: b };
    if (!b || typeof b.text !== "string" || !b.text) return null;
    var who = b.who || dflt || "partner";
    return { who: who, text: b.text, name: b.name || speakerName(who) };
  }
  function beats(x, dflt) { return (isList(x) ? x : []).map(function (b) { return beat(b, dflt); }).filter(Boolean); }

  // ---------------------------------------------------------------- what is saved on this device (every access guarded)
  function readJSON(key) {
    try { var raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function writeJSON(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }
  function found() {
    var v = readJSON(ENDINGS_KEY), out = [];
    (isList(v) ? v : []).forEach(function (id) { if (IDS.indexOf(id) !== -1 && out.indexOf(id) === -1) out.push(id); });
    return out;
  }
  function record(id) {
    var list = found();
    if (IDS.indexOf(id) === -1) return { added: false, list: list };
    if (list.indexOf(id) !== -1) return { added: false, list: list };
    list.push(id);
    writeJSON(ENDINGS_KEY, list);
    return { added: true, list: list };
  }
  // The record is { "<seed>": [ids] }. A missing or broken record is empty; a run with no entry has not been seen by
  // this version (a comeback saved before the story existed, or one just begun: see backfill).
  function seenAll() { var v = readJSON(SEEN_KEY); return v && typeof v === "object" && !isList(v) ? v : {}; }
  function seedKey(seed) { return typeof seed === "number" && isFinite(seed) ? String(seed) : "legacy"; }
  function hasRecord(seed) { return isList(seenAll()[seedKey(seed)]); }
  function seenFor(seed) { var l = seenAll()[seedKey(seed)]; return isList(l) ? l : []; }
  function setSeen(seed, ids) {
    var all = seenAll(), key = seedKey(seed);
    delete all[key]; all[key] = ids;   // the newest run last
    var keys = Object.keys(all);
    while (keys.length > KEEP_SEEDS) delete all[keys.shift()];
    writeJSON(SEEN_KEY, all);
  }
  function markSeen(seed, id) {
    var l = seenFor(seed).slice();
    if (l.indexOf(id) === -1) l.push(id);
    setSeen(seed, l);
  }
  function forget() {
    try { window.localStorage.removeItem(ENDINGS_KEY); window.localStorage.removeItem(SEEN_KEY); } catch (e) { /* storage blocked */ }
  }

  // ---------------------------------------------------------------- the counter, on the home page and on every ending
  function counterText() { return "ENDINGS " + found().length + " / " + IDS.length; }
  function counter() {
    return el("p", { class: "story-count", "data-key": "endings-count", text: counterText() });
  }
  function endingTitle(id) {
    var t = endingText(id);
    return t && t.title ? String(t.title).toUpperCase() : TITLES[id];
  }
  // The seven endings as chips: the title once found, "???" before.
  function chips(current) {
    var have = found();
    return el("ul", { class: "story-chips", "aria-label": "The seven endings" }, IDS.map(function (id) {
      var yes = have.indexOf(id) !== -1;
      return el("li", { class: "story-chip " + (yes ? "found" : "unseen") + (id === current ? " now" : ""), "data-key": "ending-" + id,
        "aria-label": yes ? endingTitle(id) : "An ending you have not found yet" }, yes ? endingTitle(id) : "???");
    }));
  }

  // ---------------------------------------------------------------- the interludes
  function comeback() { try { return typeof getComeback === "function" ? getComeback() : null; } catch (e) { return null; } }
  function level(c) { return UI.levelName ? UI.levelName(c.tier) : String(c.tier || "").toUpperCase(); }
  function kicker(c) { return (UI.modes && UI.modes.part2 ? UI.modes.part2.kicker : "PART 2") + (c ? " · " + level(c) : ""); }
  // The share of the debt left (0 to 1): the back end's own, else worked out from the debt and the starting debt.
  function debtShare(c) {
    if (typeof c.debt_share_left === "number") return c.debt_share_left;
    return c.start_debt_musd > 0 && typeof c.debt_musd === "number" ? c.debt_musd / c.start_debt_musd : null;
  }
  function lines(id) {
    var a = chapter("ajay"), iv = a && a.interludes && isList(a.interludes[id]) ? a.interludes[id] : null;
    var out = beats(iv, "partner");
    if (!out.length && id === "start") out = beats(a && a.intro, "partner");   // the opening scene is the intro, when it has no scene of its own
    return out;
  }
  // The offer's beats and its two buttons' labels and hints. The story text hangs them on the offer's list itself
  // (interludes.offer.sell ...); the same names on interludes are read too.
  function offerParts() {
    var a = chapter("ajay"), iv = a && a.interludes ? a.interludes : {}, own = iv.offer || {};
    var pick = function (k, dflt) { return typeof own[k] === "string" ? own[k] : typeof iv[k] === "string" ? iv[k] : dflt; };
    var b = lines("offer");
    return { beats: b.length ? b : beats(OFFER.beats, "rival"), sell: pick("sell", OFFER.sell), refuse: pick("refuse", OFFER.refuse),
             sell_hint: pick("sell_hint", ""), refuse_hint: pick("refuse_hint", "") };
  }

  // The interlude due now, or null: { id, beats, buttons? }. Pure: it marks nothing (showInterlude does).
  // opts.fresh: a comeback has just begun: its record starts empty.
  function nextInterlude(opts) {
    try {
      var c = comeback();
      if (!c || c.finished) return null;
      var flights = c.flights || 0, share = debtShare(c);
      var moments = [
        ["start", flights === 0],
        ["after-1", flights >= 1],
        ["refused", c.buyout === "refused"],
        ["after-3", flights >= 3 || (c.tier === "training" && flights >= 2 && share !== null && share < 0.5)],
        ["final", flights >= 1 && share !== null && share < 0.25]
      ];
      // A run just begun starts with an empty record. A run this version has no record of (a comeback saved before the
      // story existed) must not replay a scene whose moment has already passed: every moment that is behind it is
      // marked seen, and only what is due from now on is shown.
      if (opts && opts.fresh) setSeen(c.seed, []);
      else if (!hasRecord(c.seed)) {
        var behind = ["start"];   // the old opening scene was shown when the run began
        moments.forEach(function (m) { if (m[1] && behind.indexOf(m[0]) === -1) behind.push(m[0]); });
        if (c.buyout === "refused" || c.buyout === "accepted") behind.push("offer");
        setSeen(c.seed, behind);
      }
      var seen = seenFor(c.seed);
      // An open offer must be answered (the back end blocks every new design until it is), so it is due until it is.
      if (c.buyout === "offered" || c.offer) {
        var o = offerParts();
        return { id: "offer", beats: o.beats, buttons: [{ id: "refuse", label: o.refuse, hint: o.refuse_hint }, { id: "sell", label: o.sell, hint: o.sell_hint }] };
      }
      for (var i = 0; i < moments.length; i++) {
        if (!moments[i][1] || seen.indexOf(moments[i][0]) !== -1) continue;
        var b = lines(moments[i][0]);
        if (b.length) return { id: moments[i][0], beats: b };   // no text for it: nothing to show, and nothing marked
      }
    } catch (e) { /* the story must never stop the game */ }
    return null;
  }

  function showInterlude(done, opts) {
    var after = typeof done === "function" ? done : function () { if (typeof window.showComebackHub === "function") window.showComebackHub(); };
    var iv = nextInterlude(opts), c = comeback();
    if (!iv || !c) { after(); return; }
    markSeen(c.seed, iv.id);
    var tag = kicker(c);
    if (iv.buttons) UI.showBeats(iv.beats, tag, function () { showChoice(iv, c, after); }, { doneLabel: "THE OFFER" });
    else UI.showBeats(iv.beats, tag, after, { doneLabel: iv.id === "start" ? "TO THE WORKSHOP" : "CONTINUE" });
  }

  // The offer: the rival's last line again, the stakes beside it (from the back end), and the two answers.
  function showChoice(iv, c, after) {
    var note = el("p", { class: "cb-note bad", role: "alert", hidden: true });
    var answer = function (which) {
      var fn = which === "sell" ? (typeof acceptBuyout === "function" ? acceptBuyout : null) : (typeof refuseBuyout === "function" ? refuseBuyout : null);
      var r = fn ? fn() : { ok: false, reason: "That answer is not available." };
      if (r && r.ok) { if (which === "sell") showEnding(); else after(); return; }
      note.textContent = (r && r.reason) || "That did not go through.";
      note.hidden = false;
      var now = comeback();
      if (!now || now.buyout !== "offered") window.setTimeout(after, 1200);   // the offer is gone: carry on
    };
    var choice = function (which, row) {
      return UI.button([el("span", { class: "story-choice-label", text: String(row.label).toUpperCase() }),
        row.hint ? el("span", { class: "story-choice-hint", text: row.hint }) : null],
        function () { answer(which); },
        { primary: which === "refuse", key: "offer-" + which, aria: row.label + (row.hint ? ": " + row.hint : "") });
    };
    var parts = { refuse: iv.buttons[0], sell: iv.buttons[1] };
    var last = iv.beats[iv.beats.length - 1];
    UI.mount("interlude-choice", el("section", { class: "screen intro story-offer" }, [
      el("div", { class: "kicker", text: kicker(c) + " · THE OFFER" }),
      el("div", { class: "intro-beats", "aria-live": "polite" }, [last ? UI.sayEl(last) : null]),
      UI.facts([["DEBT", money(c.debt_musd)], ["MONTHS LEFT", num(c.months_left, 0)]]),
      el("div", { class: "story-choices" }, [choice("refuse", parts.refuse), choice("sell", parts.sell)]),
      note
    ]));
    var primary = document.querySelector(".story-offer .btn.primary");
    if (primary) primary.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------- the endings
  // { title, kicker, beats, line } from the story text for an ending id, or null.
  function endingText(id) {
    var ch = chapter(id === "box" ? "austin" : "ajay");
    var t = ch && ch.endings && typeof ch.endings === "object" ? ch.endings[id] : null;
    if (!t || typeof t !== "object") return null;
    return { title: typeof t.title === "string" ? t.title : "", kicker: typeof t.kicker === "string" ? t.kicker : "",
             beats: beats(t.beats, id === "box" ? "notebook" : "partner"), line: typeof t.line === "string" ? t.line : "" };
  }

  // The scene for an ending (the low-poly art the old ending used): a sombre pad, a lone Earth, or the satellite.
  function scene(id) {
    var look = LOOK[id] || {};
    return UI.lpCanvas ? UI.lpCanvas(function (L) {
      if (look.scene === "title") return typeof L.scenes.title === "function" ? L.scenes.title({}) : null;
      if (look.scene === "earth") return typeof L.scenes.earth === "function" ? L.scenes.earth({ spin: 2 }) : null;
      if (look.scene === "orbit") return typeof L.scenes.earth === "function" ? L.scenes.earth({ orbitId: "leo", spin: 5 }) : null;
      var rows = UI.data("LAUNCHERS");
      var row = UI.byId(rows, "vanguard-rocket") || rows[0];
      return row && typeof L.scenes.pad === "function" ? L.scenes.pad({ launcherId: row.id, launcher: row, ready: id === "close" }) : null;
    }, "cb-scene story-scene" + (look.sombre ? " sombre" : "")) : null;
  }

  // The ending screen. spec: { id, kind, head: [kicker, h1], stamp: [text, pass] | null, text, headline, stats, extra, buttons }.
  // The counter and the two buttons sit in a bar pinned to the foot of the window, so they are always in view.
  function drawEnding(spec) {
    var id = spec.id, t = spec.text, add = record(id), look = LOOK[id] || {};
    var art = scene(id);
    var title = t && t.title ? String(t.title).toUpperCase() : TITLES[id];
    var bs = t ? t.beats : [];
    var prev = "";
    var beatEls = bs.map(function (b, i) {
      var label = b.who !== prev && b.name ? el("span", { class: "story-beat-who", text: String(b.name).toUpperCase() }) : null;
      prev = b.who;
      return el("p", { class: "story-beat", style: "--i:" + i }, [label, b.text]);
    });
    var body = el("div", { class: "cb-end-body" }, [
      spec.stamp ? el("p", { class: "cb-stamp " + (spec.stamp[1] ? "pass" : "fail"), text: spec.stamp[0] }) : null,
      el("h2", { class: "cb-end-title", "data-key": "ending-title" }, [title, add.added ? el("span", { class: "tag warn story-new", text: "NEW" }) : null]),
      t && t.kicker ? el("p", { class: "cb-end-kicker", text: t.kicker }) : null,
      beatEls.length ? el("div", { class: "story-beats", role: "group", "aria-label": "How it ended" }, beatEls) : null,
      t && t.line ? el("p", { class: "cb-end-line", "data-key": "ending-line", style: "--i:" + beatEls.length, text: t.line }) : null
    ]);
    var panel = el("div", { class: "panel cb-end story-end " + (spec.kind || "") + " end-" + id + (look.sombre ? " sombre" : " bright") + (art ? " has-scene" : "") }, [
      el("div", { class: "cb-end-grid" }, [
        art ? el("div", { class: "cb-end-art" }, [art.canvas]) : null,
        body,
        el("div", { class: "cb-end-side" }, [chips(id)])
      ]),
      spec.headline ? el("h3", { class: "cb-headline", text: spec.headline }) : null,
      spec.stats || null
    ]);
    var bar = el("div", { class: "cb-end-bar", "data-key": "ending-bar" }, [counter()].concat([el("div", { class: "cb-end-buttons" }, spec.buttons)]));
    UI.mount("comeback-end", el("section", { class: "screen cb cb-ending" }, [
      el("div", { class: "screen-head" }, [el("span", { class: "kicker", text: spec.head[0] }), el("h1", { text: spec.head[1] })]),
      panel,
      spec.extra || null,
      bar
    ]));
    var go = document.querySelector(".cb-end-bar .btn.primary");
    if (go) go.focus({ preventScroll: true });
  }

  // Part 2's ending: the story text for the back end's ending_id, with the back end's headline and totals beside it.
  function showEnding() {
    var e = typeof getComebackEnding === "function" ? getComebackEnding() : null;
    var C = window.StarlineComeback;
    if (!e) { if (C) C.showPicker(); return; }
    var id = e.ending_id || (e.won ? "comeback" : e.lost_reason === "cash" ? "broke" : e.lost_reason === "deadline" ? "timeout" : null);
    if (!id) { if (typeof window.showComebackHub === "function") window.showComebackHub(); return; }
    var c = comeback();
    UI.leaveMission();
    UI.setStatus(UI.modes && UI.modes.part2 ? UI.modes.part2.name : "AJAY'S COMEBACK");
    var t = endingText(id);
    if (!t || !t.beats.length) {   // no text for it yet: the older ending lines say it
      var old = UI.list(UI.storyLine ? UI.storyLine("ending", { comeback: true }, e.won ? "won" : e.lost_reason === "cash" ? "cash" : "deadline") : []);
      t = { title: t ? t.title : "", kicker: t ? t.kicker : "", beats: beats(old, "partner"), line: t ? t.line : "" };
    }
    var tot = e.totals || {};
    var stat = function (v, label) { return el("div", null, [el("strong", { text: v }), el("span", { text: label })]); };
    drawEnding({
      id: id, kind: KINDS[id], text: t, stamp: STAMPS[id], headline: e.headline,
      head: ["PART 2" + (c ? " · " + level(c) : ""), String(e.title).toUpperCase()],
      stats: el("div", { class: "chron-stats" }, [stat(num(tot.flights, 0), "FLIGHTS"), stat(money(tot.earned_musd), "EARNED"),
        stat(money(tot.paid_musd), "PAID BACK"), stat(money(tot.interest_musd), "INTEREST"), stat(num(tot.months, 0), "MONTHS")]),
      extra: el("div", { class: "stack" }, [
        e.epilogue ? el("p", { class: "chron-epilogue cb-epilogue", text: e.epilogue }) : null,
        UI.list(e.timeline).length ? el("details", { class: "more" }, [el("summary", { text: "How it went" }),
          el("ol", { class: "log cb-timeline" }, UI.list(e.timeline).map(function (x) { return el("li", null, "Month " + num(x.month, 0) + ": " + x.title); }))]) : null
      ]),
      buttons: [
        UI.button(["PLAY AGAIN", " >"], function () { if (C) C.showPicker(); }, { primary: true, key: "end-again", aria: "Play again: choose a difficulty" }),
        UI.button(["< ", "HOME"], function () { UI.home(); }, { key: "end-home" })
      ]
    });
  }

  // Part 1's ending, THE BOX, shown before the way on to Part 2 (onContinue).
  function showBox(onContinue) {
    var go = typeof onContinue === "function" ? onContinue : function () { UI.home(); };
    UI.leaveMission();
    var era1958 = function () { if (typeof UI.era === "function") UI.era("1958"); };   // THE BOX is Part 1's ending: the 1958 look
    era1958();
    drawEnding({
      id: "box", kind: "box", text: endingText("box"), stamp: null,
      head: [UI.modes && UI.modes.part1 ? UI.modes.part1.kicker : "PART 1", "PART 1 COMPLETE"],
      buttons: [
        UI.button(["CONTINUE TO PART 2", " >"], go, { primary: true, key: "end-continue" }),
        UI.button("PLAY AGAIN", function () { UI.startWalkStep(1); }, { key: "end-again", aria: "Play Part 1 again" }),
        UI.button(["< ", "HOME"], function () { UI.home(); }, { key: "end-home" })
      ]
    });
    era1958();   // mounting a screen sets the era from the design (none here), so set it again once the box is on the page
  }

  window.nextInterlude = nextInterlude;
  window.showInterlude = showInterlude;
  window.showComebackEnding = showEnding;
  window.StarlineStory = { counter: counter, forget: forget, showEnding: showEnding, showBox: showBox, found: found,
    ids: function () { return IDS.slice(); } };
})();
