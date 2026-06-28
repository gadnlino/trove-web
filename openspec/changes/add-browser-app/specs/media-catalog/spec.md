## ADDED Requirements

### Requirement: Local media index
The system SHALL maintain a local index in IndexedDB of all media discovered
across mounted providers, storing at least path, provider id, media type, size,
capture/modified timestamps, dimensions or duration, and a thumbnail pointer. The
gallery SHALL read media metadata from this index rather than listing a backend
on each view.

#### Scenario: Browsing reads from the index
- **WHEN** the user opens the gallery
- **THEN** items are rendered from the IndexedDB index without issuing a directory listing to any backend

#### Scenario: Index persists across sessions
- **WHEN** the user reopens the app after closing it
- **THEN** the previously indexed media is available immediately, before any rescan completes

### Requirement: Mount scanning and reconciliation
The system SHALL perform a full scan of a provider when it is first mounted and
SHALL reconcile the index incrementally afterwards, adding new items and removing
entries for media that no longer exist in the backend. Scans SHALL be resumable
and SHALL not block browsing.

#### Scenario: Initial scan of a new mount
- **WHEN** a provider is mounted for the first time
- **THEN** the system scans it and populates the index, while the UI remains usable and shows scan progress

#### Scenario: Reconciling a deleted file
- **WHEN** an item present in the index no longer exists in the backend during reconciliation
- **THEN** the system removes that item (and its cached thumbnail) from the index

#### Scenario: Resuming an interrupted scan
- **WHEN** a scan is interrupted (tab closed or offline) and the app reopens
- **THEN** the scan resumes from where it stopped rather than restarting from the beginning

### Requirement: Search and filtering
The system SHALL let the user search and filter the catalog by at least media
type (image/video), date range, and mounted provider, returning results from the
local index.

#### Scenario: Filtering by media type
- **WHEN** the user filters to videos only
- **THEN** the gallery shows only video items from the index

#### Scenario: Searching across multiple mounts
- **WHEN** the user has more than one provider mounted and applies a date-range filter
- **THEN** results include matching media from every mounted provider
