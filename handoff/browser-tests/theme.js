// The era theme: Part 1 (1958) looks like a worn field notebook, Part 2 (today) like the clean console, the home page keeps its own.
// A tour of every screen of both parts (home, the story beats, the base map, the five places, the mission, the debrief, the
// epilogue, the picker, the workshop, the ending) checking on each one:
//   - body and html carry the right data-era ("home", "1958" or "today"),
//   - the main text and every enabled button meet 4.5:1, computed from the real rendered colours (the text colour against the
//     first opaque background behind it),
//   - no sideways scroll, and no text sticking out of the box it sits in,
//   - the 3D art took the era's palette (the 1958 key light and palette reach the render), and a page with the fonts blocked works.
// Run twice: with the fonts blocked (the default, like the other tests; the Courier New fallback) and, with FONTS=1, with the
// Google Fonts loaded when the network allows. THEME_VIEWS=1366x768,390x844 picks the window sizes (default: those two);
// THEME_SHOTS=1 saves a screenshot of every screen into the shots dir.
// Usage: node theme.js [shots dir]   or   node theme.js <repo dir> <shots dir>
const { chromium } = require('playwright');
const path = require('path');
const T = require('./lib');
const { url, shots } = T.args();
const { ok, done } = T.checker();
const { waitHead } = T;

const VIEWS = (process.env.THEME_VIEWS || '1366x768,390x844').split(',').map(v => v.split('x').map(Number));
const KEY = 'smdg-campaign';

// In the page: every visible, enabled piece of text against the first opaque background behind it.
function scan() {
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const rgba = s => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const a = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [a[0], a[1], a[2], a.length > 3 ? a[3] : 1]; };
  const ratio = (f, b) => { const x = lum(f), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = el => {
    // blend the translucent layers down to an opaque colour (the page's own background colour is the last one)
    let layers = [];
    for (let n = el; n; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 0.99) break; }
    }
    let base = [0, 0, 0];
    for (let i = layers.length - 1; i >= 0; i--) { const c = layers[i]; base = [0, 1, 2].map(k => c[k] * c[3] + base[k] * (1 - c[3])); }
    return base;
  };
  const visible = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]'); };
  const out = { low: [], clipped: [], n: 0 };
  const seen = new Set();
  document.querySelectorAll('body *').forEach(el => {
    if (el.closest('svg, canvas, .sr-only, script, style') || !visible(el)) return;
    const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.nodeValue.trim()).map(n => n.nodeValue.trim()).join(' ');
    if (!own) return;
    if (el.disabled || el.closest('button:disabled, .locked, [aria-disabled="true"]')) return;   // a greyed-out control is exempt
    const cs = getComputedStyle(el);
    const fg = rgba(cs.color); if (!fg) return;
    const bg = bgOf(el);
    const fgBlend = [0, 1, 2].map(k => fg[k] * fg[3] + bg[k] * (1 - fg[3]));
    const r = ratio(fgBlend, bg);
    out.n++;
    if (r < 4.5) { const k = el.tagName + '.' + (el.className && el.className.baseVal === undefined ? el.className : '') + ' "' + own.slice(0, 24) + '"'; if (!seen.has(k)) { seen.add(k); out.low.push(k + ' ' + r.toFixed(2)); } }
  });
  // text sticking out sideways of its own box, or of the window
  document.querySelectorAll('body *').forEach(el => {
    if (el.closest('svg, canvas, .sr-only') || !visible(el)) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'inline') return;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());
    if (!own) return;
    if (el.scrollWidth > el.clientWidth + 1 && !/scroll|auto/.test(cs.overflowX)) out.clipped.push(el.tagName + '.' + el.className + ' ' + el.scrollWidth + '>' + el.clientWidth + ' "' + el.textContent.trim().slice(0, 24) + '"');
    else if (el.getBoundingClientRect().right > innerWidth + 1) out.clipped.push(el.tagName + '.' + el.className + ' right ' + Math.round(el.getBoundingClientRect().right) + ' "' + el.textContent.trim().slice(0, 24) + '"');
  });
  return out;
}

async function tour(viewport, fontsLabel) {
  const [W, H] = viewport, label = `${W}x${H}${fontsLabel}`;
  console.log(`[${label}]`);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
  const errors = T.watchErrors(p);
  await T.noFonts(p);
  await p.goto(url); await p.evaluate(() => localStorage.clear());
  await p.evaluate(() => localStorage.setItem('gravitron-walkthrough-v1', JSON.stringify({ done: { 1: 1, 2: 1 } })));
  await p.reload(); await p.waitForTimeout(300);
  const eras = [];
  // The home page keeps the console look the home-page task owns: its era and layout are checked, its colours are not here.
  const visit = async (name, era) => {
    await p.waitForTimeout(120);
    const got = await p.evaluate(() => [document.body.dataset.era, document.documentElement.dataset.era]);
    ok(got[0] === era && got[1] === era, `${name}: data-era is "${era}"` + (got[0] === era && got[1] === era ? '' : ` (body "${got[0]}", html "${got[1]}")`));
    eras.push(name);
    const r = await p.evaluate(scan);
    if (era === 'home') r.low = [];
    ok(r.low.length === 0, `${name}: ${r.n} pieces of text, all at 4.5:1 or more` + (r.low.length ? ' | LOW: ' + r.low.slice(0, 5).join(' / ') : ''));
    ok(r.clipped.length === 0, `${name}: no text sticks out of its box or the window` + (r.clipped.length ? ' | ' + r.clipped.slice(0, 5).join(' / ') : ''));
    ok(await T.noScroll(p), `${name}: no sideways scroll`);
    if (process.env.THEME_SHOTS) await p.screenshot({ path: path.join(shots, `theme-${label}-${eras.length}-${name.replace(/\W+/g, '-')}.png`), fullPage: true });
  };

  // ---- home, then Part 1 (steps 1 and 2 done: the tour takes step 3, where nothing is preset)
  await visit('home', 'home');
  await p.click('[data-key="part1-go"]');
  await p.locator('.intro').waitFor({ timeout: 5000 });
  await visit('p1 story beat', '1958');
  await T.throughBeats(p);
  ok(await waitHead(p, 'BASE MAP'), 'p1: the base map');
  await visit('p1 map', '1958');
  await p.click('[data-key="blip-briefing"]'); await waitHead(p, 'BRIEFING'); await visit('p1 briefing', '1958');
  await p.click('[data-key="obj-radiation"]'); await p.click('.nav-row .btn.primary'); await waitHead(p, 'ORBIT'); await visit('p1 orbit', '1958');
  await p.click('[data-key="orbit-leo"]'); await p.click('.nav-row .btn.primary'); await waitHead(p, 'BUILD');
  await T.addParts(p, T.WALK[3].parts);
  await p.mouse.move(0, 0); await visit('p1 build', '1958');
  await p.click('.nav-row .btn.primary'); await waitHead(p, 'LAUNCH VEHICLE'); await p.click('[data-key="rocket-vanguard-rocket"]'); await visit('p1 launch vehicle', '1958');
  await p.click('.nav-row .btn.primary'); await waitHead(p, 'READINESS'); await visit('p1 readiness', '1958');
  await p.locator('.btn.big').click(); await waitHead(p, 'MISSION'); await visit('p1 mission', '1958');
  await T.fly(p, 'first'); await visit('p1 debrief', '1958');
  // the 3D art took the era: the 1958 palette and light are on the page (what the engine reads on every draw)
  const lp = await p.evaluate(() => ({ key: getComputedStyle(document.documentElement).getPropertyValue('--lp-light-key').trim(), sea: typeof LowPoly === 'object' ? LowPoly.colorOf('sea', document.body) : null }));
  ok(/^#[0-9a-f]{6}$/i.test(lp.key) && (lp.sea === null || lp.sea === '#3f6a73'), `p1: the 3D art has the 1958 light (${lp.key}) and palette (sea ${lp.sea})`);
  // the epilogue (after step 3), then Part 2's picker
  await p.click('[data-key="walk-next"]'); await p.locator('.intro').waitFor({ timeout: 5000 }); await visit('p1 epilogue', '1958');
  await T.throughBeats(p);   // the last beat's button is OPEN THE BOX
  await p.locator('[data-key="end-continue"]').waitFor({ timeout: 8000 }); await visit('p1 the box ending', '1958');
  await p.click('[data-key="end-continue"]');   // CONTINUE TO PART 2
  await p.locator('.cb-levels').waitFor({ timeout: 5000 }); await visit('p2 picker', 'today');

  // ---- Part 2
  await p.click('[data-key="level-standard"]'); await p.locator('.intro').waitFor({ timeout: 5000 }); await visit('p2 story beat', 'today');
  await T.throughBeats(p); await waitHead(p, 'WORKSHOP'); await visit('p2 workshop', 'today');
  await p.click('[data-key="fly-solar"]'); await waitHead(p, 'BASE MAP'); await visit('p2 map', 'today');
  await p.click('[data-key="blip-orbit"]'); await waitHead(p, 'ORBIT'); await visit('p2 orbit', 'today');
  await p.click('[data-key="orbit-leo"]'); await p.click('.nav-row .btn.primary'); await waitHead(p, 'BUILD');
  await T.addParts(p, T.CONTRACT.solar.parts); await p.mouse.move(0, 0); await visit('p2 build', 'today');
  await p.click('.nav-row .btn.primary'); await waitHead(p, 'LAUNCH VEHICLE'); await p.click(`[data-key="rocket-${T.CONTRACT.solar.launcher}"]`); await visit('p2 launch vehicle', 'today');
  await p.click('.nav-row .btn.primary'); await waitHead(p, 'READINESS'); await visit('p2 readiness', 'today');
  await p.locator('.btn.big').click(); await waitHead(p, 'MISSION'); await visit('p2 mission', 'today');
  await T.fly(p, 'first'); await visit('p2 debrief', 'today');
  const lp2 = await p.evaluate(() => typeof LowPoly === 'object' ? LowPoly.colorOf('sea', document.body) : null);
  ok(lp2 === null || lp2 === '#2b5f8a', `p2: the 3D art keeps its crisp default palette (sea ${lp2})`);
  await p.click('[data-key="debrief-workshop"]'); await waitHead(p, 'WORKSHOP');
  // a win: enough cash to pay it all, then the ending
  await p.evaluate(key => { const c = JSON.parse(localStorage.getItem(key)); c.treasury_musd = c.debt_musd + 1; localStorage.setItem(key, JSON.stringify(c)); }, KEY);
  await p.reload(); await p.waitForTimeout(300);
  await p.click('[data-key="part2-go"]'); await waitHead(p, 'WORKSHOP');
  await p.click('[data-key="pay-all"]'); await waitHead(p, 'WORKSHOP IS YOURS'); await visit('p2 ending', 'today');
  await p.click('[data-key="end-home"]'); await p.locator('.title').waitFor({ timeout: 5000 }); await visit('home again', 'home');
  ok(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' / ') : ''));
  await b.close();
}

(async () => {
  for (const v of VIEWS) await tour(v, process.env.FONTS ? ' fonts' : ' no-fonts');
  done();
})();
