import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

export interface S3Config {
  endpoint?: string; // omit for AWS S3; set for R2/B2/MinIO
  region: string; // e.g. "us-east-1", or "auto" for R2
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix?: string; // optional key prefix to scope the mount
  forcePathStyle?: boolean; // true for MinIO and many S3-compatibles
}

/**
 * One adapter for every S3-compatible service (AWS S3, Cloudflare R2,
 * Backblaze B2, MinIO). Supports signed URLs and range reads. Change events
 * are not available to a pure browser client, so `changeEvents` is false and
 * thumbnails for new items are produced on-demand.
 */
export class S3CompatibleAdapter implements StorageProvider {
  readonly kind: ProviderKind = "s3-compatible";
  readonly capabilities: ProviderCapabilities = {
    signedUrls: true,
    rangeRequests: true,
    changeEvents: false,
  };

  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(
    readonly mountId: string,
    config: S3Config
  ) {
    this.bucket = config.bucket;
    this.prefix = normalizePrefix(config.prefix);
    this.client = new S3Client({
      region: config.region || "auto",
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle ?? !!config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  private key(path: string): string {
    return this.prefix + path.replace(/^\/+/, "");
  }

  async list(path: string, opts?: ListOptions): Promise<ListResult> {
    const dirPrefix = path ? `${this.key(path)}/`.replace(/\/+$/, "/") : this.prefix;
    const out = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: dirPrefix,
        Delimiter: opts?.recursive ? undefined : "/",
        ContinuationToken: opts?.cursor,
      })
    );

    const items: ListResult["items"] = [];
    for (const cp of out.CommonPrefixes ?? []) {
      if (!cp.Prefix) continue;
      const rel = stripPrefix(cp.Prefix, this.prefix).replace(/\/$/, "");
      items.push({ path: rel, name: lastSegment(rel), isDirectory: true });
    }
    for (const obj of out.Contents ?? []) {
      if (!obj.Key || obj.Key.endsWith("/")) continue;
      const rel = stripPrefix(obj.Key, this.prefix);
      items.push({
        path: rel,
        name: lastSegment(rel),
        isDirectory: false,
        size: obj.Size,
        modifiedAt: obj.LastModified ? obj.LastModified.getTime() : undefined,
        mediaType: mediaTypeOf(rel),
      });
    }
    return { items, cursor: out.IsTruncated ? out.NextContinuationToken : undefined };
  }

  async stat(path: string): Promise<FileMetadata> {
    const head = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(path) })
    );
    return {
      path,
      size: head.ContentLength ?? 0,
      modifiedAt: head.LastModified?.getTime(),
      contentType: head.ContentType ?? contentTypeOf(path),
      mediaType: mediaTypeOf(path),
    };
  }

  async read(path: string, range?: ByteRange): Promise<ReadableStream<Uint8Array>> {
    const out = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.key(path),
        Range: range ? `bytes=${range.start}-${range.end}` : undefined,
      })
    );
    const body = out.Body as
      { transformToWebStream?: () => ReadableStream<Uint8Array> } | undefined;
    if (!body?.transformToWebStream) {
      throw new Error("S3 response body is not a readable stream in this environment");
    }
    return body.transformToWebStream();
  }

  async write(path: string, data: Blob | ReadableStream<Uint8Array>): Promise<void> {
    const blob = data instanceof Blob ? data : await new Response(data).blob();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.key(path),
        Body: new Uint8Array(await blob.arrayBuffer()),
        ContentType: blob.type || contentTypeOf(path),
      })
    );
  }

  async delete(path: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(path) }));
  }

  async getSignedUrl(path: string, ttlSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: this.key(path) }),
      { expiresIn: ttlSeconds }
    );
  }
}

function normalizePrefix(prefix?: string): string {
  if (!prefix) return "";
  return prefix.replace(/^\/+/, "").replace(/\/*$/, "/");
}

function stripPrefix(key: string, prefix: string): string {
  return key.startsWith(prefix) ? key.slice(prefix.length) : key;
}

function lastSegment(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}
