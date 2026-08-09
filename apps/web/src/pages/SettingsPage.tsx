import { useEffect, useState } from 'react';
import { Bell, Boxes, Database, Globe2, Settings2, Shield, Terminal } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { EnvironmentSettingsPanel } from '../components/settings/EnvironmentSettingsPanel';
import { SettingsTabs, type SettingsTabItem } from '../components/settings/SettingsTabs';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { applicationApi, systemSettingsApi, workflowPolicyApi } from '../services/api';
import { syncApplicationWorkflowPolicies } from '../services/workflowPolicyStore';
import { useAuthStore } from '../stores/authStore';
import type { Application, IntegrationAdapterConfig, IntegrationProvider, PlaywrightRunnerConfig, WorkflowPolicy } from '../types';

type SettingsTabId = 'environments' | 'automation' | 'integrations' | 'workflow' | 'general';

const tabs: SettingsTabItem[] = [
  { id: 'environments', label: 'محیط‌های اجرا', description: 'توسعه، تست و تولید', icon: <Boxes className="h-5 w-5" /> },
  { id: 'automation', label: 'اجرای خودکار', description: 'Runner و Playwright', icon: <Terminal className="h-5 w-5" /> },
  { id: 'integrations', label: 'یکپارچه‌سازی‌ها', description: 'CDE و FAVA', icon: <Globe2 className="h-5 w-5" /> },
  { id: 'workflow', label: 'گردش‌کار', description: 'سیاست انتشار سامانه‌ها', icon: <Shield className="h-5 w-5" /> },
  { id: 'general', label: 'عمومی', description: 'اعلان، امنیت و سیستم', icon: <Settings2 className="h-5 w-5" /> },
];

const ToggleSwitch: React.FC<{ checked: boolean; label: string; onChange: () => void; disabled?: boolean | undefined }> = ({ checked, label, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    disabled={disabled}
    className={`relative h-7 w-14 flex-shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
  >
    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${checked ? 'right-8' : 'right-1'}`} />
  </button>
);

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
  <div className="mb-5 flex items-start gap-3">
    <span className="rounded-xl bg-gray-100 p-2.5 text-gray-700">{icon}</span>
    <div><h2 className="font-semibold text-gray-900">{title}</h2><p className="mt-0.5 text-sm text-gray-500">{description}</p></div>
  </div>
);

const SettingToggle: React.FC<{ title: string; description: string; checked: boolean; onChange: () => void; disabled?: boolean | undefined }> = ({ title, description, checked, onChange, disabled }) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
    <div className="min-w-0"><p className="font-medium text-gray-900">{title}</p><p className="mt-1 text-sm leading-6 text-gray-500">{description}</p></div>
    <ToggleSwitch checked={checked} label={title} onChange={onChange} disabled={disabled} />
  </div>
);

export const SettingsPage: React.FC = () => {
  const { activeContext, refreshContexts } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTabId>('environments');
  const [applications, setApplications] = useState<Application[]>([]);
  const [workflowPolicies, setWorkflowPolicies] = useState<WorkflowPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [runnerDraft, setRunnerDraft] = useState<PlaywrightRunnerConfig | null>(null);
  const [adapterDrafts, setAdapterDrafts] = useState<Record<IntegrationProvider, IntegrationAdapterConfig> | null>(null);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({ email: true, browser: true, assignments: true, statusChanges: true, twoFactor: false });

  useEffect(() => {
    if (!activeContext) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([applicationApi.getAll(), workflowPolicyApi.getAll(), systemSettingsApi.getIntegrationSettings()])
      .then(([apps, policies, integrationSettings]) => {
        if (cancelled) return;
        syncApplicationWorkflowPolicies(apps);
        setApplications(apps);
        setWorkflowPolicies(policies);
        setRunnerDraft(integrationSettings.playwright);
        setAdapterDrafts({
          CDE: integrationSettings.adapters.find(adapter => adapter.provider === 'CDE')!,
          FAVA: integrationSettings.adapters.find(adapter => adapter.provider === 'FAVA')!,
        });
      })
      .catch(() => !cancelled && toast.error('بارگذاری تنظیمات سیستم انجام نشد.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [activeContext]);

  const updateRunner = <K extends keyof PlaywrightRunnerConfig>(field: K, value: PlaywrightRunnerConfig[K]) => {
    setRunnerDraft(previous => previous ? { ...previous, [field]: value } : previous);
  };

  const updateAdapter = <K extends keyof IntegrationAdapterConfig>(provider: IntegrationProvider, field: K, value: IntegrationAdapterConfig[K]) => {
    setAdapterDrafts(previous => previous ? { ...previous, [provider]: { ...previous[provider], [field]: value } } : previous);
  };

  const saveExecutionSettings = async () => {
    if (!activeContext || !runnerDraft || !adapterDrafts) return;
    setSaving(true);
    try {
      const [runner, cde, fava] = await Promise.all([
        systemSettingsApi.updatePlaywrightRunner(runnerDraft, activeContext.userId),
        systemSettingsApi.updateIntegrationAdapter('CDE', adapterDrafts.CDE, activeContext.userId),
        systemSettingsApi.updateIntegrationAdapter('FAVA', adapterDrafts.FAVA, activeContext.userId),
      ]);
      setRunnerDraft(runner);
      setAdapterDrafts({ CDE: cde || adapterDrafts.CDE, FAVA: fava || adapterDrafts.FAVA });
      toast.success('تنظیمات اجرا و یکپارچه‌سازی ذخیره شد.');
    } catch {
      toast.error('ذخیره تنظیمات اجرا و یکپارچه‌سازی انجام نشد.');
    } finally {
      setSaving(false);
    }
  };

  const changeWorkflowPolicy = async (applicationId: string, policyId: string) => {
    try {
      const updated = await workflowPolicyApi.updateApplicationPolicy(applicationId, policyId);
      if (!updated) return toast.error('سامانه پیدا نشد.');
      syncApplicationWorkflowPolicies([updated]);
      setApplications(previous => previous.map(application => application.id === applicationId ? updated : application));
      await refreshContexts();
      toast.success('سیاست گردش‌کار به‌روزرسانی شد.');
    } catch {
      toast.error('به‌روزرسانی سیاست گردش‌کار انجام نشد.');
    }
  };

  if (!activeContext) return null;

  const panelProps = (id: SettingsTabId) => ({
    id: `settings-panel-${id}`,
    role: 'tabpanel',
    'aria-labelledby': `settings-tab-${id}`,
    tabIndex: 0,
  } as const);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header title="تنظیمات سیستم" subtitle="مدیریت متمرکز محیط‌های اجرا، آزمون خودکار و سیاست‌های سامانه" />
      <main className="p-4 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <SettingsTabs items={tabs} activeId={activeTab} onChange={id => setActiveTab(id as SettingsTabId)} />

          {activeTab === 'environments' && <section {...panelProps('environments')}><EnvironmentSettingsPanel /></section>}

          {activeTab === 'automation' && (
            <section {...panelProps('automation')} className="space-y-5">
              <Card>
                <SectionHeader icon={<Terminal className="h-5 w-5 text-violet-600" />} title="Playwright Runner" description="رفتار پیش‌فرض صف و فرایند اجرای تست‌های مرورگر را کنترل کنید." />
                {runnerDraft ? (
                  <div className="space-y-5">
                    <div className="grid gap-3 lg:grid-cols-2">
                      <SettingToggle title="فعال‌سازی Playwright" description="امکان ثبت و اجرای تست‌های خودکار برای کاربران مجاز." checked={runnerDraft.enabled} onChange={() => updateRunner('enabled', !runnerDraft.enabled)} />
                      <SettingToggle title="کشف خودکار فایل‌ها" description="شناسایی خودکار فایل‌های تست پشتیبانی‌شده در مخزن CouchDB." checked={runnerDraft.autoDiscovery} onChange={() => updateRunner('autoDiscovery', !runnerDraft.autoDiscovery)} />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Input label="Runner ID" value={runnerDraft.runnerId} onChange={event => updateRunner('runnerId', event.target.value)} dir="ltr" />
                      <Input label="Timeout پیش‌فرض (ثانیه)" type="number" min={30} max={900} value={runnerDraft.defaultTimeoutSeconds} onChange={event => updateRunner('defaultTimeoutSeconds', Number(event.target.value) || 120)} dir="ltr" />
                      <Input className="font-mono" label="Working Directory" value={runnerDraft.defaultWorkingDirectory} onChange={event => updateRunner('defaultWorkingDirectory', event.target.value)} dir="ltr" />
                      <Input className="font-mono" label="Artifact Root" value={runnerDraft.artifactRoot} onChange={event => updateRunner('artifactRoot', event.target.value)} dir="ltr" />
                      <div className="md:col-span-2"><Input className="font-mono" label="Command Template" value={runnerDraft.commandTemplate} onChange={event => updateRunner('commandTemplate', event.target.value)} hint="متغیرهای مجاز: {testFilePath} و {environment}" dir="ltr" /></div>
                      <div className="md:col-span-2"><Input className="font-mono" label="Secret Reference" value={runnerDraft.secretReference || ''} onChange={event => updateRunner('secretReference', event.target.value)} dir="ltr" /></div>
                    </div>
                  </div>
                ) : <p className="text-sm text-gray-500">{loading ? 'در حال بارگذاری...' : 'تنظیمات Runner در دسترس نیست.'}</p>}
              </Card>
              <div className="flex justify-end"><Button onClick={() => void saveExecutionSettings()} loading={saving}>ذخیره تنظیمات اجرا</Button></div>
            </section>
          )}

          {activeTab === 'integrations' && (
            <section {...panelProps('integrations')} className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                {adapterDrafts && (['CDE', 'FAVA'] as IntegrationProvider[]).map(provider => {
                  const adapter = adapterDrafts[provider];
                  return (
                    <Card key={provider}>
                      <SectionHeader icon={<Globe2 className="h-5 w-5 text-blue-600" />} title={`${provider} Adapter`} description={`تنظیم اتصال و همگام‌سازی ${provider}`} />
                      <div className="space-y-4">
                        <SettingToggle title={`اتصال ${provider} فعال باشد`} description="Feature flag مربوط به این آداپتر را کنترل می‌کند." checked={adapter.enabled} onChange={() => updateAdapter(provider, 'enabled', !adapter.enabled)} />
                        <Input className="font-mono" label="Base URL" value={adapter.baseUrl} onChange={event => updateAdapter(provider, 'baseUrl', event.target.value)} dir="ltr" />
                        <Input className="font-mono" label="Credential Reference" value={adapter.credentialReference || ''} onChange={event => updateAdapter(provider, 'credentialReference', event.target.value)} dir="ltr" />
                        <Select label="جهت همگام‌سازی" value={adapter.syncDirection} onChange={event => updateAdapter(provider, 'syncDirection', event.target.value as IntegrationAdapterConfig['syncDirection'])} options={[{ value: 'PULL', label: 'PULL — دریافت' }, { value: 'PUSH', label: 'PUSH — ارسال' }, { value: 'BIDIRECTIONAL', label: 'BIDIRECTIONAL — دوطرفه' }]} />
                        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"><span className="text-gray-500">وضعیت سلامت</span><code className="text-gray-800">{adapter.lastHealthStatus}</code></div>
                      </div>
                    </Card>
                  );
                })}
              </div>
              <div className="flex justify-end"><Button onClick={() => void saveExecutionSettings()} loading={saving}>ذخیره یکپارچه‌سازی‌ها</Button></div>
            </section>
          )}

          {activeTab === 'workflow' && (
            <section {...panelProps('workflow')}>
              <Card>
                <SectionHeader icon={<Shield className="h-5 w-5 text-indigo-600" />} title="سیاست گردش‌کار انتشار" description="مسئول بازبینی کیفیت و تصمیم نهایی هر سامانه را تعیین کنید." />
                {loading ? <p className="text-sm text-gray-500">در حال بارگذاری...</p> : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {applications.map(application => {
                      const selectedPolicy = workflowPolicies.find(policy => policy.id === application.workflowPolicyId) || workflowPolicies[0];
                      return (
                        <div key={application.id} className="rounded-xl border border-gray-200 p-4">
                          <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,auto)]">
                            <div><p className="font-medium text-gray-900">{application.name}</p><p className="text-xs text-gray-500">{application.code}</p></div>
                            <Select aria-label={`سیاست ${application.name}`} value={application.workflowPolicyId || workflowPolicies[0]?.id || ''} onChange={event => void changeWorkflowPolicy(application.id, event.target.value)} options={workflowPolicies.map(policy => ({ value: policy.id, label: policy.name }))} />
                          </div>
                          {selectedPolicy && <p className="mt-3 border-t border-gray-100 pt-3 text-xs leading-5 text-gray-500">بازبینی کیفیت: {selectedPolicy.versionHistory.qaReviewOwnerLabel} · تصمیم نهایی: {selectedPolicy.versionHistory.decisionOwnerLabel}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </section>
          )}

          {activeTab === 'general' && (
            <section {...panelProps('general')} className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <SectionHeader icon={<Bell className="h-5 w-5 text-blue-600" />} title="اعلان‌ها" description="کانال‌ها و رویدادهای موردنظر برای دریافت اعلان." />
                  <div className="space-y-3">
                    <SettingToggle title="اعلان ایمیلی" description="دریافت اعلان‌های مهم از طریق ایمیل." checked={preferences.email} onChange={() => setPreferences(previous => ({ ...previous, email: !previous.email }))} />
                    <SettingToggle title="اعلان مرورگر" description="نمایش اعلان در مرورگر هنگام باز بودن سامانه." checked={preferences.browser} onChange={() => setPreferences(previous => ({ ...previous, browser: !previous.browser }))} />
                    <SettingToggle title="ارجاع کار" description="هشدار هنگام ارجاع یک مورد جدید." checked={preferences.assignments} onChange={() => setPreferences(previous => ({ ...previous, assignments: !previous.assignments }))} />
                    <SettingToggle title="تغییر وضعیت" description="هشدار هنگام تغییر مرحله یا نتیجه." checked={preferences.statusChanges} onChange={() => setPreferences(previous => ({ ...previous, statusChanges: !previous.statusChanges }))} />
                  </div>
                </Card>
                <div className="space-y-4">
                  <Card>
                    <SectionHeader icon={<Shield className="h-5 w-5 text-emerald-600" />} title="امنیت" description="کنترل‌های امنیتی حساب و نشست کاربر." />
                    <SettingToggle title="احراز هویت دومرحله‌ای" description="این قابلیت پس از اتصال سرویس هویت فعال خواهد شد." checked={preferences.twoFactor} onChange={() => setPreferences(previous => ({ ...previous, twoFactor: !previous.twoFactor }))} disabled />
                  </Card>
                  <Card>
                    <SectionHeader icon={<Database className="h-5 w-5 text-gray-600" />} title="اطلاعات سیستم" description="نسخه اجزای اصلی محیط فعلی." />
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      {[['Workspace', 'utms 0.0.0'], ['محیط', 'Local development'], ['Frontend', 'React 19 + Vite 7'], ['Playwright', '1.55.0']].map(([label, value]) => <div key={label} className="rounded-lg bg-gray-50 p-3"><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 font-mono text-gray-900" dir="ltr">{value}</dd></div>)}
                    </dl>
                  </Card>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};
