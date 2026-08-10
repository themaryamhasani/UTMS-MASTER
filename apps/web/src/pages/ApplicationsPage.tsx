import { useEffect, useMemo, useState } from 'react';
import { Building2, Edit, Eye, Plus, Power, Users } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { ConfirmModal, Modal } from '../components/ui/Modal';
import { Pagination, Table } from '../components/ui/Table';
import { toast } from '../components/ui/Toast';
import { applicationApi, userApi } from '../services/api';
import { canPerformAction, useAuthStore } from '../stores/authStore';
import { ROLE_LABELS, type Application, type User, type UserRoleAssignment } from '../types';

const emptyForm = { name: '', code: '', description: '' };

export const ApplicationsPage: React.FC = () => {
  const { activeContext, refreshContexts } = useAuthStore();
  const [applications, setApplications] = useState<Application[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<UserRoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Application | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [mode, setMode] = useState<'create' | 'edit' | 'detail' | null>(null);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const canManage = Boolean(activeContext && canPerformAction(activeContext.role, 'admin:manage-apps'));
  const pageSize = 10;

  const load = async () => {
    setLoading(true);
    try {
      const [apps, allUsers, roleAssignments] = await Promise.all([
        applicationApi.getAll(), userApi.getAll(), userApi.getRoleAssignments(),
      ]);
      setApplications(apps); setUsers(allUsers); setAssignments(roleAssignments);
    } catch { toast.error('بارگذاری سامانه‌ها انجام نشد.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (activeContext) void load(); }, [activeContext]);
  useEffect(() => setPage(1), [search]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return applications.filter(item => !query || `${item.name} ${item.code} ${item.description || ''}`.toLowerCase().includes(query));
  }, [applications, search]);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  const usersFor = (applicationId: string) => {
    const scoped = assignments.filter(item => item.isActive && (item.scope === 'APP' || (item.applicationIds?.length ? item.applicationIds : [item.applicationId]).includes(applicationId)));
    return [...new Set(scoped.map(item => item.userId))].map(userId => ({
      user: users.find(item => item.id === userId),
      roles: scoped.filter(item => item.userId === userId).map(item => item.role),
    })).filter(item => item.user);
  };

  const openCreate = () => { setSelected(null); setForm(emptyForm); setMode('create'); };
  const openEdit = (application: Application) => {
    setSelected(application);
    setForm({ name: application.name, code: application.code, description: application.description || '' });
    setMode('edit');
  };

  const save = async () => {
    if (!form.name.trim() || !form.code.trim()) return toast.error('نام و کد سامانه الزامی است.');
    setSaving(true);
    try {
      const data = { name: form.name.trim(), code: form.code.trim(), description: form.description.trim() };
      if (mode === 'edit' && selected) await applicationApi.update(selected.id, data);
      else await applicationApi.create(data);
      await refreshContexts();
      toast.success(mode === 'edit' ? 'سامانه ویرایش شد.' : 'سامانه ایجاد شد.');
      setMode(null); await load();
    } catch { toast.error('ذخیره سامانه انجام نشد.'); }
    finally { setSaving(false); }
  };

  const toggleActive = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await applicationApi.update(selected.id, { isActive: !selected.isActive });
      await refreshContexts();
      toast.success(`سامانه ${selected.isActive ? 'غیرفعال' : 'فعال'} شد.`);
      setConfirmToggle(false); await load();
    } catch { toast.error('تغییر وضعیت سامانه انجام نشد.'); }
    finally { setSaving(false); }
  };

  return <div className="min-h-screen bg-gray-50" dir="rtl">
    <Header title="سامانه‌ها" subtitle="مدیریت سامانه‌های تحت پوشش UTMS" />
    <main className="space-y-5 p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><div className="flex items-center gap-3"><Building2 className="h-6 w-6 text-blue-600" /><div><strong className="text-2xl">{applications.length.toLocaleString('fa-IR')}</strong><p className="text-sm text-gray-500">کل سامانه‌ها</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><Power className="h-6 w-6 text-emerald-600" /><div><strong className="text-2xl">{applications.filter(item => item.isActive).length.toLocaleString('fa-IR')}</strong><p className="text-sm text-gray-500">سامانه فعال</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><Users className="h-6 w-6 text-violet-600" /><div><strong className="text-2xl">{users.length.toLocaleString('fa-IR')}</strong><p className="text-sm text-gray-500">کاربر</p></div></div></Card>
      </div>
      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input aria-label="جستجوی سامانه" value={search} onChange={event => setSearch(event.target.value)} placeholder="جستجو در نام، کد یا توضیح…" />
          {canManage && <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>سامانه جدید</Button>}
        </div>
        <Table loading={loading} columns={[
          { key: 'name', title: 'سامانه', render: (row: Application) => <div><p className="font-medium text-gray-900">{row.name}</p><code className="text-xs text-gray-500">{row.code}</code></div> },
          { key: 'users', title: 'کاربران', render: (row: Application) => usersFor(row.id).length.toLocaleString('fa-IR') },
          { key: 'status', title: 'وضعیت', render: (row: Application) => <Badge variant={row.isActive ? 'success' : 'secondary'}>{row.isActive ? 'فعال' : 'غیرفعال'}</Badge> },
          { key: 'actions', title: '', render: (row: Application) => <div className="flex gap-2"><Button size="sm" variant="secondary" icon={<Eye className="h-4 w-4" />} onClick={() => { setSelected(row); setMode('detail'); }}>مشاهده</Button>{canManage && <Button size="sm" variant="secondary" icon={<Edit className="h-4 w-4" />} onClick={() => openEdit(row)}>ویرایش</Button>}</div> },
        ]} data={visible} emptyMessage="سامانه‌ای پیدا نشد." />
        <Pagination page={page} totalPages={Math.max(1, Math.ceil(filtered.length / pageSize))} total={filtered.length} limit={pageSize} onPageChange={setPage} />
      </Card>
    </main>

    <Modal isOpen={mode === 'create' || mode === 'edit'} onClose={() => !saving && setMode(null)} title={mode === 'edit' ? 'ویرایش سامانه' : 'ایجاد سامانه'}>
      <div className="space-y-4">
        <Input label="نام سامانه *" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
        <Input label="کد سامانه *" value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} dir="ltr" />
        <Textarea label="توضیح" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} rows={4} />
        <div className="flex justify-end gap-3 border-t pt-4"><Button variant="secondary" onClick={() => setMode(null)} disabled={saving}>انصراف</Button><Button onClick={() => void save()} loading={saving}>ذخیره</Button></div>
      </div>
    </Modal>

    <Modal isOpen={mode === 'detail'} onClose={() => setMode(null)} title={selected?.name || 'جزئیات سامانه'}>
      {selected && <div className="space-y-4"><dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-xs text-gray-500">کد</dt><dd className="font-mono">{selected.code}</dd></div><div><dt className="text-xs text-gray-500">وضعیت</dt><dd>{selected.isActive ? 'فعال' : 'غیرفعال'}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-gray-500">توضیح</dt><dd>{selected.description || '—'}</dd></div></dl><div><h3 className="mb-2 font-medium">کاربران دارای دسترسی</h3><div className="space-y-2">{usersFor(selected.id).map(item => <div key={item.user!.id} className="flex justify-between rounded-lg bg-gray-50 p-2"><span>{item.user!.fullName}</span><span className="text-xs text-gray-500">{item.roles.map(role => ROLE_LABELS[role]).join('، ')}</span></div>)}</div></div>{canManage && <div className="flex justify-end gap-3 border-t pt-4"><Button variant="secondary" onClick={() => openEdit(selected)}>ویرایش</Button><Button variant="secondary" className={selected.isActive ? 'text-amber-700' : 'text-green-700'} onClick={() => { setMode(null); setConfirmToggle(true); }}>{selected.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}</Button></div>}</div>}
    </Modal>

    <ConfirmModal isOpen={confirmToggle} onClose={() => setConfirmToggle(false)} onConfirm={() => void toggleActive()} title={selected?.isActive ? 'غیرفعال‌سازی سامانه' : 'فعال‌سازی سامانه'} message={`آیا از تغییر وضعیت «${selected?.name || ''}» اطمینان دارید؟`} confirmText="تأیید" loading={saving} />
  </div>;
};
