// Fresh 2.1 screenshots for the deck. Usage: REPO=<repo> node capture.js <out dir>
const path = require('path');
const REPO = process.env.REPO;
const { chromium } = require(require.resolve('playwright', { paths: [REPO, process.cwd(), '/usr/lib/node_modules', '/usr/local/lib/node_modules'] }));
const T = require(path.join(REPO, 'handoff/browser-tests/lib.js'));
const out = process.argv[2];
const url = 'file://' + path.join(REPO, 'index.html');
const shot = async (p, name) => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(500); await p.screenshot({ path: path.join(out, name + '.png') }); console.log('shot', name); };
(async () => {
  const b = await chromium.launch();
  const open = async (w, h) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const p = await ctx.newPage(); await T.noFonts(p);
    await p.goto(url); await p.waitForSelector('[data-key="part2-go"]'); await p.waitForTimeout(1500);
    return p;
  };
  try {
    let p = await open(1440, 900);
    await shot(p, 'home');
    await T.startComeback(p, 'standard');
    await shot(p, 'workshop');
    await p.click('[data-key="fly-solar"]'); await T.waitHead(p, 'BASE MAP');
    await p.waitForTimeout(1200); await shot(p, 'map');
    const c = T.CONTRACT.solar;
    await p.click('[data-key="blip-orbit"]'); await T.waitHead(p, 'ORBIT');
    if (await p.locator(`button[data-key="orbit-${c.orbit}"]:not([disabled])`).count()) await p.click(`[data-key="orbit-${c.orbit}"]`);
    await shot(p, 'orbit');
    await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'BUILD');
    await T.addParts(p, c.parts);
    await p.waitForTimeout(1500); await shot(p, 'build');
    await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'LAUNCH VEHICLE');
    await p.click(`[data-key="rocket-${c.launcher}"]`);
    await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'READINESS');
    await shot(p, 'review');
    await p.locator('.btn.big').click(); await T.waitHead(p, 'MISSION');
    await p.waitForTimeout(2500); await shot(p, 'mission');
    await T.fly(p, 'first', true);
    await p.waitForTimeout(2500); await shot(p, 'debrief');
    await p.context().close();
  } catch (e) { console.log('desktop flow failed: ' + e.message.split('\n')[0]); }
  try {
    let p = await open(1440, 900);
    await p.click('[data-key="mode-quick"]'); await p.waitForTimeout(1200);
    await shot(p, 'quick');
    await p.context().close();
  } catch (e) { console.log('quick failed: ' + e.message.split('\n')[0]); }
  try {
    let p = await open(390, 844);
    await shot(p, 'phone-home');
    await T.startComeback(p, 'training');
    await shot(p, 'phone-workshop');
    await p.context().close();
  } catch (e) { console.log('phone failed: ' + e.message.split('\n')[0]); }
  await b.close();
})();
