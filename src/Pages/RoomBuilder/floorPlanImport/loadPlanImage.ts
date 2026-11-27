// Detection cost grows with pixel count and walls stay well resolved at this size.
const MAX_SIDE = 1600;

export interface PlanImage {
  url: string; // object URL of the (possibly downscaled) image, for display
  raster: ImageData;
}

export async function loadPlanImage(file: File): Promise<PlanImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  // Transparent PNGs: paint white first so "background" reads as light, like printed plans.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not read the image.');
  return { url: URL.createObjectURL(blob), raster: ctx.getImageData(0, 0, width, height) };
}
