import { useEffect, useState } from 'react';
import { Bell, Shield, Terminal, Database, Globe } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../stores/authStore';
import { applicationApi, systemSettingsApi, workflowPolicyApi } from '../services/api';
import { syncApplicationWorkflowPolicies } from '../services/workflowPolicyStore';
import { toast } from '../components/ui/Toast';
import type {
  Application,
  IntegrationAdapterConfig,
  IntegrationProvider,
  PlaywrightRunnerConfig,
  WorkflowPolicy,
} from '../types';

interface SettingSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  settings: SettingItem[];
}

interface SettingItem {
  id: string;
  label: string;
  description?: string;
  type: 'toggle' | 'select' | 'input';
  value: boolean | string;
  options?: { value: string; label: string }[];
}

const ToggleSwitch: React.FC<{ checked: boolean; label: string; onChange: () => void }> = ({
  checked,
  label,
  onChange,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    className={`relative h-7 w-14 flex-shrink-0 rounded-full transition-colors ${
      checked ? 'bg-blue-600' : 'bg-gray-300'
    }`}
  >
    <span
      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
        checked ? 'right-8' : 'right-1'
      }`}
    />
  </button>
);

export const SettingsPage: React.FC = () => {
  const { activeContext, refreshContexts } = useAuthStore();
  const [applications, setApplications] = useState<Application[]>([]);
  const [workflowPolicies, setWorkflowPolicies] = useState<WorkflowPolicy[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(true);
  const [runnerDraft, setRunnerDraft] = useState<PlaywrightRunnerConfig | null>(null);
  const [adapterDrafts, setAdapterDrafts] = useState<Record<IntegrationProvider, IntegrationAdapterConfig> | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settings, setSettings] = useState<Record<string, boolean | string>>({
    'notifications.email': true,
    'notifications.browser': true,
    'notifications.assignments': true,
    'notifications.statusChanges': true,
    'security.twoFactor': false,
    'security.sessionTimeout': '30',
    'playwright.enabled': true,
    'playwright.autoDiscovery': true,
    'integrations.cde': false,
    'integrations.fava': false,
  });

  const handleToggle = (key: string) => {
    if (key === 'playwright.enabled' || key === 'playwright.autoDiscovery') {
      const field = key === 'playwright.enabled' ? 'enabled' : 'autoDiscovery';
      setRunnerDraft(prev => prev ? { ...prev, [field]: !prev[field] } : prev);
      return;
    }
    if (key === 'integrations.cde' || key === 'integrations.fava') {
      const provider: IntegrationProvider = key === 'integrations.cde' ? 'CDE' : 'FAVA';
      setAdapterDrafts(prev => prev ? {
        ...prev,
        [provider]: {
          ...prev[provider],
          enabled: !prev[provider].enabled,
        },
      } : prev);
      return;
    }
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  useEffect(() => {
    if (activeContext) {
      loadWorkflowSettings();
    }
  }, [activeContext]);

  const loadWorkflowSettings = async () => {
    setWorkflowLoading(true);
    try {
      const [apps, policies] = await Promise.all([
        applicationApi.getAll(),
        workflowPolicyApi.getAll(),
      ]);
      const integrationSettings = await systemSettingsApi.getIntegrationSettings();
      syncApplicationWorkflowPolicies(apps);
      setApplications(apps);
      setWorkflowPolicies(policies);
      setRunnerDraft(integrationSettings.playwright);
      setAdapterDrafts({
        CDE: integrationSettings.adapters.find(adapter => adapter.provider === 'CDE')!,
        FAVA: integrationSettings.adapters.find(adapter => adapter.provider === 'FAVA')!,
      });
    } catch {
      toast.error('خطا در بارگذاری سیاست‌های گردش‌کار.');
    } finally {
      setWorkflowLoading(false);
    }
  };

  const updateRunnerDraft = (field: keyof PlaywrightRunnerConfig, value: string | boolean | number) => {
    setRunnerDraft(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const updateAdapterDraft = (
    provider: IntegrationProvider,
    field: keyof IntegrationAdapterConfig,
    value: string | boolean
  ) => {
    setAdapterDrafts(prev => prev ? {
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value,
      },
    } : prev);
  };

  const saveSystemSettings = async () => {
    if (!activeContext || !runnerDraft || !adapterDrafts) return;
    setSettingsSaving(true);
    try {
      const [runner, cde, fava] = await Promise.all([
        systemSettingsApi.updatePlaywrightRunner(runnerDraft, activeContext.userId),
        systemSettingsApi.updateIntegrationAdapter('CDE', adapterDrafts.CDE, activeContext.userId),
        systemSettingsApi.updateIntegrationAdapter('FAVA', adapterDrafts.FAVA, activeContext.userId),
      ]);
      setRunnerDraft(runner);
      setAdapterDrafts({
        CDE: cde || adapterDrafts.CDE,
        FAVA: fava || adapterDrafts.FAVA,
      });
      toast.success('تنظیمات Runner و Integration ذخیره شد.');
    } catch {
      toast.error('خطا در ذخیره تنظیمات Runner و Integration.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleWorkflowPolicyChange = async (applicationId: string, policyId: string) => {
    try {
      const updated = await workflowPolicyApi.updateApplicationPolicy(applicationId, policyId);
      if (!updated) {
        toast.error('سامانه یافت نشد.');
        return;
      }
      syncApplicationWorkflowPolicies([updated]);
      setApplications(prev => prev.map(app => app.id === applicationId ? updated : app));
      await refreshContexts();
      toast.success('سیاست گردش‌کار انتشار به‌روزرسانی شد.');
    } catch {
      toast.error('خطا در به‌روزرسانی سیاست گردش‌کار.');
    }
  };

  if (!activeContext) return null;

  const sections: SettingSection[] = [
    {
      id: 'notifications',
      title: 'اعلان‌ها',
      description: 'تنظیمات اعلان‌ها و هشدارها',
      icon: <Bell className="w-5 h-5 text-blue-500" />,
      settings: [
        { id: 'notifications.email', label: 'اعلان ایمیلی', description: 'دریافت اعلان از طریق ایمیل', type: 'toggle', value: settings['notifications.email'] ?? false },
        { id: 'notifications.browser', label: 'اعلان مرورگر', description: 'نمایش اعلان در مرورگر', type: 'toggle', value: settings['notifications.browser'] ?? false },
        { id: 'notifications.assignments', label: 'ارجاعات', description: 'اعلان هنگام ارجاع کار', type: 'toggle', value: settings['notifications.assignments'] ?? false },
        { id: 'notifications.statusChanges', label: 'تغییر وضعیت', description: 'اعلان هنگام تغییر وضعیت', type: 'toggle', value: settings['notifications.statusChanges'] ?? false },
      ],
    },
    {
      id: 'security',
      title: 'امنیت',
      description: 'تنظیمات امنیتی سیستم',
      icon: <Shield className="w-5 h-5 text-green-500" />,
      settings: [
        { id: 'security.twoFactor', label: 'احراز هویت دو مرحله‌ای', description: 'فعال‌سازی 2FA (به زودی)', type: 'toggle', value: settings['security.twoFactor'] ?? false },
      ],
    },
    {
      id: 'playwright',
      title: 'Playwright',
      description: 'تنظیمات تست خودکار',
      icon: <Terminal className="w-5 h-5 text-purple-500" />,
      settings: [
        { id: 'playwright.enabled', label: 'فعال‌سازی Playwright', description: 'امکان اجرای تست‌های خودکار', type: 'toggle', value: runnerDraft?.enabled ?? settings['playwright.enabled'] ?? false },
        { id: 'playwright.autoDiscovery', label: 'کشف خودکار فایل‌ها', description: 'جستجوی خودکار فایل‌های تست', type: 'toggle', value: runnerDraft?.autoDiscovery ?? settings['playwright.autoDiscovery'] ?? false },
      ],
    },
    {
      id: 'integrations',
      title: 'یکپارچه‌سازی',
      description: 'اتصال به سیستم‌های خارجی',
      icon: <Globe className="w-5 h-5 text-amber-500" />,
      settings: [
        { id: 'integrations.cde', label: 'اتصال به CDE', description: 'یکپارچه‌سازی با CDE از طریق Adapter و Feature Flag', type: 'toggle', value: adapterDrafts?.CDE.enabled ?? settings['integrations.cde'] ?? false },
        { id: 'integrations.fava', label: 'اتصال به Fava', description: 'یکپارچه‌سازی با Fava از طریق Adapter و Feature Flag', type: 'toggle', value: adapterDrafts?.FAVA.enabled ?? settings['integrations.fava'] ?? false },
      ],
    },
  ];

  const renderSettingSection = (section: SettingSection) => (
    <Card key={section.id}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gray-100 rounded-lg">
          {section.icon}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900">{section.title}</h3>
          <p className="text-sm text-gray-500">{section.description}</p>
        </div>
      </div>

      <div className="space-y-4">
        {section.settings.map((setting) => (
          <div
            key={setting.id}
            className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0"
          >
            <div className="min-w-0">
              <p className="font-medium text-gray-900">{setting.label}</p>
              {setting.description && (
                <p className="text-sm text-gray-500">{setting.description}</p>
              )}
            </div>
            {setting.type === 'toggle' && (
              <ToggleSwitch
                checked={Boolean(setting.value)}
                label={setting.label}
                onChange={() => handleToggle(setting.id)}
              />
            )}
          </div>
        ))}
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="تنظیمات سیستم"
        subtitle="پیکربندی دسته‌بندی‌شده سامانه، اجرا و سیاست انتشار"
      />

      <main className="p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">اعلان و امنیت</h2>
              <p className="text-sm text-gray-500">تنظیمات رفتار حساب، اعلان‌ها و کنترل‌های امنیتی.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {sections
                .filter(section => ['notifications', 'security'].includes(section.id))
                .map(renderSettingSection)}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">اجرای تست و اتصال‌ها</h2>
              <p className="text-sm text-gray-500">تنظیمات Playwright، Adapterها و اتصال به سامانه‌های بیرونی.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {sections
                .filter(section => ['playwright', 'integrations'].includes(section.id))
                .map(renderSettingSection)}
            </div>
          </section>

          {runnerDraft && adapterDrafts && (
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Terminal className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">جزئیات Runner و Adapterها</h3>
                  <p className="text-sm text-gray-500">پیکربندی اجرای Playwright و اتصال‌های CDE/FAVA</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Playwright Runner</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-sm text-gray-600">Runner ID</span>
                      <input
                        value={runnerDraft.runnerId}
                        onChange={(e) => updateRunnerDraft('runnerId', e.target.value)}
                        className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm text-gray-600">Timeout پیش‌فرض</span>
                      <input
                        type="number"
                        min={30}
                        max={900}
                        value={runnerDraft.defaultTimeoutSeconds}
                        onChange={(e) => updateRunnerDraft('defaultTimeoutSeconds', Number(e.target.value) || 120)}
                        className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="text-sm text-gray-600">Command Template</span>
                      <input
                        value={runnerDraft.commandTemplate}
                        onChange={(e) => updateRunnerDraft('commandTemplate', e.target.value)}
                        className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono"
                      />
                      <span className="text-xs text-gray-500">متغیرهای مجاز: {'{testFilePath}'} و {'{environment}'}</span>
                    </label>
                    <label className="block">
                      <span className="text-sm text-gray-600">Working Directory</span>
                      <input
                        value={runnerDraft.defaultWorkingDirectory}
                        onChange={(e) => updateRunnerDraft('defaultWorkingDirectory', e.target.value)}
                        className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm text-gray-600">Artifact Root</span>
                      <input
                        value={runnerDraft.artifactRoot}
                        onChange={(e) => updateRunnerDraft('artifactRoot', e.target.value)}
                        className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="text-sm text-gray-600">Secret Reference</span>
                      <input
                        value={runnerDraft.secretReference || ''}
                        onChange={(e) => updateRunnerDraft('secretReference', e.target.value)}
                        className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono"
                      />
                    </label>
                  </div>
                </div>

                {(['CDE', 'FAVA'] as IntegrationProvider[]).map(provider => {
                  const adapter = adapterDrafts[provider];
                  return (
                    <div key={provider} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">{provider} Adapter</h4>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${adapter.enabled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                          {adapter.enabled ? 'فعال' : 'غیرفعال'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="block">
                          <span className="text-sm text-gray-600">Base URL</span>
                          <input
                            value={adapter.baseUrl}
                            onChange={(e) => updateAdapterDraft(provider, 'baseUrl', e.target.value)}
                            className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono"
                          />
                        </label>
                        <label className="block">
                          <span className="text-sm text-gray-600">Credential Reference</span>
                          <input
                            value={adapter.credentialReference || ''}
                            onChange={(e) => updateAdapterDraft(provider, 'credentialReference', e.target.value)}
                            className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono"
                          />
                        </label>
                        <label className="block">
                          <span className="text-sm text-gray-600">Sync Direction</span>
                          <select
                            value={adapter.syncDirection}
                            onChange={(e) => updateAdapterDraft(provider, 'syncDirection', e.target.value)}
                            className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                          >
                            <option value="PULL">PULL</option>
                            <option value="PUSH">PUSH</option>
                            <option value="BIDIRECTIONAL">BIDIRECTIONAL</option>
                          </select>
                        </label>
                        <div>
                          <span className="text-sm text-gray-600">Health</span>
                          <p className="mt-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg">
                            {adapter.lastHealthStatus}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Shield className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">سیاست گردش‌کار انتشار</h3>
                <p className="text-sm text-gray-500">تعیین اینکه تصمیم نهایی VersionHistory در هر سامانه با چه نقشی باشد</p>
              </div>
            </div>

            {workflowLoading ? (
              <p className="text-sm text-gray-500">در حال بارگذاری...</p>
            ) : (
              <div className="space-y-3">
                {applications.map(app => {
                  const selectedPolicy = workflowPolicies.find(policy => policy.id === app.workflowPolicyId) || workflowPolicies[0];
                  return (
                    <div key={app.id} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-900">{app.name}</p>
                          <p className="text-xs text-gray-500">{app.code}</p>
                        </div>
                        <select
                          value={app.workflowPolicyId || workflowPolicies[0]?.id || ''}
                          onChange={(e) => handleWorkflowPolicyChange(app.id, e.target.value)}
                          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                        >
                          {workflowPolicies.map(policy => (
                            <option key={policy.id} value={policy.id}>{policy.name}</option>
                          ))}
                        </select>
                      </div>
                      {selectedPolicy && (
                        <p className="text-xs text-gray-500 mt-2">
                          اعلام نظر کیفیت: {selectedPolicy.versionHistory.qaReviewOwnerLabel} | تصمیم نهایی: {selectedPolicy.versionHistory.decisionOwnerLabel}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* System Info */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Database className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">اطلاعات سیستم</h3>
                <p className="text-sm text-gray-500">مشخصات فنی سیستم</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-gray-500">نسخه Workspace</p>
                <p className="font-mono font-medium">utms 0.0.0</p>
              </div>
              <div>
                <p className="text-gray-500">محیط</p>
                <p className="font-mono font-medium">Local development</p>
              </div>
              <div>
                <p className="text-gray-500">Frontend</p>
                <p className="font-mono font-medium">React 19.2.6 + Vite 7.3.6</p>
              </div>
              <div>
                <p className="text-gray-500">Backend</p>
                <p className="font-mono font-medium">Domain RPC + API Console server</p>
              </div>
              <div>
                <p className="text-gray-500">TypeScript</p>
                <p className="font-mono font-medium">5.9.3</p>
              </div>
              <div>
                <p className="text-gray-500">Playwright</p>
                <p className="font-mono font-medium">1.55.0</p>
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button onClick={saveSystemSettings} loading={settingsSaving}>
              ذخیره تنظیمات اجرا و اتصال‌ها
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};
