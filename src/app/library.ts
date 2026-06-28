import type { MountRecord, S3Mount, LocalFolderMount } from "../db/database";
import type { S3Config } from "../storage/adapters/S3CompatibleAdapter";
import { newMountId, removeMount, saveMount } from "../storage/mountStore";
import { deleteThumbs } from "../thumbnails/opfsCache";
import { scanMount, getScanState } from "../catalog/scanner";
import { providerManager } from "./providerManager";

/** Load all providers on startup and resume any interrupted scans. */
export async function initLibrary(): Promise<void> {
  await providerManager.loadAll();
}

export async function addLocalFolderMount(): Promise<MountRecord> {
  if (typeof window.showDirectoryPicker !== "function") {
    throw new Error("This browser does not support local folder access.");
  }
  const handle = await window.showDirectoryPicker({ mode: "read" });
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
