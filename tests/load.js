// tests/load.js — loads the game's files into Node in the same order as
// index.html, and returns every global (data and functions) on one object.
// Usage: var G = require("./load")();
var fs = require("fs"), vm = require("vm"), path = require("path");

var FILES = ["data/parts.js", "data/launchers.js", "data/orbits.js", "data/objectives.js",
             "data/tiers.js", "data/events.js", "data/debrief.js", "data/earth.js", "js/game.js", "js/mission.js"];

module.exports = function load() {
  var root = path.join(__dirname, "..");
  var ctx = vm.createContext({ console: console, Math: Math });
  var names = [];
  FILES.forEach(function (f) {
    var src = fs.readFileSync(path.join(root, f), "utf8");
    vm.runInContext(src, ctx, { filename: f });
    // Collect top-level `const X =`, `var X =` and `function X(` names.
    var re = /^(?:const|var|let)\s+([A-Za-z_$][\w$]*)|^function\s+([A-Za-z_$][\w$]*)/gm, m;
    while ((m = re.exec(src))) names.push(m[1] || m[2]);
  });
  var G = {};
  names.forEach(function (n) { G[n] = vm.runInContext(n, ctx); });
  return G;
};
