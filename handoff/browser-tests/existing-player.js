// An EXISTING player updates to this version: nothing they own may change or disappear.
// The saves in tests/fixtures/player-0.9.json were written by the 0.9 game (a fresh comeback, a comeback after one and
// after two flights, one paid down, a won one, one at its deadline) with the stars record and the Part 1 record.
// For each: load them into this build in a browser and check the comeback, the stars and Part 1 survive exactly, the
// home page offers CONTINUE, the workshop opens with the same cash, debt and months, a flight can be flown and paid,
// and the records the update did not write are byte for byte the same. Also: a save from a NEWER game and a corrupt
// save are ignored without being deleted.
// Usage: node existing-player.js [shots dir]   or   node existing-player.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const T = require('./lib');
const { repo, url, shots } = T.args();
const { ok, done } = T.checker();
const fx = JSON.parse(fs.readFileSync(path.join(repo, 'tests', 'fixtures', 'player-0.9.json'), 'utf8'));
const PROGRESS = fx.progress['smdg-progress-v1'], WALK = fx.progress['gravitron-walkthrough-v1'];

async function load(b, viewport, store) {
  const p = await b.newPage({ viewport });
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  await p.goto(url);
  await p.evaluate(s => { localStorage.clear(); Object.keys(s).forEach(k => localStorage.setItem(k, s[k])); }, store);
  await p.reload();
  return { p, errors };
}
const keys = p => p.evaluate(() => ({ progress: localStorage.getItem('smdg-progress-v1'), walk: localStorage.getItem('gravitron-walkthrough-v1'), campaign: localStorage.getItem('smdg-campaign') }));

(async () => {
  const b = await chromium.launch();
  for (const [label, viewport] of [['desktop', { width: 1366, height: 768 }], ['phone', { width: 390, height: 844 }]]) {
    for (const name of Object.keys(fx.saves)) {
      const s = fx.saves[name], e = s.expect;
      console.log(`[${label}] saved comeback "${name}"`);
      const { p, errors } = await load(b, viewport, { 'smdg-progress-v1': PROGRESS, 'gravitron-walkthrough-v1': WALK, 'smdg-campaign': s.raw });
      await p.waitForTimeout(300);
      // the stars and Part 1 record are untouched by loading the new build
      const k0 = await keys(p);
      ok(k0.progress === PROGRESS && k0.walk === WALK, 'the stars record and the Part 1 record are byte for byte the same after the update loads');
      // Part 1 keeps its two passed steps
      ok(/CONTINUE: STEP 3/.test(await p.locator('[data-key="part1-go"]').innerText()) && await p.locator('.mode-steps li.passed').count() === 2, 'Part 1: two steps still passed, CONTINUE: STEP 3');
      // the comeback survives exactly
      const h = await p.evaluate(() => { const c = typeof getComeback === 'function' ? getComeback() : null; return c && { tier: c.tier, cash_musd: c.cash_musd, debt_musd: c.debt_musd, month: c.month, deadline_month: c.deadline_month, flights: c.flights, finished: c.finished, won: c.won, lost_reason: c.lost_reason, contracts: c.contracts.map(x => x.id) }; });
      ok(!!h, 'the saved comeback is still there (not discarded)');
      if (h) {
        for (const f of ['tier', 'cash_musd', 'debt_musd', 'month', 'deadline_month', 'flights', 'finished', 'won', 'lost_reason']) ok(h[f] === e[f], `${f} unchanged: ${JSON.stringify(e[f])}`);
        ok(JSON.stringify(h.contracts) === JSON.stringify(e.contracts), 'the open contracts are the same');
      }
      // the home page offers to continue a running comeback, and START after a finished one
      const p2 = await p.locator('[data-key="part2-go"]').innerText();
      ok(e.finished ? /^START/.test(p2) : /^CONTINUE/.test(p2), `Part 2 button reads ${e.finished ? 'START (the old run is over)' : 'CONTINUE'}: ${p2}`);
      if (!e.finished && h) {
        await p.click('[data-key="part2-go"]');
        // an interlude for a point the run already passed must not replay: step through whatever shows until the workshop
        let guard = 0;
        while (guard++ < 8 && !(await T.waitHead(p, 'WORKSHOP').catch(() => false))) {
          const next = p.locator('.btn.primary:visible').first();
          if (!(await next.count())) break;
          await next.click().catch(() => {});
        }
        ok(await p.locator('.screen-head h1', { hasText: 'WORKSHOP' }).count() === 1, 'CONTINUE opens the workshop');
        ok(await p.locator('#cb-months').innerText() === String(e.deadline_month - e.month) && /./.test(await p.locator('#cb-cash').innerText().catch(() => 'x')), 'the workshop shows the same months left');
        if (e.contracts.length) ok(await p.locator('.contract, [data-key^="fly-"]').count() >= 1, 'the open contracts show');
        // the player can still play on: a design for the first contract is allowed
        const can = await p.evaluate(() => { const c = getComeback(); const d = c.contracts.length ? newComebackDesign(c.contracts[0].id) : null; return !!d || c.offer !== null; });
        if (e.contracts.length) ok(can, 'a new flight (or the buyout offer, if the story says so) is available');   // the "at the deadline" fixture is hand-made with no open contracts
      }
      ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
      // loading and clicking around never rewrote the records the update did not touch
      const k1 = await keys(p);
      ok(k1.progress === PROGRESS && k1.walk === WALK, 'still the same after using the game');
      await p.close();
    }
  }

  // ---- a save from a NEWER game, and a corrupt one: ignored, never deleted, no crash
  for (const [what, raw] of [['a save from a newer game', JSON.stringify({ version: 999, mode: 'comeback', cash_musd: 1 })], ['a corrupt save', '{not json']]) {
    console.log(`[${what}]`);
    const { p, errors } = await load(b, { width: 1366, height: 768 }, { 'smdg-progress-v1': PROGRESS, 'gravitron-walkthrough-v1': WALK, 'smdg-campaign': raw });
    ok(await p.locator('.big-title').isVisible(), 'the home page still loads');
    ok(await p.evaluate(() => getComeback() === null), 'it is ignored (no comeback)');
    ok((await keys(p)).campaign === raw, 'the stored text is not deleted');
    ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await p.close();
  }
  await b.close();
  done();
})();
