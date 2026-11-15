// tests/version.js — the version number agrees everywhere it is written. Run: node tests/version.js
// SPEC.md ("Versions and changelog") writes the version in three places: the footer of index.html,
// the "Current version" line in SPEC.md and the newest released heading in CHANGELOG.md. A version is
// cut by hand, so this catches a cut that missed one of them. A missing git tag is only a warning:
// cloud sessions cannot push tags, so a tag may be waiting for someone to push it from their computer.
var fs = require("fs"), path = require("path"), cp = require("child_process");
var root = path.join(__dirname, "..");
var passed = 0, failed = 0;
function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
function check(ok, label) {
  if (ok) passed++; else failed++;
  console.log((ok ? "PASS " : "FAIL ") + label);
  return ok;
}
// "0.7 beta" -> [0, 7]; "1.0" -> [1, 0]
function parts(v) { return String(v).split(" ")[0].split(".").map(Number); }
function newer(a, b) {
  var x = parts(a), y = parts(b);
  for (var i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
}

var VERSION = "(\\d+\\.\\d+(?:\\.\\d+)?(?: beta)?)";

// 1. The footer: <footer class="foot">GRAVITRON v0.7 beta</footer>
var footerMatch = new RegExp("<footer[^>]*>[^<]*\\bv" + VERSION + "\\s*</footer>").exec(read("index.html"));
var footer = footerMatch ? footerMatch[1] : null;
check(!!footer, "index.html footer shows a version" + (footer ? " (" + footer + ")" : ""));

// 2. SPEC.md: - **Current version: 0.7 beta.**
var specMatch = new RegExp("\\*\\*Current version: " + VERSION + "\\.\\*\\*").exec(read("SPEC.md"));
var spec = specMatch ? specMatch[1] : null;
check(!!spec, "SPEC.md has a \"Current version\" line" + (spec ? " (" + spec + ")" : ""));

// 3. CHANGELOG.md: "## Unreleased" first, then "## 0.7 beta (November 15, 2026)", newest first.
var log = read("CHANGELOG.md");
var heads = log.match(/^## .*$/gm) || [];
check(heads[0] === "## Unreleased", "CHANGELOG.md starts with \"## Unreleased\"");
var released = [], badHeads = [];
heads.slice(1).forEach(function (h) {
  var m = new RegExp("^## " + VERSION + " \\(([A-Z][a-z]+ \\d{1,2}, \\d{4})\\)$").exec(h);
  if (m) released.push(m[1]); else badHeads.push(h);
});
check(badHeads.length === 0, "every released heading reads \"## X.Y beta (Month D, YYYY)\"" +
  (badHeads.length ? ": " + badHeads.join(" | ") : ""));
var latest = released[0] || null;
check(!!latest, "CHANGELOG.md has a released version" + (latest ? " (newest: " + latest + ")" : ""));
var ordered = released.every(function (v, i) { return i === 0 || newer(released[i - 1], v); });
check(ordered, "released versions run newest first with no repeats (" + released.join(", ") + ")");

// 4. All three agree.
if (footer && latest) check(footer === latest, "the footer (" + footer + ") matches the newest changelog version (" + latest + ")");
if (spec && latest) check(spec === latest, "SPEC.md's current version (" + spec + ") matches the newest changelog version (" + latest + ")");

// 5. Information, never a failure: how much is waiting to be released, and whether the tag exists.
if (latest) {
  var unreleased = log.slice(log.indexOf("## Unreleased"), log.indexOf("## " + latest));
  var waiting = (unreleased.match(/^- /gm) || []).length;
  console.log("INFO " + waiting + " line" + (waiting === 1 ? "" : "s") + " under Unreleased since " + latest +
    (waiting ? ". When a missing piece has landed, cut the next version (SPEC.md, \"Cutting a version\")." : "."));
  var tag = "v" + latest.split(" ")[0];
  try {
    var tags = cp.execFileSync("git", ["tag", "--list", tag], { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    console.log(tags ? "INFO tag " + tag + " exists here (check it is pushed: git ls-remote --tags origin)"
      : "WARN no git tag " + tag + " here: tag the commit that cut " + latest + " and push it from a computer that can push tags");
  } catch (e) {
    console.log("INFO git is not available, so the tag was not checked");
  }
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
