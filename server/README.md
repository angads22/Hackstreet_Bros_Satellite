# GRAVITRON server (optional)

The server behind the leaderboard and the 1v1 duel. The game does not need it: with no server, or when the game runs from a file, localhost or a private address, both features are off and the rest of the game is unchanged (see the "Online features" section of the root `README.md`).

Plain Node (18 or newer), **no dependencies**, no build step. One file: `server.js`.

```
node server/server.js
```

## What it does

| Endpoint | What |
| --- | --- |
| `GET /api/leaderboard?id=<player id>` | the top 20 runs; with an id, that player's own best and rank |
| `POST /api/score` | `{ id, nickname, score, won, stars, months_left, reputation }`; keeps each player's best |
| `POST /api/duel` | `{ id, nickname }`: a new room; answers a four-letter `code` and a `seed` |
| `POST /api/duel/:code/join` | `{ id, nickname }`: join a room; the same `seed` |
| `POST /api/duel/:code/result` | `{ id, science, cost_musd, stars }`: one result per player |
| `GET /api/duel/:code?id=<player id>` | the room: waiting, playing or done; the winner once both results are in |

The higher science wins; a tie goes to the lower cost. The server decides, so both players read the same answer. A room lives ten minutes and is kept in memory; the leaderboard is kept in a JSON file.

## Environment

| Variable | Meaning | Default |
| --- | --- | --- |
| `PORT` | port to listen on (free tiers set this for you) | `8787` |
| `ALLOW_ORIGIN` | the address the game is served from, for CORS (for example `https://angads22.github.io`), or `*`. Unset sends no CORS header, so only a page on the same address can use it | unset |
| `DATA_FILE` | where the leaderboard is kept | `server/data.json` |
| `TRUST_PROXY` | `1` when a proxy sits in front (most hosts): the request limit then counts the real client address from `X-Forwarded-For` | off |
| `RATE_LIMIT` | requests per minute per address (a waiting duel player asks every 2 seconds, so a classroom behind one address needs room) | `300` |

Also built in: a body size cap (2 KB), strict checks on every field (a nickname is trimmed to 16 characters, scores must be finite numbers within sane bounds, room codes are four letters), and a cap on live rooms.

## Hosting on a free tier

Any host that runs a Node process works (Render, Railway, Fly.io, a small VPS). On Render, for example: a new Web Service from this repository, build command empty, start command `node server/server.js`, environment `ALLOW_ORIGIN` (the game's address) and `TRUST_PROXY=1`. Free tiers sleep when idle and may lose files between restarts: the leaderboard then starts again empty, and a duel in progress is lost. That is fine for a game jam; use a host with a persistent disk, and point `DATA_FILE` at it, if the board should last.

Then set `endpoint` in `data/online.js` to the server's address and host the game on a public address. Nothing else changes.

## Privacy

The server stores a random player id, the nickname the player typed, and result figures. No account, no email, no cookie, no analytics, no logging of addresses beyond the in-memory request counter. Results are self-reported and not verified. To erase everything, delete `DATA_FILE`.
