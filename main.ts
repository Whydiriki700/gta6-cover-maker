// Vice Grid — the entry program for gta6-cover-art-01 (Node 22, stdlib only).
// It hands the app in: app/ and screenshots/ are copied from beside this file
// into the output directory, and dossier.json is written with the kit's
// vendored library so the judge can read the entry. Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from, to) {
  if (!existsSync(from)) return;
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

function countShots() {
  const dir = join(root, 'screenshots');
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f)).length;
}

mkdirSync(outDir, { recursive: true });
copyTree(join(root, 'app'), join(outDir, 'app'));
copyTree(join(root, 'screenshots'), join(outDir, 'screenshots'));

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`Vice Grid handed in: ${countShots()} screenshot(s), dossier written to ${join(outDir, 'dossier.json')}`);
