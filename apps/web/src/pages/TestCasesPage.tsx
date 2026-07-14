import React, { useState, useEffect } from 'react';
import { Plus, Eye, Search, Edit, Trash2 } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Table, Pagination, ExportButton, exportToExcel } from '../components/ui/Table';
import { StatusBadge, PriorityBadge } from '../components/ui/Badge';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Input, Textarea, Select } from '../components/ui/Input';
import { useAuthStore, canPerformAction } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
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
  priority: Priority;
  riskLevel: Priority;
  qualityAttribute: QualityAttribute;
  automationCandidate: boolean;
  regressionCandidate: boolean;
  testRequestId: string;
  requirementId: string;
  flowId: string;
}

const createEmptyFormState = (): TestCaseFormState => ({
  title: '',
  scenario: '',
  preconditions: '',
  testData: '',
  steps: '',
  expectedResult: '',
  testType: 'FUNCTIONAL',
  testDesignTechnique: 'REQUIREMENTS_BASED',
  priority: 'MEDIUM',
  riskLevel: 'MEDIUM',
  qualityAttribute: 'FUNCTIONALITY',
  automationCandidate: false,
  regressionCandidate: false,
  testRequestId: '',
  requirementId: '',
  flowId: '',
});

export const TestCasesPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { appId, defaultApplicationId } = useDataScope();
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

  const [testRequests, setTestRequests] = useState<TestRequest[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TestCase | null>(null);

  useEffect(() => {
    if (activeContext) {
      loadData();
      loadTestRequests();
      loadRequirements();
    }
  }, [activeContext, filters]);

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
    setFlows([]);
    setFormErrors({});
  };

  const fillFormFromCase = (testCase: TestCase) => {
    setFormData({
      title: testCase.title || '',
      scenario: testCase.scenario || '',
      preconditions: testCase.preconditions || '',
      testData: testCase.testData || '',
      steps: testCase.steps || '',
      expectedResult: testCase.expectedResult || '',
      testType: testCase.testType || 'FUNCTIONAL',
      testDesignTechnique: testCase.testDesignTechnique || 'REQUIREMENTS_BASED',
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

    if (!formData.requirementId || !selectedRequirement) {
      errors.requirementId = 'انتخاب نیازمندی آماده الزامی است.';
    } else if (!['COMPLETED', 'APPROVED'].includes(selectedRequirement.status)) {
      errors.requirementId = 'نیازمندی ناقص یا غیرفعال برای Test Case قابل انتخاب نیست.';
    }

    if (!formData.flowId || !selectedFlow) {
      errors.flowId = 'انتخاب Flow مرتبط با نیازمندی الزامی است.';
    } else if (selectedRequirement && selectedFlow.requirementId !== selectedRequirement.id) {
      errors.flowId = 'Flow باید متعلق به نیازمندی انتخاب‌شده باشد.';
    }

    if (!formData.title.trim()) errors.title = 'عنوان تست کیس الزامی است.';
    if (!formData.scenario.trim()) errors.scenario = 'سناریو الزامی است.';
    if (!formData.preconditions.trim()) errors.preconditions = 'پیش‌شرط‌ها الزامی است.';
    if (!formData.testData.trim()) errors.testData = 'داده‌های تست الزامی است.';
    if (!formData.steps.trim()) errors.steps = 'مراحل تست الزامی است.';
    if (!formData.expectedResult.trim()) errors.expectedResult = 'نتیجه مورد انتظار الزامی است.';

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
          priority: formData.priority,
          riskLevel: formData.riskLevel,
          qualityAttribute: formData.qualityAttribute,
          status: 'READY',
          isActive: true,
        },
        activeContext.userId,
        selectedRequirement.applicationId || selectedTestRequest?.applicationId || defaultApplicationId
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
            <button onClick={(e) => {
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
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${
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

      <main className="p-6">
        <Card className="mb-6" padding="sm">
          <div className="flex flex-wrap gap-4 items-center">
            {canCreate && <Button icon={<Plus className="w-4 h-4" />} onClick={() => { resetForm(); setShowCreateModal(true); }}>تست کیس جدید</Button>}
            <ExportButton onClick={() => exportToExcel(data?.data || [], [
              { key: 'title', title: 'عنوان' }, { key: 'testType', title: 'نوع تست' },
              { key: 'priority', title: 'اولویت' }, { key: 'status', title: 'وضعیت' },
            ], 'test-cases')} disabled={!data?.data?.length} />
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
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
            >
              <option value="">همه وضعیت‌ها</option>
              {Object.entries(TEST_CASE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">نوع تست</p>
                <p className="font-medium">{TEST_TYPE_LABELS[selectedCase.testType]}</p>
              </div>
              <div>
                <p className="text-gray-500">تکنیک طراحی</p>
                <p className="font-medium">{TEST_DESIGN_TECHNIQUE_LABELS[selectedCase.testDesignTechnique]}</p>
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
                <p className="text-xs text-gray-500 mb-1">Requirement</p>
                <p className="font-medium">{selectedCase.requirementId}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Flow</p>
                <p className="font-medium">{selectedCase.flowId || '-'}</p>
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
          {/* Item #2: Required Requirement selection */}
          <Select
            label="نیازمندی مرتبط * (اجباری)"
            value={formData.requirementId}
            onChange={(e) => { clearFormError('requirementId'); clearFormError('flowId'); setFormData({ ...formData, requirementId: e.target.value, testRequestId: '', flowId: '' }); }}
            options={requirements.map(r => ({ value: r.id, label: r.title }))}
            placeholder="یک نیازمندی موجود را انتخاب کنید"
            error={formErrors.requirementId}
          />
          {!formData.requirementId && (
            <p className="text-xs text-amber-600">⚠ هر تست کیس باید به یک نیازمندی موجود متصل باشد.</p>
          )}
          <Select
            label="Flow *"
            value={formData.flowId}
            onChange={(e) => { clearFormError('flowId'); setFormData({ ...formData, flowId: e.target.value }); }}
            options={flows.map(f => ({ value: f.id, label: f.title }))}
            placeholder="جریان مرتبط با Requirement را انتخاب کنید"
            disabled={!formData.requirementId}
            error={formErrors.flowId}
          />
          <Input
            label="عنوان *"
            value={formData.title}
            onChange={(e) => { clearFormError('title'); setFormData({ ...formData, title: e.target.value }); }}
            placeholder="عنوان تست کیس را وارد کنید"
            error={formErrors.title}
          />
          <Textarea
            label="سناریو *"
            value={formData.scenario}
            onChange={(e) => { clearFormError('scenario'); setFormData({ ...formData, scenario: e.target.value }); }}
            error={formErrors.scenario}
          />
          <Textarea
            label="پیش‌شرط‌ها *"
            value={formData.preconditions}
            onChange={(e) => { clearFormError('preconditions'); setFormData({ ...formData, preconditions: e.target.value }); }}
            error={formErrors.preconditions}
          />
          <Textarea
            label="داده‌های تست *"
            value={formData.testData}
            onChange={(e) => { clearFormError('testData'); setFormData({ ...formData, testData: e.target.value }); }}
            error={formErrors.testData}
          />
          <Textarea
            label="مراحل *"
            value={formData.steps}
            onChange={(e) => { clearFormError('steps'); setFormData({ ...formData, steps: e.target.value }); }}
            error={formErrors.steps}
          />
          <Textarea
            label="نتیجه مورد انتظار *"
            value={formData.expectedResult}
            onChange={(e) => { clearFormError('expectedResult'); setFormData({ ...formData, expectedResult: e.target.value }); }}
            error={formErrors.expectedResult}
          />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Select
              label="نوع تست"
              value={formData.testType}
              onChange={(e) => setFormData({ ...formData, testType: e.target.value as TestType })}
              options={Object.entries(TEST_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <Select
              label="تکنیک طراحی"
              value={formData.testDesignTechnique}
              onChange={(e) => setFormData({ ...formData, testDesignTechnique: e.target.value as TestDesignTechnique })}
              options={Object.entries(TEST_DESIGN_TECHNIQUE_LABELS).map(([value, label]) => ({ value, label }))}
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
          <Select
            label="نیازمندی مرتبط * (اجباری)"
            value={formData.requirementId}
            onChange={(e) => { clearFormError('requirementId'); clearFormError('flowId'); setFormData({ ...formData, requirementId: e.target.value, testRequestId: '', flowId: '' }); }}
            options={requirements.map(r => ({ value: r.id, label: r.title }))}
            placeholder="یک نیازمندی موجود را انتخاب کنید"
            error={formErrors.requirementId}
          />
          <Select
            label="Flow *"
            value={formData.flowId}
            onChange={(e) => { clearFormError('flowId'); setFormData({ ...formData, flowId: e.target.value }); }}
            options={flows.map(f => ({ value: f.id, label: f.title }))}
            placeholder="جریان مرتبط با Requirement را انتخاب کنید"
            disabled={!formData.requirementId}
            error={formErrors.flowId}
          />
          <Input
            label="عنوان *"
            value={formData.title}
            onChange={(e) => { clearFormError('title'); setFormData({ ...formData, title: e.target.value }); }}
            placeholder="عنوان تست کیس را وارد کنید"
            error={formErrors.title}
          />
          <Textarea
            label="سناریو *"
            value={formData.scenario}
            onChange={(e) => { clearFormError('scenario'); setFormData({ ...formData, scenario: e.target.value }); }}
            error={formErrors.scenario}
          />
          <Textarea
            label="پیش‌شرط‌ها *"
            value={formData.preconditions}
            onChange={(e) => { clearFormError('preconditions'); setFormData({ ...formData, preconditions: e.target.value }); }}
            error={formErrors.preconditions}
          />
          <Textarea
            label="داده‌های تست *"
            value={formData.testData}
            onChange={(e) => { clearFormError('testData'); setFormData({ ...formData, testData: e.target.value }); }}
            error={formErrors.testData}
          />
          <Textarea
            label="مراحل *"
            value={formData.steps}
            onChange={(e) => { clearFormError('steps'); setFormData({ ...formData, steps: e.target.value }); }}
            error={formErrors.steps}
          />
          <Textarea
            label="نتیجه مورد انتظار *"
            value={formData.expectedResult}
            onChange={(e) => { clearFormError('expectedResult'); setFormData({ ...formData, expectedResult: e.target.value }); }}
            error={formErrors.expectedResult}
          />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Select
              label="نوع تست"
              value={formData.testType}
              onChange={(e) => setFormData({ ...formData, testType: e.target.value as TestType })}
              options={Object.entries(TEST_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <Select
              label="تکنیک طراحی"
              value={formData.testDesignTechnique}
              onChange={(e) => setFormData({ ...formData, testDesignTechnique: e.target.value as TestDesignTechnique })}
              options={Object.entries(TEST_DESIGN_TECHNIQUE_LABELS).map(([value, label]) => ({ value, label }))}
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
        onConfirm={async () => {
          if (!deleteTarget) return;
          toast.success(`تست کیس «${deleteTarget.title}» حذف شد.`);
          setShowDeleteConfirm(false);
          setDeleteTarget(null);
          loadData();
        }}
        title="حذف تست کیس"
        message={`آیا از حذف تست کیس «${deleteTarget?.title}» اطمینان دارید؟`}
        variant="danger"
        confirmText="حذف"
        loading={actionLoading}
      />
    </div>
  );
};
