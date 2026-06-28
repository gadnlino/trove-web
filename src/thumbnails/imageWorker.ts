/// <reference lib="webworker" />
/**
 * Off-main-thread image thumbnail generation using `createImageBitmap` and
 * `OffscreenCanvas`. Receives an image Blob and target sizes; replies with the
 * encoded WebP thumbnails so the gallery stays responsive.
 */

export interface ImageThumbRequest {
  id: number;
  blob: Blob;
  sizes: { grid: number; preview: number };
}

export interface ImageThumbResponse {
  id: number;
  ok: boolean;
  grid?: Blob;
  preview?: Blob;
  width?: number;
  height?: number;
  error?: string;
}

async function downscale(bitmap: ImageBitmap, maxEdge: number): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable in worker");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.convertToBlob({ type: "image/webp", quality: 0.8 });
}

self.onmessage = async (e: MessageEvent<ImageThumbRequest>) => {
  const { id, blob, sizes } = e.data;
  try {
    const bitmap = await createImageBitmap(blob);
    const grid = await downscale(bitmap, sizes.grid);
    const preview = await downscale(bitmap, sizes.preview);
    const res: ImageThumbResponse = {
      id,
      ok: true,
      grid,
      preview,
      width: bitmap.width,
      height: bitmap.height,
    };
    bitmap.close();
    (self as DedicatedWorkerGlobalScope).postMessage(res);
  } catch (err) {
    const res: ImageThumbResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    (self as DedicatedWorkerGlobalScope).postMessage(res);
  }
};
