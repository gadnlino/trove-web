## Why

Local folder mounting currently relies on the File System Access API, which is
Chromium-only. Users on Firefox and Safari cannot mount a local folder at all.
We can support local folders in every modern browser by adding a second,
read-only adapter and selecting the best available option at mount time.

## What Changes

- Add a `local-snapshot` adapter that mounts a user-selected local folder using
  the universally supported `<input type="file" webkitdirectory>` (with optional
  drag-and-drop folder import). It is read-only, non-persistent across sessions,
  and supports byte-range reads via `File.slice`.
- Add a "best available local provider" selection so the mount flow chooses the
  File System Access adapter when supported (persistent, writable) and otherwise
  the snapshot adapter (all browsers, read-only, re-pick per session).
- Persist the catalog and OPFS thumbnails for snapshot mounts so the gallery
  loads instantly on return; only the live file bytes require re-selecting the
  folder. Surface a clear "reconnect folder" affordance for these mounts.
- The gallery, catalog, and thumbnail pipeline are unchanged — the new adapter
  conforms to the existing `StorageProvider` contract and capability model.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `storage-providers`: add the universal local-snapshot adapter and a
  requirement that the system selects the best available local-folder adapter
  based on browser support.
- `web-app-shell`: handle non-persistent local mounts — the catalog/thumbnails
  persist, and the user is prompted to reconnect the folder to restore byte
  access in a new session.

## Impact

- New adapter: `src/storage/adapters/LocalSnapshotAdapter.ts`.
- Mount model/store: a `local-snapshot` mount kind (no persistent handle; an
  in-memory file map rebuilt on selection).
- Mount flow (`src/app/library.ts`, `src/ui/Settings.tsx`, `src/ui/App.tsx`):
  capability-based adapter selection and a reconnect action.
- No new runtime dependencies; reuses existing catalog, OPFS cache, and worker
  pipeline.
