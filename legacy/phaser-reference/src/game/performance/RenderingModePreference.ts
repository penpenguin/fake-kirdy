export type RendererPreference = 'auto' | 'canvas';

const STORAGE_KEY = 'kirdy:rendering-mode';
const PREFERENCE_TTL_MS = 1000 * 60 * 10; // 10 minutes

type StoredPreference = {
  mode: RendererPreference;
  recordedAt: number;
};

function readStorage(): StoredPreference | undefined {
  if (typeof localStorage === 'undefined') {
    return undefined;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as Partial<StoredPreference> | undefined;
    if (!parsed || parsed.mode !== 'canvas' || typeof parsed.recordedAt !== 'number') {
      return undefined;
    }

    return { mode: 'canvas', recordedAt: parsed.recordedAt } satisfies StoredPreference;
  } catch {
    return undefined;
  }
}

function writeStorage(preference: StoredPreference) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // ignore quota or serialization errors
  }
}

function clearStorage() {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getPreferredRenderer(now = Date.now()): RendererPreference {
  const stored = readStorage();
  if (!stored) {
    return 'auto';
  }

  if (now - stored.recordedAt > PREFERENCE_TTL_MS) {
    clearStorage();
    return 'auto';
  }

  return stored.mode;
}

export function recordLowFpsEvent(now = Date.now()) {
  writeStorage({ mode: 'canvas', recordedAt: now });
}

export function recordStableFpsEvent() {
  clearStorage();
}
