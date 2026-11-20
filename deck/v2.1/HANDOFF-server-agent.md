# Handoff for the server agent (Pitstop)

Paste this into the Pitstop session. Do the lettered tasks in order and report back to the deck session (session_01V8Q2nmozJDa7Bz3YXUCgY8) or to the user.

**Deadline.** NASA Space Apps 2026 submission closes Sunday Nov 15 at 11:59 p.m. local time of the team's local event (probably US Eastern, which is 04:59 UTC on Mon Nov 16). This was written at 03:25 UTC. Anything saved after the deadline is not judged. Smallest safe change first.

## What the NASA guide (Project Submission Guide, Nov 13 2026) requires on your side

1. Two links are submitted. "Link to Project Demo" is a 7-slide deck (or a 30 second video), public, no login. "Link to Final Project" is the playable game, public, no login, no password, no registration. A link judges cannot open is not judged.
2. The demo and the final project may NOT contain any image, video, audio or other likeness of anyone under 18. Every team member is under 18. So: no team member names, photos, faces or voices on the hosted page, the deck, or repo docs we point judges to. Fictional story characters are fine. Keep the nickname filter on and seed nothing that looks like a real name.
3. SI use must be indicated where and how it was used (code and data: descriptive text and metadata; audio: the same; images and video: a visible watermark if SI-generated). Generated content may not use NASA logos, flags or mission identifiers. Keep the SI note light: one small line, not a banner.
4. If the game runs on a newly made website, NASA recommends a FortiGuard Web Filter Classification request (optional, helps judges get through). Category: "web-based application" or the closest option offered. Company Name: N/A. A human submits it; you only prepare the values.

## Tasks

**A. Public link.** Find the one stable public URL a judge can open with no login in a private window. The game is served from `/hack/app/<token>/` with a token that changes on every page load, so confirm a stable entry URL exists. Test with curl and no cookies: status 200, home page renders, a guest can press START on Part 1 and on Quick mode, no sign-in wall, no CSP errors for fonts or scripts. Report the exact URL, the status codes and what you tested. If no stable public URL exists, say so and propose the smallest fix.

**B. Which build is live.** Report the footer version label and the commit of `main` the server is on. The newest game work is on the game repo's `release/v2.1` branch and in another game session (session_01V8Q2nhLibbYic8X1ehKSGi, "Satellite mission design game"), whose logs mention a v2.4 label. Do not push to `main` of the game repo and do not change the version label: merging is the user's call. Report what is live and whether the pull is current. If `main` is behind `release/v2.1`, say so.

**C. Light SI note on the hosted page.** Keep the footer version label pattern `GRAVITRON v<digits>(.<digits>)*` intact. Add one small line to the home page footer through your override stopgap (`game-overrides.css`), for example "Built with SI assistance. Details in SI_USE.md in the repo". If your wrapper already rewrites `index.html` on each request, also add a `<meta name="description">` or a one-line HTML comment saying the code, tests and docs were written with SI assistance. Do not touch the game repo. No NASA logos or marks anywhere.

**D. Quick fixes from your own open items**, only if each takes under about 10 minutes and is safe: (1) preload or `font-display` for the two fonts (speed score 63); (2) check at 390 px wide that the map label MISSION CONTROL is not clipped on the current build. Skip the duel-reload issue. Do not claim a two-browser duel works: it has not been tested. The leaderboard is empty until people have played.

**E. FortiGuard values.** Give the user one short block with the exact values to paste into the FortiGuard form for the URL from task A. Do not submit it.

**F. Optional, only if your Google Slides connector can write.** Test with one harmless edit on the backup copy first (file id `1YZ5Gg3lbGhv7I3gCMI9ZvsfED7e2BQAhD3kRq-Db5Hk`, a private copy of the team deck). The Slides connector in the deck session is read-only. If yours can write, edit the team deck, file id `1FCQmRXNEPsOxXlr9oXis5UMQalHhJYWdb0ISp8AqFcI` (7 slides: `gv_s1`, `gv_s6`, `gv_rw`, `gv_ux1`, `gv_ux2`, `gv_s5`, `gv_s7`; the limit is 7, add none). Teammates may be editing: read each slide right before changing it, and make small batches. In priority order:

1. **Names off (under-18 rule).** On `gv_s1`, text box `elem_7` has a second line listing the five members: replace that line with `Data and rules  ·  UI and UX  ·  Story  ·  Game experience` (keep the first line TEAM HACKSTREET BROS). On `gv_s7`, text box `elem_103` lists names with roles: replace the four lines with roles only: "Data, simulation and game rules", "UI and UX and game rules", "Story", "Game experience" (keep the TEAM HACKSTREET BROS label). Use `replaceAllText` with `pageObjectIds` limited to those slides and the exact existing strings (two spaces around the middle dot). Leave the words Austin and Ajay elsewhere alone: they are fictional characters on `gv_s5`. Check the speaker notes for member names too.
2. **SI line (light).** On `gv_s7`, `elem_105` says "Every source is listed in SOURCES.md.". Change it to "Every source is listed in SOURCES.md. SI helped write the code, tests and docs: see SI_USE.md." Do not name the SI tool or models on the slides.
3. **Readable fonts.** Raise text under 12 pt to 12 pt or more where the box has room (`gv_s7`: `elem_102` is 11 pt, `n20_291` is 10.5 and 11.5 pt, labels are 11 pt). Cut words rather than shrink text. Nothing may overflow its box or overlap the QR image `g2cac52c432f0d61d_1` (leave the QR alone; it overlaps the fourth bullet slightly, so move the bullets up if you can).
4. **Stale numbers.** `gv_s7` `elem_91` says "793 automated checks pass": recount on the build the server serves (SPEC.md lists the suites under `node tests/`); the 2.1 build counted 984 across 17 suites. `n20_291` says NEW IN 2.0: relabel to the version the live build shows. `gv_s1` `elem_8` says v2.0: make it match the footer from task B.
5. **GIFs, if time remains.** Eleven GIFs are hosted at `https://raw.githubusercontent.com/angads22/Hackstreet_Bros_Satellite/claude/zealous-noether-x1ta0x/deck/v2.1/media/`: `home.gif`, `p1-build-lite.gif`, `p2-borrow.gif`, `map-gif.gif`, `p1-launch-lite.gif`, `p2-debrief-gif.gif`, `p1-fail-gif.gif`, `p1-story.gif`, `offer-gif.gif`, `phone-gif.gif`, `quick-gif.gif`. Slots: `home.gif` replaces the cover picture `imgn20_289` (about 7.0 x 4.4 in at x 5.8, y 1.7). `p2-debrief-gif.gif` replaces `imgn20_283` on `gv_ux2`. `p1-fail-gif.gif` replaces `imgn20_285`, but then rewrite its caption to say a battery-only design goes silent and the debrief says why, and delete the line "The launch dice were forced for this picture". `offer-gif.gif` replaces `imgn20_300` on `gv_s5`. `phone-gif.gif` and `quick-gif.gif` replace the two phone stills on `gv_s7`. `createImage` keeps the aspect ratio inside the box you give it.

After any edit, tell the user the link stays the same and which items you did not get to.

## Report back (short)

The public URL (A) with what you tested; the live version and commit (B); what you added for the SI line (C); what you fixed (D); the FortiGuard values (E); which deck edits you made, if any (F); anything you could not do.

Do not push to the game repo's `main`. Do not submit anything to NASA. Do not change who can view any Google file.
