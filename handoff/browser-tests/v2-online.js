// The online features (SPEC.md, "Online features"): the off switch, the home row, the leaderboard and the 1v1 duel.
//   A. From a file: the LEADERBOARD and DUEL buttons are disabled with the reason, no request to a server leaves the page
//      (even with an endpoint set), the home page still fits the first screen at 1366x768 and 390 wide, and no console errors.
//   B. With ?offline=1 on a public-looking address: off too, no request.
//   C. On a public-looking address (https://gravitron.test, served from the repo with the real server/server.js behind
//      https://api.gravitron.test): the leaderboard takes a score from the ending screen, and two players run a duel
//      (create, join by code, the same job and cash, one flight each, SEND RESULT, the same winner on both screens), and
//      the duel leaves the stars record and the comeback save alone.
// Usage: node v2-online.js [shots dir]   or   node v2-online.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const T = require('./lib');
const { repo, url, shots } = T.args();
const { ok, done } = T.checker();

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const GAME = 'https://gravitron.test', API = 'https://api.gravitron.test';
const BUS = [['cubesat-12u', 'structure'], ['spin-stabilised', 'attitude'], ['command-timer', 'computer'], ['radio-uhf', 'comms'], ['solar-small', 'power'], ['mercury-battery', 'power']];
const INSTRUMENT = { radiation: 'cosmic-ray-counter', solar: 'solar-xray-photometer', weather: 'vidicon-camera' };

// A fake public address: the game's files come from the repo, data/online.js gets an endpoint, and the API goes to the real server.
async function publicContext(browser, viewport, serverPort) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.route(/(services\.swpc\.noaa\.gov|eonet\.gsfc\.nasa\.gov|cwfis\.cfs\.nrcan\.gc\.ca)/, r => r.abort());
  await ctx.route(GAME + '/**', async route => {
    const u = new URL(route.request().url());
    let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.join(repo, rel);
    if (!file.startsWith(repo) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'nope' });
    let body = fs.readFileSync(file);
    if (rel === 'data/online.js') body = body.toString('utf8').replace('endpoint: ""', 'endpoint: "' + API + '"').replace('poll_ms: 2000', 'poll_ms: 300');
    await route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body });
  });
  await ctx.route(API + '/**', route => new Promise(resolve => {
    const req = route.request(), u = new URL(req.url());
    const fwd = http.request({ host: '127.0.0.1', port: serverPort, method: req.method(), path: u.pathname + u.search,
      headers: Object.assign({}, req.headers(), { host: '127.0.0.1' }) }, res => {
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => { route.fulfill({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }).then(resolve, resolve); });
    });
    fwd.on('error', () => route.abort().then(resolve, resolve));
    if (req.postData()) fwd.write(req.postData());
    fwd.end();
  }));
  return ctx;
}
function watchApi(page) {
  const seen = [];
  // Any request that is not the page's own files, the fonts or the open-data services is the game talking to a server.
  const known = /^(file:|data:|blob:|about:)|fonts\.(googleapis|gstatic)\.com|services\.swpc\.noaa\.gov|eonet\.gsfc\.nasa\.gov|cwfis\.cfs\.nrcan\.gc\.ca|^https:\/\/gravitron\.test\//;
  page.on('request', r => { if (!known.test(r.url())) seen.push(r.method() + ' ' + r.url()); });
  return seen;
}
const fits = (p) => p.evaluate(() => {
  const b = document.querySelector('.online-row'), r = b ? b.getBoundingClientRect() : null;
  const m = document.querySelector('.title-main').getBoundingClientRect();
  return { scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, scrollH: document.documentElement.scrollHeight, innerH: window.innerHeight,
    rowBottom: r ? Math.round(r.bottom) : null, mainBottom: Math.round(m.bottom), rowRight: r ? Math.round(r.right) : null };
});

(async () => {
  const b = await chromium.launch();

  // ---------------------------------------------------------------- A. from a file
  for (const [label, viewport] of [['1366x768', { width: 1366, height: 768 }], ['390', { width: 390, height: 844 }]]) {
    console.log(`[A. from a file, ${label}]`);
    const p = await b.newPage({ viewport });
    const errors = T.watchErrors(p);
    await T.noFonts(p);
    const seen = watchApi(p);
    await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
    const lb = p.locator('[data-key="online-leaderboard"]'), du = p.locator('[data-key="online-duel"]');
    ok(await lb.isVisible() && await du.isVisible(), 'the LEADERBOARD and DUEL buttons are on the home page');
    ok(await lb.isDisabled() && await du.isDisabled(), 'both are disabled');
    const reason = await p.locator('[data-key="online-reason"]').innerText();
    ok(/ONLINE OFF/.test(reason) && /file/i.test(reason) && reason.split(/\s+/).length <= 8, 'one short line says why: "' + reason + '"');
    ok(await p.locator('.mode-card').count() === 2, 'the two mode cards are still there');
    const f = await fits(p);
    ok(f.scrollW <= f.innerW, 'no sideways scroll');
    ok(f.rowBottom <= f.innerH && f.mainBottom <= f.innerH, `the home page still fits the first screen (row bottom ${f.rowBottom}, content bottom ${f.mainBottom}, screen ${f.innerH})`);
    await p.screenshot({ path: path.join(shots, `online-home-file-${label}.png`) });
    // An endpoint is set, but the address is a file: still no request.
    await p.evaluate(() => { ONLINE.endpoint = 'https://dummy.invalid'; });
    const st = await p.evaluate(() => LiveData.onlineStatus());
    ok(st.on === false, 'a file with an endpoint set is still off: ' + st.reason);
    const calls = await p.evaluate(async () => [await LiveData.online.leaderboard('abcdefgh'), await LiveData.online.duelCreate({ id: 'abcdefgh', nickname: 'x' }),
      await LiveData.online.duelPoll('ABCD'), await LiveData.online.submitScore({ id: 'abcdefgh' })]);
    ok(calls.every(c => c.ok === false && c.reason), 'every call answers { ok: false, reason } without a server');
    await p.evaluate(() => { UI_HOME(); function UI_HOME() { StarlineUI.home(); } });
    ok(await p.locator('[data-key="online-leaderboard"]').isDisabled(), 'redrawing the home page keeps them disabled');
    // The Part 2 ending offers no SUBMIT SCORE while online is off.
    await p.evaluate(() => {
      newComeback('standard', 7);
      const c = getCampaign();
      c.finished = true; c.won = true; c.month = 10; c.deadline_month = 20; c.reputation = 22; c.debt_musd = 0;
      saveCampaign(c);
      showComebackEnding();
    });
    ok(await p.locator('[data-key="end-again"]').count() === 1 && await p.locator('[data-key="end-submit"]').count() === 0, 'the Part 2 ending shows no SUBMIT SCORE while online is off');
    await p.waitForTimeout(400);
    ok(seen.length === 0, 'no request to any server left the page' + (seen.length ? ': ' + seen.join(', ') : ''));
    ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await p.close();
  }

  // ---------------------------------------------------------------- the server behind the fake address
  const S = require(path.join(repo, 'server/server.js'));
  const dataFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gravitron-e2e-')), 'data.json');
  const srv = S.createServer({ allowOrigin: GAME, rateLimit: 100000, dataFile });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const viewport = { width: 1100, height: 800 };

  // ---------------------------------------------------------------- B. ?offline=1
  console.log('[B. ?offline=1 on a public address]');
  {
    const ctx = await publicContext(b, viewport, port);
    const p = await ctx.newPage();
    const errors = T.watchErrors(p);
    const seen = watchApi(p);
    await p.goto(GAME + '/index.html?offline=1');
    ok(await p.locator('[data-key="online-leaderboard"]').isDisabled() && await p.locator('[data-key="online-duel"]').isDisabled(), 'both buttons are disabled');
    ok(/offline/i.test(await p.locator('[data-key="online-reason"]').innerText()), 'the reason names the offline switch');
    await p.waitForTimeout(400);
    ok(seen.length === 0, 'no request to the server');
    ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await ctx.close();
  }

  // ---------------------------------------------------------------- C. on: the leaderboard
  console.log('[C. the leaderboard]');
  {
    const ctx = await publicContext(b, viewport, port);
    const p = await ctx.newPage();
    const errors = T.watchErrors(p);
    await p.goto(GAME + '/index.html');
    ok(await p.locator('[data-key="online-leaderboard"]').isEnabled() && await p.locator('[data-key="online-duel"]').isEnabled(), 'on a public address with a server set, the buttons are enabled');
    ok(await p.locator('[data-key="online-reason"]').count() === 0, 'no "off" line is shown');
    ok(await p.evaluate(() => localStorage.getItem('gravitron-player-v1')) === null, 'nothing is stored before the player opens an online screen');
    await p.click('[data-key="online-leaderboard"]');
    await p.locator('[data-key="lb-list"]').waitFor();
    await p.waitForFunction(() => /No scores yet/.test(document.querySelector('[data-key="lb-list"]').innerText), null, { timeout: 5000 });
    ok(/self-reported/i.test(await p.locator('.preset-note').innerText()), 'the screen says scores are self-reported');
    const player = await p.evaluate(() => JSON.parse(localStorage.getItem('gravitron-player-v1')));
    ok(player && /^[A-Za-z0-9_-]{8,64}$/.test(player.id), 'a random player id is kept in gravitron-player-v1');
    await p.click('[data-key="online-home"]');
    // a finished comeback: the ending offers SUBMIT SCORE
    await p.evaluate(() => {
      newComeback('standard', 7);
      const c = getCampaign();
      c.finished = true; c.won = true; c.month = 10; c.deadline_month = 20; c.reputation = 22; c.debt_musd = 0;
      c.missions = [{ id: 'm1-x', flight: 1, month: 5, year: 2026, objective: 'radiation', orbit: 'leo', stars: 3, science: 100, payout_musd: 5, spent_musd: 4, ended_early: false, contract: null }];
      saveCampaign(c);
      showComebackEnding();
    });
    const submit = p.locator('[data-key="end-submit"]');
    ok(await submit.count() === 1, 'the Part 2 ending has a SUBMIT SCORE button');
    const expected = await p.evaluate(() => getRunScore().score);
    ok(expected === 500 + 300 + 100 + 110, 'getRunScore says ' + expected);
    await p.screenshot({ path: path.join(shots, 'online-ending.png') });
    await submit.click();
    ok((await p.locator('[data-key="lb-run"]').innerText()).indexOf(expected.toLocaleString('en-US')) !== -1, 'the leaderboard screen shows this run\'s score');
    await p.click('[data-key="lb-submit"]');
    ok(/nickname/i.test(await p.locator('[data-key="lb-msg"]').innerText()), 'SUBMIT asks for a nickname first');
    await p.fill('[data-key="online-nick"]', 'Ajay Albert Orbital Extra');
    ok((await p.inputValue('[data-key="online-nick"]')).length === 16, 'the nickname box stops at 16 characters');
    await p.click('[data-key="lb-submit"]');
    await p.waitForFunction(() => /Sent/.test(document.querySelector('[data-key="lb-msg"]').innerText), null, { timeout: 5000 });
    await p.waitForFunction(() => document.querySelectorAll('[data-key="lb-row"]').length === 1, null, { timeout: 5000 });
    ok(/#1/.test(await p.locator('[data-key="lb-you"]').innerText()), 'your own rank is shown: ' + await p.locator('[data-key="lb-you"]').innerText());
    ok(/^\s*#?\d*\s*Ajay Albert Orbi\s/i.test(await p.locator('[data-key="lb-row"]').innerText()), 'the row shows the trimmed nickname');
    await p.screenshot({ path: path.join(shots, 'online-leaderboard.png') });
    ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
    // a dead server: a plain failure, play is not blocked
    await p.evaluate(() => { ONLINE.endpoint = 'https://nowhere.gravitron.test'; });
    await ctx.route('https://nowhere.gravitron.test/**', r => r.abort());
    await p.click('[data-key="online-home"]');
    await p.click('[data-key="online-leaderboard"]');
    await p.waitForFunction(() => /Server not reachable/.test(document.querySelector('[data-key="lb-list"]').innerText), null, { timeout: 8000 });
    ok(await p.locator('[data-key="lb-retry"]').count() === 1, 'a failure says "Server not reachable" and offers RETRY');
    await p.click('[data-key="online-home"]');
    ok(await p.locator('[data-key="part1-go"]').isEnabled(), 'play is not blocked');
    await ctx.close();
  }

  // ---------------------------------------------------------------- D. the duel, two players
  console.log('[D. the duel]');
  {
    const ctxH = await publicContext(b, viewport, port), ctxG = await publicContext(b, viewport, port);
    const H = await ctxH.newPage(), G = await ctxG.newPage();
    const errs = [T.watchErrors(H), T.watchErrors(G, /duel\/QQQQ/)];   // the unknown room is a 404 on purpose
    for (const p of [H, G]) await p.goto(GAME + '/index.html');
    // a stars record and no comeback: the duel must leave both as they are
    const record = JSON.stringify({ best_stars: { training: 2 }, best_score: { training: 50 }, best_stars_by_era: {} });
    for (const p of [H, G]) await p.evaluate(r => localStorage.setItem('smdg-progress-v1', r), record);

    await H.click('[data-key="online-duel"]');
    await H.click('[data-key="duel-create"]');
    ok(/nickname/i.test(await H.locator('[data-key="duel-msg"]').innerText()), 'CREATE ROOM asks for a nickname first');
    await H.fill('[data-key="online-nick"]', 'Host');
    await H.click('[data-key="duel-create"]');
    await H.locator('[data-key="duel-room-code"]').waitFor({ timeout: 5000 });
    const code = (await H.locator('[data-key="duel-room-code"]').innerText()).trim();
    ok(/^[A-Z]{4}$/.test(code), 'the host sees a four-letter code: ' + code);
    await H.screenshot({ path: path.join(shots, 'online-duel-room.png') });

    await G.click('[data-key="online-duel"]');
    await G.fill('[data-key="online-nick"]', 'Guest');
    await G.fill('[data-key="duel-code"]', 'zz');
    await G.click('[data-key="duel-join"]');
    ok(/4 letters/.test(await G.locator('[data-key="duel-msg"]').innerText()), 'a short code is refused on the page');
    await G.fill('[data-key="duel-code"]', 'QQQQ');
    await G.click('[data-key="duel-join"]');
    await G.waitForFunction(() => /No such room/i.test(document.querySelector('[data-key="duel-msg"]').innerText), null, { timeout: 5000 });
    ok(true, 'an unknown code says so');
    await G.fill('[data-key="duel-code"]', code.toLowerCase());
    await G.click('[data-key="duel-join"]');
    await G.locator('[data-key="duel-start"]').waitFor({ timeout: 5000 });
    await H.locator('[data-key="duel-start"]').waitFor({ timeout: 8000 });
    ok(true, 'the guest joins and the host moves on by itself');
    const facts = async p => (await p.locator('.online-room').innerText()).replace(/\s+/g, ' ');
    const fh = await facts(H), fg = await facts(G);
    ok(fh.replace(/AGAINST \w+/, '') === fg.replace(/AGAINST \w+/, ''), 'both players get the same topic, orbit and cash: ' + fg);
    await G.screenshot({ path: path.join(shots, 'online-duel-intro.png') });

    // Fly: the bus and the instrument for the topic the seed chose, the small rocket, launch, fast-forward, the debrief.
    async function playDuel(p, who) {
      const topic = await p.evaluate(() => { const t = document.querySelector('.online-room').innerText; const o = OBJECTIVES.filter(x => t.indexOf(x.name) !== -1)[0]; return o && o.id; });
      ok(!!INSTRUMENT[topic], who + ': the topic is one the duel offers: ' + topic);
      await p.click('[data-key="duel-start"]');
      ok(await T.waitHead(p, 'BASE MAP'), who + ': START opens the base map');
      await p.click('[data-key="blip-build"]');
      ok(await T.waitHead(p, 'BUILD'), who + ': topic and orbit are preset, so the way leads on to Build');
      for (const [part, bin] of BUS.concat([[INSTRUMENT[topic], 'instrument']])) {
        await p.click(`[data-key="bin-${bin}"]`);
        await p.click(`[data-key="part-${part}"]`);
      }
      await p.click('.nav-row .btn.primary'); ok(await T.waitHead(p, 'LAUNCH VEHICLE'), who + ': the Rocket Yard opens');
      await p.click('[data-key="rocket-small"]');
      await p.click('.nav-row .btn.primary'); ok(await T.waitHead(p, 'READINESS'), who + ': the Readiness review opens');
      await p.locator('.btn.big').click(); ok(await T.waitHead(p, 'MISSION'), who + ': the Mission screen opens');
      await T.fly(p, 'first');
      ok(await T.waitHead(p, 'DEBRIEF'), who + ': the Debrief opens');
    }
    await Promise.all([playDuel(H, 'host'), playDuel(G, 'guest')]);
    for (const p of [H, G]) {
      ok(await p.locator('[data-key="duel-send"]').count() === 1, 'the debrief offers SEND RESULT');
      ok(await p.locator('[data-key="redesign"]').count() === 0, 'a duel debrief has no REDESIGN (one flight each)');
    }
    await H.screenshot({ path: path.join(shots, 'online-duel-debrief.png') });
    await H.click('[data-key="duel-send"]');
    await H.waitForFunction(() => /Sent/.test(document.querySelector('[data-key="duel-result-msg"]').innerText), null, { timeout: 5000 });
    ok(await H.locator('[data-key="duel-outcome"]').count() === 0, 'the host waits: no verdict until the other result is in');
    await G.click('[data-key="duel-send"]');
    const outcome = async p => { await p.locator('[data-key="duel-outcome"]').waitFor({ timeout: 8000 }); return (await p.locator('[data-key="duel-outcome"]').innerText()).trim(); };
    const [oh, og] = [await outcome(H), await outcome(G)];
    ok((oh === 'YOU WIN' && og === 'YOU LOSE') || (oh === 'YOU LOSE' && og === 'YOU WIN') || (oh === 'TIE' && og === 'TIE'), 'both screens read the same winner: host "' + oh + '", guest "' + og + '"');
    ok(await H.locator('[data-key="duel-row"]').count() === 2 && await G.locator('[data-key="duel-row"]').count() === 2, 'both figures are shown once both are in');
    await G.screenshot({ path: path.join(shots, 'online-duel-verdict.png') });
    for (const [p, who] of [[H, 'host'], [G, 'guest']]) {
      const after = await p.evaluate(() => [localStorage.getItem('smdg-progress-v1'), localStorage.getItem('smdg-campaign')]);
      ok(after[0] === record, who + ': the stars record is exactly as it was');
      ok(after[1] === null, who + ': no comeback save was made');
    }
    await H.click('[data-key="duel-home"]');
    ok(await H.locator('[data-key="part1-go"]').isVisible(), 'HOME goes back to the home page');
    ok(errs.every(e => e.length === 0), 'no console errors' + errs.map(e => e.join(' / ')).join(''));
    await ctxH.close(); await ctxG.close();
  }

  srv.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
