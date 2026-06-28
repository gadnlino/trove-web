import type { VaultConfig, VaultFactor } from "../db/database";
import { getVaultConfig, putVaultConfig } from "./mountStore";
import { fromBase64, toBase64 } from "../crypto/base64";
import {
  decryptBytes,
  decryptJson,
  encryptJson,
  type EnvelopeData,
} from "../crypto/envelope";
import {
  DEFAULT_PBKDF2_ITERATIONS,
  deriveWrappingKeyFromPassphrase,
  randomSalt,
} from "../crypto/passphrase";
import {
  deriveWrappingKeyFromPrf,
  getPrfOutput,
  isPrfSupported,
  registerPrfCredential,
} from "../crypto/webauthnPrf";
import {
  generateVaultKeyBytes,
  importVaultKey,
  wrapVaultKey,
} from "../crypto/vaultKey";

const CHECK_CONSTANT = "trove-vault-v1";
const AUTO_LOCK_MS = 15 * 60 * 1000;

export class VaultLockedError extends Error {
  constructor() {
    super("Vault is locked — unlock to access credentials.");
    this.name = "VaultLockedError";
  }
}

export class WrongPassphraseError extends Error {
  constructor() {
    super("Incorrect passphrase.");
    this.name = "WrongPassphraseError";
  }
}

/**
 * Owns the in-memory vault key and gates access to decrypted credentials. The
 * key is derived from a user-held factor (WebAuthn PRF or passphrase), held only
 * in memory, and dropped on lock / idle timeout. Persisted storage never
 * contains the raw secret or the key.
 */
class CredentialVault {
  private keyBytes: Uint8Array | null = null;
  private key: CryptoKey | null = null;
  private autoLockTimer: ReturnType<typeof setTimeout> | null = null;
  private onChange: (() => void) | null = null;

  setOnChange(cb: () => void): void {
    this.onChange = cb;
  }

  isLocked(): boolean {
    return !this.key;
  }

  async hasVault(): Promise<boolean> {
    const cfg = await getVaultConfig();
    return !!cfg && cfg.factors.length > 0;
  }

  async factorKinds(): Promise<Array<VaultFactor["kind"]>> {
    const cfg = await getVaultConfig();
    return cfg ? cfg.factors.map((f) => f.kind) : [];
  }

  prfSupported(): boolean {
    return isPrfSupported();
  }

  lock(): void {
    this.keyBytes = null;
    this.key = null;
    if (this.autoLockTimer !== null) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
    this.onChange?.();
  }

  private async setUnlocked(keyBytes: Uint8Array): Promise<void> {
    this.keyBytes = keyBytes;
    this.key = await importVaultKey(keyBytes);
    this.touch();
    this.onChange?.();
  }

  private touch(): void {
    if (this.autoLockTimer !== null) clearTimeout(this.autoLockTimer);
    if (this.key) {
      this.autoLockTimer = setTimeout(() => this.lock(), AUTO_LOCK_MS);
      // Don't keep a Node process / test runner alive for the idle timer.
      (this.autoLockTimer as { unref?: () => void }).unref?.();
    }
  }

  async encrypt(value: unknown): Promise<EnvelopeData> {
    if (!this.key) throw new VaultLockedError();
    this.touch();
    return encryptJson(this.key, value);
  }

  async decrypt<T>(env: EnvelopeData): Promise<T> {
    if (!this.key) throw new VaultLockedError();
    this.touch();
    return decryptJson<T>(this.key, env);
  }

  // --- Setup / enrollment ---

  async setupWithPassphrase(passphrase: string): Promise<void> {
    const cfg = await getVaultConfig();
    const keyBytes = cfg ? this.requireUnlockedKeyBytes() : generateVaultKeyBytes();

    const salt = randomSalt();
    const wrappingKey = await deriveWrappingKeyFromPassphrase(
      passphrase,
      salt,
      DEFAULT_PBKDF2_ITERATIONS
    );
    const wrapped = await wrapVaultKey(wrappingKey, keyBytes);
    const factor: VaultFactor = {
      kind: "passphrase",
      salt: toBase64(salt),
      iterations: DEFAULT_PBKDF2_ITERATIONS,
      wrapped,
    };
    await this.upsertFactor(cfg, keyBytes, factor);
    await this.setUnlocked(keyBytes);
  }

  /** Enroll a WebAuthn PRF factor. Returns false if PRF is unavailable. */
  async addPrfFactor(userName: string): Promise<boolean> {
    if (!isPrfSupported()) return false;
    const cfg = await getVaultConfig();
    const keyBytes = cfg ? this.requireUnlockedKeyBytes() : generateVaultKeyBytes();

    const reg = await registerPrfCredential(userName);
    if (!reg) return false;
    const prf = await getPrfOutput(reg.credentialId);
    const salt = randomSalt();
    const wrappingKey = await deriveWrappingKeyFromPrf(prf, salt);
    const wrapped = await wrapVaultKey(wrappingKey, keyBytes);
    const factor: VaultFactor = {
      kind: "webauthn-prf",
      credentialId: toBase64(reg.credentialId),
      salt: toBase64(salt),
      wrapped,
    };
    await this.upsertFactor(cfg, keyBytes, factor);
    await this.setUnlocked(keyBytes);
    return true;
  }

  private requireUnlockedKeyBytes(): Uint8Array {
    if (!this.keyBytes) {
      throw new Error("Unlock the vault before adding another factor.");
    }
    return this.keyBytes;
  }

  private async upsertFactor(
    cfg: VaultConfig | undefined,
    keyBytes: Uint8Array,
    factor: VaultFactor
  ): Promise<void> {
    let check: EnvelopeData;
    let factors: VaultFactor[];
    if (cfg) {
      check = cfg.check;
      factors = [...cfg.factors.filter((f) => f.kind !== factor.kind), factor];
    } else {
      const key = await importVaultKey(keyBytes);
      check = await encryptJson(key, CHECK_CONSTANT);
      factors = [factor];
    }
    await putVaultConfig({ id: "vault", check, factors });
  }

  // --- Unlock ---

  async unlockWithPassphrase(passphrase: string): Promise<void> {
    const cfg = await getVaultConfig();
    const factor = cfg?.factors.find((f) => f.kind === "passphrase");
    if (!cfg || !factor || factor.kind !== "passphrase") {
      throw new Error("No passphrase is set up.");
    }
    const wrappingKey = await deriveWrappingKeyFromPassphrase(
      passphrase,
      fromBase64(factor.salt),
      factor.iterations
    );
    const keyBytes = await this.unwrapAndVerify(wrappingKey, factor.wrapped, cfg).catch(() => {
      throw new WrongPassphraseError();
    });
    await this.setUnlocked(keyBytes);
  }

  async unlockWithPrf(): Promise<void> {
    const cfg = await getVaultConfig();
    const factor = cfg?.factors.find((f) => f.kind === "webauthn-prf");
    if (!cfg || !factor || factor.kind !== "webauthn-prf") {
      throw new Error("No WebAuthn factor is set up.");
    }
    const prf = await getPrfOutput(fromBase64(factor.credentialId));
    const wrappingKey = await deriveWrappingKeyFromPrf(prf, fromBase64(factor.salt));
    const keyBytes = await this.unwrapAndVerify(wrappingKey, factor.wrapped, cfg);
    await this.setUnlocked(keyBytes);
  }

  private async unwrapAndVerify(
    wrappingKey: CryptoKey,
    wrapped: EnvelopeData,
    cfg: VaultConfig
  ): Promise<Uint8Array> {
    const keyBytes = await decryptBytes(wrappingKey, wrapped);
    const key = await importVaultKey(keyBytes);
    const check = await decryptJson<string>(key, cfg.check);
    if (check !== CHECK_CONSTANT) throw new Error("Vault verification failed");
    return keyBytes;
  }
}

export const vault = new CredentialVault();
