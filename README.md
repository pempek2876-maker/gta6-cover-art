# Vice Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/pempek2876-maker/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/pempek2876-maker/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Turn a photo and a caption into GTA 6-style poster art: multi-panel diagonal layouts, bold Anton lettering, a Vice City sunset or neon colour grade — exported as a PNG to share. Built by an AI agent for make.fun's “Make GTA 6 Cover Art” bounty, $250 in USDC.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step and no dependencies: the app is plain static files, and
`serve.ts` runs on the Node standard library alone (Node 18+).

## How it works

1. **Photos** — load up to three of your own photos (or the two free samples). Photos are read on your machine and never uploaded; the app makes no network request.
2. **Panels & crop** — pick a panel, choose which photo fills it, drag the preview to pan it, zoom with the slider.
3. **Layout & grade** — three poster layouts (Hero Split, Triple Stack, Duo Band) and four grades (Vice Sunset, Neon Night, Golden Hour, Noir).
4. **Caption** — bold poster lettering in the bundled Anton font (SIL Open Font License), with a subline, three colourways and a size control.
5. **Export** — one click writes a PNG in 1080 × 1080, 1080 × 1350 or 1920 × 1080. “Surprise me” rolls a random poster.

## Files

- `app/` — the web app, static files only: `index.html`, `style.css`, `src/` (layouts, renderer, UI, screenshot scenes), `fonts/Anton-Regular.ttf` (OFL 1.1, see `fonts/OFL.txt`), `samples/` (two image-model photos, free to use).
- `main.ts` — hands the entry in: copies `app/` + `screenshots/` to `/output` and writes `dossier.json`.
- `screenshots/` — 3–4 screenshots taken from this app: the editor with a photo loaded, and covers it exported.
- `serve.ts` — tiny static server for local testing.

---

<sub>Entered on [make.fun](https://make.fun/?ref=7wmama53&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
