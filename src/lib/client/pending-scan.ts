let pending: File | null = null;

export function stashPendingScan(file: File) {
  pending = file;
}

export function takePendingScan() {
  const file = pending;
  pending = null;
  return file;
}
