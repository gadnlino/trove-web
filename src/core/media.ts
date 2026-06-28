import type { MediaType } from "./types";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp", "heic", "heif"]);

const VIDEO_EXT = new Set(["mp4", "m4v", "mov", "webm", "mkv", "avi", "ogv", "3gp"]);

/** Video formats most browsers can decode directly via <video>. */
const BROWSER_DECODABLE_VIDEO = new Set(["mp4", "m4v", "mov", "webm", "ogv"]);

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function mediaTypeOf(name: string): MediaType | undefined {
  const ext = extensionOf(name);
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  return undefined;
}

export function isBrowserDecodableVideo(name: string): boolean {
  return BROWSER_DECODABLE_VIDEO.has(extensionOf(name));
}

export function contentTypeOf(name: string): string {
  const ext = extensionOf(name);
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    bmp: "image/bmp",
    heic: "image/heic",
    heif: "image/heif",
    mp4: "video/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
    ogv: "video/ogg",
    "3gp": "video/3gpp",
  };
  return map[ext] ?? "application/octet-stream";
}
