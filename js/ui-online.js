// js/ui-online.js — QUICK MODE (SPEC.md, "Quick mode") and the online screens: LEADERBOARD and the quick 1v1 DUEL
// (SPEC.md, "Online features"). The home page has one QUICK MODE card; it opens the QUICK MODE menu: QUICK FLIGHT (solo,
// always on), 1V1 DUEL and LEADERBOARD. The last two exist only when LiveData.onlineStatus() says on (a public address
// and ONLINE.endpoint set); otherwise the menu shows them disabled with the reason, and nothing here sends anything. Every call goes through
// LiveData.online.* (js/live-data.js, the only file that fetches). A failed call says "Server not reachable" and never
// blocks play. Every number comes from the back end (getRunScore, getDuelSetup, getDebrief, the server's answers).
// Saved on this device: gravitron-player-v1 ({ id, nickname }): a random id and the nickname the player typed; and
// gravitron-quick-v1 ({ best }): the best QUICK SCORE (getQuickScore, js/mission.js).
// A duel flight is a standalone design marked design.duel (js/mission.js): it never touches the comeback save or the stars.
// A QUICK FLIGHT is the duel's standalone design (newDuelDesign) from a seed this device picks; the debrief tells it from a
// duel by the seed it remembers here (quick), so it never shows SEND RESULT and never reaches the stars or a comeback.
// Shared names: window.StarlineOnline { submitButton, showLeaderboard, showDuel, showQuickMenu, isQuick, forgetQuick }; StarlineUI.duelButtons.
(function () {
  "use strict";

  var UI = window.StarlineUI;
  if (!UI) return;   // ui-design.js failed to load; nothing to draw with
  var el = UI.el, num = UI.num, money = UI.money;

  function cfg() { return typeof ONLINE === "object" && ONLINE ? ONLINE : {}; }
  function status() {
    try { if (window.LiveData) return window.LiveData.onlineStatus(); } catch (e) { /* fall through */ }
    return { on: false, reason: "No server is set." };
  }
  function api() { return window.LiveData ? window.LiveData.online : null; }
  var FAIL = "Server not reachable";

  // ---------------------------------------------------------------- the player: a random id and a nickname
  var ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
  var memory = null;
  function randomId() {
    var s = "p";
    try {
      var a = new Uint8Array(12);
      window.crypto.getRandomValues(a);
      for (var i = 0; i < a.length; i++) s += ("0" + a[i].toString(16)).slice(-2);
      return s;
    } catch (e) {
      for (var j = 0; j < 24; j++) s += Math.floor(Math.random() * 16).toString(16);
      return s;
    }
  }
  function cleanName(v) {
    return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, cfg().nickname_max || 16).trim();
  }
  function player() {
    var key = cfg().player_key || "gravitron-player-v1", p = null;
    try {
      var raw = window.localStorage ? window.localStorage.getItem(key) : null;
      var o = raw ? JSON.parse(raw) : null;
      if (o && typeof o.id === "string" && ID_RE.test(o.id)) p = { id: o.id, nickname: cleanName(o.nickname) };
    } catch (e) { /* storage blocked or garbage */ }
    if (!p) p = memory && ID_RE.test(memory.id) ? memory : null;
    if (!p) { p = { id: randomId(), nickname: "" }; remember(p); }
    return p;
  }
  function remember(p) {
    memory = p;
    try { if (window.localStorage) window.localStorage.setItem(cfg().player_key || "gravitron-player-v1", JSON.stringify(p)); } catch (e) { /* memory copy still works */ }
  }
  // A nickname box that saves as the player types. get() is the cleaned name ("" when empty).
  function nameField() {
    var input = el("input", { type: "text", class: "online-input", maxlength: String(cfg().nickname_max || 16), placeholder: "NICKNAME",
      "aria-label": "Nickname", "data-key": "online-nick", autocomplete: "off", spellcheck: "false", value: player().nickname });
    input.addEventListener("input", function () { var p = player(); p.nickname = cleanName(input.value); remember(p); });
    return { node: input, get: function () { return cleanName(input.value); } };
  }

  // ---------------------------------------------------------------- shared bits
  var epoch = 0;   // a screen change ends every wait that belongs to the screen before it
  // opts.status: the header status (default "ONLINE"); opts.back: { label, go } for the button at the foot (default HOME).
  function open(screen, kicker, title, children, onHome, opts) {
    opts = opts || {};
    epoch++;
    UI.leaveMission();
    UI.era("today");
    UI.setStatus(opts.status || "ONLINE");
    var back = opts.back || { label: "HOME", go: onHome || function () { UI.home(); } };
    var node = el("section", { class: "screen online", "data-key": "online-" + screen }, [
      el("div", { class: "screen-head" }, [el("span", { class: "kicker", text: kicker }), el("h1", { text: title })])
    ].concat(children).concat([
      el("div", { class: "nav-row" }, [UI.button(["< ", back.label], back.go, { key: "online-home" })])
    ]));
    UI.mount("online-" + screen, node);
    return node;
  }
  function say(node, text, bad) { node.textContent = text || ""; node.className = "online-msg" + (bad ? " bad" : ""); }
  function offScreen(title) {
    var st = status();
    open("off", "ONLINE OFF", title, [el("p", { class: "online-msg", text: st.reason || "No server is set.", role: "status" })], null, { back: QUICK_BACK });
  }

  // ---------------------------------------------------------------- QUICK MODE: the menu, QUICK FLIGHT, the best score
  var QUICK_KEY = "gravitron-quick-v1";
  var QUICK_BACK = { label: "QUICK MENU", go: function () { showQuickMenu(); } };   // the foot button of the screens the menu opens
  var quick = null;       // { seed, job, result } for the quick flight in hand (job: the last topic and orbit, so the next one differs)
  var lastJob = "";
  var bestMemory = 0;

  // The best QUICK SCORE on this device: { best } in localStorage, guarded (a copy in memory when storage is blocked).
  function bestScore() {
    var best = bestMemory;
    try {
      var raw = window.localStorage ? window.localStorage.getItem(QUICK_KEY) : null;
      var o = raw ? JSON.parse(raw) : null;
      if (o && isFinite(o.best) && o.best > best) best = Math.round(o.best);
    } catch (e) { /* storage blocked or garbage: the memory copy */ }
    return best;
  }
  function keepBest(score) {
    bestMemory = Math.max(bestMemory, score);
    try { if (window.localStorage) window.localStorage.setItem(QUICK_KEY, JSON.stringify({ best: bestMemory })); } catch (e) { /* memory copy still works */ }
  }
  function forgetQuick() {
    bestMemory = 0; quick = null; lastJob = "";
    try { if (window.localStorage) window.localStorage.removeItem(QUICK_KEY); } catch (e) { /* nothing to clear */ }
  }
  // Is this design the quick flight in hand? (A duel's seed comes from the server; a quick flight's from this device.)
  function isQuick(design) { return !!(quick && design && design.duel && design.duel.seed === quick.seed); }

  // The card's state line on the home page.
  function quickState() { return status().on ? "ONLINE" : "ONLINE OFF"; }

  // The menu: QUICK FLIGHT always; 1V1 DUEL and LEADERBOARD when online is on, else disabled under the one-line reason.
  function showQuickMenu() {
    var st = status(), off = !st.on, best = bestScore();
    var children = [el("div", { class: "quick-menu", "data-key": "quick-menu" }, [
      UI.button(["QUICK FLIGHT", " >"], function () { startQuick(); }, { primary: true, key: "quick-flight" }),
      UI.button("1V1 DUEL", function () { showDuel(); }, { disabled: off, key: "online-duel" }),
      UI.button("LEADERBOARD", function () { showLeaderboard(); }, { disabled: off, key: "online-leaderboard" })
    ])];
    if (off) children.push(el("p", { class: "online-msg", "data-key": "online-reason", text: "ONLINE OFF · " + st.reason }));
    if (best > 0) children.push(el("p", { class: "online-you", "data-key": "quick-best-menu", text: "BEST " + num(best, 0) }));
    return open("quick-menu", "QUICK MODE", "PICK ONE", children, null, { status: "QUICK MODE" });
  }

  // A new seed each time, and a job (topic and orbit) other than the last one when the data has more than one.
  function pickSeed() {
    var seed = 1, tries = 0, job = "";
    do {
      seed = Math.floor(Math.random() * 1e9);
      var s = typeof getDuelSetup === "function" ? getDuelSetup(seed) : null;
      job = s ? s.objective + "/" + s.orbit : "";
      tries++;
    } while (job && job === lastJob && tries < 30);
    return { seed: seed, job: job };
  }
  function startQuick() {
    if (typeof getDuelSetup !== "function" || typeof newDuelDesign !== "function") { showQuickMenu(); return; }
    var pick = pickSeed(), setup = getDuelSetup(pick.seed);
    if (!setup) { showQuickMenu(); return; }
    duel = null;
    lastJob = pick.job;
    quick = { seed: pick.seed, result: null };
    var topic = UI.byId(UI.data("OBJECTIVES"), setup.objective), orbit = UI.byId(UI.data("ORBITS"), setup.orbit);
    open("quick-intro", "QUICK MODE", "YOUR FLIGHT", [
      el("div", { class: "panel online-room", "data-key": "quick-job" }, [
        UI.facts([["Topic", topic ? topic.name : setup.objective], ["Orbit", orbit ? orbit.name : setup.orbit], ["Cash", money(setup.cash_musd)]])]),
      el("div", { class: "nav-row" }, [UI.button(["START", " >"], function () {
        var d = newDuelDesign(pick.seed);
        if (!d) { showQuickMenu(); return; }
        window.showDesignScreen("map", d);
      }, { primary: true, key: "quick-start" })])
    ], null, { status: "QUICK MODE", back: QUICK_BACK });
  }

  // The debrief's buttons for a quick flight: the QUICK SCORE (getQuickScore: science against cost), the best kept on this
  // device, then PLAY AGAIN (a new seed), QUICK MENU and HOME. Nothing is sent anywhere.
  function quickButtons(done, d) {
    var cost = done.mission && done.mission.launch_totals ? done.mission.launch_totals.cost_musd : (typeof getTotals === "function" ? getTotals(done.design).cost_musd : 0);
    if (!quick.result || quick.result.done !== done) {   // counted once per flight: a redraw of the debrief keeps the same answer
      var score = typeof getQuickScore === "function" ? getQuickScore({ science: d.science || 0, cost_musd: cost || 0 }) : 0, before = bestScore();
      keepBest(score);
      quick.result = { done: done, score: score, fresh: score > before && score > 0, best: Math.max(before, score) };
    }
    var r = quick.result;
    return el("div", { class: "stack" }, [
      el("div", { class: "stack online-result", "data-key": "quick-result" }, [
        el("p", { class: "online-big", "data-key": "quick-score", text: "QUICK SCORE " + num(r.score, 0) }),
        el("p", { class: "online-msg" + (r.fresh ? " fresh" : ""), "data-key": "quick-best", role: "status", text: r.fresh ? "NEW BEST" : "BEST " + num(r.best, 0) })]),
      el("div", { class: "choices" }, [
        UI.button(["PLAY AGAIN", " >"], function () { startQuick(); }, { primary: true, key: "quick-again" }),
        UI.button("QUICK MENU", function () { showQuickMenu(); }, { key: "quick-menu-back" }),
        UI.button("HOME", function () { UI.home(); }, { key: "quick-home" })])
    ]);
  }

  // ---------------------------------------------------------------- the leaderboard
  // opts.run: a finished comeback's score (getRunScore) waiting to be sent; the screen asks for a nickname first.
  function showLeaderboard(opts) {
    opts = opts || {};
    if (!status().on || !api()) return offScreen("LEADERBOARD");
    var run = opts.run || null, me = player();
    var list = el("div", { class: "panel online-board", "data-key": "lb-list", "aria-live": "polite" }, [el("p", { class: "online-msg", text: "..." })]);
    var youLine = el("p", { class: "online-you", "data-key": "lb-you" });
    var sendMsg = el("p", { class: "online-msg", role: "status", "data-key": "lb-msg" });
    var nick = nameField();
    var children = [el("p", { class: "preset-note", text: "Scores are self-reported." })];
    if (run) {
      var send = UI.button("SUBMIT", function () {
        var name = nick.get();
        if (!name) { say(sendMsg, "Type a nickname first.", true); return; }
        send.disabled = true;
        api().submitScore({ id: player().id, nickname: name, score: run.score, won: !!run.won, stars: run.stars, months_left: run.months_left, reputation: run.reputation })
          .then(function (r) {
            send.disabled = !!(r && r.ok);
            say(sendMsg, r && r.ok ? "Sent. Your best is " + num(r.best, 0) + ", rank " + num(r.rank, 0) + "." : (r && r.reason) || FAIL, !(r && r.ok));
            if (r && r.ok) load();
          });
      }, { primary: true, key: "lb-submit" });
      children.push(el("div", { class: "panel online-run" }, [
        el("p", { class: "online-big", "data-key": "lb-run", text: num(run.score, 0) + " POINTS" }),
        el("div", { class: "online-line" }, [nick.node, send]), sendMsg]));
    } else {
      children.push(el("div", { class: "online-line" }, [nick.node]));
    }
    children.push(youLine, list);
    var node = open("leaderboard", "ONLINE", "LEADERBOARD", children, null, run ? null : { back: QUICK_BACK });   // from the ending: HOME
    var mine = epoch;

    function load() {
      api().leaderboard(me.id).then(function (r) {
        if (mine !== epoch) return;
        while (list.firstChild) list.removeChild(list.firstChild);
        if (!r || !r.ok) {
          list.appendChild(el("p", { class: "online-msg bad", text: (r && r.reason) || FAIL, role: "status" }));
          list.appendChild(UI.button("RETRY", function () { load(); }, { quiet: true, key: "lb-retry" }));
          return;
        }
        var rows = Array.isArray(r.rows) ? r.rows : [];
        if (!rows.length) list.appendChild(el("p", { class: "online-msg", text: "No scores yet." }));
        rows.forEach(function (x) {
          list.appendChild(el("div", { class: "lb-row" + (r.you && r.you.rank === x.rank ? " mine" : ""), "data-key": "lb-row" }, [
            el("span", { class: "lb-rank", text: "#" + num(x.rank, 0) }), el("span", { class: "lb-name", text: String(x.nickname || "") }),
            el("span", { class: "lb-score", text: num(x.score, 0) })]));
        });
        youLine.textContent = r.you ? "YOU  #" + num(r.you.rank, 0) + " · " + num(r.you.score, 0) : "";
      });
    }
    load();
    return node;
  }

  // ---------------------------------------------------------------- the duel
  var duel = null;   // { code, seed, sent } for the duel in hand

  function showDuel() {
    if (!status().on || !api()) return offScreen("DUEL");
    var nick = nameField();
    var msg = el("p", { class: "online-msg", role: "status", "data-key": "duel-msg" });
    var codeInput = el("input", { type: "text", class: "online-input code", maxlength: String(cfg().room_code_length || 4), placeholder: "CODE",
      "aria-label": "Room code", "data-key": "duel-code", autocomplete: "off", autocapitalize: "characters", spellcheck: "false" });
    codeInput.addEventListener("input", function () { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, ""); });
    var create = UI.button("CREATE ROOM", function () {
      if (!nick.get()) { say(msg, "Type a nickname first.", true); return; }
      create.disabled = true; say(msg, "...");
      api().duelCreate({ id: player().id, nickname: nick.get() }).then(function (r) {
        if (!r || !r.ok) { create.disabled = false; say(msg, (r && r.reason) || FAIL, true); return; }
        showWaiting(r);
      });
    }, { primary: true, key: "duel-create" });
    var join = UI.button("JOIN", function () {
      var code = codeInput.value.trim().toUpperCase();
      if (!nick.get()) { say(msg, "Type a nickname first.", true); return; }
      if (code.length !== (cfg().room_code_length || 4)) { say(msg, "A room code is " + (cfg().room_code_length || 4) + " letters.", true); return; }
      join.disabled = true; say(msg, "...");
      api().duelJoin(code, { id: player().id, nickname: nick.get() }).then(function (r) {
        join.disabled = false;
        if (!r || !r.ok) { say(msg, (r && r.reason) || FAIL, true); return; }
        duel = { code: r.code, seed: r.seed, sent: false };
        intro(r);
      });
    }, { key: "duel-join" });
    open("duel", "ONLINE", "DUEL", [
      el("p", { class: "preset-note", text: "Same satellite job and cash for both. One flight each. Best science wins." }),
      el("div", { class: "online-line" }, [nick.node]),
      el("div", { class: "panel online-duel" }, [
        el("div", { class: "online-line" }, [create]),
        el("div", { class: "online-line" }, [codeInput, join])]),
      msg], null, { back: QUICK_BACK });
  }

  // The host's room: the code to share, and a wait (the server is asked every ONLINE.poll_ms) until the other player joins.
  function showWaiting(room) {
    var msg = el("p", { class: "online-msg", role: "status", "data-key": "duel-wait-msg", text: "Waiting for the other player." });
    var node = open("wait", "DUEL", "ROOM", [
      el("div", { class: "panel online-room" }, [el("p", { class: "online-code", "data-key": "duel-room-code", text: room.code }), msg])
    ], function () { UI.home(); });
    var mine = epoch, pid = player().id;
    function poll() {
      if (mine !== epoch || !document.body.contains(node)) return;
      api().duelPoll(room.code, pid).then(function (r) {
        if (mine !== epoch) return;
        if (r && r.ok && r.state !== "waiting") { duel = { code: room.code, seed: r.seed, sent: false }; intro(r); return; }
        if (r && !r.ok && r.status === 404) { say(msg, r.reason || FAIL, true); return; }   // the room is gone (it expired)
        if (r && !r.ok) say(msg, r.reason || FAIL, true); else say(msg, "Waiting for the other player.");   // any other trouble: keep asking
        setTimeout(poll, cfg().poll_ms || 2000);
      });
    }
    setTimeout(poll, cfg().poll_ms || 2000);
  }

  // The duel's job in three lines, then the normal Build, Rocket Yard, Readiness, Mission and Debrief screens.
  function intro(room) {
    var setup = typeof getDuelSetup === "function" ? getDuelSetup(room.seed) : null;
    if (!setup) { showDuel(); return; }
    quick = null;   // a duel flight is not a quick flight
    var topic = UI.byId(UI.data("OBJECTIVES"), setup.objective), orbit = UI.byId(UI.data("ORBITS"), setup.orbit);
    var foe = (room.players || []).filter(function (p) { return p.role !== room.you; })[0];
    open("intro", "DUEL", "YOUR FLIGHT", [
      el("div", { class: "panel online-room" }, [
        foe ? el("p", { class: "online-msg", text: "AGAINST " + String(foe.nickname || "").toUpperCase() }) : null,
        UI.facts([["Topic", topic ? topic.name : setup.objective], ["Orbit", orbit ? orbit.name : setup.orbit], ["Cash", money(setup.cash_musd)]])]),
      el("div", { class: "nav-row" }, [UI.button(["START", " >"], function () {
        var d = typeof newDuelDesign === "function" ? newDuelDesign(room.seed) : null;
        if (!d) { UI.home(); return; }
        window.showDesignScreen("map", d);
      }, { primary: true, key: "duel-start" })])
    ]);
  }

  // The debrief's buttons for a duel flight: SEND RESULT, then who won (the server decides, so both players read the same).
  function duelButtons(done, d) {
    if (isQuick(done.design)) return quickButtons(done, d);   // QUICK MODE: the same debrief hook, a different set of buttons
    var box = el("div", { class: "stack online-result", "data-key": "duel-result" });
    var msg = el("p", { class: "online-msg", role: "status", "data-key": "duel-result-msg" });
    var verdict = el("div", { class: "online-verdict", "data-key": "duel-verdict", "aria-live": "polite" });
    var cost = done.mission && done.mission.launch_totals ? done.mission.launch_totals.cost_musd : (typeof getTotals === "function" ? getTotals(done.design).cost_musd : 0);
    var mine = { science: d.science || 0, cost_musd: cost || 0, stars: d.stars || 0 };
    var send = UI.button("SEND RESULT", function () {
      if (!duel || !api()) { say(msg, FAIL, true); return; }
      send.disabled = true; say(msg, "...");
      var p = player();
      api().duelResult(duel.code, { id: p.id, nickname: p.nickname || "PLAYER", science: mine.science, cost_musd: mine.cost_musd, stars: mine.stars }).then(function (r) {
        var already = r && !r.ok && /already/i.test(r.reason || "");
        if (!r || (!r.ok && !already)) { send.disabled = false; say(msg, (r && r.reason) || FAIL, true); return; }
        duel.sent = true;
        say(msg, "Sent. Waiting for the other player.");
        watch();
      });
    }, { primary: true, key: "duel-send" });
    function watch() {
      function tick() {
        if (!document.body.contains(verdict)) return;   // the player left the debrief
        api().duelPoll(duel.code, player().id).then(function (r) {
          if (!document.body.contains(verdict)) return;
          if (r && r.ok && r.state === "done") { showVerdict(r); return; }
          if (r && !r.ok && r.status === 404) { say(msg, r.reason || FAIL, true); return; }   // the room is gone (it expired)
          if (r && !r.ok) say(msg, r.reason || FAIL, true);   // any other trouble: keep asking
          setTimeout(tick, cfg().poll_ms || 2000);
        });
      }
      tick();
    }
    function showVerdict(r) {
      var me = r.you, win = r.winner === "tie" ? "tie" : r.winner === me ? "win" : "lose";
      say(msg, "");
      while (verdict.firstChild) verdict.removeChild(verdict.firstChild);
      verdict.appendChild(el("p", { class: "online-big " + win, "data-key": "duel-outcome", text: win === "win" ? "YOU WIN" : win === "lose" ? "YOU LOSE" : "TIE" }));
      (r.players || []).forEach(function (p) {
        var f = p.result || {};
        verdict.appendChild(el("div", { class: "lb-row" + (p.role === me ? " mine" : ""), "data-key": "duel-row" }, [
          el("span", { class: "lb-name", text: String(p.nickname || "") + (p.role === me ? " (YOU)" : "") }),
          el("span", { class: "lb-score", text: num(f.science, 0) + " · " + money(f.cost_musd) })]));
      });
      if (verdict.scrollIntoView) verdict.scrollIntoView({ block: "center" });   // the debrief is long: bring the answer into view
    }
    box.appendChild(el("p", { class: "online-msg", text: "DUEL · " + num(mine.science, 0) + " science · " + money(mine.cost_musd) }));
    box.appendChild(msg); box.appendChild(verdict);
    return el("div", { class: "stack" }, [box, el("div", { class: "choices" }, [send, UI.button("HOME", function () { UI.home(); }, { key: "duel-home" })])]);
  }
  UI.duelButtons = duelButtons;

  // ---------------------------------------------------------------- the ending's button
  // SUBMIT SCORE on Part 2's ending screen: opens the leaderboard with this run's score ready to send. Null when online is off.
  function submitButton() {
    if (!status().on) return null;
    var run = typeof getRunScore === "function" ? getRunScore() : null;
    if (!run) return null;
    return UI.button("SUBMIT SCORE", function () { showLeaderboard({ run: run }); }, { key: "end-submit", aria: "Submit your score to the leaderboard" });
  }

  window.StarlineOnline = { submitButton: submitButton, showLeaderboard: showLeaderboard, showDuel: showDuel,
    showQuickMenu: showQuickMenu, quickState: quickState, isQuick: isQuick, forgetQuick: forgetQuick };
})();
