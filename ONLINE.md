# ONLINE.md: getting the leaderboard and the 1v1 duel online

For whoever is putting the server on the internet. Read this file, do the checklist, and the two online features work. Nothing else in the game needs to change.

## Where things stand

| Piece | State |
| --- | --- |
| Game side (screens, calls, the off switch) | **Built and tested.** `js/ui-online.js`, `js/live-data.js`, `data/online.js`, `css/online.css` |
| Server | **Built and tested, not hosted.** `server/server.js` (plain Node, no dependencies), `server/README.md` |
| Hosting, the public address, `ONLINE.endpoint` | **Not done. This is the job.** |

Why the buttons look dead today: the leaderboard and the duel show **ONLINE OFF** with a one-line reason until `ONLINE.endpoint` in `data/online.js` holds a real server address **and** the game is opened from a public address. Nothing is broken; the server just has no address yet.

## What the two features are

- **Global leaderboard:** the best Part 2 runs, top 20, the player's own best and rank. Scores are **self-reported** (the game says so). A run's score is `getRunScore()` in `js/mission.js`: 500 for a win, plus 100 per star, plus 10 per month left on a win, plus 5 per point of reputation.
- **1v1 duel:** one player creates a room and gets a four-letter code; the other joins with it. Both get the same seed, so the same job and the same cash. Each flies one flight and sends the result. The higher science wins; a tie goes to the lower cost. **The server decides the winner**, so both players read the same answer. A room lives 10 minutes and is kept in memory.
- Both are reached from **QUICK MODE** on the home page (version 2.1; before that, a small row on the home page).

## The checklist (about 15 minutes)

1. **Host `server/server.js`.** Any host that runs a Node 18+ process: Render, Railway, Fly.io, a small VPS. Start command `node server/server.js`, no build command, no dependencies to install. On Render: a new Web Service from this repository, build command empty.
2. **Set the environment variables** (full table in `server/README.md`):
   - `ALLOW_ORIGIN` = the address the **game** is served from, exactly, with no trailing slash (for example `https://angads22.github.io`). Unset means no CORS header, and the browser will block every call from the game.
   - `TRUST_PROXY=1` on almost every host (the server sits behind a proxy; without this every player looks like one address and hits the request limit together).
   - `PORT` is set by the host; `DATA_FILE` and `RATE_LIMIT` have defaults.
3. **Open the server's address in a browser** with `/api/leaderboard` on the end. It must answer with JSON (an empty list is right).
4. **Put the server's address in `data/online.js`:** `endpoint: "https://your-server.example.com"` (https, no trailing slash). Commit that file to `main`.
5. **Host the game on a public address** (GitHub Pages is fine) and make sure `ALLOW_ORIGIN` from step 2 is that address.
6. **Bump the cache key** if the game was already deployed: the `?v=` on the script tags in `index.html` (the integrator does this at each release), or a returning browser keeps the old `data/online.js`.
7. **Try it** (next section).

## Smoke tests

Server only, from any terminal (replace `$S` with the server address):

```
curl -s "$S/api/leaderboard"                                   # JSON, an empty list at first
curl -s -X POST "$S/api/score" -H 'content-type: application/json' \
  -d '{"id":"test-1","nickname":"Tester","score":900,"won":true,"stars":3,"months_left":10,"reputation":5}'
curl -s "$S/api/leaderboard?id=test-1"                          # Tester appears, with a rank
curl -s -X POST "$S/api/duel" -H 'content-type: application/json' -d '{"id":"a","nickname":"A"}'   # a four-letter code and a seed
```

Then the join and the result: `POST $S/api/duel/<code>/join` with `{"id":"b","nickname":"B"}`, `POST $S/api/duel/<code>/result` with `{"id":"a","science":120,"cost_musd":3.2,"stars":2}` and again for `b`, and `GET $S/api/duel/<code>?id=a` must name the winner. The exact request and answer fields are in `server/server.js` (about 280 lines, one file); the tests in `tests/online.js` call every endpoint.

In the game, on the **public** address, with two browsers (or one normal and one private window): QUICK MODE, then LEADERBOARD (it should load and, after a Part 2 ending, SUBMIT SCORE should add a row), then 1V1 DUEL in one window (create, read the code) and in the other (join with the code). Both fly one flight and SEND RESULT; both screens must show the same winner.

The repo's own checks, without a real server: `node tests/online.js` (the off table, the score formula, every server endpoint on a random port) and `handoff/browser-tests/v2-online.js` (a fake public address backed by the real server runs a leaderboard submit and a two-player duel end to end).

## Hosted on Pitstop (the team's server)

The team's server (Pitstop) serves the game from a clone of `main` and runs `server/server.js` beside it. This is what the game keeps doing so that keeps working; `handoff/browser-tests/v21-host.js` checks the first five.

| Rule for the game | Why |
| --- | --- |
| **Relative URLs only** (`js/x.js`, never `/js/x.js`) | the game is served from `/hack/app/<token>/`, with a new token on every page load |
| **Load nothing from another website** (fonts and libraries live in the repo) | a CSP allows scripts, styles, fonts, images and `fetch` only from the site itself. The live NASA and NOAA calls are blocked there, so the game shows SNAPSHOT, as it does offline |
| **The footer reads `GRAVITRON v2.1`** (`v<digits>(.<digits>)*( beta|alpha|rc)?`) | the server reads the version from `index.html` |
| **`server/server.js` exports `{ createServer }`**, takes `dataFile`, `trustProxy`, `rateLimit`, has no dependencies and listens only under `require.main === module` | the server's wrapper imports it. A new option: tell the server side |
| **Saves stay small** (under 512 KB; a real comeback save is about 4 KB) | the server refuses anything bigger, silently |
| **`ONLINE.endpoint` stays `""` in `data/online.js`** | the server fills it in on every request (the game calls `/hack/online/<link>/api/...`) |

How it runs there: in a sandboxed frame with no cookies and no storage of its own. `localStorage` is replaced by one that saves per account on the server (a guest gets no save and a new player id each visit); there is no `sessionStorage`, so **"reload keeps your place" keeps the place with the saves there** (stamped with the time, forgotten after three hours). `main` goes live about three minutes after a push; open tabs get a "New version: reload" button.

What the game shows for the server's own answers (`js/live-data.js`): **403** "Link expired. Reload the page.", **503** "Multiplayer is switched off.", **502** "The server is down. Try again soon.", **400** the reason the server sent (a filtered nickname), **404** the duel room is gone.

For the server side:

- **QUICK MODE is in the repo from version 2.1** (a third card on the home page; the duel and the leaderboard are inside its menu). The stylesheet that restyled the old home-page online buttons as a DUEL card with a LEADERBOARD bar can be deleted: those buttons (`.online-row`) no longer exist.
- **Not yet done:** a full two-browser duel on the host. A duel between two guests ends if either reloads (a guest's player id is new on every visit); logged-in players keep theirs.
- **Checked on 2.1:** the phone map label "MISSION CONTROL" is not clipped (the floating label only shows for the next stop, which is never Mission Control in the three modes); the two first-screen fonts are preloaded to cut the late font swap.

## The off switch (do not "fix" this)

The online features turn themselves off, with **no network request at all**, when the page is opened from a file, from `localhost`, `127.0.0.1`, `[::1]`, `0.0.0.0`, a name ending `.local` or `.localhost`, a private address (10.x, 172.16 to 31.x, 192.168.x), or with `?offline=1`, and when `ONLINE.endpoint` is empty. That is on purpose: a judge or anyone who hosts the game themselves gets the plain offline game. The rule is one pure function, `LiveData.onlineStatus()` in `js/live-data.js`, and it explains itself in one line on the buttons ("Playing from a file.", "Running on this computer.", "Running on a private network.", "Offline mode is on (?offline=1).", "No server is set."). This also means you **cannot test the online screens from `localhost`**: test on the public address, or use the browser script above.

## Things that will bite

- **HTTPS:** a game served over `https` can only call an `https` server (the browser blocks mixed content). Free hosts give you https.
- **Cold starts:** free tiers sleep. The first call after a sleep can take longer than `request_timeout_ms` (6000 in `data/online.js`) and the screen says "Server not reachable". Retry works. If it is annoying, raise that number to about 15000 or ping the server every ten minutes.
- **The leaderboard file can vanish:** a free host's disk is often wiped on restart, so the leaderboard may start empty again. Rooms are in memory and vanish on restart by design. For a permanent leaderboard use the host's persistent disk (point `DATA_FILE` at it).
- **CORS errors in the browser console** mean `ALLOW_ORIGIN` does not match the game's address exactly (scheme, host, no trailing slash, no path).
- **A 404 on `/api/duel/<code>`** means the room is gone (expired or never existed). The game handles it and shows a plain message; it is not a bug.
- **Request limit:** 300 per minute per address by default; a waiting duel player asks every 2 seconds. A classroom on one address behind a proxy needs `TRUST_PROXY=1` and, if it is large, a higher `RATE_LIMIT`.

## What is sent (privacy)

A nickname the player types (at most 16 characters), a random player id kept in the browser (`localStorage`, key `gravitron-player-v1`), and result figures. No account, no email, no cookie, no analytics. Scores are not tamper-proof (the browser reports them); the leaderboard says so on its screen.

## Where the code is

| What | Where |
| --- | --- |
| Settings (endpoint, sizes, timeouts, the duel's three flight setups) | `data/online.js` |
| The only network calls, and the off switch | `js/live-data.js` (`LiveData.onlineStatus`, `LiveData.online.*`) |
| Screens (leaderboard, duel, quick mode) | `js/ui-online.js`, `css/online.css` |
| Score formula | `getRunScore()` in `js/mission.js` |
| The server | `server/server.js`, `server/README.md` |
| Tests | `tests/online.js`, `handoff/browser-tests/v2-online.js` |
| The rules | `SPEC.md`, "Online features" and "Quick mode" |

`CLAUDE.md` keeps one rule for this: `fetch` appears only in `js/live-data.js`. Keep it there.
