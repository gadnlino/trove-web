## Context

Trove is a fully client-side web app with no backend. Mount configuration and
credentials live in IndexedDB. Today the S3 `accessKeyId`/`secretAccessKey` and
the Google Drive OAuth tokens are stored as plaintext object fields, readable by
anything that can read the browser profile. We want at-rest protection using a
key the user controls, keeping the backendless model. The catalog (IndexedDB)
and thumbnail cache (OPFS) are not secret and should keep working while locked.

## Goals / Non-Goals

**Goals:**
- Encrypt sensitive credential fields at rest with an authenticated cipher.
- Use a key derived from a user-held factor that is never persisted to disk.
- Support a biometric/hardware unlock (WebAuthn PRF) with a universal passphrase
  fallback.
- Keep the cached gallery usable while locked; gate only credentialed actions.
- Migrate existing plaintext credentials in place.
- No backend, no new runtime dependencies.

**Non-Goals:**
- Defending against active malware running as the user while the vault is
  unlocked (the secret is necessarily in memory then).
- Cross-device durability, sync, or recovery of credentials (needs a backend).
- Encrypting non-secret data (catalog metadata, thumbnails).

## Decisions

### Decision: AES-GCM envelope over per-mount secret fields
Serialize the sensitive subset of a mount's credentials (S3 `accessKeyId` +
`secretAccessKey`; Drive `tokens`) to JSON and encrypt with AES-GCM (256-bit) using
a random 96-bit IV per write. Persist `{ ciphertext, iv, keyRef }` on the mount;
keep non-secret fields (`id`, `name`, `kind`, `createdAt`, S3 `endpoint`/`region`/
`bucket`/`prefix`) in plaintext so the app can list mounts and render the cached
gallery while locked.

- Alternatives: encrypt the entire mount record — rejected because the UI needs
  names/kinds and the catalog reconcile needs mount metadata while locked.

### Decision: User-held key sources (PRF primary, passphrase fallback)
A single AES key (the "vault key") encrypts all mounts. The vault key itself is
wrapped/derived from a user factor and never stored in usable form:

- **WebAuthn PRF**: register a platform credential with the `prf` extension; on
  unlock, the authenticator returns a PRF output gated by user verification.
  Derive the vault key via HKDF over the PRF output. Store only the credential id
  and a salt.
- **Passphrase**: derive the vault key via PBKDF2-HMAC-SHA-256 (WebCrypto, high
  iteration count, random salt). Store only KDF params + salt.

Support both simultaneously by wrapping one random vault key with each enrolled
factor (key-wrapping), so either factor can unlock without re-encrypting mounts.

- Alternatives: Argon2id (stronger KDF) — deferred; requires a wasm dependency,
  while PBKDF2 is native. PRF-only — rejected; Firefox/older support gaps demand
  a fallback. Non-extractable WebCrypto key with no user factor — rejected; the
  key would sit on disk and not defend the stated threat.

### Decision: Lock/unlock lifecycle with in-memory-only key
On startup, if any encrypted mount or an enrolled factor exists, the app is
**locked**: the vault key is absent and credentialed operations are blocked.
Unlocking derives the vault key into memory for the session; it is never written
to storage and is dropped on tab close (and optionally on idle timeout). A
`CredentialVault` service owns the in-memory key and exposes `getCredentials(mountId)`
to the registry/adapters.

### Decision: Locked-state behavior
While locked, the app SHALL still show mounts and render the catalog + cached
thumbnails. Operations needing credentials — scanning, signing URLs, reading
originals, generating new thumbnails — SHALL prompt to unlock. This keeps the
common "browse what I already have" path frictionless.

### Decision: Migration of existing plaintext mounts
On first run after this change, if plaintext credentials exist, prompt the user
to set up a lock (enroll PRF and/or passphrase). On enrollment, re-encrypt the
secret fields in place and remove the plaintext fields. Until a lock is set up,
clearly warn that credentials are unprotected.

## Risks / Trade-offs

- [WebAuthn PRF support varies across browsers/authenticators] → Always offer the
  passphrase fallback; detect PRF availability before offering it.
- [User loses both passkey and passphrase] → Credentials are unrecoverable by
  design; the user re-enters them. Communicate this clearly at setup.
- [Active malware while unlocked can read the in-memory secret] → Out of scope for
  any local app; mitigate exposure with optional idle auto-lock and by keeping
  decrypted secrets only as long as needed.
- [Drive silent token refresh requires the vault key] → While locked, refresh is
  deferred; unlocking restores it. Acceptable.
- [Iteration count vs unlock latency for PBKDF2] → Pick a count that balances ~a
  few hundred ms unlock with strong resistance; make it a stored, upgradeable
  parameter.

## Migration Plan

1. Ship the vault locked-by-default only when a factor is enrolled; pre-existing
   installs start with plaintext + an "unprotected" warning and a setup prompt.
2. On factor enrollment, encrypt existing secrets in place within one IndexedDB
   transaction; verify decrypt round-trip before deleting plaintext.
3. No rollback of ciphertext to plaintext; removing the lock requires explicit
   user action and re-exposes a warning.

## Open Questions

- Should an idle auto-lock timeout ship in this change or follow up? (Lean: a
  simple optional timeout here, configurable later.)
- Do we encrypt S3 `accessKeyId` too, or only the secret? (Lean: encrypt both as
  one blob; the key id is mildly sensitive and there's no cost to including it.)
