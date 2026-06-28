import type {
  ByteRange,
  FileMetadata,
  ListOptions,
  ListResult,
  ProviderCapabilities,
  ProviderKind,
} from "../core/types";

/**
 * The single contract every storage backend implements. The gallery, catalog,
 * and thumbnail pipeline depend ONLY on this interface — never on a concrete
 * adapter. Adding a new backend therefore requires no changes in consumers.
 */
export interface StorageProvider {
  /** Stable id of the mount this provider instance serves. */
  readonly mountId: string;
  /** Which family of backend this is. */
  readonly kind: ProviderKind;
  /** Declared capabilities; consumers branch on these. */
  readonly capabilities: ProviderCapabilities;

  /** List entries under a directory/prefix (paginated). */
  list(path: string, opts?: ListOptions): Promise<ListResult>;

  /** Fetch metadata for a single object. */
  stat(path: string): Promise<FileMetadata>;

  /**
   * Read an object's bytes. When `range` is provided and the provider declares
   * `rangeRequests`, only those bytes are returned.
   */
  read(path: string, range?: ByteRange): Promise<ReadableStream<Uint8Array>>;

  /** Write/overwrite an object. */
  write(path: string, data: Blob | ReadableStream<Uint8Array>): Promise<void>;

  /** Delete an object. */
  delete(path: string): Promise<void>;

  /**
   * Mint a signed URL the browser can fetch directly. Present only when
   * `capabilities.signedUrls` is true.
   */
  getSignedUrl?(path: string, ttlSeconds: number): Promise<string>;

  /**
   * Subscribe to change events. Present only when `capabilities.changeEvents`
   * is true. Returns an unsubscribe function.
   */
  subscribe?(listener: (event: StorageChangeEvent) => void): () => void;
}

export interface StorageChangeEvent {
  type: "added" | "modified" | "removed";
  path: string;
}

/** Helper: does a provider expose a usable signed-URL method? */
export function canSignUrls(
  p: StorageProvider
): p is StorageProvider & { getSignedUrl: NonNullable<StorageProvider["getSignedUrl"]> } {
  return p.capabilities.signedUrls && typeof p.getSignedUrl === "function";
}

/** Helper: does a provider expose change-event subscription? */
export function canSubscribe(
  p: StorageProvider
): p is StorageProvider & { subscribe: NonNullable<StorageProvider["subscribe"]> } {
  return p.capabilities.changeEvents && typeof p.subscribe === "function";
}
