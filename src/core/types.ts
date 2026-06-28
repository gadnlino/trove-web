/** Shared domain types for Trove. */

export type MediaType = "image" | "video";

/** A byte range for partial reads (inclusive start, inclusive end). */
export interface ByteRange {
  start: number;
  end: number;
}

/** A single entry returned while listing a provider. */
export interface FileEntry {
  /** Provider-relative path, using "/" as the separator. */
  path: string;
  /** Final path segment. */
  name: string;
  /** True when this entry is a directory/prefix rather than a file. */
  isDirectory: boolean;
  /** Size in bytes (files only). */
  size?: number;
  /** Last-modified time in epoch milliseconds, when known. */
  modifiedAt?: number;
  /** Detected media type for files, when recognizable from the name. */
  mediaType?: MediaType;
}

/** Metadata describing a single object. */
export interface FileMetadata {
  path: string;
  size: number;
  modifiedAt?: number;
  contentType?: string;
  mediaType?: MediaType;
}

/**
 * Declared capabilities of a storage backend. Consumers branch on these rather
 * than on the concrete adapter type.
 */
export interface ProviderCapabilities {
  /** Can mint time-limited signed URLs the browser can fetch directly. */
  signedUrls: boolean;
  /** Supports HTTP range / partial reads (needed for video seeking). */
  rangeRequests: boolean;
  /** Emits change notifications so thumbnails can be generated proactively. */
  changeEvents: boolean;
}

/** Options accepted by `StorageProvider.list`. */
export interface ListOptions {
  /** Opaque pagination cursor returned by a previous call. */
  cursor?: string;
  /** When true, descend into subdirectories (provider may emulate). */
  recursive?: boolean;
}

export interface ListResult {
  items: FileEntry[];
  /** Present when more results remain. */
  cursor?: string;
}

export type ProviderKind = "local-folder" | "s3-compatible" | "user-drive";
