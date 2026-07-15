import { useState, useEffect, useRef } from 'react';
import {
  Plus, Eye, PlayCircle, CheckCircle, XCircle,
  Bug as BugIcon, Send, ArrowRight, ArrowLeft,
  MessageSquare, ChevronDown, ChevronUp, FileText,
  Upload, Trash2, PlusCircle, Paperclip, Clock, User as UserIcon,
  Hash, Target, Layers, Lock, Unlock, Edit, RotateCcw,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Table, Pagination } from '../components/ui/Table';
import { CartableExcelExportButton, CartableSearchInput, CartableSelectFilter } from '../components/ui/CartableToolbar';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Input, Textarea, Select } from '../components/ui/Input';
import { useAuthStore, canPerformAction } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import { useApplicationLookup } from '../utils/useApplicationLookup';
import { testRunApi, testCaseApi, testRequestApi, bugApi, retestTaskApi, runIssueApi, userApi, commentApi, requirementApi, attachmentApi } from '../services/api';
import { toast } from '../components/ui/Toast';
import { isSemVer, SEMVER_HINT } from '../utils/semver';
import { BUILD_NUMBER_INPUT_HINT, sanitizeBuildNumberInput, sanitizeVersionInput, VERSION_INPUT_HINT } from '../utils/inputRules';
import type {
  TestRun, TestCase, Bug, RetestTask, User, Comment, Requirement, Attachment, AttachmentType,
  CartableFilterParams, PaginatedResponse,
  TestRunStatus, TestRunPurpose, BugSeverity, BugStatus, Priority, RunIssueType,
} from '../types';
import {
  TEST_RUN_STATUS_LABELS, BUG_STATUS_LABELS, BUG_SEVERITY_LABELS,
  PRIORITY_LABELS, RUN_ISSUE_TYPE_LABELS,
  TEST_TYPE_LABELS, TEST_RUN_PURPOSE_LABELS, RETEST_TASK_STATUS_LABELS,
  ATTACHMENT_TYPE_LABELS,
} from '../types';

// Bug transitions
const NO_ACTION_TRANSITION = { value: 'NO_ACTION_NEEDED', label: 'بدون نیاز به اقدام', icon: '↩', description: 'این مورد نیاز به اقدام توسعه ندارد', requiresInput: ['reason'] };

const DEV_BUG_TRANSITIONS: Record<string, { value: string; label: string; icon: string; description: string; requiresInput?: string[] }[]> = {
  'ASSIGNED': [
    { value: 'IN_PROGRESS', label: 'شروع رفع باگ', icon: '🔧', description: 'شروع کار روی رفع' },
    { value: 'REJECTED', label: 'باگ نیست', icon: '❌', description: 'ثبت نتیجه با دلیل قابل پیگیری', requiresInput: ['reason'] },
    NO_ACTION_TRANSITION,
  ],
  'IN_PROGRESS': [
    { value: 'FIXED', label: 'رفع شد — ارسال خودکار برای Retest و Regression', icon: '✅', description: 'ثبت نسخه رفع و ارسال خودکار', requiresInput: ['fixedVersion', 'fixNotes'] },
    NO_ACTION_TRANSITION,
  ],
  'FIXED': [NO_ACTION_TRANSITION],
  'RETEST_READY': [NO_ACTION_TRANSITION],
  'RETEST_FAILED': [{ value: 'IN_PROGRESS', label: 'شروع مجدد رفع', icon: '🔧', description: 'رفع مجدد پس از شکست تست' }, NO_ACTION_TRANSITION],
  'REOPENED': [{ value: 'IN_PROGRESS', label: 'شروع مجدد رفع', icon: '🔧', description: 'رفع باگ بازگشایی‌شده' }, NO_ACTION_TRANSITION],
};
const QA_BUG_TRANSITIONS: Record<string, { value: string; label: string; icon: string; description: string }[]> = {
  'NEW': [{ value: 'ASSIGNED', label: 'تخصیص به Developer', icon: '👤', description: 'تخصیص باگ' }],
  'RETEST_READY': [
    { value: 'RETEST_PASSED', label: '✅ Retest + Regression موفق', icon: '✅', description: 'تست مجدد و رگرسیون موفق' },
    { value: 'RETEST_FAILED', label: '❌ ناموفق', icon: '❌', description: 'باگ رفع نشده' },
  ],
  'RETEST_PASSED': [{ value: 'CLOSED', label: 'بستن باگ', icon: '🔒', description: 'بستن نهایی' }],
  'RETEST_FAILED': [{ value: 'REOPENED', label: 'بازگشایی', icon: '🔄', description: 'ارسال مجدد به Developer' }],
};

const EXECUTION_PURPOSES: Array<{ value: TestRunPurpose; label: string }> = [
  { value: 'SMOKE_TEST', label: 'تست اسموک' },
  { value: 'FUNCTIONAL_TEST', label: 'تست عملکردی' },
  { value: 'REGRESSION_TEST', label: 'تست رگرسیون' },
  { value: 'RETEST', label: 'تست مجدد (Retest)' },
  { value: 'UAT', label: 'تست پذیرش کاربر' },
  { value: 'INTEGRATION_TEST', label: 'تست یکپارچگی' },
  { value: 'SECURITY_TEST', label: 'تست امنیت' },
  { value: 'PERFORMANCE_TEST', label: 'تست کارایی' },
  { value: 'EXPLORATORY', label: 'تست اکتشافی' },
];

// Bug entry in step 2 multi-bug form
interface BugEntry {
  id: number;
  title: string;
  description: string;
  stepsToReproduce: string;
  severity: BugSeverity;
  priority: Priority;
  assigneeId: string; // Item #4: developer assignment
  files: File[];
}

type RetestBugDecision = 'PASSED' | 'FAILED';

interface BugEditEntry {
  id: string;
  title: string;
  description: string;
  stepsToReproduce: string;
  severity: BugSeverity;
  priority: Priority;
  assigneeId: string;
  files: File[];
  isNew?: boolean | undefined;
  isLocked?: boolean | undefined;
}

export const TestRunsBugsPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { appId, defaultApplicationId } = useDataScope();
  const { shouldShowSystemColumn, getApplicationName } = useApplicationLookup();

  // Data
  const [runsData, setRunsData] = useState<PaginatedResponse<TestRun> | null>(null);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsFilters, setRunsFilters] = useState<CartableFilterParams>({ page: 1, limit: 10, search: '', status: '', sortBy: 'createdAt', sortOrder: 'desc' });
  const [allBugs, setAllBugs] = useState<Bug[]>([]);
  const [bugsLoading, setBugsLoading] = useState(true);
  const [bugsFilters] = useState<CartableFilterParams>({ page: 1, limit: 10, search: '', status: '', sortBy: 'createdAt', sortOrder: 'desc' });
  const [retestTasksData, setRetestTasksData] = useState<PaginatedResponse<RetestTask> | null>(null);
  const [retestTasksLoading, setRetestTasksLoading] = useState(false);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [allRuns, setAllRuns] = useState<TestRun[]>([]); // for previous run selection
  // Item: Test request list for wizard
  const [testRequests, setTestRequests] = useState<Array<{id: string; title: string; version: string; buildNumber?: string | undefined}>>([]);

  // Wizard
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardTestRequestId, setWizardTestRequestId] = useState(''); // Item: required test request
  const [wizardTestCaseId, setWizardTestCaseId] = useState('');
  const [wizardVersion, setWizardVersion] = useState('');
  const [wizardBuildNumber, setWizardBuildNumber] = useState('');
  const [wizardResult, setWizardResult] = useState<TestRunStatus | ''>('');
  const [wizardActualResult, setWizardActualResult] = useState('');
  const [wizardPurposes, setWizardPurposes] = useState<TestRunPurpose[]>([]); // multi-select
  const [wizardReqExpanded, setWizardReqExpanded] = useState(false);
  const [wizardSelectedReq, setWizardSelectedReq] = useState<Requirement | null>(null);
  const [wizardCreatedRunId, setWizardCreatedRunId] = useState('');
  const [wizardPrevRunId, setWizardPrevRunId] = useState(''); // previous run for retest/regression
  const [activeRetestTaskId, setActiveRetestTaskId] = useState('');
  const [activeRetestBugId, setActiveRetestBugId] = useState('');
  const [activeRetestBugIds, setActiveRetestBugIds] = useState<string[]>([]);
  const [activeRetestBugs, setActiveRetestBugs] = useState<Bug[]>([]);
  const [retestBugDecisions, setRetestBugDecisions] = useState<Record<string, RetestBugDecision | ''>>({});
  const [wizardPrevRunExpanded, setWizardPrevRunExpanded] = useState(false);
  const [wizardFiles, setWizardFiles] = useState<File[]>([]); // step 1 attachments
  // Step 2: Multiple bugs
  const [wizardBugs, setWizardBugs] = useState<BugEntry[]>([{ id: 1, title: '', description: '', stepsToReproduce: '', severity: 'MAJOR', priority: 'HIGH', assigneeId: '', files: [] }]);
  let bugIdCounter = useRef(2);
  // Issue
  const [wizardIssueType, setWizardIssueType] = useState<RunIssueType>('ENVIRONMENT');
  const [wizardIssueTitle, setWizardIssueTitle] = useState('');
  const [wizardIssueDesc, setWizardIssueDesc] = useState('');

  // Bug/Run detail modals
  const [showBugDetailModal, setShowBugDetailModal] = useState(false);
  const [showRunDetailModal, setShowRunDetailModal] = useState(false);
  const [runDetailStep, setRunDetailStep] = useState(1); // 1=details, 2=bugs
  const [showDevStatusModal, setShowDevStatusModal] = useState(false);
  const [showAssignBugModal, setShowAssignBugModal] = useState(false);
  const [selectedBug, setSelectedBug] = useState<Bug | null>(null);
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(null);
  const [showRunEditModal, setShowRunEditModal] = useState(false);
  const [runEditData, setRunEditData] = useState({
    testRequestId: '',
    testCaseId: '',
    version: '',
    buildNumber: '',
    status: 'PENDING' as TestRunStatus,
    actualResult: '',
    previousRunId: '',
    purposes: [] as TestRunPurpose[],
  });
  const [runEditFiles, setRunEditFiles] = useState<File[]>([]);
  const [bugEditEntries, setBugEditEntries] = useState<BugEditEntry[]>([]);
  const [deletedBugIds, setDeletedBugIds] = useState<string[]>([]);
  const [developers, setDevelopers] = useState<User[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [bugComments, setBugComments] = useState<Comment[]>([]);
  const [bugAttachments, setBugAttachments] = useState<Attachment[]>([]);
  const [bugAttachmentsLoading, setBugAttachmentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [devTransitionTarget, setDevTransitionTarget] = useState('');
  const [devFixVersion, setDevFixVersion] = useState('');
  const [devFixNotes, setDevFixNotes] = useState('');
  const [devRejectReason, setDevRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [wizardErrors, setWizardErrors] = useState<Record<string, string>>({});
  const [runEditErrors, setRunEditErrors] = useState<Record<string, string>>({});
  const [devStatusErrors, setDevStatusErrors] = useState<Record<string, string>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ action: string; message: string } | null>(null);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState<{ type: 'RUN' | 'BUG'; id: string; title: string } | null>(null);
  const [unlockReason, setUnlockReason] = useState('');

  const role = activeContext?.role;
  const isDeveloper = role === 'DEVELOPER';
  const isQA = role === 'QA_LEAD' || role === 'QA_SPECIALIST';
  const canCreateRun = canPerformAction(role!, 'test-run:create');
  const canRetestBug = canPerformAction(role!, 'bug:retest');
  const canAdminUnlock = canPerformAction(role!, 'admin:unlock');

  useEffect(() => { if (activeContext) loadRuns(); }, [activeContext, runsFilters]);
  useEffect(() => { if (activeContext) loadBugs(); }, [activeContext, bugsFilters]);
  useEffect(() => {
    if (activeContext) {
      loadTestCases();
      loadRetestTasks();
      loadAllRuns();
      loadTestRequests();
    }
  }, [activeContext, appId]);
  useEffect(() => {
    if (selectedBug && showBugDetailModal) {
      loadBugComments();
      loadBugAttachments();
    }
    if (showAssignBugModal && activeContext) loadDevelopers();
  }, [selectedBug, showBugDetailModal, showAssignBugModal]);
  useEffect(() => { if (showRunEditModal && activeContext) loadDevelopers(); }, [showRunEditModal]);
  // Item #4: Load developers when wizard step 2 opens
  useEffect(() => { if (wizardStep === 2 && activeContext) loadDevelopers(); }, [wizardStep]);
  useEffect(() => {
    if (wizardTestCaseId) {
      const tc = testCases.find(t => t.id === wizardTestCaseId);
      if (tc?.requirementId) {
        requirementApi
          .getById(tc.requirementId)
          .then(r => setWizardSelectedReq(r))
          .catch(() => {
            setWizardSelectedReq(null);
            toast.error('خطا در بارگذاری نیازمندی تست‌کیس.');
          });
      }
      else setWizardSelectedReq(null);
    } else setWizardSelectedReq(null);
  }, [wizardTestCaseId]);

  const needsPrevRun = wizardPurposes.includes('REGRESSION_TEST') || wizardPurposes.includes('RETEST');

  const loadRuns = async () => { if (!activeContext) return; setRunsLoading(true); try { setRunsData(await testRunApi.getVisibleForRole(appId, runsFilters, activeContext.userId, activeContext.role)); } catch { setRunsData(null); toast.error('خطا در بارگذاری اجراهای تست.'); } finally { setRunsLoading(false); } };
  const loadAllRuns = async () => { if (!activeContext) return; try { const r = await testRunApi.getVisibleForRole(appId, { page: 1, limit: 200 }, activeContext.userId, activeContext.role); setAllRuns(r.data); } catch { setAllRuns([]); } };
  const loadTestCases = async () => { if (!activeContext) return; try { const r = await testCaseApi.getVisibleForRole(appId, { page: 1, limit: 200 }, activeContext.userId, activeContext.role); setTestCases(r.data.filter(tc => tc.status === 'READY')); } catch { setTestCases([]); toast.error('خطا در بارگذاری تست‌کیس‌ها.'); } };
  const loadTestRequests = async () => { if (!activeContext) return; try { const r = await testRequestApi.getVisibleForRole(appId, { page: 1, limit: 200 }, activeContext.userId, activeContext.role); setTestRequests(r.data.filter(tr => !['DRAFT', 'CANCELLED', 'REJECTED'].includes(tr.status)).map(tr => ({ id: tr.id, title: tr.title, version: tr.version, buildNumber: tr.buildNumber }))); } catch { setTestRequests([]); toast.error('خطا در بارگذاری درخواست‌های تست.'); } };
  const loadBugs = async () => {
    if (!activeContext) return; setBugsLoading(true);
    try {
      const r = await bugApi.getVisibleForRole(appId, { ...bugsFilters, limit: 500 }, activeContext.userId, activeContext.role);
      setAllBugs(r.data);
    }
    catch { setAllBugs([]); toast.error('خطا در بارگذاری باگ‌ها.'); } finally { setBugsLoading(false); }
  };
  const loadAllBugs = async () => {
    if (!activeContext) return;
    try {
      const r = await bugApi.getVisibleForRole(appId, { page: 1, limit: 500, sortBy: 'createdAt', sortOrder: 'desc' }, activeContext.userId, activeContext.role);
      setAllBugs(r.data);
    } catch { setAllBugs([]); }
  };
  const loadRetestTasks = async () => {
    if (!activeContext) return; setRetestTasksLoading(true);
    try { setRetestTasksData(await retestTaskApi.getVisibleForRole(appId, { page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' }, activeContext.userId, activeContext.role)); }
    catch { setRetestTasksData(null); toast.error('خطا در بارگذاری صف بازآزمون.'); } finally { setRetestTasksLoading(false); }
  };
  const loadDevelopers = async () => { if (!activeContext) return; try { setDevelopers(await userApi.getDevelopers(appId)); } catch { setDevelopers([]); toast.error('خطا در بارگذاری توسعه‌دهندگان.'); } };
  const loadBugComments = async () => { if (!selectedBug) return; try { setBugComments(await commentApi.getByEntity('BUG', selectedBug.id)); } catch { setBugComments([]); toast.error('خطا در بارگذاری دیدگاه‌ها.'); } };
  const loadBugAttachments = async () => {
    if (!selectedBug) return;
    setBugAttachments([]);
    setBugAttachmentsLoading(true);
    try {
      setBugAttachments(await attachmentApi.getByEntity('BUG', selectedBug.id));
    } catch {
      setBugAttachments([]);
    } finally {
      setBugAttachmentsLoading(false);
    }
  };

  // Purpose toggle (multi-select)
  const togglePurpose = (val: TestRunPurpose) => {
    setWizardErrors(prev => ({ ...prev, purposes: '' }));
    setWizardPurposes(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const clearWizardError = (field: string) => setWizardErrors(prev => ({ ...prev, [field]: '' }));
  const clearRunEditError = (field: string) => setRunEditErrors(prev => ({ ...prev, [field]: '' }));
  const clearDevStatusError = (field: string) => setDevStatusErrors(prev => ({ ...prev, [field]: '' }));

  const handleWizardVersionChange = (value: string) => {
    const sanitized = sanitizeVersionInput(value);
    setWizardVersion(sanitized.value);
    setWizardErrors(prev => ({ ...prev, version: sanitized.error || '' }));
  };

  const handleWizardBuildChange = (value: string) => {
    const sanitized = sanitizeBuildNumberInput(value);
    setWizardBuildNumber(sanitized.value);
    setWizardErrors(prev => ({ ...prev, buildNumber: sanitized.error || '' }));
  };

  const handleRunEditVersionChange = (value: string) => {
    const sanitized = sanitizeVersionInput(value);
    setRunEditData(prev => ({ ...prev, version: sanitized.value }));
    setRunEditErrors(prev => ({ ...prev, version: sanitized.error || '' }));
  };

  const handleRunEditBuildChange = (value: string) => {
    const sanitized = sanitizeBuildNumberInput(value);
    setRunEditData(prev => ({ ...prev, buildNumber: sanitized.value }));
    setRunEditErrors(prev => ({ ...prev, buildNumber: sanitized.error || '' }));
  };

  const handleDevFixVersionChange = (value: string) => {
    const sanitized = sanitizeVersionInput(value);
    setDevFixVersion(sanitized.value);
    setDevStatusErrors(prev => ({ ...prev, fixedVersion: sanitized.error || '' }));
  };

  // File handling
  const inferAttachmentType = (file: File): AttachmentType => {
    const name = file.name.toLowerCase();
    if (file.type.startsWith('image/')) return 'SCREENSHOT';
    if (file.type.startsWith('video/')) return 'VIDEO';
    if (file.type.includes('pdf') || file.type.includes('word') || /\.(doc|docx|pdf)$/i.test(name)) return 'DOCUMENT';
    if (file.type.includes('text') || name.endsWith('.log')) return 'LOG';
    return 'OTHER';
  };

  const formatFileSize = (size: number) => {
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const uploadFilesForEntity = async (entityType: 'TEST_RUN' | 'BUG', entityId: string, files: File[]) => {
    if (!activeContext || files.length === 0) return;
    await Promise.all(files.map(file => attachmentApi.upload(entityType, entityId, file, inferAttachmentType(file), activeContext.userId)));
  };

  const handleFileAdd = (files: FileList | null, target: 'wizard' | number) => {
    if (!files) return;
    const arr = Array.from(files);
    const valid = arr.filter(f => f.size <= 20 * 1024 * 1024); // 20MB max
    if (valid.length < arr.length) toast.warning('فایل‌های بزرگتر از ۲۰ مگابایت حذف شدند.');
    if (target === 'wizard') setWizardFiles(prev => [...prev, ...valid]);
    else {
      setWizardBugs(prev => prev.map(b => b.id === target ? { ...b, files: [...b.files, ...valid] } : b));
    }
  };

  const handleEditFileAdd = (files: FileList | null, target: 'run' | string) => {
    if (!files) return;
    const arr = Array.from(files);
    const valid = arr.filter(f => f.size <= 20 * 1024 * 1024);
    if (valid.length < arr.length) toast.warning('فایل‌های بزرگتر از ۲۰ مگابایت حذف شدند.');
    if (target === 'run') {
      setRunEditFiles(prev => [...prev, ...valid]);
      return;
    }
    setBugEditEntries(prev => prev.map(bug =>
      bug.id === target ? { ...bug, files: [...bug.files, ...valid] } : bug
    ));
  };

  const removeBugEditFile = (bugId: string, fileIndex: number) => {
    setBugEditEntries(prev => prev.map(bug =>
      bug.id === bugId
        ? { ...bug, files: bug.files.filter((_, index) => index !== fileIndex) }
        : bug
    ));
  };

  // Add/remove bugs in step 2
  const addBugEntry = () => {
    const newId = bugIdCounter.current++;
    setWizardBugs(prev => [...prev, { id: newId, title: '', description: '', stepsToReproduce: '', severity: 'MAJOR', priority: 'HIGH', assigneeId: '', files: [] }]);
  };
  const removeBugEntry = (id: number) => { if (wizardBugs.length <= 1) return; setWizardBugs(prev => prev.filter(b => b.id !== id)); };
  const updateBugEntry = <K extends keyof BugEntry>(id: number, field: K, value: BugEntry[K]) => {
    setWizardBugs(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };
  const updateRetestBugDecision = (bugId: string, decision: RetestBugDecision) => {
    clearWizardError(`retest-bug-${bugId}`);
    setRetestBugDecisions(prev => ({ ...prev, [bugId]: decision }));
  };

  const handleStartRetestTask = async (task: RetestTask) => {
    if (!activeContext) return;
    setActionLoading(true);
    try {
      const { task: startedTask, run } = await retestTaskApi.start(task.id, activeContext.userId);
      const startedBugIds = startedTask.bugIds?.length ? startedTask.bugIds : [startedTask.bugId];
      const startedBugs = startedTask.bugs?.length
        ? startedTask.bugs
        : startedBugIds
            .map(bugId => allBugs.find(bug => bug.id === bugId))
            .filter((bug): bug is Bug => Boolean(bug));
      setActiveRetestTaskId(startedTask.id);
      setActiveRetestBugId(startedBugIds[0] || startedTask.bugId);
      setActiveRetestBugIds(startedBugIds);
      setActiveRetestBugs(startedBugs);
      setRetestBugDecisions(Object.fromEntries(startedBugIds.map(bugId => [bugId, ''])));
      setWizardCreatedRunId(run.id);
      setWizardTestRequestId(startedTask.testRequestId);
      setWizardTestCaseId(startedTask.testCaseId);
      setWizardVersion(run.version || task.previousRun?.version || '');
      setWizardBuildNumber(run.buildNumber || task.previousRun?.buildNumber || '');
      setWizardPurposes(startedTask.purposes);
      setWizardPrevRunId(startedTask.previousRunId);
      setWizardResult('');
      setWizardActualResult('');
      setWizardStep(1);
      setShowBugDetailModal(false);
      setShowWizard(true);
      toast.info('Task بازآزمون شروع شد و Run جدید در حالت Pending ساخته شد.');
      loadRuns(); loadAllRuns(); loadRetestTasks();
    } catch {
      toast.error('شروع Task بازآزمون ممکن نشد.');
    } finally {
      setActionLoading(false);
    }
  };

  const resetWizard = () => {
    setShowWizard(false); setWizardStep(1); setWizardTestRequestId(''); setWizardTestCaseId(''); setWizardVersion('');
    setWizardBuildNumber(''); setWizardResult(''); setWizardActualResult(''); setWizardPurposes([]);
    setWizardReqExpanded(false); setWizardSelectedReq(null); setWizardCreatedRunId('');
    setWizardPrevRunId(''); setActiveRetestTaskId(''); setActiveRetestBugId(''); setActiveRetestBugIds([]); setActiveRetestBugs([]); setRetestBugDecisions({}); setWizardPrevRunExpanded(false); setWizardFiles([]);
    setWizardBugs([{ id: 1, title: '', description: '', stepsToReproduce: '', severity: 'MAJOR', priority: 'HIGH', assigneeId: '', files: [] }]);
    bugIdCounter.current = 2;
    setWizardIssueType('ENVIRONMENT'); setWizardIssueTitle(''); setWizardIssueDesc('');
    setWizardErrors({});
  };

  // Wizard step 1 submit
  const handleWizardStep1 = async () => {
    if (!activeContext) return;
    const errors: Record<string, string> = {};
    if (!wizardTestRequestId) errors.testRequestId = 'انتخاب درخواست تست الزامی است.';
    if (!wizardTestCaseId) errors.testCaseId = 'انتخاب تست کیس الزامی است.';
    if (!wizardVersion.trim()) errors.version = 'نسخه الزامی است.';
    else if (!isSemVer(wizardVersion)) errors.version = SEMVER_HINT;
    if (sanitizeVersionInput(wizardVersion).error) errors.version = VERSION_INPUT_HINT;
    if (sanitizeBuildNumberInput(wizardBuildNumber).error) errors.buildNumber = BUILD_NUMBER_INPUT_HINT;
    if (!wizardResult) errors.result = 'نتیجه تست الزامی است.';
    if (!wizardActualResult.trim()) errors.actualResult = 'نتیجه واقعی الزامی است.';
    if (wizardPurposes.length === 0) errors.purposes = 'حداقل یک هدف اجرا انتخاب کنید.';
    if (needsPrevRun && !wizardPrevRunId) errors.previousRunId = 'تست ران قبلی الزامی است.';
    setWizardErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setActionLoading(true);
    try {
      const run = wizardCreatedRunId
        ? await testRunApi.updateStatus(wizardCreatedRunId, wizardResult as TestRunStatus, wizardActualResult, activeContext.userId)
        : await testRunApi.create({
          testCaseId: wizardTestCaseId,
          testRequestId: wizardTestRequestId,
          version: wizardVersion,
          buildNumber: wizardBuildNumber,
          purposes: wizardPurposes,
          previousRunId: wizardPrevRunId || undefined,
          retestTaskId: activeRetestTaskId || undefined,
          sourceBugId: activeRetestBugId || undefined,
        }, activeContext.userId, defaultApplicationId, activeContext.role);
      if (!run) throw new Error('TEST_RUN_NOT_AVAILABLE');
      if (!wizardCreatedRunId) {
        await testRunApi.updateStatus(run.id, wizardResult as TestRunStatus, wizardActualResult, activeContext.userId);
      }
      if (activeRetestTaskId && activeRetestBugIds.length > 0 && wizardResult === 'PASSED') {
        for (const bugId of activeRetestBugIds) {
          await bugApi.retest(bugId, true, activeContext.userId);
        }
        await retestTaskApi.complete(activeRetestTaskId, activeContext.userId);
      }
      if (wizardFiles.length > 0) {
        await uploadFilesForEntity('TEST_RUN', run.id, wizardFiles);
        toast.info(`${wizardFiles.length} فایل مدرک ذخیره شد.`);
      }
      setWizardCreatedRunId(run.id);
      if (wizardResult === 'FAILED') { setWizardStep(2); toast.info('مرحله ۲: ثبت باگ‌ها'); }
      else if (wizardResult === 'BLOCKED') { setWizardStep(3); toast.info('مرحله ۲: ثبت مشکل اجرا'); }
      else { resetWizard(); toast.success('اجرای تست ثبت شد.'); loadRuns(); loadBugs(); loadAllBugs(); loadRetestTasks(); }
    } catch { toast.error('خطا.'); } finally { setActionLoading(false); }
  };

  // Wizard step 2: submit ALL bugs
  const handleWizardBugsSubmit = async () => {
    if (!activeContext || !wizardCreatedRunId) return;
    const isRetestFailureReview = !!activeRetestTaskId && activeRetestBugIds.length > 0;
    const validBugs = wizardBugs.filter(b => b.title.trim() && b.description.trim() && b.stepsToReproduce.trim());
    const errors: Record<string, string> = {};
    wizardBugs.forEach((bug, index) => {
      const touched = bug.title.trim() || bug.description.trim() || bug.stepsToReproduce.trim() || (!isRetestFailureReview && index === 0);
      if (!touched) return;
      if (!bug.title.trim()) errors[`bug-${bug.id}-title`] = 'عنوان باگ الزامی است.';
      if (!bug.description.trim()) errors[`bug-${bug.id}-description`] = 'توضیحات باگ الزامی است.';
      if (!bug.stepsToReproduce.trim()) errors[`bug-${bug.id}-steps`] = 'مراحل بازتولید الزامی است.';
    });
    if (isRetestFailureReview) {
      activeRetestBugIds.forEach(bugId => {
        if (!retestBugDecisions[bugId]) errors[`retest-bug-${bugId}`] = 'نتیجه بررسی این باگ را مشخص کنید.';
      });
      const hasFailedPreviousBug = activeRetestBugIds.some(bugId => retestBugDecisions[bugId] === 'FAILED');
      if (!hasFailedPreviousBug && validBugs.length === 0) {
        errors.retestReview = 'برای نتیجه ناموفق باید حداقل یک باگ قبلی رفع‌نشده باشد یا یک باگ جدید ثبت شود.';
      }
    } else if (validBugs.length === 0) {
      errors.bugs = 'حداقل یک باگ معتبر ثبت کنید.';
    }
    if (Object.keys(errors).length > 0) {
      setWizardErrors(errors);
      return;
    }
    setActionLoading(true);
    try {
      const fallbackRetestAssigneeId = activeRetestBugs.find(bug => bug.assigneeId)?.assigneeId;
      if (isRetestFailureReview) {
        for (const bugId of activeRetestBugIds) {
          const passed = retestBugDecisions[bugId] === 'PASSED';
          await bugApi.retest(bugId, passed, activeContext.userId);
          await commentApi.create(
            'BUG',
            bugId,
            passed
              ? `تأیید رفع در Retest/Regression — ${activeContext.user.fullName}`
              : `رفع تأیید نشد و برای اقدام مجدد برگشت — ${activeContext.user.fullName}`,
            activeContext.userId
          );
        }
        await retestTaskApi.complete(activeRetestTaskId, activeContext.userId);
      }
      for (const bug of validBugs) {
        const createdBug = await bugApi.create({
          testRunId: wizardCreatedRunId, title: bug.title, description: bug.description,
          stepsToReproduce: bug.stepsToReproduce, actualResult: wizardActualResult,
          severity: bug.severity, priority: bug.priority,
          assigneeId: bug.assigneeId || fallbackRetestAssigneeId || undefined,
        }, activeContext.userId, defaultApplicationId);
        if (bug.files.length > 0) {
          await uploadFilesForEntity('BUG', createdBug.id, bug.files);
          toast.info(`${bug.files.length} فایل برای باگ «${bug.title}» ذخیره شد.`);
        }
      }
      resetWizard();
      toast.success(isRetestFailureReview
        ? `نتیجه Retest ثبت شد و ${validBugs.length} باگ جدید اضافه شد.`
        : `${validBugs.length} باگ ثبت شد.`);
      loadRuns(); loadBugs(); loadAllBugs(); loadRetestTasks();
    } catch { toast.error('خطا.'); } finally { setActionLoading(false); }
  };

  // Wizard step 3: issue
  const handleWizardIssue = async () => {
    if (!activeContext || !wizardCreatedRunId) return;
    const errors: Record<string, string> = {};
    if (!wizardIssueTitle.trim()) errors.issueTitle = 'عنوان مشکل الزامی است.';
    if (!wizardIssueDesc.trim()) errors.issueDesc = 'توضیحات مشکل الزامی است.';
    setWizardErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setActionLoading(true);
    try {
      await runIssueApi.create({ testRunId: wizardCreatedRunId, issueType: wizardIssueType, title: wizardIssueTitle, description: wizardIssueDesc }, activeContext.userId, defaultApplicationId);
      resetWizard(); toast.success('مشکل اجرا ثبت شد.'); loadRuns(); loadRetestTasks();
    } catch { toast.error('خطا.'); } finally { setActionLoading(false); }
  };

  // Dev bug transitions (same as before)
  const handleDevStatusTransition = async () => {
    if (!activeContext || !selectedBug || !devTransitionTarget) return;
    setActionLoading(true);
    try {
      if (devTransitionTarget === 'FIXED') {
        if (!devFixVersion.trim()) { setDevStatusErrors({ fixedVersion: 'نسخه رفع الزامی است.' }); setActionLoading(false); return; }
        if (!isSemVer(devFixVersion)) { setDevStatusErrors({ fixedVersion: SEMVER_HINT }); setActionLoading(false); return; }
        await bugApi.setFixedVersion(selectedBug.id, devFixVersion.trim(), activeContext.userId);
        if (devFixNotes.trim()) await commentApi.create('BUG', selectedBug.id, `یادداشت رفع: ${devFixNotes.trim()}`, activeContext.userId);
        await bugApi.markReadyForRetest(selectedBug.id, activeContext.userId);
        await commentApi.create('BUG', selectedBug.id, `📤 رفع و ارسال خودکار برای Retest + Regression — نسخه: ${devFixVersion.trim()}`, activeContext.userId);
        toast.success('✅ رفع و ارسال خودکار برای تست مجدد');
      } else if (devTransitionTarget === 'REJECTED') {
        if (!devRejectReason.trim()) { setDevStatusErrors({ rejectReason: 'دلیل باگ نبودن الزامی است.' }); setActionLoading(false); return; }
        await bugApi.updateStatus(selectedBug.id, 'REJECTED' as BugStatus, devRejectReason.trim(), activeContext.userId);
        await commentApi.create('BUG', selectedBug.id, `❌ باگ نیست: ${devRejectReason.trim()}`, activeContext.userId);
        toast.success('نتیجه «باگ نیست» ثبت شد.');
      } else if (devTransitionTarget === 'NO_ACTION_NEEDED') {
        if (!devRejectReason.trim()) { setDevStatusErrors({ rejectReason: 'دلیل بدون نیاز به اقدام الزامی است.' }); setActionLoading(false); return; }
        await bugApi.updateStatus(selectedBug.id, 'NO_ACTION_NEEDED' as BugStatus, devRejectReason.trim(), activeContext.userId);
        await commentApi.create('BUG', selectedBug.id, `↩ بدون نیاز به اقدام: ${devRejectReason.trim()}`, activeContext.userId);
        toast.success('وضعیت «بدون نیاز به اقدام» ثبت شد.');
      } else {
        await bugApi.updateStatus(selectedBug.id, devTransitionTarget as BugStatus, '', activeContext.userId);
        if (devTransitionTarget === 'IN_PROGRESS') await commentApi.create('BUG', selectedBug.id, `🔧 شروع رفع — ${activeContext.user.fullName}`, activeContext.userId);
        toast.success('وضعیت تغییر کرد.');
      }
      setShowDevStatusModal(false); setDevTransitionTarget(''); setShowBugDetailModal(false); loadBugs(); loadAllBugs(); loadRetestTasks();
    } catch { toast.error('خطا.'); } finally { setActionLoading(false); }
  };

  const handleAssignBug = async () => { if (!activeContext || !selectedBug || !selectedAssignee) return; setActionLoading(true); try { await bugApi.assign(selectedBug.id, selectedAssignee, activeContext.userId); setShowAssignBugModal(false); setShowDevStatusModal(false); toast.success('تخصیص داده شد.'); loadBugs(); loadAllBugs(); } catch { toast.error('خطا.'); } finally { setActionLoading(false); } };
  const handleRetestBug = async (p: boolean) => { if (!activeContext || !selectedBug) return; setActionLoading(true); try { await bugApi.retest(selectedBug.id, p, activeContext.userId); await commentApi.create('BUG', selectedBug.id, `${p ? '✅ تست مجدد موفق' : '❌ ناموفق'} — ${activeContext.user.fullName}`, activeContext.userId); toast.success(p ? 'موفق' : 'ناموفق'); setShowConfirmModal(false); setShowBugDetailModal(false); loadBugs(); loadAllBugs(); loadRetestTasks(); } catch { toast.error('خطا.'); } finally { setActionLoading(false); } };
  const handleCloseBug = async () => { if (!activeContext || !selectedBug) return; setActionLoading(true); try { await bugApi.close(selectedBug.id, activeContext.userId); toast.success('بسته شد.'); setShowConfirmModal(false); setShowBugDetailModal(false); loadBugs(); loadAllBugs(); } catch { toast.error('خطا.'); } finally { setActionLoading(false); } };
  const handleAddComment = async () => { if (!activeContext || !selectedBug || !newComment.trim()) return; setActionLoading(true); try { await commentApi.create('BUG', selectedBug.id, newComment, activeContext.userId); setNewComment(''); loadBugComments(); } catch { toast.error('خطا در ثبت دیدگاه.'); } finally { setActionLoading(false); } };

  const canRestoreBug = (bug: Bug | null | undefined) =>
    !!bug && !bug.isLocked && !!bug.previousStatus && ['REJECTED', 'NO_ACTION_NEEDED'].includes(bug.status);

  const handleRestoreBugStatus = async (bug: Bug) => {
    if (!activeContext || !canRestoreBug(bug)) return;
    setActionLoading(true);
    try {
      const restored = await bugApi.restorePreviousStatus(bug.id, activeContext.userId);
      if (!restored) throw new Error('RESTORE_FAILED');
      await commentApi.create('BUG', bug.id, `بازگردانی وضعیت از ${BUG_STATUS_LABELS[bug.status]} به ${BUG_STATUS_LABELS[restored.status]}`, activeContext.userId);
      if (selectedBug?.id === bug.id) setSelectedBug(restored);
      toast.success('وضعیت قبلی باگ بازگردانده شد.');
      loadBugs(); loadAllBugs(); loadRetestTasks(); loadBugComments();
    } catch {
      toast.error('بازگردانی وضعیت باگ ممکن نیست.');
    } finally {
      setActionLoading(false);
    }
  };

  const openUnlockModal = (target: { type: 'RUN' | 'BUG'; id: string; title: string }) => {
    setUnlockTarget(target);
    setUnlockReason('');
    setShowUnlockModal(true);
  };

  const handleUnlock = async () => {
    if (!activeContext || !unlockTarget || !unlockReason.trim()) return;
    setActionLoading(true);
    try {
      if (unlockTarget.type === 'RUN') {
        const unlocked = await testRunApi.unlock(unlockTarget.id, unlockReason.trim(), activeContext.userId);
        if (!unlocked) throw new Error('RUN_UNLOCK_FAILED');
        setSelectedRun(unlocked);
      } else {
        const unlocked = await bugApi.unlock(unlockTarget.id, unlockReason.trim(), activeContext.userId);
        if (!unlocked) throw new Error('BUG_UNLOCK_FAILED');
        setSelectedBug(unlocked);
      }
      toast.success('قفل با ثبت دلیل باز شد.');
      setShowUnlockModal(false);
      setUnlockTarget(null);
      setUnlockReason('');
      loadRuns(); loadAllRuns(); loadBugs(); loadAllBugs(); loadRetestTasks();
    } catch {
      toast.error('باز کردن قفل ممکن نیست. نقش، دلیل و وضعیت قفل را بررسی کنید.');
    } finally {
      setActionLoading(false);
    }
  };

  const canEditRunFields = (run: TestRun | null | undefined) =>
    !!run && !run.isLocked && !run.lockedByVersionHistoryId;

  const getBugsForRun = (runId: string) => allBugs.filter(bug => bug.testRunId === runId);

  const toBugEditEntry = (bug: Bug): BugEditEntry => ({
    id: bug.id,
    title: bug.title || '',
    description: bug.description || '',
    stepsToReproduce: bug.stepsToReproduce || '',
    severity: bug.severity,
    priority: bug.priority,
    assigneeId: bug.assigneeId || '',
    files: [],
    isLocked: bug.isLocked,
  });

  const openRunEditModal = (run: TestRun) => {
    if (!canEditRunFields(run)) {
      toast.warning('این اجرا به VersionHistory متصل شده و ویرایش کامل فیلدها مجاز نیست.');
      return;
    }
    setSelectedRun(run);
    setRunEditData({
      testRequestId: run.testRequestId,
      testCaseId: run.testCaseId,
      version: run.version || '',
      buildNumber: run.buildNumber || '',
      status: run.status,
      actualResult: run.actualResult || '',
      previousRunId: run.previousRunId || '',
      purposes: run.purposes || [],
    });
    setRunEditFiles([]);
    setBugEditEntries(getBugsForRun(run.id).map(toBugEditEntry));
    setDeletedBugIds([]);
    setRunEditErrors({});
    setShowRunDetailModal(false);
    setRunDetailStep(1);
    setShowRunEditModal(true);
  };

  const toggleRunEditPurpose = (value: TestRunPurpose) => {
    setRunEditData(prev => ({
      ...prev,
      purposes: prev.purposes.includes(value)
        ? prev.purposes.filter(p => p !== value)
        : [...prev.purposes, value],
    }));
  };

  const updateBugEditEntry = (id: string, field: keyof BugEditEntry, value: string) => {
    const errorKey = field === 'stepsToReproduce' ? `bug-${id}-steps` : `bug-${id}-${field}`;
    clearRunEditError(errorKey);
    setBugEditEntries(prev => prev.map(entry =>
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  const addBugEditEntry = () => {
    if (runEditData.status !== 'FAILED') {
      toast.warning('اضافه کردن باگ فقط برای اجرای ناموفق مجاز است.');
      return;
    }
    setBugEditEntries(prev => [
      ...prev,
      {
        id: `new-${Date.now()}-${prev.length}`,
        title: '',
        description: '',
        stepsToReproduce: '',
        severity: 'MAJOR',
        priority: 'HIGH',
        assigneeId: '',
        files: [],
        isNew: true,
      },
    ]);
  };

  const removeBugEditEntry = (entry: BugEditEntry) => {
    if (entry.isLocked) {
      toast.warning('باگ قفل‌شده قابل حذف نیست.');
      return;
    }
    if (!entry.isNew) {
      setDeletedBugIds(prev => prev.includes(entry.id) ? prev : [...prev, entry.id]);
    }
    setBugEditEntries(prev => prev.filter(bug => bug.id !== entry.id));
  };

  const handleRunUpdate = async () => {
    if (!activeContext || !selectedRun) return;
    if (!canEditRunFields(selectedRun)) {
      toast.error('این اجرا به VersionHistory متصل شده و قابل ویرایش نیست.');
      return;
    }
    const errors: Record<string, string> = {};
    if (!runEditData.testRequestId) errors.testRequestId = 'درخواست تست الزامی است.';
    if (!runEditData.testCaseId) errors.testCaseId = 'تست کیس الزامی است.';
    if (!runEditData.version.trim()) errors.version = 'نسخه الزامی است.';
    else if (!isSemVer(runEditData.version)) errors.version = SEMVER_HINT;
    if (sanitizeVersionInput(runEditData.version).error) errors.version = VERSION_INPUT_HINT;
    if (sanitizeBuildNumberInput(runEditData.buildNumber).error) errors.buildNumber = BUILD_NUMBER_INPUT_HINT;
    if (runEditData.purposes.length === 0) errors.purposes = 'حداقل یک هدف اجرا انتخاب کنید.';
    bugEditEntries.forEach(bug => {
      if (bug.isLocked) return;
      if (!bug.title.trim()) errors[`bug-${bug.id}-title`] = 'عنوان باگ الزامی است.';
      if (!bug.description.trim()) errors[`bug-${bug.id}-description`] = 'توضیحات باگ الزامی است.';
      if (!bug.stepsToReproduce.trim()) errors[`bug-${bug.id}-steps`] = 'مراحل بازتولید الزامی است.';
    });
    setRunEditErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    if (bugEditEntries.some(bug => bug.isNew) && runEditData.status !== 'FAILED') {
      toast.error('اضافه کردن باگ فقط زمانی مجاز است که وضعیت اجرا ناموفق باشد.');
      return;
    }
    setActionLoading(true);
    try {
      const updated = await testRunApi.update(
        selectedRun.id,
        {
          testRequestId: runEditData.testRequestId,
          testCaseId: runEditData.testCaseId,
          version: runEditData.version.trim(),
          buildNumber: runEditData.buildNumber.trim() || undefined,
          status: runEditData.status,
          actualResult: runEditData.actualResult.trim(),
          previousRunId: runEditData.previousRunId || undefined,
          purposes: runEditData.purposes,
        },
        activeContext.userId,
        activeContext.role
      );
      if (!updated) throw new Error('RUN_UPDATE_FAILED');
      for (const bugId of deletedBugIds) {
        const removed = await bugApi.delete(bugId, activeContext.userId);
        if (!removed) throw new Error('BUG_DELETE_FAILED');
      }
      for (const bug of bugEditEntries) {
        if (bug.isLocked) continue;
        if (!bug.title.trim() || !bug.description.trim() || !bug.stepsToReproduce.trim()) {
          throw new Error('BUG_REQUIRED_FIELDS');
        }
        const bugPayload = {
          testRunId: updated.id,
          title: bug.title.trim(),
          description: bug.description.trim(),
          stepsToReproduce: bug.stepsToReproduce.trim(),
          severity: bug.severity,
          priority: bug.priority,
          assigneeId: bug.assigneeId || undefined,
        };
        const savedBug = bug.isNew
          ? await bugApi.create(bugPayload, activeContext.userId, updated.applicationId || defaultApplicationId)
          : await bugApi.update(bug.id, bugPayload, activeContext.userId);
        if (!savedBug) throw new Error('BUG_UPDATE_FAILED');
        if (bug.files.length > 0) {
          await uploadFilesForEntity('BUG', savedBug.id, bug.files);
          toast.info(`${bug.files.length} فایل پیوست برای باگ «${bug.title.trim()}» ذخیره شد.`);
        }
      }
      if (runEditFiles.length > 0) {
        await uploadFilesForEntity('TEST_RUN', updated.id, runEditFiles);
        toast.info(`${runEditFiles.length} فایل مدرک اجرای تست ذخیره شد.`);
      }
      setSelectedRun(updated);
      setShowRunEditModal(false);
      setDeletedBugIds([]);
      setRunEditFiles([]);
      toast.success('اجرای تست و باگ‌های مرتبط بروزرسانی شد.');
      loadRuns(); loadAllRuns(); loadBugs(); loadAllBugs(); loadRetestTasks();
    } catch {
      toast.error('ویرایش اجرا ممکن نیست. قفل VersionHistory، آماده بودن تست کیس و داده‌های انتخابی را بررسی کنید.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!activeContext) return null;
  const getAvailableTransitions = (bug: Bug) => {
    if (bug.isLocked) return [];
    if (isDeveloper && bug.assigneeId === activeContext.userId) return DEV_BUG_TRANSITIONS[bug.status] || [];
    if (isQA || role === 'SYSTEM_ADMIN') return QA_BUG_TRANSITIONS[bug.status] || [];
    return [];
  };

  const getPrevRun = () => allRuns.find(r => r.id === wizardPrevRunId);
  const openRetestTasks = (retestTasksData?.data || []).filter(t => ['QUEUED', 'IN_PROGRESS'].includes(t.status));
  const getRetestTaskBugIds = (task: RetestTask) => task.bugIds?.length ? task.bugIds : [task.bugId];
  const canStartRetestTask = (task: RetestTask) =>
    role === 'SYSTEM_ADMIN' || (role === 'QA_SPECIALIST' && task.assignedToId === activeContext.userId);
  const selectedOpenRetestTask = selectedBug
    ? openRetestTasks.find(t => getRetestTaskBugIds(t).includes(selectedBug.id))
    : undefined;
  const selectedRunBugs = selectedRun ? getBugsForRun(selectedRun.id) : [];

  // Detail field renderer
  const DetailField = ({ label, value, icon }: { label: string; value: string | undefined; icon?: React.ReactNode }) => (
    <div className="flex items-start gap-2 py-2">
      {icon && <span className="mt-0.5 text-gray-400">{icon}</span>}
      <div><p className="text-xs text-gray-500">{label}</p><p className="text-sm font-medium text-gray-900">{value || '-'}</p></div>
    </div>
  );

  const canEditRun = canPerformAction(role!, 'test-run:edit');
  const canDeleteRun = canPerformAction(role!, 'test-run:delete');

  const [showDeleteRunConfirm, setShowDeleteRunConfirm] = useState(false);
  const [deleteRunTarget, setDeleteRunTarget] = useState<TestRun | null>(null);

  const handleDeleteRun = async () => {
    if (!activeContext || !deleteRunTarget) return;
    setActionLoading(true);
    try {
      const removed = await testRunApi.delete(deleteRunTarget.id, activeContext.userId);
      if (!removed) {
        toast.error('حذف اجرای تست ممکن نیست؛ اجرا یا باگ‌های وابسته قفل VersionHistory دارند.');
        return;
      }
      toast.success('اجرای تست حذف شد.');
      setShowDeleteRunConfirm(false); setDeleteRunTarget(null);
      loadRuns();
      loadAllRuns();
    } catch { toast.error('خطا در حذف.'); }
    finally { setActionLoading(false); }
  };

  const runColumns = [
    { key: 'tc', title: 'تست کیس', render: (item: TestRun) => <div><p className="font-medium text-gray-900">{item.testCase?.title || '-'}</p><p className="text-xs text-gray-500">v{item.version}</p></div> },
    ...(shouldShowSystemColumn ? [{
      key: 'applicationId',
      title: 'سامانه',
      render: (item: TestRun) => <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{getApplicationName(item.applicationId)}</span>,
    }] : []),
    { key: 'status', title: 'وضعیت', render: (item: TestRun) => <StatusBadge status={item.status} labels={TEST_RUN_STATUS_LABELS} /> },
    { key: 'exec', title: 'اجراکننده', render: (item: TestRun) => item.executedBy?.fullName || '-' },
    { key: 'date', title: 'تاریخ', render: (item: TestRun) => item.executedAt ? new Date(item.executedAt).toLocaleDateString('fa-IR') : '-' },
    { key: 'a', title: 'عملیات', render: (item: TestRun) => (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" icon={<Eye className="w-4 h-4" />}
          onClick={(e) => { e.stopPropagation(); setSelectedRun(item); setRunDetailStep(1); setShowRunDetailModal(true); }}>مشاهده</Button>
        {canEditRun && canEditRunFields(item) && (
          <Button size="sm" variant="ghost" icon={<Edit className="w-4 h-4" />}
            onClick={(e) => { e.stopPropagation(); openRunEditModal(item); }}>ویرایش</Button>
        )}
        {canDeleteRun && (
          <Button size="sm" variant="ghost" className="text-red-600" icon={<Trash2 className="w-4 h-4" />}
            onClick={(e) => { e.stopPropagation(); setDeleteRunTarget(item); setShowDeleteRunConfirm(true); }}>حذف</Button>
        )}
      </div>
    )},
  ];
  // Bug columns removed — bugs shown inside run detail wizard step 2

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="کارتابل اجرای تست و باگ‌ها" subtitle={isDeveloper ? 'باگ‌های تخصیص‌یافته' : 'اجرای ویزاردی تست و مدیریت باگ'}
        onRefresh={() => { loadRuns(); loadBugs(); loadAllBugs(); loadRetestTasks(); }} refreshing={runsLoading || bugsLoading || retestTasksLoading} />
      <main className="p-4 sm:p-6">
        {activeContext.scope === 'APP' && <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-700">🌐 سطح کل اپلیکیشن</div>}

        {(isQA || role === 'SYSTEM_ADMIN') && openRetestTasks.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-purple-500" />
              صف Retest/Regression
              <span className="text-sm font-normal text-gray-500">({openRetestTasks.length})</span>
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {openRetestTasks.map(task => (
                <div key={task.id} className="p-4 bg-white border border-purple-100 rounded-lg shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-medium text-gray-900">{task.previousRun?.testCase?.title || task.bug?.title || task.bugId}</p>
                      <p className="text-xs text-gray-500 mt-1">Run قبلی: {task.previousRun?.testCase?.title || task.previousRunId}</p>
                      <p className="text-xs text-purple-700 mt-1">
                        {getRetestTaskBugIds(task).length} باگ آماده Retest/Regression
                        {task.assignedTo?.fullName ? ` | مسئول: ${task.assignedTo.fullName}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={task.status} labels={RETEST_TASK_STATUS_LABELS} />
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {task.purposes.map(p => (
                      <span key={p} className="px-2 py-0.5 text-xs bg-purple-50 text-purple-700 rounded">
                        {TEST_RUN_PURPOSE_LABELS[p]}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-500">
                      ایجاد: {new Date(task.createdAt).toLocaleDateString('fa-IR')}
                    </span>
                    {canStartRetestTask(task) ? (
                      <Button size="sm" icon={<PlayCircle className="w-4 h-4" />} onClick={() => handleStartRetestTask(task)} loading={actionLoading}>
                        {task.status === 'IN_PROGRESS' ? 'ادامه اجرا' : 'شروع اجرا'}
                      </Button>
                    ) : (
                      <span className="text-xs text-gray-500">فقط متخصص مسئول امکان شروع دارد</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Runs Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4"><PlayCircle className="w-5 h-5 text-blue-500" /> اجرای تست‌ها {runsData && <span className="text-sm font-normal text-gray-500">({runsData.total})</span>}</h2>
          <div className="flex flex-wrap gap-3 items-center mb-3">
            {canCreateRun && <Button icon={<Plus className="w-4 h-4" />} onClick={() => { resetWizard(); setShowWizard(true); }}>اجرای جدید</Button>}
            <CartableExcelExportButton
              data={runsData?.data || []}
              columns={[
                { key: 'version', title: 'نسخه' }, { key: 'status', title: 'وضعیت' },
              ]}
              filename="test-runs"
              disabled={!runsData?.data?.length}
            />
            <CartableSearchInput
              value={runsFilters.search || ''}
              onChange={(search) => setRunsFilters({ ...runsFilters, search, page: 1 })}
              className="min-w-[180px]"
            />
            <CartableSelectFilter
              value={runsFilters.status || ''}
              onChange={(status) => setRunsFilters({ ...runsFilters, status, page: 1 })}
              options={Object.entries(TEST_RUN_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              allLabel="همه وضعیت‌ها"
            />
          </div>
          <Table columns={runColumns} data={runsData?.data || []} loading={runsLoading} emptyMessage="اجرایی یافت نشد"
            onRowClick={(item) => { setSelectedRun(item); setShowRunDetailModal(true); }}
            rowClassName={(item) => item.status === 'FAILED' ? 'bg-red-50' : item.status === 'PASSED' ? 'bg-green-50' : ''}
            enableClientFilter={false}
            enableExport={false}
            enableColumnChooser={false} />
          {runsData && <Pagination page={runsData.page} totalPages={runsData.totalPages || 1} total={runsData.total} limit={runsData.limit || runsFilters.limit}
            onPageChange={(p) => setRunsFilters({ ...runsFilters, page: p })}
            onLimitChange={(l) => setRunsFilters({ ...runsFilters, limit: l, page: 1 })} />}
        </div>

        {/* Item #8: Bugs section removed from here — bugs are now shown inside Run Detail wizard */}
      </main>

      {/* ========== WIZARD MODAL ========== */}
      <Modal isOpen={showWizard} onClose={resetWizard} title={wizardStep === 1 ? '🧪 مرحله ۱: اجرای تست' : wizardStep === 2 ? '🐛 مرحله ۲: ثبت باگ‌ها' : '⚠️ مرحله ۲: مشکل اجرا'} size="xl">
        <div className="flex items-center gap-2 mb-6">
          <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${wizardStep === 1 ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>مرحله ۱ {wizardStep > 1 && '✓'}</div>
          <ArrowLeft className="w-4 h-4 text-gray-400" />
          <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${wizardStep >= 2 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'}`}>{wizardStep === 3 ? 'مشکل' : 'باگ'}</div>
        </div>
        {activeRetestTaskId && (
          <div className="mb-5 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
            این اجرا از RetestTask شروع شده است؛ Run جدید قبلاً در وضعیت Pending ساخته شده و ثبت نتیجه همین Run را تکمیل می‌کند.
          </div>
        )}

        {/* STEP 1 */}
        {wizardStep === 1 && (
          <div className="space-y-5">
            {/* Item: Required test request selection */}
            <Select label="درخواست تست *" value={wizardTestRequestId} onChange={(e) => { clearWizardError('testRequestId'); setWizardTestRequestId(e.target.value); }}
              options={testRequests.map(tr => ({ value: tr.id, label: `${tr.title} (v${tr.version})` }))} placeholder="انتخاب درخواست تست (اجباری)" disabled={!!activeRetestTaskId} error={wizardErrors.testRequestId} />

            <Select label="تست کیس *" value={wizardTestCaseId} onChange={(e) => { clearWizardError('testCaseId'); setWizardTestCaseId(e.target.value); setWizardReqExpanded(false); }}
              options={testCases.map(tc => ({ value: tc.id, label: `${tc.title} (${TEST_TYPE_LABELS[tc.testType] || tc.testType})` }))} placeholder="انتخاب تست کیس" disabled={!!activeRetestTaskId} error={wizardErrors.testCaseId} />

            {/* Requirement Accordion */}
            {wizardSelectedReq && (
              <div className="border rounded-lg overflow-hidden">
                <button onClick={() => setWizardReqExpanded(!wizardReqExpanded)} className="w-full flex items-center justify-between p-3 bg-indigo-50 hover:bg-indigo-100 text-right">
                  <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-500" /><span className="font-medium text-indigo-800 text-sm">نیازمندی: {wizardSelectedReq.title}</span></div>
                  {wizardReqExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {wizardReqExpanded && (
                  <div className="p-4 bg-white border-t space-y-2 text-sm">
                    <p>{wizardSelectedReq.description || '-'}</p>
                    {wizardSelectedReq.acceptanceCriteria && <div className="p-2 bg-green-50 rounded border border-green-200"><p className="text-xs text-gray-500">معیارهای پذیرش</p><p className="whitespace-pre-wrap">{wizardSelectedReq.acceptanceCriteria}</p></div>}
                    {wizardSelectedReq.riskNotes && <div className="p-2 bg-amber-50 rounded border border-amber-200"><p className="text-xs text-gray-500">ریسک</p><p>{wizardSelectedReq.riskNotes}</p></div>}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="نسخه *" placeholder="2.5.0" value={wizardVersion} onChange={(e) => handleWizardVersionChange(e.target.value)} error={wizardErrors.version} />
              <Input label="شماره بیلد" placeholder="build-1234" value={wizardBuildNumber} onChange={(e) => handleWizardBuildChange(e.target.value)} error={wizardErrors.buildNumber} />
            </div>

            {/* Multi-select Execution Purpose */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">هدف اجرا * (مولتی‌سلکت)</label>
              <div className="flex flex-wrap gap-2">
                {EXECUTION_PURPOSES.map(p => (
                  <button key={p.value} type="button" onClick={() => !activeRetestTaskId && togglePurpose(p.value)} disabled={!!activeRetestTaskId}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-all ${wizardPurposes.includes(p.value) ? 'bg-blue-100 border-blue-300 text-blue-700 font-medium' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    {wizardPurposes.includes(p.value) && '✓ '}{p.label}
                  </button>
                ))}
              </div>
              {wizardPurposes.length > 0 && <p className="text-xs text-blue-600 mt-1">{wizardPurposes.length} مورد انتخاب شده</p>}
              {wizardErrors.purposes && <p className="mt-1 text-sm text-red-600">{wizardErrors.purposes}</p>}
            </div>

            {/* Previous Run — when Regression or Retest selected */}
            {needsPrevRun && (
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 space-y-3">
                <p className="text-sm font-medium text-purple-800">📋 انتخاب تست ران قبلی (برای {wizardPurposes.includes('RETEST') ? 'Retest' : 'Regression'})</p>
                <Select label="تست ران قبلی *" value={wizardPrevRunId} onChange={(e) => { clearWizardError('previousRunId'); setWizardPrevRunId(e.target.value); setWizardPrevRunExpanded(false); }}
                  options={allRuns.map(r => ({ value: r.id, label: `${r.testCase?.title || r.id} — v${r.version} — ${TEST_RUN_STATUS_LABELS[r.status]}` }))} placeholder="انتخاب تست ران قبلی" disabled={!!activeRetestTaskId} error={wizardErrors.previousRunId} />
                {/* Previous Run Accordion */}
                {wizardPrevRunId && getPrevRun() && (
                  <div className="border rounded-lg overflow-hidden">
                    <button onClick={() => setWizardPrevRunExpanded(!wizardPrevRunExpanded)} className="w-full flex items-center justify-between p-3 bg-purple-100 hover:bg-purple-200 text-right">
                      <span className="font-medium text-purple-800 text-sm">اطلاعات تست ران قبلی</span>
                      {wizardPrevRunExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {wizardPrevRunExpanded && (() => { const pr = getPrevRun()!; return (
                      <div className="p-4 bg-white border-t space-y-2 text-sm">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <DetailField label="تست کیس" value={pr.testCase?.title} />
                          <DetailField label="وضعیت" value={TEST_RUN_STATUS_LABELS[pr.status]} />
                          <DetailField label="نسخه" value={pr.version} />
                          <DetailField label="بیلد" value={pr.buildNumber} />
                          <DetailField label="اجراکننده" value={pr.executedBy?.fullName} />
                          <DetailField label="تاریخ" value={pr.executedAt ? new Date(pr.executedAt).toLocaleDateString('fa-IR') : '-'} />
                        </div>
                        {pr.actualResult && <div className="p-2 bg-gray-50 rounded"><p className="text-xs text-gray-500">نتیجه واقعی</p><p>{pr.actualResult}</p></div>}
                      </div>
                    ); })()}
                  </div>
                )}
              </div>
            )}

            <Select label="نتیجه تست *" value={wizardResult} onChange={(e) => { clearWizardError('result'); setWizardResult(e.target.value as TestRunStatus); }}
              options={[{ value: 'PASSED', label: '✅ موفق' }, { value: 'FAILED', label: '❌ ناموفق → ثبت باگ' }, { value: 'BLOCKED', label: '⚠️ مسدود' }, { value: 'SKIPPED', label: '⏭️ نادیده' }]}
              placeholder="نتیجه" error={wizardErrors.result} />
            <Textarea label="نتیجه واقعی *" placeholder="شرح نتیجه..." value={wizardActualResult} onChange={(e) => { clearWizardError('actualResult'); setWizardActualResult(e.target.value); }} error={wizardErrors.actualResult} />

            {/* File Upload for Step 1 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2"><Upload className="w-4 h-4 inline ml-1" /> بارگذاری مدرک (اختیاری)</label>
              <input type="file" multiple accept="image/*,video/*,application/pdf,.doc,.docx" onChange={(e) => handleFileAdd(e.target.files, 'wizard')}
                className="block w-full text-sm text-gray-500 file:ml-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              {wizardFiles.length > 0 && (
                <div className="mt-2 space-y-1">{wizardFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                    <Paperclip className="w-3.5 h-3.5 text-gray-400" /><span className="flex-1 truncate">{f.name}</span><span className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => setWizardFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}</div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button variant="secondary" onClick={resetWizard}>انصراف</Button>
              <Button onClick={handleWizardStep1} loading={actionLoading}
                disabled={actionLoading}>
                {wizardResult === 'FAILED' ? 'ذخیره و ثبت باگ ←' : wizardResult === 'BLOCKED' ? 'ذخیره و ثبت مشکل ←' : 'ذخیره'}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Multiple Bugs */}
        {wizardStep === 2 && (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-sm text-red-700">
              تست ناموفق بود. در Retest ابتدا وضعیت باگ‌های قبلی را مشخص کنید و در صورت وجود ایراد جدید، باگ جدید ثبت کنید.
            </div>
            {activeRetestTaskId && activeRetestBugIds.length > 0 && (
              <div className="space-y-3 rounded-lg border border-purple-200 bg-purple-50 p-4">
                <div>
                  <h4 className="font-medium text-purple-900">بررسی باگ‌های قبلی Retest/Regression</h4>
                  <p className="mt-1 text-xs text-purple-700">
                    فقط باگ‌هایی که «رفع نشده» انتخاب شوند برای اقدام مجدد به توسعه‌دهنده برمی‌گردند.
                  </p>
                </div>
                {activeRetestBugIds.map((bugId, index) => {
                  const bug = activeRetestBugs.find(item => item.id === bugId) || allBugs.find(item => item.id === bugId);
                  const decision = retestBugDecisions[bugId] || '';
                  return (
                    <div key={bugId} className="rounded-lg border border-purple-100 bg-white p-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {index + 1}. {bug?.title || bugId}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            وضعیت فعلی: {bug ? BUG_STATUS_LABELS[bug.status] : '-'}
                            {bug?.fixedVersion ? ` | نسخه رفع: ${bug.fixedVersion}` : ''}
                          </p>
                          {bug?.fixNotes && <p className="mt-1 text-xs text-gray-600">یادداشت رفع: {bug.fixNotes}</p>}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            size="sm"
                            variant={decision === 'PASSED' ? 'primary' : 'secondary'}
                            icon={<CheckCircle className="w-4 h-4" />}
                            onClick={() => updateRetestBugDecision(bugId, 'PASSED')}
                          >
                            رفع تایید شد
                          </Button>
                          <Button
                            size="sm"
                            variant={decision === 'FAILED' ? 'danger' : 'secondary'}
                            icon={<XCircle className="w-4 h-4" />}
                            onClick={() => updateRetestBugDecision(bugId, 'FAILED')}
                          >
                            رفع نشده
                          </Button>
                        </div>
                      </div>
                      {wizardErrors[`retest-bug-${bugId}`] && (
                        <p className="mt-2 text-sm text-red-600">{wizardErrors[`retest-bug-${bugId}`]}</p>
                      )}
                    </div>
                  );
                })}
                {wizardErrors.retestReview && <p className="text-sm text-red-600">{wizardErrors.retestReview}</p>}
              </div>
            )}
            {wizardErrors.bugs && <p className="text-sm text-red-600">{wizardErrors.bugs}</p>}
            {wizardBugs.map((bug, idx) => (
              <div key={bug.id} className="p-4 bg-white border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">🐛 باگ جدید {idx + 1}</h4>
                  {wizardBugs.length > 1 && <button onClick={() => removeBugEntry(bug.id)} className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> حذف</button>}
                </div>
                <Input label="عنوان باگ *" placeholder="عنوان" value={bug.title} onChange={(e) => { clearWizardError(`bug-${bug.id}-title`); updateBugEntry(bug.id, 'title', e.target.value); }} error={wizardErrors[`bug-${bug.id}-title`]} />
                <Textarea label="توضیحات *" placeholder="شرح" value={bug.description} onChange={(e) => { clearWizardError(`bug-${bug.id}-description`); updateBugEntry(bug.id, 'description', e.target.value); }} error={wizardErrors[`bug-${bug.id}-description`]} />
                <Textarea label="مراحل بازتولید *" placeholder="مراحل" value={bug.stepsToReproduce} onChange={(e) => { clearWizardError(`bug-${bug.id}-steps`); updateBugEntry(bug.id, 'stepsToReproduce', e.target.value); }} error={wizardErrors[`bug-${bug.id}-steps`]} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Select label="شدت" value={bug.severity} onChange={(e) => updateBugEntry(bug.id, 'severity', e.target.value as BugSeverity)} options={Object.entries(BUG_SEVERITY_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
                  <Select label="اولویت" value={bug.priority} onChange={(e) => updateBugEntry(bug.id, 'priority', e.target.value as Priority)} options={Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
                </div>
                {/* Item #4: Developer assignment in bug form */}
                <Select label="تخصیص به توسعه‌دهنده" value={bug.assigneeId} onChange={(e) => updateBugEntry(bug.id, 'assigneeId', e.target.value)}
                  options={developers.map(d => ({ value: d.id, label: d.fullName }))} placeholder="انتخاب توسعه‌دهنده (اختیاری)" />
                {/* Bug file upload */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1"><Paperclip className="w-3.5 h-3.5 inline ml-1" /> پیوست (عکس، ویدیو، PDF)</label>
                  <input type="file" multiple accept="image/*,video/*,application/pdf" onChange={(e) => handleFileAdd(e.target.files, bug.id)}
                    className="block w-full text-xs text-gray-500 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-red-50 file:text-red-700" />
                  {bug.files.length > 0 && <div className="mt-1 space-y-0.5">{bug.files.map((f, fi) => (
                    <div key={fi} className="flex items-center gap-2 text-xs text-gray-600"><Paperclip className="w-3 h-3" />{f.name} ({(f.size / 1024).toFixed(0)} KB)</div>
                  ))}</div>}
                </div>
              </div>
            ))}
            <button onClick={addBugEntry} className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-red-400 hover:text-red-600 flex items-center justify-center gap-2 transition-colors">
              <PlusCircle className="w-5 h-5" /> افزودن باگ جدید
            </button>
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button variant="secondary" onClick={resetWizard}>انصراف</Button>
              <Button variant="danger" onClick={handleWizardBugsSubmit} loading={actionLoading}
                disabled={actionLoading}>
                {activeRetestTaskId
                  ? `ثبت نتیجه Retest${wizardBugs.filter(b => b.title.trim()).length ? ` و ${wizardBugs.filter(b => b.title.trim()).length} باگ جدید` : ''}`
                  : `ثبت ${wizardBugs.filter(b => b.title.trim()).length} باگ و اتمام`}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Issue */}
        {wizardStep === 3 && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-700">تست مسدود شد.</div>
            <Select label="نوع مشکل *" value={wizardIssueType} onChange={(e) => setWizardIssueType(e.target.value as RunIssueType)} options={Object.entries(RUN_ISSUE_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
            <Input label="عنوان *" placeholder="عنوان" value={wizardIssueTitle} onChange={(e) => { clearWizardError('issueTitle'); setWizardIssueTitle(e.target.value); }} error={wizardErrors.issueTitle} />
            <Textarea label="توضیحات *" placeholder="شرح" value={wizardIssueDesc} onChange={(e) => { clearWizardError('issueDesc'); setWizardIssueDesc(e.target.value); }} error={wizardErrors.issueDesc} />
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button variant="secondary" onClick={resetWizard}>انصراف</Button>
              <Button variant="warning" onClick={handleWizardIssue} loading={actionLoading} disabled={actionLoading}>ثبت و اتمام</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showRunEditModal} onClose={() => { setShowRunEditModal(false); setRunEditFiles([]); setRunEditErrors({}); }} title="ویرایش اجرای تست" size="xl">
        {selectedRun && (
          <div className="space-y-5">
            {!canEditRunFields(selectedRun) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                این اجرا به VersionHistory متصل شده و ویرایش فیلدها مجاز نیست.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="درخواست تست *"
                value={runEditData.testRequestId}
                onChange={(e) => {
                  clearRunEditError('testRequestId');
                  const request = testRequests.find(tr => tr.id === e.target.value);
                  setRunEditData(prev => ({
                    ...prev,
                    testRequestId: e.target.value,
                    version: request?.version || prev.version,
                    buildNumber: request?.buildNumber || prev.buildNumber,
                  }));
                }}
                options={testRequests.map(tr => ({ value: tr.id, label: `${tr.title} (v${tr.version})` }))}
                placeholder="انتخاب درخواست تست"
                disabled={!canEditRunFields(selectedRun)}
                error={runEditErrors.testRequestId}
              />
              <Select
                label="تست کیس *"
                value={runEditData.testCaseId}
                onChange={(e) => {
                  clearRunEditError('testCaseId');
                  const testCase = testCases.find(tc => tc.id === e.target.value);
                  setRunEditData(prev => ({
                    ...prev,
                    testCaseId: e.target.value,
                    testRequestId: testCase?.testRequestId || prev.testRequestId,
                  }));
                }}
                options={testCases.map(tc => ({ value: tc.id, label: `${tc.title} (${TEST_TYPE_LABELS[tc.testType] || tc.testType})` }))}
                placeholder="انتخاب تست کیس"
                disabled={!canEditRunFields(selectedRun)}
                error={runEditErrors.testCaseId}
              />
              <Input
                label="نسخه *"
                value={runEditData.version}
                onChange={(e) => handleRunEditVersionChange(e.target.value)}
                disabled={!canEditRunFields(selectedRun)}
                error={runEditErrors.version}
              />
              <Input
                label="شماره بیلد"
                value={runEditData.buildNumber}
                onChange={(e) => handleRunEditBuildChange(e.target.value)}
                disabled={!canEditRunFields(selectedRun)}
                error={runEditErrors.buildNumber}
              />
              <Select
                label="Run قبلی"
                value={runEditData.previousRunId}
                onChange={(e) => setRunEditData(prev => ({ ...prev, previousRunId: e.target.value }))}
                options={[
                  { value: '', label: 'بدون Run قبلی' },
                  ...allRuns
                    .filter(run => run.id !== selectedRun.id)
                    .map(run => ({ value: run.id, label: `${run.testCase?.title || run.id} - v${run.version} - ${TEST_RUN_STATUS_LABELS[run.status]}` })),
                ]}
                disabled={!canEditRunFields(selectedRun)}
              />
              <Select
                label="وضعیت اجرا *"
                value={runEditData.status}
                onChange={(e) => setRunEditData(prev => ({ ...prev, status: e.target.value as TestRunStatus }))}
                options={Object.entries(TEST_RUN_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                disabled={!canEditRunFields(selectedRun)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">هدف اجرا *</label>
              <div className="flex flex-wrap gap-2">
                {EXECUTION_PURPOSES.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => { clearRunEditError('purposes'); toggleRunEditPurpose(p.value); }}
                    disabled={!canEditRunFields(selectedRun)}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                      runEditData.purposes.includes(p.value)
                        ? 'bg-blue-100 border-blue-300 text-blue-700 font-medium'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {runEditData.purposes.includes(p.value) && '✓ '}{p.label}
                  </button>
                ))}
              </div>
              {runEditErrors.purposes && <p className="mt-1 text-sm text-red-600">{runEditErrors.purposes}</p>}
            </div>
            <Textarea
              label="نتیجه واقعی"
              value={runEditData.actualResult}
              onChange={(e) => setRunEditData(prev => ({ ...prev, actualResult: e.target.value }))}
              disabled={!canEditRunFields(selectedRun)}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Upload className="w-4 h-4 inline ml-1" />
                بارگذاری مدرک/پیوست اجرای تست
              </label>
              <input
                type="file"
                multiple
                accept="image/*,video/*,application/pdf,.doc,.docx"
                onChange={(e) => handleEditFileAdd(e.target.files, 'run')}
                disabled={!canEditRunFields(selectedRun)}
                className="block w-full text-sm text-gray-500 file:ml-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
              />
              {runEditFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {runEditFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                      <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</span>
                      <button
                        type="button"
                        onClick={() => setRunEditFiles(prev => prev.filter((_, fileIndex) => fileIndex !== index))}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t pt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <BugIcon className="w-5 h-5 text-red-500" />
                  ویرایش باگ‌های ثبت‌شده
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{bugEditEntries.length} باگ</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<PlusCircle className="w-4 h-4" />}
                    onClick={addBugEditEntry}
                    disabled={!canEditRunFields(selectedRun) || runEditData.status !== 'FAILED'}
                  >
                    افزودن باگ
                  </Button>
                </div>
              </div>
              {runEditData.status !== 'FAILED' && (
                <p className="text-xs text-amber-600">
                  افزودن باگ فقط برای اجرای ناموفق فعال است.
                </p>
              )}
              {bugEditEntries.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                  برای این اجرا باگی ثبت نشده است.
                </p>
              ) : (
                bugEditEntries.map((bug, index) => {
                  const disabled = !canEditRunFields(selectedRun) || !!bug.isLocked;
                  return (
                    <div key={bug.id} className={`p-4 rounded-lg border space-y-3 ${bug.isLocked ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-gray-900">باگ {index + 1}</p>
                        <div className="flex items-center gap-2">
                          {bug.isNew && <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">جدید</span>}
                          {bug.isLocked && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                              <Lock className="w-3.5 h-3.5" />
                              قفل شده
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            icon={<Trash2 className="w-4 h-4" />}
                            onClick={() => removeBugEditEntry(bug)}
                            disabled={disabled}
                          >
                            حذف
                          </Button>
                        </div>
                      </div>
                      <Input
                        label="عنوان باگ *"
                        value={bug.title}
                        onChange={(e) => updateBugEditEntry(bug.id, 'title', e.target.value)}
                        disabled={disabled}
                        error={runEditErrors[`bug-${bug.id}-title`]}
                      />
                      <Textarea
                        label="توضیحات *"
                        value={bug.description}
                        onChange={(e) => updateBugEditEntry(bug.id, 'description', e.target.value)}
                        disabled={disabled}
                        error={runEditErrors[`bug-${bug.id}-description`]}
                      />
                      <Textarea
                        label="مراحل بازتولید *"
                        value={bug.stepsToReproduce}
                        onChange={(e) => updateBugEditEntry(bug.id, 'stepsToReproduce', e.target.value)}
                        disabled={disabled}
                        error={runEditErrors[`bug-${bug.id}-steps`]}
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Select
                          label="شدت"
                          value={bug.severity}
                          onChange={(e) => updateBugEditEntry(bug.id, 'severity', e.target.value)}
                          options={Object.entries(BUG_SEVERITY_LABELS).map(([value, label]) => ({ value, label }))}
                          disabled={disabled}
                        />
                        <Select
                          label="اولویت"
                          value={bug.priority}
                          onChange={(e) => updateBugEditEntry(bug.id, 'priority', e.target.value)}
                          options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
                          disabled={disabled}
                        />
                      </div>
                      <Select
                        label="تخصیص به توسعه‌دهنده"
                        value={bug.assigneeId}
                        onChange={(e) => updateBugEditEntry(bug.id, 'assigneeId', e.target.value)}
                        options={[
                          { value: '', label: 'بدون تخصیص' },
                          ...developers.map(d => ({ value: d.id, label: d.fullName })),
                        ]}
                        disabled={disabled}
                      />
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          <Paperclip className="w-3.5 h-3.5 inline ml-1" />
                          پیوست باگ (عکس، ویدیو، PDF)
                        </label>
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*,application/pdf"
                          onChange={(e) => handleEditFileAdd(e.target.files, bug.id)}
                          disabled={disabled}
                          className="block w-full text-xs text-gray-500 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-red-50 file:text-red-700 disabled:opacity-50"
                        />
                        {bug.files.length > 0 && (
                          <div className="mt-1 space-y-1">
                            {bug.files.map((file, fileIndex) => (
                              <div key={`${file.name}-${fileIndex}`} className="flex items-center gap-2 text-xs text-gray-600">
                                <Paperclip className="w-3 h-3" />
                                <span className="flex-1 truncate">{file.name} ({(file.size / 1024).toFixed(0)} KB)</span>
                                <button
                                  type="button"
                                  onClick={() => removeBugEditFile(bug.id, fileIndex)}
                                  disabled={disabled}
                                  className="text-red-500 hover:text-red-700 disabled:opacity-50"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button variant="secondary" onClick={() => { setShowRunEditModal(false); setRunEditFiles([]); setRunEditErrors({}); }}>انصراف</Button>
              <Button
                onClick={handleRunUpdate}
                loading={actionLoading}
                disabled={!canEditRunFields(selectedRun) || actionLoading}
              >
                ذخیره تغییرات
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========== RUN DETAIL WIZARD — Item #8: wizard with bugs in step 2 ========== */}
      <Modal isOpen={showRunDetailModal} onClose={() => { setShowRunDetailModal(false); setRunDetailStep(1); }} title={runDetailStep === 1 ? 'مشاهده جزئیات اجرای تست' : '🐛 باگ‌های مرتبط با اجرا'} size="xl">
        {selectedRun && (
          <div>
            {/* Wizard steps */}
            <div className="flex items-center gap-2 mb-5">
              <button onClick={() => setRunDetailStep(1)} className={`px-3 py-1.5 rounded-full text-sm font-medium ${runDetailStep === 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                مرحله ۱: اطلاعات اجرا
              </button>
              <ArrowLeft className="w-4 h-4 text-gray-400" />
              <button onClick={() => setRunDetailStep(2)} className={`px-3 py-1.5 rounded-full text-sm font-medium ${runDetailStep === 2 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                مرحله ۲: باگ‌ها و تغییر وضعیت
              </button>
            </div>

            {/* STEP 1: Run details */}
            {runDetailStep === 1 && (
              <div className="space-y-5">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">{selectedRun.testCase?.title || '-'}</h3>
                  <div className="flex items-center gap-2">
                    {selectedRun.isLocked && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                        <Lock className="w-3.5 h-3.5" />
                        قفل شده
                      </span>
                    )}
                    <StatusBadge status={selectedRun.status} labels={TEST_RUN_STATUS_LABELS} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <DetailField label="شناسه اجرا" value={selectedRun.id} icon={<Hash className="w-4 h-4" />} />
                  <DetailField label="نسخه" value={selectedRun.version} icon={<Layers className="w-4 h-4" />} />
                  <DetailField label="شماره بیلد" value={selectedRun.buildNumber || '-'} icon={<Hash className="w-4 h-4" />} />
                  <DetailField label="وضعیت" value={TEST_RUN_STATUS_LABELS[selectedRun.status]} icon={<Target className="w-4 h-4" />} />
                  <DetailField label="اجراکننده" value={selectedRun.executedBy?.fullName || '-'} icon={<UserIcon className="w-4 h-4" />} />
                  <DetailField label="تاریخ اجرا" value={selectedRun.executedAt ? new Date(selectedRun.executedAt).toLocaleString('fa-IR') : '-'} icon={<Clock className="w-4 h-4" />} />
                  <DetailField label="تاریخ ایجاد" value={new Date(selectedRun.createdAt).toLocaleString('fa-IR')} icon={<Clock className="w-4 h-4" />} />
                  <DetailField label="قفل تصمیم انتشار" value={selectedRun.isLocked ? (selectedRun.lockedByVersionHistoryId || 'قفل شده') : 'باز'} icon={<Lock className="w-4 h-4" />} />
                </div>
                {selectedRun.isLocked && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                    این Run پس از تصمیم VersionHistory قفل شده است. تغییر فقط با Unlock ممیزی‌شده توسط System Admin مجاز است.
                  </div>
                )}
                {(selectedRun.retestTaskId || selectedRun.previousRunId || selectedRun.purposes?.length) && (
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <h4 className="font-medium text-purple-800 mb-2 flex items-center gap-2"><Target className="w-4 h-4" /> اطلاعات Retest/Regression</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <DetailField label="RetestTask" value={selectedRun.retestTaskId || '-'} />
                      <DetailField label="Run قبلی" value={selectedRun.previousRunId || '-'} />
                      <DetailField label="اهداف اجرا" value={selectedRun.purposes?.map(p => TEST_RUN_PURPOSE_LABELS[p]).join('، ') || '-'} />
                    </div>
                  </div>
                )}
                {selectedRun.testCase && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2"><FileText className="w-4 h-4" /> اطلاعات تست کیس</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <DetailField label="عنوان" value={selectedRun.testCase.title} />
                      <DetailField label="نوع تست" value={TEST_TYPE_LABELS[selectedRun.testCase.testType]} />
                      <DetailField label="اولویت" value={PRIORITY_LABELS[selectedRun.testCase.priority]} />
                      <DetailField label="سطح ریسک" value={PRIORITY_LABELS[selectedRun.testCase.riskLevel]} />
                    </div>
                    {selectedRun.testCase.scenario && <div className="mt-2 p-2 bg-white rounded"><p className="text-xs text-gray-500">سناریو</p><p className="text-sm">{selectedRun.testCase.scenario}</p></div>}
                    {selectedRun.testCase.expectedResult && <div className="mt-2 p-2 bg-white rounded"><p className="text-xs text-gray-500">نتیجه مورد انتظار</p><p className="text-sm">{selectedRun.testCase.expectedResult}</p></div>}
                  </div>
                )}
                {selectedRun.actualResult && (
                  <div className={`p-4 rounded-lg ${selectedRun.status === 'PASSED' ? 'bg-green-50 border border-green-200' : selectedRun.status === 'FAILED' ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border'}`}>
                    <p className="text-xs text-gray-500 mb-1">نتیجه واقعی</p><p className="text-sm whitespace-pre-wrap">{selectedRun.actualResult}</p>
                  </div>
                )}
                {/* Uploaded files display */}
                {wizardFiles.length > 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-2">فایل‌های پیوست</p>
                    {wizardFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 p-1.5 text-sm"><Paperclip className="w-3.5 h-3.5 text-gray-400" /><a href="#" className="text-blue-600 hover:underline">{f.name}</a><span className="text-xs text-gray-400">({(f.size / 1024).toFixed(0)} KB)</span></div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between pt-4 border-t">
                  <Button variant="secondary" onClick={() => { setShowRunDetailModal(false); setRunDetailStep(1); }}>بستن</Button>
                  <div className="flex gap-2">
                    {canEditRun && canEditRunFields(selectedRun) && (
                      <Button
                        variant="secondary"
                        icon={<Edit className="w-4 h-4" />}
                        onClick={() => openRunEditModal(selectedRun)}
                      >
                        ویرایش
                      </Button>
                    )}
                    {canAdminUnlock && selectedRun.isLocked && (
                      <Button
                        variant="warning"
                        icon={<Unlock className="w-4 h-4" />}
                        onClick={() => openUnlockModal({ type: 'RUN', id: selectedRun.id, title: selectedRun.testCase?.title || selectedRun.id })}
                      >
                        Unlock
                      </Button>
                    )}
                    <Button onClick={() => setRunDetailStep(2)}>مرحله بعد: باگ‌ها ←</Button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Bugs for this run + developer status change */}
            {runDetailStep === 2 && (
              <div className="space-y-5">
                <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                  <span className="text-sm">اجرای تست: <strong>{selectedRun.testCase?.title}</strong></span>
                  <StatusBadge status={selectedRun.status} labels={TEST_RUN_STATUS_LABELS} />
                </div>

                {/* Bugs list for this run */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2"><BugIcon className="w-5 h-5 text-red-500" /> باگ‌های مرتبط</h4>
                  {selectedRunBugs.length > 0 ? (
                    <div className="space-y-3">
                      {selectedRunBugs.map(bug => (
                        <div key={bug.id} className={`p-4 rounded-lg border ${bug.severity === 'CRITICAL' ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h5 className="font-medium text-gray-900">{bug.title}</h5>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{bug.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {bug.isLocked && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                                  <Lock className="w-3.5 h-3.5" />
                                  قفل شده
                                </span>
                              )}
                              <StatusBadge status={bug.status} labels={BUG_STATUS_LABELS} />
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-3">
                            <span>شدت: <StatusBadge status={bug.severity} labels={BUG_SEVERITY_LABELS} /></span>
                            <span>Developer: {bug.assignee?.fullName || '-'}</span>
                            <span>نسخه رفع: {bug.fixedVersion || '-'}</span>
                          </div>
                          {/* Developer actions inline */}
                          {(getAvailableTransitions(bug).length > 0 || canRestoreBug(bug)) && (
                            <div className="flex gap-2 pt-2 border-t">
                              {getAvailableTransitions(bug).length > 0 && (
                                <Button size="sm" variant="primary" icon={<ArrowRight className="w-3.5 h-3.5" />}
                                  onClick={() => { setSelectedBug(bug); setDevTransitionTarget(''); setDevFixVersion(bug.fixedVersion || ''); setDevRejectReason(''); setDevStatusErrors({}); setShowDevStatusModal(true); }}>
                                  تغییر وضعیت
                                </Button>
                              )}
                              {canRestoreBug(bug) && (
                                <Button size="sm" variant="secondary" icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={() => handleRestoreBugStatus(bug)} loading={actionLoading}>
                                  بازگردانی به {BUG_STATUS_LABELS[bug.previousStatus!]}
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" icon={<Eye className="w-3.5 h-3.5" />}
                                onClick={() => { setSelectedBug(bug); setShowBugDetailModal(true); }}>
                                جزئیات کامل
                              </Button>
                            </div>
                          )}
                          {getAvailableTransitions(bug).length === 0 && !canRestoreBug(bug) && (
                            <Button size="sm" variant="ghost" icon={<Eye className="w-3.5 h-3.5" />}
                              onClick={() => { setSelectedBug(bug); setShowBugDetailModal(true); }}>
                              مشاهده جزئیات
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-6">باگی برای این اجرا ثبت نشده است.</p>
                  )}
                </div>

                <div className="flex justify-between pt-4 border-t">
                  <Button variant="ghost" onClick={() => setRunDetailStep(1)}>← مرحله قبل</Button>
                  <Button variant="secondary" onClick={() => { setShowRunDetailModal(false); setRunDetailStep(1); }}>بستن</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ========== BUG DETAIL MODAL — Item #1: Full view ========== */}
      <Modal isOpen={showBugDetailModal} onClose={() => setShowBugDetailModal(false)} title="مشاهده جزئیات باگ" size="xl">
        {selectedBug && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3"><div className="p-2 bg-red-100 rounded-lg"><BugIcon className="w-6 h-6 text-red-600" /></div>
                <div><h3 className="text-lg font-semibold">{selectedBug.title}</h3><p className="text-sm text-gray-500">گزارش‌دهنده: {selectedBug.reportedBy?.fullName}</p></div></div>
              <div className="flex items-center gap-2">
                {selectedBug.isLocked && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                    <Lock className="w-3.5 h-3.5" />
                    قفل شده
                  </span>
                )}
                <StatusBadge status={selectedBug.status} labels={BUG_STATUS_LABELS} />
              </div>
            </div>
            {/* All fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <DetailField label="شناسه" value={selectedBug.id} icon={<Hash className="w-4 h-4" />} />
              <DetailField label="شدت" value={BUG_SEVERITY_LABELS[selectedBug.severity]} />
              <DetailField label="اولویت" value={PRIORITY_LABELS[selectedBug.priority]} />
              <DetailField label="وضعیت" value={BUG_STATUS_LABELS[selectedBug.status]} />
              <DetailField label="Developer" value={selectedBug.assignee?.fullName || 'تخصیص نیافته'} icon={<UserIcon className="w-4 h-4" />} />
              <DetailField label="نسخه رفع" value={selectedBug.fixedVersion || '-'} />
              <DetailField label="تاریخ ایجاد" value={new Date(selectedBug.createdAt).toLocaleString('fa-IR')} icon={<Clock className="w-4 h-4" />} />
              <DetailField label="قفل تصمیم انتشار" value={selectedBug.isLocked ? (selectedBug.lockedByVersionHistoryId || 'قفل شده') : 'باز'} icon={<Lock className="w-4 h-4" />} />
            </div>
            {selectedBug.isLocked && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                این Bug پس از تصمیم VersionHistory قفل شده است و برای تغییر نیاز به Unlock ممیزی‌شده دارد.
              </div>
            )}
            <div className="p-4 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500 mb-1">توضیحات</p><p className="text-sm whitespace-pre-wrap">{selectedBug.description}</p></div>
            {selectedBug.stepsToReproduce && <div className="p-4 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500 mb-1">مراحل بازتولید</p><p className="text-sm whitespace-pre-wrap">{selectedBug.stepsToReproduce}</p></div>}
            {selectedBug.expectedResult && <div className="p-4 bg-green-50 rounded-lg border border-green-200"><p className="text-xs text-gray-500 mb-1">نتیجه مورد انتظار</p><p className="text-sm">{selectedBug.expectedResult}</p></div>}
            {selectedBug.actualResult && <div className="p-4 bg-red-50 rounded-lg border border-red-200"><p className="text-xs text-gray-500 mb-1">نتیجه واقعی</p><p className="text-sm">{selectedBug.actualResult}</p></div>}
            {selectedBug.fixNotes && <div className="p-4 bg-blue-50 rounded-lg border border-blue-200"><p className="text-xs text-gray-500 mb-1">یادداشت رفع</p><p className="text-sm">{selectedBug.fixNotes}</p></div>}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Paperclip className="w-5 h-5 text-slate-500" />
                  پیوست‌های باگ
                </h4>
                <Badge variant="default" size="sm">{bugAttachments.length}</Badge>
              </div>
              {bugAttachmentsLoading ? (
                <div className="text-sm text-gray-500 py-3">در حال بارگذاری پیوست‌ها...</div>
              ) : bugAttachments.length === 0 ? (
                <div className="text-sm text-gray-500 py-3">پیوستی برای این باگ ثبت نشده است.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {bugAttachments.map(attachment => (
                    <div key={attachment.id} className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="p-2 bg-blue-50 rounded-md text-blue-600 flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate" title={attachment.fileName}>{attachment.fileName}</p>
                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                          <span>{ATTACHMENT_TYPE_LABELS[attachment.type]}</span>
                          <span>{formatFileSize(attachment.fileSize)}</span>
                          <span>{attachment.uploadedBy?.fullName || '-'}</span>
                          <span>{new Date(attachment.createdAt).toLocaleDateString('fa-IR')}</span>
                        </div>
                        <a
                          href={attachment.storagePath}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          مشاهده / دانلود
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Comments */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-blue-500" /> تاریخچه</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto mb-3">{bugComments.length === 0 ? <p className="text-sm text-gray-500">نظری نیست</p> : bugComments.map(c => (
                <div key={c.id} className={`p-3 rounded-lg ${c.content.includes('📤') ? 'bg-purple-50 border border-purple-200' : c.content.includes('✅') ? 'bg-green-50 border border-green-200' : c.content.includes('❌') ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  <div className="flex justify-between mb-1"><span className="text-sm font-medium">{c.author?.fullName}</span><span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString('fa-IR')}</span></div>
                  <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                </div>
              ))}</div>
              <div className="flex gap-2"><Input placeholder="نظر..." value={newComment} onChange={(e) => setNewComment(e.target.value)} /><Button onClick={handleAddComment} disabled={!newComment.trim() || actionLoading} loading={actionLoading}>ارسال</Button></div>
            </div>
            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              {getAvailableTransitions(selectedBug).length > 0 && <Button variant="primary" icon={<ArrowRight className="w-4 h-4" />} onClick={() => { setDevTransitionTarget(''); setDevFixVersion(selectedBug.fixedVersion || ''); setDevRejectReason(''); setDevStatusErrors({}); setShowDevStatusModal(true); }}>تغییر وضعیت</Button>}
              {canRestoreBug(selectedBug) && (
                <Button variant="secondary" icon={<RotateCcw className="w-4 h-4" />} onClick={() => handleRestoreBugStatus(selectedBug)} loading={actionLoading}>
                  بازگردانی به {BUG_STATUS_LABELS[selectedBug.previousStatus!]}
                </Button>
              )}
              {canAdminUnlock && selectedBug.isLocked && (
                <Button
                  variant="warning"
                  icon={<Unlock className="w-4 h-4" />}
                  onClick={() => openUnlockModal({ type: 'BUG', id: selectedBug.id, title: selectedBug.title })}
                >
                  Unlock
                </Button>
              )}
              {canRetestBug && !selectedBug.isLocked && selectedBug.status === 'RETEST_READY' && selectedOpenRetestTask && canStartRetestTask(selectedOpenRetestTask) && (
                <Button variant="primary" icon={<PlayCircle className="w-4 h-4" />} onClick={() => handleStartRetestTask(selectedOpenRetestTask)}>
                  شروع از Task بازآزمون
                </Button>
              )}
              {canRetestBug && role !== 'QA_LEAD' && !selectedBug.isLocked && selectedBug.status === 'RETEST_READY' && !selectedOpenRetestTask && <>
                <Button variant="primary" icon={<CheckCircle className="w-4 h-4" />} onClick={() => { setConfirmAction({ action: 'pass', message: 'Retest و Regression موفق؟' }); setShowConfirmModal(true); }}>موفق</Button>
                <Button variant="danger" icon={<XCircle className="w-4 h-4" />} onClick={() => { setConfirmAction({ action: 'fail', message: 'ناموفق؟' }); setShowConfirmModal(true); }}>ناموفق</Button>
              </>}
              {canRetestBug && role !== 'QA_LEAD' && !selectedBug.isLocked && selectedBug.status === 'RETEST_PASSED' && <Button onClick={() => { setConfirmAction({ action: 'close', message: 'بستن؟' }); setShowConfirmModal(true); }}>بستن باگ</Button>}
              <Button variant="secondary" onClick={() => setShowBugDetailModal(false)}>بستن</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Dev Status Modal */}
      <Modal isOpen={showDevStatusModal} onClose={() => setShowDevStatusModal(false)} title="تغییر وضعیت" size="lg">
        {selectedBug && <div className="space-y-5">
          <div className="p-4 bg-gray-50 rounded-lg border"><div className="flex justify-between"><h4 className="font-medium">{selectedBug.title}</h4><StatusBadge status={selectedBug.status} labels={BUG_STATUS_LABELS} /></div></div>
          <div className="space-y-2">{(isDeveloper ? (DEV_BUG_TRANSITIONS[selectedBug.status] || []) : (QA_BUG_TRANSITIONS[selectedBug.status] || [])).map(t => (
            <label key={t.value} className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer ${devTransitionTarget === t.value ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
              <input type="radio" name="tr" value={t.value} checked={devTransitionTarget === t.value} onChange={() => setDevTransitionTarget(t.value)} className="mt-1 w-4 h-4" />
              <div><p className="font-medium">{t.icon} {t.label}</p><p className="text-sm text-gray-500">{t.description}</p></div>
            </label>
          ))}</div>
          {devTransitionTarget === 'FIXED' && <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-3">
            <Input label="نسخه رفع *" placeholder="2.5.1" value={devFixVersion} onChange={(e) => handleDevFixVersionChange(e.target.value)} error={devStatusErrors.fixedVersion} />
            <Textarea label="یادداشت (اختیاری)" placeholder="توضیح..." value={devFixNotes} onChange={(e) => setDevFixNotes(e.target.value)} />
          </div>}
          {['REJECTED', 'NO_ACTION_NEEDED'].includes(devTransitionTarget) && (
            <Textarea
              label={devTransitionTarget === 'NO_ACTION_NEEDED' ? 'دلیل بدون نیاز به اقدام *' : 'دلیل باگ نبودن *'}
              placeholder={devTransitionTarget === 'NO_ACTION_NEEDED' ? 'چرا این مورد نیاز به اقدام توسعه ندارد؟' : 'چرا این مورد باگ نیست...'}
              value={devRejectReason}
              onChange={(e) => { clearDevStatusError('rejectReason'); setDevRejectReason(e.target.value); }}
              error={devStatusErrors.rejectReason}
            />
          )}
          {devTransitionTarget === 'ASSIGNED' && !isDeveloper && <Select label="تخصیص به *" value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)} options={developers.map(u => ({ value: u.id, label: u.fullName }))} placeholder="انتخاب" />}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowDevStatusModal(false)}>انصراف</Button>
            {devTransitionTarget === 'ASSIGNED' && !isDeveloper
              ? <Button onClick={async () => { if (!selectedAssignee) { toast.error('Developer انتخاب کنید.'); return; } await handleAssignBug(); setShowDevStatusModal(false); }} loading={actionLoading} disabled={!selectedAssignee || actionLoading}>تخصیص</Button>
              : <Button variant={devTransitionTarget === 'FIXED' ? 'primary' : 'primary'} onClick={handleDevStatusTransition} loading={actionLoading} disabled={!devTransitionTarget || actionLoading}
                  icon={devTransitionTarget === 'FIXED' ? <Send className="w-4 h-4" /> : undefined}>
                  {devTransitionTarget === 'FIXED' ? 'رفع و ارسال خودکار' : 'ذخیره'}
                </Button>}
          </div>
        </div>}
      </Modal>

      {/* Assign/Confirm Modals */}
      <Modal isOpen={showAssignBugModal} onClose={() => setShowAssignBugModal(false)} title="تخصیص" size="sm">
        <div className="space-y-4">
          <Select label="تخصیص به *" value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)} options={developers.map(u => ({ value: u.id, label: u.fullName }))} placeholder="انتخاب" />
          <div className="flex gap-3 justify-end"><Button variant="secondary" onClick={() => setShowAssignBugModal(false)}>انصراف</Button><Button onClick={handleAssignBug} loading={actionLoading} disabled={!selectedAssignee || actionLoading}>تخصیص</Button></div>
        </div>
      </Modal>
      <ConfirmModal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)}
        onConfirm={() => { if (confirmAction?.action === 'pass') handleRetestBug(true); else if (confirmAction?.action === 'fail') handleRetestBug(false); else if (confirmAction?.action === 'close') handleCloseBug(); }}
        title="تایید" message={confirmAction?.message || ''} variant={confirmAction?.action === 'fail' ? 'danger' : 'primary'} loading={actionLoading} />
      <Modal isOpen={showUnlockModal} onClose={() => setShowUnlockModal(false)} title="Unlock ممیزی‌شده" size="md">
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            Unlock فقط برای اصلاح اداری پس از تصمیم VersionHistory مجاز است و در Audit ثبت می‌شود.
          </div>
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <p className="text-gray-500">مورد انتخاب‌شده</p>
            <p className="font-medium text-gray-900">{unlockTarget?.title || '-'}</p>
          </div>
          <Textarea
            label="دلیل Unlock *"
            value={unlockReason}
            onChange={(e) => setUnlockReason(e.target.value)}
            placeholder="دلیل دقیق و قابل ممیزی را وارد کنید..."
          />
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowUnlockModal(false)}>انصراف</Button>
            <Button
              variant="warning"
              icon={<Unlock className="w-4 h-4" />}
              onClick={handleUnlock}
              loading={actionLoading}
              disabled={!unlockReason.trim() || actionLoading}
            >
              ثبت Unlock
            </Button>
          </div>
        </div>
      </Modal>
      {/* Delete Run Confirm */}
      <ConfirmModal isOpen={showDeleteRunConfirm} onClose={() => setShowDeleteRunConfirm(false)}
        onConfirm={handleDeleteRun} title="حذف اجرای تست"
        message={`آیا از حذف اجرای تست «${deleteRunTarget?.testCase?.title || ''}» اطمینان دارید؟`}
        variant="danger" confirmText="حذف" loading={actionLoading} />
    </div>
  );
};
