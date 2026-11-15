// The story text, in plain Node (no browser): every key of the story design exists with beats of the right shape,
// no beat is over 100 characters, no scene is over 6 beats, no digits, $ or % in story text, and never the word "AI".
// It slices js/ui-design.js between STORY-BEGIN and STORY-END and evaluates that block alone (the helpers there only
// touch page globals inside function bodies).
// Usage: node story-text.js        (from any folder; the repo is the one this file lives in, or $REPO)
const fs = require('fs');
const path = require('path');
const T = require('./lib');
const repo = process.env.REPO || path.resolve(__dirname, '..', '..');
const { ok, done } = T.checker();

const src = fs.readFileSync(path.join(repo, 'js', 'ui-design.js'), 'utf8');
const a = src.indexOf('// STORY-BEGIN'), b = src.indexOf('// STORY-END');
ok(a > 0 && b > a, 'the STORY-BEGIN and STORY-END markers are there');
const STORY = new Function(src.slice(a, b) + '\nreturn STORY;')();
const A = STORY.austin, J = STORY.ajay;

const MAX_BEAT = 100;                 // characters in one beat or ending line
const MAX_SCENE = 6;                  // beats in one scene
const SPEAKERS = ['team', 'partner', 'customer', 'notebook', 'rival', 'mum'];
const isBeat = x => x && typeof x === 'object' && typeof x.who === 'string' && SPEAKERS.includes(x.who) && typeof x.text === 'string' && x.text.length > 0;
const stats = { beats: 0, scenes: 0, longest: 0, longestText: '' };
function scene(name, beats, min, max) {
  const list = Array.isArray(beats) ? beats : [];
  const good = Array.isArray(beats) && list.length >= (min || 1) && list.length <= (max || MAX_SCENE) && list.every(isBeat);
  ok(good, `${name}: ${list.length} beats, each { who, text } with a known speaker (${min || 1} to ${max || MAX_SCENE})`);
  list.forEach(x => { if (x && typeof x.text === 'string') { stats.beats++; if (x.text.length > stats.longest) { stats.longest = x.text.length; stats.longestText = x.text; } } });
  stats.scenes++;
  return list;
}
function ending(name, e, beatMin, beatMax) {
  ok(e && typeof e.title === 'string' && e.title.length > 0 && e.title.length <= 30, `${name}: a title (${e && e.title})`);
  ok(e && typeof e.kicker === 'string' && e.kicker.length > 0 && e.kicker.length <= 60, `${name}: a kicker`);
  scene(`${name}: beats`, e && e.beats, beatMin, beatMax);
  ok(e && typeof e.line === 'string' && e.line.length > 0 && e.line.length <= MAX_BEAT, `${name}: one closing line (${e && e.line ? e.line.length : 0} characters)`);
}

// ---- speakers
ok(STORY.speakers.rival === 'IRON ECLIPSE' && STORY.speakers.mum === 'MUM', 'speakers: rival is IRON ECLIPSE, mum is MUM');
['team', 'partner', 'customer', 'notebook'].forEach(k => ok(typeof STORY.speakers[k] === 'string', `speakers: ${k} is still there`));

// ---- Part 1: Austin
const intro = scene('austin.intro', A.intro, 3, 4);
['1', '2', '3'].forEach(n => {
  const s = A.steps[n];
  ok(s && typeof s.name === 'string' && s.name.length > 0, `austin.steps[${n}]: a name`);
  scene(`austin.steps[${n}].open`, s && s.open, 2, 4);
  ok(s && isBeat(s.close), `austin.steps[${n}].close: one { who, text } beat`);
  if (s && s.close) { stats.beats++; stats.scenes++; }
});
ok(intro.length + A.steps['1'].open.length <= MAX_SCENE, `step 1 scene (intro + open) is ${intro.length + A.steps['1'].open.length} beats, at most ${MAX_SCENE}`);
const epi = scene('austin.epilogue', A.epilogue, 5, 6);
ok(epi.length && epi[epi.length - 1].text === 'Decades later, his grandson Ajay opens it.', 'austin.epilogue ends on "Decades later, his grandson Ajay opens it."');
ending('austin.endings.box', A.endings && A.endings.box, 3, 4);
ok(A.endings && A.endings.box && A.endings.box.title === 'THE BOX', 'austin.endings.box is THE BOX');
['map', 'briefing', 'orbit', 'build', 'launcher', 'review', 'mission-start', 'mission-end', 'debrief', 'closing', 'notebook', 'who']
  .forEach(k => ok(A[k] !== undefined, `austin.${k}: the existing key is kept`));

// ---- Part 2: Ajay
const aintro = scene('ajay.intro', J.intro, 4, 6);
ok(/Albert Orbital/.test(aintro.map(x => x.text).join(' ')) && /workshop/.test(aintro.map(x => x.text).join(' ')), 'ajay.intro names Albert Orbital and the workshop (browser test comeback.js)');
ok(Array.isArray(J.why) && J.why.length >= 6 && J.why.every(x => typeof x === 'string' && x.length > 0 && x.length <= 70), `ajay.why: ${J.why.length} single lines of at most 70 characters`);
const I = J.interludes;
const ids = ['start', 'after-1', 'offer', 'refused', 'after-3', 'final'];
ok(I && ids.every(k => Array.isArray(I[k])), 'ajay.interludes has start, after-1, offer, refused, after-3 and final');
scene('interludes.start', I.start, 4, 6);
ok(JSON.stringify(I.start) === JSON.stringify(J.intro), 'interludes.start is the same six beats as intro');
scene('interludes.after-1', I['after-1'], 3, 5);
scene('interludes.offer', I.offer, 3, 5);
scene('interludes.refused', I.refused, 2, 2);
scene('interludes.after-3', I['after-3'], 3, 5);
scene('interludes.final', I.final, 1, 1);
ok(I.offer.sell === 'SELL' && I.offer.refuse === 'REFUSE', 'interludes.offer.sell is SELL and .refuse is REFUSE');
ok(typeof I.offer.sell_hint === 'string' && I.offer.sell_hint.length <= MAX_BEAT && typeof I.offer.refuse_hint === 'string' && I.offer.refuse_hint.length <= MAX_BEAT, 'interludes.offer has a one-line sell_hint and refuse_hint');
ok(/^Almost there\./.test(I.final[0].text), 'interludes.final starts "Almost there."');
ok(I['after-1'][0].who === 'mum' && I.offer[0].who === 'rival' && I['after-3'][0].who === 'notebook', 'mum calls in after-1, the rival offers, the notebook speaks in after-3');
const E = J.endings;
['legend', 'comeback', 'close', 'sold', 'timeout', 'broke'].forEach(id => ending(`ajay.endings.${id}`, E && E[id], 3, 4));
ok(E && Object.keys(E).length === 6, 'ajay.endings has exactly the six Part 2 endings (the seventh is austin.endings.box)');
const titles = [A.endings.box].concat(Object.values(E)).map(e => e.title);
ok(new Set(titles).size === 7, 'seven endings, seven different titles: ' + titles.join(' | '));
['legend', 'sold'].forEach(id => ok(E[id].beats.some(x => /page|notebook/i.test(x.text)) || /page/.test(E[id].line), `ending ${id}: it stands alone, the notebook's last page is in it`));
['won', 'deadline', 'cash'].forEach(k => scene(`ajay.ending.${k} (legacy)`, J.ending && J.ending[k], 2, 2));
['hub', 'contract', 'map', 'briefing', 'orbit', 'build', 'launcher', 'review', 'mission-start', 'mission-end', 'debrief', 'closing', 'notebook', 'who']
  .forEach(k => ok(J[k] !== undefined, `ajay.${k}: the existing key is kept`));

// ---- every string under austin and ajay: length, digits, $, %, "AI"
const strings = [];
(function walk(x, where) {
  if (typeof x === 'string') strings.push([where, x]);
  else if (x && typeof x === 'object') {
    Object.keys(x).forEach(k => walk(x[k], where + '.' + k));
    ['sell', 'refuse', 'sell_hint', 'refuse_hint'].forEach(k => { if (Array.isArray(x) && typeof x[k] === 'string') strings.push([where + '.' + k, x[k]]); });
  }
})({ austin: A, ajay: J }, 'STORY');
const skip = /\.who\.|\.who$/;      // the screen-to-speaker map holds ids, not words
const text = strings.filter(s => !skip.test(s[0]) && !/\.who$/.test(s[0]));
const tooLong = text.filter(s => s[1].length > MAX_BEAT);
ok(tooLong.length === 0, `no line over ${MAX_BEAT} characters (${text.length} strings checked)` + tooLong.map(s => '\n      ' + s[0] + ': ' + s[1].length).join(''));
const digits = text.filter(s => /[0-9$%]/.test(s[1]));
ok(digits.length === 0, 'no digit, $ or % in story text' + digits.map(s => '\n      ' + s[0] + ': ' + s[1]).join(''));
const ai = text.filter(s => /\bAI\b/.test(s[1]));
ok(ai.length === 0, 'the word "AI" never appears' + ai.map(s => '\n      ' + s[0]).join(''));
const screen = text.filter(s => /^STORY\.(austin|ajay)\.(map|briefing|orbit|build|launcher|review|mission-start|mission-end|debrief|closing|notebook|hub|contract|event-calibration)\b/.test(s[0]) && s[1].length > 90);
ok(screen.length === 0, 'no per-screen line over 90 characters' + screen.map(s => '\n      ' + s[0] + ': ' + s[1].length).join(''));

console.log(`counts: ${stats.scenes} scenes, ${stats.beats} beats, longest ${stats.longest} characters`);
console.log(`longest: ${stats.longestText}`);
console.log(`endings: ${titles.length}, interludes: ${ids.length}, why lines: ${J.why.length}`);
done();
