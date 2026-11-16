// js/live-data.js — owned by Data (yarmee). The only file allowed to call the network
// (SPEC.md, "Live open data"). When the game opens it asks three free, keyless open-data
// services for today's numbers and folds them into EARTH. If a call fails or is slow,
// the snapshot in data/earth.js stays and the game plays exactly as it does offline.
// The tests never load this file, so seeded missions stay repeatable.

(function () {
  if (typeof EARTH === "undefined") return;

  var TIMEOUT_MS = 8000;
  var SOURCES = [
    { id: "sunspots", name: "NOAA SWPC solar cycle indices (SILSO sunspot number)",
      url: "https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json" },
    { id: "eonet-fires", name: "NASA EONET open wildfire events",
      url: "https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&days=30" },
    { id: "eonet-ice", name: "NASA EONET open sea and lake ice events",
      url: "https://eonet.gsfc.nasa.gov/api/v3/events?category=seaLakeIce&status=open" },
    { id: "cwfis", name: "Natural Resources Canada CWFIS satellite hotspots, last 24 hours",
      url: "https://cwfis.cfs.nrcan.gc.ca/geoserver/public/ows?service=WFS&version=2.0.0&request=GetFeature" +
           "&typeName=public:hotspots_last24hrs&resultType=hits" }
  ];

  EARTH.live = {
    status: "snapshot", fetched_at: null, sunspots_through: null,
    sources: SOURCES.map(function (s) { return { id: s.id, name: s.name, ok: false }; }),
    wildfire_now: null, sea_ice_now: null
  };
  if (typeof fetch !== "function") return;
  EARTH.live.status = "loading";

  function get(url, as) {
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT_MS);
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return as === "text" ? r.text() : r.json();
    }, function (e) { clearTimeout(timer); throw e; });
  }

  // Monthly sunspot numbers from 1957 to the latest month. Months not yet observed in the
  // current year repeat the latest value, and sunspots_through says where real data ends.
  function useSunspots(rows) {
    var start = EARTH.solar.sunspots.start_year, table = [], last = null;
    rows.forEach(function (r) {
      var y = parseInt(r["time-tag"].slice(0, 4), 10), m = parseInt(r["time-tag"].slice(5, 7), 10) - 1;
      if (y < start || typeof r.ssn !== "number" || r.ssn < 0) return;
      (table[y - start] = table[y - start] || [])[m] = Math.round(r.ssn * 10) / 10;
      last = r["time-tag"];
    });
    if (!last || table.length < EARTH.solar.sunspots.monthly.length) throw new Error("short sunspot table");
    var lastRow = table[table.length - 1], fill = lastRow[lastRow.length - 1];
    for (var i = 0; i < 12; i++) if (lastRow[i] === undefined) lastRow[i] = fill;
    EARTH.solar.sunspots.monthly = table;
    EARTH.live.sunspots_through = last;
  }

  function dateOf(ev) {
    var g = ev.geometry && ev.geometry.length ? ev.geometry[ev.geometry.length - 1] : null;
    return g && g.date ? g.date.slice(0, 10) : "";
  }

  function eventList(data) {
    return (data.events || []).map(function (ev) { return { title: ev.title, date: dateOf(ev), link: ev.link || "" }; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }

  var jobs = [
    get(SOURCES[0].url).then(useSunspots),
    get(SOURCES[1].url).then(function (d) { return eventList(d); }),
    get(SOURCES[2].url).then(function (d) { return eventList(d); }),
    get(SOURCES[3].url, "text").then(function (xml) {
      var m = /numberMatched="(\d+)"/.exec(xml);
      if (!m) throw new Error("no count");
      return parseInt(m[1], 10);
    })
  ];

  Promise.allSettled(jobs).then(function (res) {
    var live = EARTH.live;
    res.forEach(function (r, i) { live.sources[i].ok = r.status === "fulfilled"; });
    var fires = res[1].status === "fulfilled" ? res[1].value : null;
    var hot = res[3].status === "fulfilled" ? res[3].value : null;
    var ice = res[2].status === "fulfilled" ? res[2].value : null;

    if (fires || hot !== null) {
      var parts = [];
      if (hot !== null) parts.push("In the last 24 hours, satellites made " + hot.toLocaleString("en-US") +
        " fire detections over North America (Canadian Wildland Fire Information System, from NASA MODIS and VIIRS).");
      if (fires && fires.length) parts.push("NASA EONET lists " + fires.length + " open wildfire events this month; the latest is " +
        fires[0].title + " (" + fires[0].date + ").");
      live.wildfire_now = { text: parts.join(" "), events: fires || [], hotspots_24h: hot };
    }
    if (ice && ice.length) {
      live.sea_ice_now = { events: ice,
        text: "NASA EONET is tracking " + ice.length + " open sea and lake ice events right now; the latest is " +
          ice[0].title + " (" + ice[0].date + ")." };
    }
    var ok = live.sources.filter(function (s) { return s.ok; }).length;
    live.status = ok === live.sources.length ? "live" : ok > 0 ? "partial" : "snapshot";
    live.fetched_at = new Date().toISOString();
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof Event === "function") {
      window.dispatchEvent(new Event("livedata"));
    }
  });
})();

// ---------------------------------------------------------------- online features (SPEC.md, "Online features")
// A leaderboard and a quick 1v1 duel, both through the optional server in server/. Defined apart from the open-data
// code above so they exist even when EARTH does not. onlineStatus() is the one rule for "on or off": it looks only at
// the address the page was opened from and at ONLINE (data/online.js). When it says off, nothing here sends anything.
// Every call returns a promise that always resolves: { ok: true, ... } or { ok: false, reason }.
(function () {
  var root = typeof window !== "undefined" ? window : globalThis;
  var FAIL = "Server not reachable";
  var REASONS = {
    file: "Playing from a file.",
    local: "Running on this computer.",
    lan: "Running on a private network.",
    flag: "Offline mode is on (?offline=1).",
    none: "No server is set."
  };

  function config() { return typeof ONLINE === "object" && ONLINE ? ONLINE : { endpoint: "" }; }

  // loc: { protocol, hostname, search } (default: the page's own address). cfg: ONLINE (default: the data file).
  // Returns { on, reason }; reason is "" when on. The address is judged first and the missing endpoint last.
  function onlineStatus(loc, cfg) {
    loc = loc || (typeof location === "object" && location ? location : {});
    cfg = cfg || config();
    var proto = String(loc.protocol || "").toLowerCase();
    var host = String(loc.hostname || "").toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
    var search = String(loc.search || "");
    function off(key) { return { on: false, reason: REASONS[key] }; }
    if (proto === "file:" || proto === "") return off("file");
    if (host === "localhost" || host === "0.0.0.0" || host === "::1" || host === "::" || host === "" ||
        /\.local$/.test(host) || /\.localhost$/.test(host) || /^127\.\d+\.\d+\.\d+$/.test(host)) return off("local");
    var ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (ip) {
      var a = parseInt(ip[1], 10), b = parseInt(ip[2], 10);
      if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) return off("lan");
    }
    // fd00::/8 and fe80::/10 are the private and link-local IPv6 ranges.
    if (/^(fd[0-9a-f]{2}|fe[89ab][0-9a-f]):/.test(host)) return off("lan");
    if (/(^|[?&])offline=1(&|$)/.test(search)) return off("flag");
    if (!cfg || typeof cfg.endpoint !== "string" || !cfg.endpoint.trim()) return off("none");
    return { on: true, reason: "" };
  }

  function base() { return String(config().endpoint || "").trim().replace(/\/+$/, ""); }

  // One request. No network at all when the status is off. Never rejects.
  function call(method, path, body) {
    var st = onlineStatus();
    if (!st.on) return Promise.resolve({ ok: false, off: true, reason: st.reason });
    if (typeof fetch !== "function") return Promise.resolve({ ok: false, reason: FAIL });
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, config().request_timeout_ms || 6000);
    var opts = { method: method, cache: "no-store", credentials: "omit" };
    if (ctl) opts.signal = ctl.signal;
    if (body !== undefined) { opts.headers = { "Content-Type": "application/json" }; opts.body = JSON.stringify(body); }
    return fetch(base() + path, opts).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, json: j }; }, function () { return { status: r.status, json: null }; });
    }).then(function (x) {
      clearTimeout(timer);
      var j = x.json && typeof x.json === "object" ? x.json : null;
      if (x.status >= 200 && x.status < 300 && j) { j.ok = true; return j; }
      // The host in front of the server answers for itself too (ONLINE.md): 403 the game link expired, 503 multiplayer was
      // switched off, 502 the server is down. A 400 carries its own reason (a filtered nickname). 404: the room is gone.
      var hostSays = x.status === 403 ? "Link expired. Reload the page." : x.status === 503 ? "Multiplayer is switched off."
        : x.status === 502 ? "The server is down. Try again soon." : "";
      return { ok: false, status: x.status, reason: j && typeof j.reason === "string" && j.reason ? j.reason : hostSays || FAIL };
    }, function () { clearTimeout(timer); return { ok: false, reason: FAIL }; });
  }

  function q(id) { return id ? "?id=" + encodeURIComponent(id) : ""; }
  function code(c) { return encodeURIComponent(String(c || "").toUpperCase()); }

  var online = {
    // The best runs, newest ranking. id (optional) also returns the player's own best and rank as `you`.
    leaderboard: function (id) { return call("GET", "/api/leaderboard" + q(id)); },
    // entry: { id, nickname, score, won, stars, months_left, reputation } (self-reported).
    submitScore: function (entry) { return call("POST", "/api/score", entry || {}); },
    // who: { id, nickname }. Answers { code, seed }.
    duelCreate: function (who) { return call("POST", "/api/duel", who || {}); },
    duelJoin: function (c, who) { return call("POST", "/api/duel/" + code(c) + "/join", who || {}); },
    // figures: { id, nickname, science, cost_musd, stars, score }.
    duelResult: function (c, figures) { return call("POST", "/api/duel/" + code(c) + "/result", figures || {}); },
    // id (optional): says which player is asking, so the answer can say `you`.
    duelPoll: function (c, id) { return call("GET", "/api/duel/" + code(c) + q(id)); }
  };

  root.LiveData = { onlineStatus: onlineStatus, online: online, failure: FAIL };
})();
