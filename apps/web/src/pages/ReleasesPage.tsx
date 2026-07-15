import React, { useState, useEffect } from 'react';
import { 
  Plus, Eye, CheckCircle, AlertTriangle, 
  Rocket, Search, Clock, Shield, Activity
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { Table, Pagination } from '../components/ui/Table';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Textarea, Select } from '../components/ui/Input';
import { useAuthStore, canPerformWorkflowAction, getWorkflowPolicyForContext } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import { useApplicationLookup } from '../utils/useApplicationLookup';
import { releasePublishApi, commentApi, testRequestApi } from '../services/api';
import { toast } from '../components/ui/Toast';
import type { ReleasePublish, Bug, Comment, TestRequest, VersionHistoryEvidence, CartableFilterParams, PaginatedResponse, QAQualityStatus, VersionHistoryDecision } from '../types';
import { 
  RELEASE_PUBLISH_STATUS_LABELS, 
  QA_QUALITY_STATUS_LABELS,
  BUG_SEVERITY_LABELS,
  TEST_RUN_STATUS_LABELS,
  PRIORITY_LABELS,
  TEST_REQUEST_STATUS_LABELS
} from '../types';

export const ReleasesPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { appId, defaultApplicationId } = useDataScope();
  const { shouldShowSystemColumn, getApplicationName } = useApplicationLookup();
  const [data, setData] = useState<PaginatedResponse<ReleasePublish> | null>(null);
  const [developerRequests, setDeveloperRequests] = useState<TestRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CartableFilterParams>({
    page: 1,
    limit: 10,
    search: '',
    status: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showQAReviewModal, setShowQAReviewModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<ReleasePublish | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    primaryTestRequestId: '',
    relatedRequestIds: [] as string[],
  });
  const [eligibleRequests, setEligibleRequests] = useState<TestRequest[]>([]);
  const [primaryRequestTitles, setPrimaryRequestTitles] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [qaQualityStatus, setQaQualityStatus] = useState<QAQualityStatus | ''>('');
  const [qaQualityNotes, setQaQualityNotes] = useState('');
  const [decision, setDecision] = useState<VersionHistoryDecision | ''>('');
  const [decisionReason, setDecisionReason] = useState('');
  const [emergencyReason, setEmergencyReason] = useState('');
  const [riskDescription, setRiskDescription] = useState('');
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [criticalBugs, setCriticalBugs] = useState<Bug[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [evidence, setEvidence] = useState<VersionHistoryEvidence | null>(null);
  const [evidenceModalTitle, setEvidenceModalTitle] = useState('');
  const [evidenceModalItems, setEvidenceModalItems] = useState<Array<{ id: string; title: string; subtitle?: string; status?: string }>>([]);
  const [newComment, setNewComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (activeContext) {
      if (activeContext.role === 'DEVELOPER') loadDeveloperReleaseRequests();
      else loadData();
    }
  }, [activeContext, filters]);

  useEffect(() => {
    if (selectedRelease && showDetailModal) {
      setEvidence(null);
      setCriticalBugs([]);
      setComments([]);
      loadReleaseDetails();
    }
  }, [selectedRelease, showDetailModal]);

  useEffect(() => {
    if (activeContext && showCreateModal) {
      loadEligibleRequests();
    }
  }, [activeContext, showCreateModal, appId]);

  const loadData = async () => {
    if (!activeContext) return;
    setLoading(true);
    try {
      const [response, requests] = await Promise.all([
        releasePublishApi.getAll(appId, filters),
        releasePublishApi.getPrimaryRequestCandidates(appId),
      ]);
      setData(response);
      setPrimaryRequestTitles(Object.fromEntries(requests.map(request => [request.id, request.title])));
    } catch {
      setData(null);
      setPrimaryRequestTitles({});
      toast.error('خطا در بارگذاری نسخه‌ها.');
    } finally {
      setLoading(false);
    }
  };

  const loadDeveloperReleaseRequests = async () => {
    if (!activeContext) return;
    setLoading(true);
    try {
      const response = await testRequestApi.getVisibleForRole(
        appId,
        { ...filters, limit: 500 },
        activeContext.userId,
        activeContext.role
      );
      setDeveloperRequests(response.data);
    } catch {
      setDeveloperRequests([]);
      toast.error('خطا در بارگذاری وضعیت انتشار درخواست‌های شما');
    } finally {
      setLoading(false);
    }
  };

  const loadEligibleRequests = async () => {
    if (!activeContext) return;
    try {
      const requests = await releasePublishApi.getPrimaryRequestCandidates(appId);
      setEligibleRequests(requests.filter(req =>
        canPerformWorkflowAction(activeContext, 'versionHistory:create', req.applicationId)
      ));
    } catch {
      setEligibleRequests([]);
      toast.error('خطا در بارگذاری درخواست‌ها');
    }
  };

  const loadReleaseDetails = async () => {
    if (!selectedRelease || !activeContext) return;
    try {
      const [bugs, vhComments, legacyComments, releaseEvidence] = await Promise.all([
        releasePublishApi.getCriticalOpenBugs(selectedRelease.id),
        commentApi.getByEntity('VERSION_HISTORY', selectedRelease.id),
        commentApi.getByEntity('RELEASE_PUBLISH', selectedRelease.id),
        releasePublishApi.getEvidence(selectedRelease.id),
      ]);
      setCriticalBugs(bugs);
      setComments([
        ...vhComments,
        ...legacyComments.filter(c => !vhComments.some(vh => vh.id === c.id)),
      ]);
      setEvidence(releaseEvidence);
    } catch {
      setCriticalBugs([]);
      setComments([]);
      setEvidence(null);
      toast.error('خطا در بارگذاری جزئیات انتشار.');
    }
  };

  const handleCreate = async (primaryTestRequestId = formData.primaryTestRequestId) => {
    if (!activeContext) return;
    const primaryRequest = eligibleRequests.find(r => r.id === primaryTestRequestId);
    if (!primaryRequest) {
      setFormError('انتخاب Primary Test Request الزامی است.');
      setFieldErrors({ primaryTestRequestId: 'انتخاب درخواست تست الزامی است.' });
      return;
    }
    setActionLoading(true);
    setFormError('');
    try {
      const existing = await releasePublishApi.getByPrimaryTestRequest(primaryTestRequestId);
      if (existing) {
        setShowCreateModal(false);
        resetForm();
        setSelectedRelease(existing);
        setShowDetailModal(true);
        toast.info('برای این درخواست تست قبلا VersionHistory ثبت شده است.');
        return;
      }
      const created = await releasePublishApi.create(
        {
          primaryTestRequestId,
          relatedRequestIds: [],
        },
        activeContext.userId,
        primaryRequest.applicationId || defaultApplicationId,
        activeContext.role
      );
      setShowCreateModal(false);
      resetForm();
      setSelectedRelease(created);
      setShowDetailModal(true);
      toast.success('انتشار جدید ایجاد شد.');
      loadData();
    } catch {
      setFormError('ایجاد انتشار ناموفق بود. وضعیت درخواست یا دسترسی را بررسی کنید.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQAReview = async () => {
    if (!activeContext || !selectedRelease) return;
    const errors: Record<string, string> = {};
    if (!qaQualityStatus) errors.qaQualityStatus = 'انتخاب وضعیت کیفیت الزامی است.';
    if (!qaQualityNotes.trim()) errors.qaQualityNotes = 'ثبت توضیح QA الزامی است.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    const selectedQaQualityStatus = qaQualityStatus;
    if (!selectedQaQualityStatus) return;
    setActionLoading(true);
    try {
      const updated = await releasePublishApi.setQAQuality(
        selectedRelease.id,
        selectedQaQualityStatus,
        qaQualityNotes,
        activeContext.userId,
        activeContext.role
      );
      if (!updated) {
        toast.error('ثبت نظر QA مجاز نیست. اجرای تست، تکمیل نیازمندی‌ها و وضعیت انتخاب‌شده را بررسی کنید.');
        return;
      }
      setShowQAReviewModal(false);
      setQaQualityStatus('');
      setQaQualityNotes('');
      setSelectedRelease(updated);
      toast.success('نظر QA و Snapshot ثبت شد.');
      loadData();
    } catch {
      toast.error('خطا در ثبت نظر QA');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecision = async () => {
    if (!activeContext || !selectedRelease) return;
    const errors: Record<string, string> = {};
    if (!decision) errors.decision = 'انتخاب تصمیم انتشار الزامی است.';
    if (!decisionReason.trim()) errors.decisionReason = 'دلیل تصمیم الزامی است.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const selectedDecision = decision;
    if (!selectedDecision) return;
    setActionLoading(true);
    try {
      const updated = await releasePublishApi.decide(
        selectedRelease.id,
        selectedDecision,
        decisionReason,
        activeContext.userId,
        activeContext.role
      );
      if (!updated) {
        toast.error('تصمیم ثبت نشد. برای Tag اضطراری ابتدا پذیرش ریسک و توضیحات اجباری را ثبت کنید.');
        return;
      }
      setShowDecisionModal(false);
      setDecision('');
      setDecisionReason('');
      setShowDetailModal(false);
      toast.success(selectedDecision === 'BLOCKED' ? 'نیاز به بازآزمون ثبت شد و Runهای قبلی قفل شدند.' : 'تصمیم نهایی ثبت و Runهای مرتبط قفل شدند.');
      loadData();
    } catch {
      toast.error('خطا در ثبت تصمیم');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEmergencyPublish = async () => {
    if (!activeContext || !selectedRelease) return;
    if (!riskAccepted) {
      setFieldErrors({ riskAccepted: 'پذیرش صریح ریسک الزامی است.' });
      return;
    }
    const errors: Record<string, string> = {};
    if (!emergencyReason.trim()) errors.emergencyReason = 'دلیل اضطرار الزامی است.';
    if (!riskDescription.trim()) errors.riskDescription = 'شرح ریسک الزامی است.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setActionLoading(true);
    try {
      const updated = await releasePublishApi.emergencyPublish(
        selectedRelease.id,
        emergencyReason,
        riskDescription,
        activeContext.userId,
        activeContext.role
      );
      if (!updated) {
        toast.error('ثبت پذیرش ریسک فقط برای VersionHistory دارای Tag اضطراری محاسباتی مجاز است.');
        return;
      }
      setEmergencyReason('');
      setRiskDescription('');
      setRiskAccepted(false);
      setSelectedRelease(updated);
      toast.success('پذیرش ریسک Tag اضطراری ثبت شد.');
      loadData();
    } catch {
      toast.error('خطا در ثبت پذیرش ریسک');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!activeContext || !selectedRelease || !newComment.trim()) return;
    setActionLoading(true);
    try {
      await commentApi.create('VERSION_HISTORY', selectedRelease.id, newComment, activeContext.userId);
      setNewComment('');
      loadReleaseDetails();
    } catch {
      toast.error('خطا در ثبت دیدگاه.');
    } finally {
      setActionLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      primaryTestRequestId: '',
      relatedRequestIds: [],
    });
    setFormError('');
    setFieldErrors({});
  };

  const selectedPrimaryRequest = eligibleRequests.find(r => r.id === formData.primaryTestRequestId);

  if (!activeContext) return null;

  const canCreate = canPerformWorkflowAction(activeContext, 'versionHistory:create');
  const selectedReleasePolicy = getWorkflowPolicyForContext(
    activeContext,
    selectedRelease?.applicationId || defaultApplicationId
  );
  const canQAReview = selectedRelease
    ? canPerformWorkflowAction(activeContext, 'versionHistory:qaReview', selectedRelease.applicationId)
    : false;
  const canDecide = selectedRelease
    ? canPerformWorkflowAction(activeContext, 'versionHistory:decide', selectedRelease.applicationId)
    : false;
  const canEmergency = selectedRelease
    ? canPerformWorkflowAction(activeContext, 'versionHistory:riskAccept', selectedRelease.applicationId)
    : false;
  const canComment = selectedRelease
    ? canPerformWorkflowAction(activeContext, 'versionHistory:comment', selectedRelease.applicationId)
    : false;
  const closedBugStatuses = ['CLOSED', 'REJECTED', 'RETEST_PASSED', 'NO_ACTION_NEEDED'];
  const primaryRequestDetails = evidence?.primaryRequest || selectedPrimaryRequest;
  const openEvidenceList = (
    title: string,
    items: Array<{ id: string; title: string; subtitle?: string; status?: string }>
  ) => {
    setEvidenceModalTitle(title);
    setEvidenceModalItems(items);
    setShowEvidenceModal(true);
  };
  const testCaseItems = evidence?.testCases.map(tc => ({
    id: tc.id,
    title: tc.title,
    subtitle: `${tc.scenario || 'بدون سناریو'} | Requirement: ${tc.requirementId}`,
    status: tc.status,
  })) || [];
  const testRunItems = (status?: string | string[]) => {
    const statuses = Array.isArray(status) ? status : status ? [status] : undefined;
    return (evidence?.testRuns || [])
      .filter(run => !statuses || statuses.includes(run.status))
      .map(run => ({
        id: run.id,
        title: run.testCase?.title || run.testCaseId,
        subtitle: `نسخه ${run.version}${run.buildNumber ? ` / بیلد ${run.buildNumber}` : ''}`,
        status: TEST_RUN_STATUS_LABELS[run.status],
      }));
  };
  const bugItems = (openOnly = false) => (evidence?.bugs || [])
    .filter(bug => !openOnly || !closedBugStatuses.includes(bug.status))
    .map(bug => ({
      id: bug.id,
      title: bug.title,
      subtitle: bug.description,
      status: BUG_SEVERITY_LABELS[bug.severity],
    }));
  const retestTaskItems = (status?: string | string[]) => {
    const statuses = Array.isArray(status) ? status : status ? [status] : undefined;
    return (evidence?.retestTasks || [])
    .filter(task => !statuses || statuses.includes(task.status))
    .map(task => ({
      id: task.id,
      title: task.bug?.title || task.bugId,
      subtitle: `Run قبلی: ${task.previousRun?.testCase?.title || task.previousRunId}`,
      status: task.status,
    }));
  };
  const qaQualityOptions = Object.entries(QA_QUALITY_STATUS_LABELS)
    .filter(([value]) => !['NOT_STARTED', 'IN_PROGRESS'].includes(value))
    .map(([value, label]) => ({ value, label }));
  const renderTestOutcome = (item: ReleasePublish) => {
    const snapshot = item.snapshot;
    if (!snapshot) return <Badge variant="secondary" size="sm">در انتظار تست</Badge>;

    const executed = snapshot.executedTestRuns ?? (
      snapshot.passedTestRuns + snapshot.failedTestRuns + snapshot.blockedTestRuns + (snapshot.skippedTestRuns || 0)
    );
    const pending = snapshot.pendingTestRuns || 0;
    const openIssues = snapshot.openRunIssues || 0;
    if (
      executed > 0 &&
      pending === 0 &&
      snapshot.failedTestRuns === 0 &&
      snapshot.blockedTestRuns === 0 &&
      (snapshot.skippedTestRuns || 0) === 0 &&
      snapshot.openBugs === 0 &&
      openIssues === 0
    ) {
      return <Badge variant="success" size="sm">تست موفق</Badge>;
    }
    if (snapshot.failedTestRuns > 0 || snapshot.openBugs > 0 || openIssues > 0) {
      return <Badge variant="danger" size="sm">نیازمند اقدام</Badge>;
    }
    if (pending > 0) {
      return <Badge variant="warning" size="sm">تست در جریان</Badge>;
    }
    return <Badge variant="default" size="sm">نامشخص</Badge>;
  };

  const columns = [
    {
      key: 'version',
      title: 'نسخه',
      sortable: true,
      render: (item: ReleasePublish) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{item.version}</span>
          {item.buildNumber && (
            <span className="text-xs text-gray-500">({item.buildNumber})</span>
          )}
          {item.isEmergency && (
            <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded">
              Tag اضطراری
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'primaryTestRequestId',
      title: 'Primary Request',
      render: (item: ReleasePublish) => {
        const requestTitle = primaryRequestTitles[item.primaryTestRequestId];
        return (
          <div>
            <p className="font-medium text-gray-900">{requestTitle || item.primaryTestRequestId}</p>
            {requestTitle && (
              <p className="mt-0.5 font-mono text-xs text-gray-500" dir="ltr">{item.primaryTestRequestId}</p>
            )}
          </div>
        );
      },
    },
    ...(shouldShowSystemColumn ? [{
      key: 'applicationId',
      title: 'سامانه',
      render: (item: ReleasePublish) => <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{getApplicationName(item.applicationId)}</span>,
    }] : []),
    {
      key: 'status',
      title: 'وضعیت',
      render: (item: ReleasePublish) => (
        <StatusBadge status={item.status} labels={RELEASE_PUBLISH_STATUS_LABELS} />
      ),
    },
    {
      key: 'testOutcome',
      title: 'نتیجه تست',
      render: renderTestOutcome,
    },
    {
      key: 'qaQualityStatus',
      title: 'وضعیت کیفیت',
      render: (item: ReleasePublish) => 
        item.qaQualityStatus ? (
          <StatusBadge status={item.qaQualityStatus} labels={QA_QUALITY_STATUS_LABELS} />
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'createdBy',
      title: 'ایجادکننده',
      render: (item: ReleasePublish) => item.createdBy?.fullName || '-',
    },
    {
      key: 'createdAt',
      title: 'تاریخ',
      sortable: true,
      render: (item: ReleasePublish) => new Date(item.createdAt).toLocaleDateString('fa-IR'),
    },
    {
      key: 'actions',
      title: 'عملیات',
      render: (item: ReleasePublish) => (
        <Button
          size="sm"
          variant="ghost"
          icon={<Eye className="w-4 h-4" />}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedRelease(item);
            setShowDetailModal(true);
          }}
        >
          مشاهده
        </Button>
      ),
    },
  ];

  const developerColumns = [
    {
      key: 'title',
      title: 'درخواست تست',
      render: (item: TestRequest) => (
        <div>
          <p className="font-medium text-gray-900">{item.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            نسخه {item.version}{item.buildNumber ? ` / بیلد ${item.buildNumber}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      title: 'وضعیت درخواست',
      render: (item: TestRequest) => <StatusBadge status={item.status} labels={TEST_REQUEST_STATUS_LABELS} />,
    },
    {
      key: 'versionHistory',
      title: 'VersionHistory',
      render: (item: TestRequest) => item.versionHistoryId
        ? <Badge variant="info" size="sm">ثبت شده</Badge>
        : <Badge variant="default" size="sm">ثبت نشده</Badge>,
    },
    {
      key: 'qaQualityStatus',
      title: 'کیفیت QA',
      render: (item: TestRequest) => item.qaQualityStatus
        ? <StatusBadge status={item.qaQualityStatus} labels={QA_QUALITY_STATUS_LABELS} />
        : <span className="text-gray-400">-</span>,
    },
    {
      key: 'releaseDecision',
      title: 'تصمیم انتشار',
      render: (item: TestRequest) => item.releaseDecision
        ? <StatusBadge status={item.releaseDecision} labels={RELEASE_PUBLISH_STATUS_LABELS} />
        : <span className="text-gray-400">در انتظار</span>,
    },
    {
      key: 'published',
      title: 'وضعیت پابلیش',
      render: (item: TestRequest) => {
        const isPublished = ['APPROVED', 'CONDITIONAL'].includes(item.releaseDecision || '');
        if (isPublished) return <Badge variant="success" size="sm">پابلیش/تایید شده</Badge>;
        if (item.versionHistoryId) return <Badge variant="warning" size="sm">در گردش انتشار</Badge>;
        return <Badge variant="default" size="sm">بدون نسخه انتشار</Badge>;
      },
    },
    {
      key: 'releaseDecisionAt',
      title: 'تاریخ تصمیم',
      render: (item: TestRequest) => item.releaseDecisionAt ? new Date(item.releaseDecisionAt).toLocaleDateString('fa-IR') : '-',
    },
  ];

  if (activeContext.role === 'DEVELOPER') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header
          title="وضعیت انتشار درخواست‌های من"
          subtitle="نمای فقط خواندنی برای مشاهده VersionHistory و وضعیت پابلیش درخواست‌های ثبت‌شده توسط شما"
          onRefresh={loadDeveloperReleaseRequests}
          refreshing={loading}
        />
        <main className="p-6">
          <Card className="mb-6" padding="sm">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="جستجو..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                  className="w-full pr-10 pl-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">همه وضعیت‌های درخواست</option>
                {Object.entries(TEST_REQUEST_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </Card>

          <Table
            columns={developerColumns}
            data={developerRequests}
            loading={loading}
            emptyMessage="برای درخواست‌های شما وضعیت انتشاری ثبت نشده است"
            enableClientFilter={false}
            enableExport={false}
            enableColumnChooser={false}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="تصمیم و ثبت انتشار"
        subtitle={`${data?.total || 0} رکورد VersionHistory`}
        onRefresh={loadData}
        refreshing={loading}
        actions={
          canCreate && (
            <Button
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                resetForm();
                setFieldErrors({});
                setShowCreateModal(true);
              }}
            >
              انتشار جدید
            </Button>
          )
        }
      />

      <main className="p-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="در انتظار بررسی QA"
            value={data?.data.filter(r => ['DRAFT', 'QA_REVIEW'].includes(r.status)).length || 0}
            icon={<Clock className="w-6 h-6" />}
            variant="warning"
          />
          <StatCard
            title="در انتظار تصمیم"
            value={data?.data.filter(r => r.status === 'PENDING_DECISION').length || 0}
            icon={<Shield className="w-6 h-6" />}
            variant="primary"
          />
          <StatCard
            title="آماده تصمیم نهایی"
            value={data?.data.filter(r => ['APPROVED', 'CONDITIONAL'].includes(r.status)).length || 0}
            icon={<Rocket className="w-6 h-6" />}
            variant="success"
          />
          <StatCard
            title="منتشر شده"
            value={data?.data.filter(r => r.status === 'PUBLISHED').length || 0}
            icon={<CheckCircle className="w-6 h-6" />}
          />
        </div>

        {/* Filters */}
        <Card className="mb-6" padding="sm">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="جستجو..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                className="w-full pr-10 pl-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">همه وضعیت‌ها</option>
              {Object.entries(RELEASE_PUBLISH_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </Card>

        {/* Table */}
        <Table
          columns={columns}
          data={data?.data || []}
          loading={loading}
          emptyMessage="رکورد VersionHistory یافت نشد"
          sortBy={filters.sortBy}
          sortOrder={filters.sortOrder}
          onSort={(key) => {
            setFilters({
              ...filters,
              sortBy: key,
              sortOrder: filters.sortBy === key && filters.sortOrder === 'asc' ? 'desc' : 'asc',
            });
          }}
          onRowClick={(item) => {
            setSelectedRelease(item);
            setShowDetailModal(true);
          }}
          rowClassName={(item) =>
            item.isEmergency ? 'bg-red-50' : 
            item.status === 'PUBLISHED' ? 'bg-green-50' : ''
          }
          enableClientFilter={false}
          enableExport={false}
          enableColumnChooser={false}
        />

        {data && data.total > 0 && (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            limit={data.limit}
            onPageChange={(page) => setFilters({ ...filters, page })}
            onLimitChange={(limit) => setFilters({ ...filters, limit, page: 1 })}
          />
        )}
      </main>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="انتشار جدید"
        size="xl"
      >
        <div className="space-y-4">
          <Select
            label="درخواست تست *"
            value={formData.primaryTestRequestId}
            onChange={(e) => {
              const requestId = e.target.value;
              setFieldErrors(prev => ({ ...prev, primaryTestRequestId: '' }));
              setFormData({ primaryTestRequestId: requestId, relatedRequestIds: [] });
              handleCreate(requestId);
            }}
            options={eligibleRequests.map(req => ({
              value: req.id,
              label: `${req.title} - نسخه ${req.version}${req.buildNumber ? ` / بیلد ${req.buildNumber}` : ''}`,
            }))}
            placeholder="یک درخواست تست را انتخاب کنید"
            disabled={actionLoading}
            error={fieldErrors.primaryTestRequestId}
          />
          {eligibleRequests.length === 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              درخواست تستی در محدوده دسترسی شما یافت نشد.
            </div>
          )}
          {selectedPrimaryRequest && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div>
                <p className="text-xs text-gray-500">نسخه</p>
                <p className="font-medium text-gray-900">{selectedPrimaryRequest.version}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">شماره بیلد</p>
                <p className="font-medium text-gray-900">{selectedPrimaryRequest.buildNumber || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">وضعیت درخواست</p>
                <StatusBadge status={selectedPrimaryRequest.status} labels={{
                  DRAFT: 'پیش‌نویس',
                  SUBMITTED: 'ارسال شده',
                  UNDER_REVIEW: 'در حال بررسی',
                  ACCEPTED: 'پذیرفته شده',
                  REJECTED: 'رد شده',
                  CANCELLED: 'لغو شده',
                  IN_PROGRESS: 'در حال انجام',
                  COMPLETED: 'تکمیل شده',
                }} />
              </div>
              <div>
                <p className="text-xs text-gray-500">درخواست‌دهنده</p>
                <p className="font-medium text-gray-900">{selectedPrimaryRequest.requester?.fullName || '-'}</p>
              </div>
            </div>
          )}
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {formError}
            </div>
          )}
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              انصراف
            </Button>
            {actionLoading && <span className="text-sm text-gray-500 self-center">در حال آماده‌سازی انتشار...</span>}
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="جزئیات تصمیم انتشار"
        size="full"
      >
        {selectedRelease && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedRelease.isEmergency ? 'bg-red-100' : 'bg-blue-100'}`}>
                  <Rocket className={`w-6 h-6 ${selectedRelease.isEmergency ? 'text-red-600' : 'text-blue-600'}`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    نسخه {selectedRelease.version}
                    {selectedRelease.buildNumber && (
                      <span className="text-sm font-normal text-gray-500">
                        ({selectedRelease.buildNumber})
                      </span>
                    )}
                    {selectedRelease.isEmergency && (
                      <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
                        Tag اضطراری
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500">
                    ایجاد: {selectedRelease.createdBy?.fullName} - {new Date(selectedRelease.createdAt).toLocaleDateString('fa-IR')}
                  </p>
                </div>
              </div>
              <StatusBadge
                status={selectedRelease.status}
                labels={RELEASE_PUBLISH_STATUS_LABELS}
              />
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-3">جزئیات درخواست تست</h4>
              {primaryRequestDetails ? (
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-gray-900">{primaryRequestDetails.title}</p>
                    {primaryRequestDetails.description && <p className="text-sm text-gray-600 mt-1">{primaryRequestDetails.description}</p>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                    <div><p className="text-xs text-gray-500">نسخه</p><p className="font-medium">{primaryRequestDetails.version}</p></div>
                    <div><p className="text-xs text-gray-500">بیلد</p><p className="font-medium">{primaryRequestDetails.buildNumber || '-'}</p></div>
                    <div><p className="text-xs text-gray-500">محیط</p><p className="font-medium">{primaryRequestDetails.environment}</p></div>
                    <div><p className="text-xs text-gray-500">وضعیت</p><p className="font-medium">{primaryRequestDetails.status}</p></div>
                    <div><p className="text-xs text-gray-500">اولویت</p><p className="font-medium">{PRIORITY_LABELS[primaryRequestDetails.priority]}</p></div>
                    <div><p className="text-xs text-gray-500">سطح ریسک</p><p className="font-medium">{PRIORITY_LABELS[primaryRequestDetails.riskLevel]}</p></div>
                    <div><p className="text-xs text-gray-500">درخواست‌دهنده</p><p className="font-medium">{primaryRequestDetails.requester?.fullName || '-'}</p></div>
                    <div><p className="text-xs text-gray-500">تستر</p><p className="font-medium">{primaryRequestDetails.assignee?.fullName || '-'}</p></div>
                    <div className="md:col-span-2"><p className="text-xs text-gray-500">آدرس سامانه</p><p className="font-medium text-blue-700">{primaryRequestDetails.systemUrl || '-'}</p></div>
                    <div className="md:col-span-2"><p className="text-xs text-gray-500">نوع تست</p><p className="font-medium">{primaryRequestDetails.testTypes?.join('، ') || '-'}</p></div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600">{selectedRelease.primaryTestRequestId}</p>
              )}
            </div>

            {/* Quality Snapshot */}
            {selectedRelease.snapshot && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-500" />
                  وضعیت کیفیت
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <button type="button" onClick={() => openEvidenceList('تست کیس‌ها', testCaseItems)} className="text-center p-3 bg-white rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors">
                    <p className="text-2xl font-bold text-gray-900">{selectedRelease.snapshot.totalTestCases}</p>
                    <p className="text-xs text-gray-500">تست کیس</p>
                  </button>
                  <button type="button" onClick={() => openEvidenceList('کل اجراهای درخواست', testRunItems())} className="text-center p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-400 transition-colors">
                    <p className="text-2xl font-bold text-slate-700">{evidence?.testRuns.length || 0}</p>
                    <p className="text-xs text-gray-500">کل اجراها</p>
                  </button>
                  <button type="button" onClick={() => openEvidenceList('اجراهای نهایی', testRunItems(['PASSED', 'FAILED', 'BLOCKED', 'SKIPPED']))} className="text-center p-3 bg-white rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors">
                    <p className="text-2xl font-bold text-gray-900">{selectedRelease.snapshot.executedTestRuns || 0}</p>
                    <p className="text-xs text-gray-500">اجراهای نهایی</p>
                  </button>
                  <button type="button" onClick={() => openEvidenceList('اجراهای در صف یا در حال انجام', testRunItems(['PENDING', 'IN_PROGRESS']))} className="text-center p-3 bg-white rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors">
                    <p className="text-2xl font-bold text-gray-900">{selectedRelease.snapshot.pendingTestRuns || 0}</p>
                    <p className="text-xs text-gray-500">اجراهای باز</p>
                  </button>
                  <button type="button" onClick={() => openEvidenceList('اجراهای موفق', testRunItems('PASSED'))} className="text-center p-3 bg-green-50 rounded-lg border border-green-200 hover:border-green-400 transition-colors">
                    <p className="text-2xl font-bold text-green-600">{selectedRelease.snapshot.passedTestRuns}</p>
                    <p className="text-xs text-gray-500">موفق</p>
                  </button>
                  <button type="button" onClick={() => openEvidenceList('اجراهای ناموفق', testRunItems('FAILED'))} className="text-center p-3 bg-red-50 rounded-lg border border-red-200 hover:border-red-400 transition-colors">
                    <p className="text-2xl font-bold text-red-600">{selectedRelease.snapshot.failedTestRuns}</p>
                    <p className="text-xs text-gray-500">ناموفق</p>
                  </button>
                  <button type="button" onClick={() => openEvidenceList('اجراهای مسدود', testRunItems('BLOCKED'))} className="text-center p-3 bg-amber-50 rounded-lg border border-amber-200 hover:border-amber-400 transition-colors">
                    <p className="text-2xl font-bold text-amber-600">{selectedRelease.snapshot.blockedTestRuns}</p>
                    <p className="text-xs text-gray-500">مسدود</p>
                  </button>
                  <button type="button" onClick={() => openEvidenceList('اجراهای نادیده', testRunItems('SKIPPED'))} className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors">
                    <p className="text-2xl font-bold text-gray-700">{selectedRelease.snapshot.skippedTestRuns || 0}</p>
                    <p className="text-xs text-gray-500">نادیده</p>
                  </button>
                  <button type="button" onClick={() => openEvidenceList('باگ‌های باز', bugItems(true))} className="text-center p-3 bg-amber-50 rounded-lg border border-amber-200 hover:border-amber-400 transition-colors">
                    <p className="text-2xl font-bold text-amber-600">{selectedRelease.snapshot.openBugs}</p>
                    <p className="text-xs text-gray-500">باگ باز</p>
                  </button>
                  <button type="button" onClick={() => openEvidenceList('Retest باز', retestTaskItems(['QUEUED', 'IN_PROGRESS']))} className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200 hover:border-purple-400 transition-colors">
                    <p className="text-2xl font-bold text-purple-600">{selectedRelease.snapshot.openRetestTasks || 0}</p>
                    <p className="text-xs text-gray-500">Retest باز</p>
                  </button>
                  <button type="button" onClick={() => openEvidenceList('Retest کامل', retestTaskItems('COMPLETED'))} className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200 hover:border-blue-400 transition-colors">
                    <p className="text-2xl font-bold text-blue-600">{selectedRelease.snapshot.completedRetestTasks || 0}</p>
                    <p className="text-xs text-gray-500">Retest کامل</p>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">امنیت:</span>
                    {selectedRelease.snapshot.securityChecklistResult ? (
                      <StatusBadge 
                        status={selectedRelease.snapshot.securityChecklistResult} 
                        labels={{ PASS: 'قبول', FAIL: 'رد', PARTIAL: 'جزئی' }} 
                      />
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">کارایی:</span>
                    {selectedRelease.snapshot.performanceChecklistResult ? (
                      <StatusBadge 
                        status={selectedRelease.snapshot.performanceChecklistResult} 
                        labels={{ PASS: 'قبول', FAIL: 'رد', PARTIAL: 'جزئی' }} 
                      />
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Playwright:</span>
                    {selectedRelease.snapshot.playwrightPassRate !== undefined ? (
                      <span className="font-medium">{selectedRelease.snapshot.playwrightPassRate}%</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* QA Quality Status */}
            {selectedRelease.qaQualityStatus && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">وضعیت کیفیت QA</h4>
                  <StatusBadge status={selectedRelease.qaQualityStatus} labels={QA_QUALITY_STATUS_LABELS} />
                </div>
                {selectedRelease.qaQualityNotes && (
                  <p className="text-sm text-gray-700">{selectedRelease.qaQualityNotes}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  بررسی توسط: {selectedRelease.qaReviewedBy?.fullName} - {selectedRelease.qaReviewedAt && new Date(selectedRelease.qaReviewedAt).toLocaleDateString('fa-IR')}
                </p>
              </div>
            )}

            {/* Decision */}
            {selectedRelease.decision && (
              <div className={`p-4 rounded-lg border ${
                selectedRelease.decision === 'APPROVED' ? 'bg-green-50 border-green-200' :
                selectedRelease.decision === 'REJECTED' ? 'bg-red-50 border-red-200' :
                'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">تصمیم نهایی</h4>
                  <StatusBadge status={selectedRelease.decision} labels={{
                    APPROVED: 'انتشار مجاز',
                    CONDITIONAL: 'انتشار مشروط',
                    REJECTED: 'عدم انتشار',
                    BLOCKED: 'نیازمند بازآزمون',
                  }} />
                </div>
                {selectedRelease.decisionReason && (
                  <p className="text-sm text-gray-700">{selectedRelease.decisionReason}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  تصمیم توسط: {selectedRelease.decisionBy?.fullName} - {selectedRelease.decisionAt && new Date(selectedRelease.decisionAt).toLocaleDateString('fa-IR')}
                </p>
              </div>
            )}

            {/* Emergency Info */}
            {selectedRelease.isEmergency && selectedRelease.emergencyReason && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Tag اضطراری
                </h4>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">دلیل Tag اضطراری:</span> {selectedRelease.emergencyReason}</p>
                  {selectedRelease.riskDescription && (
                    <p><span className="font-medium">توضیح ریسک:</span> {selectedRelease.riskDescription}</p>
                  )}
                  {selectedRelease.riskAccepted && (
                    <p className="text-red-600 font-medium">✓ ریسک پذیرفته شده</p>
                  )}
                </div>
              </div>
            )}

            {/* Critical Bugs Warning */}
            {criticalBugs.length > 0 && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  باگ‌های بحرانی/اصلی باز
                </h4>
                <div className="space-y-2">
                  {criticalBugs.slice(0, 5).map((bug) => (
                    <div key={bug.id} className="flex items-center justify-between p-2 bg-white rounded border">
                      <span className="text-sm">{bug.title}</span>
                      <StatusBadge status={bug.severity} labels={BUG_SEVERITY_LABELS} />
                    </div>
                  ))}
                  {criticalBugs.length > 5 && (
                    <p className="text-sm text-amber-600">و {criticalBugs.length - 5} باگ دیگر...</p>
                  )}
                </div>
              </div>
            )}

            {/* Comments */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">نظرات</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                {comments.length === 0 ? (
                  <p className="text-sm text-gray-500">نظری ثبت نشده است</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{comment.author?.fullName}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(comment.createdAt).toLocaleDateString('fa-IR')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>
              {canComment && (
                <div className="flex gap-2">
                  <Input
                    placeholder="نظر جدید..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <Button
                    onClick={handleAddComment}
                    loading={actionLoading}
                    disabled={!newComment.trim()}
                  >
                    ارسال
                  </Button>
                </div>
              )}
            </div>

            {canEmergency && selectedRelease.isEmergency && !selectedRelease.riskAccepted &&
             !['PUBLISHED', 'REJECTED', 'APPROVED', 'CONDITIONAL'].includes(selectedRelease.status) && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200 space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={riskAccepted}
                    onChange={(e) => {
                      setFieldErrors(prev => ({ ...prev, riskAccepted: '' }));
                      setRiskAccepted(e.target.checked);
                      if (!e.target.checked) {
                        setEmergencyReason('');
                        setRiskDescription('');
                      }
                    }}
                    className="mt-1 w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-red-800">
                    ثبت پذیرش ریسک اضطراری برای این VersionHistory الزامی است
                  </span>
                </label>
                {fieldErrors.riskAccepted && <p className="text-sm text-red-600">{fieldErrors.riskAccepted}</p>}
                {riskAccepted && (
                  <div className="space-y-3">
                    <Textarea
                      label="دلیل اضطرار *"
                      value={emergencyReason}
                      onChange={(e) => { setFieldErrors(prev => ({ ...prev, emergencyReason: '' })); setEmergencyReason(e.target.value); }}
                      placeholder="چرا این Tag اضطراری ثبت می‌شود؟"
                      error={fieldErrors.emergencyReason}
                    />
                    <Textarea
                      label="توضیح ریسک *"
                      value={riskDescription}
                      onChange={(e) => { setFieldErrors(prev => ({ ...prev, riskDescription: '' })); setRiskDescription(e.target.value); }}
                      placeholder="ریسک‌های این انتشار را توضیح دهید..."
                      error={fieldErrors.riskDescription}
                    />
                    <div className="flex justify-end">
                      <Button
                        variant="danger"
                        onClick={handleEmergencyPublish}
                        loading={actionLoading}
                        disabled={actionLoading}
                      >
                        ذخیره پذیرش ریسک
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              {/* QA Lead: Submit QA Review */}
              {canQAReview && ['DRAFT', 'QA_REVIEW'].includes(selectedRelease.status) && (
                <Button
                  variant="primary"
                  icon={<Shield className="w-4 h-4" />}
                  onClick={() => { setFieldErrors({}); setShowQAReviewModal(true); }}
                >
                  ثبت وضعیت کیفیت ({selectedReleasePolicy.versionHistory.qaReviewOwnerLabel})
                </Button>
              )}

              {/* Tech Lead: Make Decision */}
              {canDecide && selectedRelease.status === 'PENDING_DECISION' && (
                <Button
                  variant="primary"
                  icon={<CheckCircle className="w-4 h-4" />}
                  onClick={() => { setFieldErrors({}); setShowDecisionModal(true); }}
                >
                  ثبت تصمیم ({selectedReleasePolicy.versionHistory.decisionOwnerLabel})
                </Button>
              )}

              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                بستن
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* QA Review Modal */}
      <Modal
        isOpen={showQAReviewModal}
        onClose={() => setShowQAReviewModal(false)}
        title="ثبت وضعیت کیفیت"
        size="md"
      >
        <div className="space-y-4">
          {primaryRequestDetails && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <p className="font-medium text-blue-900 mb-2">{primaryRequestDetails.title}</p>
              {primaryRequestDetails.description && <p className="text-gray-700 mb-2">{primaryRequestDetails.description}</p>}
              <div className="grid grid-cols-2 gap-2">
                <span>نسخه: <strong>{primaryRequestDetails.version}</strong></span>
                <span>بیلد: <strong>{primaryRequestDetails.buildNumber || '-'}</strong></span>
                <span>محیط: <strong>{primaryRequestDetails.environment}</strong></span>
                <span>اولویت: <strong>{PRIORITY_LABELS[primaryRequestDetails.priority]}</strong></span>
                <span>ریسک: <strong>{PRIORITY_LABELS[primaryRequestDetails.riskLevel]}</strong></span>
                <span>تستر: <strong>{primaryRequestDetails.assignee?.fullName || '-'}</strong></span>
                <span className="col-span-2">آدرس سامانه: <strong>{primaryRequestDetails.systemUrl || '-'}</strong></span>
                <span className="col-span-2">نوع تست: <strong>{primaryRequestDetails.testTypes?.join('، ') || '-'}</strong></span>
              </div>
            </div>
          )}
          <Select
            label="وضعیت کیفیت *"
            value={qaQualityStatus}
            onChange={(e) => { setFieldErrors(prev => ({ ...prev, qaQualityStatus: '' })); setQaQualityStatus(e.target.value as QAQualityStatus); }}
            options={qaQualityOptions}
            placeholder="انتخاب کنید"
            error={fieldErrors.qaQualityStatus}
          />
          <Textarea
            label="توضیح QA *"
            value={qaQualityNotes}
            onChange={(e) => { setFieldErrors(prev => ({ ...prev, qaQualityNotes: '' })); setQaQualityNotes(e.target.value); }}
            placeholder="توضیحات وضعیت کیفیت..."
            error={fieldErrors.qaQualityNotes}
          />
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowQAReviewModal(false)}>
              انصراف
            </Button>
            <Button
              onClick={handleQAReview}
              loading={actionLoading}
              disabled={actionLoading}
            >
              ثبت
            </Button>
          </div>
        </div>
      </Modal>

      {/* Decision Modal */}
      <Modal
        isOpen={showDecisionModal}
        onClose={() => setShowDecisionModal(false)}
        title={`ثبت تصمیم نهایی VersionHistory (${selectedReleasePolicy.versionHistory.decisionOwnerLabel})`}
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="تصمیم *"
            value={decision}
            onChange={(e) => { setFieldErrors(prev => ({ ...prev, decision: '' })); setDecision(e.target.value as VersionHistoryDecision); }}
            options={[
              { value: 'APPROVED', label: 'انتشار مجاز' },
              { value: 'CONDITIONAL', label: 'انتشار مشروط' },
              { value: 'REJECTED', label: 'عدم انتشار' },
              { value: 'BLOCKED', label: 'نیازمند بازآزمون' },
            ]}
            placeholder="انتخاب کنید"
            error={fieldErrors.decision}
          />
          <Textarea
            label="دلیل تصمیم *"
            value={decisionReason}
            onChange={(e) => { setFieldErrors(prev => ({ ...prev, decisionReason: '' })); setDecisionReason(e.target.value); }}
            placeholder="دلیل تصمیم خود را توضیح دهید..."
            error={fieldErrors.decisionReason}
          />
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowDecisionModal(false)}>
              انصراف
            </Button>
            <Button
              onClick={handleDecision}
              loading={actionLoading}
              disabled={actionLoading}
              variant={decision === 'REJECTED' || decision === 'BLOCKED' ? 'danger' : 'primary'}
            >
              ثبت تصمیم
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEvidenceModal}
        onClose={() => setShowEvidenceModal(false)}
        title={evidenceModalTitle}
        size="lg"
      >
        <div className="space-y-3">
          {evidenceModalItems.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">موردی برای نمایش وجود ندارد.</p>
          ) : (
            evidenceModalItems.map(item => (
              <div key={item.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{item.title}</p>
                    {item.subtitle && <p className="text-sm text-gray-600 mt-1">{item.subtitle}</p>}
                  </div>
                  {item.status && <span className="text-xs px-2 py-1 bg-white border rounded text-gray-600">{item.status}</span>}
                </div>
                <p className="text-xs text-gray-400 mt-2">{item.id}</p>
              </div>
            ))
          )}
          <div className="flex justify-end pt-3">
            <Button variant="secondary" onClick={() => setShowEvidenceModal(false)}>بستن</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
