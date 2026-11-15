// tests/online.js — the online features (SPEC.md, "Online features"): the off switch, the run score, the duel setup,
// and the optional server. Run from the repo root:  node tests/online.js
// The server tests start a real server on a random port and talk to it over http; nothing leaves the machine.
var fs = require("fs"), vm = require("vm"), os = require("os"), path = require("path"), http = require("http");
var root = path.join(__dirname, "..");
var load = require("./load");
var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) passed++; else failed++;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
}

// ---- 1. onlineStatus: the one rule for on and off. live-data.js is loaded alone, with a counting fetch.
var fetched = [];
function loadLive(location, endpoint) {
  var ctx = vm.createContext({ console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, AbortController: AbortController,
    fetch: function (url) { fetched.push(url); return Promise.reject(new Error("blocked in tests")); } });
  ctx.location = location;
  vm.runInContext("const ONLINE = { endpoint: " + JSON.stringify(endpoint) + ", request_timeout_ms: 500 };", ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "js/live-data.js"), "utf8"), ctx, { filename: "js/live-data.js" });
  return ctx.LiveData;
}
function loc(host, o) { o = o || {}; return { protocol: o.protocol || "https:", hostname: host, search: o.search || "" }; }
var END = "https://server.example.com";
var OFF = [
  ["a file",              { protocol: "file:", hostname: "", search: "" }],
  ["localhost",           loc("localhost")],
  ["LOCALHOST (caps)",    loc("LocalHost")],
  ["127.0.0.1",           loc("127.0.0.1")],
  ["another 127.x",       loc("127.1.2.3")],
  ["[::1]",               loc("[::1]")],
  ["::1",                 loc("::1")],
  ["0.0.0.0",             loc("0.0.0.0")],
  ["a .local name",       loc("laptop.local")],
  ["a .localhost name",   loc("game.localhost")],
  ["10.x",                loc("10.0.0.5")],
  ["172.16",              loc("172.16.0.1")],
  ["172.31",              loc("172.31.255.1")],
  ["192.168.x",           loc("192.168.1.20")],
  ["?offline=1",          loc("game.example.com", { search: "?offline=1" })],
  ["?x=1&offline=1",      loc("game.example.com", { search: "?x=1&offline=1" })],
  ["http on localhost",   loc("localhost", { protocol: "http:" })]
];
OFF.forEach(function (c) {
  var L = loadLive(c[1], END), s = L.onlineStatus();
  check("1 off: " + c[0], s.on === false && typeof s.reason === "string" && s.reason.length > 0 && s.reason.length < 60, s.reason);
});
var SPECIFIC = { "a file": /file/i, "localhost": /computer/i, "10.x": /private/i, "192.168.x": /private/i, "?offline=1": /offline/i };
Object.keys(SPECIFIC).forEach(function (k) {   // the address is judged before the missing endpoint, so the reason is the address's
  var row = OFF.filter(function (c) { return c[0] === k; })[0];
  check("1 the reason for " + k + " names the address, not the empty endpoint", SPECIFIC[k].test(loadLive(row[1], "").onlineStatus().reason));
});
check("1 a public address with no server set is off, and says so", (function () {
  var s = loadLive(loc("game.example.com"), "").onlineStatus(); return !s.on && /server/i.test(s.reason);
})());
check("1 a public address with whitespace as the server is off", !loadLive(loc("game.example.com"), "   ").onlineStatus().on);
var ON = ["game.example.com", "172.32.0.1", "172.15.0.1", "11.0.0.1", "192.169.1.1", "localhost.example.com", "mylocal.com", "10.example.com",
          "93.184.216.34", "username.github.io", "[2606:4700::1]"];
ON.forEach(function (h) {
  var s = loadLive(loc(h), END).onlineStatus();
  check("1 on: " + h, s.on === true && s.reason === "");
});
check("1 on with ?x=offline=2 or ?offline=10 (only offline=1 turns it off)", loadLive(loc("g.example.com", { search: "?offline=10" }), END).onlineStatus().on &&
  loadLive(loc("g.example.com", { search: "?foo=offline=1" }), END).onlineStatus().on);
check("1 onlineStatus takes explicit arguments (pure)", (function () {
  var L = loadLive(loc("localhost"), END);
  return L.onlineStatus(loc("game.example.com"), { endpoint: END }).on === true && L.onlineStatus(loc("game.example.com"), { endpoint: "" }).on === false;
})());

// ---- 2. No network request at all when off; a plain failure when on and unreachable.
(async function () {
  fetched.length = 0;
  for (var i = 0; i < OFF.length; i++) {
    var L = loadLive(OFF[i][1], END), o = L.online;
    var rs = await Promise.all([o.leaderboard("abcdefgh"), o.submitScore({ id: "abcdefgh" }), o.duelCreate({ id: "abcdefgh" }), o.duelJoin("ABCD", {}),
                                o.duelResult("ABCD", {}), o.duelPoll("ABCD")]);
    if (!rs.every(function (r) { return r && r.ok === false && typeof r.reason === "string"; })) fetched.push("a call did not answer { ok: false, reason }: " + OFF[i][0]);
  }
  check("2 off: no call sends a request, and every call answers { ok: false, reason }", fetched.length === 0, fetched.join(","));
  var live = loadLive(loc("game.example.com"), END);
  var r = await live.online.leaderboard();
  check("2 on but unreachable: a plain failure and one request made", r.ok === false && r.reason === "Server not reachable" && fetched.length === 1 && fetched[0].indexOf(END + "/api/leaderboard") === 0, JSON.stringify(r));
  await serverTests();
  await gameTests();
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();

// ---- 3. The run score and the duel setup (back end).
function gameTests() {
  var store = load.memoryStorage();
  var G = load({ storage: store });
  G.run(fs.readFileSync(path.join(root, "data/online.js"), "utf8"));   // ONLINE joins the game, as index.html does
  var ONL = G.run("ONLINE"), K = ONL.run_score;
  check("3 the data file and the back end's fallback agree on the score formula",
    K.win === 500 && K.per_star === 100 && K.per_month_left === 10 && K.per_reputation === 5);
  check("3 no comeback, no score", G.getRunScore() === null);
  G.resetCampaign();
  var h = G.newComeback("standard", 7);
  check("3 a comeback in progress has no score", G.getRunScore() === null);
  var c = G.getCampaign();
  c.finished = true; c.won = true; c.month = 20; c.deadline_month = 30; c.reputation = 24;
  c.missions = [{ stars: 3 }, { stars: 2 }, { stars: 1 }];
  var s = G.getRunScore(c);
  check("3 a win: 500 + 100 per star + 10 per month left + 5 per reputation", s && s.score === 500 + 600 + 100 + 120 && s.won && s.stars === 6 && s.months_left === 10 && s.reputation === 24, JSON.stringify(s));
  c.won = false;
  s = G.getRunScore(c);
  check("3 a loss: no win bonus and no months, stars and reputation still count", s && s.score === 600 + 120 && s.months_left === 0 && !s.won, JSON.stringify(s));
  c.won = true; c.month = 40;
  check("3 months never go below 0", G.getRunScore(c).months_left === 0);
  c.won = true; c.month = 20; c.missions = []; c.reputation = 0;
  check("3 a win with no stars and no name is the 500 and the months", G.getRunScore(c).score === 500 + 100);
  var before = JSON.stringify(c);
  G.getRunScore(c);
  check("3 getRunScore writes nothing", JSON.stringify(c) === before);
  G.saveCampaign(c);
  check("3 with no argument it reads the saved comeback", G.getRunScore().score === 600);
  G.resetCampaign();

  // The duel setup: the same seed gives the same setup; each setup is a real topic, orbit, era and tier.
  var a = G.getDuelSetup(12345), b = G.getDuelSetup(12345);
  check("3 the same seed gives the same duel setup", a && JSON.stringify(a) === JSON.stringify(b), JSON.stringify(a));
  check("3 a bad seed gives none", G.getDuelSetup("x") === null && G.getDuelSetup(-1) === null && G.getDuelSetup(1.5) === null && G.newDuelDesign(NaN) === null);
  var seen = {};
  for (var n = 1; n <= 60; n++) { var u = G.getDuelSetup(n); seen[u.objective + "/" + u.orbit] = 1; }
  check("3 the seeds reach every setup", Object.keys(seen).length === ONL.duel_setups.length, Object.keys(seen).join(","));
  var BUS = ["solar-small", "mercury-battery", "radio-uhf", "command-timer", "spin-stabilised", "cubesat-12u"];
  var INSTRUMENT = { radiation: "cosmic-ray-counter", solar: "solar-xray-photometer", weather: "vidicon-camera" };
  ONL.duel_setups.forEach(function (st) {
    var tier = G.getTier(st.tier), d = G.newDuelDesign(
      (function () { for (var k = 1; k < 500; k++) { var x = G.getDuelSetup(k); if (x.objective === st.objective && x.orbit === st.orbit) return k; } })());
    G.setLauncher(d, "small");
    BUS.concat([INSTRUMENT[st.objective]]).forEach(function (p) { G.addPart(d, p); });
    var okDesign = d && d.duel && d.era === st.era && d.tier === st.tier && d.objective === st.objective && d.orbit === st.orbit;
    var m = G.startMission(d), res = null;
    if (m) { var ev; do { ev = G.stepMonth(m); if (ev.event) { var j = ev.event.choices.findIndex(function (x) { return !x.fail_chance_now; }); G.chooseEvent(m, j < 0 ? 0 : j); } } while (!m.ended); res = G.getDebrief(m); }
    check("3 duel setup " + st.objective + "/" + st.orbit + ": a small satellite under the " + tier.name + " budget flies and earns a star",
      okDesign && m && res.stars >= 1 && G.getTotals(d).cost_musd <= tier.budget_musd && m.design.duel && m.design.duel.seed === d.duel.seed, res ? res.stars + " stars" : "did not launch");
  });
  // A duel flight never touches the stars record, the eras or the comeback save.
  var G2 = load({ storage: load.memoryStorage() });
  G2.run(fs.readFileSync(path.join(root, "data/online.js"), "utf8"));
  G2.resetProgress(); G2.resetCampaign();
  var progress = JSON.stringify(G2.getProgress());
  var d2 = G2.newDuelDesign(7);
  G2.setLauncher(d2, "small");
  BUS.concat([INSTRUMENT[d2.objective]]).forEach(function (p) { G2.addPart(d2, p); });
  var m2 = G2.startMission(d2), e2;
  do { e2 = G2.stepMonth(m2); if (e2.event) { var jj = e2.event.choices.findIndex(function (x) { return !x.fail_chance_now; }); G2.chooseEvent(m2, jj < 0 ? 0 : jj); } } while (!m2.ended);
  var rec = G2.recordResult(m2);
  check("3 a duel flight is recorded as a duel and opens nothing", rec && rec.duel === true && rec.unlocked === null && rec.era_unlocked === null && rec.stars >= 1);
  check("3 a duel flight leaves the stars record exactly as it was", JSON.stringify(G2.getProgress()) === progress);
  check("3 a duel flight creates no comeback or campaign save", G2.getCampaign() === null || G2.getCampaign() === undefined || !G2.getComeback());
  check("3 recordResult is still once-only for a duel", G2.recordResult(m2) === rec);
  // A normal standalone flight still records (the guard is only for duels).
  var d3 = G2.newDesign("training"); G2.setObjective(d3, "radiation"); G2.setOrbit(d3, "leo"); G2.setLauncher(d3, "juno-1");
  ["explorer-body", "spin-stabilised", "cosmic-ray-counter", "minitrack-beacon", "command-timer", "silicon-cells"].forEach(function (p) { G2.addPart(d3, p); });
  G2.setEra(d3, "igy");
  var m3 = G2.startMission(d3), e3;
  if (m3) { do { e3 = G2.stepMonth(m3); if (e3.event) { var j3 = e3.event.choices.findIndex(function (x) { return !x.fail_chance_now; }); G2.chooseEvent(m3, j3 < 0 ? 0 : j3); } } while (!m3.ended); G2.recordResult(m3); }
  check("3 an ordinary flight still moves the record", m3 && JSON.stringify(G2.getProgress()) !== progress);
}

// ---- 4. The server, over real http on a random port.
function request(port, method, p, body, headers) {
  return new Promise(function (resolve) {
    var data = body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body);
    var req = http.request({ host: "127.0.0.1", port: port, method: method, path: p,
      headers: Object.assign(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}, headers || {}) }, function (res) {
      var chunks = []; res.on("data", function (c) { chunks.push(c); });
      res.on("end", function () {
        var text = Buffer.concat(chunks).toString("utf8"), j = null; try { j = JSON.parse(text); } catch (e) { /* not json */ }
        resolve({ status: res.statusCode, json: j, headers: res.headers, text: text });
      });
    });
    req.on("error", function (e) { resolve({ status: 0, json: null, error: String(e), headers: {}, text: "" }); });
    if (data) req.write(data);
    req.end();
  });
}
function listen(srv) { return new Promise(function (res) { srv.listen(0, "127.0.0.1", function () { res(srv.address().port); }); }); }
function close(srv) { return new Promise(function (res) { srv.close(res); if (srv.closeAllConnections) srv.closeAllConnections(); }); }
function pid(n) { return "player" + String(n).padStart(4, "0"); }

async function serverTests() {
  var S = require(path.join(root, "server/server.js"));
  var file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gravitron-server-")), "data.json");
  var clock = 1000000;
  var srv = S.createServer({ dataFile: file, allowOrigin: "https://game.example.com", rateLimit: 100000, now: function () { return clock; } });
  var port = await listen(srv), r;

  r = await request(port, "GET", "/api/leaderboard");
  check("4 an empty leaderboard answers with no rows and says it is self-reported", r.status === 200 && r.json.ok && r.json.rows.length === 0 && r.json.self_reported === true);
  // 25 players, scores 100..2500 (shuffled order), one nickname that is too long and padded.
  var order = []; for (var i = 1; i <= 25; i++) order.push(i);
  order.sort(function (a, b) { return (a * 7) % 25 - (b * 7) % 25; });
  for (var k = 0; k < order.length; k++) {
    var n = order[k];
    r = await request(port, "POST", "/api/score", { id: pid(n), nickname: n === 25 ? "   A very long nickname indeed   " : "P" + n, score: n * 100, won: true, stars: 3, months_left: 4, reputation: 10 });
    if (r.status !== 200 || !r.json.ok) check("4 a valid score is accepted (player " + n + ")", false, r.text);
  }
  r = await request(port, "GET", "/api/leaderboard");
  var rows = r.json.rows;
  check("4 the leaderboard is capped at 20", rows.length === 20 && r.json.total === 25);
  check("4 the leaderboard is sorted best first with ranks 1..20", rows.every(function (x, i) { return x.rank === i + 1 && (i === 0 || rows[i - 1].score >= x.score); }) && rows[0].score === 2500 && rows[19].score === 600);
  check("4 a nickname is trimmed and cut to 16 characters", rows[0].nickname === "A very long nick" && rows[0].nickname.length <= 16, rows[0].nickname);
  check("4 the board never shows a player id", r.text.indexOf("player00") === -1);
  r = await request(port, "GET", "/api/leaderboard?id=" + pid(3));
  check("4 your own best and rank come back with your id (even outside the top 20)", r.json.you && r.json.you.score === 300 && r.json.you.rank === 23, JSON.stringify(r.json.you));
  r = await request(port, "POST", "/api/score", { id: pid(3), nickname: "P3", score: 150 });
  check("4 a worse score does not replace your best", r.json.ok && r.json.best === 300);
  r = await request(port, "POST", "/api/score", { id: pid(3), nickname: "P3", score: 4000 });
  check("4 a better score replaces it and ranks first", r.json.ok && r.json.best === 4000 && r.json.rank === 1);
  check("4 the board is saved to the file and loads again", (function () {
    var saved = JSON.parse(fs.readFileSync(file, "utf8")); return saved.scores.length === 25 && saved.scores[0].score === 4000;
  })());
  var again = S.createServer({ dataFile: file, rateLimit: 100000 }), p2 = await listen(again);
  r = await request(p2, "GET", "/api/leaderboard");
  check("4 a restarted server keeps the leaderboard", r.json.rows.length === 20 && r.json.rows[0].score === 4000);
  await close(again);

  // validation rejects
  async function rejects(name, body, status) {
    var x = await request(port, "POST", "/api/score", body);
    check("4 rejects " + name, x.status === (status || 400) && x.json && x.json.ok === false && typeof x.json.reason === "string", x.status + " " + x.text.slice(0, 80));
  }
  await rejects("a missing id", { nickname: "A", score: 1 });
  await rejects("a short id", { id: "abc", nickname: "A", score: 1 });
  await rejects("an id with odd characters", { id: "../../etc/passwd", nickname: "A", score: 1 });
  await rejects("an empty nickname", { id: pid(30), nickname: "   ", score: 1 });
  await rejects("a nickname that is not text", { id: pid(30), nickname: 5, score: 1 });
  await rejects("a text score", { id: pid(30), nickname: "A", score: "999" });
  await rejects("a negative score", { id: pid(30), nickname: "A", score: -5 });
  await rejects("an absurd score", { id: pid(30), nickname: "A", score: 1e9 });
  await rejects("an infinite score (sent as null by JSON)", { id: pid(30), nickname: "A", score: null });
  await rejects("a text 'won'", { id: pid(30), nickname: "A", score: 5, won: "yes" });
  await rejects("too many stars", { id: pid(30), nickname: "A", score: 5, stars: 999 });
  await rejects("a body that is not an object", "[1,2,3]");
  await rejects("a body that is not json", "{nope");
  r = await request(port, "POST", "/api/score", { id: pid(31), nickname: "Ctl\u0007\u0000Chars", score: 5 });
  check("4 control characters in a nickname are stripped", r.json.ok && JSON.parse(fs.readFileSync(file, "utf8")).scores.some(function (s) { return s.nickname === "Ctl Chars"; }));
  r = await request(port, "POST", "/api/score", { id: "__proto__", nickname: "A", score: 5 });
  check("4 rejects a prototype-pollution id", r.status === 400);
  r = await request(port, "POST", "/api/score", { id: pid(32), nickname: "Big", score: 5, junk: "x".repeat(5000) });
  check("4 a body over the size cap is refused (413) and the server lives on", r.status === 413 || r.status === 0, String(r.status));
  r = await request(port, "GET", "/api/leaderboard");
  check("4 the server still answers after an oversize body", r.status === 200);
  r = await request(port, "GET", "/api/nothing");
  check("4 an unknown path is a 404 in json", r.status === 404 && r.json && r.json.ok === false);
  r = await request(port, "DELETE", "/api/score");
  check("4 an unsupported method is refused", r.status === 405);
  r = await request(port, "GET", "/api/score");
  check("4 the wrong method on a known path is a 405", r.status === 405);

  // CORS, including the preflight a browser sends before a JSON post
  r = await request(port, "OPTIONS", "/api/score", undefined, { Origin: "https://game.example.com", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" });
  check("4 a CORS preflight is answered (204) with the allowed origin, methods and Content-Type", r.status === 204 && r.headers["access-control-allow-origin"] === "https://game.example.com" &&
    /POST/.test(r.headers["access-control-allow-methods"]) && /content-type/i.test(r.headers["access-control-allow-headers"]));
  r = await request(port, "GET", "/api/leaderboard");
  check("4 a normal answer carries the CORS origin too", r.headers["access-control-allow-origin"] === "https://game.example.com");
  var plain = S.createServer({ rateLimit: 100000 }), p3 = await listen(plain);
  r = await request(p3, "GET", "/api/leaderboard");
  check("4 with no ALLOW_ORIGIN no CORS header is sent", r.headers["access-control-allow-origin"] === undefined && r.json.ok);
  await close(plain);

  // duel: create, join, result, poll
  r = await request(port, "POST", "/api/duel", { id: pid(1), nickname: "Host" });
  var code = r.json && r.json.code, seed = r.json && r.json.seed;
  check("4 a duel room has a four-letter code, a seed and waits", r.status === 200 && /^[A-Z]{4}$/.test(code) && Number.isInteger(seed) && seed > 0 && r.json.state === "waiting" && r.json.you === "host");
  r = await request(port, "GET", "/api/duel/" + code + "?id=" + pid(1));
  check("4 polling a waiting room says waiting", r.json.ok && r.json.state === "waiting" && r.json.players.length === 1);
  r = await request(port, "POST", "/api/duel/" + code + "/join", { id: pid(1), nickname: "Host" });
  check("4 you cannot join your own room", r.status === 400 && r.json.ok === false);
  r = await request(port, "POST", "/api/duel/" + code.toLowerCase() + "/join", { id: pid(2), nickname: "Guest" });
  check("4 a guest joins by code (any letter case) and gets the same seed", r.status === 200 && r.json.seed === seed && r.json.state === "playing" && r.json.you === "guest", r.text.slice(0, 120));
  r = await request(port, "POST", "/api/duel/" + code + "/join", { id: pid(3), nickname: "Late" });
  check("4 a third player is told the room is full", r.status === 409);
  r = await request(port, "POST", "/api/duel/" + code + "/join", { id: pid(2), nickname: "Guest" });
  check("4 the guest joining again is fine", r.status === 200);
  r = await request(port, "POST", "/api/duel/ZZZZ/join", { id: pid(4), nickname: "Lost" });
  check("4 an unknown room is a 404", r.status === 404);
  r = await request(port, "POST", "/api/duel/AB/join", { id: pid(4), nickname: "Lost" });
  check("4 a code that is not four letters is refused", r.status === 400);
  r = await request(port, "POST", "/api/duel/" + code + "/result", { id: pid(9), science: 10, cost_musd: 5, stars: 1 });
  check("4 a stranger cannot send a result", r.status === 403);
  r = await request(port, "POST", "/api/duel/" + code + "/result", { id: pid(1), science: -1, cost_musd: 5 });
  check("4 a negative science figure is refused", r.status === 400);
  r = await request(port, "POST", "/api/duel/" + code + "/result", { id: pid(1), science: "lots", cost_musd: 5 });
  check("4 a text science figure is refused", r.status === 400);
  r = await request(port, "POST", "/api/duel/" + code + "/result", { id: pid(1), science: 120.5, cost_musd: 9, stars: 2 });
  check("4 the host sends a result and the room waits for the guest", r.status === 200 && r.json.state === "playing" && r.json.winner === null && r.json.players[0].done === true && !r.json.players[0].result);
  r = await request(port, "POST", "/api/duel/" + code + "/result", { id: pid(1), science: 999, cost_musd: 1 });
  check("4 a second result from the same player is refused", r.status === 409);
  r = await request(port, "GET", "/api/duel/" + code + "?id=" + pid(2));
  check("4 the figures stay hidden until both are in", r.json.state === "playing" && !JSON.stringify(r.json).match(/120\.5/));
  r = await request(port, "POST", "/api/duel/" + code + "/result", { id: pid(2), science: 130, cost_musd: 12, stars: 2 });
  check("4 when both are in, the higher science wins", r.json.state === "done" && r.json.winner === "guest" && r.json.players.every(function (p) { return p.result; }));
  r = await request(port, "GET", "/api/duel/" + code + "?id=" + pid(1));
  check("4 both players read the same winner and each learns which side they are", r.json.winner === "guest" && r.json.you === "host" && r.json.players.length === 2);
  async function duel(a, b) {   // a, b: [science, cost]; returns the winner
    var c = await request(port, "POST", "/api/duel", { id: pid(50), nickname: "H" });
    var cd = c.json.code;
    await request(port, "POST", "/api/duel/" + cd + "/join", { id: pid(51), nickname: "G" });
    await request(port, "POST", "/api/duel/" + cd + "/result", { id: pid(50), science: a[0], cost_musd: a[1], stars: 1 });
    var f = await request(port, "POST", "/api/duel/" + cd + "/result", { id: pid(51), science: b[0], cost_musd: b[1], stars: 1 });
    return f.json.winner;
  }
  check("4 equal science goes to the lower cost", await duel([100, 12], [100, 9]) === "guest" && await duel([100, 8], [100, 9]) === "host");
  check("4 equal science and equal cost is a tie", await duel([100, 9], [100, 9]) === "tie");
  check("4 the higher science wins even when it costs more", await duel([200, 19], [100, 1]) === "host");
  clock += 11 * 60 * 1000;
  r = await request(port, "GET", "/api/duel/" + code + "?id=" + pid(1));
  check("4 a room is gone after ten minutes", r.status === 404 && r.json.ok === false);
  r = await request(port, "POST", "/api/duel/" + code + "/join", { id: pid(5), nickname: "Late" });
  check("4 an expired room cannot be joined", r.status === 404);
  r = await request(port, "POST", "/api/duel", { id: pid(1), nickname: "  " });
  check("4 a room needs a nickname", r.status === 400);
  var codes = {};
  for (var q = 0; q < 40; q++) { var cr = await request(port, "POST", "/api/duel", { id: pid(60 + q), nickname: "H" }); codes[cr.json.code] = 1; }
  check("4 room codes do not collide", Object.keys(codes).length === 40);
  await close(srv);

  // the per-address request limit, on its own server with a tiny limit
  var tiny = S.createServer({ rateLimit: 5, rateWindowMs: 60000, now: function () { return clock; } }), p4 = await listen(tiny);
  var statuses = [];
  for (var t = 0; t < 8; t++) statuses.push((await request(p4, "GET", "/api/leaderboard")).status);
  check("4 the request limit stops an address after its quota (429 with Retry-After)", statuses.slice(0, 5).every(function (s) { return s === 200; }) && statuses.slice(5).every(function (s) { return s === 429; }), statuses.join(","));
  r = await request(p4, "GET", "/api/leaderboard");
  check("4 a limited answer says how long to wait", r.status === 429 && Number(r.headers["retry-after"]) >= 1 && r.json.ok === false);
  clock += 61000;
  r = await request(p4, "GET", "/api/leaderboard");
  check("4 the limit lifts after its window", r.status === 200);
  await close(tiny);
  var proxied = S.createServer({ rateLimit: 2, trustProxy: true, now: function () { return clock; } }), p5 = await listen(proxied);
  var a1 = [await request(p5, "GET", "/api/leaderboard", undefined, { "X-Forwarded-For": "1.2.3.4" }), await request(p5, "GET", "/api/leaderboard", undefined, { "X-Forwarded-For": "1.2.3.4" }),
            await request(p5, "GET", "/api/leaderboard", undefined, { "X-Forwarded-For": "1.2.3.4" }), await request(p5, "GET", "/api/leaderboard", undefined, { "X-Forwarded-For": "5.6.7.8" })];
  check("4 behind a proxy (TRUST_PROXY) each real address has its own quota", a1[2].status === 429 && a1[3].status === 200);
  await close(proxied);
}
