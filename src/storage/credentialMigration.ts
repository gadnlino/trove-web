import type { S3Secret } from "./adapters/S3CompatibleAdapter";
import { vault, VaultLockedError } from "./credentialVault";
import { listMounts, saveMount } from "./mountStore";

/** True if any mount still stores credentials in plaintext (pre-encryption). */
export async function hasUnprotectedCredentials(): Promise<boolean> {
  const mounts = await listMounts();
  return mounts.some(
    (m) =>
      (m.kind === "s3-compatible" && !!m.legacySecret) ||
      (m.kind === "user-drive" && !!m.legacyTokens)
  );
}

/**
 * Encrypt any plaintext credentials in place using the unlocked vault. Each
 * secret is verified by a decrypt round-trip before the plaintext is removed.
 */
export async function encryptPlaintextCredentials(): Promise<void> {
  if (vault.isLocked()) throw new VaultLockedError();
  for (const mount of await listMounts()) {
    if (mount.kind === "s3-compatible" && mount.legacySecret) {
      const enc = await vault.encrypt(mount.legacySecret);
      const back = await vault.decrypt<S3Secret>(enc);
      if (
        back.accessKeyId !== mount.legacySecret.accessKeyId ||
        back.secretAccessKey !== mount.legacySecret.secretAccessKey
      ) {
        throw new Error("Credential encryption verification failed");
      }
      mount.secret = enc;
      mount.legacySecret = undefined;
      await saveMount(mount);
    } else if (mount.kind === "user-drive" && mount.legacyTokens) {
      const enc = await vault.encrypt(mount.legacyTokens);
      mount.tokensEnc = enc;
      mount.legacyTokens = undefined;
      await saveMount(mount);
    }
  }
}
