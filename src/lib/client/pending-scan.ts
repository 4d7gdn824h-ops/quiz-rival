let pending: File[] = [];
let paste = false;
let demoId: string | null = null;

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

export function stashPendingDemo(fixtureId: string) {
  demoId = fixtureId;
}

export function takePendingDemo() {
  const value = demoId;
  demoId = null;
  return value;
}
