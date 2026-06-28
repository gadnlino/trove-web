## ADDED Requirements

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
