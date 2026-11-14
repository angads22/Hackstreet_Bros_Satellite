// js/game.js — Rules: totals, the eight formulas, blockers and warnings.
//
// This file must never touch the page: no `document`, no HTML.
// Test it from the browser console, for example:
//   var d = newDesign("training"); setOrbit(d, "sso"); addPart(d, "sar-radar"); getTotals(d)

// ------------------------------------------------------------------ constants
var MU = 3.986e14;          // Earth's gravitational parameter, m^3/s^2
var R_EARTH_KM = 6371;      // Earth's radius, km
var G0 = 9.81;              // standard gravity, m/s^2
var SUN_W_M2 = 1361;        // sunlight above the atmosphere, W/m^2
var DOD = 0.3;              // battery depth of discharge (formula 5)
var LOW_MARGIN = 0.10;      // margins under 10% raise a warning
// Part categories in Build-screen order (SPEC.md, "Structure and attitude control").
// Switch-over: structure and attitude become required only when the Build screen
// has bins for them. Design screens sets this to true in the same change.
var NEW_CATEGORIES_REQUIRED = false;
var CATEGORY_LIST = [
  { id: "structure",  name: "STRUCTURE",  sub: "The satellite's body",      required: "new" },
  { id: "instrument", name: "INSTRUMENTS", sub: "What the mission sees",    required: true },
  { id: "power",      name: "POWER",      sub: "Panels and batteries",      required: true },
  { id: "comms",      name: "RADIO",      sub: "Send data home",            required: true },
  { id: "computer",   name: "COMPUTER",   sub: "Runs the spacecraft",       required: true },
  { id: "attitude",   name: "ATTITUDE",   sub: "Keeps it pointed",          required: "new" },
  { id: "propulsion", name: "PROPULSION", sub: "Speed change, optional",    required: false }
];
function getCategories() {
  return CATEGORY_LIST.map(function (c) {
    return { id: c.id, name: c.name, sub: c.sub, required: c.required === "new" ? NEW_CATEGORIES_REQUIRED : c.required };
  });
}
function requiredCategories() { return getCategories().filter(function (c) { return c.required; }).map(function (c) { return c.id; }); }
var REQUIRED_CATEGORIES = requiredCategories();   // fixed at load; use requiredCategories() in logic

// Instruments that need a steady view: on a spinning satellite their pictures smear.
var POINTING_TAGS = ["imaging", "thermal", "radar"];
var SPIN_SMEAR = 0.6;   // GAME VALUE: share of science a smeared instrument still returns

// ------------------------------------------------------------------ lookups
function findById(list, id) {
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}
function getPart(id)      { return findById(PARTS, id); }
function getOrbit(id)     { return findById(ORBITS, id); }
function getLauncher(id)  { return findById(LAUNCHERS, id); }
function getObjective(id) { return findById(OBJECTIVES, id); }
function getTier(id)      { return findById(TIERS, id); }

function designParts(design) {
  return design.parts.map(getPart).filter(function (p) { return p; });
}
function sum(list, fn) {
  var t = 0;
  for (var i = 0; i < list.length; i++) t += fn(list[i]) || 0;
  return t;
}
function round(x, places) {
  var f = Math.pow(10, places || 0);
  return Math.round(x * f) / f;
}

// ------------------------------------------------------------------ design edits
function newDesign(tierId) {
  // Unknown tier ids fall back to the first tier, so the budget check always applies.
  if (!getTier(tierId)) tierId = TIERS.length ? TIERS[0].id : "training";
  return {
    tier: tierId,
    objective: null,
    orbit: null,
    parts: [],        // list of part ids
    launcher: null
  };
}
function setObjective(design, id) { design.objective = id; return design; }
function setOrbit(design, id)     { design.orbit = id; return design; }
function setLauncher(design, id)  { design.launcher = id; return design; }
function addPart(design, partId) {
  if (getPart(partId) && design.parts.indexOf(partId) === -1) design.parts.push(partId);
  return design;
}
function removePart(design, partId) {
  design.parts = design.parts.filter(function (id) { return id !== partId; });
  return design;
}

// ------------------------------------------------------------------ the eight formulas

// 1. Rocket equation: dv = Isp g0 ln(m_full / m_empty)
function rocketDeltaV(ispS, mFullKg, fuelKg) {
  if (!ispS || fuelKg <= 0 || mFullKg <= fuelKg) return 0;
  return ispS * G0 * Math.log(mFullKg / (mFullKg - fuelKg));
}

// 2. Orbital speed and period, r = R + h
function orbitRadiusM(altitudeKm) { return (R_EARTH_KM + altitudeKm) * 1000; }
function orbitalSpeedMs(altitudeKm) { return Math.sqrt(MU / orbitRadiusM(altitudeKm)); }
function orbitalPeriodS(altitudeKm) {
  var r = orbitRadiusM(altitudeKm);
  return 2 * Math.PI * Math.sqrt(r * r * r / MU);
}

// 3. Solar power: P = S A eta cos(theta), theta = 0
function solarPowerW(part) {
  if (!part.panel_area_m2 || !part.efficiency) return part.power_gen_w || 0;
  return SUN_W_M2 * part.panel_area_m2 * part.efficiency;
}

// 4. Eclipse fraction: f = (1/pi) asin(R / (R + h))
function eclipseFraction(altitudeKm) {
  return Math.asin(R_EARTH_KM / (R_EARTH_KM + altitudeKm)) / Math.PI;
}

// 5. Battery size: E = P_load t_eclipse / DoD   (Wh, with t in hours)
function batteryNeededWh(loadW, altitudeKm) {
  var eclipseH = eclipseFraction(altitudeKm) * orbitalPeriodS(altitudeKm) / 3600;
  return loadW * eclipseH / DOD;
}

// 6. Image resolution: x = 1.22 lambda h / D. Radar builds a synthetic aperture,
//    so the formula does not apply to it and we return null.
function resolutionM(part, altitudeKm) {
  if (!part.aperture_m || !part.wavelength_m) return null;
  if (part.tags.indexOf("radar") !== -1) return null;
  return 1.22 * part.wavelength_m * altitudeKm * 1000 / part.aperture_m;
}

// 7. Data budget: returned = min(produced, downlink x c)
function dataReturnedGbDay(producedGb, downlinkGb, contactShare) {
  return Math.min(producedGb, downlinkGb * contactShare);
}

// 8. Margin = (capacity - used) / capacity
function margin(capacity, used) {
  if (!capacity) return null;
  return (capacity - used) / capacity;
}

// ------------------------------------------------------------------ budget and locks
// A campaign design spends from the treasury; anything else uses the tier's budget.
function budgetFor(design) {
  if (design.campaign && typeof getCampaign === "function") {
    var c = getCampaign();
    if (c) return c.treasury_musd;
  }
  var tier = getTier(design.tier);
  return tier ? tier.budget_musd : null;
}

// Research (data/research.js) locks a part, launcher or objective only while a
// campaign is running and the research that unlocks it has not been bought.
function researchUnlocking(kind, id) {
  if (typeof RESEARCH === "undefined") return null;
  for (var i = 0; i < RESEARCH.length; i++) {
    var u = RESEARCH[i].unlocks || {};
    if (u[kind] && u[kind].indexOf(id) !== -1) return RESEARCH[i];
  }
  return null;
}
// The year an item arrived: the year of the research that unlocks it, or 1957.
var BASE_YEAR = 1957;
function itemYear(kind, id) {
  if (kind === "objectives") {
    var o = getObjective(id);
    if (o && o.requires_research) { var rr = researchById(o.requires_research); if (rr) return rr.year; }
  }
  if (kind === "parts") { var up = upgradeOf(id); if (up) return up.year; }
  var r = researchUnlocking(kind, id);
  return r ? r.year : BASE_YEAR;
}
// Upgrades (SPEC.md, "The lab"): a part with an `upgrade` field is the real successor of
// another part. In a campaign it is bought in the lab and then replaces its predecessor.
// Fuel to bring a polar-orbit satellite down at the end is a debris rule from 1995
// (NASA-STD 1740.14, later NASA-STD-8719.14). Before then, satellites such as Alouette 1
// (1962) and Nimbus 1 (1964) reached polar orbits on their rocket alone.
var DISPOSAL_RULE_YEAR = 1995;
var DISPOSAL_ONLY_ORBITS = ["sso"];   // orbits whose dv_needed_ms is only the disposal fuel
function designYear(design) {
  if (!design) return null;
  if (design.campaign) { var c = typeof getCampaign === "function" ? getCampaign() : null; return c ? c.year : null; }
  return design.year || null;
}
function dvNeeded(orbit, design) {
  if (!orbit) return 0;
  var y = designYear(design);
  if (y !== null && y < DISPOSAL_RULE_YEAR && DISPOSAL_ONLY_ORBITS.indexOf(orbit.id) !== -1) return 0;
  return orbit.dv_needed_ms;
}
function upgradeOf(partId) {
  var p = typeof PARTS === "undefined" ? null : findById(PARTS, partId);
  return p && p.upgrade ? p.upgrade : null;
}
// The owned upgrade that replaced this part in the campaign, or null.
function replacedBy(partId, c) {
  if (!c || !c.upgrades) return null;
  for (var i = 0; i < c.upgrades.length; i++) {
    var u = upgradeOf(c.upgrades[i]);
    if (u && u.of === partId) return findById(PARTS, c.upgrades[i]);
  }
  return null;
}
function researchById(id) {
  return typeof RESEARCH === "undefined" ? null : RESEARCH.filter(function (r) { return r.id === id; })[0] || null;
}

// Available to this design? Campaign designs follow research; a design set in an
// era offers only what existed by its year; anything else offers everything.
// Without a design, research applies whenever a campaign is saved (as before).
function isUnlocked(kind, id, design) {
  if (design && !design.campaign) {
    return !design.year || itemYear(kind, id) <= design.year;
  }
  var c = typeof getCampaign === "function" ? getCampaign() : null;
  if (kind === "parts" && c) {
    if (replacedBy(id, c)) return false;
    if (upgradeOf(id)) return (c.upgrades || []).indexOf(id) !== -1;
  }
  var r = researchUnlocking(kind, id);
  if (kind === "objectives") {
    var o = getObjective(id);
    if (o && o.requires_research) r = researchById(o.requires_research) || r;
  }
  if (!r) return true;
  return !c || c.research.indexOf(r.id) !== -1;
}
function researchNameFor(kind, id) {
  var r = researchUnlocking(kind, id);
  if (!r && kind === "objectives" && typeof RESEARCH !== "undefined") {
    var o = getObjective(id);
    if (o && o.requires_research) r = RESEARCH.filter(function (x) { return x.id === o.requires_research; })[0];
  }
  return r ? r.name : "";
}
function isPartAvailable(id, design)      { return isUnlocked("parts", id, design); }
function isLauncherAvailable(id, design)  { return isUnlocked("launchers", id, design); }
function isObjectiveAvailable(id, design) { return isUnlocked("objectives", id, design); }

// Availability of every part, rocket and topic for this design, with the year each
// arrived and a reason to show when it is not available. One call per screen refresh.
function getAvailability(design) {
  function entry(kind, id) {
    var ok = isUnlocked(kind, id, design), y = itemYear(kind, id), reason = null;
    if (!ok) {
      var c = design && design.campaign && typeof getCampaign === "function" ? getCampaign() : null;
      var by = kind === "parts" && c ? replacedBy(id, c) : null, up = kind === "parts" ? upgradeOf(id) : null;
      if (by) reason = "Replaced by " + by.name;
      else if (c && up) reason = "Upgrade in the lab, from " + ((findById(PARTS, up.of) || {}).name || up.of);
      else reason = c ? "Needs research: " + researchNameFor(kind, id) : "Arrives in " + y;
    }
    return { available: ok, year: y, reason: reason };
  }
  var out = { parts: {}, launchers: {}, objectives: {} };
  PARTS.forEach(function (p) { out.parts[p.id] = entry("parts", p.id); });
  LAUNCHERS.forEach(function (l) { out.launchers[l.id] = entry("launchers", l.id); });
  OBJECTIVES.forEach(function (o) { out.objectives[o.id] = entry("objectives", o.id); });
  return out;
}

// ------------------------------------------------------------------ eras
function getEra(id) { return typeof ERAS === "undefined" ? null : findById(ERAS, id); }

// Set a standalone design in an era: only what existed by its year is offered.
function setEra(design, eraId) {
  var e = getEra(eraId);
  design.era = e ? e.id : null;
  design.year = e ? e.year : null;
  return design;
}

function getEras() {
  if (typeof ERAS === "undefined") return [];
  var p = typeof getProgress === "function" ? getProgress() : { best_stars_by_era: {} };
  var byEra = p.best_stars_by_era || {};
  return ERAS.map(function (e, i) {
    return {
      id: e.id, name: e.name, year: e.year, blurb: e.blurb, real_missions: e.real_missions || [],
      unlocked: i === 0 || (byEra[ERAS[i - 1].id] || 0) >= 2,
      best_stars: byEra[e.id] || 0,
      topics: OBJECTIVES.filter(function (o) { return itemYear("objectives", o.id) <= e.year; }).map(function (o) { return o.id; })
    };
  });
}

// ------------------------------------------------------------------ bodies
// The satellite's body (a structure part with payload_kg and slots), or null.
function bodySummary(parts) {
  var body = parts.filter(function (p) { return p.category === "structure"; })[0];
  if (!body) return null;
  var used = {}, slots = {};
  parts.forEach(function (p) { if (p.category !== "structure") used[p.category] = (used[p.category] || 0) + 1; });
  CATEGORY_LIST.forEach(function (c) {
    if (c.id === "structure") return;
    slots[c.id] = { used: used[c.id] || 0, max: (body.slots && body.slots[c.id]) || 0 };
  });
  return { id: body.id, name: body.name, payload_kg: body.payload_kg || 0,
           payload_used_kg: round(sum(parts, function (p) { return p.category === "structure" ? 0 : p.mass_kg; }), 2), slots: slots };
}

// ------------------------------------------------------------------ development time
// Time as a resource (SPEC.md): the longest part to build, plus one month of
// integration and testing for every three parts. Parts are built in parallel.
function devMonths(design) {
  var parts = designParts(design);
  if (!parts.length) return 0;
  var longest = Math.max.apply(null, parts.map(function (p) { return p.build_months || 0; }));
  return longest + Math.ceil(parts.length / 3);
}

// Years a campaign mission takes on the calendar: at least one, more for long builds.
function missionYears(design) {
  var per = typeof CAMPAIGN !== "undefined" ? CAMPAIGN.years_per_mission : 1;
  return Math.max(per, Math.ceil(devMonths(design) / 12));
}

// How the satellite points: "three-axis", "spin", or null when no attitude part is fitted.
function pointingOf(parts) {
  var att = parts.filter(function (p) { return p.category === "attitude"; });
  if (!att.length) return NEW_CATEGORIES_REQUIRED ? "spin" : null;
  return att.some(function (p) { return p.tags.indexOf("three-axis") !== -1; }) ? "three-axis" : "spin";
}

// ------------------------------------------------------------------ totals
function getTotals(design) {
  var parts = designParts(design);
  var orbit = getOrbit(design.orbit);
  var launcher = getLauncher(design.launcher);
  var budget = budgetFor(design);
  var dev = devMonths(design);

  var mass = sum(parts, function (p) { return p.mass_kg; });
  var draw = sum(parts, function (p) { return p.power_draw_w; });
  var gen = sum(parts, function (p) { return p.category === "power" ? solarPowerW(p) : 0; });
  var partsCost = sum(parts, function (p) { return p.cost_musd; });
  var cost = partsCost + (launcher ? launcher.cost_musd : 0);
  var produced = sum(parts, function (p) { return p.data_gb_day; });
  var downlink = sum(parts, function (p) { return p.downlink_gb_day; });
  var batteryWh = sum(parts, function (p) { return p.battery_wh; });

  // Rocket equation with every propulsion part burning together:
  // effective Isp = total impulse / (total fuel x g0).
  var props = parts.filter(function (p) { return p.category === "propulsion"; });
  var fuel = sum(props, function (p) { return p.fuel_kg; });
  var impulse = sum(props, function (p) { return p.fuel_kg * p.isp_s * G0; });
  var ispEff = fuel > 0 ? impulse / (fuel * G0) : 0;
  var deltaV = rocketDeltaV(ispEff, mass, fuel);

  var capacity = (launcher && orbit) ? launcher.capacity_kg[orbit.id] : 0;
  var returned = orbit ? dataReturnedGbDay(produced, downlink, orbit.downlink_mult) : 0;

  return {
    mass_kg: round(mass, 2),
    power_draw_w: round(draw, 1),
    power_gen_w: round(gen, 1),
    cost_musd: round(cost, 3),
    data_gb_day: round(produced, 6),        // 6 places: 1950s radios sent only bits a second
    downlink_gb_day: round(downlink, 6),
    delta_v_ms: round(deltaV, 0),
    margins: {
      mass: capacity ? round(margin(capacity, mass), 3) : null,
      power: gen ? round(margin(gen, draw), 3) : null,
      budget: budget ? round(margin(budget, cost), 3) : null
    },
    // Extra values so the screens never do maths:
    data_returned_gb_day: round(returned, 6),
    battery_wh: batteryWh,
    capacity_kg: capacity,
    budget_musd: budget,
    dev_months: dev,
    body: bodySummary(parts)
  };
}

// ------------------------------------------------------------------ orbit facts
function getOrbitFacts(design) {
  var orbit = getOrbit(design.orbit);
  if (!orbit) return { period_min: null, laps_per_day: null, eclipse_fraction: null };
  var h = orbit.altitude_km;
  var periodS = orbitalPeriodS(h);
  var f = eclipseFraction(h);
  var res = {};
  designParts(design).forEach(function (p) {
    if (p.category === "instrument") {
      var x = resolutionM(p, h);
      res[p.id] = x === null ? null : round(x, x < 10 ? 1 : 0);
    }
  });
  return {
    period_min: round(periodS / 60, 1),
    laps_per_day: round(86400 / periodS, 1),
    eclipse_fraction: round(f, 3),
    // Extra values for the orbit and instrument cards:
    eclipse_min: round(f * periodS / 60, 1),
    speed_kms: round(orbitalSpeedMs(h) / 1000, 2),
    resolution_m: res,  // per instrument id; null = radar (formula does not apply)
    target_in_view: targetInView(design),  // share of the objective's real targets in view, or null
    battery_needed_wh: round(batteryNeededWh(getTotals(design).power_draw_w, h), 0)
  };
}

// Share of the objective's real-world targets this orbit can see (NASA data), or null.
function targetInView(design) {
  var e = earthFor(design.objective);
  if (!e || !e.orbit_view || !design.orbit || e.orbit_view[design.orbit] === undefined) return null;
  return e.orbit_view[design.orbit];
}

// ------------------------------------------------------------------ science rate
// Science per month for a design, before events. mission.js uses this too.
// `brokenIds` lists parts that have failed during a mission.
// Real NASA data (data/earth.js) for this objective, or null.
function earthFor(objectiveId) {
  return (typeof EARTH !== "undefined" && EARTH[objectiveId]) ? EARTH[objectiveId] : null;
}
function mean(list) { return list.reduce(function (a, b) { return a + b; }, 0) / list.length; }

// How the real world changes an instrument's science this month.
//   view:   share of the real targets this orbit can see (wildfire: NASA FIRMS)
//   season: this month's share of the year's targets, scaled so the year averages 1
//   light:  cameras see nothing in polar night (sea ice: Sun at 75 degrees north)
// calMonth 0..11, or null for the yearly average (the Build screen preview).
// Real sunspot number for a calendar year and month (SILSO), or null.
function sunspots(year, calMonth) {
  var e = earthFor("solar");
  if (!e || !e.sunspots || year === null || year === undefined) return null;
  var row = e.sunspots.monthly[year - e.sunspots.start_year];
  if (!row) return null;
  return (calMonth === null || calMonth === undefined) ? mean(row) : row[calMonth];
}

// How strongly the Sun's activity drives the solar topic: 0.5 at a quiet Sun,
// about 1.8 at the 1957-58 maximum. A GAME VALUE shape on real sunspot numbers.
function solarActivityFactor(sn) { return 0.5 + sn / 200; }

function earthFactor(objectiveId, orbitId, part, calMonth, year) {
  var e = earthFor(objectiveId);
  if (!e) return 1;
  if (e.sunspots) {
    var y = (year === null || year === undefined) ? e.sunspots.start_year : year;
    var sn = sunspots(y, calMonth);
    return sn === null ? 1 : solarActivityFactor(sn);
  }
  var view = (e.orbit_view && e.orbit_view[orbitId] !== undefined) ? e.orbit_view[orbitId] : 1;
  var season = 1;
  if (e.monthly_share && calMonth !== null && calMonth !== undefined) season = e.monthly_share[calMonth] * 12;
  var light = 1;
  if (e.daylight_share && part.tags.indexOf("imaging") !== -1) {
    light = (calMonth === null || calMonth === undefined) ? mean(e.daylight_share) : e.daylight_share[calMonth];
  }
  return view * season * light;
}

function scienceRate(design, brokenIds, calMonth, year) {
  brokenIds = brokenIds || [];
  if (calMonth === undefined) calMonth = null;
  var orbit = getOrbit(design.orbit);
  var objective = getObjective(design.objective);
  var result = { per_month: 0, ideal_per_month: 0, data_share: 1, power_share: 1, instruments: [] };
  if (!orbit || !objective) return result;

  var parts = designParts(design).filter(function (p) { return brokenIds.indexOf(p.id) === -1; });
  var h = orbit.altitude_km;
  var fit = objective.orbit_fit ? (objective.orbit_fit[orbit.id] || 0) : 1;

  // Data: science counts in proportion to data returned (formula 7).
  var produced = sum(parts, function (p) { return p.data_gb_day; });
  var downlink = sum(parts, function (p) { return p.downlink_gb_day; });
  var returned = dataReturnedGbDay(produced, downlink, orbit.downlink_mult);
  var dataShare = produced > 0 ? returned / produced : 0;

  // Power, from the parts still working:
  //  - in sunlight, if the panels make less than the parts draw, instruments run
  //    only that share of the time (a broken panel matters in flight);
  //  - in shadow (formula 5), the battery covers its share of what is needed;
  //    the rest of the shadow time the instruments are off.
  var draw = sum(parts, function (p) { return p.power_draw_w; });
  var gen = sum(parts, function (p) { return p.category === "power" ? solarPowerW(p) : 0; });
  var battery = sum(parts, function (p) { return p.battery_wh; });
  var f = eclipseFraction(h);
  var need = batteryNeededWh(draw, h);
  // A battery-only spacecraft (Sputnik, Explorer 1) runs fully until its battery is spent;
  // that end is handled by the mission's lifetime, not here.
  var batteryOnly = gen === 0 && battery > 0;
  var sunShare = batteryOnly ? 1 : (draw > 0 ? Math.min(1, gen / draw) : 1);
  var shadowCovered = batteryOnly ? 1 : (need > 0 ? Math.min(1, battery / need) : 1);
  var powerShare = sunShare * (1 - f * (1 - shadowCovered));

  var ideal = 0, pointing = pointingOf(parts);
  parts.forEach(function (p) {
    if (p.category !== "instrument") return;
    var match = 0;   // first wanted tag counts fully, later ones half
    objective.wants.forEach(function (tag, i) {
      if (p.tags.indexOf(tag) !== -1) match = Math.max(match, i === 0 ? 1 : 0.5);
    });
    var x = resolutionM(p, h);
    var sharpEnough = !objective.needs_resolution_m || x === null || x <= objective.needs_resolution_m;
    var smeared = pointing === "spin" && p.tags.some(function (t) { return POINTING_TAGS.indexOf(t) !== -1; });
    var pts = p.science * orbit.science_mult * fit * match * (sharpEnough ? 1 : 0) * (smeared ? SPIN_SMEAR : 1) *
              earthFactor(objective.id, orbit.id, p, calMonth, year);
    result.instruments.push({ id: p.id, match: match, sharp_enough: sharpEnough, smeared: smeared, points: round(pts, 2) });
    ideal += pts;
  });

  result.ideal_per_month = ideal;
  result.data_share = dataShare;
  result.power_share = powerShare;
  result.per_month = ideal * dataShare * powerShare;
  return result;
}

// ------------------------------------------------------------------ checks
function runChecks(design) {
  var blockers = [];
  var warnings = [];
  var t = getTotals(design);
  var parts = designParts(design);
  var orbit = getOrbit(design.orbit);
  var launcher = getLauncher(design.launcher);
  var objective = getObjective(design.objective);
  var tier = getTier(design.tier);
  function block(id, text) { blockers.push({ id: id, text: text }); }
  function warn(id, text) { warnings.push({ id: id, text: text }); }

  if (!objective) block("no-objective", "Pick a science objective on the Briefing screen.");

  // Locks: research in a campaign; the era's year in a standalone mission set in an era.
  if (design.campaign || design.year) {
    var why = function (kind, id) {
      return design.campaign ? " needs research first: " + researchNameFor(kind, id) + "."
                             : " does not exist yet in " + design.year + " (it arrives in " + itemYear(kind, id) + ").";
    };
    if (objective && !isObjectiveAvailable(objective.id, design)) block("objective-locked", objective.name + why("objectives", objective.id));
    parts.forEach(function (p) { if (!isPartAvailable(p.id, design)) block("part-locked", p.name + why("parts", p.id)); });
    if (launcher && !isLauncherAvailable(launcher.id, design)) block("launcher-locked", launcher.name + why("launchers", launcher.id));
  }

  // The body: one per satellite, and everything must fit in it.
  var bodies = parts.filter(function (p) { return p.category === "structure"; });
  if (bodies.length > 1) block("body-count", "A satellite has one body; remove all but one.");
  var bs = bodySummary(parts);
  if (bs) {
    if (bs.payload_used_kg > bs.payload_kg) {
      block("body-payload", "The parts weigh " + bs.payload_used_kg + " kg but the " + bs.name + " carries at most " + bs.payload_kg + " kg.");
    }
    Object.keys(bs.slots).forEach(function (cat) {
      var sl = bs.slots[cat];
      if (sl.used > sl.max) block("body-slots", "The " + bs.name + " has room for " + sl.max + " " + cat + " part" + (sl.max === 1 ? "" : "s") + " (you fitted " + sl.used + ").");
    });
  }
  if (!orbit) block("no-orbit", "Pick an orbit.");
  if (!launcher) block("no-launcher", "Pick a launch vehicle.");

  requiredCategories().forEach(function (cat) {
    var has = parts.some(function (p) { return p.category === cat; });
    if (!has) block("empty-" + cat, "No " + cat + " part. The spacecraft needs at least one.");
  });

  if (launcher && orbit) {
    if (!t.capacity_kg) {
      block("launcher-reach", launcher.name + " cannot reach " + orbit.name + ".");
    } else if (t.mass_kg > t.capacity_kg) {
      block("mass", "Spacecraft is " + t.mass_kg + " kg but the " + launcher.name +
        " can carry only " + t.capacity_kg + " kg to " + orbit.name + ".");
    } else if (t.margins.mass < LOW_MARGIN) {
      warn("mass-margin", "Mass margin is only " + Math.round(t.margins.mass * 100) +
        "%. Events will hit harder.");
    }
  }

  if (t.budget_musd !== null && t.cost_musd > t.budget_musd) {
    block("budget", "Cost is $" + round(t.cost_musd, 2) + "M but " +
      (design.campaign ? "the treasury holds $" : "the budget is $") + round(t.budget_musd, 2) + "M.");
  }

  // A spinning satellite smears cameras, thermal imagers and radar.
  if (pointingOf(parts) === "spin") {
    parts.filter(function (p) { return p.category === "instrument" && p.tags.some(function (t) { return POINTING_TAGS.indexOf(t) !== -1; }); })
      .forEach(function (p) {
        warn("smear-" + p.id, p.name + " on a spinning satellite smears its pictures: it returns " + Math.round(SPIN_SMEAR * 100) +
          "% of its science. Three-axis control would hold it steady.");
      });
  }

  // Time: in a campaign, the satellite must be built before the programme ends.
  if (design.campaign && typeof getCampaign === "function" && typeof CAMPAIGN !== "undefined") {
    var camp = getCampaign();
    if (camp && camp.year + missionYears(design) > CAMPAIGN.end_year) {
      block("too-late", "Building this takes " + t.dev_months + " months: it could not launch before the programme ends in " + CAMPAIGN.end_year + ".");
    }
  }

  var batteryMonths = batteryLifeMonths(design);
  if (batteryMonths !== null) {
    warn("battery-only", "No solar panel: the battery runs everything for about " + Math.max(1, Math.round(batteryMonths * 30)) +
      " days, then the satellite falls silent.");
  } else if (t.power_draw_w > t.power_gen_w) {
    block("power", "Parts draw " + t.power_draw_w + " W but the solar panels make only " + t.power_gen_w + " W.");
  } else if (t.power_gen_w > 0 && t.margins.power < LOW_MARGIN) {
    warn("power-margin", "Power margin is only " + Math.round(t.margins.power * 100) +
      "%. Events will hit harder.");
  }

  if (orbit && t.delta_v_ms < dvNeeded(orbit, design)) {
    block("delta-v", orbit.name + " needs " + dvNeeded(orbit, design) + " m/s of thrust from the spacecraft, but it has only " +
      t.delta_v_ms + " m/s. Add propulsion or cut mass.");
  }

  if (orbit && t.data_gb_day > t.data_returned_gb_day) {
    warn("data", "Instruments make " + t.data_gb_day + " GB a day but only " + t.data_returned_gb_day +
      " GB reaches the ground. The rest is lost.");
  }

  if (orbit && t.power_draw_w > 0) {
    var need = batteryNeededWh(t.power_draw_w, orbit.altitude_km);
    if (t.battery_wh < need) {
      warn("battery", "Riding through Earth's shadow needs a " + round(need, need < 10 ? 1 : 0) + " Wh battery; you have " +
        t.battery_wh + " Wh. Instruments will switch off in shadow.");
    }
  }

  if (objective) {
    var instruments = parts.filter(function (p) { return p.category === "instrument"; });
    var matches = instruments.some(function (p) {
      return p.tags.some(function (tag) { return objective.wants.indexOf(tag) !== -1; });
    });
    if (instruments.length && !matches) {
      warn("no-match", "No instrument suits " + objective.name + ".");
    }
    if (orbit && objective.orbit_fit && objective.orbit_fit[orbit.id] === 0) {
      warn("orbit-fit", orbit.name + " cannot see what " + objective.name + " needs.");
    }
    if (orbit && objective.needs_resolution_m) {
      instruments.forEach(function (p) {
        var x = resolutionM(p, orbit.altitude_km);
        if (x !== null && x > objective.needs_resolution_m) {
          warn("resolution-" + p.id, p.name + " sees " + Math.round(x) + " m detail from " + orbit.name +
            "; this objective needs " + objective.needs_resolution_m + " m. It will earn no science.");
        }
      });
    }
  }

  return { blockers: blockers, warnings: warnings };
}

// A spacecraft with batteries and no solar panel runs until the battery is spent.
// Returns that time in months, or null when solar panels (or no battery) apply.
function batteryLifeMonths(design) {
  var parts = designParts(design);
  var gen = sum(parts, function (p) { return p.category === "power" ? solarPowerW(p) : 0; });
  var battery = sum(parts, function (p) { return p.battery_wh; });
  var draw = sum(parts, function (p) { return p.power_draw_w; });
  if (gen > 0 || battery <= 0 || draw <= 0) return null;
  return battery / draw / 730;   // 730 hours in a month
}

// ------------------------------------------------------------------ science preview
// What the Build screen shows before launch: expected science over the whole
// mission if nothing goes wrong. Function name to be confirmed with Design screens.
function previewScience(design) {
  var orbit = getOrbit(design.orbit);
  var objective = getObjective(design.objective);
  var rate = scienceRate(design, []);
  var months = orbit ? orbit.lifetime_months : 0;
  var bl = batteryLifeMonths(design);
  if (bl !== null) months = Math.min(months, bl);
  var target = objective ? objective.science_target : 0;
  var total = rate.per_month * months;
  return {
    per_month: round(rate.per_month, 2),
    months: round(months, 1),
    total: round(total, 1),
    target: target,
    share: target ? round(Math.min(1, total / target), 3) : 0,
    data_share: round(rate.data_share, 3),     // share of data that reaches the ground
    power_share: round(rate.power_share, 3),   // share of time instruments stay on
    instruments: rate.instruments.map(function (i) {
      return { id: i.id, name: getPart(i.id).name, per_month: round(i.points * rate.data_share * rate.power_share, 2),
               counts: i.match > 0, sharp_enough: i.sharp_enough };
    })
  };
}

// ------------------------------------------------------------------ part card facts
// Numbers a part card shows that are computed, not read from the data:
// solar output, resolution from the chosen orbit, and the science this
// instrument would earn in this design. Works for parts not yet added.
function getPartFacts(design, partId) {
  var p = getPart(partId);
  if (!p) return null;
  var orbit = getOrbit(design.orbit);
  var objective = getObjective(design.objective);
  var facts = {
    power_gen_w: p.category === "power" ? round(solarPowerW(p), 1) : 0,
    resolution_m: null,      // instruments only, once an orbit is chosen; null for radar
    sharp_enough: null,      // true/false when the objective sets needs_resolution_m
    counts: null,            // true when this instrument's type counts for the objective
    science_per_month: null  // instruments only, before data and power losses
  };
  if (p.category !== "instrument") return facts;
  if (orbit) {
    var x = resolutionM(p, orbit.altitude_km);
    facts.resolution_m = x === null ? null : round(x, x < 10 ? 1 : 0);
    if (objective && objective.needs_resolution_m && x !== null) facts.sharp_enough = x <= objective.needs_resolution_m;
  }
  if (objective) {
    facts.counts = p.tags.some(function (t) { return objective.wants.indexOf(t) !== -1; });
    if (orbit) {
      var probe = { tier: design.tier, objective: design.objective, orbit: design.orbit, launcher: design.launcher, parts: [partId] };
      var row = scienceRate(probe, []).instruments[0];
      facts.science_per_month = row ? row.points : 0;
    }
  }
  return facts;
}

// ------------------------------------------------------------------ hover preview
// What toggling one part would change, for the hover preview on a Build card.
// If the part is in the design this previews removing it, otherwise adding it.
// The design itself is not changed.
function previewToggle(design, partId) {
  if (!getPart(partId)) return null;
  var adding = design.parts.indexOf(partId) === -1;
  var after = { tier: design.tier, objective: design.objective, orbit: design.orbit,
                launcher: design.launcher, parts: design.parts.slice(), campaign: design.campaign };
  if (adding) addPart(after, partId); else removePart(after, partId);

  function snapshot(d) {
    var t = getTotals(d);
    return { mass_kg: t.mass_kg, power_draw_w: t.power_draw_w, power_gen_w: t.power_gen_w,
             cost_musd: t.cost_musd, data_gb_day: t.data_gb_day,
             data_returned_gb_day: t.data_returned_gb_day, delta_v_ms: t.delta_v_ms,
             battery_wh: t.battery_wh, science_total: previewScience(d).total };
  }
  var b = snapshot(design), a = snapshot(after), delta = {};
  Object.keys(b).forEach(function (k) { delta[k] = round(a[k] - b[k], 2); });

  function ids(list) { return list.map(function (c) { return c.id; }); }
  var cb = runChecks(design), ca = runChecks(after);
  var before = ids(cb.blockers).concat(ids(cb.warnings)), afterIds = ids(ca.blockers).concat(ids(ca.warnings));
  return {
    adding: adding,
    before: b,
    after: a,
    delta: delta,                                   // after minus before, per number
    fixes: cb.blockers.concat(cb.warnings).filter(function (c) { return afterIds.indexOf(c.id) === -1; }),
    causes: ca.blockers.concat(ca.warnings).filter(function (c) { return before.indexOf(c.id) === -1; })
  };
}

// ------------------------------------------------------------------ hints
// Tips for a screen (data/hints.js), led by advice for the design's current
// problems. The tier's hints field sets the mode: "off" returns no tips.
var HINT_SCREENS = ["hub", "briefing", "orbit", "build", "launch", "readiness", "mission", "debrief"];

function getHints(screen, design) {
  var tierId = design ? design.tier : (typeof getCampaign === "function" && getCampaign() ? getCampaign().tier : null);
  var tier = getTier(tierId) || TIERS[0];
  var mode = tier && tier.hints ? tier.hints : "on";
  var h = typeof HINTS !== "undefined" ? HINTS : { screens: {}, tutorial: {}, checks: {} };
  var out = { mode: mode, tutorial: mode === "on" ? (h.tutorial[screen] || "") : "", tips: [] };
  if (mode === "off" || HINT_SCREENS.indexOf(screen) === -1) return out;
  if (design && ["build", "launch", "readiness"].indexOf(screen) !== -1) {
    var c = runChecks(design), seen = {};
    c.blockers.concat(c.warnings).forEach(function (x) {
      var key = x.id.indexOf("resolution-") === 0 ? "resolution" : x.id.indexOf("empty-") === 0 ? "empty" :
                x.id.indexOf("smear-") === 0 ? "smear" : x.id;
      if (seen[key] || !h.checks[key]) return;
      if (screen === "build" && ["no-launcher", "launcher-reach", "launcher-locked"].indexOf(key) !== -1) return;
      seen[key] = true;
      out.tips.push(h.checks[key]);
    });
  }
  out.tips = out.tips.concat(h.screens[screen] || []);
  return out;
}
