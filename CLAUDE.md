# CLAUDE.md

- Read `SPEC.md` before doing anything. It is the source of truth.
- Plain HTML, CSS and JavaScript only. No frameworks, no build step.
- No `import`. Data files define one global each, loaded with a plain script tag.
- `fetch` only in `js/live-data.js`, and the game must still work offline from the snapshot in `data/earth.js`.
- `js/game.js` must never touch the page (no `document`, no HTML).
- Do not rename or add data fields without asking me.
- Do one small task at a time.
- Push any change to `SPEC.md` to `main` immediately, in its own commit, so every teammate's AI reads the same spec.
