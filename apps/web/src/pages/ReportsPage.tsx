import { useEffect, useMemo, useState } from 'react';
import { format as formatJalali, isValid as isValidDate, parse as parseJalali } from 'date-fns-jalali';
import {
  BarChart3, FileText, Bug, PlayCircle, ShieldCheck, Rocket, Users,
  History, Paperclip, Terminal, TrendingUp, AlertTriangle, CheckCircle,
  XCircle, Clock, ArrowLeft, Download, RefreshCw, GitBranch, Braces,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { Table as BaseTable, Pagination, exportToExcel } from '../components/ui/Table';
import { Badge, StatusBadge, PriorityBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useAuthStore } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import { toast } from '../components/ui/Toast';
import { applicationApi } from '../services/api';
import { reportsApi } from '../services/reportsApi';
import { apiConsoleApi } from '../services/apiConsoleApi';
import {
  TEST_REQUEST_STATUS_LABELS, BUG_STATUS_LABELS, BUG_SEVERITY_LABELS,
  TEST_RUN_STATUS_LABELS, REQUIREMENT_STATUS_LABELS, ROLE_LABELS,
  RELEASE_PUBLISH_STATUS_LABELS, QA_QUALITY_STATUS_LABELS, PLAYWRIGHT_RUN_STATUS_LABELS,
  TEST_CASE_STATUS_LABELS, CHECKLIST_STATUS_LABELS, ATTACHMENT_STATUS_LABELS,
  RETEST_TASK_STATUS_LABELS, RUN_ISSUE_STATUS_LABELS,
} from '../types';

type ReportKey =
  | 'overview' | 'quality-health' | 'test-requests' | 'requirements' | 'flow-coverage'
  | 'test-cases' | 'test-runs' | 'open-bugs' | 'developer-performance' | 'developer-bugfix'
  | 'checklists' | 'releases' | 'emergency' | 'playwright' | 'attachments'
  | 'users-roles' | 'audit' | 'product-quality' | 'comments' | 'traceability' | 'api-usage';

interface ReportDef {
  key: ReportKey;
  title: string;
  icon: React.ReactNode;
  description: string;
  roles: string[];
  category: string;
}

type ReportRole = {
  role: keyof typeof ROLE_LABELS | string;
  appName: string;
};

interface ReportNestedMetrics extends Record<string, number> {
  total: number;
  draft: number;
  open: number;
  passed: number;
  failed: number;
  blocked: number;
  pending: number;
  passRate: number;
  critical: number;
  major: number;
  fixed: number;
  retestReady: number;
  approved: number;
  conditional: number;
  rejected: number;
  emergency: number;
}

interface ReportRow extends Record<string, unknown> {
  title: string;
  status: string;
  priority: string;
  requester: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  executedAt: string;
  publishedAt: string;
  startedAt: string;
  capturedAt: string;
  date: string;
  ba: string;
  hasFlow: boolean;
  hasTestCase: boolean;
  testCase: string;
  executor: string;
  severity: string;
  developer: string;
  assignee: string;
  buildNumber: string;
  testCaseCount: number;
  runCount: number;
  openBugCount: number;
  ageDays: number;
  versionHistory: string;
  developerName: string;
  totalRequests: number;
  completed: number;
  rejected: number;
  bugsAssigned: number;
  bugsFixed: number;
  bugsReopened: number;
  criticalBugs: number;
  assigned: number;
  fixed: number;
  reopened: number;
  reopenRate: number;
  open: number;
  critical: number;
  qaName: string;
  count: number;
  ready: number;
  isEmergency: boolean;
  decision: string;
  techLead: string;
  revisionNo: number;
  qaStatus: string;
  qaQualityStatus: string;
  executedTestRuns: number;
  totalTestCases: number;
  passedTestRuns: number;
  failedTestRuns: number;
  openBugs: number;
  majorBugs: number;
  qaNotes: string;
  reason: string;
  risk: string;
  type: string;
  result: string;
  reviewer: string;
  itemsDone: number;
  itemsTotal: number;
  testFile: string;
  duration: number;
  passedTests: number;
  totalTests: number;
  triggeredBy: string;
  fileName: string;
  fileSize: number;
  uploader: string;
  fullName: string;
  phoneNumber: string;
  isActive: boolean;
  roles: ReportRole[];
  userName: string;
  action: string;
  entityType: string;
  appName: string;
  failedRuns: number;
  flows: number;
  readyTestCases: number;
  passedRuns: number;
  runs: number;
  criticalOpenBugs: number;
  testRequests: string | number;
  releases: string | number;
  coverageStatus: string;
  requirementTitle: string;
  requirementStatus: string;
  eventType: string;
  apiTitle: string;
  userDisplayName: string;
  userId: string;
  activeRole: keyof typeof ROLE_LABELS | string;
  eventAt: string;
  environmentId: string;
  correlationId: string;
  content: string;
  author: string;
}

interface ReportData extends Record<string, unknown> {
  total: number;
  draft: number;
  completed: number;
  approved: number;
  conditional: number;
  emergency: number;
  pending: number;
  failed: number;
  passed: number;
  ready: number;
  valid: number;
  deleted: number;
  inProgress: number;
  open: number;
  totalRuns: number;
  passRate: number;
  failRate: number;
  blockedRate: number;
  reopenRate: number;
  playwrightPassRate: number;
  requirementCoverage: number;
  criticalMajorOpen: number;
  totalRequirements: number;
  totalFlows: number;
  totalReleases: number;
  totalUsers: number;
  totalSize: number;
  activeRequests: number;
  readyForRelease: number;
  testPassRate: number;
  averageOpenAgeDays: number;
  automationCandidates: number;
  highRisk: number;
  activeUsers: number;
  inactiveUsers: number;
  multiRoleUsers: number;
  emergencyRate: number;
  withFlow: number;
  withRun: number;
  withTestCase: number;
  withoutTestCase: number;
  withOpenBug: number;
  details: ReportRow[];
  data: ReportRow[];
  changeHistory: ReportRow[];
  openRequestsList: ReportRow[];
  riskApps: ReportRow[];
  byQA: ReportRow[];
  testRequests: ReportNestedMetrics;
  requirements: ReportNestedMetrics;
  testCases: ReportNestedMetrics;
  testRuns: ReportNestedMetrics;
  bugs: ReportNestedMetrics;
  releases: ReportNestedMetrics;
  byAction: ReportNestedMetrics;
  summary?: {
    total: number;
    uniqueApis: number;
    uniqueUsers: number;
    byType?: ReportNestedMetrics;
  };
}

type ReportColumn<T extends object> = {
  key: string;
  title: string;
  sortable?: boolean | undefined;
  render?: ((item: T, index: number) => React.ReactNode) | undefined;
  className?: string | undefined;
};

type PaginatedReportTableProps<T extends object> = {
  columns: ReportColumn<T>[];
  data: T[];
  emptyMessage?: string | undefined;
  pageSize?: number | undefined;
};

function PaginatedReportTable<T extends object>({
  columns,
  data,
  emptyMessage = 'داده‌ای یافت نشد',
  pageSize = 10,
}: PaginatedReportTableProps<T>) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(pageSize);
  const totalPages = Math.max(1, Math.ceil(data.length / limit));
  const safePage = Math.min(page, totalPages);
  const pagedData = useMemo(
    () => data.slice((safePage - 1) * limit, safePage * limit),
    [data, safePage, limit]
  );

  useEffect(() => {
    setPage(1);
  }, [data.length, limit]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  return (
    <>
      <BaseTable
        columns={columns}
        data={pagedData}
        emptyMessage={emptyMessage}
        enableClientFilter={false}
        enableExport={false}
        enableColumnChooser={false}
      />
      {data.length > 0 && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          total={data.length}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
        />
      )}
    </>
  );
}

const REPORTS: ReportDef[] = [
  { key: 'overview', title: 'داشبورد کلان سامانه', icon: <BarChart3 className="w-5 h-5" />, description: 'نمای کلی وضعیت تمام موجودیت‌ها', roles: ['SYSTEM_ADMIN','QA_LEAD','TECH_LEAD','PRODUCT_OWNER'], category: 'مدیریتی' },
  { key: 'quality-health', title: 'سلامت کیفیت سامانه', icon: <TrendingUp className="w-5 h-5" />, description: 'نرخ موفقیت، شکست، پوشش و ریسک', roles: ['SYSTEM_ADMIN','QA_LEAD','TECH_LEAD','PRODUCT_OWNER'], category: 'مدیریتی' },
  { key: 'product-quality', title: 'نمای مدیریتی کیفیت محصول', icon: <TrendingUp className="w-5 h-5" />, description: 'آمار مدیریتی برای Product Owner', roles: ['PRODUCT_OWNER','SYSTEM_ADMIN'], category: 'مدیریتی' },
  { key: 'test-requests', title: 'گزارش درخواست‌های تست', icon: <FileText className="w-5 h-5" />, description: 'وضعیت درخواست‌ها به تفکیک Developer و سامانه', roles: ['SYSTEM_ADMIN','QA_LEAD','TECH_LEAD','PRODUCT_OWNER','DEVELOPER'], category: 'عملیاتی' },
  { key: 'requirements', title: 'گزارش نیازمندی‌ها', icon: <FileText className="w-5 h-5" />, description: 'تکمیل و پوشش نیازمندی‌ها', roles: ['SYSTEM_ADMIN','QA_LEAD','BA','PRODUCT_OWNER','TECH_LEAD'], category: 'عملیاتی' },
  { key: 'flow-coverage', title: 'گزارش پوشش Flow', icon: <FileText className="w-5 h-5" />, description: 'Flowهای دارای/بدون Test Case', roles: ['SYSTEM_ADMIN','QA_LEAD','BA','PRODUCT_OWNER'], category: 'عملیاتی' },
  { key: 'traceability', title: 'گزارش Traceability', icon: <GitBranch className="w-5 h-5" />, description: 'ردیابی نیازمندی تا Flow، Test Case، اجرا، باگ و انتشار', roles: ['SYSTEM_ADMIN','QA_LEAD','TECH_LEAD','PRODUCT_OWNER'], category: 'مدیریتی' },
  { key: 'api-usage', title: 'گزارش مصرف APIها', icon: <Braces className="w-5 h-5" />, description: 'رویدادهای Add، Open، Execute، Remove و مشاهده Version جدید', roles: ['SYSTEM_ADMIN','QA_LEAD','TECH_LEAD'], category: 'عملیاتی' },
  { key: 'test-cases', title: 'گزارش تست کیس‌ها', icon: <CheckCircle className="w-5 h-5" />, description: 'طراحی و وضعیت تست کیس‌ها', roles: ['SYSTEM_ADMIN','QA_LEAD','QA_SPECIALIST'], category: 'عملیاتی' },
  { key: 'test-runs', title: 'گزارش اجرای تست', icon: <PlayCircle className="w-5 h-5" />, description: 'Pass/Fail/Blocked آمار و جزئیات', roles: ['SYSTEM_ADMIN','QA_LEAD','QA_SPECIALIST','TECH_LEAD'], category: 'عملیاتی' },
  { key: 'open-bugs', title: 'گزارش باگ‌های باز', icon: <Bug className="w-5 h-5" />, description: 'باگ‌های Critical/Major و آماده Retest', roles: ['SYSTEM_ADMIN','QA_LEAD','QA_SPECIALIST','TECH_LEAD','DEVELOPER'], category: 'عملیاتی' },
  { key: 'developer-performance', title: 'عملکرد Developer', icon: <Users className="w-5 h-5" />, description: 'ثبت درخواست و کیفیت تغییرات', roles: ['SYSTEM_ADMIN','QA_LEAD','TECH_LEAD','PRODUCT_OWNER'], category: 'عملکرد' },
  { key: 'developer-bugfix', title: 'عملکرد اصلاح باگ', icon: <Bug className="w-5 h-5" />, description: 'سرعت و کیفیت اصلاح باگ Developer', roles: ['SYSTEM_ADMIN','QA_LEAD','TECH_LEAD'], category: 'عملکرد' },
  { key: 'checklists', title: 'گزارش چک‌لیست امنیت', icon: <ShieldCheck className="w-5 h-5" />, description: 'وضعیت بررسی‌های امنیتی', roles: ['SYSTEM_ADMIN','SECURITY_REVIEWER','QA_LEAD','TECH_LEAD'], category: 'عملیاتی' },
  { key: 'releases', title: 'گزارش VersionHistory', icon: <Rocket className="w-5 h-5" />, description: 'تصمیمات ثبت انتشار، وضعیت VersionHistory و گزارش تغییرات هر نسخه', roles: ['SYSTEM_ADMIN','QA_LEAD','TECH_LEAD','PRODUCT_OWNER','DEVELOPER','QA_SPECIALIST','BA','SECURITY_REVIEWER'], category: 'مدیریتی' },
  { key: 'emergency', title: 'گزارش Tag اضطراری', icon: <AlertTriangle className="w-5 h-5" />, description: 'ریسک و دلایل Tag اضطراری روی VersionHistory', roles: ['SYSTEM_ADMIN','QA_LEAD','TECH_LEAD','PRODUCT_OWNER'], category: 'مدیریتی' },
  { key: 'playwright', title: 'گزارش Playwright', icon: <Terminal className="w-5 h-5" />, description: 'اجرای تست‌های خودکار', roles: ['SYSTEM_ADMIN','QA_LEAD','QA_SPECIALIST','TECH_LEAD'], category: 'عملیاتی' },
  { key: 'attachments', title: 'گزارش پیوست‌ها', icon: <Paperclip className="w-5 h-5" />, description: 'فایل‌ها و مصرف Storage', roles: ['SYSTEM_ADMIN','QA_LEAD'], category: 'سیستمی' },
  { key: 'users-roles', title: 'گزارش کاربران و نقش‌ها', icon: <Users className="w-5 h-5" />, description: 'کاربران، نقش‌ها و دسترسی‌ها', roles: ['SYSTEM_ADMIN'], category: 'سیستمی' },
  { key: 'audit', title: 'گزارش Audit Trail', icon: <History className="w-5 h-5" />, description: 'عملیات حساس و رهگیری', roles: ['SYSTEM_ADMIN'], category: 'سیستمی' },
  { key: 'comments', title: 'گزارش کامنت‌ها', icon: <FileText className="w-5 h-5" />, description: 'بازخورد Product Owner روی VersionHistory', roles: ['PRODUCT_OWNER','QA_LEAD','TECH_LEAD','SYSTEM_ADMIN'], category: 'عملیاتی' },
];

function flattenReportValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(flattenReportValue).join(' ');
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).map(flattenReportValue).join(' ');
  return '';
}

function rowsFromReportValue(value: unknown): ReportRow[] {
  return Array.isArray(value) ? value as ReportRow[] : [];
}

function normalizeReportData(value: unknown): ReportData {
  return value as ReportData;
}

function getReportRowDate(row: ReportRow): string {
  return row.createdAt || row.updatedAt || row.executedAt || row.publishedAt || row.startedAt || row.capturedAt || row.date || '';
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function normalizeDateDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, digit => {
    const persianIndex = PERSIAN_DIGITS.indexOf(digit);
    if (persianIndex >= 0) return String(persianIndex);
    const arabicIndex = ARABIC_DIGITS.indexOf(digit);
    return arabicIndex >= 0 ? String(arabicIndex) : digit;
  });
}

function sanitizeJalaliDateInput(value: string): string {
  return normalizeDateDigits(value)
    .replace(/[.\-\s]+/g, '/')
    .replace(/[^\d/]/g, '')
    .replace(/\/{2,}/g, '/')
    .slice(0, 10);
}

function parseJalaliFilterDate(value: string, endOfDay = false): Date | null {
  const normalized = sanitizeJalaliDateInput(value);
  if (!normalized || normalized.length < 8) return null;
  const parsed = parseJalali(normalized, 'yyyy/MM/dd', new Date());
  if (!isValidDate(parsed)) return null;
  parsed.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return parsed;
}

function formatReportDate(value: string | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : formatJalali(date, 'yyyy/MM/dd');
}

function formatReportDateTime(value: string | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : formatJalali(date, 'yyyy/MM/dd HH:mm');
}

function getReportRowStatus(row: ReportRow): string {
  return row.status || row.qaStatus || row.qaQualityStatus || row.requirementStatus || row.coverageStatus || '';
}

const REPORT_STATUS_LABEL_GROUPS = [
  TEST_REQUEST_STATUS_LABELS,
  REQUIREMENT_STATUS_LABELS,
  TEST_CASE_STATUS_LABELS,
  TEST_RUN_STATUS_LABELS,
  RETEST_TASK_STATUS_LABELS,
  BUG_STATUS_LABELS,
  RUN_ISSUE_STATUS_LABELS,
  CHECKLIST_STATUS_LABELS,
  RELEASE_PUBLISH_STATUS_LABELS,
  QA_QUALITY_STATUS_LABELS,
  PLAYWRIGHT_RUN_STATUS_LABELS,
  ATTACHMENT_STATUS_LABELS,
] as Array<Record<string, string>>;

const REPORT_STATUS_LABEL_GROUPS_BY_REPORT: Partial<Record<ReportKey, Array<Record<string, string>>>> = {
  overview: [TEST_REQUEST_STATUS_LABELS, TEST_RUN_STATUS_LABELS, BUG_STATUS_LABELS, RELEASE_PUBLISH_STATUS_LABELS],
  'quality-health': [TEST_RUN_STATUS_LABELS, BUG_STATUS_LABELS, REQUIREMENT_STATUS_LABELS, PLAYWRIGHT_RUN_STATUS_LABELS],
  'test-requests': [TEST_REQUEST_STATUS_LABELS],
  requirements: [REQUIREMENT_STATUS_LABELS],
  'flow-coverage': [REQUIREMENT_STATUS_LABELS],
  traceability: [REQUIREMENT_STATUS_LABELS],
  'test-cases': [TEST_CASE_STATUS_LABELS, QA_QUALITY_STATUS_LABELS],
  'test-runs': [TEST_RUN_STATUS_LABELS, RETEST_TASK_STATUS_LABELS],
  'open-bugs': [BUG_STATUS_LABELS],
  'developer-bugfix': [BUG_STATUS_LABELS],
  checklists: [CHECKLIST_STATUS_LABELS],
  releases: [RELEASE_PUBLISH_STATUS_LABELS, QA_QUALITY_STATUS_LABELS],
  emergency: [RELEASE_PUBLISH_STATUS_LABELS],
  playwright: [PLAYWRIGHT_RUN_STATUS_LABELS],
  attachments: [ATTACHMENT_STATUS_LABELS],
};

const REPORT_STATUS_FALLBACK_LABELS: Record<string, string> = {
  ACCEPTED: 'پذیرفته شده',
  APPROVED: 'تایید شده',
  ASSIGNED: 'تخصیص یافته',
  BLOCKED: 'مسدود',
  CANCELLED: 'لغو شده',
  CLOSED: 'بسته',
  COMPLETED: 'تکمیل شده',
  CONDITIONAL: 'تایید مشروط',
  DELETED: 'حذف شده',
  DRAFT: 'پیش‌نویس',
  EMERGENCY: 'اضطراری',
  ERROR: 'خطا',
  FAILED: 'ناموفق',
  FIXED: 'رفع شده',
  IN_PROGRESS: 'در حال انجام',
  INVALID: 'نامعتبر',
  NEW: 'جدید',
  NO_ACTION_NEEDED: 'بدون نیاز به اقدام',
  NOT_APPLICABLE: 'غیرقابل اعمال',
  NOT_READY: 'آماده نیست',
  NOT_STARTED: 'شروع نشده',
  OBSOLETE: 'منسوخ',
  OPEN: 'باز',
  PASSED: 'موفق',
  PENDING: 'در انتظار',
  PENDING_DECISION: 'در انتظار تصمیم',
  PUBLISHED: 'منتشر شده',
  QA_REVIEW: 'بررسی QA',
  READY: 'آماده',
  REJECTED: 'رد شده',
  REOPENED: 'بازگشایی شده',
  RESOLVED: 'حل شده',
  RETEST_FAILED: 'تست مجدد ناموفق',
  RETEST_PASSED: 'تست مجدد موفق',
  RETEST_READY: 'آماده تست مجدد',
  RUNNING: 'در حال اجرا',
  SKIPPED: 'نادیده',
  SUBMITTED: 'ارسال شده',
  UNDER_REVIEW: 'در حال بررسی',
  UPLOADED: 'آپلود شده',
  VALID: 'معتبر',
};

function normalizeReportStatusKey(status: unknown): string {
  return String(status || '').trim().replace(/[\s-]+/g, '_').toUpperCase();
}

function getReportStatusLabel(status: string, reportKey: ReportKey | null): string {
  const normalizedStatus = normalizeReportStatusKey(status);
  if (!normalizedStatus) return '';
  const scopedGroups = reportKey ? REPORT_STATUS_LABEL_GROUPS_BY_REPORT[reportKey] || [] : [];
  const labelGroups = [...scopedGroups, ...REPORT_STATUS_LABEL_GROUPS];
  for (const labels of labelGroups) {
    if (labels[status]) return labels[status];
    if (labels[normalizedStatus]) return labels[normalizedStatus];
    const matched = Object.entries(labels).find(([key]) => normalizeReportStatusKey(key) === normalizedStatus);
    if (matched) return matched[1];
  }
  return REPORT_STATUS_FALLBACK_LABELS[normalizedStatus] || status;
}

export const ReportsPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { appId: scopedAppId, scopeApplicationIds, isAppLevel, isMultiSystem } = useDataScope();
  const [selectedReport, setSelectedReport] = useState<ReportKey | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  // Item #5: APP-level system filter
  const [selectedSystemId, setSelectedSystemId] = useState('');
  const [applications, setApplications] = useState<Array<{id: string; name: string}>>([]);
  const [reportFilters, setReportFilters] = useState({ dateFrom: '', dateTo: '', status: '', person: '' });
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ frequency: 'weekly', recipient: '' });
  const [alertForm, setAlertForm] = useState({ metric: 'openBugs', threshold: '1', recipient: '' });

  // Load applications from the active access scope.
  useEffect(() => {
    if (isAppLevel || isMultiSystem) {
      applicationApi
        .getAll()
        .then(rows => {
          const allowed = isAppLevel
            ? rows
            : rows.filter(app => scopeApplicationIds.includes(app.id));
          setApplications(allowed.map(app => ({ id: app.id, name: app.name })));
        })
        .catch(() => {
          setApplications(scopeApplicationIds.map(id => ({
            id,
            name: id === activeContext?.applicationId ? activeContext.application.name : 'سامانه نامشخص',
          })));
        });
      return;
    }
    setApplications([]);
  }, [activeContext, isAppLevel, isMultiSystem, scopeApplicationIds.join(',')]);

  if (!activeContext) return null;
  const role = activeContext.role;

  const accessibleReports = REPORTS.filter(r =>
    role === 'SYSTEM_ADMIN' || r.roles.includes(role)
  );

  const filteredReports = categoryFilter
    ? accessibleReports.filter(r => r.category === categoryFilter)
    : accessibleReports;

  const categories = [...new Set(accessibleReports.map(r => r.category))];

  const getPrimaryReportRows = (): ReportRow[] => {
    if (!reportData) return [];
    if (Array.isArray(reportData)) return reportData as ReportRow[];
    return rowsFromReportValue(reportData.data || reportData.details || reportData.changeHistory || reportData.openRequestsList || reportData.riskApps || reportData.byQA);
  };

  const filterReportRows = (rows: ReportRow[] = []) => rows.filter(row => {
    const fromDate = parseJalaliFilterDate(reportFilters.dateFrom);
    const toDate = parseJalaliFilterDate(reportFilters.dateTo, true);
    const rowDate = getReportRowDate(row);
    const parsedRowDate = rowDate ? new Date(rowDate) : null;
    const rowStatus = getReportRowStatus(row);
    const rowText = flattenReportValue(row).toLowerCase();
    if (fromDate && parsedRowDate && parsedRowDate < fromDate) return false;
    if (toDate && parsedRowDate && parsedRowDate > toDate) return false;
    if (reportFilters.status && normalizeReportStatusKey(rowStatus) !== normalizeReportStatusKey(reportFilters.status)) return false;
    if (reportFilters.person && !rowText.includes(reportFilters.person.toLowerCase())) return false;
    return true;
  });

  const filteredPrimaryRows = filterReportRows(getPrimaryReportRows());
  const availableStatuses = Array.from(
    getPrimaryReportRows().reduce((statuses, row) => {
      const rawStatus = getReportRowStatus(row);
      const normalizedStatus = normalizeReportStatusKey(rawStatus);
      if (normalizedStatus && !statuses.has(normalizedStatus)) {
        statuses.set(normalizedStatus, String(rawStatus).trim());
      }
      return statuses;
    }, new Map<string, string>()).values()
  );

  const downloadReportBlob = (content: BlobPart, type: string, extension: string, prefix = 'report') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prefix}-${selectedReport}-${new Date().toISOString().split('T')[0]}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadReport = async (key: ReportKey, targetSystemId = selectedSystemId) => {
    const targetAppId = targetSystemId || scopedAppId;
    setLoading(true);
    setSelectedReport(key);
    try {
      let data;
      switch (key) {
        case 'overview': data = await reportsApi.getSystemOverview(targetAppId); break;
        case 'quality-health': data = await reportsApi.getQualityHealth(targetAppId); break;
        case 'product-quality': data = await reportsApi.getProductQualityOverview(); break;
        case 'test-requests': data = await reportsApi.getTestRequestReport(targetAppId); break;
        case 'requirements': data = await reportsApi.getRequirementReport(targetAppId); break;
        case 'flow-coverage': data = await reportsApi.getFlowCoverage(targetAppId); break;
        case 'traceability': data = await reportsApi.getTraceabilityReport(targetAppId); break;
        case 'test-cases': data = await reportsApi.getTestCaseReport(targetAppId); break;
        case 'test-runs': data = await reportsApi.getTestRunReport(targetAppId); break;
        case 'open-bugs': data = await reportsApi.getOpenBugsList(targetAppId); break;
        case 'developer-performance': data = await reportsApi.getDeveloperPerformance(targetAppId); break;
        case 'developer-bugfix': data = await reportsApi.getDeveloperBugFixReport(targetAppId); break;
        case 'checklists': data = await reportsApi.getChecklistReport(targetAppId); break;
        case 'releases': data = await reportsApi.getReleaseReport(targetAppId); break;
        case 'emergency': data = await reportsApi.getEmergencyPublishReport(targetAppId); break;
        case 'playwright': data = await reportsApi.getPlaywrightReport(targetAppId); break;
        case 'attachments': data = await reportsApi.getAttachmentReport(); break;
        case 'users-roles': data = await reportsApi.getUsersRolesReport(); break;
        case 'audit': data = await reportsApi.getAuditReport(targetAppId); break;
        case 'comments': data = await reportsApi.getCommentReport(); break;
        case 'api-usage': data = await apiConsoleApi.getApiUsageReport({ page: 1, limit: 100, applicationId: targetAppId || 'ALL' }, activeContext); break;
      }
      setReportData(normalizeReportData(data));
    } catch { toast.error('خطا در بارگذاری گزارش.'); }
    finally { setLoading(false); }
  };

  const handleJsonExport = () => {
    if (!reportData) return;
    const jsonStr = JSON.stringify(reportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${selectedReport}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('خروجی گزارش دانلود شد.');
  };

  const handleExcelExport = () => {
    const rows = filteredPrimaryRows;
    if (!rows.length) {
      toast.warning('داده‌ای برای خروجی اکسل وجود ندارد.');
      return;
    }
    const firstRow = rows[0];
    if (!firstRow) return;
    const keys = Object.keys(firstRow).filter(key => !Array.isArray(firstRow[key]) && typeof firstRow[key] !== 'object');
    exportToExcel(rows, keys.map(key => ({ key, title: key })), `report-${selectedReport || 'unknown'}`);
    toast.success('خروجی اکسل گزارش دانلود شد.');
  };

  const handlePdfExport = () => {
    if (!reportData) return;
    const text = [
      'UTMS Report Export',
      `Report: ${selectedReport}`,
      `GeneratedAt: ${new Date().toISOString()}`,
      `Rows: ${filteredPrimaryRows.length}`,
      'PDF export generated from the current report data.',
    ].join('\n');
    downloadReportBlob(text, 'application/pdf', 'pdf');
    toast.success('خروجی PDF گزارش دانلود شد.');
  };

  // Report list view
  if (!selectedReport) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="گزارش‌ها و داشبوردها" subtitle={`${accessibleReports.length} گزارش قابل دسترسی`} />
        <main className="p-4 sm:p-6">
          {/* Category filter */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button onClick={() => setCategoryFilter('')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!categoryFilter ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              همه ({accessibleReports.length})
            </button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${categoryFilter === cat ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {cat} ({accessibleReports.filter(r => r.category === cat).length})
              </button>
            ))}
          </div>

          {/* Report cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.map(report => (
              <button key={report.key} onClick={() => loadReport(report.key)}
                className="p-5 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-right group">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-100 transition-colors">
                    {report.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{report.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                    <Badge variant="default" size="sm" className="mt-2">{report.category}</Badge>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Individual report view
  const currentReport = REPORTS.find(r => r.key === selectedReport);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title={currentReport?.title || 'گزارش'}
        subtitle={currentReport?.description}
        onRefresh={() => loadReport(selectedReport)}
        refreshing={loading}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />}
              onClick={handleJsonExport} disabled={!reportData}>JSON</Button>
            <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />}
              onClick={handleExcelExport} disabled={!reportData}>Excel</Button>
            <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />}
              onClick={handlePdfExport} disabled={!reportData}>PDF</Button>
            <Button variant="secondary" size="sm" onClick={() => setShowScheduleModal(true)} disabled={!reportData}>زمان‌بندی</Button>
            <Button variant="secondary" size="sm" onClick={() => setShowAlertModal(true)} disabled={!reportData}>Alert</Button>
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => { setSelectedReport(null); setReportData(null); }}>بازگشت</Button>
          </div>
        }
      />
      <main className="p-4 sm:p-6">
        {/* Item #5: System filter for APP-level and multi-system users */}
        {(isAppLevel || isMultiSystem) && (
          <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <label className="block text-sm font-medium text-indigo-800 mb-2">فیلتر سامانه</label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setSelectedSystemId(''); if (selectedReport) loadReport(selectedReport, ''); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${!selectedSystemId ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 border border-indigo-300'}`}>
                همه سامانه‌ها
              </button>
              {applications.map(app => (
                <button key={app.id} onClick={() => { setSelectedSystemId(app.id); if (selectedReport) loadReport(selectedReport, app.id); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${selectedSystemId === app.id ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 border border-indigo-300'}`}>
                  {app.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <Card className="mb-6" padding="sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-600">از تاریخ</span>
              <input type="text" value={reportFilters.dateFrom}
                dir="ltr"
                inputMode="numeric"
                placeholder={`مثال ${formatJalali(new Date(), 'yyyy/MM/dd')}`}
                onChange={(e) => setReportFilters({ ...reportFilters, dateFrom: sanitizeJalaliDateInput(e.target.value) })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-600">تا تاریخ</span>
              <input type="text" value={reportFilters.dateTo}
                dir="ltr"
                inputMode="numeric"
                placeholder={`مثال ${formatJalali(new Date(), 'yyyy/MM/dd')}`}
                onChange={(e) => setReportFilters({ ...reportFilters, dateTo: sanitizeJalaliDateInput(e.target.value) })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-600">وضعیت</span>
              <select value={reportFilters.status}
                onChange={(e) => setReportFilters({ ...reportFilters, status: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">همه وضعیت</option>
                {availableStatuses.map(status => (
                  <option key={status} value={status}>{getReportStatusLabel(status, selectedReport)}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-600">شخص / متن</span>
              <input type="text" value={reportFilters.person}
                onChange={(e) => setReportFilters({ ...reportFilters, person: e.target.value })}
                placeholder="نام، نقش، وضعیت یا کد"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>ردیف‌های منطبق: {filteredPrimaryRows.length}</span>
            <button type="button" className="text-blue-600 hover:text-blue-700"
              onClick={() => setReportFilters({ dateFrom: '', dateTo: '', status: '', person: '' })}>
              پاک کردن فیلترها
            </button>
          </div>
        </Card>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <span className="mr-3 text-gray-500">در حال بارگذاری گزارش...</span>
          </div>
        )}

        {!loading && reportData && (
          <div className="space-y-6">
            {/* ===== OVERVIEW ===== */}
            {selectedReport === 'overview' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <StatCard title="درخواست‌های تست" value={reportData.testRequests.total} icon={<FileText className="w-6 h-6" />} />
                  <StatCard title="درخواست‌های باز" value={reportData.testRequests.open} icon={<Clock className="w-6 h-6" />} variant="warning" />
                  <StatCard title="تست کیس‌ها" value={reportData.testCases.total} icon={<CheckCircle className="w-6 h-6" />} />
                  <StatCard title="نرخ موفقیت تست" value={`${reportData.testRuns.passRate}%`} icon={<TrendingUp className="w-6 h-6" />} variant="success" />
                  <StatCard title="باگ‌های باز" value={reportData.bugs.open} icon={<Bug className="w-6 h-6" />} variant="danger" />
                  <StatCard title="باگ Critical" value={reportData.bugs.critical} icon={<AlertTriangle className="w-6 h-6" />} variant="danger" />
                  <StatCard title="VersionHistory" value={reportData.releases.total} icon={<Rocket className="w-6 h-6" />} />
                  <StatCard title="Emergency" value={reportData.releases.emergency} icon={<AlertTriangle className="w-6 h-6" />} variant="warning" />
                </div>

                {/* Item #2: Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Test Runs Bar Chart */}
                  <Card>
                    <h4 className="font-semibold text-gray-900 mb-4">📊 وضعیت اجراهای تست</h4>
                    <div className="space-y-3">
                      {[
                        { label: 'موفق', value: reportData.testRuns.passed, total: reportData.testRuns.total, color: 'bg-green-500' },
                        { label: 'ناموفق', value: reportData.testRuns.failed, total: reportData.testRuns.total, color: 'bg-red-500' },
                        { label: 'مسدود', value: reportData.testRuns.blocked, total: reportData.testRuns.total, color: 'bg-amber-500' },
                        { label: 'در انتظار', value: reportData.testRuns.pending, total: reportData.testRuns.total, color: 'bg-gray-400' },
                      ].map(bar => (
                        <div key={bar.label} className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 w-16 text-left">{bar.label}</span>
                          <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full ${bar.color} rounded-full transition-all duration-500`}
                              style={{ width: `${bar.total > 0 ? (bar.value / bar.total) * 100 : 0}%` }} />
                          </div>
                          <span className="text-sm font-medium text-gray-900 w-10 text-left">{bar.value}</span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Bug Severity Pie-like Chart */}
                  <Card>
                    <h4 className="font-semibold text-gray-900 mb-4">📊 توزیع شدت باگ‌ها</h4>
                    <div className="flex items-center gap-6">
                      <div className="relative w-32 h-32">
                        <svg viewBox="0 0 36 36" className="w-32 h-32">
                          <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                          <circle cx="18" cy="18" r="16" fill="none" stroke="#ef4444" strokeWidth="3"
                            strokeDasharray={`${reportData.bugs.total > 0 ? (reportData.bugs.critical / reportData.bugs.total) * 100 : 0} 100`}
                            strokeDashoffset="0" transform="rotate(-90 18 18)" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold text-gray-900">{reportData.bugs.total}</span>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span>Critical: {reportData.bugs.critical}</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500" /><span>Major: {reportData.bugs.major}</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /><span>رفع شده: {reportData.bugs.fixed}</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500" /><span>آماده Retest: {reportData.bugs.retestReady}</span></div>
                      </div>
                    </div>
                  </Card>

                  {/* VersionHistory Decision Chart */}
                  <Card>
                    <h4 className="font-semibold text-gray-900 mb-4">📊 تصمیمات انتشار</h4>
                    <div className="space-y-3">
                      {[
                        { label: 'تأیید شده', value: reportData.releases.approved, color: 'bg-green-500' },
                        { label: 'مشروط', value: reportData.releases.conditional, color: 'bg-amber-500' },
                        { label: 'رد شده', value: reportData.releases.rejected, color: 'bg-red-500' },
                        { label: 'مسدود', value: reportData.releases.blocked, color: 'bg-gray-500' },
                        { label: 'اضطراری', value: reportData.releases.emergency, color: 'bg-purple-500' },
                      ].map(bar => (
                        <div key={bar.label} className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 w-20 text-left">{bar.label}</span>
                          <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full ${bar.color} rounded-full`}
                              style={{ width: `${reportData.releases.total > 0 ? (bar.value / reportData.releases.total) * 100 : 0}%` }} />
                          </div>
                          <span className="text-sm font-medium w-8 text-left">{bar.value}</span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Pass Rate Gauge */}
                  <Card>
                    <h4 className="font-semibold text-gray-900 mb-4">📊 نرخ موفقیت کلی</h4>
                    <div className="flex flex-col items-center">
                      <div className="relative w-40 h-40">
                        <svg viewBox="0 0 36 36" className="w-40 h-40">
                          <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
                          <circle cx="18" cy="18" r="16" fill="none"
                            stroke={reportData.testRuns.passRate >= 70 ? '#22c55e' : reportData.testRuns.passRate >= 40 ? '#f59e0b' : '#ef4444'}
                            strokeWidth="2.5" strokeLinecap="round"
                            strokeDasharray={`${reportData.testRuns.passRate} 100`}
                            strokeDashoffset="0" transform="rotate(-90 18 18)" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-3xl font-bold text-gray-900">{reportData.testRuns.passRate}%</span>
                          <span className="text-xs text-gray-500">نرخ Pass</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>

                <Card>
                  <h3 className="font-semibold text-gray-900 mb-4">درخواست‌های باز</h3>
                  <PaginatedReportTable columns={[
                    { key: 'title', title: 'عنوان', render: (i: ReportRow) => <span className="font-medium">{i.title}</span> },
                    { key: 'status', title: 'وضعیت', render: (i: ReportRow) => <StatusBadge status={i.status} labels={TEST_REQUEST_STATUS_LABELS} /> },
                    { key: 'priority', title: 'اولویت', render: (i: ReportRow) => <PriorityBadge priority={i.priority} /> },
                    { key: 'requester', title: 'درخواست‌دهنده', render: (i: ReportRow) => i.requester },
                    { key: 'version', title: 'نسخه', render: (i: ReportRow) => i.version },
                    { key: 'date', title: 'تاریخ', render: (i: ReportRow) => formatReportDate(i.createdAt) },
                  ]} data={filterReportRows(reportData.openRequestsList || [])} emptyMessage="درخواست بازی وجود ندارد" />
                </Card>
              </>
            )}

            {/* ===== QUALITY HEALTH ===== */}
            {selectedReport === 'quality-health' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <StatCard title="نرخ موفقیت تست" value={`${reportData.passRate}%`} icon={<CheckCircle className="w-6 h-6" />} variant="success" />
                  <StatCard title="نرخ شکست تست" value={`${reportData.failRate}%`} icon={<XCircle className="w-6 h-6" />} variant="danger" />
                  <StatCard title="نرخ Blocked" value={`${reportData.blockedRate}%`} icon={<AlertTriangle className="w-6 h-6" />} variant="warning" />
                  <StatCard title="باگ Critical/Major باز" value={reportData.criticalMajorOpen} icon={<Bug className="w-6 h-6" />} variant="danger" />
                  <StatCard title="نرخ Reopen" value={`${reportData.reopenRate}%`} icon={<RefreshCw className="w-6 h-6" />} />
                  <StatCard title="پوشش نیازمندی" value={`${reportData.requirementCoverage}%`} icon={<FileText className="w-6 h-6" />} variant="primary" />
                  <StatCard title="نرخ Playwright" value={`${reportData.playwrightPassRate}%`} icon={<Terminal className="w-6 h-6" />} variant="success" />
                  <StatCard title="کل اجراها" value={reportData.totalRuns} icon={<PlayCircle className="w-6 h-6" />} />
                </div>
                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <Card>
                    <h4 className="font-semibold text-gray-900 mb-4">📊 شاخص‌های کیفیت</h4>
                    <div className="space-y-4">
                      {[
                        { label: 'نرخ موفقیت', value: reportData.passRate, color: 'bg-green-500' },
                        { label: 'پوشش نیازمندی', value: reportData.requirementCoverage, color: 'bg-blue-500' },
                        { label: 'نرخ Playwright', value: reportData.playwrightPassRate, color: 'bg-purple-500' },
                        { label: 'نرخ شکست', value: reportData.failRate, color: 'bg-red-500' },
                        { label: 'نرخ Reopen', value: reportData.reopenRate, color: 'bg-amber-500' },
                      ].map(m => (
                        <div key={m.label}>
                          <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">{m.label}</span><span className="font-medium">{m.value}%</span></div>
                          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full ${m.color} rounded-full transition-all duration-700`} style={{ width: `${m.value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card>
                    <h4 className="font-semibold text-gray-900 mb-4">📊 نرخ موفقیت کلی</h4>
                    <div className="flex flex-col items-center py-4">
                      <div className="relative w-36 h-36">
                        <svg viewBox="0 0 36 36" className="w-36 h-36">
                          <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                          <circle cx="18" cy="18" r="16" fill="none"
                            stroke={reportData.passRate >= 70 ? '#22c55e' : reportData.passRate >= 40 ? '#f59e0b' : '#ef4444'}
                            strokeWidth="3" strokeLinecap="round"
                            strokeDasharray={`${reportData.passRate} 100`} transform="rotate(-90 18 18)" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-3xl font-bold">{reportData.passRate}%</span>
                          <span className="text-xs text-gray-500">Pass Rate</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </>
            )}

            {/* ===== REQUIREMENTS ===== */}
            {selectedReport === 'requirements' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <StatCard title="کل نیازمندی‌ها" value={reportData.total} icon={<FileText className="w-6 h-6" />} />
                  <StatCard title="Draft" value={reportData.draft} variant="warning" icon={<Clock className="w-6 h-6" />} />
                  <StatCard title="تکمیل شده" value={reportData.completed} variant="success" icon={<CheckCircle className="w-6 h-6" />} />
                  <StatCard title="بدون Test Case" value={reportData.withoutTestCase} variant="danger" icon={<XCircle className="w-6 h-6" />} />
                </div>
                <Card>
                  <h3 className="font-semibold text-gray-900 mb-4">جزئیات نیازمندی‌ها</h3>
                  <PaginatedReportTable columns={[
                    { key: 'title', title: 'عنوان', render: (i: ReportRow) => <span className="font-medium">{i.title}</span> },
                    { key: 'status', title: 'وضعیت', render: (i: ReportRow) => <StatusBadge status={i.status} labels={REQUIREMENT_STATUS_LABELS} /> },
                    { key: 'ba', title: 'BA', render: (i: ReportRow) => i.ba },
                    { key: 'flow', title: 'Flow', render: (i: ReportRow) => i.hasFlow ? <Badge variant="success" size="sm">دارد</Badge> : <Badge variant="danger" size="sm">ندارد</Badge> },
                    { key: 'tc', title: 'Test Case', render: (i: ReportRow) => i.hasTestCase ? <Badge variant="success" size="sm">دارد</Badge> : <Badge variant="danger" size="sm">ندارد</Badge> },
                  ]} data={filterReportRows(reportData.details || [])} emptyMessage="نیازمندی‌ای یافت نشد" />
                </Card>
              </>
            )}

            {/* ===== TEST RUNS ===== */}
            {selectedReport === 'test-runs' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <StatCard title="کل اجراها" value={reportData.total} icon={<PlayCircle className="w-6 h-6" />} />
                  <StatCard title="موفق" value={reportData.passed} variant="success" icon={<CheckCircle className="w-6 h-6" />} />
                  <StatCard title="ناموفق" value={reportData.failed} variant="danger" icon={<XCircle className="w-6 h-6" />} />
                  <StatCard title="نرخ موفقیت" value={`${reportData.passRate}%`} variant="success" icon={<TrendingUp className="w-6 h-6" />} />
                </div>
                <Card>
                  <h3 className="font-semibold text-gray-900 mb-4">جزئیات اجراها</h3>
                  <PaginatedReportTable columns={[
                    { key: 'testCase', title: 'تست کیس', render: (i: ReportRow) => i.testCase },
                    { key: 'status', title: 'وضعیت', render: (i: ReportRow) => <StatusBadge status={i.status} labels={TEST_RUN_STATUS_LABELS} /> },
                    { key: 'version', title: 'نسخه', render: (i: ReportRow) => i.version },
                    { key: 'executor', title: 'اجراکننده', render: (i: ReportRow) => i.executor },
                  ]} data={filterReportRows(reportData.details || [])} emptyMessage="اجرایی یافت نشد" />
                </Card>
              </>
            )}

            {/* ===== OPEN BUGS ===== */}
            {selectedReport === 'open-bugs' && (
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">باگ‌های باز ({Array.isArray(reportData) ? reportData.length : 0})</h3>
                <PaginatedReportTable columns={[
                  { key: 'title', title: 'عنوان', render: (i: ReportRow) => <span className="font-medium">{i.title}</span> },
                  { key: 'severity', title: 'شدت', render: (i: ReportRow) => <StatusBadge status={i.severity} labels={BUG_SEVERITY_LABELS} /> },
                  { key: 'priority', title: 'اولویت', render: (i: ReportRow) => <PriorityBadge priority={i.priority} /> },
                  { key: 'status', title: 'وضعیت', render: (i: ReportRow) => <StatusBadge status={i.status} labels={BUG_STATUS_LABELS} /> },
                  { key: 'developer', title: 'توسعه‌دهنده', render: (i: ReportRow) => i.developer },
                  { key: 'date', title: 'تاریخ', render: (i: ReportRow) => formatReportDate(i.createdAt) },
                ]} data={filterReportRows(Array.isArray(reportData) ? reportData : [])} emptyMessage="باگ بازی وجود ندارد ✓" />
              </Card>
            )}

            {/* ===== TEST REQUESTS ===== */}
            {selectedReport === 'test-requests' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <StatCard title="کل درخواست‌ها" value={reportData.total} icon={<FileText className="w-6 h-6" />} />
                  <StatCard title="درخواست‌های باز" value={reportData.open} icon={<Clock className="w-6 h-6" />} variant="warning" />
                  <StatCard title="تکمیل شده" value={reportData.completed} icon={<CheckCircle className="w-6 h-6" />} variant="success" />
                  <StatCard title="میانگین سن باز" value={`${reportData.averageOpenAgeDays} روز`} icon={<TrendingUp className="w-6 h-6" />} />
                </div>
                <Card>
                  <h3 className="font-semibold text-gray-900 mb-4">جزئیات درخواست‌های تست</h3>
                  <PaginatedReportTable columns={[
                    { key: 'title', title: 'عنوان', render: (i: ReportRow) => <span className="font-medium">{i.title}</span> },
                    { key: 'status', title: 'وضعیت', render: (i: ReportRow) => <StatusBadge status={i.status} labels={TEST_REQUEST_STATUS_LABELS} /> },
                    { key: 'priority', title: 'اولویت', render: (i: ReportRow) => <PriorityBadge priority={i.priority} /> },
                    { key: 'requester', title: 'درخواست‌دهنده', render: (i: ReportRow) => i.requester },
                    { key: 'assignee', title: 'تستر', render: (i: ReportRow) => i.assignee },
                    { key: 'version', title: 'نسخه/بیلد', render: (i: ReportRow) => `${i.version}${i.buildNumber !== '-' ? ` / ${i.buildNumber}` : ''}` },
                    { key: 'coverage', title: 'پوشش', render: (i: ReportRow) => `${i.testCaseCount} TC / ${i.runCount} Run / ${i.openBugCount} Bug باز` },
                    { key: 'ageDays', title: 'سن', render: (i: ReportRow) => `${i.ageDays} روز` },
                    { key: 'versionHistory', title: 'VersionHistory', render: (i: ReportRow) => i.versionHistory },
                  ]} data={filterReportRows(reportData.details || [])} emptyMessage="درخواست تستی یافت نشد" />
                </Card>
              </>
            )}

            {/* ===== DEVELOPER PERFORMANCE ===== */}
            {selectedReport === 'developer-performance' && (
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">عملکرد Developer</h3>
                <PaginatedReportTable columns={[
                  { key: 'name', title: 'نام', render: (i: ReportRow) => <span className="font-medium">{i.developerName}</span> },
                  { key: 'total', title: 'درخواست‌ها', render: (i: ReportRow) => i.totalRequests },
                  { key: 'completed', title: 'تکمیل شده', render: (i: ReportRow) => <Badge variant="success" size="sm">{i.completed}</Badge> },
                  { key: 'rejected', title: 'رد شده', render: (i: ReportRow) => <Badge variant="danger" size="sm">{i.rejected}</Badge> },
                  { key: 'bugs', title: 'باگ تخصیصی', render: (i: ReportRow) => i.bugsAssigned },
                  { key: 'fixed', title: 'رفع شده', render: (i: ReportRow) => i.bugsFixed },
                  { key: 'reopened', title: 'Reopen', render: (i: ReportRow) => i.bugsReopened > 0 ? <Badge variant="danger" size="sm">{i.bugsReopened}</Badge> : '0' },
                  { key: 'critical', title: 'Critical', render: (i: ReportRow) => i.criticalBugs > 0 ? <Badge variant="danger" size="sm">{i.criticalBugs}</Badge> : '0' },
                ]} data={filterReportRows(Array.isArray(reportData) ? reportData : [])} emptyMessage="داده‌ای یافت نشد" />
              </Card>
            )}

            {/* ===== DEVELOPER BUGFIX ===== */}
            {selectedReport === 'developer-bugfix' && (
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">عملکرد اصلاح باگ</h3>
                <PaginatedReportTable columns={[
                  { key: 'name', title: 'Developer', render: (i: ReportRow) => <span className="font-medium">{i.developerName}</span> },
                  { key: 'assigned', title: 'تخصیصی', render: (i: ReportRow) => i.assigned },
                  { key: 'fixed', title: 'رفع شده', render: (i: ReportRow) => <Badge variant="success" size="sm">{i.fixed}</Badge> },
                  { key: 'reopened', title: 'Reopen', render: (i: ReportRow) => i.reopened > 0 ? <Badge variant="danger" size="sm">{i.reopened}</Badge> : '0' },
                  { key: 'rate', title: 'نرخ Reopen', render: (i: ReportRow) => `${i.reopenRate}%` },
                  { key: 'open', title: 'باز', render: (i: ReportRow) => i.open },
                  { key: 'critical', title: 'Critical', render: (i: ReportRow) => i.critical },
                ]} data={filterReportRows(Array.isArray(reportData) ? reportData : [])} emptyMessage="داده‌ای یافت نشد" />
              </Card>
            )}

            {/* ===== TEST CASES ===== */}
            {selectedReport === 'test-cases' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <StatCard title="کل تست کیس‌ها" value={reportData.total} icon={<CheckCircle className="w-6 h-6" />} />
                  <StatCard title="آماده اجرا" value={reportData.ready} variant="success" icon={<PlayCircle className="w-6 h-6" />} />
                  <StatCard title="پرریسک" value={reportData.highRisk} variant="danger" icon={<AlertTriangle className="w-6 h-6" />} />
                  <StatCard title="کاندید خودکارسازی" value={reportData.automationCandidates} icon={<Terminal className="w-6 h-6" />} />
                </div>
                <Card>
                  <h3 className="font-semibold text-gray-900 mb-4">به تفکیک QA Specialist</h3>
                  <PaginatedReportTable columns={[
                    { key: 'name', title: 'QA Specialist', render: (i: ReportRow) => <span className="font-medium">{i.qaName}</span> },
                    { key: 'count', title: 'تعداد کل', render: (i: ReportRow) => i.count },
                    { key: 'ready', title: 'آماده اجرا', render: (i: ReportRow) => <Badge variant="success" size="sm">{i.ready}</Badge> },
                  ]} data={filterReportRows(reportData.byQA || [])} emptyMessage="-" />
                </Card>
              </>
            )}

            {/* ===== RELEASES ===== */}
            {selectedReport === 'releases' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <StatCard title="کل VersionHistory" value={reportData.total} icon={<Rocket className="w-6 h-6" />} />
                  <StatCard title="تأیید شده" value={reportData.approved} variant="success" icon={<CheckCircle className="w-6 h-6" />} />
                  <StatCard title="مشروط" value={reportData.conditional} variant="warning" icon={<AlertTriangle className="w-6 h-6" />} />
                  <StatCard title="اضطراری" value={reportData.emergency} variant="danger" icon={<AlertTriangle className="w-6 h-6" />} />
                </div>
                <Card>
                  <h3 className="font-semibold text-gray-900 mb-4">جزئیات VersionHistory</h3>
                  <PaginatedReportTable columns={[
                    { key: 'version', title: 'نسخه', render: (i: ReportRow) => <span className="font-medium">{i.version}</span> },
                    { key: 'status', title: 'وضعیت', render: (i: ReportRow) => <StatusBadge status={i.status} labels={RELEASE_PUBLISH_STATUS_LABELS} /> },
                    { key: 'emergency', title: 'اضطراری', render: (i: ReportRow) => i.isEmergency ? <Badge variant="danger" size="sm">بله</Badge> : '-' },
                    { key: 'decision', title: 'تصمیم', render: (i: ReportRow) => i.decision },
                    { key: 'techLead', title: 'Tech Lead', render: (i: ReportRow) => i.techLead },
                  ]} data={filterReportRows(reportData.details || [])} emptyMessage="-" />
                </Card>
                <Card>
                  <h3 className="font-semibold text-gray-900 mb-4">گزارش تغییرات هر نسخه</h3>
                  <PaginatedReportTable columns={[
                    { key: 'version', title: 'نسخه', render: (i: ReportRow) => <span className="font-medium">{i.version}</span> },
                    { key: 'buildNumber', title: 'بیلد', render: (i: ReportRow) => i.buildNumber || '-' },
                    { key: 'revisionNo', title: 'Revision', render: (i: ReportRow) => `#${i.revisionNo}` },
                    { key: 'qaStatus', title: 'کیفیت QA', render: (i: ReportRow) => <StatusBadge status={i.qaStatus} labels={QA_QUALITY_STATUS_LABELS} /> },
                    { key: 'tests', title: 'اجراها', render: (i: ReportRow) => `${i.executedTestRuns}/${i.totalTestCases}` },
                    { key: 'passed', title: 'موفق/ناموفق', render: (i: ReportRow) => `${i.passedTestRuns}/${i.failedTestRuns}` },
                    { key: 'bugs', title: 'باگ باز', render: (i: ReportRow) => `${i.openBugs} (C:${i.criticalBugs} / M:${i.majorBugs})` },
                    { key: 'qaNotes', title: 'یادداشت تغییر', render: (i: ReportRow) => i.qaNotes || '-' },
                    { key: 'capturedAt', title: 'زمان Snapshot', render: (i: ReportRow) => formatReportDate(i.capturedAt) },
                  ]} data={filterReportRows(reportData.changeHistory || [])} emptyMessage="تغییری برای نسخه‌ها ثبت نشده است" />
                </Card>
              </>
            )}

            {/* ===== EMERGENCY PUBLISH ===== */}
            {selectedReport === 'emergency' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                  <StatCard title="Tag اضطراری" value={reportData.total} variant="danger" icon={<AlertTriangle className="w-6 h-6" />} />
                  <StatCard title="کل VersionHistory" value={reportData.totalReleases} icon={<Rocket className="w-6 h-6" />} />
                  <StatCard title="نسبت اضطراری" value={`${reportData.emergencyRate}%`} icon={<TrendingUp className="w-6 h-6" />} />
                </div>
                <Card>
                  <h3 className="font-semibold text-gray-900 mb-4">جزئیات Emergency</h3>
                  <PaginatedReportTable columns={[
                    { key: 'version', title: 'نسخه', render: (i: ReportRow) => i.version },
                    { key: 'reason', title: 'دلیل اضطرار', render: (i: ReportRow) => i.reason },
                    { key: 'risk', title: 'ریسک', render: (i: ReportRow) => i.risk },
                    { key: 'techLead', title: 'Tech Lead', render: (i: ReportRow) => i.techLead },
                  ]} data={filterReportRows(reportData.details || [])} emptyMessage="Tag اضطراری وجود ندارد" />
                </Card>
              </>
            )}

            {/* ===== CHECKLISTS ===== */}
            {selectedReport === 'checklists' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <StatCard title="کل چک‌لیست‌ها" value={reportData.total} icon={<ShieldCheck className="w-6 h-6" />} />
                  <StatCard title="تکمیل شده" value={reportData.completed} variant="success" icon={<CheckCircle className="w-6 h-6" />} />
                  <StatCard title="در انتظار" value={reportData.pending} variant="warning" icon={<Clock className="w-6 h-6" />} />
                  <StatCard title="در حال بررسی" value={reportData.inProgress} variant="primary" icon={<ShieldCheck className="w-6 h-6" />} />
                </div>
                <Card>
                  <PaginatedReportTable columns={[
                    { key: 'type', title: 'نوع', render: (i: ReportRow) => i.type },
                    { key: 'status', title: 'وضعیت', render: (i: ReportRow) => <StatusBadge status={i.status} labels={CHECKLIST_STATUS_LABELS} /> },
                    { key: 'result', title: 'نتیجه', render: (i: ReportRow) => i.result },
                    { key: 'reviewer', title: 'بازبین', render: (i: ReportRow) => i.reviewer },
                    { key: 'progress', title: 'پیشرفت', render: (i: ReportRow) => `${i.itemsDone}/${i.itemsTotal}` },
                  ]} data={filterReportRows(reportData.details || [])} emptyMessage="-" />
                </Card>
              </>
            )}

            {/* ===== PLAYWRIGHT ===== */}
            {selectedReport === 'playwright' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <StatCard title="کل اجراها" value={reportData.total} icon={<Terminal className="w-6 h-6" />} />
                  <StatCard title="موفق" value={reportData.passed} variant="success" icon={<CheckCircle className="w-6 h-6" />} />
                  <StatCard title="ناموفق" value={reportData.failed} variant="danger" icon={<XCircle className="w-6 h-6" />} />
                  <StatCard title="نرخ موفقیت" value={`${reportData.passRate}%`} variant="success" icon={<TrendingUp className="w-6 h-6" />} />
                </div>
                <Card>
                  <PaginatedReportTable columns={[
                    { key: 'file', title: 'فایل تست', render: (i: ReportRow) => <span className="font-mono text-sm">{i.testFile.split('/').pop()}</span> },
                    { key: 'status', title: 'وضعیت', render: (i: ReportRow) => <StatusBadge status={i.status} labels={PLAYWRIGHT_RUN_STATUS_LABELS} /> },
                    { key: 'duration', title: 'مدت (ثانیه)', render: (i: ReportRow) => i.duration },
                    { key: 'tests', title: 'تست‌ها', render: (i: ReportRow) => `${i.passedTests}/${i.totalTests}` },
                    { key: 'triggeredBy', title: 'اجراکننده', render: (i: ReportRow) => i.triggeredBy },
                  ]} data={filterReportRows(reportData.details || [])} emptyMessage="-" />
                </Card>
              </>
            )}

            {/* ===== ATTACHMENTS ===== */}
            {selectedReport === 'attachments' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <StatCard title="کل پیوست‌ها" value={reportData.total} icon={<Paperclip className="w-6 h-6" />} />
                  <StatCard title="حجم کل" value={`${Math.round(reportData.totalSize / 1024)} KB`} icon={<Paperclip className="w-6 h-6" />} />
                  <StatCard title="معتبر" value={reportData.valid} variant="success" icon={<CheckCircle className="w-6 h-6" />} />
                  <StatCard title="حذف شده" value={reportData.deleted} variant="danger" icon={<XCircle className="w-6 h-6" />} />
                </div>
                <Card>
                  <PaginatedReportTable columns={[
                    { key: 'name', title: 'نام فایل', render: (i: ReportRow) => i.fileName },
                    { key: 'type', title: 'نوع', render: (i: ReportRow) => i.type },
                    { key: 'status', title: 'وضعیت', render: (i: ReportRow) => <StatusBadge status={i.status} labels={ATTACHMENT_STATUS_LABELS} /> },
                    { key: 'size', title: 'حجم', render: (i: ReportRow) => `${Math.round(i.fileSize / 1024)} KB` },
                    { key: 'uploader', title: 'آپلودکننده', render: (i: ReportRow) => i.uploader },
                  ]} data={filterReportRows(reportData.details || [])} emptyMessage="-" />
                </Card>
              </>
            )}

            {/* ===== USERS & ROLES ===== */}
            {selectedReport === 'users-roles' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <StatCard title="کل کاربران" value={reportData.totalUsers} icon={<Users className="w-6 h-6" />} />
                  <StatCard title="فعال" value={reportData.activeUsers} variant="success" icon={<CheckCircle className="w-6 h-6" />} />
                  <StatCard title="غیرفعال" value={reportData.inactiveUsers} variant="danger" icon={<XCircle className="w-6 h-6" />} />
                  <StatCard title="چندنقشی" value={reportData.multiRoleUsers} icon={<Users className="w-6 h-6" />} />
                </div>
                <Card>
                  <PaginatedReportTable columns={[
                    { key: 'name', title: 'نام', render: (i: ReportRow) => <span className="font-medium">{i.fullName}</span> },
                    { key: 'phone', title: 'تلفن', render: (i: ReportRow) => <span className="font-mono text-sm" dir="ltr">{i.phoneNumber}</span> },
                    { key: 'active', title: 'وضعیت', render: (i: ReportRow) => i.isActive ? <Badge variant="success" size="sm">فعال</Badge> : <Badge variant="danger" size="sm">غیرفعال</Badge> },
                    { key: 'roles', title: 'نقش‌ها', render: (i: ReportRow) => (
                      <div className="flex flex-wrap gap-1">
                        {i.roles.map((r: ReportRole, idx: number) => (
                          <Badge key={idx} variant="secondary" size="sm">{ROLE_LABELS[r.role as keyof typeof ROLE_LABELS]} ({r.appName})</Badge>
                        ))}
                      </div>
                    )},
                  ]} data={filterReportRows(reportData.details || [])} emptyMessage="-" />
                </Card>
              </>
            )}

            {/* ===== AUDIT ===== */}
            {selectedReport === 'audit' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <StatCard title="کل رویدادها" value={reportData.total} icon={<History className="w-6 h-6" />} />
                  <StatCard title="ایجاد" value={reportData.byAction.create ?? 0} icon={<FileText className="w-6 h-6" />} />
                  <StatCard title="تغییر وضعیت" value={reportData.byAction.statusChange ?? 0} icon={<RefreshCw className="w-6 h-6" />} />
                  <StatCard title="ثبت تصمیم انتشار" value={reportData.byAction.publish ?? 0} icon={<Rocket className="w-6 h-6" />} />
                </div>
                <Card>
                  <PaginatedReportTable columns={[
                    { key: 'user', title: 'کاربر', render: (i: ReportRow) => i.userName },
                    { key: 'action', title: 'عملیات', render: (i: ReportRow) => i.action },
                    { key: 'entity', title: 'موجودیت', render: (i: ReportRow) => i.entityType },
                    { key: 'date', title: 'زمان', render: (i: ReportRow) => formatReportDateTime(i.createdAt) },
                  ]} data={filterReportRows(reportData.details || [])} emptyMessage="-" />
                </Card>
              </>
            )}

            {/* ===== PRODUCT QUALITY ===== */}
            {selectedReport === 'product-quality' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <StatCard title="درخواست‌های فعال" value={reportData.activeRequests} icon={<FileText className="w-6 h-6" />} />
                  <StatCard title="آماده تصمیم انتشار" value={reportData.readyForRelease} variant="success" icon={<Rocket className="w-6 h-6" />} />
                  <StatCard title="نرخ موفقیت" value={`${reportData.testPassRate}%`} variant="success" icon={<TrendingUp className="w-6 h-6" />} />
                  <StatCard title="باگ Critical/Major" value={reportData.criticalMajorOpen} variant="danger" icon={<Bug className="w-6 h-6" />} />
                </div>
                <Card>
                  <h3 className="font-semibold text-gray-900 mb-4">سامانه‌های پرریسک</h3>
                  <PaginatedReportTable columns={[
                    { key: 'app', title: 'سامانه', render: (i: ReportRow) => <span className="font-medium">{i.appName}</span> },
                    { key: 'bugs', title: 'باگ‌های باز', render: (i: ReportRow) => i.openBugs > 0 ? <Badge variant="danger" size="sm">{i.openBugs}</Badge> : '0' },
                    { key: 'fails', title: 'تست ناموفق', render: (i: ReportRow) => i.failedRuns > 0 ? <Badge variant="warning" size="sm">{i.failedRuns}</Badge> : '0' },
                  ]} data={filterReportRows(reportData.riskApps || [])} emptyMessage="-" />
                </Card>
              </>
            )}

            {/* ===== FLOW COVERAGE ===== */}
            {selectedReport === 'flow-coverage' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                  <StatCard title="کل Flowها" value={reportData.totalFlows} icon={<FileText className="w-6 h-6" />} />
                  <StatCard title="دارای Test Case" value={reportData.withTestCase} variant="success" icon={<CheckCircle className="w-6 h-6" />} />
                  <StatCard title="بدون Test Case" value={reportData.withoutTestCase} variant="danger" icon={<XCircle className="w-6 h-6" />} />
                </div>
                <Card>
                  <PaginatedReportTable columns={[
                    { key: 'title', title: 'عنوان Flow', render: (i: ReportRow) => i.title },
                    { key: 'req', title: 'نیازمندی', render: (i: ReportRow) => i.requirementTitle },
                    { key: 'tc', title: 'Test Case', render: (i: ReportRow) => i.hasTestCase ? <Badge variant="success" size="sm">{i.testCaseCount}</Badge> : <Badge variant="danger" size="sm">ندارد</Badge> },
                  ]} data={filterReportRows(reportData.details || [])} emptyMessage="-" />
                </Card>
              </>
            )}

            {/* ===== TRACEABILITY ===== */}
            {selectedReport === 'traceability' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
                  <StatCard title="نیازمندی‌ها" value={reportData.totalRequirements} icon={<FileText className="w-6 h-6" />} />
                  <StatCard title="دارای Flow" value={reportData.withFlow} icon={<GitBranch className="w-6 h-6" />} variant="success" />
                  <StatCard title="دارای Test Case" value={reportData.withTestCase} icon={<CheckCircle className="w-6 h-6" />} variant="success" />
                  <StatCard title="دارای اجرا" value={reportData.withRun} icon={<PlayCircle className="w-6 h-6" />} />
                  <StatCard title="باگ باز" value={reportData.withOpenBug} icon={<Bug className="w-6 h-6" />} variant="danger" />
                </div>
                <Card>
                  <h3 className="font-semibold text-gray-900 mb-4">ماتریس ردیابی نیازمندی تا انتشار</h3>
                  <PaginatedReportTable columns={[
                    { key: 'requirementTitle', title: 'نیازمندی', render: (i: ReportRow) => <span className="font-medium">{i.requirementTitle}</span> },
                    { key: 'requirementStatus', title: 'وضعیت', render: (i: ReportRow) => <StatusBadge status={i.requirementStatus} labels={REQUIREMENT_STATUS_LABELS} /> },
                    { key: 'flows', title: 'Flow', render: (i: ReportRow) => i.flows },
                    { key: 'testCases', title: 'Test Case', render: (i: ReportRow) => `${i.readyTestCases}/${i.testCases}` },
                    { key: 'runs', title: 'اجرا', render: (i: ReportRow) => `${i.passedRuns}/${i.runs}` },
                    { key: 'bugs', title: 'باگ باز', render: (i: ReportRow) => i.openBugs > 0 ? <Badge variant={i.criticalOpenBugs > 0 ? 'danger' : 'warning'} size="sm">{i.openBugs}</Badge> : '0' },
                    { key: 'testRequests', title: 'درخواست تست', render: (i: ReportRow) => <span className="text-xs">{i.testRequests}</span> },
                    { key: 'releases', title: 'نسخه/انتشار', render: (i: ReportRow) => <span className="text-xs">{i.releases}</span> },
                    { key: 'coverageStatus', title: 'پوشش', render: (i: ReportRow) => <Badge variant={i.coverageStatus === 'کامل' ? 'success' : 'warning'} size="sm">{i.coverageStatus}</Badge> },
                  ]} data={filterReportRows(reportData.details || [])} emptyMessage="ردیابی ثبت نشده است" />
                </Card>
              </>
            )}

            {/* ===== API USAGE ===== */}
            {selectedReport === 'api-usage' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <StatCard title="کل رویدادها" value={reportData.summary?.total || 0} icon={<Braces className="w-6 h-6" />} variant="primary" />
                  <StatCard title="API یکتا" value={reportData.summary?.uniqueApis || 0} icon={<GitBranch className="w-6 h-6" />} />
                  <StatCard title="کاربر یکتا" value={reportData.summary?.uniqueUsers || 0} icon={<Users className="w-6 h-6" />} />
                  <StatCard title="Execute" value={reportData.summary?.byType?.API_EXECUTED || 0} icon={<PlayCircle className="w-6 h-6" />} variant="success" />
                </div>
                <Card>
                  <h3 className="font-semibold text-gray-900 mb-4">جزئیات مصرف API Console</h3>
                  <PaginatedReportTable columns={[
                    { key: 'eventType', title: 'رویداد', render: (i: ReportRow) => <Badge variant={i.eventType === 'API_EXECUTED' ? 'success' : i.eventType === 'REMOVED_FROM_CONSOLE' ? 'danger' : 'default'} size="sm">{i.eventType}</Badge> },
                    { key: 'apiTitle', title: 'API', render: (i: ReportRow) => <span className="font-medium">{i.apiTitle}</span> },
                    { key: 'version', title: 'Version', render: (i: ReportRow) => <span className="font-mono text-xs" dir="ltr">v{i.version}</span> },
                    { key: 'userDisplayName', title: 'کاربر', render: (i: ReportRow) => i.userDisplayName || i.userId },
                    { key: 'activeRole', title: 'Role', render: (i: ReportRow) => ROLE_LABELS[i.activeRole as keyof typeof ROLE_LABELS] || i.activeRole },
                    { key: 'eventAt', title: 'زمان', render: (i: ReportRow) => formatReportDateTime(i.eventAt) },
                    { key: 'environmentId', title: 'Environment', render: (i: ReportRow) => i.environmentId || '-' },
                    { key: 'correlationId', title: 'Correlation ID', render: (i: ReportRow) => i.correlationId ? <span className="font-mono text-xs" dir="ltr">{i.correlationId}</span> : '-' },
                  ]} data={filterReportRows(reportData.data || [])} emptyMessage="رویداد مصرف API ثبت نشده است" />
                </Card>
              </>
            )}

            {/* ===== COMMENTS ===== */}
            {selectedReport === 'comments' && (
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">کامنت‌های VersionHistory ({reportData.total})</h3>
                <PaginatedReportTable columns={[
                  { key: 'content', title: 'محتوا', render: (i: ReportRow) => i.content },
                  { key: 'author', title: 'نویسنده', render: (i: ReportRow) => i.author },
                  { key: 'date', title: 'تاریخ', render: (i: ReportRow) => formatReportDate(i.createdAt) },
                ]} data={filterReportRows(reportData.details || [])} emptyMessage="کامنتی ثبت نشده" />
              </Card>
            )}
          </div>
        )}
      </main>
      <Modal isOpen={showScheduleModal} onClose={() => setShowScheduleModal(false)} title="زمان‌بندی گزارش" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">این تنظیم به‌عنوان درخواست زمان‌بندی ثبت می‌شود و برای اجرای دوره‌ای باید به Scheduled Report backend متصل باشد.</p>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">تناوب ارسال</span>
            <select value={scheduleForm.frequency} onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="daily">روزانه</option>
              <option value="weekly">هفتگی</option>
              <option value="monthly">ماهانه</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">گیرنده</span>
            <input value={scheduleForm.recipient} onChange={(e) => setScheduleForm({ ...scheduleForm, recipient: e.target.value })}
              placeholder="email@example.com یا شناسه کاربر"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowScheduleModal(false)}>انصراف</Button>
            <Button onClick={() => { setShowScheduleModal(false); toast.success('درخواست زمان‌بندی گزارش ثبت شد.'); }}>ثبت زمان‌بندی</Button>
          </div>
        </div>
      </Modal>
      <Modal isOpen={showAlertModal} onClose={() => setShowAlertModal(false)} title="تعریف Alert گزارش" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">این Alert به‌عنوان درخواست پایش ثبت می‌شود و برای ارسال اعلان باید به سرویس Notification متصل باشد.</p>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">شاخص</span>
            <select value={alertForm.metric} onChange={(e) => setAlertForm({ ...alertForm, metric: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="openBugs">باگ باز</option>
              <option value="failedRuns">اجرای ناموفق</option>
              <option value="blockedRuns">اجرای Blocked</option>
              <option value="emergency">انتشار اضطراری</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">آستانه</span>
            <input type="number" min="0" value={alertForm.threshold} onChange={(e) => setAlertForm({ ...alertForm, threshold: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">گیرنده</span>
            <input value={alertForm.recipient} onChange={(e) => setAlertForm({ ...alertForm, recipient: e.target.value })}
              placeholder="email@example.com یا شناسه کاربر"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowAlertModal(false)}>انصراف</Button>
            <Button onClick={() => { setShowAlertModal(false); toast.success('درخواست Alert گزارش ثبت شد.'); }}>ثبت Alert</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
