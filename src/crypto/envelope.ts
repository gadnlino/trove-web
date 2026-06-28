import { fromBase64, toBase64 } from "./base64";

/** An AES-GCM ciphertext plus its initialization vector, base64-encoded. */
export interface EnvelopeData {
  ct: string;
  iv: string;
}

const IV_BYTES = 12;

export async function encryptBytes(key: CryptoKey, data: Uint8Array): Promise<EnvelopeData> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data as BufferSource);
  return { ct: toBase64(new Uint8Array(ct)), iv: toBase64(iv) };
}

export async function decryptBytes(key: CryptoKey, env: EnvelopeData): Promise<Uint8Array> {
  const iv = fromBase64(env.iv);
  const ct = fromBase64(env.ct);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ct as BufferSource
  );
  return new Uint8Array(plain);
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<EnvelopeData> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return encryptBytes(key, bytes);
}

export async function decryptJson<T>(key: CryptoKey, env: EnvelopeData): Promise<T> {
  const bytes = await decryptBytes(key, env);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
