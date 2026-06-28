## Context

Trove's `LocalFolderAdapter` uses the File System Access API
(`showDirectoryPicker`), which is implemented only in Chromium browsers. Firefox
and Safari users therefore have no way to mount a local folder. The app already
abstracts every backend behind the `StorageProvider` interface and a capability
model, so adding cross-browser local access is an additive adapter problem, not
a rearchitecture. Thumbnails live in OPFS and metadata in IndexedDB, both of
which persist independently of the original files.

## Goals / Non-Goals

**Goals:**
- Allow mounting a local folder in every modern browser (Chrome, Edge, Firefox, Safari).
- Reuse the existing gallery, catalog, and thumbnail pipeline without changes.
- Keep the persistent, writable experience on browsers that support it.
- Make the reduced-capability (non-persistent) experience clear to the user.

**Non-Goals:**
- Persistent re-binding of a folder without re-selection on non-Chromium browsers
  (the platform provides no API for this).
- Writing back to the folder on the snapshot path (it is read-only).
- Importing/copying files into browser storage (OPFS) as a "mount."

## Decisions

### Decision: Add a `LocalSnapshotAdapter` backed by `webkitdirectory`
Use `<input type="file" webkitdirectory multiple>` to obtain a `FileList`. Build
an in-memory map of `webkitRelativePath` → `File`, stripping the leading root
segment so paths match the provider model. `list` walks the map by prefix,
`stat`/`read` use the `File` (with `File.slice` for ranges).

- Capabilities: `signedUrls: false`, `rangeRequests: true`, `changeEvents: false`.
- Alternatives considered: drag-and-drop `webkitGetAsEntry` (lazier traversal but
  weaker Safari support) — kept as an optional enhancement, not the primary path.

### Decision: Non-persistent mount kind with rebuildable byte source
Add a `local-snapshot` mount kind that stores only display metadata (id, name,
created time) in IndexedDB — never file handles, since none exist. The in-memory
`File` map is the byte source for the current session. On a new session the mount
exists (catalog + thumbnails load), but byte access requires the user to
reconnect the folder, which repopulates the map.

- Alternative: store nothing and treat each selection as a brand-new mount —
  rejected because it would orphan the catalog/thumbnails and force a full
  rescan every time.

### Decision: Capability-based adapter selection at mount time
The "Add local folder" action picks the File System Access adapter when
`window.showDirectoryPicker` exists, otherwise the snapshot adapter. Selection is
based on capability detection, consistent with how consumers already branch on
the capability model rather than adapter type.

### Decision: Reconnect affordance for non-persistent mounts
A snapshot mount whose `File` map is empty in the current session is shown as
"needs reconnect." Thumbnails still render from OPFS; opening originals or
rescanning prompts the user to reselect the same folder. Reconnect reuses the
existing scan/reconcile path, so renamed/removed files are reconciled normally.

## Risks / Trade-offs

- [Large folders enumerate eagerly via `webkitdirectory`] → Acceptable for typical
  libraries; show scan progress and keep work off the main thread. Drag-and-drop
  lazy traversal can be added later for very large trees.
- [User reselects a different folder on reconnect] → Reconcile by path; items not
  present are removed and new ones added, so a mismatched selection self-corrects
  on the next scan rather than corrupting the catalog.
- [Safari/iOS folder selection quirks] → Desktop Safari supports `webkitdirectory`;
  iOS support is limited, so messaging should set expectations on mobile.
- [Stale thumbnails after external edits while disconnected] → Reconciliation on
  reconnect resets thumbnails for items whose size/modified time changed.

## Open Questions

- Should drag-and-drop folder import ship in this change or as a follow-up? (Lean
  follow-up; `webkitdirectory` covers all target browsers.)
