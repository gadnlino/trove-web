import { db, type MountRecord, type ScanState } from "../db/database";
import type { StorageProvider } from "../storage/StorageProvider";
import { reconcileStale, upsertFromEntry } from "./catalog";

export interface ScanCallbacks {
  onProgress?: (scannedCount: number) => void;
  signal?: AbortSignal;
}

async function putScan(state: ScanState): Promise<void> {
  await (await db()).put("scanState", state);
}

export async function getScanState(mountId: string): Promise<ScanState | undefined> {
  return (await db()).get("scanState", mountId);
}

/**
 * Scan a mount and reconcile the catalog. Walks directories using a persisted
 * stack so an interrupted scan resumes where it stopped. A full run that
 * completes also removes catalog entries for media that no longer exist.
 */
export async function scanMount(
  mount: MountRecord,
  provider: StorageProvider,
  cb: ScanCallbacks = {}
): Promise<void> {
  const prior = await getScanState(mount.id);
  const resuming =
    !!prior && prior.status !== "done" && prior.pendingDirs.length > 0 && !!prior.runStartedAt;

  const state: ScanState = resuming
    ? { ...prior!, status: "scanning" }
    : {
        mountId: mount.id,
        status: "scanning",
        pendingDirs: [""],
        scannedCount: 0,
        runStartedAt: Date.now(),
      };
  await putScan(state);
  const runStartedAt = state.runStartedAt!;

  try {
    while (state.pendingDirs.length > 0) {
      if (cb.signal?.aborted) {
        state.status = "paused";
        await putScan(state);
        return;
      }
      const dir = state.pendingDirs.pop()!;
      let cursor: string | undefined;
      do {
        const { items, cursor: next } = await provider.list(dir, { cursor });
        cursor = next;
        for (const entry of items) {
          if (entry.isDirectory) {
            state.pendingDirs.push(entry.path);
          } else if (entry.mediaType) {
            await upsertFromEntry(mount.id, { ...entry, mediaType: entry.mediaType });
            state.scannedCount += 1;
            cb.onProgress?.(state.scannedCount);
          }
        }
        await putScan(state); // persist progress + pendingDirs for resumability
      } while (cursor);
    }

    await reconcileStale(mount.id, runStartedAt);
    state.status = "done";
    state.lastScanAt = Date.now();
    await putScan(state);
  } catch (err) {
    state.status = "error";
    state.error = err instanceof Error ? err.message : String(err);
    await putScan(state);
    throw err;
  }
}
