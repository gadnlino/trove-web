import { useEffect, useState } from "react";
import type { MediaItem } from "../db/database";
import { providerManager } from "../app/providerManager";
import { canSignUrls } from "../storage/StorageProvider";
import { formatBytes, formatDate } from "./format";

interface MediaViewerProps {
  item: MediaItem;
  onClose: () => void;
  onReconnect?: (mountId: string) => void;
}

export function MediaViewer({ item, onClose, onReconnect }: MediaViewerProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnectNeeded, setReconnectNeeded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      const provider = providerManager.get(item.mountId);
      if (!provider) {
        setError("This item's storage is not mounted.");
        return;
      }
      try {
        if (canSignUrls(provider)) {
          // Direct fetch / seekable network playback via a signed URL.
          const url = await provider.getSignedUrl(item.path, 600);
          if (!cancelled) setSrc(url);
        } else {
          // Buffered fallback: stream the bytes and play from an object URL.
          const stream = await provider.read(item.path);
          const blob = await new Response(stream).blob();
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) setSrc(objectUrl);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.name === "SnapshotNotConnectedError") {
          setReconnectNeeded(true);
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="viewer-overlay" onClick={onClose}>
      <div className="viewer-content" onClick={(e) => e.stopPropagation()}>
        <button className="viewer-close" type="button" onClick={onClose}>
          ✕
        </button>
        <div className="viewer-stage">
          {reconnectNeeded ? (
            <div className="viewer-error">
              <p>This folder isn't connected in this session.</p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  onReconnect?.(item.mountId);
                  onClose();
                }}
              >
                Reconnect folder
              </button>
            </div>
          ) : error ? (
            <div className="viewer-error">{error}</div>
          ) : !src ? (
            <div className="viewer-loading">Loading…</div>
          ) : item.mediaType === "image" ? (
            <img className="viewer-media" src={src} alt={item.name} />
          ) : (
            <video className="viewer-media" src={src} controls autoPlay playsInline />
          )}
        </div>
        <div className="viewer-meta">
          <span className="viewer-name">{item.name}</span>
          <span className="viewer-sub">
            {formatDate(item.capturedAt)} · {formatBytes(item.size)}
            {item.width && item.height ? ` · ${item.width}×${item.height}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
