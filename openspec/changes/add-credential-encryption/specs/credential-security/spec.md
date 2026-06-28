## ADDED Requirements

### Requirement: At-rest credential encryption
The system SHALL encrypt sensitive credential fields (such as S3 secret/access
keys and cloud-drive OAuth tokens) with an authenticated cipher (AES-GCM) before
persisting them, storing only ciphertext, an initialization vector, and key
references — never the plaintext secret or the encryption key. Non-secret mount
metadata MAY remain in plaintext so the app can list mounts while locked.

#### Scenario: Secret is stored as ciphertext
- **WHEN** a credentialed mount is saved
- **THEN** the persisted record contains ciphertext and an IV but no plaintext secret and no encryption key

#### Scenario: Round-trip after unlock
- **WHEN** the vault is unlocked and a stored credential is read
- **THEN** the system decrypts it and the original secret is recovered exactly

### Requirement: User-held key sources
The system SHALL derive the encryption key from a factor the user controls that
is never written to disk, MUST support a passphrase factor (key derived with a
memory/CPU-hard or iterated KDF over a random salt), and SHALL support a WebAuthn
PRF factor (biometric or security-key unlock) where the browser provides it.
When PRF is unavailable, the system SHALL fall back to the passphrase factor.

#### Scenario: Unlocking with a passphrase
- **WHEN** the user enters the correct passphrase
- **THEN** the system derives the vault key, unlocks, and can decrypt stored credentials

#### Scenario: Unlocking with WebAuthn PRF
- **WHEN** the user verifies with an enrolled WebAuthn PRF credential in a supporting browser
- **THEN** the system derives the vault key from the PRF output without prompting for a passphrase

#### Scenario: PRF unavailable
- **WHEN** the browser or authenticator does not support the WebAuthn PRF extension
- **THEN** the system offers the passphrase factor instead and does not block setup

#### Scenario: Wrong passphrase
- **WHEN** the user enters an incorrect passphrase
- **THEN** decryption fails, the vault remains locked, and no credential is exposed

### Requirement: Lock/unlock lifecycle
The system SHALL start in a locked state whenever an enrolled factor or encrypted
credential exists, SHALL hold the derived key only in memory for the session, and
SHALL discard the key when the session ends. The system MAY auto-lock after a
period of inactivity.

#### Scenario: Locked on startup
- **WHEN** the app loads and encrypted credentials exist
- **THEN** the vault is locked and the key is not present in memory until the user unlocks

#### Scenario: Key is not persisted
- **WHEN** the vault is unlocked
- **THEN** the derived key exists only in memory and is never written to storage

#### Scenario: Re-locking ends key access
- **WHEN** the user locks the vault or the session ends
- **THEN** the in-memory key is discarded and credentialed operations require unlocking again

### Requirement: Locked-state behavior
While locked, the system SHALL keep non-credentialed functionality available —
listing mounts and rendering the catalog and cached thumbnails — and SHALL prompt
the user to unlock before performing any operation that requires a credential
(scanning, minting signed URLs, reading originals, or generating new thumbnails).

#### Scenario: Browsing cached media while locked
- **WHEN** the vault is locked and the user opens the gallery
- **THEN** mounts, catalog entries, and cached thumbnails are shown without requiring unlock

#### Scenario: Credentialed action while locked
- **WHEN** the user triggers a scan or opens an original from a credentialed mount while locked
- **THEN** the system prompts the user to unlock before proceeding

### Requirement: Migration of existing plaintext credentials
The system SHALL detect credentials previously stored in plaintext, SHALL prompt
the user to set up a lock, and on enrollment SHALL re-encrypt those credentials in
place and remove the plaintext fields. Until a lock is set up, the system SHALL
warn that credentials are unprotected.

#### Scenario: Prompting to protect existing credentials
- **WHEN** the app starts and finds plaintext credentials
- **THEN** the user is warned and prompted to set up a lock

#### Scenario: Encrypting in place on enrollment
- **WHEN** the user enrolls a factor with existing plaintext credentials present
- **THEN** the system encrypts those credentials, verifies a decrypt round-trip, and removes the plaintext fields
