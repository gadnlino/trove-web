## Why

Storage credentials (S3 access key + secret, cloud-drive OAuth tokens) are
currently persisted as plaintext in IndexedDB. Any local process, malware, or
party with read access to the browser profile or disk can lift them. We want
secure-at-rest protection on the user's device without introducing a backend or
weakening Trove's privacy-first, fully client-side model.

## What Changes

- Encrypt sensitive credential fields at rest with AES-GCM, storing only
  ciphertext, IV, and salt — never the raw secret or the encryption key.
- Derive the encryption key from something the **user controls and that is never
  written to disk**:
  - Primary: a WebAuthn PRF credential (unlock with Touch ID / Face ID / a
    security key).
  - Fallback: a passphrase (PBKDF2 via WebCrypto, no new dependencies).
- Introduce a lock/unlock lifecycle: the app starts **locked** when encrypted
  credentials exist; the derived key lives only in memory and is discarded when
  the session ends.
- Keep the cached experience usable while locked — mount names/kinds, the
  catalog, and OPFS thumbnails remain available; unlocking is required only to
  scan, open originals, or mint signed URLs.
- Migrate existing plaintext mounts: prompt the user to set up a lock and
  encrypt stored credentials in place.

## Capabilities

### New Capabilities

- `credential-security`: at-rest encryption of credentials and the lock/unlock
  lifecycle (key sources, in-memory key handling, locked-state behavior,
  migration of existing plaintext credentials).

### Modified Capabilities

- `web-app-shell`: the on-device credential storage requirement changes from
  plaintext persistence to encrypted-at-rest persistence with a user-held key.
- `storage-providers`: providers obtain credentials only from the unlocked
  credential store; while locked, credentialed operations are unavailable.

## Impact

- New module(s): `src/crypto/` (AES-GCM envelope, PBKDF2, WebAuthn PRF helpers)
  and a credential vault that gates access to decrypted secrets.
- `src/db/database.ts` / `src/storage/mountStore.ts`: store encrypted credential
  blobs instead of plaintext fields; add vault metadata (key source, KDF params,
  WebAuthn credential id).
- `src/storage/registry.ts` and adapters: read credentials through the unlocked
  vault.
- UI: a lock/unlock surface, first-time lock setup, and locked-state messaging.
- No backend and no new runtime dependencies (WebAuthn + WebCrypto are native).
- Out of scope: protection against active malware running while unlocked, and
  cross-device durability/recovery of credentials (would require a backend).
