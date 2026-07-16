import { useState, useEffect } from 'react';
import { Search, User, Shield, Building2, Plus, Trash2, Eye, Key } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Table, Pagination } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Input, Select } from '../components/ui/Input';
import { useAuthStore, canPerformAction } from '../stores/authStore';
import { userApi, applicationApi } from '../services/api';
import { toast } from '../components/ui/Toast';
import type { User as UserType, Application, UserRole, AccessScope, CartableFilterParams } from '../types';
import { ROLE_LABELS } from '../types';
import { mockUserRoleAssignments } from '../services/seedData';

export const UsersPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const [users, setUsers] = useState<UserType[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CartableFilterParams>({ page: 1, limit: 10, search: '' });

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // -- Create/Edit form fields --
  const [nationalCodeInput, setNationalCodeInput] = useState('');
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [foundName, setFoundName] = useState('');
  const [foundPhone, setFoundPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>('');
  const [accessScope, setAccessScope] = useState<AccessScope>('SYSTEMS');
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [automatedTestsEnabled, setAutomatedTestsEnabled] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => { if (activeContext) loadData(); }, [activeContext]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, a] = await Promise.all([userApi.getAll(), applicationApi.getAll()]);
      setUsers(u); setApplications(a);
    } catch { toast.error('خطا در بارگذاری.'); }
    finally { setLoading(false); }
  };

  const role = activeContext?.role;
  const canCreate = canPerformAction(role!, 'admin:create-user');
  const canEdit = canPerformAction(role!, 'admin:edit-user');
  const canDelete = canPerformAction(role!, 'admin:delete-user');

  // -- National code lookup via API --
  const handleNationalCodeLookup = async () => {
    if (!nationalCodeInput || nationalCodeInput.length !== 10) {
      setFormErrors({ nationalCode: 'کد ملی باید ۱۰ رقم باشد.' });
      return;
    }
    setLookupLoading(true);
    setFormErrors({});
    try {
      const found = await userApi.lookupByNationalCode(nationalCodeInput);
      if (found) {
        setFoundName(found.fullName);
        setFoundPhone(found.phoneNumber);
        setLookupDone(true);
        toast.success('اطلاعات کاربر از پایگاه داده یافت شد.');
      } else {
        setFoundName('');
        setFoundPhone('');
        setLookupDone(true);
        toast.info('کاربری با این کد ملی یافت نشد. لطفاً اطلاعات را وارد کنید.');
      }
    } catch {
      toast.error('خطا در استعلام کد ملی.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleToggleSystem = (appId: string) => {
    setSelectedSystems(prev =>
      prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]
    );
  };

  const generatePassword = () => {
    const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
    let pw = '';
    for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setGeneratedPassword(pw);
  };

  const resetCreateForm = () => {
    setNationalCodeInput(''); setLookupDone(false); setFoundName(''); setFoundPhone('');
    setSelectedRole(''); setAccessScope('SYSTEMS'); setSelectedSystems([]);
    setAutomatedTestsEnabled(true);
    setGeneratedPassword(''); setFormErrors({});
  };

  const handleRoleChange = (value: UserRole | '') => {
    setSelectedRole(value);
    if (value !== 'QA_SPECIALIST') {
      setAutomatedTestsEnabled(true);
    }
  };

  const validateAccessForm = (requirePassword = false): boolean => {
    const errors: Record<string, string> = {};
    if (!selectedRole) errors.role = 'انتخاب نقش الزامی است.';
    if (accessScope === 'SYSTEMS' && selectedSystems.length === 0) errors.systems = 'حداقل یک سامانه باید انتخاب شود.';
    if (requirePassword && !generatedPassword) errors.password = 'تولید رمز عبور الزامی است.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateCreateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!nationalCodeInput || nationalCodeInput.length !== 10) errors.nationalCode = 'کد ملی باید ۱۰ رقم باشد.';
    if (!foundName.trim()) errors.fullName = 'نام و نام خانوادگی الزامی است.';
    if (!foundPhone.trim()) errors.phoneNumber = 'شماره تلفن الزامی است.';
    else if (!/^09\d{9}$/.test(foundPhone)) errors.phoneNumber = 'شماره تلفن باید ۱۱ رقم و با ۰۹ شروع شود.';
    if (!selectedRole) errors.role = 'انتخاب نقش الزامی است.';
    if (accessScope === 'SYSTEMS' && selectedSystems.length === 0) errors.systems = 'حداقل یک سامانه باید انتخاب شود.';
    if (!generatedPassword) errors.password = 'تولید رمز عبور الزامی است.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateCreateForm()) return;
    setActionLoading(true);
    try {
      const createdUser = await userApi.create({
        nationalCode: nationalCodeInput,
        fullName: foundName.trim(),
        phoneNumber: foundPhone.trim(),
      });
      await userApi.replaceRoleAssignments(createdUser.id, {
        role: selectedRole as UserRole,
        scope: accessScope,
        applicationIds: accessScope === 'SYSTEMS' ? selectedSystems : [],
        automatedTestsEnabled: selectedRole === 'QA_SPECIALIST' ? automatedTestsEnabled : undefined,
      });
      toast.success(`کاربر «${foundName}» با نقش ${ROLE_LABELS[selectedRole as UserRole]} ایجاد شد. رمز: ${generatedPassword}`);
      setShowCreateModal(false);
      resetCreateForm();
      loadData();
    } catch { toast.error('خطا در ایجاد کاربر.'); }
    finally { setActionLoading(false); }
  };

  const openEditUser = (user: UserType) => {
    setSelectedUser(user);
    handleRoleChange('');
    setAccessScope('SYSTEMS');
    setSelectedSystems([]);
    setAutomatedTestsEnabled(true);
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleManagedRoleChange = (value: UserRole | '') => {
    handleRoleChange(value);
    if (!selectedUser || !value) {
      setAccessScope('SYSTEMS');
      setSelectedSystems([]);
      return;
    }
    const assignments = mockUserRoleAssignments.filter(assignment =>
      assignment.userId === selectedUser.id && assignment.role === value && assignment.isActive
    );
    if (!assignments.length) {
      setAccessScope('SYSTEMS');
      setSelectedSystems([]);
      setAutomatedTestsEnabled(true);
      return;
    }
    const isAppScope = assignments.some(assignment => assignment.scope === 'APP');
    setAccessScope(isAppScope ? 'APP' : 'SYSTEMS');
    setSelectedSystems(Array.from(new Set(assignments.flatMap(assignment =>
      assignment.applicationIds?.length ? assignment.applicationIds : [assignment.applicationId]
    ))));
    setAutomatedTestsEnabled(value === 'QA_SPECIALIST'
      ? assignments.every(assignment => assignment.automatedTestsEnabled !== false)
      : true);
  };

  const handleEditAccess = async () => {
    if (!selectedUser || !validateAccessForm()) return;
    setActionLoading(true);
    try {
      await userApi.replaceRoleAssignments(selectedUser.id, {
        role: selectedRole as UserRole,
        scope: accessScope,
        applicationIds: accessScope === 'SYSTEMS' ? selectedSystems : [],
        automatedTestsEnabled: selectedRole === 'QA_SPECIALIST' ? automatedTestsEnabled : undefined,
      });
      toast.success(`نقش ${ROLE_LABELS[selectedRole as UserRole]} ثبت شد و سایر نقش‌های کاربر حفظ شدند.`);
      setShowEditModal(false);
      loadData();
    } catch {
      toast.error('خطا در بروزرسانی دسترسی کاربر.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      toast.success(`کاربر «${selectedUser.fullName}» غیرفعال شد.`);
      setShowDeleteConfirm(false); loadData();
    } catch { toast.error('خطا.'); }
    finally { setActionLoading(false); }
  };

  const getUserRoles = (userId: string) => {
    const byRole = new Map<UserRole, typeof mockUserRoleAssignments>();
    mockUserRoleAssignments
      .filter(assignment => assignment.userId === userId && assignment.isActive)
      .forEach(assignment => {
        const rows = byRole.get(assignment.role) || [];
        rows.push(assignment);
        byRole.set(assignment.role, rows);
      });
    return Array.from(byRole.entries()).map(([assignedRole, assignments]) => {
      const applicationIds = Array.from(new Set(assignments.flatMap(assignment =>
        assignment.applicationIds?.length ? assignment.applicationIds : [assignment.applicationId]
      )));
      return {
        role: assignedRole,
        scope: assignments.some(assignment => assignment.scope === 'APP') ? 'APP' as const : 'SYSTEMS' as const,
        automatedTestsEnabled: assignedRole === 'QA_SPECIALIST'
          ? assignments.every(assignment => assignment.automatedTestsEnabled !== false)
          : undefined,
        applications: applications.filter(application => applicationIds.includes(application.id)),
      };
    });
  };

  // Filter
  let filteredUsers = [...users];
  if (filters.search) {
    const s = filters.search.toLowerCase();
    filteredUsers = filteredUsers.filter(u =>
      u.fullName.toLowerCase().includes(s) || u.phoneNumber.includes(s) || u.nationalCode?.includes(s)
    );
  }
  const total = filteredUsers.length;
  const start = (filters.page - 1) * filters.limit;
  const paginatedUsers = filteredUsers.slice(start, start + filters.limit);
  const totalPages = Math.ceil(total / filters.limit);

  const columns = [
    {
      key: 'fullName', title: 'نام کاربر',
      render: (item: UserType) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center"><User className="w-5 h-5 text-blue-600" /></div>
          <div>
            <p className="font-medium text-gray-900">{item.fullName}</p>
            <p className="text-xs text-gray-500 font-mono" dir="ltr">{item.nationalCode || '-'}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', title: 'شماره تلفن', render: (item: UserType) => <span className="font-mono text-sm" dir="ltr">{item.phoneNumber}</span> },
    {
      key: 'roles', title: 'نقش و سطح دسترسی',
      render: (item: UserType) => {
        const roles = getUserRoles(item.id);
        return (
          <div className="flex flex-wrap gap-1">
            {roles.map((r, i) => (
              <div key={i} className="flex flex-wrap gap-1">
                <Badge variant={r.scope === 'APP' ? 'info' : 'secondary'} size="sm">
                  {ROLE_LABELS[r.role]} ({r.scope === 'APP' ? 'همه سامانه‌ها' : r.applications.map(application => application.name).join('، ') || 'سامانه نامشخص'})
                </Badge>
                {r.role === 'QA_SPECIALIST' && (
                  <Badge variant={r.automatedTestsEnabled !== false ? 'success' : 'warning'} size="sm">
                    تست خودکار {r.automatedTestsEnabled !== false ? 'فعال' : 'غیرفعال'}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        );
      },
    },
    { key: 'isActive', title: 'وضعیت', render: (item: UserType) => <Badge variant={item.isActive ? 'success' : 'danger'}>{item.isActive ? 'فعال' : 'غیرفعال'}</Badge> },
    {
      key: 'actions', title: 'عملیات',
      render: (item: UserType) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" icon={<Eye className="w-3.5 h-3.5" />}
            onClick={(e) => { e.stopPropagation(); setSelectedUser(item); setShowDetailModal(true); }}>مشاهده</Button>
          {canEdit && <Button size="sm" variant="ghost" icon={<Plus className="w-3.5 h-3.5" />}
            onClick={(e) => { e.stopPropagation(); openEditUser(item); }}>مدیریت نقش‌ها</Button>}
          {canDelete && <Button size="sm" variant="ghost" className="text-red-600" icon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={(e) => { e.stopPropagation(); setSelectedUser(item); setShowDeleteConfirm(true); }}>حذف</Button>}
        </div>
      ),
    },
  ];

  if (!activeContext) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="مدیریت کاربران و نقش‌ها" subtitle={`${total} کاربر`} onRefresh={loadData} refreshing={loading}
        actions={canCreate && <Button icon={<Plus className="w-4 h-4" />} onClick={() => { resetCreateForm(); setShowCreateModal(true); }}>افزودن کاربر</Button>} />

      <main className="p-4 sm:p-6">
        <Card className="mb-6" padding="sm">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="جستجو بر اساس نام، کد ملی یا شماره تلفن..." value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                className="w-full pr-10 pl-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </Card>
        <Table columns={columns} data={paginatedUsers} loading={loading} emptyMessage="کاربری یافت نشد"
          onRowClick={(item) => { setSelectedUser(item); setShowDetailModal(true); }} />
        {total > 0 && <Pagination page={filters.page} totalPages={totalPages || 1} total={total} limit={filters.limit}
          onPageChange={(p) => setFilters({ ...filters, page: p })}
          onLimitChange={(limit) => setFilters({ ...filters, limit, page: 1 })} />}
      </main>

      {/* ===== CREATE MODAL ===== */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="افزودن کاربر جدید" size="xl">
        <div className="space-y-5">
          {/* Step 1: National Code Lookup */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2"><Shield className="w-5 h-5 text-blue-500" /> مرحله ۱: استعلام کد ملی</h4>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Input label="کد ملی *" placeholder="کد ملی ۱۰ رقمی را وارد کنید" value={nationalCodeInput} dir="ltr" maxLength={10}
                  onChange={(e) => { setNationalCodeInput(e.target.value.replace(/\D/g, '')); setLookupDone(false); }}
                  error={formErrors.nationalCode} />
              </div>
              <Button onClick={handleNationalCodeLookup} loading={lookupLoading} disabled={lookupLoading || nationalCodeInput.length !== 10}>
                استعلام
              </Button>
            </div>
          </div>

          {/* Step 2: Auto-filled / Manual user info */}
          {lookupDone && (
            <div className="p-4 bg-gray-50 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-3">مرحله ۲: اطلاعات کاربر</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="نام و نام خانوادگی *" placeholder="نام کامل" value={foundName}
                  onChange={(e) => setFoundName(e.target.value)} error={formErrors.fullName} />
                <Input label="شماره تلفن *" placeholder="۰۹۱۲۱۲۳۴۵۶۷" value={foundPhone} dir="ltr" maxLength={11}
                  onChange={(e) => setFoundPhone(e.target.value)} error={formErrors.phoneNumber} />
              </div>
            </div>
          )}

          {/* Step 3: Role & Scope */}
          {lookupDone && (
            <div className="p-4 bg-gray-50 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-3">مرحله ۳: نقش و سطح دسترسی</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <Select label="نقش کاربر *" value={selectedRole}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  options={Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                  placeholder="نقش را انتخاب کنید" error={formErrors.role} />
                <Select label="سطح دسترسی *" value={accessScope}
                  onChange={(e) => setAccessScope(e.target.value as AccessScope)}
                  options={[
                    { value: 'APP', label: 'سطح اپ (دسترسی به تمام سامانه‌ها)' },
                    { value: 'SYSTEMS', label: 'سطح سامانه (انتخاب یک یا چند سامانه)' },
                  ]} />
              </div>

              {selectedRole === 'QA_SPECIALIST' && (
                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  automatedTestsEnabled ? 'bg-purple-50 border-purple-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={automatedTestsEnabled}
                    onChange={(e) => setAutomatedTestsEnabled(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-gray-300 text-purple-600"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">نمایش کارتابل‌های تست خودکار و اجازه اجرای Playwright</span>
                    <span className="block text-xs text-gray-500 mt-1">
                      اگر غیرفعال باشد، کارشناس تست کارتابل Playwright را نمی‌بیند و امکان اجرای جدید Playwright ندارد.
                    </span>
                  </span>
                </label>
              )}

              {accessScope === 'APP' && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm text-green-700">
                  ✓ این کاربر به <strong>تمام سامانه‌ها</strong> با نقش {selectedRole ? ROLE_LABELS[selectedRole as UserRole] : '...'} دسترسی خواهد داشت.
                </div>
              )}

              {accessScope === 'SYSTEMS' && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">سامانه‌های مورد نظر را انتخاب کنید: <span className="text-red-500">*</span></p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {applications.map(app => (
                      <label key={app.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedSystems.includes(app.id) ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}>
                        <input type="checkbox" checked={selectedSystems.includes(app.id)}
                          onChange={() => handleToggleSystem(app.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{app.name}</p>
                          <p className="text-xs text-gray-500">{app.code}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {formErrors.systems && <p className="mt-1.5 text-sm text-red-600">{formErrors.systems}</p>}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Password */}
          {lookupDone && selectedRole && (
            <div className="p-4 bg-gray-50 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2"><Key className="w-5 h-5 text-amber-500" /> مرحله ۴: رمز عبور</h4>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Input label="رمز عبور *" value={generatedPassword} readOnly dir="ltr"
                    placeholder="روی دکمه تولید کلیک کنید" error={formErrors.password} />
                </div>
                <Button variant="secondary" onClick={generatePassword}>تولید رمز</Button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>انصراف</Button>
            <Button onClick={handleCreate} loading={actionLoading}
              disabled={!lookupDone || !selectedRole || actionLoading}>
              ثبت کاربر
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="افزودن یا بروزرسانی نقش کاربر" size="lg">
        {selectedUser && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">کاربر: <span className="font-medium text-gray-900">{selectedUser.fullName}</span></p>
              <p className="text-sm text-gray-500">کد ملی: <span className="font-mono" dir="ltr">{selectedUser.nationalCode || '-'}</span></p>
            </div>
            <Select label="نقش مورد نظر *" value={selectedRole}
              onChange={(e) => handleManagedRoleChange(e.target.value as UserRole)}
              options={Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              placeholder="نقش را انتخاب کنید" error={formErrors.role} />
            <Select label="سطح دسترسی" value={accessScope}
              onChange={(e) => setAccessScope(e.target.value as AccessScope)}
              options={[
                { value: 'APP', label: 'سطح اپ (تمام سامانه‌ها)' },
                { value: 'SYSTEMS', label: 'سطح سامانه (یک یا چند سامانه)' },
              ]} />
            {selectedRole === 'QA_SPECIALIST' && (
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                automatedTestsEnabled ? 'bg-purple-50 border-purple-300' : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="checkbox"
                  checked={automatedTestsEnabled}
                  onChange={(e) => setAutomatedTestsEnabled(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-purple-600"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">نمایش کارتابل‌های تست خودکار و اجازه اجرای Playwright</span>
                  <span className="block text-xs text-gray-500 mt-1">
                    اگر غیرفعال باشد، کارشناس تست کارتابل Playwright را نمی‌بیند و امکان اجرای جدید Playwright ندارد.
                  </span>
                </span>
              </label>
            )}
            {accessScope === 'SYSTEMS' && (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {applications.map(app => (
                    <label key={app.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${selectedSystems.includes(app.id) ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}`}>
                      <input type="checkbox" checked={selectedSystems.includes(app.id)}
                        onChange={() => handleToggleSystem(app.id)} className="w-4 h-4 rounded border-gray-300" />
                      <span className="text-sm">{app.name}</span>
                    </label>
                  ))}
                </div>
                {formErrors.systems && <p className="mt-1.5 text-sm text-red-600">{formErrors.systems}</p>}
              </div>
            )}
            <div className="flex gap-3 justify-end pt-4">
              <Button variant="secondary" onClick={() => setShowEditModal(false)}>انصراف</Button>
              <Button onClick={handleEditAccess}
                loading={actionLoading} disabled={actionLoading || !selectedRole}>ثبت نقش</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="جزئیات کاربر" size="lg">
        {selectedUser && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center"><User className="w-8 h-8 text-blue-600" /></div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{selectedUser.fullName}</h3>
                <p className="text-gray-500 font-mono" dir="ltr">کد ملی: {selectedUser.nationalCode || '-'}</p>
                <p className="text-sm text-gray-400 font-mono" dir="ltr">{selectedUser.phoneNumber}</p>
              </div>
              <Badge variant={selectedUser.isActive ? 'success' : 'danger'} className="mr-auto">{selectedUser.isActive ? 'فعال' : 'غیرفعال'}</Badge>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2"><Shield className="w-5 h-5 text-purple-500" /> نقش‌ها و دسترسی‌ها</h4>
              <div className="space-y-2">
                {getUserRoles(selectedUser.id).map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium">{r.scope === 'APP' ? 'تمام سامانه‌ها' : r.applications.map(application => application.name).join('، ') || 'سامانه نامشخص'}</p>
                        <p className="text-xs text-gray-500">{r.scope === 'APP' ? 'سطح اپ' : 'سطح سامانه'}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {r.role === 'QA_SPECIALIST' && (
                        <Badge variant={r.automatedTestsEnabled !== false ? 'success' : 'warning'}>
                          تست خودکار {r.automatedTestsEnabled !== false ? 'فعال' : 'غیرفعال'}
                        </Badge>
                      )}
                      <Badge variant={r.scope === 'APP' ? 'info' : 'secondary'}>{ROLE_LABELS[r.role]}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-4 border-t">
              {canEdit && <Button variant="secondary" icon={<Plus className="w-4 h-4" />}
                onClick={() => { setShowDetailModal(false); openEditUser(selectedUser); }}>افزودن یا بروزرسانی نقش</Button>}
              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>بستن</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete} title="حذف/غیرفعال‌سازی کاربر"
        message={`آیا از غیرفعال‌سازی کاربر «${selectedUser?.fullName}» اطمینان دارید؟`}
        variant="danger" confirmText="غیرفعال‌سازی" loading={actionLoading} />
    </div>
  );
};
