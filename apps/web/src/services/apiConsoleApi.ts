import type { ActiveContext, ApplicationScopeFilter, PaginatedResponse } from '../types';
import type {
  ApiCollection,
  ApiConsolePermissionPolicy,
  ApiCurlImportPreview,
  ApiEffectiveRequestSnapshot,
  ApiEnvironmentProfile,
  ApiExecutionMode,
  ApiExecutionRunner,
  ApiExportDialect,
  ApiManualResponseExample,
  ApiPostmanCollectionExport,
  ApiConsoleReference,
  ApiConsumerCandidate,
  ApiRepositoryItem,
  ApiRequestDefinition,
  ApiRequestExecution,
  ApiShareRequest,
  ApiUsageReport,
  ApiVersionConsumer,
  ApiDocumentationResult,
  NormalizedApiRequest,
} from '../types/apiConsole';

const API_BASE = (import.meta.env.VITE_API_CONSOLE_BASE_URL || '/api/api-console').replace(/\/$/, '');

const API_CONSOLE_POLICY: ApiConsolePermissionPolicy = {
  canView: ['SYSTEM_ADMIN', 'QA_LEAD', 'QA_SPECIALIST', 'BA', 'SECURITY_REVIEWER', 'TECH_LEAD', 'PRODUCT_OWNER', 'DEVELOPER'],
  canCreate: ['SYSTEM_ADMIN', 'QA_LEAD', 'QA_SPECIALIST', 'BA', 'TECH_LEAD', 'DEVELOPER'],
  canEdit: ['SYSTEM_ADMIN', 'QA_LEAD', 'QA_SPECIALIST', 'BA', 'TECH_LEAD', 'DEVELOPER'],
  canExecute: ['SYSTEM_ADMIN', 'QA_LEAD', 'QA_SPECIALIST', 'SECURITY_REVIEWER', 'TECH_LEAD', 'DEVELOPER'],
  canExecuteProduction: ['SYSTEM_ADMIN', 'TECH_LEAD', 'QA_LEAD'],
  canExecuteCommand: ['SYSTEM_ADMIN', 'QA_LEAD', 'TECH_LEAD'],
  canExecuteProductionCommand: ['SYSTEM_ADMIN', 'TECH_LEAD'],
  canDelete: ['SYSTEM_ADMIN', 'QA_LEAD', 'QA_SPECIALIST', 'BA', 'SECURITY_REVIEWER', 'TECH_LEAD', 'PRODUCT_OWNER', 'DEVELOPER'],
  canGenerateDocumentation: ['SYSTEM_ADMIN', 'QA_LEAD', 'QA_SPECIALIST', 'BA', 'SECURITY_REVIEWER', 'TECH_LEAD', 'PRODUCT_OWNER', 'DEVELOPER'],
};

type ApiConsoleRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown | undefined;
  context?: ActiveContext | undefined;
};

type CoreValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

type ParserSelfCheckResult = {
  passed: number;
  failed: number;
  details: Array<{ name: string; passed: boolean; message?: string }>;
};

function compactContext(context?: ActiveContext) {
  if (!context) return undefined;
  return {
    userId: context.userId,
    user: context.user ? { id: context.user.id, fullName: context.user.fullName } : undefined,
    assignmentId: context.assignmentId,
    applicationId: context.applicationId,
    scopeApplicationIds: context.scopeApplicationIds,
    role: context.role,
    scope: context.scope,
    automatedTestsEnabled: context.automatedTestsEnabled,
  };
}

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function contextHeader(context?: ActiveContext): Record<string, string> {
  const compact = compactContext(context);
  if (!compact) return {};
  return { 'x-utms-context': encodeBase64Utf8(JSON.stringify(compact)) };
}

function applicationScopeParam(scope: ApplicationScopeFilter): string {
  if (!scope || scope === 'ALL') return 'ALL';
  if (Array.isArray(scope)) return JSON.stringify(scope);
  return scope;
}

async function parseApiError(response: Response): Promise<Error> {
  try {
    const payload = await response.json();
    const category = payload?.error?.category || 'INTERNAL_EXECUTION_ERROR';
    const message = payload?.error?.message || response.statusText || 'API Console request failed.';
    return new Error(`${category}: ${message}`);
  } catch {
    return new Error(`INTERNAL_EXECUTION_ERROR: ${response.statusText || 'API Console request failed.'}`);
  }
}

async function requestJson<T>(path: string, options: ApiConsoleRequestOptions = {}): Promise<T> {
  const method = options.method || 'GET';
  const requestInit: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
      ...contextHeader(options.context),
    },
  };
  if (method !== 'GET') {
    requestInit.body = JSON.stringify(options.body || {});
  }
  const response = await fetch(`${API_BASE}${path}`, requestInit);

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.json() as Promise<T>;
}

function withQuery(path: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export const apiConsoleApi = {
  policy: API_CONSOLE_POLICY,

  getEnvironments(): Promise<ApiEnvironmentProfile[]> {
    return requestJson('/environments');
  },

  getRunners(): Promise<ApiExecutionRunner[]> {
    return requestJson('/runners');
  },

  getCollections(applicationId: ApplicationScopeFilter, context?: ActiveContext): Promise<ApiCollection[]> {
    return requestJson(withQuery('/collections', { applicationId: applicationScopeParam(applicationId) }), { context });
  },

  createCollection(data: Partial<ApiCollection>, context: ActiveContext): Promise<ApiCollection> {
    return requestJson('/collections', {
      method: 'POST',
      context,
      body: { data },
    });
  },

  exportPostmanCollection(collectionId: string, context: ActiveContext): Promise<ApiPostmanCollectionExport> {
    return requestJson(`/collections/${encodeURIComponent(collectionId)}/export-postman`, { context });
  },

  parseCurl(curlText: string, userId: string, context?: ActiveContext): Promise<ApiCurlImportPreview> {
    return requestJson('/curl/parse', {
      method: 'POST',
      context,
      body: { curlText, userId },
    });
  },

  createRequest(
    data: {
      name: string;
      description?: string;
      collectionId: string;
      applicationId: string;
      environmentId: string;
      normalizedRequest: NormalizedApiRequest;
      originalImportedCurl?: string;
      importedCurlId?: string;
    },
    context: ActiveContext
  ): Promise<ApiRequestDefinition> {
    return requestJson('/requests', {
      method: 'POST',
      context,
      body: { data },
    });
  },

  createBlankRequest(collectionId: string, applicationId: string, environmentId: string, context: ActiveContext): Promise<ApiRequestDefinition> {
    return requestJson('/requests/blank', {
      method: 'POST',
      context,
      body: { data: { collectionId, applicationId, environmentId } },
    });
  },

  updateRequest(id: string, data: Partial<ApiRequestDefinition>, context: ActiveContext): Promise<ApiRequestDefinition | null> {
    return requestJson(`/requests/${encodeURIComponent(id)}`, {
      method: 'PUT',
      context,
      body: { data },
    });
  },

  getRequests(
    applicationId: ApplicationScopeFilter,
    filters: { page: number; limit: number; search?: string; collectionId?: string; classificationType?: string; status?: string },
    context?: ActiveContext
  ): Promise<PaginatedResponse<ApiRequestDefinition>> {
    return requestJson(withQuery('/requests', {
      applicationId: applicationScopeParam(applicationId),
      page: filters.page,
      limit: filters.limit,
      search: filters.search,
      collectionId: filters.collectionId,
      classificationType: filters.classificationType,
      status: filters.status,
    }), { context });
  },

  getRequest(id: string, context?: ActiveContext): Promise<ApiRequestDefinition | null> {
    return requestJson(`/requests/${encodeURIComponent(id)}`, { context });
  },

  archiveRequest(id: string, context: ActiveContext): Promise<ApiRequestDefinition | null> {
    return requestJson(`/requests/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      context,
      body: {},
    });
  },

  shareRequest(
    requestId: string,
    data: { purpose: string; introduction: string; description: string },
    context: ActiveContext
  ): Promise<ApiShareRequest> {
    return requestJson(`/requests/${encodeURIComponent(requestId)}/share`, {
      method: 'POST',
      context,
      body: { data },
    });
  },

  createVersion(
    requestId: string,
    data: { version: string; changeLog: string },
    context: ActiveContext
  ): Promise<ApiRequestDefinition> {
    return requestJson(`/requests/${encodeURIComponent(requestId)}/versions`, {
      method: 'POST',
      context,
      body: { data },
    });
  },

  getShareReviews(
    filters: { page: number; limit: number; search?: string; status?: string; submittedBy?: string; version?: string; applicationId?: ApplicationScopeFilter },
    context: ActiveContext
  ): Promise<PaginatedResponse<ApiShareRequest>> {
    return requestJson(withQuery('/share-reviews', {
      applicationId: applicationScopeParam(filters.applicationId ?? 'ALL'),
      page: filters.page,
      limit: filters.limit,
      search: filters.search,
      status: filters.status,
      submittedBy: filters.submittedBy,
      version: filters.version,
    }), { context });
  },

  getShareReview(id: string, context: ActiveContext): Promise<ApiShareRequest> {
    return requestJson(`/share-reviews/${encodeURIComponent(id)}`, { context });
  },

  approveShareReview(id: string, consumers: ApiVersionConsumer[], rowVersion: string, context: ActiveContext): Promise<ApiShareRequest> {
    return requestJson(`/share-reviews/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      context,
      body: { consumers, rowVersion },
    });
  },

  returnShareReview(id: string, reason: string, rowVersion: string, context: ActiveContext): Promise<ApiShareRequest> {
    return requestJson(`/share-reviews/${encodeURIComponent(id)}/return`, {
      method: 'POST',
      context,
      body: { reason, rowVersion },
    });
  },

  getConsumerCandidates(context: ActiveContext): Promise<ApiConsumerCandidate[]> {
    return requestJson('/consumer-candidates', { context });
  },

  getRepository(
    filters: { page: number; limit: number; search?: string; applicationId?: ApplicationScopeFilter },
    context: ActiveContext
  ): Promise<PaginatedResponse<ApiRepositoryItem>> {
    return requestJson(withQuery('/repository', {
      applicationId: applicationScopeParam(filters.applicationId ?? 'ALL'),
      page: filters.page,
      limit: filters.limit,
      search: filters.search,
    }), { context });
  },

  getRepositoryVersions(apiId: string, context: ActiveContext): Promise<ApiRepositoryItem[]> {
    return requestJson(`/repository/${encodeURIComponent(apiId)}/versions`, { context });
  },

  getRepositoryVersion(apiId: string, version: string, context: ActiveContext): Promise<ApiRepositoryItem> {
    return requestJson(`/repository/${encodeURIComponent(apiId)}/versions/${encodeURIComponent(version)}`, { context });
  },

  addRepositoryVersionToConsole(apiId: string, version: string, collectionId: string | undefined, context: ActiveContext): Promise<{ reference: ApiConsoleReference; request: ApiRequestDefinition }> {
    return requestJson(`/repository/${encodeURIComponent(apiId)}/versions/${encodeURIComponent(version)}/add-to-console`, {
      method: 'POST',
      context,
      body: { collectionId },
    });
  },

  markRepositoryVersionViewed(apiId: string, version: string, context: ActiveContext): Promise<{ viewedAt?: string }> {
    return requestJson(`/repository/${encodeURIComponent(apiId)}/versions/${encodeURIComponent(version)}/mark-viewed`, {
      method: 'POST',
      context,
      body: {},
    });
  },

  getReferences(context: ActiveContext): Promise<ApiConsoleReference[]> {
    return requestJson('/references', { context });
  },

  removeReference(referenceId: string, context: ActiveContext): Promise<ApiConsoleReference> {
    return requestJson(`/references/${encodeURIComponent(referenceId)}`, {
      method: 'DELETE',
      context,
      body: {},
    });
  },

  updateConsumers(apiId: string, version: string, consumers: ApiVersionConsumer[], context: ActiveContext): Promise<ApiVersionConsumer[]> {
    return requestJson(`/shared-apis/${encodeURIComponent(apiId)}/versions/${encodeURIComponent(version)}/consumers`, {
      method: 'PUT',
      context,
      body: { consumers },
    });
  },

  getApiUsageReport(
    filters: {
      page: number;
      limit: number;
      applicationId?: ApplicationScopeFilter;
      apiId?: string;
      version?: string;
      userId?: string;
      role?: string;
      eventType?: string;
      dateFrom?: string;
      dateTo?: string;
    },
    context: ActiveContext
  ): Promise<ApiUsageReport> {
    return requestJson(withQuery('/reports/api-usage', {
      applicationId: applicationScopeParam(filters.applicationId ?? 'ALL'),
      page: filters.page,
      limit: filters.limit,
      apiId: filters.apiId,
      version: filters.version,
      userId: filters.userId,
      role: filters.role,
      eventType: filters.eventType,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    }), { context });
  },

  validateCoreRequest(requestOrId: string | ApiRequestDefinition | NormalizedApiRequest, context?: ActiveContext): Promise<CoreValidationResult> {
    if (typeof requestOrId === 'string') {
      return requestJson(`/requests/${encodeURIComponent(requestOrId)}/validate-core`, { method: 'POST', context });
    }
    return requestJson('/validate-core', {
      method: 'POST',
      context,
      body: { request: requestOrId },
    });
  },

  executeRequest(
    requestId: string,
    context: ActiveContext,
    options?: {
      environmentId?: string;
      executionMode?: ApiExecutionMode;
      productionCommandConfirmed?: boolean;
      businessJustification?: string;
      executionVariables?: Record<string, string>;
    }
  ): Promise<ApiRequestExecution> {
    return requestJson(`/requests/${encodeURIComponent(requestId)}/execute`, {
      method: 'POST',
      context,
      body: { options: options || {} },
    });
  },

  cancelExecution(executionId: string, context: ActiveContext): Promise<ApiRequestExecution | null> {
    return requestJson(`/executions/${encodeURIComponent(executionId)}/cancel`, {
      method: 'POST',
      context,
      body: {},
    });
  },

  getExecution(executionId: string, context?: ActiveContext): Promise<ApiRequestExecution | null> {
    return requestJson(`/executions/${encodeURIComponent(executionId)}`, { context });
  },

  getExecutionHistory(requestId: string, context?: ActiveContext): Promise<ApiRequestExecution[]> {
    return requestJson(`/requests/${encodeURIComponent(requestId)}/executions`, { context });
  },

  async exportCurl(requestId: string, dialect: ApiExportDialect, options?: { exposeSecrets?: boolean; context?: ActiveContext }): Promise<string> {
    const response = await requestJson<{ value: string }>(`/requests/${encodeURIComponent(requestId)}/export-curl`, {
      method: 'POST',
      context: options?.context,
      body: { dialect, exposeSecrets: options?.exposeSecrets },
    });
    return response.value;
  },

  addManualResponse(
    requestId: string,
    data: {
      statusCode: number;
      headersText: string;
      body: string;
      claimedEnvironmentId: string;
      source: string;
      reason: string;
    },
    context: ActiveContext
  ): Promise<ApiManualResponseExample> {
    return requestJson(`/requests/${encodeURIComponent(requestId)}/manual-responses`, {
      method: 'POST',
      context,
      body: { data },
    });
  },

  getManualResponses(requestId: string, context?: ActiveContext): Promise<ApiManualResponseExample[]> {
    return requestJson(`/requests/${encodeURIComponent(requestId)}/manual-responses`, { context });
  },

  generateDocumentationPreview(requestId: string, context: ActiveContext): Promise<ApiDocumentationResult> {
    return requestJson(`/requests/${encodeURIComponent(requestId)}/documentation/preview`, {
      method: 'POST',
      context,
      body: {},
    });
  },

  generateDocumentationFinal(requestId: string, context: ActiveContext): Promise<ApiDocumentationResult> {
    return requestJson(`/requests/${encodeURIComponent(requestId)}/documentation/final`, {
      method: 'POST',
      context,
      body: {},
    });
  },

  getEffectiveRequest(requestId: string, environmentId?: string, executionMode?: ApiExecutionMode, context?: ActiveContext): Promise<ApiEffectiveRequestSnapshot | null> {
    return requestJson(withQuery(`/requests/${encodeURIComponent(requestId)}/effective-request`, {
      environmentId,
      executionMode,
    }), { context });
  },

  runParserSelfCheck(): Promise<ParserSelfCheckResult> {
    return requestJson('/self-check');
  },
};
