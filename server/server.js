// server/server.js — the optional server for GRAVITRON's online features (SPEC.md, "Online features"):
// a global leaderboard and a quick 1v1 duel. Plain Node, no dependencies, no build step.
//   node server/server.js
// Environment: PORT (default 8787), ALLOW_ORIGIN (the game's address, or * ; unset sends no CORS header),
// DATA_FILE (where the leaderboard is kept, default server/data.json), TRUST_PROXY=1 (read the client address
// from X-Forwarded-For, for hosts that put a proxy in front), RATE_LIMIT (requests per minute per address, default 300).
// Stored: a random player id, a nickname, and the result figures. No account, no email, no cookie, no analytics.
// Results are self-reported: the server checks they are sane numbers, not that the game produced them.
"use strict";

var http = require("http");
var fs = require("fs");
var path = require("path");

var LIMITS = {
  body_bytes: 2048,              // size cap of a request body
  nickname: 16,                  // characters
  leaderboard_rows: 20,          // rows returned
  stored_players: 1000,          // the file keeps this many, the best first
  room_ttl_ms: 10 * 60 * 1000,   // a duel room lives ten minutes
  max_rooms: 500,
  max_score: 10000,              // a run's score is about 500 + 100 per star + 10 per month + 5 per reputation
  max_stars: 60, max_months: 120, max_reputation: 500,
  max_science: 100000, max_cost_musd: 100000
};
var CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";   // no I or O: they read as 1 and 0
var ID_RE = /^(?!__proto__$|constructor$|prototype$)[A-Za-z0-9_-]{8,64}$/;   // the names an object already has are not ids

function createServer(opts) {
  opts = opts || {};
  var now = opts.now || Date.now;
  var allowOrigin = opts.allowOrigin || "";
  var rate = { max: opts.rateLimit || 300, window_ms: opts.rateWindowMs || 60 * 1000 };
  var ttl = opts.roomTtlMs || LIMITS.room_ttl_ms;
  var dataFile = opts.dataFile || "";
  var trustProxy = !!opts.trustProxy;
  var random = opts.random || Math.random;

  // ---- storage: the best run of each player, kept in a JSON file when one is given
  var scores = Object.create(null);   // id -> { id, nickname, score, won, stars, months_left, reputation, at }
  if (dataFile) {
    try {
      var saved = JSON.parse(fs.readFileSync(dataFile, "utf8"));
      (Array.isArray(saved.scores) ? saved.scores : []).forEach(function (s) {
        if (s && typeof s.id === "string" && ID_RE.test(s.id) && isFinite(s.score)) scores[s.id] = s;
      });
    } catch (e) { /* no file yet, or unreadable: start empty */ }
  }
  function persist() {
    if (!dataFile) return;
    var rows = ranked().slice(0, LIMITS.stored_players);
    scores = Object.create(null);
    rows.forEach(function (r) { scores[r.id] = r; });
    try {
      fs.mkdirSync(path.dirname(path.resolve(dataFile)), { recursive: true });
      var tmp = dataFile + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify({ scores: rows }));
      fs.renameSync(tmp, dataFile);
    } catch (e) { /* a full disk must not stop the game: the board stays in memory */ }
  }
  function ranked() {
    return Object.keys(scores).map(function (k) { return scores[k]; })
      .sort(function (a, b) { return b.score - a.score || a.at - b.at; });
  }

  // ---- validation
  function clean(v) { return typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim() : ""; }
  function nickname(v) { return clean(v).slice(0, LIMITS.nickname).trim(); }
  function num(v, lo, hi) { return typeof v === "number" && isFinite(v) && v >= lo && v <= hi; }
  function code(v) { var c = String(v || "").toUpperCase(); return /^[A-Z]{4}$/.test(c) ? c : ""; }
  function bad(reason, status) { return { status: status || 400, body: { ok: false, reason: reason } }; }
  function ok(body) { body = body || {}; body.ok = true; return { status: 200, body: body }; }

  // ---- the leaderboard
  function board(id) {
    var all = ranked();
    var out = { rows: all.slice(0, LIMITS.leaderboard_rows).map(function (r, i) {
      return { rank: i + 1, nickname: r.nickname, score: r.score, won: !!r.won, stars: r.stars, months_left: r.months_left, reputation: r.reputation };
    }), total: all.length, self_reported: true };
    if (id && ID_RE.test(id) && scores[id]) {
      var at = all.findIndex(function (r) { return r.id === id; });
      out.you = { rank: at + 1, nickname: scores[id].nickname, score: scores[id].score };
    }
    return ok(out);
  }
  function submit(b) {
    if (!b || !ID_RE.test(String(b.id || ""))) return bad("Bad player id");
    var nick = nickname(b.nickname);
    if (!nick) return bad("Type a nickname");
    if (!num(b.score, 0, LIMITS.max_score)) return bad("That score is not valid");
    if (b.won !== undefined && typeof b.won !== "boolean") return bad("That score is not valid");
    if (b.stars !== undefined && !num(b.stars, 0, LIMITS.max_stars)) return bad("That score is not valid");
    if (b.months_left !== undefined && !num(b.months_left, 0, LIMITS.max_months)) return bad("That score is not valid");
    if (b.reputation !== undefined && !num(b.reputation, 0, LIMITS.max_reputation)) return bad("That score is not valid");
    var prev = scores[b.id];
    var rec = { id: b.id, nickname: nick, score: Math.round(b.score), won: !!b.won, stars: Math.round(b.stars || 0),
                months_left: Math.round(b.months_left || 0), reputation: Math.round(b.reputation || 0), at: now() };
    if (prev && prev.score >= rec.score) { prev.nickname = nick; rec = prev; }   // only a better run replaces the best
    scores[b.id] = rec;
    persist();
    var all = ranked();
    return ok({ best: rec.score, rank: all.findIndex(function (r) { return r.id === b.id; }) + 1, total: all.length });
  }

  // ---- duel rooms (in memory: a room lives ten minutes)
  var rooms = Object.create(null);
  function purge() {
    var t = now();
    Object.keys(rooms).forEach(function (k) { if (rooms[k].expires <= t) delete rooms[k]; });
  }
  function newCode() {
    for (var tries = 0; tries < 200; tries++) {
      var c = "";
      for (var i = 0; i < 4; i++) c += CODE_LETTERS.charAt(Math.floor(random() * CODE_LETTERS.length));
      if (!rooms[c]) return c;
    }
    return "";
  }
  function winnerOf(room) {
    var a = room.host.result, b = room.guest && room.guest.result;
    if (!a || !b) return null;
    if (a.science !== b.science) return a.science > b.science ? "host" : "guest";
    if (a.cost_musd !== b.cost_musd) return a.cost_musd < b.cost_musd ? "host" : "guest";
    return "tie";
  }
  function view(room, id) {
    var done = !!(room.guest && room.host.result && room.guest.result);
    var stateName = !room.guest ? "waiting" : done ? "done" : "playing";
    var you = id && room.host.id === id ? "host" : id && room.guest && room.guest.id === id ? "guest" : null;
    function side(role, p) {
      var o = { role: role, nickname: p.nickname, done: !!p.result };
      if (done) o.result = p.result;   // the figures show only once both are in
      return o;
    }
    var players = [side("host", room.host)];
    if (room.guest) players.push(side("guest", room.guest));
    return { code: room.code, seed: room.seed, state: stateName, you: you, players: players, winner: done ? winnerOf(room) : null,
             expires_in_s: Math.max(0, Math.round((room.expires - now()) / 1000)) };
  }
  function create(b) {
    if (!b || !ID_RE.test(String(b.id || ""))) return bad("Bad player id");
    var nick = nickname(b.nickname);
    if (!nick) return bad("Type a nickname");
    purge();
    if (Object.keys(rooms).length >= LIMITS.max_rooms) return bad("Too many rooms right now", 503);
    var c = newCode();
    if (!c) return bad("Too many rooms right now", 503);
    var room = { code: c, seed: Math.floor(random() * 2147483647) + 1, created: now(), expires: now() + ttl,
                 host: { id: b.id, nickname: nick, result: null }, guest: null };
    rooms[c] = room;
    return ok(view(room, b.id));
  }
  function find(c) {
    purge();
    var k = code(c);
    if (!k) return null;
    return rooms[k] || null;
  }
  function join(c, b) {
    if (!code(c)) return bad("That code is four letters");
    if (!b || !ID_RE.test(String(b.id || ""))) return bad("Bad player id");
    var nick = nickname(b.nickname);
    if (!nick) return bad("Type a nickname");
    var room = find(c);
    if (!room) return bad("No such room. It may have expired.", 404);
    if (room.host.id === b.id) return bad("That is your own room");
    if (room.guest && room.guest.id !== b.id) return bad("That room is full", 409);
    if (!room.guest) room.guest = { id: b.id, nickname: nick, result: null };
    return ok(view(room, b.id));
  }
  function result(c, b) {
    if (!code(c)) return bad("That code is four letters");
    if (!b || !ID_RE.test(String(b.id || ""))) return bad("Bad player id");
    var room = find(c);
    if (!room) return bad("No such room. It may have expired.", 404);
    var me = room.host.id === b.id ? room.host : room.guest && room.guest.id === b.id ? room.guest : null;
    if (!me) return bad("You are not in that room", 403);
    if (!num(b.science, 0, LIMITS.max_science) || !num(b.cost_musd, 0, LIMITS.max_cost_musd) ||
        (b.stars !== undefined && !num(b.stars, 0, 3))) return bad("Those figures are not valid");
    if (me.result) return bad("Your result is already in", 409);
    me.result = { science: Math.round(b.science * 100) / 100, cost_musd: Math.round(b.cost_musd * 1000) / 1000, stars: Math.round(b.stars || 0) };
    return ok(view(room, b.id));
  }

  // ---- per-address request limit (a fixed window)
  var hits = Object.create(null);
  function limited(ip) {
    var t = now(), h = hits[ip];
    if (!h || t - h.start >= rate.window_ms) { h = hits[ip] = { start: t, n: 0 }; }
    h.n++;
    if (Object.keys(hits).length > 5000) Object.keys(hits).forEach(function (k) { if (t - hits[k].start >= rate.window_ms) delete hits[k]; });
    return h.n > rate.max ? Math.max(1, Math.ceil((h.start + rate.window_ms - t) / 1000)) : 0;
  }
  function clientIp(req) {
    if (trustProxy) {
      var f = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
      if (f) return f;
    }
    return req.socket.remoteAddress || "?";
  }

  // ---- http
  function headers(req, extra) {
    var h = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
    if (allowOrigin) {
      h["Access-Control-Allow-Origin"] = allowOrigin;
      h["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
      h["Access-Control-Allow-Headers"] = "Content-Type";
      h["Access-Control-Max-Age"] = "600";
      if (allowOrigin !== "*") h["Vary"] = "Origin";
    }
    Object.keys(extra || {}).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }
  function send(req, res, r, extra) {
    var text = JSON.stringify(r.body);
    res.writeHead(r.status, headers(req, extra));
    res.end(text);
  }

  function route(req, res, url, body) {
    var p = url.pathname.replace(/\/+$/, "") || "/", m = req.method, mt;
    if (p === "/" && m === "GET") return send(req, res, ok({ name: "gravitron-server" }));
    if (p === "/api/leaderboard") return m === "GET" ? send(req, res, board(url.searchParams.get("id") || "")) : send(req, res, bad("Use GET", 405));
    if (p === "/api/score") return m === "POST" ? send(req, res, submit(body)) : send(req, res, bad("Use POST", 405));
    if (p === "/api/duel") return m === "POST" ? send(req, res, create(body)) : send(req, res, bad("Use POST", 405));
    if ((mt = /^\/api\/duel\/([A-Za-z]{1,8})\/(join|result)$/.exec(p))) {
      if (m !== "POST") return send(req, res, bad("Use POST", 405));
      return send(req, res, mt[2] === "join" ? join(mt[1], body) : result(mt[1], body));
    }
    if ((mt = /^\/api\/duel\/([A-Za-z]{1,8})$/.exec(p))) {
      if (m !== "GET") return send(req, res, bad("Use GET", 405));
      if (!code(mt[1])) return send(req, res, bad("That code is four letters"));
      var room = find(mt[1]);
      return send(req, res, room ? ok(view(room, url.searchParams.get("id") || "")) : bad("No such room. It may have expired.", 404));
    }
    return send(req, res, bad("Not found", 404));
  }

  var server = http.createServer(function (req, res) {
    var wait = limited(clientIp(req));
    if (wait) return send(req, res, bad("Too many requests. Wait a moment.", 429), { "Retry-After": String(wait) });
    if (req.method === "OPTIONS") { res.writeHead(204, headers(req)); return res.end(); }
    var url;
    try { url = new URL(req.url, "http://localhost"); } catch (e) { return send(req, res, bad("Bad request")); }
    if (req.method === "GET" || req.method === "HEAD") return route(req, res, url, null);
    if (req.method !== "POST") return send(req, res, bad("Use GET or POST", 405));
    var size = 0, chunks = [], dead = false;
    req.on("data", function (c) {
      if (dead) return;
      size += c.length;
      if (size > LIMITS.body_bytes) { dead = true; send(req, res, bad("Request too big", 413), { "Connection": "close" }); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", function () {
      if (dead) return;
      var parsed;
      try { parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"); } catch (e) { return send(req, res, bad("Bad request")); }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return send(req, res, bad("Bad request"));
      route(req, res, url, parsed);
    });
    req.on("error", function () { /* a dropped connection: nothing to answer */ });
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 10000;
  return server;
}

module.exports = { createServer: createServer, LIMITS: LIMITS };

if (require.main === module) {
  var port = parseInt(process.env.PORT, 10) || 8787;
  var srv = createServer({
    allowOrigin: process.env.ALLOW_ORIGIN || "",
    dataFile: process.env.DATA_FILE || path.join(__dirname, "data.json"),
    trustProxy: process.env.TRUST_PROXY === "1",
    rateLimit: parseInt(process.env.RATE_LIMIT, 10) || 300
  });
  srv.listen(port, function () { console.log("GRAVITRON server on port " + port); });
}
