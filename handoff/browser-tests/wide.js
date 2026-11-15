const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('file:///home/user/Hackstreet_Bros_Satellite/index.html'); await p.waitForTimeout(1500);
  for (const step of ['tier-training','obj-sea-ice']) { await p.click(`[data-key="${step}"]`); }
  await p.click('.nav-row .btn.primary'); await p.click('[data-key="orbit-sso"]'); await p.click('.nav-row .btn.primary');
  for (const [bin, part] of [['instrument','sar-radar'],['power','solar-large'],['comms','radio-xband'],['computer','obc-basic']]) { await p.click(`[data-key="bin-${bin}"]`); await p.click(`[data-key="part-${part}"]`); }
  await p.click('.nav-row .btn.primary'); await p.click('[data-key="rocket-small"]'); await p.click('.nav-row .btn.primary');
  console.log(await p.evaluate(() => { const W = window.innerWidth; return [document.documentElement.scrollWidth, W, [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > W + 1).slice(0, 8).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right) + ' ' + (e.textContent || '').slice(0, 40))]; }));
  await b.close();
})();
