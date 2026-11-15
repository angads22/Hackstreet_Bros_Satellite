// tests/load.js — loads the game's files into Node in the same order as
// index.html, and returns every global (data and functions) on one object.
// Usage: var G = require("./load")();
var fs = require("fs"), vm = require("vm"), path = require("path");

var FILES = ["data/parts.js", "data/launchers.js", "data/orbits.js", "data/objectives.js", "data/campaign.js", "data/contracts.js", "data/research.js",
             "data/tiers.js", "data/events.js", "data/debrief.js", "data/missions.js", "data/hints.js", "data/eras.js", "data/earth.js", "js/game.js", "js/mission.js"];

// load({ newCategoriesRequired: true }) loads the game as it will be once the Build
// screen has bins for structure and attitude (SPEC.md, "Switch-over").
// load({ storage: load.memoryStorage() }) gives the game a localStorage that keeps only text, as a
// browser does; loading again with the same storage is a page reload.
// Rockets never fail here unless the test asks for the dice: load({ realRockets: true }) keeps data/launchers.js
// failure_chance as it is. The other tests are about money, contracts and parts, not luck, so they must not depend on
// a tuned chance; the tests of the dice (tests/comeback.js, section 20) opt in.
module.exports = function load(opts) {
  opts = opts || {};
  var root = path.join(__dirname, "..");
  var ctx = vm.createContext({ console: console, Math: Math, btoa: btoa, atob: atob });   // browser globals the game uses
  if (opts.storage) ctx.localStorage = opts.storage;
  var names = [];
  FILES.forEach(function (f) {
    var src = fs.readFileSync(path.join(root, f), "utf8");
    vm.runInContext(src, ctx, { filename: f });
    // Collect top-level `const X =`, `var X =` and `function X(` names.
    var re = /^(?:const|var|let)\s+([A-Za-z_$][\w$]*)|^function\s+([A-Za-z_$][\w$]*)/gm, m;
    while ((m = re.exec(src))) names.push(m[1] || m[2]);
  });
  if (opts.newCategoriesRequired) vm.runInContext("NEW_CATEGORIES_REQUIRED = true;", ctx);
  if (!opts.realRockets) vm.runInContext("LAUNCHERS.forEach(function (l) { l.failure_chance = 0; });", ctx);
  var G = {};
  names.forEach(function (n) { G[n] = vm.runInContext(n, ctx); });
  G.run = function (code) { return vm.runInContext(code, ctx); };   // for tuning scripts: change a game value in place
  // For the sweeps: parts and launchers grouped by era. "era" = open at the start of a
  // campaign or unlocked by research dated before 1965; "modern" = everything later.
  G.eraOf = function (kind, id) {
    var r = G.researchUnlocking(kind, id);
    return (!r || r.year < 1965) ? "era" : "modern";
  };
  G.topicEra = function (objectiveId) {
    var o = G.getObjective(objectiveId), r = o && o.requires_research ? G.researchById(o.requires_research) : null;
    return (!r || r.year < 1965) ? "era" : "modern";
  };
  return G;
};

// A localStorage stand-in: values are stored as text, so anything JSON cannot keep is lost, as in a browser.
module.exports.memoryStorage = function () {
  var data = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; },
    clear: function () { data = {}; }
  };
};
