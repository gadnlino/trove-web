import { isBrowserDecodableVideo } from "../core/media";
import { bitmapToThumbs, type ThumbResult, type ThumbSizes } from "./canvas";

export interface VideoThumbResult extends ThumbResult {
  durationSec?: number;
}

/**
 * Generate a thumbnail frame for a video. Prefers a native `HTMLVideoElement`
 * seek + canvas capture for browser-decodable formats; falls back to
 * `ffmpeg.wasm` (single-threaded core, lazily loaded) for everything else.
 */
export async function generateVideoThumb(
  blob: Blob,
  name: string,
  sizes: ThumbSizes
): Promise<VideoThumbResult> {
  if (isBrowserDecodableVideo(name)) {
    try {
      return await viaVideoElement(blob, sizes);
    } catch {
      // fall through to ffmpeg.wasm
    }
  }
  return viaFfmpeg(blob, sizes);
}

async function viaVideoElement(blob: Blob, sizes: ThumbSizes): Promise<VideoThumbResult> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.playsInline = true;
  video.src = url;

  try {
    await once(video, "loadedmetadata");
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const seekTo = duration > 0 ? Math.min(1, duration * 0.1) : 0;
    video.currentTime = seekTo;
    await once(video, "seeked");

    const bitmap = await createImageBitmap(video);
    const thumbs = await bitmapToThumbs(bitmap, sizes);
    bitmap.close();
    return { ...thumbs, durationSec: duration || undefined };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}

async function viaFfmpeg(blob: Blob, sizes: ThumbSizes): Promise<VideoThumbResult> {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { fetchFile, toBlobURL } = await import("@ffmpeg/util");

  const ffmpeg = new FFmpeg();
  const base = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
  });

  await ffmpeg.writeFile("input", await fetchFile(blob));
  await ffmpeg.exec(["-ss", "1", "-i", "input", "-frames:v", "1", "frame.png"]);
  const data = (await ffmpeg.readFile("frame.png")) as Uint8Array;
  const frameBlob = new Blob([data as unknown as BlobPart], { type: "image/png" });

  const bitmap = await createImageBitmap(frameBlob);
  const thumbs = await bitmapToThumbs(bitmap, sizes);
  bitmap.close();
  return thumbs;
}

function once(target: EventTarget, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error(`video event error before '${event}'`));
    };
    const cleanup = () => {
      target.removeEventListener(event, onOk);
      target.removeEventListener("error", onErr);
    };
    target.addEventListener(event, onOk, { once: true });
    target.addEventListener("error", onErr, { once: true });
  });
}
