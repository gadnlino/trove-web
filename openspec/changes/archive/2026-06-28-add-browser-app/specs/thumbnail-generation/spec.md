## ADDED Requirements

### Requirement: Image thumbnail generation
The system SHALL generate downscaled thumbnails for image media entirely in the
browser using canvas-based decoding and resizing, producing at least a grid
thumbnail and a larger preview, without uploading the original anywhere.

#### Scenario: Generating an image thumbnail
- **WHEN** an image is indexed and has no cached thumbnail
- **THEN** the system decodes it, produces grid and preview sizes, and stores them in the thumbnail cache

#### Scenario: Processing happens off the main thread
- **WHEN** thumbnails are generated
- **THEN** the work runs in a Web Worker so the gallery remains responsive

### Requirement: Video thumbnail generation
The system SHALL generate a thumbnail frame for video media in the browser,
preferring an `HTMLVideoElement` seek plus canvas capture for browser-decodable
formats and falling back to `ffmpeg.wasm` for formats the browser cannot decode.

#### Scenario: Browser-decodable video
- **WHEN** a video is in a format the browser can decode (e.g. MP4/H.264)
- **THEN** the system seeks to a representative frame and captures it via canvas without loading ffmpeg.wasm

#### Scenario: Non-decodable video format
- **WHEN** the browser cannot decode the video
- **THEN** the system uses ffmpeg.wasm to extract a frame and produce the thumbnail

### Requirement: Thumbnail cache in OPFS
The system SHALL cache generated thumbnails in the Origin Private File System and
reference them from the catalog, so a thumbnail is generated at most once per
media item regardless of which backend stores the original.

#### Scenario: Reusing a cached thumbnail
- **WHEN** a media item that already has a cached thumbnail is displayed again
- **THEN** the system serves the cached thumbnail and does not regenerate it

#### Scenario: Evicting a thumbnail with its item
- **WHEN** a media item is removed from the index during reconciliation
- **THEN** its cached thumbnail is removed from OPFS

### Requirement: Generation trigger strategy
The system SHALL generate thumbnails proactively for providers that declare
change events and on-demand (at first view, then cached) for providers that do
not.

#### Scenario: Event-capable backend
- **WHEN** a new media item appears on a provider that declares `changeEvents: true`
- **THEN** the system generates its thumbnail proactively rather than waiting for a view

#### Scenario: Backend without events
- **WHEN** a media item on a provider with `changeEvents: false` is first viewed
- **THEN** the system generates its thumbnail at that moment and caches the result for later
