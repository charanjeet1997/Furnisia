/**
 * Texture optimisation pass.
 *
 * The source art is checked in at full resolution: ~100KB lossless PNG thumbnails and 2-4MB
 * 4K JPEG surfaces. That is far more than the UI ever displays (thumbnails render at 75px,
 * wall surfaces at a couple of metres), and on a cold deploy it dominates load time.
 *
 * The full-res masters live in `texture-sources/` at the repo root, deliberately OUTSIDE
 * `public/` — everything under `public/` is copied verbatim into `dist/` by Vite, so keeping
 * the originals there meant shipping 158MB of art the app never requests. This reads the
 * masters and writes only the optimised derivatives into `public/`:
 *
 *   texture-sources/previews/*.png  ->  public/assets/textures/previews/*.webp
 *   texture-sources/walls|floors/*  ->  public/assets/textures/walls|floors/*.webp
 *
 * Output paths mirror the source layout, so `textureCatalog.json` keeps its familiar
 * `/assets/textures/<dir>/<name>` shape — only the extension changes.
 *
 * Run with `npm run optimize:textures`. Pass --dry to preview the savings without writing.
 * `textureCatalog.json` is rewritten to match the generated files unless --no-catalog.
 */
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = path.join(ROOT, 'texture-sources');
const OUTPUT = path.join(ROOT, 'public', 'assets', 'textures');
const CATALOG = path.join(ROOT, 'src', 'Data', 'textureCatalog.json');

const DRY = process.argv.includes('--dry');
const WRITE_CATALOG = !process.argv.includes('--no-catalog');

// Thumbnails stay 256px: they render at 75px, so this keeps 2x+ headroom for retina. Only the
// encoding changes. Surfaces drop to 1024px, which is ample for a wall a few metres wide and
// is where the multi-MB savings come from.
const PREVIEW = { size: 256, quality: 80 };
const SURFACE = { size: 1024, quality: 82 };
// Normal/roughness maps carry non-colour data where banding shows up badly, so they get a
// higher quality floor than the albedo they accompany.
const DATA_MAP = { size: 1024, quality: 90 };

const isDataMap = (file) => /_(nor|rough|disp|arm|ao)\b/i.test(file);

async function optimizeDir(srcDir, outDir, opts) {
  let entries;
  try {
    entries = await readdir(srcDir);
  } catch {
    console.log(`  (skipped ${path.basename(srcDir)} — not found)`);
    return { before: 0, after: 0, count: 0, map: new Map() };
  }

  const images = entries.filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  if (!DRY) await mkdir(outDir, { recursive: true });

  let before = 0;
  let after = 0;
  const map = new Map();

  for (const file of images) {
    const srcPath = path.join(srcDir, file);
    const outName = file.replace(/\.(png|jpe?g|webp)$/i, '.webp');
    const outPath = path.join(outDir, outName);

    const srcSize = (await stat(srcPath)).size;
    const preset = isDataMap(file) ? DATA_MAP : opts;

    const buf = await sharp(srcPath)
      // `withoutEnlargement` keeps anything already smaller than the target untouched rather
      // than upscaling it into a bigger file for no gain.
      .resize(preset.size, preset.size, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: preset.quality })
      .toBuffer();

    if (!DRY) await writeFile(outPath, buf);

    before += srcSize;
    after += buf.length;
    // Keyed by stem, not full filename, so repointing works regardless of what extension the
    // catalog currently holds — that keeps re-runs idempotent once paths already say `.webp`.
    map.set(file.replace(/\.(png|jpe?g|webp)$/i, ''), outName);
  }

  const pct = before ? ((1 - after / before) * 100).toFixed(1) : '0';
  console.log(
    `  ${path.basename(srcDir).padEnd(10)} ${String(images.length).padStart(3)} files  ` +
      `${mb(before).padStart(8)} -> ${mb(after).padStart(8)}  (-${pct}%)`,
  );

  return { before, after, count: images.length, map };
}

const mb = (bytes) => `${(bytes / 1048576).toFixed(2)}MB`;

async function main() {
  // The masters are not kept in the repo — regenerating requires restoring them first, so fail
  // loudly rather than "succeeding" with zero files and rewriting the catalog to nothing.
  try {
    await stat(SOURCES);
  } catch {
    console.error(
      `No masters found at ${path.relative(ROOT, SOURCES)}/\n\n` +
        'The full-res source art is not checked in. Restore it before re-running:\n' +
        '  git checkout d742859 -- public/assets/textures\n' +
        '  mkdir texture-sources && git mv public/assets/textures/* texture-sources/\n',
    );
    process.exit(1);
  }

  console.log(DRY ? 'Texture optimisation (DRY RUN — nothing written)\n' : 'Optimising textures\n');

  const results = {};
  for (const [dir, opts] of [
    ['previews', PREVIEW],
    ['walls', SURFACE],
    ['floors', SURFACE],
  ]) {
    results[dir] = await optimizeDir(path.join(SOURCES, dir), path.join(OUTPUT, dir), opts);
  }

  const before = Object.values(results).reduce((s, r) => s + r.before, 0);
  const after = Object.values(results).reduce((s, r) => s + r.after, 0);
  console.log(
    `\n  TOTAL      ${mb(before)} -> ${mb(after)}  ` +
      `(-${((1 - after / before) * 100).toFixed(1)}%, saved ${mb(before - after)})`,
  );

  if (!WRITE_CATALOG || DRY) {
    console.log(DRY ? '\nDry run — catalog untouched.' : '\nCatalog left untouched (--no-catalog).');
    return;
  }

  // Point the catalog at the generated files. Only rewrite a path when the optimised file was
  // actually produced, so a partial run can't leave the catalog referencing something missing.
  const catalog = JSON.parse(await readFile(CATALOG, 'utf8'));
  let rewritten = 0;

  const repoint = (p) => {
    if (typeof p !== 'string') return p;
    // Tolerates the legacy `-opt` directory suffix so catalogs written by earlier runs of this
    // script are migrated rather than silently left pointing at deleted directories.
    const m = p.match(/^\/assets\/textures\/(previews|walls|floors)(?:-opt)?\/(.+)$/);
    if (!m) return p;
    const [, dir, file] = m;
    const stem = file.replace(/\.(png|jpe?g|webp)$/i, '');
    const outName = results[dir]?.map.get(stem);
    if (!outName) return p;
    rewritten++;
    return `/assets/textures/${dir}/${outName}`;
  };

  for (const group of Object.keys(catalog)) {
    for (const entry of catalog[group]) {
      for (const key of ['texturePath', 'normalPath', 'roughnessPath', 'previewPath']) {
        if (entry[key]) entry[key] = repoint(entry[key]);
      }
    }
  }

  await writeFile(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`\nRewrote ${rewritten} paths in src/Data/textureCatalog.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
