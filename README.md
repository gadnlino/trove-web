# Trove (browser version)

A privacy-first personal photo and video manager that runs **entirely in your
browser** — no application backend, no per-user hosting cost, and your
credentials never leave your device. It's an alternative to closed cloud
galleries (Instagram, Google Photos) where *you* own both the data and the place
it lives.

## Core idea

Two independent axes:

- **Pluggable storage** — mount whatever filesystem you want behind one
  `StorageProvider` contract: a local folder (File System Access API), any
  S3-compatible bucket (S3 / R2 / B2 / MinIO), or your own cloud drive (OAuth).
- **Client-side processing** — thumbnails for images and videos are generated in
  the browser (`OffscreenCanvas`, `ffmpeg.wasm`/`<video>`+canvas), cached in OPFS,
  and indexed in IndexedDB so the gallery stays fast.

The UI and the thumbnail pipeline only ever talk to the `StorageProvider`
interface plus a declared capability model (signed URLs, range requests, change
events) — never to a concrete backend.

## Planned stack

- TypeScript + React, served as a static website (client-side web app)
- IndexedDB (catalog) · OPFS (thumbnail cache) · Web Workers (processing)
- Optional `ffmpeg.wasm` for video formats the browser can't decode natively

A future desktop (Tauri) packaging can reuse the same `StorageProvider` and UI
while swapping the thumbnail engine for native FFmpeg/Sharp.

## Specification

This project is spec-driven with [OpenSpec](https://openspec.dev/). The full
specification for the browser version lives under `openspec/`:

- Change proposal: [`openspec/changes/add-browser-app/`](openspec/changes/add-browser-app/)
  - `proposal.md` — why & what
  - `design.md` — technical approach and trade-offs
  - `specs/` — requirements (capabilities: `storage-providers`, `media-catalog`,
    `thumbnail-generation`, `media-viewing`, `web-app-shell`)
  - `tasks.md` — implementation checklist

Useful commands:

```bash
npx @fission-ai/openspec@latest list                       # list active changes
npx @fission-ai/openspec@latest show add-browser-app        # inspect the change
npx @fission-ai/openspec@latest validate add-browser-app --strict
```

## Status

Specification stage. No application code yet — see the OpenSpec change above for
the planned scope.
