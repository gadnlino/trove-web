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

/**
 * Local folder adapter backed by the File System Access API. Grants read/write
 * access to a user-selected directory via a persisted directory handle.
 *
 * Capabilities: no real signed URLs (consumers read bytes directly), range
 * reads supported by slicing the File, and no change events (the API does not
 * surface them).
 */
export class LocalFolderAdapter implements StorageProvider {
  readonly kind: ProviderKind = "local-folder";
  readonly capabilities: ProviderCapabilities = {
    signedUrls: false,
    rangeRequests: true,
    changeEvents: false,
  };

  constructor(
    readonly mountId: string,
    private readonly root: FileSystemDirectoryHandle
  ) {}

  /** Ensure we still hold permission to the directory (may prompt). */
  async ensurePermission(mode: "read" | "readwrite" = "read"): Promise<boolean> {
    const handle = this.root as FileSystemHandle;
    const opts = { mode };
    if (handle.queryPermission && (await handle.queryPermission(opts)) === "granted") {
      return true;
    }
    if (handle.requestPermission) {
      return (await handle.requestPermission(opts)) === "granted";
    }
    return true;
  }

  private async resolveDir(path: string): Promise<FileSystemDirectoryHandle> {
    const segments = splitPath(path);
    let dir = this.root;
    for (const segment of segments) {
      dir = await dir.getDirectoryHandle(segment);
    }
    return dir;
  }

  private async resolveFile(path: string): Promise<File> {
    const segments = splitPath(path);
    const fileName = segments.pop();
    if (!fileName) throw new Error(`Not a file path: ${path}`);
    let dir = this.root;
    for (const segment of segments) {
      dir = await dir.getDirectoryHandle(segment);
    }
    const fileHandle = await dir.getFileHandle(fileName);
    return fileHandle.getFile();
  }

  async list(path: string, _opts?: ListOptions): Promise<ListResult> {
    const dir = await this.resolveDir(path);
    const items: ListResult["items"] = [];
    // `entries()` yields [name, handle] pairs.
    for await (const [name, handle] of dir.entries()) {
      const childPath = path ? `${path}/${name}` : name;
      if (handle.kind === "directory") {
        items.push({ path: childPath, name, isDirectory: true });
      } else {
        const file = await (handle as FileSystemFileHandle).getFile();
        items.push({
          path: childPath,
          name,
          isDirectory: false,
          size: file.size,
          modifiedAt: file.lastModified,
          mediaType: mediaTypeOf(name),
        });
      }
    }
    return { items };
  }

  async stat(path: string): Promise<FileMetadata> {
    const file = await this.resolveFile(path);
    return {
      path,
      size: file.size,
      modifiedAt: file.lastModified,
      contentType: file.type || contentTypeOf(path),
      mediaType: mediaTypeOf(path),
    };
  }

  async read(path: string, range?: ByteRange): Promise<ReadableStream<Uint8Array>> {
    const file = await this.resolveFile(path);
    const blob = range ? file.slice(range.start, range.end + 1) : file;
    return blob.stream() as unknown as ReadableStream<Uint8Array>;
  }

  async write(path: string, data: Blob | ReadableStream<Uint8Array>): Promise<void> {
    const segments = splitPath(path);
    const fileName = segments.pop();
    if (!fileName) throw new Error(`Not a file path: ${path}`);
    let dir = this.root;
    for (const segment of segments) {
      dir = await dir.getDirectoryHandle(segment, { create: true });
    }
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data instanceof Blob ? data : await streamToBlob(data));
    await writable.close();
  }

  async delete(path: string): Promise<void> {
    const segments = splitPath(path);
    const fileName = segments.pop();
    if (!fileName) throw new Error(`Not a file path: ${path}`);
    const dir = await this.resolveDir(segments.join("/"));
    await dir.removeEntry(fileName);
  }
}

function splitPath(path: string): string[] {
  return path.split("/").filter(Boolean);
}

async function streamToBlob(stream: ReadableStream<Uint8Array>): Promise<Blob> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return new Blob(chunks as BlobPart[]);
}
