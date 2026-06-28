## ADDED Requirements

### Requirement: Universal local snapshot adapter
The system SHALL provide a `local-snapshot` adapter that mounts a user-selected
local folder using browser APIs available in all modern browsers (the
`webkitdirectory` file input). This adapter SHALL be read-only and SHALL declare
`signedUrls: false`, `rangeRequests: true`, and `changeEvents: false`. It SHALL
support listing, stat, and ranged reads of the selected files for the duration of
the session.

#### Scenario: Mounting a folder on a non-Chromium browser
- **WHEN** the user selects a folder via the universal folder picker in a browser without the File System Access API
- **THEN** the system builds an in-memory index of the selected files and the gallery, catalog, and thumbnail pipeline operate against the adapter unchanged

#### Scenario: Ranged read from a snapshot file
- **WHEN** a consumer calls `read` with a byte range on a `local-snapshot` provider
- **THEN** the provider returns only the requested bytes by slicing the selected file

#### Scenario: Writes are rejected
- **WHEN** a consumer attempts to `write` or `delete` through a `local-snapshot` provider
- **THEN** the operation fails because the adapter is read-only

### Requirement: Best-available local adapter selection
When the user mounts a local folder, the system SHALL select the
File System Access adapter where that API is supported (persistent, writable) and
SHALL otherwise select the universal `local-snapshot` adapter. Selection SHALL be
based on detected browser capabilities rather than a fixed adapter choice.

#### Scenario: Chromium browser prefers the persistent adapter
- **WHEN** the user mounts a local folder in a browser that supports the File System Access API
- **THEN** the system uses the persistent local folder adapter

#### Scenario: Other browsers fall back to the snapshot adapter
- **WHEN** the user mounts a local folder in a browser without the File System Access API
- **THEN** the system uses the `local-snapshot` adapter and informs the user that the folder must be reconnected each session
