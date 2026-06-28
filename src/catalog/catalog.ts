import { db, mediaId, type MediaItem } from "../db/database";
import type { MediaType } from "../core/types";
import type { FileEntry } from "../core/types";
import { deleteThumbs } from "../thumbnails/opfsCache";

/** Filter accepted by `queryItems`. */
export interface CatalogFilter {
  mountId?: string;
  mediaType?: MediaType;
  /** Inclusive lower bound on capturedAt (epoch ms). */
  from?: number;
  /** Inclusive upper bound on capturedAt (epoch ms). */
  to?: number;
}

/** Insert/update a media item from a scanned file entry. */
export async function upsertFromEntry(
  mountId: string,
  entry: FileEntry & { mediaType: MediaType }
): Promise<MediaItem> {
  const database = await db();
  const id = mediaId(mountId, entry.path);
  const existing = await database.get("media", id);

  const changed = !!existing && existing.modifiedAt !== entry.modifiedAt;
  const record: MediaItem = {
    id,
    mountId,
    path: entry.path,
    name: entry.name,
    mediaType: entry.mediaType,
    size: entry.size ?? existing?.size ?? 0,
    modifiedAt: entry.modifiedAt,
    capturedAt: entry.modifiedAt ?? existing?.capturedAt ?? Date.now(),
    width: changed ? undefined : existing?.width,
    height: changed ? undefined : existing?.height,
    durationSec: changed ? undefined : existing?.durationSec,
    thumbStatus: existing && !changed ? existing.thumbStatus : "pending",
    thumbKey: changed ? undefined : existing?.thumbKey,
    previewKey: changed ? undefined : existing?.previewKey,
    indexedAt: Date.now(),
  };
  await database.put("media", record);
  return record;
}

export async function getItem(id: string): Promise<MediaItem | undefined> {
  return (await db()).get("media", id);
}

export async function putItem(item: MediaItem): Promise<void> {
  await (await db()).put("media", item);
}

/** Query the catalog, newest first, applying an in-memory filter. */
export async function queryItems(filter: CatalogFilter = {}): Promise<MediaItem[]> {
  const database = await db();
  let items: MediaItem[];
  if (filter.mountId) {
    items = await database.getAllFromIndex("media", "by-mount", filter.mountId);
  } else if (filter.mediaType) {
    items = await database.getAllFromIndex("media", "by-type", filter.mediaType);
  } else {
    items = await database.getAll("media");
  }
  return items
    .filter((it) => (filter.mediaType ? it.mediaType === filter.mediaType : true))
    .filter((it) => (filter.mountId ? it.mountId === filter.mountId : true))
    .filter((it) => (filter.from === undefined ? true : it.capturedAt >= filter.from))
    .filter((it) => (filter.to === undefined ? true : it.capturedAt <= filter.to))
    .sort((a, b) => b.capturedAt - a.capturedAt);
}

/** Items still needing a thumbnail (for proactive/background generation). */
export async function pendingThumbnailItems(limit = 50): Promise<MediaItem[]> {
  const database = await db();
  const items = await database.getAllFromIndex("media", "by-thumbStatus", "pending");
  return items.slice(0, limit);
}

/**
 * Delete catalog entries for a mount that were not touched during the current
 * scan run (i.e. they no longer exist in the backend), along with their cached
 * thumbnails.
 */
export async function reconcileStale(mountId: string, runStartedAt: number): Promise<number> {
  const database = await db();
  const items = await database.getAllFromIndex("media", "by-mount", mountId);
  const stale = items.filter((it) => it.indexedAt < runStartedAt);
  for (const it of stale) {
    await database.delete("media", it.id);
    await deleteThumbs([it.thumbKey, it.previewKey]);
  }
  return stale.length;
}
