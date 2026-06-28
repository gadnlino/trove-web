import type { MountRecord } from "../db/database";
import { listMounts } from "../storage/mountStore";
import { createProvider } from "../storage/registry";
import type { StorageProvider } from "../storage/StorageProvider";
import { thumbnails } from "../thumbnails/thumbnailService";

/**
 * Holds the live `StorageProvider` instances for all mounts. The UI, catalog,
 * and thumbnail pipeline resolve providers through here by mount id.
 */
class ProviderManager {
  private readonly providers = new Map<string, StorageProvider>();

  async loadAll(): Promise<void> {
    this.providers.clear();
    for (const mount of await listMounts()) {
      this.register(mount);
    }
  }

  register(mount: MountRecord): StorageProvider {
    const provider = createProvider(mount);
    this.providers.set(mount.id, provider);
    thumbnails.attachProvider(provider);
    return provider;
  }

  unregister(mountId: string): void {
    this.providers.delete(mountId);
  }

  get(mountId: string): StorageProvider | undefined {
    return this.providers.get(mountId);
  }

  all(): StorageProvider[] {
    return [...this.providers.values()];
  }
}

export const providerManager = new ProviderManager();
