## ADDED Requirements

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
