import type {
  Application,
  AuditLog,
  Bug,
  Checklist,
  ChecklistResult,
  CommandTrace,
  Comment,
  Flow,
  Notification,
  NotificationOutboxItem,
  PlaywrightRun,
  PlaywrightTestFile,
  ReleasePublish,
  Requirement,
  RetestTask,
  RunIssue,
  SystemIntegrationSettings,
  TestCase,
  TestRequest,
  TestRun,
  User,
  UserRoleAssignment,
  Attachment,
} from '../types';

const DB_NAME = 'utms-browser-database';
const DB_VERSION = 1;
const STORE_NAME = 'key-value';
const STATE_KEY = 'utms-state-v1';
const SAVE_DEBOUNCE_MS = 150;

export interface PersistedSecurityChecklistTemplateItem {
  title: string;
  description: string;
}

export interface PersistedSecurityReviewRecord {
  id: string;
  testCaseId: string;
  testCaseTitle: string;
  applicationId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  items: Array<{
    id: string;
    title: string;
    description: string;
    result?: ChecklistResult | 'N_A';
    notes?: string;
  }>;
  reviewedById?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedUserCredential {
  userId: string;
  password: string;
  updatedAt: string;
}

export interface PersistedPasswordResetOtp {
  userId: string;
  code: string;
  expiresAt: string;
  requestedAt: string;
}

export interface PersistedUtmsState {
  schemaVersion: 1;
  savedAt: string;
  testRequests: TestRequest[];
  requirements: Requirement[];
  flows: Flow[];
  testCases: TestCase[];
  testRuns: TestRun[];
  bugs: Bug[];
  retestTasks: RetestTask[];
  runIssues: RunIssue[];
  checklists: Checklist[];
  playwrightRuns: PlaywrightRun[];
  playwrightTestFiles: PlaywrightTestFile[];
  hiddenDiscoveredPlaywrightPaths: string[];
  releasePublishes: ReleasePublish[];
  auditLogs: AuditLog[];
  comments: Comment[];
  notifications: Notification[];
  notificationOutbox: NotificationOutboxItem[];
  attachments: Attachment[];
  users: User[];
  applications: Application[];
  userRoleAssignments: UserRoleAssignment[];
  userCredentials?: PersistedUserCredential[];
  passwordResetOtps?: PersistedPasswordResetOtp[];
  commandTraces: CommandTrace[];
  systemIntegrationSettings: SystemIntegrationSettings;
  securityChecklistTemplate: PersistedSecurityChecklistTemplateItem[];
  securityReviews: PersistedSecurityReviewRecord[];
}

let saveTimerId: number | ReturnType<typeof setTimeout> | undefined;
let pendingSave: Promise<void> = Promise.resolve();

function getBrowserWindow(): Window | null {
  return typeof window === 'undefined' ? null : window;
}

function getNodeStateFile(): string | null {
  if (getBrowserWindow()) return null;
  const processLike = (globalThis as { process?: { versions?: { node?: string }; env?: Record<string, string | undefined>; cwd?: () => string } }).process;
  if (!processLike?.versions?.node || !processLike.cwd) return null;
  const nodeRequire = Function('return typeof require === "undefined" ? undefined : require')() as
    | ((name: string) => { mkdirSync?: Function; readFileSync?: Function; writeFileSync?: Function; renameSync?: Function; join?: Function })
    | undefined;
  if (!nodeRequire) return null;
  const path = nodeRequire('path') as { join: (...parts: string[]) => string };
  return processLike.env?.UTMS_DOMAIN_STATE_FILE || path.join(processLike.cwd(), 'runtime', 'domain-rpc', 'utms-state.json');
}

function readStateFromNodeFile(): PersistedUtmsState | null {
  const file = getNodeStateFile();
  if (!file) return null;
  try {
    const nodeRequire = Function('return require')() as (name: string) => { readFileSync: (path: string, encoding: string) => string };
    const fs = nodeRequire('fs');
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    return isPersistedUtmsState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStateToNodeFile(state: PersistedUtmsState): void {
  const file = getNodeStateFile();
  if (!file) return;
  try {
    const nodeRequire = Function('return require')() as (name: string) => {
      mkdirSync: (path: string, options: { recursive: boolean }) => void;
      writeFileSync: (path: string, data: string, encoding: string) => void;
      renameSync: (from: string, to: string) => void;
      dirname?: (path: string) => string;
    };
    const fs = nodeRequire('fs');
    const path = nodeRequire('path') as unknown as { dirname: (target: string) => string };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  } catch {
    // Server-side file persistence is best-effort; API calls should remain usable.
  }
}

function isPersistedUtmsState(value: unknown): value is PersistedUtmsState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PersistedUtmsState>;
  return candidate.schemaVersion === 1 && Array.isArray(candidate.testRequests);
}

function readStateFromLocalStorage(): PersistedUtmsState | null {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) return null;

  try {
    const raw = browserWindow.localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPersistedUtmsState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStateToLocalStorage(state: PersistedUtmsState): void {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) return;

  try {
    browserWindow.localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // IndexedDB remains the primary database; localStorage is only a best-effort mirror.
  }
}

function openDatabase(): Promise<IDBDatabase | null> {
  const browserWindow = getBrowserWindow();
  if (!browserWindow?.indexedDB) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = browserWindow.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open UTMS browser database.'));
    request.onblocked = () => reject(new Error('UTMS browser database upgrade is blocked.'));
  });
}

function readStateFromDatabase(db: IDBDatabase): Promise<PersistedUtmsState | null> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(STATE_KEY);

    request.onsuccess = () => {
      const result: unknown = request.result;
      resolve(isPersistedUtmsState(result) ? result : null);
    };
    request.onerror = () => reject(request.error ?? new Error('Unable to read UTMS state.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to read UTMS state.'));
  });
}

function writeStateToDatabase(db: IDBDatabase, state: PersistedUtmsState): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(state, STATE_KEY);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to persist UTMS state.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('UTMS state persistence was aborted.'));
  });
}

export async function loadPersistedUtmsState(): Promise<PersistedUtmsState | null> {
  const nodeState = readStateFromNodeFile();
  if (nodeState) return nodeState;

  let db: IDBDatabase | null = null;

  try {
    db = await openDatabase();
    if (db) {
      const databaseState = await readStateFromDatabase(db);
      if (databaseState) return databaseState;
    }
  } catch {
    // Fall back to the localStorage mirror below.
  } finally {
    db?.close();
  }

  return readStateFromLocalStorage();
}

export async function savePersistedUtmsState(state: PersistedUtmsState): Promise<void> {
  const browserWindow = getBrowserWindow();

  const stateToSave: PersistedUtmsState = {
    ...state,
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
  };

  if (!browserWindow) {
    writeStateToNodeFile(stateToSave);
    return;
  }

  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    if (db) {
      await writeStateToDatabase(db, stateToSave);
    }
  } catch {
    // Keep the UI usable even if the browser database is temporarily unavailable.
  } finally {
    db?.close();
  }

  writeStateToLocalStorage(stateToSave);
}

export function schedulePersistedUtmsStateSave(stateFactory: () => PersistedUtmsState): void {
  const browserWindow = getBrowserWindow();

  if (saveTimerId !== undefined) {
    if (browserWindow) {
      browserWindow.clearTimeout(saveTimerId as unknown as number);
    } else {
      clearTimeout(saveTimerId as ReturnType<typeof setTimeout>);
    }
  }

  const schedule = browserWindow
    ? browserWindow.setTimeout.bind(browserWindow)
    : setTimeout;

  saveTimerId = schedule(() => {
    saveTimerId = undefined;
    pendingSave = pendingSave
      .catch(() => undefined)
      .then(() => savePersistedUtmsState(stateFactory()));
  }, SAVE_DEBOUNCE_MS);
}
