## ADDED Requirements

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
