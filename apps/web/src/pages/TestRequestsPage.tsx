import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit, CheckCircle, XCircle, UserPlus, ChevronDown, ChevronUp, GitBranch, PlusCircle, Trash2 } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Table, Pagination } from '../components/ui/Table';
import { CartableExcelExportButton, CartableSearchInput, CartableSelectFilter } from '../components/ui/CartableToolbar';
import { StatusBadge, PriorityBadge } from '../components/ui/Badge';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Input, Textarea, Select } from '../components/ui/Input';
import { useAuthStore, canPerformAction } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import { useApplicationLookup } from '../utils/useApplicationLookup';
import { auditLogApi, testRequestApi, requirementApi, userApi, flowApi } from '../services/api';
import { toast } from '../components/ui/Toast';
import { isSemVer, SEMVER_HINT } from '../utils/semver';
import {
  BUILD_NUMBER_INPUT_HINT,
  isValidSystemUrl,
  sanitizeBuildNumberInput,
  sanitizeRequestTitleInput,
  sanitizeVersionInput,
  SYSTEM_URL_INPUT_HINT,
  validateRequestTitle,
} from '../utils/inputRules';
import type { TestRequest, User, Requirement, Flow, CartableFilterParams, PaginatedResponse, Priority, AuditLog } from '../types';
import { TEST_REQUEST_STATUS_LABELS, PRIORITY_LABELS, REQUIREMENT_STATUS_LABELS, QA_QUALITY_STATUS_LABELS, RELEASE_PUBLISH_STATUS_LABELS } from '../types';

interface OtherReqEntry {
  id: number;
  title: string;
  description: string;
  acceptanceCriteria: string;
  flows: Array<{ title: string; description: string }>;
}
let otherReqCounter = 1;

export const TestRequestsPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { appId, defaultApplicationId } = useDataScope();
  const { shouldShowSystemColumn, getApplicationName } = useApplicationLookup();
  const [data, setData] = useState<PaginatedResponse<TestRequest> | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CartableFilterParams>({ page: 1, limit: 10, search: '', status: '', sortBy: 'createdAt', sortOrder: 'desc' });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAcceptAssignModal, setShowAcceptAssignModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TestRequest | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ action: string; message: string } | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'history'>('info');
  const [requestAuditLogs, setRequestAuditLogs] = useState<AuditLog[]>([]);

  // Form — separate state per field to avoid focus loss
  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fVersion, setFVersion] = useState('');
  const [fBuild, setFBuild] = useState('');
  const [fUrl, setFUrl] = useState('');
  const [fEnv, setFEnv] = useState('development');
  const [fPriority, setFPriority] = useState<Priority>('MEDIUM');
  const [fRisk, setFRisk] = useState<Priority>('MEDIUM');
  // Item #4: Test request type multi-select
  const [fTestTypes, setFTestTypes] = useState<string[]>([]);

  const [availableReqs, setAvailableReqs] = useState<Requirement[]>([]);
  const [selectedReqIds, setSelectedReqIds] = useState<string[]>([]);
  const [expandedReqId, setExpandedReqId] = useState<string | null>(null);
  const [reqFlows, setReqFlows] = useState<Record<string, Flow[]>>({});
  const [otherReqs, setOtherReqs] = useState<OtherReqEntry[]>([]);

  const [qaSpecialists, setQaSpecialists] = useState<User[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const role = activeContext?.role;
  const isDeveloper = role === 'DEVELOPER';
  const isSystemAdmin = role === 'SYSTEM_ADMIN';
  const canCreate = canPerformAction(role!, 'test-request:create');
  const canReview = canPerformAction(role!, 'test-request:review');
  const canAssign = canPerformAction(role!, 'test-request:assign');

  useEffect(() => { if (activeContext) loadData(); }, [activeContext, filters]);
  useEffect(() => { if (activeContext) loadRequirements(); }, [activeContext, appId]);
  useEffect(() => { if (activeContext && (showAssignModal || showAcceptAssignModal)) loadQASpecialists(); }, [activeContext, showAssignModal, showAcceptAssignModal]);
  useEffect(() => {
    if (!selectedRequest || !showDetailModal) {
      setRequestAuditLogs([]);
      return;
    }
    auditLogApi
      .getByEntity('TEST_REQUEST', selectedRequest.id)
      .then(logs => setRequestAuditLogs(logs))
      .catch(() => setRequestAuditLogs([]));
  }, [selectedRequest?.id, showDetailModal]);
  useEffect(() => {
    if (expandedReqId && !reqFlows[expandedReqId]) {
      flowApi
        .getByRequirement(expandedReqId)
        .then(flows => setReqFlows(prev => ({ ...prev, [expandedReqId]: flows })))
        .catch(() => {
          setReqFlows(prev => ({ ...prev, [expandedReqId]: [] }));
          toast.error('خطا در بارگذاری جریان‌های نیازمندی.');
        });
    }
  }, [expandedReqId]);

  const loadRequirements = async () => {
    if (!activeContext) return;
    try { const r = await requirementApi.getAll(appId, { page: 1, limit: 200 }); setAvailableReqs(r.data); } catch { setAvailableReqs([]); toast.error('خطا در بارگذاری نیازمندی‌ها.'); }
  };
  const loadData = async () => {
    if (!activeContext) return; setLoading(true);
    try {
      const response = await testRequestApi.getVisibleForRole(appId, filters, activeContext.userId, activeContext.role);
      setData(response);
    } catch { setData(null); toast.error('خطا در بارگذاری درخواست‌های تست.'); } finally { setLoading(false); }
  };
  const loadQASpecialists = async () => { if (!activeContext) return; try { setQaSpecialists(await userApi.getQASpecialists(appId)); } catch { setQaSpecialists([]); toast.error('خطا در بارگذاری تسترها.'); } };

  const TEST_TYPE_OPTIONS = [
    { value: 'INITIAL', label: 'تست اولیه (Initial Test)' },
    { value: 'RETEST_REGRESSION', label: 'بازآزمون + رگرسیون (Retest + Regression)' },
    { value: 'SMOKE', label: 'تست دود (Smoke Test)' },
    { value: 'UAT', label: 'پذیرش کاربر (UAT)' },
    { value: 'EXPLORATORY', label: 'اکتشافی (Exploratory)' },
  ];

  const handleTitleChange = (value: string) => {
    const sanitized = sanitizeRequestTitleInput(value);
    setFTitle(sanitized.value);
    setFieldErrors(prev => ({ ...prev, title: sanitized.error || '' }));
  };

  const handleVersionChange = (value: string) => {
    const sanitized = sanitizeVersionInput(value);
    setFVersion(sanitized.value);
    setFieldErrors(prev => ({ ...prev, version: '' }));
  };

  const handleBuildChange = (value: string) => {
    const sanitized = sanitizeBuildNumberInput(value);
    setFBuild(sanitized.value);
    setFieldErrors(prev => ({ ...prev, buildNumber: sanitized.error || '' }));
  };

  const handleSystemUrlChange = (value: string) => {
    setFUrl(value);
    setFieldErrors(prev => ({ ...prev, systemUrl: '' }));
  };

  const addOtherRequirement = () => {
    setFieldErrors(prev => ({ ...prev, requirements: '' }));
    setOtherReqs([
      ...otherReqs,
      { id: otherReqCounter++, title: '', description: '', acceptanceCriteria: '', flows: [{ title: '', description: '' }] },
    ]);
  };

  const resetForm = () => {
    setFTitle(''); setFDesc(''); setFVersion(''); setFBuild(''); setFUrl(''); setFEnv('development'); setFPriority('MEDIUM'); setFRisk('MEDIUM'); setFTestTypes([]);
    setSelectedReqIds([]); setOtherReqs([]); setExpandedReqId(null); setActionError(''); otherReqCounter = 1;
    setFieldErrors({});
  };

  const fillFormFromRequest = (item: TestRequest) => {
    setFTitle(item.title); setFDesc(item.description || ''); setFVersion(item.version); setFBuild(item.buildNumber || '');
    setFUrl(item.systemUrl || ''); setFEnv(item.environment); setFPriority(item.priority); setFRisk(item.riskLevel); setActionError('');
    setFieldErrors({});
    setFTestTypes(item.testTypes || []);
    setSelectedReqIds(item.selectedRequirementIds || []);
  };

  const handleCreate = async () => {
    if (!activeContext) return;
    const errors: Record<string, string> = {};
    const titleError = validateRequestTitle(fTitle);
    if (titleError) errors.title = titleError;
    if (!fVersion.trim()) errors.version = 'نسخه الزامی است.';
    else if (!isSemVer(fVersion)) errors.version = SEMVER_HINT;
    if (sanitizeBuildNumberInput(fBuild).error) errors.buildNumber = BUILD_NUMBER_INPUT_HINT;
    if (!isValidSystemUrl(fUrl)) errors.systemUrl = SYSTEM_URL_INPUT_HINT;
    if (selectedReqIds.length === 0 && otherReqs.length === 0) errors.requirements = 'حداقل یک نیازمندی انتخاب یا اضافه کنید.';
    const selectedWithoutFlow = availableReqs.filter(req => selectedReqIds.includes(req.id) && (req.flows?.length || 0) === 0);
    if (selectedWithoutFlow.length > 0) errors.requirements = 'نیازمندی انتخاب‌شده باید حداقل یک جریان داشته باشد.';
    otherReqs.forEach((req, reqIndex) => {
      if (!req.title.trim()) errors[`otherReq-${req.id}-title`] = 'عنوان نیازمندی الزامی است.';
      if (!req.description.trim()) errors[`otherReq-${req.id}-description`] = 'توضیحات نیازمندی الزامی است.';
      if (req.flows.length === 0) errors[`otherReq-${req.id}-flows`] = 'حداقل یک جریان برای این نیازمندی الزامی است.';
      req.flows.forEach((flow, flowIndex) => {
        if (!flow.title.trim()) errors[`otherReq-${req.id}-flow-${flowIndex}-title`] = 'عنوان جریان الزامی است.';
        if (!flow.description.trim()) errors[`otherReq-${req.id}-flow-${flowIndex}-description`] = 'توضیحات جریان الزامی است.';
      });
      if (reqIndex === 0 && req.flows.length === 0) errors.requirements = 'برای هر نیازمندی جدید حداقل یک جریان ثبت کنید.';
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setActionLoading(true); setActionError('');
    try {
      const nr = await testRequestApi.create({ title: fTitle.trim(), description: fDesc.trim(), version: fVersion.trim(), buildNumber: fBuild.trim(), environment: fEnv, priority: fPriority, riskLevel: fRisk, systemUrl: fUrl.trim(), selectedRequirementIds: selectedReqIds, testTypes: fTestTypes }, activeContext.userId, defaultApplicationId);
      for (const or of otherReqs) {
        const createdReq = await requirementApi.create({ title: or.title.trim(), description: or.description.trim(), acceptanceCriteria: or.acceptanceCriteria.trim(), testRequestId: nr.id }, activeContext.userId, defaultApplicationId);
        for (const flow of or.flows) {
          await flowApi.create({ title: flow.title.trim(), description: flow.description.trim(), requirementId: createdReq.id }, activeContext.userId);
        }
      }
      setShowCreateModal(false); resetForm(); toast.success('درخواست تست ایجاد شد.');
      await loadRequirements();
      loadData();
    } catch { setActionError('خطا.'); } finally { setActionLoading(false); }
  };

  const handleUpdate = async () => {
    if (!activeContext || !selectedRequest) return;
    const errors: Record<string, string> = {};
    const titleError = validateRequestTitle(fTitle);
    if (titleError) errors.title = titleError;
    if (!fVersion.trim()) errors.version = 'نسخه الزامی است.';
    else if (!isSemVer(fVersion)) errors.version = SEMVER_HINT;
    if (sanitizeBuildNumberInput(fBuild).error) errors.buildNumber = BUILD_NUMBER_INPUT_HINT;
    if (!isValidSystemUrl(fUrl)) errors.systemUrl = SYSTEM_URL_INPUT_HINT;
    const selectedWithoutFlow = availableReqs.filter(req => selectedReqIds.includes(req.id) && (req.flows?.length || 0) === 0);
    if (selectedWithoutFlow.length > 0) errors.requirements = 'نیازمندی انتخاب‌شده باید حداقل یک جریان داشته باشد.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setActionLoading(true); setActionError('');
    try {
      await testRequestApi.update(selectedRequest.id, { title: fTitle.trim(), description: fDesc.trim(), version: fVersion.trim(), buildNumber: fBuild.trim(), environment: fEnv, priority: fPriority, riskLevel: fRisk, systemUrl: fUrl.trim(), testTypes: fTestTypes, selectedRequirementIds: selectedReqIds }, activeContext.userId);
      setShowEditModal(false); toast.success('بروزرسانی شد.'); loadData();
    } catch { setActionError('خطا.'); } finally { setActionLoading(false); }
  };

  const handleSubmit = async (req: TestRequest) => { if (!activeContext) return; setActionLoading(true); try { await testRequestApi.submit(req.id, activeContext.userId); setShowDetailModal(false); toast.success('ارسال شد.'); loadData(); } catch { toast.error('خطا.'); } finally { setActionLoading(false); } };
  const handleReview = async (d: 'ACCEPTED' | 'REJECTED') => { if (!activeContext || !selectedRequest) return; setActionLoading(true); try { await testRequestApi.review(selectedRequest.id, activeContext.userId, d); if (d === 'ACCEPTED' && selectedRequest.requirement) { try { await requirementApi.update(selectedRequest.requirement.id, { status: 'APPROVED' }, activeContext.userId); } catch { toast.warning('درخواست پذیرفته شد، اما تایید نیازمندی ثبت نشد.'); } } setShowConfirmModal(false); setShowDetailModal(false); toast.success(d === 'ACCEPTED' ? 'پذیرفته شد.' : 'رد شد.'); await loadRequirements(); loadData(); } catch { toast.error('خطا.'); } finally { setActionLoading(false); } };
  const handleAcceptAndAssign = async () => {
    if (!activeContext || !selectedRequest || !selectedAssignee) return;
    setActionLoading(true);
    try {
      const reviewed = await testRequestApi.review(selectedRequest.id, activeContext.userId, 'ACCEPTED');
      if (!reviewed) throw new Error('REVIEW_FAILED');
      if (selectedRequest.requirement) {
        try { await requirementApi.update(selectedRequest.requirement.id, { status: 'APPROVED' }, activeContext.userId); } catch { toast.warning('درخواست پذیرفته شد، اما تایید نیازمندی ثبت نشد.'); }
      }
      await testRequestApi.assign(selectedRequest.id, selectedAssignee, activeContext.userId);
      setShowAcceptAssignModal(false);
      setShowDetailModal(false);
      toast.success('درخواست پذیرفته و به تستر ارجاع شد.');
      await loadRequirements();
      loadData();
    } catch {
      toast.error('خطا در پذیرش یا انتخاب تستر.');
    } finally {
      setActionLoading(false);
    }
  };
  const handleAssign = async () => { if (!activeContext || !selectedRequest || !selectedAssignee) return; setActionLoading(true); try { await testRequestApi.assign(selectedRequest.id, selectedAssignee, activeContext.userId); setShowAssignModal(false); setShowDetailModal(false); toast.success('تستر بروزرسانی شد.'); loadData(); } catch { toast.error('خطا.'); } finally { setActionLoading(false); } };
  const handleCancel = async () => { if (!activeContext || !selectedRequest) return; setActionLoading(true); try { await testRequestApi.cancel(selectedRequest.id, activeContext.userId); setShowConfirmModal(false); setShowDetailModal(false); toast.success('لغو شد.'); loadData(); } catch { toast.error('خطا.'); } finally { setActionLoading(false); } };
  const openConfirmModal = (a: string, m: string) => { setConfirmAction({ action: a, message: m }); setShowConfirmModal(true); };
  const execConfirm = () => { if (!confirmAction) return; if (confirmAction.action === 'accept') handleReview('ACCEPTED'); else if (confirmAction.action === 'reject') handleReview('REJECTED'); else if (confirmAction.action === 'cancel') handleCancel(); };

  if (!activeContext) return null;

  const envLabels: Record<string, string> = { development: 'توسعه', staging: 'آزمایشی', production: 'تولید' };
  const selectableRequirements = availableReqs.filter(req => req.status !== 'DRAFT' || selectedReqIds.includes(req.id));
  const selectedRequirementList = selectedRequest?.selectedRequirementIds
    ? availableReqs.filter(req => selectedRequest.selectedRequirementIds!.includes(req.id))
    : [];
  const auditActionLabels: Record<string, string> = {
    CREATE: 'ایجاد',
    UPDATE: 'ویرایش',
    SUBMIT: 'ارسال',
    REVIEW: 'بررسی',
    ASSIGN: 'ارجاع',
    CANCEL: 'لغو',
  };
  const renderAuditSummary = (log: AuditLog) => {
    if (log.action === 'UPDATE') return 'ویرایش اطلاعات درخواست';
    if (log.action === 'SUBMIT') return 'ارسال درخواست';
    if (log.action === 'REVIEW') return 'بررسی درخواست';
    if (log.action === 'ASSIGN') return 'ارجاع درخواست';
    if (log.action === 'CANCEL') return 'لغو درخواست';
    return auditActionLabels[log.action] || log.action;
  };

  const columns = [
    { key: 'title', title: 'عنوان', sortable: true, render: (item: TestRequest) => <div><p className="font-medium text-gray-900">{item.title}</p><p className="text-xs text-gray-500 mt-0.5">نسخه: {item.version}</p></div> },
    ...((isSystemAdmin || shouldShowSystemColumn) ? [{ key: 'applicationId', title: 'سامانه', render: (item: TestRequest) => <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{getApplicationName(item.applicationId)}</span> }] : []),
    { key: 'status', title: 'وضعیت', render: (item: TestRequest) => <StatusBadge status={item.status} labels={TEST_REQUEST_STATUS_LABELS} /> },
    { key: 'releaseDecision', title: 'تصمیم انتشار', render: (item: TestRequest) => item.releaseDecision ? <StatusBadge status={item.releaseDecision} labels={RELEASE_PUBLISH_STATUS_LABELS} /> : <span className="text-gray-400">-</span> },
    { key: 'priority', title: 'اولویت', render: (item: TestRequest) => <PriorityBadge priority={item.priority} /> },
    { key: 'requester', title: 'درخواست‌دهنده', render: (item: TestRequest) => item.requester?.fullName || '-' },
    { key: 'assignee', title: 'تستر', render: (item: TestRequest) => item.assignee?.fullName || '-' },
    { key: 'date', title: 'تاریخ', sortable: true, render: (item: TestRequest) => new Date(item.createdAt).toLocaleDateString('fa-IR') },
    { key: 'actions', title: 'عملیات', render: (item: TestRequest) => (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" icon={<Eye className="w-4 h-4" />} onClick={(e) => { e.stopPropagation(); setSelectedRequest(item); setDetailTab('info'); setShowDetailModal(true); }}>مشاهده</Button>
        {isDeveloper && item.requesterId === activeContext?.userId && ['DRAFT', 'SUBMITTED'].includes(item.status) && (
          <Button size="sm" variant="ghost" icon={<Edit className="w-4 h-4" />} onClick={(e) => { e.stopPropagation(); setSelectedRequest(item); fillFormFromRequest(item); setShowEditModal(true); }}>ویرایش</Button>
        )}
      </div>
    )},
  ];

  // Toggle test type multi-select
  const toggleTestType = (val: string) => setFTestTypes(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  // Inline form fields JSX — NOT a component, to prevent focus loss
  const formFieldsJSX = (
    <div className="space-y-4">
      <Input label="عنوان درخواست *" value={fTitle} onChange={(e) => handleTitleChange(e.target.value)} placeholder="عنوان درخواست تست" error={fieldErrors.title} />
      <Textarea label="توضیحات" value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder="توضیحات" />
      <div className="grid grid-cols-2 gap-4">
        <Input label="نسخه *" value={fVersion} onChange={(e) => handleVersionChange(e.target.value)} placeholder="مثال: 2.5.0" error={fieldErrors.version} />
        <Input label="شماره بیلد" value={fBuild} onChange={(e) => handleBuildChange(e.target.value)} placeholder="مثال: build-1234" error={fieldErrors.buildNumber} />
      </div>
      <Input label="آدرس سامانه" value={fUrl} onChange={(e) => handleSystemUrlChange(e.target.value)} placeholder="https://app.example.com" error={fieldErrors.systemUrl} />
      <div className="grid grid-cols-3 gap-4">
        <Select label="محیط" value={fEnv} onChange={(e) => setFEnv(e.target.value)} options={[{ value: 'development', label: 'توسعه' }, { value: 'staging', label: 'آزمایشی' }, { value: 'production', label: 'تولید' }]} />
        <Select label="اولویت" value={fPriority} onChange={(e) => setFPriority(e.target.value as Priority)} options={Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
        <Select label="سطح ریسک" value={fRisk} onChange={(e) => setFRisk(e.target.value as Priority)} options={Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
      </div>
      {/* Item #4: Test request type multi-select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">نوع درخواست تست (مولتی‌سلکت)</label>
        <div className="flex flex-wrap gap-2">
          {TEST_TYPE_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => toggleTestType(opt.value)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-all ${fTestTypes.includes(opt.value) ? 'bg-blue-100 border-blue-300 text-blue-700 font-medium' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {fTestTypes.includes(opt.value) && '✓ '}{opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Requirement accordion inline JSX for detail modal (Item #2, #10)
  const renderReqAccordion = (req: Requirement) => {
    const isExp = expandedReqId === req.id;
    const flows = reqFlows[req.id] || [];
    return (
      <div key={req.id} className="border rounded-lg overflow-hidden">
        <button onClick={() => setExpandedReqId(isExp ? null : req.id)} className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 text-right">
          <div className="flex items-center gap-2 flex-1"><span className="text-sm font-medium text-blue-800">{req.title}</span><StatusBadge status={req.status} labels={REQUIREMENT_STATUS_LABELS} /></div>
          {isExp ? <ChevronUp className="w-4 h-4 text-blue-500" /> : <ChevronDown className="w-4 h-4 text-blue-500" />}
        </button>
        {isExp && (
          <div className="p-3 bg-white border-t space-y-2 text-sm">
            {req.description && <div><p className="text-xs text-gray-500">توضیحات</p><p>{req.description}</p></div>}
            {req.acceptanceCriteria && <div className="p-2 bg-green-50 rounded border border-green-200"><p className="text-xs text-gray-500">معیارهای پذیرش</p><p className="whitespace-pre-wrap">{req.acceptanceCriteria}</p></div>}
            {req.riskNotes && <div className="p-2 bg-amber-50 rounded border border-amber-200"><p className="text-xs text-gray-500">ریسک</p><p>{req.riskNotes}</p></div>}
            {flows.length > 0 && <div><p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><GitBranch className="w-3.5 h-3.5 text-purple-500" /> جریان‌ها ({flows.length})</p>
              {flows.map(f => <div key={f.id} className="p-2 bg-purple-50 rounded border border-purple-200 mb-1"><p className="font-medium text-purple-800 text-xs">{f.title}</p>{f.description && <p className="text-xs text-purple-600 mt-0.5">{f.description}</p>}</div>)}
            </div>}
            {flows.length === 0 && <p className="text-xs text-gray-400">جریانی ثبت نشده</p>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="کارتابل درخواست‌های تست" subtitle={`${data?.total || 0} درخواست`} onRefresh={loadData} refreshing={loading} />
      <main className="p-6">
        <Card className="mb-6" padding="sm">
          <div className="flex flex-wrap gap-4 items-center">
            {canCreate && <Button icon={<Plus className="w-4 h-4" />} onClick={() => { resetForm(); setShowCreateModal(true); }}>درخواست جدید</Button>}
            <CartableExcelExportButton
              data={data?.data || []}
              columns={[
                { key: 'title', title: 'عنوان' }, { key: 'version', title: 'نسخه' },
                { key: 'status', title: 'وضعیت' }, { key: 'priority', title: 'اولویت' },
              ]}
              filename="test-requests"
              disabled={!data?.data?.length}
            />
            <CartableSearchInput
              value={filters.search || ''}
              onChange={(search) => setFilters({ ...filters, search, page: 1 })}
            />
            <CartableSelectFilter
              value={filters.status || ''}
              onChange={(status) => setFilters({ ...filters, status, page: 1 })}
              options={Object.entries(TEST_REQUEST_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <CartableSelectFilter
              value={filters.priority || ''}
              onChange={(priority) => setFilters({ ...filters, priority: priority ? priority as Priority : undefined, page: 1 })}
              options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
              allLabel="همه اولویت‌ها"
              ariaLabel="فیلتر اولویت"
            />
          </div>
        </Card>
        <Table columns={columns} data={data?.data || []} loading={loading} emptyMessage="درخواست تستی یافت نشد" sortBy={filters.sortBy} sortOrder={filters.sortOrder}
          onSort={(key) => setFilters({ ...filters, sortBy: key, sortOrder: filters.sortBy === key && filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
          onRowClick={(item) => { setSelectedRequest(item); setDetailTab('info'); setShowDetailModal(true); }}
          enableClientFilter={false}
          enableExport={false}
          enableColumnChooser={false} />
        {data && <Pagination page={data.page} totalPages={data.totalPages || 1} total={data.total} limit={data.limit || filters.limit}
          onPageChange={(p) => setFilters({ ...filters, page: p })}
          onLimitChange={(l) => setFilters({ ...filters, limit: l, page: 1 })} />}
      </main>

      {/* CREATE */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="ایجاد درخواست تست جدید" size="xl">
        <div className="space-y-4">
          {formFieldsJSX}
          <div><label className="block text-sm font-medium text-gray-700 mb-2">نیازمندی‌های مرتبط <span className="text-red-500">*</span></label>
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-2">
              {selectableRequirements.map(req => <div key={req.id}>
                <label className={`flex items-center gap-2 p-2 rounded cursor-pointer ${selectedReqIds.includes(req.id) ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={selectedReqIds.includes(req.id)} onChange={() => { setFieldErrors(prev => ({ ...prev, requirements: '' })); setSelectedReqIds(prev => prev.includes(req.id) ? prev.filter(id => id !== req.id) : [...prev, req.id]); }} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  <span className="text-sm text-gray-900 flex-1">{req.title}</span>
                  <button onClick={(e) => { e.preventDefault(); setExpandedReqId(expandedReqId === req.id ? null : req.id); }} className="text-blue-500"><ChevronDown className="w-4 h-4" /></button>
                </label>
                {expandedReqId === req.id && <div className="mr-6 mt-1 p-2 bg-blue-50 rounded text-xs space-y-1">{req.description && <p>{req.description}</p>}{req.acceptanceCriteria && <p className="text-green-700">معیارها: {req.acceptanceCriteria}</p>}{(reqFlows[req.id]||[]).map(f=><div key={f.id} className="p-1 bg-purple-50 rounded"><span className="text-purple-700">{f.title}</span></div>)}</div>}
              </div>)}
              {selectableRequirements.length === 0 && <p className="text-sm text-gray-500 text-center py-2">نیازمندی فعالی نیست</p>}
            </div>
            {fieldErrors.requirements && <p className="mt-1 text-sm text-red-600">{fieldErrors.requirements}</p>}
          </div>
          <div className="border-t pt-4"><div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-amber-800">سایر نیازمندی‌ها ({otherReqs.length})</span>
            <Button size="sm" variant="secondary" icon={<PlusCircle className="w-3.5 h-3.5" />} onClick={addOtherRequirement}>افزودن نیازمندی</Button></div>
            {otherReqs.map((or, idx) => <div key={or.id} className="p-3 bg-amber-50 rounded-lg border border-amber-200 mb-2 space-y-2">
              <div className="flex items-center justify-between"><span className="text-sm font-medium text-amber-800">نیازمندی {idx+1}</span><button onClick={() => setOtherReqs(otherReqs.filter(r => r.id !== or.id))} className="text-red-500 text-xs"><Trash2 className="w-3 h-3 inline" /> حذف</button></div>
              <Input label="عنوان *" value={or.title} onChange={(e) => { const n=[...otherReqs]; if (!n[idx]) return; n[idx].title=e.target.value; setOtherReqs(n); setFieldErrors(prev => ({ ...prev, [`otherReq-${or.id}-title`]: '' })); }} placeholder="عنوان" error={fieldErrors[`otherReq-${or.id}-title`]} />
              <Textarea label="توضیحات *" value={or.description} onChange={(e) => { const n=[...otherReqs]; if (!n[idx]) return; n[idx].description=e.target.value; setOtherReqs(n); setFieldErrors(prev => ({ ...prev, [`otherReq-${or.id}-description`]: '' })); }} placeholder="توضیحات نیازمندی" error={fieldErrors[`otherReq-${or.id}-description`]} />
              <div className="pt-2 border-t border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-amber-800">جریان‌ها ({or.flows.length})</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<GitBranch className="w-3.5 h-3.5" />}
                    onClick={() => {
                      const n = [...otherReqs];
                      if (!n[idx]) return;
                      n[idx].flows = [...n[idx].flows, { title: '', description: '' }];
                      setOtherReqs(n);
                      setFieldErrors(prev => ({ ...prev, [`otherReq-${or.id}-flows`]: '' }));
                    }}
                  >
                    افزودن جریان
                  </Button>
                </div>
                {fieldErrors[`otherReq-${or.id}-flows`] && <p className="text-sm text-red-600 mb-2">{fieldErrors[`otherReq-${or.id}-flows`]}</p>}
                {or.flows.map((flow, flowIndex) => (
                  <div key={flowIndex} className="p-2 bg-white rounded border border-amber-100 mb-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">جریان {flowIndex + 1}</span>
                      {or.flows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const n = [...otherReqs];
                            if (!n[idx]) return;
                            n[idx].flows = n[idx].flows.filter((_, i) => i !== flowIndex);
                            setOtherReqs(n);
                          }}
                          className="text-xs text-red-500"
                        >
                          حذف
                        </button>
                      )}
                    </div>
                    <Input
                      label="عنوان جریان *"
                      value={flow.title}
                      onChange={(e) => {
                        const n = [...otherReqs];
                        if (!n[idx]?.flows[flowIndex]) return;
                        n[idx].flows[flowIndex].title = e.target.value;
                        setOtherReqs(n);
                        setFieldErrors(prev => ({ ...prev, [`otherReq-${or.id}-flow-${flowIndex}-title`]: '' }));
                      }}
                      error={fieldErrors[`otherReq-${or.id}-flow-${flowIndex}-title`]}
                    />
                    <Textarea
                      label="توضیحات جریان *"
                      value={flow.description}
                      onChange={(e) => {
                        const n = [...otherReqs];
                        if (!n[idx]?.flows[flowIndex]) return;
                        n[idx].flows[flowIndex].description = e.target.value;
                        setOtherReqs(n);
                        setFieldErrors(prev => ({ ...prev, [`otherReq-${or.id}-flow-${flowIndex}-description`]: '' }));
                      }}
                      error={fieldErrors[`otherReq-${or.id}-flow-${flowIndex}-description`]}
                    />
                  </div>
                ))}
              </div>
            </div>)}
          </div>
          {actionError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{actionError}</div>}
          <div className="flex gap-3 justify-end pt-4"><Button variant="secondary" onClick={() => setShowCreateModal(false)}>انصراف</Button><Button onClick={handleCreate} loading={actionLoading} disabled={actionLoading}>ایجاد</Button></div>
        </div>
      </Modal>

      {/* EDIT — with requirements selection */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="ویرایش درخواست تست" size="xl">
        <div className="space-y-4">
          {formFieldsJSX}

          {/* Requirements selection — same as create */}
          <div><label className="block text-sm font-medium text-gray-700 mb-2">نیازمندی‌های مرتبط</label>
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-2">
              {selectableRequirements.map(req => <div key={req.id}>
                <label className={`flex items-center gap-2 p-2 rounded cursor-pointer ${selectedReqIds.includes(req.id) ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={selectedReqIds.includes(req.id)} onChange={() => { setFieldErrors(prev => ({ ...prev, requirements: '' })); setSelectedReqIds(prev => prev.includes(req.id) ? prev.filter(id => id !== req.id) : [...prev, req.id]); }} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  <span className="text-sm text-gray-900 flex-1">{req.title}</span>
                  <button onClick={(e) => { e.preventDefault(); setExpandedReqId(expandedReqId === req.id ? null : req.id); }} className="text-blue-500"><ChevronDown className="w-4 h-4" /></button>
                </label>
                {expandedReqId === req.id && <div className="mr-6 mt-1 p-2 bg-blue-50 rounded text-xs space-y-1">{req.description && <p>{req.description}</p>}{req.acceptanceCriteria && <p className="text-green-700">معیارها: {req.acceptanceCriteria}</p>}{(reqFlows[req.id]||[]).map(f=><div key={f.id} className="p-1 bg-purple-50 rounded"><span className="text-purple-700">{f.title}</span></div>)}</div>}
              </div>)}
              {selectableRequirements.length === 0 && <p className="text-sm text-gray-500 text-center py-2">نیازمندی فعالی نیست</p>}
            </div>
          </div>

          {actionError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{actionError}</div>}
          <div className="flex gap-3 justify-end pt-4"><Button variant="secondary" onClick={() => setShowEditModal(false)}>انصراف</Button><Button onClick={handleUpdate} loading={actionLoading} disabled={actionLoading}>ذخیره</Button></div>
        </div>
      </Modal>

      {/* DETAIL */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="جزئیات درخواست تست" size="xl">
        {selectedRequest && <div className="space-y-5">
          <div className="flex border-b"><button onClick={() => setDetailTab('info')} className={`px-4 py-2 text-sm font-medium border-b-2 ${detailTab === 'info' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>اطلاعات</button>
            <button onClick={() => setDetailTab('history')} className={`px-4 py-2 text-sm font-medium border-b-2 ${detailTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>تاریخچه</button></div>
          {detailTab === 'info' && <>
            <div className="flex items-start justify-between"><div><h3 className="text-lg font-semibold text-gray-900">{selectedRequest.title}</h3>{selectedRequest.description && <p className="text-sm text-gray-500 mt-1">{selectedRequest.description}</p>}</div><StatusBadge status={selectedRequest.status} labels={TEST_REQUEST_STATUS_LABELS} /></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div><p className="text-xs text-gray-500">نسخه</p><p className="font-medium">{selectedRequest.version}</p></div>
              <div><p className="text-xs text-gray-500">شماره بیلد</p><p className="font-medium">{selectedRequest.buildNumber || '-'}</p></div>
              <div><p className="text-xs text-gray-500">محیط</p><p className="font-medium">{envLabels[selectedRequest.environment] || selectedRequest.environment}</p></div>
              <div><p className="text-xs text-gray-500">اولویت</p><PriorityBadge priority={selectedRequest.priority} /></div>
              <div><p className="text-xs text-gray-500">سطح ریسک</p><PriorityBadge priority={selectedRequest.riskLevel} /></div>
              <div><p className="text-xs text-gray-500">درخواست‌دهنده</p><p className="font-medium">{selectedRequest.requester?.fullName}</p></div>
              <div><p className="text-xs text-gray-500">تستر</p><p className="font-medium">{selectedRequest.assignee?.fullName || '-'}</p></div>
              <div><p className="text-xs text-gray-500">تاریخ</p><p className="font-medium">{new Date(selectedRequest.createdAt).toLocaleDateString('fa-IR')}</p></div>
              {/* آدرس سامانه */}
              <div className="col-span-2"><p className="text-xs text-gray-500">آدرس سامانه</p><p className="font-medium text-blue-600">{selectedRequest.systemUrl || '-'}</p></div>
            </div>

            {(selectedRequest.qaQualityStatus || selectedRequest.releaseDecision) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedRequest.qaQualityStatus && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-900">نظر QA روی Primary Request</p>
                      <StatusBadge status={selectedRequest.qaQualityStatus} labels={QA_QUALITY_STATUS_LABELS} />
                    </div>
                    {selectedRequest.qaQualityNotes && <p className="text-sm text-gray-700">{selectedRequest.qaQualityNotes}</p>}
                  </div>
                )}
                {selectedRequest.releaseDecision && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-900">تصمیم نهایی انتشار</p>
                      <StatusBadge status={selectedRequest.releaseDecision} labels={RELEASE_PUBLISH_STATUS_LABELS} />
                    </div>
                    {selectedRequest.releaseDecisionReason && <p className="text-sm text-gray-700">{selectedRequest.releaseDecisionReason}</p>}
                  </div>
                )}
              </div>
            )}

            {/* نیازمندی‌های انتخاب شده */}
            {selectedRequirementList.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">نیازمندی‌های انتخاب شده:</p>
                <div className="space-y-2">
                  {selectedRequirementList.map(req => renderReqAccordion(req))}
                </div>
              </div>
            )}

            {selectedRequest.requirement && <div><p className="text-sm font-medium text-gray-700 mb-2">نیازمندی ایجاد شده:</p>{renderReqAccordion(selectedRequest.requirement)}</div>}
            {selectedRequest.reviewNotes && <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500 mb-1">یادداشت بررسی</p><p className="text-sm">{selectedRequest.reviewNotes}</p></div>}
          </>}
          {detailTab === 'history' && <div className="space-y-2">
            {requestAuditLogs.length === 0 && (
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-500">تاریخچه‌ای ثبت نشده است.</div>
            )}
            {requestAuditLogs.map(log => (
              <div key={log.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-gray-900">{renderAuditSummary(log)}</span>
                  <span className="text-gray-500">{new Date(log.createdAt).toLocaleString('fa-IR')}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">کاربر: {log.user?.fullName || log.userId}</p>
              </div>
            ))}
          </div>}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            {selectedRequest.status === 'DRAFT' && selectedRequest.requesterId === activeContext?.userId && <Button onClick={() => handleSubmit(selectedRequest)} loading={actionLoading}>ارسال</Button>}
            {canReview && selectedRequest.status === 'SUBMITTED' && <><Button variant="primary" icon={<CheckCircle className="w-4 h-4" />} onClick={() => { setSelectedAssignee(selectedRequest.assigneeId || ''); setShowAcceptAssignModal(true); }}>پذیرش</Button><Button variant="danger" icon={<XCircle className="w-4 h-4" />} onClick={() => openConfirmModal('reject','رد؟')}>رد</Button></>}
            {canAssign && ['ACCEPTED','IN_PROGRESS'].includes(selectedRequest.status) && <Button variant="secondary" icon={<UserPlus className="w-4 h-4" />} onClick={() => { setSelectedAssignee(selectedRequest.assigneeId || ''); setShowAssignModal(true); }}>ویرایش تستر</Button>}
            {(selectedRequest.requesterId === activeContext?.userId || canReview) && !['COMPLETED','CANCELLED'].includes(selectedRequest.status) && <Button variant="ghost" onClick={() => openConfirmModal('cancel','لغو؟')}>لغو</Button>}
            <Button variant="secondary" onClick={() => setShowDetailModal(false)}>بستن</Button>
          </div>
        </div>}
      </Modal>

      <Modal isOpen={showAcceptAssignModal} onClose={() => setShowAcceptAssignModal(false)} title="پذیرش درخواست و انتخاب تستر" size="sm">
        <div className="space-y-4">
          <Select label="تستر *" value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)} options={qaSpecialists.map(u => ({ value: u.id, label: u.fullName }))} placeholder="انتخاب تستر" />
          <div className="flex gap-3 justify-end"><Button variant="secondary" onClick={() => setShowAcceptAssignModal(false)}>انصراف</Button><Button onClick={handleAcceptAndAssign} loading={actionLoading} disabled={!selectedAssignee || actionLoading}>پذیرش و ارجاع</Button></div>
        </div>
      </Modal>

      <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title="ویرایش تستر" size="sm">
        <div className="space-y-4"><Select label="تستر" value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)} options={qaSpecialists.map(u => ({ value: u.id, label: u.fullName }))} placeholder="انتخاب تستر" />
          <div className="flex gap-3 justify-end"><Button variant="secondary" onClick={() => setShowAssignModal(false)}>انصراف</Button><Button onClick={handleAssign} loading={actionLoading} disabled={!selectedAssignee || actionLoading}>ذخیره تستر</Button></div></div>
      </Modal>

      <ConfirmModal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} onConfirm={execConfirm} title="تایید" message={confirmAction?.message || ''}
        variant={confirmAction?.action === 'reject' || confirmAction?.action === 'cancel' ? 'danger' : 'primary'} loading={actionLoading} />
    </div>
  );
};
