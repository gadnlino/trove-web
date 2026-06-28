import { useState } from "react";
import type { MountRecord } from "../db/database";
import type { S3Config } from "../storage/adapters/S3CompatibleAdapter";
import type { BrowserFeatures } from "../core/features";

export interface ScanInfo {
  status: string;
  count: number;
}

interface SettingsProps {
  mounts: MountRecord[];
  features: BrowserFeatures;
  scanInfo: Record<string, ScanInfo>;
  busy: string | null;
  onAddLocal: () => void;
  onAddS3: (name: string, cfg: S3Config) => void;
  onConnectDrive: (name: string, clientId: string) => void;
  onRemove: (id: string) => void;
  onRescan: (mount: MountRecord) => void;
  onClose: () => void;
}

const CORS_POLICY = `[
  {
    "AllowedOrigins": ["${typeof window !== "undefined" ? window.location.origin : "https://your-site"}"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "ETag"]
  }
]`;

export function Settings(props: SettingsProps) {
  const { mounts, features, scanInfo, busy } = props;
  return (
    <div className="settings-overlay" onClick={props.onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <h2>Mounts &amp; settings</h2>
          <button type="button" className="btn-ghost" onClick={props.onClose}>
            ✕
          </button>
        </div>

        <section className="settings-section">
          <h3>Mounted storage</h3>
          {mounts.length === 0 && <p className="muted">No storage mounted yet.</p>}
          {mounts.map((m) => {
            const info = scanInfo[m.id];
            return (
              <div className="mount-row" key={m.id}>
                <div>
                  <div className="mount-name">{m.name}</div>
                  <div className="muted small">
                    {m.kind}
                    {info ? ` · ${info.status} (${info.count} items)` : ""}
                  </div>
                </div>
                <div className="row-actions">
                  <button type="button" className="btn-ghost" onClick={() => props.onRescan(m)}>
                    Rescan
                  </button>
                  <button type="button" className="btn-danger" onClick={() => props.onRemove(m.id)}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        <section className="settings-section">
          <h3>Add storage</h3>

          <div className="add-block">
            <strong>Local folder</strong>
            {features.fileSystemAccess ? (
              <button type="button" className="btn" disabled={!!busy} onClick={props.onAddLocal}>
                Choose folder…
              </button>
            ) : (
              <p className="muted small">
                Not supported in this browser. Use Chrome or Edge for local folders, or mount an
                S3-compatible bucket below.
              </p>
            )}
          </div>

          <S3Form busy={busy} onSubmit={props.onAddS3} />
          <DriveForm busy={busy} onSubmit={props.onConnectDrive} />
        </section>
      </div>
    </div>
  );
}

function S3Form({
  busy,
  onSubmit,
}: {
  busy: string | null;
  onSubmit: (name: string, cfg: S3Config) => void;
}) {
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [region, setRegion] = useState("auto");
  const [bucket, setBucket] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [prefix, setPrefix] = useState("");
  const [forcePathStyle, setForcePathStyle] = useState(true);

  return (
    <form
      className="add-block"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name, {
          endpoint: endpoint || undefined,
          region,
          bucket,
          accessKeyId,
          secretAccessKey,
          prefix: prefix || undefined,
          forcePathStyle,
        });
      }}
    >
      <strong>S3-compatible (S3 / R2 / B2 / MinIO)</strong>
      <input placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} />
      <input
        placeholder="Endpoint (blank for AWS S3)"
        value={endpoint}
        onChange={(e) => setEndpoint(e.target.value)}
      />
      <input
        placeholder="Region (e.g. auto, us-east-1)"
        value={region}
        onChange={(e) => setRegion(e.target.value)}
      />
      <input
        placeholder="Bucket"
        value={bucket}
        onChange={(e) => setBucket(e.target.value)}
        required
      />
      <input
        placeholder="Access key ID"
        value={accessKeyId}
        onChange={(e) => setAccessKeyId(e.target.value)}
        required
      />
      <input
        placeholder="Secret access key"
        type="password"
        value={secretAccessKey}
        onChange={(e) => setSecretAccessKey(e.target.value)}
        required
      />
      <input
        placeholder="Prefix (optional)"
        value={prefix}
        onChange={(e) => setPrefix(e.target.value)}
      />
      <label className="checkbox">
        <input
          type="checkbox"
          checked={forcePathStyle}
          onChange={(e) => setForcePathStyle(e.target.checked)}
        />
        Force path-style (MinIO and most non-AWS)
      </label>
      <button type="submit" className="btn" disabled={!!busy}>
        {busy === "s3" ? "Connecting…" : "Mount bucket"}
      </button>
      <details className="cors">
        <summary>Bucket not loading? Apply this CORS policy</summary>
        <pre>{CORS_POLICY}</pre>
      </details>
    </form>
  );
}

function DriveForm({
  busy,
  onSubmit,
}: {
  busy: string | null;
  onSubmit: (name: string, clientId: string) => void;
}) {
  const [name, setName] = useState("My Drive");
  const [clientId, setClientId] = useState("");
  return (
    <form
      className="add-block"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name, clientId);
      }}
    >
      <strong>Google Drive (read-only, OAuth)</strong>
      <input placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} />
      <input
        placeholder="OAuth client ID"
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        required
      />
      <p className="muted small">
        Redirect URI: <code>{typeof window !== "undefined" ? window.location.origin : ""}</code>
      </p>
      <button type="submit" className="btn" disabled={!!busy}>
        {busy === "drive" ? "Connecting…" : "Connect Drive"}
      </button>
    </form>
  );
}
