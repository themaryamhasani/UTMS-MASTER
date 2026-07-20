type ServiceObject = Record<string, unknown>;
interface DomainRpcProxyOptions {
  backendOnly?: boolean;
  backendRequiredMethods?: readonly string[];
}

const metaEnv = import.meta.env ?? {};
const DOMAIN_RPC_BASE = (metaEnv.VITE_DOMAIN_API_BASE_URL || '/api/domain').replace(/\/$/, '');
const DOMAIN_API_MODE = metaEnv.VITE_DOMAIN_API_MODE || 'backend';
const FALLBACK_COOLDOWN_MS = Number(metaEnv.VITE_DOMAIN_RPC_FALLBACK_COOLDOWN_MS || 5000);
const READ_RESPONSE_CACHE_TTL_MS = Number(metaEnv.VITE_DOMAIN_RPC_READ_CACHE_TTL_MS || 750);
const inFlightReadRequests = new Map<string, Promise<unknown>>();
const readResponseCache = new Map<string, { expiresAt: number; value: unknown }>();
const DATABASE_ONLY_SERVICES = new Set([
  'applicationApi',
  'userApi',
  'workflowPolicyApi',
]);

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
  'userApi.authenticate',
  'userApi.getAll',
  'userApi.getById',
  'userApi.getRoleAssignments',
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

function shouldUseDomainBackend(requiresBackend: boolean): boolean {
  return typeof window !== 'undefined' && (requiresBackend || DOMAIN_API_MODE !== 'mock');
}

function requiresBackend(
  service: string,
  method: string,
  options: DomainRpcProxyOptions
): boolean {
  return Boolean(
    options.backendOnly ||
    options.backendRequiredMethods?.includes(method) ||
    DATABASE_ONLY_SERVICES.has(service)
  );
}

function backendRequiredError(service: string, method: string): Error {
  return new Error(`${service}.${method} requires the PostgreSQL-backed domain API.`);
}

function isReadOperation(service: string, method: string): boolean {
  return READ_OPERATION_POLICIES.has(`${service}.${method}`);
}

function clearReadCacheAfterMutation(service: string, method: string): void {
  if (!isReadOperation(service, method)) {
    readResponseCache.clear();
  }
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
  if (!key) {
    readResponseCache.clear();
    return callDomainRpc<T>(service, method, args);
  }

  const cached = readResponseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.value as T);
  }
  if (cached) {
    readResponseCache.delete(key);
  }

  const existing = inFlightReadRequests.get(key);
  if (existing) return existing as Promise<T>;

  let trackedPromise: Promise<T>;
  trackedPromise = callDomainRpc<T>(service, method, args)
    .then(result => {
      if (READ_RESPONSE_CACHE_TTL_MS > 0) {
        readResponseCache.set(key, {
          expiresAt: Date.now() + READ_RESPONSE_CACHE_TTL_MS,
          value: result,
        });
      }
      return result;
    })
    .finally(() => {
      if (inFlightReadRequests.get(key) === trackedPromise) {
        inFlightReadRequests.delete(key);
      }
    });
  inFlightReadRequests.set(key, trackedPromise);
  return trackedPromise;
}

export function createDomainRpcProxy<TService extends ServiceObject>(
  service: string,
  localService: TService,
  options: DomainRpcProxyOptions = {}
): TService {
  return new Proxy(localService, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property !== 'string' || typeof value !== 'function') return value;
      const localMethod = value as (...args: unknown[]) => Promise<unknown>;

      return async (...args: unknown[]) => {
        const mustUseBackend = requiresBackend(service, property, options);

        if (!shouldUseDomainBackend(mustUseBackend)) {
          if (mustUseBackend) {
            throw backendRequiredError(service, property);
          }
          const result = await localMethod.apply(target, args);
          clearReadCacheAfterMutation(service, property);
          return result;
        }

        if (!mustUseBackend && isCircuitOpen()) {
          const result = await localMethod.apply(target, args);
          clearReadCacheAfterMutation(service, property);
          return result;
        }

        if (!mustUseBackend && isHalfOpenProbeInProgress()) {
          const result = await localMethod.apply(target, args);
          clearReadCacheAfterMutation(service, property);
          return result;
        }

        try {
          const backendCall = callDomainRpcSingleFlight(service, property, args);
          recoveryProbe = backendCall;
          const result = await backendCall;
          circuitOpenedUntil = 0;
          clearReadCacheAfterMutation(service, property);
          return result;
        } catch (error) {
          if (mustUseBackend || DOMAIN_API_MODE === 'strict') throw error;
          if (isTransportError(error) || (error as { backendUnavailable?: boolean }).backendUnavailable) {
            openFallbackCircuit();
          }
          const result = await localMethod.apply(target, args);
          clearReadCacheAfterMutation(service, property);
          return result;
        } finally {
          if (recoveryProbe) {
            recoveryProbe = null;
          }
        }
      };
    },
  });
}
