import { describe, expect, it } from "vitest";
import { deriveWrappingKeyFromPassphrase, randomSalt } from "./passphrase";
import { generateVaultKeyBytes, wrapVaultKey } from "./vaultKey";
import { decryptBytes } from "./envelope";

// Keep iterations low so the test is fast; production uses the default.
const ITER = 10_000;

describe("passphrase key wrapping", () => {
  it("unwraps the vault key with the correct passphrase", async () => {
    const salt = randomSalt();
    const vaultKey = generateVaultKeyBytes();
    const wrapKey = await deriveWrappingKeyFromPassphrase("correct horse", salt, ITER);
    const wrapped = await wrapVaultKey(wrapKey, vaultKey);

    const again = await deriveWrappingKeyFromPassphrase("correct horse", salt, ITER);
    const unwrapped = await decryptBytes(again, wrapped);
    expect(unwrapped).toEqual(vaultKey);
  });

  it("fails to unwrap with the wrong passphrase", async () => {
    const salt = randomSalt();
    const vaultKey = generateVaultKeyBytes();
    const wrapKey = await deriveWrappingKeyFromPassphrase("correct horse", salt, ITER);
    const wrapped = await wrapVaultKey(wrapKey, vaultKey);

    const wrong = await deriveWrappingKeyFromPassphrase("battery staple", salt, ITER);
    await expect(decryptBytes(wrong, wrapped)).rejects.toBeTruthy();
  });

  it("derives a different key for a different salt", async () => {
    const vaultKey = generateVaultKeyBytes();
    const a = await deriveWrappingKeyFromPassphrase("same pass", randomSalt(), ITER);
    const b = await deriveWrappingKeyFromPassphrase("same pass", randomSalt(), ITER);
    const wa = await wrapVaultKey(a, vaultKey);
    // The wrong-salt key must not unwrap a blob wrapped with a different salt's key.
    await expect(decryptBytes(b, wa)).rejects.toBeTruthy();
  });
});
