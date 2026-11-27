import type { TextLine } from './scaleFromLabels';

// Room-size labels on plans are small italic text; recognition is far more reliable after
// enlarging, greying and boosting contrast.
const UPSCALE = 3;
const SPARSE_TEXT = '11'; // Tesseract page mode: text scattered across the page, no layout

// Reads all text lines on the plan (free, in-browser OCR). The first call downloads the
// English text model once from a public CDN; the library is loaded only when needed.
export async function readPlanText(raster: ImageData): Promise<TextLine[]> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    await worker.setParameters({ tessedit_pageseg_mode: SPARSE_TEXT as never });
    const { data } = await worker.recognize(enlarge(raster), {}, { blocks: true });
    const lines: TextLine[] = [];
    for (const block of data.blocks ?? []) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          lines.push({
            text: line.text.trim(),
            x0: line.bbox.x0 / UPSCALE,
            y0: line.bbox.y0 / UPSCALE,
            x1: line.bbox.x1 / UPSCALE,
            y1: line.bbox.y1 / UPSCALE,
          });
        }
      }
    }
    return lines;
  } finally {
    await worker.terminate();
  }
}

function enlarge(raster: ImageData): HTMLCanvasElement {
  const source = document.createElement('canvas');
  source.width = raster.width;
  source.height = raster.height;
  source.getContext('2d')!.putImageData(raster, 0, 0);

  const canvas = document.createElement('canvas');
  canvas.width = raster.width * UPSCALE;
  canvas.height = raster.height * UPSCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.filter = 'grayscale(1) contrast(1.4)';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}
