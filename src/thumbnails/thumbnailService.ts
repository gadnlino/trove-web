import { mediaId, type MediaItem } from "../db/database";
import { getItem, putItem, pendingThumbnailItems } from "../catalog/catalog";
import { canSignUrls, canSubscribe, type StorageProvider } from "../storage/StorageProvider";
import type { ImageThumbRequest, ImageThumbResponse } from "./imageWorker";
import { generateVideoThumb } from "./videoThumbnailer";
import { readThumbBlob, writeThumb, thumbKeyFor } from "./opfsCache";
import type { ThumbSizes } from "./canvas";

const SIZES: ThumbSizes = { grid: 320, preview: 1280 };

/** Fetch an object's bytes via the cheapest path the provider supports. */
async function fetchBlob(provider: StorageProvider, path: string): Promise<Blob> {
  if (canSignUrls(provider)) {
    const url = await provider.getSignedUrl(path, 300);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return res.blob();
  }
  const stream = await provider.read(path);
  return new Response(stream).blob();
}

/**
 * Orchestrates client-side thumbnail generation: image work runs in a Web
 * Worker; video work runs on the main thread (`<video>`/ffmpeg.wasm). Results
 * are cached in OPFS and referenced from the catalog so each item is processed
 * at most once. Capable providers trigger generation proactively; others are
 * generated on-demand at first view.
 */
class ThumbnailService {
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, (res: ImageThumbResponse) => void>();
  private readonly unsubscribers = new Map<string, () => void>();

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL("./imageWorker.ts", import.meta.url), {
        type: "module",
      });
      this.worker.onmessage = (e: MessageEvent<ImageThumbResponse>) => {
        const resolve = this.pending.get(e.data.id);
        if (resolve) {
          this.pending.delete(e.data.id);
          resolve(e.data);
        }
      };
    }
    return this.worker;
  }

  private generateImageInWorker(blob: Blob): Promise<ImageThumbResponse> {
    const id = this.nextId++;
    const req: ImageThumbRequest = { id, blob, sizes: SIZES };
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.getWorker().postMessage(req);
    });
  }

  /** Generate (or regenerate) thumbnails for an item and update the catalog. */
  async generate(item: MediaItem, provider: StorageProvider): Promise<MediaItem> {
    try {
      const blob = await fetchBlob(provider, item.path);
      const gridKey = thumbKeyFor(item.mountId, item.path, "grid");
      const previewKey = thumbKeyFor(item.mountId, item.path, "preview");

      let width: number | undefined;
      let height: number | undefined;
      let durationSec: number | undefined;

      if (item.mediaType === "image") {
        const res = await this.generateImageInWorker(blob);
        if (!res.ok || !res.grid || !res.preview) {
          throw new Error(res.error ?? "image thumbnail failed");
        }
        await writeThumb(gridKey, res.grid);
        await writeThumb(previewKey, res.preview);
        width = res.width;
        height = res.height;
      } else {
        const res = await generateVideoThumb(blob, item.name, SIZES);
        await writeThumb(gridKey, res.grid);
        await writeThumb(previewKey, res.preview);
        width = res.width;
        height = res.height;
        durationSec = res.durationSec;
      }

      const updated: MediaItem = {
        ...item,
        thumbStatus: "ready",
        thumbKey: gridKey,
        previewKey,
        width,
        height,
        durationSec,
      };
      await putItem(updated);
      return updated;
    } catch (err) {
      const failed: MediaItem = { ...item, thumbStatus: "error" };
      await putItem(failed);
      throw err;
    }
  }

  /** Return the item if its thumbnail is cached, otherwise generate on-demand. */
  async ensure(item: MediaItem, provider: StorageProvider): Promise<MediaItem> {
    if (item.thumbStatus === "ready" && item.thumbKey) {
      const cached = await readThumbBlob(item.thumbKey);
      if (cached) return item; // reuse — do not regenerate
    }
    return this.generate(item, provider);
  }

  /**
   * Attach a provider: if it emits change events, generate proactively for new
   * items; otherwise nothing to do (items are handled on-demand / by the queue).
   */
  attachProvider(provider: StorageProvider): void {
    if (!canSubscribe(provider)) return;
    if (this.unsubscribers.has(provider.mountId)) return;
    const unsub = provider.subscribe(async (event) => {
      if (event.type === "removed") return;
      const item = await getItem(mediaId(provider.mountId, event.path));
      if (item && item.thumbStatus !== "ready") {
        await this.generate(item, provider).catch(() => undefined);
      }
    });
    this.unsubscribers.set(provider.mountId, unsub);
  }

  /** Background pass over pending items (used for capable backends/catch-up). */
  async runQueue(
    getProvider: (mountId: string) => StorageProvider | undefined,
    concurrency = 2
  ): Promise<void> {
    const items = await pendingThumbnailItems(200);
    let cursor = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (cursor < items.length) {
        const item = items[cursor++];
        const provider = getProvider(item.mountId);
        if (!provider) continue;
        await this.generate(item, provider).catch(() => undefined);
      }
    });
    await Promise.all(workers);
  }
}

export const thumbnails = new ThumbnailService();
