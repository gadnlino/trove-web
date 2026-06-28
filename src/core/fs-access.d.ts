// Minimal ambient typings for the parts of the File System Access API that the
// standard TS DOM lib does not yet include (permission queries + picker).

interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface FileSystemHandle {
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface DirectoryPickerOptions {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: string | FileSystemHandle;
}

interface Window {
  showDirectoryPicker?(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}

declare function showDirectoryPicker(
  options?: DirectoryPickerOptions
): Promise<FileSystemDirectoryHandle>;
