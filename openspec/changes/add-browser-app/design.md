## Context

Trove's browser version is a fully client-side web application served as a static
website (not offline-first, not an installable PWA). There is no application
backend; the only server-side dependency is the user's own storage. This shapes
every decision: secrets stay on-device, processing happens in the browser, and
the storage location is chosen by the user at runtime.

The system is split along two orthogonal axes:

1. **Where bytes live** — the pluggable `StorageProvider` (local folder,
   S3-compatible, user drive). Backends differ in capabilities.
2. **Where code runs** — for this change, the browser. The same `StorageProvider`
   contract is intended to survive a later desktop (Tauri) packaging.

```
Gallery UI ──> StorageProvider (interface + capabilities)
   │                 ├── LocalFolderAdapter   (File System Access API)
   │                 ├── S3CompatibleAdapter  (S3 / R2 / B2 / MinIO)
   │                 └── UserDriveAdapter      (Drive/Dropbox, OAuth)
   ├──> Media Catalog (IndexedDB)        ← UI reads from here, not the backend
   └──> Thumbnail Pipeline (Worker)      → Thumbnail Cache (OPFS)
```

## Goals / Non-Goals

**Goals:**
- Run with zero application backend and zero per-user hosting cost.
- Let the user mount any supported storage backend at runtime, with no code
  change, behind one `StorageProvider` contract.
- Keep all credentials and configuration on the user's device only.
- Generate and cache thumbnails for both images and videos in the browser.
- Keep the gallery fast by reading from a local index, not by listing the backend.
- Degrade gracefully when a backend lacks a capability (events, signed URLs, range).

**Non-Goals:**
- Multi-user accounts, sharing, or any server-side sync.
- A desktop/native build (Tauri) — reuse is anticipated but out of scope here.
- Editing media (crop, filters), face recognition, or AI tagging.
- A server-side thumbnail fallback (Lambda); the pipeline is client-side only.

## Decisions

### 1. Storage abstraction with an explicit capability model
A single `StorageProvider` interface (`list`, `stat`, `read(range?)`, `write`,
`delete`, optional `getSignedUrl`) plus a `capabilities` descriptor
(`signedUrls`, `rangeRequests`, `changeEvents`). The UI and pipeline branch on
capabilities, never on the concrete adapter. S3, R2, B2, and MinIO are all served
by one `S3CompatibleAdapter` because they share the S3 API.

### 2. Local catalog (IndexedDB) is the source of truth for the UI
Browsing reads media metadata (path, type, size, dimensions, timestamps,
thumbnail pointer) from IndexedDB. A separate scan/reconcile step syncs the index
with the backend (full scan on mount, incremental afterwards). This avoids slow
and inconsistent directory listings across heterogeneous backends.

### 3. Thumbnail engine selected per media type and capability
- Images: decode with `createImageBitmap`, downscale on `OffscreenCanvas`, encode
  WebP — fast and dependency-free.
- Video: prefer `HTMLVideoElement` seek + canvas frame capture for
  browser-decodable formats (MP4/H.264, WebM); fall back to `ffmpeg.wasm` for
  formats the browser cannot decode. All thumbnail work runs in a Web Worker.
- Thumbnails are cached in OPFS and referenced from the catalog, so the cache is
  independent of where the original lives.

### 4. Generation trigger is event-driven when possible, on-demand otherwise
Backends that expose change events trigger generation proactively. Backends
without events (e.g. user drive) generate on first view and then cache. Either
way, a thumbnail is produced at most once per media item.

### 5. Credentials live on-device only
Mount configuration and credentials are stored locally (IndexedDB). The app never
transmits them anywhere except directly to the user's chosen backend. Because the
storage belongs to the user, holding their own credentials locally is acceptable;
true multi-user would require a token-signing service (explicit non-goal).

## Risks / Trade-offs

- **Browser support:** File System Access API is Chromium-only. Mitigation:
  S3-compatible and user-drive adapters work cross-browser; local-folder mounts
  are gated by feature detection with a clear message.
- **Video processing performance:** `ffmpeg.wasm` is significantly slower than
  native FFmpeg. Mitigation: prefer the native `<video>`+canvas path, run in a
  worker, and only fall back to wasm when necessary; defer to a future Tauri build
  for heavy bulk processing.
- **Backends without signed URLs/range:** require proxying bytes through the app,
  complicating video streaming. Mitigation: capability model marks these backends
  and the viewer adapts (buffered playback / range emulation).
- **No background processing:** the browser must be open to scan or generate.
  Mitigation: incremental scanning, resumable jobs, and OPFS caching so work is
  never repeated.
- **CORS friction:** mounting an S3-compatible bucket requires the user to enable
  CORS. Mitigation: provide a copy-pasteable CORS policy and a guided mount flow.
