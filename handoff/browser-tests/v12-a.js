// v1.2 builder A, shell and chrome: the next bar (sticky, with a reason), no visible step title (the heading stays for screen
// readers, the minimap key names the step), the one merged line (speech with its face carrying the instruction), and the
// first-visit collapse. Part 1 and Part 2, at 1366x768, 1280x800 and 390 wide.
// Usage: node v12-a.js [shots dir]   or   node v12-a.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();

const SIZES = [{ w: 1366, h: 768 }, { w: 1280, h: 800 }, { w: 390, h: 844 }];

async function fresh(b, w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload();
  await T.seedRuns(p);
  return { p, errors };
}

// What the page shows about the shell now.
const shell = p => p.evaluate(() => {
  const r = n => { if (!n) return null; const b = n.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, bottom: b.bottom }; };
  const bar = document.querySelector('.nav-row.next-bar');
  const h1 = document.querySelector('.screen-head h1');
  const obj = document.getElementById('objective');
  const say = document.querySelector('.screen > .say');
  const cs = bar ? getComputedStyle(bar) : null;
  return {
    vh: window.innerHeight, docH: document.documentElement.scrollHeight, sideways: document.documentElement.scrollWidth > window.innerWidth,
    bar: r(bar), pos: cs && cs.position, primary: r(document.querySelector('.nav-row .btn.primary')),
    primaryDisabled: !!(document.querySelector('.nav-row .btn.primary') || {}).disabled,
    why: (document.querySelector('.next-why') || {}).innerText || '',
    h1: h1 ? { text: h1.textContent, box: r(h1.closest('.screen-head')), own: r(h1) } : null,
    obj: obj ? { text: obj.textContent, inDom: true, live: obj.getAttribute('aria-live'), box: r(obj), hidden: obj.hidden } : null,
    say: say ? { text: say.innerText.replace(/\s+/g, ' '), name: (say.querySelector('.say-name') || {}).textContent || '', portrait: !!say.querySelector('.portrait, svg.portrait, img.portrait, canvas'),
      doText: (say.querySelector('.say-do') || {}).textContent || '', top: r(say).y, bottom: r(say).bottom } : null,
    key: (document.querySelector('.minimap-key') || {}).innerText || '',
    hint: !document.getElementById('hint').hidden, helpBtn: !document.getElementById('help-btn').hidden,
    title: document.querySelectorAll('.screen-head h1').length
  };
});

async function checkStep(p, label, step, name, opts) {
  const s = await shell(p);
  console.log('  [' + label + '] bar bottom ' + (s.bar ? Math.round(s.bar.bottom) : '-') + ' of ' + s.vh + ', say ' + (s.say ? Math.round(s.say.top) + '-' + Math.round(s.say.bottom) : '-'));
  ok(!s.sideways, label + ': no sideways scroll');
  ok(s.bar && s.pos === 'sticky', label + ': the next bar is sticky');
  ok(s.bar && s.bar.bottom <= s.vh + 1 && (s.bar.bottom > s.vh - 12 || s.docH <= s.vh + 1), label + ': the bar sits at the bottom of the viewport, or at the end of a short page (' + (s.bar && Math.round(s.bar.bottom)) + ' of ' + s.vh + ', page ' + s.docH + ')');
  ok(s.primary && s.primary.bottom <= s.vh + 1 && s.primary.y >= 0 && s.primary.h >= 44, label + ': the next button is in view and at least 44 px tall');
  ok(!s.primaryDisabled || (opts && opts.disabled), label + ': the next button is not disabled' + (opts && opts.disabled ? ' (disabled: a choice is missing)' : ''));
  ok(s.h1 && new RegExp(name).test(s.h1.text) && s.h1.box.w <= 2 && s.h1.box.h <= 2 && s.h1.own.h > 0, label + ': the title is a 1 px heading for screen readers (' + (s.h1 && s.h1.text) + ')');
  ok(s.obj && s.obj.inDom && s.obj.live === 'polite' && /\S/.test(s.obj.text) && s.obj.box.w <= 2, label + ': #objective stays in the page, hidden, aria-live: ' + (s.obj && s.obj.text.slice(0, 50)));
  const instr = s.obj ? s.obj.text.replace(/^\s*OBJECTIVE:?\s*/, '').trim() : '';
  ok(s.say && s.say.portrait && s.say.doText.trim() === instr && instr.length > 0, label + ': one line, with the face, carries the instruction: ' + (s.say && s.say.doText.trim()));
  ok(new RegExp(step + '\\s*' + name.split(' ')[0] + '[\\s\\S]*MAP \\[M\\]').test(s.key.replace(/\n/g, ' ')) || new RegExp(name).test(s.key), label + ': the minimap key names the step: ' + s.key.replace(/\n/g, ' / '));
  ok(s.title === 1, label + ': one heading on the screen');
  return s;
}

async function part1(b, w, h) {
  const { p, errors } = await fresh(b, w, h);
  const tag = w + 'x' + h + '-p1';
  await p.click('[data-key="part1-go"]');
  await T.throughBeats(p);
  await T.waitHead(p, 'BASE MAP');
  await p.waitForTimeout(500);
  const mapS = await shell(p);
  ok(mapS.h1 && /BASE MAP/.test(mapS.h1.text) && mapS.h1.box.h <= 2, tag + ': the base map keeps its name as a 1 px heading');
  ok(!mapS.sideways, tag + ': map: no sideways scroll');
  await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD');
  await p.waitForTimeout(1400);
  let s = await checkStep(p, tag + ' build', 3, 'BUILD');
  ok(/NO GO TO FIX/.test(s.why) && !s.primaryDisabled, tag + ': build with nothing built: a reason beside the button, the button still works: "' + s.why + '"');
  await p.screenshot({ path: shots + '/v12a-' + tag + '-build.png' });
  // Scrolled to the very bottom the bar is below the content, not on top of it.
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(200);
  const end = await p.evaluate(() => {
    const bar = document.querySelector('.nav-row.next-bar').getBoundingClientRect();
    const kids = [...document.querySelectorAll('.workshop > *')].map(n => n.getBoundingClientRect().bottom);
    return { barTop: bar.top, last: Math.max(...kids), foot: document.querySelector('.foot').getBoundingClientRect().top };
  });
  ok(end.barTop >= end.last - 40 || end.last <= end.barTop + 2, tag + ': at the end of the page the bar covers no content (bar top ' + Math.round(end.barTop) + ', content ends ' + Math.round(end.last) + ')');
  await p.evaluate(() => window.scrollTo(0, 0));
  // Leaving and coming back: the speech collapses to its first sentence; the instruction stays.
  await p.click('.nav-row .btn:not(.primary)'); await T.waitHead(p, 'BASE MAP');
  await p.click('[data-key="blip-build"]'); await T.waitHead(p, 'BUILD'); await p.waitForTimeout(900);
  const again = await p.evaluate(() => { const sp = document.querySelector('.screen > .say .say-text p'); return { text: sp && sp.textContent, full: sp && sp.getAttribute('data-full'), doText: (document.querySelector('.say-do') || {}).textContent }; });
  ok(again.text && (!again.full || again.full.indexOf(again.text) === 0 && again.full.length > again.text.length) && /\S/.test(again.doText || ''), tag + ': a second visit: the speech is its first sentence ("' + again.text + '"), the instruction stays');
  // The hint stays behind the "?" button (Part 1 shows its tutorial line on the first visit only).
  const hint = await p.evaluate(() => ({ btn: !document.getElementById('help-btn').hidden, box: !document.getElementById('hint').hidden }));
  ok(hint.btn && !hint.box, tag + ': on a later visit the hint is behind the "?" button');
  await p.click('#help-btn');
  ok(!(await p.evaluate(() => document.getElementById('hint').hidden)), tag + ': "?" opens the hint');
  // The other design steps: Briefing (preset) and the Launch Pad.
  await p.click('.nav-row .btn:not(.primary)'); await T.waitHead(p, 'BASE MAP');
  ok(await p.locator('.nav-row.next-bar').count() === 0, tag + ': the map has no next bar');
  ok(errors.length === 0, tag + ': no errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await p.context().close();
}

async function part2(b, w, h, level) {
  const { p, errors } = await fresh(b, w, h);
  const tag = w + 'x' + h + '-p2-' + level;
  await p.click('[data-key="part2-go"]');
  await p.click('[data-key="level-' + level + '"]');
  await T.throughBeats(p);
  await T.waitHead(p, 'WORKSHOP');
  await p.waitForTimeout(600);
  const wk = await shell(p);
  ok(wk.h1 && /WORKSHOP/.test(wk.h1.text) && wk.h1.box.h > 10, tag + ': the Part 2 workshop keeps its visible title');
  ok(await p.locator('.nav-row.next-bar').count() === 0, tag + ': the workshop buttons are not a next bar');
  await p.click('[data-key="fly-wildfire"]'); await T.waitHead(p, 'BASE MAP');
  await p.click('[data-key="blip-briefing"]'); await T.waitHead(p, 'BRIEFING'); await p.waitForTimeout(500);
  await checkStep(p, tag + ' briefing', 1, 'BRIEFING');
  await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'ORBIT'); await p.waitForTimeout(500);
  const o = await checkStep(p, tag + ' orbit', 2, 'ORBIT', { disabled: true });
  ok(o.primaryDisabled && /\S/.test(o.why), tag + ': orbit: no orbit chosen yet, the button waits and says why: "' + o.why + '"');
  await p.click('[data-key="orbit-leo"]');
  await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'BUILD'); await p.waitForTimeout(1200);
  const s = await checkStep(p, tag + ' build', 3, 'BUILD');
  await p.screenshot({ path: shots + '/v12a-' + tag + '-build.png' });
  ok(/NO GO TO FIX/.test(s.why), tag + ': an empty Build shows its reason: "' + s.why + '"');
  // The next button works with a NO GO standing (a reason, not a lock): it goes on to the next step.
  await p.click('.nav-row .btn.primary'); await T.waitHead(p, 'LAUNCH VEHICLE'); await p.waitForTimeout(500);
  await checkStep(p, tag + ' rocket yard', 4, 'LAUNCH VEHICLE');
  await p.screenshot({ path: shots + '/v12a-' + tag + '-rocket.png' });
  ok(errors.length === 0, tag + ': no errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await p.context().close();
}

(async () => {
  const b = await chromium.launch();
  for (const z of SIZES) {
    console.log('[' + z.w + 'x' + z.h + ' Part 1]');
    await part1(b, z.w, z.h);
    console.log('[' + z.w + 'x' + z.h + ' Part 2 (Normal)]');
    await part2(b, z.w, z.h, 'standard');
  }
  await b.close();
  done();
})().catch(e => { console.log('FAIL ' + e.stack); process.exit(1); });
