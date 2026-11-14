// Is the debrief advice actionable? And the battery cliff.
var L = require("./lib"); var G = L.G; var fs = require("fs");
var IDS = L.PART_IDS;
function has(mask, id) { return !!(mask & (1 << IDS.indexOf(id))); }
function parts(mask) { return IDS.filter(function (_, i) { return mask & (1 << i); }); }
["training", "standard", "expert"].forEach(function (tier) {
  var rows = JSON.parse(fs.readFileSync(require("path").join(__dirname, "sweep-" + tier + ".json"), "utf8"));
  var powerWithBattery = rows.filter(function (r) { return r.safe.lim === "power" && has(r.mask, "battery-28v"); });
  var power = rows.filter(function (r) { return r.safe.lim === "power"; });
  var dataWithX = rows.filter(function (r) { return r.safe.lim === "data" && has(r.mask, "radio-xband"); });
  var data = rows.filter(function (r) { return r.safe.lim === "data"; });
  var budgetOnRideshare = rows.filter(function (r) { return r.safe.lim === "budget" && r.ln === "rideshare"; });
  var budget = rows.filter(function (r) { return r.safe.lim === "budget"; });
  var geoSea = rows.filter(function (r) { return r.o === "sea-ice" && r.orb === "geo"; });
  var noneLim = rows.filter(function (r) { return r.safe.lim === "none"; });
  console.log(tier + ": lim=power " + power.length + " of which battery already fitted " + powerWithBattery.length +
    " | lim=data " + data.length + " of which X-band already fitted " + dataWithX.length +
    " | lim=budget " + budget.length + " of which already on rideshare " + budgetOnRideshare.length +
    " | sea-ice GEO designs " + geoSea.length + " lim: " + JSON.stringify(geoSea.reduce(function (h, r) { h[r.safe.lim] = (h[r.safe.lim] || 0) + 1; return h; }, {})) +
    " | lim=none by objective " + JSON.stringify(noneLim.reduce(function (h, r) { h[r.o] = (h[r.o] || 0) + 1; return h; }, {})));
  if (powerWithBattery[0]) {
    var d = L.design(tier, powerWithBattery[0].o, powerWithBattery[0].orb, powerWithBattery[0].ln, parts(powerWithBattery[0].mask));
    console.log("   e.g. power w/ battery: " + parts(powerWithBattery[0].mask).join(",") + " -> \"" + L.play(d, L.SAFE).suggestion + "\"");
  }
});

console.log("\nBattery cliff: largest draw the single 560 Wh battery carries through eclipse");
G.ORBITS.forEach(function (o) {
  var need1W = G.batteryNeededWh(1, o.altitude_km);
  console.log("  " + o.id + ": eclipse " + (G.eclipseFraction(o.altitude_km) * G.orbitalPeriodS(o.altitude_km) / 60).toFixed(1) + " min/lap -> max draw " + Math.floor(560 / need1W) + " W; above that science x" + (1 - G.eclipseFraction(o.altitude_km)).toFixed(3));
});
var core = ["sar-radar", "solar-large", "radio-xband", "obc-basic", "battery-28v", "prop-ion"];
var a = L.design("training", "sea-ice", "sso", "small", core), b = L.design("training", "sea-ice", "sso", "small", core.concat(["obc-radtol"]));
console.log("  sea-ice SSO core (" + G.getTotals(a).power_draw_w + " W): preview " + G.previewScience(a).total + "; + radiation-tolerant computer (+1.3 W): preview " + G.previewScience(b).total);
var c = L.design("training", "sea-ice", "sso", "small", ["sar-radar", "solar-large", "radio-xband", "obc-basic", "prop-ion"]);
console.log("  same core with NO battery at all: preview " + G.previewScience(c).total + " (target 200) -> battery is optional for 3 stars");

console.log("\nDominance checks");
var pairs = [["obc-basic", "obc-payload"], ["prop-ion", "prop-green-large"], ["prop-ion", "prop-green-small"], ["solar-large", "solar-small"]];
pairs.forEach(function (p) {
  var A = G.getPart(p[0]), B = G.getPart(p[1]);
  console.log("  " + p[0] + " vs " + p[1] + ": mass " + A.mass_kg + "/" + B.mass_kg + ", cost " + A.cost_musd + "/" + B.cost_musd + ", draw " + A.power_draw_w + "/" + B.power_draw_w +
    (A.isp_s ? ", total impulse kN-s " + (A.isp_s * 9.81 * A.fuel_kg / 1000).toFixed(1) + "/" + (B.isp_s * 9.81 * B.fuel_kg / 1000).toFixed(1) : "") +
    (A.storage_gb !== undefined ? ", storage " + A.storage_gb + "/" + B.storage_gb : "") +
    (A.panel_area_m2 ? ", W " + Math.round(G.solarPowerW(A)) + "/" + Math.round(G.solarPowerW(B)) + ", W/kg " + (G.solarPowerW(A) / A.mass_kg).toFixed(1) + "/" + (G.solarPowerW(B) / B.mass_kg).toFixed(1) + ", W/$M " + Math.round(G.solarPowerW(A) / A.cost_musd) + "/" + Math.round(G.solarPowerW(B) / B.cost_musd) : ""));
});

console.log("\nWildfire science ceiling by orbit (any part set)");
G.ORBITS.forEach(function (o) {
  var best = 0, bestParts = null;
  for (var m = 1; m < 32768; m++) {
    var ps = parts(m), d = L.design("training", "wildfire", o.id, "heavy", ps);
    var t = G.previewScience(d).total;
    if (t > best) { best = t; bestParts = ps; }
  }
  console.log("  " + o.id + ": " + best + " / 180 with " + (bestParts ? bestParts.join(",") : "nothing"));
});
console.log("\nSea-ice science ceiling by orbit (any part set)");
G.ORBITS.forEach(function (o) {
  var best = 0, bestParts = null;
  for (var m = 1; m < 32768; m++) {
    var ps = parts(m), d = L.design("training", "sea-ice", o.id, "heavy", ps);
    var t = G.previewScience(d).total;
    if (t > best) { best = t; bestParts = ps; }
  }
  console.log("  " + o.id + ": " + best + " / 200 with " + (bestParts ? bestParts.join(",") : "nothing"));
});

console.log("\nScore ceiling by tier (science 60 + margins 15 + events 10 + budget share x 15)");
G.TIERS.forEach(function (t) {
  [["wildfire", 5.36], ["sea-ice", 15.26]].forEach(function (x) {
    console.log("  " + t.id + " " + x[0] + ": cheapest 3*-class build $" + x[1] + "M -> budget pts " + (15 * (t.budget_musd - x[1]) / t.budget_musd).toFixed(1));
  });
});

console.log("\nEvent odds per orbit (weight share of the pool)");
G.ORBITS.forEach(function (o) {
  var w = G.EVENTS.map(function (e) { return (e.orbit_weight && e.orbit_weight[o.id] !== undefined) ? e.orbit_weight[o.id] : 1; });
  var tot = w.reduce(function (a, b) { return a + b; }, 0);
  console.log("  " + o.id + ": " + G.EVENTS.map(function (e, i) { return e.id + " " + Math.round(100 * w[i] / tot) + "%"; }).join(", "));
});
