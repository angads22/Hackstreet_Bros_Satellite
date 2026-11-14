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
