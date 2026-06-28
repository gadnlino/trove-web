import type { MountRecord } from "../db/database";
import { getMount, updateDriveTokens } from "./mountStore";
import { refreshTokens } from "./oauth/pkce";
import type { StorageProvider } from "./StorageProvider";
import { LocalFolderAdapter } from "./adapters/LocalFolderAdapter";
import { LocalSnapshotAdapter } from "./adapters/LocalSnapshotAdapter";
import { S3CompatibleAdapter } from "./adapters/S3CompatibleAdapter";
import { UserDriveAdapter } from "./adapters/UserDriveAdapter";

/**
 * Instantiates a concrete `StorageProvider` for a stored mount. This is the one
 * place that knows about concrete adapters; everything else depends only on the
 * `StorageProvider` interface.
 */
export function createProvider(mount: MountRecord): StorageProvider {
  switch (mount.kind) {
    case "local-folder":
      return new LocalFolderAdapter(mount.id, mount.handle);
    case "local-snapshot":
      return new LocalSnapshotAdapter(mount.id);
    case "s3-compatible":
      return new S3CompatibleAdapter(mount.id, mount.s3);
    case "user-drive":
      return new UserDriveAdapter(mount.id, makeDriveTokenGetter(mount.id));
  }
}

/** A token getter that reads stored tokens and refreshes them when expired. */
function makeDriveTokenGetter(mountId: string): () => Promise<string> {
  return async () => {
    const mount = await getMount(mountId);
    if (!mount || mount.kind !== "user-drive" || !mount.tokens) {
      throw new Error("Drive is not connected — reconnect in settings");
    }
    let tokens = mount.tokens;
    if (tokens.expiresAt <= Date.now() + 30_000) {
      if (!tokens.refreshToken) {
        throw new Error("Drive session expired — reconnect in settings");
      }
      tokens = await refreshTokens(mount.oauth, tokens.refreshToken);
      await updateDriveTokens(mountId, tokens);
    }
    return tokens.accessToken;
  };
}
