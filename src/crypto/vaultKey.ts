import { decryptBytes, encryptBytes, type EnvelopeData } from "./envelope";

/**
 * The vault key is a single random AES-GCM key that encrypts all credentials.
 * It is wrapped (encrypted) once per enrolled factor, so any factor can unlock
 * the same vault key without re-encrypting stored credentials.
 */

export function generateVaultKeyBytes(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export function importVaultKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw as BufferSource, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Wrap the raw vault key bytes with a factor's wrapping key. */
export function wrapVaultKey(
  wrappingKey: CryptoKey,
  vaultKeyBytes: Uint8Array
): Promise<EnvelopeData> {
  return encryptBytes(wrappingKey, vaultKeyBytes);
}

/** Unwrap the vault key with a factor's wrapping key, returning a usable key. */
export async function unwrapVaultKey(
  wrappingKey: CryptoKey,
  wrapped: EnvelopeData
): Promise<CryptoKey> {
  const raw = await decryptBytes(wrappingKey, wrapped);
  return importVaultKey(raw);
}
