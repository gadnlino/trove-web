## 1. Project scaffold

- [x] 1.1 Set up TypeScript + React + Vite web app project with linting and formatting
- [x] 1.2 Configure the static build and SPA routing for deployment as a hosted website
- [x] 1.3 Establish the Web Worker build pipeline for off-main-thread processing

## 2. Storage providers

- [x] 2.1 Define the `StorageProvider` interface (`list`, `stat`, `read` with range, `write`, `delete`, optional `getSignedUrl`) and the `capabilities` descriptor
- [x] 2.2 Implement the local folder adapter on the File System Access API with persistent handles and feature detection
- [x] 2.3 Implement the S3-compatible adapter (S3/R2/B2/MinIO) with signed URLs, range reads, and change events where available
- [x] 2.4 Implement the user-drive adapter via OAuth PKCE (read-mostly, no signed URLs)
- [x] 2.5 Add a provider registry and the guided mount flow, including the CORS guidance for S3-compatible mounts

## 3. Media catalog

- [x] 3.1 Design the IndexedDB schema for media metadata and thumbnail pointers
- [x] 3.2 Implement initial full scan with progress reporting that does not block the UI
- [x] 3.3 Implement incremental reconciliation (additions and deletions) and resumable scans
- [x] 3.4 Implement search and filtering by media type, date range, and provider

## 4. Thumbnail generation

- [x] 4.1 Implement image thumbnails (grid + preview) via `createImageBitmap`/`OffscreenCanvas` in a worker
- [x] 4.2 Implement video thumbnails via `HTMLVideoElement` seek + canvas capture
- [x] 4.3 Add the `ffmpeg.wasm` fallback path for non-decodable video formats
- [x] 4.4 Implement the OPFS thumbnail cache with catalog references and eviction on item removal
- [x] 4.5 Implement the event-driven vs on-demand generation trigger based on provider capabilities

## 5. Media viewing

- [x] 5.1 Build the virtualized responsive gallery grid with image/video distinction
- [x] 5.2 Build full-resolution image viewing with signed-URL and `read` fallback paths
- [x] 5.3 Build seekable video playback with range support and a buffered fallback

## 6. Web app shell and settings

- [x] 6.1 Implement on-device storage of mount configuration and credentials
- [x] 6.2 Build the mount management settings (add, inspect, remove with cleanup)
- [x] 6.3 Implement clear status and empty states when a mounted backend is unreachable
- [x] 6.4 Set up static hosting/deployment of the website

## 7. Validation

- [x] 7.1 Add feature-detection gating and graceful messaging for unsupported browsers
- [x] 7.2 Verify capability-based degradation across all three adapters (signed URLs, range, events)
- [x] 7.3 Add automated tests for the catalog, thumbnail cache, and provider contract
