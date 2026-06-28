import type { MountRecord, S3Mount } from "../db/database";
import { getMount, updateDriveTokens } from "./mountStore";
import { refreshTokens, type TokenSet } from "./oauth/pkce";
import { vault } from "./credentialVault";
import type { StorageProvider } from "./StorageProvider";
import { LocalFolderAdapter } from "./adapters/LocalFolderAdapter";
import { LocalSnapshotAdapter } from "./adapters/LocalSnapshotAdapter";
import {
  S3CompatibleAdapter,
  type S3Config,
  type S3Secret,
} from "./adapters/S3CompatibleAdapter";
import { UserDriveAdapter } from "./adapters/UserDriveAdapter";

/** Whether a mount needs decrypted credentials to operate. */
export function requiresCredentials(mount: MountRecord): boolean {
  return mount.kind === "s3-compatible" || mount.kind === "user-drive";
}

/** Whether a mount still has plaintext credentials (pre-encryption / legacy). */
export function hasPlaintextSecret(mount: MountRecord): boolean {
  if (mount.kind === "s3-compatible") return !!mount.legacySecret;
  if (mount.kind === "user-drive") return !!mount.legacyTokens;
  return false;
}

/** A provider can be built now if it needs no credentials, has plaintext, or the vault is unlocked. */
export function canBuildProvider(mount: MountRecord): boolean {
  if (!requiresCredentials(mount)) return true;
  return hasPlaintextSecret(mount) || !vault.isLocked();
}

export function createCredentialFreeProvider(mount: MountRecord): StorageProvider | null {
  switch (mount.kind) {
    case "local-folder":
      return new LocalFolderAdapter(mount.id, mount.handle);
    case "local-snapshot":
      return new LocalSnapshotAdapter(mount.id);
    default:
      return null;
  }
}

/** Build a provider, decrypting credentials via the vault when needed. */
export async function createProvider(mount: MountRecord): Promise<StorageProvider> {
  const free = createCredentialFreeProvider(mount);
  if (free) return free;

  switch (mount.kind) {
    case "s3-compatible": {
      const secret = await getS3Secret(mount);
      const config: S3Config = { ...mount.s3, ...secret };
      return new S3CompatibleAdapter(mount.id, config);
    }
    case "user-drive":
      return new UserDriveAdapter(mount.id, makeDriveTokenGetter(mount.id));
    default:
      throw new Error(`Unknown mount kind: ${(mount as MountRecord).kind}`);
  }
}

async function getS3Secret(mount: S3Mount): Promise<S3Secret> {
  if (mount.legacySecret) return mount.legacySecret;
  if (mount.secret) return vault.decrypt<S3Secret>(mount.secret);
  throw new Error("S3 mount has no credentials");
}

function makeDriveTokenGetter(mountId: string): () => Promise<string> {
  return async () => {
    const mount = await getMount(mountId);
    if (!mount || mount.kind !== "user-drive") {
      throw new Error("Drive is not connected — reconnect in settings");
    }
    let tokens: TokenSet;
    if (mount.legacyTokens) tokens = mount.legacyTokens;
    else if (mount.tokensEnc) tokens = await vault.decrypt<TokenSet>(mount.tokensEnc);
    else throw new Error("Drive session expired — reconnect in settings");

    if (tokens.expiresAt <= Date.now() + 30_000) {
      if (!tokens.refreshToken) {
        throw new Error("Drive session expired — reconnect in settings");
      }
      tokens = await refreshTokens(mount.oauth, tokens.refreshToken);
      // Persist refreshed tokens encrypted when the vault is available.
      if (!vault.isLocked()) {
        await updateDriveTokens(mountId, await vault.encrypt(tokens));
      }
    }
    return tokens.accessToken;
  };
}
