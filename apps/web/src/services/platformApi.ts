import type { ActiveContext, PaginatedResponse, PlaywrightRun, PlaywrightTestFile, User } from '../types';

const CSRF_STORAGE_KEY = 'utms-csrf';

export type CdeBranchSelector =
  | { kind: 'PUBLIC' }
  | { kind: 'PERSONAL'; randId?: string; index?: number };

export interface CdeConnectionStatus {
  connected: boolean;
  reconnectRequired?: boolean;
  nextStep?: string;
  challenge?: string;
  ecreq?: boolean;
  user?: { firstName: string; lastName: string; displayName: string } | null;
}

export interface CdePackageSummary {
  id: string;
  branches: Array<{
    selector: CdeBranchSelector;
    versionId?: string | null;
    editable?: boolean;
    meta?: Record<string, unknown>;
    configured?: boolean;
  }>;
}

export interface CdeCatalogRepository {
  type: 'WEB_UI' | 'DATA_SERVICE' | 'API_MODULE' | 'MESSAGE_CONSUMER' | 'TESTS';
  repoName: string;
  packages: CdePackageSummary[];
  error?: { code: string; message: string };
}

export interface CdeCatalog {
  applicationId?: string;
  projectKey: string;
  repositories: CdeCatalogRepository[];
}

export interface CdePackageContent {
  applicationId?: string;
  projectKey?: string;
  repositoryType: CdeCatalogRepository['type'];
  repoName: string;
  packId: string;
  branches: Array<{
    selector: CdeBranchSelector;
    versionId?: string | null;
    editable?: boolean;
    meta?: Record<string, unknown>;
  }>;
  branch: {
    selector: CdeBranchSelector;
    versionId?: string | null;
    editable: boolean;
    meta?: Record<string, unknown>;
  };
  files: Array<{ path: string; code: string; language?: string; readOnly: boolean }>;
}

export interface CdeProjectDescriptor {
  projectKey: string;
  repositories: Record<'WEB_UI' | 'DATA_SERVICE' | 'API_MODULE' | 'MESSAGE_CONSUMER', string>;
  editorUrls: {
    webUi: string;
    dataService: string;
    gateway: string;
  };
}

export interface ApplicationEnvironmentProfile {
  id: string;
  applicationId: string;
  name: string;
  webBaseUrl: string;
  apiBaseUrl?: string | null;
  gatewayBaseUrl?: string | null;
  secretReferences?: Record<string, string>;
  enabled: boolean;
  availableFrom?: string | null;
  availableUntil?: string | null;
  availableNow?: boolean;
}

export interface CdeVisibleApplication {
  id: string;
  name: string;
  code: string;
  projectKey: string;
  repositories: Record<string, string | null | undefined>;
  environments: ApplicationEnvironmentProfile[];
}

export interface CdeApplicationMapping {
  applicationId: string;
  serviceId: 'cde.edus.ir';
  projectKey: string;
  webUiRepoName?: string | null;
  dataServiceRepoName?: string | null;
  apiModuleRepoName?: string | null;
  messageConsumerRepoName?: string | null;
  testRepoName?: string | null;
  testPackId?: string | null;
  testBranchRandId?: string | null;
  testBranchIndex?: number | null;
  enabled: boolean;
  lastValidationStatus?: string | null;
  lastValidatedAt?: string | null;
}

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

export const cdeApi = {
  status: () => request<CdeConnectionStatus>('/api/cde/session'),
  startLogin: (userLoginName: string) => request<CdeConnectionStatus>('/api/cde/session/start', {
    method: 'POST', body: JSON.stringify({ userLoginName }),
  }),
  finishPassword: (challenge: string, password: string) => request<CdeConnectionStatus>('/api/cde/session/password', {
    method: 'POST', body: JSON.stringify({ challenge, password }),
  }),
  disconnect: () => request<CdeConnectionStatus>('/api/cde/session', { method: 'DELETE' }),
  projects: () => request<CdeProjectDescriptor[]>('/api/cde/projects'),
  projectCatalog: (projectKey: string) => request<CdeCatalog>(`/api/cde/projects/${encodeURIComponent(projectKey)}/catalog`),
  projectPackage: (projectKey: string, data: {
    repositoryType: Exclude<CdeCatalogRepository['type'], 'TESTS'>;
    packId: string;
    branch?: CdeBranchSelector;
  }) => request<CdePackageContent>(`/api/cde/projects/${encodeURIComponent(projectKey)}/package`, {
    method: 'POST', body: JSON.stringify(data),
  }),
  applications: () => request<CdeVisibleApplication[]>('/api/cde/applications'),
  mapping: (applicationId: string) => request<CdeApplicationMapping>(`/api/applications/${encodeURIComponent(applicationId)}/cde/mapping`),
  saveMapping: (applicationId: string, data: Omit<CdeApplicationMapping, 'applicationId' | 'serviceId' | 'lastValidationStatus' | 'lastValidatedAt'>) =>
    request<CdeApplicationMapping>(`/api/applications/${encodeURIComponent(applicationId)}/cde/mapping`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
  validateMapping: (applicationId: string) => request<{
    valid: true;
    projectKey: string;
    storage: { provider: 'COUCHDB'; database: string; healthy: true; documentCount: number };
  }>(`/api/applications/${encodeURIComponent(applicationId)}/cde/mapping/validate`, {
    method: 'POST', body: '{}',
  }),
  catalog: (applicationId: string) => request<CdeCatalog>(`/api/applications/${encodeURIComponent(applicationId)}/cde/catalog`),
  packageContent: (applicationId: string, data: {
    repositoryType: CdeCatalogRepository['type'];
    repoName: string;
    packId: string;
    branch?: CdeBranchSelector;
  }) => request<CdePackageContent>(`/api/applications/${encodeURIComponent(applicationId)}/cde/package`, {
    method: 'POST', body: JSON.stringify(data),
  }),
  selectBranch: (applicationId: string, data: {
    repositoryType: CdeCatalogRepository['type']; repoName: string; packId: string; branch: CdeBranchSelector;
  }) => request<{ branch: CdeBranchSelector; versionId?: string }>(`/api/applications/${encodeURIComponent(applicationId)}/cde/branch-selection`, {
    method: 'PUT', body: JSON.stringify(data),
  }),
  testFiles: <T>(applicationId: string, filters: { page?: number; limit?: number; search?: string } = {}) => {
    const query = new URLSearchParams();
    if (filters.page) query.set('page', String(filters.page));
    if (filters.limit) query.set('limit', String(filters.limit));
    if (filters.search) query.set('search', filters.search);
    return request<T>(`/api/applications/${encodeURIComponent(applicationId)}/playwright/files?${query}`);
  },
  createTestFile: <T>(applicationId: string, data: unknown) => request<T>(`/api/applications/${encodeURIComponent(applicationId)}/playwright/files`, {
    method: 'POST', body: JSON.stringify(data),
  }),
  updateTestFile: <T>(applicationId: string, fileId: string, data: unknown) => request<T>(`/api/applications/${encodeURIComponent(applicationId)}/playwright/files/${encodeURIComponent(fileId)}`, {
    method: 'PATCH', body: JSON.stringify(data),
  }),
  environments: (applicationId: string, options: { includeDisabled?: boolean } = {}) => {
    const query = options.includeDisabled ? '?includeDisabled=true' : '';
    return request<ApplicationEnvironmentProfile[]>(`/api/applications/${encodeURIComponent(applicationId)}/environments${query}`);
  },
  saveEnvironment: (applicationId: string, data: Omit<ApplicationEnvironmentProfile, 'id' | 'applicationId'>) =>
    request<ApplicationEnvironmentProfile>(`/api/applications/${encodeURIComponent(applicationId)}/environments`, {
      method: 'POST', body: JSON.stringify(data),
    }),
  updateEnvironment: (applicationId: string, environmentId: string, data: Partial<Omit<ApplicationEnvironmentProfile, 'id' | 'applicationId'>>) =>
    request<ApplicationEnvironmentProfile>(`/api/applications/${encodeURIComponent(applicationId)}/environments/${encodeURIComponent(environmentId)}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),
  deleteEnvironment: (applicationId: string, environmentId: string) =>
    request<{ deleted: true; id: string }>(`/api/applications/${encodeURIComponent(applicationId)}/environments/${encodeURIComponent(environmentId)}`, {
      method: 'DELETE', body: '{}',
    }),
  bulkConfigureEnvironments: (data: {
    sourceApplicationId: string;
    sourceEnvironmentId: string;
    applicationIds?: string[];
    allMapped?: boolean;
    enabled: boolean;
    availableFrom?: string | null;
    availableUntil?: string | null;
    createMissing: boolean;
    overwriteUrls: boolean;
  }) => request<{ updated: number; created: number; skipped: number; total: number }>('/api/applications/bulk/environments', {
    method: 'POST', body: JSON.stringify(data),
  }),
  runs: (filters: { applicationId?: string; page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (filters.applicationId && filters.applicationId !== 'ALL') query.set('applicationId', filters.applicationId);
    if (filters.page) query.set('page', String(filters.page));
    if (filters.limit) query.set('limit', String(filters.limit));
    return request<PaginatedResponse<PlaywrightRun>>(`/api/playwright/runs?${query}`);
  },
  run: (runId: string) => request<PlaywrightRun>(`/api/playwright/runs/${encodeURIComponent(runId)}`),
  startRun: (data: {
    applicationId: string;
    environmentProfileId: string;
    testFileId: string;
    projects: string[];
    workers: string;
    retries: number;
    maxFailures?: string;
    trace?: string;
    timeoutSeconds: number;
  }) => request<PlaywrightRun>('/api/playwright/runs', { method: 'POST', body: JSON.stringify(data) }),
  cancelRun: (runId: string) => request<PlaywrightRun>(`/api/playwright/runs/${encodeURIComponent(runId)}/cancel`, {
    method: 'POST', body: '{}',
  }),
  runnableFiles: (applicationId: string) => request<{
    files: PaginatedResponse<PlaywrightTestFile>;
    storage: { provider: 'COUCHDB'; database: string; projectKey: string; bindingFingerprint: string; editable: boolean };
  }>(`/api/applications/${encodeURIComponent(applicationId)}/playwright/files?limit=100`),
};
