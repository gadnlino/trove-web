# Web App Shell Specification

## Purpose

Deliver Trove as a hosted, fully client-side website with no application backend,
storing all mount configuration and credentials on-device and providing a
settings surface for managing mounts.

## Requirements

### Requirement: Hosted web application shell
The system SHALL be delivered as a website that loads and runs in the user's
browser from a URL, with all media-management logic executing client-side and no
application backend. The shell SHALL be responsive across desktop and mobile
browser viewports.

#### Scenario: Opening the website
- **WHEN** the user navigates to the application URL in a supported browser
- **THEN** the app shell loads and renders the gallery for any already-mounted providers

#### Scenario: No application backend
- **WHEN** the app needs media or metadata
- **THEN** it obtains them from the user's mounted providers and the local catalog, and from no application server

### Requirement: On-device mount and credential storage
The system SHALL store all mount configuration and credentials only on the user's
device and SHALL never transmit them to any destination other than the user's
chosen backend.

#### Scenario: Persisting a mount locally
- **WHEN** the user configures a mount with credentials
- **THEN** the configuration and credentials are persisted on-device and reused on later visits in the same browser

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

### Requirement: Reconnecting non-persistent local mounts
The system SHALL support local mounts that cannot persist file access across
sessions (the `local-snapshot` adapter) by persisting the catalog and cached
thumbnails so the gallery renders on return, clearly indicating that the mount
needs reconnection, and letting the user reconnect by reselecting the folder to
restore access to the original bytes.

#### Scenario: Returning to a snapshot mount in a new session
- **WHEN** the user reopens the app with a previously created `local-snapshot` mount
- **THEN** the gallery renders the mount's media from the catalog and cached thumbnails, and the mount is marked as needing reconnection

#### Scenario: Reconnecting to restore byte access
- **WHEN** the user reconnects a `local-snapshot` mount by reselecting the folder
- **THEN** the system rebuilds the in-memory file index, reconciles added/removed items, and can open originals and regenerate missing thumbnails

#### Scenario: Opening an original before reconnecting
- **WHEN** the user opens a full-resolution item from a snapshot mount that has not been reconnected this session
- **THEN** the system prompts the user to reconnect the folder rather than failing silently
