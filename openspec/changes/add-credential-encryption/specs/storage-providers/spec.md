## ADDED Requirements

### Requirement: Providers obtain credentials from the unlocked vault
Provider adapters that require credentials SHALL obtain them only from the
unlocked credential vault and SHALL NOT read plaintext secrets from persisted
storage. When the vault is locked, credentialed provider operations SHALL be
unavailable until the user unlocks.

#### Scenario: Instantiating a credentialed provider while locked
- **WHEN** a credentialed operation is requested for an S3-compatible or user-drive mount while the vault is locked
- **THEN** the operation does not proceed and the system signals that unlocking is required

#### Scenario: Using credentials after unlock
- **WHEN** the vault is unlocked and a credentialed provider performs an operation
- **THEN** the provider receives the decrypted credentials from the vault in memory and completes the operation

#### Scenario: Credential-free providers are unaffected
- **WHEN** a local-folder or local-snapshot mount (which has no stored secret) is used while the vault is locked
- **THEN** its operations proceed without requiring unlock
