const { chromium } = require('playwright');
const REPO = '/home/user/Hackstreet_Bros_Satellite';
const ALL = { best_stars: {}, best_score: {}, best_stars_by_era: { igy: 3, nimbus: 3, eos: 3 } };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const wait = t => p.locator('.screen-head h1', { hasText: t }).waitFor({ timeout: 8000 });
  const regions = async (name, sels) => { const r = await p.evaluate(sels => sels.map(s => { const n = [...document.querySelectorAll(s)].map(e => e.innerText).join(' '); return [s, (n.match(/\S+/g) || []).length]; }), sels); console.log(name + ': ' + r.map(x => x[0] + '=' + x[1]).join('  ')); };
  await p.goto('file://' + REPO + '/index.html'); await p.evaluate(a => localStorage.setItem('smdg-progress-v1', JSON.stringify(a)), ALL); await p.reload();
  await regions('title', ['header', '#hint', '.era', '.campaign-panel', '.title']);
  await p.click('[data-key="start-new-space-training"]'); await p.locator('.intro').waitFor({timeout:3000}).then(()=>p.click('text=SKIP'),()=>{}); /*SKIPINTRO*/ await wait('BASE MAP'); await p.waitForTimeout(300);
  await regions('map', ['header', '#hint', '.map-prompt', '.map-layout aside', '.legend']);
  await p.click('[data-key="blip-briefing"]'); await wait('BRIEFING'); await regions('briefing', ['header', '#hint', '.grid', '.nav-row']);
  await p.click('[data-key="obj-sea-ice"]'); await p.click('.nav-row .btn.primary'); await wait('ORBIT'); await regions('orbit', ['header', '#hint', '.grid']);
  await p.click('[data-key="orbit-sso"]'); await p.click('.nav-row .btn.primary'); await wait('BUILD'); await p.click('[data-key="bin-instrument"]');
  await regions('build', ['header', '#hint', '.bins', '.bench', '.workshop .stack', '.shelf', '.nav-row']);
  await p.click('.nav-row .btn.primary'); await wait('LAUNCH VEHICLE'); await regions('rocket', ['header', '#hint', '.grid', '.pad .panel']);
  await b.close();
})();
