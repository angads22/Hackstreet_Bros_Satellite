// cap6.js: the base map walk, and Iron Eclipse's offer with the SOLD OUT ending.
const R = require('./rec.js');
const T = require(R.GAME + '/handoff/browser-tests/lib.js');
const only = process.argv[2];
const want = n => !only || only.split(',').includes(n);
const sleep = (p, ms) => p.waitForTimeout(ms);
const gif = (id, o) => { try { const r = R.makeGif(id, o); console.log(id, r.kb + 'KB', 'lite', r.liteKb + 'KB', r.frames + ' frames'); R.sheet(id, { n: 9, cols: 3, cell: 440 }); } catch (e) { console.log('gif fail', id, e.message.slice(0, 200)); } };
const guard = async (name, fn) => { try { await fn(); } catch (e) { console.log('FAILED', name, String(e).slice(0, 300)); } };
const FLY = () => {
  const c = getCampaign();
  const k = { id: 't-story-' + c.missions.length, topic: 'radiation', orbit: null, client: 'A test client', reason: 'It tests things.', min_science: 60,
    price_musd: 10, bonus_musd: 2.5, expires_month: c.month + 12, done: false, text: 'A test contract.' };
  c.offers = (c.offers || []).concat([k]); saveCampaign(c);
  const d = newComebackDesign(k.id);
  if (!d) return null;
  setOrbit(d, 'leo'); setLauncher(d, 'rideshare');
  ['scintillation-counter', 'solar-small', 'mercury-battery', 'radio-uhf', 'command-timer', 'spin-stabilised', 'cubesat-12u'].forEach(p => addPart(d, p));
  const m = startMission(d);
  let s; do { s = stepMonth(m); if (s.event) chooseEvent(m, Math.max(0, s.event.choices.findIndex(x => !x.fail_chance_now))); } while (!m.ended);
  return recordResult(m).stars;
};

(async () => {
  if (want('map')) await guard('map', async () => {
    const s = await R.open({ name: 'map-gif', height: 800 });
    const p = s.page;
    await p.click('[data-key="part1-go"]'); await T.throughBeats(p);
    await T.waitHead(p, 'BASE MAP'); await sleep(p, 1500); await R.park(p);
    const cap = R.startCapture(p, 'map-gif', { fps: 10, clip: { x: 0, y: 0, width: 1280, height: 800 } });
    await sleep(p, 1200);
    await p.keyboard.press('e');
    await sleep(p, 3600);
    await p.keyboard.press('e');
    await sleep(p, 1800);
    await cap.stop();
    await R.still(p, 'map-gif', 'poster');
    console.log('map after walk:', (await R.text(p)).slice(0, 120));
    await s.close();
    gif('map-gif', { width: 860, colors: 56, holdLast: 0.4 });
  });

  if (want('offer')) await guard('offer', async () => {
    const s = await R.open({ name: 'offer-gif', height: 800 });
    const p = s.page;
    p.on('dialog', d => d.accept());
    await p.click('[data-key="part2-go"]'); await p.click('[data-key="level-standard"]');
    for (let i = 0; i < 12 && await p.locator('.intro').count(); i++) await p.click('.intro .btn.primary');
    await T.waitHead(p, 'WORKSHOP');
    await p.evaluate(FLY); await p.evaluate(() => window.showComebackHub());
    for (let i = 0; i < 12 && await p.locator('.intro').count(); i++) await p.click('.intro .btn.primary');
    await T.waitHead(p, 'WORKSHOP');
    await p.evaluate(FLY);
    await R.park(p);
    const cap = R.startCapture(p, 'offer-gif', { fps: 10, clip: { x: 0, y: 0, width: 1280, height: 800 } });
    await p.evaluate(() => window.showComebackHub());
    await sleep(p, 1800);
    for (let i = 0; i < 14 && !(await p.locator('.story-offer').count()); i++) {
      await p.click('.intro .btn.primary').catch(() => {}); await sleep(p, 1500);
    }
    await sleep(p, 1800); await R.park(p);
    await R.still(p, 'offer-gif', 'offer');
    console.log('offer text:', (await R.text(p)).slice(0, 220));
    await p.click('[data-key="offer-sell"]'); await R.park(p);
    await sleep(p, 6500);
    await cap.stop();
    await R.still(p, 'offer-gif', 'poster');
    console.log('ending text:', (await R.text(p)).slice(0, 220));
    await s.close();
    gif('offer-gif', { width: 860, colors: 56, holdLast: 0.6 });
  });
})().catch(e => { console.error('CAP6 ERROR', e); process.exit(1); });
