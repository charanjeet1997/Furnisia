import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const jsonPath = path.join(rootDir, 'src', 'Data', 'furnitureCatalog.json');
const pubJsonPath = path.join(rootDir, 'public', 'data', 'furnitureCatalog.json');
const thumbDir = path.join(rootDir, 'public', 'assets', 'thumbnails');

const catalog = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

let count = 0;
let missing = 0;

for (const item of catalog) {
  const thumbFile = `${item.id}.png`;
  const fullThumbPath = path.join(thumbDir, thumbFile);

  if (fs.existsSync(fullThumbPath)) {
    item.thumbnailPath = `/assets/thumbnails/${thumbFile}`;
    count++;
  } else {
    console.log(`Missing thumbnail on disk for: ${item.id} (${item.name})`);
    missing++;
  }
}

fs.writeFileSync(jsonPath, JSON.stringify(catalog, null, 2));
fs.writeFileSync(pubJsonPath, JSON.stringify(catalog, null, 2));

console.log(`Successfully linked ${count} thumbnails in JSON database! Missing: ${missing}`);
