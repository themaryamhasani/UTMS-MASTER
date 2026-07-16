import { useState, useEffect } from 'react';
import { Plus, Eye, FileText, GitBranch, Edit, Trash2 } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Table, Pagination } from '../components/ui/Table';
import { CartableExcelExportButton, CartableSearchInput, CartableSelectFilter } from '../components/ui/CartableToolbar';
import { StatusBadge } from '../components/ui/Badge';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Input, Textarea } from '../components/ui/Input';
import { ApplicationSelect } from '../components/ui/ApplicationSelect';
import { useAuthStore, canPerformAction } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import { useApplicationLookup } from '../utils/useApplicationLookup';
import { requirementApi, flowApi } from '../services/api';
import { toast } from '../components/ui/Toast';
import type { Requirement, Flow, CartableFilterParams, PaginatedResponse } from '../types';
import { REQUIREMENT_STATUS_LABELS } from '../types';

export const RequirementsPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { appId, defaultApplicationId, isAppLevel, isMultiSystem } = useDataScope();
  const { shouldShowSystemColumn, getApplicationName } = useApplicationLookup();
  const [data, setData] = useState<PaginatedResponse<Requirement> | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CartableFilterParams>({
    page: 1, limit: 10, search: '', status: '', sortBy: 'createdAt', sortOrder: 'desc',
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [requirementFlows, setRequirementFlows] = useState<Flow[]>([]);
  const [formData, setFormData] = useState({ title: '', description: '', acceptanceCriteria: '', riskNotes: '' });
  const [createApplicationId, setCreateApplicationId] = useState('');
  const [flowFormData, setFlowFormData] = useState({ title: '', description: '', steps: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  // Inline flows during creation
  const [createFlows, setCreateFlows] = useState<Array<{ title: string; description: string; steps: string }>>([]);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Requirement | null>(null);
  const [flowDeleteTarget, setFlowDeleteTarget] = useState<Flow | null>(null);

  const role = activeContext?.role;
  const isDeveloper = role === 'DEVELOPER';
  const canCreate = canPerformAction(role!, 'requirement:create');
  const canEdit = canPerformAction(role!, 'requirement:edit') && !isDeveloper;
  const canDeleteReq = canPerformAction(role!, 'requirement:delete') && !isDeveloper;
  const canToggle = canPerformAction(role!, 'requirement:edit') && !isDeveloper;
  const canCreateFlow = canPerformAction(role!, 'flow:create') && !isDeveloper;

  useEffect(() => { if (activeContext) loadData(); }, [activeContext, filters]);
  useEffect(() => { if (selectedRequirement && showDetailModal) loadFlows(); }, [selectedRequirement, showDetailModal]);

  const loadData = async () => {
    if (!activeContext) return;
    setLoading(true);
    try {
      const response = await requirementApi.getAll(appId, filters);
      // Item #11: Hide inactive (DRAFT) requirements from everyone except QA_LEAD and SYSTEM_ADMIN
      if (role !== 'QA_LEAD' && role !== 'SYSTEM_ADMIN') {
        response.data = response.data.filter(r => r.status !== 'DRAFT');
        response.total = response.data.length;
      }
      setData(response);
    }
    catch { /* silent */ } finally { setLoading(false); }
  };

  const loadFlows = async () => {
    if (!selectedRequirement) return;
    try { setRequirementFlows(await flowApi.getByRequirement(selectedRequirement.id)); } catch { /* */ }
  };

  const handleCreate = async () => {
    if (!activeContext) return;
    const errors: Record<string, string> = {};
    if (!createApplicationId) errors.applicationId = 'انتخاب سامانه الزامی است.';
    if (!formData.title.trim()) errors.title = 'عنوان نیازمندی الزامی است.';
    if (!formData.description.trim()) errors.description = 'توضیحات نیازمندی الزامی است.';
    if (createFlows.length === 0) errors.flows = 'حداقل یک جریان برای نیازمندی الزامی است.';
    createFlows.forEach((flow, index) => {
      if (!flow.title.trim()) errors[`createFlow-${index}-title`] = 'عنوان جریان الزامی است.';
      if (!flow.description.trim()) errors[`createFlow-${index}-description`] = 'توضیحات جریان الزامی است.';
    });
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setActionLoading(true);
    try {
      const created = await requirementApi.create(formData, activeContext.userId, createApplicationId);
      // Create inline flows when provided.
      for (const flow of createFlows) {
        if (flow.title.trim()) {
          await flowApi.create({ ...flow, requirementId: created.id }, activeContext.userId);
        }
      }
      setShowCreateModal(false);
      resetForm();
      toast.success('نیازمندی ایجاد شد.');
      loadData();
    } catch { toast.error('خطا در ایجاد.'); }
    finally { setActionLoading(false); }
  };

  const handleUpdate = async () => {
    if (!activeContext || !selectedRequirement) return;
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = 'عنوان نیازمندی الزامی است.';
    if (!formData.description.trim()) errors.description = 'توضیحات نیازمندی الزامی است.';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setActionLoading(true);
    try {
      await requirementApi.update(selectedRequirement.id, formData, activeContext.userId);
      setShowDetailModal(false);
      toast.success('نیازمندی بروزرسانی شد.');
      loadData();
    } catch { toast.error('خطا.'); } finally { setActionLoading(false); }
  };

  const handleCreateFlow = async () => {
    if (!activeContext || !selectedRequirement) return;
    const errors: Record<string, string> = {};
    if (!flowFormData.title.trim()) errors.flowTitle = 'عنوان جریان الزامی است.';
    if (!flowFormData.description.trim()) errors.flowDescription = 'توضیحات جریان الزامی است.';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setActionLoading(true);
    try {
      await flowApi.create({ ...flowFormData, requirementId: selectedRequirement.id }, activeContext.userId);
      setShowFlowModal(false);
      setFlowFormData({ title: '', description: '', steps: '' });
      loadFlows();
      // Reload main data to update flow count in table
      loadData();
      toast.success('جریان ایجاد شد.');
    } catch { toast.error('خطا.'); } finally { setActionLoading(false); }
  };

  const handleDeleteFlow = async () => {
    if (!flowDeleteTarget) return;
    setActionLoading(true);
    try {
      await flowApi.delete(flowDeleteTarget.id);
      setFlowDeleteTarget(null);
      loadFlows();
      loadData();
      toast.success('جریان با موفقیت حذف شد.');
    } catch {
      toast.error('خطا در حذف جریان.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (item: Requirement) => {
    if (!activeContext || !canToggle) return;
    const newStatus = (item.status === 'APPROVED' || item.status === 'COMPLETED') ? 'DRAFT' : 'APPROVED';
    if (newStatus === 'APPROVED') {
      const itemFlows = item.flows?.length ? item.flows : await flowApi.getByRequirement(item.id);
      if (itemFlows.length === 0) {
        toast.error('برای فعال کردن نیازمندی، حداقل یک جریان باید ثبت شده باشد.');
        return;
      }
    }
    try {
      await requirementApi.update(item.id, { status: newStatus }, activeContext.userId);
      toast.success(newStatus === 'APPROVED' ? 'نیازمندی فعال شد.' : 'نیازمندی غیرفعال شد.');
      loadData();
    } catch { toast.error('خطا.'); }
  };

  const handleDeleteReq = async () => {
    if (!deleteTarget || !activeContext) return;
    setActionLoading(true);
    try {
      await requirementApi.delete(deleteTarget.id);
      toast.success(`نیازمندی «${deleteTarget.title}» حذف شد.`);
      setShowDeleteConfirm(false); setDeleteTarget(null); loadData();
    } catch { toast.error('خطا در حذف نیازمندی.'); } finally { setActionLoading(false); }
  };

  const resetForm = () => {
    setCreateApplicationId(isAppLevel || isMultiSystem ? '' : defaultApplicationId);
    setFormData({ title: '', description: '', acceptanceCriteria: '', riskNotes: '' });
    setCreateFlows([{ title: '', description: '', steps: '' }]);
    setFormErrors({});
  };

  const openDetail = (req: Requirement) => {
    setSelectedRequirement(req);
    setFormData({ title: req.title, description: req.description, acceptanceCriteria: req.acceptanceCriteria || '', riskNotes: req.riskNotes || '' });
    setFormErrors({});
    setShowDetailModal(true);
  };

  if (!activeContext) return null;

  const columns = [
    {
      key: 'title', title: 'عنوان', sortable: true,
      render: (item: Requirement) => (
        <div><p className="font-medium text-gray-900">{item.title}</p><p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p></div>
      ),
    },
    ...(shouldShowSystemColumn ? [{
      key: 'applicationId',
      title: 'سامانه',
      render: (item: Requirement) => <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{getApplicationName(item.applicationId)}</span>,
    }] : []),
    { key: 'createdBy', title: 'ایجادکننده', render: (item: Requirement) => item.createdBy?.fullName || '-' },
    {
      key: 'flows', title: 'جریان‌ها',
      render: (item: Requirement) => <span className="text-sm text-gray-600">{item.flows?.length || 0} جریان</span>,
    },
    { key: 'createdAt', title: 'تاریخ', sortable: true, render: (item: Requirement) => new Date(item.createdAt).toLocaleDateString('fa-IR') },
    {
      key: 'actions', title: 'عملیات',
      render: (item: Requirement) => (
        <div className="flex items-center gap-2">
          {/* Toggle — under actions, only for non-developers */}
           {canToggle && (
            <button type="button" role="switch" aria-checked={item.status === 'APPROVED' || item.status === 'COMPLETED'} aria-label={`فعال بودن نیازمندی ${item.title}`} onClick={(e) => { e.stopPropagation(); handleToggleStatus(item); }}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                item.status === 'APPROVED' || item.status === 'COMPLETED' ? 'bg-green-500' : 'bg-gray-300'
              }`}
              dir="ltr">
              <span className={`theme-switch-thumb pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
                item.status === 'APPROVED' || item.status === 'COMPLETED' ? 'translate-x-5' : 'translate-x-1'
              }`} />
            </button>
          )}
          {/* Developer only sees view */}
          <Button size="sm" variant="ghost" icon={<Eye className="w-4 h-4" />}
            onClick={(e) => { e.stopPropagation(); openDetail(item); }}>مشاهده</Button>
          {canEdit && (
            <Button size="sm" variant="ghost" icon={<Edit className="w-4 h-4" />}
              onClick={(e) => { e.stopPropagation(); openDetail(item); }}>ویرایش</Button>
          )}
          {canDeleteReq && (
            <Button size="sm" variant="ghost" className="text-red-600" icon={<Trash2 className="w-4 h-4" />}
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); setShowDeleteConfirm(true); }}>حذف</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="کارتابل نیازمندی‌ها" subtitle={`${data?.total || 0} نیازمندی`}
        onRefresh={loadData} refreshing={loading} />

      <main className="p-4 sm:p-6">
        {/* Item #8: Add button moved next to search */}
        <Card className="mb-6" padding="sm">
          <div className="flex flex-wrap gap-4 items-center">
            {canCreate && !isDeveloper && (
              <Button icon={<Plus className="w-4 h-4" />} onClick={() => { resetForm(); setShowCreateModal(true); }}>نیازمندی جدید</Button>
            )}
            <CartableExcelExportButton
              data={data?.data || []}
              columns={[
                { key: 'title', title: 'عنوان' }, { key: 'status', title: 'وضعیت' },
              ]}
              filename="requirements"
              disabled={!data?.data?.length}
            />
            <CartableSearchInput
              value={filters.search || ''}
              onChange={(search) => setFilters({ ...filters, search, page: 1 })}
            />
            <CartableSelectFilter
              value={filters.status || ''}
              onChange={(status) => setFilters({ ...filters, status, page: 1 })}
              options={Object.entries(REQUIREMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </div>
        </Card>

        <Table columns={columns} data={data?.data || []} loading={loading} emptyMessage="نیازمندی‌ای یافت نشد"
          sortBy={filters.sortBy} sortOrder={filters.sortOrder}
          onSort={(key) => setFilters({ ...filters, sortBy: key, sortOrder: filters.sortBy === key && filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
          onRowClick={openDetail}
          enableClientFilter={false}
          enableExport={false}
          enableColumnChooser={false} />

        {data && <Pagination page={data.page} totalPages={data.totalPages || 1} total={data.total} limit={data.limit || filters.limit}
          onPageChange={(p) => setFilters({ ...filters, page: p })}
          onLimitChange={(l) => setFilters({ ...filters, limit: l, page: 1 })} />}
      </main>

      {/* Create Modal — with inline flow creation */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="ایجاد نیازمندی جدید" size="xl">
        <div className="space-y-4">
          <ApplicationSelect
            label="سامانه نیازمندی"
            required
            value={createApplicationId}
            onChange={(applicationId) => {
              setCreateApplicationId(applicationId);
              setFormErrors(prev => ({ ...prev, applicationId: '' }));
            }}
            error={formErrors.applicationId}
            hint="این نیازمندی و تمام جریان‌های آن به سامانه انتخاب‌شده تعلق خواهند داشت."
          />
          <Input label="عنوان *" value={formData.title} onChange={(e) => { setFormErrors(prev => ({ ...prev, title: '' })); setFormData({ ...formData, title: e.target.value }); }} placeholder="عنوان نیازمندی" error={formErrors.title} />
          <Textarea label="توضیحات *" value={formData.description} onChange={(e) => { setFormErrors(prev => ({ ...prev, description: '' })); setFormData({ ...formData, description: e.target.value }); }} placeholder="توضیحات نیازمندی" error={formErrors.description} />
          <Textarea label="معیارهای پذیرش" value={formData.acceptanceCriteria} onChange={(e) => setFormData({ ...formData, acceptanceCriteria: e.target.value })} placeholder="معیارهای پذیرش" />
          <Textarea label="یادداشت‌های ریسک" value={formData.riskNotes} onChange={(e) => setFormData({ ...formData, riskNotes: e.target.value })} placeholder="ریسک‌ها" />

          {/* Inline Flow Creation */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900 flex items-center gap-2"><GitBranch className="w-4 h-4 text-purple-500" /> جریان‌ها ({createFlows.length})</h4>
              <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => { setFormErrors(prev => ({ ...prev, flows: '' })); setCreateFlows([...createFlows, { title: '', description: '', steps: '' }]); }}>
                افزودن جریان
              </Button>
            </div>
            {formErrors.flows && <p className="mb-2 text-sm text-red-600">{formErrors.flows}</p>}
            {createFlows.map((flow, idx) => (
              <div key={idx} className="p-3 bg-purple-50 rounded-lg border border-purple-200 mb-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-purple-800">جریان {idx + 1}</span>
                  <button onClick={() => setCreateFlows(createFlows.filter((_, i) => i !== idx))} className="text-red-500 text-xs">حذف</button>
                </div>
                <Input
                  label="عنوان جریان *"
                  value={flow.title}
                  onChange={(e) => { const nf = [...createFlows]; if (!nf[idx]) return; nf[idx].title = e.target.value; setCreateFlows(nf); setFormErrors(prev => ({ ...prev, [`createFlow-${idx}-title`]: '' })); }}
                  placeholder="عنوان"
                  error={formErrors[`createFlow-${idx}-title`]}
                />
                <Textarea
                  label="توضیحات جریان *"
                  value={flow.description}
                  onChange={(e) => { const nf = [...createFlows]; if (!nf[idx]) return; nf[idx].description = e.target.value; setCreateFlows(nf); setFormErrors(prev => ({ ...prev, [`createFlow-${idx}-description`]: '' })); }}
                  placeholder="توضیحات"
                  error={formErrors[`createFlow-${idx}-description`]}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>انصراف</Button>
            <Button onClick={handleCreate} loading={actionLoading} disabled={actionLoading}>ایجاد</Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="جزئیات نیازمندی" size="xl">
        {selectedRequirement && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg"><FileText className="w-6 h-6 text-blue-600" /></div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedRequirement.title}</h3>
                  <p className="text-sm text-gray-500">ایجاد توسط: {selectedRequirement.createdBy?.fullName}</p>
                </div>
              </div>
              <StatusBadge status={selectedRequirement.status} labels={REQUIREMENT_STATUS_LABELS} />
            </div>

            <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm">
              <span className="text-indigo-600">سامانه: </span>
              <span className="font-semibold text-indigo-900">{getApplicationName(selectedRequirement.applicationId)}</span>
              <p className="mt-1 text-xs text-indigo-600">سامانه نیازمندی پس از ایجاد قابل تغییر نیست.</p>
            </div>

            {canEdit ? (
              <div className="space-y-4">
                <Input label="عنوان" value={formData.title} onChange={(e) => { setFormErrors(prev => ({ ...prev, title: '' })); setFormData({ ...formData, title: e.target.value }); }} error={formErrors.title} />
                <Textarea label="توضیحات" value={formData.description} onChange={(e) => { setFormErrors(prev => ({ ...prev, description: '' })); setFormData({ ...formData, description: e.target.value }); }} error={formErrors.description} />
                <Textarea label="معیارهای پذیرش" value={formData.acceptanceCriteria} onChange={(e) => setFormData({ ...formData, acceptanceCriteria: e.target.value })} />
                <Textarea label="یادداشت‌های ریسک" value={formData.riskNotes} onChange={(e) => setFormData({ ...formData, riskNotes: e.target.value })} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500 mb-1">توضیحات</p><p className="text-sm">{selectedRequirement.description}</p></div>
                {selectedRequirement.acceptanceCriteria && <div className="p-3 bg-green-50 rounded-lg border border-green-200"><p className="text-xs text-gray-500 mb-1">معیارهای پذیرش</p><p className="text-sm whitespace-pre-wrap">{selectedRequirement.acceptanceCriteria}</p></div>}
                {selectedRequirement.riskNotes && <div className="p-3 bg-amber-50 rounded-lg border border-amber-200"><p className="text-xs text-gray-500 mb-1">ریسک‌ها</p><p className="text-sm">{selectedRequirement.riskNotes}</p></div>}
              </div>
            )}

            {/* Flows — with edit/delete capability */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 flex items-center gap-2"><GitBranch className="w-5 h-5 text-purple-500" /> جریان‌ها ({requirementFlows.length})</h4>
                {canCreateFlow && <Button size="sm" variant="secondary" icon={<Plus className="w-4 h-4" />} onClick={() => { setFormErrors({}); setFlowFormData({ title: '', description: '', steps: '' }); setShowFlowModal(true); }}>جریان جدید</Button>}
              </div>
              <div className="space-y-2">
                {requirementFlows.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">جریانی ثبت نشده</p> :
                  requirementFlows.map(f => (
                    <div key={f.id} className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{f.title}</p>
                          <p className="text-sm text-gray-600 mt-1">{f.description}</p>
                          {f.steps && <div className="mt-2 text-sm text-gray-500 whitespace-pre-wrap">{f.steps}</div>}
                        </div>
                        {canEdit && (
                          <div className="flex gap-1 mr-2 flex-shrink-0">
                            <button onClick={() => { setFormErrors({}); setFlowFormData({ title: f.title, description: f.description, steps: f.steps || '' }); setEditingFlowId(f.id); setShowFlowModal(true); }}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="ویرایش"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => setFlowDeleteTarget(f)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded" title="حذف"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t">
              {canEdit && <Button onClick={handleUpdate} loading={actionLoading}>ذخیره تغییرات</Button>}
              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>بستن</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Flow Create/Edit Modal */}
      <Modal isOpen={showFlowModal} onClose={() => { setShowFlowModal(false); setEditingFlowId(null); }} title={editingFlowId ? 'ویرایش جریان' : 'ایجاد جریان جدید'} size="md">
        <div className="space-y-4">
          <Input label="عنوان جریان *" value={flowFormData.title} onChange={(e) => { setFormErrors(prev => ({ ...prev, flowTitle: '' })); setFlowFormData({ ...flowFormData, title: e.target.value }); }} placeholder="عنوان" error={formErrors.flowTitle} />
          <Textarea label="توضیحات *" value={flowFormData.description} onChange={(e) => { setFormErrors(prev => ({ ...prev, flowDescription: '' })); setFlowFormData({ ...flowFormData, description: e.target.value }); }} placeholder="توضیحات" error={formErrors.flowDescription} />
          <Textarea label="مراحل" value={flowFormData.steps} onChange={(e) => setFlowFormData({ ...flowFormData, steps: e.target.value })} placeholder="مراحل" />
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="secondary" onClick={() => { setShowFlowModal(false); setEditingFlowId(null); }}>انصراف</Button>
            <Button onClick={async () => {
              const errors: Record<string, string> = {};
              if (!flowFormData.title.trim()) errors.flowTitle = 'عنوان جریان الزامی است.';
              if (!flowFormData.description.trim()) errors.flowDescription = 'توضیحات جریان الزامی است.';
              setFormErrors(errors);
              if (Object.keys(errors).length > 0) return;
              if (editingFlowId) {
                // Update existing flow
                setActionLoading(true);
                try {
                  await flowApi.update(editingFlowId, flowFormData);
                  setShowFlowModal(false); setEditingFlowId(null);
                  setFlowFormData({ title: '', description: '', steps: '' });
                  loadFlows(); loadData();
                  toast.success('جریان بروزرسانی شد.');
                } catch { toast.error('خطا.'); } finally { setActionLoading(false); }
              } else {
                handleCreateFlow();
              }
            }} loading={actionLoading} disabled={actionLoading}>
              {editingFlowId ? 'بروزرسانی' : 'ایجاد'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={handleDeleteReq}
        title="حذف نیازمندی" message={`آیا از حذف «${deleteTarget?.title}» اطمینان دارید؟`} variant="danger" confirmText="حذف" loading={actionLoading} />
      <ConfirmModal isOpen={!!flowDeleteTarget} onClose={() => setFlowDeleteTarget(null)} onConfirm={handleDeleteFlow}
        title="حذف جریان" message={`آیا از حذف جریان «${flowDeleteTarget?.title || ''}» اطمینان دارید؟`} variant="danger" confirmText="حذف" loading={actionLoading} />
    </div>
  );
};
