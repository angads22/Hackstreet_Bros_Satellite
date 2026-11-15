// Shared by the browser tests: where the repo is, the page URL, error capture, and Part 1's proof designs.
// Usage in a test:  const T = require('./lib');  const { repo, shots } = T.args();
//   node <test>.js [shots dir]               the repo is the one this file lives in (or $REPO)
//   node <test>.js <repo dir> <shots dir>    an explicit repo (it must hold index.html)
// Run the tests from a scratch folder, never from the repo: screenshots go to the shots dir.
const fs = require('fs');
const path = require('path');

function args() {
  const a = process.argv.slice(2);
  let repo = process.env.REPO || path.resolve(__dirname, '..', '..');
  let shots = a[0];
  if (a[0] && fs.existsSync(path.join(a[0], 'index.html'))) { repo = a[0]; shots = a[1]; }
  shots = shots || fs.mkdtempSync(path.join(require('os').tmpdir(), 'gravitron-shots-'));
  const url = 'file://' + path.join(path.resolve(repo), 'index.html');
  console.log('page: ' + url + '   shots: ' + shots);
  return { repo: path.resolve(repo), shots, url };
}

// Outbound calls are blocked in the sandbox: the fonts and the live open data fail to load and the SNAPSHOT badge
// shows. Those failed requests are expected; any other console error, and every page error, counts.
const EXPECTED = /fonts\.(googleapis|gstatic)\.com|services\.swpc\.noaa\.gov|eonet\.gsfc\.nasa\.gov|cwfis\.cfs\.nrcan\.gc\.ca/;
function watchErrors(page, extraAllowed) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const where = (m.location() || {}).url || '';
    if (EXPECTED.test(where) || EXPECTED.test(m.text())) return;
    if (extraAllowed && (extraAllowed.test(where) || extraAllowed.test(m.text()))) return;
    errors.push(m.text() + (where ? ' (' + where + ')' : ''));
  });
  return errors;
}
async function noFonts(page) { if (!process.env.FONTS) await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort()); }

function checker() {
  let fails = 0;
  const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; return !!c; };
  const done = () => { console.log(fails ? 'FAILED ' + fails : 'PASSED'); process.exit(fails ? 1 : 0); };
  return { ok, done, count: () => fails };
}
function skipped(why) { console.log('SKIPPED: ' + why); process.exit(0); }

const head = (p, text) => p.locator('.screen-head h1', { hasText: text });
const waitHead = (p, text) => head(p, text).waitFor({ timeout: 8000 }).then(() => true, () => false);
const noScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const words = t => (String(t).match(/\S+/g) || []).length;

// Part 1's proof designs: each flies to at least 1 star with 1958 parts under every event choice
// (handoff/browser-tests/walk-proof.js checks them in Node with the real back end; play.js flies them in the page).
// The presets are the step's own (js/ui-design.js, WALK_STEPS); a step only sets what the player chooses.
const BASIC = ['explorer-body', 'spin-stabilised', 'cosmic-ray-counter', 'minitrack-beacon', 'command-timer'];
const WALK = {
  // Step 1: the opening beats say "fit solar cells", so this is the build they lead to (cells, no battery).
  1: { preset: { objective: 'radiation', orbit: 'leo', launcher: 'juno-1' }, parts: BASIC.concat(['silicon-cells']) },
  // Step 2: the player picks the orbit; cells plus a battery carry it through Earth's shadow.
  2: { preset: { objective: 'radiation', launcher: 'vanguard-rocket' }, orbit: 'leo', parts: BASIC.concat(['silicon-cells', 'mercury-battery']) },
  // Step 3: nothing preset. 1958 has one topic (radiation) and its rockets reach only low orbit.
  3: { preset: {}, objective: 'radiation', orbit: 'leo', launcher: 'juno-1', parts: BASIC.concat(['silicon-cells', 'mercury-battery']) }
};
// The faithful Explorer 1 (batteries only): it falls silent and earns no star.
const BATTERY_ONLY = BASIC.concat(['mercury-battery']);
const BIN = { 'explorer-body': 'structure', 'spin-stabilised': 'attitude', 'cosmic-ray-counter': 'instrument', 'scintillation-counter': 'instrument',
  'minitrack-beacon': 'comms', 'command-timer': 'computer', 'tape-recorder': 'computer', 'silicon-cells': 'power', 'mercury-battery': 'power',
  'silver-zinc-battery': 'power',
  // present-day parts (modern.js)
  'smallsat-bus': 'structure', 'reaction-wheels': 'attitude', 'sar-radar': 'instrument', 'solar-large': 'power', 'radio-xband': 'comms',
  'obc-basic': 'computer', 'battery-28v': 'power', 'prop-green-large': 'propulsion',
  // Part 2's contract designs (CONTRACT below)
  'drum-body': 'structure', 'cubesat-12u': 'structure', 'oso-xray-spectrometer': 'instrument', 'avcs-camera': 'instrument',
  'alouette-2-sounder': 'instrument', 'solar-small': 'power', 'n-on-p-cells': 'power', 'radio-uhf': 'comms', 'radio-sband': 'comms',
  'prop-ion': 'propulsion' };

// Part 2's proof designs, one per contract topic the tests fly, found with the back end in Node (today's parts):
//   solar: 3 stars on Normal's opening solar contract (low orbit): full pay and the 3-star bonus, about $2.7M with the rocket.
//   wildfire: 2 stars on Normal's opening wildfire contract (low orbit): paid in part (a little under the minimum of data).
//   ionosphere: Easy's opening ionosphere contract (polar orbit); it costs more than Easy's starting cash, so iono.js adds cash.
const CONTRACT = {
  solar: { orbit: 'leo', launcher: 'rideshare', parts: ['drum-body', 'spin-stabilised', 'scintillation-counter', 'oso-xray-spectrometer', 'solar-small', 'mercury-battery', 'radio-uhf', 'obc-basic'] },
  wildfire: { orbit: 'leo', launcher: 'rideshare', parts: ['cubesat-12u', 'spin-stabilised', 'avcs-camera', 'n-on-p-cells', 'mercury-battery', 'radio-sband', 'obc-basic'] },
  ionosphere: { orbit: 'sso', launcher: 'small', parts: ['smallsat-bus', 'spin-stabilised', 'alouette-2-sounder', 'solar-small', 'mercury-battery', 'radio-uhf', 'obc-basic', 'prop-ion'] }
};

async function addParts(page, parts) {
  for (const part of parts) {
    await page.click(`[data-key="bin-${BIN[part]}"]`);
    await page.click(`[data-key="part-${part}"]`);
  }
}
// Through the story beats (NEXT ... START) to the base map. Returns the beats' text.
async function throughBeats(page) {
  const seen = [];
  for (let i = 0; i < 12; i++) {
    if (!(await page.locator('.intro').count())) break;
    seen.push((await page.locator('.intro .say-text p').innerText().catch(() => '')));
    await page.click('.intro .btn.primary');
  }
  return seen;
}
// Fly the mission at fast forward, answering every event with `choice` (first, or 'last'). Returns the event count.
async function fly(page, choice) {
  await page.click('button[aria-label="Fast forward"]');
  let events = 0;
  for (let i = 0; i < 600; i++) {
    if (await head(page, 'DEBRIEF').count()) break;
    if (await page.locator('[role="alertdialog"]').count()) {
      events++;
      const btns = page.locator('[role="alertdialog"] .choices .btn');
      await (choice === 'last' ? btns.last() : btns.first()).click();
    }
    await page.waitForTimeout(50);
  }
  return events;
}
// Part 2: from the home page, start a comeback on a difficulty ('training', 'standard' or 'expert') and go through Ajay's
// intro to the workshop. Returns the intro beats' text.
async function startComeback(page, tierId) {
  await page.click('[data-key="part2-go"]');
  await page.click(`[data-key="level-${tierId}"]`);
  const beats = await throughBeats(page);
  await waitHead(page, 'WORKSHOP');
  return beats;
}
// Part 2: from the workshop, take the contract on `topic` (FLY THIS), build CONTRACT[topic] and launch it (the orbit is
// chosen at the Tracking Station only when the contract leaves it open). Stops on the mission screen, or on the
// readiness review with { review: true }.
async function launchContract(page, topic, opts) {
  const c = CONTRACT[topic];
  await page.click(`[data-key="fly-${topic}"]`); await waitHead(page, 'BASE MAP');
  if (c.orbit) {
    await page.click('[data-key="blip-orbit"]'); await waitHead(page, 'ORBIT');
    if (await page.locator(`button[data-key="orbit-${c.orbit}"]:not([disabled])`).count()) await page.click(`[data-key="orbit-${c.orbit}"]`);
    await page.click('.nav-row .btn.primary');
  } else await page.click('[data-key="blip-build"]');
  await waitHead(page, 'BUILD');
  await addParts(page, c.parts);
  await page.click('.nav-row .btn.primary'); await waitHead(page, 'LAUNCH VEHICLE');
  await page.click(`[data-key="rocket-${c.launcher}"]`);
  await page.click('.nav-row .btn.primary'); await waitHead(page, 'READINESS');
  if (opts && opts.review) return;
  await page.locator('.btn.big').click(); await waitHead(page, 'MISSION');
}
async function stars(page) {
  const label = await page.locator('.stamp').getAttribute('aria-label');
  return parseInt(label, 10);
}

module.exports = { args, watchErrors, noFonts, checker, skipped, head, waitHead, noScroll, words, WALK, BATTERY_ONLY, BIN,
  CONTRACT, addParts, throughBeats, fly, stars, startComeback, launchContract };
