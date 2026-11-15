// tests/perf.js — the load-time choices that keep the desktop Lighthouse score high stay in place. Run: node tests/perf.js
// What each guards (see handoff/notes/v2-perf.md):
//  - every script is deferred (a script added without defer would run before all the others and find no globals);
//  - the page opens as the home page (body.is-home) and the footer stays hidden until the first screen is drawn,
//    which is what removed the big layout shift (CLS 0.81 to 0);
//  - the fonts are served from css/fonts/, not from Google Fonts (a render-blocking request), and every font file exists.
var fs = require("fs"), path = require("path");
var root = path.join(__dirname, "..");
var passed = 0, failed = 0;
function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
function check(ok, label) { if (ok) passed++; else failed++; console.log((ok ? "PASS " : "FAIL ") + label); return ok; }

var html = read("index.html"), css = read("css/style.css"), ui = read("js/ui-design.js");

var tags = html.match(/<script\b[^>]*>/g) || [];
var plain = tags.filter(function (t) { return !/\bdefer\b/.test(t); });
check(tags.length > 0 && plain.length === 0, "every <script> in index.html has defer" + (plain.length ? " (missing: " + plain.join(" ").slice(0, 160) + ")" : " (" + tags.length + " tags)"));

check(/<body[^>]*class="[^"]*\bis-home\b/.test(html), "index.html opens as the home page (body.is-home)");
check(/#app:empty\s*~\s*\.foot\s*\{[^}]*visibility:\s*hidden/.test(css), "the footer stays hidden until the first screen is drawn (css/style.css)");
check(/document\.currentScript\s*&&\s*document\.currentScript\.defer/.test(ui), "js/ui-design.js starts on DOMContentLoaded when its script is deferred");

check(!/fonts\.(googleapis|gstatic)\.com/.test(html + css + read("css/story.css")), "no request to Google Fonts in index.html or the CSS");
var urls = [], re = /url\(\s*["']?(fonts\/[^"')]+)["']?\s*\)/g, m;
while ((m = re.exec(css))) urls.push(m[1]);
var missing = urls.filter(function (u) { return !fs.existsSync(path.join(root, "css", u)); });
check(urls.length >= 7 && missing.length === 0, "every font file in css/style.css exists in css/fonts/ (" + urls.length + " urls)" + (missing.length ? " missing: " + missing.join(", ") : ""));
["Pixelify Sans", "VT323", "Courier Prime", "Special Elite", "Stardos Stencil"].forEach(function (f) {
  check(new RegExp('@font-face\\s*\\{\\s*font-family:\\s*"' + f + '"').test(css), "@font-face for " + f);
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
