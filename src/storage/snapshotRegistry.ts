/**
 * Session-scoped, in-memory byte source for `local-snapshot` mounts. The
 * `webkitdirectory` picker yields a `FileList` we cannot persist, so the
 * provider-relative path → File map lives here only for the current session and
 * must be rebuilt when the user reconnects the folder.
 */

const maps = new Map<string, Map<string, File>>();

/** Build a provider-relative file map from a picker's FileList. */
export function buildFileMap(files: FileList | File[]): Map<string, File> {
  const list = Array.from(files);
  const map = new Map<string, File>();
  for (const file of list) {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    // Strip the leading root folder segment so paths match the provider model.
    const path = rel.includes("/") ? rel.slice(rel.indexOf("/") + 1) : rel;
    map.set(path, file);
  }
  return map;
}

export function setSnapshot(mountId: string, files: Map<string, File>): void {
  maps.set(mountId, files);
}

export function getSnapshot(mountId: string): Map<string, File> | undefined {
  return maps.get(mountId);
}

export function hasSnapshot(mountId: string): boolean {
  const map = maps.get(mountId);
  return !!map && map.size > 0;
}

export function clearSnapshot(mountId: string): void {
  maps.delete(mountId);
}
