import { useEffect, useState } from "react";
import type { MediaItem } from "../db/database";
import { providerManager } from "../app/providerManager";
import { thumbnails } from "../thumbnails/thumbnailService";
import { readThumbUrl } from "../thumbnails/opfsCache";
import { formatDuration } from "./format";

interface ThumbProps {
  item: MediaItem;
  onOpen: (item: MediaItem) => void;
}

export function Thumb({ item, onOpen }: ThumbProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        let current = item;
        if (current.thumbStatus !== "ready" || !current.thumbKey) {
          const provider = providerManager.get(current.mountId);
          if (!provider) return;
          current = await thumbnails.ensure(current, provider);
        }
        if (current.thumbKey) {
          const u = await readThumbUrl(current.thumbKey);
          if (!cancelled && u) {
            objectUrl = u;
            setUrl(u);
          }
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item]);

  return (
    <button className="thumb" onClick={() => onOpen(item)} title={item.name} type="button">
      {url ? (
        <img className="thumb-img" src={url} alt={item.name} loading="lazy" />
      ) : (
        <div className={`thumb-placeholder ${error ? "thumb-error" : ""}`}>{error ? "!" : ""}</div>
      )}
      {item.mediaType === "video" && (
        <span className="thumb-badge">{formatDuration(item.durationSec) || "video"}</span>
      )}
    </button>
  );
}
