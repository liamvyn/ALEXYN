const API_BASE_STORAGE_KEY = 'alexyn_api_base_url_v1';

export function normalizeApiBaseUrl(raw: string | null | undefined): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return '';
  return trimmed.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search);
    const paramVal = normalizeApiBaseUrl(params.get('api'));
    if (paramVal) {
      window.localStorage.setItem(API_BASE_STORAGE_KEY, paramVal);
      return paramVal;
    }
    return normalizeApiBaseUrl(window.localStorage.getItem(API_BASE_STORAGE_KEY));
  } catch {
    return '';
  }
}

export function setApiBaseUrl(raw: string): string {
  const normalized = normalizeApiBaseUrl(raw);
  if (typeof window !== 'undefined') {
    try {
      if (normalized) {
        window.localStorage.setItem(API_BASE_STORAGE_KEY, normalized);
      } else {
        window.localStorage.removeItem(API_BASE_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }
  return normalized;
}

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${cleanPath}` : cleanPath;
}

export function isStandaloneFileOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'file:' ||
    window.location.protocol === 'content:' ||
    window.location.origin === 'null'
  );
}

export function isFileProtocolWithoutServer(): boolean {
  return isStandaloneFileOrigin() && !getApiBaseUrl();
}

export function formatConnectionError(
  err: unknown,
  fallback = 'Could not reach the ALEXYN backend server.'
): string {
  if (isFileProtocolWithoutServer()) {
    return 'Standalone offline mode: connect your running ALEXYN Backend Server URL in Settings → AI Provider & Backend URL to use live AI features. Offline tools (Scientific Calculator, Math Notebook, Saved Notes, Saved Quizzes, and 3D Labs) work without a server.';
  }
  const msg = err instanceof Error ? err.message : '';
  if (
    /failed to fetch|networkerror|load failed|network request failed/i.test(msg)
  ) {
    const base = getApiBaseUrl();
    return base
      ? `Cannot reach ALEXYN backend at ${base}. Make sure the server is running and reachable from this device.`
      : 'Cannot reach the ALEXYN backend server. Check that the ALEXYN server is running on this host.';
  }
  return msg || fallback;
}

export async function parseJsonResponseSafe<T = Record<string, unknown>>(
  res: Response
): Promise<T & { error?: string }> {
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (ctype.includes('application/json')) {
    return (await res.json().catch(() => ({}))) as T & { error?: string };
  }
  const text = (await res.text().catch(() => '')).trim();
  if (!text) return {} as T & { error?: string };
  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    return {
      error: res.ok
        ? undefined
        : `Server returned HTTP ${res.status} (${res.statusText || 'unexpected response'}).`,
    } as T & { error?: string };
  }
}
