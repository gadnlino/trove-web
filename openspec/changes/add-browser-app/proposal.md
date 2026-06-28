## Why

People want to keep and browse their personal photos and videos without handing
them to a closed cloud service like Instagram or Google Photos. They want to own
both the files and the place those files live. Today that forces a choice between
convenience (a hosted gallery) and control (a folder of files with no good
viewer).

Trove's browser version removes that trade-off: a gallery that runs entirely in
the user's browser, generates its own thumbnails, and reads media from whatever
storage the user chooses to mount — a local folder, an S3-compatible bucket, or
their own cloud drive. There is no application backend to operate, no per-user
hosting cost, and the user's credentials never leave their device.

## What Changes

- Introduce a **pluggable storage layer** (`StorageProvider` interface + a
  capability model) so users can mount different filesystems. Ship three
  adapters: local folder (File System Access API), S3-compatible (S3/R2/B2/MinIO),
  and a read-mostly user-drive adapter (OAuth).
- Introduce a **local media catalog** (IndexedDB) that indexes mounted media so
  the gallery is fast and never has to list the backend on every view.
- Introduce a **client-side thumbnail pipeline**: image thumbnails via
  `OffscreenCanvas`, video thumbnails via `ffmpeg.wasm` or `<video>`+canvas,
  cached in OPFS, generated either on change-event (capable backends) or
  on-demand (others).
- Introduce **media viewing**: a responsive gallery grid plus full-resolution
  image view and seekable video playback (HTTP range / signed URLs, with proxy
  fallback).
- Introduce a **hosted web app shell**: a website (no application backend)
  accessed via URL, responsive across desktop and mobile browsers, with
  local-only storage of mount configuration and credentials, and a settings
  surface to manage mounts.

## Capabilities

### New Capabilities
- `storage-providers`: pluggable storage abstraction, capability model, and the local/S3-compatible/user-drive adapters.
- `media-catalog`: local IndexedDB index of mounted media plus listing, browsing, search, and filtering.
- `thumbnail-generation`: client-side image/video thumbnail creation, OPFS caching, and event-vs-on-demand generation strategy.
- `media-viewing`: gallery grid, full-resolution image viewing, and seekable video playback.
- `web-app-shell`: hosted website shell, local credential/mount management, and settings.

### Modified Capabilities
<!-- None — this is the initial set of capabilities for the project. -->

## Impact

- **New project**, a client-side web app served as a static website. No
  application server; static hosting only. Not offline-first and not an
  installable PWA — it is accessed from a URL in the browser.
- Browser API dependencies: File System Access API (Chromium), OPFS, IndexedDB,
  OffscreenCanvas, Web Workers; `ffmpeg.wasm` as an optional dependency for
  non-natively-decodable video formats.
- Backend prerequisites are limited to the user's own storage (e.g. CORS must be
  enabled on a mounted S3-compatible bucket). No secrets are managed by the app.
- A future desktop (Tauri) packaging can reuse the same `StorageProvider` and UI
  while swapping the thumbnail engine for native FFmpeg/Sharp; this proposal does
  not cover that packaging.
