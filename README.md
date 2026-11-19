# Vice Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/pempek2876-maker/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/pempek2876-maker/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

A web app that turns a photo and a caption into cover art in the style of
GTA 6's posters — the multi-panel look, bold lettering, a Vice City
sunset or neon grade — and exports it as a PNG to share. It runs offline
in a desktop browser from its own static files: photos never leave the
machine.

Entry for make.fun competition **gta6-cover-art-01** ("Make GTA 6 Cover
Art", $250, 50 paid places).

## Run it

```sh
node serve.ts            # serves app/ at http://localhost:8080
```

Open http://localhost:8080 in desktop Chrome. No build step, no network
request: every script, style, font and sample photo is a file under
`app/`.

## How it works

1. **Photos** — load up to three photos from your machine, or try the two
   bundled samples (AI-made for make.fun, free to use). Click a photo
   slot to put that photo in the selected panel.
2. **Panels & crop** — pick a panel, then drag it in the preview to pan
   its photo, or use the zoom slider. "Reset crop" restores the panel.
3. **Layout & grade** — three panel layouts (hero split, triple stack,
   duo band) and three colour grades (neon nights, Vice sunset, golden
   hour).
4. **Caption** — a title and a subline, lettered in Anton (SIL OFL,
   vendored under `app/fonts/`) with a heavy outline so it reads over
   any photo.
5. **Export PNG** — square 1080×1080, portrait 1080×1350 or wide
   1920×1080, rendered on this machine and downloaded as a PNG.

## The cover engine

- `app/src/layouts.js` — the three layouts: panel polygons (diagonal
  seams, shared edges) and where the title block sits in each.
- `app/src/cover.js` — the renderer: cover-fit photos per panel, grade
  wash + glow, white poster gutters, Anton title block, seeded film
  grain and a vignette. Deterministic: the same state paints the same
  pixels.
- `app/src/shots.js` — the query-string scenes (`?shot=cover|editor|
  export&size=...&layout=...&grade=...&caption=...&subline=...`) and
  the export sizes used for screenshots.
- `app/src/main.js` — editor state, controls, drag-to-pan, and the
  `window.__shot` / `window.__export` hooks the screenshot driver reads.

## Screenshots

Taken headlessly from the app itself (see `shots.json` for the exact
queries):

- `1-cover.jpg` — wide neon cover, hero-split layout
- `2-editor.jpg` — the editor with a photo loaded, portrait preview
- `3-cover.jpg` — exported square cover, triple-stack, sunset grade
- `4-cover.jpg` — exported portrait cover, duo-band, golden grade

## Verified (19 Nov 2026, fresh recorded rebuild)

- All four screenshots re-taken from the app itself: `1-cover.jpg`
  1280×720, 158,768 bytes; `2-editor.jpg` 1280×720, 143,439 bytes;
  `3-cover.jpg` 1080×1080, 189,256 bytes; `4-cover.jpg` 1024×1280,
  210,317 bytes — each `ready=true`, no errors, inside the gate's
  limits (≤256 KiB, long side ≤1280, short side ≥480).
- `main.ts` run twice to two output directories: byte-identical
  (`diff -r` clean). Dossier 981,437 bytes, under the 1.5 MiB cap.
- Kit check (`node cli/makefun.mjs check --kit . --repo …`): 4 passed,
  0 failed, 16 skipped (transcript checks run on the site), 5 checked
  at submission (repo public / owner / created-after-open / commit
  pushed / duplicate snapshot — site-side, cleared by pushing this
  commit to the public repo before submitting).
- Screenshot exports are JPEG at 0.88: a photographic cover as PNG
  runs ~2 MB at 1080×1080 in this encoder, past the 256 KiB
  screenshot cap. The in-app Download button still writes a real PNG.

## Hand-in

`main.ts` (Node 22, standard library only) copies `app/` and
`screenshots/` to `/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes
`/output/dossier.json` with the kit's vendored `buildDossier` library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Originality

Everything here is the author's own: no Rockstar Games logo, artwork or
font. Lettering is Anton under the SIL Open Font License
(`app/fonts/OFL.txt`). Sample photos were made with an image model for
make.fun and are free to use.

## License

MIT — see `LICENSE`.
