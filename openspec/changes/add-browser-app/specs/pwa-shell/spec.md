## ADDED Requirements

### Requirement: Installable offline app shell
The system SHALL be an installable Progressive Web App whose shell loads and
operates offline, allowing the user to browse already-indexed media and view
cached thumbnails without a network connection.

#### Scenario: Installing the app
- **WHEN** the user installs the PWA
- **THEN** it launches in a standalone window and loads its shell from cache

#### Scenario: Offline browsing
- **WHEN** the user opens the app with no network connection
- **THEN** the gallery renders from the index and serves cached thumbnails, and media that requires the backend is clearly marked as unavailable

### Requirement: On-device mount and credential storage
The system SHALL store all mount configuration and credentials only on the user's
device and SHALL never transmit them to any destination other than the user's
chosen backend.

#### Scenario: Persisting a mount locally
- **WHEN** the user configures a mount with credentials
- **THEN** the configuration and credentials are persisted on-device and reused on later sessions

#### Scenario: No third-party transmission
- **WHEN** the app communicates over the network
- **THEN** credentials are sent only to the mounted backend and to no application server

### Requirement: Mount management settings
The system SHALL provide a settings surface where the user can add, inspect, and
remove mounts, and where removing a mount clears its indexed entries and cached
thumbnails.

#### Scenario: Adding a mount
- **WHEN** the user adds a new mount from settings
- **THEN** the mount appears in the list and an initial scan begins

#### Scenario: Removing a mount
- **WHEN** the user removes a mount
- **THEN** the system deletes that mount's catalog entries and cached thumbnails and stops showing its media
