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

export function isFileProtocolWithoutServer(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'file:' && !getApiBaseUrl();
}
