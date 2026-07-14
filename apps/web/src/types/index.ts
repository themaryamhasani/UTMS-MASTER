// ============================================
// UTMS - Unified Test Quality & Release Management System
// Type Definitions
// ============================================
// User Roles
export type UserRole = 'SYSTEM_ADMIN' | 'DEVELOPER' | 'QA_LEAD' | 'QA_SPECIALIST' | 'BA' | 'SECURITY_REVIEWER' | 'TECH_LEAD' | 'PRODUCT_OWNER';
export const ROLE_LABELS: Record<UserRole, string> = {
    SYSTEM_ADMIN: 'مدیر سیستم',
    DEVELOPER: 'توسعه‌دهنده',
    QA_LEAD: 'سرپرست QA',
    QA_SPECIALIST: 'متخصص QA',
    BA: 'تحلیلگر کسب‌وکار',
    SECURITY_REVIEWER: 'بازبین امنیت',
    TECH_LEAD: 'سرپرست فنی',
    PRODUCT_OWNER: 'مالک محصول',
};
export type VersionHistoryWorkflowMode = 'TECH_LEAD_DECISION' | 'QA_OWNED_DECISION';
export type WorkflowCapability = 'versionHistory:create' | 'versionHistory:qaReview' | 'versionHistory:decide' | 'versionHistory:riskAccept' | 'versionHistory:comment' | 'versionHistory:view';
export interface WorkflowPolicy {
    id: string;
    name: string;
    description: string;
    versionHistory: {
        mode: VersionHistoryWorkflowMode;
        qaReviewOwnerLabel: string;
        decisionOwnerLabel: string;
        requireIndependentDecisionRole: boolean;
        capabilityRoles: Record<WorkflowCapability, UserRole[]>;
    };
}
export type CommandSource = 'UI' | 'API' | 'SYSTEM' | 'RUNNER';
export interface CommandMetadata {
    idempotencyKey?: string | undefined;
    correlationId?: string | undefined;
    requestedAt?: string | undefined;
    source?: CommandSource | undefined;
}
export interface CommandTrace {
    id: string;
    commandName: string;
    entityType?: (EntityType | 'USER' | 'APPLICATION' | 'ROLE_ASSIGNMENT') | undefined;
    entityId?: string | undefined;
    applicationId?: string | undefined;
    userId?: string | undefined;
    idempotencyKey?: string | undefined;
    correlationId: string;
    source: CommandSource;
    status: 'COMPLETED' | 'REPLAYED';
    createdAt: string;
    replayedAt?: string | undefined;
}
export type IntegrationProvider = 'CDE' | 'FAVA';
export type IntegrationHealthStatus = 'DISABLED' | 'UNKNOWN' | 'HEALTHY' | 'DEGRADED';
export interface IntegrationAdapterConfig {
    provider: IntegrationProvider;
    enabled: boolean;
    baseUrl: string;
    credentialReference?: string | undefined;
    syncDirection: 'PULL' | 'PUSH' | 'BIDIRECTIONAL';
    lastHealthStatus: IntegrationHealthStatus;
    updatedAt: string;
}
export interface PlaywrightRunnerConfig {
    enabled: boolean;
    autoDiscovery: boolean;
    runnerId: string;
    commandTemplate: string;
    defaultWorkingDirectory: string;
    defaultTimeoutSeconds: number;
    artifactRoot: string;
    secretReference?: string | undefined;
    updatedAt: string;
}
export interface SystemIntegrationSettings {
    playwright: PlaywrightRunnerConfig;
    adapters: IntegrationAdapterConfig[];
    updatedAt: string;
    updatedById?: string | undefined;
}
// Application
export interface Application {
    id: string;
    name: string;
    code: string;
    description?: string | undefined;
    cdeFrontUrl?: string | undefined;
    cdeDataServiceUrl?: string | undefined;
    cdeGatewayUrl?: string | undefined;
    workflowPolicyId?: string | undefined;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
// User
export interface User {
    id: string;
    nationalCode?: string | undefined;
    phoneNumber: string;
    fullName: string;
    email?: string | undefined;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
// Access Scope — app-level or one/more selected systems.
export type AccessScope = 'APP' | 'SYSTEMS';
export type ApplicationScopeFilter = string | string[] | undefined;
// User Role Assignment
export interface UserRoleAssignment {
    id: string;
    userId: string;
    applicationId: string; // legacy/default application id for older mock data
    applicationIds?: string[] | undefined; // SYSTEMS scope can include multiple applications
    role: UserRole;
    scope: AccessScope; // APP = all systems, SYSTEMS = selected systems
    automatedTestsEnabled?: boolean | undefined; // Meaningful for QA_SPECIALIST access to automated-test cartables.
    isActive: boolean;
}
// Active Context (Session)
export interface ActiveContext {
    userId: string;
    user: User;
    assignmentId: string;
    applicationId: string; // 'ALL' for APP scope, otherwise the default application in scope
    scopeApplicationIds: string[];
    application: Application;
    role: UserRole;
    scope: AccessScope; // APP = sees all systems, SYSTEMS = selected systems
    automatedTestsEnabled?: boolean | undefined;
    token: string;
}
// Test Request Status
export type TestRequestStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'IN_PROGRESS' | 'COMPLETED';
export const TEST_REQUEST_STATUS_LABELS: Record<TestRequestStatus, string> = {
    DRAFT: 'پیش‌نویس',
    SUBMITTED: 'ارسال شده',
    UNDER_REVIEW: 'در حال بررسی',
    ACCEPTED: 'پذیرفته شده',
    REJECTED: 'رد شده',
    CANCELLED: 'لغو شده',
    IN_PROGRESS: 'در حال انجام',
    COMPLETED: 'تکمیل شده',
};
export type VersionHistoryDecision = 'APPROVED' | 'CONDITIONAL' | 'REJECTED' | 'BLOCKED';
// Test Request Priority
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export const PRIORITY_LABELS: Record<Priority, string> = {
    CRITICAL: 'بحرانی',
    HIGH: 'بالا',
    MEDIUM: 'متوسط',
    LOW: 'پایین',
};
// Test Request
export interface TestRequest {
    id: string;
    applicationId: string;
    title: string;
    description: string;
    version: string;
    buildNumber?: string | undefined;
    environment: string;
    priority: Priority;
    riskLevel: Priority;
    status: TestRequestStatus;
    systemUrl?: string | undefined;
    selectedRequirementIds?: string[] | undefined;
    testTypes?: string[] | undefined;
    requesterId: string;
    requester?: User | undefined;
    assigneeId?: string | undefined;
    assignee?: User | undefined;
    requirementId?: string | undefined;
    requirement?: Requirement | undefined;
    createdAt: string;
    updatedAt: string;
    submittedAt?: string | undefined;
    reviewedAt?: string | undefined;
    reviewedById?: string | undefined;
    reviewNotes?: string | undefined;
    versionHistoryId?: string | undefined;
    qaQualityStatus?: QAQualityStatus | undefined;
    qaQualityNotes?: string | undefined;
    releaseDecision?: VersionHistoryDecision | undefined;
    releaseDecisionReason?: string | undefined;
    releaseDecisionById?: string | undefined;
    releaseDecisionAt?: string | undefined;
}
// Requirement Status
export type RequirementStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED';
export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
    DRAFT: 'پیش‌نویس',
    IN_PROGRESS: 'در حال تکمیل',
    COMPLETED: 'تکمیل شده',
    APPROVED: 'تایید شده',
};
// Requirement
export interface Requirement {
    id: string;
    applicationId: string;
    title: string;
    description: string;
    acceptanceCriteria?: string | undefined;
    riskNotes?: string | undefined;
    status: RequirementStatus;
    createdById: string;
    createdBy?: User | undefined;
    testRequestId?: string | undefined;
    flows?: Flow[] | undefined;
    createdAt: string;
    updatedAt: string;
}
// Flow
export interface Flow {
    id: string;
    requirementId: string;
    title: string;
    description: string;
    steps?: string | undefined;
    createdById: string;
    createdBy?: User | undefined;
    createdAt: string;
    updatedAt: string;
}
// Test Case Status
export type TestCaseStatus = 'DRAFT' | 'READY' | 'OBSOLETE';
export const TEST_CASE_STATUS_LABELS: Record<TestCaseStatus, string> = {
    DRAFT: 'پیش‌نویس',
    READY: 'آماده اجرا',
    OBSOLETE: 'منسوخ',
};
// Test Type
export type TestType = 'FUNCTIONAL' | 'INTEGRATION' | 'REGRESSION' | 'SMOKE' | 'UAT' | 'SECURITY' | 'PERFORMANCE';
export const TEST_TYPE_LABELS: Record<TestType, string> = {
    FUNCTIONAL: 'عملکردی',
    INTEGRATION: 'یکپارچگی',
    REGRESSION: 'رگرسیون',
    SMOKE: 'اسموک',
    UAT: 'پذیرش کاربر',
    SECURITY: 'امنیت',
    PERFORMANCE: 'کارایی',
};
// Test Design Technique — Item #6: Updated options
export type TestDesignTechnique = 'REQUIREMENTS_BASED' | 'EQUIVALENCE_PARTITIONING' | 'BOUNDARY_VALUE' | 'DECISION_TABLE' | 'STATE_TRANSITION' | 'SCENARIO' | 'CLASSIFICATION_TREE' | 'COMBINATORIAL' | 'CAUSE_EFFECT' | 'SYNTAX' | 'RANDOM' | 'METAMORPHIC' | 'STATEMENT' | 'BRANCH' | 'DECISION' | 'BRANCH_CONDITION' | 'BRANCH_CONDITION_COMBINATION' | 'MCDC' | 'DATA_FLOW' | 'ERROR_GUESSING';
export const TEST_DESIGN_TECHNIQUE_LABELS: Record<TestDesignTechnique, string> = {
    REQUIREMENTS_BASED: 'تست مبتنی بر نیازمندی',
    EQUIVALENCE_PARTITIONING: 'افراز هم‌ارزی',
    BOUNDARY_VALUE: 'تحلیل مقادیر مرزی',
    DECISION_TABLE: 'تست جدول تصمیم',
    STATE_TRANSITION: 'تست انتقال وضعیت',
    SCENARIO: 'تست سناریویی',
    CLASSIFICATION_TREE: 'روش درخت طبقه‌بندی',
    COMBINATORIAL: 'طراحی تست ترکیبی',
    CAUSE_EFFECT: 'نمودار علت و معلول',
    SYNTAX: 'تست نحو/ساختار ورودی',
    RANDOM: 'تست تصادفی',
    METAMORPHIC: 'تست دگرریختی/رابطه‌ای',
    STATEMENT: 'تست دستورها',
    BRANCH: 'تست شاخه‌ها',
    DECISION: 'تست تصمیم‌ها',
    BRANCH_CONDITION: 'تست شرط شاخه',
    BRANCH_CONDITION_COMBINATION: 'تست ترکیب شرط‌های شاخه',
    MCDC: 'پوشش تصمیم/شرط اصلاح‌شده (MC/DC)',
    DATA_FLOW: 'تست جریان داده',
    ERROR_GUESSING: 'حدس خطا',
};
// Quality Attribute
export type QualityAttribute = 'FUNCTIONALITY' | 'RELIABILITY' | 'USABILITY' | 'EFFICIENCY' | 'MAINTAINABILITY' | 'PORTABILITY' | 'SECURITY';
export const QUALITY_ATTRIBUTE_LABELS: Record<QualityAttribute, string> = {
    FUNCTIONALITY: 'عملکرد',
    RELIABILITY: 'قابلیت اطمینان',
    USABILITY: 'قابلیت استفاده',
    EFFICIENCY: 'کارایی',
    MAINTAINABILITY: 'قابلیت نگهداری',
    PORTABILITY: 'قابلیت حمل',
    SECURITY: 'امنیت',
};
// Test Case
export interface TestCase {
    id: string;
    applicationId: string;
    testRequestId: string;
    requirementId: string;
    flowId?: string | undefined;
    title: string;
    scenario: string;
    preconditions: string;
    testData: string;
    steps: string;
    expectedResult: string;
    testType: TestType;
    testDesignTechnique: TestDesignTechnique;
    priority: Priority;
    riskLevel: Priority;
    qualityAttribute: QualityAttribute;
    automationCandidate: boolean;
    regressionCandidate: boolean;
    isActive?: boolean | undefined;
    isComplete?: boolean | undefined;
    readinessErrors?: string[] | undefined;
    status: TestCaseStatus;
    createdById: string;
    createdBy?: User | undefined;
    createdAt: string;
    updatedAt: string;
}
// Test Run Status
export type TestRunStatus = 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'BLOCKED' | 'SKIPPED';
export const TEST_RUN_STATUS_LABELS: Record<TestRunStatus, string> = {
    PENDING: 'در انتظار',
    IN_PROGRESS: 'در حال اجرا',
    PASSED: 'موفق',
    FAILED: 'ناموفق',
    BLOCKED: 'مسدود',
    SKIPPED: 'نادیده',
};
export type TestRunPurpose = 'SMOKE_TEST' | 'FUNCTIONAL_TEST' | 'REGRESSION_TEST' | 'RETEST' | 'UAT' | 'INTEGRATION_TEST' | 'SECURITY_TEST' | 'PERFORMANCE_TEST' | 'EXPLORATORY';
export const TEST_RUN_PURPOSE_LABELS: Record<TestRunPurpose, string> = {
    SMOKE_TEST: 'تست اسموک',
    FUNCTIONAL_TEST: 'تست عملکردی',
    REGRESSION_TEST: 'تست رگرسیون',
    RETEST: 'تست مجدد',
    UAT: 'تست پذیرش کاربر',
    INTEGRATION_TEST: 'تست یکپارچگی',
    SECURITY_TEST: 'تست امنیت',
    PERFORMANCE_TEST: 'تست کارایی',
    EXPLORATORY: 'تست اکتشافی',
};
// Test Run
export interface TestRun {
    id: string;
    testCaseId: string;
    testCase?: TestCase | undefined;
    testRequestId: string;
    applicationId: string;
    purposes?: TestRunPurpose[] | undefined;
    previousRunId?: string | undefined;
    previousRun?: TestRun | undefined;
    retestTaskId?: string | undefined;
    sourceBugId?: string | undefined;
    version: string;
    buildNumber?: string | undefined;
    versionChangedReason?: string | undefined;
    status: TestRunStatus;
    actualResult?: string | undefined;
    executedById: string;
    executedBy?: User | undefined;
    executedAt?: string | undefined;
    isFinalized: boolean;
    isLocked: boolean;
    lockedByVersionHistoryId?: string | undefined;
    lockedAt?: string | undefined;
    unlockedById?: string | undefined;
    unlockedAt?: string | undefined;
    unlockReason?: string | undefined;
    createdAt: string;
    updatedAt: string;
}
export type RetestTaskStatus = 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export const RETEST_TASK_STATUS_LABELS: Record<RetestTaskStatus, string> = {
    QUEUED: 'در صف QA',
    IN_PROGRESS: 'در حال اجرا',
    COMPLETED: 'تکمیل شده',
    CANCELLED: 'لغو شده',
};
export interface RetestTask {
    id: string;
    applicationId: string;
    bugId: string;
    bug?: Bug | undefined;
    previousRunId: string;
    previousRun?: TestRun | undefined;
    testRequestId: string;
    testCaseId: string;
    purposes: TestRunPurpose[];
    status: RetestTaskStatus;
    assignedToId?: string | undefined;
    assignedTo?: User | undefined;
    createdById: string;
    createdBy?: User | undefined;
    startedById?: string | undefined;
    startedBy?: User | undefined;
    startedAt?: string | undefined;
    completedAt?: string | undefined;
    createdRunId?: string | undefined;
    createdRun?: TestRun | undefined;
    idempotencyKey: string;
    correlationId?: string | undefined;
    createdAt: string;
    updatedAt: string;
}
// Bug Severity
export type BugSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'TRIVIAL';
export const BUG_SEVERITY_LABELS: Record<BugSeverity, string> = {
    CRITICAL: 'بحرانی',
    MAJOR: 'اصلی',
    MINOR: 'جزئی',
    TRIVIAL: 'کم‌اهمیت',
};
// Bug Status
export type BugStatus = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'FIXED' | 'RETEST_READY' | 'RETEST_PASSED' | 'RETEST_FAILED' | 'REOPENED' | 'CLOSED' | 'REJECTED' | 'NO_ACTION_NEEDED';
export const BUG_STATUS_LABELS: Record<BugStatus, string> = {
    NEW: 'جدید',
    ASSIGNED: 'تخصیص یافته',
    IN_PROGRESS: 'در حال رفع',
    FIXED: 'رفع شده',
    RETEST_READY: 'آماده تست مجدد',
    RETEST_PASSED: 'تست مجدد موفق',
    RETEST_FAILED: 'تست مجدد ناموفق',
    REOPENED: 'بازگشایی شده',
    CLOSED: 'بسته شده',
    REJECTED: 'رد شده',
    NO_ACTION_NEEDED: 'بدون نیاز به اقدام',
};
// Bug
export interface Bug {
    id: string;
    applicationId: string;
    testRunId: string;
    testRun?: TestRun | undefined;
    title: string;
    description: string;
    stepsToReproduce: string;
    expectedResult: string;
    actualResult: string;
    severity: BugSeverity;
    priority: Priority;
    status: BugStatus;
    assigneeId?: string | undefined;
    assignee?: User | undefined;
    reportedById: string;
    reportedBy?: User | undefined;
    fixedVersion?: string | undefined;
    fixNotes?: string | undefined;
    externalToolLink?: string | undefined;
    externalToolId?: string | undefined;
    isLocked?: boolean | undefined;
    lockedByVersionHistoryId?: string | undefined;
    lockedAt?: string | undefined;
    unlockedById?: string | undefined;
    unlockedAt?: string | undefined;
    unlockReason?: string | undefined;
    createdAt: string;
    updatedAt: string;
}
// Run Issue Type
export type RunIssueType = 'ENVIRONMENT' | 'ACCESS' | 'DATA' | 'DEPENDENCY';
export const RUN_ISSUE_TYPE_LABELS: Record<RunIssueType, string> = {
    ENVIRONMENT: 'محیط',
    ACCESS: 'دسترسی',
    DATA: 'داده',
    DEPENDENCY: 'وابستگی',
};
// Run Issue Status
export type RunIssueStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export const RUN_ISSUE_STATUS_LABELS: Record<RunIssueStatus, string> = {
    OPEN: 'باز',
    IN_PROGRESS: 'در حال بررسی',
    RESOLVED: 'حل شده',
    CLOSED: 'بسته',
};
// Run Issue
export interface RunIssue {
    id: string;
    testRunId: string;
    testRun?: TestRun | undefined;
    applicationId: string;
    issueType: RunIssueType;
    title: string;
    description: string;
    status: RunIssueStatus;
    reportedById: string;
    reportedBy?: User | undefined;
    assigneeId?: string | undefined;
    assignee?: User | undefined;
    resolution?: string | undefined;
    createdAt: string;
    updatedAt: string;
}
// Attachment Type
export type AttachmentType = 'SCREENSHOT' | 'LOG' | 'VIDEO' | 'REPORT' | 'TRACE' | 'DOCUMENT' | 'OTHER';
export const ATTACHMENT_TYPE_LABELS: Record<AttachmentType, string> = {
    SCREENSHOT: 'تصویر',
    LOG: 'لاگ',
    VIDEO: 'ویدیو',
    REPORT: 'گزارش',
    TRACE: 'ردیابی',
    DOCUMENT: 'سند',
    OTHER: 'سایر',
};
// Attachment Status
export type AttachmentStatus = 'UPLOADED' | 'VALID' | 'INVALID' | 'DELETED';
export const ATTACHMENT_STATUS_LABELS: Record<AttachmentStatus, string> = {
    UPLOADED: 'آپلود شده',
    VALID: 'معتبر',
    INVALID: 'نامعتبر',
    DELETED: 'حذف شده',
};
// Entity Type (for attachments)
export type EntityType = 'TEST_REQUEST' | 'REQUIREMENT' | 'FLOW' | 'TEST_CASE' | 'TEST_RUN' | 'BUG' | 'RETEST_TASK' | 'RUN_ISSUE' | 'CHECKLIST' | 'VERSION_HISTORY' | 'RELEASE_PUBLISH' | 'PLAYWRIGHT_RUN' | 'PLAYWRIGHT_TEST_FILE';
// Attachment
export interface Attachment {
    id: string;
    entityType: EntityType;
    entityId: string;
    type: AttachmentType;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storagePath: string;
    status: AttachmentStatus;
    uploadedById: string;
    uploadedBy?: User | undefined;
    createdAt: string;
    updatedAt: string;
}
// Checklist Type
export type ChecklistType = 'SECURITY' | 'PERFORMANCE' | 'PENETRATION';
export const CHECKLIST_TYPE_LABELS: Record<ChecklistType, string> = {
    SECURITY: 'امنیت',
    PERFORMANCE: 'کارایی',
    PENETRATION: 'نفوذ',
};
// Checklist Status
export type ChecklistStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_APPLICABLE';
export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
    PENDING: 'در انتظار',
    IN_PROGRESS: 'در حال بررسی',
    COMPLETED: 'تکمیل شده',
    NOT_APPLICABLE: 'غیرقابل اعمال',
};
// Checklist Result
export type ChecklistResult = 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT_TESTED';
export const CHECKLIST_RESULT_LABELS: Record<ChecklistResult, string> = {
    PASS: 'قبول',
    FAIL: 'رد',
    PARTIAL: 'جزئی',
    NOT_TESTED: 'تست نشده',
};
// Checklist
export interface Checklist {
    id: string;
    applicationId: string;
    testRequestId: string;
    type: ChecklistType;
    status: ChecklistStatus;
    result?: ChecklistResult | undefined;
    items: ChecklistItem[];
    notes?: string | undefined;
    reviewedById?: string | undefined;
    reviewedBy?: User | undefined;
    reviewedAt?: string | undefined;
    createdAt: string;
    updatedAt: string;
}
// Checklist Item
export interface ChecklistItem {
    id: string;
    checklistId: string;
    title: string;
    description?: string | undefined;
    result?: ChecklistResult | undefined;
    notes?: string | undefined;
    order: number;
}
// Playwright Run Status
export type PlaywrightRunStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR' | 'CANCELLED';
export const PLAYWRIGHT_RUN_STATUS_LABELS: Record<PlaywrightRunStatus, string> = {
    PENDING: 'در انتظار',
    RUNNING: 'در حال اجرا',
    PASSED: 'موفق',
    FAILED: 'ناموفق',
    ERROR: 'خطا',
    CANCELLED: 'لغو شده',
};
export type PlaywrightProject = 'chromium' | 'firefox' | 'webkit';
export type PlaywrightWorkers = 'auto' | '1' | '2' | '4';
export type PlaywrightMaxFailures = 'unlimited' | '1' | '3' | '5';
export type PlaywrightTraceMode = 'off' | 'retain-on-failure' | 'on-first-retry';
export type PlaywrightReporter = 'html' | 'json' | 'junit';
export const PLAYWRIGHT_PROJECT_LABELS: Record<PlaywrightProject, string> = {
    chromium: 'Chromium',
    firefox: 'Firefox',
    webkit: 'WebKit',
};
export const PLAYWRIGHT_WORKERS_LABELS: Record<PlaywrightWorkers, string> = {
    auto: 'Auto',
    '1': '1',
    '2': '2',
    '4': '4',
};
export const PLAYWRIGHT_MAX_FAILURES_LABELS: Record<PlaywrightMaxFailures, string> = {
    unlimited: 'نامحدود',
    '1': '1',
    '3': '3',
    '5': '5',
};
export const PLAYWRIGHT_TRACE_LABELS: Record<PlaywrightTraceMode, string> = {
    off: 'خاموش',
    'retain-on-failure': 'هنگام شکست',
    'on-first-retry': 'Retry',
};
export const PLAYWRIGHT_REPORTER_LABELS: Record<PlaywrightReporter, string> = {
    html: 'HTML',
    json: 'JSON',
    junit: 'JUnit',
};
export interface PlaywrightReportCodeFrameLine {
    lineNumber: number;
    text: string;
    highlighted?: boolean | undefined;
}
export interface PlaywrightReportFailure {
    title: string;
    project: PlaywrightProject;
    filePath: string;
    line: number;
    column: number;
    message: string;
    expected?: string | undefined;
    received?: string | undefined;
    durationMs: number;
    snippet: PlaywrightReportCodeFrameLine[];
}
export type PlaywrightReportTestOutcome = 'passed' | 'skipped' | 'cancelled';
export interface PlaywrightReportTestItem {
    title: string;
    project: PlaywrightProject;
    filePath: string;
    status: PlaywrightReportTestOutcome;
    durationMs: number;
}
export interface PlaywrightReport {
    reporter: PlaywrightReporter;
    fileName: string;
    mimeType: string;
    storagePath: string;
    generatedAt: string;
    status: PlaywrightRunStatus;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    cancelledTests: number;
    durationMs: number;
    failures: PlaywrightReportFailure[];
    passed: PlaywrightReportTestItem[];
    skipped: PlaywrightReportTestItem[];
    cancelled: PlaywrightReportTestItem[];
    content: string;
}
// Playwright Run
export interface PlaywrightRun {
    id: string;
    applicationId: string;
    testRequestId?: string | undefined;
    testCaseIds?: string[] | undefined;
    testFilePath: string;
    environment: string;
    projects?: PlaywrightProject[] | undefined;
    headed?: boolean | undefined;
    workers?: PlaywrightWorkers | undefined;
    retries?: number | undefined;
    maxFailures?: PlaywrightMaxFailures | undefined;
    trace?: PlaywrightTraceMode | undefined;
    reporter?: PlaywrightReporter | undefined;
    status: PlaywrightRunStatus;
    queueStatus?: ('QUEUED' | 'DISPATCHED' | 'DONE' | 'FAILED') | undefined;
    runnerId?: string | undefined;
    command?: string | undefined;
    workingDirectory?: string | undefined;
    timeoutSeconds?: number | undefined;
    artifactIds?: string[] | undefined;
    artifactPaths?: string[] | undefined;
    report?: PlaywrightReport | undefined;
    manualPath?: boolean | undefined;
    idempotencyKey?: string | undefined;
    correlationId?: string | undefined;
    requestedAt?: string | undefined;
    dispatchedAt?: string | undefined;
    lastHeartbeatAt?: string | undefined;
    startedAt?: string | undefined;
    completedAt?: string | undefined;
    duration?: number | undefined;
    totalTests?: number | undefined;
    passedTests?: number | undefined;
    failedTests?: number | undefined;
    skippedTests?: number | undefined;
    cancelledTests?: number | undefined;
    logs?: string | undefined;
    triggeredById: string;
    triggeredBy?: User | undefined;
    createdAt: string;
    updatedAt: string;
}
export type PlaywrightCdeRootKind = 'FRONT' | 'DATASERVICE' | 'GATEWAY';
export const PLAYWRIGHT_CDE_ROOT_LABELS: Record<PlaywrightCdeRootKind, string> = {
    FRONT: 'Front',
    DATASERVICE: 'Back NodeJS / DataService',
    GATEWAY: 'Gateway',
};
export interface PlaywrightTestFolder {
    id: string;
    applicationId: string;
    rootKind: PlaywrightCdeRootKind;
    rootUrl: string;
    relativePath: string;
    fullPath: string;
}
export interface PlaywrightTestFile {
    id: string;
    applicationId: string;
    rootKind: PlaywrightCdeRootKind;
    rootUrl: string;
    source: 'DISCOVERED' | 'MANAGED';
    folderPath: string;
    relativeFolderPath: string;
    fileName: string;
    fullPath: string;
    script: string;
    description?: string | undefined;
    createdById: string;
    createdBy?: User | undefined;
    createdAt: string;
    updatedAt: string;
}
// Version History / Publish Decision Status
export type VersionHistoryStatus = 'DRAFT' | 'QA_REVIEW' | 'PENDING_DECISION' | 'APPROVED' | 'CONDITIONAL' | 'REJECTED' | 'BLOCKED' | 'EMERGENCY' | 'PUBLISHED';
export const VERSION_HISTORY_STATUS_LABELS: Record<VersionHistoryStatus, string> = {
    DRAFT: 'پیش‌نویس',
    QA_REVIEW: 'بررسی QA',
    PENDING_DECISION: 'در انتظار تصمیم',
    APPROVED: 'تایید شده',
    CONDITIONAL: 'تایید مشروط',
    REJECTED: 'رد شده',
    BLOCKED: 'مسدود',
    EMERGENCY: 'اضطراری',
    PUBLISHED: 'منتشر شده',
};
// Compatibility aliases while the UI is migrated from ReleasePublish naming.
export type ReleasePublishStatus = VersionHistoryStatus;
export const RELEASE_PUBLISH_STATUS_LABELS = VERSION_HISTORY_STATUS_LABELS;
// QA Quality Status
export type QAQualityStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'READY' | 'NOT_READY' | 'CONDITIONAL';
export const QA_QUALITY_STATUS_LABELS: Record<QAQualityStatus, string> = {
    NOT_STARTED: 'شروع نشده',
    IN_PROGRESS: 'در حال بررسی',
    READY: 'آماده',
    NOT_READY: 'آماده نیست',
    CONDITIONAL: 'مشروط',
};
// VersionHistory is the PRD publish entity. UI label: «تصمیم و ثبت انتشار».
export interface VersionHistory {
    id: string;
    applicationId: string;
    version: string;
    buildNumber?: string | undefined;
    status: VersionHistoryStatus;
    primaryTestRequestId: string;
    relatedRequestIds: string[];
    isEmergency: boolean;
    emergencyReason?: string | undefined;
    riskDescription?: string | undefined;
    riskAccepted?: boolean | undefined;
    qaQualityStatus?: QAQualityStatus | undefined;
    qaQualityNotes?: string | undefined;
    qaReviewedById?: string | undefined;
    qaReviewedBy?: User | undefined;
    qaReviewedAt?: string | undefined;
    decision?: VersionHistoryDecision | undefined;
    decisionReason?: string | undefined;
    decisionById?: string | undefined;
    decisionBy?: User | undefined;
    decisionAt?: string | undefined;
    // legacy aggregate until all pages switch to primary/related request fields
    testRequestIds: string[];
    snapshot?: VersionSnapshot | undefined;
    decisionSnapshot?: VersionSnapshot | undefined;
    revisions?: VersionHistoryRevision[] | undefined;
    creationCommand?: CommandMetadata | undefined;
    lastCommand?: CommandMetadata | undefined;
    createdById: string;
    createdBy?: User | undefined;
    createdAt: string;
    updatedAt: string;
    publishedAt?: string | undefined;
}
export type ReleasePublish = VersionHistory;
export interface VersionHistoryRevision {
    id: string;
    versionHistoryId: string;
    qaQualityStatus: QAQualityStatus;
    qaQualityNotes: string;
    snapshot: VersionSnapshot;
    createdById: string;
    createdAt: string;
}
// Version Snapshot
export interface VersionSnapshot {
    totalTestCases: number;
    executedTestRuns?: number | undefined;
    pendingTestRuns?: number | undefined;
    passedTestRuns: number;
    failedTestRuns: number;
    blockedTestRuns: number;
    skippedTestRuns?: number | undefined;
    totalBugs: number;
    criticalBugs: number;
    majorBugs: number;
    openBugs: number;
    closedBugs: number;
    openRetestTasks?: number | undefined;
    completedRetestTasks?: number | undefined;
    openRunIssues?: number | undefined;
    securityChecklistResult?: ChecklistResult | undefined;
    performanceChecklistResult?: ChecklistResult | undefined;
    penetrationChecklistResult?: ChecklistResult | undefined;
    playwrightPassRate?: number | undefined;
    playwrightTotalRuns?: number | undefined;
    capturedAt: string;
}
export interface VersionHistoryEvidence {
    primaryRequest?: TestRequest | undefined;
    linkedRequests: TestRequest[];
    testCases: TestCase[];
    testRuns: TestRun[];
    bugs: Bug[];
    retestTasks: RetestTask[];
    runIssues: RunIssue[];
}
export type ReleaseSnapshot = VersionSnapshot;
// Audit Action
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'ASSIGN' | 'SUBMIT' | 'REVIEW' | 'APPROVE' | 'REJECT' | 'CANCEL' | 'FINALIZE' | 'UNLOCK' | 'PUBLISH' | 'EMERGENCY_PUBLISH' | 'ROLE_CHANGE' | 'LOGIN' | 'LOGOUT' | 'CONTEXT_SWITCH';
// Audit Log
export interface AuditLog {
    id: string;
    userId: string;
    user?: User | undefined;
    applicationId?: string | undefined;
    application?: Application | undefined;
    entityType: EntityType | 'USER' | 'APPLICATION' | 'ROLE_ASSIGNMENT';
    entityId: string;
    action: AuditAction;
    previousValue?: string | undefined;
    newValue?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
    createdAt: string;
}
// Comment
export interface Comment {
    id: string;
    entityType: EntityType;
    entityId: string;
    content: string;
    authorId: string;
    author?: User | undefined;
    createdAt: string;
    updatedAt: string;
}
// Notification
export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS';
export type NotificationDeliveryStatus = 'QUEUED' | 'DELIVERED' | 'FAILED';
export interface Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
    entityType?: EntityType | undefined;
    entityId?: string | undefined;
    channels?: NotificationChannel[] | undefined;
    deliveryStatus?: NotificationDeliveryStatus | undefined;
    deliveredAt?: string | undefined;
    correlationId?: string | undefined;
    isRead: boolean;
    createdAt: string;
}
export interface NotificationOutboxItem {
    id: string;
    notificationId: string;
    userId: string;
    channel: NotificationChannel;
    status: NotificationDeliveryStatus;
    retryCount: number;
    lastError?: string | undefined;
    correlationId?: string | undefined;
    createdAt: string;
    deliveredAt?: string | undefined;
}
// Pagination
export interface PaginationParams {
    page: number;
    limit: number;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
// Filter Params
export interface CartableFilterParams extends PaginationParams {
    search?: string | undefined;
    status?: string | undefined;
    priority?: Priority | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
    sortBy?: string | undefined;
    sortOrder?: ('asc' | 'desc') | undefined;
    assigneeId?: string | undefined;
    requesterId?: string | undefined;
    applicationId?: string | undefined;
}
// Dashboard Stats
export interface DashboardStats {
    pendingTestRequests: number;
    inProgressTestRequests: number;
    completedTestRequests: number;
    pendingBugs: number;
    criticalBugs: number;
    pendingChecklists: number;
    pendingReleases: number;
    totalTestCases: number;
    passedTestRuns: number;
    failedTestRuns: number;
}
// Cartable Item Base
export interface CartableItem {
    id: string;
    type: string;
    title: string;
    status: string;
    priority?: Priority | undefined;
    createdAt: string;
    updatedAt: string;
    dueDate?: string | undefined;
    assignee?: User | undefined;
    requester?: User | undefined;
    application: Application;
    actionRequired: string;
    actions: CartableAction[];
}
// Cartable Action
export interface CartableAction {
    id: string;
    label: string;
    icon: string;
    variant: 'primary' | 'secondary' | 'danger' | 'warning';
    requiresConfirmation: boolean;
    confirmationMessage?: string | undefined;
}
// Feature Flags
export interface FeatureFlags {
    cdeIntegration: boolean;
    favaIntegration: boolean;
    playwrightEnabled: boolean;
    emergencyPublishEnabled: boolean;
}

