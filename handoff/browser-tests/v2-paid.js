// Paying engineers for part information (SPEC.md, "Paying engineers for part information"), in the page:
//   Normal: the sheet is free, PERFORMANCE and DOSSIER show "?" with ASK; paying shows the value and the cash drops; it stays.
//   Hard: every group is "?". Easy and Part 1: nothing hidden, no ASK button. At 390 wide the "?" lines fit and nothing scrolls sideways.
//   Normal flight: the debrief's cash ledger has one ENGINEERS line and still adds up.
// Usage (from OUTSIDE the repo):  REPO=<repo> node <repo>/handoff/browser-tests/v2-paid.js <shots dir>
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();
const { waitHead } = T;

const COMMS = 'radio-uhf';
const instrumentOf = topic => T.CONTRACT[topic].parts.find(x => T.BIN[x] === 'instrument');
const near = (a, b) => Math.abs(a - b) < 0.0051;

// From the home page to the Build screen of the first open contract. Returns its topic.
async function toBuild(page, level) {
  await T.seedRuns(page);
  await page.click('[data-key="part2-go"]');
  await page.click(`[data-key="level-${level}"]`);
  await T.pastScenes(page);
  await waitHead(page, 'WORKSHOP');
  const keys = await page.$$eval('[data-key^="fly-"]', es => es.map(e => e.dataset.key.slice(4)));
  const topic = keys.find(k => T.CONTRACT[k]) || keys[0];
  const c = T.CONTRACT[topic];
  await page.click(`[data-key="fly-${topic}"]`); await waitHead(page, 'BASE MAP');
  if (c && c.orbit && await page.locator('[data-key="blip-orbit"]').count()) {
    await page.click('[data-key="blip-orbit"]'); await waitHead(page, 'ORBIT');
    await page.click(`[data-key="orbit-${c.orbit}"]`);
    await page.click('.nav-row .btn.primary');
  } else if (await page.locator('[data-key="blip-build"]').count()) await page.click('[data-key="blip-build"]');
  else { await page.click('[data-key="blip-orbit"]'); await waitHead(page, 'ORBIT'); await page.click('.card:not(.dim)'); await page.click('.nav-row .btn.primary'); }
  await waitHead(page, 'BUILD');
  return topic;
}
const slot = (p, id) => p.locator(`.part-slot:has([data-key="part-${id}"])`);
const cardText = async (p, id) => (await p.locator(`[data-key="part-${id}"]`).innerText()).replace(/\s+/g, ' ');
const asks = p => p.locator('.ask').count();

async function normal(viewport, label) {
  console.log(`[Normal, ${label}]`);
  const b = await chromium.launch();
  const page = await b.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = T.watchErrors(page);
  await T.noFonts(page);
  await page.goto(url); await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await page.reload();
  const topic = await toBuild(page, 'standard');
  const INSTR = instrumentOf(topic), c = T.CONTRACT[topic];
  await page.click('[data-key="bin-instrument"]'); await T.openLater(page, INSTR);   // v2.1: Part 2 shows six cards a bin

  ok(/WEIGHS|kg/i.test(await cardText(page, INSTR)), 'Normal: the card shows the sheet (mass and power are free)');
  ok(!/sci\/mo|m detail/.test(await cardText(page, INSTR)), 'Normal: the card hides the science a month');
  const unk = await slot(page, INSTR).innerText();
  ok(/SCIENCE \?/.test(unk) && !/SHEET \?/.test(unk), 'Normal: the card says SCIENCE ? and not SHEET ?');
  ok((await page.locator(`[data-key="ask-${INSTR}-performance"]`).innerText()).includes('$0.04M'), 'Normal: the ASK button names its fee ($0.04M)');
  ok(await page.locator(`[data-key="ask-${INSTR}-sheet"]`).count() === 0, 'Normal: no ASK for the free sheet');
  ok(await T.noScroll(page), label + ': no sideways scroll with the "?" lines');

  // The preview: the dossier is "?" with ASK THE ENGINEERS, and no explainer is drawn.
  await page.hover(`[data-key="part-${INSTR}"]`); await page.waitForTimeout(200);
  const pv = await page.locator('#preview').innerText();
  ok(/DOSSIER \?/.test(pv) && /ASK THE ENGINEERS/.test(pv), 'Normal: the preview shows DOSSIER ? and ASK THE ENGINEERS');
  ok(await page.locator('#preview figure.explainer').count() === 0, 'Normal: no explainer before the dossier is paid');
  ok(await page.locator('#preview .part-why').count() === 0, 'Normal: no WHY box before the dossier is paid');
  ok(await page.locator('#preview .preview-line.fix, #preview .preview-line.cause').count() === 0, 'Normal: no Fixes or Causes lines before the dossier is paid');
  if (viewport.width > 600) await page.screenshot({ path: path.join(shots, `v2paid-normal-${label}-unknown.png`) });

  // Pay for the performance: the value appears and the cash drops by the fee.
  const cash0 = await T.cashNow(page);
  await page.click(`[data-key="ask-${INSTR}-performance"]`); await page.waitForTimeout(200);
  const cash1 = await T.cashNow(page);
  ok(near(cash0 - cash1, 0.04), `Normal: the cash dropped by the fee (${cash0} -> ${cash1})`);
  ok(/sci\/mo/.test(await cardText(page, INSTR)), 'Normal: the science a month now shows on the card');
  ok(await page.locator(`[data-key="unknown-${INSTR}-performance"]`).count() === 0, 'Normal: its "?" and ASK are gone');
  // Pay for the dossier from the preview: the explainer (or the blurb) comes.
  await page.hover(`[data-key="part-${INSTR}"]`); await page.waitForTimeout(150);
  await page.click(`[data-key="ask-${INSTR}-dossier"]`); await page.waitForTimeout(250);
  const cash2 = await T.cashNow(page);
  ok(near(cash1 - cash2, 0.04), `Normal: the dossier cost its own fee (${cash1} -> ${cash2})`);
  ok(await page.locator('#preview figure.explainer, #preview .blurb').count() > 0, 'Normal: the explainer shows once the dossier is paid');
  ok(await page.locator('#preview .preview-line.fix').count() > 0 && /Fixes:/.test(await page.locator('#preview').innerText()), 'Normal: a paid dossier shows what the part fixes ("Fixes: ...")');
  ok(await asks(page) === 0 || await page.locator(`[data-key="ask-${INSTR}-dossier"]`).count() === 0, 'Normal: no ASK left for that part');
  // Once per run: change bins and come back, and it stays known; the same part's other groups were never charged twice.
  await page.click('[data-key="bin-power"]'); await page.click('[data-key="bin-instrument"]'); await T.openLater(page, INSTR);
  ok(/sci\/mo/.test(await cardText(page, INSTR)) && near(await T.cashNow(page), cash2), 'Normal: it stays known, and nothing is charged again');
  // Another part is still "?".
  ok(await page.locator('.ask').count() > 0, 'Normal: the other instruments still say ?');
  // The bars, blockers and readiness stay free: the problem list is on screen with nothing paid for the other parts.
  ok(await page.locator('.stack').innerText().then(t => /PROBLEMS/.test(t)), 'Normal: the problem list is free');
  ok(await page.evaluate(id => StarlineUI.infoKnown(id, 'sheet') === true && StarlineUI.infoKnown(id, 'dossier') === true && StarlineUI.infoKnown('thermal-imager', 'dossier') === false, INSTR), 'StarlineUI.infoKnown: true for a paid part, false for one not asked about');

  // The rest of the flight: build it, launch, and read the ledger.
  await T.addParts(page, c.parts);
  if (viewport.width > 600) {
    ok(new RegExp('^' + c.parts.length + ' parts').test(await page.locator('.bench-label span').first().innerText()), 'Normal: every part of the design was added, paid for or not (adding is not research)');
    await page.click('.nav-row .btn.primary'); await waitHead(page, 'LAUNCH VEHICLE');
    await page.click(`[data-key="rocket-${c.launcher}"]`);
    await page.click('.nav-row .btn.primary'); await waitHead(page, 'READINESS');
    const fees = 0.08;
    await page.locator('.btn.big').click(); await waitHead(page, 'MISSION');
    await T.fly(page, 'first'); await waitHead(page, 'DEBRIEF');
    const rows = await page.$$eval('[data-key="cash-ledger"] .cb-row', es => es.map(e => ({ label: e.children[0].innerText, musd: parseFloat(e.dataset.musd) })));
    const eng = rows.filter(r => /ENGINEERS/.test(r.label));
    ok(eng.length === 1 && near(eng[0].musd, -fees), `debrief: one ENGINEERS line of -$0.08M in the cash ledger (${JSON.stringify(eng)})`);
    const sum = rows.slice(0, -1).reduce((t, r) => t + r.musd, 0);
    ok(near(sum, rows[rows.length - 1].musd), `debrief: the cash ledger still adds up (${sum.toFixed(3)} vs ${rows[rows.length - 1].musd})`);
    ok(/-\$0\.08M/.test(await page.locator('[data-key="cash-ledger"]').innerText()), 'debrief: the ENGINEERS amount reads -$0.08M');
    await page.screenshot({ path: path.join(shots, `v2paid-normal-${label}-debrief.png`) });
  }
  ok(errors.length === 0, label + ': no page errors' + (errors.length ? ' ' + errors.join(' | ') : ''));
  await b.close();
}

async function hard() {
  console.log('[Hard, 1280]');
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const errors = T.watchErrors(page);
  await T.noFonts(page);
  await page.goto(url); await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await page.reload();
  const topic = await toBuild(page, 'expert'), INSTR = instrumentOf(topic);
  await page.click('[data-key="bin-instrument"]'); await T.openLater(page, INSTR);
  const t = await cardText(page, INSTR), u = await slot(page, INSTR).innerText();
  ok(!/\bkg\b|\bW\b|sci\/mo/.test(t), 'Hard: the card shows no numbers: ' + t.slice(0, 80));
  ok(/SHEET \?/.test(u) && /SCIENCE \?/.test(u), 'Hard: SHEET ? and SCIENCE ? on the instrument card');
  ok(/\$/.test(t), 'Hard: the catalogue price still shows');
  await page.click('[data-key="bin-comms"]');
  const u2 = await slot(page, COMMS).innerText();
  ok(/SHEET \?/.test(u2) && !/SCIENCE \?/.test(u2), 'Hard: a radio has a sheet "?" and no science "?"');
  await page.hover(`[data-key="part-${COMMS}"]`); await page.waitForTimeout(200);
  const pv = await page.locator('#preview').innerText();
  ok(/SHEET \?/.test(pv) && /DOSSIER \?/.test(pv) && !/\bkg\b/.test(pv.replace(/ADD.*/, '')), 'Hard: the preview shows SHEET ? and DOSSIER ? and no mass');
  const cash0 = await T.cashNow(page);
  await page.click(`[data-key="ask-${COMMS}-sheet"]`); await page.waitForTimeout(200);
  ok(near(cash0 - await T.cashNow(page), 0.02), 'Hard: the sheet costs $0.02M');
  ok(/\bW\b|kg/.test(await cardText(page, COMMS)), 'Hard: after paying, the radio card shows its numbers');
  await page.screenshot({ path: path.join(shots, 'v2paid-hard-1280.png') });
  // A hidden group never blocks the design: the bars and the problem list work, and a part can be added unseen.
  await page.click(`[data-key="part-${COMMS}"]`);
  ok(await page.locator(`[data-key="part-${COMMS}"][aria-pressed="true"]`).count() === 1, 'Hard: a part can be added without asking');
  // Not enough cash: drive the cash down in the save, then ask.
  await page.evaluate(() => { const c = getCampaign(); c.treasury_musd = 0.03; saveCampaign(c); });
  await page.click('[data-key="bin-instrument"]'); await T.openLater(page, INSTR);
  await page.click(`[data-key="ask-${INSTR}-performance"]`); await page.waitForTimeout(150);
  ok(await page.locator('.ask-fail').count() === 1 && /not enough cash/i.test(await page.locator('.ask-fail').innerText()), 'Hard: with too little cash the ASK says so and buys nothing');
  ok(near(await page.evaluate(() => getComeback().cash_musd), 0.03), 'Hard: the cash is untouched');
  ok(errors.length === 0, 'Hard: no page errors' + (errors.length ? ' ' + errors.join(' | ') : ''));
  await b.close();
}

async function easy() {
  console.log('[Easy, 1280]');
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const errors = T.watchErrors(page);
  await T.noFonts(page);
  await page.goto(url); await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await page.reload();
  await toBuild(page, 'training');
  await page.click('[data-key="bin-instrument"]');
  ok(await asks(page) === 0, 'Easy: no ASK button, nothing is hidden');
  ok(/sci\/mo|m detail/.test(await page.locator('.shelf').innerText()), 'Easy: the instruments show their science a month');
  const first = await page.$$eval('.part:not(.locked)', es => es[0].dataset.key.slice(5));
  await page.hover(`[data-key="part-${first}"]`); await page.waitForTimeout(200);
  ok(await page.locator('#preview .ask, #preview [data-key^="unknown-"]').count() === 0, 'Easy: the preview has no "?"');
  ok(await page.evaluate(id => ['sheet', 'performance', 'dossier'].every(g => StarlineUI.infoKnown(id, g)), first), 'Easy: StarlineUI.infoKnown is true for every group');
  ok(errors.length === 0, 'Easy: no page errors' + (errors.length ? ' ' + errors.join(' | ') : ''));
  await b.close();
}

async function part1() {
  console.log('[Part 1, 1280]');
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const errors = T.watchErrors(page);
  await T.noFonts(page);
  await page.goto(url); await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await page.reload();
  await page.click('[data-key="part1-go"]'); await T.throughBeats(page); await waitHead(page, 'BASE MAP');
  await page.click('[data-key="blip-build"]'); await waitHead(page, 'BUILD');
  await page.click('[data-key="bin-instrument"]');
  ok(await asks(page) === 0 && await page.locator('[data-key^="unknown-"]').count() === 0, 'Part 1: no "?" and no ASK button');
  ok(await page.evaluate(() => ['sheet', 'performance', 'dossier'].every(g => StarlineUI.infoKnown('cosmic-ray-counter', g))), 'Part 1: StarlineUI.infoKnown is true');
  ok(await page.locator('[data-key="part-cosmic-ray-counter"]').innerText().then(t => /kg/.test(t)), 'Part 1: the card shows its mass');
  ok(errors.length === 0, 'Part 1: no page errors' + (errors.length ? ' ' + errors.join(' | ') : ''));
  await b.close();
}

(async () => {
  await normal({ width: 1280, height: 900 }, '1280');
  await hard();
  await easy();
  await part1();
  await normal({ width: 390, height: 844 }, '390');
  done();
})().catch(e => { console.error(e); process.exit(1); });
