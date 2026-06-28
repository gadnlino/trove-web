/**
 * Universal folder selection via a hidden `<input type="file" webkitdirectory>`.
 * Supported in all modern browsers (Chrome, Edge, Firefox, Safari desktop),
 * unlike the File System Access API.
 */
export function pickDirectoryFiles(): Promise<FileList> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    // `webkitdirectory` is the de-facto standard attribute across browsers.
    input.setAttribute("webkitdirectory", "");
    input.style.display = "none";

    const cleanup = () => {
      input.removeEventListener("change", onChange);
      input.removeEventListener("cancel", onCancel);
      input.remove();
    };
    const onChange = () => {
      const files = input.files;
      cleanup();
      if (files && files.length > 0) resolve(files);
      else reject(new Error("No files selected"));
    };
    const onCancel = () => {
      cleanup();
      reject(new Error("Folder selection cancelled"));
    };

    input.addEventListener("change", onChange);
    input.addEventListener("cancel", onCancel);
    document.body.appendChild(input);
    input.click();
  });
}

/** Derive the selected folder's name from the first entry's relative path. */
export function deriveRootFolderName(files: FileList | File[]): string {
  const first = Array.from(files)[0] as (File & { webkitRelativePath?: string }) | undefined;
  const rel = first?.webkitRelativePath;
  if (rel && rel.includes("/")) return rel.slice(0, rel.indexOf("/"));
  return "Local folder";
}
