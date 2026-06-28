# Storage Providers Specification

## Purpose

Define the single storage abstraction (`StorageProvider`) and its capability
model so that any storage backend — a local folder, an S3-compatible bucket, or
a personal cloud drive — can be mounted and used by the rest of the app without
changes to consumers.

## Requirements

### Requirement: Storage provider contract
The system SHALL define a single `StorageProvider` interface that all storage
backends implement, exposing at minimum `list`, `stat`, `read` (with optional
byte range), `write`, and `delete` operations, plus an optional `getSignedUrl`.
The gallery and the thumbnail pipeline SHALL depend only on this interface and
never on a concrete adapter.

#### Scenario: Adding a new backend without changing consumers
- **WHEN** a developer adds a new adapter that implements `StorageProvider`
- **THEN** the gallery, catalog, and thumbnail pipeline operate against it with no code changes in those consumers

#### Scenario: Reading a byte range from a provider
- **WHEN** a consumer calls `read` with a byte range on a provider whose capabilities include range requests
- **THEN** the provider returns only the requested bytes as a stream

### Requirement: Capability model
Each provider SHALL declare a `capabilities` descriptor including at least
`signedUrls`, `rangeRequests`, and `changeEvents`. Consumers SHALL branch on the
declared capabilities rather than on the adapter type.

#### Scenario: Consumer adapts to a missing capability
- **WHEN** a provider declares `signedUrls: false`
- **THEN** the viewer fetches bytes through the provider's `read` rather than requesting a signed URL

#### Scenario: Capabilities are inspectable before use
- **WHEN** a mount is configured
- **THEN** the system can read the provider's capabilities without performing any media transfer

### Requirement: Local folder adapter
The system SHALL provide a local folder adapter built on the File System Access
API that grants persistent read/write access to a user-selected directory. When
the API is unavailable, the system SHALL hide or disable local-folder mounting
and explain why.

#### Scenario: Mounting a local folder
- **WHEN** the user selects a directory through the directory picker
- **THEN** the system stores a persistent handle and can list and read media from that directory on later sessions without re-prompting, where the browser allows

#### Scenario: Unsupported browser
- **WHEN** the browser does not support the File System Access API
- **THEN** the local folder mount option is disabled with a message indicating the requirement

### Requirement: S3-compatible adapter
The system SHALL provide a single adapter that works against any S3-compatible
service (such as Amazon S3, Cloudflare R2, Backblaze B2, and MinIO), supporting
signed URLs, byte-range reads, and change events where the service offers them.

#### Scenario: Mounting an S3-compatible bucket
- **WHEN** the user provides an endpoint, region, bucket, and credentials for an S3-compatible service
- **THEN** the system validates access and registers the mount, declaring `signedUrls`, `rangeRequests`, and `changeEvents` according to that service

#### Scenario: CORS not configured
- **WHEN** a browser request to the bucket is blocked by missing CORS configuration
- **THEN** the system surfaces actionable guidance, including a copy-pasteable CORS policy

### Requirement: User-drive adapter
The system SHALL provide a read-mostly adapter for a user's personal cloud drive
authenticated via OAuth (PKCE, no application backend). This adapter SHALL declare
`signedUrls: false` and may declare `changeEvents: false`.

#### Scenario: Connecting a personal drive
- **WHEN** the user completes the OAuth flow for their drive account
- **THEN** the system stores the resulting tokens on-device and can list and read media from the drive

#### Scenario: Reading bytes without signed URLs
- **WHEN** the viewer needs media from a user-drive mount
- **THEN** bytes are streamed through the adapter's `read` instead of a signed URL

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
