import { describe, expect, it } from "vitest";
import { contentTypeOf, extensionOf, isBrowserDecodableVideo, mediaTypeOf } from "./media";

describe("media detection", () => {
  it("extracts extensions case-insensitively", () => {
    expect(extensionOf("Photo.JPG")).toBe("jpg");
    expect(extensionOf("clip.MP4")).toBe("mp4");
    expect(extensionOf("noext")).toBe("");
  });

  it("classifies images and videos", () => {
    expect(mediaTypeOf("a.png")).toBe("image");
    expect(mediaTypeOf("a.webp")).toBe("image");
    expect(mediaTypeOf("a.mov")).toBe("video");
    expect(mediaTypeOf("a.txt")).toBeUndefined();
  });

  it("knows which videos the browser can decode natively", () => {
    expect(isBrowserDecodableVideo("a.mp4")).toBe(true);
    expect(isBrowserDecodableVideo("a.webm")).toBe(true);
    expect(isBrowserDecodableVideo("a.mkv")).toBe(false);
    expect(isBrowserDecodableVideo("a.avi")).toBe(false);
  });

  it("maps content types", () => {
    expect(contentTypeOf("a.jpg")).toBe("image/jpeg");
    expect(contentTypeOf("a.mp4")).toBe("video/mp4");
    expect(contentTypeOf("a.bin")).toBe("application/octet-stream");
  });
});
