import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const outputDir = path.join(rootDir, 'public', 'assets', 'textures');

// Curated list of indoor-appropriate wall & floor textures from Poly Haven
const TEXTURES = {
  floors: [
    // Wood floors
    'wood_floor',
    'wood_floor_deck',
    'wooden_floor',
    'wooden_floor_2',
    'wooden_floor_3',
    'herringbone_parquet',
    'dark_wooden_planks',
    'laminate_floor',
    'laminate_floor_02',
    // Tiles
    'hexagonal_concrete',
    'large_white_tiles',
    'marble_01',
    'white_marble',
    'black_marble',
    'terrazzo_floor',
    'concrete_floor_02',
    'brown_floor_tiles',
    'slate_floor',
    'clay_floor_001',
  ],
  walls: [
    // Painted walls / plaster
    'painted_plaster',
    'plastered_wall',
    'plastered_wall_02',
    'white_plaster_02',
    'beige_wall_001',
    'concrete_wall_008',
    'concrete_wall_003',
    'rough_plasterbrick_05',
    // Brick walls
    'red_brick_03',
    'red_brick_04',
    'brick_wall_001',
    'brick_wall_008',
    // Stone & decorative
    'castle_brick_07',
    'stone_wall',
    'stone_wall_03',
    'rough_stone_wall',
    // Wallpaper / fabric
    'fabric_pattern_07',
    'leather_white',
    'book_pattern',
  ],
};

const RES = '2k'; // 2k resolution
const FORMAT = 'jpg';

function downloadFile(url, destPath) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, (res2) => {
          res2.pipe(file);
          file.on('finish', () => { file.close(); resolve(true); });
        }).on('error', () => {
          file.close();
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          resolve(false);
        });
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        resolve(false);
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(true); });
    }).on('error', () => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      resolve(false);
    });
  });
}

async function downloadTextureMaps(name, category) {
  const catDir = path.join(outputDir, category);
  if (!fs.existsSync(catDir)) fs.mkdirSync(catDir, { recursive: true });

  // 1. Diffuse Map (Color)
  const diffFile = `${name}_diff_${RES}.${FORMAT}`;
  const diffUrl = `https://dl.polyhaven.org/file/ph-assets/Textures/${FORMAT}/${RES}/${name}/${diffFile}`;
  const diffPath = path.join(catDir, `${name}.jpg`);

  if (!fs.existsSync(diffPath)) {
    const success = await downloadFile(diffUrl, diffPath);
    if (!success || fs.statSync(diffPath).size < 1000) {
      if (fs.existsSync(diffPath)) fs.unlinkSync(diffPath);
      console.log(`  ❌ Diffuse map not found: ${name} (skipped)`);
      return false;
    }
  }

  // 2. Normal Map (OpenGL format for Three.js 3D surface depth)
  const norFile = `${name}_nor_gl_${RES}.${FORMAT}`;
  const norUrl = `https://dl.polyhaven.org/file/ph-assets/Textures/${FORMAT}/${RES}/${name}/${norFile}`;
  const norPath = path.join(catDir, `${name}_nor.jpg`);

  if (!fs.existsSync(norPath)) {
    const ok = await downloadFile(norUrl, norPath);
    if (!ok || fs.statSync(norPath).size < 1000) {
      if (fs.existsSync(norPath)) fs.unlinkSync(norPath);
    }
  }

  // 3. Roughness Map (For realistic specular lighting reflection)
  const roughFile = `${name}_rough_${RES}.${FORMAT}`;
  const roughUrl = `https://dl.polyhaven.org/file/ph-assets/Textures/${FORMAT}/${RES}/${name}/${roughFile}`;
  const roughPath = path.join(catDir, `${name}_rough.jpg`);

  if (!fs.existsSync(roughPath)) {
    const ok = await downloadFile(roughUrl, roughPath);
    if (!ok || fs.statSync(roughPath).size < 1000) {
      if (fs.existsSync(roughPath)) fs.unlinkSync(roughPath);
    }
  }

  console.log(`  ✅ ${category}/${name} (Diffuse + Normal + Roughness maps ready)`);
  return true;
}

async function downloadThumbnail(name) {
  const thumbDir = path.join(outputDir, 'previews');
  if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

  const thumbUrl = `https://cdn.polyhaven.com/asset_img/thumbs/${name}.png?width=256&height=256`;
  const destPath = path.join(thumbDir, `${name}.png`);

  if (fs.existsSync(destPath)) return true;
  return await downloadFile(thumbUrl, destPath);
}

async function main() {
  console.log('🎨 Furnisia PBR Texture Downloader (Diffuse + Normal Maps)\n');
  console.log(`Resolution: ${RES} | Format: ${FORMAT}\n`);

  let totalDownloaded = 0;
  let totalFailed = 0;

  // Download floor textures
  console.log('━━━ FLOOR TEXTURES (Diffuse + Normal + Roughness) ━━━');
  for (const name of TEXTURES.floors) {
    const ok = await downloadTextureMaps(name, 'floors');
    if (ok) {
      await downloadThumbnail(name);
      totalDownloaded++;
    } else {
      totalFailed++;
    }
  }

  // Download wall textures
  console.log('\n━━━ WALL TEXTURES (Diffuse + Normal + Roughness) ━━━');
  for (const name of TEXTURES.walls) {
    const ok = await downloadTextureMaps(name, 'walls');
    if (ok) {
      await downloadThumbnail(name);
      totalDownloaded++;
    } else {
      totalFailed++;
    }
  }

  console.log(`\n✅ Download Process Completed! Valid assets: ${totalDownloaded} | Skipped: ${totalFailed}`);

  // Generate textures catalog JSON
  const catalog = { floors: [], walls: [] };

  for (const cat of ['floors', 'walls']) {
    const catDir = path.join(outputDir, cat);
    if (!fs.existsSync(catDir)) continue;
    const files = fs.readdirSync(catDir).filter(f => f.endsWith('.jpg') && !f.endsWith('_nor.jpg') && !f.endsWith('_rough.jpg'));
    for (const file of files) {
      const id = path.basename(file, '.jpg');
      const name = id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const previewPath = `/assets/textures/previews/${id}.png`;
      const texturePath = `/assets/textures/${cat}/${file}`;
      
      const norFile = `${id}_nor.jpg`;
      const roughFile = `${id}_rough.jpg`;
      const normalPath = fs.existsSync(path.join(catDir, norFile)) ? `/assets/textures/${cat}/${norFile}` : undefined;
      const roughnessPath = fs.existsSync(path.join(catDir, roughFile)) ? `/assets/textures/${cat}/${roughFile}` : undefined;

      catalog[cat].push({ id, name, texturePath, normalPath, roughnessPath, previewPath });
    }
  }

  const catalogPath = path.join(rootDir, 'src', 'Data', 'textureCatalog.json');
  const pubCatalogPath = path.join(rootDir, 'public', 'data', 'textureCatalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  fs.writeFileSync(pubCatalogPath, JSON.stringify(catalog, null, 2));
  console.log(`\n📄 Texture catalog updated:\n - ${catalogPath}\n - ${pubCatalogPath}`);
}

main().catch(console.error);
