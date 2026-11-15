# v2 perf: the desktop Lighthouse score

Short answer: the score of about 60 was real, not a fluke. Three runs on the old code gave 64 to 68 on a bare static server and 74 to 75 on a gzip server, with the same cause each time. It is fixed: **99** (gzip server), 94 on a bare server with no compression.

## How it was measured

Lighthouse 12, desktop preset, performance only, headless Chromium, 3 runs per row, the home page. Servers: `python3 -m http.server` (HTTP/1.0, no compression, no cache headers) and a small Node server with gzip and `max-age=600` (what GitHub Pages and most static hosts send). Google Fonts was reachable through the sandbox proxy for the "before" runs; the three live open-data hosts (EONET, NOAA, CWFIS) were refused, so every run shows the SNAPSHOT badge and the hosted game's LIVE DATA path (badge flip, extra fetches) was **not measured**. The hosted site differs in network and CPU too: Lighthouse simulates a 10 Mbit link and 40 ms round trip either way, but the layout shift is measured from a real, unthrottled load and does not depend on the network.

| Run (3 each) | Score | FCP | LCP | TBT | CLS | Speed Index |
| --- | --- | --- | --- | --- | --- | --- |
| Before, bare server | 64, 67, 68 | 1.1 to 1.4 s | 1.6 to 1.7 s | 0 to 30 ms | **0.81** | 1.1 to 1.4 s |
| Before, gzip server | 74, 75, 74 | 0.7 s | 1.0 s | 0 to 30 ms | **0.81** | 0.7 to 0.8 s |
| After, gzip server | **99, 99, 99** | 0.3 s | 0.9 to 1.0 s | 0 ms | **0** | 0.6 s |
| After, bare server | 94, 94, 94 | 0.4 s | 1.6 s | 0 to 20 ms | 0 | 0.8 to 0.9 s |

Run to run the score moved by 1 to 4 points, so a result within that is noise. The jump is not.

## The cause: layout shift (CLS 0.81, worth about 25 points)

Layout shift is a quarter of the score, and 0.81 scores zero. The page painted the normal header and footer first. When the scripts ran, `markHome()` added `body.is-home`, which moves the header to a corner and the footer to the bottom of the screen: the whole page jumped. Web fonts swapping in late was a smaller second shift.

Fixes, none of which change what a player sees:

1. **`index.html` opens as the home page** (`<body class="is-home">`), because the game always starts on the home screen. The first paint is already in its final layout.
2. **The footer is hidden until the first screen is drawn** (`#app:empty ~ .foot { visibility: hidden }` in `css/style.css`), because it is positioned for the finished page.
3. **Fonts are self-hosted** in `css/fonts/` (Pixelify Sans, Courier Prime, Special Elite, Stardos Stencil added; VT323 was there). This removes two render-blocking stylesheets and the chained font requests to Google, and the pixel type now also works offline. Licences are in `SOURCES.md` (Special Elite is Apache 2.0, the rest SIL OFL). The 1958 faces are fetched only when Part 1 uses them.
4. **All 36 scripts are `defer`**: they download while the page is read and run in order once it is parsed, so nothing blocks the first paint (FCP 0.8 s to 0.3 s, Speed Index 0.8 s to 0.6 s). `js/ui-design.js` used to start on `DOMContentLoaded` only if the page was still loading; with defer it would have started before `ui-comeback.js` ran (Part 2 read COMING NEXT), so it now waits for `DOMContentLoaded` when its own tag is deferred (one commented line at the end of that file).

## Merge hazard: new script tags need `defer`

A `<script src>` without `defer` runs at once, before every deferred script, and finds none of the globals. Anyone adding a script to `index.html` (the online features) must write `<script defer src="...">`. `node tests/perf.js` fails if one has no defer.

## Tried and dropped

- `<link rel="preload" as="font" crossorigin>` for the two fonts: with a 250 ms font delay the layout shift was 0.01 with and without it, and on a page opened as a file it logs a CORS error and fails the browser tests' "no errors" check. Not used.
- Hero 3D scene: already capped (24 or 30 fps), already paused when the tab is hidden or the canvas is off screen (`js/lowpoly.js`, IntersectionObserver and visibilitychange), and its first frame lands before the menu animates in, so it is not on the critical path. No long tasks remain (TBT 0 to 30 ms). Left alone.

## What is left, and why it stays

- **No compression or long cache on the host** is the largest remaining cost: the bare server scores 94 against 99 with gzip (about 1.1 MB raw, about 390 KB gzipped). Nothing to change in the repo; check the host sends gzip or brotli.
- Lighthouse still lists unminified and unused JS and CSS (about 370 KB and 460 KB) and a short cache lifetime. Minifying or splitting needs a build step, which the project does not have, so they stay. With gzip they cost no points.
- LCP (0.9 to 1.0 s with gzip, 1.6 s without) is when the home menu is drawn by the scripts and then animates in (`js/motion.js`); it is load-bound, and how much the entry animation adds was not isolated.

Checked after the changes (the `lowpoly` browser script was not run; the 3D start was not touched): `node tests/version.js`, `node tests/api.js`, `node tests/perf.js`; browser scripts `smoke`, `home`, `play`, `wide`; a page served over http loads every font (home: Pixelify Sans, VT323, Digits; Part 1 adds Courier Prime, Special Elite, Stardos Stencil) with no failed font request; the same page opened as a file also loads them (`document.fonts`), and `smoke` passes on the final tree.
