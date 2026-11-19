// Vice Cover Studio — entry program for gta6-cover-art-01 (Node 22,
// standard library only).
//
// The program hands the app in: it copies this repository's app/ (the
// offline cover maker) and screenshots/ (its four renders) into the
// output directory and writes /output/dossier.json with the kit's
// vendored buildDossier library, so the scorer can rebuild the same
// dossier byte for byte. Outside the grader, MAKEFUN_OUTPUT_DIR stands
// in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The run is deterministic: the same repository always writes the same
// bytes, because it only copies files and builds the dossier from them.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The app first: every static file under app/ (index.html, styles,
// modules, fonts and samples) goes across unchanged.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });

// Then the screenshots the dossier embeds, first by name the cover.
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The dossier, with the gate's own caps: the text cap shapes the bytes,
// the rest only refuse an entry the scorer would refuse anyway.
const dossierPath = join(out, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

// Say what the run handed in, so a failed copy or a missing dossier is
// visible in the log instead of silent: the file counts under app/ and
// screenshots/, and the dossier's bytes (the gate caps it at 1.5 MiB).
const countFiles = (dir) => {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? countFiles(join(dir, e.name)) : 1;
  }
  return n;
};
console.log(
  `Vice Cover Studio handed in: app/ (${countFiles(join(out, 'app'))} files), ` +
  `screenshots/ (${countFiles(join(out, 'screenshots'))} files), ` +
  `dossier.json (${statSync(dossierPath).size} bytes) -> ${out}`,
);
