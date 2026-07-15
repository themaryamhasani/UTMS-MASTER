// ============================================
// UTMS - API Service Layer
// Local in-memory service implementation for frontend development.
// ============================================

import { v4 as uuidv4 } from 'uuid';
import type {
  TestRequest,
  Requirement,
  Flow,
  TestCase,
  TestRun,
  Bug,
  RetestTask,
  RunIssue,
  Checklist,
  PlaywrightRun,
  PlaywrightCdeRootKind,
  PlaywrightReport,
  PlaywrightReportFailure,
  PlaywrightReportTestItem,
  PlaywrightTestFile,
  PlaywrightTestFolder,
  ReleasePublish,
  AuditLog,
  Comment,
  Notification,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationOutboxItem,
  Attachment,
  User,
  Application,
  UserRole,
  AccessScope,
  UserRoleAssignment,
  CartableFilterParams,
  ApplicationScopeFilter,
  PaginatedResponse,
  DashboardStats,
  BugStatus,
  TestRunStatus,
  ReleasePublishStatus,
  QAQualityStatus,
  VersionHistoryDecision,
  VersionSnapshot,
  VersionHistoryEvidence,
  ChecklistResult,
  AttachmentType,
  EntityType,
  AuditAction,
  WorkflowCapability,
  CommandMetadata,
  CommandTrace,
  IntegrationAdapterConfig,
  IntegrationProvider,
  PlaywrightRunnerConfig,
  SystemIntegrationSettings,
} from '../types';
import {
  loadPersistedUtmsState,
  savePersistedUtmsState,
  schedulePersistedUtmsStateSave,
  type PersistedUtmsState,
} from './persistentStore';
import {
  mockTestRequests,
  mockRequirements,
  mockFlows,
  mockTestCases,
  mockTestRuns,
  mockBugs,
  mockRetestTasks,
  mockRunIssues,
  mockChecklists,
  mockPlaywrightRuns,
  mockReleasePublishes,
  mockAuditLogs,
  mockComments,
  mockNotifications,
  mockAttachments,
  mockUsers,
  mockApplications,
  mockUserRoleAssignments,
  getUserById,
  getApplicationById,
} from './seedData';
import {
  applyWorkflowPolicyToApplication,
  canRolePerformWorkflowCapability,
  getWorkflowPolicy,
  listWorkflowPolicies,
  setApplicationWorkflowPolicy,
} from './workflowPolicyStore';
import { isSemVer } from '../utils/semver';
import { DESCRIPTION_MAX_LENGTH, hasInvalidBuildNumber, isValidSystemUrl, validateRequestTitle } from '../utils/inputRules';
// UserRoleAssignment type is available via mockUserRoleAssignments

// Simulate API delay
const wait = (ms: number = 300) => new Promise<void>(resolve => setTimeout(resolve, ms));
const delay = async (ms: number = 300): Promise<void> => {
  await ensurePersistenceReady();
  await wait(ms);
  queuePersistenceAfterCurrentOperation();
};

function normalizeApplicationScope(scope: ApplicationScopeFilter): string[] | undefined {
  if (!scope || scope === 'ALL') return undefined;
  if (Array.isArray(scope)) return scope.length ? scope : undefined;
  if (scope.includes(',')) return scope.split(',').map(s => s.trim()).filter(Boolean);
  return [scope];
}

function matchesApplicationScope(applicationId: string | undefined, scope: ApplicationScopeFilter): boolean {
  const ids = normalizeApplicationScope(scope);
  return !ids || (!!applicationId && ids.includes(applicationId));
}

function filterByApplicationScope<T extends { applicationId?: string | undefined }>(
  data: T[],
  scope: ApplicationScopeFilter
): T[] {
  const ids = normalizeApplicationScope(scope);
  if (!ids) return [...data];
  return data.filter(item => !!item.applicationId && ids.includes(item.applicationId));
}

function requireAt<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`INDEX_OUT_OF_RANGE:${index}`);
  }
  return item;
}

function assertDescriptionLength(value: string | undefined | null, errorCode = 'DESCRIPTION_TOO_LONG') {
  if (value && value.length > DESCRIPTION_MAX_LENGTH) {
    throw new Error(errorCode);
  }
}

function assertBuildNumber(value: string | undefined | null) {
  if (hasInvalidBuildNumber(value)) {
    throw new Error('INVALID_BUILD_NUMBER');
  }
}

function assertSystemUrl(value: string | undefined | null) {
  if (!isValidSystemUrl(value)) {
    throw new Error('INVALID_SYSTEM_URL');
  }
}

function assertTestRequestTitle(value: string | undefined | null) {
  const error = validateRequestTitle(value || '');
  if (error) {
    throw new Error('INVALID_TEST_REQUEST_TITLE');
  }
}

function requirementHasFlow(requirementId: string): boolean {
  return flows.some(flow => flow.requirementId === requirementId);
}

// Mutable copies of mock data for CRUD operations
let testRequests = [...mockTestRequests];
let requirements = [...mockRequirements];
let flows = [...mockFlows];
let testCases = [...mockTestCases];
let testRuns = [...mockTestRuns];
let bugs = [...mockBugs];
let retestTasks = [...mockRetestTasks];
let runIssues = [...mockRunIssues];
let checklists = [...mockChecklists];
let playwrightRuns = [...mockPlaywrightRuns];
let playwrightTestFiles: PlaywrightTestFile[] = [];
let hiddenDiscoveredPlaywrightPaths = new Set<string>();
let releasePublishes = [...mockReleasePublishes];
let auditLogs = [...mockAuditLogs];
let comments = [...mockComments];
let notifications = [...mockNotifications];
let notificationOutbox: NotificationOutboxItem[] = [];
let attachments = [...mockAttachments];
let mutableApplications = mockApplications.map(applyWorkflowPolicyToApplication);
const playwrightTimers = new Map<string, ReturnType<typeof setTimeout>>();
const commandResultCache = new Map<string, unknown>();
let commandTraces: CommandTrace[] = [];
let systemIntegrationSettings: SystemIntegrationSettings = {
  playwright: {
    enabled: true,
    autoDiscovery: true,
    runnerId: 'runner-default',
    commandTemplate: 'npx playwright test {testFilePath}',
    defaultWorkingDirectory: '/repo',
    defaultTimeoutSeconds: 120,
    artifactRoot: '/object-storage/playwright',
    secretReference: 'secret/playwright/default',
    updatedAt: new Date().toISOString(),
  },
  adapters: [
    {
      provider: 'CDE',
      enabled: false,
      baseUrl: 'https://cde.example.local/api',
      credentialReference: 'secret/integrations/cde',
      syncDirection: 'PULL',
      lastHealthStatus: 'DISABLED',
      updatedAt: new Date().toISOString(),
    },
    {
      provider: 'FAVA',
      enabled: false,
      baseUrl: 'https://fava.example.local/api',
      credentialReference: 'secret/integrations/fava',
      syncDirection: 'BIDIRECTIONAL',
      lastHealthStatus: 'DISABLED',
      updatedAt: new Date().toISOString(),
    },
  ],
  updatedAt: new Date().toISOString(),
};

let persistenceReadyPromise: Promise<void> | null = null;
let persistenceHydrated = false;
let persistenceAutosaveStarted = false;

function replaceArrayContents<T>(target: T[], source: readonly T[]): void {
  target.splice(0, target.length, ...source);
}

function syncSeedDataCollections(): void {
  replaceArrayContents(mockTestRequests, testRequests);
  replaceArrayContents(mockRequirements, requirements);
  replaceArrayContents(mockFlows, flows);
  replaceArrayContents(mockTestCases, testCases);
  replaceArrayContents(mockTestRuns, testRuns);
  replaceArrayContents(mockBugs, bugs);
  replaceArrayContents(mockRetestTasks, retestTasks);
  replaceArrayContents(mockRunIssues, runIssues);
  replaceArrayContents(mockChecklists, checklists);
  replaceArrayContents(mockPlaywrightRuns, playwrightRuns);
  replaceArrayContents(mockReleasePublishes, releasePublishes);
  replaceArrayContents(mockAuditLogs, auditLogs);
  replaceArrayContents(mockComments, comments);
  replaceArrayContents(mockNotifications, notifications);
  replaceArrayContents(mockAttachments, attachments);
  replaceArrayContents(mockUsers, mutableUsers);
  replaceArrayContents(mockApplications, mutableApplications.map(applyWorkflowPolicyToApplication));
}

function currentPersistentState(): PersistedUtmsState {
  syncSeedDataCollections();

  return {
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    testRequests: [...testRequests],
    requirements: [...requirements],
    flows: [...flows],
    testCases: [...testCases],
    testRuns: [...testRuns],
    bugs: [...bugs],
    retestTasks: [...retestTasks],
    runIssues: [...runIssues],
    checklists: [...checklists],
    playwrightRuns: [...playwrightRuns],
    playwrightTestFiles: [...playwrightTestFiles],
    hiddenDiscoveredPlaywrightPaths: Array.from(hiddenDiscoveredPlaywrightPaths),
    releasePublishes: [...releasePublishes],
    auditLogs: [...auditLogs],
    comments: [...comments],
    notifications: [...notifications],
    notificationOutbox: [...notificationOutbox],
    attachments: [...attachments],
    users: [...mutableUsers],
    applications: mutableApplications.map(applyWorkflowPolicyToApplication),
    userRoleAssignments: [...mockUserRoleAssignments],
    commandTraces: [...commandTraces],
    systemIntegrationSettings: {
      ...systemIntegrationSettings,
      playwright: { ...systemIntegrationSettings.playwright },
      adapters: systemIntegrationSettings.adapters.map(adapter => ({ ...adapter })),
    },
    securityChecklistTemplate: securityChecklistTemplate.map(item => ({ ...item })),
    securityReviews: securityReviews.map(review => ({
      ...review,
      items: review.items.map(item => ({ ...item })),
    })),
  };
}

function applyPersistedState(persisted: PersistedUtmsState): void {
  const state: Partial<PersistedUtmsState> = persisted;

  testRequests = Array.isArray(state.testRequests) ? state.testRequests : testRequests;
  requirements = Array.isArray(state.requirements) ? state.requirements : requirements;
  flows = Array.isArray(state.flows) ? state.flows : flows;
  testCases = Array.isArray(state.testCases) ? state.testCases : testCases;
  testRuns = Array.isArray(state.testRuns) ? state.testRuns : testRuns;
  bugs = Array.isArray(state.bugs) ? state.bugs : bugs;
  retestTasks = Array.isArray(state.retestTasks) ? state.retestTasks : retestTasks;
  runIssues = Array.isArray(state.runIssues) ? state.runIssues : runIssues;
  checklists = Array.isArray(state.checklists) ? state.checklists : checklists;
  playwrightRuns = Array.isArray(state.playwrightRuns) ? state.playwrightRuns : playwrightRuns;
  playwrightTestFiles = Array.isArray(state.playwrightTestFiles) ? state.playwrightTestFiles : playwrightTestFiles;
  hiddenDiscoveredPlaywrightPaths = new Set(state.hiddenDiscoveredPlaywrightPaths ?? []);
  releasePublishes = Array.isArray(state.releasePublishes) ? state.releasePublishes : releasePublishes;
  auditLogs = Array.isArray(state.auditLogs) ? state.auditLogs : auditLogs;
  comments = Array.isArray(state.comments) ? state.comments : comments;
  notifications = Array.isArray(state.notifications) ? state.notifications : notifications;
  notificationOutbox = Array.isArray(state.notificationOutbox) ? state.notificationOutbox : notificationOutbox;
  attachments = Array.isArray(state.attachments) ? state.attachments : attachments;
  mutableUsers = Array.isArray(state.users) ? state.users : mutableUsers;

  if (Array.isArray(state.applications)) {
    state.applications.forEach(application => {
      if (!application.workflowPolicyId) return;
      try {
        setApplicationWorkflowPolicy(application.id, application.workflowPolicyId);
      } catch {
        // Ignore stale policy IDs from older browser state.
      }
    });
    mutableApplications = state.applications.map(applyWorkflowPolicyToApplication);
  }

  if (Array.isArray(state.userRoleAssignments)) {
    replaceArrayContents(mockUserRoleAssignments, state.userRoleAssignments);
  }

  if (Array.isArray(state.commandTraces)) {
    commandTraces = state.commandTraces;
  }

  if (state.systemIntegrationSettings) {
    systemIntegrationSettings = state.systemIntegrationSettings;
  }

  if (Array.isArray(state.securityChecklistTemplate)) {
    securityChecklistTemplate = state.securityChecklistTemplate;
  }

  if (Array.isArray(state.securityReviews)) {
    securityReviews = state.securityReviews;
  }

  syncSeedDataCollections();
}

function scheduleCurrentStatePersistence(): void {
  if (!persistenceHydrated) return;
  schedulePersistedUtmsStateSave(currentPersistentState);
}

function queuePersistenceAfterCurrentOperation(): void {
  if (!persistenceHydrated || typeof window === 'undefined') return;
  window.setTimeout(scheduleCurrentStatePersistence, 0);
}

function startPersistenceAutosave(): void {
  if (persistenceAutosaveStarted || typeof window === 'undefined') return;

  persistenceAutosaveStarted = true;
  window.setInterval(scheduleCurrentStatePersistence, 1000);
  window.document.addEventListener('visibilitychange', () => {
    if (window.document.visibilityState === 'hidden') {
      void savePersistedUtmsState(currentPersistentState());
    }
  });
  window.addEventListener('pagehide', () => {
    void savePersistedUtmsState(currentPersistentState());
  });
}

async function hydratePersistentState(): Promise<void> {
  const persisted = await loadPersistedUtmsState();
  if (persisted) {
    applyPersistedState(persisted);
  } else {
    syncSeedDataCollections();
  }
  persistenceHydrated = true;
  startPersistenceAutosave();
  scheduleCurrentStatePersistence();
}

function ensurePersistenceReady(): Promise<void> {
  if (!persistenceReadyPromise) {
    persistenceReadyPromise = hydratePersistentState();
  }
  return persistenceReadyPromise;
}

export async function ensureDataPersistenceReady(): Promise<void> {
  await ensurePersistenceReady();
}

export function flushCurrentDataState(): void {
  if (!persistenceHydrated) return;
  syncSeedDataCollections();
  scheduleCurrentStatePersistence();
}

// Helper for pagination
function paginate<T>(
  data: T[],
  page: number,
  limit: number
): PaginatedResponse<T> {
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginatedData = data.slice(start, end);
  
  return {
    data: paginatedData,
    total: data.length,
    page,
    limit,
    totalPages: Math.ceil(data.length / limit),
  };
}

type AuditableEntityType = EntityType | 'USER' | 'APPLICATION' | 'ROLE_ASSIGNMENT';
const AUDIT_ENTITY_TYPES: readonly AuditableEntityType[] = [
  'TEST_REQUEST',
  'REQUIREMENT',
  'FLOW',
  'TEST_CASE',
  'TEST_RUN',
  'BUG',
  'RETEST_TASK',
  'RUN_ISSUE',
  'CHECKLIST',
  'VERSION_HISTORY',
  'RELEASE_PUBLISH',
  'PLAYWRIGHT_RUN',
  'PLAYWRIGHT_TEST_FILE',
  'USER',
  'APPLICATION',
  'ROLE_ASSIGNMENT',
];
const AUDIT_ACTIONS: readonly AuditAction[] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'STATUS_CHANGE',
  'ASSIGN',
  'SUBMIT',
  'REVIEW',
  'APPROVE',
  'REJECT',
  'CANCEL',
  'FINALIZE',
  'UNLOCK',
  'PUBLISH',
  'EMERGENCY_PUBLISH',
  'ROLE_CHANGE',
  'LOGIN',
  'LOGOUT',
  'CONTEXT_SWITCH',
];
const CHECKLIST_RESULTS: readonly ChecklistResult[] = ['PASS', 'FAIL', 'PARTIAL', 'NOT_TESTED'];
const SECURITY_REVIEW_RESULTS = [...CHECKLIST_RESULTS, 'N_A'] as const;
type SecurityReviewItemResult = typeof SECURITY_REVIEW_RESULTS[number];

function ensureAuditableEntityType(value: string): AuditableEntityType {
  if (AUDIT_ENTITY_TYPES.includes(value as AuditableEntityType)) return value as AuditableEntityType;
  throw new Error(`INVALID_AUDIT_ENTITY_TYPE:${value}`);
}

function ensureAuditAction(value: string): AuditAction {
  if (AUDIT_ACTIONS.includes(value as AuditAction)) return value as AuditAction;
  throw new Error(`INVALID_AUDIT_ACTION:${value}`);
}

function ensureChecklistResult(value: string): ChecklistResult {
  if (CHECKLIST_RESULTS.includes(value as ChecklistResult)) return value as ChecklistResult;
  throw new Error(`INVALID_CHECKLIST_RESULT:${value}`);
}

function ensureSecurityReviewItemResult(value: string): SecurityReviewItemResult {
  if (SECURITY_REVIEW_RESULTS.includes(value as SecurityReviewItemResult)) return value as SecurityReviewItemResult;
  throw new Error(`INVALID_SECURITY_REVIEW_RESULT:${value}`);
}

function getDynamicField(item: object, key: string): unknown {
  return (item as Record<string, unknown>)[key];
}

function getDateFilterValue(item: object): string | number | Date {
  const value = getDynamicField(item, 'createdAt');
  return typeof value === 'string' || typeof value === 'number' || value instanceof Date ? value : '';
}

// Helper for filtering
function applyFilters<T extends object>(
  data: T[],
  filters: CartableFilterParams
): T[] {
  let filtered = [...data];

  if (filters.search) {
    const search = filters.search.toLowerCase();
    filtered = filtered.filter(item =>
      Object.values(item as Record<string, unknown>).some(val =>
        String(val).toLowerCase().includes(search)
      )
    );
  }

  if (filters.status) {
    filtered = filtered.filter(item => getDynamicField(item, 'status') === filters.status);
  }

  if (filters.priority) {
    filtered = filtered.filter(item => getDynamicField(item, 'priority') === filters.priority);
  }

  if (filters.assigneeId) {
    filtered = filtered.filter(item => getDynamicField(item, 'assigneeId') === filters.assigneeId);
  }

  if (filters.requesterId) {
    filtered = filtered.filter(item => getDynamicField(item, 'requesterId') === filters.requesterId);
  }

  if (filters.applicationId) {
    filtered = filtered.filter(item => getDynamicField(item, 'applicationId') === filters.applicationId);
  }

  if (filters.dateFrom) {
    filtered = filtered.filter(item => 
      new Date(getDateFilterValue(item)) >= new Date(filters.dateFrom!)
    );
  }

  if (filters.dateTo) {
    filtered = filtered.filter(item =>
      new Date(getDateFilterValue(item)) <= new Date(filters.dateTo!)
    );
  }

  // Sorting
  if (filters.sortBy) {
    filtered.sort((a, b) => {
      const aVal = getDynamicField(a, filters.sortBy!);
      const bVal = getDynamicField(b, filters.sortBy!);
      const order = filters.sortOrder === 'desc' ? -1 : 1;
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * order;
      }
      return String(aVal ?? '').localeCompare(String(bVal ?? '')) * order;
    });
  }

  return filtered;
}

type ResolvedCommandMetadata = {
  commandName: string;
  idempotencyKey?: string | undefined;
  correlationId: string;
  requestedAt: string;
  source: NonNullable<CommandMetadata['source']>;
};

function resolveCommandMetadata(
  commandName: string,
  metadata?: CommandMetadata,
  fallbackIdempotencyKey?: string
): ResolvedCommandMetadata {
  return {
    commandName,
    idempotencyKey: metadata?.idempotencyKey?.trim() || fallbackIdempotencyKey,
    correlationId: metadata?.correlationId?.trim() || `${commandName}:${uuidv4()}`,
    requestedAt: metadata?.requestedAt || new Date().toISOString(),
    source: metadata?.source || 'UI',
  };
}

function commandCacheKey(metadata: ResolvedCommandMetadata): string | undefined {
  return metadata.idempotencyKey
    ? `${metadata.commandName}:${metadata.idempotencyKey}`
    : undefined;
}

function getIdempotentResult<T>(metadata: ResolvedCommandMetadata): T | undefined {
  const key = commandCacheKey(metadata);
  if (!key || !commandResultCache.has(key)) return undefined;
  return commandResultCache.get(key) as T;
}

function rememberIdempotentResult<T>(metadata: ResolvedCommandMetadata, result: T): T {
  const key = commandCacheKey(metadata);
  if (key && result !== null && result !== undefined) {
    commandResultCache.set(key, result);
  }
  return result;
}

function createCommandTrace(
  metadata: ResolvedCommandMetadata,
  status: CommandTrace['status'],
  userId?: string,
  applicationId?: string,
  entityType?: CommandTrace['entityType'],
  entityId?: string
): CommandTrace {
  const now = new Date().toISOString();
  const existingTrace = metadata.idempotencyKey
    ? commandTraces.find(trace =>
        trace.commandName === metadata.commandName &&
        trace.idempotencyKey === metadata.idempotencyKey &&
        trace.status === 'COMPLETED'
      )
    : undefined;

  const trace: CommandTrace = {
    id: uuidv4(),
    commandName: metadata.commandName,
    entityType,
    entityId,
    applicationId,
    userId,
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    source: metadata.source,
    status,
    createdAt: status === 'REPLAYED' ? existingTrace?.createdAt || metadata.requestedAt : now,
    replayedAt: status === 'REPLAYED' ? now : undefined,
  };
  commandTraces.unshift(trace);
  return trace;
}

function commandAuditMetadata(
  metadata?: ResolvedCommandMetadata,
  extra?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!metadata && !extra) return undefined;
  return {
    ...(extra || {}),
    ...(metadata ? {
      commandName: metadata.commandName,
      idempotencyKey: metadata.idempotencyKey,
      correlationId: metadata.correlationId,
      commandSource: metadata.source,
      requestedAt: metadata.requestedAt,
    } : {}),
  };
}

function commandRecordMetadata(metadata: ResolvedCommandMetadata): CommandMetadata {
  return {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    requestedAt: metadata.requestedAt,
    source: metadata.source,
  };
}

// Create audit log helper
function createAuditLog(
  userId: string,
  applicationId: string | undefined,
  entityType: string,
  entityId: string,
  action: string,
  previousValue?: unknown,
  newValue?: unknown,
  metadata?: Record<string, unknown>
) {
  const log: AuditLog = {
    id: uuidv4(),
    userId,
    user: getUserById(userId),
    applicationId,
    application: applicationId ? getApplicationById(applicationId) : undefined,
    entityType: ensureAuditableEntityType(entityType),
    entityId,
    action: ensureAuditAction(action),
    previousValue: previousValue ? JSON.stringify(previousValue) : undefined,
    newValue: newValue ? JSON.stringify(newValue) : undefined,
    metadata,
    createdAt: new Date().toISOString(),
  };
  auditLogs.unshift(log);
  return log;
}

function userHasRole(userId: string, roles: UserRole[], applicationId?: string): boolean {
  return mockUserRoleAssignments.some(a =>
    a.userId === userId &&
    a.isActive &&
    roles.includes(a.role) &&
    (!applicationId || a.scope === 'APP' || (a.applicationIds || [a.applicationId]).includes(applicationId))
  );
}

function isActiveDeveloperForApplication(userId: string | undefined, applicationId: string): boolean {
  if (!userId || !applicationId) return false;
  const user = mockUsers.find(u => u.id === userId);
  if (!user?.isActive) return false;
  return mockUserRoleAssignments.some(a =>
    a.userId === userId &&
    a.isActive &&
    a.role === 'DEVELOPER' &&
    (a.scope === 'APP' || (a.applicationIds || [a.applicationId]).includes(applicationId))
  );
}

function canActorUseWorkflowCapability(
  actorRole: UserRole | undefined,
  capability: WorkflowCapability,
  applicationId: string
): boolean {
  return !actorRole || canRolePerformWorkflowCapability(actorRole, capability, applicationId);
}

const DEFAULT_NOTIFICATION_CHANNELS: NotificationChannel[] = ['IN_APP', 'EMAIL'];

function normalizeNotificationChannels(channels?: NotificationChannel[]): NotificationChannel[] {
  const selected = channels?.length ? channels : DEFAULT_NOTIFICATION_CHANNELS;
  return Array.from(new Set(selected));
}

function refreshNotificationDeliveryStatus(notificationId: string): void {
  const notification = notifications.find(n => n.id === notificationId);
  if (!notification) return;

  const deliveries = notificationOutbox.filter(item => item.notificationId === notificationId);
  if (deliveries.length === 0) {
    notification.deliveryStatus = 'QUEUED';
    return;
  }

  if (deliveries.every(item => item.status === 'DELIVERED')) {
    notification.deliveryStatus = 'DELIVERED';
    const deliveredAt = deliveries
      .map(item => item.deliveredAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .pop();
    notification.deliveredAt = deliveredAt;
    return;
  }

  const status: NotificationDeliveryStatus = deliveries.some(item => item.status === 'FAILED') ? 'FAILED' : 'QUEUED';
  notification.deliveryStatus = status;
}

function processNotificationOutbox(limit = 25, userId?: string): NotificationOutboxItem[] {
  const queuedItems = notificationOutbox
    .filter(item => item.status === 'QUEUED' && (!userId || item.userId === userId))
    .slice(0, limit);

  queuedItems.forEach(item => {
    const notification = notifications.find(n => n.id === item.notificationId);
    if (!notification) {
      item.status = 'FAILED';
      item.retryCount += 1;
      item.lastError = 'NOTIFICATION_NOT_FOUND';
      refreshNotificationDeliveryStatus(item.notificationId);
      return;
    }

    item.status = 'DELIVERED';
    item.deliveredAt = new Date().toISOString();
    item.lastError = undefined;
    refreshNotificationDeliveryStatus(item.notificationId);
  });

  return queuedItems;
}

function hydrateLegacyNotificationDeliveryState(userId?: string): void {
  notifications
    .filter(notification => !userId || notification.userId === userId)
    .forEach(notification => {
      if (!notification.channels) {
        notification.channels = ['IN_APP'];
      }
      if (!notification.deliveryStatus) {
        notification.deliveryStatus = 'DELIVERED';
        notification.deliveredAt = notification.createdAt;
      }
    });
}

function createNotification(
  userId: string | undefined,
  title: string,
  message: string,
  type: Notification['type'],
  entityType?: Notification['entityType'],
  entityId?: string,
  channels?: NotificationChannel[],
  correlationId?: string
): Notification | null {
  if (!userId) return null;
  const now = new Date().toISOString();
  const selectedChannels = normalizeNotificationChannels(channels);
  const resolvedCorrelationId = correlationId || `${entityType || 'NOTIFICATION'}:${entityId || uuidv4()}`;
  const notification: Notification = {
    id: uuidv4(),
    userId,
    title,
    message,
    type,
    entityType,
    entityId,
    channels: selectedChannels,
    deliveryStatus: 'QUEUED',
    correlationId: resolvedCorrelationId,
    isRead: false,
    createdAt: now,
  };
  notifications.unshift(notification);

  selectedChannels.forEach(channel => {
    notificationOutbox.unshift({
      id: uuidv4(),
      notificationId: notification.id,
      userId,
      channel,
      status: 'QUEUED',
      retryCount: 0,
      correlationId: resolvedCorrelationId,
      createdAt: now,
    });
  });

  processNotificationOutbox(selectedChannels.length, userId);
  return notification;
}

function notifyRoles(
  applicationId: string,
  roles: UserRole[],
  title: string,
  message: string,
  type: Notification['type'],
  entityType?: Notification['entityType'],
  entityId?: string,
  channels?: NotificationChannel[],
  correlationId?: string
) {
  const userIds = Array.from(new Set(
    mockUserRoleAssignments
      .filter(a =>
        a.isActive &&
        roles.includes(a.role) &&
        (a.scope === 'APP' || (a.applicationIds || [a.applicationId]).includes(applicationId))
      )
      .map(a => a.userId)
  ));
  userIds.forEach(userId => createNotification(
    userId,
    title,
    message,
    type,
    entityType,
    entityId,
    channels,
    correlationId || `${applicationId}:${entityType || 'NOTIFICATION'}:${entityId || title}`
  ));
}

function hydrateTestRequest(tr: TestRequest): TestRequest {
  const generatedRequirements = requirements.filter(requirement => requirement.testRequestId === tr.id);
  const selectedRequirementIds = Array.from(new Set([
    ...(tr.selectedRequirementIds || []),
    ...generatedRequirements.map(requirement => requirement.id),
    ...(tr.requirementId ? [tr.requirementId] : []),
  ]));
  return {
    ...tr,
    selectedRequirementIds,
    requester: getUserById(tr.requesterId),
    assignee: tr.assigneeId ? getUserById(tr.assigneeId) : undefined,
    requirement: tr.requirementId
      ? requirements.find(r => r.id === tr.requirementId)
      : generatedRequirements[0] || tr.requirement,
  };
}

function getVisibleTestRequestsForRole(
  data: TestRequest[],
  userId: string,
  role: UserRole
): TestRequest[] {
  if (role === 'DEVELOPER') {
    return data.filter(tr => tr.requesterId === userId);
  }
  if (role === 'QA_SPECIALIST') {
    return data.filter(tr => tr.assigneeId === userId && !['DRAFT', 'CANCELLED'].includes(tr.status));
  }
  if (['QA_LEAD', 'TECH_LEAD', 'PRODUCT_OWNER', 'BA'].includes(role)) {
    return data.filter(tr => !['DRAFT', 'CANCELLED'].includes(tr.status));
  }
  return data;
}

function getAssignedTestRequestIdsForUser(userId: string): string[] {
  return testRequests
    .filter(tr => tr.assigneeId === userId && !['DRAFT', 'CANCELLED'].includes(tr.status))
    .map(tr => tr.id);
}

function isTestRequestAssignedToUser(testRequestId: string | undefined, userId: string): boolean {
  if (!testRequestId) return false;
  return getAssignedTestRequestIdsForUser(userId).includes(testRequestId);
}

function canDeveloperAccessBug(bug: Bug, userId: string): boolean {
  return bug.assigneeId === userId;
}

function getVisibleBugsForRole(data: Bug[], userId: string, role: UserRole): Bug[] {
  if (role === 'DEVELOPER') {
    return data.filter(b => canDeveloperAccessBug(b, userId) && b.status !== 'CLOSED');
  }
  return data;
}

function hydrateBug(bug: Bug): Bug {
  const run = testRuns.find(r => r.id === bug.testRunId);
  return {
    ...bug,
    assignee: bug.assigneeId ? getUserById(bug.assigneeId) : undefined,
    reportedBy: getUserById(bug.reportedById),
    testRun: run ? hydrateTestRun(run) : undefined,
  };
}

function hydrateTestRun(run: TestRun): TestRun {
  return {
    ...run,
    testCase: testCases.find(tc => tc.id === run.testCaseId),
    previousRun: run.previousRunId ? testRuns.find(r => r.id === run.previousRunId) : undefined,
    executedBy: getUserById(run.executedById),
  };
}

function getVisibleTestRunsForRole(data: TestRun[], userId: string, role: UserRole): TestRun[] {
  if (role === 'QA_SPECIALIST') {
    const assignedRequestIds = getAssignedTestRequestIdsForUser(userId);
    return data.filter(tr => assignedRequestIds.includes(tr.testRequestId));
  }
  if (role !== 'DEVELOPER') return data;
  const ownRequestIds = testRequests.filter(tr => tr.requesterId === userId).map(tr => tr.id);
  const assignedBugRunIds = bugs.filter(b => b.assigneeId === userId).map(b => b.testRunId);
  return data.filter(tr => ownRequestIds.includes(tr.testRequestId) || assignedBugRunIds.includes(tr.id));
}

function getVisibleTestCasesForRole(data: TestCase[], userId: string, role: UserRole): TestCase[] {
  if (role === 'QA_SPECIALIST') {
    const assignedRequestIds = getAssignedTestRequestIdsForUser(userId);
    return data.filter(tc => assignedRequestIds.includes(tc.testRequestId));
  }
  if (role !== 'DEVELOPER') return data;
  const ownRequestIds = testRequests.filter(tr => tr.requesterId === userId).map(tr => tr.id);
  const assignedBugRunIds = bugs.filter(b => b.assigneeId === userId).map(b => b.testRunId);
  const assignedBugTestCaseIds = testRuns
    .filter(tr => assignedBugRunIds.includes(tr.id))
    .map(tr => tr.testCaseId);
  return data.filter(tc =>
    ownRequestIds.includes(tc.testRequestId) || assignedBugTestCaseIds.includes(tc.id)
  );
}

function hydrateRetestTask(task: RetestTask): RetestTask {
  const taskBugIds = task.bugIds?.length ? task.bugIds : [task.bugId];
  return {
    ...task,
    bugIds: taskBugIds,
    bug: hydrateBug(bugs.find(b => b.id === task.bugId) || task.bug!),
    bugs: taskBugIds
      .map(bugId => bugs.find(b => b.id === bugId))
      .filter((bug): bug is Bug => Boolean(bug))
      .map(hydrateBug),
    previousRun: testRuns.find(r => r.id === task.previousRunId),
    createdRun: task.createdRunId ? testRuns.find(r => r.id === task.createdRunId) : undefined,
    assignedTo: task.assignedToId ? getUserById(task.assignedToId) : undefined,
    createdBy: getUserById(task.createdById),
    startedBy: task.startedById ? getUserById(task.startedById) : undefined,
  };
}

function getVisibleRetestTasksForRole(data: RetestTask[], userId: string, role: UserRole): RetestTask[] {
  if (role === 'DEVELOPER') {
    return data.filter(task => {
      const taskBugIds = task.bugIds?.length ? task.bugIds : [task.bugId];
      return taskBugIds.some(bugId => {
        const bug = bugs.find(b => b.id === bugId);
        return !!bug && canDeveloperAccessBug(bug, userId);
      });
    });
  }
  if (role === 'QA_SPECIALIST') {
    return data.filter(task => task.assignedToId === userId);
  }
  if (['QA_LEAD', 'SYSTEM_ADMIN', 'TECH_LEAD'].includes(role)) {
    return data;
  }
  return [];
}

function getRetestTaskBugIds(task: RetestTask): string[] {
  return task.bugIds?.length ? task.bugIds : [task.bugId];
}

function getOpenRetestTaskForBug(bugId: string): RetestTask | undefined {
  return retestTasks.find(task =>
    getRetestTaskBugIds(task).includes(bugId) && ['QUEUED', 'IN_PROGRESS'].includes(task.status)
  );
}

function ensureRetestTaskForBug(
  bug: Bug,
  userId: string,
  commandMetadata?: ResolvedCommandMetadata
): RetestTask | null {
  const existing = getOpenRetestTaskForBug(bug.id);
  if (existing) return existing;

  const previousRun = testRuns.find(r => r.id === bug.testRunId);
  if (!previousRun) {
    throw new Error('RETEST_TASK_REQUIRES_PREVIOUS_RUN');
  }

  const relatedBugs = bugs.filter(candidate =>
    candidate.testRunId === previousRun.id &&
    !['CLOSED', 'REJECTED', 'NO_ACTION_NEEDED'].includes(candidate.status)
  );
  if (!relatedBugs.length || !relatedBugs.every(candidate => candidate.status === 'RETEST_READY')) {
    return null;
  }

  const existingRunTask = retestTasks.find(task =>
    ['QUEUED', 'IN_PROGRESS'].includes(task.status) &&
    (task.sourceRunId === previousRun.id || task.previousRunId === previousRun.id)
  );
  if (existingRunTask) {
    const nextBugIds = Array.from(new Set([
      ...getRetestTaskBugIds(existingRunTask),
      ...relatedBugs.map(item => item.id),
    ]));
    existingRunTask.bugIds = nextBugIds;
    existingRunTask.bugId = nextBugIds[0] || existingRunTask.bugId;
    existingRunTask.updatedAt = new Date().toISOString();
    return existingRunTask;
  }

  const testRequest = testRequests.find(request => request.id === previousRun.testRequestId);
  const requestAssigneeId = testRequest?.assigneeId;
  const fallbackAssignedToId =
    (userHasRole(previousRun.executedById, ['QA_SPECIALIST'], bug.applicationId) ? previousRun.executedById : undefined)
    || (userHasRole(bug.reportedById, ['QA_SPECIALIST'], bug.applicationId) ? bug.reportedById : undefined);
  const assignedToId = requestAssigneeId && userHasRole(requestAssigneeId, ['QA_SPECIALIST'], bug.applicationId)
    ? requestAssigneeId
    : fallbackAssignedToId;
  const groupedBugIds = relatedBugs.map(item => item.id);
  const now = new Date().toISOString();
  const task: RetestTask = {
    id: uuidv4(),
    applicationId: bug.applicationId,
    bugId: groupedBugIds[0] || bug.id,
    bugIds: groupedBugIds,
    sourceRunId: previousRun.id,
    previousRunId: previousRun.id,
    testRequestId: previousRun.testRequestId,
    testCaseId: previousRun.testCaseId,
    purposes: ['RETEST', 'REGRESSION_TEST'],
    status: 'QUEUED',
    assignedToId,
    createdById: userId,
    idempotencyKey: commandMetadata?.idempotencyKey || `bug:${bug.id}:retest-ready`,
    correlationId: commandMetadata?.correlationId,
    createdAt: now,
    updatedAt: now,
  };
  retestTasks.unshift(task);
  createAuditLog(
    userId,
    bug.applicationId,
    'RETEST_TASK',
    task.id,
    'CREATE',
    null,
    task,
    commandAuditMetadata(commandMetadata)
  );

  const notificationMessage = relatedBugs.length > 1
    ? `${relatedBugs.length} باگ Run "${previousRun.testCase?.title || previousRun.id}" برای Retest/Regression آماده شد.`
    : `باگ "${bug.title}" برای Retest/Regression آماده شد.`;
  if (assignedToId) {
    createNotification(
      assignedToId,
      'Task بازآزمون و رگرسیون',
      notificationMessage,
      'INFO',
      'RETEST_TASK',
      task.id,
      undefined,
      commandMetadata?.correlationId
    );
  } else {
    notifyRoles(
      bug.applicationId,
      ['QA_SPECIALIST'],
      'Task بازآزمون و رگرسیون',
      notificationMessage,
      'INFO',
      'RETEST_TASK',
      task.id,
      undefined,
      commandMetadata?.correlationId
    );
  }
  return task;
}

function isRequirementReadyForTestCase(requirementId: string | undefined): boolean {
  const req = requirements.find(r => r.id === requirementId);
  return !!req && ['COMPLETED', 'APPROVED'].includes(req.status);
}

function resolveTestRequestIdForRequirement(requirement: Requirement | undefined): string {
  if (!requirement) return '';
  if (requirement.testRequestId) return requirement.testRequestId;
  return testRequests.find(tr =>
    tr.selectedRequirementIds?.includes(requirement.id) &&
    ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(tr.status)
  )?.id || '';
}

function getTestCaseReadinessErrors(tc: Partial<TestCase>): string[] {
  const errors: string[] = [];
  const requiredStringFields: Array<keyof TestCase> = [
    'title',
    'requirementId',
    'flowId',
    'scenario',
    'preconditions',
    'testData',
    'steps',
    'expectedResult',
  ];

  requiredStringFields.forEach(field => {
    const value = tc[field];
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(String(field));
    }
  });

  const req = requirements.find(r => r.id === tc.requirementId);
  if (!req || !['COMPLETED', 'APPROVED'].includes(req.status)) {
    errors.push('requirement-not-ready');
  }

  const flow = flows.find(f => f.id === tc.flowId);
  if (!flow || flow.requirementId !== tc.requirementId) {
    errors.push('flow-not-linked-to-requirement');
  }

  return errors;
}

function applyTestCaseReadiness(tc: TestCase): TestCase {
  const readinessErrors = getTestCaseReadinessErrors(tc);
  const isActive = tc.isActive ?? tc.status === 'READY';
  tc.isActive = isActive;
  tc.isComplete = readinessErrors.length === 0;
  tc.readinessErrors = readinessErrors;
  if (!tc.testDesignTechniques?.length) {
    tc.testDesignTechniques = [tc.testDesignTechnique || 'REQUIREMENTS_BASED'];
  }
  tc.status = isActive && tc.isComplete ? 'READY' : 'DRAFT';
  return tc;
}

function hydrateTestCase(tc: TestCase): TestCase {
  const hydrated = applyTestCaseReadiness(tc);
  return {
    ...hydrated,
    requirement: requirements.find(r => r.id === hydrated.requirementId),
    flow: hydrated.flowId ? flows.find(f => f.id === hydrated.flowId) : undefined,
    createdBy: getUserById(hydrated.createdById),
  };
}

function removeAttachmentsForEntity(entityType: EntityType, entityId: string): void {
  attachments = attachments.filter(att => !(att.entityType === entityType && att.entityId === entityId));
}

function canDeleteRunCascade(run: TestRun): boolean {
  if (run.isLocked || run.lockedByVersionHistoryId) return false;
  return !bugs.some(bug =>
    bug.testRunId === run.id && (bug.isLocked || bug.lockedByVersionHistoryId)
  );
}

function deleteRunCascade(run: TestRun, userId: string): boolean {
  if (!canDeleteRunCascade(run)) return false;
  const runBugs = bugs.filter(bug => bug.testRunId === run.id);

  const runBugIds = runBugs.map(bug => bug.id);
  const runIssueIds = runIssues.filter(issue => issue.testRunId === run.id).map(issue => issue.id);
  const runRetestTaskIds = retestTasks
    .filter(task =>
      task.previousRunId === run.id ||
      task.createdRunId === run.id ||
      task.sourceRunId === run.id ||
      runBugIds.includes(task.bugId) ||
      task.bugIds?.some(bugId => runBugIds.includes(bugId))
    )
    .map(task => task.id);

  runBugs.forEach(bug => {
    removeAttachmentsForEntity('BUG', bug.id);
    createAuditLog(userId, bug.applicationId, 'BUG', bug.id, 'DELETE', bug, null, { source: 'TEST_RUN_DELETE' });
  });
  runIssueIds.forEach(issueId => removeAttachmentsForEntity('RUN_ISSUE', issueId));
  runRetestTaskIds.forEach(taskId => removeAttachmentsForEntity('RETEST_TASK', taskId));
  removeAttachmentsForEntity('TEST_RUN', run.id);

  bugs = bugs.filter(bug => bug.testRunId !== run.id);
  runIssues = runIssues.filter(issue => issue.testRunId !== run.id);
  retestTasks = retestTasks.filter(task => !runRetestTaskIds.includes(task.id));
  testRuns = testRuns.filter(item => item.id !== run.id);
  createAuditLog(userId, run.applicationId, 'TEST_RUN', run.id, 'DELETE', run, null);
  return true;
}

// ============================================
// Test Request API
// ============================================

export const testRequestApi = {
  async getAll(
    applicationId: ApplicationScopeFilter,
    filters: CartableFilterParams
  ): Promise<PaginatedResponse<TestRequest>> {
    await delay();
    let data = filterByApplicationScope(testRequests, applicationId);
    data = applyFilters(data, filters);
    data = data.map(hydrateTestRequest);
    return paginate(data, filters.page, filters.limit);
  },

  async getVisibleForRole(
    applicationId: ApplicationScopeFilter,
    filters: CartableFilterParams,
    userId: string,
    role: UserRole
  ): Promise<PaginatedResponse<TestRequest>> {
    await delay();
    let data = filterByApplicationScope(testRequests, applicationId);
    data = getVisibleTestRequestsForRole(data, userId, role);
    data = applyFilters(data, filters);
    data = data.map(hydrateTestRequest);
    return paginate(data, filters.page, filters.limit);
  },

  async getById(id: string): Promise<TestRequest | null> {
    await delay();
    const tr = testRequests.find(t => t.id === id);
    return tr ? hydrateTestRequest(tr) : null;
  },

  async create(
    data: Partial<TestRequest>,
    userId: string,
    applicationId: string
  ): Promise<TestRequest> {
    await delay();
    assertTestRequestTitle(data.title);
    assertDescriptionLength(data.description, 'TEST_REQUEST_DESCRIPTION_TOO_LONG');
    assertBuildNumber(data.buildNumber);
    assertSystemUrl(data.systemUrl);
    if (!isSemVer(data.version)) {
      throw new Error('INVALID_SEMVER_VERSION');
    }
    const tr: TestRequest = {
      id: uuidv4(),
      applicationId,
      title: data.title || '',
      description: data.description || '',
      version: data.version || '',
      buildNumber: data.buildNumber,
      environment: data.environment || 'development',
      priority: data.priority || 'MEDIUM',
      riskLevel: data.riskLevel || 'MEDIUM',
      status: 'DRAFT',
      systemUrl: data.systemUrl || '',
      selectedRequirementIds: data.selectedRequirementIds || [],
      testTypes: data.testTypes || [],
      requesterId: userId,
      requester: getUserById(userId),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    testRequests.unshift(tr);
    createAuditLog(userId, applicationId, 'TEST_REQUEST', tr.id, 'CREATE', null, tr);
    return tr;
  },

  async update(id: string, data: Partial<TestRequest>, userId: string): Promise<TestRequest | null> {
    await delay();
    const index = testRequests.findIndex(t => t.id === id);
    if (index === -1) return null;
    if ('title' in data) assertTestRequestTitle(data.title);
    if ('description' in data) assertDescriptionLength(data.description, 'TEST_REQUEST_DESCRIPTION_TOO_LONG');
    if ('buildNumber' in data) assertBuildNumber(data.buildNumber);
    if ('systemUrl' in data) assertSystemUrl(data.systemUrl);
    if ('version' in data && !isSemVer(data.version)) {
      throw new Error('INVALID_SEMVER_VERSION');
    }
    
    const current = requireAt(testRequests, index);
    const previous = { ...current };
    testRequests[index] = {
      ...current,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    const updated = requireAt(testRequests, index);
    createAuditLog(userId, updated.applicationId, 'TEST_REQUEST', id, 'UPDATE', previous, updated);
    return updated;
  },

  async submit(id: string, userId: string): Promise<TestRequest | null> {
    await delay();
    const tr = testRequests.find(t => t.id === id);
    if (!tr || tr.status !== 'DRAFT') return null;
    
    const previous = { status: tr.status };
    tr.status = 'SUBMITTED';
    tr.submittedAt = new Date().toISOString();
    tr.updatedAt = new Date().toISOString();
    createAuditLog(userId, tr.applicationId, 'TEST_REQUEST', id, 'SUBMIT', previous, { status: tr.status });
    notifyRoles(
      tr.applicationId,
      ['QA_LEAD'],
      'درخواست تست جدید',
      `درخواست تست "${tr.title}" برای بررسی ارسال شد.`,
      'INFO',
      'TEST_REQUEST',
      tr.id
    );
    return tr;
  },

  async review(
    id: string,
    userId: string,
    decision: 'ACCEPTED' | 'REJECTED',
    notes?: string
  ): Promise<TestRequest | null> {
    await delay();
    const tr = testRequests.find(t => t.id === id);
    if (!tr || !['SUBMITTED', 'UNDER_REVIEW'].includes(tr.status)) return null;
    
    const previous = { status: tr.status };
    tr.status = decision;
    tr.reviewedAt = new Date().toISOString();
    tr.reviewedById = userId;
    tr.reviewNotes = notes;
    tr.updatedAt = new Date().toISOString();
    createAuditLog(userId, tr.applicationId, 'TEST_REQUEST', id, 'REVIEW', previous, { status: tr.status, decision });
    if (decision === 'ACCEPTED') {
      requirements
        .filter(requirement => requirement.testRequestId === tr.id && requirement.status !== 'APPROVED' && requirementHasFlow(requirement.id))
        .forEach(requirement => {
          const previousRequirement = { status: requirement.status };
          requirement.status = 'APPROVED';
          requirement.updatedAt = new Date().toISOString();
          createAuditLog(userId, requirement.applicationId, 'REQUIREMENT', requirement.id, 'APPROVE', previousRequirement, { status: 'APPROVED', testRequestId: tr.id });
        });
    }
    return tr;
  },

  async assign(id: string, assigneeId: string, userId: string): Promise<TestRequest | null> {
    await delay();
    const tr = testRequests.find(t => t.id === id);
    if (!tr || !['ACCEPTED', 'IN_PROGRESS'].includes(tr.status)) return null;
    
    const previous = { assigneeId: tr.assigneeId };
    tr.assigneeId = assigneeId;
    tr.assignee = getUserById(assigneeId);
    tr.status = 'IN_PROGRESS';
    tr.updatedAt = new Date().toISOString();
    createAuditLog(userId, tr.applicationId, 'TEST_REQUEST', id, 'ASSIGN', previous, { assigneeId });
    createNotification(
      assigneeId,
      'ارجاع درخواست تست',
      `درخواست تست "${tr.title}" به شما ارجاع شد.`,
      'INFO',
      'TEST_REQUEST',
      tr.id
    );
    return tr;
  },

  async cancel(id: string, userId: string, reason?: string): Promise<TestRequest | null> {
    await delay();
    const tr = testRequests.find(t => t.id === id);
    if (!tr || tr.status === 'COMPLETED' || tr.status === 'CANCELLED') return null;
    
    const previous = { status: tr.status };
    tr.status = 'CANCELLED';
    tr.updatedAt = new Date().toISOString();
    createAuditLog(userId, tr.applicationId, 'TEST_REQUEST', id, 'CANCEL', previous, { status: 'CANCELLED', reason });
    return tr;
  },

  // Get pending requests for QA Lead cartable
  async getPendingForReview(applicationId: ApplicationScopeFilter): Promise<TestRequest[]> {
    await delay();
    return testRequests.filter(
      tr => matchesApplicationScope(tr.applicationId, applicationId) && tr.status === 'SUBMITTED'
    );
  },

  // Get developer's own requests
  async getByRequester(applicationId: ApplicationScopeFilter, requesterId: string): Promise<TestRequest[]> {
    await delay();
    return testRequests.filter(
      tr => matchesApplicationScope(tr.applicationId, applicationId) && tr.requesterId === requesterId
    );
  },

  // Get assigned requests
  async getByAssignee(applicationId: ApplicationScopeFilter, assigneeId: string): Promise<TestRequest[]> {
    await delay();
    return testRequests.filter(
      tr => matchesApplicationScope(tr.applicationId, applicationId) && tr.assigneeId === assigneeId && tr.status === 'IN_PROGRESS'
    );
  },
};

// ============================================
// Requirement API
// ============================================

export const requirementApi = {
  async getAll(applicationId: ApplicationScopeFilter, filters: CartableFilterParams): Promise<PaginatedResponse<Requirement>> {
    await delay();
    let data = filterByApplicationScope(requirements, applicationId);
    // Populate flows count for each requirement (Item #3 fix)
    data = data.map(r => ({ ...r, flows: flows.filter(f => f.requirementId === r.id) }));
    data = applyFilters(data, filters);
    return paginate(data, filters.page, filters.limit);
  },

  async getById(id: string): Promise<Requirement | null> {
    await delay();
    const req = requirements.find(r => r.id === id);
    if (req) {
      req.createdBy = getUserById(req.createdById);
      req.flows = flows.filter(f => f.requirementId === id);
    }
    return req || null;
  },

  async create(data: Partial<Requirement>, userId: string, applicationId: string): Promise<Requirement> {
    await delay();
    assertDescriptionLength(data.description, 'REQUIREMENT_DESCRIPTION_TOO_LONG');
    const req: Requirement = {
      id: uuidv4(),
      applicationId,
      title: data.title || '',
      description: data.description || '',
      acceptanceCriteria: data.acceptanceCriteria,
      riskNotes: data.riskNotes,
      status: 'DRAFT',
      createdById: userId,
      createdBy: getUserById(userId),
      testRequestId: data.testRequestId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    requirements.unshift(req);
    createAuditLog(userId, applicationId, 'REQUIREMENT', req.id, 'CREATE', null, req);
    return req;
  },

  async update(id: string, data: Partial<Requirement>, userId: string): Promise<Requirement | null> {
    await delay();
    const index = requirements.findIndex(r => r.id === id);
    if (index === -1) return null;
    assertDescriptionLength(data.description, 'REQUIREMENT_DESCRIPTION_TOO_LONG');
    if (data.status && ['COMPLETED', 'APPROVED'].includes(data.status) && !requirementHasFlow(id)) {
      throw new Error('REQUIREMENT_FLOW_REQUIRED');
    }
    
    const current = requireAt(requirements, index);
    const previous = { ...current };
    requirements[index] = {
      ...current,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    const updated = requireAt(requirements, index);
    createAuditLog(userId, updated.applicationId, 'REQUIREMENT', id, 'UPDATE', previous, updated);
    return updated;
  },

  async approve(id: string, userId: string): Promise<Requirement | null> {
    await delay();
    const req = requirements.find(r => r.id === id);
    if (!req || req.status === 'APPROVED') return null;
    if (!requirementHasFlow(id)) {
      throw new Error('REQUIREMENT_FLOW_REQUIRED');
    }
    
    const previous = { status: req.status };
    req.status = 'APPROVED';
    req.updatedAt = new Date().toISOString();
    createAuditLog(userId, req.applicationId, 'REQUIREMENT', id, 'APPROVE', previous, { status: 'APPROVED' });
    return req;
  },

  // Get incomplete requirements for BA cartable
  async getIncomplete(applicationId: ApplicationScopeFilter): Promise<Requirement[]> {
    await delay();
    return requirements.filter(
      r => matchesApplicationScope(r.applicationId, applicationId) && ['DRAFT', 'IN_PROGRESS'].includes(r.status)
    );
  },

  async delete(id: string): Promise<boolean> {
    await delay();
    const index = requirements.findIndex(r => r.id === id);
    if (index === -1) return false;
    requirements.splice(index, 1);
    return true;
  },
};

// ============================================
// Flow API
// ============================================

export const flowApi = {
  async getByRequirement(requirementId: string): Promise<Flow[]> {
    await delay();
    return flows.filter(f => f.requirementId === requirementId);
  },

  async create(data: Partial<Flow>, userId: string): Promise<Flow> {
    await delay();
    assertDescriptionLength(data.description, 'FLOW_DESCRIPTION_TOO_LONG');
    const flow: Flow = {
      id: uuidv4(),
      requirementId: data.requirementId || '',
      title: data.title || '',
      description: data.description || '',
      steps: data.steps,
      createdById: userId,
      createdBy: getUserById(userId),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    flows.unshift(flow);
    return flow;
  },

  async update(id: string, data: Partial<Flow>): Promise<Flow | null> {
    await delay();
    const index = flows.findIndex(f => f.id === id);
    if (index === -1) return null;
    assertDescriptionLength(data.description, 'FLOW_DESCRIPTION_TOO_LONG');
    
    const current = requireAt(flows, index);
    flows[index] = {
      ...current,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return requireAt(flows, index);
  },

  async delete(id: string): Promise<boolean> {
    await delay();
    const index = flows.findIndex(f => f.id === id);
    if (index === -1) return false;
    flows.splice(index, 1);
    return true;
  },
};

// ============================================
// Test Case API
// ============================================

export const testCaseApi = {
  async getAll(applicationId: ApplicationScopeFilter, filters: CartableFilterParams): Promise<PaginatedResponse<TestCase>> {
    await delay();
    let data = filterByApplicationScope(testCases, applicationId);
    data = data.map(hydrateTestCase);
    data = applyFilters(data, filters);
    return paginate(data, filters.page, filters.limit);
  },

  async getVisibleForRole(
    applicationId: ApplicationScopeFilter,
    filters: CartableFilterParams,
    userId: string,
    role: UserRole
  ): Promise<PaginatedResponse<TestCase>> {
    await delay();
    let data = filterByApplicationScope(testCases, applicationId);
    data = getVisibleTestCasesForRole(data, userId, role);
    data = data.map(hydrateTestCase);
    data = applyFilters(data, filters);
    return paginate(data, filters.page, filters.limit);
  },

  async getById(id: string): Promise<TestCase | null> {
    await delay();
    const tc = testCases.find(t => t.id === id);
    if (tc) {
      return hydrateTestCase(tc);
    }
    return null;
  },

  async getByTestRequest(testRequestId: string): Promise<TestCase[]> {
    await delay();
    return testCases.filter(tc => tc.testRequestId === testRequestId).map(hydrateTestCase);
  },

  async create(data: Partial<TestCase>, userId: string, applicationId: string): Promise<TestCase> {
    await delay();
    const requirement = requirements.find(r => r.id === data.requirementId);
    if (!requirement || !isRequirementReadyForTestCase(requirement.id)) {
      throw new Error('REQUIREMENT_NOT_READY_FOR_TEST_CASE');
    }

    const flow = flows.find(f => f.id === data.flowId && f.requirementId === requirement.id);
    if (!flow) {
      throw new Error('FLOW_REQUIRED_FOR_TEST_CASE');
    }

    const testRequestId = data.testRequestId || resolveTestRequestIdForRequirement(requirement);
    const testRequest = testRequestId ? testRequests.find(tr => tr.id === testRequestId) : undefined;
    if (testRequest && testRequest.applicationId !== requirement.applicationId) {
      throw new Error('TEST_REQUEST_OUT_OF_SCOPE');
    }

    const tc: TestCase = {
      id: uuidv4(),
      applicationId: requirement.applicationId || testRequest?.applicationId || applicationId,
      testRequestId: testRequestId || '',
      requirementId: requirement.id,
      flowId: flow.id,
      title: data.title || '',
      scenario: data.scenario || '',
      preconditions: data.preconditions || '',
      testData: data.testData || '',
      steps: data.steps || '',
      expectedResult: data.expectedResult || '',
      testType: data.testType || 'FUNCTIONAL',
      testDesignTechnique: data.testDesignTechnique || 'REQUIREMENTS_BASED',
      testDesignTechniques: data.testDesignTechniques?.length
        ? data.testDesignTechniques
        : [data.testDesignTechnique || 'REQUIREMENTS_BASED'],
      priority: data.priority || 'MEDIUM',
      riskLevel: data.riskLevel || 'MEDIUM',
      qualityAttribute: data.qualityAttribute || 'FUNCTIONALITY',
      automationCandidate: data.automationCandidate || false,
      regressionCandidate: data.regressionCandidate || false,
      isActive: data.isActive ?? true,
      isComplete: false,
      readinessErrors: [],
      status: 'DRAFT',
      createdById: userId,
      createdBy: getUserById(userId),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tc.testRequestId = testRequestId || '';
    applyTestCaseReadiness(tc);
    if (!tc.isComplete) {
      throw new Error('TEST_CASE_INCOMPLETE');
    }
    testCases.unshift(tc);
    createAuditLog(userId, tc.applicationId, 'TEST_CASE', tc.id, 'CREATE', null, tc);
    return tc;
  },

  async update(id: string, data: Partial<TestCase>, userId: string): Promise<TestCase | null> {
    await delay();
    const index = testCases.findIndex(t => t.id === id);
    if (index === -1) return null;

    const current = requireAt(testCases, index);
    const previous = { ...current };
    if (data.status === 'READY') {
      data.isActive = true;
    }
    if (data.status === 'DRAFT') {
      data.isActive = false;
    }
    if (data.requirementId && data.testRequestId === undefined) {
      data.testRequestId = resolveTestRequestIdForRequirement(
        requirements.find(r => r.id === data.requirementId)
      ) || '';
    }
    
    testCases[index] = {
      ...current,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    const updated = requireAt(testCases, index);
    applyTestCaseReadiness(updated);
    createAuditLog(userId, updated.applicationId, 'TEST_CASE', id, 'UPDATE', previous, updated);
    return updated;
  },

  async delete(id: string, userId: string): Promise<boolean> {
    await delay();
    const index = testCases.findIndex(t => t.id === id);
    if (index === -1) return false;
    const testCase = requireAt(testCases, index);
    const relatedRuns = testRuns.filter(run => run.testCaseId === id);
    if (!relatedRuns.every(canDeleteRunCascade)) return false;
    relatedRuns.forEach(run => deleteRunCascade(run, userId));

    testCases.splice(index, 1);
    removeAttachmentsForEntity('TEST_CASE', id);
    createAuditLog(userId, testCase.applicationId, 'TEST_CASE', id, 'DELETE', testCase, null);
    return true;
  },
};

// ============================================
// Test Run API
// ============================================

export const testRunApi = {
  async getAll(applicationId: ApplicationScopeFilter, filters: CartableFilterParams): Promise<PaginatedResponse<TestRun>> {
    await delay();
    let data = filterByApplicationScope(testRuns, applicationId);
    data = applyFilters(data, filters);
    data = data.map(hydrateTestRun);
    return paginate(data, filters.page, filters.limit);
  },

  async getVisibleForRole(
    applicationId: ApplicationScopeFilter,
    filters: CartableFilterParams,
    userId: string,
    role: UserRole
  ): Promise<PaginatedResponse<TestRun>> {
    await delay();
    let data = filterByApplicationScope(testRuns, applicationId);
    data = getVisibleTestRunsForRole(data, userId, role);
    data = applyFilters(data, filters);
    data = data.map(hydrateTestRun);
    return paginate(data, filters.page, filters.limit);
  },

  async getById(id: string): Promise<TestRun | null> {
    await delay();
    const run = testRuns.find(r => r.id === id);
    return run ? hydrateTestRun(run) : null;
  },

  async getByTestRequest(testRequestId: string): Promise<TestRun[]> {
    await delay();
    return testRuns.filter(tr => tr.testRequestId === testRequestId).map(hydrateTestRun);
  },

  async create(
    data: Partial<TestRun>,
    userId: string,
    applicationId: string,
    metadataOrRole?: CommandMetadata | UserRole,
    metadata?: CommandMetadata
  ): Promise<TestRun> {
    await delay();
    const actorRole = typeof metadataOrRole === 'string' ? metadataOrRole : undefined;
    const commandMetadata = typeof metadataOrRole === 'string' ? metadata : metadataOrRole;
    const command = resolveCommandMetadata(
      'testRun.create',
      commandMetadata,
      commandMetadata?.idempotencyKey
    );
    const replayed = getIdempotentResult<TestRun>(command);
    if (replayed) {
      createCommandTrace(command, 'REPLAYED', userId, replayed.applicationId, 'TEST_RUN', replayed.id);
      return hydrateTestRun(replayed);
    }

    const testCase = testCases.find(tc => tc.id === data.testCaseId);
    if (!testCase) {
      throw new Error('TEST_CASE_NOT_FOUND');
    }
    applyTestCaseReadiness(testCase);
    if (testCase.status !== 'READY' || testCase.isComplete === false || testCase.isActive === false) {
      throw new Error('TEST_CASE_NOT_READY');
    }

    const testRequest = testRequests.find(tr => tr.id === (data.testRequestId || testCase.testRequestId));
    if (actorRole === 'QA_SPECIALIST' && !isTestRequestAssignedToUser(testRequest?.id, userId)) {
      throw new Error('TEST_REQUEST_NOT_ASSIGNED_TO_QA_SPECIALIST');
    }
    const resolvedVersion = data.version || testRequest?.version || '';
    if (!isSemVer(resolvedVersion)) {
      throw new Error('INVALID_SEMVER_VERSION');
    }
    assertBuildNumber(data.buildNumber);
    const run: TestRun = {
      id: uuidv4(),
      testCaseId: testCase.id,
      testRequestId: data.testRequestId || testCase.testRequestId,
      applicationId: testCase.applicationId || applicationId,
      purposes: data.purposes,
      previousRunId: data.previousRunId,
      retestTaskId: data.retestTaskId,
      sourceBugId: data.sourceBugId,
      version: resolvedVersion,
      buildNumber: data.buildNumber || testRequest?.buildNumber,
      status: 'PENDING',
      executedById: userId,
      executedBy: getUserById(userId),
      isFinalized: false,
      isLocked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    testRuns.unshift(run);
    createAuditLog(
      userId,
      run.applicationId,
      'TEST_RUN',
      run.id,
      'CREATE',
      null,
      run,
      commandAuditMetadata(command)
    );
    createCommandTrace(command, 'COMPLETED', userId, run.applicationId, 'TEST_RUN', run.id);
    return rememberIdempotentResult(command, run);
  },

  async update(
    id: string,
    data: Partial<TestRun>,
    userId: string,
    metadataOrRole?: CommandMetadata | UserRole,
    metadata?: CommandMetadata
  ): Promise<TestRun | null> {
    await delay();
    const actorRole = typeof metadataOrRole === 'string' ? metadataOrRole : undefined;
    const commandMetadata = typeof metadataOrRole === 'string' ? metadata : metadataOrRole;
    const command = resolveCommandMetadata('testRun.update', commandMetadata);
    const replayed = getIdempotentResult<TestRun | null>(command);
    if (replayed) {
      createCommandTrace(command, 'REPLAYED', userId, replayed.applicationId, 'TEST_RUN', id);
      return hydrateTestRun(replayed);
    }

    const run = testRuns.find(r => r.id === id);
    if (!run || run.isLocked || run.lockedByVersionHistoryId) return null;

    const nextTestCase = testCases.find(tc => tc.id === (data.testCaseId || run.testCaseId));
    if (!nextTestCase) return null;
    applyTestCaseReadiness(nextTestCase);
    if (nextTestCase.status !== 'READY' || nextTestCase.isComplete === false || nextTestCase.isActive === false) {
      return null;
    }

    const nextTestRequestId = data.testRequestId || nextTestCase.testRequestId || run.testRequestId;
    const nextTestRequest = testRequests.find(tr => tr.id === nextTestRequestId);
    if (!nextTestRequest) return null;
    if (actorRole === 'QA_SPECIALIST' && !isTestRequestAssignedToUser(nextTestRequest.id, userId)) return null;
    const nextVersion = data.version ?? run.version;
    if (!isSemVer(nextVersion)) {
      throw new Error('INVALID_SEMVER_VERSION');
    }
    if ('buildNumber' in data) assertBuildNumber(data.buildNumber);

    const previous = { ...run };
    run.testCaseId = nextTestCase.id;
    run.testRequestId = nextTestRequest.id;
    run.applicationId = nextTestCase.applicationId || nextTestRequest.applicationId || run.applicationId;
    run.purposes = data.purposes ?? run.purposes;
    run.previousRunId = data.previousRunId || undefined;
    run.retestTaskId = data.retestTaskId ?? run.retestTaskId;
    run.sourceBugId = data.sourceBugId ?? run.sourceBugId;
    run.version = nextVersion;
    run.buildNumber = data.buildNumber;
    run.versionChangedReason = data.versionChangedReason ?? run.versionChangedReason;
    run.status = data.status ?? run.status;
    run.actualResult = data.actualResult ?? run.actualResult;
    if (data.status && FINAL_RUN_STATUSES.includes(data.status)) {
      run.executedAt = new Date().toISOString();
    }
    run.updatedAt = new Date().toISOString();

    createAuditLog(
      userId,
      run.applicationId,
      'TEST_RUN',
      id,
      'UPDATE',
      previous,
      run,
      commandAuditMetadata(command)
    );
    createCommandTrace(command, 'COMPLETED', userId, run.applicationId, 'TEST_RUN', id);
    return rememberIdempotentResult(command, run);
  },

  async updateStatus(
    id: string,
    status: TestRunStatus,
    actualResult: string,
    userId: string,
    metadata?: CommandMetadata
  ): Promise<TestRun | null> {
    await delay();
    const command = resolveCommandMetadata('testRun.updateStatus', metadata);
    const replayed = getIdempotentResult<TestRun | null>(command);
    if (replayed) {
      createCommandTrace(command, 'REPLAYED', userId, replayed.applicationId, 'TEST_RUN', id);
      return hydrateTestRun(replayed);
    }

    const run = testRuns.find(r => r.id === id);
    if (!run || run.isLocked) return null;
    
    const previous = { status: run.status };
    run.status = status;
    run.actualResult = actualResult;
    run.executedAt = new Date().toISOString();
    run.updatedAt = new Date().toISOString();
    createAuditLog(
      userId,
      run.applicationId,
      'TEST_RUN',
      id,
      'STATUS_CHANGE',
      previous,
      { status },
      commandAuditMetadata(command)
    );
    createCommandTrace(command, 'COMPLETED', userId, run.applicationId, 'TEST_RUN', id);
    return rememberIdempotentResult(command, run);
  },

  async unlock(
    id: string,
    reason: string,
    userId: string,
    metadata?: CommandMetadata
  ): Promise<TestRun | null> {
    await delay();
    const command = resolveCommandMetadata('testRun.unlock', metadata, `test-run:${id}:unlock`);
    const replayed = getIdempotentResult<TestRun | null>(command);
    if (replayed) {
      createCommandTrace(command, 'REPLAYED', userId, replayed.applicationId, 'TEST_RUN', id);
      return hydrateTestRun(replayed);
    }

    const run = testRuns.find(r => r.id === id);
    if (!run || !run.isLocked || !reason.trim()) return null;
    if (!userHasRole(userId, ['SYSTEM_ADMIN'], run.applicationId)) return null;

    const previous = {
      isLocked: run.isLocked,
      lockedByVersionHistoryId: run.lockedByVersionHistoryId,
      lockedAt: run.lockedAt,
    };
    run.isLocked = false;
    run.unlockedById = userId;
    run.unlockedAt = new Date().toISOString();
    run.unlockReason = reason.trim();
    run.updatedAt = run.unlockedAt;
    createAuditLog(
      userId,
      run.applicationId,
      'TEST_RUN',
      id,
      'UNLOCK',
      previous,
      {
        isLocked: false,
        reason: run.unlockReason,
        unlockedById: userId,
      },
      commandAuditMetadata(command)
    );
    createCommandTrace(command, 'COMPLETED', userId, run.applicationId, 'TEST_RUN', id);
    return rememberIdempotentResult(command, run);
  },

  async finalize(id: string, userId: string): Promise<TestRun | null> {
    await delay();
    const run = testRuns.find(r => r.id === id);
    if (!run || run.isFinalized) return null;
    
    run.isFinalized = true;
    run.updatedAt = new Date().toISOString();
    createAuditLog(userId, run.applicationId, 'TEST_RUN', id, 'FINALIZE', null, { isFinalized: true });
    return run;
  },

  async delete(id: string, userId: string): Promise<boolean> {
    await delay();
    const run = testRuns.find(r => r.id === id);
    if (!run) return false;
    return deleteRunCascade(run, userId);
  },

  // Get pending runs for QA cartable
  async getPending(applicationId: ApplicationScopeFilter): Promise<TestRun[]> {
    await delay();
    return testRuns.filter(
      tr => matchesApplicationScope(tr.applicationId, applicationId) && ['PENDING', 'IN_PROGRESS'].includes(tr.status)
    );
  },
};

// ============================================
// Bug API
// ============================================

export const bugApi = {
  async getAll(applicationId: ApplicationScopeFilter, filters: CartableFilterParams): Promise<PaginatedResponse<Bug>> {
    await delay();
    let data = filterByApplicationScope(bugs, applicationId);
    data = applyFilters(data, filters);
    data = data.map(hydrateBug);
    return paginate(data, filters.page, filters.limit);
  },

  async getVisibleForRole(
    applicationId: ApplicationScopeFilter,
    filters: CartableFilterParams,
    userId: string,
    role: UserRole
  ): Promise<PaginatedResponse<Bug>> {
    await delay();
    let data = filterByApplicationScope(bugs, applicationId);
    data = getVisibleBugsForRole(data, userId, role);
    data = applyFilters(data, filters);
    data = data.map(hydrateBug);
    return paginate(data, filters.page, filters.limit);
  },

  async getById(id: string): Promise<Bug | null> {
    await delay();
    const bug = bugs.find(b => b.id === id);
    if (bug) {
      return hydrateBug(bug);
    }
    return null;
  },

  async create(data: Partial<Bug>, userId: string, applicationId: string): Promise<Bug> {
    await delay();
    const run = testRuns.find(r => r.id === data.testRunId);
    if (!run || run.status !== 'FAILED') {
      throw new Error('BUG_REQUIRES_FAILED_TEST_RUN');
    }
    if (run.isLocked) {
      throw new Error('BUG_REQUIRES_UNLOCKED_TEST_RUN');
    }
    if (data.assigneeId && !isActiveDeveloperForApplication(data.assigneeId, run.applicationId || applicationId)) {
      throw new Error('INVALID_BUG_ASSIGNEE');
    }
    assertDescriptionLength(data.description, 'BUG_DESCRIPTION_TOO_LONG');
    const bug: Bug = {
      id: uuidv4(),
      applicationId: run.applicationId || applicationId,
      testRunId: run.id,
      title: data.title || '',
      description: data.description || '',
      stepsToReproduce: data.stepsToReproduce || '',
      expectedResult: data.expectedResult || '',
      actualResult: data.actualResult || '',
      severity: data.severity || 'MAJOR',
      priority: data.priority || 'HIGH',
      status: data.assigneeId ? 'ASSIGNED' : 'NEW',
      assigneeId: data.assigneeId,
      assignee: data.assigneeId ? getUserById(data.assigneeId) : undefined,
      reportedById: userId,
      reportedBy: getUserById(userId),
      externalToolLink: data.externalToolLink,
      externalToolId: data.externalToolId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    bugs.unshift(bug);
    createAuditLog(userId, bug.applicationId, 'BUG', bug.id, 'CREATE', null, bug);
    if (bug.assigneeId) {
      createNotification(
        bug.assigneeId,
        'باگ جدید تخصیص یافت',
        `باگ "${bug.title}" به شما تخصیص یافت.`,
        'WARNING',
        'BUG',
        bug.id
      );
    }
    return bug;
  },

  async update(id: string, data: Partial<Bug>, userId: string): Promise<Bug | null> {
    await delay();
    const bug = bugs.find(b => b.id === id);
    if (!bug || bug.isLocked) return null;

    const targetRun = data.testRunId
      ? testRuns.find(run => run.id === data.testRunId)
      : testRuns.find(run => run.id === bug.testRunId);
    if (!targetRun || targetRun.isLocked || targetRun.lockedByVersionHistoryId) {
      return null;
    }
    if (data.assigneeId && !isActiveDeveloperForApplication(data.assigneeId, bug.applicationId)) {
      throw new Error('INVALID_BUG_ASSIGNEE');
    }
    if ('description' in data) assertDescriptionLength(data.description, 'BUG_DESCRIPTION_TOO_LONG');
    if ('fixedVersion' in data && data.fixedVersion && !isSemVer(data.fixedVersion)) {
      throw new Error('INVALID_SEMVER_VERSION');
    }

    const previous = { ...bug };
    bug.testRunId = targetRun.id;
    bug.title = data.title ?? bug.title;
    bug.description = data.description ?? bug.description;
    bug.stepsToReproduce = data.stepsToReproduce ?? bug.stepsToReproduce;
    bug.expectedResult = data.expectedResult ?? bug.expectedResult;
    bug.actualResult = data.actualResult ?? bug.actualResult;
    bug.severity = data.severity ?? bug.severity;
    bug.priority = data.priority ?? bug.priority;
    bug.status = data.status ?? bug.status;
    if ('assigneeId' in data) {
      bug.assigneeId = data.assigneeId || undefined;
      bug.assignee = bug.assigneeId ? getUserById(bug.assigneeId) : undefined;
      if (bug.assigneeId && previous.status === 'NEW' && !data.status) {
        bug.status = 'ASSIGNED';
      }
    }
    if ('fixedVersion' in data) bug.fixedVersion = data.fixedVersion;
    if ('fixNotes' in data) bug.fixNotes = data.fixNotes;
    if ('externalToolLink' in data) bug.externalToolLink = data.externalToolLink;
    if ('externalToolId' in data) bug.externalToolId = data.externalToolId;
    bug.updatedAt = new Date().toISOString();
    createAuditLog(userId, bug.applicationId, 'BUG', id, 'UPDATE', previous, bug);
    if (bug.assigneeId && bug.assigneeId !== previous.assigneeId) {
      createNotification(
        bug.assigneeId,
        'باگ به شما تخصیص یافت',
        `باگ "${bug.title}" برای رفع به شما ارجاع شد.`,
        'WARNING',
        'BUG',
        bug.id
      );
    }
    return hydrateBug(bug);
  },

  async delete(id: string, userId: string): Promise<boolean> {
    await delay();
    const index = bugs.findIndex(b => b.id === id);
    if (index === -1) return false;
    const bug = requireAt(bugs, index);
    if (bug.isLocked) return false;
    const run = testRuns.find(r => r.id === bug.testRunId);
    if (run?.isLocked || run?.lockedByVersionHistoryId) return false;

    bugs.splice(index, 1);
    retestTasks = retestTasks.filter(task => !getRetestTaskBugIds(task).includes(id));
    createAuditLog(userId, bug.applicationId, 'BUG', id, 'DELETE', bug, null);
    return true;
  },

  async assign(id: string, assigneeId: string, userId: string): Promise<Bug | null> {
    await delay();
    const bug = bugs.find(b => b.id === id);
    if (!bug) return null;
    if (bug.isLocked) return null;
    if (!isActiveDeveloperForApplication(assigneeId, bug.applicationId)) {
      throw new Error('INVALID_BUG_ASSIGNEE');
    }
    
    const previous = { assigneeId: bug.assigneeId, status: bug.status };
    bug.assigneeId = assigneeId;
    bug.assignee = getUserById(assigneeId);
    bug.status = 'ASSIGNED';
    bug.updatedAt = new Date().toISOString();
    createAuditLog(userId, bug.applicationId, 'BUG', id, 'ASSIGN', previous, { assigneeId, status: 'ASSIGNED' });
    createNotification(
      assigneeId,
      'باگ به شما تخصیص یافت',
      `باگ "${bug.title}" برای رفع به شما ارجاع شد.`,
      'WARNING',
      'BUG',
      bug.id
    );
    return bug;
  },

  async updateStatus(id: string, status: BugStatus, notes: string, userId: string): Promise<Bug | null> {
    await delay();
    const bug = bugs.find(b => b.id === id);
    if (!bug) return null;
    if (bug.isLocked) return null;
    if (
      userHasRole(userId, ['DEVELOPER'], bug.applicationId) &&
      !userHasRole(userId, ['QA_LEAD', 'QA_SPECIALIST', 'SYSTEM_ADMIN'], bug.applicationId) &&
      !canDeveloperAccessBug(bug, userId)
    ) {
      return null;
    }
    
    const previous = {
      status: bug.status,
      previousStatus: bug.previousStatus,
      previousStatusChangedAt: bug.previousStatusChangedAt,
    };
    if (['REJECTED', 'NO_ACTION_NEEDED'].includes(status) && bug.status !== status) {
      bug.previousStatus = bug.status;
      bug.previousStatusChangedAt = new Date().toISOString();
    } else if (!['REJECTED', 'NO_ACTION_NEEDED'].includes(status)) {
      bug.previousStatus = undefined;
      bug.previousStatusChangedAt = undefined;
    }
    bug.status = status;
    bug.fixNotes = notes;
    bug.updatedAt = new Date().toISOString();
    createAuditLog(userId, bug.applicationId, 'BUG', id, 'STATUS_CHANGE', previous, {
      status,
      notes,
      previousStatus: bug.previousStatus,
    });
    return bug;
  },

  async restorePreviousStatus(id: string, userId: string, notes = ''): Promise<Bug | null> {
    await delay();
    const bug = bugs.find(b => b.id === id);
    if (!bug || bug.isLocked || !bug.previousStatus || !['REJECTED', 'NO_ACTION_NEEDED'].includes(bug.status)) return null;
    if (
      userHasRole(userId, ['DEVELOPER'], bug.applicationId) &&
      !userHasRole(userId, ['QA_LEAD', 'QA_SPECIALIST', 'SYSTEM_ADMIN'], bug.applicationId) &&
      !canDeveloperAccessBug(bug, userId)
    ) {
      return null;
    }

    const restoredStatus = bug.previousStatus;
    const previous = {
      status: bug.status,
      previousStatus: bug.previousStatus,
      previousStatusChangedAt: bug.previousStatusChangedAt,
    };
    bug.status = restoredStatus;
    bug.previousStatus = undefined;
    bug.previousStatusChangedAt = undefined;
    if (notes.trim()) bug.fixNotes = notes.trim();
    bug.updatedAt = new Date().toISOString();
    createAuditLog(userId, bug.applicationId, 'BUG', id, 'STATUS_CHANGE', previous, {
      status: restoredStatus,
      notes,
      restoredFrom: previous.status,
    });
    return bug;
  },

  async setFixedVersion(id: string, fixedVersion: string, userId: string): Promise<Bug | null> {
    await delay();
    if (!isSemVer(fixedVersion)) {
      throw new Error('INVALID_SEMVER_VERSION');
    }
    const bug = bugs.find(b => b.id === id);
    if (!bug) return null;
    if (bug.isLocked) return null;
    if (
      userHasRole(userId, ['DEVELOPER'], bug.applicationId) &&
      !userHasRole(userId, ['QA_LEAD', 'QA_SPECIALIST', 'SYSTEM_ADMIN'], bug.applicationId) &&
      !canDeveloperAccessBug(bug, userId)
    ) {
      return null;
    }
    
    bug.fixedVersion = fixedVersion;
    bug.status = 'FIXED';
    bug.updatedAt = new Date().toISOString();
    createAuditLog(userId, bug.applicationId, 'BUG', id, 'UPDATE', null, { fixedVersion, status: 'FIXED' });
    return bug;
  },

  async markReadyForRetest(id: string, userId: string, metadata?: CommandMetadata): Promise<Bug | null> {
    await delay();
    const command = resolveCommandMetadata('bug.markReadyForRetest', metadata, `bug:${id}:ready-for-retest`);
    const replayed = getIdempotentResult<Bug | null>(command);
    if (replayed) {
      createCommandTrace(command, 'REPLAYED', userId, replayed.applicationId, 'BUG', id);
      return hydrateBug(replayed);
    }

    const bug = bugs.find(b => b.id === id);
    if (bug?.isLocked) return null;
    if (!bug || !['FIXED', 'RETEST_READY'].includes(bug.status)) return null;
    if (
      userHasRole(userId, ['DEVELOPER'], bug.applicationId) &&
      !userHasRole(userId, ['QA_LEAD', 'QA_SPECIALIST', 'SYSTEM_ADMIN'], bug.applicationId) &&
      !canDeveloperAccessBug(bug, userId)
    ) {
      return null;
    }
    
    const previous = { status: bug.status };
    bug.status = 'RETEST_READY';
    bug.updatedAt = new Date().toISOString();
    const task = ensureRetestTaskForBug(bug, userId, command);
    const retestAuditPayload: { status: BugStatus; retestTaskId?: string; waitingForRunBugs?: boolean } = {
      status: 'RETEST_READY',
    };
    if (task) retestAuditPayload.retestTaskId = task.id;
    else retestAuditPayload.waitingForRunBugs = true;
    createAuditLog(
      userId,
      bug.applicationId,
      'BUG',
      id,
      'STATUS_CHANGE',
      previous,
      retestAuditPayload,
      commandAuditMetadata(command)
    );
    createCommandTrace(command, 'COMPLETED', userId, bug.applicationId, 'BUG', id);
    return rememberIdempotentResult(command, bug);
  },

  async retest(id: string, passed: boolean, userId: string, metadata?: CommandMetadata): Promise<Bug | null> {
    await delay();
    const command = resolveCommandMetadata('bug.retest', metadata);
    const replayed = getIdempotentResult<Bug | null>(command);
    if (replayed) {
      createCommandTrace(command, 'REPLAYED', userId, replayed.applicationId, 'BUG', id);
      return hydrateBug(replayed);
    }

    const bug = bugs.find(b => b.id === id);
    if (bug?.isLocked) return null;
    const targetStatus: BugStatus = passed ? 'RETEST_PASSED' : 'RETEST_FAILED';
    if (!bug) return null;
    if (bug.status === targetStatus) return hydrateBug(bug);
    if (bug.status !== 'RETEST_READY') return null;
    
    const previous = { status: bug.status };
    bug.status = targetStatus;
    bug.updatedAt = new Date().toISOString();
    createAuditLog(
      userId,
      bug.applicationId,
      'BUG',
      id,
      'STATUS_CHANGE',
      previous,
      { status: bug.status, passed },
      commandAuditMetadata(command)
    );
    const task = getOpenRetestTaskForBug(bug.id);
    if (task) {
      const taskBugIds = getRetestTaskBugIds(task);
      const hasPendingBug = taskBugIds.some(taskBugId => bugs.find(item => item.id === taskBugId)?.status === 'RETEST_READY');
      if (!hasPendingBug) {
        const previousTask = { status: task.status };
        task.status = 'COMPLETED';
        task.completedAt = new Date().toISOString();
        task.updatedAt = new Date().toISOString();
        createAuditLog(
          userId,
          bug.applicationId,
          'RETEST_TASK',
          task.id,
          'STATUS_CHANGE',
          previousTask,
          { status: 'COMPLETED', passed },
          commandAuditMetadata(command)
        );
      }
    }
    createCommandTrace(command, 'COMPLETED', userId, bug.applicationId, 'BUG', id);
    return rememberIdempotentResult(command, bug);
  },

  async close(id: string, userId: string): Promise<Bug | null> {
    await delay();
    const bug = bugs.find(b => b.id === id);
    if (!bug) return null;
    if (bug.isLocked) return null;
    
    const previous = { status: bug.status };
    bug.status = 'CLOSED';
    bug.updatedAt = new Date().toISOString();
    createAuditLog(userId, bug.applicationId, 'BUG', id, 'STATUS_CHANGE', previous, { status: 'CLOSED' });
    return bug;
  },

  async unlock(
    id: string,
    reason: string,
    userId: string,
    metadata?: CommandMetadata
  ): Promise<Bug | null> {
    await delay();
    const command = resolveCommandMetadata('bug.unlock', metadata, `bug:${id}:unlock`);
    const replayed = getIdempotentResult<Bug | null>(command);
    if (replayed) {
      createCommandTrace(command, 'REPLAYED', userId, replayed.applicationId, 'BUG', id);
      return hydrateBug(replayed);
    }

    const bug = bugs.find(b => b.id === id);
    if (!bug || !bug.isLocked || !reason.trim()) return null;
    if (!userHasRole(userId, ['SYSTEM_ADMIN'], bug.applicationId)) return null;

    const previous = {
      isLocked: bug.isLocked,
      lockedByVersionHistoryId: bug.lockedByVersionHistoryId,
      lockedAt: bug.lockedAt,
    };
    bug.isLocked = false;
    bug.unlockedById = userId;
    bug.unlockedAt = new Date().toISOString();
    bug.unlockReason = reason.trim();
    bug.updatedAt = bug.unlockedAt;
    createAuditLog(
      userId,
      bug.applicationId,
      'BUG',
      id,
      'UNLOCK',
      previous,
      {
        isLocked: false,
        reason: bug.unlockReason,
        unlockedById: userId,
      },
      commandAuditMetadata(command)
    );
    createCommandTrace(command, 'COMPLETED', userId, bug.applicationId, 'BUG', id);
    return rememberIdempotentResult(command, bug);
  },

  // Get bugs assigned to developer
  async getByAssignee(applicationId: ApplicationScopeFilter, assigneeId: string): Promise<Bug[]> {
    await delay();
    return bugs.filter(
      b => matchesApplicationScope(b.applicationId, applicationId) && 
           b.assigneeId === assigneeId && 
           b.status !== 'CLOSED'
    ).map(hydrateBug);
  },

  // Get bugs ready for retest
  async getReadyForRetest(applicationId: ApplicationScopeFilter): Promise<Bug[]> {
    await delay();
    return bugs.filter(
      b => matchesApplicationScope(b.applicationId, applicationId) && b.status === 'RETEST_READY'
    );
  },

  // Get critical/major open bugs
  async getCriticalOpen(applicationId: ApplicationScopeFilter): Promise<Bug[]> {
    await delay();
    return bugs.filter(
      b => matchesApplicationScope(b.applicationId, applicationId) && 
           ['CRITICAL', 'MAJOR'].includes(b.severity) &&
           !['CLOSED', 'REJECTED', 'RETEST_PASSED', 'NO_ACTION_NEEDED'].includes(b.status)
    ).map(hydrateBug);
  },

  async getCriticalOpenVisible(applicationId: ApplicationScopeFilter, userId: string, role: UserRole): Promise<Bug[]> {
    await delay();
    return getVisibleBugsForRole(
      bugs.filter(
        b => matchesApplicationScope(b.applicationId, applicationId) &&
             ['CRITICAL', 'MAJOR'].includes(b.severity) &&
             !['CLOSED', 'REJECTED', 'RETEST_PASSED', 'NO_ACTION_NEEDED'].includes(b.status)
      ),
      userId,
      role
    ).map(hydrateBug);
  },
};

// ============================================
// Retest Task API
// ============================================

export const retestTaskApi = {
  async getAll(applicationId: ApplicationScopeFilter, filters: CartableFilterParams): Promise<PaginatedResponse<RetestTask>> {
    await delay();
    let data = filterByApplicationScope(retestTasks, applicationId);
    data = applyFilters(data, filters);
    data = data.map(hydrateRetestTask);
    return paginate(data, filters.page, filters.limit);
  },

  async getVisibleForRole(
    applicationId: ApplicationScopeFilter,
    filters: CartableFilterParams,
    userId: string,
    role: UserRole
  ): Promise<PaginatedResponse<RetestTask>> {
    await delay();
    let data = filterByApplicationScope(retestTasks, applicationId);
    data = getVisibleRetestTasksForRole(data, userId, role);
    data = applyFilters(data, filters);
    data = data.map(hydrateRetestTask);
    return paginate(data, filters.page, filters.limit);
  },

  async getByBug(bugId: string): Promise<RetestTask | null> {
    await delay();
    const task = getOpenRetestTaskForBug(bugId);
    return task ? hydrateRetestTask(task) : null;
  },

  async ensureForBug(bugId: string, userId: string, metadata?: CommandMetadata): Promise<RetestTask | null> {
    await delay();
    const command = resolveCommandMetadata('retestTask.ensureForBug', metadata, `bug:${bugId}:retest-ready`);
    const replayed = getIdempotentResult<RetestTask | null>(command);
    if (replayed) {
      createCommandTrace(command, 'REPLAYED', userId, replayed.applicationId, 'RETEST_TASK', replayed.id);
      return hydrateRetestTask(replayed);
    }

    const bug = bugs.find(b => b.id === bugId);
    if (!bug || bug.status !== 'RETEST_READY') return null;
    const task = ensureRetestTaskForBug(bug, userId, command);
    if (!task) {
      createCommandTrace(command, 'COMPLETED', userId, bug.applicationId, 'RETEST_TASK', bug.id);
      return rememberIdempotentResult(command, null);
    }
    createCommandTrace(command, 'COMPLETED', userId, task.applicationId, 'RETEST_TASK', task.id);
    return hydrateRetestTask(rememberIdempotentResult(command, task));
  },

  async start(
    id: string,
    userId: string,
    metadata?: CommandMetadata
  ): Promise<{ task: RetestTask; run: TestRun }> {
    await delay();
    const command = resolveCommandMetadata('retestTask.start', metadata, `retest-task:${id}:start`);
    const replayed = getIdempotentResult<{ task: RetestTask; run: TestRun }>(command);
    if (replayed) {
      createCommandTrace(command, 'REPLAYED', userId, replayed.task.applicationId, 'RETEST_TASK', id);
      return {
        task: hydrateRetestTask(replayed.task),
        run: hydrateTestRun(replayed.run),
      };
    }

    const task = retestTasks.find(t => t.id === id);
    if (!task) {
      throw new Error('RETEST_TASK_NOT_FOUND');
    }
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
      throw new Error('RETEST_TASK_CLOSED');
    }

    const existingRun = task.createdRunId ? testRuns.find(r => r.id === task.createdRunId) : undefined;
    if (task.status === 'IN_PROGRESS' && existingRun) {
      const result = { task, run: existingRun };
      createCommandTrace(command, 'COMPLETED', userId, task.applicationId, 'RETEST_TASK', task.id);
      rememberIdempotentResult(command, result);
      return { task: hydrateRetestTask(task), run: hydrateTestRun(existingRun) };
    }

    const previousRun = testRuns.find(r => r.id === task.previousRunId);
    if (!previousRun) {
      throw new Error('RETEST_TASK_REQUIRES_PREVIOUS_RUN');
    }
    const sourceBug = bugs.find(b => b.id === task.bugId);

    const run = await testRunApi.create(
      {
        testCaseId: task.testCaseId,
        testRequestId: task.testRequestId,
        version: sourceBug?.fixedVersion || previousRun.version,
        buildNumber: previousRun.buildNumber,
        purposes: task.purposes,
        previousRunId: task.previousRunId,
        retestTaskId: task.id,
        sourceBugId: task.bugId,
      },
      userId,
      task.applicationId,
      command
    );
    const previous = { status: task.status, createdRunId: task.createdRunId };
    task.status = 'IN_PROGRESS';
    task.startedById = userId;
    task.startedAt = task.startedAt || new Date().toISOString();
    task.createdRunId = run.id;
    task.updatedAt = new Date().toISOString();
    createAuditLog(
      userId,
      task.applicationId,
      'RETEST_TASK',
      task.id,
      'STATUS_CHANGE',
      previous,
      { status: 'IN_PROGRESS', createdRunId: run.id },
      commandAuditMetadata(command)
    );
    const result = { task, run };
    createCommandTrace(command, 'COMPLETED', userId, task.applicationId, 'RETEST_TASK', task.id);
    rememberIdempotentResult(command, result);
    return { task: hydrateRetestTask(task), run: hydrateTestRun(run) };
  },

  async complete(id: string, userId: string, metadata?: CommandMetadata): Promise<RetestTask | null> {
    await delay();
    const command = resolveCommandMetadata('retestTask.complete', metadata, `retest-task:${id}:complete`);
    const replayed = getIdempotentResult<RetestTask | null>(command);
    if (replayed) {
      createCommandTrace(command, 'REPLAYED', userId, replayed.applicationId, 'RETEST_TASK', id);
      return hydrateRetestTask(replayed);
    }

    const task = retestTasks.find(t => t.id === id);
    if (!task || task.status === 'COMPLETED') return task ? hydrateRetestTask(task) : null;
    const previous = { status: task.status };
    task.status = 'COMPLETED';
    task.completedAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();
    createAuditLog(
      userId,
      task.applicationId,
      'RETEST_TASK',
      task.id,
      'STATUS_CHANGE',
      previous,
      { status: 'COMPLETED' },
      commandAuditMetadata(command)
    );
    createCommandTrace(command, 'COMPLETED', userId, task.applicationId, 'RETEST_TASK', task.id);
    return hydrateRetestTask(rememberIdempotentResult(command, task));
  },
};

// ============================================
// Run Issue API
// ============================================

export const runIssueApi = {
  async getAll(applicationId: ApplicationScopeFilter, filters: CartableFilterParams): Promise<PaginatedResponse<RunIssue>> {
    await delay();
    let data = filterByApplicationScope(runIssues, applicationId);
    data = applyFilters(data, filters);
    return paginate(data, filters.page, filters.limit);
  },

  async create(data: Partial<RunIssue>, userId: string, applicationId: string): Promise<RunIssue> {
    await delay();
    assertDescriptionLength(data.description, 'RUN_ISSUE_DESCRIPTION_TOO_LONG');
    const issue: RunIssue = {
      id: uuidv4(),
      testRunId: data.testRunId || '',
      applicationId,
      issueType: data.issueType || 'ENVIRONMENT',
      title: data.title || '',
      description: data.description || '',
      status: 'OPEN',
      reportedById: userId,
      reportedBy: getUserById(userId),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    runIssues.unshift(issue);
    return issue;
  },

  async resolve(id: string, resolution: string, _userId: string): Promise<RunIssue | null> {
    await delay();
    const issue = runIssues.find(ri => ri.id === id);
    if (!issue) return null;
    
    issue.status = 'RESOLVED';
    issue.resolution = resolution;
    issue.updatedAt = new Date().toISOString();
    return issue;
  },

  async getOpen(applicationId: ApplicationScopeFilter): Promise<RunIssue[]> {
    await delay();
    return runIssues.filter(
      ri => matchesApplicationScope(ri.applicationId, applicationId) && ['OPEN', 'IN_PROGRESS'].includes(ri.status)
    );
  },
};

// ============================================
// Checklist API
// ============================================

export const checklistApi = {
  async getAll(applicationId: ApplicationScopeFilter, filters: CartableFilterParams): Promise<PaginatedResponse<Checklist>> {
    await delay();
    let data = filterByApplicationScope(checklists, applicationId);
    data = applyFilters(data, filters);
    return paginate(data, filters.page, filters.limit);
  },

  async getById(id: string): Promise<Checklist | null> {
    await delay();
    const cl = checklists.find(c => c.id === id);
    if (cl && cl.reviewedById) {
      cl.reviewedBy = getUserById(cl.reviewedById);
    }
    return cl || null;
  },

  async updateItem(
    checklistId: string,
    itemId: string,
    result: string,
    notes: string,
    userId: string
  ): Promise<Checklist | null> {
    await delay();
    const cl = checklists.find(c => c.id === checklistId);
    if (!cl) return null;
    
    const item = cl.items.find(i => i.id === itemId);
    if (!item) return null;
    
    item.result = ensureChecklistResult(result);
    item.notes = notes;
    cl.status = 'IN_PROGRESS';
    cl.reviewedById = userId;
    cl.reviewedBy = getUserById(userId);
    cl.updatedAt = new Date().toISOString();
    return cl;
  },

  async complete(id: string, userId: string): Promise<Checklist | null> {
    await delay();
    const cl = checklists.find(c => c.id === id);
    if (!cl) return null;
    
    // Check if all items have results
    const allComplete = cl.items.every(i => i.result);
    if (!allComplete) return null;
    
    // Calculate overall result
    const hasFailure = cl.items.some(i => i.result === 'FAIL');
    const hasPartial = cl.items.some(i => i.result === 'PARTIAL');
    
    cl.status = 'COMPLETED';
    cl.result = hasFailure ? 'FAIL' : hasPartial ? 'PARTIAL' : 'PASS';
    cl.reviewedAt = new Date().toISOString();
    cl.updatedAt = new Date().toISOString();
    
    createAuditLog(userId, cl.applicationId, 'CHECKLIST', id, 'FINALIZE', null, { result: cl.result });
    return cl;
  },

  // Get pending checklists for security reviewer
  async getPending(applicationId: ApplicationScopeFilter): Promise<Checklist[]> {
    await delay();
    return checklists.filter(
      c => matchesApplicationScope(c.applicationId, applicationId) && ['PENDING', 'IN_PROGRESS'].includes(c.status)
    );
  },
};

// ============================================
// Playwright API
// ============================================

function clampPlaywrightRetries(value?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(3, Math.max(0, Math.trunc(value)));
}

function buildPlaywrightRunOptions(run: PlaywrightRun): string[] {
  const projects: NonNullable<PlaywrightRun['projects']> = run.projects?.length
    ? run.projects
    : ['chromium'];
  const options = projects.map(project => `--project=${project}`);
  const workers = run.workers || 'auto';
  const maxFailures = run.maxFailures || 'unlimited';
  const trace = run.trace || 'off';
  const reporter = run.reporter || 'html';

  if (run.headed) {
    options.push('--headed');
  }

  if (workers !== 'auto') {
    options.push(`--workers=${workers}`);
  }

  options.push(`--retries=${clampPlaywrightRetries(run.retries)}`);

  if (maxFailures !== 'unlimited') {
    options.push(`--max-failures=${maxFailures}`);
  }

  if (trace !== 'off') {
    options.push(`--trace=${trace}`);
  }

  options.push(`--reporter=${reporter}`);
  return options;
}

function buildPlaywrightCommand(run: PlaywrightRun): string {
  const baseCommand = systemIntegrationSettings.playwright.commandTemplate
    .replace('{testFilePath}', run.testFilePath)
    .replace('{environment}', run.environment)
    .trim();
  return [baseCommand, ...buildPlaywrightRunOptions(run)].filter(Boolean).join(' ');
}

type PlaywrightReportArtifactSpec = {
  fileName: string;
  mimeType: string;
  label: string;
};

const PLAYWRIGHT_REPORT_ARTIFACTS: Record<NonNullable<PlaywrightRun['reporter']>, PlaywrightReportArtifactSpec> = {
  html: {
    fileName: 'playwright-report.html',
    mimeType: 'text/html',
    label: 'HTML',
  },
  json: {
    fileName: 'playwright-report.json',
    mimeType: 'application/json',
    label: 'JSON',
  },
  junit: {
    fileName: 'playwright-report.xml',
    mimeType: 'application/xml',
    label: 'JUnit XML',
  },
};

function getPlaywrightReportArtifactSpec(run: PlaywrightRun): PlaywrightReportArtifactSpec {
  return PLAYWRIGHT_REPORT_ARTIFACTS[run.reporter || 'html'];
}

function createPlaywrightArtifact(
  run: PlaywrightRun,
  fileName: string,
  type: Attachment['type'],
  mimeType?: string
): Attachment {
  const now = new Date().toISOString();
  const artifact: Attachment = {
    id: uuidv4(),
    entityType: 'PLAYWRIGHT_RUN',
    entityId: run.id,
    type,
    fileName,
    fileSize: Math.floor(Math.random() * 700000) + 100000,
    mimeType: mimeType || (type === 'TRACE' ? 'application/zip' : type === 'REPORT' ? 'text/html' : 'text/plain'),
    storagePath: `${systemIntegrationSettings.playwright.artifactRoot}/${run.id}/${fileName}`,
    status: 'VALID',
    uploadedById: run.triggeredById,
    uploadedBy: getUserById(run.triggeredById),
    createdAt: now,
    updatedAt: now,
  };
  attachments.unshift(artifact);
  return artifact;
}

function escapeReportText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getPlaywrightRunScript(run: PlaywrightRun): string {
  const managedFile = playwrightTestFiles.find(file => file.fullPath === run.testFilePath);
  if (managedFile) return managedFile.script;
  const fileName = run.testFilePath.split(/[\\/]/).pop() || 'scenario.spec.ts';
  return defaultPlaywrightScript(fileName);
}

function createPlaywrightFailures(run: PlaywrightRun): PlaywrightReportFailure[] {
  const failureCount = Math.max(1, run.failedTests || 1);
  const projects: NonNullable<PlaywrightRun['projects']> = run.projects?.length
    ? run.projects
    : ['chromium'];
  const lines = getPlaywrightRunScript(run).split(/\r?\n/);
  const expectLineIndex = lines.findIndex(line => line.includes('expect('));
  const fallbackLineIndex = lines.findIndex(line => line.trim().startsWith('await '));
  const baseLineIndex = expectLineIndex >= 0 ? expectLineIndex : Math.max(0, fallbackLineIndex);
  const fileName = run.testFilePath.split(/[\\/]/).pop()?.replace(/\.spec\.ts$/, '') || 'playwright scenario';

  return Array.from({ length: failureCount }, (_, index) => {
    const lineIndex = Math.min(lines.length - 1, Math.max(0, baseLineIndex + (index % 2)));
    const line = lineIndex + 1;
    const lineText = lines[lineIndex] || '';
    const column = Math.max(1, lineText.search(/\S/) + 1);
    const snippetStart = Math.max(0, lineIndex - 2);
    const snippetEnd = Math.min(lines.length, lineIndex + 3);
    return {
      title: `${fileName} › scenario ${index + 1}`,
      project: projects[index % projects.length] ?? 'chromium',
      filePath: run.testFilePath,
      line,
      column,
      message: `Error: expect(locator).toBeVisible() failed\nLocator resolved to hidden element in ${run.testFilePath}:${line}:${column}`,
      expected: 'visible',
      received: 'hidden',
      durationMs: 900 + (index + 1) * 170,
      snippet: lines.slice(snippetStart, snippetEnd).map((text, offset) => {
        const lineNumber = snippetStart + offset + 1;
        return {
          lineNumber,
          text,
          highlighted: lineNumber === line,
        };
      }),
    };
  });
}

function createPlaywrightTestItems(
  run: PlaywrightRun,
  status: PlaywrightReportTestItem['status'],
  count: number,
  offset: number
): PlaywrightReportTestItem[] {
  const projects: NonNullable<PlaywrightRun['projects']> = run.projects?.length
    ? run.projects
    : ['chromium'];
  const fileName = run.testFilePath.split(/[\\/]/).pop()?.replace(/\.spec\.ts$/, '') || 'playwright scenario';
  const statusLabel = status === 'passed' ? 'passed' : status === 'skipped' ? 'skipped' : 'cancelled';

  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    title: `${fileName} › ${statusLabel} test ${offset + index + 1}`,
    project: projects[(offset + index) % projects.length] ?? 'chromium',
    filePath: run.testFilePath,
    status,
    durationMs: status === 'cancelled' ? 0 : status === 'skipped' ? 12 : 520 + ((offset + index) % 5) * 140,
  }));
}

function renderReportTestList(title: string, items: PlaywrightReportTestItem[]): string {
  if (!items.length) return '';
  return `
    <section class="test-list">
      <h2>${escapeReportText(title)}</h2>
      <ul>
        ${items.map(item => `<li><strong>${escapeReportText(item.title)}</strong><span>${escapeReportText(item.project)} · ${escapeReportText(item.status)} · ${item.durationMs}ms</span></li>`).join('')}
      </ul>
    </section>
  `;
}

function renderPlaywrightHtmlReport(
  run: PlaywrightRun,
  failures: PlaywrightReportFailure[],
  passed: PlaywrightReportTestItem[],
  skipped: PlaywrightReportTestItem[],
  cancelled: PlaywrightReportTestItem[],
  generatedAt: string
): string {
  const status = run.status === 'PASSED' ? 'passed' : run.status === 'CANCELLED' ? 'cancelled' : 'failed';
  const failureBlocks = failures.length
    ? failures.map(failure => `
      <section class="failure">
        <h2>${escapeReportText(failure.title)}</h2>
        <p class="location">${escapeReportText(failure.project)} · ${escapeReportText(failure.filePath)}:${failure.line}:${failure.column}</p>
        <pre class="message">${escapeReportText(failure.message)}</pre>
        <pre class="snippet">${failure.snippet.map(line =>
          `<span class="${line.highlighted ? 'highlight' : ''}">${String(line.lineNumber).padStart(4, ' ')} | ${escapeReportText(line.text)}</span>`
        ).join('\n')}</pre>
      </section>
    `).join('')
    : run.status === 'CANCELLED'
      ? '<section class="success">Run was cancelled. See cancelled tests below.</section>'
      : '<section class="success">No failed tests.</section>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Playwright Report - ${escapeReportText(run.testFilePath)}</title>
  <style>
    body { margin: 0; padding: 24px; font-family: Inter, Segoe UI, Arial, sans-serif; color: #111827; background: #f8fafc; }
    .shell { max-width: 1100px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 20px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .path { font-family: Consolas, monospace; color: #475569; word-break: break-all; }
    .badge { border-radius: 999px; padding: 6px 12px; font-weight: 700; text-transform: uppercase; background: ${status === 'passed' ? '#dcfce7' : status === 'cancelled' ? '#fef3c7' : '#fee2e2'}; color: ${status === 'passed' ? '#166534' : status === 'cancelled' ? '#92400e' : '#991b1b'}; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
    .stat { background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; }
    .stat strong { display: block; font-size: 24px; }
    .failure, .success { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .test-list { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .test-list h2 { margin: 0 0 10px; font-size: 16px; }
    .test-list ul { margin: 0; padding: 0; list-style: none; }
    .test-list li { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; border-top: 1px solid #eef2f7; }
    .test-list li:first-child { border-top: 0; }
    .test-list span { color: #64748b; font-family: Consolas, monospace; font-size: 12px; }
    .failure h2 { margin: 0 0 6px; font-size: 18px; color: #991b1b; }
    .location { margin: 0 0 12px; color: #475569; font-family: Consolas, monospace; }
    pre { overflow: auto; border-radius: 10px; padding: 12px; }
    .message { background: #111827; color: #fecaca; white-space: pre-wrap; }
    .snippet { background: #0f172a; color: #d1d5db; }
    .snippet span { display: block; }
    .snippet .highlight { background: rgba(239, 68, 68, .25); color: #fff; }
  </style>
</head>
<body>
  <main class="shell">
    <div class="header">
      <div>
        <h1>Playwright Test Report</h1>
        <div class="path">${escapeReportText(run.testFilePath)}</div>
        <div>Generated at ${escapeReportText(new Date(generatedAt).toLocaleString('fa-IR'))}</div>
      </div>
      <span class="badge">${status}</span>
    </div>
    <div class="stats">
      <div class="stat"><span>Total</span><strong>${run.totalTests || 0}</strong></div>
      <div class="stat"><span>Passed</span><strong>${run.passedTests || 0}</strong></div>
      <div class="stat"><span>Failed</span><strong>${run.failedTests || 0}</strong></div>
      <div class="stat"><span>Skipped</span><strong>${run.skippedTests || 0}</strong></div>
    </div>
    ${failureBlocks}
    ${renderReportTestList('Passed tests', passed)}
    ${renderReportTestList('Skipped tests', skipped)}
    ${renderReportTestList('Cancelled tests', cancelled)}
  </main>
</body>
</html>`;
}

function renderPlaywrightJsonReport(
  run: PlaywrightRun,
  failures: PlaywrightReportFailure[],
  passed: PlaywrightReportTestItem[],
  skipped: PlaywrightReportTestItem[],
  cancelled: PlaywrightReportTestItem[],
  generatedAt: string
): string {
  return JSON.stringify({
    config: {
      reporter: run.reporter || 'html',
      projects: run.projects?.length ? run.projects : ['chromium'],
      command: run.command,
    },
    stats: {
      startTime: run.startedAt,
      generatedAt,
      duration: run.duration || 0,
      expected: run.passedTests || 0,
      unexpected: run.failedTests || 0,
      skipped: run.skippedTests || 0,
      cancelled: run.cancelledTests || 0,
      total: run.totalTests || 0,
    },
    tests: {
      passed,
      failed: failures,
      skipped,
      cancelled,
    },
    suites: [
      {
        title: run.testFilePath,
        specs: failures.length
          ? failures.map(failure => ({
              title: failure.title,
              file: failure.filePath,
              line: failure.line,
              column: failure.column,
              tests: [
                {
                  projectName: failure.project,
                  status: 'failed',
                  duration: failure.durationMs,
                  errors: [
                    {
                      message: failure.message,
                      location: {
                        file: failure.filePath,
                        line: failure.line,
                        column: failure.column,
                      },
                      snippet: failure.snippet,
                    },
                  ],
                },
              ],
            }))
          : [
              {
                title: `${run.testFilePath} › all tests`,
                file: run.testFilePath,
                tests: [
                  {
                    projectName: run.projects?.[0] || 'chromium',
                    status: 'passed',
                    duration: run.duration ? run.duration * 1000 : 0,
                    errors: [],
                  },
                ],
              },
            ],
      },
    ],
  }, null, 2);
}

function renderPlaywrightJunitReport(
  run: PlaywrightRun,
  failures: PlaywrightReportFailure[],
  passed: PlaywrightReportTestItem[],
  skipped: PlaywrightReportTestItem[],
  cancelled: PlaywrightReportTestItem[]
): string {
  const durationSeconds = run.duration || 0;
  const failureCases = failures.map(failure => {
        const snippet = failure.snippet
          .map(line => `${String(line.lineNumber).padStart(4, ' ')} | ${line.text}`)
          .join('\n');
        const firstFailureLine = failure.message.split('\n')[0] ?? failure.message;
        return `    <testcase classname="${escapeReportText(failure.project)}.${escapeReportText(run.testFilePath)}" name="${escapeReportText(failure.title)}" time="${(failure.durationMs / 1000).toFixed(3)}">
      <failure message="${escapeReportText(firstFailureLine)}" type="AssertionError">${escapeReportText(`${failure.filePath}:${failure.line}:${failure.column}\n${failure.message}\n\n${snippet}`)}</failure>
    </testcase>`;
      }).join('\n');
  const passedCases = passed.map(item =>
    `    <testcase classname="${escapeReportText(item.project)}.${escapeReportText(item.filePath)}" name="${escapeReportText(item.title)}" time="${(item.durationMs / 1000).toFixed(3)}" />`
  ).join('\n');
  const skippedCases = skipped.map(item =>
    `    <testcase classname="${escapeReportText(item.project)}.${escapeReportText(item.filePath)}" name="${escapeReportText(item.title)}" time="${(item.durationMs / 1000).toFixed(3)}"><skipped /></testcase>`
  ).join('\n');
  const cancelledCases = cancelled.map(item =>
    `    <testcase classname="${escapeReportText(item.project)}.${escapeReportText(item.filePath)}" name="${escapeReportText(item.title)}" time="0"><skipped message="cancelled by runner" /></testcase>`
  ).join('\n');
  const testCases = [failureCases, passedCases, skippedCases, cancelledCases].filter(Boolean).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites id="" name="" tests="${run.totalTests || 0}" failures="${run.failedTests || 0}" skipped="${(run.skippedTests || 0) + (run.cancelledTests || 0)}" errors="0" time="${durationSeconds.toFixed(3)}">
  <testsuite name="${escapeReportText(run.testFilePath)}" timestamp="${escapeReportText(run.startedAt || '')}" tests="${run.totalTests || 0}" failures="${run.failedTests || 0}" skipped="${(run.skippedTests || 0) + (run.cancelledTests || 0)}" time="${durationSeconds.toFixed(3)}">
${testCases}
  </testsuite>
</testsuites>`;
}

function createPlaywrightReport(
  run: PlaywrightRun,
  reportSpec: PlaywrightReportArtifactSpec,
  reportArtifact: Attachment,
  generatedAt: string
): PlaywrightReport {
  const failures = run.failedTests ? createPlaywrightFailures(run) : [];
  const passed = createPlaywrightTestItems(run, 'passed', run.passedTests || 0, 0);
  const skipped = createPlaywrightTestItems(run, 'skipped', run.skippedTests || 0, passed.length);
  const cancelled = createPlaywrightTestItems(run, 'cancelled', run.cancelledTests || 0, passed.length + skipped.length);
  const reporter = run.reporter || 'html';
  const content = reporter === 'json'
    ? renderPlaywrightJsonReport(run, failures, passed, skipped, cancelled, generatedAt)
    : reporter === 'junit'
      ? renderPlaywrightJunitReport(run, failures, passed, skipped, cancelled)
      : renderPlaywrightHtmlReport(run, failures, passed, skipped, cancelled, generatedAt);

  return {
    reporter,
    fileName: reportSpec.fileName,
    mimeType: reportSpec.mimeType,
    storagePath: reportArtifact.storagePath,
    generatedAt,
    status: run.status,
    totalTests: run.totalTests || 0,
    passedTests: run.passedTests || 0,
    failedTests: run.failedTests || 0,
    skippedTests: run.skippedTests || 0,
    cancelledTests: run.cancelledTests || 0,
    durationMs: (run.duration || 0) * 1000,
    failures,
    passed,
    skipped,
    cancelled,
    content,
  };
}

function dispatchPlaywrightRun(id: string): void {
  const run = playwrightRuns.find(pr => pr.id === id);
  if (!run || run.status !== 'PENDING') return;

  run.status = 'RUNNING';
  run.queueStatus = 'DISPATCHED';
  run.runnerId = systemIntegrationSettings.playwright.runnerId || `runner-${run.applicationId}`;
  run.dispatchedAt = new Date().toISOString();
  run.startedAt = run.dispatchedAt;
  run.lastHeartbeatAt = run.dispatchedAt;
  run.updatedAt = run.dispatchedAt;

  const durationMs = Math.min((run.timeoutSeconds || 120) * 100, 5000);
  const timer = setTimeout(() => completePlaywrightRun(id), durationMs);
  playwrightTimers.set(id, timer);
}

function completePlaywrightRun(id: string): void {
  const run = playwrightRuns.find(pr => pr.id === id);
  if (!run || run.status !== 'RUNNING') return;

  const deterministicSeed = run.testFilePath.length + run.environment.length;
  const success = deterministicSeed % 4 !== 0;
  const now = new Date().toISOString();
  const reportSpec = getPlaywrightReportArtifactSpec(run);
  const logFile = createPlaywrightArtifact(run, 'runner.log', 'LOG');
  const reportFile = createPlaywrightArtifact(run, reportSpec.fileName, 'REPORT', reportSpec.mimeType);
  const traceFile = createPlaywrightArtifact(run, 'trace.zip', 'TRACE');

  run.status = success ? 'PASSED' : 'FAILED';
  run.queueStatus = 'DONE';
  run.completedAt = now;
  run.duration = run.startedAt ? Math.max(1, Math.round((Date.parse(now) - Date.parse(run.startedAt)) / 1000)) : 0;
  run.totalTests = 10;
  run.failedTests = success ? 0 : 3;
  run.skippedTests = 1;
  run.cancelledTests = !success && run.maxFailures !== 'unlimited' ? 1 : 0;
  run.passedTests = Math.max(0, run.totalTests - run.failedTests - run.skippedTests - run.cancelledTests);
  run.artifactIds = [logFile.id, reportFile.id, traceFile.id];
  run.artifactPaths = [logFile.storagePath, reportFile.storagePath, traceFile.storagePath];
  run.report = createPlaywrightReport(run, reportSpec, reportFile, now);
  run.logs = success
    ? `Runner ${run.runnerId} completed ${run.command}\nAll tests passed. ${reportSpec.label} report generated: ${reportFile.storagePath}`
    : `Runner ${run.runnerId} completed ${run.command}\nError: Some tests failed. ${reportSpec.label} report generated: ${reportFile.storagePath}\nTrace artifact is available: ${traceFile.storagePath}`;
  run.updatedAt = now;
  playwrightTimers.delete(id);
}

function normalizeCdeRoot(value?: string): string {
  return (value || '').trim().replace(/[\\/]+$/, '');
}

const PLAYWRIGHT_TEST_FILE_NAME_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*\.spec\.ts$/;

const CDE_ROOT_FOLDERS: Record<PlaywrightCdeRootKind, string[]> = {
  FRONT: ['tests/e2e', 'tests/e2e/auth', 'tests/e2e/smoke', 'tests/e2e/regression'],
  DATASERVICE: ['tests/api', 'tests/api/contracts', 'tests/api/data-service', 'tests/api/regression'],
  GATEWAY: ['tests/api', 'tests/api/gateway', 'tests/api/gateway/auth', 'tests/api/gateway/routing'],
};

const CDE_TEST_FILE_TEMPLATES: Record<PlaywrightCdeRootKind, Array<{ folder: string; fileName: string }>> = {
  FRONT: [
    { folder: 'tests/e2e', fileName: 'app-shell.spec.ts' },
    { folder: 'tests/e2e', fileName: 'auth-flow.spec.ts' },
    { folder: 'tests/e2e/smoke', fileName: 'smoke-navigation.spec.ts' },
  ],
  DATASERVICE: [
    { folder: 'tests/api', fileName: 'data-contract.spec.ts' },
    { folder: 'tests/api', fileName: 'business-rules.spec.ts' },
    { folder: 'tests/api/contracts', fileName: 'schema-validation.spec.ts' },
  ],
  GATEWAY: [
    { folder: 'tests/api/gateway', fileName: 'routing.spec.ts' },
    { folder: 'tests/api/gateway', fileName: 'auth.spec.ts' },
  ],
};

function cdeRootsForApplication(app: Application): Array<{ kind: PlaywrightCdeRootKind; root: string }> {
  const roots: Array<{ kind: PlaywrightCdeRootKind; root: string }> = [
    { kind: 'FRONT', root: normalizeCdeRoot(app.cdeFrontUrl) },
    { kind: 'DATASERVICE', root: normalizeCdeRoot(app.cdeDataServiceUrl) },
    { kind: 'GATEWAY', root: normalizeCdeRoot(app.cdeGatewayUrl) },
  ];
  return roots.filter(item => !!item.root);
}

function cdeTestFoldersForApplication(app: Application): PlaywrightTestFolder[] {
  return cdeRootsForApplication(app).flatMap(({ kind, root }) =>
    CDE_ROOT_FOLDERS[kind].map(relativePath => ({
      id: `${app.id}:${kind}:${relativePath}`,
      applicationId: app.id,
      rootKind: kind,
      rootUrl: root,
      relativePath,
      fullPath: `${root}/${relativePath}`,
    }))
  );
}

function defaultPlaywrightScript(fileName: string): string {
  const title = fileName.replace(/\.spec\.ts$/, '').replace(/-/g, ' ');
  return `import { test, expect } from '@playwright/test';\n\n` +
    `test('${title}', async ({ page }) => {\n` +
    `  await page.goto('/');\n` +
    `  await expect(page).toHaveTitle(/./);\n` +
    `});\n`;
}

function cdeDiscoveredTestFilesForApplication(app: Application): PlaywrightTestFile[] {
  const folders = cdeTestFoldersForApplication(app);
  return cdeRootsForApplication(app).flatMap(({ kind, root }) =>
    CDE_TEST_FILE_TEMPLATES[kind].flatMap(template => {
      const folder = folders.find(item => item.rootKind === kind && item.relativePath === template.folder);
      if (!folder) return [];
      const fullPath = `${root}/${template.folder}/${template.fileName}`;
      if (hiddenDiscoveredPlaywrightPaths.has(fullPath)) return [];
      return [{
        id: `discovered:${app.id}:${kind}:${template.folder}/${template.fileName}`,
        applicationId: app.id,
        rootKind: kind,
        rootUrl: root,
        source: 'DISCOVERED' as const,
        folderPath: folder.fullPath,
        relativeFolderPath: folder.relativePath,
        fileName: template.fileName,
        fullPath,
        script: defaultPlaywrightScript(template.fileName),
        description: 'فایل تست کشف‌شده از ریشه CDE سامانه.',
        createdById: 'user-admin',
        createdBy: getUserById('user-admin'),
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      }];
    })
  );
}

function cdeTestFilesForApplication(app: Application): string[] {
  return cdeDiscoveredTestFilesForApplication(app).map(file => file.fullPath);
}

function getAllPlaywrightTestFiles(applicationId: ApplicationScopeFilter): PlaywrightTestFile[] {
  const discovered = mutableApplications
    .filter(app => app.isActive && matchesApplicationScope(app.id, applicationId))
    .flatMap(cdeDiscoveredTestFilesForApplication);
  const managed = filterByApplicationScope(playwrightTestFiles, applicationId);
  const managedPaths = new Set(managed.map(file => file.fullPath));
  return [
    ...managed.map(file => ({ ...file, createdBy: getUserById(file.createdById) })),
    ...discovered.filter(file => !managedPaths.has(file.fullPath)),
  ];
}

function assertPlaywrightFilePayload(data: {
  applicationId: string;
  folderPath: string;
  fileName: string;
  script: string;
  description?: string;
}): {
  application: Application;
  folder: PlaywrightTestFolder;
  fileName: string;
  script: string;
  fullPath: string;
} {
  const application = mutableApplications.find(app => app.id === data.applicationId && app.isActive);
  if (!application) {
    throw new Error('APPLICATION_NOT_FOUND');
  }

  const folder = cdeTestFoldersForApplication(application).find(item => item.fullPath === data.folderPath);
  if (!folder) {
    throw new Error('PLAYWRIGHT_FOLDER_NOT_FOUND');
  }

  const fileName = data.fileName.trim();
  if (!PLAYWRIGHT_TEST_FILE_NAME_REGEX.test(fileName)) {
    throw new Error('INVALID_PLAYWRIGHT_TEST_FILE_NAME');
  }

  const script = data.script.trim();
  if (!script) {
    throw new Error('PLAYWRIGHT_SCRIPT_REQUIRED');
  }

  assertDescriptionLength(data.description, 'PLAYWRIGHT_FILE_DESCRIPTION_TOO_LONG');
  return {
    application,
    folder,
    fileName,
    script,
    fullPath: `${folder.fullPath}/${fileName}`,
  };
}

export const playwrightApi = {
  async getAll(applicationId: ApplicationScopeFilter, filters: CartableFilterParams): Promise<PaginatedResponse<PlaywrightRun>> {
    await delay();
    let data = filterByApplicationScope(playwrightRuns, applicationId);
    data = applyFilters(data, filters);
    data = data.map(pr => ({
      ...pr,
      triggeredBy: getUserById(pr.triggeredById),
    }));
    return paginate(data, filters.page, filters.limit);
  },

  async getById(id: string): Promise<PlaywrightRun | null> {
    await delay();
    const run = playwrightRuns.find(pr => pr.id === id);
    if (run) {
      run.triggeredBy = getUserById(run.triggeredById);
    }
    return run || null;
  },

  async getTestFiles(applicationId: ApplicationScopeFilter, filters: CartableFilterParams): Promise<PaginatedResponse<PlaywrightTestFile>> {
    await delay();
    let data = getAllPlaywrightTestFiles(applicationId);
    data = applyFilters(data, filters);
    return paginate(data, filters.page, filters.limit);
  },

  async discoverFolders(applicationId: ApplicationScopeFilter): Promise<PlaywrightTestFolder[]> {
    await delay();
    return mutableApplications
      .filter(app => app.isActive && matchesApplicationScope(app.id, applicationId))
      .flatMap(cdeTestFoldersForApplication)
      .sort((a, b) => a.fullPath.localeCompare(b.fullPath));
  },

  async createTestFile(
    data: {
      applicationId: string;
      folderPath: string;
      fileName: string;
      script: string;
      description?: string;
    },
    userId: string
  ): Promise<PlaywrightTestFile> {
    await delay();
    const { application, folder, fileName, script, fullPath } = assertPlaywrightFilePayload(data);
    if (getAllPlaywrightTestFiles(application.id).some(file => file.fullPath === fullPath)) {
      throw new Error('PLAYWRIGHT_TEST_FILE_ALREADY_EXISTS');
    }

    const now = new Date().toISOString();
    const file: PlaywrightTestFile = {
      id: uuidv4(),
      applicationId: application.id,
      rootKind: folder.rootKind,
      rootUrl: folder.rootUrl,
      source: 'MANAGED',
      folderPath: folder.fullPath,
      relativeFolderPath: folder.relativePath,
      fileName,
      fullPath,
      script,
      description: data.description?.trim() || undefined,
      createdById: userId,
      createdBy: getUserById(userId),
      createdAt: now,
      updatedAt: now,
    };

    playwrightTestFiles.unshift(file);
    createAuditLog(userId, application.id, 'PLAYWRIGHT_TEST_FILE', file.id, 'CREATE', null, {
      fullPath: file.fullPath,
      rootKind: file.rootKind,
      description: file.description,
    });
    return file;
  },

  async updateTestFile(
    id: string,
    data: {
      applicationId: string;
      folderPath: string;
      fileName: string;
      script: string;
      description?: string;
    },
    userId: string
  ): Promise<PlaywrightTestFile | null> {
    await delay();
    const existing = getAllPlaywrightTestFiles(undefined).find(file => file.id === id);
    if (!existing) return null;
    const { application, folder, fileName, script, fullPath } = assertPlaywrightFilePayload(data);
    const duplicate = getAllPlaywrightTestFiles(undefined).some(file => file.id !== id && file.fullPath === fullPath);
    if (duplicate) {
      throw new Error('PLAYWRIGHT_TEST_FILE_ALREADY_EXISTS');
    }

    const previous = { ...existing };
    const updated: PlaywrightTestFile = {
      ...existing,
      applicationId: application.id,
      rootKind: folder.rootKind,
      rootUrl: folder.rootUrl,
      source: 'MANAGED',
      folderPath: folder.fullPath,
      relativeFolderPath: folder.relativePath,
      fileName,
      fullPath,
      script,
      description: data.description?.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    const managedIndex = playwrightTestFiles.findIndex(file => file.id === id);
    if (managedIndex >= 0) {
      playwrightTestFiles[managedIndex] = updated;
    } else {
      playwrightTestFiles.unshift(updated);
    }
    if (id.startsWith('discovered:') && previous.fullPath !== updated.fullPath) {
      hiddenDiscoveredPlaywrightPaths.add(previous.fullPath);
    }

    createAuditLog(userId, application.id, 'PLAYWRIGHT_TEST_FILE', updated.id, 'UPDATE', previous, updated);
    return { ...updated, createdBy: getUserById(updated.createdById) };
  },

  async start(
    data: Partial<PlaywrightRun>,
    userId: string,
    applicationId: string,
    metadata?: CommandMetadata
  ): Promise<PlaywrightRun> {
    await delay();
    const command = resolveCommandMetadata('playwright.start', metadata);
    const replayed = getIdempotentResult<PlaywrightRun>(command);
    if (replayed) {
      createCommandTrace(command, 'REPLAYED', userId, replayed.applicationId, 'PLAYWRIGHT_RUN', replayed.id);
      return replayed;
    }

    if (!systemIntegrationSettings.playwright.enabled) {
      throw new Error('PLAYWRIGHT_DISABLED');
    }

    if (!data.testFilePath?.trim()) {
      throw new Error('PLAYWRIGHT_FILE_REQUIRED');
    }
    const now = new Date().toISOString();
    const run: PlaywrightRun = {
      id: uuidv4(),
      applicationId,
      testRequestId: data.testRequestId,
      testCaseIds: data.testCaseIds || [],
      testFilePath: data.testFilePath.trim(),
      environment: data.environment || 'staging',
      projects: data.projects?.length ? data.projects : ['chromium'],
      headed: data.headed ?? false,
      workers: data.workers || 'auto',
      retries: clampPlaywrightRetries(data.retries),
      maxFailures: data.maxFailures || 'unlimited',
      trace: data.trace || 'retain-on-failure',
      reporter: data.reporter || 'html',
      status: 'PENDING',
      queueStatus: 'QUEUED',
      workingDirectory: data.workingDirectory || systemIntegrationSettings.playwright.defaultWorkingDirectory,
      timeoutSeconds: data.timeoutSeconds || systemIntegrationSettings.playwright.defaultTimeoutSeconds,
      manualPath: data.manualPath ?? false,
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      triggeredById: userId,
      triggeredBy: getUserById(userId),
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    run.command = buildPlaywrightCommand(run);
    playwrightRuns.unshift(run);
    createAuditLog(
      userId,
      applicationId,
      'PLAYWRIGHT_RUN',
      run.id,
      'CREATE',
      null,
      run,
      commandAuditMetadata(command)
    );
    createCommandTrace(command, 'COMPLETED', userId, applicationId, 'PLAYWRIGHT_RUN', run.id);
    rememberIdempotentResult(command, run);
    const dispatchTimer = setTimeout(() => dispatchPlaywrightRun(run.id), 500);
    playwrightTimers.set(`${run.id}:dispatch`, dispatchTimer);
    
    return run;
  },

  async cancel(id: string, userId: string, metadata?: CommandMetadata): Promise<PlaywrightRun | null> {
    await delay();
    const command = resolveCommandMetadata('playwright.cancel', metadata, `playwright:${id}:cancel`);
    const replayed = getIdempotentResult<PlaywrightRun | null>(command);
    if (replayed) {
      createCommandTrace(command, 'REPLAYED', userId, replayed.applicationId, 'PLAYWRIGHT_RUN', id);
      return replayed;
    }

    const run = playwrightRuns.find(pr => pr.id === id);
    if (!run) return null;
    if (run.status === 'CANCELLED') return run;
    if (!['PENDING', 'RUNNING'].includes(run.status)) return null;
    
    playwrightTimers.get(id) && clearTimeout(playwrightTimers.get(id)!);
    playwrightTimers.get(`${id}:dispatch`) && clearTimeout(playwrightTimers.get(`${id}:dispatch`)!);
    playwrightTimers.delete(id);
    playwrightTimers.delete(`${id}:dispatch`);
    const previous = { status: run.status, queueStatus: run.queueStatus };
    run.status = 'CANCELLED';
    run.queueStatus = 'DONE';
    const now = new Date().toISOString();
    run.completedAt = now;
    run.duration = run.startedAt ? Math.max(1, Math.round((Date.parse(now) - Date.parse(run.startedAt)) / 1000)) : 0;
    run.totalTests = 10;
    run.passedTests = Math.min(2, run.totalTests);
    run.failedTests = 0;
    run.skippedTests = 0;
    run.cancelledTests = Math.max(0, run.totalTests - run.passedTests);
    const reportSpec = getPlaywrightReportArtifactSpec(run);
    const logFile = createPlaywrightArtifact(run, 'runner.log', 'LOG');
    const reportFile = createPlaywrightArtifact(run, reportSpec.fileName, 'REPORT', reportSpec.mimeType);
    const traceFile = createPlaywrightArtifact(run, 'trace.zip', 'TRACE');
    run.artifactIds = [logFile.id, reportFile.id, traceFile.id];
    run.artifactPaths = [logFile.storagePath, reportFile.storagePath, traceFile.storagePath];
    run.report = createPlaywrightReport(run, reportSpec, reportFile, now);
    run.logs = `Runner ${run.runnerId || systemIntegrationSettings.playwright.runnerId} cancelled ${run.command}\n${reportSpec.label} report generated for the partial run: ${reportFile.storagePath}`;
    run.updatedAt = now;
    createAuditLog(
      userId,
      run.applicationId,
      'PLAYWRIGHT_RUN',
      id,
      'CANCEL',
      previous,
      { status: 'CANCELLED' },
      commandAuditMetadata(command)
    );
    createCommandTrace(command, 'COMPLETED', userId, run.applicationId, 'PLAYWRIGHT_RUN', id);
    return rememberIdempotentResult(command, run);
  },

  async discoverFiles(applicationId: ApplicationScopeFilter): Promise<string[]> {
    await delay();
    if (!systemIntegrationSettings.playwright.enabled) {
      return [];
    }
    const managedFiles = filterByApplicationScope(playwrightTestFiles, applicationId).map(file => file.fullPath);
    if (!systemIntegrationSettings.playwright.autoDiscovery) {
      return Array.from(new Set(managedFiles)).sort();
    }
    const cdeFiles = mutableApplications
      .filter(app => matchesApplicationScope(app.id, applicationId))
      .flatMap(cdeTestFilesForApplication);
    const discoveredAndManaged = Array.from(new Set([...cdeFiles, ...managedFiles])).sort();
    if (discoveredAndManaged.length > 0) {
      return discoveredAndManaged;
    }
    // Mock file discovery
    return [
      'tests/auth/login.spec.ts',
      'tests/auth/two-factor.spec.ts',
      'tests/transfer/scheduled-transfer.spec.ts',
      'tests/transfer/instant-transfer.spec.ts',
      'tests/reports/financial-report.spec.ts',
      'tests/reports/statement.spec.ts',
    ];
  },
};

// ============================================
// VersionHistory helpers
// ============================================

const FINAL_RUN_STATUSES: TestRunStatus[] = ['PASSED', 'FAILED', 'BLOCKED', 'SKIPPED'];
const CLOSED_BUG_STATUSES: BugStatus[] = ['CLOSED', 'REJECTED', 'RETEST_PASSED', 'NO_ACTION_NEEDED'];

function uniqueIds(ids: Array<string | undefined>): string[] {
  return Array.from(new Set(ids.filter((id): id is string => !!id)));
}

function getVersionHistoryRequestIds(rp: ReleasePublish): string[] {
  return uniqueIds([
    rp.primaryTestRequestId,
    ...rp.relatedRequestIds,
    ...rp.testRequestIds,
  ]);
}

function syncVersionHistoryRequestIds(rp: ReleasePublish): string[] {
  const ids = getVersionHistoryRequestIds(rp);
  rp.testRequestIds = ids;
  return ids;
}

function getRunsForRequestIds(requestIds: string[]): TestRun[] {
  return testRuns.filter(tr => requestIds.includes(tr.testRequestId));
}

function getBugsForRequestIds(requestIds: string[]): Bug[] {
  const runIds = getRunsForRequestIds(requestIds).map(tr => tr.id);
  return bugs.filter(b => runIds.includes(b.testRunId));
}

function getRunIssuesForRequestIds(requestIds: string[]): RunIssue[] {
  const runIds = getRunsForRequestIds(requestIds).map(tr => tr.id);
  return runIssues.filter(ri => runIds.includes(ri.testRunId));
}

function getChecklistResultForRequestIds(
  requestIds: string[],
  type: Checklist['type']
): ChecklistResult | undefined {
  const scoped = checklists.filter(c => requestIds.includes(c.testRequestId) && c.type === type);
  if (!scoped.length) return undefined;
  if (scoped.some(c => c.result === 'FAIL')) return 'FAIL';
  if (scoped.some(c => c.result === 'PARTIAL')) return 'PARTIAL';
  if (scoped.every(c => c.result === 'PASS')) return 'PASS';
  return 'NOT_TESTED';
}

function getSecurityReviewResultForRequestIds(requestIds: string[]): ChecklistResult | undefined {
  const linkedTestCases = testCases.filter(tc => requestIds.includes(tc.testRequestId));
  if (!linkedTestCases.length) return undefined;

  uniqueIds(linkedTestCases.map(tc => tc.applicationId)).forEach(ensureSecurityReviewsExist);
  const testCaseIds = linkedTestCases.map(tc => tc.id);
  const scopedReviews = securityReviews.filter(review => testCaseIds.includes(review.testCaseId));
  if (!scopedReviews.length) {
    return getChecklistResultForRequestIds(requestIds, 'SECURITY');
  }

  const itemResults = scopedReviews.flatMap(review => review.items.map(item => item.result));
  if (itemResults.some(result => result === 'FAIL')) return 'FAIL';
  if (itemResults.some(result => result === 'PARTIAL')) return 'PARTIAL';

  const allReviewsCompleted = scopedReviews.length === linkedTestCases.length &&
    scopedReviews.every(review => review.status === 'COMPLETED');
  const allAnsweredItemsPassOrNA = itemResults.length > 0 &&
    scopedReviews.every(review =>
      review.items.every(item => item.result === 'PASS' || item.result === 'N_A')
    );

  if (allReviewsCompleted && allAnsweredItemsPassOrNA) return 'PASS';
  return 'NOT_TESTED';
}

function getPlaywrightPassRateForRequestIds(requestIds: string[]): { rate?: number; total: number } {
  const scoped = playwrightRuns.filter(pr =>
    pr.testRequestId && requestIds.includes(pr.testRequestId) && ['PASSED', 'FAILED'].includes(pr.status)
  );
  if (!scoped.length) return { total: 0 };
  return {
    total: scoped.length,
    rate: Math.round((scoped.filter(pr => pr.status === 'PASSED').length / scoped.length) * 100),
  };
}

function buildVersionSnapshot(rp: ReleasePublish): VersionSnapshot {
  const requestIds = syncVersionHistoryRequestIds(rp);
  const runs = getRunsForRequestIds(requestIds);
  const bgs = getBugsForRequestIds(requestIds);
  const issues = getRunIssuesForRequestIds(requestIds);
  const tasks = retestTasks.filter(task => requestIds.includes(task.testRequestId));
  const playwright = getPlaywrightPassRateForRequestIds(requestIds);

  return {
    totalTestCases: testCases.filter(tc => requestIds.includes(tc.testRequestId)).length,
    executedTestRuns: runs.filter(tr => FINAL_RUN_STATUSES.includes(tr.status)).length,
    pendingTestRuns: runs.filter(tr => ['PENDING', 'IN_PROGRESS'].includes(tr.status)).length,
    passedTestRuns: runs.filter(tr => tr.status === 'PASSED').length,
    failedTestRuns: runs.filter(tr => tr.status === 'FAILED').length,
    blockedTestRuns: runs.filter(tr => tr.status === 'BLOCKED').length,
    skippedTestRuns: runs.filter(tr => tr.status === 'SKIPPED').length,
    totalBugs: bgs.length,
    criticalBugs: bgs.filter(b => b.severity === 'CRITICAL').length,
    majorBugs: bgs.filter(b => b.severity === 'MAJOR').length,
    openBugs: bgs.filter(b => !CLOSED_BUG_STATUSES.includes(b.status)).length,
    closedBugs: bgs.filter(b => CLOSED_BUG_STATUSES.includes(b.status)).length,
    openRetestTasks: tasks.filter(task => ['QUEUED', 'IN_PROGRESS'].includes(task.status)).length,
    completedRetestTasks: tasks.filter(task => task.status === 'COMPLETED').length,
    openRunIssues: issues.filter(ri => !['RESOLVED', 'CLOSED'].includes(ri.status)).length,
    securityChecklistResult: getSecurityReviewResultForRequestIds(requestIds),
    performanceChecklistResult: getChecklistResultForRequestIds(requestIds, 'PERFORMANCE'),
    penetrationChecklistResult: getChecklistResultForRequestIds(requestIds, 'PENETRATION'),
    playwrightPassRate: playwright.rate,
    playwrightTotalRuns: playwright.total,
    capturedAt: new Date().toISOString(),
  };
}

function hasOpenCriticalBug(requestIds: string[]): boolean {
  return getBugsForRequestIds(requestIds).some(
    b => b.severity === 'CRITICAL' && !CLOSED_BUG_STATUSES.includes(b.status)
  );
}

function refreshVersionHistoryDerivedFields(rp: ReleasePublish): ReleasePublish {
  const requestIds = syncVersionHistoryRequestIds(rp);
  if (!rp.snapshot || ['DRAFT', 'QA_REVIEW', 'PENDING_DECISION'].includes(rp.status)) {
    rp.snapshot = buildVersionSnapshot(rp);
  }
  rp.isEmergency = hasOpenCriticalBug(requestIds) || !!rp.riskAccepted;
  return rp;
}

function hasIncompleteLinkedRequirement(requestIds: string[]): boolean {
  const selectedReqIds = testRequests
    .filter(tr => requestIds.includes(tr.id))
    .flatMap(tr => tr.selectedRequirementIds || []);
  const linkedReqIds = uniqueIds([
    ...selectedReqIds,
    ...requirements.filter(r => r.testRequestId && requestIds.includes(r.testRequestId)).map(r => r.id),
  ]);
  const linkedReqs = requirements.filter(r => linkedReqIds.includes(r.id));
  return linkedReqs.some(r => !['COMPLETED', 'APPROVED'].includes(r.status));
}

function lockRunsForVersionHistory(rp: ReleasePublish) {
  const requestIds = getVersionHistoryRequestIds(rp);
  const now = new Date().toISOString();
  const runIds: string[] = [];
  testRuns.forEach(tr => {
    if (requestIds.includes(tr.testRequestId)) {
      tr.isLocked = true;
      tr.lockedByVersionHistoryId = rp.id;
      tr.lockedAt = tr.lockedAt || now;
      tr.updatedAt = now;
      runIds.push(tr.id);
    }
  });
  bugs.forEach(bug => {
    if (runIds.includes(bug.testRunId)) {
      bug.isLocked = true;
      bug.lockedByVersionHistoryId = rp.id;
      bug.lockedAt = bug.lockedAt || now;
      bug.updatedAt = now;
    }
  });
}

function reflectVersionHistoryOnPrimaryRequest(rp: ReleasePublish) {
  const primary = testRequests.find(tr => tr.id === rp.primaryTestRequestId);
  if (!primary) return;

  primary.versionHistoryId = rp.id;
  primary.qaQualityStatus = rp.qaQualityStatus;
  primary.qaQualityNotes = rp.qaQualityNotes;
  primary.releaseDecision = rp.decision;
  primary.releaseDecisionReason = rp.decisionReason;
  primary.releaseDecisionById = rp.decisionById;
  primary.releaseDecisionAt = rp.decisionAt;
  primary.updatedAt = new Date().toISOString();
}

const VERSION_HISTORY_DECISION_LABELS: Record<VersionHistoryDecision, string> = {
  APPROVED: 'انتشار مجاز',
  CONDITIONAL: 'انتشار مشروط',
  REJECTED: 'عدم انتشار',
  BLOCKED: 'نیازمند بازآزمون',
};

function getVersionHistoryStakeholderIds(rp: ReleasePublish): string[] {
  const requestIds = getVersionHistoryRequestIds(rp);
  const linkedRequests = testRequests.filter(tr => requestIds.includes(tr.id));
  const linkedRunIds = getRunsForRequestIds(requestIds).map(run => run.id);
  const relatedBugAssigneeIds = bugs
    .filter(bug => linkedRunIds.includes(bug.testRunId))
    .map(bug => bug.assigneeId);
  const roleUserIds = mockUserRoleAssignments
    .filter(assignment =>
      assignment.isActive &&
      ['QA_LEAD', 'TECH_LEAD', 'PRODUCT_OWNER'].includes(assignment.role) &&
      (assignment.scope === 'APP' || (assignment.applicationIds || [assignment.applicationId]).includes(rp.applicationId))
    )
    .map(assignment => assignment.userId);

  return uniqueIds([
    rp.createdById,
    rp.qaReviewedById,
    rp.decisionById,
    ...linkedRequests.map(request => request.requesterId),
    ...linkedRequests.map(request => request.assigneeId),
    ...relatedBugAssigneeIds,
    ...roleUserIds,
  ]);
}

function notifyVersionHistoryStakeholders(
  rp: ReleasePublish,
  title: string,
  message: string,
  type: Notification['type'],
  correlationSuffix: string,
  commandMetadata?: ResolvedCommandMetadata
): void {
  getVersionHistoryStakeholderIds(rp).forEach(userId => {
    createNotification(
      userId,
      title,
      message,
      type,
      'VERSION_HISTORY',
      rp.id,
      undefined,
      commandMetadata?.correlationId || `version-history:${rp.id}:${correlationSuffix}`
    );
  });
}

function notifyVersionHistoryDecision(
  rp: ReleasePublish,
  decision: VersionHistoryDecision,
  commandMetadata?: ResolvedCommandMetadata
): void {
  const primary = testRequests.find(tr => tr.id === rp.primaryTestRequestId);
  const label = VERSION_HISTORY_DECISION_LABELS[decision];
  const notificationType: Notification['type'] =
    decision === 'APPROVED' ? 'SUCCESS' :
    decision === 'REJECTED' ? 'ERROR' :
    'WARNING';

  notifyVersionHistoryStakeholders(
    rp,
    `تصمیم VersionHistory: ${label}`,
    `تصمیم "${label}" برای نسخه ${rp.version}${rp.buildNumber ? ` / بیلد ${rp.buildNumber}` : ''} ثبت شد. Primary Request: ${primary?.title || rp.primaryTestRequestId}.`,
    notificationType,
    `decision:${decision}`,
    commandMetadata
  );
}

function notifyVersionHistoryPublished(rp: ReleasePublish, commandMetadata?: ResolvedCommandMetadata): void {
  notifyVersionHistoryStakeholders(
    rp,
    'VersionHistory منتشر شد',
    `نسخه ${rp.version}${rp.buildNumber ? ` / بیلد ${rp.buildNumber}` : ''} منتشر شد.`,
    'SUCCESS',
    'published',
    commandMetadata
  );
}

function notifyVersionHistoryRiskAccepted(rp: ReleasePublish, commandMetadata?: ResolvedCommandMetadata): void {
  notifyVersionHistoryStakeholders(
    rp,
    'پذیرش ریسک اضطراری ثبت شد',
    `پذیرش ریسک Tag اضطراری برای نسخه ${rp.version}${rp.buildNumber ? ` / بیلد ${rp.buildNumber}` : ''} ثبت شد.`,
    'WARNING',
    'risk-accepted',
    commandMetadata
  );
}

function isRequestAlreadyLinkedToVersionHistory(testRequestId: string): boolean {
  return releasePublishes.some(rp => getVersionHistoryRequestIds(rp).includes(testRequestId));
}

function getLatestRunForTestCaseInRequest(testRequestId: string, testCaseId: string): TestRun | undefined {
  return testRuns
    .filter(run => run.testRequestId === testRequestId && run.testCaseId === testCaseId)
    .sort((a, b) => {
      const aTime = new Date(a.executedAt || a.updatedAt || a.createdAt).getTime();
      const bTime = new Date(b.executedAt || b.updatedAt || b.createdAt).getTime();
      return bTime - aTime;
    })[0];
}

function getActiveReadyTestCasesForRequest(testRequestId: string): TestCase[] {
  return testCases
    .filter(tc => tc.testRequestId === testRequestId)
    .map(applyTestCaseReadiness)
    .filter(tc => tc.status === 'READY' && tc.isActive !== false);
}

function isTestRequestReadyForQualityQueue(testRequest: TestRequest): boolean {
  if (!['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(testRequest.status)) return false;
  if (hasIncompleteLinkedRequirement([testRequest.id])) return false;

  const readyTestCases = getActiveReadyTestCasesForRequest(testRequest.id);
  if (readyTestCases.length === 0) return false;

  const hasPassedLatestRunForEveryCase = readyTestCases.every(testCase => {
    const latestRun = getLatestRunForTestCaseInRequest(testRequest.id, testCase.id);
    return !!latestRun && latestRun.status === 'PASSED';
  });
  if (!hasPassedLatestRunForEveryCase) return false;

  const hasOpenBug = getBugsForRequestIds([testRequest.id])
    .some(bug => !CLOSED_BUG_STATUSES.includes(bug.status));
  if (hasOpenBug) return false;

  const hasOpenRunIssue = getRunIssuesForRequestIds([testRequest.id])
    .some(issue => !['RESOLVED', 'CLOSED'].includes(issue.status));
  if (hasOpenRunIssue) return false;

  return !retestTasks.some(task =>
    task.testRequestId === testRequest.id && ['QUEUED', 'IN_PROGRESS'].includes(task.status)
  );
}

function isVersionHistoryReadyForQualityQueue(rp: ReleasePublish): boolean {
  return getVersionHistoryRequestIds(rp).every(requestId => {
    const request = testRequests.find(tr => tr.id === requestId);
    return !!request && isTestRequestReadyForQualityQueue(request);
  });
}

function getAutoVersionHistoryCreatorId(testRequest: TestRequest): string {
  const qaLeadAssignment = mockUserRoleAssignments.find(assignment =>
    assignment.isActive &&
    assignment.role === 'QA_LEAD' &&
    (
      assignment.scope === 'APP' ||
      (assignment.applicationIds || [assignment.applicationId]).includes(testRequest.applicationId)
    )
  );
  return qaLeadAssignment?.userId || testRequest.reviewedById || testRequest.assigneeId || testRequest.requesterId || 'user-admin';
}

function markRequestCompletedBySuccessfulTests(testRequest: TestRequest, userId: string): void {
  if (testRequest.status === 'COMPLETED') return;
  const previous = { status: testRequest.status };
  testRequest.status = 'COMPLETED';
  testRequest.updatedAt = new Date().toISOString();
  createAuditLog(
    userId,
    testRequest.applicationId,
    'TEST_REQUEST',
    testRequest.id,
    'STATUS_CHANGE',
    previous,
    { status: 'COMPLETED', source: 'AUTO_SUCCESSFUL_TESTS' },
    { source: 'AUTO_SUCCESSFUL_TESTS' }
  );
}

function promoteVersionHistoryToQAReviewIfReady(rp: ReleasePublish): boolean {
  if (rp.status !== 'DRAFT' || !isVersionHistoryReadyForQualityQueue(rp)) return false;
  const primary = testRequests.find(tr => tr.id === rp.primaryTestRequestId);
  if (!primary) return false;
  const actorId = getAutoVersionHistoryCreatorId(primary);
  const previous = { status: rp.status };

  getVersionHistoryRequestIds(rp).forEach(requestId => {
    const linkedRequest = testRequests.find(tr => tr.id === requestId);
    if (linkedRequest) {
      linkedRequest.versionHistoryId = rp.id;
      markRequestCompletedBySuccessfulTests(linkedRequest, actorId);
    }
  });

  rp.status = 'QA_REVIEW';
  rp.snapshot = buildVersionSnapshot(rp);
  rp.updatedAt = new Date().toISOString();
  createAuditLog(
    actorId,
    rp.applicationId,
    'VERSION_HISTORY',
    rp.id,
    'STATUS_CHANGE',
    previous,
    { status: 'QA_REVIEW', source: 'AUTO_SUCCESSFUL_TESTS' },
    { source: 'AUTO_SUCCESSFUL_TESTS' }
  );
  return true;
}

function createAutomaticVersionHistoryForSuccessfulRequests(requests: TestRequest[]): ReleasePublish | null {
  const [primary, ...relatedRequests] = requests;
  if (!primary) return null;

  const actorId = getAutoVersionHistoryCreatorId(primary);
  const now = new Date().toISOString();
  const linkedRequestIds = uniqueIds([primary.id, ...relatedRequests.map(request => request.id)]);
  const rp: ReleasePublish = {
    id: uuidv4(),
    applicationId: primary.applicationId,
    version: primary.version,
    buildNumber: primary.buildNumber,
    status: 'QA_REVIEW',
    primaryTestRequestId: primary.id,
    relatedRequestIds: relatedRequests.map(request => request.id),
    isEmergency: false,
    testRequestIds: linkedRequestIds,
    createdById: actorId,
    createdBy: getUserById(actorId),
    createdAt: now,
    updatedAt: now,
  };

  refreshVersionHistoryDerivedFields(rp);
  releasePublishes.unshift(rp);
  requests.forEach(request => {
    request.versionHistoryId = rp.id;
    markRequestCompletedBySuccessfulTests(request, actorId);
  });
  createAuditLog(
    actorId,
    primary.applicationId,
    'VERSION_HISTORY',
    rp.id,
    'CREATE',
    null,
    { ...rp, source: 'AUTO_SUCCESSFUL_TESTS' },
    { source: 'AUTO_SUCCESSFUL_TESTS' }
  );
  notifyRoles(
    primary.applicationId,
    ['QA_LEAD'],
    'در انتظار اعلام وضعیت کیفیت',
    `تست نسخه ${primary.version}${primary.buildNumber ? ` / بیلد ${primary.buildNumber}` : ''} با موفقیت کامل شد و برای اعلام وضعیت کیفیت آماده است.`,
    'SUCCESS',
    'VERSION_HISTORY',
    rp.id,
    undefined,
    `version-history:${rp.id}:auto-successful-tests`
  );
  return rp;
}

function syncAutomaticSuccessfulVersionHistories(applicationId: ApplicationScopeFilter): void {
  releasePublishes
    .filter(rp => matchesApplicationScope(rp.applicationId, applicationId))
    .forEach(promoteVersionHistoryToQAReviewIfReady);

  const groupedRequests = new Map<string, TestRequest[]>();
  testRequests
    .filter(request =>
      matchesApplicationScope(request.applicationId, applicationId) &&
      !isRequestAlreadyLinkedToVersionHistory(request.id) &&
      isTestRequestReadyForQualityQueue(request)
    )
    .forEach(request => {
      const groupKey = `${request.applicationId}:${request.version}:${request.buildNumber || ''}`;
      groupedRequests.set(groupKey, [...(groupedRequests.get(groupKey) || []), request]);
    });

  groupedRequests.forEach(requests => {
    const orderedRequests = [...requests].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt).getTime();
      return aTime - bTime;
    });
    createAutomaticVersionHistoryForSuccessfulRequests(orderedRequests);
  });
}

function hydrateVersionHistory(rp: ReleasePublish): ReleasePublish {
  refreshVersionHistoryDerivedFields(rp);
  return {
    ...rp,
    createdBy: getUserById(rp.createdById),
    qaReviewedBy: rp.qaReviewedById ? getUserById(rp.qaReviewedById) : undefined,
    decisionBy: rp.decisionById ? getUserById(rp.decisionById) : undefined,
  };
}

// ============================================
// Release Publish API
// ============================================

export const releasePublishApi = {
  async getAll(applicationId: ApplicationScopeFilter, filters: CartableFilterParams): Promise<PaginatedResponse<ReleasePublish>> {
    await delay();
    syncAutomaticSuccessfulVersionHistories(applicationId);
    let data = filterByApplicationScope(releasePublishes, applicationId);
    data = applyFilters(data, filters);
    data = data.map(hydrateVersionHistory);
    return paginate(data, filters.page, filters.limit);
  },

  async getById(id: string): Promise<ReleasePublish | null> {
    await delay();
    const rp = releasePublishes.find(r => r.id === id);
    return rp ? hydrateVersionHistory(rp) : null;
  },

  async getByPrimaryTestRequest(testRequestId: string): Promise<ReleasePublish | null> {
    await delay();
    const rp = releasePublishes.find(r => getVersionHistoryRequestIds(r).includes(testRequestId));
    return rp ? hydrateVersionHistory(rp) : null;
  },

  async getPrimaryRequestCandidates(applicationId: ApplicationScopeFilter): Promise<TestRequest[]> {
    await delay();
    return testRequests
      .filter(tr => matchesApplicationScope(tr.applicationId, applicationId))
      .map(tr => ({
        ...tr,
        requester: getUserById(tr.requesterId),
        assignee: tr.assigneeId ? getUserById(tr.assigneeId) : undefined,
      }));
  },

  async getEligiblePrimaryRequests(applicationId: ApplicationScopeFilter): Promise<TestRequest[]> {
    await delay();
    return testRequests
      .filter(tr =>
        matchesApplicationScope(tr.applicationId, applicationId) &&
        ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(tr.status) &&
        !isRequestAlreadyLinkedToVersionHistory(tr.id)
      )
      .map(tr => ({
        ...tr,
        requester: getUserById(tr.requesterId),
        assignee: tr.assigneeId ? getUserById(tr.assigneeId) : undefined,
      }));
  },

  async getRelatedCandidates(primaryTestRequestId: string, applicationId: ApplicationScopeFilter): Promise<TestRequest[]> {
    await delay();
    const primary = testRequests.find(tr => tr.id === primaryTestRequestId);
    if (!primary) return [];

    return testRequests
      .filter(tr =>
        tr.id !== primary.id &&
        tr.applicationId === primary.applicationId &&
        tr.version === primary.version &&
        (tr.buildNumber || '') === (primary.buildNumber || '') &&
        matchesApplicationScope(tr.applicationId, applicationId) &&
        ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(tr.status) &&
        !isRequestAlreadyLinkedToVersionHistory(tr.id)
      )
      .map(tr => ({
        ...tr,
        requester: getUserById(tr.requesterId),
        assignee: tr.assigneeId ? getUserById(tr.assigneeId) : undefined,
      }));
  },

  async getEvidence(id: string): Promise<VersionHistoryEvidence | null> {
    await delay();
    const rp = releasePublishes.find(r => r.id === id);
    if (!rp) return null;
    const requestIds = getVersionHistoryRequestIds(rp);
    const runIds = getRunsForRequestIds(requestIds).map(run => run.id);
    return {
      primaryRequest: (() => {
        const primary = testRequests.find(tr => tr.id === rp.primaryTestRequestId);
        return primary ? hydrateTestRequest(primary) : undefined;
      })(),
      linkedRequests: testRequests
        .filter(tr => requestIds.includes(tr.id))
        .map(hydrateTestRequest),
      testCases: testCases
        .filter(tc => requestIds.includes(tc.testRequestId))
        .map(hydrateTestCase),
      testRuns: getRunsForRequestIds(requestIds).map(hydrateTestRun),
      bugs: getBugsForRequestIds(requestIds).map(hydrateBug),
      retestTasks: retestTasks
        .filter(task => requestIds.includes(task.testRequestId))
        .map(hydrateRetestTask),
      runIssues: runIssues
        .filter(issue => runIds.includes(issue.testRunId))
        .map(issue => ({ ...issue, reportedBy: getUserById(issue.reportedById), assignee: issue.assigneeId ? getUserById(issue.assigneeId) : undefined })),
    };
  },

  async getCriticalOpenBugs(id: string): Promise<Bug[]> {
    await delay();
    const rp = releasePublishes.find(r => r.id === id);
    if (!rp) return [];
    return getBugsForRequestIds(getVersionHistoryRequestIds(rp))
      .filter(b => b.severity === 'CRITICAL' && !CLOSED_BUG_STATUSES.includes(b.status))
      .map(b => ({
        ...b,
        assignee: b.assigneeId ? getUserById(b.assigneeId) : undefined,
        reportedBy: getUserById(b.reportedById),
      }));
  },

  async create(
    data: Partial<ReleasePublish>,
    userId: string,
    applicationId: string,
    actorRole?: UserRole,
    metadata?: CommandMetadata
  ): Promise<ReleasePublish> {
    await delay();
    const primaryTestRequestId = data.primaryTestRequestId || data.testRequestIds?.[0];
    if (!primaryTestRequestId) {
      throw new Error('PRIMARY_TEST_REQUEST_REQUIRED');
    }
    const command = resolveCommandMetadata(
      'versionHistory.create',
      metadata,
      `version-history:create:${primaryTestRequestId}`
    );
    const replayed = getIdempotentResult<ReleasePublish>(command);
    if (replayed) {
      createCommandTrace(command, 'REPLAYED', userId, replayed.applicationId, 'VERSION_HISTORY', replayed.id);
      return hydrateVersionHistory(replayed);
    }

    const primary = testRequests.find(tr => tr.id === primaryTestRequestId);
    if (!primary) {
      throw new Error('PRIMARY_TEST_REQUEST_NOT_FOUND');
    }

    if (!matchesApplicationScope(primary.applicationId, applicationId)) {
      throw new Error('PRIMARY_TEST_REQUEST_OUT_OF_SCOPE');
    }

    if (!canActorUseWorkflowCapability(actorRole, 'versionHistory:create', primary.applicationId)) {
      throw new Error('VERSION_POLICY_FORBIDDEN');
    }

    if (isRequestAlreadyLinkedToVersionHistory(primary.id)) {
      throw new Error('PRIMARY_TEST_REQUEST_ALREADY_LINKED');
    }

    const relatedRequests = (data.relatedRequestIds || [])
      .map(id => testRequests.find(tr => tr.id === id))
      .filter((tr): tr is TestRequest => !!tr);

    const hasInvalidRelated = relatedRequests.some(tr =>
      tr.applicationId !== primary.applicationId ||
      tr.version !== primary.version ||
      (tr.buildNumber || '') !== (primary.buildNumber || '') ||
      isRequestAlreadyLinkedToVersionHistory(tr.id)
    );
    if (hasInvalidRelated) {
      throw new Error('INVALID_RELATED_TEST_REQUEST');
    }

    const linkedRequestIds = uniqueIds([primary.id, ...relatedRequests.map(tr => tr.id)]);
    const rp: ReleasePublish = {
      id: uuidv4(),
      applicationId: primary.applicationId,
      version: primary.version,
      buildNumber: primary.buildNumber,
      status: 'DRAFT',
      primaryTestRequestId: primary.id,
      relatedRequestIds: relatedRequests.map(tr => tr.id),
      isEmergency: false,
      testRequestIds: linkedRequestIds,
      creationCommand: commandRecordMetadata(command),
      lastCommand: commandRecordMetadata(command),
      createdById: userId,
      createdBy: getUserById(userId),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    refreshVersionHistoryDerivedFields(rp);
    releasePublishes.unshift(rp);
    primary.versionHistoryId = rp.id;
    createAuditLog(
      userId,
      primary.applicationId,
      'VERSION_HISTORY',
      rp.id,
      'CREATE',
      null,
      rp,
      commandAuditMetadata(command)
    );
    createCommandTrace(command, 'COMPLETED', userId, primary.applicationId, 'VERSION_HISTORY', rp.id);
    return rememberIdempotentResult(command, rp);
  },

  async submitForQAReview(id: string, userId: string, metadata?: CommandMetadata): Promise<ReleasePublish | null> {
    await delay();
    const command = resolveCommandMetadata('versionHistory.submitForQAReview', metadata);
    const replayed = getIdempotentResult<ReleasePublish | null>(command);
    if (replayed) {
      createCommandTrace(command, 'REPLAYED', userId, replayed.applicationId, 'VERSION_HISTORY', id);
      return hydrateVersionHistory(replayed);
    }

    const rp = releasePublishes.find(r => r.id === id);
    if (!rp || rp.status !== 'DRAFT') return null;
    
    const previous = { status: rp.status };
    rp.status = 'QA_REVIEW';
    rp.lastCommand = commandRecordMetadata(command);
    rp.updatedAt = new Date().toISOString();
    createAuditLog(
      userId,
      rp.applicationId,
      'VERSION_HISTORY',
      id,
      'STATUS_CHANGE',
      previous,
      { status: 'QA_REVIEW' },
      commandAuditMetadata(command)
    );
    createCommandTrace(command, 'COMPLETED', userId, rp.applicationId, 'VERSION_HISTORY', id);
    return rememberIdempotentResult(command, rp);
  },

  async setQAQuality(
    id: string,
    qualityStatus: QAQualityStatus,
    notes: string,
    userId: string,
    actorRole?: UserRole,
    metadata?: CommandMetadata
  ): Promise<ReleasePublish | null> {
    await delay();
    const command = resolveCommandMetadata('versionHistory.setQAQuality', metadata);
    const replayed = getIdempotentResult<ReleasePublish | null>(command);
    if (replayed) {
      createCommandTrace(command, 'REPLAYED', userId, replayed.applicationId, 'VERSION_HISTORY', id);
      return hydrateVersionHistory(replayed);
    }

    const rp = releasePublishes.find(r => r.id === id);
    if (!rp || !['QA_REVIEW', 'DRAFT'].includes(rp.status)) return null;
    if (!canActorUseWorkflowCapability(actorRole, 'versionHistory:qaReview', rp.applicationId)) return null;
    if (!notes.trim()) return null;

    const requestIds = syncVersionHistoryRequestIds(rp);
    const snapshot = buildVersionSnapshot(rp);
    if ((snapshot.executedTestRuns || 0) === 0 && qualityStatus !== 'NOT_STARTED') {
      return null;
    }
    if (hasIncompleteLinkedRequirement(requestIds)) {
      return null;
    }
    
    rp.qaQualityStatus = qualityStatus;
    rp.qaQualityNotes = notes.trim();
    rp.qaReviewedById = userId;
    rp.qaReviewedBy = getUserById(userId);
    rp.qaReviewedAt = new Date().toISOString();
    rp.status = 'PENDING_DECISION';
    rp.lastCommand = commandRecordMetadata(command);
    rp.updatedAt = new Date().toISOString();
    rp.snapshot = snapshot;
    rp.revisions = [
      ...(rp.revisions || []),
      {
        id: uuidv4(),
        versionHistoryId: rp.id,
        qaQualityStatus: qualityStatus,
        qaQualityNotes: notes.trim(),
        snapshot,
        createdById: userId,
        createdAt: new Date().toISOString(),
      },
    ];
    refreshVersionHistoryDerivedFields(rp);
    reflectVersionHistoryOnPrimaryRequest(rp);

    createAuditLog(
      userId,
      rp.applicationId,
      'VERSION_HISTORY',
      id,
      'REVIEW',
      null,
      { qualityStatus, notes, snapshot },
      commandAuditMetadata(command)
    );
    createCommandTrace(command, 'COMPLETED', userId, rp.applicationId, 'VERSION_HISTORY', id);
    return rememberIdempotentResult(command, rp);
  },

  async decide(
    id: string,
    decision: VersionHistoryDecision,
    reason: string,
    userId: string,
    actorRole?: UserRole,
    metadata?: CommandMetadata
  ): Promise<ReleasePublish | null> {
    await delay();
    const command = resolveCommandMetadata('versionHistory.decide', metadata);
    const replayed = getIdempotentResult<ReleasePublish | null>(command);
    if (replayed) {
      createCommandTrace(command, 'REPLAYED', userId, replayed.applicationId, 'VERSION_HISTORY', id);
      return hydrateVersionHistory(replayed);
    }

    const rp = releasePublishes.find(r => r.id === id);
    if (!rp || rp.status !== 'PENDING_DECISION') return null;
    if (!canActorUseWorkflowCapability(actorRole, 'versionHistory:decide', rp.applicationId)) return null;
    if (!rp.qaQualityStatus || !reason.trim()) return null;
    refreshVersionHistoryDerivedFields(rp);
    if (rp.isEmergency && ['APPROVED', 'CONDITIONAL'].includes(decision) && !rp.riskAccepted) {
      return null;
    }
    
    rp.decision = decision;
    rp.decisionReason = reason.trim();
    rp.decisionById = userId;
    rp.decisionBy = getUserById(userId);
    rp.decisionAt = new Date().toISOString();
    rp.decisionSnapshot = buildVersionSnapshot(rp);
    rp.status = decision === 'BLOCKED' ? 'DRAFT' : decision as ReleasePublishStatus;
    if (['APPROVED', 'CONDITIONAL'].includes(decision)) {
      rp.publishedAt = new Date().toISOString();
    }
    rp.lastCommand = commandRecordMetadata(command);
    rp.updatedAt = new Date().toISOString();
    lockRunsForVersionHistory(rp);
    reflectVersionHistoryOnPrimaryRequest(rp);
    
    createAuditLog(userId, rp.applicationId, 'VERSION_HISTORY', id, 'APPROVE', null, {
      decision,
      reason,
      snapshot: rp.decisionSnapshot,
    }, commandAuditMetadata(command));
    notifyVersionHistoryDecision(rp, decision, command);
    createCommandTrace(command, 'COMPLETED', userId, rp.applicationId, 'VERSION_HISTORY', id);
    return rememberIdempotentResult(command, rp);
  },

  async publish(id: string, userId: string, metadata?: CommandMetadata): Promise<ReleasePublish | null> {
    await delay();
    const command = resolveCommandMetadata('versionHistory.publish', metadata);
    const replayed = getIdempotentResult<ReleasePublish | null>(command);
    if (replayed) {
      createCommandTrace(command, 'REPLAYED', userId, replayed.applicationId, 'VERSION_HISTORY', id);
      return hydrateVersionHistory(replayed);
    }

    const rp = releasePublishes.find(r => r.id === id);
    if (!rp || !['APPROVED', 'CONDITIONAL', 'EMERGENCY'].includes(rp.status)) return null;
    
    const previous = { status: rp.status };
    rp.status = 'PUBLISHED';
    rp.publishedAt = new Date().toISOString();
    rp.lastCommand = commandRecordMetadata(command);
    rp.updatedAt = new Date().toISOString();
    
    lockRunsForVersionHistory(rp);
    
    reflectVersionHistoryOnPrimaryRequest(rp);
    createAuditLog(
      userId,
      rp.applicationId,
      'VERSION_HISTORY',
      id,
      'PUBLISH',
      previous,
      { status: 'PUBLISHED' },
      commandAuditMetadata(command)
    );
    notifyVersionHistoryPublished(rp, command);
    createCommandTrace(command, 'COMPLETED', userId, rp.applicationId, 'VERSION_HISTORY', id);
    return rememberIdempotentResult(command, rp);
  },

  async emergencyPublish(
    id: string,
    emergencyReason: string,
    riskDescription: string,
    userId: string,
    actorRole?: UserRole,
    metadata?: CommandMetadata
  ): Promise<ReleasePublish | null> {
    await delay();
    const command = resolveCommandMetadata('versionHistory.emergencyPublish', metadata);
    const replayed = getIdempotentResult<ReleasePublish | null>(command);
    if (replayed) {
      createCommandTrace(command, 'REPLAYED', userId, replayed.applicationId, 'VERSION_HISTORY', id);
      return hydrateVersionHistory(replayed);
    }

    const rp = releasePublishes.find(r => r.id === id);
    if (!rp) return null;
    if (!canActorUseWorkflowCapability(actorRole, 'versionHistory:riskAccept', rp.applicationId)) return null;
    refreshVersionHistoryDerivedFields(rp);
    if (!rp.isEmergency || !emergencyReason.trim() || !riskDescription.trim()) return null;
    
    rp.emergencyReason = emergencyReason.trim();
    rp.riskDescription = riskDescription.trim();
    rp.riskAccepted = true;
    rp.decisionById = userId;
    rp.decisionBy = getUserById(userId);
    rp.lastCommand = commandRecordMetadata(command);
    rp.updatedAt = new Date().toISOString();
    
    createAuditLog(userId, rp.applicationId, 'VERSION_HISTORY', id, 'EMERGENCY_PUBLISH', null, {
      emergencyReason,
      riskDescription,
      riskAccepted: true,
    }, commandAuditMetadata(command));
    notifyVersionHistoryRiskAccepted(rp, command);
    createCommandTrace(command, 'COMPLETED', userId, rp.applicationId, 'VERSION_HISTORY', id);
    return rememberIdempotentResult(command, rp);
  },

  // Get releases pending decision for Tech Lead
  async getPendingDecision(applicationId: ApplicationScopeFilter): Promise<ReleasePublish[]> {
    await delay();
    syncAutomaticSuccessfulVersionHistories(applicationId);
    return releasePublishes
      .filter(rp => matchesApplicationScope(rp.applicationId, applicationId) && rp.status === 'PENDING_DECISION')
      .map(hydrateVersionHistory);
  },

  // Get releases pending QA review
  async getPendingQAReview(applicationId: ApplicationScopeFilter): Promise<ReleasePublish[]> {
    await delay();
    syncAutomaticSuccessfulVersionHistories(applicationId);
    return releasePublishes
      .filter(rp => matchesApplicationScope(rp.applicationId, applicationId) && ['DRAFT', 'QA_REVIEW'].includes(rp.status))
      .map(hydrateVersionHistory);
  },
};

export const versionHistoryApi = releasePublishApi;

// ============================================
// Command Trace API
// ============================================

export const commandTraceApi = {
  async getAll(
    applicationId: ApplicationScopeFilter,
    filters: CartableFilterParams
  ): Promise<PaginatedResponse<CommandTrace>> {
    await delay();
    let data = commandTraces.filter(trace => matchesApplicationScope(trace.applicationId, applicationId));
    data = applyFilters(data, filters);
    return paginate(data, filters.page, filters.limit);
  },

  async getByCorrelationId(correlationId: string): Promise<CommandTrace[]> {
    await delay();
    return commandTraces.filter(trace => trace.correlationId === correlationId);
  },

  async getByIdempotencyKey(idempotencyKey: string): Promise<CommandTrace[]> {
    await delay();
    return commandTraces.filter(trace => trace.idempotencyKey === idempotencyKey);
  },
};

// ============================================
// Audit Log API
// ============================================

export const auditLogApi = {
  async getAll(filters: Omit<CartableFilterParams, 'applicationId'> & { applicationId?: ApplicationScopeFilter }): Promise<PaginatedResponse<AuditLog>> {
    await delay();
    const { applicationId, ...filterParams } = filters;
    let data = [...auditLogs];
    data = data.filter(a => matchesApplicationScope(a.applicationId, applicationId));
    data = applyFilters(data, filterParams);
    return paginate(data, filters.page, filters.limit);
  },

  async getByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    await delay();
    return auditLogs.filter(a => a.entityType === entityType && a.entityId === entityId);
  },
};

// ============================================
// Comment API
// ============================================

export const commentApi = {
  async getByEntity(entityType: string, entityId: string): Promise<Comment[]> {
    await delay();
    return comments.filter(c => c.entityType === entityType && c.entityId === entityId);
  },

  async create(entityType: EntityType, entityId: string, content: string, userId: string): Promise<Comment> {
    await delay();
    const comment: Comment = {
      id: uuidv4(),
      entityType,
      entityId,
      content,
      authorId: userId,
      author: getUserById(userId),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    comments.unshift(comment);
    return comment;
  },
};

// ============================================
// Notification API
// ============================================

export const notificationApi = {
  async getByUser(userId: string): Promise<Notification[]> {
    await delay();
    processNotificationOutbox(25, userId);
    hydrateLegacyNotificationDeliveryState(userId);
    return notifications.filter(n => n.userId === userId);
  },

  async markAsRead(id: string): Promise<Notification | null> {
    await delay();
    const notif = notifications.find(n => n.id === id);
    if (notif) {
      notif.isRead = true;
    }
    return notif || null;
  },

  async markAllAsRead(userId: string): Promise<void> {
    await delay();
    notifications.forEach(n => {
      if (n.userId === userId) {
        n.isRead = true;
      }
    });
  },

  async getUnreadCount(userId: string): Promise<number> {
    await delay();
    processNotificationOutbox(25, userId);
    hydrateLegacyNotificationDeliveryState(userId);
    return notifications.filter(n => n.userId === userId && !n.isRead).length;
  },

  async getOutbox(userId?: string): Promise<NotificationOutboxItem[]> {
    await delay();
    processNotificationOutbox(50, userId);
    return notificationOutbox.filter(item => !userId || item.userId === userId);
  },

  async processOutbox(limit = 25, userId?: string): Promise<NotificationOutboxItem[]> {
    await delay();
    return processNotificationOutbox(limit, userId);
  },

  async retryFailed(userId?: string): Promise<NotificationOutboxItem[]> {
    await delay();
    const failedItems = notificationOutbox.filter(item =>
      item.status === 'FAILED' && (!userId || item.userId === userId)
    );
    failedItems.forEach(item => {
      item.status = 'QUEUED';
      item.lastError = undefined;
    });
    return processNotificationOutbox(failedItems.length || 25, userId);
  },
};

// ============================================
// Attachment API
// ============================================

export const attachmentApi = {
  async getByEntity(entityType: string, entityId: string): Promise<Attachment[]> {
    await delay();
    return attachments.filter(a => a.entityType === entityType && a.entityId === entityId && a.status !== 'DELETED');
  },

  async upload(
    entityType: EntityType,
    entityId: string,
    file: { name: string; size: number; type: string },
    attachmentType: AttachmentType,
    userId: string
  ): Promise<Attachment> {
    await delay();
    const blobFile = file as unknown as Blob;
    const storagePath =
      typeof URL !== 'undefined' &&
      typeof URL.createObjectURL === 'function' &&
      typeof blobFile.arrayBuffer === 'function'
        ? URL.createObjectURL(blobFile)
        : `/attachments/${entityId}/${file.name}`;
    const att: Attachment = {
      id: uuidv4(),
      entityType,
      entityId,
      type: attachmentType,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      storagePath,
      status: 'UPLOADED',
      uploadedById: userId,
      uploadedBy: getUserById(userId),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    attachments.unshift(att);
    return att;
  },

  async softDelete(id: string, _userId: string): Promise<Attachment | null> {
    await delay();
    const att = attachments.find(a => a.id === id);
    if (!att) return null;
    
    att.status = 'DELETED';
    att.updatedAt = new Date().toISOString();
    return att;
  },
};

// ============================================
// Dashboard API
// ============================================

export const dashboardApi = {
  async getStats(applicationId: ApplicationScopeFilter, userId: string, role: string): Promise<DashboardStats> {
    await delay();
    syncAutomaticSuccessfulVersionHistories(applicationId);
    
    const filterByApp = <T extends { applicationId: string }>(arr: T[]) =>
      filterByApplicationScope(arr, applicationId);
    
    const scopedTestRequests = filterByApp(testRequests);
    const scopedBugs = filterByApp(bugs);
    const appTestRequests = getVisibleTestRequestsForRole(scopedTestRequests, userId, role as UserRole);
    const appBugs = getVisibleBugsForRole(scopedBugs, userId, role as UserRole);
    const appChecklists = filterByApp(checklists);
    const appReleases = filterByApp(releasePublishes);
    const appTestCases = filterByApp(testCases);
    const appTestRuns = getVisibleTestRunsForRole(filterByApp(testRuns), userId, role as UserRole);
    
    return {
      pendingTestRequests: appTestRequests.filter(tr => tr.status === 'SUBMITTED').length,
      inProgressTestRequests: appTestRequests.filter(tr => tr.status === 'IN_PROGRESS').length,
      completedTestRequests: appTestRequests.filter(tr => tr.status === 'COMPLETED').length,
      pendingBugs: appBugs.filter(b => !['CLOSED', 'REJECTED', 'RETEST_PASSED', 'NO_ACTION_NEEDED'].includes(b.status)).length,
      criticalBugs: appBugs.filter(b => b.severity === 'CRITICAL' && !['CLOSED', 'REJECTED', 'RETEST_PASSED', 'NO_ACTION_NEEDED'].includes(b.status)).length,
      pendingChecklists: appChecklists.filter(c => ['PENDING', 'IN_PROGRESS'].includes(c.status)).length,
      pendingReleases: appReleases.filter(rp => ['DRAFT', 'QA_REVIEW', 'PENDING_DECISION'].includes(rp.status)).length,
      totalTestCases: appTestCases.length,
      passedTestRuns: appTestRuns.filter(tr => tr.status === 'PASSED').length,
      failedTestRuns: appTestRuns.filter(tr => tr.status === 'FAILED').length,
    };
  },
};

// ============================================
// User API (Admin) — Item #3 fix: actual CRUD
// ============================================

// Mutable users list for CRUD
let mutableUsers = [...mockUsers];

export const userApi = {
  async getAll(): Promise<User[]> {
    await delay();
    return [...mutableUsers];
  },

  async getById(id: string): Promise<User | null> {
    await delay();
    return mutableUsers.find(u => u.id === id) || null;
  },

  async create(data: Partial<User>): Promise<User> {
    await delay();
    const newUser: User = {
      id: uuidv4(),
      nationalCode: data.nationalCode || '',
      phoneNumber: data.phoneNumber || '',
      fullName: data.fullName || '',
      email: data.email,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mutableUsers.unshift(newUser);
    mockUsers.unshift(newUser);
    return newUser;
  },

  async replaceRoleAssignments(
    userId: string,
    data: {
      role: UserRole;
      scope: AccessScope;
      applicationIds: string[];
      automatedTestsEnabled?: boolean | undefined;
    }
  ): Promise<UserRoleAssignment[]> {
    await delay();
    mockUserRoleAssignments.forEach(assignment => {
      if (assignment.userId === userId) assignment.isActive = false;
    });
    const applicationIds = data.applicationIds.length ? data.applicationIds : mutableApplications.filter(app => app.isActive).map(app => app.id);
    const assignment: UserRoleAssignment = {
      id: uuidv4(),
      userId,
      applicationId: applicationIds[0] || mutableApplications[0]?.id || '',
      applicationIds,
      role: data.role,
      scope: data.scope,
      automatedTestsEnabled: data.role === 'QA_SPECIALIST' ? data.automatedTestsEnabled !== false : undefined,
      isActive: true,
    };
    mockUserRoleAssignments.unshift(assignment);
    return [assignment];
  },

  async update(id: string, data: Partial<User>): Promise<User | null> {
    await delay();
    const idx = mutableUsers.findIndex(u => u.id === id);
    if (idx === -1) return null;
    mutableUsers[idx] = { ...requireAt(mutableUsers, idx), ...data, updatedAt: new Date().toISOString() };
    return requireAt(mutableUsers, idx);
  },

  async deactivate(id: string): Promise<User | null> {
    await delay();
    const idx = mutableUsers.findIndex(u => u.id === id);
    if (idx === -1) return null;
    mutableUsers[idx] = { ...requireAt(mutableUsers, idx), isActive: false, updatedAt: new Date().toISOString() };
    return requireAt(mutableUsers, idx);
  },

  async lookupByNationalCode(nationalCode: string): Promise<User | null> {
    await delay(500);
    return mutableUsers.find(u => u.nationalCode === nationalCode) || null;
  },

  async getDevelopers(applicationId: ApplicationScopeFilter): Promise<User[]> {
    await delay();
    const ids = normalizeApplicationScope(applicationId);
    const devAssignments = mockUserRoleAssignments.filter(
      a => (!ids || (a.applicationIds || [a.applicationId]).some(id => ids.includes(id))) && a.role === 'DEVELOPER' && a.isActive
    );
    return devAssignments.map(a => mutableUsers.find(u => u.id === a.userId)!).filter(Boolean);
  },

  async getQASpecialists(applicationId: ApplicationScopeFilter): Promise<User[]> {
    await delay();
    const ids = normalizeApplicationScope(applicationId);
    const qaAssignments = mockUserRoleAssignments.filter(
      a => (!ids || (a.applicationIds || [a.applicationId]).some(id => ids.includes(id))) &&
           ['QA_SPECIALIST', 'QA_LEAD'].includes(a.role) &&
           a.isActive
    );
    return qaAssignments.map(a => mutableUsers.find(u => u.id === a.userId)!).filter(Boolean);
  },
};

// ============================================
// System Integration Settings API
// ============================================

export const systemSettingsApi = {
  async getIntegrationSettings(): Promise<SystemIntegrationSettings> {
    await delay();
    return {
      ...systemIntegrationSettings,
      playwright: { ...systemIntegrationSettings.playwright },
      adapters: systemIntegrationSettings.adapters.map(adapter => ({ ...adapter })),
    };
  },

  async updatePlaywrightRunner(
    data: Partial<PlaywrightRunnerConfig>,
    userId: string
  ): Promise<PlaywrightRunnerConfig> {
    await delay();
    const previous = { ...systemIntegrationSettings.playwright };
    const updatedAt = new Date().toISOString();
    systemIntegrationSettings = {
      ...systemIntegrationSettings,
      playwright: {
        ...systemIntegrationSettings.playwright,
        ...data,
        defaultTimeoutSeconds: Number(data.defaultTimeoutSeconds || systemIntegrationSettings.playwright.defaultTimeoutSeconds),
        updatedAt,
      },
      updatedAt,
      updatedById: userId,
    };
    createAuditLog(
      userId,
      undefined,
      'APPLICATION',
      'system-integration-settings',
      'UPDATE',
      previous,
      systemIntegrationSettings.playwright,
      { settingsArea: 'PLAYWRIGHT_RUNNER' }
    );
    return { ...systemIntegrationSettings.playwright };
  },

  async updateIntegrationAdapter(
    provider: IntegrationProvider,
    data: Partial<IntegrationAdapterConfig>,
    userId: string
  ): Promise<IntegrationAdapterConfig | null> {
    await delay();
    const idx = systemIntegrationSettings.adapters.findIndex(adapter => adapter.provider === provider);
    if (idx === -1) return null;
    const currentAdapter = requireAt(systemIntegrationSettings.adapters, idx);
    const previous = { ...currentAdapter };
    const updatedAt = new Date().toISOString();
    const nextAdapter: IntegrationAdapterConfig = {
      ...currentAdapter,
      ...data,
      provider,
      lastHealthStatus: (data.enabled ?? currentAdapter.enabled) ? 'UNKNOWN' : 'DISABLED',
      updatedAt,
    };
    const adapters = [...systemIntegrationSettings.adapters];
    adapters[idx] = nextAdapter;
    systemIntegrationSettings = {
      ...systemIntegrationSettings,
      adapters,
      updatedAt,
      updatedById: userId,
    };
    createAuditLog(
      userId,
      undefined,
      'APPLICATION',
      `integration-adapter:${provider}`,
      'UPDATE',
      previous,
      nextAdapter,
      { settingsArea: 'INTEGRATION_ADAPTER', provider }
    );
    return { ...nextAdapter };
  },
};

// ============================================
// Workflow Policy API
// ============================================

export const workflowPolicyApi = {
  async getAll() {
    await delay();
    return listWorkflowPolicies();
  },

  async getForApplication(applicationId: string) {
    await delay();
    return getWorkflowPolicy(applicationId);
  },

  async updateApplicationPolicy(applicationId: string, policyId: string): Promise<Application | null> {
    await delay();
    const idx = mutableApplications.findIndex(a => a.id === applicationId);
    if (idx === -1) return null;
    const workflowPolicyId = setApplicationWorkflowPolicy(applicationId, policyId);
    mutableApplications[idx] = {
      ...requireAt(mutableApplications, idx),
      workflowPolicyId,
      updatedAt: new Date().toISOString(),
    };
    return requireAt(mutableApplications, idx);
  },
};

// ============================================
// Application API (Admin) — Item #2 fix: actual CRUD
// ============================================

export const applicationApi = {
  async getAll(): Promise<Application[]> {
    await delay();
    return mutableApplications.map(applyWorkflowPolicyToApplication);
  },

  async getById(id: string): Promise<Application | null> {
    await delay();
    const app = mutableApplications.find(a => a.id === id);
    return app ? applyWorkflowPolicyToApplication(app) : null;
  },

  async create(data: Partial<Application>): Promise<Application> {
    await delay();
    const id = data.id || uuidv4();
    const workflowPolicyId = setApplicationWorkflowPolicy(id, data.workflowPolicyId || getWorkflowPolicy().id);
    const app: Application = {
      id,
      name: data.name || '',
      code: data.code || '',
      description: data.description,
      cdeFrontUrl: data.cdeFrontUrl,
      cdeDataServiceUrl: data.cdeDataServiceUrl,
      cdeGatewayUrl: data.cdeGatewayUrl,
      workflowPolicyId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mutableApplications.unshift(app);
    return app;
  },

  async update(id: string, data: Partial<Application>): Promise<Application | null> {
    await delay();
    const idx = mutableApplications.findIndex(a => a.id === id);
    if (idx === -1) return null;
    const workflowPolicyId = data.workflowPolicyId
      ? setApplicationWorkflowPolicy(id, data.workflowPolicyId)
      : requireAt(mutableApplications, idx).workflowPolicyId;
    mutableApplications[idx] = { ...requireAt(mutableApplications, idx), ...data, workflowPolicyId, updatedAt: new Date().toISOString() };
    return requireAt(mutableApplications, idx);
  },

  async deactivate(id: string): Promise<Application | null> {
    await delay();
    const idx = mutableApplications.findIndex(a => a.id === id);
    if (idx === -1) return null;
    mutableApplications[idx] = { ...requireAt(mutableApplications, idx), isActive: false, updatedAt: new Date().toISOString() };
    return requireAt(mutableApplications, idx);
  },
};

// ============================================
// Security Checklist API — Items #1/#6/#7
// Per-test-case security checklists
// ============================================

// Default security checklist template items
let securityChecklistTemplate = [
  { title: 'بررسی احراز هویت', description: 'تایید صحت مکانیزم احراز هویت' },
  { title: 'بررسی مجوزدهی', description: 'تایید صحت سیستم سطوح دسترسی' },
  { title: 'بررسی رمزنگاری', description: 'بررسی رمزنگاری داده‌ها در انتقال و ذخیره‌سازی' },
  { title: 'بررسی XSS', description: 'بررسی آسیب‌پذیری Cross-Site Scripting' },
  { title: 'بررسی CSRF', description: 'بررسی آسیب‌پذیری Cross-Site Request Forgery' },
  { title: 'بررسی SQL Injection', description: 'بررسی آسیب‌پذیری تزریق SQL' },
  { title: 'بررسی ورودی‌ها', description: 'اعتبارسنجی تمام ورودی‌های کاربر' },
  { title: 'بررسی لاگ‌ها', description: 'ثبت صحیح رویدادهای امنیتی' },
];

// Security review records: one per test case
interface SecurityReviewRecord {
  id: string;
  testCaseId: string;
  testCaseTitle: string;
  applicationId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  items: Array<{
    id: string;
    title: string;
    description: string;
    result?: 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT_TESTED' | 'N_A';
    notes?: string;
  }>;
  reviewedById?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

let securityReviews: SecurityReviewRecord[] = [];

// Auto-generate security reviews for all test cases
function ensureSecurityReviewsExist(applicationId: string) {
  const appTestCases = testCases.filter(tc => tc.applicationId === applicationId);
  for (const tc of appTestCases) {
    if (!securityReviews.find(sr => sr.testCaseId === tc.id)) {
      securityReviews.push({
        id: uuidv4(),
        testCaseId: tc.id,
        testCaseTitle: tc.title,
        applicationId: tc.applicationId,
        status: 'PENDING',
        items: securityChecklistTemplate.map((item, idx) => ({
          id: `scli-${tc.id}-${idx}`,
          title: item.title,
          description: item.description,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

export const securityChecklistApi = {
  // Get all security reviews for an application (one per test case)
  async getAllForApp(applicationId: string): Promise<SecurityReviewRecord[]> {
    await delay();
    ensureSecurityReviewsExist(applicationId);
    return securityReviews.filter(sr => sr.applicationId === applicationId);
  },

  async getById(id: string): Promise<SecurityReviewRecord | null> {
    await delay();
    return securityReviews.find(sr => sr.id === id) || null;
  },

  // Update a single item result within a security review
  async updateItem(reviewId: string, itemId: string, result: string, notes: string, userId: string): Promise<SecurityReviewRecord | null> {
    await delay();
    const review = securityReviews.find(sr => sr.id === reviewId);
    if (!review) return null;
    const item = review.items.find(i => i.id === itemId);
    if (!item) return null;
    item.result = ensureSecurityReviewItemResult(result);
    item.notes = notes;
    review.status = 'IN_PROGRESS';
    review.reviewedById = userId;
    review.updatedAt = new Date().toISOString();
    return review;
  },

  // Complete a security review
  async complete(reviewId: string, userId: string): Promise<SecurityReviewRecord | null> {
    await delay();
    const review = securityReviews.find(sr => sr.id === reviewId);
    if (!review) return null;
    review.status = 'COMPLETED';
    review.reviewedById = userId;
    review.reviewedAt = new Date().toISOString();
    review.updatedAt = new Date().toISOString();
    return review;
  },

  // Admin: get template items
  async getTemplate(): Promise<typeof securityChecklistTemplate> {
    await delay();
    return [...securityChecklistTemplate];
  },

  // Admin: add template item
  async addTemplateItem(title: string, description: string): Promise<typeof securityChecklistTemplate> {
    await delay();
    securityChecklistTemplate.push({ title, description });
    return [...securityChecklistTemplate];
  },

  // Admin: update template item
  async updateTemplateItem(index: number, title: string, description: string): Promise<typeof securityChecklistTemplate> {
    await delay();
    if (index >= 0 && index < securityChecklistTemplate.length) {
      securityChecklistTemplate[index] = { title, description };
    }
    return [...securityChecklistTemplate];
  },

  // Admin: delete template item
  async deleteTemplateItem(index: number): Promise<typeof securityChecklistTemplate> {
    await delay();
    if (index >= 0 && index < securityChecklistTemplate.length) {
      securityChecklistTemplate.splice(index, 1);
    }
    return [...securityChecklistTemplate];
  },
};
