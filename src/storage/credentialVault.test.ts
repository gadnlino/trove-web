import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { vault, VaultLockedError, WrongPassphraseError } from "./credentialVault";
import { deleteVaultConfig, getMount, listMounts, removeMount, saveMount } from "./mountStore";
import {
  encryptPlaintextCredentials,
  hasUnprotectedCredentials,
} from "./credentialMigration";
import type { S3Mount } from "../db/database";
import type { S3Secret } from "./adapters/S3CompatibleAdapter";

const PASS = "correct horse battery";

const SECRET: S3Secret = {
  accessKeyId: "AKIAEXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/EXAMPLEKEY",
};

function plaintextMount(id: string): S3Mount {
  return {
    id,
    kind: "s3-compatible",
    name: "bucket",
    createdAt: Date.now(),
    s3: { region: "auto", bucket: "bucket" },
    legacySecret: { ...SECRET },
  };
}

describe("CredentialVault", () => {
  beforeEach(async () => {
    vault.lock();
    await deleteVaultConfig();
    for (const m of await listMounts()) await removeMount(m.id);
  });

  it("blocks encrypt/decrypt while locked", async () => {
    expect(vault.isLocked()).toBe(true);
    await expect(vault.encrypt({ a: 1 })).rejects.toBeInstanceOf(VaultLockedError);
  });

  it("sets up with a passphrase and round-trips a secret", async () => {
    await vault.setupWithPassphrase(PASS);
    expect(vault.isLocked()).toBe(false);
    expect(await vault.hasVault()).toBe(true);

    const env = await vault.encrypt(SECRET);
    expect(await vault.decrypt<S3Secret>(env)).toEqual(SECRET);
  });

  it("migrates plaintext credentials in place", async () => {
    await saveMount(plaintextMount("m-mig"));
    expect(await hasUnprotectedCredentials()).toBe(true);

    await vault.setupWithPassphrase(PASS);
    await encryptPlaintextCredentials();

    const stored = (await getMount("m-mig")) as S3Mount;
    expect(stored.legacySecret).toBeUndefined();
    expect(stored.secret).toBeTruthy();
    expect(await hasUnprotectedCredentials()).toBe(false);
    expect(await vault.decrypt<S3Secret>(stored.secret!)).toEqual(SECRET);
  });

  it("unlocks with the correct passphrase and rejects the wrong one", async () => {
    await vault.setupWithPassphrase(PASS);
    const env = await vault.encrypt(SECRET);

    vault.lock();
    expect(vault.isLocked()).toBe(true);

    await expect(vault.unlockWithPassphrase("wrong pass")).rejects.toBeInstanceOf(
      WrongPassphraseError
    );
    expect(vault.isLocked()).toBe(true);

    await vault.unlockWithPassphrase(PASS);
    expect(vault.isLocked()).toBe(false);
    expect(await vault.decrypt<S3Secret>(env)).toEqual(SECRET);
  });
});
