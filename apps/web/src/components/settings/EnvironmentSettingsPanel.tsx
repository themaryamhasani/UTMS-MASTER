import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, CircleOff, Layers3, Pencil, Plus, Power, RefreshCw, Server, Trash2, UsersRound } from 'lucide-react';
import { cdeApi, type ApplicationEnvironmentProfile, type CdeVisibleApplication } from '../../services/platformApi';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input, SearchableSelect } from '../ui/Input';
import { JalaliDateTimePicker } from '../ui/JalaliDateTimePicker';
import { ConfirmModal, Modal } from '../ui/Modal';
import { toast } from '../ui/Toast';

interface EnvironmentPreset {
  id: 'development' | 'test' | 'staging' | 'production';
  name: string;
  label: string;
  description: string;
  aliases: string[];
  color: string;
}

const presets: EnvironmentPreset[] = [
  { id: 'development', name: 'develop', label: 'توسعه', description: 'اجرای روزمره تیم توسعه و بررسی تغییرات اولیه', aliases: ['dev', 'develop', 'development', 'توسعه'], color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'test', name: 'test', label: 'تست', description: 'اجرای سناریوهای QA روی داده و سرویس کنترل‌شده', aliases: ['test', 'testing', 'qa', 'تست'], color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { id: 'staging', name: 'staging', label: 'پیش‌انتشار', description: 'اعتبارسنجی نسخه نزدیک به تولید پیش از انتشار', aliases: ['stage', 'staging', 'preproduction', 'pre-production', 'پیش انتشار', 'پیش‌انتشار'], color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'production', name: 'production', label: 'تولید', description: 'اجرای محدود و کنترل‌شده روی سامانه عملیاتی', aliases: ['prod', 'production', 'تولید'], color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
];

interface EnvironmentDraft {
  id?: string | undefined;
  presetId?: EnvironmentPreset['id'] | undefined;
  name: string;
  webBaseUrl: string;
  apiBaseUrl: string;
  gatewayBaseUrl: string;
  secretReference: string;
  enabled: boolean;
  availableFrom: string;
  availableUntil: string;
}

const emptyDraft: EnvironmentDraft = {
  name: '', webBaseUrl: '', apiBaseUrl: '', gatewayBaseUrl: '', secretReference: '', enabled: true,
  availableFrom: '', availableUntil: '',
};

interface BulkDraft {
  sourceEnvironmentId: string;
  enabled: boolean;
  availableFrom: string;
  availableUntil: string;
  createMissing: boolean;
  overwriteUrls: boolean;
}

function toLocalDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const part = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}

function toIsoDateTime(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function availabilityText(environment: ApplicationEnvironmentProfile) {
  if (!environment.enabled) return 'غیرفعال';
  if (environment.availableNow === false) {
    if (environment.availableFrom && new Date(environment.availableFrom) > new Date()) return 'زمان‌بندی‌شده';
    return 'پایان‌یافته';
  }
  return 'فعال';
}

function normalizedName(value: string) {
  return value.trim().toLocaleLowerCase('fa-IR').replace(/[\s_-]+/g, '');
}

function presetFor(environment: ApplicationEnvironmentProfile) {
  const name = normalizedName(environment.name);
  return presets.find(preset => preset.aliases.some(alias => normalizedName(alias) === name));
}

function environmentForPreset(environments: ApplicationEnvironmentProfile[], preset: EnvironmentPreset) {
  return environments.find(environment => presetFor(environment)?.id === preset.id);
}

function displayHost(value?: string | null) {
  if (!value) return 'ثبت نشده';
  try { return new URL(value).host; } catch { return value; }
}

export const EnvironmentSettingsPanel: React.FC = () => {
  const [applications, setApplications] = useState<CdeVisibleApplication[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState('');
  const [environments, setEnvironments] = useState<ApplicationEnvironmentProfile[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [environmentsLoading, setEnvironmentsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState<EnvironmentDraft | null>(null);
  const [bulkDraft, setBulkDraft] = useState<BulkDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApplicationEnvironmentProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const requestIdRef = useRef(0);

  const loadApplications = async () => {
    setApplicationsLoading(true);
    setLoadError('');
    try {
      const items = await cdeApi.applications();
      setApplications(items);
      setSelectedApplicationId(previous => items.some(item => item.id === previous) ? previous : items[0]?.id || '');
      if (!items.length) setLoadError('هیچ پروژه CDE نگاشت‌شده‌ای در محدوده دسترسی شما پیدا نشد.');
    } catch (error) {
      setApplications([]);
      setSelectedApplicationId('');
      setLoadError(error instanceof Error ? error.message : 'بارگذاری پروژه‌های CDE انجام نشد.');
    } finally {
      setApplicationsLoading(false);
    }
  };

  useEffect(() => { void loadApplications(); }, []);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setEnvironments([]);
    setDraft(null);
    if (!selectedApplicationId) return;
    setEnvironmentsLoading(true);
    setLoadError('');
    cdeApi.environments(selectedApplicationId, { includeDisabled: true })
      .then(items => {
        if (requestId === requestIdRef.current) setEnvironments(items);
      })
      .catch(error => {
        if (requestId === requestIdRef.current) {
          setLoadError(error instanceof Error ? error.message : 'بارگذاری محیط‌های اجرا انجام نشد.');
        }
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setEnvironmentsLoading(false);
      });
  }, [selectedApplicationId]);

  const selectedApplication = applications.find(item => item.id === selectedApplicationId);
  const configuredCount = presets.filter(preset => environmentForPreset(environments, preset)).length;
  const enabledCount = environments.filter(environment => environment.enabled).length;
  const customEnvironments = environments.filter(environment => !presetFor(environment));
  const projectOptions = useMemo(() => applications.map(application => ({
    value: application.id,
    label: `${application.projectKey} — ${application.name}`,
    keywords: `${application.code} ${application.projectKey} ${application.name}`,
  })), [applications]);

  const openEditor = (preset?: EnvironmentPreset, environment?: ApplicationEnvironmentProfile) => {
    setDraft({
      id: environment?.id,
      presetId: preset?.id,
      name: environment?.name || preset?.name || '',
      webBaseUrl: environment?.webBaseUrl || '',
      apiBaseUrl: environment?.apiBaseUrl || '',
      gatewayBaseUrl: environment?.gatewayBaseUrl || '',
      secretReference: environment?.secretReferences?.runtime || '',
      enabled: environment?.enabled ?? true,
      availableFrom: toLocalDateTime(environment?.availableFrom),
      availableUntil: toLocalDateTime(environment?.availableUntil),
    });
  };

  const availabilityPayload = (availableFrom: string, availableUntil: string) => {
    const from = toIsoDateTime(availableFrom);
    const until = toIsoDateTime(availableUntil);
    if (availableFrom && !from) throw new Error('زمان شروع بازه معتبر نیست.');
    if (availableUntil && !until) throw new Error('زمان پایان بازه معتبر نیست.');
    if (from && until && new Date(until) <= new Date(from)) throw new Error('زمان پایان باید بعد از زمان شروع باشد.');
    return { availableFrom: from, availableUntil: until };
  };

  const saveEnvironment = async () => {
    if (!draft || !selectedApplicationId) return;
    if (!draft.name.trim() || !draft.webBaseUrl.trim()) {
      toast.error('نام محیط و آدرس Web الزامی است.');
      return;
    }
    setSaving(true);
    try {
      const availability = availabilityPayload(draft.availableFrom, draft.availableUntil);
      const data = {
        name: draft.name.trim(),
        webBaseUrl: draft.webBaseUrl.trim(),
        apiBaseUrl: draft.apiBaseUrl.trim() || null,
        gatewayBaseUrl: draft.gatewayBaseUrl.trim() || null,
        secretReferences: draft.secretReference.trim() ? { runtime: draft.secretReference.trim() } : {},
        enabled: draft.enabled,
        ...availability,
      };
      if (draft.id) await cdeApi.updateEnvironment(selectedApplicationId, draft.id, data);
      else await cdeApi.saveEnvironment(selectedApplicationId, data);
      const refreshed = await cdeApi.environments(selectedApplicationId, { includeDisabled: true });
      setEnvironments(refreshed);
      setDraft(null);
      toast.success(`محیط «${data.name}» ذخیره شد.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ذخیره محیط اجرا انجام نشد.');
    } finally {
      setSaving(false);
    }
  };

  const deleteCustomEnvironment = async () => {
    if (!deleteTarget || !selectedApplicationId) return;
    setDeleting(true);
    try {
      await cdeApi.deleteEnvironment(selectedApplicationId, deleteTarget.id);
      setEnvironments(previous => previous.filter(environment => environment.id !== deleteTarget.id));
      toast.success(`محیط سفارشی «${deleteTarget.name}» حذف شد.`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'حذف محیط سفارشی انجام نشد.');
    } finally {
      setDeleting(false);
    }
  };

  const toggleCustomEnvironment = async (environment: ApplicationEnvironmentProfile) => {
    if (!selectedApplicationId || togglingId) return;
    setTogglingId(environment.id);
    try {
      const updated = await cdeApi.updateEnvironment(selectedApplicationId, environment.id, { enabled: !environment.enabled });
      setEnvironments(previous => previous.map(item => {
        if (item.id !== environment.id) return item;
        const next = { ...item, ...updated };
        if (item.secretReferences) next.secretReferences = item.secretReferences;
        return next;
      }));
      toast.success(`محیط «${environment.name}» ${updated.enabled ? 'فعال' : 'غیرفعال'} شد.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تغییر وضعیت محیط انجام نشد.');
    } finally {
      setTogglingId('');
    }
  };

  const openBulkEditor = () => {
    const source = environments[0];
    if (!source) {
      toast.warning('ابتدا حداقل یک محیط را برای سامانه فعلی پیکربندی کنید.');
      return;
    }
    setBulkDraft({
      sourceEnvironmentId: source.id,
      enabled: source.enabled,
      availableFrom: toLocalDateTime(source.availableFrom),
      availableUntil: toLocalDateTime(source.availableUntil),
      createMissing: true,
      overwriteUrls: false,
    });
  };

  const selectBulkSource = (environmentId: string) => {
    const source = environments.find(environment => environment.id === environmentId);
    if (!source || !bulkDraft) return;
    setBulkDraft({
      ...bulkDraft,
      sourceEnvironmentId: source.id,
      enabled: source.enabled,
      availableFrom: toLocalDateTime(source.availableFrom),
      availableUntil: toLocalDateTime(source.availableUntil),
    });
  };

  const applyBulkSettings = async () => {
    if (!bulkDraft || !selectedApplicationId) return;
    setBulkSaving(true);
    try {
      const availability = availabilityPayload(bulkDraft.availableFrom, bulkDraft.availableUntil);
      const result = await cdeApi.bulkConfigureEnvironments({
        sourceApplicationId: selectedApplicationId,
        sourceEnvironmentId: bulkDraft.sourceEnvironmentId,
        allMapped: true,
        enabled: bulkDraft.enabled,
        ...availability,
        createMissing: bulkDraft.createMissing,
        overwriteUrls: bulkDraft.overwriteUrls,
      });
      setEnvironments(await cdeApi.environments(selectedApplicationId, { includeDisabled: true }));
      setBulkDraft(null);
      toast.success(`${result.updated} محیط به‌روزرسانی و ${result.created} محیط ایجاد شد${result.skipped ? `؛ ${result.skipped} مورد بدون تغییر ماند` : ''}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تنظیم دسته‌جمعی محیط‌ها انجام نشد.');
    } finally {
      setBulkSaving(false);
    }
  };

  const renderEnvironmentCard = (preset: EnvironmentPreset, environment?: ApplicationEnvironmentProfile) => (
    <Card key={preset.id} className="flex h-full flex-col" padding="none">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`rounded-xl border p-2.5 ${preset.color}`}><Server className="h-5 w-5" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-gray-900">{preset.label}</h3>
              <Badge size="sm" variant={environment ? (environment.availableNow ? 'success' : environment.enabled ? 'warning' : 'default') : 'warning'}>
                {environment ? availabilityText(environment) : 'پیکربندی نشده'}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-gray-500">{preset.description}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3"><dt className="text-gray-500">Web</dt><dd className="max-w-[70%] truncate font-mono text-xs text-gray-800" dir="ltr">{displayHost(environment?.webBaseUrl)}</dd></div>
          <div className="flex items-center justify-between gap-3"><dt className="text-gray-500">API</dt><dd className="max-w-[70%] truncate font-mono text-xs text-gray-800" dir="ltr">{displayHost(environment?.apiBaseUrl)}</dd></div>
          <div className="flex items-center justify-between gap-3"><dt className="text-gray-500">Gateway</dt><dd className="max-w-[70%] truncate font-mono text-xs text-gray-800" dir="ltr">{displayHost(environment?.gatewayBaseUrl)}</dd></div>
        </dl>
        <Button className="mt-auto w-full" variant={environment ? 'outline' : 'secondary'} icon={environment ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} onClick={() => openEditor(preset, environment)}>
          {environment ? 'ویرایش تنظیمات' : 'پیکربندی محیط'}
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="space-y-5" dir="rtl">
      <Card className="overflow-visible bg-gradient-to-l from-blue-50 via-white to-white">
        <div className="grid items-end gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <SearchableSelect
            id="settings-cde-project"
            label="پروژه CDE"
            value={selectedApplicationId}
            onValueChange={setSelectedApplicationId}
            options={projectOptions}
            placeholder={applicationsLoading ? 'در حال دریافت پروژه‌ها...' : 'پروژه را انتخاب کنید'}
            searchPlaceholder="جستجو با نام پروژه، سامانه یا کد..."
            emptyMessage="پروژه‌ای با این عبارت پیدا نشد."
            disabled={applicationsLoading || !applications.length}
            hint="محیط‌های اجرا به نگاشت همین پروژه و سامانه متصل می‌شوند."
          />
          <Button variant="outline" icon={<RefreshCw className={`h-4 w-4 ${applicationsLoading ? 'animate-spin' : ''}`} />} onClick={() => void loadApplications()} disabled={applicationsLoading}>
            تازه‌سازی پروژه‌ها
          </Button>
          <Button icon={<UsersRound className="h-4 w-4" />} onClick={openBulkEditor} disabled={!environments.length || applicationsLoading}>
            تنظیم دسته‌جمعی
          </Button>
        </div>
        {selectedApplication && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-blue-100 pt-4 text-sm text-gray-600">
            <Layers3 className="h-4 w-4 text-blue-600" />
            <span>{selectedApplication.name}</span>
            <span className="text-gray-300">•</span>
            <code dir="ltr" className="rounded bg-white px-2 py-1 text-xs text-blue-700">{selectedApplication.projectKey}</code>
          </div>
        )}
      </Card>

      {loadError && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-2"><CircleOff className="mt-0.5 h-5 w-5 flex-shrink-0" /><p>{loadError}</p></div>
          <p className="mt-2 text-xs text-amber-700">برای دریافت فهرست پروژه‌ها، اتصال CDE باید فعال و نگاشت سامانه ثبت شده باشد.</p>
        </div>
      )}

      {selectedApplicationId && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">محیط‌های استاندارد</p><p className="mt-1 text-2xl font-bold text-gray-900">{configuredCount}<span className="text-sm font-normal text-gray-400"> / ۴</span></p></div>
            <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">پروفایل‌های فعال</p><p className="mt-1 text-2xl font-bold text-emerald-600">{enabledCount}</p></div>
            <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">پروفایل‌های سفارشی</p><p className="mt-1 text-2xl font-bold text-gray-900">{customEnvironments.length}</p></div>
          </div>

          {environmentsLoading ? (
            <div className="grid gap-4 md:grid-cols-2"><div className="h-64 animate-pulse rounded-xl bg-gray-100" /><div className="h-64 animate-pulse rounded-xl bg-gray-100" /></div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {presets.map(preset => renderEnvironmentCard(preset, environmentForPreset(environments, preset)))}
            </div>
          )}

          {!environmentsLoading && (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="font-semibold text-gray-900">محیط‌های سفارشی</h3><p className="text-sm text-gray-500">برای محیط‌های موقت، دمو یا سناریوهای اختصاصی پروفایل جدا بسازید.</p></div>
                <Button variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setDraft({ ...emptyDraft })}>افزودن محیط سفارشی</Button>
              </div>
              {customEnvironments.length > 0 && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {customEnvironments.map(environment => (
                    <div key={environment.id} className="rounded-xl border border-gray-200 p-3 transition hover:border-blue-300 hover:bg-blue-50/30">
                      <div className="flex items-start justify-between gap-3">
                        <button type="button" onClick={() => openEditor(undefined, environment)} className="min-w-0 flex-1 text-right">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-gray-900">{environment.name}</p>
                            <Badge size="sm" variant={environment.availableNow ? 'success' : environment.enabled ? 'warning' : 'default'}>{availabilityText(environment)}</Badge>
                          </div>
                          <p dir="ltr" className="mt-1 truncate text-xs text-gray-500">{environment.webBaseUrl}</p>
                          {(environment.availableFrom || environment.availableUntil) && (
                            <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                              <CalendarClock className="h-3.5 w-3.5" />
                              {environment.availableFrom ? new Date(environment.availableFrom).toLocaleString('fa-IR') : 'بدون شروع'}
                              <span>تا</span>
                              {environment.availableUntil ? new Date(environment.availableUntil).toLocaleString('fa-IR') : 'بدون پایان'}
                            </p>
                          )}
                        </button>
                        <div className="flex flex-shrink-0 items-center gap-1">
                          <button type="button" disabled={Boolean(togglingId)} onClick={() => void toggleCustomEnvironment(environment)} aria-label={`${environment.enabled ? 'غیرفعال‌کردن' : 'فعال‌کردن'} ${environment.name}`} className={`rounded-lg p-2 hover:bg-gray-100 disabled:opacity-50 ${environment.enabled ? 'text-emerald-600' : 'text-gray-400'}`}><Power className="h-4 w-4" /></button>
                          <button type="button" onClick={() => openEditor(undefined, environment)} aria-label={`ویرایش ${environment.name}`} className="rounded-lg p-2 text-blue-600 hover:bg-blue-100"><Pencil className="h-4 w-4" /></button>
                          <button type="button" onClick={() => setDeleteTarget(environment)} aria-label={`حذف ${environment.name}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      <Modal isOpen={Boolean(draft)} onClose={() => !saving && setDraft(null)} title={draft?.id ? 'ویرایش محیط اجرا' : 'ایجاد محیط اجرا'} size="xl">
        {draft && (
          <form onSubmit={event => { event.preventDefault(); void saveEnvironment(); }} className="space-y-5">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
              URLهای این فرم مقصد واقعی اجرای Playwright هستند؛ آدرس ویرایشگر سورس CDE قابل استفاده نیست.
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="نام محیط *" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} disabled={Boolean(draft.presetId)} placeholder="مثلاً develop" dir="ltr" />
              <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2.5">
                <span><span className="block text-sm font-medium text-gray-800">محیط فعال باشد</span><span className="text-xs text-gray-500">فقط محیط فعال در فرم اجرای تست نمایش داده می‌شود.</span></span>
                <input type="checkbox" checked={draft.enabled} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} className="h-5 w-5 accent-blue-600" />
              </label>
              <Input className="font-mono" label="آدرس Web *" value={draft.webBaseUrl} onChange={event => setDraft({ ...draft, webBaseUrl: event.target.value })} placeholder="https://app.example.ir" dir="ltr" />
              <Input className="font-mono" label="آدرس API" value={draft.apiBaseUrl} onChange={event => setDraft({ ...draft, apiBaseUrl: event.target.value })} placeholder="https://api.example.ir" dir="ltr" />
              <Input className="font-mono" label="آدرس Gateway" value={draft.gatewayBaseUrl} onChange={event => setDraft({ ...draft, gatewayBaseUrl: event.target.value })} placeholder="https://gateway.example.ir" dir="ltr" />
              <Input className="font-mono" label="مرجع Secret" value={draft.secretReference} onChange={event => setDraft({ ...draft, secretReference: event.target.value })} placeholder="vault://utms/project/environment" dir="ltr" hint="مقدار Secret را وارد نکنید؛ فقط شناسه یا مسیر امن آن را ثبت کنید." />
              <JalaliDateTimePicker label="شروع دسترسی (اختیاری)" value={draft.availableFrom} onChange={availableFrom => setDraft({ ...draft, availableFrom })} />
              <JalaliDateTimePicker label="پایان دسترسی (اختیاری)" value={draft.availableUntil} onChange={availableUntil => setDraft({ ...draft, availableUntil })} hint="تاریخ شمسی است؛ خارج از این بازه، محیط در فرم اجرای تست قابل انتخاب نیست." />
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
              <Button variant="secondary" onClick={() => setDraft(null)} disabled={saving}>انصراف</Button>
              <Button type="submit" loading={saving}>ذخیره محیط</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={Boolean(bulkDraft)} onClose={() => !bulkSaving && setBulkDraft(null)} title="تنظیم دسته‌جمعی محیط اجرا" size="xl">
        {bulkDraft && (
          <form onSubmit={event => { event.preventDefault(); void applyBulkSettings(); }} className="space-y-5">
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-900">
              تنظیمات روی همه سامانه‌های فعال دارای نگاشت CDE اعمال می‌شود؛ اکنون {applications.length.toLocaleString('fa-IR')} مورد از آن‌ها در اتصال CDE شما قابل مشاهده است. آدرس‌های اختصاصی هر سامانه به‌صورت پیش‌فرض حفظ خواهند شد.
            </div>
            <SearchableSelect
              label="محیط مبنا"
              value={bulkDraft.sourceEnvironmentId}
              onValueChange={selectBulkSource}
              options={environments.map(environment => ({ value: environment.id, label: `${environment.name} — ${displayHost(environment.webBaseUrl)}`, keywords: environment.webBaseUrl }))}
              searchPlaceholder="جستجوی محیط مبنا..."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
                <span><span className="block text-sm font-medium text-gray-800">فعال باشد</span><span className="text-xs text-gray-500">وضعیت این محیط در تمام سامانه‌ها</span></span>
                <input type="checkbox" checked={bulkDraft.enabled} onChange={event => setBulkDraft({ ...bulkDraft, enabled: event.target.checked })} className="h-5 w-5 accent-blue-600" />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
                <span><span className="block text-sm font-medium text-gray-800">ایجاد در سامانه‌های فاقد محیط</span><span className="text-xs text-gray-500">اگر محیط وجود ندارد، از مبنا کپی شود.</span></span>
                <input type="checkbox" checked={bulkDraft.createMissing} onChange={event => setBulkDraft({ ...bulkDraft, createMissing: event.target.checked })} className="h-5 w-5 accent-blue-600" />
              </label>
              <JalaliDateTimePicker label="شروع دسترسی (اختیاری)" value={bulkDraft.availableFrom} onChange={availableFrom => setBulkDraft({ ...bulkDraft, availableFrom })} />
              <JalaliDateTimePicker label="پایان دسترسی (اختیاری)" value={bulkDraft.availableUntil} onChange={availableUntil => setBulkDraft({ ...bulkDraft, availableUntil })} />
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <input type="checkbox" checked={bulkDraft.overwriteUrls} onChange={event => setBulkDraft({ ...bulkDraft, overwriteUrls: event.target.checked })} className="mt-1 h-5 w-5 accent-amber-600" />
              <span><span className="block font-medium text-amber-900">آدرس‌ها و Secret Reference نیز یکسان‌سازی شوند</span><span className="mt-1 block text-xs leading-5 text-amber-700">با فعال‌کردن این گزینه، Web/API/Gateway تمام محیط‌های موجود با محیط مبنا جایگزین می‌شود. فقط زمانی استفاده کنید که مقصد همه سامانه‌ها واقعاً مشترک است.</span></span>
            </label>
            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
              <Button variant="secondary" onClick={() => setBulkDraft(null)} disabled={bulkSaving}>انصراف</Button>
              <Button type="submit" loading={bulkSaving}>اعمال روی همه سامانه‌ها</Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={() => void deleteCustomEnvironment()}
        title="حذف محیط سفارشی"
        message={`محیط «${deleteTarget?.name || ''}» حذف شود؟ اجرای جدید دیگر نمی‌تواند از این محیط استفاده کند.`}
        confirmText="حذف محیط"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};
