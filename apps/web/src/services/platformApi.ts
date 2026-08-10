import type { ActiveContext, User } from '../types';

const CSRF_STORAGE_KEY = 'utms-csrf';

export class PlatformApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function storage(): Storage | null {
  return typeof window === 'undefined' ? null : window.sessionStorage;
}

export function getCsrfToken(): string {
  return storage()?.getItem(CSRF_STORAGE_KEY) || '';
}

function setCsrfToken(value?: string | null): void {
  const target = storage();
  if (!target) return;
  if (value) target.setItem(CSRF_STORAGE_KEY, value);
  else target.removeItem(CSRF_STORAGE_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const csrf = getCsrfToken();
  if (csrf && !['GET', 'HEAD'].includes(String(init.method || 'GET').toUpperCase())) {
    headers.set('x-csrf-token', csrf);
  }
  const response = await fetch(path, { ...init, headers, credentials: 'include' });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = payload?.error || {};
    throw new PlatformApiError(error.category || 'PLATFORM_API_ERROR', error.message || response.statusText, response.status, error.details);
  }
  if (payload?.csrfToken) setCsrfToken(payload.csrfToken);
  return payload as T;
}

export const authSessionApi = {
  async login(phoneNumber: string, password: string): Promise<{ user: User; activeContext: ActiveContext; csrfToken: string; expiresAt: string }> {
    return request('/api/auth/login', { method: 'POST', body: JSON.stringify({ phoneNumber, password }) });
  },

  async current(): Promise<{ authenticated: boolean; activeContext: ActiveContext; csrfToken: string; expiresAt: string }> {
    return request('/api/auth/session');
  },

  async selectContext(assignmentId: string): Promise<{ activeContext: ActiveContext }> {
    return request('/api/auth/context', { method: 'POST', body: JSON.stringify({ assignmentId }) });
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST', body: '{}' });
    } finally {
      setCsrfToken(null);
    }
  },
};
