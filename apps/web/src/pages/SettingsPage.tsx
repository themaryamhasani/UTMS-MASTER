import { useEffect, useState } from 'react';
import { Bell, Database, Globe2, Settings2, Shield } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { SettingsTabs, type SettingsTabItem } from '../components/settings/SettingsTabs';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { applicationApi, systemSettingsApi, workflowPolicyApi } from '../services/api';
import { syncApplicationWorkflowPolicies } from '../services/workflowPolicyStore';
import { useAuthStore } from '../stores/authStore';
import type { Application, IntegrationAdapterConfig, WorkflowPolicy } from '../types';

type SettingsTabId = 'integrations' | 'workflow' | 'general';
const tabs: SettingsTabItem[] = [
  { id: 'integrations', label: 'یکپارچه‌سازی‌ها', description: 'آداپتر FAVA', icon: <Globe2 className="h-5 w-5" /> },
  { id: 'workflow', label: 'گردش‌کار', description: 'سیاست انتشار سامانه‌ها', icon: <Shield className="h-5 w-5" /> },
  { id: 'general', label: 'عمومی', description: 'اعلان، امنیت و سیستم', icon: <Settings2 className="h-5 w-5" /> },
];

const Toggle: React.FC<{ title: string; description: string; checked: boolean; onChange: () => void; disabled?: boolean }> = ({ title, description, checked, onChange, disabled }) => <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4"><div><p className="font-medium">{title}</p><p className="mt-1 text-sm text-gray-500">{description}</p></div><button type="button" role="switch" aria-checked={checked} aria-label={title} disabled={disabled} onClick={onChange} className={`relative h-7 w-14 rounded-full ${checked ? 'bg-blue-600' : 'bg-gray-300'} disabled:opacity-50`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'right-8' : 'right-1'}`} /></button></div>;
const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => <div className="mb-5 flex gap-3"><span className="rounded-xl bg-gray-100 p-2.5">{icon}</span><div><h2 className="font-semibold">{title}</h2><p className="text-sm text-gray-500">{description}</p></div></div>;

export const SettingsPage: React.FC = () => {
  const { activeContext, refreshContexts } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTabId>('integrations');
  const [applications, setApplications] = useState<Application[]>([]);
  const [policies, setPolicies] = useState<WorkflowPolicy[]>([]);
  const [adapter, setAdapter] = useState<IntegrationAdapterConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({ email: true, browser: true, assignments: true, statusChanges: true, twoFactor: false });

  useEffect(() => {
    if (!activeContext) return;
    let cancelled = false; setLoading(true);
    Promise.all([applicationApi.getAll(), workflowPolicyApi.getAll(), systemSettingsApi.getIntegrationSettings()])
      .then(([apps, workflowPolicies, settings]) => {
        if (cancelled) return;
        syncApplicationWorkflowPolicies(apps); setApplications(apps); setPolicies(workflowPolicies);
        setAdapter(settings.adapters.find(item => item.provider === 'FAVA') || null);
      })
      .catch(() => !cancelled && toast.error('بارگذاری تنظیمات سیستم انجام نشد.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [activeContext]);

  const updateAdapter = <K extends keyof IntegrationAdapterConfig>(field: K, value: IntegrationAdapterConfig[K]) => setAdapter(previous => previous ? { ...previous, [field]: value } : previous);
  const saveAdapter = async () => {
    if (!activeContext || !adapter) return; setSaving(true);
    try { setAdapter(await systemSettingsApi.updateIntegrationAdapter('FAVA', adapter, activeContext.userId)); toast.success('تنظیمات FAVA ذخیره شد.'); }
    catch { toast.error('ذخیره تنظیمات FAVA انجام نشد.'); }
    finally { setSaving(false); }
  };
  const changePolicy = async (applicationId: string, policyId: string) => {
    try { const updated = await workflowPolicyApi.updateApplicationPolicy(applicationId, policyId); if (!updated) return; syncApplicationWorkflowPolicies([updated]); setApplications(items => items.map(item => item.id === applicationId ? updated : item)); await refreshContexts(); toast.success('سیاست گردش‌کار به‌روزرسانی شد.'); }
    catch { toast.error('به‌روزرسانی سیاست گردش‌کار انجام نشد.'); }
  };
  if (!activeContext) return null;

  return <div className="min-h-screen bg-gray-50" dir="rtl"><Header title="تنظیمات سیستم" subtitle="مدیریت یکپارچه‌سازی، گردش‌کار و تنظیمات عمومی UTMS" /><main className="p-4 sm:p-6"><div className="mx-auto max-w-7xl space-y-5"><SettingsTabs items={tabs} activeId={activeTab} onChange={id => setActiveTab(id as SettingsTabId)} />
    {activeTab === 'integrations' && <section role="tabpanel"><Card><SectionHeader icon={<Globe2 className="h-5 w-5 text-blue-600" />} title="FAVA Adapter" description="تنظیم اتصال و جهت همگام‌سازی FAVA" />{adapter ? <div className="space-y-4"><Toggle title="اتصال FAVA فعال باشد" description="Feature flag این آداپتر را کنترل می‌کند." checked={adapter.enabled} onChange={() => updateAdapter('enabled', !adapter.enabled)} /><Input label="Base URL" value={adapter.baseUrl} onChange={event => updateAdapter('baseUrl', event.target.value)} dir="ltr" /><Input label="Credential Reference" value={adapter.credentialReference || ''} onChange={event => updateAdapter('credentialReference', event.target.value)} dir="ltr" /><Select label="جهت همگام‌سازی" value={adapter.syncDirection} onChange={event => updateAdapter('syncDirection', event.target.value as IntegrationAdapterConfig['syncDirection'])} options={[{ value: 'PULL', label: 'PULL — دریافت' }, { value: 'PUSH', label: 'PUSH — ارسال' }, { value: 'BIDIRECTIONAL', label: 'BIDIRECTIONAL — دوطرفه' }]} /><div className="flex justify-end"><Button onClick={() => void saveAdapter()} loading={saving}>ذخیره</Button></div></div> : <p className="text-sm text-gray-500">{loading ? 'در حال بارگذاری…' : 'آداپتر FAVA تعریف نشده است.'}</p>}</Card></section>}
    {activeTab === 'workflow' && <section role="tabpanel"><Card><SectionHeader icon={<Shield className="h-5 w-5 text-indigo-600" />} title="سیاست گردش‌کار انتشار" description="مالک بازبینی و تصمیم هر سامانه" /><div className="grid gap-3 lg:grid-cols-2">{applications.map(application => <div key={application.id} className="rounded-xl border p-4"><p className="mb-3 font-medium">{application.name}</p><Select aria-label={`سیاست ${application.name}`} value={application.workflowPolicyId || policies[0]?.id || ''} onChange={event => void changePolicy(application.id, event.target.value)} options={policies.map(policy => ({ value: policy.id, label: policy.name }))} /></div>)}</div></Card></section>}
    {activeTab === 'general' && <section role="tabpanel" className="grid gap-4 lg:grid-cols-2"><Card><SectionHeader icon={<Bell className="h-5 w-5 text-blue-600" />} title="اعلان‌ها" description="کانال‌ها و رویدادهای اعلان" /><div className="space-y-3"><Toggle title="اعلان ایمیلی" description="دریافت رویدادهای مهم با ایمیل." checked={preferences.email} onChange={() => setPreferences(value => ({ ...value, email: !value.email }))} /><Toggle title="اعلان مرورگر" description="نمایش اعلان در مرورگر." checked={preferences.browser} onChange={() => setPreferences(value => ({ ...value, browser: !value.browser }))} /><Toggle title="ارجاع کار" description="هشدار ارجاع مورد جدید." checked={preferences.assignments} onChange={() => setPreferences(value => ({ ...value, assignments: !value.assignments }))} /></div></Card><div className="space-y-4"><Card><SectionHeader icon={<Shield className="h-5 w-5 text-emerald-600" />} title="امنیت" description="کنترل‌های حساب" /><Toggle title="احراز هویت دومرحله‌ای" description="پس از اتصال سرویس هویت فعال می‌شود." checked={preferences.twoFactor} onChange={() => undefined} disabled /></Card><Card><SectionHeader icon={<Database className="h-5 w-5" />} title="اطلاعات سیستم" description="نسخه اجزای اصلی" /><dl className="grid gap-3 text-sm sm:grid-cols-2">{[['Workspace', 'utms 1.0.0'], ['Frontend', 'React 19 + Vite 7']].map(([label, value]) => <div key={label} className="rounded-lg bg-gray-50 p-3"><dt className="text-xs text-gray-500">{label}</dt><dd className="font-mono">{value}</dd></div>)}</dl></Card></div></section>}
  </div></main></div>;
};
