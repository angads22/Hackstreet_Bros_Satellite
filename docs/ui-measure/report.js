// docs/ui-measure/report.js: turns measure.js output into markdown tables.
//   node report.js before.json [after.json]      (with two files, each cell reads "before -> after")
const fs = require('fs');
const [A, B] = process.argv.slice(2).map(f => f && JSON.parse(fs.readFileSync(f, 'utf8')));
const cell = (a, b) => (b === undefined || b === null ? String(a) : String(a) === String(b) ? String(a) : `${a} -> ${b}`);
const VPS = A.runs.map(r => r.viewport);
const run = (X, vp) => X && X.runs.find(r => r.viewport === vp);
const table = (head, rows) => ['| ' + head.join(' | ') + ' |', '| ' + head.map(() => '---').join(' | ') + ' |'].concat(rows.map(r => '| ' + r.join(' | ') + ' |')).join('\n');
const states = Object.keys(A.runs[0].states);

console.log('### Scroll depth (page height / viewport height; 1.0 means no scrolling)\n');
console.log(table(['screen', ...VPS], states.map(s => [s, ...VPS.map(v => cell(run(A, v).states[s].ratio, run(B, v) && run(B, v).states[s].ratio))])));

console.log('\n### Always-visible elements that are NOT on screen without scrolling\n');
const rows = [];
for (const s of states) for (const v of VPS) {
  const miss = (X) => X ? Object.entries(run(X, v).states[s].keys).filter(([, k]) => !k.onScreen).map(([n]) => n) : null;
  const a = miss(A), b = miss(B);
  if (a.length || (b && b.length)) rows.push([s, v, a.join(', ') || '-', b ? (b.join(', ') || '-') : '']);
}
console.log(table(B ? ['screen', 'viewport', 'before', 'after'] : ['screen', 'viewport', 'off screen'], B ? rows : rows.map(r => r.slice(0, 3))));

console.log('\n### Task cost (scrolls / clicks / hovers)\n');
const tasks = Object.keys(A.runs[0].tasks);
console.log(table(['task', ...VPS], tasks.map(t => [t, ...VPS.map(v => { const x = run(A, v).tasks[t], y = run(B, v) && run(B, v).tasks[t]; const f = o => `${o.scrolls}/${o.clicks}/${o.hovers}` + (o.unreachable ? ` (${o.unreachable} stayed covered)` : ''); return cell(f(x), y && f(y)); })])));

console.log('\n### Words on screen at scroll 0, and where the first control sits\n');
console.log(table(['screen', ...VPS.map(v => v + ' words')], states.map(s => [s, ...VPS.map(v => cell(run(A, v).states[s].wordsInView, run(B, v) && run(B, v).states[s].wordsInView))])));

console.log('\n### Targets under the minimum size (24 px desktop, 44 px touch) and overlaps\n');
console.log(table(['screen', ...VPS.map(v => v + ' small targets'), ...VPS.map(v => v + ' overlaps')],
  states.map(s => [s, ...VPS.map(v => cell(run(A, v).states[s].smallTargets, run(B, v) && run(B, v).states[s].smallTargets)), ...VPS.map(v => cell(run(A, v).states[s].overlaps, run(B, v) && run(B, v).states[s].overlaps))])));
const ex = new Set(); A.runs.forEach(r => Object.values(r.states).forEach(st => st.smallExamples.forEach(e => ex.add(r.viewport + ': ' + e))));
console.log('\nExamples of small targets: ' + [...ex].slice(0, 12).join('; '));
const oex = new Set(); A.runs.forEach(r => Object.entries(r.states).forEach(([n, st]) => st.overlapExamples.forEach(e => oex.add(r.viewport + ' ' + n + ': ' + e))));
console.log('\nExamples of overlaps (before): ' + [...oex].slice(0, 10).join('; '));

console.log('\n### Hover, focus and tap behaviour on Build\n');
const hv = (v, k, X) => { const x = run(X, v); return x ? x.hover[k] : undefined; };
const gv = (v, k, X) => { const x = run(X, v); return x && x.hover.previewGeometry ? x.hover.previewGeometry[k] : '?'; };
const row = (label, f) => [label, ...VPS.map(v => cell(f(v, A), B ? f(v, B) : undefined))];
console.log(table(['check', ...VPS], [
  row('hover opens the preview', (v, X) => hv(v, 'hoverOpens', X) === undefined ? 'n/a (touch)' : hv(v, 'hoverOpens', X)),
  row('keyboard focus opens it', (v, X) => hv(v, 'focusOpens', X) === undefined ? 'n/a' : hv(v, 'focusOpens', X)),
  row('first tap previews, does not add', (v, X) => hv(v, 'firstTapPreviews', X) === undefined ? 'n/a' : (hv(v, 'firstTapPreviews', X) && !hv(v, 'firstTapAddedPart', X))),
  row('preview fully on screen (while hovering a card)', (v, X) => gv(v, 'previewFullyOnScreen', X)),
  row('preview share of the viewport height', (v, X) => gv(v, 'previewShareOfViewport', X)),
  row('card the player is acting on is covered at the pointer', (v, X) => gv(v, 'cardCoveredAtPointer', X)),
  row('"Why" opens by keyboard', (v, X) => String(hv(v, 'whyOpensByKeyboard', X))),
  row('"?" opens by keyboard', (v, X) => String(hv(v, 'helpOpensByKeyboard', X))),
  row('layout shift while hovering and clicking (CLS)', (v, X) => hv(v, 'layoutShift', X)),
  row('title-only tooltips (no keyboard or tap)', (v, X) => { const t = hv(v, 'titleOnly', X) || []; return t.length + ' ' + (t[0] || ''); })
]));

console.log('\n### axe-core violations at 1366x768 (id: nodes)\n');
const axeRows = states.map(s => { const a = run(A, '1366x768').states[s].axe, b = run(B, '1366x768') && run(B, '1366x768').states[s].axe; const f = x => x ? x.map(v => `${v.id}(${v.impact[0]}):${v.nodes}`).join(', ') || 'none' : '?'; return [s, f(a), b ? f(b) : '']; });
console.log(table(B ? ['screen', 'before', 'after'] : ['screen', 'violations'], B ? axeRows : axeRows.map(r => r.slice(0, 2))));
console.log('\nPage errors: ' + A.runs.map(r => r.errors.length).join(', '));
