// tests/formulas.js — hand-worked answers for the eight formulas in SPEC.md.
// Run from the repo root:  node tests/formulas.js
// Each expected value was worked out by hand (shown in the comment), so a
// change that breaks the maths fails here.
var G = require("./load")();
var failed = 0, passed = 0;
function near(name, got, want, tol) {
  var ok = Math.abs(got - want) <= tol;
  if (ok) passed++; else failed++;
  console.log((ok ? "PASS " : "FAIL ") + name + ": got " + (Math.round(got * 1000) / 1000) + ", want " + want + " ± " + tol);
}
function part(id) { return G.getPart(id); }

// 1. Rocket equation: 200 s x 9.81 x ln(100 / 90) = 206.7 m/s
near("1 rocket equation", G.rocketDeltaV(200, 100, 10), 206.7, 0.1);
near("1 no fuel gives no dv", G.rocketDeltaV(200, 100, 0), 0, 0);

// 2. Speed and period at 500 km: r = 6,871 km
//    v = sqrt(3.986e14 / 6.871e6) = 7,616 m/s; T = 2 pi sqrt(r^3 / mu) = 5,668 s = 94.47 min
near("2 LEO speed m/s", G.orbitalSpeedMs(500), 7616, 2);
near("2 LEO period min", G.orbitalPeriodS(500) / 60, 94.47, 0.05);
//    At 35,786 km the period is one sidereal day: 86,164 s = 1,436.1 min
near("2 GEO period min", G.orbitalPeriodS(35786) / 60, 1436.1, 0.5);

// 3. Solar power: 1361 x 0.66 x 0.204 = 183.2 W (Sparkwing panel, 183 W on its datasheet)
near("3 small panel W", G.solarPowerW(part("solar-small")), 183.2, 0.1);
near("3 large panel W", G.solarPowerW(part("solar-large")), 365.2, 0.2);

// 4. Eclipse fraction at 500 km: asin(6371 / 6871) / pi = 1.1868 / 3.1416 = 0.3778
near("4 LEO eclipse fraction", G.eclipseFraction(500), 0.3778, 0.0005);
//    GEO: asin(6371 / 42157) / pi = 0.0483
near("4 GEO eclipse fraction", G.eclipseFraction(35786), 0.0483, 0.0005);

// 5. Battery at 500 km, 100 W load: eclipse = 0.3778 x 5,668 s = 2,141 s = 0.5948 h
//    E = 100 x 0.5948 / 0.3 = 198.3 Wh
near("5 battery Wh", G.batteryNeededWh(100, 500), 198.3, 0.5);

// 6. Resolution of the thermal imager at 500 km: 1.22 x 1e-5 x 500,000 / 0.25 = 24.4 m
near("6 thermal at LEO m", G.resolutionM(part("thermal-imager"), 500), 24.4, 0.05);
//    ...and from GEO: 1.22 x 1e-5 x 35,786,000 / 0.25 = 1,746 m
near("6 thermal at GEO m", G.resolutionM(part("thermal-imager"), 35786), 1746.4, 0.5);
//    Radar: formula does not apply, so null
var r = G.resolutionM(part("sar-radar"), 500);
if (r === null) { passed++; console.log("PASS 6 radar resolution is null"); } else { failed++; console.log("FAIL 6 radar resolution should be null, got " + r); }

// 7. Data budget: min(10, 65 x 0.07) = 4.55 GB/day
near("7 data returned GB", G.dataReturnedGbDay(10, 65, 0.07), 4.55, 0.001);
near("7 data capped by production", G.dataReturnedGbDay(2, 270, 1), 2, 0);

// 8. Margin: (200 - 57) / 200 = 0.715
near("8 margin", G.margin(200, 57), 0.715, 0.0001);

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed) process.exitCode = 1;
