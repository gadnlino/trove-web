import { describe, expect, it } from "vitest";
import type {
  ByteRange,
  FileMetadata,
  ListResult,
  ProviderCapabilities,
  ProviderKind,
} from "../core/types";
import { canSignUrls, canSubscribe, type StorageProvider } from "./StorageProvider";

/** Minimal in-memory provider used to verify the contract + capability helpers. */
class FakeProvider implements StorageProvider {
  readonly kind: ProviderKind = "s3-compatible";
  constructor(
    readonly mountId: string,
    readonly capabilities: ProviderCapabilities,
    private readonly files: Record<string, Uint8Array>
  ) {}

  async list(): Promise<ListResult> {
    return {
      items: Object.keys(this.files).map((path) => ({
        path,
        name: path,
        isDirectory: false,
        size: this.files[path].length,
        mediaType: "image" as const,
      })),
    };
  }

  async stat(path: string): Promise<FileMetadata> {
    return { path, size: this.files[path]?.length ?? 0 };
  }

  async read(path: string, range?: ByteRange): Promise<ReadableStream<Uint8Array>> {
    const bytes = this.files[path] ?? new Uint8Array();
    const slice = range ? bytes.slice(range.start, range.end + 1) : bytes;
    return new Response(new Blob([slice as unknown as BlobPart]))
      .body as ReadableStream<Uint8Array>;
  }

  async write(): Promise<void> {}
  async delete(): Promise<void> {}

  async getSignedUrl(path: string): Promise<string> {
    return `https://signed.example/${path}`;
  }
}

describe("StorageProvider contract", () => {
  const files = { "a.jpg": new Uint8Array([1, 2, 3, 4, 5]) };

  it("lists files through the interface", async () => {
    const p = new FakeProvider(
      "m1",
      { signedUrls: true, rangeRequests: true, changeEvents: false },
      files
    );
    const res = await p.list();
    expect(res.items).toHaveLength(1);
    expect(res.items[0].mediaType).toBe("image");
  });

  it("honors byte ranges in read()", async () => {
    const p = new FakeProvider(
      "m1",
      { signedUrls: false, rangeRequests: true, changeEvents: false },
      files
    );
    const stream = await p.read("a.jpg", { start: 1, end: 2 });
    const buf = new Uint8Array(await new Response(stream).arrayBuffer());
    expect(Array.from(buf)).toEqual([2, 3]);
  });

  it("capability helpers reflect declared capabilities", () => {
    const signed = new FakeProvider(
      "m1",
      { signedUrls: true, rangeRequests: true, changeEvents: false },
      files
    );
    const plain = new FakeProvider(
      "m2",
      { signedUrls: false, rangeRequests: false, changeEvents: false },
      files
    );
    expect(canSignUrls(signed)).toBe(true);
    expect(canSignUrls(plain)).toBe(false);
    expect(canSubscribe(signed)).toBe(false);
  });
});
