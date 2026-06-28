import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { MediaType, ProviderKind } from "../core/types";
import type { S3PublicConfig, S3Secret } from "../storage/adapters/S3CompatibleAdapter";
import type { PkceConfig, TokenSet } from "../storage/oauth/pkce";
import type { EnvelopeData } from "../crypto/envelope";

/** A media item as stored in the local catalog. */
export interface MediaItem {
  /** `${mountId}\u0000${path}` */
  id: string;
  mountId: string;
  path: string;
  name: string;
  mediaType: MediaType;
  size: number;
  modifiedAt?: number;
  /** Best-known timestamp used for sorting (modifiedAt, else indexedAt). */
  capturedAt: number;
  width?: number;
  height?: number;
  durationSec?: number;
  thumbStatus: "pending" | "ready" | "error";
  /** OPFS path of the grid thumbnail. */
  thumbKey?: string;
  /** OPFS path of the larger preview. */
  previewKey?: string;
  indexedAt: number;
}

interface BaseMount {
  id: string;
  kind: ProviderKind;
  name: string;
  createdAt: number;
}

export interface LocalFolderMount extends BaseMount {
  kind: "local-folder";
  handle: FileSystemDirectoryHandle;
}

/**
 * A local folder mounted via the universal `webkitdirectory` picker. No file
 * handle can be persisted, so only metadata is stored; the byte source (an
 * in-memory file map) is rebuilt when the user reconnects the folder.
 */
export interface LocalSnapshotMount extends BaseMount {
  kind: "local-snapshot";
}

export interface S3Mount extends BaseMount {
  kind: "s3-compatible";
  s3: S3PublicConfig;
  /** Encrypted S3Secret. Present once the vault has been set up. */
  secret?: EnvelopeData;
  /** Plaintext secret awaiting encryption (migration only). */
  legacySecret?: S3Secret;
}

export interface UserDriveMount extends BaseMount {
  kind: "user-drive";
  oauth: PkceConfig;
  rootFolderId?: string;
  /** Encrypted TokenSet. Present once the vault has been set up. */
  tokensEnc?: EnvelopeData;
  /** Plaintext tokens awaiting encryption (migration only). */
  legacyTokens?: TokenSet;
}

/** A factor that can unlock the vault key (which it wraps). */
export type VaultFactor =
  | {
      kind: "passphrase";
      salt: string;
      iterations: number;
      wrapped: EnvelopeData;
    }
  | {
      kind: "webauthn-prf";
      credentialId: string;
      salt: string;
      wrapped: EnvelopeData;
    };

/** Singleton vault configuration: enrolled factors + an unlock check token. */
export interface VaultConfig {
  id: "vault";
  /** Encryption of a known constant, used to verify a correct unlock. */
  check: EnvelopeData;
  factors: VaultFactor[];
}

export type MountRecord = LocalFolderMount | LocalSnapshotMount | S3Mount | UserDriveMount;

export interface ScanState {
  mountId: string;
  status: "idle" | "scanning" | "paused" | "done" | "error";
  /** Directories/prefixes still to visit (resumable). */
  pendingDirs: string[];
  scannedCount: number;
  /** Start time of the current full run; used to reconcile stale items. */
  runStartedAt?: number;
  lastScanAt?: number;
  error?: string;
}

interface TroveDB extends DBSchema {
  mounts: {
    key: string;
    value: MountRecord;
  };
  media: {
    key: string;
    value: MediaItem;
    indexes: {
      "by-mount": string;
      "by-type": MediaType;
      "by-capturedAt": number;
      "by-thumbStatus": string;
    };
  };
  scanState: {
    key: string;
    value: ScanState;
  };
  vault: {
    key: string;
    value: VaultConfig;
  };
}

const DB_NAME = "trove";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<TroveDB>> | null = null;

export function db(): Promise<IDBPDatabase<TroveDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TroveDB>(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          database.createObjectStore("mounts", { keyPath: "id" });
          const media = database.createObjectStore("media", { keyPath: "id" });
          media.createIndex("by-mount", "mountId");
          media.createIndex("by-type", "mediaType");
          media.createIndex("by-capturedAt", "capturedAt");
          media.createIndex("by-thumbStatus", "thumbStatus");
          database.createObjectStore("scanState", { keyPath: "mountId" });
        }
        if (oldVersion < 2) {
          database.createObjectStore("vault", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export function mediaId(mountId: string, path: string): string {
  return `${mountId}\u0000${path}`;
}
