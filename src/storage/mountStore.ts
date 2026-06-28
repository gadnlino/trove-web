import { db, type MountRecord, type VaultConfig } from "../db/database";
import type { EnvelopeData } from "../crypto/envelope";

/**
 * On-device storage of mount configuration and credentials. Everything lives in
 * IndexedDB on the user's machine and is never transmitted anywhere except to
 * the user's chosen backend.
 */

export function newMountId(): string {
  return `m_${crypto.randomUUID()}`;
}

export async function listMounts(): Promise<MountRecord[]> {
  return (await db()).getAll("mounts");
}

export async function getMount(id: string): Promise<MountRecord | undefined> {
  return (await db()).get("mounts", id);
}

export async function saveMount(mount: MountRecord): Promise<void> {
  await (await db()).put("mounts", mount);
}

/** Persist refreshed Drive tokens as an encrypted blob. */
export async function updateDriveTokens(id: string, tokensEnc: EnvelopeData): Promise<void> {
  const database = await db();
  const mount = await database.get("mounts", id);
  if (mount && mount.kind === "user-drive") {
    mount.tokensEnc = tokensEnc;
    mount.legacyTokens = undefined;
    await database.put("mounts", mount);
  }
}

export async function getVaultConfig(): Promise<VaultConfig | undefined> {
  return (await db()).get("vault", "vault");
}

export async function putVaultConfig(config: VaultConfig): Promise<void> {
  await (await db()).put("vault", config);
}

export async function deleteVaultConfig(): Promise<void> {
  await (await db()).delete("vault", "vault");
}

/** Remove a mount along with all of its catalog entries. */
export async function removeMount(id: string): Promise<string[]> {
  const database = await db();
  const tx = database.transaction(["mounts", "media", "scanState"], "readwrite");
  await tx.objectStore("mounts").delete(id);
  await tx.objectStore("scanState").delete(id);

  // Collect and delete this mount's media; return thumb keys for OPFS cleanup.
  const removedThumbKeys: string[] = [];
  const index = tx.objectStore("media").index("by-mount");
  let cursor = await index.openCursor(id);
  while (cursor) {
    const item = cursor.value;
    if (item.thumbKey) removedThumbKeys.push(item.thumbKey);
    if (item.previewKey) removedThumbKeys.push(item.previewKey);
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
  return removedThumbKeys;
}
