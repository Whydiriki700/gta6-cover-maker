// Vice Grid: a gta6-cover-art-01 entry, written for Node 22 with the standard
// library only. The app itself is the static files under app/ — index.html and
// its ES modules, no library, no network request — and this program hands it
// in: it copies app/ and screenshots/ from beside this file into /output and
// writes /output/dossier.json there with the vendored make.fun library, the
// summary the judge reads.
//
// What the app does: four multi-panel layouts, one photo spread across the
// panels or a different photo in each, per-photo crop and zoom, Vice City
// colour grades, display-lettered captions, and PNG export at 1080x1080,
// 1080x1350 and 1920x1080.
//
// Try it locally with `node serve.ts` (opens http://localhost:8080).
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
const shotsOut = join(outputDir, 'screenshots');
mkdirSync(shotsOut, { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), shotsOut, { recursive: true });
}

// The scorer's own caps (see the kit's reference/gate.json): text_max_bytes is
// the only one that shapes the bytes; the rest refuse an entry the scorer
// would refuse — more than 4 screenshots, one over 256 KiB, more than 993
// files in app/, more than 48 MiB of app files in all, or a path under app/
// over 1000 bytes. app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
