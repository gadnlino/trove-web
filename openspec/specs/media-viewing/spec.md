# Media Viewing Specification

## Purpose

Present indexed media in a virtualized gallery and allow full-resolution image
viewing and seekable video playback, degrading gracefully based on whether the
backing provider supports signed URLs and range requests.

## Requirements

### Requirement: Gallery grid
The system SHALL present indexed media as a responsive thumbnail grid that
supports virtualized scrolling so large libraries render smoothly.

#### Scenario: Rendering a large library
- **WHEN** the catalog contains tens of thousands of items
- **THEN** the grid renders visible thumbnails and recycles off-screen ones without freezing

#### Scenario: Mixed image and video items
- **WHEN** the grid shows both images and videos
- **THEN** video items are visually distinguished (e.g. duration badge) from images

### Requirement: Full-resolution image viewing
The system SHALL allow opening an image at full resolution, fetching the original
via a signed URL when the provider supports it and via the provider's `read`
otherwise.

#### Scenario: Viewing on a signed-URL backend
- **WHEN** the user opens an image from a provider that supports signed URLs
- **THEN** the original is loaded directly from a signed URL without proxying through app logic

#### Scenario: Viewing on a non-signed-URL backend
- **WHEN** the user opens an image from a provider that does not support signed URLs
- **THEN** the original is streamed through the provider's `read`

### Requirement: Seekable video playback
The system SHALL play videos with seeking support, using HTTP range requests when
the provider supports them and a buffered fallback when it does not.

#### Scenario: Seeking with range support
- **WHEN** the user seeks within a video on a provider that supports range requests
- **THEN** playback resumes near the seek position without downloading the whole file first

#### Scenario: Playback without range support
- **WHEN** the provider does not support range requests
- **THEN** the player falls back to buffered playback and still allows viewing the video
