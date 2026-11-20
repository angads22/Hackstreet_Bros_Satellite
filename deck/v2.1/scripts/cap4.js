// cap4.js: phone stills (home, build) and the Quick mode menu.
const R = require('./rec.js');
const T = require(R.GAME + '/handoff/browser-tests/lib.js');
const sleep = (p, ms) => p.waitForTimeout(ms);
(async () => {
  const s = await R.open({ name: 'phone', phone: true, scale: 2 });
  const p = s.page;
  await R.park(p);
  await R.still(p, 'phone', 'home');
  await p.tap('[data-key="part1-go"]');
  await p.locator('.intro').waitFor({ timeout: 4000 });
  await T.throughBeats(p);
  await T.waitHead(p, 'BASE MAP');
  await p.tap('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
  await sleep(p, 1500);
  await p.tap('[data-key="bin-structure"]'); await sleep(p, 500);
  for (let i = 0; i < 2; i++) { await p.tap('[data-key="part-explorer-body"]'); await sleep(p, 700); }
  await sleep(p, 900);
  await R.still(p, 'phone', 'build');
  console.log('phone text:', (await R.text(p)).slice(0, 200));
  await s.close();

  const d = await R.open({ name: 'quick', height: 800 });
  await d.page.click('[data-key="quick-go"]');
  await sleep(d.page, 1500); await R.park(d.page);
  await R.still(d.page, 'quick', 'poster');
  console.log('quick buttons:', (await R.buttons(d.page)).join(' | '));
  await d.close();
})().catch(e => { console.error('CAP4 ERROR', e); process.exit(1); });
