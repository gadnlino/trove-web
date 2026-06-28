## 1. Project scaffold

- [ ] 1.1 Set up TypeScript + React + Vite web app project with linting and formatting
- [ ] 1.2 Configure the static build and SPA routing for deployment as a hosted website
- [ ] 1.3 Establish the Web Worker build pipeline for off-main-thread processing

## 2. Storage providers

- [ ] 2.1 Define the `StorageProvider` interface (`list`, `stat`, `read` with range, `write`, `delete`, optional `getSignedUrl`) and the `capabilities` descriptor
- [ ] 2.2 Implement the local folder adapter on the File System Access API with persistent handles and feature detection
- [ ] 2.3 Implement the S3-compatible adapter (S3/R2/B2/MinIO) with signed URLs, range reads, and change events where available
- [ ] 2.4 Implement the user-drive adapter via OAuth PKCE (read-mostly, no signed URLs)
- [ ] 2.5 Add a provider registry and the guided mount flow, including the CORS guidance for S3-compatible mounts

## 3. Media catalog

- [ ] 3.1 Design the IndexedDB schema for media metadata and thumbnail pointers
- [ ] 3.2 Implement initial full scan with progress reporting that does not block the UI
- [ ] 3.3 Implement incremental reconciliation (additions and deletions) and resumable scans
- [ ] 3.4 Implement search and filtering by media type, date range, and provider

## 4. Thumbnail generation

- [ ] 4.1 Implement image thumbnails (grid + preview) via `createImageBitmap`/`OffscreenCanvas` in a worker
- [ ] 4.2 Implement video thumbnails via `HTMLVideoElement` seek + canvas capture
- [ ] 4.3 Add the `ffmpeg.wasm` fallback path for non-decodable video formats
- [ ] 4.4 Implement the OPFS thumbnail cache with catalog references and eviction on item removal
- [ ] 4.5 Implement the event-driven vs on-demand generation trigger based on provider capabilities

## 5. Media viewing

- [ ] 5.1 Build the virtualized responsive gallery grid with image/video distinction
- [ ] 5.2 Build full-resolution image viewing with signed-URL and `read` fallback paths
- [ ] 5.3 Build seekable video playback with range support and a buffered fallback

## 6. Web app shell and settings

- [ ] 6.1 Implement on-device storage of mount configuration and credentials
- [ ] 6.2 Build the mount management settings (add, inspect, remove with cleanup)
- [ ] 6.3 Implement clear status and empty states when a mounted backend is unreachable
- [ ] 6.4 Set up static hosting/deployment of the website

## 7. Validation

- [ ] 7.1 Add feature-detection gating and graceful messaging for unsupported browsers
- [ ] 7.2 Verify capability-based degradation across all three adapters (signed URLs, range, events)
- [ ] 7.3 Add automated tests for the catalog, thumbnail cache, and provider contract
