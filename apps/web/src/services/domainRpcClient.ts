type ServiceObject = Record<string, unknown>;

const metaEnv = import.meta.env ?? {};
const DOMAIN_RPC_BASE = (metaEnv.VITE_DOMAIN_API_BASE_URL || '/api/domain').replace(/\/$/, '');
const DOMAIN_API_MODE = metaEnv.VITE_DOMAIN_API_MODE || 'backend';
const FALLBACK_COOLDOWN_MS = Number(metaEnv.VITE_DOMAIN_RPC_FALLBACK_COOLDOWN_MS || 5000);
const inFlightReadRequests = new Map<string, Promise<unknown>>();

const READ_OPERATION_POLICIES = new Set([
  'testRequestApi.getAll',
  'testRequestApi.getVisibleForRole',
  'testRequestApi.getById',
  'testRequestApi.getPendingForReview',
  'testRequestApi.getByRequester',
  'testRequestApi.getByAssignee',
  'requirementApi.getAll',
  'requirementApi.getById',
  'requirementApi.getIncomplete',
  'flowApi.getByRequirement',
  'testCaseApi.getAll',
  'testCaseApi.getVisibleForRole',
  'testCaseApi.getById',
  'testCaseApi.getByTestRequest',
  'testRunApi.getAll',
  'testRunApi.getVisibleForRole',
  'testRunApi.getById',
  'testRunApi.getByTestRequest',
  'testRunApi.getPending',
  'bugApi.getAll',
  'bugApi.getVisibleForRole',
  'bugApi.getById',
  'bugApi.getByAssignee',
  'bugApi.getReadyForRetest',
  'bugApi.getCriticalOpen',
  'bugApi.getCriticalOpenVisible',
  'retestTaskApi.getAll',
  'retestTaskApi.getVisibleForRole',
  'retestTaskApi.getByBug',
  'runIssueApi.getAll',
  'runIssueApi.getOpen',
  'checklistApi.getAll',
  'checklistApi.getById',
  'checklistApi.getPending',
  'dashboardApi.getStats',
  'playwrightApi.getAll',
  'playwrightApi.getById',
  'playwrightApi.getTestFiles',
  'playwrightApi.discoverFolders',
  'playwrightApi.discoverFiles',
  'releasePublishApi.getAll',
  'releasePublishApi.getById',
  'releasePublishApi.getByPrimaryTestRequest',
  'releasePublishApi.getPrimaryRequestCandidates',
  'releasePublishApi.getEligiblePrimaryRequests',
  'releasePublishApi.getRelatedCandidates',
  'releasePublishApi.getEvidence',
  'releasePublishApi.getCriticalOpenBugs',
  'releasePublishApi.getPendingDecision',
  'releasePublishApi.getPendingQAReview',
  'versionHistoryApi.getAll',
  'versionHistoryApi.getById',
  'versionHistoryApi.getByPrimaryTestRequest',
  'versionHistoryApi.getPrimaryRequestCandidates',
  'versionHistoryApi.getEligiblePrimaryRequests',
  'versionHistoryApi.getRelatedCandidates',
  'versionHistoryApi.getEvidence',
  'versionHistoryApi.getCriticalOpenBugs',
  'commandTraceApi.getAll',
  'commandTraceApi.getByCorrelationId',
  'commandTraceApi.getByIdempotencyKey',
  'auditLogApi.getAll',
  'auditLogApi.getByEntity',
  'commentApi.getByEntity',
  'notificationApi.getByUser',
  'notificationApi.getUnreadCount',
  'notificationApi.getOutbox',
  'attachmentApi.getByEntity',
  'userApi.getAll',
  'userApi.getById',
  'userApi.lookupByNationalCode',
  'userApi.getDevelopers',
  'userApi.getQASpecialists',
  'systemSettingsApi.getIntegrationSettings',
  'workflowPolicyApi.getAll',
  'workflowPolicyApi.getForApplication',
  'applicationApi.getAll',
  'applicationApi.getById',
  'securityChecklistApi.getById',
  'securityChecklistApi.getTemplate',
  'reportsApi.getSystemOverview',
  'reportsApi.getTestRequestReport',
  'reportsApi.getQualityHealth',
  'reportsApi.getDeveloperPerformance',
  'reportsApi.getDeveloperBugFixReport',
  'reportsApi.getRequirementReport',
  'reportsApi.getFlowCoverage',
  'reportsApi.getTestCaseReport',
  'reportsApi.getTestRunReport',
  'reportsApi.getChecklistReport',
  'reportsApi.getReleaseReport',
  'reportsApi.getEmergencyPublishReport',
  'reportsApi.getUsersRolesReport',
  'reportsApi.getAuditReport',
  'reportsApi.getAttachmentReport',
  'reportsApi.getPlaywrightReport',
  'reportsApi.getProductQualityOverview',
  'reportsApi.getOpenBugsList',
  'reportsApi.getCommentReport',
  'reportsApi.getTraceabilityReport',
]);

let circuitOpenedUntil = 0;
let recoveryProbe: Promise<unknown> | null = null;

function shouldUseDomainBackend(): boolean {
  return typeof window !== 'undefined' && DOMAIN_API_MODE !== 'mock';
}

function isCircuitOpen(): boolean {
  return DOMAIN_API_MODE !== 'strict' && Date.now() < circuitOpenedUntil;
}

function isHalfOpenProbeInProgress(): boolean {
  return DOMAIN_API_MODE !== 'strict' && circuitOpenedUntil > 0 && Date.now() >= circuitOpenedUntil && recoveryProbe !== null;
}

function openFallbackCircuit(): void {
  if (DOMAIN_API_MODE !== 'strict' && FALLBACK_COOLDOWN_MS > 0) {
    circuitOpenedUntil = Date.now() + FALLBACK_COOLDOWN_MS;
  }
}

function isBackendAvailabilityFailure(response: Response): boolean {
  return response.status === 0 || response.status === 502 || response.status === 503 || response.status === 504;
}

function isTransportError(error: unknown): boolean {
  return error instanceof TypeError || error instanceof DOMException;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function normalizeForFingerprint(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeForFingerprint);
  }

  if (isPlainObject(value)) {
    return Object.keys(value).sort().reduce<Record<string, unknown>>((normalized, key) => {
      const child = value[key];
      if (typeof child === 'undefined' || typeof child === 'function' || typeof child === 'symbol') {
        throw new Error(`Unsupported RPC argument value for fingerprint: ${key}`);
      }
      normalized[key] = normalizeForFingerprint(child);
      return normalized;
    }, {});
  }

  throw new Error(`Unsupported RPC argument type for fingerprint: ${typeof value}`);
}

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function readActiveContextSnapshot(): Record<string, unknown> | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    const persisted = JSON.parse(window.localStorage.getItem('utms-auth') || '{}') as {
      state?: { activeContext?: Record<string, unknown> | null };
    };
    const context = persisted.state?.activeContext;
    if (!context) return undefined;
    return {
      contextId: context.contextId,
      userId: context.userId,
      assignmentId: context.assignmentId,
      assignmentIds: context.assignmentIds,
      applicationId: context.applicationId,
      scopeApplicationIds: context.scopeApplicationIds,
      role: context.role,
      scope: context.scope,
      automatedTestsEnabled: context.automatedTestsEnabled ?? null,
    };
  } catch {
    return undefined;
  }
}

function contextHeaders(): Record<string, string> {
  const context = readActiveContextSnapshot();
  if (!context) return {};
  return { 'x-utms-context': encodeBase64Utf8(JSON.stringify(context)) };
}

function makeReadRequestKey(service: string, method: string, args: unknown[]): string | null {
  if (!READ_OPERATION_POLICIES.has(`${service}.${method}`)) return null;

  try {
    return JSON.stringify(normalizeForFingerprint({
      service,
      method,
      args,
      context: readActiveContextSnapshot() ?? null,
    }));
  } catch {
    return null;
  }
}

async function callDomainRpc<T>(service: string, method: string, args: unknown[]): Promise<T> {
  const response = await fetch(`${DOMAIN_RPC_BASE}/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...contextHeaders() },
    body: JSON.stringify({ service, method, args }),
  });

  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = payload?.error?.message || response.statusText || 'Domain API request failed.';
    const error = new Error(message);
    if (isBackendAvailabilityFailure(response)) {
      Object.assign(error, { backendUnavailable: true });
    }
    throw error;
  }

  return payload?.data as T;
}

function callDomainRpcSingleFlight<T>(service: string, method: string, args: unknown[]): Promise<T> {
  const key = makeReadRequestKey(service, method, args);
  if (!key) return callDomainRpc<T>(service, method, args);

  const existing = inFlightReadRequests.get(key);
  if (existing) return existing as Promise<T>;

  let trackedPromise: Promise<T>;
  trackedPromise = callDomainRpc<T>(service, method, args).finally(() => {
    if (inFlightReadRequests.get(key) === trackedPromise) {
      inFlightReadRequests.delete(key);
    }
  });
  inFlightReadRequests.set(key, trackedPromise);
  return trackedPromise;
}

export function createDomainRpcProxy<TService extends ServiceObject>(service: string, localService: TService): TService {
  return new Proxy(localService, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property !== 'string' || typeof value !== 'function') return value;
      const localMethod = value as (...args: unknown[]) => Promise<unknown>;

      return async (...args: unknown[]) => {
        if (!shouldUseDomainBackend()) {
          return localMethod.apply(target, args);
        }

        if (isCircuitOpen()) {
          return localMethod.apply(target, args);
        }

        if (isHalfOpenProbeInProgress()) {
          return localMethod.apply(target, args);
        }

        try {
          const backendCall = callDomainRpcSingleFlight(service, property, args);
          recoveryProbe = backendCall;
          const result = await backendCall;
          circuitOpenedUntil = 0;
          return result;
        } catch (error) {
          if (DOMAIN_API_MODE === 'strict') throw error;
          if (isTransportError(error) || (error as { backendUnavailable?: boolean }).backendUnavailable) {
            openFallbackCircuit();
          }
          return localMethod.apply(target, args);
        } finally {
          if (recoveryProbe) {
            recoveryProbe = null;
          }
        }
      };
    },
  });
}
