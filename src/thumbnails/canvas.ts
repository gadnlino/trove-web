/** Shared canvas helpers for downscaling decoded frames into WebP thumbnails. */

export interface ThumbSizes {
  grid: number;
  preview: number;
}

export interface ThumbResult {
  grid: Blob;
  preview: Blob;
  width: number;
  height: number;
}

async function downscaleBitmap(bitmap: ImageBitmap, maxEdge: number): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.convertToBlob({ type: "image/webp", quality: 0.8 });
}

export async function bitmapToThumbs(bitmap: ImageBitmap, sizes: ThumbSizes): Promise<ThumbResult> {
  const grid = await downscaleBitmap(bitmap, sizes.grid);
  const preview = await downscaleBitmap(bitmap, sizes.preview);
  return { grid, preview, width: bitmap.width, height: bitmap.height };
}
