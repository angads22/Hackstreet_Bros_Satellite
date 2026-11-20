# Compliance audit against the NASA Project Submission Guide (Nov 13, 2026)

Written Nov 16, 03:30 UTC from five read-only checks. Severity: blocker, should_fix, nice_to_have. Each fix names the file or slide element.

## SI marking and NASA branding in the game

No NASA branding found anywhere: no logo, meatball, worm, flag, patch, insignia, image file or data-URI picture of one. The game has zero image, video or audio files (art is drawn by SI-written code, sound is a Web Audio synth). The gap is SI acknowledgement: README.md, index.html, js/audio.js, data/*.js and the game screens say nothing about SI, SI_USE.md has 5 rows (last dated Nov 15) against 453 commits, and the deck GIFs carry no watermark. Fixes are comment, meta, README, SI_USE rows and a label on the pictures; none touch SPEC.md or add a data field. The checked-out branch is still 2.0 (CHANGELOG top is 2.0; README lacks Quick mode), so apply the edits to the 2.1 export or main. The 2.1 export's index.html also loads css/build.css, css/ledger.css, js/ui-verdict.js and js/ui-ledger.js, and its README and CHANGELOG are longer, so patch the 2.1 copies. Caveats: I did not frame-inspect the GIFs, and I skipped the advisor call to stay inside the time limit.

### [should_fix] Guide: images and videos must carry a visible SI watermark

- Where: deck/v2.1/media/*.gif (11 GIFs); GRAVITRON-2.1-mini.pptx holds 13 GIF + 2 JPG + 1 PNG
- Issue: None carries any SI label. The pictures are screen captures of an SI-written game, recorded by an SI-written script (deck/v2.1/scripts/rec.js). Whether a capture of SI-written art counts as an 'SI-generated image' is a judgment call, but the label is cheap and a judge will not read it charitably if absent.
- Fix: Recommendation: label them. (1) Deck, now, 2 minutes: on every slide with a GIF or screenshot add a small semi-opaque text box inside the picture's lower-left corner reading 'Made with SI: capture of the SI-written game'. That is a visible watermark on the slide and needs no re-render. (2) Anything uploaded to the Project page (JPG/PNG/GIF, separate files) must have it baked in. Cheapest: ffmpeg -i in.gif -vf "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='Made with SI':x=8:y=h-th-8:fontsize=14:fontcolor=white:box=1:boxcolor=black@0.6,split[a][b];[a]palettegen[p];[b][p]paletteuse" out.gif (ffmpeg is already used by rec.js:123). Slide 7 already says SI was used (notes-2.1.md:61), keep it.

### [should_fix] Guide: code and data must acknowledge SI in descriptive text

- Where: README.md (no SI mention; 25 lines; the 2.1 export README is longer, append at its end)
- Issue: The repo front page never says SI built the game.
- Fix: Append: '## Made with SI\n\nGRAVITRON was built with SI (super intelligence) tools, as the NASA Space Apps rules ask. The tool was Claude Code (Anthropic); `SI_USE.md` lists where it worked and which models. It wrote much of the code (`js/`, `css/`, `index.html`, `server/`, `tests/`), the data files in `data/` from the sources in `SOURCES.md`, the low-poly art the code draws as the page runs (the game has no image files), the music and sound effects (made by `js/audio.js` with the Web Audio API, no recordings) and the documents, working from the team\'s design mock-up, directions and story. The team decided what the game is: the design, the story, the rules and what counts as realistic. Numbers are labelled sourced, ESTIMATE or GAME VALUE in `data/`. Pictures and GIFs of the game carry a "Made with SI" label. The five font families in `css/fonts/` are third party (see `SOURCES.md`). Mission names such as Explorer 1 and TIROS-1 cite real history; the game draws no NASA logo, flag or mission insignia, and NASA did not make or endorse it.' Paste the same paragraph into the project page's description.

### [should_fix] Guide: code must acknowledge SI in metadata

- Where: index.html <head> (lines 3-6; no meta description, no generator, no SI comment; no package.json or manifest exists)
- Issue: Page metadata is silent about SI. Only <title> and viewport are set.
- Fix: After the viewport meta add: <meta name="description" content="GRAVITRON, a browser game for the NASA Space Apps 2026 challenge Space Mission Design Game: design a satellite, launch it, learn why it flew or failed. Written with SI (Claude Code); see SI_USE.md.">  <meta name="generator" content="Claude Code (SI)">  <!-- SI use: this page, its scripts, styles and data files were written with SI (Claude Code, Anthropic) from the team's design and directions. Record: SI_USE.md. Sources: SOURCES.md. No NASA logo or insignia is used. -->  Do not touch the <footer> text (see next finding). Comments and meta are safe under CLAUDE.md.

### [should_fix] Guide: audio must acknowledge SI in descriptive text and metadata

- Where: js/audio.js lines 1-17 (header says 'No recording, sample, library or file is used' but not who wrote it)
- Issue: The audio is code only (Web Audio oscillators, filtered noise, a generated reverb tail; 387 lines), so there is no audio file whose metadata can be tagged. The header comment is the metadata, and it has no SI line.
- Fix: Insert after line 4 (inside the comment block): ' * SI use: this file was written by an SI (Claude Code, Anthropic). Every sound is code, not a recording, so there is no audio file to tag. Record: SI_USE.md.' Also keep SOURCES.md row 'Music and sound effects' and add 'written by an SI' to its 'Made for this game' cell. If the demo ever has sound (video option), say it in the description text too; the deck GIFs have none.

### [should_fix] Guide: data must acknowledge SI in descriptive text and metadata

- Where: data/*.js (15 files: parts, launchers, orbits, objectives, campaign, contracts, research, tiers, events, debrief, missions, hints, eras, earth, online); line 1 of each is '// data/x.js — owned by ...'
- Issue: No data header mentions SI. SOURCES.md says the SI drafted the data files, and many rows read 'Opened by the SI and checked by yarmee'.
- Fix: Add one comment line after the first line of each file (a comment, not a field, allowed by CLAUDE.md): '// SI use: written with SI (Claude Code, Anthropic) from the sources in SOURCES.md; figures are sourced, ESTIMATE or GAME VALUE. Record: SI_USE.md.' Leave the existing 'owned by' wording alone (names already in files).

### [should_fix] Guide: clearly indicate where and how SI was used (SI_USE.md completeness)

- Where: SI_USE.md (13 lines, 5 rows: four dated Nov 14, one Nov 15; last row ends at the GRAVITRON name and the calibration event)
- Issue: Git has 453 commits (165 on Nov 14, 271 on Nov 15, 17 on Nov 16; 169 authored by Claude; 125 with Co-Authored-By: Opus 5.5 x87, Sonnet 5.5 x32, Fable 5.2 x5, Haiku 5.5 x1). Missing rows by date and area: Nov 14 rules and simulation back end and tests (237bf2d, f20397c, a858c6f, 437f0fb, 3addce3), earth data and live data (f42dc2b, 6f10529); Nov 15 low-poly renderer and models (4bc6c6a, c33352d), motion, part explainers, story and Part 2 comeback (6ec53c8, b256078), loans and credit PR (21075e8, eb8257f, 763e438), lead times and paid part info (9f7dced, f11928a), online leaderboard and duel (5b47e3f, 403ac35), audio (a05622f), UI review docs (f7fa973), versions 1.0 and 2.0 (db161d2, d15b07f), deck 0.9 (9317323, f95b0ee); Nov 16 version 2.1 build (84552d5 credit scores, f29586f BORROW, 78b45db lift-off sound, a3e9c33 music fix, ledger and verdict strips), deck 2.1 (add38dc, e20235a, d8d7365, da66dd5). The last line names Opus 5.5, Fable 5.2 and Haiku 5.5 but omits Sonnet 5.5 (32 commits). The file does name the tool (Claude Code) and the models.
- Fix: Append these rows (same 4 columns):
| Nov 14, 2026 | Claude Code | `js/game.js`, `js/mission.js`, `data/*.js`, `tests/formulas.js`, `tests/redteam/` | Wrote the rules back end (totals, the eight formulas, blockers, warnings), the month-by-month simulation, the first data files and the formula and red-team tests, from `SPEC.md`. Sourced figures cite their page; the rest are labelled ESTIMATE or GAME VALUE. |
| Nov 14, 2026 | Claude Code | `data/earth.js`, `tools/earth_data.py`, `js/live-data.js`, `SOURCES.md` | Wrote the script and data file for the real-Earth numbers and the live open-data calls; opened source pages and filled `SOURCES.md`. A teammate checks each source. |
| Nov 15, 2026 | Claude Code | `js/lowpoly.js`, `js/lp-*.js`, `js/motion.js`, `js/ui-parts.js`, `js/part-story.js` | Wrote the low-poly 3D renderer and every model it draws (Earth, rockets, launch pad, satellite parts, base map, story busts), the motion code and the part explainers. The game has no image files: the code draws all art. |
| Nov 15, 2026 | Claude Code | `js/ui-story.js`, `js/ui-comeback.js`, `data/events.js`, `data/debrief.js`, `data/hints.js`, `data/contracts.js` | Wrote the story screens and Part 2 (the comeback), loans and credit, lead times and paid part information, from the team's story and directions; trimmed events, hints and debrief text. |
| Nov 15, 2026 | Claude Code | `js/audio.js` | Wrote all music and sound effects as code (Web Audio oscillators and noise). No recording or sample is used. |
| Nov 15, 2026 | Claude Code | `js/ui-online.js`, `server/server.js`, `data/online.js`, `ONLINE.md` | Wrote the leaderboard and 1v1 duel screens and the server. They need a server and are off unless one is set up; the game is fully playable without them. |
| Nov 15, 2026 | Claude Code | `docs/ui-review.md`, `handoff/`, `tests/`, `CHANGELOG.md`, `SPEC.md`, `PLAN.md` | Wrote the UI review, handoff notes, unit and browser tests and the changelog for 0.7 to 2.0. |
| Nov 15, 2026 | Claude Code | `deck/GRAVITRON.pptx`, `deck/GRAVITRON-static.pdf`, `deck/briefs.md`, `deck/claims-0.9.md` | Built the first pitch deck, speaker briefs and claims table. |
| Nov 16, 2026 | Claude Code | `js/ui-ledger.js`, `js/ui-verdict.js`, `js/audio.js`, `js/mission.js`, `css/`, `SPEC.md`, `CHANGELOG.md` | Built version 2.1: ledger and verdict strips, Quick mode, real credit scores (300 to 850), BORROW on every Part 2 screen, the rebuilt lift-off sound. |
| Nov 16, 2026 | Claude Code | `deck/v2.1/` | Built the 7-slide 2.1 deck, speaker notes and claims table; recorded the GIFs with `deck/v2.1/scripts/rec.js` from the offline game. The pictures carry a "Made with SI" label. (Add the label first.) |
| Nov 16, 2026 | Claude Code | `README.md`, `index.html`, `js/audio.js`, `data/*.js`, `SI_USE.md`, `SOURCES.md` | Added the SI acknowledgements and header comments. |
Then replace the last line with: 'With Claude Code as the harness, the models used were Claude Opus 5.5, Claude Sonnet 5.5 and Claude Fable 5.2, with Haiku 5.5 used for subagents (from the Co-Authored-By trailers in git).'

### [should_fix] Privacy (minors) when pasting SI_USE.md into the public project page

- Where: SI_USE.md row 1: 'Put angads22 on the Rules, Simulation and Design screens roles'
- Issue: QA copies this file to the project page, which would publish a team member's GitHub handle; the deck deliberately leaves names off (notes-2.1.md:65, claims-2.1.md:35).
- Fix: In the pasted copy (and ideally the file) change to: 'Assigned the Rules, Simulation and Design screens roles in `SPEC.md`. Started this record.' Do not touch SOURCES.md 'checked by yarmee' rows beyond your own decision.

### [nice_to_have] Guide: say where SI was used, visible to players

- Where: index.html:36 footer; no About or credits screen (grep of index.html, js/, css/, data/ for SI|Claude|generated finds nothing)
- Issue: No in-game SI line. Do NOT append text to the footer: SPEC.md:215 says the host needs the footer in the form 'GRAVITRON v2.1', and tests/version.js matches '<footer[^>]*>[^<]*\bvX.Y\s*</footer>'. js/audio.js inserts the MUSIC and SOUNDS buttons into .foot, and the home screen already uses the bottom edge (css/style.css:853 .is-home .foot, :928 .title-foot).
- Fix: Zero-risk: <footer class="foot" title="Made with SI (Claude Code). See SI_USE.md.">GRAVITRON v2.0</footer> (an attribute only; tooltip, not visible on touch). A visible line is optional and needs a 1366x768 and phone check first, so skip it under time pressure; the guide asks for descriptive text and metadata for code, which the edits above supply.

### [nice_to_have] Mission identifiers (judgment call)

- Where: data/missions.js (Explorer 1, Vanguard 2, TIROS-1, SOLRAD 1, Seasat, Terra, GOES-16, Alouette 1, RADARSAT Constellation, ICEYE, FOREST); data/parts.js and launchers.js (Explorer 4, OSO 1, Nimbus 1, OGO 1, Juno I, Vanguard, Thor-Able); js/lp-parts-body.js:177-225 'Explorer-style cylinder' with the striped tube; ui-design.js:1003 and lp-people.js:6,309 'your NASA team'
- Issue: The guide's 'mission identifiers' means branding (mission logos, patches, insignia), not factual names. Naming real missions as history in text, with agency and year, is a plain reference, not SI-generated branding; I judge it low risk but it is a judgment call. The Explorer body is a plain striped cylinder, no insignia. The 'NASA colleagues' portrait label puts invented characters under the NASA name.
- Fix: Safest wording: keep names as plain text with agency and year, never draw a patch or emblem, and say once (README line above, project page): 'Mission names are used only to cite real history; this game is not made or endorsed by NASA.' Optional: change the labels at ui-design.js:1003 and lp-people.js:309 from 'Portrait of your NASA team: two colleagues...' to 'Portrait of your team: two colleagues...'. Under-18 rule: the only people drawn are fictional low-poly busts (lp-people.js); no photos or real likenesses in the repo or in the deck images I opened (image-2-2.jpg text panel, image-5-3.jpg game screen, image-7-1.png QR code).

### [nice_to_have] References must be accurate and complete

- Where: SOURCES.md: row 'Pixelify Sans and VT323 (web fonts) ... index.html (loaded from Google Fonts)'; second 'Real missions for the debrief comparison' row (contains 'NASA, YesAA, CSA', a find-and-replace corruption); css/fonts/ has no licence files
- Issue: The Google Fonts row is stale (index.html comments at lines 7-8 say fonts are self-hosted, no request to Google Fonts) and duplicates the Fontsource row. The second 'Real missions' row is a corrupted duplicate. OFL asks the licence text to travel with the fonts. If a QR generator made image-7-1.png, it is a tool to list.
- Fix: Delete both stale rows. Add to the fonts row: 'Licence texts: https://openfontlicense.org (OFL 1.1) and https://www.apache.org/licenses/LICENSE-2.0 (Special Elite).' Add a Tools row 'QR code generator (name it) | Tool | link | slide 7 QR code' only if one was used.

### Needs a team decision

- Treat the deck GIFs and screenshots as SI-generated images and label them (recommended), or argue they are plain screen captures and rely on the slide 7 SI text? Labelling costs about 2 minutes in Slides.
- Name the tool and models on the public project page? The deck deliberately does not, but the form field and SI_USE.md must (notes-2.1.md:66). Recommended: name them in the SI field and SI_USE.md, not on slides.
- Footer: index.html and the export still show 'GRAVITRON v2.0' while SPEC.md says version 2.1 and SPEC.md:215 requires the footer to read 'GRAVITRON v2.1' for the host; node tests/version.js fails 1 check (SPEC 2.1 vs changelog 2.0). Outside my brief, flagging only. Any SPEC.md edit must go straight to main in its own commit (CLAUDE.md).

## Deck against the slide rules

Both decks stay within 7 slides, are in English, name the challenge, show the game, describe the UX, and carry no NASA logo or real person. The LIVE deck has two gaps that matter for judging. It shows no visible SI use (the guide says judges see SI indicators inside the project, not the form answer). It also still says 793 checks (984 counted on release/v2.1). The REDESIGN covers SI use but omits member names, which the guide's slide tips list. Several claims in both decks need softening (699,369, lead-time and game-value wording, unlabelled fiction, NSIDC/SILSO labels). Font sizes come from the PDF export (960 x 540 pt page, so pt are true). Only text in screenshots is unreadable in either deck.

### [blocker] SI use must be visible in the project (guide p.7: audio and code need descriptive text; judges see indicators, not the form answer)

- Where: LIVE slide 7, elem_105 (right column, y 4.3 in; free space below it to y 6.2)
- Issue: No visible SI statement anywhere on the 7 slides. Guide text: 'This SI question ... your response will not be seen by the judges. However, judges will be able to see any SI-generated indicators within your project'. SPEC.md:1271 says the deck carries no tool credits and the form field does, which the guide contradicts.
- Fix: elem_105: 'REFERENCES\nEvery source is listed in SOURCES.md.' -> 'SI USE AND REFERENCES\nThe idea, story and rules are ours. SI wrote much of the code, tests and docs from our design. Our pictures are screenshots of the game. Sources: SOURCES.md.' (no tool or model names, per team rule).

### [blocker] Figures must trace to a repo file; 984 checks across 17 suites counted on release/v2.1

- Where: LIVE slide 7, elem_91
- Issue: Says 793 automated checks. Stale against the counted 984 across 17 suites (deck/v2.1/claims-2.1.md row 7). REDESIGN slide 7 already says 984 across 17 suites.
- Fix: elem_91: '793 automated checks pass' -> '984 automated checks pass across 17 suites'. If the public game link serves a different build, drop the number: 'automated checks pass'.

### [should_fix] DO NOT CLAIM anything about data/result_master.csv

- Where: LIVE slide 2, elem_74; REDESIGN slide 2, CSA ALOUETTE card
- Issue: 699,369 ionosphere soundings is the row count of result_master.csv (SOURCES.md:23). It is also the only partner-agency figure, so removing it weakens the CSA story. Team decision needed.
- Fix: LIVE elem_74: 'CSA ALOUETTE\n699,369\nionosphere soundings' -> 'CSA ALOUETTE · CANADA\nAlouette 1\nionosphere sounder, 1962'. REDESIGN: same swap on the 4th card ('699,369' -> 'Alouette 1', 'ionosphere soundings' -> 'ionosphere sounder, 1962'). Source for 1962: SPEC.md:316 and SOURCES.md:24.

### [should_fix] Label each source NASA vs partner vs other; do not call NSIDC/SILSO NASA data

- Where: LIVE slide 2, elem_71, elem_72, elem_73, elem_74; REDESIGN slide 2, four card headers
- Issue: NASA FIRMS and NASA EONET are NASA. NSIDC is 'NSIDC (NASA DAAC) / NOAA' with a NOAA-hosted URL (SOURCES.md:19), so it is not flatly NASA. SILSO is the Royal Observatory of Belgium, CC BY-NC 4.0 (SOURCES.md:22), neither NASA nor a space-agency partner. CSA is the partner agency. CWFIS is Natural Resources Canada, not CSA. Only the CSA card is tagged in REDESIGN ('(CANADA)').
- Fix: LIVE elem_72: 'NSIDC SEA ICE INDEX' -> 'NSIDC SEA ICE INDEX · NOAA'. elem_73: 'SILSO SUNSPOTS' -> 'SILSO SUNSPOTS · BELGIUM'. elem_74: see previous row. Keep 'NASA FIRMS' as is. REDESIGN: 'NSIDC SEA ICE INDEX' -> 'NSIDC SEA ICE INDEX (NOAA)', 'SILSO SUNSPOTS' -> 'SILSO SUNSPOTS (BELGIUM)'.

### [should_fix] Names of team members (guide slide tips) vs under-18 clause

- Where: LIVE slides 1 (elem_7) and 7 (elem_103); REDESIGN slides 1 and 7 (team block, roles only)
- Issue: Guide slide tips: 'Ensure that the content of your slides address the following: Team name / Names of team members / The challenge your team selected.' The under-18 clause covers 'images, video, audio, or other likeness' of persons under 18; it does not mention names. LIVE meets the tip (first names). REDESIGN omits names, so it misses the tip as written. The 'local event' rule on minors' names appears only in claims-2.1.md and I could not verify it. Ages are unknown. Both decks also use Austin and Ajay as story characters (SOURCES.md:33 says they are invented), so removing names from the team block only partly separates them.
- Fix: Options only: (a) keep names (LIVE as is; add back to REDESIGN slides 1 and 7 if all are 18+ or the organiser allows). (b) keep team name and roles, put names only on the project page. (c) first names only, as LIVE does now.

### [should_fix] Game values and unverified lead times must not read as real fact

- Where: LIVE slide 3: n20_210, n20_258, n20_206; slide 5: n20_284
- Issue: n20_210 says the dossier holds a 'real-world lead time', but lead_months is a GAME VALUE rounded from a spoken engineers' quote, marked NEEDS HUMAN CHECK (SOURCES.md:37; SPEC.md:178). It also says 'On Hard', while the table beside it shows Normal also pays. n20_258 states real-programme behaviour as fact. n20_206 and n20_284 state game dollars and months without saying 'game'.
- Fix: n20_210: 'On Hard you pay to learn a part’s sheet, results and dossier. The dossier holds its real-world lead time. Fees show in the debrief.' -> 'On Normal and Hard you pay to learn a part’s facts. The dossier holds a lead-time estimate rounded from what the engineers told us. Fees show in the debrief.' | n20_258 (after the 'WHY IT MATTERS' label): 'Real programmes lose months to one slow part, pay to learn what a part can do, and fund research with both money and data.' -> 'Satellite engineers told us real programmes can lose months to one slow part. We turned that into game rules.' | n20_206: 'A 12-month imager makes a 17-month flight: $3.5M of interest on a $40M debt.' -> 'In the game, a 12-month imager makes a 17-month flight: $3.5M of game interest on a $40M game debt.' | n20_284: '16 months cost $3.32M.' -> 'in this run, 16 months cost $3.32M of game money.'

### [should_fix] Say where SI was used (audio, code) and do not imply unhosted features are playable

- Where: LIVE slide 7, n20_291
- Issue: Heading 'NEW IN 2.0' is the wrong label for a 2.1 build, and listing the leaderboard and duel under it suggests they play. Music and sound are made by SI-written code but the line does not say so; the guide wants audio acknowledged in descriptive text. REDESIGN already says 'NOT FINISHED' for the server features.
- Fix: n20_291: 'NEW IN 2.0' -> 'ALSO IN THE GAME'; 'Leaderboard and 1v1 duel (server not hosted yet)' -> 'Leaderboard and 1v1 duel: built, not playable (server not hosted)'; 'Music and sound, made in the browser' -> 'Music and sound, made in the browser by SI-written code'. REDESIGN slide 7 'Music and sound made in the browser' -> 'Music and sound made in the browser by SI-written code'.

### [should_fix] Story is fiction, and the deck should say so

- Where: LIVE slide 6, elem_53; REDESIGN slide 5 kicker
- Issue: Neither title says the 1958 story and its characters are invented (SOURCES.md:33: Voss, Austin, Ajay, Priya and Iron Eclipse are invented). A judge could read '1958' and 'Austin Albert' as history.
- Fix: LIVE elem_53: 'Story: 1958 and today' -> 'Story (fiction): 1958 and today'. REDESIGN: 'STORY' -> 'STORY (FICTION)'.

### [should_fix] Readable font size (guide: 'readable font size'; 12 pt is the brief's threshold)

- Where: LIVE slides 1 to 7; REDESIGN slides 1 and 2
- Issue: LIVE text under 12 pt: slide 1 labels 9 pt (PROBLEM, SOLUTION, WHY IT MATTERS), footer elem_8 10.5 pt, team label and blurbs 11 pt; slide 2 card headers, chart title and rules bar 9.5 pt, captions 11 to 11.5 pt, elem_86 11 pt; slide 3 about 130 words at 8 to 11 pt (table heads 8 pt, cards 9 to 9.5 pt); slide 4 labels 8.5 to 10.5 pt, WHY IT WORKS 11.5 pt; slide 5 labels 8.5 to 9.5 pt, body 11.5 pt; slide 6 seven chips elem_62 to elem_68 at 7.5 pt (smallest in either deck), part labels 10.5 pt; slide 7 about 48 words at 10.5 to 11.5 pt. Page numbers are 8.5 pt. REDESIGN: smallest is 10 pt (slide 1 eyebrow, slide 2 card labels, 31 words); all body text is 12 pt or more.
- Fix: Lowest effort: LIVE slide 6, select elem_62 to elem_68 and set 9 pt (long labels may wrap to two lines). Slide 3 table heads n20_237/238/239 to 9 pt. REDESIGN: eyebrow 'NASA SPACE APPS 2026 · SPACE MISSION DESIGN GAME' -> 'Challenge: Space Mission Design Game' at 12 pt (also names the challenge explicitly).

### [nice_to_have] Limit words per slide when possible

- Where: LIVE slide 3 (240), slide 4 (150); REDESIGN slide 7 (173)
- Issue: Word counts, LIVE slides 1 to 7: 79, 129, 240, 150, 118, 92, 131. REDESIGN: 93, 156, 87, 94, 106, 99, 173. Counts include chart labels and page numbers. LIVE slide 3 is the heaviest. REDESIGN is lighter on slides 3 to 5 but slide 7 is dense.
- Fix: LIVE slide 3: delete caption n20_236 and line n20_252 (about 28 words, both repeat the table or chart). REDESIGN slide 7: delete 'ALSO IN 2.1' block.

### [nice_to_have] Version labels must match the build shown

- Where: LIVE slide 1, elem_8; REDESIGN slide 1 'Version 2.1' line
- Issue: claims-2.1.md says the release footer still reads v2.0 until the team cuts the version. LIVE says 'v2.0' while its slides 4 and 5 use 2.1 images. REDESIGN says 'Version 2.1' while its own screenshot footer reads v2.0.
- Fix: LIVE elem_8: 'A browser game in plain HTML, CSS and JavaScript  ·  v2.0' -> 'A browser game in plain HTML, CSS and JavaScript'. REDESIGN: 'Version 2.1 · a browser game in plain HTML, CSS and JavaScript' -> 'A browser game in plain HTML, CSS and JavaScript'.

### [nice_to_have] External facts need a checked source

- Where: REDESIGN slide 2 'WHY IT FEELS REAL'; LIVE slide 2 elem_76
- Issue: 'as Sputnik 1 did after 21 days' is not in SOURCES.md (row 33 says only that Sputnik's beeps were heard; page not opened). The 92/100/69 percent orbit shares come from earth.js orbit_view and look like a game model, but I did not check how they are computed. FIRMS, NSIDC, SILSO and Alouette rows are 'Downloaded and processed', not marked checked, so the decks must not say verified (they do not).
- Fix: REDESIGN: 'A battery-only satellite goes silent, as Sputnik 1 did after 21 days.' -> 'A battery-only satellite goes silent when its battery runs out.' LIVE elem_76: add ' (GAME MODEL)' at the end if earth.js confirms they are modelled.

### [nice_to_have] Public access and QR

- Where: LIVE slide 7 QR (g2cac52c432f0d61d_1); REDESIGN slide 7 'Scan to play'
- Issue: LIVE: QR sits tight under bullet 4 and has no caption. Its target was not decoded here (claims-2.1.md: copied from the earlier deck, team says it works). REDESIGN: no public link yet, the PDF shows only first frames of the GIFs (static), and 'Scan to play' promises a hosted game that I could not confirm.
- Fix: Open the deck link and the QR in a private window and confirm both work with no sign-in. LIVE: add a 'Scan to play' text box under the QR if the target is the hosted game.

### Needs a team decision

- Names of team members: the guide's slide tips list them; the under-18 clause covers images, video, audio or likeness only. LIVE shows first names; REDESIGN omits them. The 'local event' rule on minors' names is only in deck/v2.1/claims-2.1.md and is unverified. Ages are unknown. The characters Austin and Ajay appear in both decks.
- 699,369 Alouette soundings: this is the result_master.csv row count (SOURCES.md:23). Dropping it follows the no-claims rule but removes the only partner-agency number on slide 2.
- NSIDC Sea Ice Index: SOURCES.md says 'NSIDC (NASA DAAC) / NOAA'. Decide whether to list it under the NASA Data field or under Other References.
- SI line on the deck: the guide says judges do not see the form answer, so the deck needs a visible SI line. SPEC.md:1271 says no tool credits on the deck, so decide whether to name the tool and models or keep it generic.
- Which build the public game link serves: 984 checks and the 2.1 features hold only for release/v2.1. Decide between the wording 'Version 2.1' and no version label.
- SILSO is CC BY-NC 4.0 (Royal Observatory of Belgium): confirm non-commercial use is acceptable and credit it in Other References.

## People under 18, names, originality

Game and deck show no photos, audio or faces of real people (no image/audio assets in the repo; sound is synthesised; busts are generic low-poly; Austin and Ajay have no face). No ages are recorded anywhere. Real teammate names do sit in the public repo: SPEC.md line 3 has a full name, many docs have first names, and SOURCES.md (to be pasted into the form) credits "yarmee". The one yes/no question for the team is whether every member is 18 or over. SOURCES.md has real gaps: Inter and Roboto Mono (deck fonts), two stale or duplicate rows, a Sputnik row that contradicts itself, and no OFL licence text shipped with css/fonts. No copyrighted material found; real company names are used only as plain-text references.

### [should_fix] Real teammate full name in public repo

- Where: SPEC.md line 3 ('Nov 13, 2026 · @Yareem Al-Eryani'); SPEC.md lines 1146-1149, 1157 (Team roles: Yareem, angads22)
- Issue: The only full real name in the repo, in the source-of-truth spec on a public GitHub repo. If the project link points at the repo, it is public. Names of minors are barred by the local event rules.
- Fix: Only if the team answers 'under 18' or 'unknown': change line 3 to 'Nov 13, 2026 · Data lead' and the roles table to roles only. CLAUDE.md says SPEC.md edits are pushed to main immediately in their own commit. Do not edit before the team answers. Safer alternative for the public link: point the Final Project link at the hosted game, not the repo.

### [should_fix] Names/handles that go into the submission form

- Where: SOURCES.md lines 20, 21, 25 ('checked by yarmee'); SI_USE.md line 7 ('Put angads22 on ... roles'); LICENSE line 3 ('Copyright (c) 2026 angads22')
- Issue: SOURCES.md is pasted into the References field and SI_USE.md into the SI field, so these handles would appear on the public project page. LICENSE is shown on the repo front page. Handles can identify a person.
- Fix: In SOURCES.md lines 20, 21, 25 replace 'Opened by the SI and checked by yarmee' with 'Opened by the SI and checked by a team member'. In SI_USE.md line 7 replace 'Put angads22 on' with 'Assigned the team roles on'. LICENSE: 'Copyright (c) 2026 Hackstreet Bros' (needs the team's yes). Same answer-first rule applies.

### [nice_to_have] First names in public docs and code comments

- Where: HANDOFF.md, PLAN.md, docs/ui-review.md, docs/real-world-plan.md, handoff/*.md, deck/briefs.md, deck/claims-0.9.md, tests/redteam/REPORT.md ('Yareem', 'Angad'); .github/CODEOWNERS; first line of data/*.js and js/live-data.js ('owned by Data (yarmee)'); git author lines (angads22, yarmee; 14 commits carry a personal gmail address)
- Issue: Not user-facing in the game screens (index.html, js and css show no teammate name; footer reads only 'GRAVITRON v2.0'). They are visible to anyone who opens the repo or view-source. A personal email address is in git history for 14 commits.
- Fix: Do not rewrite history with under two hours left. Instead keep the Final Project link on the hosted game and leave the repo link out of the form (or accept the exposure if all members are 18+).

### [should_fix] Story characters share first names with two teammates

- Where: js/ui-design.js (Austin 26 hits, Ajay 19), js/mission.js (Ajay 27), data/campaign.js, data/contracts.js, SPEC.md lines 20, 225, 233
- Issue: Guide bars 'images, video, audio or other likeness' of under-18s. A fictional character named Austin Albert or Ajay Albert is text, not an image or likeness, and neither has a face in the game, so the plain reading does not cover them. Risk is a judge reading 'Ajay, a reckless founder in debt whose girlfriend leaves him' as a teammate if the slides also name Ajay or Austin. Code comments already say 'Voss, Austin, Ajay, Priya and Iron Eclipse are invented' (js/ui-design.js line 158) and SOURCES.md says the same.
- Fix: No code change. Add one line to the Detailed Project Description and slide 7 notes: 'All story characters (Austin Albert, Ajay Albert, Priya, Voss) and companies (Iron Eclipse, Albert Orbital) are fictional; any likeness to real people is coincidental.' Do not put the characters' portraits or names on the same slide as team names. Ask the two teammates if they are comfortable; if not, rename characters, but that touches data and text fields so it needs the owner's approval per CLAUDE.md.

### [should_fix] SOURCES.md gap: deck fonts not listed

- Where: deck/v2.1/scripts/lib_deck.js line 8 (F = Inter, Inter, Roboto Mono); SOURCES.md
- Issue: Inter and Roboto Mono are used for all deck text and labels but have no row. The game itself does not use them (index.html loads no Google Fonts; css/style.css lines 49-55 declare only Pixelify Sans, VT323, Courier Prime, Special Elite, Stardos Stencil).
- Fix: Add rows to the main table. Inter | Rasmus Andersson, SIL Open Font License 1.1 | https://fonts.google.com/specimen/Inter | Deck 2.1 slide text (not in the game) | No. Roboto Mono | Christian Robertson, Apache License 2.0 | https://fonts.google.com/specimen/Roboto+Mono | Deck 2.1 labels (not in the game) | No.

### [should_fix] SOURCES.md gap: tools and libraries not listed

- Where: SOURCES.md 'Tools and other resources' last paragraph ('No third-party code libraries or images are used')
- Issue: deck/v2.1/scripts/lib_deck.js and build_deck.js require pptxgenjs, and cap/rec scripts require playwright (GIF recording). Node.js runs tests, tools and server. The line is true for the shipped game but the form field says list ALL tools.
- Fix: Add rows. pptxgenjs | Library, MIT | https://github.com/gitbrent/PptxGenJS | Built the PPTX deck (deck/v2.1/scripts/build_deck.js). Playwright | Tool, Apache 2.0 | https://playwright.dev | Recorded the deck GIFs (deck/v2.1/scripts/rec.js). Node.js | Runtime, MIT | https://nodejs.org | tests/, tools/, server/, deck scripts (not in the shipped game). Google Slides / Canva/Figma if used for the final deck: add as tools. Change the closing sentence to: 'No third-party code or images ship in the game; build tools are listed above.'

### [should_fix] SOURCES.md stale and duplicate rows

- Where: SOURCES.md: last data row 'Pixelify Sans and VT323 (web fonts) ... index.html (loaded from Google Fonts)'; duplicate 'Real missions for the debrief comparison' rows (one says NOAA, one says 'YesAA')
- Issue: Last font row contradicts index.html line 7 and the earlier Fontsource row (self-hosted, no Google Fonts request). The duplicate mission rows carry a typo 'YesAA'. A judge reading the References field sees contradictions.
- Fix: Delete the last 'Pixelify Sans and VT323 (web fonts)' row and the second 'Real missions for the debrief comparison' row (the one with 'YesAA').

### [should_fix] SOURCES.md row contradicts itself

- Where: SOURCES.md Sputnik 1 row (Checked column says 'Checked and opened by a human.' while the Agency column says the NASA page was not opened and the link is 'to be confirmed')
- Issue: Violates the house rule that unchecked sources are not claimed as verified. Also the CHANGELOG/deck must not say Sputnik facts are verified.
- Fix: Change the Checked cell to 'NOT OPENED, NEEDS HUMAN CHECK' unless a teammate opens a NASA Sputnik 1 page now and pastes its real URL into the Link cell.

### [should_fix] OFL and Apache licence text not shipped with the fonts

- Where: css/fonts/ (7 .woff2 files, no licence or OFL text file); css/style.css lines 37 and 46 mention the licences only in comments
- Issue: SIL OFL 1.1 condition 2 requires the copyright notice and licence text to accompany every copy of the Font Software (a text file or font metadata). Pixelify Sans, VT323, Courier Prime and Stardos Stencil are OFL; Special Elite is Apache 2.0 (needs the licence text and attribution). I could not read the woff2 name tables here (no fontTools), so I cannot confirm the files carry the notice in metadata. Roboto Mono and Inter are not in the game, so no files to ship.
- Fix: Add css/fonts/LICENSES.md with one line per font: 'Pixelify Sans: Copyright The Pixelify Sans Project Authors, SIL OFL 1.1', 'VT323: Copyright The VT323 Project Authors, SIL OFL 1.1', 'Courier Prime: Copyright The Courier Prime Project Authors, SIL OFL 1.1', 'Stardos Stencil: Copyright The Stardos Stencil Project Authors, SIL OFL 1.1', 'Special Elite: Copyright astigmatic, Apache License 2.0', then the OFL 1.1 text (https://openfontlicense.org/open-font-license-official-text/) and the Apache 2.0 text. Copy the exact copyright lines from the LICENSE file of each @fontsource package (version 5.3.0) before pasting; mark Checked as No until done. Link it from SOURCES.md font row.

### [should_fix] Data licence and acknowledgement text missing

- Where: SOURCES.md rows for NASA FIRMS, SILSO, CSA Alouette (data/earth.js)
- Issue: No licence or acknowledgement wording. FIRMS asks for an acknowledgement. SILSO is CC BY-NC 4.0 (already noted; the game must not be sold). CSA data is under CSA Open Data terms (Open Government Licence - Canada), not stated. Claim nothing about data/result_master.csv beyond the row as it stands.
- Fix: Append to the FIRMS row: 'Acknowledgement: We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS)'. Append to the SILSO row: 'Attribution: SILSO World Data Center, Royal Observatory of Belgium; non-commercial use'. Append to the CSA Alouette row: 'Licence: CSA Open Data terms (to be confirmed on the download page); source credited to the Canadian Space Agency'. Checked stays 'Downloaded and processed'.

### [should_fix] SI watermark on deck pictures (originality tie-in)

- Where: deck/v2.1/media/*.gif (11 GIFs), deck/v2.1/GRAVITRON-2.1.pdf
- Issue: The guide wants SI-generated images and videos to carry a visible watermark. The GIFs are recordings of a game built and drawn by code that an SI wrote. I did not check whether each slide shows a visible 'made with SI' mark.
- Fix: Confirm each deck slide with a game picture carries a visible line such as 'Game art and code made with SI (Claude Code); see SI_USE.md'. Other reviewers may cover this.

### Needs a team decision

- YES/NO: Is every team member 18 or older on the day of submission? Yes means names may go on slides 1 and 7. No, or anyone unsure, means roles only. Whichever the answer, also decide whether the repo link goes in the form, since the repo shows names and handles.
- If the answer is 'unknown/not all': safest slide 7 text is 'Team Hackstreet Bros. Data and rules; UI and UX; story; game experience. Challenge: Space Mission Design Game.' No names, photos, avatars or voice. Name the team members only through the NASA team page, which the Space Apps platform already lists.
- Ages: I found nothing about any teammate's age, birth date, grade or school in the repo (searched age, under 18, minor, birth, grade, high school, teenager, years old). Only the deck notes (deck/briefs.md line 58, deck/claims-0.9.md line 54, deck/v2.1/notes-2.1.md line 65, deck/v2.1/claims-2.1.md line 35) say ages are unknown and names were left off on purpose.
- Do the two teammates called Austin and Ajay accept fictional characters with their first names (Ajay is a debtor founder)? If not, renaming characters needs the owner's approval (CLAUDE.md: no renaming data fields without asking).

## Public link, QR, hosting

The QR decodes (OpenCV) to https://makeitoutthegc.ca/hack, the team's event-host ("Pitstop") server, not GitHub Pages. I could NOT verify that link: the sandbox proxy returns 403 for makeitoutthegc.ca and *.github.io, so a human must test it. GitHub Pages is NOT enabled on the repo (has_pages=false, no deployments, no workflow, no gh-pages branch, no CNAME), so https://angads22.github.io/Hackstreet_Bros_Satellite/ would 404 today. All 11 deck GIFs return 200 image/gif. Team deck is public (anyone with link, viewer); standalone 13-GIF deck is private (owner only). Recommended "Link to Final Project" and QR: https://makeitoutthegc.ca/hack, only after a private-window and phone-on-mobile-data test passes. Backup: enable Pages on main and use the github.io URL.

### [blocker] Link to Final Project must open with no login in a private window

- Where: deck/v2.1 assets/qr.png (slide 7, 'Scan to play'); deck/v2.1/claims-2.1.md:34
- Issue: QR decodes to https://makeitoutthegc.ca/hack. Unverified: the sandbox proxy answers 403 to that host, so status, redirects and content type are unknown. claims-2.1.md only says 'copied from the earlier deck; the team says it works'. deck/v2.1/HANDOFF-server-agent.md says the game is served at /hack/app/<token>/ with a token that changes on every page load, so a stable entry is unconfirmed.
- Fix: A human opens https://makeitoutthegc.ca/hack in a private window on a laptop and scans the QR on a phone using mobile data. Pass = home page shows, START works on Part 1 and Quick mode, no sign-in, no password, no registration, and it still works the second time (token changes). If any step fails, use the backup in the next finding.

### [should_fix] Know what is deployed; do not claim GitHub Pages

- Where: SPEC.md:1179 and :1199; repo settings
- Issue: SPEC says main 'deploys to GitHub Pages on every merge', but Pages is off: GitHub repo API has_pages=false, homepage null, deployments [], .github holds only CODEOWNERS (no pages workflow), branch list has no gh-pages, no CNAME file. So the github.io address does not exist. No README, ONLINE.md or handoff doc names a live play URL (ONLINE.md:25 and server/README.md:29 only use https://angads22.github.io as an example).
- Fix: Backup, a human step by the repo owner (about 2 minutes plus build): Settings > Pages > Source 'Deploy from a branch' > main > / (root) > Save. The game uses relative URLs only, so it works under /Hackstreet_Bros_Satellite/. The leaderboard and duel stay off there (ONLINE.endpoint is empty), which is correct. Then test https://angads22.github.io/Hackstreet_Bros_Satellite/ in a private window. Per CLAUDE.md, fix SPEC.md:1179 only on the team's say-so, pushed to main in its own commit.

### [should_fix] Say which build is public (v2.0 vs v2.1)

- Where: origin/main index.html:36; origin/release/v2.1 index.html:36
- Issue: Public build could not be read (host blocked). The host serves 'a clone of main' (SPEC.md:215). Footers: release/v2.0 'GRAVITRON v2.0', release/v2.1 'v2.1', release/v2.2 'v2.2', main (5472fc7, Nov 15, 'Finalize Source Checks') 'v2.2' while SPEC.md says current version 2.3. data/campaign.js has the credit block on ALL of v2.0, v2.1, v2.2 and main, so it does not tell them apart; only the footer does. The deck is built on v2.1 (984 checks, 17 suites).
- Fix: Open the public link, read the footer, and make deck slides 1 and 7 say that same version. If the host is still on v2.0 or older than the deck's screenshots, say so in the notes or re-pull the host. Do not call the numbers '984 checks' unless the live version is the one tested.

### [should_fix] Demo link must be public with no login

- Where: Google Drive 1FCQmRXNEPsOxXlr9oXis5UMQalHhJYWdb0ISp8AqFcI vs 19fjp-srXKrkozmTz8Kr8lq0rKjnsMfGCgbQHXl0nF80
- Issue: Team deck (1FCQ...): anyoneWithLink = reader, so it opens with no login (public view); four named editors plus the owner. Standalone 13-GIF deck (19fjp...): owner only, so it is PRIVATE and fails the guide's rule. Sharing was not changed.
- Fix: Use the team deck link for 'Link to Project Demo'. If the team wants the 19fjp... deck instead, a human sets it to Anyone with the link, Viewer, then tests it in a private window. Also confirm the 7-slide limit and that no names or under-18 likeness are on the slides.

### [should_fix] FortiGuard Web Filter Classification for a new website

- Where: Link to Final Project field; guide page 5
- Issue: The play link is on makeitoutthegc.ca, an event-host site, not github.io, so the guide's 'new website' recommendation applies. A human must submit it; classification is at Fortiguard's discretion and optional but prevents judge access problems. I did not submit.
- Fix: On the FortiGuard Web Filter Classification form (link is in the guide's Step 'Complete the FortiGuard Web Filter Classification form'): URL = https://makeitoutthegc.ca/hack ; Category = 'Web-based application' (guide's own example; pick the closest listed option, NASA cannot choose for you) ; Company Name = N/A. Fill any other required field (such as a contact address) with an adult's or a team mailbox, not a minor's name. If the backup is used, also request https://angads22.github.io/Hackstreet_Bros_Satellite/ the same way.

### Needs a team decision

- Is https://makeitoutthegc.ca/hack the stable public entry (the handoff says the page URL carries a token that changes per load)? A human must test it in a private window and on a phone, because the sandbox cannot reach it.
- Enable GitHub Pages on main as a backup link (repo owner, about 2 minutes) and, if used, replace the QR and field value together?
- Which Drive deck is the demo link: the public team deck 1FCQ... (already anyone-with-link) or the private standalone 19fjp... (needs a human to share it)?
- Submit the FortiGuard request now for makeitoutthegc.ca/hack, and who is the adult contact for the form?
- SPEC.md:1179 and :1199 say Pages deploys on merge but it is off; correct it (own commit pushed to main, per CLAUDE.md) or leave it?
