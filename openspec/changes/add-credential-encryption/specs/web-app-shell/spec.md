## MODIFIED Requirements

### Requirement: On-device mount and credential storage
The system SHALL store all mount configuration and credentials only on the user's
device and SHALL never transmit them to any destination other than the user's
chosen backend. Sensitive credential fields SHALL be encrypted at rest with a key
derived from a user-held factor, such that the persisted data contains no
plaintext secret and no encryption key.

#### Scenario: Persisting a mount locally
- **WHEN** the user configures a mount with credentials
- **THEN** the configuration is persisted on-device and reused on later visits in the same browser

#### Scenario: Secrets encrypted at rest
- **WHEN** a mount's credentials are persisted
- **THEN** the sensitive fields are stored as ciphertext and cannot be read without unlocking the vault

#### Scenario: No third-party transmission
- **WHEN** the app communicates over the network
- **THEN** credentials are sent only to the mounted backend and to no application server
