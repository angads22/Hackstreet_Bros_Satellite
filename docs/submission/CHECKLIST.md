# Before you press Submit for Judging

For the person who submits GRAVITRON 2.1. The words for each field are in `FORM.md`. Work down this list; every box is something only a person can do. Written November 16, 2026 against `origin/main` at `3647062` ("Version 2.1").

The window closes **Sunday, November 15 at 11:59 p.m. in the Local Event's time zone** (`SPEC.md`, "Submission checklist"). Only the last saved submission is judged, and a team can resubmit until the window closes, so submit early and fix after.

## 1. Fill the six blanks in FORM.md

Search `FORM.md` for `[TEAM`. None may reach the form.

- [ ] Field 3: the link to the demo (the deck or the video).
- [ ] Field 4: the address of the hosted game. No hosted address is written anywhere in the repository.
- [ ] Field 6: any other SI tool a teammate used, or delete the bracket.
- [ ] Field 6: who wrote the story of Austin and Ajay. The repository says the team gave the story and the SI put it into the screens (`SI_USE.md`, the November 15 row); later story text (Mara, the parents' letter) has no record.
- [ ] Field 6: the list of what people did. Correct it; do not leave a claim nobody can stand behind.
- [ ] Field 8: the link for the Sputnik 1 row (see section 5).

## 2. The links

- [ ] Open every link in a **private window**: it must open with no login, permission or registration. A project the judges cannot open is not judged.
- [ ] The repository `https://github.com/angads22/Hackstreet_Bros_Satellite` is **public**. (Not checkable from here.)
- [ ] The hosted game shows **GRAVITRON v2.1** in its footer. If it shows v2.0, the host is serving an old copy: redeploy `main`.
- [ ] Play one flight on the hosted game in the private window: QUICK MODE, QUICK FLIGHT, to the debrief.
- [ ] The demo is hosted on YouTube, Google Drive, GitHub, OneDrive or Dropbox. The form takes images only (JPG, PNG, GIF up to 10 MB), not a video or a document.
- [ ] Optional: ask for a FortiGuard Web Filter classification for the hosted address (category "web-based application", company "N/A").

## 3. The demo: at most 7 slides, or a video of 30 seconds or less

Over either limit, the project is not eligible for Global Judging. Everything in English.

The deck in the repository (`deck/GRAVITRON.pptx`, last changed November 15) is the **0.9 beta deck**. Seven slides, so the count is right, but these are out of date:

- [ ] Slide 1 says "v0.9 beta" and "Team: [__]". Put the team name and v2.1.
- [ ] Slide 6 is "Two parts, one story". There are three modes now: add Quick mode, and the credit score is 300 to 850 (the slide says credit "runs out").
- [ ] Slide 7: the test counts are old (it says api 121, comeback 90, debrief 23, saves 32; today api 143, comeback 151, debrief 35, saves 35). It says "22 events" (there are 27) and lists launch failures as "Next" (they are built). It names "balance 53 (3 known gaps)", which was not re-run for 2.1: take it off or re-run it.
- [ ] Slide 7 says "Works on a phone". `CHANGELOG.md` (2.0, "Not in this version yet") says the phone layout for Build is not built. Take the claim off unless someone checks it on a phone.
- [ ] Slide 7 has `[__]` where three names go.
- [ ] The deck must show: team name, the members' names, the challenge, an image of the project, the user experience, and how NASA and space-agency open data make it possible (`SPEC.md`, "Slide deck must show").
- [ ] No NASA logo on any slide. The pictures are screenshots of the game, which carries none.
- [ ] **Under 18:** no image, video, audio or likeness of anyone under 18 in the demo or the project. If a teammate is under 18, show roles and not names, and do not use their voice (`deck/briefs.md`).

If you record the 30-second video instead: 30 seconds or less by the player's own clock, English, no voice or face of anyone under 18, the same public-link rule. The sounds in the game are made by the game, so there is no music licence to clear.

## 4. The SI field

- [ ] `SI_USE.md` is behind. Its last row is November 15 and it lists the screens only. It does not record the SI's work on versions 1.0, 2.0 and 2.1 (the story screens, loans and credit, music and sound, the server, Quick mode, the tests) or the deck. Field 6 in `FORM.md` covers these; add the rows to `SI_USE.md` so the record matches what you submit.
- [ ] Read the form's own instructions for the SI field (they were collapsed in the screenshot the team worked from). If it asks for something `FORM.md` does not give, such as a mark on SI-made images, add it. The game has no SI-made image, video or recorded audio: its pictures and sound are drawn and synthesised by code.
- [ ] No NASA branding on anything the SI made, the deck included.

## 5. SOURCES.md: rows a person must still open

"Checked" means a team member opened the page and confirmed the numbers. These rows say nobody has:

- [ ] **Part lead times (months from order to delivery), the engineers' quote.** Marked "No: NEEDS HUMAN CHECK". Spoken, so the check is: do the two engineers' words match the ranges in the row?
- [ ] **The schedule is set by the slowest part (lead times and the long pole)**, Space Nexus. Marked "NOT OPENED, NEEDS HUMAN CHECK".
- [ ] **Where are the real bottlenecks in the small-satellite supply chain?**, New Space Economy. Marked "NOT OPENED, NEEDS HUMAN CHECK". The link ends in `.md`, which looks wrong: find the real address.
- [ ] **SES secures long-lead items (long-lead items ordered early)**, Aviation Week. Marked "NOT OPENED, NEEDS HUMAN CHECK". Used in `docs/real-world-plan.md` only.
- [ ] **The space supply chain is getting stretched (sole source and buffer stock)**, Breaking Defense. Marked "NOT OPENED, NEEDS HUMAN CHECK". Used in `docs/real-world-plan.md` only.

`FORM.md` (field 8) says of the last four "found by the SI and not yet opened by a team member". When a person has opened a page, delete that sentence for it. If a page does not exist or does not say what the row claims, delete the reference from the form and tell the data owner.

Rows marked "No":

- [ ] **Pixelify Sans (variable, latin), VT323, Courier Prime, Special Elite, Stardos Stencil (web fonts)**: check the two licences (SIL Open Font License 1.1; Apache License 2.0 for Special Elite).
- [ ] **Pixelify Sans and VT323 (web fonts)**, the last row of the table: see the slips below.

Rows a person never opened, but that are not marked for a check: the four "Downloaded and processed" rows (NASA FIRMS, NSIDC Sea Ice Index, SILSO, Alouette-1) and the three "Called live" rows (NOAA solar cycle indices, NASA EONET, the Canadian Wildland Fire Information System). Open each address once.

Slips in `SOURCES.md` to fix before anyone pastes that file anywhere (this pack was not allowed to edit it; `FORM.md` already leaves them out):

- [ ] The row "Real missions for the debrief comparison" is there twice. The second copy reads "NASA, YesAA, CSA" (it should be NOAA). Delete the second copy.
- [ ] The last row says the fonts are "loaded from Google Fonts" in `index.html`. They are not: `index.html` and `css/` make no request to Google Fonts, and the row above it says the fonts are in the game since v2. Delete the last row.
- [ ] "Small Spacecraft Technology State of the Art, 2025 edition" links to a file named `soa-2026.pdf`. Open it and write the edition the page shows.
- [ ] The Sputnik 1 row has no link ("page to confirm") and says both "not opened" and "Checked and opened by a human". Put the link that was opened, in the row and in `FORM.md` field 8.
- [ ] The "Music and sound effects" row has no Checked cell.
- [ ] No row for three NASA resources the game uses: Design and Develop Science Missions (the four segments in the debrief), Mission Design Lab (the discipline names in `data/debrief.js`) and JPL Concept Maturity Levels (the level names in `data/tiers.js`). `FORM.md` field 7 lists them, with the links from `SPEC.md`.
- [ ] No row for the SDO, Terra and Seasat mission pages named in `data/missions.js`, or for Node.js and Python.

Notes inside the data files that still say NEEDS HUMAN CHECK (they are not rows of `SOURCES.md`):

- [ ] `data/missions.js`: the mass of Explorer 3, SOLRAD 1, Solar Dynamics Observatory, GOES-16, Terra, PlanetScope and RADARSAT Constellation, and the mass and lifetime of Seasat. These are shown in the debrief's real-mission comparison.
- [ ] `data/parts.js`: four early parts sourced from "secondary sources" (Explorer 1 mercury batteries, Sputnik 1 silver-zinc batteries, the 108 MHz Minitrack beacon, the Explorer 3 tape recorder), and the lead-time note.
- [ ] `data/launchers.js`: the launch failure chances (game values, to check against launch records), the rideshare price, Rocket Lab's current figures.

## 6. If something changes before you submit

- [ ] **The server gets hosted.** Today `ONLINE.endpoint` in `data/online.js` is empty on `main`, so the leaderboard and the duel are off, and `FORM.md` says so (field 5, "WHAT WE HOPE TO ACHIEVE"). If someone hosts the server and sets the endpoint first, rewrite those two sentences: say the two features are live on the hosted game and off when the game is run locally, and that scores are self-reported.
- [ ] **Tests.** `FORM.md` says "more than 900 automated checks pass". On the 2.1 base the fifteen suites below gave 924 with none failing. Run them once more on `main` after the last merge; if any fails, fix it or change the sentence.
- [ ] **A count changes** (parts, rockets, events, endings): the numbers in fields 2, 5, 7 and 8 come from the data files, listed in section 9.

## 7. Tags

- [ ] Git tags: `CHANGELOG.md` says `v1.0` and `v2.0` were never pushed (cloud sessions cannot). From a computer: create `v2.0` and `v2.1` on their commits and `git push --tags`. Not needed for judging, but the changelog promises them.
- [ ] If the form asks for tags or keywords, `FORM.md` ends with a suggested list.

## 8. Pressing the button

- [ ] Every member is registered at the same Local Event and listed on the team page (at most six).
- [ ] Switch the edit lock on while you paste, so two teammates do not overwrite each other.
- [ ] Check each field against its limit as you paste. The limits are not known to us.
- [ ] Tick "Terms and Conditions" and "Confirm All Work is Original".
- [ ] Press **Submit for Judging**. Saving alone does not submit, and only a submitted team gets the certificate.
- [ ] Reopen the project page in a private window and read it as a judge would.

## 9. How each number in FORM.md was checked

- 41 parts in 7 groups, 7 rockets, 3 orbits, 6 topics, 27 events, 14 real missions, a lead time on all 41 parts: counted by loading every file in `data/` with Node.
- 3,693,555 fire detections; 92%, 100% and 69% by orbit (0.921, 1, 0.687); 699,369 soundings and 33 stations; sunspots from 1957 to 2025: read from `data/earth.js`.
- 4.75 million square kilometres in September 2025 against an average of 6.41: `data/earth.js`. That is 25.9% below, written as 26%.
- Seven endings: the list of seven ids in `js/ui-story.js`.
- Credit score 300 to 850: `data/campaign.js`, and `node tests/credit.js` (56 passed).
- Eight formulas: named in `CHANGELOG.md` (0.5 beta, "Rules"); `node tests/formulas.js` (16 passed).
- More than 900 checks: formulas 16, api 143, campaign 61, comeback 151, speed 6, version 8, debrief 35, migration 177, saves 35, clarity 30, info 45, online 126, world 19, credit 56, verdict 16. Total 924, none failed.
- Online off: `endpoint` is empty in `data/online.js` here and on `origin/main`; `README.md`; `node tests/online.js`.
- Three live feeds, and `fetch` only in `js/live-data.js`: read from that file (NOAA SWPC, NASA EONET, CWFIS).
- No image or sound file in the game: the repository's only binary files are seven fonts, the Alouette CSV and the deck.
- No request to Google Fonts and no NASA logo: searched `index.html`, `css/` and `js/`. The only "logo" is the GRAVITRON lettering, drawn by code.
- The four segments, the discipline names, the level names: `js/mission.js`, `data/debrief.js`, `data/tiers.js`.
- The models named in the SI field: the last line of `SI_USE.md`.
- Word counts: summary 98, description 598.

## 10. What could not be verified

- **The form itself.** Its exact field names, any length limit, and whether it asks for tags. `SPEC.md` records eight fields from a screenshot with the instructions collapsed.
- **The rule on SI-made images and NASA branding** as the 2026 guide words it. It is not quoted in the repository.
- **The team name, the members' names, the hosted address and that the repository is public.** None is in the repository.
- **What people did and who wrote the story** (field 6). Only the team knows; the repository records the mock-up, the story and the source checks by yarmee in a few lines.
- **That two satellite engineers visited** and what they said. It is recorded in `docs/real-world-plan.md` and `SOURCES.md` as spoken.
- **Every outside link.** None was opened in this pass; a person must (section 5). The figures inside the sources were not compared with the data files again.
- **The downloads behind the snapshot.** `tools/earth_data.py` was not re-run and the FIRMS files are not in the repository, so 3,693,555 is the number the snapshot holds, not a fresh count.
- **The live feeds answering today.** `FORM.md` only says "when online".
- **Play in a browser.** No browser test was run in this pass (documents only). Offline play rests on the project rule, the Node tests above and the earlier 2.1 browser runs.
- **Balance.** "At least two designs earn three stars per topic" (`tests/balance.js`) was not run, and `CHANGELOG.md` says balance was not re-measured with loans, launch failures and fees together. `FORM.md` does not claim it.
- **Speed.** The Lighthouse figures in `CHANGELOG.md` (94 to 99) were not measured again. `FORM.md` does not claim them.
- **Phones.** Not checked; `FORM.md` does not claim a phone layout.
- **The deck's pictures.** The slide text was read; the images were not looked at one by one.
