/**
 * Thumbnail cache backed by the Origin Private File System (OPFS). Thumbnails
 * are stored here once and referenced from the catalog, independent of which
 * backend holds the original.
 */

const THUMB_DIR = "thumbs";

async function thumbDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(THUMB_DIR, { create: true });
}

export async function writeThumb(key: string, blob: Blob): Promise<void> {
  const dir = await thumbDir();
  const handle = await dir.getFileHandle(key, { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function readThumbBlob(key: string): Promise<Blob | null> {
  try {
    const dir = await thumbDir();
    const handle = await dir.getFileHandle(key);
    return await handle.getFile();
  } catch {
    return null;
  }
}

/** Read a thumbnail and return an object URL (or null when missing). */
export async function readThumbUrl(key: string): Promise<string | null> {
  const blob = await readThumbBlob(key);
  return blob ? URL.createObjectURL(blob) : null;
}

export async function deleteThumbs(keys: Array<string | undefined>): Promise<void> {
  const dir = await thumbDir();
  for (const key of keys) {
    if (!key) continue;
    try {
      await dir.removeEntry(key);
    } catch {
      // already gone — ignore
    }
  }
}

/** Stable, filesystem-safe key for a media item + variant. */
export function thumbKeyFor(mountId: string, path: string, variant: "grid" | "preview"): string {
  const safe = `${mountId}:${path}`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${safe}.${variant}.webp`;
}
