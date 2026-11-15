// Words per screen region (visible text), at 1280x800: the home page, then Part 1, step 1. The home page must stay
// readable in five seconds, so its body (#app) has a budget.
// Usage: node regions.js [shots dir]   or   node regions.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const T = require('./lib');
const { url } = T.args();
const { ok, done } = T.checker();
const HOME_BUDGET = 80;   // words in the home page body (#app), header and footer not counted

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await T.noFonts(p);
  const regions = async (name, sels) => {
    const r = await p.evaluate(sels => sels.map(s => [s, ([...document.querySelectorAll(s)].map(e => e.innerText).join(' ').match(/\S+/g) || []).length]), sels);
    console.log(name + ': ' + r.map(x => x[0] + '=' + x[1]).join('  '));
    return Object.fromEntries(r);
  };
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
  const home = await regions('home', ['header', '#hint', '[data-key="mode-part1"]', '[data-key="mode-part2"]', '#app', 'body']);
  ok(home['#app'] <= HOME_BUDGET, `home page body: ${home['#app']} words (budget ${HOME_BUDGET})`);
  await p.click('[data-key="part1-go"]');
  await regions('beat', ['.intro']);
  await T.throughBeats(p); await T.waitHead(p, 'BASE MAP'); await p.waitForTimeout(300);
  await regions('map', ['header', '#hint', '.map-prompt', '.map-layout aside', '.legend']);
  await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD'); await p.click('[data-key="bin-instrument"]');
  await regions('build', ['header', '#hint', '.bins', '.bench', '.workshop .stack', '.shelf', '.nav-row']);
  await T.addParts(p, T.WALK[1].parts);
  await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'READINESS');
  await regions('review', ['header', '#hint', '.pad > .panel', '.nav-row']);
  await p.keyboard.press('m'); await T.waitHead(p, 'BASE MAP'); await p.click('[data-key="blip-launcher"]'); await T.waitHead(p, 'LAUNCH VEHICLE');
  await regions('rocket', ['header', '#hint', '.grid', '.pad .panel']);
  await b.close();
  done();
})();
