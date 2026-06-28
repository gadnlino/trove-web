import type { MountRecord } from "../db/database";
import { listMounts } from "../storage/mountStore";
import {
  canBuildProvider,
  createProvider,
  requiresCredentials,
} from "../storage/registry";
import type { StorageProvider } from "../storage/StorageProvider";
import { thumbnails } from "../thumbnails/thumbnailService";

/**
 * Holds the live `StorageProvider` instances for all mounts. Credential-free
 * mounts are always available; credentialed mounts are built only once their
 * credentials can be resolved (plaintext legacy or an unlocked vault), and are
 * dropped when the vault locks.
 */
class ProviderManager {
  private readonly providers = new Map<string, StorageProvider>();

  async loadAll(): Promise<void> {
    this.providers.clear();
    for (const mount of await listMounts()) {
      await this.register(mount);
    }
  }

  /** Build and register a provider for a mount if it can be built now. */
  async register(mount: MountRecord): Promise<StorageProvider | undefined> {
    if (!canBuildProvider(mount)) return undefined;
    const provider = await createProvider(mount);
    this.providers.set(mount.id, provider);
    thumbnails.attachProvider(provider);
    return provider;
  }

  unregister(mountId: string): void {
    this.providers.delete(mountId);
  }

  /** After unlocking: build any credentialed providers that were gated. */
  async onUnlock(): Promise<void> {
    for (const mount of await listMounts()) {
      if (requiresCredentials(mount) && !this.providers.has(mount.id)) {
        await this.register(mount);
      }
    }
  }

  /** After locking: drop providers that depend on decrypted credentials. */
  onLock(): void {
    for (const [id, provider] of this.providers) {
      if (provider.kind === "s3-compatible" || provider.kind === "user-drive") {
        this.providers.delete(id);
      }
    }
  }

  get(mountId: string): StorageProvider | undefined {
    return this.providers.get(mountId);
  }

  all(): StorageProvider[] {
    return [...this.providers.values()];
  }
}

export const providerManager = new ProviderManager();
