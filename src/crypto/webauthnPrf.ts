/**
 * WebAuthn PRF helpers: use a platform authenticator (Touch ID / Face ID /
 * security key) as a source of key material that never touches disk. We are not
 * authenticating to a server — the authenticator is used purely as a local key
 * store, so the random challenge is not verified anywhere.
 */

// A stable per-app input so the authenticator returns a consistent PRF output.
const PRF_INPUT = new TextEncoder().encode("trove-credential-vault-v1");

export function isPrfSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    !!navigator.credentials
  );
}

function randomChallenge(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export interface PrfRegistration {
  credentialId: Uint8Array;
}

/**
 * Register a new resident credential with the PRF extension. Returns null if the
 * authenticator does not report PRF support.
 */
export async function registerPrfCredential(userName: string): Promise<PrfRegistration | null> {
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge: randomChallenge() as BufferSource,
    rp: { name: "Trove" },
    user: {
      id: userId as BufferSource,
      name: userName || "trove-user",
      displayName: userName || "Trove user",
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },
      { type: "public-key", alg: -257 },
    ],
    authenticatorSelection: {
      userVerification: "required",
      residentKey: "preferred",
    },
    timeout: 60_000,
    // `prf: {}` requests the extension; types don't include it yet.
    extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
  };

  const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!cred) return null;
  const ext = cred.getClientExtensionResults() as { prf?: { enabled?: boolean } };
  if (!ext.prf?.enabled) return null;
  return { credentialId: new Uint8Array(cred.rawId) };
}

/** Obtain the PRF output for an enrolled credential (prompts user verification). */
export async function getPrfOutput(credentialId: Uint8Array): Promise<Uint8Array> {
  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: randomChallenge() as BufferSource,
    allowCredentials: [{ type: "public-key", id: credentialId as BufferSource }],
    userVerification: "required",
    timeout: 60_000,
    extensions: {
      prf: { eval: { first: PRF_INPUT } },
    } as AuthenticationExtensionsClientInputs,
  };
  const assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!assertion) throw new Error("WebAuthn assertion failed");
  const results = (
    assertion.getClientExtensionResults() as {
      prf?: { results?: { first?: ArrayBuffer } };
    }
  ).prf?.results?.first;
  if (!results) throw new Error("Authenticator did not return a PRF output");
  return new Uint8Array(results);
}

/** Derive an AES-GCM wrapping key from a PRF output via HKDF. */
export async function deriveWrappingKeyFromPrf(
  prfOutput: Uint8Array,
  salt: Uint8Array
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    prfOutput as BufferSource,
    "HKDF",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: PRF_INPUT as BufferSource },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
