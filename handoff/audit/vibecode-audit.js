export const meta = {
  name: 'vibecode-audit',
  description: 'Audit the GRAVITRON game for vibecoded tells (visual, copy, build), verify each finding, and write a ranked fix plan',
  whenToUse: 'Before restyling or tightening a hackathon front end',
  phases: [
    { title: 'Audit', detail: 'eight dimension finders read the code and run the game' },
    { title: 'Verify', detail: 'skeptics try to refute every finding' },
    { title: 'Gaps', detail: 'a critic checks the brief for anything nobody examined' },
    { title: 'Plan', detail: 'dedupe, rank by fix priority, write AUDIT.md and a fix plan' },
  ],
}

const SCRATCH = args.scratch

const BRIEF = [
  'THE BRIEF (what makes a site look and feel "vibecoded": built fast from AI output that nobody tightened).',
  '1. VISUAL TELLS: purple-to-blue or pink gradients on buttons, headings, hero backgrounds; glassmorphism (frosted blur, translucent panels); soft drop shadows on every card, glowing borders; emoji used as icons in headings, bullets, cards; hover effects that lift, scale or float everything; the stock layout (big centered hero, three feature cards in a row, a "how it works" 1-2-3 strip, a final call-to-action banner); default fonts (Inter or system) with no type hierarchy and everything centered; uniform padding and one corner radius on every element; dark mode with neon accents by default; stock illustrations or placeholder images that do not match the product.',
  '2. COPY TELLS: em dashes throughout; buzzwords (seamless, effortless, supercharge, unlock, elevate, revolutionize, cutting-edge, all-in-one); "Not just X, it is Y" taglines and three-item lists everywhere; fake testimonials, fake stats, invented logos; lorem ipsum or "Your text here"; every button reads "Get Started"; cheerful empty error messages ("Oops! Something went wrong").',
  '3. BUILD AND CODE TELLS: SECURITY (keys or secrets in front-end code or committed; no input validation; auth only in the browser; user content rendered as raw HTML (XSS); open CORS; verbose errors leaking stack traces). FAKE FUNCTIONALITY (buttons that do nothing; forms that say "sent" but send nothing; hardcoded or mock data that looks real; features that only work for one demo path). MISSING STATES (no loading, empty or error states; breaks when the network drops; double-submits; no feedback after clicking). BROKEN BASICS (not working on a phone: clipped text, sideways scroll, tap targets under 44px; no keyboard or screen-reader support; no focus styles; poor contrast; no alt text; no title or meta tags; no 404 page). CODE HYGIENE (huge single files; dead code and commented-out blocks; leftover console.log; duplicated logic; unused dependencies; no tests; no README or setup steps; .env or data files committed). INCONSISTENCY (each page styled slightly differently; three button styles; spacing and colours hardcoded instead of tokens; copy tone that changes between pages). UNVERIFIED WORK (nothing run with real input, so bugs show up only when a stranger uses it).',
  'FIX PRIORITY: security, then broken functionality, then missing states and mobile, then accessibility, then visual polish, then copy.',
  'RULES FOR FIXES: keep rounded corners where they exist, keep it flat (no gradients, glass or shadows, no emoji icons), use real content, and verify every change by running it with real input rather than only reading the code.',
  'NOTE: this is a client-only static game, so server concerns (auth, rate limits, admin routes, CORS headers, stack traces) cannot exist. Do not invent findings for them: list them under not_applicable with a one-line reason, and look instead at their real client-side analogues (innerHTML and XSS from data or save codes or live fetch results, localStorage tampering, validation of an imported save code, secrets or large junk committed to git, third-party script and font loading).',
].join('\n')

const CONTEXT = [
  'Project: GRAVITRON, a browser game (NASA Space Apps 2026) in /home/user/Hackstreet_Bros_Satellite. Plain HTML, CSS and JavaScript, no build step, no import; open index.html from file://. Front end: index.html, css/style.css, js/ui-design.js (the big one, one IIFE), js/ui-mission.js, js/ui-tree.js, js/ui-campaign.js, js/live-data.js; back end: js/game.js, js/mission.js; data/*.js (one global each); tests/*.js (Node); docs: SPEC.md, HANDOFF.md, CHANGELOG.md, SI_USE.md, SOURCES.md, and a README if there is one.',
  'The repo is at a committed HEAD. YOU ARE READ-ONLY: do not edit, stage or commit anything in the repo and write nothing into it (not even screenshots in its root). All your scripts, screenshots and notes go under ' + SCRATCH + '/audit/<your dimension>/ .',
  'CLAUDE.md rules bind every fix you propose: plain HTML/CSS/JS, no import, fetch only in js/live-data.js (the game must still work offline from data/earth.js), js/game.js never touches the page (no document), do not rename or add data fields, one small task at a time.',
  'Running the game: Playwright is installed (require("playwright") works from any directory; chromium.launch() needs no options). Block Google Fonts with page.route(/fonts\\.(googleapis|gstatic)\\.com/, r => r.abort()) so runs are repeatable. Check phone (390x844) and desktop (1280x800). Helper scripts you may read and copy from: ' + SCRATCH + '/play/play.js, fail.js, touch.js, campaign.js, calib.js. Progress is saved in localStorage key smdg-progress-v1; to open every era and Trade Space set {best_stars:{training:3},best_score:{training:97},best_stars_by_era:{igy:3,nimbus:3,eos:3}}.',
  'The machine is busy with a long test run: keep your own runs short, and do NOT run tests/simulate.js, tests/balance.js or tests/campaign.js (tests/api.js and tests/formulas.js are fine).',
  'Report only what you confirmed by reading the exact code or by running it. Cite file and 1-based line. Prefer solid findings over vague ones, but do not stop early: if there are more than 15, return the 15 most severe and set truncated=true. For each finding give a concrete, small fix that fits the CLAUDE.md rules. Also list in "checked" the brief bullets you actually examined, and in not_applicable the ones that cannot apply, each with a reason.',
].join('\n')

const FINDING = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
    group: { type: 'string', enum: ['security', 'broken', 'states_mobile', 'a11y', 'visual', 'copy', 'hygiene'] },
    file: { type: 'string' },
    line: { type: 'integer' },
    evidence: { type: 'string' },
    why: { type: 'string' },
    fix: { type: 'string' },
    fix_files: { type: 'array', items: { type: 'string' } },
    needs_user_decision: { type: 'boolean' },
    confirmed_by: { type: 'string', enum: ['ran', 'read'] },
  },
  required: ['title', 'severity', 'group', 'file', 'line', 'evidence', 'why', 'fix', 'fix_files', 'needs_user_decision', 'confirmed_by'],
}
const FINDINGS = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: FINDING },
    truncated: { type: 'boolean' },
    checked: { type: 'array', items: { type: 'string' } },
    not_applicable: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, reason: { type: 'string' } }, required: ['item', 'reason'] } },
  },
  required: ['findings', 'truncated', 'checked', 'not_applicable'],
}
const VERDICT = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
    better_fix: { type: 'string' },
  },
  required: ['refuted', 'reason', 'severity', 'better_fix'],
}
const GAPS = {
  type: 'object',
  properties: {
    gaps: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, where_to_look: { type: 'string' }, why_missing: { type: 'string' } }, required: ['item', 'where_to_look', 'why_missing'] } },
  },
  required: ['gaps'],
}
const PLAN = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    verdict: { type: 'string' },
    counts: { type: 'array', items: { type: 'object', properties: { group: { type: 'string' }, count: { type: 'integer' } }, required: ['group', 'count'] } },
    tasks: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, title: { type: 'string' }, group: { type: 'string' },
      files: { type: 'array', items: { type: 'string' } }, finding_ids: { type: 'array', items: { type: 'string' } },
      change: { type: 'string' }, verify: { type: 'string' }, needs_user_decision: { type: 'boolean' },
    }, required: ['id', 'title', 'group', 'files', 'finding_ids', 'change', 'verify', 'needs_user_decision'] } },
    decisions: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, why: { type: 'string' }, recommendation: { type: 'string' } }, required: ['question', 'why', 'recommendation'] } },
    report_path: { type: 'string' },
    plan_path: { type: 'string' },
  },
  required: ['summary', 'verdict', 'counts', 'tasks', 'decisions', 'report_path', 'plan_path'],
}

const DIMS = [
  { id: 'visual', prompt: 'DIMENSION: VISUAL TELLS. Read css/style.css and the drawing code in js/ui-design.js (art(), PAL, satellite and rocket and portrait art, the map), index.html, then LOOK at the running game: take screenshots of every screen at 390 and 1280 (title, intro, map, briefing, orbit, build, launcher, review, mission, debrief, campaign hub, lab). Find every visual tell in group 1 of the brief: gradients (grep linear-gradient, radial-gradient), backdrop-filter, box-shadow and text-shadow (including hard offset shadows used as a style), glows, hover lift or scale or transform transitions on everything, emoji or pictograph characters used as icons (grep for non-ASCII symbols in the JS and HTML), the stock layout patterns, centred-everything layouts, font stack and type hierarchy (how many sizes, weights, is there a real scale), one border radius everywhere, uniform padding, neon accents on dark, art that does not match the product. Also say what the current look is and why a reviewer might read it as generated. Group these findings as visual.' },
  { id: 'copy', prompt: 'DIMENSION: COPY TELLS. Read every user-facing string: index.html, js/ui-design.js (including the STORY block, hints, CHECK_LABELS, tier and era text), js/ui-mission.js, js/ui-campaign.js, js/ui-tree.js, js/live-data.js, and the data files that are shown to the player (data/*.js: parts, objectives, orbits, launchers, events, debrief, hints, research, missions, campaign, eras, tiers), also the game back end strings that reach the screen (js/game.js, js/mission.js). Grep for em dashes and en dashes, the buzzwords in the brief, "Not just ... it is ..." patterns, lists of exactly three used as a tic, "Oops", "Something went wrong", "Get Started", lorem, placeholder text, invented stats or logos. Then read the copy aloud, screen by screen: sentences that sound like a brochure, tone that changes between screens (formal, jokey, imperative), inconsistent capitalisation of labels, vague error or empty-state messages. Check numbers shown to the player are sourced (data files or SOURCES.md) and not invented. Group these findings as copy, except unsourced or invented numbers (broken).' },
  { id: 'security', prompt: 'DIMENSION: SECURITY (client-side analogues). Grep and read for: innerHTML, outerHTML, insertAdjacentHTML, document.write, eval, new Function, setTimeout with a string, javascript: URLs, inline on* handlers, target=_blank without rel; how el() in js/ui-design.js sets text and attributes (can any data value, live fetch result from js/live-data.js such as a NASA EONET event title, or an imported save code reach the DOM as HTML or as an attribute like href or src or style?); importSave / exportSave in the back end and the hub import box (what happens with garbage, huge input, __proto__ or constructor keys, wrong types, negative or NaN numbers: can a hand-edited save code or localStorage value give infinite money or break the game?); localStorage JSON.parse without try/catch; the live data fetch (only in js/live-data.js? response validation, size limits, timeouts, what it does with HTML in a response); third-party scripts and fonts (Google Fonts link without integrity is acceptable for CSS but note it); secrets: grep the whole git history and tree for api keys, tokens, passwords, .env; large or sensitive committed files (data/result_master.csv is about 93 MB: is it used?); .gitignore. Actually try the attacks in the browser (for example import a save code with <img src=x onerror=alert(1)> in a string field, or set localStorage to junk and reload). Group these findings as security, or broken if they only break the game.' },
  { id: 'functionality', prompt: 'DIMENSION: FAKE FUNCTIONALITY AND MISSING STATES. Click every button and link on every screen and write down anything that does nothing, says it did something it did not, or only works on the one demo path (for example the sea-ice SSO example). Check each screen for loading, empty and error states: no live data and offline (block every external host in Playwright), live data returning garbage or a 500, a corrupt or old localStorage value, a missing data global (delete one data script tag), an empty parts bin, zero unlocked topics in a campaign, a campaign import with a bad code, a campaign save from an older version. Double-submits and rapid clicks (double-click LAUNCH, double-click START, spamming BUY in the lab, clicking REDESIGN twice, pressing keys during a transition), going back with Esc or the map in odd places (during a mission, on the debrief), and what the player sees after each click (feedback, disabled state, focus). Check the hardcoded or mock data that looks real (anything on screen not computed by the back end or read from data/). Group these findings as broken or states_mobile.' },
  { id: 'basics', prompt: 'DIMENSION: BROKEN BASICS (phone, keyboard, screen reader, contrast, meta). With Playwright measure on every screen at 390x844, 360x640 and a phone held sideways (844x390): horizontal overflow (scrollWidth > innerWidth), clipped or overlapping text, and the size of every interactive element (report anything under 44x44 CSS px: buttons, tier buttons, part cards, map markers, minimap, the ? button, close buttons, tree nodes). Keyboard: tab through each screen, is every action reachable and operable with Enter and Space, is the focus visible (grep :focus and :focus-visible, outline: none), is focus moved sensibly after a screen change, does anything trap focus. Screen reader: landmarks, headings order, aria-labels, role=img with a label on every piece of art or aria-hidden, live regions, aria-pressed, the alertdialog in the mission. Contrast: compute WCAG ratios for every foreground and background token pair in css/style.css (text, text-dim, accent on bg, accent-ink on accent, info, bad, disabled, placeholders), and report pairs under 4.5:1 for text or 3:1 for large text and UI. prefers-reduced-motion for every animation and transition, prefers-color-scheme (is there only one theme), zoom to 200 percent. index.html: title, meta description, theme-color, viewport, lang, favicon, open-graph tags, noscript message, and whether a 404.html exists for a GitHub Pages deploy. Group these findings as states_mobile (phone) or a11y.' },
  { id: 'hygiene', prompt: 'DIMENSION: CODE HYGIENE. Look at the whole repo: file sizes (js/ui-design.js is one IIFE of roughly 2700 lines: where would you split it without breaking the no-import, one-global-per-file rule, and which sections are independent?), console.log and console.* calls, TODO and FIXME and XXX, commented-out code blocks, dead functions and unused variables (find functions defined in js/ui-design.js that are never called; CSS selectors in css/style.css that match nothing in the JS or HTML; data fields nothing reads), duplicated logic (copy-pasted helpers across ui files, repeated string formatting, three ways to build a button), magic numbers, the STORY and SAT blocks (are the integration markers still accurate and are the file header comments up to date?), tests (which tests exist, what is not covered, does a failing test fail loudly, is there a way to run all of them with one command), README and setup steps (does the repo explain how to run it, in one screen?), committed junk (data/result_master.csv 93 MB unused, stray images, .env, node_modules, editor files), .gitignore, doc drift (does SPEC.md, CHANGELOG.md, HANDOFF.md, SI_USE.md and the code agree about names, numbers and the brand: GRAVITRON versus STARLINE leftovers, StarlineUI and smdg-progress-v1 are internal and fine). Group these findings as hygiene.' },
  { id: 'consistency', prompt: 'DIMENSION: INCONSISTENCY. In css/style.css and the inline style code in the JS: every hardcoded colour value (hex, rgb, hsl, named) outside the :root token block, every hardcoded px size or font size that bypasses a token or a scale, how many distinct button styles exist (.btn, .tier-btn, .part, .blip, the hub and lab buttons, key caps: do they share one definition or look like different apps?), border radius, border width, spacing values and font sizes actually in use (count distinct values: a design that has no scale uses 15 different paddings), z-index values, media query breakpoints (are they the same everywhere?). Compare screens visually (screenshots at 1280 and 390): heading styles, panel styles, tag and badge styles, how a locked, selected, hover and disabled card looks on each screen (do they follow one rule?), title casing, label casing (UPPERCASE versus Sentence), punctuation, number and unit formatting ($1.5M versus $1,500,000, kg versus KG), the separator character used (the middle dot), date formats, and copy tone between the debrief, campaign hub and lab. Group these findings as visual, copy or hygiene as fits.' },
  { id: 'playthrough', prompt: 'DIMENSION: UNVERIFIED WORK. Actually play it as a stranger would, with real and hostile input, at 390x844 and 1280x800, and record every bug: a full standalone mission in each of the four eras and the three tiers (use the progress value in the context to open them), a full campaign (title screen, campaign hub, research, lab upgrade, mission, debrief, back to hub, export and import a save code, reload mid-campaign), the intro both stepped through and skipped, the map by mouse, by keyboard (arrows, WASD, E, M, Esc) and by touch (page.tap), the redesign loop, the careless design (nothing built, go to review, FIX links), failing a mission on purpose, an event with each choice. Watch the browser console and page errors, layout breaks, wrong numbers (cross-check a few against the back end with node: the front end must never compute game numbers), text that does not match the state (for example "you have 4" versus the real count), stale state after Redesign or Change tier or going back to the title, anything that needs a reload. Report each real bug with the exact steps to reproduce. Group these findings as broken or states_mobile.' },
]

const finderPrompt = (d) => [CONTEXT, BRIEF, d.prompt, 'Dimension id for your scratch folder: ' + d.id + '. Return the structured result.'].join('\n\n')

const verifyPrompt = (f, lens) => [
  CONTEXT,
  'You are a skeptic. A finder claims this problem exists in the repo at HEAD:\n' + JSON.stringify(f, null, 1),
  lens === 'reproduce'
    ? 'Check the claim against the actual file at the cited line and, for anything behavioural or visual, by running it (Playwright from file://, scripts in ' + SCRATCH + '/audit/verify/). Try to REFUTE it: wrong file or line, handled elsewhere, unreachable, a misread of the code, rendered differently from what the CSS suggests. Default to refuted=true if you cannot confirm it. If it is real, correct the severity if it is off, and give a better_fix if the proposed one is wrong, unsafe or too big (otherwise repeat it).'
    : 'Challenge it on merit. Is this really a defect or a "vibecoded" tell as the brief defines them, or a reasonable choice for a hackathon game? The visual direction of the game is being changed to a PlayStation 4 style, so do not defend the current look as intentional; judge it against the brief. Is the proposed fix correct, small, allowed by the CLAUDE.md rules, and unlikely to break tests or other screens? Default to refuted=true if it is only a matter of taste, a duplicate of a more important finding, or the fix would cause a worse problem. better_fix: your corrected fix, or repeat the proposal.',
  'Return the structured verdict.',
].join('\n\n')

// The machine runs 2 agents at a time per workflow, so each dimension's findings are checked by ONE skeptic
// that tries to refute every finding (reproduce lens for all, plus the merit lens for high and critical ones).
const BATCH_VERDICT = {
  type: 'object',
  properties: { verdicts: { type: 'array', items: { type: 'object', properties: {
    index: { type: 'integer' }, refuted: { type: 'boolean' }, reason: { type: 'string' },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] }, better_fix: { type: 'string' },
  }, required: ['index', 'refuted', 'reason', 'severity', 'better_fix'] } } },
  required: ['verdicts'],
}
async function verifyAll(findings, tag) {
  if (!findings.length) return []
  const list = findings.map((f, k) => Object.assign({ index: k }, f))
  const res = await agent([
    CONTEXT,
    'You are a SKEPTIC. A finder claims each of these problems exists in the repo at HEAD. Check EVERY one (return one verdict per index, none skipped):\n' + JSON.stringify(list, null, 1),
    'For each finding: (1) REPRODUCE: open the file at the cited line and, for anything behavioural or visual, run it (Playwright from file://, scripts in ' + SCRATCH + '/audit/verify-' + tag + '/). Try to refute it: wrong file or line, handled elsewhere, unreachable, a misread of the code, rendered differently from what the CSS suggests. (2) For critical and high findings also judge MERIT: is it a real defect or a "vibecoded" tell as the brief defines them, or only taste? The visual direction is changing to a PS3-era low-poly 3D art style with a flat, clean interface, so do not defend the current look as intentional. Is the proposed fix correct, small, allowed by the CLAUDE.md rules and unlikely to break tests or other screens? Default to refuted=true when you cannot confirm it, when it is only taste, or when it duplicates a more important finding in the list. Correct the severity if it is off. better_fix: your corrected fix, or repeat the proposal.',
    'Return the structured verdicts.',
  ].join('\n\n'), { label: 'verify:' + tag, phase: 'Verify', schema: BATCH_VERDICT })
  const byIdx = {}
  ;((res && res.verdicts) || []).forEach((v) => { byIdx[v.index] = v })
  return findings.map((f, k) => {
    const v = byIdx[k]
    return Object.assign({}, f, { id: tag + '-' + (k + 1), dimension: tag, votes_n: v ? 1 : 0, unverified: !v, keep: v ? !v.refuted : true,
      severity: v ? v.severity : f.severity, fix: (v && v.better_fix) || f.fix, refutations: v && v.refuted ? [v.reason] : [] })
  })
}

phase('Audit')
const results = await pipeline(
  DIMS,
  (a, b, i) => agent(finderPrompt((typeof i === 'number' && DIMS[i]) || a), { label: 'find:' + ((typeof i === 'number' && DIMS[i]) || a).id, phase: 'Audit', schema: FINDINGS }),
  async (res, b, i) => {
    const d = (typeof i === 'number' && DIMS[i]) || b
    if (!res) return { dim: d.id, failed: true, findings: [], checked: [], not_applicable: [], truncated: false }
    log(d.id + ': ' + res.findings.length + ' findings' + (res.truncated ? ' (truncated by the finder)' : ''))
    const vf = await verifyAll(res.findings, d.id)
    return { dim: d.id, failed: false, findings: vf, checked: res.checked, not_applicable: res.not_applicable, truncated: res.truncated }
  }
)
const done = results.filter(Boolean)
log('Verified: ' + done.map((r) => r.dim + ' ' + r.findings.filter((f) => f.keep).length + '/' + r.findings.length).join(', '))
const failedDims = DIMS.filter((d, i) => !results[i] || results[i].failed).map((d) => d.id)
if (failedDims.length) log('A finder died for: ' + failedDims.join(', ') + ' (not covered by this run)')

phase('Gaps')
const covered = done.map((r) => ({ dimension: r.dim, checked: r.checked, not_applicable: r.not_applicable, kept_titles: r.findings.filter((f) => f.keep).map((f) => f.title) }))
const gapRes = await agent([
  BRIEF,
  'You are the completeness critic. Eight finders audited the game, one per dimension. Here is what each reports having checked, what it ruled not applicable, and the titles of the findings that survived verification:\n' + JSON.stringify(covered, null, 1),
  'Go through EVERY bullet of the brief (all three groups) and decide whether it was actually examined by someone, found or ruled out with a reason. List the brief bullets, or whole areas of the game (a screen, a flow, a data file, a doc), that nobody examined or examined too thinly to trust. You may look at the repo (' + '/home/user/Hackstreet_Bros_Satellite' + ', read-only) to see what exists, but do not audit yourself: name each gap with where to look. At most 10 gaps; fewer is fine if coverage is good. ' + (failedDims.length ? 'These dimensions had no finder result at all and must be listed as gaps: ' + failedDims.join(', ') + '.' : ''),
].join('\n\n'), { label: 'gap-critic', phase: 'Gaps', schema: GAPS })
const allGaps = (gapRes && gapRes.gaps) || []
const gapItems = allGaps.slice(0, 4)
log('Gaps to examine: ' + gapItems.length + (allGaps.length > 4 ? ' (' + (allGaps.length - 4) + ' more listed by the critic and NOT examined: ' + allGaps.slice(4).map((g) => g.item).join('; ') + ')' : ''))
const gapRuns = await parallel(gapItems.map((g) => () => agent([CONTEXT, BRIEF, 'DIMENSION: GAP FILL. Examine exactly this area that the first pass missed.\nItem: ' + g.item + '\nWhere to look: ' + g.where_to_look + '\nWhy it was missed: ' + g.why_missing + '\nYour scratch folder id: gap. Return the structured result.'].join('\n\n'),
  { label: 'gap:' + g.item.slice(0, 40), phase: 'Gaps', schema: FINDINGS })))
const gapFindings = gapRuns.filter(Boolean).flatMap((r) => r.findings)
const gapVerified = await verifyAll(gapFindings, 'gap')
const gapDone = [{ dim: 'gap', failed: false, findings: gapVerified, checked: gapRuns.filter(Boolean).flatMap((r) => r.checked), not_applicable: gapRuns.filter(Boolean).flatMap((r) => r.not_applicable), truncated: false }]
const notExaminedGaps = allGaps.slice(4).map((g) => g.item)

phase('Plan')
const all = done.concat(gapDone)
const kept = all.flatMap((r) => r.findings.filter((f) => f.keep))
const dropped = all.flatMap((r) => r.findings.filter((f) => !f.keep)).map((f) => ({ id: f.id, title: f.title, why: f.refutations }))
const na = all.flatMap((r) => r.not_applicable)
log('Kept ' + kept.length + ' findings, dropped ' + dropped.length + ' refuted')
const plan = await agent([
  'You are writing the audit report and a fix plan for the GRAVITRON browser game (repo /home/user/Hackstreet_Bros_Satellite, read-only for you; write only the two files named below).',
  BRIEF,
  'Verified findings (each survived a skeptic; ids are stable):\n' + JSON.stringify(kept, null, 1),
  'Not applicable items reported by finders:\n' + JSON.stringify(na, null, 1),
  'Refuted and dropped (for the appendix only):\n' + JSON.stringify(dropped, null, 1),
  'Do this:\n1. Merge duplicates (the same cause reported by two dimensions) and keep the clearest wording and the highest verified severity.\n2. Write ' + SCRATCH + '/audit/AUDIT.md: a one-paragraph honest verdict on how vibecoded the game looks and feels and why; then findings in the brief\'s FIX PRIORITY order (security, broken functionality, missing states and mobile, accessibility, visual polish, copy, then code hygiene), each as: id, severity, file:line, what is wrong, why it reads vibecoded or is unsafe, the fix; then the not-applicable list and the refuted appendix. Plain sentences, no em dashes, no emoji.\n3. Write ' + SCRATCH + '/audit/fix-plan.json: an ordered list of SMALL tasks (one concern each, a day of one person at most), each naming the files it touches, so that two tasks that touch the same file never run at the same time: order them so that non-visual fixes (security, broken, states, a11y, hygiene) come before the visual and copy restyle, and put every task that edits css/style.css or the art code in js/ui-design.js in the restyle group at the end. Each task: id, title, group, files, finding_ids, change (exactly what to do), verify (how to prove it by running it), needs_user_decision.\n4. List decisions that are the user\'s to make (for example: story copy that is the Story owner\'s, data files owned by the Data owner, anything touching SPEC.md, the visual direction) with your recommendation.\nReturn the structured result with the real paths.',
].join('\n\n'), { label: 'plan', phase: 'Plan', schema: PLAN })

return {
  plan: plan,
  counts: { kept: kept.length, dropped: dropped.length, failedDimensions: failedDims, gaps: gapItems.length, gapsNotExamined: notExaminedGaps },
  kept: kept.map((f) => ({ id: f.id, sev: f.severity, group: f.group, file: f.file, line: f.line, title: f.title })),
}