import { describe, expect, it } from "vitest";
import { decryptBytes, decryptJson, encryptBytes, encryptJson } from "./envelope";

async function freshKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

describe("envelope", () => {
  it("round-trips JSON values", async () => {
    const key = await freshKey();
    const value = { accessKeyId: "AKIA123", secretAccessKey: "s3cr3t/+=" };
    const env = await encryptJson(key, value);
    expect(await decryptJson(key, env)).toEqual(value);
  });

  it("round-trips raw bytes", async () => {
    const key = await freshKey();
    const data = crypto.getRandomValues(new Uint8Array(48));
    const env = await encryptBytes(key, data);
    expect(await decryptBytes(key, env)).toEqual(data);
  });

  it("uses a fresh IV per encryption", async () => {
    const key = await freshKey();
    const a = await encryptJson(key, "same");
    const b = await encryptJson(key, "same");
    expect(a.iv).not.toEqual(b.iv);
    expect(a.ct).not.toEqual(b.ct);
  });

  it("does not leak plaintext into the ciphertext", async () => {
    const key = await freshKey();
    const secret = "SUPER-SECRET-VALUE";
    const env = await encryptJson(key, secret);
    const decoded = atob(env.ct);
    expect(decoded.includes(secret)).toBe(false);
  });

  it("fails to decrypt with the wrong key", async () => {
    const key = await freshKey();
    const other = await freshKey();
    const env = await encryptJson(key, "secret");
    await expect(decryptJson(other, env)).rejects.toBeTruthy();
  });
});
