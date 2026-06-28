/** Passphrase-based key derivation (PBKDF2 via WebCrypto, no dependencies). */

export const DEFAULT_PBKDF2_ITERATIONS = 600_000;

/**
 * Derive an AES-GCM wrapping key from a passphrase. The result is used to wrap
 * (encrypt) the random vault key; it is never persisted.
 */
export async function deriveWrappingKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = DEFAULT_PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export function randomSalt(bytes = 16): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(bytes));
}
