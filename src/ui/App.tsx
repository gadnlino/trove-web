import { useCallback, useEffect, useMemo, useState } from "react";
import type { MediaType } from "../core/types";
import { features } from "../core/features";
import { type MountRecord, type UserDriveMount } from "../db/database";
import type { S3Config } from "../storage/adapters/S3CompatibleAdapter";
import { listMounts, newMountId, saveMount } from "../storage/mountStore";
import { providerManager } from "../app/providerManager";
import {
  addLocalFolderMount,
  addS3Mount,
  initLibrary,
  removeMountFull,
  startScan,
} from "../app/library";
import { getScanState } from "../catalog/scanner";
import { queryItems, type CatalogFilter } from "../catalog/catalog";
import type { MediaItem } from "../db/database";
import { beginAuthorization, completeAuthorization, type PkceConfig } from "../storage/oauth/pkce";
import { MediaGrid } from "./MediaGrid";
import { MediaViewer } from "./MediaViewer";
import { Settings, type ScanInfo } from "./Settings";

const PENDING_DRIVE_KEY = "trove.pendingDrive";

function driveConfig(clientId: string): PkceConfig {
  return {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    clientId,
    redirectUri: window.location.origin + window.location.pathname,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  };
}

export function App() {
  const feat = useMemo(() => features(), []);
  const [mounts, setMounts] = useState<MountRecord[]>([]);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [scanInfo, setScanInfo] = useState<Record<string, ScanInfo>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<MediaType | "all">("all");
  const [mountFilter, setMountFilter] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const filter = useMemo<CatalogFilter>(
    () => ({
      mediaType: type === "all" ? undefined : type,
      mountId: mountFilter === "all" ? undefined : mountFilter,
      from: from ? Date.parse(from) : undefined,
      to: to ? Date.parse(to) + 86_399_999 : undefined,
    }),
    [type, mountFilter, from, to]
  );

  const reloadItems = useCallback(async () => {
    setItems(await queryItems(filter));
  }, [filter]);

  const reloadMounts = useCallback(async () => {
    setMounts(await listMounts());
  }, []);

  const runScan = useCallback(
    async (mount: MountRecord) => {
      setScanInfo((p) => ({ ...p, [mount.id]: { status: "scanning", count: 0 } }));
      try {
        await startScan(mount, (count) =>
          setScanInfo((p) => ({ ...p, [mount.id]: { status: "scanning", count } }))
        );
        setScanInfo((p) => ({
          ...p,
          [mount.id]: { status: "done", count: p[mount.id]?.count ?? 0 },
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setScanInfo((p) => ({
          ...p,
          [mount.id]: { status: "error", count: p[mount.id]?.count ?? 0 },
        }));
      }
      await reloadItems();
    },
    [reloadItems]
  );

  // Initial load: handle any OAuth redirect, load library, resume scans.
  useEffect(() => {
    (async () => {
      await initLibrary();
      await handleOAuthRedirect(runScan);
      await reloadMounts();
      await reloadItems();
      for (const mount of await listMounts()) {
        const state = await getScanState(mount.id);
        if (!state || state.status !== "done") {
          void runScan(mount);
        }
      }
    })().catch((err) => setError(err instanceof Error ? err.message : String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void reloadItems();
  }, [reloadItems]);

  async function handleOAuthRedirect(scan: (m: MountRecord) => Promise<void>) {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("code")) return;
    const pendingRaw = localStorage.getItem(PENDING_DRIVE_KEY);
    try {
      if (pendingRaw) {
        const pending = JSON.parse(pendingRaw) as { name: string; oauth: PkceConfig };
        const tokens = await completeAuthorization(pending.oauth, params);
        const mount: UserDriveMount = {
          id: newMountId(),
          kind: "user-drive",
          name: pending.name,
          createdAt: Date.now(),
          oauth: pending.oauth,
          tokens,
        };
        await saveMount(mount);
        providerManager.register(mount);
        void scan(mount);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      localStorage.removeItem(PENDING_DRIVE_KEY);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  const onAddLocal = useCallback(async () => {
    setBusy("local");
    setError(null);
    try {
      const mount = await addLocalFolderMount();
      await reloadMounts();
      void runScan(mount);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, [reloadMounts, runScan]);

  const onAddS3 = useCallback(
    async (name: string, cfg: S3Config) => {
      setBusy("s3");
      setError(null);
      try {
        const mount = await addS3Mount(name, cfg);
        await reloadMounts();
        void runScan(mount);
      } catch (err) {
        setError(
          `Could not mount bucket: ${err instanceof Error ? err.message : String(err)}. ` +
            "If this looks like a network/CORS error, apply the CORS policy shown in the form."
        );
      } finally {
        setBusy(null);
      }
    },
    [reloadMounts, runScan]
  );

  const onConnectDrive = useCallback((name: string, clientId: string) => {
    const oauth = driveConfig(clientId);
    localStorage.setItem(PENDING_DRIVE_KEY, JSON.stringify({ name, oauth }));
    void beginAuthorization(oauth);
  }, []);

  const onRemove = useCallback(
    async (id: string) => {
      await removeMountFull(id);
      setScanInfo((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
      await reloadMounts();
      await reloadItems();
    },
    [reloadItems, reloadMounts]
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Trove</div>
        <div className="filters">
          <select value={type} onChange={(e) => setType(e.target.value as MediaType | "all")}>
            <option value="all">All media</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
          </select>
          <select value={mountFilter} onChange={(e) => setMountFilter(e.target.value)}>
            <option value="all">All mounts</option>
            {mounts.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To" />
        </div>
        <div className="spacer" />
        <span className="count muted">{items.length} items</span>
        <button type="button" className="btn" onClick={() => setShowSettings(true)}>
          Mounts
        </button>
      </header>

      {error && (
        <div className="banner-error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <main className="content">
        {mounts.length === 0 ? (
          <div className="empty">
            <h2>Welcome to Trove</h2>
            <p className="muted">
              Your photos and videos stay in your storage. Mount a local folder or an S3-compatible
              bucket to get started.
            </p>
            <button type="button" className="btn" onClick={() => setShowSettings(true)}>
              Add storage
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="empty">
            <p className="muted">No media matches the current filters yet.</p>
          </div>
        ) : (
          <MediaGrid items={items} onOpen={setSelected} />
        )}
      </main>

      {selected && <MediaViewer item={selected} onClose={() => setSelected(null)} />}
      {showSettings && (
        <Settings
          mounts={mounts}
          features={feat}
          scanInfo={scanInfo}
          busy={busy}
          onAddLocal={onAddLocal}
          onAddS3={onAddS3}
          onConnectDrive={onConnectDrive}
          onRemove={onRemove}
          onRescan={runScan}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
