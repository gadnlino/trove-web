import type {
  ByteRange,
  FileMetadata,
  ListOptions,
  ListResult,
  ProviderCapabilities,
  ProviderKind,
} from "../../core/types";
import { contentTypeOf, mediaTypeOf } from "../../core/media";
import type { StorageProvider } from "../StorageProvider";
import { getSnapshot } from "../snapshotRegistry";

/** Thrown when a snapshot mount is used before the folder is reconnected. */
export class SnapshotNotConnectedError extends Error {
  constructor(mountId: string) {
    super(`Folder not connected for mount ${mountId} — reconnect it to continue.`);
    this.name = "SnapshotNotConnectedError";
  }
}

/**
 * Read-only local folder adapter backed by the universally supported
 * `webkitdirectory` picker. Bytes come from an in-memory file map held in the
 * snapshot registry for the current session; the map is empty until the user
 * connects (or reconnects) the folder.
 */
export class LocalSnapshotAdapter implements StorageProvider {
  readonly kind: ProviderKind = "local-snapshot";
  readonly capabilities: ProviderCapabilities = {
    signedUrls: false,
    rangeRequests: true,
    changeEvents: false,
  };

  constructor(readonly mountId: string) {}

  private map(): Map<string, File> {
    const map = getSnapshot(this.mountId);
    if (!map) throw new SnapshotNotConnectedError(this.mountId);
    return map;
  }

  async list(path: string, _opts?: ListOptions): Promise<ListResult> {
    const map = this.map();
    const prefix = path ? `${path.replace(/\/+$/, "")}/` : "";
    const dirs = new Set<string>();
    const items: ListResult["items"] = [];

    for (const [key, file] of map) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      if (!rest) continue;
      const slash = rest.indexOf("/");
      if (slash >= 0) {
        dirs.add(rest.slice(0, slash));
      } else {
        items.push({
          path: key,
          name: rest,
          isDirectory: false,
          size: file.size,
          modifiedAt: file.lastModified,
          mediaType: mediaTypeOf(rest),
        });
      }
    }

    for (const name of dirs) {
      const childPath = prefix + name;
      items.push({ path: childPath, name, isDirectory: true });
    }
    return { items };
  }

  async stat(path: string): Promise<FileMetadata> {
    const file = this.map().get(path);
    if (!file) throw new Error(`Not found: ${path}`);
    return {
      path,
      size: file.size,
      modifiedAt: file.lastModified,
      contentType: file.type || contentTypeOf(path),
      mediaType: mediaTypeOf(path),
    };
  }

  async read(path: string, range?: ByteRange): Promise<ReadableStream<Uint8Array>> {
    const file = this.map().get(path);
    if (!file) throw new Error(`Not found: ${path}`);
    const blob = range ? file.slice(range.start, range.end + 1) : file;
    return blob.stream() as unknown as ReadableStream<Uint8Array>;
  }

  async write(): Promise<void> {
    throw new Error("LocalSnapshotAdapter is read-only");
  }

  async delete(): Promise<void> {
    throw new Error("LocalSnapshotAdapter is read-only");
  }
}
