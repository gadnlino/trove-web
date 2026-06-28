## 1. Crypto primitives

- [x] 1.1 Implement an AES-GCM envelope helper (encrypt/decrypt JSON → `{ ciphertext, iv }`) over WebCrypto
- [x] 1.2 Implement a PBKDF2 passphrase KDF (random salt, stored upgradeable iteration count) producing the vault key
- [x] 1.3 Implement WebAuthn PRF helpers (feature-detect, register credential with `prf`, derive key via HKDF over PRF output)
- [x] 1.4 Implement key-wrapping so one random vault key can be unlocked by either enrolled factor

## 2. Vault and storage

- [x] 2.1 Add vault metadata + per-mount encrypted credential fields to the database schema (key refs, KDF params, WebAuthn credential id, salts)
- [x] 2.2 Implement a `CredentialVault` service holding the in-memory key, with `unlock`, `lock`, `isLocked`, and `getCredentials(mountId)`
- [x] 2.3 Update `mountStore` to encrypt sensitive fields on save and keep non-secret metadata in plaintext
- [x] 2.4 Discard the in-memory key on lock/session end and add an optional idle auto-lock

## 3. Provider integration

- [x] 3.1 Update the registry/factory and adapters to obtain credentials from the unlocked vault
- [x] 3.2 Block credentialed operations while locked and surface an "unlock required" signal; leave local-folder/local-snapshot unaffected

## 4. Lifecycle and migration

- [x] 4.1 Start locked when an enrolled factor or encrypted credential exists; keep catalog + cached thumbnails available while locked
- [x] 4.2 Detect existing plaintext credentials, prompt to set up a lock, and encrypt in place (verify decrypt round-trip before removing plaintext)

## 5. UI

- [x] 5.1 Build lock setup (enroll WebAuthn PRF and/or passphrase) with clear "no recovery if lost" messaging
- [x] 5.2 Build the unlock prompt (biometric primary, passphrase fallback) triggered by credentialed actions
- [x] 5.3 Add lock/unlock controls and an "unprotected credentials" warning in settings

## 6. Validation

- [x] 6.1 Add tests for the AES-GCM envelope and passphrase KDF (round-trip, wrong passphrase fails, ciphertext contains no plaintext)
- [x] 6.2 Add tests for vault gating (locked blocks credentialed access; credential-free providers unaffected) and migration round-trip
- [x] 6.3 Typecheck, lint, build, and run the test suite
