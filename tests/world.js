// tests/world.js — the long pole and lead time (SPEC.md, "Real-world elements: the long pole and lead time").
// Run from the repo root:  node tests/world.js
// 1. getSchedule(design) names the slowest part and matches the hand-worked cases below.
// 2. It changes no timing: dev_months is still the longest build plus one month per three parts.
// 3. Every part has a positive whole-number lead_months with a source note, and build_months is untouched.
var fs = require("fs"), path = require("path");
var G = require("./load")();
var passed = 0, failed = 0;
function check(name, ok, detail) { if (ok) passed++; else failed++; console.log((ok ? "PASS " : "FAIL ") + name + (ok || !detail ? "" : "  (" + detail + ")")); }
function design(ids) { var d = G.newDesign("training"); ids.forEach(function (id) { G.addPart(d, id); }); return d; }
function same(got, want) { return JSON.stringify(got) === JSON.stringify(want); }

// ---- 1. hand-worked cases (build_months: vidicon 6, silicon cells 3, NiCd 2, 235 MHz link 3, clock 1, radar 18, thermal 12, optical 6)
var a = G.getSchedule(design(["vidicon-camera", "silicon-cells", "nicad-battery", "vhf-telemetry", "command-timer"]));
check("A five parts: the vidicon cameras are the long pole, 6 months",
  same(a, { long_pole: "Vidicon TV cameras", long_pole_months: 6, next_months: 3, integration_months: 2, total_months: 8 }), JSON.stringify(a));

var b = G.getSchedule(design(["thermal-imager", "sar-radar", "optical-camera"]));
check("B radar 18, next is the thermal imager 12, one month to integrate: 19",
  same(b, { long_pole: "Synthetic aperture radar", long_pole_months: 18, next_months: 12, integration_months: 1, total_months: 19 }), JSON.stringify(b));

var b2 = G.getSchedule(design(["thermal-imager", "optical-camera"]));
check("B swapping the long pole out: the total is next_months + integration (12 + 1)", b2.total_months === b.next_months + b2.integration_months && b2.total_months === 13, JSON.stringify(b2));

var c = G.getSchedule(design(["optical-camera", "vidicon-camera"]));
check("C two equal long poles name both; removing one saves nothing",
  c.long_pole === "Optical camera and Vidicon TV cameras" && c.long_pole_months === 6 && c.next_months === 6 && c.total_months === 7, JSON.stringify(c));

var d = G.getSchedule(design(["cloud-photocell", "scintillation-counter", "vhf-telemetry"]));
check("D three equal long poles: the first name and a count", d.long_pole === "Cloud-cover photocells and 2 other parts" && d.long_pole_months === 3 && d.total_months === 4, JSON.stringify(d));

var one = G.getSchedule(design(["sar-radar"]));
check("E one part: no next part, 0 months without it", one.long_pole === "Synthetic aperture radar" && one.next_months === 0 && one.total_months === 19, JSON.stringify(one));

var none = G.getSchedule(design([]));
check("F no parts: nothing to name, all zero", same(none, { long_pole: null, long_pole_months: 0, next_months: 0, integration_months: 0, total_months: 0 }), JSON.stringify(none));

// ---- 2. no timing changed: total_months is dev_months, and both follow the old rule
function oldRule(ids) {
  if (!ids.length) return 0;
  return Math.max.apply(null, ids.map(function (id) { return G.getPart(id).build_months; })) + Math.ceil(ids.length / 3);
}
var all = G.PARTS.map(function (p) { return p.id; });
var singles = all.every(function (id) { var dd = design([id]); return G.getSchedule(dd).total_months === G.getTotals(dd).dev_months && G.getTotals(dd).dev_months === oldRule([id]); });
check("every part alone: total_months = dev_months = longest build + 1", singles);
var runs = [];
for (var i = 0; i < all.length; i += 4) runs.push(all.slice(i, i + 4 + (i % 3)));
runs.push(all);
var many = runs.every(function (ids) { var dd = design(ids); return G.getSchedule(dd).total_months === G.getTotals(dd).dev_months && G.getTotals(dd).dev_months === oldRule(ids); });
check("groups of parts and the whole catalogue: total_months = dev_months = the old rule", many);
check("dev_months of the SPEC example is still 6 + 2", G.getTotals(design(["vidicon-camera", "silicon-cells", "nicad-battery", "vhf-telemetry", "command-timer"])).dev_months === 8);
check("the sum of build_months is untouched (187 over 41 parts)", G.PARTS.length === 41 && G.PARTS.reduce(function (s, p) { return s + p.build_months; }, 0) === 187);
check("getSchedule only reads: the design is not changed", (function () { var dd = design(["sar-radar", "optical-camera"]), before = JSON.stringify(dd); G.getSchedule(dd); return JSON.stringify(dd) === before; }()));

// ---- 3. lead_months on every part, with a source note on the same line
check("every part has a positive whole-number lead_months",
  G.PARTS.every(function (p) { return typeof p.lead_months === "number" && isFinite(p.lead_months) && p.lead_months > 0 && Math.floor(p.lead_months) === p.lead_months; }),
  G.PARTS.filter(function (p) { return !(p.lead_months > 0); }).map(function (p) { return p.id; }).join(","));
check("lead_months is at most 24 months (the engineers' worst case is about 18)", G.PARTS.every(function (p) { return p.lead_months <= 24; }));
var src = fs.readFileSync(path.join(__dirname, "..", "data", "parts.js"), "utf8").split("\n").filter(function (l) { return /^\s+lead_months:/.test(l); });
check("each lead_months line carries a GAME VALUE source note", src.length === G.PARTS.length && src.every(function (l) { return /\/\/ GAME VALUE/.test(l); }), src.length + " lines");
var rows = fs.readFileSync(path.join(__dirname, "..", "SOURCES.md"), "utf8");
check("SOURCES.md lists lead_months as a game value and the web pages as not opened", /lead_months/.test(rows) && /NOT OPENED, NEEDS HUMAN CHECK/.test(rows));
check("simple electronics wait less than the wheels and the solar cells",
  G.getPart("command-timer").lead_months < G.getPart("reaction-wheels").lead_months && G.getPart("radio-uhf").lead_months < G.getPart("solar-small").lead_months);
check("reaction wheels sit inside 18 to 52 weeks (4 to 12 months)", G.getPart("reaction-wheels").lead_months >= 4 && G.getPart("reaction-wheels").lead_months <= 12);
check("modern solar panels sit inside 26 weeks to 18 months (6 to 18)", ["solar-small", "solar-large"].every(function (id) { var m = G.getPart(id).lead_months; return m >= 6 && m <= 18; }));

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed) process.exitCode = 1;
