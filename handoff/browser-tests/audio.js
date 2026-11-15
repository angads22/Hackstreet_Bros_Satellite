// The game's own music and sounds (js/audio.js): synthesised in the browser, silent until the first click, two footer switches
// that are remembered, the era picks the mood, the part cards / launch / debrief / events call the effects, and the game
// still works with no Web Audio at all. A tap on the master output proves the music really makes a signal.
// Usage: node audio.js [shots dir]   or   node audio.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const T = require('./lib');
const { url } = T.args();
const { ok, done } = T.checker();

const TAP = () => {   // an analyser on the master output, for the test only
  const Orig = window.AudioContext;
  if (!Orig) return;
  window.AudioContext = class extends Orig {
    createDynamicsCompressor() { const c = super.createDynamicsCompressor(); const an = this.createAnalyser(); an.fftSize = 2048; c.connect(an); window.__an = an; return c; }
  };
};
const rms = p => p.evaluate(() => { const a = window.__an; if (!a) return -1; const d = new Float32Array(a.fftSize); a.getFloatTimeDomainData(d); let s = 0; for (const v of d) s += v * v; return Math.sqrt(s / d.length); });

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  // ---- music and effects, with the tap
  {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = T.watchErrors(p);
    await T.noFonts(p);
    await p.addInitScript(TAP);
    await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
    ok(await p.locator('.foot .snd').count() === 2, 'two footer switches: MUSIC and SOUNDS');
    ok(/MUSIC: ON/.test(await p.locator('.snd-music').innerText()) && /SOUNDS: ON/.test(await p.locator('.snd-sfx').innerText()), 'both on by default');
    ok(await p.evaluate(() => GravAudio.state().running) === false, 'nothing plays before the first click');
    await p.mouse.click(5, 5);
    await p.waitForTimeout(3500);
    ok(await p.evaluate(() => GravAudio.state().running), 'the first click starts the audio');
    const level = await rms(p);
    ok(level > 0.0008, `the music makes a signal (rms ${level.toFixed(4)})`);
    ok(level < 0.5, 'and it is not loud');
    await p.evaluate(() => { window.__calls = []; const o = GravAudio.sfx; GravAudio.sfx = function (n, a) { window.__calls.push(n); return o.apply(this, arguments); }; });
    await p.click('[data-key="part2-go"]').catch(() => {});
    ok((await p.evaluate(() => window.__calls)).includes('click'), 'a button press ticks');
    // era follows the page
    await p.evaluate(() => document.body.setAttribute('data-era', '1958')); await p.waitForTimeout(100);
    ok(await p.evaluate(() => GravAudio.state().era) === '1958', 'the 1958 look gives the 1958 mood');
    await p.evaluate(() => document.body.setAttribute('data-era', 'today')); await p.waitForTimeout(100);
    ok(await p.evaluate(() => GravAudio.state().era) === 'today', '...and today gives the modern one');
    // part cards: add and remove sounds
    await p.evaluate(() => { const d = newDesign('training'); setEra(d, 'igy'); setObjective(d, 'radiation'); setOrbit(d, 'leo'); window.showDesignScreen('build', d); window.__calls = []; });
    await T.waitHead(p, 'BUILD');
    await p.click('[data-key="bin-instrument"]').catch(() => {});
    await p.evaluate(() => { window.__calls = []; });   // the bin's own tick is not the card's
    const card = p.locator('.part:not(.locked):not([disabled])').first();
    await card.click(); await p.waitForTimeout(150);
    const added = await p.evaluate(() => window.__calls.slice());
    ok(added.includes('add'), `adding a part makes the add sound (${added.join(',')})`);
    ok(!added.includes('click'), 'a part card does not also tick');
    await p.locator('.part.on, .part[aria-pressed="true"]').first().click().catch(() => {}); await p.waitForTimeout(150);
    ok((await p.evaluate(() => window.__calls)).includes('remove'), 'taking it out makes the remove sound');
    ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    // switches: remembered across a reload
    await p.click('.snd-music'); await p.click('.snd-sfx');
    ok(/MUSIC: OFF/.test(await p.locator('.snd-music').innerText()) && /SOUNDS: OFF/.test(await p.locator('.snd-sfx').innerText()), 'both switches turn off');
    await p.waitForTimeout(2500);
    const quiet = await rms(p);
    ok(quiet < 0.0008, `with music off the output falls silent (rms ${quiet.toFixed(5)})`);
    await p.reload();
    ok(/MUSIC: OFF/.test(await p.locator('.snd-music').innerText()) && /SOUNDS: OFF/.test(await p.locator('.snd-sfx').innerText()), 'the choice is remembered after a reload');
    await p.close();
  }
  // ---- the game with no Web Audio at all
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errors = T.watchErrors(p);
    await T.noFonts(p);
    await p.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; });
    await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
    await p.click('[data-key="part1-go"]');
    ok(await p.locator('.intro').waitFor({ timeout: 4000 }).then(() => true, () => false), 'with no Web Audio the game still plays');
    ok(await p.evaluate(() => GravAudio.state().supported) === false, 'and says it is not supported');
    ok(await T.noScroll(p), 'no sideways scroll at 390');
    ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await p.close();
  }
  await b.close();
  done();
})();
