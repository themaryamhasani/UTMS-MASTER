import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit, Trash2, FileText, GitBranch } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Table, Pagination } from '../components/ui/Table';
import { CartableExcelExportButton, CartableSearchInput, CartableSelectFilter } from '../components/ui/CartableToolbar';
import { StatusBadge, PriorityBadge } from '../components/ui/Badge';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Input, Textarea, Select } from '../components/ui/Input';
import { ApplicationSelect } from '../components/ui/ApplicationSelect';
import { useAuthStore, canPerformAction } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import { useApplicationLookup } from '../utils/useApplicationLookup';
import { testCaseApi, requirementApi, flowApi, testRequestApi } from '../services/api';
import { toast } from '../components/ui/Toast';
import type {
  TestCase,
  Requirement,
  Flow,
  TestRequest,
  CartableFilterParams,
  PaginatedResponse,
  TestType,
  TestDesignTechnique,
  Priority,
  QualityAttribute,
} from '../types';
import { 
  TEST_CASE_STATUS_LABELS, 
  TEST_TYPE_LABELS, 
  TEST_DESIGN_TECHNIQUE_LABELS,
  QUALITY_ATTRIBUTE_LABELS,
  PRIORITY_LABELS
} from '../types';

interface TestCaseFormState {
  title: string;
  scenario: string;
  preconditions: string;
  testData: string;
  steps: string;
  expectedResult: string;
  testType: TestType;
  testDesignTechnique: TestDesignTechnique;
  testDesignTechniques: TestDesignTechnique[];
  priority: Priority;
  riskLevel: Priority;
  qualityAttribute: QualityAttribute;
  automationCandidate: boolean;
  regressionCandidate: boolean;
  testRequestId: string;
  requirementId: string;
  flowId: string;
}

const TEST_CASE_TITLE_MAX_LENGTH = 50;
const TEST_CASE_BODY_MAX_LENGTH = 700;

const createEmptyFormState = (): TestCaseFormState => ({
  title: '',
  scenario: '',
  preconditions: '',
  testData: '',
  steps: '',
  expectedResult: '',
  testType: 'FUNCTIONAL',
  testDesignTechnique: 'REQUIREMENTS_BASED',
  testDesignTechniques: ['REQUIREMENTS_BASED'],
  priority: 'MEDIUM',
  riskLevel: 'MEDIUM',
  qualityAttribute: 'FUNCTIONALITY',
  automationCandidate: false,
  regressionCandidate: false,
  testRequestId: '',
  requirementId: '',
  flowId: '',
});

const TestCaseContextAccordion: React.FC<{
  requirement?: Requirement | undefined;
  flow?: Flow | undefined;
  testRequest?: TestRequest | undefined;
  applicationName?: string | undefined;
}> = ({ requirement, flow, testRequest, applicationName }) => {
  if (!requirement && !flow) return null;

  return (
    <details className="rounded-lg border border-indigo-200 bg-indigo-50/60" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-right">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-indigo-600" />
          <span className="truncate text-sm font-medium text-indigo-900">
            اطلاعات نیازمندی و جریان انتخاب‌شده
          </span>
        </div>
      </summary>
      <div className="space-y-3 border-t border-indigo-100 bg-white px-4 py-3 text-sm">
        {requirement && (
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">نیازمندی</p>
            <p className="font-medium text-gray-900">{requirement.title}</p>
            <p className="mt-1 text-xs font-medium text-indigo-700">
              سامانه: {applicationName || 'سامانه نامشخص'}
            </p>
            {testRequest && <p className="mt-1 text-xs text-gray-500">درخواست تست: {testRequest.title}</p>}
            {requirement.description && <p className="mt-2 whitespace-pre-wrap text-gray-700">{requirement.description}</p>}
            {requirement.acceptanceCriteria && (
              <div className="mt-2 rounded border border-green-200 bg-green-50 p-2">
                <p className="text-xs text-green-700">معیارهای پذیرش</p>
                <p className="mt-1 whitespace-pre-wrap text-gray-800">{requirement.acceptanceCriteria}</p>
              </div>
            )}
            {requirement.riskNotes && (
              <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2">
                <p className="text-xs text-amber-700">ریسک‌ها</p>
                <p className="mt-1 whitespace-pre-wrap text-gray-800">{requirement.riskNotes}</p>
              </div>
            )}
          </div>
        )}
        {flow && (
          <div className="rounded-lg bg-purple-50 p-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-purple-600" />
              <p className="font-medium text-purple-900">جریان: {flow.title}</p>
            </div>
            {flow.description && <p className="mt-2 whitespace-pre-wrap text-gray-700">{flow.description}</p>}
            {flow.steps && (
              <div className="mt-2 rounded border border-purple-200 bg-white p-2">
                <p className="text-xs text-purple-700">مراحل جریان</p>
                <p className="mt-1 whitespace-pre-wrap text-gray-800">{flow.steps}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </details>
  );
};

export const TestCasesPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { appId, defaultApplicationId, isAppLevel, isMultiSystem } = useDataScope();
  const { shouldShowSystemColumn, getApplicationName } = useApplicationLookup();
  const [data, setData] = useState<PaginatedResponse<TestCase> | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CartableFilterParams>({
    page: 1,
    limit: 10,
    search: '',
    status: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<TestCaseFormState>(createEmptyFormState);
  const [formApplicationId, setFormApplicationId] = useState('');

  const [testRequests, setTestRequests] = useState<TestRequest[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TestCase | null>(null);

  useEffect(() => {
    if (activeContext) {
      loadData();
    }
  }, [activeContext, filters]);

  useEffect(() => {
    if (activeContext) {
      loadTestRequests();
      loadRequirements();
    }
  }, [activeContext, appId]);

  useEffect(() => {
    if (formData.requirementId) {
      loadFlows(formData.requirementId);
    } else {
      setFlows([]);
    }
  }, [formData.requirementId]);

  const loadData = async () => {
    if (!activeContext) return;
    setLoading(true);
    try {
      const response = await testCaseApi.getVisibleForRole(appId, filters, activeContext.userId, activeContext.role);
      setData(response);
    } catch {
      toast.error('خطا در بارگذاری تست کیس‌ها.');
    } finally {
      setLoading(false);
    }
  };

  const loadRequirements = async () => {
    if (!activeContext) return;
    try {
      const response = await requirementApi.getAll(appId, { page: 1, limit: 200 });
      setRequirements(response.data
        .filter(r => ['COMPLETED', 'APPROVED'].includes(r.status)));
    } catch {
      setRequirements([]);
      toast.error('خطا در بارگذاری نیازمندی‌ها.');
    }
  };

  const loadTestRequests = async () => {
    if (!activeContext) return;
    try {
      const response = await testRequestApi.getVisibleForRole(appId, { page: 1, limit: 200 }, activeContext.userId, activeContext.role);
      setTestRequests(response.data.filter(tr => ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(tr.status)));
    } catch {
      setTestRequests([]);
      toast.error('خطا در بارگذاری درخواست‌های تست.');
    }
  };

  const loadFlows = async (requirementId: string) => {
    try {
      setFlows(await flowApi.getByRequirement(requirementId));
    } catch {
      setFlows([]);
    }
  };

  const resetForm = () => {
    setFormData(createEmptyFormState());
    setFormApplicationId(isAppLevel || isMultiSystem ? '' : defaultApplicationId);
    setFlows([]);
    setFormErrors({});
  };

  const fillFormFromCase = (testCase: TestCase) => {
    setFormApplicationId(testCase.applicationId);
    setFormData({
      title: testCase.title || '',
      scenario: testCase.scenario || '',
      preconditions: testCase.preconditions || '',
      testData: testCase.testData || '',
      steps: testCase.steps || '',
      expectedResult: testCase.expectedResult || '',
      testType: testCase.testType || 'FUNCTIONAL',
      testDesignTechnique: testCase.testDesignTechnique || 'REQUIREMENTS_BASED',
      testDesignTechniques: testCase.testDesignTechniques?.length
        ? testCase.testDesignTechniques
        : [testCase.testDesignTechnique || 'REQUIREMENTS_BASED'],
      priority: testCase.priority || 'MEDIUM',
      riskLevel: testCase.riskLevel || 'MEDIUM',
      qualityAttribute: testCase.qualityAttribute || 'FUNCTIONALITY',
      automationCandidate: !!testCase.automationCandidate,
      regressionCandidate: !!testCase.regressionCandidate,
      testRequestId: testCase.testRequestId || '',
      requirementId: testCase.requirementId || '',
      flowId: testCase.flowId || '',
    });
    setFormErrors({});
  };

  const selectedRequirement = requirements.find(r => r.id === formData.requirementId);
  const selectedFlow = flows.find(f => f.id === formData.flowId);
  const resolveTestRequestForRequirement = (requirement?: Requirement) => {
    if (!requirement) return undefined;
    return testRequests.find(tr => tr.id === requirement.testRequestId)
      || testRequests.find(tr => tr.selectedRequirementIds?.includes(requirement.id));
  };
  const selectedTestRequest = resolveTestRequestForRequirement(selectedRequirement);
  const selectedRequirementApplicationName = selectedRequirement
    ? getApplicationName(selectedRequirement.applicationId)
    : undefined;
  const requirementOptions = requirements
    .filter(requirement => !formApplicationId || requirement.applicationId === formApplicationId)
    .map(requirement => ({
    value: requirement.id,
    label: `${requirement.title} — سامانه: ${getApplicationName(requirement.applicationId)}`,
  }));

  const updateLimitedTextField = (
    field: 'title' | 'scenario' | 'preconditions' | 'testData' | 'steps' | 'expectedResult',
    value: string,
    maxLength: number
  ) => {
    setFormData(prev => ({ ...prev, [field]: value.slice(0, maxLength) }));
  };

  const toggleDesignTechnique = (technique: TestDesignTechnique) => {
    setFormData(prev => {
      const nextTechniques = prev.testDesignTechniques.includes(technique)
        ? prev.testDesignTechniques.filter(item => item !== technique)
        : [...prev.testDesignTechniques, technique];
      const safeTechniques = nextTechniques.length ? nextTechniques : [technique];
      return {
        ...prev,
        testDesignTechniques: safeTechniques,
        testDesignTechnique: safeTechniques[0] || technique,
      };
    });
  };

  const getRequirementTitle = (testCase: TestCase) =>
    testCase.requirement?.title
    || requirements.find(requirement => requirement.id === testCase.requirementId)?.title
    || testCase.requirementId
    || '-';

  const getFlowTitle = (testCase: TestCase) =>
    testCase.flow?.title
    || flows.find(flow => flow.id === testCase.flowId)?.title
    || testCase.flowId
    || '-';

  const getDesignTechniqueLabel = (testCase: TestCase) => {
    const techniques = testCase.testDesignTechniques?.length
      ? testCase.testDesignTechniques
      : [testCase.testDesignTechnique];
    return techniques
      .filter(Boolean)
      .map(technique => TEST_DESIGN_TECHNIQUE_LABELS[technique as TestDesignTechnique])
      .join('، ');
  };

  const clearFormError = (field: string) => {
    setFormErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formApplicationId) errors.applicationId = 'انتخاب سامانه الزامی است.';

    if (!formData.requirementId || !selectedRequirement) {
      errors.requirementId = 'انتخاب نیازمندی آماده الزامی است.';
    } else if (!['COMPLETED', 'APPROVED'].includes(selectedRequirement.status)) {
      errors.requirementId = 'نیازمندی ناقص یا غیرفعال برای Test Case قابل انتخاب نیست.';
    } else if (selectedRequirement.applicationId !== formApplicationId) {
      errors.requirementId = 'نیازمندی باید متعلق به سامانه انتخاب‌شده باشد.';
    }

    if (!formData.flowId || !selectedFlow) {
      errors.flowId = 'انتخاب Flow مرتبط با نیازمندی الزامی است.';
    } else if (selectedRequirement && selectedFlow.requirementId !== selectedRequirement.id) {
      errors.flowId = 'Flow باید متعلق به نیازمندی انتخاب‌شده باشد.';
    }

    if (!formData.title.trim()) errors.title = 'عنوان تست کیس الزامی است.';
    else if (formData.title.length > TEST_CASE_TITLE_MAX_LENGTH) errors.title = `عنوان حداکثر ${TEST_CASE_TITLE_MAX_LENGTH} کاراکتر است.`;
    if (!formData.scenario.trim()) errors.scenario = 'سناریو الزامی است.';
    if (!formData.preconditions.trim()) errors.preconditions = 'پیش‌شرط‌ها الزامی است.';
    if (!formData.testData.trim()) errors.testData = 'داده‌های تست الزامی است.';
    if (!formData.steps.trim()) errors.steps = 'مراحل تست الزامی است.';
    if (!formData.expectedResult.trim()) errors.expectedResult = 'نتیجه مورد انتظار الزامی است.';
    (['scenario', 'preconditions', 'testData', 'steps', 'expectedResult'] as const).forEach(field => {
      if (formData[field].length > TEST_CASE_BODY_MAX_LENGTH) {
        errors[field] = `حداکثر ${TEST_CASE_BODY_MAX_LENGTH} کاراکتر مجاز است.`;
      }
    });
    if (!formData.testDesignTechniques.length) {
      errors.testDesignTechniques = 'حداقل یک تکنیک طراحی انتخاب کنید.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!activeContext) return;
    if (!validateForm() || !selectedRequirement) return;
    
    setActionLoading(true);
    try {
      await testCaseApi.create(
        {
          ...formData,
          testRequestId: selectedTestRequest?.id || '',
          testType: formData.testType,
          testDesignTechnique: formData.testDesignTechnique,
          testDesignTechniques: formData.testDesignTechniques,
          priority: formData.priority,
          riskLevel: formData.riskLevel,
          qualityAttribute: formData.qualityAttribute,
          status: 'READY',
          isActive: true,
        },
        activeContext.userId,
        selectedRequirement.applicationId
      );
      setShowCreateModal(false);
      resetForm();
      toast.success('تست کیس با موفقیت ایجاد شد.');
      loadData();
    } catch {
      toast.error('خطا در ایجاد تست کیس.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!activeContext || !selectedCase) return;
    if (!validateForm()) return;

    setActionLoading(true);
    try {
      const updated = await testCaseApi.update(
        selectedCase.id,
        {
          ...formData,
          testRequestId: selectedTestRequest?.id || '',
          testType: formData.testType,
          testDesignTechnique: formData.testDesignTechnique,
          testDesignTechniques: formData.testDesignTechniques,
          priority: formData.priority,
          riskLevel: formData.riskLevel,
          qualityAttribute: formData.qualityAttribute,
          status: selectedCase.status,
          isActive: selectedCase.isActive ?? selectedCase.status === 'READY',
        },
        activeContext.userId
      );
      if (!updated) throw new Error('TEST_CASE_UPDATE_FAILED');
      setSelectedCase(updated);
      setShowEditModal(false);
      resetForm();
      toast.success('تست کیس بروزرسانی شد.');
      loadData();
    } catch {
      toast.error('خطا در ویرایش تست کیس.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTestCase = async () => {
    if (!activeContext || !deleteTarget) return;
    setActionLoading(true);
    try {
      const removed = await testCaseApi.delete(deleteTarget.id, activeContext.userId);
      if (!removed) {
        toast.error('حذف تست کیس ممکن نیست؛ تست کیس یا اجراهای وابسته قفل VersionHistory دارند.');
        return;
      }
      toast.success(`تست کیس «${deleteTarget.title}» حذف شد.`);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      loadData();
    } catch {
      toast.error('خطا در حذف تست کیس.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!activeContext) return null;

  const role = activeContext.role;
  const isDeveloper = role === 'DEVELOPER';
  const canCreate = canPerformAction(role, 'test-case:create') && !isDeveloper;
  const canEditTC = canPerformAction(role, 'test-case:edit') && !isDeveloper;
  const canDeleteTC = canPerformAction(role, 'test-case:delete') && !isDeveloper;
  const canToggleTC = canPerformAction(role, 'test-case:edit') && !isDeveloper;

  const columns = [
    {
      key: 'title',
      title: 'عنوان',
      sortable: true,
      render: (item: TestCase) => (
        <div>
          <p className="font-medium text-gray-900">{item.title}</p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
            {item.scenario}
          </p>
        </div>
      ),
    },
    {
      key: 'testType',
      title: 'نوع تست',
      render: (item: TestCase) => TEST_TYPE_LABELS[item.testType],
    },
    ...(shouldShowSystemColumn ? [{
      key: 'applicationId',
      title: 'سامانه',
      render: (item: TestCase) => <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{getApplicationName(item.applicationId)}</span>,
    }] : []),
    {
      key: 'priority',
      title: 'اولویت',
      render: (item: TestCase) => <PriorityBadge priority={item.priority} />,
    },
    {
      key: 'status',
      title: 'وضعیت',
      render: (item: TestCase) => (
        <StatusBadge status={item.status} labels={TEST_CASE_STATUS_LABELS} />
      ),
    },
    {
      key: 'readiness',
      title: 'آمادگی',
      render: (item: TestCase) => (
        item.isComplete ? (
          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">کامل</span>
        ) : (
          <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">ناقص</span>
        )
      ),
    },
    {
      key: 'automationCandidate',
      title: 'خودکارسازی',
      render: (item: TestCase) => (
        item.automationCandidate ? (
          <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">کاندید</span>
        ) : null
      ),
    },
    {
      key: 'createdAt',
      title: 'تاریخ',
      sortable: true,
      render: (item: TestCase) => new Date(item.createdAt).toLocaleDateString('fa-IR'),
    },
    {
      key: 'actions',
      title: 'عملیات',
      render: (item: TestCase) => (
        <div className="flex items-center gap-2">
          {/* Toggle under actions column */}
          {canToggleTC && (
            <button type="button" role="switch" aria-checked={item.status === 'READY'} aria-label={`فعال بودن تست کیس ${item.title}`} onClick={(e) => {
              e.stopPropagation();
              const newStatus = item.status === 'READY' ? 'DRAFT' : 'READY';
              testCaseApi.update(item.id, { status: newStatus }, activeContext!.userId).then((updated) => {
                if (newStatus === 'READY' && updated?.status !== 'READY') {
                  toast.error('Test Case ناقص قابل فعال‌سازی نیست.');
                  loadData();
                  return;
                }
                toast.success(newStatus === 'READY' ? 'تست کیس فعال شد.' : 'تست کیس غیرفعال شد.');
                loadData();
              }).catch(() => toast.error('به‌روزرسانی وضعیت Test Case ممکن نشد.'));
            }}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
                item.status === 'READY' ? 'bg-green-500' : 'bg-gray-300'
              }`}
              dir="ltr">
              <span className={`theme-switch-thumb pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${
                item.status === 'READY' ? 'translate-x-5' : 'translate-x-1'
              }`} />
            </button>
          )}
          <Button size="sm" variant="ghost" icon={<Eye className="w-4 h-4" />}
            onClick={(e) => { e.stopPropagation(); setSelectedCase(item); setShowDetailModal(true); }}>مشاهده</Button>
          {canEditTC && (
            <Button size="sm" variant="ghost" icon={<Edit className="w-4 h-4" />}
              onClick={(e) => { e.stopPropagation(); setSelectedCase(item); fillFormFromCase(item); setShowEditModal(true); }}>ویرایش</Button>
          )}
          {canDeleteTC && (
            <Button size="sm" variant="ghost" className="text-red-600" icon={<Trash2 className="w-4 h-4" />}
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); setShowDeleteConfirm(true); }}>حذف</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="کارتابل تست کیس‌ها"
        subtitle={`${data?.total || 0} تست کیس`}
        onRefresh={loadData}
        refreshing={loading}
      />

      <main className="p-4 sm:p-6">
        <Card className="mb-6" padding="sm">
          <div className="flex flex-wrap gap-4 items-center">
            {canCreate && <Button icon={<Plus className="w-4 h-4" />} onClick={() => { resetForm(); setShowCreateModal(true); }}>تست کیس جدید</Button>}
            <CartableExcelExportButton
              data={data?.data || []}
              columns={[
                { key: 'title', title: 'عنوان' }, { key: 'testType', title: 'نوع تست' },
                { key: 'priority', title: 'اولویت' }, { key: 'status', title: 'وضعیت' },
              ]}
              filename="test-cases"
              disabled={!data?.data?.length}
            />
            <CartableSearchInput
              value={filters.search || ''}
              onChange={(search) => setFilters({ ...filters, search, page: 1 })}
            />
            <CartableSelectFilter
              value={filters.status || ''}
              onChange={(status) => setFilters({ ...filters, status, page: 1 })}
              options={Object.entries(TEST_CASE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </div>
        </Card>

        <Table
          columns={columns}
          data={data?.data || []}
          loading={loading}
          emptyMessage="تست کیسی یافت نشد"
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
            setSelectedCase(item);
            setShowDetailModal(true);
          }}
          enableClientFilter={false}
          enableExport={false}
          enableColumnChooser={false}
        />

        {data && <Pagination page={data.page} totalPages={data.totalPages || 1} total={data.total} limit={data.limit || filters.limit}
          onPageChange={(p) => setFilters({ ...filters, page: p })}
          onLimitChange={(l) => setFilters({ ...filters, limit: l, page: 1 })} />}
      </main>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="جزئیات تست کیس"
        size="xl"
      >
        {selectedCase && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedCase.title}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge status={selectedCase.status} labels={TEST_CASE_STATUS_LABELS} />
                  <PriorityBadge priority={selectedCase.priority} />
                  {selectedCase.automationCandidate && (
                    <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">کاندید خودکارسازی</span>
                  )}
                  {selectedCase.regressionCandidate && (
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">کاندید رگرسیون</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 md:grid-cols-4">
              <div>
                <p className="text-gray-500">سامانه</p>
                <p className="font-medium">{getApplicationName(selectedCase.applicationId)}</p>
              </div>
              <div>
                <p className="text-gray-500">نوع تست</p>
                <p className="font-medium">{TEST_TYPE_LABELS[selectedCase.testType]}</p>
              </div>
              <div>
                <p className="text-gray-500">تکنیک طراحی</p>
                <p className="font-medium">{getDesignTechniqueLabel(selectedCase)}</p>
              </div>
              <div>
                <p className="text-gray-500">سطح ریسک</p>
                <PriorityBadge priority={selectedCase.riskLevel} />
              </div>
              <div>
                <p className="text-gray-500">ویژگی کیفی</p>
                <p className="font-medium">{QUALITY_ATTRIBUTE_LABELS[selectedCase.qualityAttribute]}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">نیازمندی</p>
                <p className="font-medium">{getRequirementTitle(selectedCase)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">جریان</p>
                <p className="font-medium">{getFlowTitle(selectedCase)}</p>
              </div>
            </div>

            {!!selectedCase.readinessErrors?.length && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-700 mb-1">دلایل ناقص بودن</p>
                <p className="text-sm text-amber-800">{selectedCase.readinessErrors.join(', ')}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">سناریو</p>
                <p className="text-sm">{selectedCase.scenario}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">پیش‌شرط‌ها</p>
                <p className="text-sm whitespace-pre-wrap">{selectedCase.preconditions}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">داده‌های تست</p>
                <p className="text-sm whitespace-pre-wrap">{selectedCase.testData}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">مراحل</p>
                <p className="text-sm whitespace-pre-wrap">{selectedCase.steps}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-gray-500 mb-1">نتیجه مورد انتظار</p>
                <p className="text-sm">{selectedCase.expectedResult}</p>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                بستن
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="ایجاد تست کیس جدید"
        size="full"
      >
        <div className="space-y-4">
          <ApplicationSelect
            label="سامانه تست کیس"
            required
            value={formApplicationId}
            onChange={(applicationId) => {
              setFormApplicationId(applicationId);
              setFormData(prev => ({ ...prev, requirementId: '', testRequestId: '', flowId: '' }));
              setFlows([]);
              clearFormError('applicationId');
              clearFormError('requirementId');
              clearFormError('flowId');
            }}
            error={formErrors.applicationId}
            hint="پس از انتخاب سامانه، فقط نیازمندی‌های همان سامانه نمایش داده می‌شوند."
          />
          {/* Item #2: Required Requirement selection */}
          <Select
            label="نیازمندی مرتبط * (اجباری)"
            value={formData.requirementId}
            onChange={(e) => { clearFormError('requirementId'); clearFormError('flowId'); setFormData({ ...formData, requirementId: e.target.value, testRequestId: '', flowId: '' }); }}
            options={requirementOptions}
            placeholder="یک نیازمندی موجود را انتخاب کنید"
            error={formErrors.requirementId}
          />
          {!formData.requirementId && (
            <p className="text-xs text-amber-600">⚠ هر تست کیس باید به یک نیازمندی موجود متصل باشد.</p>
          )}
          <Select
            label="جریان *"
            value={formData.flowId}
            onChange={(e) => { clearFormError('flowId'); setFormData({ ...formData, flowId: e.target.value }); }}
            options={flows.map(f => ({ value: f.id, label: f.title }))}
            placeholder="جریان مرتبط با نیازمندی را انتخاب کنید"
            disabled={!formData.requirementId}
            error={formErrors.flowId}
          />
          <TestCaseContextAccordion
            requirement={selectedRequirement}
            flow={selectedFlow}
            testRequest={selectedTestRequest}
            applicationName={selectedRequirementApplicationName}
          />
          <Input
            label="عنوان *"
            value={formData.title}
            maxLength={TEST_CASE_TITLE_MAX_LENGTH}
            onChange={(e) => { clearFormError('title'); updateLimitedTextField('title', e.target.value, TEST_CASE_TITLE_MAX_LENGTH); }}
            placeholder="عنوان تست کیس را وارد کنید"
            hint={`${formData.title.length}/${TEST_CASE_TITLE_MAX_LENGTH}`}
            error={formErrors.title}
          />
          <Textarea
            label="سناریو *"
            value={formData.scenario}
            maxLength={TEST_CASE_BODY_MAX_LENGTH}
            showCounter
            onChange={(e) => { clearFormError('scenario'); updateLimitedTextField('scenario', e.target.value, TEST_CASE_BODY_MAX_LENGTH); }}
            error={formErrors.scenario}
          />
          <Textarea
            label="پیش‌شرط‌ها *"
            value={formData.preconditions}
            maxLength={TEST_CASE_BODY_MAX_LENGTH}
            showCounter
            onChange={(e) => { clearFormError('preconditions'); updateLimitedTextField('preconditions', e.target.value, TEST_CASE_BODY_MAX_LENGTH); }}
            error={formErrors.preconditions}
          />
          <Textarea
            label="داده‌های تست *"
            value={formData.testData}
            maxLength={TEST_CASE_BODY_MAX_LENGTH}
            showCounter
            onChange={(e) => { clearFormError('testData'); updateLimitedTextField('testData', e.target.value, TEST_CASE_BODY_MAX_LENGTH); }}
            error={formErrors.testData}
          />
          <Textarea
            label="مراحل *"
            value={formData.steps}
            maxLength={TEST_CASE_BODY_MAX_LENGTH}
            showCounter
            onChange={(e) => { clearFormError('steps'); updateLimitedTextField('steps', e.target.value, TEST_CASE_BODY_MAX_LENGTH); }}
            error={formErrors.steps}
          />
          <Textarea
            label="نتیجه مورد انتظار *"
            value={formData.expectedResult}
            maxLength={TEST_CASE_BODY_MAX_LENGTH}
            showCounter
            onChange={(e) => { clearFormError('expectedResult'); updateLimitedTextField('expectedResult', e.target.value, TEST_CASE_BODY_MAX_LENGTH); }}
            error={formErrors.expectedResult}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
            <Select
              label="نوع تست"
              value={formData.testType}
              onChange={(e) => setFormData({ ...formData, testType: e.target.value as TestType })}
              options={Object.entries(TEST_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <Select
              label="اولویت"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
              options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <Select
              label="سطح ریسک"
              value={formData.riskLevel}
              onChange={(e) => setFormData({ ...formData, riskLevel: e.target.value as Priority })}
              options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <Select
              label="ویژگی کیفی"
              value={formData.qualityAttribute}
              onChange={(e) => setFormData({ ...formData, qualityAttribute: e.target.value as QualityAttribute })}
              options={Object.entries(QUALITY_ATTRIBUTE_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">تکنیک‌های طراحی تست</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(TEST_DESIGN_TECHNIQUE_LABELS).map(([value, label]) => {
                const typedValue = value as TestDesignTechnique;
                const checked = formData.testDesignTechniques.includes(typedValue);
                return (
                  <label key={value} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checked ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDesignTechnique(typedValue)}
                      className="w-4 h-4 rounded"
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
            {formErrors.testDesignTechniques && <p className="mt-1 text-sm text-red-600">{formErrors.testDesignTechniques}</p>}
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.automationCandidate}
                onChange={(e) => setFormData({ ...formData, automationCandidate: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">کاندید خودکارسازی</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.regressionCandidate}
                onChange={(e) => setFormData({ ...formData, regressionCandidate: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">کاندید رگرسیون</span>
            </label>
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>انصراف</Button>
            <Button
              onClick={handleCreate}
              loading={actionLoading}
              disabled={actionLoading}
            >
              ایجاد
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="ویرایش تست کیس"
        size="full"
      >
        <div className="space-y-4">
          <ApplicationSelect
            label="سامانه تست کیس"
            required
            value={formApplicationId}
            onChange={() => undefined}
            disabled
            error={formErrors.applicationId}
            hint="سامانه از نیازمندی اصلی تست کیس مشتق شده و قابل تغییر نیست."
          />
          <Select
            label="نیازمندی مرتبط * (اجباری)"
            value={formData.requirementId}
            onChange={(e) => { clearFormError('requirementId'); clearFormError('flowId'); setFormData({ ...formData, requirementId: e.target.value, testRequestId: '', flowId: '' }); }}
            options={requirementOptions}
            placeholder="یک نیازمندی موجود را انتخاب کنید"
            error={formErrors.requirementId}
          />
          <Select
            label="جریان *"
            value={formData.flowId}
            onChange={(e) => { clearFormError('flowId'); setFormData({ ...formData, flowId: e.target.value }); }}
            options={flows.map(f => ({ value: f.id, label: f.title }))}
            placeholder="جریان مرتبط با نیازمندی را انتخاب کنید"
            disabled={!formData.requirementId}
            error={formErrors.flowId}
          />
          <TestCaseContextAccordion
            requirement={selectedRequirement}
            flow={selectedFlow}
            testRequest={selectedTestRequest}
            applicationName={selectedRequirementApplicationName}
          />
          <Input
            label="عنوان *"
            value={formData.title}
            maxLength={TEST_CASE_TITLE_MAX_LENGTH}
            onChange={(e) => { clearFormError('title'); updateLimitedTextField('title', e.target.value, TEST_CASE_TITLE_MAX_LENGTH); }}
            placeholder="عنوان تست کیس را وارد کنید"
            hint={`${formData.title.length}/${TEST_CASE_TITLE_MAX_LENGTH}`}
            error={formErrors.title}
          />
          <Textarea
            label="سناریو *"
            value={formData.scenario}
            maxLength={TEST_CASE_BODY_MAX_LENGTH}
            showCounter
            onChange={(e) => { clearFormError('scenario'); updateLimitedTextField('scenario', e.target.value, TEST_CASE_BODY_MAX_LENGTH); }}
            error={formErrors.scenario}
          />
          <Textarea
            label="پیش‌شرط‌ها *"
            value={formData.preconditions}
            maxLength={TEST_CASE_BODY_MAX_LENGTH}
            showCounter
            onChange={(e) => { clearFormError('preconditions'); updateLimitedTextField('preconditions', e.target.value, TEST_CASE_BODY_MAX_LENGTH); }}
            error={formErrors.preconditions}
          />
          <Textarea
            label="داده‌های تست *"
            value={formData.testData}
            maxLength={TEST_CASE_BODY_MAX_LENGTH}
            showCounter
            onChange={(e) => { clearFormError('testData'); updateLimitedTextField('testData', e.target.value, TEST_CASE_BODY_MAX_LENGTH); }}
            error={formErrors.testData}
          />
          <Textarea
            label="مراحل *"
            value={formData.steps}
            maxLength={TEST_CASE_BODY_MAX_LENGTH}
            showCounter
            onChange={(e) => { clearFormError('steps'); updateLimitedTextField('steps', e.target.value, TEST_CASE_BODY_MAX_LENGTH); }}
            error={formErrors.steps}
          />
          <Textarea
            label="نتیجه مورد انتظار *"
            value={formData.expectedResult}
            maxLength={TEST_CASE_BODY_MAX_LENGTH}
            showCounter
            onChange={(e) => { clearFormError('expectedResult'); updateLimitedTextField('expectedResult', e.target.value, TEST_CASE_BODY_MAX_LENGTH); }}
            error={formErrors.expectedResult}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
            <Select
              label="نوع تست"
              value={formData.testType}
              onChange={(e) => setFormData({ ...formData, testType: e.target.value as TestType })}
              options={Object.entries(TEST_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <Select
              label="اولویت"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
              options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <Select
              label="سطح ریسک"
              value={formData.riskLevel}
              onChange={(e) => setFormData({ ...formData, riskLevel: e.target.value as Priority })}
              options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <Select
              label="ویژگی کیفی"
              value={formData.qualityAttribute}
              onChange={(e) => setFormData({ ...formData, qualityAttribute: e.target.value as QualityAttribute })}
              options={Object.entries(QUALITY_ATTRIBUTE_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">تکنیک‌های طراحی تست</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(TEST_DESIGN_TECHNIQUE_LABELS).map(([value, label]) => {
                const typedValue = value as TestDesignTechnique;
                const checked = formData.testDesignTechniques.includes(typedValue);
                return (
                  <label key={value} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checked ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDesignTechnique(typedValue)}
                      className="w-4 h-4 rounded"
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
            {formErrors.testDesignTechniques && <p className="mt-1 text-sm text-red-600">{formErrors.testDesignTechniques}</p>}
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.automationCandidate}
                onChange={(e) => setFormData({ ...formData, automationCandidate: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">کاندید خودکارسازی</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.regressionCandidate}
                onChange={(e) => setFormData({ ...formData, regressionCandidate: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">کاندید رگرسیون</span>
            </label>
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>انصراف</Button>
            <Button
              onClick={handleUpdate}
              loading={actionLoading}
              disabled={actionLoading}
            >
              ذخیره تغییرات
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete ConfirmModal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteTestCase}
        title="حذف تست کیس"
        message={`آیا از حذف تست کیس «${deleteTarget?.title}» اطمینان دارید؟`}
        variant="danger"
        confirmText="حذف"
        loading={actionLoading}
      />
    </div>
  );
};
