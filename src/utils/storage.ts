export function getStorage(type: 'local' | 'session'): Storage | null {
  try {
    if (type === 'local') return window.localStorage;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getStoredValue(key: string): string | null {
  const local = getStorage('local');
  const localValue = local?.getItem(key);
  if (localValue) return localValue;

  const session = getStorage('session');
  const sessionValue = session?.getItem(key);

  if (sessionValue && local) {
    local.setItem(key, sessionValue);
    session?.removeItem(key);
  }

  return sessionValue || null;
}

export function setStoredValue(key: string, value: string): void {
  const local = getStorage('local');
  if (local) {
    local.setItem(key, value);
    return;
  }
  getStorage('session')?.setItem(key, value);
}

export function removeStoredValue(key: string): void {
  getStorage('local')?.removeItem(key);
  getStorage('session')?.removeItem(key);
}
