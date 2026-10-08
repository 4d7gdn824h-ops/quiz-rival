let pending: File[] = [];
let paste = false;

export function stashPendingScan(files: File[]) {
  pending = files.slice();
}

export function takePendingScan() {
  const files = pending;
  pending = [];
  return files;
}

export function stashPendingPaste() {
  paste = true;
}

export function takePendingPaste() {
  const value = paste;
  paste = false;
  return value;
}
