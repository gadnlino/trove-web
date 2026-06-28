import { afterEach, describe, expect, it } from "vitest";
import { LocalSnapshotAdapter, SnapshotNotConnectedError } from "./LocalSnapshotAdapter";
import { buildFileMap, clearSnapshot, setSnapshot } from "../snapshotRegistry";
import { createCredentialFreeProvider } from "../registry";

function file(name: string, bytes: number[], type = "image/jpeg"): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

const MOUNT = "snap1";

afterEach(() => clearSnapshot(MOUNT));

describe("LocalSnapshotAdapter", () => {
  it("lists immediate files and subdirectories", async () => {
    setSnapshot(
      MOUNT,
      new Map<string, File>([
        ["a.jpg", file("a.jpg", [1, 2, 3])],
        ["sub/b.png", file("b.png", [4, 5], "image/png")],
      ])
    );
    const adapter = new LocalSnapshotAdapter(MOUNT);

    const root = await adapter.list("");
    const names = root.items.map((i) => `${i.name}:${i.isDirectory}`).sort();
    expect(names).toEqual(["a.jpg:false", "sub:true"]);

    const sub = await adapter.list("sub");
    expect(sub.items).toHaveLength(1);
    expect(sub.items[0].path).toBe("sub/b.png");
    expect(sub.items[0].mediaType).toBe("image");
  });

  it("honors byte ranges in read()", async () => {
    setSnapshot(MOUNT, new Map([["a.jpg", file("a.jpg", [10, 20, 30, 40, 50])]]));
    const adapter = new LocalSnapshotAdapter(MOUNT);
    const stream = await adapter.read("a.jpg", { start: 1, end: 2 });
    const buf = new Uint8Array(await new Response(stream).arrayBuffer());
    expect(Array.from(buf)).toEqual([20, 30]);
  });

  it("rejects writes and deletes (read-only)", async () => {
    setSnapshot(MOUNT, new Map([["a.jpg", file("a.jpg", [1])]]));
    const adapter = new LocalSnapshotAdapter(MOUNT);
    await expect(adapter.write()).rejects.toThrow(/read-only/);
    await expect(adapter.delete()).rejects.toThrow(/read-only/);
  });

  it("throws SnapshotNotConnectedError when the folder is not connected", async () => {
    const adapter = new LocalSnapshotAdapter("not-connected");
    await expect(adapter.list("")).rejects.toBeInstanceOf(SnapshotNotConnectedError);
  });

  it("strips the root folder segment when building the file map", () => {
    const f = file("a.jpg", [1]);
    Object.defineProperty(f, "webkitRelativePath", { value: "MyPhotos/2024/a.jpg" });
    const map = buildFileMap([f]);
    expect([...map.keys()]).toEqual(["2024/a.jpg"]);
  });
});

describe("provider selection", () => {
  it("instantiates a LocalSnapshotAdapter for a local-snapshot mount", () => {
    const provider = createCredentialFreeProvider({
      id: "m",
      kind: "local-snapshot",
      name: "Folder",
      createdAt: 0,
    });
    expect(provider?.kind).toBe("local-snapshot");
    expect(provider?.capabilities).toEqual({
      signedUrls: false,
      rangeRequests: true,
      changeEvents: false,
    });
  });
});
