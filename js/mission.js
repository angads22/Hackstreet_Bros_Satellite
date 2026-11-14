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
function pickWeighted(pool, orbitId, rand) {
  var weights = pool.map(function (e) {
    return (e.orbit_weight && orbitId && e.orbit_weight[orbitId] !== undefined) ? e.orbit_weight[orbitId] : 1;
  });
  var total = weights.reduce(function (a, b) { return a + b; }, 0), r = rand() * total;
  for (var i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
}

// ------------------------------------------------------------------ mission
function startMission(design) {
  var orbit = getOrbit(design.orbit);
  var tier = getTier(design.tier);
  var lifetime = orbit ? orbit.lifetime_months : 12;
  var rand = makeRandom(designSeed(design));

  // Pick distinct events and distinct months (never month 1 or the last month).
  var pool = EVENTS.slice();
  var count = Math.min(tier ? tier.events : 1, pool.length, Math.max(0, lifetime - 2));
  var schedule = [];
  var usedMonths = {};
  for (var i = 0; i < count; i++) {
    var ev = pool.splice(pickWeighted(pool, orbit ? orbit.id : null, rand), 1)[0];
    var month;
    do { month = 2 + Math.floor(rand() * (lifetime - 2)); } while (usedMonths[month]);
    usedMonths[month] = true;
    schedule.push({ month: month, event: ev });
  }
  schedule.sort(function (a, b) { return a.month - b.month; });

  var totals = getTotals(design);
  var thin = (totals.margins.mass !== null && totals.margins.mass < LOW_MARGIN) ||
             (totals.margins.power !== null && totals.margins.power < LOW_MARGIN);

  return {
    design: design,
    rand: rand,
    month: 0,
    lifetime_months: lifetime,
    science: 0,
    schedule: schedule,
    pending_event: null,
    events_seen: [],          // { id, title, choice, label, protected, failed_part }
    broken: [],               // ids of parts that have failed
    lost_months: 0,           // months still to skip because of events
    science_mult: 1,          // product of event science_mult effects
    extra_cost_musd: 0,       // costs added by events
    thin_margins: thin,
    // Bookkeeping for the debrief:
    lost: { data: 0, power: 0, event: 0 },
    // Real-world tally against NASA data (data/earth.js):
    real: { fires_in_view: 0, fires_reported: 0, months_mapped: 0, dark_months_mapped: 0 },
    ended: false,
    ended_early: false,
    end_reason: null
  };
}

function isProtected(design, eventId) {
  return designParts(design).some(function (p) { return p.protects.indexOf(eventId) !== -1; });
}

// A required category with no working parts ends the mission.
function missingRequired(mission) {
  var working = designParts(mission.design).filter(function (p) {
    return mission.broken.indexOf(p.id) === -1;
  });
  for (var i = 0; i < REQUIRED_CATEGORIES.length; i++) {
    var cat = REQUIRED_CATEGORIES[i];
    if (!working.some(function (p) { return p.category === cat; })) return cat;
  }
  return null;
}

function stepMonth(mission) {
  if (mission.ended || mission.pending_event) {
    return { month: mission.month, science: round(mission.science, 1),
             event: mission.pending_event, ended: mission.ended };
  }
  mission.month += 1;
  var cal = calendarMonth(mission.month);

  // Earn this month's science, unless an event cost us the month.
  var rate = scienceRate(mission.design, mission.broken, cal);
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

  if (!event && mission.month >= mission.lifetime_months) mission.ended = true;
  return { month: mission.month, science: round(mission.science, 1), event: event, ended: mission.ended,
           calendar_month: cal, month_name: MONTH_NAMES[cal], real: realThisMonth(mission.design.objective, cal) };
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
function realThisMonth(objectiveId, cal) {
  var e = earthFor(objectiveId);
  if (!e) return null;
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
  var quality = rate.data_share * rate.power_share * mission.science_mult;
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
function realWorldSummary(mission) {
  var e = earthFor(mission.design.objective);
  if (!e) return null;
  if (e.monthly_share) {
    var years = mission.month / 12;
    var seen = mission.real.fires_in_view, reported = mission.real.fires_reported;
    var view = e.orbit_view ? (e.orbit_view[mission.design.orbit] || 0) : 1;
    return {
      fires_per_year: e.detections,
      share_in_view: view,
      fires_reported: Math.round(reported),
      share_reported: seen > 0 ? round(reported / (e.detections * years), 3) : 0,
      text: "In " + e.year + ", NASA's MODIS instruments detected " + e.detections.toLocaleString("en-US") +
        " active fires worldwide. From this orbit your satellite could see " + Math.round(view * 100) +
        "% of them. Over " + mission.month + " months it would have reported about " +
        Math.round(reported).toLocaleString("en-US") + " fires, " +
        Math.round(100 * reported / (e.detections * Math.max(years, 1 / 12))) + "% of all the fires that burned."
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
        " million km2, " + drop + "% below the 1981-2010 average (NSIDC). Your satellite mapped the ice in " +
        mission.real.months_mapped + " of " + mission.month + " months, " +
        (mission.real.dark_months_mapped
          ? "including " + mission.real.dark_months_mapped + " months of polar night, when only radar can see."
          : "but none in the " + dark + " months of polar night each year, when only radar can see.")
    };
  }
  return null;
}

// `choice` is the index of the chosen option in event.choices.
// Returns what happened: { id, title, choice, label, protected, failed_part,
// ended, ended_early }. failed_part is a part id or null.
function chooseEvent(mission, choice) {
  var event = mission.pending_event;
  if (!event) return null;
  var picked = event.choices[choice] || event.choices[0];
  var effect = picked.effect || {};
  var prot = isProtected(mission.design, event.id);
  var record = { id: event.id, title: event.title, choice: choice, label: picked.label,
                 protected: prot, failed_part: null };

  // Protection cancels the penalty of the riskiest choice (the one with a fail_chance).
  var riskiest = prot && effect.fail_chance;

  if (!riskiest) {
    if (effect.lose_months) mission.lost_months += effect.lose_months;
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
    mission.end_reason = { event: event.id, title: event.title, category: missing };
  } else if (mission.month >= mission.lifetime_months) {
    mission.ended = true;
  }
  return { id: record.id, title: record.title, choice: record.choice, label: record.label,
           protected: record.protected, failed_part: record.failed_part,
           ended: mission.ended, ended_early: mission.ended_early };
}

// ------------------------------------------------------------------ debrief
function getDebrief(mission) {
  var design = mission.design;
  var objective = getObjective(design.objective);
  var totals = getTotals(design);
  var tier = getTier(design.tier);
  var target = objective ? objective.science_target : 100;

  // Score (SPEC.md "Scoring")
  var scienceShare = Math.min(1, mission.science / target);
  var spent = totals.cost_musd + mission.extra_cost_musd;
  var budgetShare = tier ? Math.max(0, (tier.budget_musd - spent) / tier.budget_musd) : 0;
  var massOk = totals.margins.mass !== null && totals.margins.mass >= LOW_MARGIN;
  var powerOk = totals.margins.power !== null && totals.margins.power >= LOW_MARGIN;
  var events = mission.events_seen.length;
  var clean = mission.events_seen.filter(function (e) { return !e.failed_part; }).length;

  var parts = {
    science: round(60 * scienceShare, 1),
    budget: round(15 * budgetShare, 1),
    margins: (massOk ? 7.5 : 0) + (powerOk ? 7.5 : 0),
    events: round(events ? 10 * clean / events : 10, 1)
  };
  var score = Math.round(parts.science + parts.budget + parts.margins + parts.events);
  var stars = score >= 90 ? 3 : score >= 70 ? 2 : score >= 50 ? 1 : 0;

  var lim = limitingFactor(mission, totals, scienceShare);
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
    real_world: realWorldSummary(mission),
    events: mission.events_seen,
    ended_early: mission.ended_early
  };
}

// The single thing that most limited the mission, and one concrete change.
function limitingFactor(mission, totals, scienceShare) {
  var design = mission.design;
  if (mission.ended_early) {
    var r = mission.end_reason;
    var guard = PARTS.filter(function (p) { return p.protects.indexOf(r.event) !== -1; })[0];
    return { key: "event", suggestion: "The " + r.title.toLowerCase() + " knocked out your only " + r.category +
      " part. " + (guard ? "Fly the " + guard.name.toLowerCase() + ", which guards against it, or carry a spare."
                         : "Carry a spare " + r.category + " part, or pick the safer option next time.") };
  }

  var lost = mission.lost;
  var biggest = Math.max(lost.data, lost.power, lost.event);
  var potential = mission.science + lost.data + lost.power + lost.event;
  if (biggest > 0.05 * potential && scienceShare < 1) {
    if (biggest === lost.data) {
      return { key: "data", suggestion: "Only " + totals.data_returned_gb_day + " of " + totals.data_gb_day +
        " GB a day reached the ground. Fit a faster radio, such as X-band, or fly an orbit with longer ground contact." };
    }
    if (biggest === lost.power) {
      return { key: "power", suggestion: "Your instruments switched off in Earth's shadow. Add a battery big enough to carry them through the eclipse." };
    }
    return { key: "event", suggestion: "Events cost you months of observing. Protective parts, or the safer choice, keep the mission running." };
  }

  if (scienceShare < 1) {
    if (totals.margins.budget !== null && totals.margins.budget < LOW_MARGIN) {
      return { key: "budget", suggestion: "You spent " + Math.round((1 - totals.margins.budget) * 100) +
        "% of the budget. A cheaper rocket, such as a rideshare, frees money for better instruments." };
    }
    if (totals.margins.mass !== null && totals.margins.mass < LOW_MARGIN) {
      return { key: "mass", suggestion: "The rocket was nearly full. A bigger launcher or lighter parts would give you room." };
    }
    var rate = scienceRate(design, []);
    var weak = rate.instruments.filter(function (i) { return i.match === 0 || !i.sharp_enough; });
    if (weak.length) {
      return { key: "design", suggestion: "Some instruments earned nothing: wrong type for this objective, or too blurry from this orbit. Swap them for ones that suit it." };
    }
    // A wanted instrument type nobody carries is the cheapest way to more science.
    var objective = getObjective(design.objective);
    var carried = designParts(design).filter(function (p) { return p.category === "instrument"; })
      .reduce(function (tags, p) { return tags.concat(p.tags); }, []);
    var missingTag = objective ? objective.wants.filter(function (t) { return carried.indexOf(t) === -1; })[0] : null;
    var extra = missingTag ? PARTS.filter(function (p) { return p.category === "instrument" && p.tags.indexOf(missingTag) !== -1; })[0] : null;
    return { key: "design", suggestion: extra
      ? "Nothing ran short, but one instrument was not enough. Add the " + extra.name.toLowerCase() + " as well; this objective counts it too."
      : "Nothing ran short, but the science fell below target. Try an orbit that suits the objective better." };
  }
  return { key: "none", suggestion: "Target reached. Try the next tier, or reach it on a smaller budget." };
}

// ------------------------------------------------------------------ progress
// Two stars on a tier unlocks the next one (SPEC.md, "Difficulty tiers").
// Saved in localStorage when the browser allows it; otherwise kept in memory
// for this visit only, so the game still runs in a private window or in Node.
var PROGRESS_KEY = "smdg-progress-v1";
var memoryProgress = null;

function emptyProgress() { return { best_stars: {}, best_score: {} }; }

function getProgress() {
  try {
    if (typeof localStorage !== "undefined") {
      var raw = localStorage.getItem(PROGRESS_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) { /* storage blocked: fall through to memory */ }
  return memoryProgress || emptyProgress();
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
  var tierId = mission.design.tier;
  var d = getDebrief(mission);
  var p = getProgress();
  var i = TIERS.map(function (t) { return t.id; }).indexOf(tierId);
  var nextId = TIERS[i + 1] ? TIERS[i + 1].id : null;
  var wasLocked = nextId ? !isTierUnlocked(nextId) : false;
  p.best_stars[tierId] = Math.max(p.best_stars[tierId] || 0, d.stars);
  p.best_score[tierId] = Math.max(p.best_score[tierId] || 0, d.score);
  saveProgress(p);
  return { stars: d.stars, best_stars: p.best_stars[tierId],
           unlocked: nextId && wasLocked && isTierUnlocked(nextId) ? nextId : null };
}

function resetProgress() { saveProgress(emptyProgress()); }
