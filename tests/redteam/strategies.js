// Named strategies, every tier, each played safe / risky / best / worst choice sequences.
var L = require("./lib"); var G = L.G;
var S = [
  ["wildfire", "Minimalist (thermal, cheapest everything, LEO rideshare)", "leo", "rideshare", ["thermal-imager", "solar-small", "radio-uhf", "obc-basic"]],
  ["wildfire", "Spec's 2-star recipe (thermal + S-band, SSO rideshare)", "sso", "rideshare", ["thermal-imager", "solar-small", "battery-28v", "radio-sband", "obc-basic", "prop-green-small"]],
  ["wildfire", "Optimiser's pick (thermal+camera+X-band+ion, SSO rideshare)", "sso", "rideshare", ["thermal-imager", "optical-camera", "solar-small", "battery-28v", "radio-xband", "obc-basic", "prop-ion"]],
  ["wildfire", "Bunker (optimiser + rad-tol spare computer + both radios)", "sso", "rideshare", ["thermal-imager", "optical-camera", "solar-large", "battery-28v", "radio-sband", "radio-xband", "obc-basic", "obc-radtol", "prop-ion"]],
  ["wildfire", "GEO stare (the spec's 'real choice')", "geo", "heavy", ["thermal-imager", "optical-camera", "solar-small", "battery-28v", "radio-xband", "obc-basic", "prop-ion"]],
  ["wildfire", "Camera trap (camera only)", "sso", "rideshare", ["optical-camera", "solar-small", "battery-28v", "radio-xband", "obc-basic", "prop-ion"]],
  ["wildfire", "Kitchen sink (all 15 parts)", "sso", "small", L.PART_IDS],
  ["sea-ice", "Spec walkthrough design (radar, large thruster, small launcher)", "sso", "small", ["sar-radar", "solar-large", "battery-28v", "radio-xband", "obc-basic", "prop-green-large"]],
  ["sea-ice", "Optimiser's pick (no battery, ion)", "sso", "small", ["sar-radar", "solar-large", "radio-xband", "obc-basic", "prop-ion"]],
  ["sea-ice", "Camera trap (camera only, SSO rideshare)", "sso", "rideshare", ["optical-camera", "solar-small", "battery-28v", "radio-xband", "obc-basic", "prop-ion"]],
  ["sea-ice", "Radar in LEO (blurb: never flies over the poles)", "leo", "small", ["sar-radar", "solar-large", "battery-28v", "radio-sband", "radio-xband", "obc-basic"]],
  ["sea-ice", "Radar + camera (two instruments)", "sso", "small", ["sar-radar", "optical-camera", "solar-large", "solar-small", "battery-28v", "radio-xband", "obc-basic", "prop-ion"]],
  ["sea-ice", "Kitchen sink (all 15 parts)", "sso", "small", L.PART_IDS],
  ["sea-ice", "Kitchen sink on the medium-lift rocket", "sso", "heavy", L.PART_IDS]
];
function seqs(d) {
  var n = G.startMission(d).schedule.length, out = [];
  for (var m = 0; m < (1 << n); m++) { var s = []; for (var i = 0; i < n; i++) s.push((m >> i) & 1); out.push(L.play(d, s)); }
  return out;
}
S.forEach(function (s) {
  var row = "| " + s[0] + " | " + s[1] + " | " + s[2] + "/" + s[3];
  G.TIERS.forEach(function (t) {
    var d = L.design(t.id, s[0], s[2], s[3], s[4]);
    var b = G.runChecks(d).blockers;
    if (b.length) { row += " | blocked: " + b.map(function (x) { return x.id; }).join(","); return; }
    var safe = L.play(d, L.SAFE), all = seqs(d);
    var best = Math.max.apply(null, all.map(function (r) { return r.score; })), worst = Math.min.apply(null, all.map(function (r) { return r.score; }));
    row += " | " + safe.score + " (" + safe.stars + "★) " + safe.limiting + (best !== worst ? " [" + worst + "–" + best + "]" : "");
  });
  var dd = L.design("training", s[0], s[2], s[3], s[4]);
  console.log(row + " | $" + G.getTotals(dd).cost_musd + ", " + G.getTotals(dd).mass_kg + " kg, preview " + G.previewScience(dd).total + " |");
});
