import { useState, useEffect } from 'react';
import { Search, Building2, Users, Plus, Edit, Power, Eye } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Table, Pagination } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Input, Textarea } from '../components/ui/Input';
import { useAuthStore, canPerformAction } from '../stores/authStore';
import { applicationApi, userApi } from '../services/api';
import { toast } from '../components/ui/Toast';
import type { Application, CartableFilterParams, User as UserType, UserRoleAssignment } from '../types';
import { ROLE_LABELS } from '../types';

const CDE_BASE_URL = 'https://cde.edus.ir/';
const CDE_ROOT_RULES = {
  cdeFrontUrl: {
    prefix: `${CDE_BASE_URL}front/`,
    label: 'فرانت سامانه',
  },
  cdeDataServiceUrl: {
    prefix: `${CDE_BASE_URL}dservice/`,
    label: 'Back NodeJS / DataService',
  },
  cdeGatewayUrl: {
    prefix: `${CDE_BASE_URL}back/`,
    label: 'Gateway',
  },
} as const;

type CdeRootField = keyof typeof CDE_ROOT_RULES;

const emptyAppForm = {
  name: '',
  code: '',
  description: '',
  cdeFrontUrl: '',
  cdeDataServiceUrl: '',
  cdeGatewayUrl: '',
};

export const ApplicationsPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const [applications, setApplications] = useState<Application[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<UserRoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CartableFilterParams>({ page: 1, limit: 10, search: '' });

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [appForm, setAppForm] = useState(emptyAppForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const role = activeContext?.role;
  const canManage = canPerformAction(role!, 'admin:manage-apps');

  useEffect(() => { if (activeContext) loadData(); }, [activeContext]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [apps, allUsers, assignments] = await Promise.all([
        applicationApi.getAll(),
        userApi.getAll(),
        userApi.getRoleAssignments(),
      ]);
      setApplications(apps);
      setUsers(allUsers);
      setRoleAssignments(assignments);
    }
    catch { toast.error('خطا.'); }
    finally { setLoading(false); }
  };

  const getAppUsers = (appId: string) => {
    const assignments = roleAssignments.filter(a => {
      const assignmentApplicationIds = a.applicationIds?.length ? a.applicationIds : [a.applicationId];
      return a.isActive && (a.scope === 'APP' || assignmentApplicationIds.includes(appId));
    });
    const userIds = [...new Set(assignments.map(a => a.userId))];
    return userIds.map(uid => {
      const user = users.find(u => u.id === uid);
      const roles = assignments.filter(a => a.userId === uid).map(a => a.role);
      return { user, roles };
    }).filter(u => u.user);
  };

  const validateCdeRoot = (field: CdeRootField): string | undefined => {
    const value = appForm[field].trim();
    if (!value) return undefined;
    const rule = CDE_ROOT_RULES[field];
    if (!value.startsWith(CDE_BASE_URL)) {
      return `آدرس ${rule.label} باید با ${CDE_BASE_URL} شروع شود.`;
    }
    if (!value.startsWith(rule.prefix)) {
      return `آدرس ${rule.label} باید مطابق هینت همین فیلد باشد.`;
    }
    try {
      new URL(value);
    } catch {
      return `آدرس ${rule.label} معتبر نیست.`;
    }
    return undefined;
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!appForm.name.trim()) errors.name = 'نام سامانه الزامی است.';
    if (!appForm.code.trim()) errors.code = 'کد سامانه الزامی است.';
    (Object.keys(CDE_ROOT_RULES) as CdeRootField[]).forEach(field => {
      const error = validateCdeRoot(field);
      if (error) errors[field] = error;
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    setActionLoading(true);
    try {
      await applicationApi.create({
        name: appForm.name.trim(),
        code: appForm.code.trim(),
        description: appForm.description.trim(),
        cdeFrontUrl: appForm.cdeFrontUrl.trim(),
        cdeDataServiceUrl: appForm.cdeDataServiceUrl.trim(),
        cdeGatewayUrl: appForm.cdeGatewayUrl.trim(),
      });
      toast.success(`سامانه «${appForm.name}» با موفقیت ایجاد شد.`);
      setShowCreateModal(false); setAppForm(emptyAppForm); loadData();
    } catch (error) {
      if (error instanceof Error && error.message === 'APPLICATION_CDE_ROOT_INVALID') {
        toast.error('آدرس‌های CDE باید مطابق هینت و با https://cde.edus.ir/ باشند.');
      } else {
        toast.error('خطا در ایجاد سامانه.');
      }
    }
    finally { setActionLoading(false); }
  };

  const handleEdit = async () => {
    if (!validateForm() || !selectedApp) return;
    setActionLoading(true);
    try {
      await applicationApi.update(selectedApp.id, {
        name: appForm.name.trim(),
        code: appForm.code.trim(),
        description: appForm.description.trim(),
        cdeFrontUrl: appForm.cdeFrontUrl.trim(),
        cdeDataServiceUrl: appForm.cdeDataServiceUrl.trim(),
        cdeGatewayUrl: appForm.cdeGatewayUrl.trim(),
      });
      toast.success(`سامانه «${appForm.name}» ویرایش شد.`);
      setShowEditModal(false); loadData();
    } catch (error) {
      if (error instanceof Error && error.message === 'APPLICATION_CDE_ROOT_INVALID') {
        toast.error('آدرس‌های CDE باید مطابق هینت و با https://cde.edus.ir/ باشند.');
      } else {
        toast.error('خطا در ویرایش.');
      }
    }
    finally { setActionLoading(false); }
  };

  const handleToggleActive = async () => {
    if (!selectedApp) return;
    setActionLoading(true);
    try {
      const nextActive = !selectedApp.isActive;
      await applicationApi.update(selectedApp.id, { isActive: nextActive });
      toast.success(`سامانه «${selectedApp.name}» ${nextActive ? 'فعال' : 'غیرفعال'} شد.`);
      setShowDeleteConfirm(false); loadData();
    } catch { toast.error('خطا.'); }
    finally { setActionLoading(false); }
  };

  // Filter
  let filteredApps = [...applications];
  if (filters.search) {
    const s = filters.search.toLowerCase();
    filteredApps = filteredApps.filter(a => a.name.toLowerCase().includes(s) || a.code.toLowerCase().includes(s));
  }
  const total = filteredApps.length;
  const totalPages = Math.ceil(total / filters.limit);
  const start = (filters.page - 1) * filters.limit;
  const paginatedApps = filteredApps.slice(start, start + filters.limit);

  const columns = [
    {
      key: 'name', title: 'نام سامانه',
      render: (item: Application) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><Building2 className="w-5 h-5 text-purple-600" /></div>
          <div>
            <p className="font-medium text-gray-900">{item.name}</p>
            <p className="text-xs text-gray-500 font-mono">{item.code}</p>
          </div>
        </div>
      ),
    },
    { key: 'description', title: 'توضیحات', render: (item: Application) => <p className="text-sm text-gray-600 line-clamp-1">{item.description || '-'}</p> },
    {
      key: 'cdeRoots',
      title: 'CDE',
      render: (item: Application) => {
        const configuredCount = [item.cdeFrontUrl, item.cdeDataServiceUrl, item.cdeGatewayUrl].filter(Boolean).length;
        return (
          <Badge variant={configuredCount === 3 ? 'success' : configuredCount > 0 ? 'warning' : 'default'} size="sm">
            {configuredCount}/3 ریشه تست
          </Badge>
        );
      },
    },
    {
      key: 'users', title: 'کاربران',
      render: (item: Application) => {
        const users = getAppUsers(item.id);
        return <div className="flex items-center gap-1"><Users className="w-4 h-4 text-gray-400" /><span className="text-sm">{users.length} کاربر</span></div>;
      },
    },
    { key: 'isActive', title: 'وضعیت', render: (item: Application) => <Badge variant={item.isActive ? 'success' : 'danger'}>{item.isActive ? 'فعال' : 'غیرفعال'}</Badge> },
    {
      key: 'actions', title: 'عملیات',
      render: (item: Application) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" icon={<Eye className="w-3.5 h-3.5" />}
            onClick={(e) => { e.stopPropagation(); setSelectedApp(item); setShowDetailModal(true); }}>مشاهده</Button>
          {canManage && (
            <>
              <Button size="sm" variant="ghost" icon={<Edit className="w-3.5 h-3.5" />}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedApp(item);
                  setFormErrors({});
                  setAppForm({
                    name: item.name,
                    code: item.code,
                    description: item.description || '',
                    cdeFrontUrl: item.cdeFrontUrl || '',
                    cdeDataServiceUrl: item.cdeDataServiceUrl || '',
                    cdeGatewayUrl: item.cdeGatewayUrl || '',
                  });
                  setShowEditModal(true);
                }}>ویرایش</Button>
              <Button
                size="sm"
                variant="ghost"
                className={item.isActive ? 'text-amber-700' : 'text-green-700'}
                icon={<Power className="w-3.5 h-3.5" />}
                onClick={(e) => { e.stopPropagation(); setSelectedApp(item); setShowDeleteConfirm(true); }}
              >
                {item.isActive ? 'غیرفعال' : 'فعال‌سازی'}
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  if (!activeContext) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="مدیریت سامانه‌ها" subtitle={`${applications.length} سامانه`} onRefresh={loadData} refreshing={loading}
        actions={canManage && <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setAppForm(emptyAppForm); setFormErrors({}); setShowCreateModal(true); }}>سامانه جدید</Button>} />

      <main className="p-4 sm:p-6">
        <Card className="mb-6" padding="sm">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="جستجو سامانه..." value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                className="w-full pr-10 pl-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </Card>
        <Table columns={columns} data={paginatedApps} loading={loading} emptyMessage="سامانه‌ای یافت نشد"
          onRowClick={(item) => { setSelectedApp(item); setShowDetailModal(true); }} />
        {total > 0 && <Pagination page={filters.page} totalPages={totalPages || 1} total={total} limit={filters.limit}
          onPageChange={(page) => setFilters({ ...filters, page })}
          onLimitChange={(limit) => setFilters({ ...filters, limit, page: 1 })} />}
      </main>

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="ایجاد سامانه جدید" size="lg">
        <div className="space-y-4">
          <Input label="نام سامانه *" placeholder="نام سامانه را وارد کنید" value={appForm.name}
            onChange={(e) => setAppForm({ ...appForm, name: e.target.value })} error={formErrors.name} />
          <Input label="کد سامانه *" placeholder="مثال: ONLINE_BANKING" value={appForm.code} dir="ltr"
            onChange={(e) => setAppForm({ ...appForm, code: e.target.value.toUpperCase() })} error={formErrors.code} />
          <Textarea label="توضیحات" placeholder="توضیحات سامانه" value={appForm.description}
            onChange={(e) => setAppForm({ ...appForm, description: e.target.value })} />
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
            <div>
              <h4 className="font-medium text-blue-900">ریشه‌های فایل تست در CDE</h4>
              <p className="text-xs text-blue-700 mt-1">با ثبت این آدرس‌ها، فایل‌های تست موجود در سه ریشه Front، Back NodeJS/DataService و Gateway در Discovery خوانده می‌شوند.</p>
            </div>
            <Input
              label="آدرس فرانت سامانه در CDE"
              placeholder="https://cde.edus.ir/front/directory/medu-community%3EApp"
              value={appForm.cdeFrontUrl}
              onChange={(e) => setAppForm({ ...appForm, cdeFrontUrl: e.target.value })}
              error={formErrors.cdeFrontUrl}
              dir="ltr"
            />
            <Input
              label="آدرس Back NodeJS / DataService در CDE"
              placeholder="https://cde.edus.ir/dservice/directory/medu-community%3EApp"
              value={appForm.cdeDataServiceUrl}
              onChange={(e) => setAppForm({ ...appForm, cdeDataServiceUrl: e.target.value })}
              error={formErrors.cdeDataServiceUrl}
              dir="ltr"
            />
            <Input
              label="آدرس Gateway در CDE"
              placeholder="https://cde.edus.ir/back/medu-ai/medu-community%3E?return=/workspace/medu-ai"
              value={appForm.cdeGatewayUrl}
              onChange={(e) => setAppForm({ ...appForm, cdeGatewayUrl: e.target.value })}
              error={formErrors.cdeGatewayUrl}
              dir="ltr"
            />
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>انصراف</Button>
            <Button onClick={handleCreate} loading={actionLoading} disabled={actionLoading}>ایجاد</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="ویرایش سامانه" size="lg">
        <div className="space-y-4">
          <Input label="نام سامانه *" value={appForm.name}
            onChange={(e) => setAppForm({ ...appForm, name: e.target.value })} error={formErrors.name} />
          <Input label="کد سامانه *" value={appForm.code} dir="ltr"
            onChange={(e) => setAppForm({ ...appForm, code: e.target.value.toUpperCase() })} error={formErrors.code} />
          <Textarea label="توضیحات" value={appForm.description}
            onChange={(e) => setAppForm({ ...appForm, description: e.target.value })} />
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
            <div>
              <h4 className="font-medium text-blue-900">ریشه‌های فایل تست در CDE</h4>
              <p className="text-xs text-blue-700 mt-1">با ثبت این آدرس‌ها، فایل‌های تست موجود در سه ریشه Front، Back NodeJS/DataService و Gateway در Discovery خوانده می‌شوند.</p>
            </div>
            <Input
              label="آدرس فرانت سامانه در CDE"
              value={appForm.cdeFrontUrl}
              onChange={(e) => setAppForm({ ...appForm, cdeFrontUrl: e.target.value })}
              error={formErrors.cdeFrontUrl}
              dir="ltr"
            />
            <Input
              label="آدرس Back NodeJS / DataService در CDE"
              value={appForm.cdeDataServiceUrl}
              onChange={(e) => setAppForm({ ...appForm, cdeDataServiceUrl: e.target.value })}
              error={formErrors.cdeDataServiceUrl}
              dir="ltr"
            />
            <Input
              label="آدرس Gateway در CDE"
              value={appForm.cdeGatewayUrl}
              onChange={(e) => setAppForm({ ...appForm, cdeGatewayUrl: e.target.value })}
              error={formErrors.cdeGatewayUrl}
              dir="ltr"
            />
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>انصراف</Button>
            <Button onClick={handleEdit} loading={actionLoading} disabled={actionLoading}>ذخیره</Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="جزئیات سامانه" size="lg">
        {selectedApp && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center"><Building2 className="w-8 h-8 text-purple-600" /></div>
              <div>
                <h3 className="text-xl font-semibold">{selectedApp.name}</h3>
                <p className="font-mono text-gray-500">{selectedApp.code}</p>
              </div>
              <Badge variant={selectedApp.isActive ? 'success' : 'danger'} className="mr-auto">{selectedApp.isActive ? 'فعال' : 'غیرفعال'}</Badge>
            </div>
            {selectedApp.description && <div className="p-4 bg-gray-50 rounded-lg"><p className="text-sm">{selectedApp.description}</p></div>}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-3">ریشه‌های فایل تست در CDE</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-blue-700 mb-1">فرانت سامانه</p>
                  <p className="font-mono text-xs text-gray-800 break-all">{selectedApp.cdeFrontUrl || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-700 mb-1">Back NodeJS / DataService</p>
                  <p className="font-mono text-xs text-gray-800 break-all">{selectedApp.cdeDataServiceUrl || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-700 mb-1">Gateway</p>
                  <p className="font-mono text-xs text-gray-800 break-all">{selectedApp.cdeGatewayUrl || '-'}</p>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2"><Users className="w-5 h-5 text-blue-500" /> کاربران</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {getAppUsers(selectedApp.id).map(({ user, roles }, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div><p className="font-medium">{user?.fullName}</p><p className="text-sm text-gray-500">{user?.phoneNumber}</p></div>
                    <div className="flex gap-1">{roles.map((r, j) => <Badge key={j} variant="secondary" size="sm">{ROLE_LABELS[r]}</Badge>)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-4 border-t">
              {canManage && <Button variant="secondary" icon={<Edit className="w-4 h-4" />}
                onClick={() => {
                  setShowDetailModal(false);
                  setFormErrors({});
                  setAppForm({
                    name: selectedApp.name,
                    code: selectedApp.code,
                    description: selectedApp.description || '',
                    cdeFrontUrl: selectedApp.cdeFrontUrl || '',
                    cdeDataServiceUrl: selectedApp.cdeDataServiceUrl || '',
                    cdeGatewayUrl: selectedApp.cdeGatewayUrl || '',
                  });
                  setShowEditModal(true);
                }}>ویرایش</Button>}
              {canManage && <Button
                variant="secondary"
                className={selectedApp.isActive ? 'text-amber-700' : 'text-green-700'}
                icon={<Power className="w-4 h-4" />}
                onClick={() => {
                  setShowDetailModal(false);
                  setShowDeleteConfirm(true);
                }}
              >
                {selectedApp.isActive ? 'غیرفعال کردن' : 'فعال‌سازی'}
              </Button>}
              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>بستن</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleToggleActive} title={selectedApp?.isActive ? 'غیرفعال کردن سامانه' : 'فعال‌سازی سامانه'}
        message={`آیا از ${selectedApp?.isActive ? 'غیرفعال کردن' : 'فعال‌سازی'} سامانه «${selectedApp?.name}» اطمینان دارید؟`}
        variant={selectedApp?.isActive ? 'warning' : 'primary'} confirmText={selectedApp?.isActive ? 'غیرفعال کردن' : 'فعال‌سازی'} loading={actionLoading} />
    </div>
  );
};
