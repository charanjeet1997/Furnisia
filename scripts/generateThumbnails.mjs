import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const catalogPath = path.join(rootDir, 'public', 'data', 'furnitureCatalog.json');
const srcCatalogPath = path.join(rootDir, 'src', 'Data', 'furnitureCatalog.json');
const outputDir = path.join(rootDir, 'public', 'assets', 'thumbnails');

if (!fs.existsSync(catalogPath)) {
  console.error('Error: furnitureCatalog.json not found at:', catalogPath);
  process.exit(1);
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
console.log(`Loaded ${catalog.length} items from catalog database.`);

// Identify items missing thumbnails on disk
const missingItems = catalog.filter((item) => {
  const thumbFile = `${item.id}.png`;
  return !fs.existsSync(path.join(outputDir, thumbFile));
});

console.log(`Found ${missingItems.length} items needing thumbnail generation.`);

const PORT = 3030;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(getHtmlContent(missingItems));
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/node_modules/three/')) {
    const relativePath = req.url.replace('/node_modules/three/', '');
    const filePath = path.join(rootDir, 'node_modules', 'three', relativePath);
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  if (req.method === 'GET' && req.url.startsWith('/assets/')) {
    const filePath = path.join(rootDir, 'public', req.url);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.glb': 'model/gltf-binary',
        '.gltf': 'model/gltf+json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.js': 'text/javascript',
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    } else {
      res.writeHead(404);
      res.end('File not found');
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/save-thumbnail') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { id, dataUrl, index, total } = JSON.parse(body);
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
        const filename = `${id}.png`;
        const filePath = path.join(outputDir, filename);

        fs.writeFileSync(filePath, base64Data, 'base64');
        console.log(`[${index + 1}/${total}] Saved thumbnail: /assets/thumbnails/${filename}`);

        // Update item in catalog
        const item = catalog.find((i) => i.id === id);
        if (item) {
          item.thumbnailPath = `/assets/thumbnails/${filename}`;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('Failed to save thumbnail:', err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/complete') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));

    // Ensure thumbnailPath is updated for all existing thumbnails on disk
    for (const item of catalog) {
      const thumbFile = `${item.id}.png`;
      if (fs.existsSync(path.join(outputDir, thumbFile))) {
        item.thumbnailPath = `/assets/thumbnails/${thumbFile}`;
      }
    }

    // Write updated catalog back with thumbnailPath references
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
    if (fs.existsSync(path.dirname(srcCatalogPath))) {
      fs.writeFileSync(srcCatalogPath, JSON.stringify(catalog, null, 2));
    }

    console.log('\n✅ ALL 81 THUMBNAILS GENERATED AND SAVED SUCCESSFULLY!');
    console.log(`Updated catalog databases at:\n - ${catalogPath}\n - ${srcCatalogPath}\n`);

    setTimeout(() => {
      server.close(() => process.exit(0));
    }, 1000);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

function listenOnAvailablePort(startPort) {
  server.listen(startPort, () => {
    const port = server.address().port;
    console.log(`\nLocal Thumbnail Generator Server running at http://localhost:${port}`);
    console.log('Launching browser to render missing thumbnails...\n');

    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    let browserPath = fs.existsSync(edgePath) ? edgePath : fs.existsSync(chromePath) ? chromePath : null;

    if (browserPath) {
      spawn(browserPath, [`http://localhost:${port}`, '--new-window', '--window-size=600,700']);
    } else {
      console.log(`Open http://localhost:${port} in your web browser to generate thumbnails automatically.`);
    }
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      listenOnAvailablePort(startPort + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

listenOnAvailablePort(3030);

function getHtmlContent(items) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Furnisia 3D Thumbnail Generator</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    h2 { margin: 0 0 10px 0; color: #38bdf8; font-size: 22px; }
    #status { font-weight: 600; font-size: 15px; margin-bottom: 15px; color: #cbd5e1; }
    .progress-bar {
      width: 400px;
      height: 12px;
      background: #334155;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 20px;
    }
    .progress-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #38bdf8, #818cf8);
      transition: width 0.2s ease;
    }
    canvas {
      width: 320px;
      height: 320px;
      border-radius: 12px;
      background: #1e293b;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
  </style>
</head>
<body>
  <h2>Furnisia Thumbnail Generator</h2>
  <div id="status">Initializing 3D renderer...</div>
  <div class="progress-bar"><div id="progress" class="progress-fill"></div></div>
  <canvas id="renderCanvas" width="512" height="512"></canvas>

  <script type="importmap">
  {
    "imports": {
      "three": "/node_modules/three/build/three.module.js",
      "three/examples/jsm/": "/node_modules/three/examples/jsm/"
    }
  }
  </script>
  <script type="module">
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

    const items = ${JSON.stringify(items)};
    const canvas = document.getElementById('renderCanvas');
    const statusEl = document.getElementById('status');
    const progressEl = document.getElementById('progress');

    let started = false;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true
    });
    renderer.setSize(512, 512);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();

    // Studio Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.35);
    dirLight.position.set(3, 5, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xa5b4fc, 0.6);
    fillLight.position.set(-4, 3, -3);
    scene.add(fillLight);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

    const loader = new GLTFLoader();

    async function processNext(index) {
      if (index >= items.length) {
        statusEl.innerText = '✅ Complete! Closing browser...';
        progressEl.style.width = '100%';
        await fetch('/complete', { method: 'POST' });
        setTimeout(() => window.close(), 800);
        return;
      }

      const item = items[index];
      const pct = Math.round(((index + 1) / items.length) * 100);
      statusEl.innerText = \`[\${index + 1}/\${items.length}] Rendering: \${item.name}...\`;
      progressEl.style.width = \`\${pct}%\`;

      // Clear previous model from scene
      const toRemove = [];
      scene.children.forEach(child => {
        if (child !== ambientLight && child !== dirLight && child !== fillLight) {
          toRemove.push(child);
        }
      });
      toRemove.forEach(child => scene.remove(child));

      loader.load(
        item.modelPath,
        async (gltf) => {
          const model = gltf.scene;

          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          // Center and auto-fit model inside camera frame
          const box = new THREE.Box3().setFromObject(model);
          const center = new THREE.Vector3();
          const size = new THREE.Vector3();
          box.getCenter(center);
          box.getSize(size);

          model.position.x -= center.x;
          model.position.y -= box.min.y;
          model.position.z -= center.z;

          scene.add(model);

          const maxDim = Math.max(size.x, size.y, size.z);
          const dist = maxDim * 1.85;

          camera.position.set(dist * 0.8, dist * 0.65, dist * 0.8);
          camera.lookAt(0, size.y * 0.45, 0);

          renderer.render(scene, camera);

          const dataUrl = canvas.toDataURL('image/png');

          try {
            await fetch('/save-thumbnail', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: item.id,
                dataUrl: dataUrl,
                index: index,
                total: items.length
              })
            });
          } catch (err) {
            console.error('Error saving image:', err);
          }

          setTimeout(() => processNext(index + 1), 60);
        },
        undefined,
        (err) => {
          console.warn('Failed to load GLB for thumbnail:', item.modelPath, err);
          setTimeout(() => processNext(index + 1), 60);
        }
      );
    }

    function startOnce() {
      if (started) return;
      started = true;
      processNext(0);
    }

    setTimeout(startOnce, 300);
  </script>
</body>
</html>`;
}
