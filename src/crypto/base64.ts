/** Base64 helpers for storing binary crypto material in IndexedDB/JSON. */

export function toBase64(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str);
}

export function fromBase64(b64: string): Uint8Array {
  const str = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}
