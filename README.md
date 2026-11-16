# Hackstreet_Bros_Satellite

GRAVITRON, a browser game: design a satellite, launch it, learn why it flew or failed. Plain HTML, CSS and JavaScript, no build step: open `index.html`.

## Online features

**To put the server online, read [`ONLINE.md`](ONLINE.md)** (the checklist, the smoke tests, and what can go wrong).

Two optional features need a server: a **global leaderboard** (the best Part 2 runs) and a **quick 1v1 duel** (two players get the same job and cash, fly one flight each, and the higher science wins). The game is fully playable without them.

**They are off by default, and off automatically when you run the game yourself.** The leaderboard and duel entries of the QUICK MODE menu are disabled (with the reason in one line) and the game sends no network request for them when the page is:

- opened from a file (`file://`),
- served from `localhost`, `127.0.0.1`, `[::1]`, `0.0.0.0`, or a name ending `.local` or `.localhost`,
- served from a private address (`10.x`, `172.16.x` to `172.31.x`, `192.168.x`),
- opened with `?offline=1` in the address,
- or when no server is set (`ONLINE.endpoint` in `data/online.js` is empty, which is the default).

So a judge, or anyone who hosts the game locally, gets the pure offline game. The rule is one function, `LiveData.onlineStatus()` in `js/live-data.js`, tested in `tests/online.js`.

**Quick mode** is the third card on the home page. It opens the QUICK MODE menu: QUICK FLIGHT (solo, always available, works offline: one flight from a seeded job, scored by the science returned against the cost, best score kept in `localStorage` as `gravitron-quick-v1`), and the two online entries, 1V1 DUEL and LEADERBOARD, shown disabled with the reason when online is off. A quick flight never touches your stars, Part 1 or a comeback.

**What is sent** when you use them: a nickname you type (16 characters at most), a random player id kept in your browser (`localStorage`, `gravitron-player-v1`), and the result figures (the score and its parts, or a duel flight's science, cost and stars). No account, no email, no cookie, no analytics. Scores are **self-reported**: the server checks that they are sane numbers, not that the game produced them, and the leaderboard says so.

**To turn them on,** run the server (`server/README.md`: plain Node, no dependencies, free-tier friendly), host the game on a public address, and set `endpoint` in `data/online.js` to the server's address, for example `endpoint: "https://gravitron-server.example.com"`. Set the server's `ALLOW_ORIGIN` to the address the game is served from.

Tests: `node tests/online.js` (the off switch, the run score, the duel setup and the server). The browser check is `handoff/browser-tests/v2-online.js`.
