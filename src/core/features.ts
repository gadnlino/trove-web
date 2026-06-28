/** Runtime browser-capability detection used to gate features gracefully. */

export interface BrowserFeatures {
  fileSystemAccess: boolean;
  opfs: boolean;
  indexedDB: boolean;
  offscreenCanvas: boolean;
  webWorkers: boolean;
}

export function detectFeatures(): BrowserFeatures {
  const w = globalThis as unknown as Record<string, unknown>;
  return {
    fileSystemAccess:
      typeof (w as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function",
    opfs:
      typeof navigator !== "undefined" &&
      !!navigator.storage &&
      typeof navigator.storage.getDirectory === "function",
    indexedDB: typeof indexedDB !== "undefined",
    offscreenCanvas: typeof OffscreenCanvas !== "undefined",
    webWorkers: typeof Worker !== "undefined",
  };
}

let cached: BrowserFeatures | null = null;
export function features(): BrowserFeatures {
  if (!cached) cached = detectFeatures();
  return cached;
}
