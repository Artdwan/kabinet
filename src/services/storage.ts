// Thin localStorage wrapper. Every persisted key lives under one namespace
// so the whole cabinet's local state can be inspected/cleared as a unit.
// TODO: this is the seam where a real backend replaces localStorage —
// swap the bodies of read/write for fetch() calls against the API and
// nothing above this module needs to change.

const NAMESPACE = "kabinet";

function key(name: string): string {
  return `${NAMESPACE}:${name}`;
}

export function readJSON<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(name));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(name: string, value: T): void {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
  } catch {
    // storage full or unavailable — fail silently, in-memory state still works
  }
}

export function removeKey(name: string): void {
  localStorage.removeItem(key(name));
}

export function clearAll(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(`${NAMESPACE}:`)) toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}
