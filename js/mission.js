// js/mission.js — Simulation: the month-by-month mission, seeded events,
// scoring, stars and the limiting factor. Uses helpers from game.js.
//
// This file must never touch the page: no `document`, no HTML.
// Console test:
//   var m = startMission(d); var s; do { s = stepMonth(m); if (s.event) chooseEvent(m, 0); } while (!s.ended); getDebrief(m)

var THIN_MARGIN_RISK = 1.5;   // fail chances x1.5 when mass or power margin is under 10%

// ------------------------------------------------------------------ seeded random
// The seed comes from the design, so the same design replays the same mission.
function designSeed(design) {
  var key = [design.tier, design.objective, design.orbit, design.launcher]
    .concat(design.parts.slice().sort()).join("|");
  var h = 2166136261;                       // FNV-1a hash
  for (var i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function makeRandom(seed) {                 // mulberry32
  var a = seed;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Index of a random event, weighted by its orbit_weight for this orbit.
function pickWeighted(pool, orbitId, rand, year) {
  var sn = sunspots(year, null);
  var weights = pool.map(function (e) {
    var w = (e.orbit_weight && orbitId && e.orbit_weight[orbitId] !== undefined) ? e.orbit_weight[orbitId] : 1;
    // Solar storms follow the real solar cycle (SILSO): common in 1958, rare in 1964.
    if (e.id === "solar-storm" && sn !== null) w *= solarActivityFactor(sn);
    return w;
  });
  var total = weights.reduce(function (a, b) { return a + b; }, 0), r = rand() * total;
  for (var i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
}

// ------------------------------------------------------------------ mission
var missionCounter = 0;

// A copy of the design as it was at launch. Later edits to the player's design
// never change a mission that has already flown.
function copyDesign(design) {
  var copy = { tier: design.tier, objective: design.objective, orbit: design.orbit,
               launcher: design.launcher, parts: design.parts.slice() };
  if (design.campaign) copy.campaign = true;
  if (design.comeback) { copy.comeback = true; copy.contract = design.contract || null; }
  if (design.year) { copy.year = design.year; copy.era = design.era; }
  return copy;
}

function missionId(seed) { return "m" + missionCounter + "-" + seed.toString(36); }

// Campaign flights launched in this page and not yet recorded (by mission id). A launch in the saved log
// that is not here was made by a page that has since closed: its flight is lost, so its cost comes back.
var liveFlights = {};
function refundLostFlights(c) {
  var lost = (c.log || []).filter(function (e) { return e.kind === "launch" && !liveFlights[e.id]; });
  if (!lost.length) return c;
  lost.forEach(function (e) {
    c.treasury_musd = round(c.treasury_musd + e.musd, 3);
    c.flights = Math.max(c.missions.length, c.flights - 1);
  });
  c.log = c.log.filter(function (e) { return lost.indexOf(e) === -1; });
  saveCampaign(c);
  return c;
}
// Called when a flight is recorded: its launch is no longer pending.
function landFlight(c, mission) {
  delete liveFlights[mission.id];
  if (c.log) c.log = c.log.filter(function (e) { return !(e.kind === "launch" && e.id === mission.id); });
}

// Returns null if the design still has blockers: nothing launches past the readiness review.
function startMission(design) {
  if (!design || runChecks(design).blockers.length) return null;
  var launchTotals = getTotals(design);   // before any money moves
  design = copyDesign(design);
  missionCounter += 1;
  var seed = designSeed(design);

  // Campaign: pay at launch, count the flight, and give each flight fresh luck.
  var flight = 0, scienceBefore = 0, contract = null;
  var startYear = design.year || (typeof CAMPAIGN !== "undefined" ? CAMPAIGN.start_year : null);
  if (design.campaign) {
    var c = getCampaign();
    if (!c || c.finished) return null;
    if (!!design.comeback !== isComeback(c)) return null;   // a design from the other mode never flies
    if (design.comeback) contract = contractSnapshot(openContract(c, design.contract));   // the terms it flies for
    startYear = c.year;
    c.treasury_musd = round(c.treasury_musd - launchTotals.cost_musd, 3);
    c.flights = (c.flights || 0) + 1;
    flight = c.flights;
    scienceBefore = c.knowledge_science[design.objective] || 0;
    seed = (seed ^ Math.imul(flight, 2654435761)) >>> 0;
    // The flight lives only in this page until its debrief records it. The log keeps what it cost, so a
    // page closed or reloaded in flight gives the money back (refundLostFlights) instead of losing it.
    var launchId = missionId(seed);
    liveFlights[launchId] = true;
    (c.log = c.log || []).push({ year: c.year, month: isComeback(c) ? c.month : undefined, kind: "launch", id: launchId,
                                 flight: flight, musd: launchTotals.cost_musd });
    saveCampaign(c);
  }

  var orbit = getOrbit(design.orbit);
  var tier = getTier(design.tier);
  var lifetime = orbit ? orbit.lifetime_months : 12;
  // Battery-only satellites fall silent when the battery is spent (Sputnik 1: about 21 days).
  var batteryMonths = batteryLifeMonths(design);
  var batteryLimited = batteryMonths !== null && batteryMonths < lifetime;
  if (batteryLimited) lifetime = Math.max(1, Math.round(batteryMonths));
  var rand = makeRandom(seed);

  // Pick distinct events and distinct months (never month 1 or the last month).
  // Events tied to topics (the optional `objectives` field) fire only on those missions.
  var pool = EVENTS.filter(function (e) { return !e.objectives || e.objectives.indexOf(design.objective) !== -1; });
  var count = Math.min(tier ? tier.events : 1, pool.length, Math.max(0, lifetime - 2));
  var schedule = [];
  var usedMonths = {};
  for (var i = 0; i < count; i++) {
    var ev = pool.splice(pickWeighted(pool, orbit ? orbit.id : null, rand, startYear), 1)[0];
    var month;
    do { month = 2 + Math.floor(rand() * (lifetime - 2)); } while (usedMonths[month]);
    usedMonths[month] = true;
    schedule.push({ month: month, event: ev });
  }
  schedule.sort(function (a, b) { return a.month - b.month; });

  var totals = launchTotals;
  var thin = (totals.margins.mass !== null && totals.margins.mass < LOW_MARGIN) ||
             (totals.margins.power !== null && totals.margins.power < LOW_MARGIN);

  return {
    id: missionId(seed),
    design: design,           // the copy taken at launch
    launch_totals: launchTotals,
    campaign_flight: flight,  // 0 = standalone mission
    science_before: scienceBefore,   // campaign: science already banked on this topic at launch
    comeback: !!design.comeback,     // Ajay's comeback: paid by a contract, not by the knowledge curve
    contract: contract,              // the contract's terms at launch (comeback only), or null
    rand: rand,
    month: 0,
    lifetime_months: lifetime,
    battery_limited: batteryLimited,   // true: the mission ends when the battery runs down
    start_year: startYear,
    science: 0,
    schedule: schedule,
    pending_event: null,
    events_seen: [],          // { id, title, choice, label, protected, failed_part }
    broken: [],               // ids of parts that have failed
    lost_months: 0,           // months still to skip because of events
    months_lost_total: 0,     // every month an event cost, for the score
    science_mult: 1,          // product of event science_mult effects
    extra_cost_musd: 0,       // costs added by events
    thin_margins: thin,
    // Bookkeeping for the debrief:
    lost: { data: 0, power: 0, event: 0 },
    // Real-world tally against NASA data (data/earth.js):
    real: { fires_in_view: 0, fires_reported: 0, months_mapped: 0, dark_months_mapped: 0 },
    ended: false,
    ended_early: false,
    end_reason: null,
    recorded: null            // the result of recordResult, once called
  };
}

function isProtected(design, eventId) {
  return designParts(design).some(function (p) { return p.protects.indexOf(eventId) !== -1; });
}

// A required category with no working parts ends the mission.
function isGenerator(p) { return p.category === "power" && solarPowerW(p) > 0; }
function missingRequired(mission) {
  var parts = designParts(mission.design);
  var working = parts.filter(function (p) {
    return mission.broken.indexOf(p.id) === -1;
  });
  var req = requiredCategories();
  for (var i = 0; i < req.length; i++) {
    var cat = req[i];
    if (!working.some(function (p) { return p.category === cat; })) return cat;
  }
  // A satellite that launched with solar cells dies when the last of them fails: the battery alone
  // cannot keep it alive for long. A battery-only satellite was never relying on cells: it flies on
  // until its battery is spent (its lifetime, set at launch).
  if (parts.some(isGenerator) && !working.some(isGenerator)) return "power";
  return null;
}

// The event as the screen shows it: each choice carries its real odds right now
// (fail_chance_now), including the thin-margin penalty and any protection on board.
function eventWithOdds(mission, event) {
  if (!event) return null;
  var prot = isProtected(mission.design, event.id);
  return {
    id: event.id, title: event.title, text: event.text,
    choices: event.choices.map(function (c) {
      var fc = (c.effect && c.effect.fail_chance) || 0;
      var now = prot ? 0 : Math.min(0.9, fc * (mission.thin_margins ? THIN_MARGIN_RISK : 1));
      return { label: c.label, effect: c.effect, fail_chance_now: round(now, 2) };
    })
  };
}

function stepMonth(mission) {
  if (!mission) return null;
  if (mission.ended || mission.pending_event) {
    return { month: mission.month, science: round(mission.science, 1),
             event: eventWithOdds(mission, mission.pending_event), ended: mission.ended };
  }
  mission.month += 1;
  var cal = calendarMonth(mission.month);

  // Earn this month's science, unless an event cost us the month.
  var year = mission.start_year === null ? null : mission.start_year + Math.floor((mission.month - 1) / 12);
  var rate = scienceRate(mission.design, mission.broken, cal, year);
  var observing = mission.lost_months === 0;
  tallyRealWorld(mission, rate, cal, observing);
  if (!observing) {
    mission.lost_months -= 1;
    mission.lost.event += rate.per_month * mission.science_mult;
  } else {
    var earned = rate.per_month * mission.science_mult;
    mission.science += earned;
    mission.lost.data += rate.ideal_per_month * (1 - rate.data_share) * mission.science_mult;
    mission.lost.power += rate.ideal_per_month * rate.data_share * (1 - rate.power_share) * mission.science_mult;
  }

  var event = null;
  for (var i = 0; i < mission.schedule.length; i++) {
    if (mission.schedule[i].month === mission.month) event = mission.schedule[i].event;
  }
  if (event) mission.pending_event = event;

  if (!event && mission.month >= mission.lifetime_months) {
    mission.ended = true;
    if (mission.battery_limited) mission.end_cause = "batteries";
  }
  return { month: mission.month, science: round(mission.science, 1), event: eventWithOdds(mission, event), ended: mission.ended,
           calendar_month: cal, month_name: MONTH_NAMES[cal], year: year,
           real: realThisMonth(mission.design.objective, cal, year) };
}

// ------------------------------------------------------------------ real NASA data
var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July",
                   "August", "September", "October", "November", "December"];

// Mission month 1 is January of the data year (EARTH.start_month), then it cycles.
function calendarMonth(missionMonth) {
  var start = (typeof EARTH !== "undefined" && EARTH.start_month) ? EARTH.start_month : 0;
  return (start + missionMonth - 1) % 12;
}

// What the real Earth looked like this calendar month, for the Mission screen.
function realThisMonth(objectiveId, cal, year) {
  var e = earthFor(objectiveId);
  if (!e) return null;
  if (e.sunspots) {
    var sn = sunspots(year, cal);
    return sn === null ? null : { sunspots: sn, year: year };
  }
  if (e.soundings) {
    return { soundings: Math.round(ionoSoundingsPerYear(e) * e.monthly_share[cal]), year: e.year };
  }
  if (e.monthly_share) {
    return { fires: Math.round(e.detections * e.monthly_share[cal]), year: e.year };
  }
  if (e.extent_mkm2) {
    return { ice_extent_mkm2: e.extent_mkm2[cal], ice_average_mkm2: e.extent_1981_2010_mkm2[cal],
             daylight_share: e.daylight_share[cal], year: e.year };
  }
  return null;
}

function tallyRealWorld(mission, rate, cal, observing) {
  var e = earthFor(mission.design.objective);
  if (!e) return;
  var useful = rate.instruments.some(function (i) { return i.points > 0; });
  // How well the best working instrument suits the topic: a camera counts fires
  // at half the rate of a thermal imager (it cannot see through smoke or at night).
  var match = rate.instruments.reduce(function (m, i) { return i.points > 0 ? Math.max(m, i.match) : m; }, 0);
  var quality = rate.data_share * rate.power_share * mission.science_mult * match;
  if (e.soundings) {
    var reach = e.orbit_view ? (e.orbit_view[mission.design.orbit] || 0) : 1;
    var sound = ionoSoundingsPerYear(e) * e.monthly_share[cal];   // Alouette's real soundings this month
    mission.real.soundings_alouette = (mission.real.soundings_alouette || 0) + sound;
    if (observing && useful) mission.real.soundings_heard = (mission.real.soundings_heard || 0) + sound * reach * quality;
    return;
  }
  if (e.monthly_share) {
    var view = e.orbit_view ? (e.orbit_view[mission.design.orbit] || 0) : 1;
    var objective = getObjective(mission.design.objective);
    var looks = objective.orbit_fit ? (objective.orbit_fit[mission.design.orbit] || 0) : 1;  // how often it looks
    var fires = e.detections * e.monthly_share[cal];   // this month's real detections
    mission.real.fires_in_view += fires * view;
    if (observing && useful) mission.real.fires_reported += fires * view * looks * quality;
  }
  if (e.extent_mkm2 && observing && useful) {
    mission.real.months_mapped += 1;
    if (e.daylight_share[cal] === 0) mission.real.dark_months_mapped += 1;
  }
}

// One-paragraph comparison with the real Earth for the Debrief screen.
// Live open data (js/live-data.js): the status for the LIVE DATA / SNAPSHOT badge.
function getLiveData() {
  var l = (typeof EARTH !== "undefined" && EARTH.live) ? EARTH.live : null;
  if (!l) return { status: "snapshot", fetched_at: null, sources: [], sunspots_through: null, wildfire_now: null, sea_ice_now: null };
  return JSON.parse(JSON.stringify(l));
}

// Adds a "right now" line from live data to the debrief's real-world summary, when there is one.
function withLiveNow(summary, objectiveId) {
  var l = (typeof EARTH !== "undefined" && EARTH.live) ? EARTH.live : null;
  var now = null;
  if (l && objectiveId === "wildfire" && l.wildfire_now) now = l.wildfire_now.text;
  if (l && objectiveId === "sea-ice" && l.sea_ice_now) now = l.sea_ice_now.text;
  if (l && objectiveId === "solar" && l.sunspots_through) {
    var y = parseInt(l.sunspots_through.slice(0, 4), 10), m = parseInt(l.sunspots_through.slice(5, 7), 10) - 1;
    var sn = sunspots(y, m);
    if (sn !== null) now = "The latest monthly sunspot number, for " + l.sunspots_through + ", is " + Math.round(sn) +
      " (SILSO, via NOAA's Space Weather Prediction Center).";
  }
  if (!summary) return now ? { now: now, text: now } : null;
  summary.now = now;
  return summary;
}

// Alouette 1's average soundings a year over its three busiest years (1963-1965).
function ionoSoundingsPerYear(e) {
  var y = e.soundings_by_year || {};
  return ((y[1963] || 0) + (y[1964] || 0) + (y[1965] || 0)) / 3;
}

function realWorldSummary(mission) {
  var e = earthFor(mission.design.objective);
  if (!e) return null;
  if (e.soundings) {
    var heard = Math.round(mission.real.soundings_heard || 0), pace = mission.real.soundings_alouette || 0;
    var reach = e.orbit_view ? (e.orbit_view[mission.design.orbit] || 0) : 1;
    var top = e.top_stations || [];
    return {
      soundings_heard: heard,
      share_of_alouette: pace > 0 ? round(heard / pace, 3) : 0,
      stations_in_reach_share: reach,
      text: "Alouette 1 swept the ionosphere " + e.soundings.toLocaleString("en-US") + " times between 1962 and 1973, and " +
        e.stations + " ground stations heard it (CSA, digitised Alouette 1 ionograms). The busiest were " +
        (top[0] ? top[0].name + " (" + top[0].soundings.toLocaleString("en-US") + ")" : "") +
        (top[1] ? " and " + top[1].name + " (" + top[1].soundings.toLocaleString("en-US") + ")" : "") +
        ", under the auroral zone. From this orbit your satellite could reach the stations that heard " + Math.round(reach * 100) +
        "% of Alouette's soundings. Over " + mission.month + " months it would have sent about " + heard.toLocaleString("en-US") +
        " soundings home, " + Math.round(100 * (pace > 0 ? heard / pace : 0)) + "% of Alouette's pace." +
        (reach < 1 ? " Alouette flew an 80-degree orbit to pass over the polar stations." : "")
    };
  }
  if (e.sunspots && mission.start_year !== null) {
    var y0 = mission.start_year, sn0 = sunspots(y0, null), all = [];
    e.sunspots.monthly.forEach(function (row) { all.push(mean(row)); });
    var peak = Math.max.apply(null, all), quiet = Math.min.apply(null, all);
    // A flight after the record ends (Ajay's comeback flies today) quotes the latest full year instead.
    var lastYear = e.sunspots.start_year + e.sunspots.monthly.length - 1, when = "In " + y0;
    if (sn0 === null && y0 > lastYear) { sn0 = all[all.length - 1]; when = "In " + lastYear + ", the latest full year on record,"; }
    return {
      year: y0, sunspots: round(sn0, 0),
      text: when + " the Sun averaged " + Math.round(sn0) + " sunspots a month (SILSO, Royal Observatory of Belgium). " +
        "Between " + e.sunspots.start_year + " and " + (e.sunspots.start_year + all.length - 1) + " the yearly average ran from " +
        Math.round(quiet) + " to " + Math.round(peak) + ": the Sun has an 11-year cycle, so when you fly decides how much there is to see. " +
        "The International Geophysical Year was timed for the 1957-58 maximum, the strongest on record."
    };
  }
  if (e.monthly_share) {
    var years = mission.month / 12;
    var seen = mission.real.fires_in_view, reported = mission.real.fires_reported;
    var view = e.orbit_view ? (e.orbit_view[mission.design.orbit] || 0) : 1;
    return {
      fires_per_year: e.detections,
      share_in_view: view,
      fires_reported: Math.round(reported),
      share_reported: seen > 0 ? round(reported / (e.detections * years), 3) : 0,
      text: "In " + e.year + ", NASA's MODIS instruments made " + e.detections.toLocaleString("en-US") +
        " active-fire detections worldwide. From this orbit your satellite could see " + Math.round(view * 100) +
        "% of them. Over " + mission.month + " months it would have reported about " +
        Math.round(reported).toLocaleString("en-US") + " fire detections, " +
        Math.round(100 * reported / (e.detections * Math.max(years, 1 / 12))) + "% of all those NASA recorded."
    };
  }
  if (e.extent_mkm2) {
    var sep = 8, drop = Math.round(100 * (1 - e.extent_mkm2[sep] / e.extent_1981_2010_mkm2[sep]));
    var dark = e.daylight_share.filter(function (x) { return x === 0; }).length;
    return {
      september_extent_mkm2: e.extent_mkm2[sep],
      september_drop_share: drop / 100,
      months_mapped: mission.real.months_mapped,
      dark_months_mapped: mission.real.dark_months_mapped,
      text: "In September " + e.year + ", Arctic sea ice shrank to " + e.extent_mkm2[sep] +
        " million km2, " + drop + "% below the 1981-2010 average (NSIDC). " +
        (mission.real.months_mapped === 0
          ? "Your satellite never mapped the ice."
          : "Your satellite mapped the ice in " + mission.real.months_mapped + " of " + mission.month + " months, " +
            (mission.real.dark_months_mapped
              ? "including " + mission.real.dark_months_mapped + " months of polar night, when only radar can see."
              : "but none in the " + dark + " months of polar night each year, when only radar can see."))
    };
  }
  return null;
}

// `choice` is the index of the chosen option in event.choices.
// Returns what happened: { id, title, choice, label, protected, failed_part,
// ended, ended_early }. failed_part is a part id or null.
function chooseEvent(mission, choice) {
  if (!mission) return null;
  var event = mission.pending_event;
  if (!event) return null;
  // An index outside the list counts as the first choice, and is recorded as such.
  if (typeof choice !== "number" || !event.choices[choice]) choice = 0;
  var picked = event.choices[choice];
  var effect = picked.effect || {};
  var prot = isProtected(mission.design, event.id);

  // Protection cancels the penalty of the riskiest choice (the one with a fail_chance).
  var riskiest = !!(prot && effect.fail_chance);
  var record = { id: event.id, title: event.title, choice: choice, label: picked.label,
                 protected: riskiest, failed_part: null };   // true only when protection applied

  if (!riskiest) {
    if (effect.lose_months) { mission.lost_months += effect.lose_months; mission.months_lost_total += effect.lose_months; }
    if (effect.science_mult) mission.science_mult *= effect.science_mult;
    if (effect.cost_musd) mission.extra_cost_musd += effect.cost_musd;
  }
  if (effect.fail_chance && effect.fails && !riskiest) {
    var chance = effect.fail_chance * (mission.thin_margins ? THIN_MARGIN_RISK : 1);
    if (mission.rand() < Math.min(chance, 0.9)) {
      var victims = designParts(mission.design).filter(function (p) {
        return p.category === effect.fails && mission.broken.indexOf(p.id) === -1;
      });
      if (victims.length) {
        var victim = victims[Math.floor(mission.rand() * victims.length)];
        mission.broken.push(victim.id);
        record.failed_part = victim.id;
      }
    }
  }
  mission.events_seen.push(record);
  mission.pending_event = null;

  var missing = missingRequired(mission);
  if (missing) {
    // Count the science we will now never collect as lost to the event.
    var rate = scienceRate(mission.design, []);
    mission.lost.event += rate.per_month * mission.science_mult * (mission.lifetime_months - mission.month);
    mission.ended = true;
    mission.ended_early = true;
    mission.end_reason = { event: event.id, title: event.title, category: missing, part: record.failed_part };
  } else if (mission.month >= mission.lifetime_months) {
    mission.ended = true;
    if (mission.battery_limited) mission.end_cause = "batteries";
  }
  return { id: record.id, title: record.title, choice: record.choice, label: record.label,
           protected: record.protected, failed_part: record.failed_part,
           ended: mission.ended, ended_early: mission.ended_early };
}

// ------------------------------------------------------------------ debrief
// Score (SPEC.md "Scoring"): science 50, efficiency 15, margins 15, events 10,
// novelty 10. Three stars also need the science target. Lost months and event
// costs count against everything they affect.
var EVENT_PENALTY = { part: 4, month: 1, per_musd: 2 };   // points off the 10 event points

function getDebrief(mission) {
  if (!mission) return null;
  var design = mission.design;
  var objective = getObjective(design.objective);
  var totals = mission.launch_totals || getTotals(design);
  var target = objective ? objective.science_target : 100;

  var k = knowledgeResult(mission);
  var spent = totals.cost_musd + mission.extra_cost_musd;
  var scienceShare = Math.min(1, mission.science / target);
  var efficiency = spent > 0 ? Math.min(1, (k.payout_musd / spent) / 1.5) : 0;
  var massOk = totals.margins.mass !== null && totals.margins.mass >= LOW_MARGIN;
  var powerOk = totals.margins.power !== null && totals.margins.power >= LOW_MARGIN;
  var partsLost = mission.events_seen.filter(function (e) { return e.failed_part; }).length;
  var eventPoints = Math.max(0, 10 - EVENT_PENALTY.part * partsLost - EVENT_PENALTY.month * mission.months_lost_total -
                                EVENT_PENALTY.per_musd * mission.extra_cost_musd);

  var parts = {
    science: round(50 * scienceShare, 1),
    efficiency: round(15 * efficiency, 1),
    margins: (massOk ? 7.5 : 0) + (powerOk ? 7.5 : 0),
    events: round(eventPoints, 1),
    novelty: round(10 * k.novelty, 1)
  };
  var score = Math.round(parts.science + parts.efficiency + parts.margins + parts.events + parts.novelty);
  var stars = score >= 90 ? 3 : score >= 70 ? 2 : score >= 50 ? 1 : 0;
  if (stars === 3 && mission.science < target) stars = 2;   // 3 stars need the target

  var lim = limitingFactor(mission, totals, scienceShare);
  // Ajay's comeback: the client pays in proportion to the data, plus the 3-star bonus (score and stars are unchanged).
  var cpay = mission.contract ? contractPay(mission.contract, design, mission.science, k.new_data, stars) : null;
  var kp = "";
  if (mission.campaign_flight) {
    if (k.nothing_new && cpay) kp = "Nothing new: this topic's data has already been collected, so the client paid nothing. Take a contract on another topic.";
    else if (k.nothing_new) kp = "Nothing new: this topic's data has already been collected, so the flight earned no money and no science points. Try another mission type.";
    // The 1957 campaign pays by the knowledge curve; a comeback client pays by the contract, so these two lines do not apply there.
    else if (mission.comeback) kp = "";
    else if (k.novelty < 0.15) kp = DEBRIEF.saturated || "";
    // Only the first real look at a topic (as settleCampaign's first_look): later flights add less.
    else if (k.knowledge_before < 0.05 && k.new_data > 0) kp = DEBRIEF.breakthrough || "";
  }
  return {
    score: score,
    stars: stars,
    limiting: lim.key,
    suggestion: lim.suggestion,
    // Extra values for the debrief screen:
    breakdown: parts,
    science: round(mission.science, 1),
    science_target: target,
    paragraph: DEBRIEF[lim.key] || "",
    real_mission: objective ? objective.real_mission : "",
    real_world: withLiveNow(realWorldSummary(mission), mission.design.objective),
    closest_mission: closestMission(design),
    limiting_name: disciplineName(lim),
    segments: segmentLines(mission, totals, k, cpay),
    events: mission.events_seen,
    ended_early: mission.ended_early,
    payout_musd: cpay ? round(cpay.paid_musd + cpay.bonus_musd, 3) : k.payout_musd,
    contract_paid_musd: cpay ? cpay.paid_musd : null,     // comeback only: the client's pay for the data
    contract_bonus_musd: cpay ? cpay.bonus_musd : null,   // comeback only: the 3-star bonus (0 below 3 stars)
    knowledge_before: k.knowledge_before,
    knowledge_after: k.knowledge_after,
    novelty: k.novelty,
    new_data: k.new_data,
    nothing_new: !!(mission.campaign_flight && k.nothing_new),
    topic_complete: !!(mission.campaign_flight && k.topic_complete),
    spent_musd: round(spent, 3),
    best_next_topic: mission.campaign_flight ? bestNextTopic(design.objective) : null,
    knowledge_paragraph: kp
  };
}

// ------------------------------------------------------------------ knowledge and payout
// knowledge(S) = 1 - exp(-S / knowledge_scale): the share of a topic the player knows
// after S science points. A model of diminishing returns, not a measured fact.
function knowledgeOf(objective, S) {
  if (!objective || !objective.knowledge_scale) return 0;
  return 1 - Math.exp(-S / objective.knowledge_scale);
}

// Payout for sending home `science` points on a topic where `before` points were already known.
// Each mission type has a data cap (SPEC.md, "The core loop"): only data under the cap is new.
function dataCap(objective) {
  var n = typeof CAMPAIGN !== "undefined" && CAMPAIGN.cap_scales ? CAMPAIGN.cap_scales : 0;
  return objective && objective.knowledge_scale && n ? objective.knowledge_scale * n : Infinity;
}
function newDataFor(objective, before, science) {
  return Math.max(0, Math.min(science, dataCap(objective) - before));
}

function payoutFor(objective, before, science) {
  var floor = typeof CAMPAIGN !== "undefined" ? CAMPAIGN.repeat_floor_musd : 0;
  var cap = dataCap(objective), raw = science;
  science = newDataFor(objective, before, science);   // rewards are for new data only
  var kb = knowledgeOf(objective, before), ka = knowledgeOf(objective, before + science);
  var gain = ka - kb;
  var first = knowledgeOf(objective, Math.min(raw, cap));   // what a first mission would have gained
  var value = objective && objective.value_musd ? objective.value_musd : 0;
  return {
    payout_musd: round(Math.max(value * gain, science > 0 ? floor : 0), 3),
    knowledge_before: round(kb, 3),
    knowledge_after: round(ka, 3),
    novelty: first > 0 ? round(Math.min(1, gain / first), 3) : 0,
    new_data: round(science, 1),
    data_left: isFinite(cap) ? round(Math.max(0, cap - before - science), 1) : null,
    topic_complete: isFinite(cap) && before + science >= cap,
    nothing_new: raw > 0 && science === 0
  };
}

// Without a campaign, a mission is scored as the first one on its topic.
function knowledgeResult(mission) {
  var objective = getObjective(mission.design.objective);
  return payoutFor(objective, mission.campaign_flight ? mission.science_before : 0, mission.science);
}

// The open topic that would pay the most for a typical mission (its science target).
function bestNextTopic(currentId) {
  var c = getCampaign();
  if (!c) return null;
  var best = null, bestPay = -1;
  OBJECTIVES.forEach(function (o) {
    if (!isObjectiveAvailable(o.id) || o.id === currentId && (c.knowledge_science[o.id] || 0) >= dataCap(o)) return;
    var pay = payoutFor(o, c.knowledge_science[o.id] || 0, o.science_target).payout_musd;
    if (pay > bestPay) { bestPay = pay; best = o.id; }
  });
  return best;
}

// The single thing that most limited the mission, and one concrete change.
// Every suggestion must be something the player can actually do with what this design has: a part that exists
// for it (its era, or the campaign's research), that fits the body and the rocket it flew, and an orbit that
// rocket reaches. A standalone mission (Part 1) never changes the rocket: a walkthrough step may have set it.
// A comeback never changes the orbit its contract names, nor the topic. Returns { key, discipline?, suggestion,
// change }: change is what the suggestion asks for ({ add, remove, orbit, launcher }), or null.
function limitingFactor(mission, totals, scienceShare) {
  var design = mission.design;
  var objective = getObjective(design.objective);
  var orbit = getOrbit(design.orbit);
  var target = objective ? objective.science_target : 100;
  var era1957 = !!(mission.campaign_flight && !mission.comeback);   // the 1957 campaign: locked parts wait for research
  function say(key, text, change, discipline) {
    var out = { key: key, suggestion: text, change: change || null };
    if (discipline) out.discipline = discipline;
    return out;
  }

  if (mission.ended_early) {
    var r = mission.end_reason, part = getPart(r.part);
    var ev = findById(EVENTS, r.event);
    var generator = r.category === "power" && part && isGenerator(part) &&
      designParts(design).some(function (p) { return p.category === "power" && !isGenerator(p) && mission.broken.indexOf(p.id) === -1; });
    var head = (mission.science >= target ? "Target reached first. " : "") + r.title + ": " +
      (part ? "your " + inText(part.name) + " failed" : "a part failed") +
      (generator ? ", and a battery alone cannot keep a satellite alive. " : ", and it was your only " + CATEGORY_WORDS[r.category] + ". ");
    var guard = bestChange(mission, PARTS.filter(function (p) { return (p.protects || []).indexOf(r.event) !== -1; }).map(function (p) { return p.id; }), false);
    // A spare does the same job: a second generator, or an instrument that also counts for this topic.
    var spare = guard ? null : bestChange(mission, PARTS.filter(function (p) {
      return p.category === r.category && (!generator || isGenerator(p)) && (!part || p.id !== part.id) &&
        (p.category !== "instrument" || !objective || p.tags.some(function (t) { return objective.wants.indexOf(t) !== -1; }));
    }).map(function (p) { return p.id; }), false, true);
    var safe = ev ? ev.choices.filter(function (c) { return !(c.effect && c.effect.fail_chance); })[0] : null;
    var choice = safe ? "“" + safe.label + "”" : "the safer option";
    if (guard) return say("event", head + changeText(guard) + ", which guards against it, or pick " + choice + " next time.", guard);
    if (spare) return say("event", head + "Carry a spare: " + lcFirst(changeText(spare)) + ", or pick " + choice + " next time.", spare);
    return say("event", head + "Next time, pick " + choice + ".");
  }

  // A battery-only satellite that fell silent: the history lesson that leads to solar cells.
  if (mission.end_cause === "batteries" && scienceShare < 1) {
    var silent = "Your batteries ran down after " + mission.month + " month" + (mission.month > 1 ? "s" : "") +
      " and the satellite fell silent, as Sputnik 1 did after 21 days. ";
    var cells = bestChange(mission, PARTS.filter(isGenerator).map(function (p) { return p.id; }), true);
    if (cells) return say("power", silent + changeText(cells) + " so the Sun keeps it running.", cells);
    var bigger = bestChange(mission, PARTS.filter(function (p) { return p.battery_wh; }).map(function (p) { return p.id; }), true);
    if (bigger) return say("power", silent + changeText(bigger) + ": it stores more, so the satellite lasts longer.", bigger);
    if (era1957 && PARTS.some(function (p) { return isGenerator(p) && !isPartAvailable(p.id, design); })) {
      return say("power", silent + "Solar cells would keep it running: research them.");
    }
    // Instruments that earn nothing are the bigger problem: no power source helps them (the design branches below).
    if (scienceRate(design, []).per_month > 0) return say("power", silent + "Parts that draw less would make the battery last longer.");
  }

  // An orbit that cannot see the target at all comes before everything else.
  if (objective && orbit && objective.orbit_fit && objective.orbit_fit[orbit.id] === 0) {
    var seeing = orbitChange(mission, function (o) { return objective.orbit_fit[o.id] > 0; });
    return say("design", "From " + inText(orbit.name) + " the spacecraft cannot see what " + inText(objective.name) + " needs. " +
      (seeing ? orbitText(seeing) + " instead." + thrusterNote(seeing) : "Pick an orbit that can, then clear what the readiness review asks."), seeing, "orbit");
  }

  var lost = mission.lost;
  var biggest = Math.max(lost.data, lost.power, lost.event);
  var potential = mission.science + lost.data + lost.power + lost.event;
  if (biggest > 0.05 * potential && scienceShare < 1) {
    if (biggest === lost.data) {
      var dataHead = "Only " + formatData(totals.data_returned_gb_day) + " of the " + formatData(totals.data_gb_day) +
        " made each day reached the ground. ";
      var radio = bestChange(mission, PARTS.filter(function (p) { return p.category === "comms"; }).map(function (p) { return p.id; }), true);
      var contact = orbitChange(mission, function (o) { return o.downlink_mult > (orbit ? orbit.downlink_mult : 0); }, true);
      if (radio || contact) {
        return say("data", dataHead + (radio ? changeText(radio) : "") + (radio && contact ? ", or " + lcFirst(orbitText(contact)) : contact ? orbitText(contact) : "") +
          (contact ? " for longer ground contact." : ".") + thrusterNote(contact), radio || contact);
      }
      var lighter = bestChange(mission, PARTS.filter(function (p) { return p.category === "instrument"; }).map(function (p) { return p.id; }), true, false, true);
      if (lighter) return say("data", dataHead + changeText(lighter) + ": it makes less data, so more of it gets home.", lighter);
      return say("data", dataHead + "No radio or orbit you can use sends more: carry an instrument that makes less data.");
    }
    if (biggest === lost.power) {
      if (totals.power_gen_w < totals.power_draw_w) {
        return say("power", "Your panels make " + totals.power_gen_w + " W but the parts draw " +
          totals.power_draw_w + " W. Add or enlarge a solar panel, or cut the draw.");
      }
      var store = bestChange(mission, PARTS.filter(function (p) { return p.battery_wh; }).map(function (p) { return p.id; }), true);
      if (store) return say("power", "Your instruments switched off in Earth's shadow. " + changeText(store) + " to carry them through the eclipse.", store);
      return say("power", "Your instruments switched off in Earth's shadow, and no battery you can fit carries a " + totals.power_draw_w +
        " W satellite through it. Choose parts that draw less.");
    }
    return say("event", "Events cost you months of observing. The safer choice, or a part that guards against an event, keeps the mission running.");
  }

  if (scienceShare < 1) {
    if (totals.margins.budget !== null && totals.margins.budget < LOW_MARGIN) {
      var cheaper = design.year && !design.campaign ? null : launcherChange(mission, function (l) { return l.cost_musd < (getLauncher(design.launcher) || {}).cost_musd; });
      return say("budget", "You spent " + Math.round((1 - totals.margins.budget) * 100) + "% of the budget. " +
        (cheaper ? "The " + cheaper.launcherName + " is cheaper and still carries it, which frees money for better instruments."
                 : "Cheaper parts would free money for better instruments."), cheaper);
    }
    if (totals.margins.mass !== null && totals.margins.mass < LOW_MARGIN) {
      var roomier = design.year && !design.campaign ? null : launcherChange(mission, function (l) {
        return ((l.capacity_kg || {})[design.orbit] || 0) > totals.capacity_kg; });
      return say("mass", "The rocket was nearly full. " + (roomier ? "The " + roomier.launcherName + " carries more, or lighter parts would give you room."
                                                                    : "Lighter parts would give you room."), roomier);
    }
    var rate = scienceRate(design, []);
    if (rate.instruments.some(function (i) { return i.smeared && i.match > 0; })) {
      var steady = bestChange(mission, PARTS.filter(function (p) { return p.category === "attitude" && p.tags.indexOf("three-axis") !== -1; })
        .map(function (p) { return p.id; }), true);
      var later = PARTS.filter(function (p) { return p.category === "attitude" && p.tags.indexOf("three-axis") !== -1; })[0];
      return say("design", "Your satellite spun, so its pictures were smeared, as TIROS-1's were. " +
        (steady ? changeText(steady) + " to hold it steady." : era1957 ? "Research three-axis control to hold it steady."
                : later && design.year && !design.campaign && itemYear("parts", later.id) > design.year
                  ? "Three-axis control would hold it steady: it arrives in " + itemYear("parts", later.id) + "."
                  : "Three-axis control would hold it steady, on a body and rocket with room for it."), steady, "attitude");
    }
    var instrumentIds = PARTS.filter(function (p) { return p.category === "instrument"; }).map(function (p) { return p.id; });
    var weak = rate.instruments.filter(function (i) { return i.match === 0 || !i.sharp_enough; });
    if (weak.length) {
      var suit = bestChange(mission, instrumentIds, true);
      return say("design", "Some instruments earned nothing: wrong type for this objective, or too blurry from this orbit. " +
        (suit ? changeText(suit) + "." : "Swap them for ones that suit it."), suit, "instruments");
    }
    // A wanted instrument type nobody carries is the cheapest way to more science.
    var carried = designParts(design).filter(function (p) { return p.category === "instrument"; })
      .reduce(function (tags, p) { return tags.concat(p.tags); }, []);
    var wanted = objective ? objective.wants.filter(function (t) { return carried.indexOf(t) === -1; }) : [];
    var extra = bestChange(mission, PARTS.filter(function (p) {
      return p.category === "instrument" && p.tags.some(function (t) { return wanted.indexOf(t) !== -1; }); }).map(function (p) { return p.id; }), true, false, false, true);
    if (extra) {
      return say("design", "Nothing ran short, but one instrument was not enough. " + changeText(extra) + " as well; this objective counts it too.", extra, "instruments");
    }
    var better = orbitChange(mission, function () { return true; }, true);
    if (better) return say("design", "Nothing ran short, but the science fell below target. " + inText(getOrbit(better.orbit).name).replace(/^./, function (x) { return x.toUpperCase(); }) +
      " suits this objective better" + (better.launcher ? ", on the " + better.launcherName : "") + "." + thrusterNote(better), better, "orbit");
    var sharper = bestChange(mission, instrumentIds, true);
    if (sharper) return say("design", "Nothing ran short, but the science fell below target. " + changeText(sharper) + ": it earns more.", sharper, "instruments");
    return say("design", "Nothing ran short, but the science fell below target. No single change you can make earns more: try a different design.", null, "instruments");
  }
  // In a campaign there is no "next tier": the next step is the lab, or another topic.
  if (mission.comeback) return say("none", "Target reached. Pay back the lenders, or take the next contract.");
  if (mission.campaign_flight) return say("none", "Target reached. Spend the science in the lab, or fly a different topic.");
  // Tiers are chosen as a ladder only in the old tier select (no era); Part 1's steps and the last tier have no next one.
  var ti = TIERS.map(function (t) { return t.id; }).indexOf(design.tier);
  if (!design.year && TIERS[ti + 1]) return say("none", "Target reached. Try the next tier, or reach it on a smaller budget.");
  return say("none", "Target reached. Now try it for less money.");
}

// ---- advice the player can act on
var CATEGORY_WORDS = { structure: "body", instrument: "instrument", power: "power source", comms: "radio", computer: "computer",
                       attitude: "attitude control", propulsion: "thruster" };
// A name inside a sentence: the first letter lower-cased, unless the name starts with a proper noun or an acronym.
var KEEP_CAPITAL = /^(Explorer|Nimbus|TIROS|Geiger|Arctic|Earth|Sun|Alouette|Li-ion|Thor|Juno|Vanguard)\b|^[A-Z0-9]{2}|^[A-Z]-/;
function inText(name) { return !name ? "" : KEEP_CAPITAL.test(name) ? name : lcFirst(name); }

// The flown design with one change, as the player would build it for the next flight.
function variantOf(design, change) {
  var v = copyDesign(design);
  (change.remove || []).forEach(function (id) { removePart(v, id); });
  (change.add || []).forEach(function (id) { addPart(v, id); });
  if (change.orbit) v.orbit = change.orbit;
  if (change.launcher) v.launcher = change.launcher;
  return v;
}
// Could the changed design launch? Only what the change itself affects counts: the contract (already flown) and
// the calendar do not, and money is judged against what this flight had to spend at launch.
var ADVICE_IGNORES = ["budget", "no-contract", "contract-topic", "contract-orbit", "comeback-over", "no-comeback", "buyout-open", "too-late"];
function canFly(mission, v) {
  if (runChecks(v).blockers.some(function (b) { return ADVICE_IGNORES.indexOf(b.id) === -1; })) return false;
  var budget = mission.launch_totals ? mission.launch_totals.budget_musd : budgetFor(v);
  return budget === null || budget === undefined || getTotals(v).cost_musd <= budget + 1e-9;
}
// The best way to fit one of `ids` (beside the parts of its category, or in place of one of them) that this design
// can launch with. needGain: it must raise the expected science. spare: only beside (a second part of the category).
// lessData: it must make less data than the part it replaces. newOnly: only beside, as an extra instrument.
function bestChange(mission, ids, needGain, spare, lessData, newOnly) {
  var d = mission.design, base = previewScience(d).total, best = null;
  ids.forEach(function (id) {
    var p = getPart(id);
    if (!p || d.parts.indexOf(id) !== -1 || !isPartAvailable(id, d)) return;
    var same = designParts(d).filter(function (q) { return q.category === p.category; });
    var options = [{ add: [id] }];
    if (!spare && !newOnly) same.forEach(function (q) { options.push({ add: [id], remove: [q.id], instead: q.id }); });
    options.forEach(function (ch) {
      if (lessData && !(ch.instead && (p.data_gb_day || 0) < (getPart(ch.instead).data_gb_day || 0))) return;
      var v = variantOf(d, ch);
      if (!canFly(mission, v)) return;
      var gain = previewScience(v).total - base;
      if (needGain && !(gain > 0.05)) return;
      var cost = getTotals(v).cost_musd, mass = getTotals(v).mass_kg;
      if (!best || gain > best.gain + 0.05 || (Math.abs(gain - best.gain) <= 0.05 && (mass < best.mass - 1e-9 || (mass === best.mass && cost < best.cost)))) {
        best = { add: ch.add, remove: ch.remove || [], part: id, instead: ch.instead || null, gain: gain, cost: cost, mass: mass };
      }
    });
  });
  return best;
}
function changeText(ch) {
  var p = getPart(ch.part);
  return ch.instead ? "Swap your " + inText(getPart(ch.instead).name) + " for the " + inText(p.name) : "Fit the " + inText(p.name);
}
// Another orbit (passing `test`) that this design reaches and can launch to, best first by expected science. A
// standalone mission keeps its rocket; a campaign or comeback flight may take the cheapest one that carries it.
// A comeback contract that names an orbit fixes it. needGain: it must raise the expected science.
function orbitChange(mission, test, needGain) {
  var d = mission.design;
  if (mission.contract && mission.contract.orbit) return null;
  var base = previewScience(d).total, best = null;
  ORBITS.forEach(function (o) {
    if (o.id === d.orbit || !test(o)) return;
    var rockets = d.year && !d.campaign ? [d.launcher] :
      LAUNCHERS.filter(function (l) { return isLauncherAvailable(l.id, d); })
        .sort(function (a, b) { return (a.id === d.launcher ? -1 : 0) - (b.id === d.launcher ? -1 : 0) || a.cost_musd - b.cost_musd; }).map(function (l) { return l.id; });
    // An orbit that needs the satellite's own thrust (polar orbit since 1995, geostationary) may also need a thruster.
    var thrusters = [null].concat(PARTS.filter(function (p) { return p.category === "propulsion" && isPartAvailable(p.id, d); })
      .sort(function (a, b) { return a.mass_kg - b.mass_kg; }).map(function (p) { return p.id; }));
    for (var i = 0; i < rockets.length; i++) {
      for (var j = 0; j < thrusters.length; j++) {
        var ch = { orbit: o.id, launcher: rockets[i] !== d.launcher ? rockets[i] : null, add: thrusters[j] ? [thrusters[j]] : [] };
        if (thrusters[j] && designParts(d).some(function (p) { return p.category === "propulsion"; })) continue;
        var v = variantOf(d, ch);
        if (!canFly(mission, v)) continue;
        var gain = previewScience(v).total - base;
        if (needGain && !(gain > 0.05)) return;
        if (!best || gain > best.gain) best = { orbit: o.id, launcher: ch.launcher, launcherName: ch.launcher ? inText(getLauncher(ch.launcher).name) : null,
                                               add: ch.add, thruster: thrusters[j], gain: gain };
        return;
      }
    }
  });
  return best;
}
function orbitText(ch) {
  return "Fly in " + inText(getOrbit(ch.orbit).name) + (ch.launcher ? " on the " + ch.launcherName : "");
}
function thrusterNote(ch) { return ch && ch.thruster ? " That orbit needs a thruster: fit the " + inText(getPart(ch.thruster).name) + "." : ""; }
// Another rocket (passing `test`) that this design can launch on, cheapest first.
function launcherChange(mission, test) {
  var d = mission.design;
  var l = LAUNCHERS.filter(function (x) { return x.id !== d.launcher && isLauncherAvailable(x.id, d) && test(x); })
    .sort(function (a, b) { return a.cost_musd - b.cost_musd; })
    .filter(function (x) { return canFly(mission, variantOf(d, { launcher: x.id })); })[0];
  return l ? { launcher: l.id, launcherName: inText(l.name) } : null;
}

// ------------------------------------------------------------------ progress
// Two stars on a tier unlocks the next one (SPEC.md, "Difficulty tiers").
// Saved in localStorage when the browser allows it; otherwise kept in memory
// for this visit only, so the game still runs in a private window or in Node.
var PROGRESS_KEY = "smdg-progress-v1";
var memoryProgress = null;

function emptyProgress() { return { best_stars: {}, best_score: {}, best_stars_by_era: {} }; }

function getProgress() {
  try {
    if (typeof localStorage !== "undefined") {
      var raw = localStorage.getItem(PROGRESS_KEY);
      if (raw) return repairProgress(JSON.parse(raw));
    }
  } catch (e) { /* storage blocked or unreadable: fall through to memory */ }
  return memoryProgress ? repairProgress(memoryProgress) : emptyProgress();
}
// A record read back from the browser keeps every part that is well formed; a broken part starts empty,
// so a damaged record can never stop the title screen from drawing.
function repairProgress(p) {
  p = isRecord(p) ? p : {};
  return { best_stars: isNumberMap(p.best_stars) ? p.best_stars : {}, best_score: isNumberMap(p.best_score) ? p.best_score : {},
           best_stars_by_era: isNumberMap(p.best_stars_by_era) ? p.best_stars_by_era : {} };
}

function saveProgress(p) {
  memoryProgress = p;
  try { if (typeof localStorage !== "undefined") localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); }
  catch (e) { /* storage blocked: memory copy still works */ }
}

function isTierUnlocked(tierId) {
  var i = TIERS.map(function (t) { return t.id; }).indexOf(tierId);
  if (i <= 0) return i === 0;
  return (getProgress().best_stars[TIERS[i - 1].id] || 0) >= 2;
}

// Call once when a mission ends. Returns { stars, best_stars, unlocked }
// where `unlocked` is the id of a tier this result just opened, or null.
function recordResult(mission) {
  if (!mission || !mission.ended) return null;           // only finished missions count
  if (mission.recorded) return mission.recorded;         // a second call changes nothing
  var tierId = mission.design.tier;
  var d = getDebrief(mission);
  var p = getProgress();
  var i = TIERS.map(function (t) { return t.id; }).indexOf(tierId);
  var nextId = TIERS[i + 1] ? TIERS[i + 1].id : null;
  var wasLocked = nextId ? !isTierUnlocked(nextId) : false;
  p.best_stars[tierId] = Math.max(p.best_stars[tierId] || 0, d.stars);
  if (mission.design.era) {
    p.best_stars_by_era = p.best_stars_by_era || {};
    var eraWasOpen = getEras().map(function (e) { return e.unlocked; });
    p.best_stars_by_era[mission.design.era] = Math.max(p.best_stars_by_era[mission.design.era] || 0, d.stars);
  }
  p.best_score[tierId] = Math.max(p.best_score[tierId] || 0, d.score);
  saveProgress(p);
  mission.recorded = { stars: d.stars, best_stars: p.best_stars[tierId],
                       unlocked: nextId && wasLocked && isTierUnlocked(nextId) ? nextId : null,
                       era_unlocked: null };
  if (mission.design.era) {
    getEras().forEach(function (e, i) { if (e.unlocked && !eraWasOpen[i]) mission.recorded.era_unlocked = e.id; });
  }
  if (mission.campaign_flight) settleCampaign(mission, d, mission.recorded);
  return mission.recorded;
}

function resetProgress() { saveProgress(emptyProgress()); }

// ------------------------------------------------------------------ campaign
// One saved campaign per browser (SPEC.md, "Scoring" and "Functions"). Saved in
// localStorage when allowed, otherwise in memory; a save from another version is discarded.
var CAMPAIGN_KEY = "smdg-campaign";
var memoryCampaign = null;
var cheapestCache = {};

function campaignVersion() { return typeof CAMPAIGN !== "undefined" ? CAMPAIGN.save_version : 1; }

var checkedRaw = null;   // the last saved text that passed validCampaign (it is read very often)
function getCampaign() {
  var c = null;
  try {
    if (typeof localStorage !== "undefined") {
      var raw = localStorage.getItem(CAMPAIGN_KEY);
      if (raw) {
        c = JSON.parse(raw);
        // A save of the wrong shape (an old bug, or a hand-edited browser store) is ignored, and so is one from a newer
        // game: neither is deleted. A save from the game before this one is upgraded in place (upgradeCampaign).
        if (raw !== checkedRaw) {
          var upgraded = upgradeCampaign(c);
          if (!validCampaign(c)) return null;
          if (upgraded) { raw = JSON.stringify(c); localStorage.setItem(CAMPAIGN_KEY, raw); }
          checkedRaw = raw;
        }
      }
    }
  } catch (e) { c = null; }
  if (!c) c = memoryCampaign;
  if (!c || c.version !== campaignVersion()) return null;
  return refundLostFlights(c);
}

// ---- upgrading a save from the game before this one, in place
// A campaign saved at SAVE_UPGRADES_FROM (the 0.9 game) is brought to the current version and nothing is thrown away:
// every field and value it has stays exactly as it is, and only what the new version adds is filled in with a safe
// default. A comeback gets a random seed (its contracts are already dealt, so it changes nothing now), buyout "none"
// (the offer comes after its next settled flight, as it does for any run) and its own starting debt, so a run keeps
// the debt the player was given even though the tuning of new runs changed. A save with a field missing that the new
// version added is never refused for it. Returns true if c was changed (the caller saves it back).
var SAVE_UPGRADES_FROM = 4;
var LEGACY_START_DEBT = { training: 30, standard: 40, expert: 45 };   // what the debt of each difficulty was at version 4
function upgradeCampaign(c) {
  if (!isRecord(c) || typeof CAMPAIGN === "undefined") return false;
  var changed = false, wasOld = false;
  if (c.version === SAVE_UPGRADES_FROM && c.version < campaignVersion()) { c.version = campaignVersion(); changed = true; wasOld = true; }
  if (c.version !== campaignVersion() || c.mode !== "comeback") return changed;
  if (c.seed === undefined) { c.seed = Math.floor(Math.random() * 4294967296); changed = true; }
  if (c.buyout === undefined) { c.buyout = "none"; changed = true; }
  if (c.start_debt_musd === undefined) {
    var legacy = LEGACY_START_DEBT[c.tier], t = comebackTier(c);
    var start = legacy !== undefined && wasOld ? legacy : t ? t.debt_musd : undefined;
    if (isNumber(start)) { c.start_debt_musd = start; changed = true; }
  }
  return changed;
}

function saveCampaign(c) {
  memoryCampaign = c;
  try { if (typeof localStorage !== "undefined") localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(c)); }
  catch (e) { /* storage blocked: memory copy still works */ }
}

function resetCampaign() {
  memoryCampaign = null;
  try { if (typeof localStorage !== "undefined") localStorage.removeItem(CAMPAIGN_KEY); } catch (e) {}
}

function newCampaign(tierId) {
  var tier = getTier(tierId) || TIERS[0];
  var knowledge = {};
  OBJECTIVES.forEach(function (o) { knowledge[o.id] = 0; });
  var c = {
    version: campaignVersion(),
    mode: "campaign",         // the 1957 campaign; "comeback" is Ajay's comeback (newComeback)
    tier: tier.id,
    year: typeof CAMPAIGN !== "undefined" ? CAMPAIGN.start_year : 0,
    treasury_musd: tier.budget_musd,
    knowledge_science: knowledge,
    research: [],
    upgrades: [],             // lab upgrades bought (successor part ids)
    science_pts: 0,           // science returned, spent in the lab
    lessons: [],
    missions: [],
    flights: 0,
    finished: false,
    won: false
  };
  saveCampaign(c);
  makeOffers(c);   // after saving: what is open depends on the saved research
  saveCampaign(c);
  return c;
}

function newCampaignDesign() {
  var c = getCampaign();
  if (!c || c.finished) return null;
  var d = newDesign(c.tier);
  d.campaign = true;
  if (isComeback(c)) { d.comeback = true; d.contract = null; }   // newComebackDesign(contractId) picks the contract
  return d;
}

function grantFor(c) {
  var tier = getTier(c.tier);
  if (tier && tier.grant_musd !== undefined) return tier.grant_musd;
  return typeof CAMPAIGN !== "undefined" ? CAMPAIGN.grant_musd : 0;
}

// The cheapest design that can launch for any open topic, found by search (never a
// hard-coded number). Used to prevent soft locks. Parts are tried in price order and a
// branch stops as soon as it cannot beat the best design found, so it stays fast
// (a few milliseconds) even with every part unlocked. Battery-only designs count.
// topicId and orbitId (optional) limit the search to one topic and one orbit (a comeback contract).
function cheapestLaunchCost(c, topicId, orbitId) {
  var key = c.research.slice().sort().join(",") + "|" + (c.upgrades || []).slice().sort().join(",") +
            (topicId ? "|" + topicId + "|" + (orbitId || "") : "");
  if (cheapestCache[key] !== undefined) return cheapestCache[key];
  function byCost(list) { return list.slice().sort(function (a, b) { return a.cost_musd - b.cost_musd; }); }
  function avail(cat) { return byCost(PARTS.filter(function (p) { return p.category === cat && isPartAvailable(p.id); })); }
  var power = avail("power"), comms = avail("comms"), comp = avail("computer"), prop = [null].concat(avail("propulsion"));
  // Structure and attitude join the search once they are required: their cheapest
  // part is always the cheapest choice that keeps a design launchable, so take it.
  var extras = [];
  if (requiredCategories().indexOf("attitude") !== -1 && avail("attitude")[0]) extras.push(avail("attitude")[0]);
  var extraCost = extras.reduce(function (t, p) { return t + p.cost_musd; }, 0);
  // Bodies are tried cheapest first; a design must fit in its body.
  var bodiesToTry = requiredCategories().indexOf("structure") !== -1 ? avail("structure") : [null];
  var launchers = byCost(LAUNCHERS.filter(function (l) { return isLauncherAvailable(l.id); }));
  var best = Infinity;
  // Quick arithmetic before runChecks: a design too heavy for the rocket, or that does not fit its
  // body, would be blocked anyway (launcher-reach, mass, body-payload, body-slots), so skip it.
  // The small tolerance leaves every borderline design to runChecks, so the result never changes.
  var extraMass = extras.reduce(function (t, p) { return t + p.mass_kg; }, 0);
  var extraAtt = extras.filter(function (p) { return p.category === "attitude"; }).length;
  function fits(body, load, hasProp) {
    if (!body) return true;
    if (round(load, 2) > (body.payload_kg || 0) + 1e-6) return false;
    var s = body.slots || {};
    return (s.instrument || 0) >= 1 && (s.power || 0) >= 1 && (s.comms || 0) >= 1 && (s.computer || 0) >= 1 &&
           (s.attitude || 0) >= extraAtt && (s.propulsion || 0) >= (hasProp ? 1 : 0);
  }
  OBJECTIVES.forEach(function (o) {
    if (!isObjectiveAvailable(o.id) || (topicId && o.id !== topicId)) return;
    var ins = avail("instrument").filter(function (p) {
      return p.tags.some(function (t) { return o.wants.indexOf(t) !== -1; });
    });
    ORBITS.forEach(function (orb) {
      if (o.orbit_fit && !o.orbit_fit[orb.id] || (orbitId && orb.id !== orbitId)) return;
      for (var a = 0; a < ins.length; a++) {
        var c1 = ins[a].cost_musd + extraCost; if (c1 >= best) break;
        for (var b = 0; b < power.length; b++) {
          var c2 = c1 + power[b].cost_musd; if (c2 >= best) break;
          for (var e = 0; e < comms.length; e++) {
            var c3 = c2 + comms[e].cost_musd; if (c3 >= best) break;
            for (var f = 0; f < comp.length; f++) {
              var c4 = c3 + comp[f].cost_musd; if (c4 >= best) break;
              for (var g = 0; g < prop.length; g++) {
                var c5 = c4 + (prop[g] ? prop[g].cost_musd : 0); if (c5 >= best) continue;
                var load = ins[a].mass_kg + power[b].mass_kg + comms[e].mass_kg + comp[f].mass_kg + (prop[g] ? prop[g].mass_kg : 0) + extraMass;
                for (var h = 0; h < launchers.length; h++) {
                  var cost0 = c5 + launchers[h].cost_musd; if (cost0 >= best) break;
                  var capacity = (launchers[h].capacity_kg || {})[orb.id] || 0;
                  if (!capacity || round(load, 2) > capacity + 1e-6) continue;
                  for (var k = 0; k < bodiesToTry.length; k++) {
                    var body = bodiesToTry[k], cost = cost0 + (body ? body.cost_musd : 0); if (cost >= best) break;
                    if (round(load + (body ? body.mass_kg : 0), 2) > capacity + 1e-6 || !fits(body, load, !!prop[g])) continue;
                    var d = { tier: c.tier, objective: o.id, orbit: orb.id, launcher: launchers[h].id,
                              parts: [ins[a].id, power[b].id, comms[e].id, comp[f].id].concat(prop[g] ? [prop[g].id] : [],
                                     extras.map(function (x) { return x.id; }), body ? [body.id] : []) };
                    var blockers = runChecks(d).blockers.filter(function (x) { return x.id !== "budget"; });
                    if (!blockers.length && scienceRate(d, []).per_month > 0) { best = cost; break; }
                  }
                }
              }
            }
          }
        }
      }
    });
  });
  best = round(best, 3);
  cheapestCache[key] = best;
  return best;
}

// Called once from recordResult for a campaign mission.
function settleCampaign(mission, debrief, result) {
  var c = getCampaign();
  if (!c) return;
  if (isComeback(c) !== !!mission.comeback) return;   // the save changed mode since launch: nothing to settle
  landFlight(c, mission);
  if (isComeback(c)) return settleComeback(c, mission, debrief, result);
  var obj = mission.design.objective;
  var grant = grantFor(c);
  var newData = newDataFor(getObjective(obj), c.knowledge_science[obj] || 0, mission.science);
  c.knowledge_science[obj] = (c.knowledge_science[obj] || 0) + newData;
  c.treasury_musd = round(c.treasury_musd + debrief.payout_musd + grant - mission.extra_cost_musd, 3);
  var yearFlown = c.year;
  var offersClaimed = claimOffers(c, mission, yearFlown, newData);
  var yearsPassed = missionYears(mission.design);
  c.year += yearsPassed;   // time as a resource: long builds cost years
  // Science points: this flight's data, plus a share of the whole archive for every year that passed.
  var archive = round(archivePerYear(c) * yearsPassed, 1);
  c.science_pts = round((c.science_pts || 0) + newData + archive, 1);
  var newLessons = lessonsFrom(mission, debrief, c).filter(function (l) { return c.lessons.indexOf(l) === -1; });
  c.lessons = c.lessons.concat(newLessons);
  c.missions.push({ id: mission.id, year: yearFlown, objective: obj, orbit: mission.design.orbit,
                    spent_musd: debrief.spent_musd, science: round(mission.science, 1),
                    payout_musd: debrief.payout_musd, stars: debrief.stars,
                    // For the programme chronicle (SPEC.md, "The ending"):
                    flight: mission.campaign_flight || c.flights, new_data: round(newData, 1), first_look: (debrief.knowledge_before || 0) < 0.05 && newData > 0,
                    months: mission.month, ended_early: !!mission.ended_early, limiting: debrief.limiting_name || null,
                    parts: designParts(mission.design).length,
                    real: debrief.closest_mission ? { name: debrief.closest_mission.name, year: debrief.closest_mission.year } : null });

  // Win: enough topics known well enough (every topic, if there are fewer).
  var win = typeof CAMPAIGN !== "undefined" ? CAMPAIGN.win : { topics_known: 3, knowledge: 0.6 };
  var needed = Math.min(win.topics_known, OBJECTIVES.length);
  var known = OBJECTIVES.filter(function (o) { return knowledgeOf(o, c.knowledge_science[o.id] || 0) >= win.knowledge; }).length;
  if (known >= needed) { c.finished = true; c.won = true; }
  else if (typeof CAMPAIGN !== "undefined" && c.year >= CAMPAIGN.end_year) { c.finished = true; }

  // Never soft-locked: top the treasury up to the cheapest launchable design.
  var bailout = 0;
  if (!c.finished) {
    var cheapest = cheapestLaunchCost(c);
    if (isFinite(cheapest) && c.treasury_musd < cheapest) {
      bailout = round(cheapest - c.treasury_musd, 3);
      c.treasury_musd = round(cheapest, 3);
    }
  }
  saveCampaign(c);
  if (!c.finished) { makeOffers(c); saveCampaign(c); }

  result.offers_claimed = offersClaimed;
  result.payout_musd = debrief.payout_musd;
  result.grant_musd = grant;
  result.event_costs_musd = round(mission.extra_cost_musd, 3);
  result.knowledge_before = debrief.knowledge_before;
  result.knowledge_after = debrief.knowledge_after;
  result.novelty = debrief.novelty;
  result.treasury_musd = c.treasury_musd;
  result.year = c.year;
  result.bailout = bailout > 0;
  result.bailout_musd = bailout;
  result.campaign_over = c.finished;
  result.won = c.won;
  result.lessons_new = newLessons;
  result.science_pts_earned = round(newData, 1);
  result.new_data = round(newData, 1);
  result.nothing_new = mission.science > 0 && newData === 0;
  result.best_next_topic = bestNextTopic(obj);
  result.archive_sci = archive;
  result.science_pts = c.science_pts;
}

// Science points the archive pays each campaign year (SPEC.md, "The archive").
function archivePerYear(c) {
  var share = typeof CAMPAIGN !== "undefined" && CAMPAIGN.archive_share !== undefined ? CAMPAIGN.archive_share : 0;
  var banked = 0;
  Object.keys(c.knowledge_science || {}).forEach(function (k) { banked += c.knowledge_science[k] || 0; });
  return round(banked * share, 1);
}

// ------------------------------------------------------------------ yearly offers
// Customers ask for something specific (SPEC.md, "Offers"): a topic, sometimes from a given orbit, by a year.
// Any flight that returns enough data for it, and some of it new, claims the bonus. Generated from the
// topics, orbits and rockets the programme can use now; nothing here is a data file.
var OFFER_COUNT = 2;      // open offers at any time
var OFFER_YEARS = 2;      // years to deliver
var OFFER_CLIENTS = {
  radiation: ["the National Academy of Sciences", "the Air Force research office"],
  solar: ["a university physics department", "the radio broadcasters' association"],
  weather: ["the Weather Bureau", "an airline association"],
  ionosphere: ["the Defence Research Telecommunications Establishment", "a shortwave radio operators' club"],
  wildfire: ["the forestry service", "a state fire marshal"],
  "sea-ice": ["the coast guard", "a shipping company"]
};

function offerText(o, topic, orbit) {
  return o.client + " wants " + lcFirst(topic.name) + " data" + (orbit ? " from " + lcFirst(orbit.name) : "") +
    ": at least " + o.min_science + " points by " + o.year_to + ". Bonus $" + o.bonus_musd + "M and " + o.bonus_sci + " science.";
}

function makeOffers(c) {
  if (isComeback(c)) return makeContracts(c);
  var rand = makeRandom((c.year * 7919 + (c.flights || 0) * 104729 + 17) >>> 0);
  var open = (c.offers || []).filter(function (o) { return !o.done && o.year_to >= c.year; });
  // Only topics with something new left to collect: a customer cannot ask for what is already known.
  var topics = OBJECTIVES.filter(function (o) { return isObjectiveAvailable(o.id) && (c.knowledge_science[o.id] || 0) < dataCap(o); });
  for (var guard = 0; open.length < OFFER_COUNT && topics.length && guard < 30; guard++) {
    var o = topics[Math.floor(rand() * topics.length)];
    if (open.some(function (x) { return x.topic === o.id; })) continue;
    // An orbit is named only if the topic can use it and some rocket we have can reach it.
    var orbits = ORBITS.filter(function (orb) {
      return (!o.orbit_fit || o.orbit_fit[orb.id] > 0) &&
        LAUNCHERS.some(function (l) { return isLauncherAvailable(l.id) && ((l.capacity_kg || {})[orb.id] || 0) >= 10; });
    });
    var orb = orbits.length > 1 && rand() < 0.6 ? orbits[Math.floor(rand() * orbits.length)] : null;
    var clients = OFFER_CLIENTS[o.id] || ["a customer"];
    var offer = {
      id: "offer-" + c.year + "-" + o.id, topic: o.id, orbit: orb ? orb.id : null,
      min_science: Math.max(5, Math.round(0.6 * o.science_target / 5) * 5),
      bonus_musd: round(0.2 * (o.value_musd || 0), 1), year_from: c.year, year_to: c.year + OFFER_YEARS,
      client: clients[Math.floor(rand() * clients.length)], done: false
    };
    offer.bonus_sci = Math.round(0.3 * offer.min_science);
    offer.text = offerText(offer, o, orb);
    open.push(offer);
  }
  c.offers = open.concat((c.offers || []).filter(function (x) { return x.done; }));
}

// Claims every open offer this flight meets; returns what was claimed.
function claimOffers(c, mission, yearFlown, newData, stars) {
  if (isComeback(c)) return claimContract(c, mission, newData, stars);
  var claimed = [];
  if (!(newData > 0)) return claimed;   // no new data, no reward: offers follow the same rule as everything else
  (c.offers || []).forEach(function (o) {
    if (o.done || o.topic !== mission.design.objective || yearFlown > o.year_to) return;
    if (o.orbit && o.orbit !== mission.design.orbit) return;
    if (mission.science < o.min_science) return;
    o.done = true;
    c.treasury_musd = round(c.treasury_musd + o.bonus_musd, 3);
    c.science_pts = round((c.science_pts || 0) + o.bonus_sci, 1);
    claimed.push({ text: o.text, client: o.client, topic: o.topic, bonus_musd: o.bonus_musd, bonus_sci: o.bonus_sci });
  });
  return claimed;
}

// The open offers, for the hub.
function offersList(c) {
  return (c.offers || []).filter(function (o) { return !o.done && o.year_to >= c.year; }).map(function (o) {
    var t = getObjective(o.topic), orb = o.orbit ? getOrbit(o.orbit) : null;
    return { id: o.id, topic: o.topic, topic_name: t ? t.name : o.topic, orbit: o.orbit, orbit_name: orb ? orb.name : null,
             min_science: o.min_science, bonus_musd: o.bonus_musd, bonus_sci: o.bonus_sci, year_to: o.year_to,
             client: o.client, text: o.text };
  });
}

// ------------------------------------------------------------------ the ending: the programme chronicle
// The story of one campaign, built from what the player actually did and the real missions in
// data/missions.js (SPEC.md, "The ending"). Works for a campaign in progress and for a finished one.
var RATINGS = [
  { id: "architects", name: "Architects of the space age", min: 3.0, needs_win: true,
    text: "Your programme did what the first agencies did together: it mapped the belts, watched the weather and read the Sun, and it left behind a method others could follow." },
  { id: "pioneers", name: "Pioneers", min: 0, needs_win: true,
    text: "You reached the goal you were set. Few programmes of the time could say as much." },
  { id: "established", name: "An established programme", min: 1.8, needs_win: false,
    text: "Time ran out before the goal, but the programme left real knowledge behind and the next team starts further on." },
  { id: "promising", name: "A promising start", min: 0.9, needs_win: false,
    text: "A few good flights and some hard lessons. Programmes that began like this often went on to do the most." },
  { id: "lessons", name: "Lessons learned", min: 0, needs_win: false,
    text: "The first satellites were hard. Most of the early ones failed, and the lessons they taught are in every satellite flying today." }
];

function ratingFor(c, K) {
  for (var i = 0; i < RATINGS.length; i++) {
    var r = RATINGS[i];
    if ((!r.needs_win || c.won) && K >= r.min) return r;
  }
  return RATINGS[RATINGS.length - 1];
}

function flightHeadline(m, o, orbitName) {
  var topic = o ? o.name : m.objective;
  if (m.ended_early) return "Satellite lost" + (isCount(m.months) ? " after " + m.months + (m.months === 1 ? " month" : " months") : "");
  if (m.new_data <= 0) return "Old news: " + topic + " measured again";
  if (m.first_look && m.stars >= 2) return topic + ": the first data comes home";
  if (m.stars === 3) return "Flawless flight adds to the record on " + topic;
  if (m.stars === 0) return "A hard lesson on the way to " + topic;
  return "New data on " + topic;
}

function getChronicle() {
  var c = getCampaign();
  if (!c) return null;
  var startYear = isComeback(c) ? comebackStartYear() : typeof CAMPAIGN !== "undefined" ? CAMPAIGN.start_year : c.year;
  var missions = c.missions || [];
  var K = 0;
  var topics = OBJECTIVES.map(function (o) {
    var S = c.knowledge_science[o.id] || 0, k = knowledgeOf(o, S);
    var flights = missions.filter(function (m) { return m.objective === o.id; });
    K += k;
    return { id: o.id, name: o.name, knowledge: round(k, 3), data: round(S, 1), flights: flights.length,
             best_stars: flights.reduce(function (b, m) { return Math.max(b, m.stars || 0); }, 0),
             real_mission: o.real_mission || null };
  }).filter(function (t) { return t.flights > 0; }).sort(function (a, b) { return b.knowledge - a.knowledge; });

  var rating = ratingFor(c, K);
  var timeline = [];
  missions.forEach(function (m, i) {
    var o = getObjective(m.objective), orbit = getOrbit(m.orbit);
    var orbitName = orbit ? orbit.name : m.orbit;
    var parts = [];
    parts.push("G-" + (m.flight || i + 1) + " flew in " + lcFirst(orbitName) + " for " + (m.months || "?") + (m.months === 1 ? " month" : " months"));
    parts.push(round(m.science, 0) + " points of data" + (m.new_data < m.science ? " (" + round(m.new_data, 0) + " of it new)" : ""));
    parts.push((m.stars || 0) + (m.stars === 1 ? " star" : " stars"));
    parts.push("paid $" + round(m.payout_musd, 1) + "M");
    var text = parts.join(", ") + "." + (m.limiting && !/^nothing/i.test(m.limiting) ? " " + m.limiting + " limited it." : "") +
      (m.real ? " Its real twin: " + m.real.name + " (" + m.real.year + ")." : "");
    timeline.push({ year: m.year, kind: "flight", flight: m.flight || i + 1, stars: m.stars || 0,
                    title: flightHeadline(m, o, orbitName), text: text });
  });
  (c.log || []).forEach(function (e) {
    if (e.kind === "research") {
      var r = researchById(e.id);
      timeline.push({ year: e.year, kind: "research", title: "Research: " + (r ? r.name : e.id),
                      text: r ? (r.blurb || "") : "" });
    } else if (e.kind === "upgrade") {
      var p = findById(PARTS, e.id), pred = p && p.upgrade ? findById(PARTS, p.upgrade.of) : null;
      timeline.push({ year: e.year, kind: "upgrade", title: "Upgrade: " + (pred ? pred.name + " to " : "") + (p ? p.name : e.id),
                      text: p ? (p.blurb || "") : "" });
    }
  });
  var order = { research: 0, upgrade: 1, flight: 2 };
  timeline.sort(function (a, b) { return a.year - b.year || order[a.kind] - order[b.kind]; });

  var stars = missions.reduce(function (t, m) { return t + (m.stars || 0); }, 0);
  var spent = missions.reduce(function (t, m) { return t + (m.spent_musd || 0); }, 0);
  var best = topics[0] || null;
  var lastYear = c.finished ? c.year : c.year;
  return {
    title: "The programme, " + startYear + " to " + lastYear,
    finished: !!c.finished, won: !!c.won,
    rating: { id: rating.id, name: rating.name, text: rating.text },
    headline: rating.name + (best ? ": " + best.name : ""),
    totals: { flights: missions.length, stars: stars, data: round(topics.reduce(function (t, x) { return t + x.data; }, 0), 0),
              spent_musd: round(spent, 1), research: c.research.length, upgrades: (c.upgrades || []).length,
              knowledge: round(K, 2), year: c.year },
    topics: topics,
    timeline: timeline,
    epilogue: c.won
      ? "By " + c.year + " your satellites had told us more than anyone could have asked of the first dozen years in space."
      : c.finished ? "In " + c.year + " the funding stopped. What your satellites sent home stayed behind." : null
  };
}

function getHubInfo() {
  var c = getCampaign();
  if (!c) return null;
  return {
    year: c.year,
    treasury_musd: c.treasury_musd,
    science_pts: c.science_pts || 0,
    archive_sci_per_year: archivePerYear(c),
    offers: offersList(c),
    topics: OBJECTIVES.map(function (o) {
      var S = c.knowledge_science[o.id] || 0;
      var open = isObjectiveAvailable(o.id);
      return {
        id: o.id, name: o.name, available: open,
        knowledge: round(knowledgeOf(o, S), 3),
        data_collected: round(S, 1),
        data_cap: isFinite(dataCap(o)) ? dataCap(o) : null,
        complete: S >= dataCap(o),
        science_so_far: round(S, 1),
        next_payout_estimate_musd: payoutFor(o, S, o.science_target).payout_musd,
        locked_reason: open ? null : "Needs " + researchNameFor("objectives", o.id)
      };
    }),
    lessons: c.lessons.map(function (id) { return { id: id, name: LESSONS[id] || id }; }),
    research: (typeof RESEARCH === "undefined" ? [] : RESEARCH).map(function (r) {
      var owned = c.research.indexOf(r.id) !== -1;
      var missing = researchMissing(r, c);
      var met = missing.filter(function (m) { return m.kind !== "money" && m.kind !== "science"; }).length === 0;
      return { id: r.id, name: r.name, year: r.year, depth: researchDepth(r.id), cost_musd: r.cost_musd,
               cost_sci: r.cost_sci || 0, blurb: r.blurb,
               owned: owned, requires: r.requires || [], requires_met: met, affordable: !owned && missing.length === 0,
               missing: owned ? [] : missing.map(function (m) { return m.text; }), unlocks_names: unlockNames(r) };
    }),
    missions: c.missions,
    finished: c.finished,
    won: c.won
  };
}

function buyResearch(id) {
  var c = getCampaign();
  if (!c) return { ok: false, reason: "No campaign is running." };
  if (isComeback(c)) return { ok: false, reason: "There is no lab in Ajay's comeback: every part of today is already on the shelf." };
  if (c.finished) return { ok: false, reason: "The campaign is over." };
  var r = typeof RESEARCH === "undefined" ? null : RESEARCH.filter(function (x) { return x.id === id; })[0];
  if (!r) return { ok: false, reason: "No such research." };
  if (c.research.indexOf(id) !== -1) return { ok: false, reason: "Already owned." };
  var missing = researchMissing(r, c);
  if (missing.length) return { ok: false, reason: missing.map(function (m) { return m.text; }).join(" ") };
  var undo = JSON.stringify(c);
  c.treasury_musd = round(c.treasury_musd - r.cost_musd, 3);
  c.science_pts = round((c.science_pts || 0) - (r.cost_sci || 0), 1);
  c.research.push(id);
  (c.log = c.log || []).push({ year: c.year, kind: "research", id: id });
  saveCampaign(c);
  return keepsLaunchable(c, undo);
}

// Never soft-locked (SPEC.md, "Scoring"): only a flight brings the grants, so a lab purchase that would leave
// less money than the cheapest launchable design is refused and undone. Called just after the purchase is
// saved, because what can launch depends on what is owned.
function keepsLaunchable(c, undo) {
  var cheapest = cheapestLaunchCost(c);
  if (!isFinite(cheapest) || c.treasury_musd >= cheapest) return { ok: true, reason: null };
  var left = c.treasury_musd;
  saveCampaign(JSON.parse(undo));
  return { ok: false, reason: "That would leave $" + round(left, 2) + "M, less than the cheapest launch ($" + round(cheapest, 2) + "M). Fly first." };
}

// What a design would earn if it flies as planned (for the Build screen).
function previewPayout(design) {
  var objective = getObjective(design.objective);
  var c = design.campaign ? getCampaign() : null;
  if (design.comeback && isComeback(c)) return previewContractPay(design, c);
  var before = c ? (c.knowledge_science[design.objective] || 0) : 0;
  var cost = getTotals(design).cost_musd;
  var k = payoutFor(objective, before, previewScience(design).total);
  var sci = previewScience(design).total;
  var offers = c ? offersList(c).filter(function (o) { return o.topic === design.objective && (!o.orbit || o.orbit === design.orbit); })
    .map(function (o) { return { text: o.text, bonus_musd: o.bonus_musd, bonus_sci: o.bonus_sci, min_science: o.min_science, met: sci >= o.min_science && k.new_data > 0 }; }) : [];
  return { offers: offers, expected_payout_musd: k.payout_musd, knowledge_before: k.knowledge_before,
           knowledge_after: k.knowledge_after, novelty: k.novelty,
           new_data: k.new_data, data_left: k.data_left, topic_complete: k.topic_complete,
           cost_musd: cost, net_musd: round(k.payout_musd - cost, 3) };
}

// ------------------------------------------------------------------ save codes
// One save per browser, plus export and import codes (clicker-game style).
// Code: "SMDG1." + base64(JSON) + "." + checksum. Length does not matter.
function checksum(text) {
  var h = 2166136261;
  for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
function toBase64(text) { return btoa(unescape(encodeURIComponent(text))); }
function fromBase64(b64) { return decodeURIComponent(escape(atob(b64))); }

function exportSave() {
  var body = JSON.stringify({ v: campaignVersion(), campaign: getCampaign(), progress: getProgress() });
  return "SMDG1." + toBase64(body) + "." + checksum(body);
}

function importSave(code) {
  try {
    var parts = String(code || "").trim().split(".");
    if (parts.length !== 3 || parts[0] !== "SMDG1") return { ok: false, reason: "That is not a save code." };
    var body = fromBase64(parts[1]);
    if (checksum(body) !== parts[2]) return { ok: false, reason: "The code is damaged or incomplete." };
    var data = JSON.parse(body);
    if (!isRecord(data)) return { ok: false, reason: "The code could not be read." };
    var upgradable = function (v) { return v === campaignVersion() || v === SAVE_UPGRADES_FROM; };   // a code from the game before is upgraded
    if (!upgradable(data.v)) return { ok: false, reason: "The code is from another version of the game." };
    if (data.campaign && !upgradable(data.campaign.version)) return { ok: false, reason: "The campaign is from another version." };
    if (data.campaign) upgradeCampaign(data.campaign);
    if (!isRecord(data.progress)) return { ok: false, reason: "The code has no progress in it." };
    // Every field is checked before anything is saved: a code that is well formed but incomplete never replaces a good save.
    var progress = cleanProgress(data.progress);
    if (!progress || (data.campaign !== null && data.campaign !== undefined && !validCampaign(data.campaign))) {
      return { ok: false, reason: "The code could not be read." };
    }
    saveProgress(progress);
    if (data.campaign) { saveCampaign(data.campaign); cheapestCache = {}; } else resetCampaign();
    return { ok: true, reason: null };
  } catch (e) {
    return { ok: false, reason: "The code could not be read." };
  }
}

// ---- the shape of a save: checked on import, and when a save is read back from the browser
function isRecord(x) { return !!x && typeof x === "object" && !Array.isArray(x); }
function isNumber(x) { return typeof x === "number" && isFinite(x); }
function isText(x) { return typeof x === "string"; }
function isFlag(x) { return typeof x === "boolean"; }
function isTextOrNull(x) { return x === null || isText(x); }
function isCount(x) { return isNumber(x) && x >= 0 && Math.floor(x) === x; }
function isNumberMap(x) { return isRecord(x) && Object.keys(x).every(function (k) { return isNumber(x[k]); }); }
function isListOf(x, test) { return Array.isArray(x) && x.every(function (v) { return test(v); }); }
function isOptional(x, test) { return x === undefined || test(x); }

// Tier progress: { best_stars, best_score, best_stars_by_era }, each { id: number }. An older record without
// best_stars_by_era gets an empty one. Returns the clean record, or null when it cannot be used.
function cleanProgress(p) {
  if (!isRecord(p) || !isNumberMap(p.best_stars) || !isNumberMap(p.best_score) || !isOptional(p.best_stars_by_era, isNumberMap)) return null;
  return { best_stars: p.best_stars, best_score: p.best_score, best_stars_by_era: p.best_stars_by_era || {} };
}

// One flight, as settleCampaign and settleComeback save it.
function validFlight(m) {
  return isRecord(m) && isText(m.id) && isText(m.objective) && isText(m.orbit) && isNumber(m.year) && isNumber(m.science) &&
    isNumber(m.stars) && isNumber(m.payout_musd) && isNumber(m.spent_musd) &&
    isOptional(m.flight, isCount) && isOptional(m.new_data, isNumber) && isOptional(m.first_look, isFlag) &&
    isOptional(m.months, isCount) && isOptional(m.ended_early, isFlag) && isOptional(m.limiting, isTextOrNull) &&
    isOptional(m.parts, isCount) && isOptional(m.month, isNumber) && isOptional(m.contract, isTextOrNull) &&
    isOptional(m.real, function (r) { return r === null || (isRecord(r) && isText(r.name) && isNumber(r.year)); });
}
// A yearly offer (the 1957 campaign) or a contract (the comeback).
function validOffer(o, comeback) {
  if (!isRecord(o) || !isText(o.id) || !isText(o.topic) || !isTextOrNull(o.orbit) || !isText(o.client) || !isText(o.text) ||
      !isFlag(o.done) || !isNumber(o.min_science) || !isNumber(o.bonus_musd)) return false;
  return comeback ? isText(o.reason) && isNumber(o.price_musd) && isNumber(o.expires_month)
                  : isNumber(o.year_to) && isNumber(o.bonus_sci) && isOptional(o.year_from, isNumber);
}
// The log: research and upgrades bought, payments to the lenders, and flights launched but not yet recorded.
function validLogEntry(e) {
  if (!isRecord(e) || !isText(e.kind) || !isNumber(e.year)) return false;
  if (e.kind === "payment") return isNumber(e.musd) && isNumber(e.month);
  if (e.kind === "launch") return isText(e.id) && isNumber(e.musd) && isCount(e.flight);
  return isText(e.id);
}
function validCampaign(c) {
  if (!isRecord(c) || c.version !== campaignVersion() || (c.mode !== "campaign" && c.mode !== "comeback") || !getTier(c.tier)) return false;
  var comeback = c.mode === "comeback";
  if (!isNumber(c.year) || !isNumber(c.treasury_musd) || !isNumber(c.science_pts) || !isCount(c.flights) ||
      !isFlag(c.finished) || !isFlag(c.won) || !isNumberMap(c.knowledge_science) ||
      !isListOf(c.research, isText) || !isListOf(c.upgrades, isText) || !isListOf(c.lessons, isText) ||
      !isListOf(c.missions, validFlight) || !isOptional(c.log, function (l) { return isListOf(l, validLogEntry); }) ||
      !isOptional(c.offers, function (l) { return isListOf(l, function (o) { return validOffer(o, comeback); }); })) return false;
  if (!comeback) return true;
  var cfg = comebackConfig();
  return !!(cfg && cfg.tiers[c.tier]) && isNumber(c.month) && isNumber(c.deadline_month) && isNumber(c.debt_musd) &&
    isCount(c.seed) && c.seed <= 4294967295 && BUYOUT_STATES.indexOf(c.buyout) !== -1 && isOptional(c.start_debt_musd, isNumber);
}

// ------------------------------------------------------------------ research tree and lessons
// Best practices the player must show in flight before some research opens (SPEC.md, "Lessons").
var LESSONS = {
  margins: "Flew with 10% mass and power margins",
  all_data: "Sent home all the data its instruments made",
  three_stars: "Earned 3 stars",
  storm_survived: "Met a solar storm and lost no part",
  "protected": "A part on board cancelled an event's penalty",
  spare: "Carried a spare in a required category",
  batteries_ran_out: "Watched a satellite fall silent when its batteries ran down",
  new_topic: "Flew on a second topic"
};

// The lessons one recorded mission demonstrates.
function lessonsFrom(mission, debrief, c) {
  var out = [], t = mission.launch_totals;
  if (t.margins.mass !== null && t.margins.mass >= LOW_MARGIN && t.margins.power !== null && t.margins.power >= LOW_MARGIN) out.push("margins");
  if (t.data_gb_day > 0 && t.data_returned_gb_day >= t.data_gb_day) out.push("all_data");
  if (debrief.stars === 3) out.push("three_stars");
  if (mission.events_seen.some(function (e) { return e.id === "solar-storm" && !e.failed_part; })) out.push("storm_survived");
  if (mission.events_seen.some(function (e) { return e.protected; })) out.push("protected");
  var counts = {};
  designParts(mission.design).forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });
  if (requiredCategories().some(function (cat) { return (counts[cat] || 0) >= 2; })) out.push("spare");
  if (mission.end_cause === "batteries") out.push("batteries_ran_out");
  var topics = {};
  c.missions.forEach(function (m) { topics[m.objective] = true; });
  topics[mission.design.objective] = true;
  if (Object.keys(topics).length >= 2) out.push("new_topic");
  return out;
}


// What still stands between the player and this research, as { kind, text } items.
function researchMissing(r, c) {
  var out = [];
  (r.requires || []).forEach(function (q) {
    if (c.research.indexOf(q) === -1) { var rq = researchById(q); out.push({ kind: "research", text: "Needs " + (rq ? rq.name : q) + "." }); }
  });
  var hidden = lessonsHidden(c);
  (r.requires_lessons || []).forEach(function (l) {
    if (c.lessons.indexOf(l) === -1) out.push({ kind: "lesson",
      text: hidden ? (LESSON_HINTS[l] || "A review board wants to see better practice in flight.") : "Show in flight: " + (LESSONS[l] || l) + "." });
  });
  var rk = r.requires_knowledge || {};
  Object.keys(rk).forEach(function (topic) {
    var o = getObjective(topic), k = knowledgeOf(o, c.knowledge_science[topic] || 0);
    if (k < rk[topic]) out.push({ kind: "knowledge", text: "Know " + Math.round(rk[topic] * 100) + "% of the topic " +
      (o ? o.name : topic) + " (now " + Math.round(k * 100) + "%)." });
  });
  if (c.treasury_musd < r.cost_musd) out.push({ kind: "money", text: "Costs $" + r.cost_musd + "M." });
  if ((c.science_pts || 0) < (r.cost_sci || 0)) out.push({ kind: "science", text: "Needs " + (r.cost_sci || 0) +
    " science points (you have " + Math.floor(c.science_pts || 0) + ")." });
  return out;
}

// Less hand-holding (SPEC.md, "The lab"): above Initial Feasibility, a lesson's exact
// condition stays hidden behind a hint until the player earns it.
function lessonsHidden(c) {
  var tier = getTier(c.tier);
  return !!(tier && tier.hints && tier.hints !== "on");
}
var LESSON_HINTS = {
  margins: "A review board wants proof of engineering discipline before it signs off.",
  all_data: "The scientists complain that data is being left in orbit.",
  three_stars: "Only a flawless mission will convince the committee.",
  storm_survived: "Engineers want to see a satellite come through the Sun's worst unharmed.",
  "protected": "Show that you planned for something going wrong, and it paid off.",
  spare: "The board asks what happens when a part fails and there is no second one.",
  batteries_ran_out: "Someone must learn first-hand what a satellite without a generator does.",
  new_topic: "The agency wants a programme, not a single experiment."
};

// ------------------------------------------------------------------ the lab: upgrades replace
// What still stands between the player and an upgrade, as { kind, text } items.
function upgradeMissing(p, c) {
  var u = p.upgrade, out = [], pred = findById(PARTS, u.of);
  if (!isPartAvailable(u.of)) out.push({ kind: "part", text: "Needs " + (pred ? pred.name : u.of) + " first." });
  (u.requires || []).forEach(function (q) {
    if (c.research.indexOf(q) === -1) { var rq = researchById(q); out.push({ kind: "research", text: "Needs " + (rq ? rq.name : q) + "." }); }
  });
  if (c.year < u.year) out.push({ kind: "year", text: "Not invented until " + u.year + "." });
  if (c.treasury_musd < u.cost_musd) out.push({ kind: "money", text: "Costs $" + u.cost_musd + "M." });
  if ((c.science_pts || 0) < u.cost_sci) out.push({ kind: "science", text: "Needs " + u.cost_sci +
    " science points (you have " + Math.floor(c.science_pts || 0) + ")." });
  return out;
}

// Plain-English differences between a successor and its predecessor.
function upgradeGains(p, pred) {
  var out = [];
  function diff(field, label, unit, better) {
    var a = pred[field] || 0, b = p[field] || 0;
    if (a === b) return;
    var word = (b > a) === (better === "more") ? "better" : "worse";
    out.push(label + " " + a + unit + " to " + b + unit + " (" + word + ")");
  }
  diff("science", "Science", "", "more");
  diff("mass_kg", "Mass", " kg", "less");
  diff("power_draw_w", "Power draw", " W", "less");
  diff("efficiency", "Cell efficiency", "", "more");
  diff("data_gb_day", "Data", " GB/day", "more");
  diff("downlink_gb_day", "Downlink", " GB/day", "more");
  diff("cost_musd", "Price", " $M", "less");
  (p.protects || []).forEach(function (e) {
    if ((pred.protects || []).indexOf(e) === -1) {
      var ev = EVENTS.filter(function (x) { return x.id === e; })[0];
      out.push("Shrugs off: " + (ev ? ev.title : e));
    }
  });
  return out;
}

function getLab() {
  var c = getCampaign();
  if (!c) return null;
  var ups = PARTS.filter(function (p) { return p.upgrade; }).map(function (p) {
    var pred = findById(PARTS, p.upgrade.of) || {};
    var owned = (c.upgrades || []).indexOf(p.id) !== -1;
    var missing = owned ? [] : upgradeMissing(p, c).map(function (m) { return m.text; });
    return { id: p.id, name: p.name, of: p.upgrade.of, of_name: pred.name || p.upgrade.of, year: p.upgrade.year,
             cost_musd: p.upgrade.cost_musd, cost_sci: p.upgrade.cost_sci, owned: owned,
             can_buy: !owned && !c.finished && missing.length === 0, missing: missing,
             gains: upgradeGains(p, pred), blurb: p.blurb };
  });
  ups.sort(function (a, b) { return a.year - b.year; });
  return { science_pts: c.science_pts || 0, treasury_musd: c.treasury_musd,
           archive_sci_per_year: archivePerYear(c), upgrades: ups };
}

function buyUpgrade(id) {
  var c = getCampaign();
  if (!c) return { ok: false, reason: "No campaign is running." };
  if (isComeback(c)) return { ok: false, reason: "There is no lab in Ajay's comeback: every part of today is already on the shelf." };
  if (c.finished) return { ok: false, reason: "The campaign is over." };
  var p = findById(PARTS, id);
  if (!p || !p.upgrade) return { ok: false, reason: "No such upgrade." };
  if ((c.upgrades || []).indexOf(id) !== -1) return { ok: false, reason: "Already owned." };
  var missing = upgradeMissing(p, c);
  if (missing.length) return { ok: false, reason: missing.map(function (m) { return m.text; }).join(" ") };
  var undo = JSON.stringify(c);
  c.treasury_musd = round(c.treasury_musd - p.upgrade.cost_musd, 3);
  c.science_pts = round((c.science_pts || 0) - p.upgrade.cost_sci, 1);
  c.upgrades = (c.upgrades || []).concat([id]);
  (c.log = c.log || []).push({ year: c.year, kind: "upgrade", id: id });
  saveCampaign(c);
  cheapestCache = {};
  return keepsLaunchable(c, undo);
}

// Longest chain of prerequisites, so a tree screen can put each node in a column.
function researchDepth(id, seen) {
  seen = seen || {};
  if (seen[id]) return 0;            // guards against a cycle in the data
  seen[id] = true;
  var r = researchById(id);
  if (!r || !(r.requires || []).length) return 0;
  return 1 + Math.max.apply(null, r.requires.map(function (q) { return researchDepth(q, Object.assign({}, seen)); }));
}

function unlockNames(r) {
  var u = r.unlocks || {}, out = [];
  (u.parts || []).forEach(function (id) { var p = getPart(id); out.push(p ? p.name : id); });
  (u.launchers || []).forEach(function (id) { var l = getLauncher(id); out.push(l ? l.name : id); });
  (u.objectives || []).forEach(function (id) { var o = getObjective(id); out.push(o ? "Topic: " + o.name : id); });
  OBJECTIVES.forEach(function (o) { if (o.requires_research === r.id) out.push("Topic: " + o.name); });
  return out;
}

// ------------------------------------------------------------------ real twin
function lcFirst(text) { return text ? text.charAt(0).toLowerCase() + text.slice(1) : ""; }
// The real satellite most like the player's design (data/missions.js): same topic
// first, then orbit, instrument types, kind of power and mass. Returns
// { id, name, year, agency, blurb, shared: [reasons] } or null.
function closestMission(design) {
  if (typeof MISSIONS === "undefined" || !MISSIONS.length) return null;
  var parts = designParts(design);
  var tags = parts.filter(function (p) { return p.category === "instrument"; })
                  .reduce(function (t, p) { return t.concat(p.tags); }, []);
  var hasSolar = parts.some(function (p) { return p.category === "power" && solarPowerW(p) > 0; });
  var mass = sum(parts, function (p) { return p.mass_kg; });
  var orbit = getOrbit(design.orbit);
  var best = null;
  MISSIONS.forEach(function (m) {
    var shared = [], score = 0;
    if (m.objective === design.objective) { score += 10; shared.push("both studied " + lcFirst((getObjective(m.objective) || {}).name || m.objective)); }
    if (m.orbit === design.orbit) { score += 4; shared.push("both flew in " + (orbit ? lcFirst(orbit.name) : m.orbit)); }
    var common = m.tags.filter(function (t) { return tags.indexOf(t) !== -1; });
    if (common.length) { score += 3 * common.length; shared.push("both carried " + common.join(" and ") + " instruments"); }
    if ((m.power === "solar") === hasSolar) { score += 2; shared.push(hasSolar ? "both ran on solar power" : "both ran on batteries alone"); }
    var ratio = mass > 0 ? Math.max(mass, m.mass_kg) / Math.min(mass, m.mass_kg) : 1000;
    score += Math.max(0, 3 - Math.log(ratio) / Math.log(3));   // within a factor of 3 scores well
    if (ratio < 2) shared.push("about the same mass (" + Math.round(mass) + " kg against " + m.mass_kg + " kg)");
    if (!best || score > best.score) best = { score: score, m: m, shared: shared };
  });
  if (!best) return null;
  return { id: best.m.id, name: best.m.name, year: best.m.year, agency: best.m.agency,
           blurb: best.m.blurb, shared: best.shared };
}

// ------------------------------------------------------------------ disciplines and segments
// The Mission Design Lab's name for what limited the mission (data/debrief.js "disciplines").
function disciplineName(lim) {
  var names = (typeof DEBRIEF !== "undefined" && DEBRIEF.disciplines) || {};
  var key = lim.discipline || lim.key;
  return names[key] || names[lim.key] || key;
}

// Data per day in units a person can read: GB, MB or kB.
function formatData(gb) {
  if (gb >= 1) return round(gb, 1) + " GB";
  if (gb >= 0.001) return round(gb * 1000, 1) + " MB";
  return round(gb * 1e6, 1) + " kB";
}

// One line per mission segment (NASA, "Design and Develop Science Missions").
function segmentLines(mission, t, k, cpay) {
  var d = mission.design, orbit = getOrbit(d.orbit), launcher = getLauncher(d.launcher), objective = getObjective(d.objective);
  var spare = t.capacity_kg ? Math.round(100 * (t.capacity_kg - t.mass_kg) / t.capacity_kg) : null;
  var parts = designParts(d);
  var lines = [];
  lines.push({ id: "launch", name: "Launch segment",
    text: (launcher ? launcher.name : "The rocket") + " carried " + round(t.mass_kg, 1) + " kg to " +
      (orbit ? lcFirst(orbit.name) : "orbit") + (spare !== null ? ", with " + spare + "% of its capacity to spare." : ".") });
  lines.push({ id: "space", name: "Space segment",
    text: parts.length + " parts drawing " + round(t.power_draw_w, 1) + " W" +
      (t.power_gen_w > 0 ? " from " + round(t.power_gen_w, 1) + " W of solar cells" : " from batteries alone") +
      "; it worked for " + mission.month + " of " + mission.lifetime_months + " months planned" +
      (mission.ended_early ? ", then a failure ended it." : mission.end_cause === "batteries" ? ", until the batteries ran down." : ".") });
  var share = t.data_gb_day > 0 ? Math.round(100 * t.data_returned_gb_day / t.data_gb_day) : 100;
  lines.push({ id: "ground", name: "Ground segment",
    text: formatData(t.data_returned_gb_day) + " of the " + formatData(t.data_gb_day) + " made each day reached the ground (" + share + "%)" +
      (orbit ? ", in contact with a ground station " + round(orbit.downlink_mult * 100, orbit.downlink_mult < 0.1 ? 1 : 0) + "% of the time." : ".") });
  lines.push({ id: "user", name: "User segment",
    text: "Scientists received " + Math.round(mission.science) + " science points against a target of " +
      (objective ? objective.science_target : "?") +
      (cpay ? "; " + lcFirst(mission.contract.client) + " paid $" + round(cpay.paid_musd + cpay.bonus_musd, 3) + "M for it." :
       mission.campaign_flight ? "; the programme was paid $" + k.payout_musd + "M for what was new." : ".") });
  return lines;
}

// ------------------------------------------------------------------ research tree for a tree component
// Nodes and edges only, so a reusable tree component can draw it without the rules.
function getResearchTree() {
  var c = getCampaign();
  var nodes = (typeof RESEARCH === "undefined" ? [] : RESEARCH).map(function (r) {
    var owned = !!(c && c.research.indexOf(r.id) !== -1);
    var missing = c && !owned ? researchMissing(r, c).map(function (m) { return m.text; }) : [];
    return { id: r.id, name: r.name, year: r.year, depth: researchDepth(r.id), cost_musd: r.cost_musd,
             cost_sci: r.cost_sci || 0, blurb: r.blurb,
             unlocks_names: unlockNames(r), owned: owned, can_buy: !!(c && !owned && !c.finished && missing.length === 0),
             missing: missing };
  });
  var edges = [];
  (typeof RESEARCH === "undefined" ? [] : RESEARCH).forEach(function (r) {
    (r.requires || []).forEach(function (q) { edges.push({ from: q, to: r.id }); });
  });
  return { nodes: nodes, edges: edges };
}

// ------------------------------------------------------------------ Part 2: Ajay's comeback
// A mode of the campaign above (SPEC.md, "Two game modes"): the same save, flights, offers and chronicle,
// with mode "comeback". Ajay owes the lenders a debt that grows every month; clients pay for data through
// contracts (data/contracts.js); the cash pays for parts and launches and is the readiness review's budget.
// Today's parts: the save owns every research node and every upgrade, so the 1958 originals show as
// "Replaced by" their successors and nothing waits for the lab. There is no grant and no bail-out.
// Win: the debt reaches 0 (payDebt). Lose: the deadline comes with debt left, or the cash can neither buy
// the cheapest launchable design for an open contract nor clear the debt.
var COMEBACK_ERA = "new-space";      // the calendar starts in this era's year (data/eras.js)
var CONTRACT_PRICE_SHARE = 0.32;     // GAME VALUE: a contract's full price = this x the topic's value_musd,
var CONTRACT_PRICE_PER_MONTH = 0.56; // GAME VALUE:   plus this ($M) per month its quickest full-credit instrument takes to build
var CONTRACT_MIN_SHARE = 0.6;        // GAME VALUE: full price needs this share of the topic's science target
var CONTRACT_ORBIT_CHANCE = 0.4;     // GAME VALUE: how often a client names the orbit

var BUYOUT_STATES = ["none", "offered", "refused", "accepted"];   // Iron Eclipse's offer: not made, open, refused, taken

function comebackConfig() { return typeof CAMPAIGN !== "undefined" && CAMPAIGN.comeback ? CAMPAIGN.comeback : null; }
function isComeback(c) { return !!(c && c.mode === "comeback"); }
function comebackStartYear() {
  var e = getEra(COMEBACK_ERA);
  return e ? e.year : (typeof CAMPAIGN !== "undefined" ? CAMPAIGN.start_year : 0);
}
function comebackTier(c) { var cfg = comebackConfig(); return cfg && c ? cfg.tiers[c.tier] || null : null; }

// Months a comeback flight takes on the calendar: building it, then the launch campaign.
function flightMonths(design) {
  var cfg = comebackConfig();
  return devMonths(design) + (cfg ? cfg.launch_campaign_months : 0);
}

// The debt after `months` months of interest, compounded monthly and rounded like the rest of the money.
function accrueInterest(debt, months) {
  var cfg = comebackConfig(), r = cfg ? cfg.interest_per_month : 0;
  for (var i = 0; i < months; i++) debt = round(debt * (1 + r), 3);
  return debt;
}

// ---- contracts: the comeback's offers, with a client and a reason
// Clients pay for what the topic is worth and for the time the work takes: a radar takes far longer to
// build than a radiation counter, so sea-ice pays more. The instruments are those with the topic's first
// wanted tag (full credit) on the shelf today.
function contractPrice(objective) {
  var tag = objective.wants && objective.wants[0];
  var months = PARTS.filter(function (p) { return p.category === "instrument" && p.tags.indexOf(tag) !== -1 && isPartAvailable(p.id); })
    .reduce(function (m, p) { return Math.min(m, p.build_months || 0); }, Infinity);
  return round((objective.value_musd || 0) * CONTRACT_PRICE_SHARE + CONTRACT_PRICE_PER_MONTH * (isFinite(months) ? months : 0), 1);
}
function cheapestRocketTo(orbitId) {
  return LAUNCHERS.filter(function (l) { return isLauncherAvailable(l.id) && ((l.capacity_kg || {})[orbitId] || 0) > 0; })
    .reduce(function (m, l) { return Math.min(m, l.cost_musd); }, Infinity);
}
function contractText(k, topic, orbit) {
  return k.client + ": " + topic.name + (orbit ? ", from " + lcFirst(orbit.name) : "") + ". $" + k.price_musd +
    "M for at least " + k.min_science + " points of data, less for less; 3 stars adds $" + k.bonus_musd +
    "M. Open until month " + k.expires_month + ".";
}

// Drops expired contracts and refills to CAMPAIGN.comeback.contracts_open, from topics with new data
// left, never two for one topic. Seeded by the month and the flight count, so a save replays the same.
function makeContracts(c) {
  var cfg = comebackConfig();
  var all = c.offers || [];
  var open = all.filter(function (k) { return !k.done && k.expires_month > c.month; });
  var done = all.filter(function (k) { return k.done; });
  var salt = TIERS.map(function (t) { return t.id; }).indexOf(c.tier) + 1;
  // The run's seed (newComeback) makes every comeback draw different clients, topics and orbits; the same seed repeats.
  var rand = makeRandom(((c.seed || 0) ^ Math.imul((c.month * 7919 + (c.flights || 0) * 104729 + salt * 15485863 + 101) >>> 0, 2654435761)) >>> 0);
  var topics = OBJECTIVES.filter(function (o) {
    return isObjectiveAvailable(o.id) && (c.knowledge_science[o.id] || 0) < dataCap(o) &&
      typeof CONTRACTS !== "undefined" && CONTRACTS[o.id] && CONTRACTS[o.id].length;
  });
  for (var guard = 0; cfg && open.length < cfg.contracts_open && guard < 60; guard++) {
    if (topics.every(function (o) { return open.some(function (k) { return k.topic === o.id; }); })) break;
    var o = topics[Math.floor(rand() * topics.length)];
    if (open.some(function (k) { return k.topic === o.id; })) continue;
    var price = contractPrice(o);
    // A client names an orbit only if the topic can use it and a rocket that reaches it costs less than the contract pays.
    var orbits = ORBITS.filter(function (orb) { return (!o.orbit_fit || o.orbit_fit[orb.id] > 0) && cheapestRocketTo(orb.id) < price; });
    var orb = orbits.length > 1 && rand() < CONTRACT_ORBIT_CHANCE ? orbits[Math.floor(rand() * orbits.length)] : null;
    // Clients take turns: one the programme has not met on this topic comes first.
    var list = CONTRACTS[o.id], met = all.concat(open).filter(function (k) { return k.topic === o.id; }).map(function (k) { return k.client; });
    var fresh = list.filter(function (x) { return met.indexOf(x.client) === -1; }), pool = fresh.length ? fresh : list;
    var who = pool[Math.floor(rand() * pool.length)];
    var k = {
      id: "contract-" + (c.flights || 0) + "-" + o.id, topic: o.id, orbit: orb ? orb.id : null,
      client: who.client, reason: who.reason,
      min_science: Math.max(5, Math.round(CONTRACT_MIN_SHARE * o.science_target / 5) * 5),
      price_musd: price, bonus_musd: round(price * cfg.bonus_3_stars, 1),
      expires_month: c.month + cfg.contract_months, done: false
    };
    k.text = contractText(k, o, orb);
    open.push(k);
  }
  c.offers = open.concat(done);
}

function openContract(c, id) {
  if (!isComeback(c) || !id) return null;
  return (c.offers || []).filter(function (k) { return k.id === id && !k.done && k.expires_month > c.month; })[0] || null;
}
function contractSnapshot(k) {
  return k ? { id: k.id, topic: k.topic, orbit: k.orbit, client: k.client, reason: k.reason,
               min_science: k.min_science, price_musd: k.price_musd, bonus_musd: k.bonus_musd } : null;
}
function contractsList(c) {
  return (c.offers || []).filter(function (k) { return !k.done && k.expires_month > c.month; }).map(function (k) {
    var t = getObjective(k.topic), orb = k.orbit ? getOrbit(k.orbit) : null;
    return { id: k.id, client: k.client, reason: k.reason, topic: k.topic, topic_name: t ? t.name : k.topic,
             orbit: k.orbit, orbit_name: orb ? orb.name : null, min_science: k.min_science, price_musd: k.price_musd,
             bonus_musd: k.bonus_musd, expires_month: k.expires_month, months_left: k.expires_month - c.month, text: k.text };
  });
}

// What a contract pays for a flight: nothing without new data (the core loop), else the price times
// min(1, science / min_science), plus the 3-star bonus. A flight for another topic or orbit earns nothing.
function contractPay(k, design, science, newData, stars) {
  var out = { paid_musd: 0, bonus_musd: 0, share: 0, met: false };
  if (!k || !design || design.objective !== k.topic || (k.orbit && design.orbit !== k.orbit) || !(newData > 0)) return out;
  var share = k.min_science > 0 ? Math.min(1, science / k.min_science) : 1;
  out.share = round(share, 3);
  out.paid_musd = round(k.price_musd * share, 3);
  out.met = science >= k.min_science;
  out.bonus_musd = stars === 3 && out.paid_musd > 0 ? k.bonus_musd : 0;
  return out;
}

// Called by claimOffers in a comeback: the flown contract closes (one flight per contract) and pays.
function claimContract(c, mission, newData, stars) {
  var k = openContract(c, mission.design.contract);
  if (!k) return [];
  k.done = true;
  var p = contractPay(mission.contract || contractSnapshot(k), mission.design, mission.science, newData, stars);
  c.treasury_musd = round(c.treasury_musd + p.paid_musd + p.bonus_musd, 3);
  return [{ id: k.id, client: k.client, topic: k.topic, text: k.text, paid_musd: p.paid_musd, bonus_musd: p.bonus_musd, met: p.met }];
}

// The Build screen's payout line for a comeback design: the contract's pay if it flies as planned.
function previewContractPay(design, c) {
  var objective = getObjective(design.objective);
  var before = c.knowledge_science[design.objective] || 0;
  var sci = previewScience(design).total, cost = getTotals(design).cost_musd;
  var k = payoutFor(objective, before, sci);
  var ct = openContract(c, design.contract), p = contractPay(ct, design, sci, k.new_data, null);
  return { offers: [], expected_payout_musd: p.paid_musd, knowledge_before: k.knowledge_before,
           knowledge_after: k.knowledge_after, novelty: k.novelty, new_data: k.new_data, data_left: k.data_left,
           topic_complete: k.topic_complete, cost_musd: cost, net_musd: round(p.paid_musd - cost, 3),
           contract: ct ? { id: ct.id, client: ct.client, price_musd: ct.price_musd, bonus_musd: ct.bonus_musd,
                            min_science: ct.min_science, orbit: ct.orbit, expected_pay_musd: p.paid_musd, met: p.met } : null };
}

// ---- the money and the clock
function startDebt(c) {
  if (c && isNumber(c.start_debt_musd)) return c.start_debt_musd;   // the debt this run began with (kept if the tuning changes)
  var t = comebackTier(c); return t ? t.debt_musd : 0;
}
function paidSoFar(c) {
  return round((c.log || []).reduce(function (t, e) { return e.kind === "payment" ? t + (e.musd || 0) : t; }, 0), 3);
}
// The cheapest launchable design for any open contract (its topic, and its orbit when named), or Infinity.
function comebackCheapest(c) {
  return contractsList(c).reduce(function (m, k) { return Math.min(m, cheapestLaunchCost(c, k.topic, k.orbit)); }, Infinity);
}
function safePayMax(c) {
  if (!isComeback(c) || c.finished) return 0;
  if (c.treasury_musd >= c.debt_musd) return c.debt_musd;
  var cheapest = comebackCheapest(c);
  return isFinite(cheapest) ? Math.max(0, round(c.treasury_musd - cheapest, 3)) : 0;
}

// Why a comeback is lost right now, or null. One check, after every flight and every payment.
function comebackLoss(c) {
  if (!isComeback(c) || c.won || !(c.debt_musd > 0)) return null;
  if (c.month >= c.deadline_month) return "deadline";
  if (c.treasury_musd >= c.debt_musd) return null;           // it can still pay the lenders off today
  if (c.treasury_musd < comebackCheapest(c)) return "cash";   // no open contract can be flown (or none is left)
  return null;
}
function checkComebackEnd(c) {
  if (c.finished) return;
  if (!(c.debt_musd > 0)) { c.debt_musd = 0; c.finished = true; c.won = true; return; }
  if (comebackLoss(c)) { c.finished = true; c.won = false; }
}
// The reason a finished comeback was lost: the deadline if it came, else the cash (never for a sold company).
function lostReason(c) {
  if (!isComeback(c) || !c.finished || c.won || c.buyout === "accepted") return null;
  return c.month >= c.deadline_month ? "deadline" : "cash";
}

// Checks the readiness review adds for a comeback design (called by runChecks in game.js).
function comebackChecks(design, t) {
  var out = { blockers: [], warnings: [] };
  var c = getCampaign();
  if (!isComeback(c)) {
    out.blockers.push({ id: "no-comeback", text: "This design belongs to Ajay's comeback, and none is running." });
    return out;
  }
  if (c.finished) { out.blockers.push({ id: "comeback-over", text: "The comeback is over." }); return out; }
  if (c.buyout === "offered") { out.blockers.push({ id: "buyout-open", text: "Answer Iron Eclipse's offer first." }); return out; }
  var k = design.comeback ? openContract(c, design.contract) : null;   // a 1957 design has no contract
  if (!k) {
    out.blockers.push({ id: "no-contract", text: design.contract ? "That contract is no longer open: pick another on the hub."
                                                                  : "Pick a contract on the hub first: nobody pays for data without one." });
  } else {
    var topic = getObjective(k.topic), orb = k.orbit ? getOrbit(k.orbit) : null;
    if (design.objective && design.objective !== k.topic) {
      out.blockers.push({ id: "contract-topic", text: k.client + " is paying for " + lcFirst(topic ? topic.name : k.topic) + " data, not this." });
    }
    if (orb && design.orbit && design.orbit !== k.orbit) {
      out.blockers.push({ id: "contract-orbit", text: k.client + " wants the data from " + lcFirst(orb.name) + "." });
    }
  }
  var months = flightMonths(design), left = c.deadline_month - c.month;
  if (design.parts.length && months >= left) {
    out.warnings.push({ id: "deadline", text: "Building and launching this takes " + months + " months, but the lenders' deadline is in " +
      left + (left === 1 ? " month" : " months") + ": the pay would come too late, and the comeback would end when it lands." });
  }
  return out;
}

// ---- the API for the screens
// Starts and saves a new comeback (replacing any saved campaign); returns getComeback().
// seed (optional, a whole number, kept to 32 bits): the contracts, clients and reasons come from it, so the same seed
// plays the same run and a new one plays differently. With none, a random seed is drawn. getComeback().seed says which.
function newComeback(tierId, seed) {
  var cfg = comebackConfig();
  if (!cfg) return null;
  seed = typeof seed === "number" && isFinite(seed) ? Math.floor(Math.abs(seed)) % 4294967296 : Math.floor(Math.random() * 4294967296);
  var tier = getTier(tierId) && cfg.tiers[tierId] ? getTier(tierId) : (getTier("standard") || TIERS[0]);
  var t = cfg.tiers[tier.id];
  var knowledge = {};
  OBJECTIVES.forEach(function (o) { knowledge[o.id] = 0; });
  var c = {
    version: campaignVersion(),
    mode: "comeback",
    tier: tier.id,
    seed: seed,                     // 32-bit: what this run's contracts are drawn from
    buyout: "none",                 // Iron Eclipse's offer: "none" | "offered" | "refused" | "accepted"
    year: comebackStartYear(),
    month: 0,                       // months since the comeback started
    deadline_month: t.deadline_months,
    treasury_musd: t.cash_musd,     // the cash
    debt_musd: t.debt_musd,
    start_debt_musd: t.debt_musd,   // the debt this run began with (the hub's and the chronicle's reference)
    knowledge_science: knowledge,
    research: (typeof RESEARCH === "undefined" ? [] : RESEARCH).map(function (r) { return r.id; }),   // today's parts: nothing to research
    upgrades: PARTS.filter(function (p) { return p.upgrade; }).map(function (p) { return p.id; }),
    science_pts: 0,
    lessons: [],
    missions: [],
    flights: 0,
    log: [],
    finished: false,
    won: false
  };
  saveCampaign(c);
  makeOffers(c);
  checkComebackEnd(c);
  saveCampaign(c);
  return getComeback();
}

// The hub: null unless the saved campaign is a comeback.
function getComeback() {
  var c = getCampaign();
  if (!isComeback(c)) return null;
  var cfg = comebackConfig(), tier = getTier(c.tier), cheapest = comebackCheapest(c);
  var missions = c.missions || [], last = missions[missions.length - 1] || null, lastTopic = last ? getObjective(last.objective) : null;
  var startD = startDebt(c);
  return {
    mode: "comeback",
    seed: c.seed,
    tier: c.tier,
    tier_name: tier ? tier.name : c.tier,
    year: c.year,
    month: c.month,
    months_left: Math.max(0, c.deadline_month - c.month),
    deadline_month: c.deadline_month,
    cash_musd: c.treasury_musd,
    debt_musd: c.debt_musd,
    start_debt_musd: startDebt(c),
    interest_per_month: cfg ? cfg.interest_per_month : 0,
    debt_paid_musd: paidSoFar(c),
    safe_pay_max_musd: safePayMax(c),
    cheapest_launch_musd: isFinite(cheapest) ? cheapest : null,
    contracts: c.finished ? [] : contractsList(c),
    flights: c.flights || 0,
    missions: c.missions || [],
    finished: !!c.finished,
    won: !!c.won,
    lost_reason: lostReason(c),
    // For the story screens (js/ui-story.js): which act of the run this is, what the last flight did, and the offer.
    act: missions.length >= 2 ? 3 : missions.length + 1,       // 1 before any flight is settled, 2 after one, 3 after two or more
    last_flight: last ? { stars: last.stars || 0, paid_musd: last.payout_musd || 0, new_data: last.new_data || 0,
                          ended_early: !!last.ended_early, topic: last.objective, topic_name: lastTopic ? lastTopic.name : last.objective } : null,
    debt_share_left: c.won || !(c.debt_musd > 0) ? 0 : startD > 0 ? Math.max(0.01, round(Math.min(1, c.debt_musd / startD), 2)) : 1,   // 0..1, for choosing beats only
    buyout: c.buyout || "none",                                 // "none" | "offered" | "refused" | "accepted"
    offer: c.buyout === "offered" && !c.finished ? { id: "buyout" } : null,   // open until acceptBuyout() or refuseBuyout()
    ending_id: comebackEndingId(c)                              // null until finished
  };
}

// Iron Eclipse's offer: once CAMPAIGN.comeback.buyout_after_flights flights are settled and the debt stands, it
// offers to clear the whole debt for the workshop, the patents and Austin's notebook. Made once; it blocks the next
// design (newComebackDesign returns null) until the player answers.
function maybeOfferBuyout(c) {
  var cfg = comebackConfig();
  if (!cfg || c.finished || c.buyout !== "none" || !(c.debt_musd > 0)) return;
  if ((c.missions || []).length >= cfg.buyout_after_flights) c.buyout = "offered";
}
function acceptBuyout() {
  var c = getCampaign();
  if (!isComeback(c)) return { ok: false, reason: "No comeback is running." };
  if (c.finished) return { ok: false, reason: "The comeback is over." };
  if (c.buyout !== "offered") return { ok: false, reason: "Nobody is offering to buy Albert Orbital." };
  c.buyout = "accepted";
  c.finished = true;
  c.won = false;
  saveCampaign(c);
  return { ok: true, reason: null };
}
function refuseBuyout() {
  var c = getCampaign();
  if (!isComeback(c)) return { ok: false, reason: "No comeback is running." };
  if (c.finished) return { ok: false, reason: "The comeback is over." };
  if (c.buyout !== "offered") return { ok: false, reason: "Nobody is offering to buy Albert Orbital." };
  c.buyout = "refused";
  saveCampaign(c);
  return { ok: true, reason: null };
}

// How a finished comeback ended, or null while it runs: legend | comeback | close | sold | timeout | broke.
// A win is "legend" with an average of CAMPAIGN.comeback.legend_avg_stars or more a flight, else "close" with
// close_share of the deadline or less left, else "comeback".
function comebackEndingId(c) {
  if (!isComeback(c) || !c.finished) return null;
  if (c.buyout === "accepted") return "sold";
  if (!c.won) return lostReason(c) === "deadline" ? "timeout" : "broke";
  var cfg = comebackConfig() || {}, missions = c.missions || [];
  var stars = missions.reduce(function (t, m) { return t + (m.stars || 0); }, 0);
  if (missions.length && stars / missions.length >= (cfg.legend_avg_stars || 2.5)) return "legend";
  if (Math.max(0, c.deadline_month - c.month) <= (cfg.close_share || 0.1) * c.deadline_month) return "close";
  return "comeback";
}

// A design that flies for one open contract: the topic (and the orbit, when the client names one) is preset.
function newComebackDesign(contractId) {
  var c = getCampaign();
  if (!isComeback(c) || c.finished || c.buyout === "offered") return null;   // an open offer must be answered first
  var k = openContract(c, contractId);
  if (!k) return null;
  var d = newDesign(c.tier);
  d.campaign = true;
  d.comeback = true;
  d.contract = k.id;
  setObjective(d, k.topic);
  if (k.orbit) setOrbit(d, k.orbit);
  return d;
}

// PAY BACK: moves cash to the debt. Refuses what is not a positive number, more than the cash, and a
// partial payment that would leave too little cash to launch anything (more than safe_pay_max_musd).
// More than the debt pays the debt. Paying the whole debt wins at once.
function payDebt(amountMusd) {
  var c = getCampaign();
  function no(reason) {
    return { ok: false, reason: reason, paid_musd: 0, cash_musd: c ? c.treasury_musd : null, debt_musd: c ? c.debt_musd : null, won: !!(c && c.won) };
  }
  if (!isComeback(c)) { c = null; return no("No comeback is running."); }
  if (c.finished) return no("The comeback is over.");
  if (typeof amountMusd !== "number" || !isFinite(amountMusd)) return no("Pay an amount in millions of dollars.");
  if (amountMusd <= 0) return no("Pay more than nothing.");
  var amount = round(Math.min(amountMusd, c.debt_musd), 3);
  if (amount <= 0) return no("Pay at least $0.001M.");                 // money is kept to the thousandth of a million
  if (amount > c.treasury_musd + 1e-9) return no("Ajay has only $" + c.treasury_musd + "M in cash.");
  var safe = safePayMax(c);
  if (amount < c.debt_musd && amount > safe + 1e-9) {
    return no("That would leave too little cash to launch anything: pay at most $" + safe + "M now, or the whole debt.");
  }
  c.treasury_musd = round(c.treasury_musd - amount, 3);
  c.debt_musd = round(c.debt_musd - amount, 3);
  (c.log = c.log || []).push({ year: c.year, month: c.month, kind: "payment", musd: amount });
  checkComebackEnd(c);
  saveCampaign(c);
  return { ok: true, reason: null, paid_musd: amount, cash_musd: c.treasury_musd, debt_musd: c.debt_musd, won: !!c.won };
}

// Called from settleCampaign for a comeback flight: the contract pays, events cost cash, months pass and
// the debt grows; then contracts expire and refill, and the comeback may end.
function settleComeback(c, mission, debrief, result) {
  var obj = mission.design.objective;
  var newData = newDataFor(getObjective(obj), c.knowledge_science[obj] || 0, mission.science);
  c.knowledge_science[obj] = (c.knowledge_science[obj] || 0) + newData;
  var claimed = claimOffers(c, mission, c.year, newData, debrief.stars);
  var pay = claimed[0] || { id: null, paid_musd: 0, bonus_musd: 0 };
  c.treasury_musd = round(c.treasury_musd - mission.extra_cost_musd, 3);
  var used = flightMonths(mission.design), debtBefore = c.debt_musd, yearFlown = c.year;
  c.debt_musd = accrueInterest(c.debt_musd, used);
  var interest = round(c.debt_musd - debtBefore, 3);
  c.month += used;
  c.year = comebackStartYear() + Math.floor(c.month / 12);
  c.science_pts = round((c.science_pts || 0) + newData, 1);
  var newLessons = lessonsFrom(mission, debrief, c).filter(function (l) { return c.lessons.indexOf(l) === -1; });
  c.lessons = c.lessons.concat(newLessons);
  c.missions.push({ id: mission.id, year: yearFlown, objective: obj, orbit: mission.design.orbit,
                    spent_musd: debrief.spent_musd, science: round(mission.science, 1),
                    payout_musd: round(pay.paid_musd + pay.bonus_musd, 3), stars: debrief.stars,
                    flight: mission.campaign_flight || c.flights, new_data: round(newData, 1), first_look: (debrief.knowledge_before || 0) < 0.05 && newData > 0,
                    months: mission.month, ended_early: !!mission.ended_early, limiting: debrief.limiting_name || null,
                    parts: designParts(mission.design).length,
                    real: debrief.closest_mission ? { name: debrief.closest_mission.name, year: debrief.closest_mission.year } : null,
                    month: c.month, contract: mission.design.contract || null });   // comeback: the month the pay came, and for whom
  saveCampaign(c);
  makeOffers(c);
  checkComebackEnd(c);
  maybeOfferBuyout(c);
  saveCampaign(c);

  result.offers_claimed = [];
  result.payout_musd = round(pay.paid_musd + pay.bonus_musd, 3);
  result.grant_musd = 0;
  result.event_costs_musd = round(mission.extra_cost_musd, 3);
  result.knowledge_before = debrief.knowledge_before;
  result.knowledge_after = debrief.knowledge_after;
  result.novelty = debrief.novelty;
  result.treasury_musd = c.treasury_musd;
  result.year = c.year;
  result.bailout = false;
  result.bailout_musd = 0;
  result.campaign_over = !!c.finished;
  result.won = !!c.won;
  result.lessons_new = newLessons;
  result.science_pts_earned = round(newData, 1);
  result.new_data = round(newData, 1);
  result.nothing_new = mission.science > 0 && newData === 0;
  result.best_next_topic = bestNextTopic(obj);
  result.archive_sci = 0;
  result.science_pts = c.science_pts;
  // The comeback's own numbers for the debrief:
  result.contract_id = pay.id;
  result.contract_paid_musd = pay.paid_musd;
  result.contract_bonus_musd = pay.bonus_musd;
  result.cash_musd = c.treasury_musd;
  result.debt_musd = c.debt_musd;
  result.interest_musd = interest;
  result.months_used = used;
  result.months_left = Math.max(0, c.deadline_month - c.month);
  result.comeback_over = !!c.finished;
  result.lost_reason = lostReason(c);
}

// The ending: a short chronicle of the comeback, won, lost or still running.
function getComebackEnding() {
  var c = getCampaign();
  if (!isComeback(c)) return null;
  var missions = c.missions || [], lost = lostReason(c);
  var start = startDebt(c), paid = paidSoFar(c), interest = round(c.debt_musd - start + paid, 3);
  var earned = round(missions.reduce(function (t, m) { return t + (m.payout_musd || 0); }, 0), 3);
  var stars = missions.reduce(function (t, m) { return t + (m.stars || 0); }, 0);
  function money(x) { return "$" + round(x, 1) + "M"; }
  function months(n) { return n + (n === 1 ? " month" : " months"); }
  var timeline = [];
  missions.forEach(function (m, i) {
    var o = getObjective(m.objective), orbit = getOrbit(m.orbit);
    var k = (c.offers || []).filter(function (x) { return x.id === m.contract; })[0];
    timeline.push({ month: m.month, title: "G-" + (m.flight || i + 1) + ": " + flightHeadline(m, o, orbit ? orbit.name : m.orbit),
      text: "Flown for " + (k ? lcFirst(k.client) : "no client") + " from " + lcFirst(orbit ? orbit.name : m.orbit) + ": " +
        round(m.science, 0) + " points of data, " + (m.stars || 0) + (m.stars === 1 ? " star" : " stars") + ", paid " + money(m.payout_musd || 0) + "." +
        (m.real ? " Its real twin: " + m.real.name + " (" + m.real.year + ")." : "") });
  });
  (c.log || []).forEach(function (e) {
    if (e.kind === "payment") timeline.push({ month: e.month, title: "Paid the lenders " + money(e.musd), text: "Every dollar paid now stops growing interest." });
  });
  timeline = timeline.map(function (e, i) { return { e: e, i: i }; })
    .sort(function (a, b) { return a.e.month - b.e.month || a.i - b.i; }).map(function (x) { return x.e; });
  var title, headline, text, epilogue = null;
  if (c.buyout === "accepted") {
    title = "Sold out";
    headline = "Iron Eclipse buys Albert Orbital, workshop and all";
    text = "Ajay flew " + missions.length + (missions.length === 1 ? " satellite" : " satellites") + " and earned " + money(earned) +
      ", then sold the workshop, the patents and Austin's notebook to clear what was owed.";
    epilogue = "The debt is gone. So is the workshop, and the notebook is in Iron Eclipse's vault with Marcus Voss's name on the door.";
  } else if (c.won) {
    title = "The workshop is yours";
    headline = "Albert Orbital clears its debt in " + months(c.month);
    text = "Ajay flew " + missions.length + (missions.length === 1 ? " satellite" : " satellites") + " for paying clients, earned " +
      money(earned) + " and paid the lenders " + money(paid) + ", " + money(interest) + " of it interest, with " +
      months(Math.max(0, c.deadline_month - c.month)) + " to spare.";
    epilogue = "The lenders hand back the keys. In the workshop, Ajay opens Austin's notebook to the last page, the one his grandfather never got to fill, and starts writing.";
  } else if (lost) {
    title = lost === "deadline" ? "Out of time" : "Out of money";
    headline = lost === "deadline" ? "The deadline passes with " + money(c.debt_musd) + " still owed"
                                   : "Albert Orbital runs out of cash with " + money(c.debt_musd) + " still owed";
    text = "Ajay flew " + missions.length + (missions.length === 1 ? " satellite" : " satellites") + " and earned " + money(earned) +
      (lost === "deadline" ? ", but the lenders' clock ran out first." : ", but the cash ran out before the debt did: nothing left could launch.") +
      " He paid back " + money(paid) + "; interest added " + money(interest) + ".";
    epilogue = "The lenders change the locks on the workshop. Ajay keeps the notebook. Somewhere, Iron Eclipse sends flowers.";
  } else {
    title = "Ajay's comeback so far";
    headline = money(c.debt_musd) + " still owed, " + months(Math.max(0, c.deadline_month - c.month)) + " left";
    text = missions.length + (missions.length === 1 ? " flight" : " flights") + " so far, " + money(earned) + " earned and " + money(paid) + " paid back.";
  }
  return {
    won: !!c.won, lost_reason: lost, ending_id: comebackEndingId(c), title: title, headline: headline, text: text,
    totals: { flights: missions.length, stars: stars, earned_musd: earned, paid_musd: paid, interest_musd: interest, months: c.month },
    timeline: timeline,
    epilogue: epilogue
  };
}
