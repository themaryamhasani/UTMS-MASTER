import { useState, useEffect, useRef } from 'react';
import { Play, Eye, Terminal, CheckCircle, XCircle, Loader2, StopCircle, FolderOpen, Download } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { Table, Pagination } from '../components/ui/Table';
import { CartableSearchInput } from '../components/ui/CartableToolbar';
import { StatusBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Select } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { useAuthStore, canPerformAction, canUseAutomatedTests } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import { useApplicationLookup } from '../utils/useApplicationLookup';
import { playwrightApi, systemSettingsApi } from '../services/api';
import type {
  PlaywrightRun,
  CartableFilterParams,
  PaginatedResponse,
  PlaywrightRunnerConfig,
  PlaywrightProject,
  PlaywrightWorkers,
  PlaywrightMaxFailures,
  PlaywrightTraceMode,
  PlaywrightReporter,
} from '../types';
import {
  PLAYWRIGHT_RUN_STATUS_LABELS,
  PLAYWRIGHT_PROJECT_LABELS,
  PLAYWRIGHT_WORKERS_LABELS,
  PLAYWRIGHT_MAX_FAILURES_LABELS,
  PLAYWRIGHT_TRACE_LABELS,
  PLAYWRIGHT_REPORTER_LABELS,
} from '../types';

const PLAYWRIGHT_PROJECT_OPTIONS: PlaywrightProject[] = ['chromium', 'firefox', 'webkit'];

const createDefaultPlaywrightForm = (timeoutSeconds = 120) => ({
  testFilePath: '',
  environment: 'staging',
  timeoutSeconds,
  manualPath: false,
  projects: ['chromium'] as PlaywrightProject[],
  headed: false,
  workers: 'auto' as PlaywrightWorkers,
  retries: 0,
  maxFailures: 'unlimited' as PlaywrightMaxFailures,
  trace: 'retain-on-failure' as PlaywrightTraceMode,
  reporter: 'html' as PlaywrightReporter,
});

type PlaywrightRunForm = ReturnType<typeof createDefaultPlaywrightForm>;

export const PlaywrightPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { appId, defaultApplicationId } = useDataScope();
  const { shouldShowSystemColumn, getApplicationName } = useApplicationLookup();
  const [data, setData] = useState<PaginatedResponse<PlaywrightRun> | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CartableFilterParams>({
    page: 1,
    limit: 10,
    search: '',
    status: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // Modals
  const [showStartModal, setShowStartModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PlaywrightRun | null>(null);
  const [discoveredFiles, setDiscoveredFiles] = useState<string[]>([]);
  const [runnerConfig, setRunnerConfig] = useState<PlaywrightRunnerConfig | null>(null);

  // Form state
  const [formData, setFormData] = useState<PlaywrightRunForm>(createDefaultPlaywrightForm());
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (activeContext) {
      loadData();
    }
  }, [activeContext, filters]);

  useEffect(() => {
    if (activeContext) {
      loadRunnerConfig();
    }
  }, [activeContext]);

  useEffect(() => {
    if (showStartModal && activeContext) {
      discoverFiles();
    }
  }, [showStartModal, activeContext]);

  useEffect(() => {
    if (!selectedRun || !data?.data.length) return;
    const freshRun = data.data.find(run => run.id === selectedRun.id);
    if (freshRun && freshRun.updatedAt !== selectedRun.updatedAt) {
      setSelectedRun(freshRun);
    }
  }, [data, selectedRun]);

  // Auto-refresh ONLY when there are RUNNING tests — fixed to prevent infinite loop
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    // Check whether tests are running.
    const hasRunning = data?.data?.some(r => ['PENDING', 'RUNNING'].includes(r.status)) ?? false;
    
    if (hasRunning && !intervalRef.current) {
      // Start polling only when running tests exist and no interval is active
      intervalRef.current = setInterval(() => {
        if (activeContext) {
          playwrightApi.getAll(appId, filters).then(setData).catch(() => {});
        }
      }, 5000);
    } else if (!hasRunning && intervalRef.current) {
      // Stop polling when no running tests
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [data?.data?.map(d => d.status).join(',')]); // Only re-run when status string changes

  const loadData = async () => {
    if (!activeContext) return;
    setLoading(true);
    try {
      const response = await playwrightApi.getAll(appId, filters);
      setData(response);
    } catch {
      setData(null);
      toast.error('خطا در بارگذاری اجراهای Playwright.');
    } finally {
      setLoading(false);
    }
  };

  const loadRunnerConfig = async () => {
    try {
      const settings = await systemSettingsApi.getIntegrationSettings();
      setRunnerConfig(settings.playwright);
      setFormData(prev => ({
        ...prev,
        timeoutSeconds: settings.playwright.defaultTimeoutSeconds,
      }));
    } catch {
      setRunnerConfig(null);
      toast.error('خطا در بارگذاری تنظیمات Runner.');
    }
  };

  const discoverFiles = async () => {
    if (!activeContext) return;
    if (runnerConfig && !runnerConfig.enabled) {
      setDiscoveredFiles([]);
      return;
    }
    try {
      const files = await playwrightApi.discoverFiles(appId);
      setDiscoveredFiles(files);
    } catch {
      setDiscoveredFiles([]);
      toast.error('خطا در کشف فایل‌های تست.');
    }
  };

  const toggleProject = (project: PlaywrightProject) => {
    setFormData(prev => {
      const projects = prev.projects.includes(project)
        ? prev.projects.filter(item => item !== project)
        : [...prev.projects, project];
      return { ...prev, projects };
    });
  };

  const handleStart = async () => {
    if (!activeContext || !formData.testFilePath || formData.projects.length === 0) return;
    setActionLoading(true);
    try {
      await playwrightApi.start(
        {
          testFilePath: formData.testFilePath,
          environment: formData.environment,
          projects: formData.projects,
          headed: formData.headed,
          workers: formData.workers,
          retries: formData.retries,
          maxFailures: formData.maxFailures,
          trace: formData.trace,
          reporter: formData.reporter,
          timeoutSeconds: formData.timeoutSeconds,
          manualPath: formData.manualPath,
          workingDirectory: runnerConfig?.defaultWorkingDirectory,
        },
        activeContext.userId,
        defaultApplicationId
      );
      setShowStartModal(false);
      setFormData(createDefaultPlaywrightForm(runnerConfig?.defaultTimeoutSeconds || 120));
      loadData();
    } catch {
      toast.error('خطا در شروع اجرای Playwright.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (run: PlaywrightRun) => {
    if (!activeContext) return;
    setActionLoading(true);
    try {
      await playwrightApi.cancel(run.id, activeContext.userId);
      loadData();
    } catch {
      toast.error('خطا در لغو اجرای Playwright.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!activeContext) return null;

  const role = activeContext.role;
  const canRun = canPerformAction(role, 'playwright:run') && canUseAutomatedTests(activeContext) && (runnerConfig?.enabled ?? true);

  const formatProjects = (run: PlaywrightRun) =>
    (run.projects?.length ? run.projects : (['chromium'] as PlaywrightProject[]))
      .map(project => PLAYWRIGHT_PROJECT_LABELS[project])
      .join('، ');

  const formatMaxFailures = (run: PlaywrightRun) => {
    const value = run.maxFailures || 'unlimited';
    return PLAYWRIGHT_MAX_FAILURES_LABELS[value];
  };

  const downloadPlaywrightReport = (run: PlaywrightRun) => {
    if (!run.report) return;
    const blob = new Blob([run.report.content], { type: `${run.report.mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = run.report.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASSED': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'FAILED': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'PENDING':
      case 'RUNNING': return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'ERROR': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'CANCELLED': return <StopCircle className="w-5 h-5 text-gray-500" />;
      default: return <Terminal className="w-5 h-5 text-gray-400" />;
    }
  };

  // Calculate stats
  const stats = {
    total: data?.total || 0,
    passed: data?.data.filter(r => r.status === 'PASSED').length || 0,
    failed: data?.data.filter(r => r.status === 'FAILED').length || 0,
    running: data?.data.filter(r => ['PENDING', 'RUNNING'].includes(r.status)).length || 0,
  };

  const columns = [
    {
      key: 'testFilePath',
      title: 'فایل تست',
      render: (item: PlaywrightRun) => (
        <div className="flex items-center gap-2">
          {getStatusIcon(item.status)}
          <div>
            <p className="font-medium text-gray-900 font-mono text-sm">
              {item.testFilePath.split('/').pop()}
            </p>
            <p className="text-xs text-gray-500">{item.testFilePath}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      title: 'وضعیت',
      render: (item: PlaywrightRun) => (
        <StatusBadge status={item.status} labels={PLAYWRIGHT_RUN_STATUS_LABELS} />
      ),
    },
    ...(shouldShowSystemColumn ? [{
      key: 'applicationId',
      title: 'سامانه',
      render: (item: PlaywrightRun) => <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{getApplicationName(item.applicationId)}</span>,
    }] : []),
    {
      key: 'results',
      title: 'نتایج',
      render: (item: PlaywrightRun) => {
        if (item.totalTests === undefined) return '-';
        return (
          <div className="flex items-center gap-2">
            <span className="text-green-600 font-medium">{item.passedTests || 0}</span>
            <span className="text-gray-400">/</span>
            <span className="text-red-600 font-medium">{item.failedTests || 0}</span>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600">{item.totalTests}</span>
          </div>
        );
      },
    },
    {
      key: 'duration',
      title: 'مدت',
      render: (item: PlaywrightRun) => {
        if (!item.duration) return '-';
        const minutes = Math.floor(item.duration / 60);
        const seconds = item.duration % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      },
    },
    {
      key: 'environment',
      title: 'محیط',
      render: (item: PlaywrightRun) => (
        <span className="px-2 py-0.5 text-xs bg-gray-100 rounded">{item.environment}</span>
      ),
    },
    {
      key: 'triggeredBy',
      title: 'اجراکننده',
      render: (item: PlaywrightRun) => item.triggeredBy?.fullName || '-',
    },
    {
      key: 'startedAt',
      title: 'زمان',
      render: (item: PlaywrightRun) => item.startedAt
        ? new Date(item.startedAt).toLocaleString('fa-IR')
        : '-',
    },
    {
      key: 'actions',
      title: 'عملیات',
      render: (item: PlaywrightRun) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<Eye className="w-4 h-4" />}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedRun(item);
              setShowDetailModal(true);
            }}
          >
            مشاهده
          </Button>
          {['PENDING', 'RUNNING'].includes(item.status) && canRun && (
            <Button
              size="sm"
              variant="danger"
              icon={<StopCircle className="w-4 h-4" />}
              onClick={(e) => {
                e.stopPropagation();
                handleCancel(item);
              }}
            >
              توقف
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Playwright - تست خودکار"
        subtitle={`${data?.total || 0} اجرا`}
        onRefresh={loadData}
        refreshing={loading}
        actions={
          canRun && (
            <Button
              icon={<Play className="w-4 h-4" />}
              onClick={() => setShowStartModal(true)}
            >
              اجرای جدید
            </Button>
          )
        }
      />

      <main className="p-4 sm:p-6">
        {runnerConfig && !runnerConfig.enabled && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            Runner Playwright در تنظیمات سیستم غیرفعال است. برای اجرای تست، System Admin باید Feature Flag مربوطه را فعال کند.
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="کل اجراها"
            value={stats.total}
            icon={<Terminal className="w-6 h-6" />}
          />
          <StatCard
            title="موفق"
            value={stats.passed}
            icon={<CheckCircle className="w-6 h-6" />}
            variant="success"
          />
          <StatCard
            title="ناموفق"
            value={stats.failed}
            icon={<XCircle className="w-6 h-6" />}
            variant="danger"
          />
          <StatCard
            title="در حال اجرا"
            value={stats.running}
            icon={<Loader2 className="w-6 h-6" />}
            variant="primary"
          />
        </div>

        {/* Filters */}
        <Card className="mb-6" padding="sm">
          <div className="flex flex-wrap gap-4 items-center">
            <CartableSearchInput
              value={filters.search || ''}
              onChange={(search) => setFilters({ ...filters, search, page: 1 })}
            />
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">همه وضعیت‌ها</option>
              {Object.entries(PLAYWRIGHT_RUN_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </Card>

        {/* Table */}
        <Table
          columns={columns}
          data={data?.data || []}
          loading={loading}
          emptyMessage="اجرایی یافت نشد"
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
            setSelectedRun(item);
            setShowDetailModal(true);
          }}
          rowClassName={(item) =>
            item.status === 'PASSED' ? 'bg-green-50' :
            item.status === 'FAILED' ? 'bg-red-50' :
            item.status === 'RUNNING' ? 'bg-blue-50' : ''
          }
          enableClientFilter={false}
          enableExport={false}
          enableColumnChooser={false}
        />

        {data && data.total > 0 && (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            limit={data.limit}
            onPageChange={(page) => setFilters({ ...filters, page })}
            onLimitChange={(limit) => setFilters({ ...filters, limit, page: 1 })}
          />
        )}
      </main>

      {/* Start Modal */}
      <Modal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        title="اجرای تست Playwright"
        size="wide"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FolderOpen className="w-4 h-4 inline ml-1" />
              فایل تست
            </label>
            {discoveredFiles.length > 0 ? (
              <div className="space-y-2 min-w-0">
                <p className="text-xs text-gray-500">
                  {discoveredFiles.length} فایل تست از ریشه‌های CDE و فایل‌های ساخته‌شده در UTMS قابل انتخاب است.
                </p>
                <Select
                  value={formData.manualPath ? '' : formData.testFilePath}
                  onChange={(e) => setFormData({ ...formData, testFilePath: e.target.value, manualPath: false })}
                  options={discoveredFiles.map(f => ({ value: f, label: f }))}
                  placeholder="انتخاب فایل تست"
                />
                {formData.testFilePath && !formData.manualPath && (
                  <p className="break-all rounded-lg bg-gray-50 p-2 text-left font-mono text-xs text-gray-500" dir="ltr">
                    {formData.testFilePath}
                  </p>
                )}
                <Input
                  value={formData.manualPath ? formData.testFilePath : ''}
                  onChange={(e) => setFormData({ ...formData, testFilePath: e.target.value, manualPath: true })}
                  placeholder="یا مسیر دستی فایل تست"
                />
              </div>
            ) : (
              <Input
                value={formData.testFilePath}
                onChange={(e) => setFormData({ ...formData, testFilePath: e.target.value, manualPath: true })}
                placeholder="مسیر فایل تست (مثال: tests/auth/login.spec.ts)"
              />
            )}
          </div>
          <Select
            label="محیط"
            value={formData.environment}
            onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
            options={[
              { value: 'development', label: 'توسعه' },
              { value: 'staging', label: 'آزمایشی' },
              { value: 'production', label: 'تولید' },
            ]}
          />
          <Input
            label="Timeout Runner (ثانیه)"
            type="number"
            min={30}
            max={900}
            value={formData.timeoutSeconds}
            onChange={(e) => setFormData({ ...formData, timeoutSeconds: Number(e.target.value) || 120 })}
          />
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">تنظیمات اجرای Playwright</h3>
                <p className="mt-1 text-xs text-gray-500">
                  این گزینه‌ها به command runner تبدیل می‌شوند و اجرای تست را کنترل می‌کنند.
                </p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                Command options
              </span>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">مرورگر / Project</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {PLAYWRIGHT_PROJECT_OPTIONS.map(project => {
                  const selected = formData.projects.includes(project);
                  return (
                    <button
                      key={project}
                      type="button"
                      onClick={() => toggleProject(project)}
                      className={`rounded-lg border p-3 text-right transition ${
                        selected
                          ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                      }`}
                    >
                      <span className="block text-sm font-semibold">{PLAYWRIGHT_PROJECT_LABELS[project]}</span>
                      <span className="mt-1 block font-mono text-xs text-gray-500">--project={project}</span>
                    </button>
                  );
                })}
              </div>
              {formData.projects.length === 0 && (
                <p className="mt-2 text-xs text-red-600">حداقل یک مرورگر باید انتخاب شود.</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <button
                type="button"
                role="switch"
                aria-checked={formData.headed}
                onClick={() => setFormData({ ...formData, headed: !formData.headed })}
                className="flex h-full items-center justify-between rounded-lg border border-gray-200 bg-white p-3 text-right"
              >
                <span>
                  <span className="block text-sm font-medium text-gray-700">حالت نمایش مرورگر</span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {formData.headed ? 'نمایشی (--headed)' : 'مخفی'}
                  </span>
                </span>
                <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  formData.headed ? 'bg-blue-600' : 'bg-gray-300'
                }`}>
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                    formData.headed ? '-translate-x-5' : '-translate-x-1'
                  }`} />
                </span>
              </button>

              <Select
                label="تعداد اجرای هم‌زمان"
                value={formData.workers}
                onChange={(e) => setFormData({ ...formData, workers: e.target.value as PlaywrightWorkers })}
                options={Object.entries(PLAYWRIGHT_WORKERS_LABELS).map(([value, label]) => ({ value, label }))}
              />

              <Input
                label="تلاش مجدد"
                type="number"
                min={0}
                max={3}
                step={1}
                value={formData.retries}
                onChange={(e) => setFormData({
                  ...formData,
                  retries: Math.min(3, Math.max(0, Number(e.target.value) || 0)),
                })}
                hint="مجاز: 0 تا 3"
              />

              <Select
                label="توقف پس از شکست"
                value={formData.maxFailures}
                onChange={(e) => setFormData({ ...formData, maxFailures: e.target.value as PlaywrightMaxFailures })}
                options={Object.entries(PLAYWRIGHT_MAX_FAILURES_LABELS).map(([value, label]) => ({ value, label }))}
              />

              <Select
                label="Trace"
                value={formData.trace}
                onChange={(e) => setFormData({ ...formData, trace: e.target.value as PlaywrightTraceMode })}
                options={Object.entries(PLAYWRIGHT_TRACE_LABELS).map(([value, label]) => ({ value, label }))}
              />

              <Select
                label="گزارش خروجی"
                value={formData.reporter}
                onChange={(e) => setFormData({ ...formData, reporter: e.target.value as PlaywrightReporter })}
                options={Object.entries(PLAYWRIGHT_REPORTER_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </div>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-700">
            تست‌ها روی سرور مشخص اجرا می‌شوند. نتایج پس از اتمام نمایش داده خواهند شد.
          </div>
          {runnerConfig && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700">
              <p>Runner: <span className="font-mono">{runnerConfig.runnerId}</span></p>
              <p>Working Directory: <span className="font-mono">{runnerConfig.defaultWorkingDirectory}</span></p>
              <p>Artifact Root: <span className="font-mono">{runnerConfig.artifactRoot}</span></p>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowStartModal(false)}>
              انصراف
            </Button>
            <Button
              icon={<Play className="w-4 h-4" />}
              onClick={handleStart}
              loading={actionLoading}
              disabled={!formData.testFilePath || formData.projects.length === 0}
            >
              اجرا
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="جزئیات اجرای Playwright"
        size="xl"
      >
        {selectedRun && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(selectedRun.status)}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 font-mono">
                    {selectedRun.testFilePath.split('/').pop()}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedRun.testFilePath}</p>
                </div>
              </div>
              <StatusBadge
                status={selectedRun.status}
                labels={PLAYWRIGHT_RUN_STATUS_LABELS}
              />
            </div>

            {/* Results */}
            {selectedRun.totalTests !== undefined && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{selectedRun.totalTests}</p>
                  <p className="text-sm text-gray-500">کل تست‌ها</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-2xl font-bold text-green-600">{selectedRun.passedTests || 0}</p>
                  <p className="text-sm text-gray-500">موفق</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-2xl font-bold text-red-600">{selectedRun.failedTests || 0}</p>
                  <p className="text-sm text-gray-500">ناموفق</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-600">{selectedRun.skippedTests || 0}</p>
                  <p className="text-sm text-gray-500">نادیده</p>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-2xl font-bold text-amber-600">{selectedRun.cancelledTests || 0}</p>
                  <p className="text-sm text-gray-500">لغوشده</p>
                </div>
              </div>
            )}

            {/* Info */}
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 md:grid-cols-4">
              <div>
                <p className="text-gray-500">محیط</p>
                <p className="font-medium">{selectedRun.environment}</p>
              </div>
              <div>
                <p className="text-gray-500">مدت زمان</p>
                <p className="font-medium">
                  {selectedRun.duration ? `${Math.floor(selectedRun.duration / 60)}:${(selectedRun.duration % 60).toString().padStart(2, '0')}` : '-'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">اجراکننده</p>
                <p className="font-medium">{selectedRun.triggeredBy?.fullName || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">زمان شروع</p>
                <p className="font-medium">
                  {selectedRun.startedAt 
                    ? new Date(selectedRun.startedAt).toLocaleString('fa-IR')
                    : '-'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-3">Queue / Runner</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">وضعیت صف</p>
                  <p className="font-medium">{selectedRun.queueStatus || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Runner</p>
                  <p className="font-medium">{selectedRun.runnerId || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Timeout</p>
                  <p className="font-medium">{selectedRun.timeoutSeconds || '-'} ثانیه</p>
                </div>
                <div>
                  <p className="text-gray-500">Browser / Project</p>
                  <p className="font-medium">{formatProjects(selectedRun)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Headed</p>
                  <p className="font-medium">{selectedRun.headed ? 'نمایشی' : 'مخفی'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Workers</p>
                  <p className="font-medium">{PLAYWRIGHT_WORKERS_LABELS[selectedRun.workers || 'auto']}</p>
                </div>
                <div>
                  <p className="text-gray-500">Retries</p>
                  <p className="font-medium">{selectedRun.retries ?? 0}</p>
                </div>
                <div>
                  <p className="text-gray-500">Max Failures</p>
                  <p className="font-medium">{formatMaxFailures(selectedRun)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Trace</p>
                  <p className="font-medium">{PLAYWRIGHT_TRACE_LABELS[selectedRun.trace || 'off']}</p>
                </div>
                <div>
                  <p className="text-gray-500">Reporter</p>
                  <p className="font-medium">{PLAYWRIGHT_REPORTER_LABELS[selectedRun.reporter || 'html']}</p>
                </div>
                <div className="md:col-span-3">
                  <p className="text-gray-500">Command</p>
                  <p className="font-mono text-xs bg-white p-2 rounded border overflow-x-auto">{selectedRun.command || '-'}</p>
                </div>
                <div className="md:col-span-3">
                  <p className="text-gray-500">Working Directory</p>
                  <p className="font-mono text-xs">{selectedRun.workingDirectory || '-'}</p>
                </div>
              </div>
            </div>

            {/* Logs */}
            {selectedRun.logs && (
              <div className="p-4 bg-gray-900 rounded-lg">
                <p className="text-xs text-gray-400 mb-2">خروجی کنسول:</p>
                <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap overflow-x-auto">
                  {selectedRun.logs}
                </pre>
              </div>
            )}

            {selectedRun.report && (
              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">گزارش خروجی Playwright</h4>
                    <p className="mt-1 text-sm text-gray-500">
                      فرمت انتخاب‌شده: {PLAYWRIGHT_REPORTER_LABELS[selectedRun.report.reporter]} · فایل: {selectedRun.report.fileName}
                    </p>
                    <p className="mt-1 break-all text-left font-mono text-xs text-gray-500" dir="ltr">
                      {selectedRun.report.storagePath}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Download className="w-4 h-4" />}
                    onClick={() => downloadPlaywrightReport(selectedRun)}
                  >
                    دانلود گزارش
                  </Button>
                </div>

                {selectedRun.report.failures.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-medium text-red-700">تست‌های Fail شده</p>
                    {selectedRun.report.failures.map((failure, index) => (
                      <div key={`${failure.title}-${index}`} className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="font-medium text-red-900">{failure.title}</p>
                          <p className="font-mono text-xs text-red-700" dir="ltr">
                            {failure.filePath}:{failure.line}:{failure.column}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-red-700">Project: {PLAYWRIGHT_PROJECT_LABELS[failure.project]}</p>
                        <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-950 p-3 text-xs text-red-100 overflow-x-auto">
                          {failure.message}
                        </pre>
                        <pre className="mt-2 rounded-lg bg-gray-900 p-3 text-xs text-gray-100 overflow-x-auto" dir="ltr">
                          {failure.snippet.map(line => (
                            <div
                              key={line.lineNumber}
                              className={line.highlighted ? 'bg-red-900/60 text-white' : ''}
                            >
                              {String(line.lineNumber).padStart(4, ' ')} | {line.text || ' '}
                            </div>
                          ))}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                  {[
                    { title: 'تست‌های پاس‌شده', items: selectedRun.report.passed, color: 'green' },
                    { title: 'تست‌های نادیده‌شده', items: selectedRun.report.skipped, color: 'gray' },
                    { title: 'تست‌های لغوشده', items: selectedRun.report.cancelled, color: 'amber' },
                  ].map(section => (
                    <div key={section.title} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">{section.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          section.color === 'green'
                            ? 'bg-green-100 text-green-700'
                            : section.color === 'amber'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-200 text-gray-700'
                        }`}>
                          {section.items.length}
                        </span>
                      </div>
                      {section.items.length > 0 ? (
                        <div className="max-h-48 space-y-2 overflow-y-auto">
                          {section.items.map((item, index) => (
                            <div key={`${item.status}-${item.title}-${index}`} className="rounded-md bg-white p-2 text-xs">
                              <p className="truncate font-medium text-gray-900" title={item.title}>{item.title}</p>
                              <p className="mt-1 font-mono text-gray-500" dir="ltr">
                                {PLAYWRIGHT_PROJECT_LABELS[item.project]} · {item.durationMs}ms
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-md bg-white p-2 text-xs text-gray-500">موردی وجود ندارد.</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium text-gray-700">پیش‌نمایش فایل گزارش</p>
                  {selectedRun.report.reporter === 'html' ? (
                    <iframe
                      title="Playwright HTML report"
                      srcDoc={selectedRun.report.content}
                      className="h-80 w-full rounded-lg border bg-white"
                      sandbox=""
                    />
                  ) : (
                    <pre className="max-h-80 overflow-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-100" dir="ltr">
                      {selectedRun.report.content}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {!!selectedRun.artifactPaths?.filter(path => path !== selectedRun.report?.storagePath).length && (
              <div className="p-4 bg-gray-50 rounded-lg border">
                <p className="text-sm font-medium text-gray-900 mb-2">سایر Artifactها</p>
                <div className="space-y-2">
                  {selectedRun.artifactPaths.filter(path => path !== selectedRun.report?.storagePath).map(path => (
                    <div key={path} className="p-2 bg-white border rounded font-mono text-xs text-gray-700">
                      {path}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Running indicator */}
            {['PENDING', 'RUNNING'].includes(selectedRun.status) && (
              <div className="flex items-center justify-center gap-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <span className="text-blue-700">در حال اجرا...</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              {['PENDING', 'RUNNING'].includes(selectedRun.status) && canRun && (
                <Button
                  variant="danger"
                  icon={<StopCircle className="w-4 h-4" />}
                  onClick={() => handleCancel(selectedRun)}
                  loading={actionLoading}
                >
                  توقف
                </Button>
              )}
              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                بستن
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
