import type {
  ByteRange,
  FileMetadata,
  ListOptions,
  ListResult,
  ProviderCapabilities,
  ProviderKind,
} from "../../core/types";
import { mediaTypeOf } from "../../core/media";
import type { StorageProvider } from "../StorageProvider";

/**
 * Read-mostly adapter for a user's personal Google Drive, authenticated via
 * OAuth (PKCE, no application backend). Implemented against the Drive v3 REST
 * API using a bearer access token.
 *
 * Capabilities: no signed URLs (bytes are streamed through `read`), range
 * requests not relied upon (declared false; the viewer uses buffered playback),
 * and no change events (thumbnails are produced on-demand).
 */
export class UserDriveAdapter implements StorageProvider {
  readonly kind: ProviderKind = "user-drive";
  readonly capabilities: ProviderCapabilities = {
    signedUrls: false,
    rangeRequests: false,
    changeEvents: false,
  };

  private static readonly API = "https://www.googleapis.com/drive/v3";

  constructor(
    readonly mountId: string,
    private readonly getAccessToken: () => Promise<string>
  ) {}

  private async authHeaders(): Promise<HeadersInit> {
    return { Authorization: `Bearer ${await this.getAccessToken()}` };
  }

  async list(path: string, opts?: ListOptions): Promise<ListResult> {
    // `path` is treated as a Drive folder id; empty means the root folder.
    const folderId = path || "root";
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const fields = encodeURIComponent(
      "nextPageToken, files(id, name, mimeType, size, modifiedTime)"
    );
    const url =
      `${UserDriveAdapter.API}/files?q=${query}&fields=${fields}&pageSize=200` +
      (opts?.cursor ? `&pageToken=${encodeURIComponent(opts.cursor)}` : "");

    const res = await fetch(url, { headers: await this.authHeaders() });
    if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
    const json = (await res.json()) as {
      nextPageToken?: string;
      files: Array<{
        id: string;
        name: string;
        mimeType: string;
        size?: string;
        modifiedTime?: string;
      }>;
    };

    const items: ListResult["items"] = json.files.map((f) => {
      const isDirectory = f.mimeType === "application/vnd.google-apps.folder";
      return {
        path: f.id,
        name: f.name,
        isDirectory,
        size: f.size ? Number(f.size) : undefined,
        modifiedAt: f.modifiedTime ? Date.parse(f.modifiedTime) : undefined,
        mediaType: isDirectory ? undefined : mediaTypeOf(f.name),
      };
    });
    return { items, cursor: json.nextPageToken };
  }

  async stat(path: string): Promise<FileMetadata> {
    const fields = encodeURIComponent("id, name, mimeType, size, modifiedTime");
    const res = await fetch(
      `${UserDriveAdapter.API}/files/${encodeURIComponent(path)}?fields=${fields}`,
      { headers: await this.authHeaders() }
    );
    if (!res.ok) throw new Error(`Drive stat failed: ${res.status}`);
    const f = (await res.json()) as {
      name: string;
      mimeType: string;
      size?: string;
      modifiedTime?: string;
    };
    return {
      path,
      size: f.size ? Number(f.size) : 0,
      modifiedAt: f.modifiedTime ? Date.parse(f.modifiedTime) : undefined,
      contentType: f.mimeType,
      mediaType: mediaTypeOf(f.name),
    };
  }

  async read(path: string, range?: ByteRange): Promise<ReadableStream<Uint8Array>> {
    const headers = new Headers(await this.authHeaders());
    // Range is attempted opportunistically; capability is declared false so
    // consumers do not depend on it.
    if (range) headers.set("Range", `bytes=${range.start}-${range.end}`);
    const res = await fetch(`${UserDriveAdapter.API}/files/${encodeURIComponent(path)}?alt=media`, {
      headers,
    });
    if (!res.ok || !res.body) throw new Error(`Drive read failed: ${res.status}`);
    return res.body;
  }

  async write(): Promise<void> {
    throw new Error("UserDriveAdapter is read-only");
  }

  async delete(): Promise<void> {
    throw new Error("UserDriveAdapter is read-only");
  }
}
