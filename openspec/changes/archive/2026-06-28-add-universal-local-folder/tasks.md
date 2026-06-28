## 1. Mount model

- [x] 1.1 Add a `local-snapshot` mount kind (metadata only, no persistent handle) to the database/mount types
- [x] 1.2 Add a session-scoped, in-memory file-map registry keyed by mount id for snapshot byte access

## 2. Snapshot adapter

- [x] 2.1 Implement `LocalSnapshotAdapter` (`list`, `stat`, ranged `read`; `write`/`delete` reject) over an in-memory `webkitRelativePath` → `File` map
- [x] 2.2 Declare capabilities `signedUrls: false`, `rangeRequests: true`, `changeEvents: false`
- [x] 2.3 Register the adapter in the provider registry/factory

## 3. Adapter selection and mount flow

- [x] 3.1 Implement best-available local-folder selection (File System Access API when present, else snapshot) using feature detection
- [x] 3.2 Add a universal folder picker (`<input webkitdirectory>`) and build the file map, stripping the root path segment
- [x] 3.3 Persist the snapshot mount and start the initial scan from the in-memory map

## 4. Reconnect lifecycle

- [x] 4.1 Detect snapshot mounts with no file map in the current session and mark them "needs reconnect"
- [x] 4.2 Implement reconnect (reselect folder → rebuild map → reconcile added/removed items → regenerate missing thumbnails)
- [x] 4.3 Prompt to reconnect when opening an original or rescanning a disconnected snapshot mount

## 5. UI and messaging

- [x] 5.1 Update settings to show snapshot mounts, their reconnect state, and a reconnect action
- [x] 5.2 Show capability/expectation messaging (read-only, re-pick per session; note iOS limitations)

## 6. Validation

- [x] 6.1 Add tests for the snapshot adapter (list, ranged read, write/delete rejection) against an in-memory file map
- [x] 6.2 Verify capability-based selection chooses the correct adapter per browser support
- [x] 6.3 Typecheck, lint, build, and run the test suite
