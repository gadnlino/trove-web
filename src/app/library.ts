import type { MountRecord, S3Mount, LocalFolderMount, LocalSnapshotMount } from "../db/database";
import type { S3Config } from "../storage/adapters/S3CompatibleAdapter";
import { newMountId, removeMount, saveMount } from "../storage/mountStore";
import { deriveRootFolderName, pickDirectoryFiles } from "../storage/folderPicker";
import { buildFileMap, hasSnapshot, setSnapshot } from "../storage/snapshotRegistry";
import { deleteThumbs } from "../thumbnails/opfsCache";
import { scanMount, getScanState } from "../catalog/scanner";
import { providerManager } from "./providerManager";

/** True when the browser supports persistent, writable local folders. */
export function supportsFileSystemAccess(): boolean {
  return typeof window.showDirectoryPicker === "function";
}

/** Load all providers on startup and resume any interrupted scans. */
export async function initLibrary(): Promise<void> {
  await providerManager.loadAll();
}

/**
 * Mount a local folder using the best adapter the browser supports: the
 * persistent File System Access adapter where available, otherwise the
 * universal (read-only, re-pick per session) snapshot adapter.
 */
export async function addLocalFolderMount(): Promise<MountRecord> {
  return supportsFileSystemAccess() ? addFileSystemAccessMount() : addSnapshotMount();
}

async function addFileSystemAccessMount(): Promise<MountRecord> {
  const handle = await window.showDirectoryPicker!({ mode: "read" });
  const mount: LocalFolderMount = {
    id: newMountId(),
    kind: "local-folder",
    name: handle.name || "Local folder",
    createdAt: Date.now(),
    handle,
  };
  await saveMount(mount);
  providerManager.register(mount);
  return mount;
}

async function addSnapshotMount(): Promise<MountRecord> {
  const files = await pickDirectoryFiles();
  const mount: LocalSnapshotMount = {
    id: newMountId(),
    kind: "local-snapshot",
    name: deriveRootFolderName(files),
    createdAt: Date.now(),
  };
  setSnapshot(mount.id, buildFileMap(files));
  await saveMount(mount);
  providerManager.register(mount);
  return mount;
}

/** Whether a snapshot mount needs the folder reconnected this session. */
export function needsReconnect(mount: MountRecord): boolean {
  return mount.kind === "local-snapshot" && !hasSnapshot(mount.id);
}

/**
 * Reconnect a snapshot mount by reselecting its folder, then rescan so the
 * catalog reconciles any added/removed files.
 */
export async function reconnectSnapshotMount(
  mount: MountRecord,
  onProgress?: (count: number) => void
): Promise<void> {
  if (mount.kind !== "local-snapshot") return;
  const files = await pickDirectoryFiles();
  setSnapshot(mount.id, buildFileMap(files));
  await startScan(mount, onProgress);
}

export async function addS3Mount(name: string, s3: S3Config): Promise<MountRecord> {
  const mount: S3Mount = {
    id: newMountId(),
    kind: "s3-compatible",
    name: name || s3.bucket,
    createdAt: Date.now(),
    s3,
  };
  // Validate access before persisting the mount.
  const provider = providerManager.register(mount);
  await provider.list("");
  await saveMount(mount);
  return mount;
}

export async function startScan(
  mount: MountRecord,
  onProgress?: (count: number) => void
): Promise<void> {
  const provider = providerManager.get(mount.id);
  if (!provider) throw new Error("Provider not loaded for mount");
  await scanMount(mount, provider, { onProgress });
}

export async function removeMountFull(mountId: string): Promise<void> {
  const removedThumbKeys = await removeMount(mountId);
  await deleteThumbs(removedThumbKeys);
  providerManager.unregister(mountId);
}

export { getScanState };
