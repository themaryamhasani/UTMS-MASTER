import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Edit, Eye, FileText, FolderOpen, Plus, Save, Search, Terminal } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { Table, Pagination } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Select } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { useAuthStore, canPerformAction, canUseAutomatedTests } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import { applicationApi, playwrightApi } from '../services/api';
import type {
  Application,
  CartableFilterParams,
  PaginatedResponse,
  PlaywrightTestFile,
  PlaywrightTestFolder,
} from '../types';
import { PLAYWRIGHT_CDE_ROOT_LABELS } from '../types';

const DESCRIPTION_MAX_LENGTH = 700;
const PLAYWRIGHT_FILE_NAME_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*\.spec\.ts$/;

const DEFAULT_SCRIPT = `import { test, expect } from '@playwright/test';

test('new scenario', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/./);
});
`;

type FormMode = 'create' | 'edit';

interface FormState {
  applicationId: string;
  folderPath: string;
  fileName: string;
  description: string;
  script: string;
}

export const PlaywrightFilesPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { appId, defaultApplicationId, scopeApplicationIds, isAppLevel } = useDataScope();
  const [applications, setApplications] = useState<Application[]>([]);
  const [folders, setFolders] = useState<PlaywrightTestFolder[]>([]);
  const [data, setData] = useState<PaginatedResponse<PlaywrightTestFile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<PlaywrightTestFile | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<CartableFilterParams>({
    page: 1,
    limit: 10,
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [formData, setFormData] = useState<FormState>({
    applicationId: defaultApplicationId,
    folderPath: '',
    fileName: '',
    description: '',
    script: DEFAULT_SCRIPT,
  });

  useEffect(() => {
    if (activeContext) {
      loadApplications();
      loadFiles();
    }
  }, [activeContext]);

  useEffect(() => {
    if (activeContext) {
      loadFiles();
    }
  }, [filters]);

  useEffect(() => {
    if (formData.applicationId) {
      loadFolders(formData.applicationId);
    } else {
      setFolders([]);
    }
  }, [formData.applicationId]);

  const loadApplications = async () => {
    if (!activeContext) return;
    try {
      const all = await applicationApi.getAll();
      const allowed = isAppLevel
        ? all.filter(app => app.isActive)
        : all.filter(app => app.isActive && scopeApplicationIds.includes(app.id));
      setApplications(allowed);
      setFormData(prev => ({
        ...prev,
        applicationId: prev.applicationId || defaultApplicationId || allowed[0]?.id || '',
      }));
    } catch {
      toast.error('خطا در بارگذاری سامانه‌ها.');
    }
  };

  const loadFolders = async (applicationId: string) => {
    try {
      const response = await playwrightApi.discoverFolders(applicationId);
      setFolders(response);
      setFormData(prev => ({
        ...prev,
        folderPath: response.some(folder => folder.fullPath === prev.folderPath) ? prev.folderPath : '',
      }));
    } catch {
      toast.error('خطا در خواندن پوشه‌های CDE.');
    }
  };

  const loadFiles = async () => {
    if (!activeContext) return;
    setLoading(true);
    try {
      const response = await playwrightApi.getTestFiles(appId, filters);
      setData(response);
    } catch {
      setData(null);
      toast.error('خطا در بارگذاری فایل‌های تست.');
    } finally {
      setLoading(false);
    }
  };

  const selectedApplication = applications.find(app => app.id === formData.applicationId);
  const selectedFolder = folders.find(folder => folder.fullPath === formData.folderPath);
  const finalPath = selectedFolder && formData.fileName
    ? `${selectedFolder.fullPath}/${formData.fileName}`
    : '';

  const foldersByRoot = useMemo(() => {
    return folders.reduce<Record<string, number>>((acc, folder) => {
      acc[folder.rootKind] = (acc[folder.rootKind] || 0) + 1;
      return acc;
    }, {});
  }, [folders]);

  const resetForm = (applicationId = formData.applicationId || defaultApplicationId || applications[0]?.id || '') => {
    setFormData({
      applicationId,
      folderPath: '',
      fileName: '',
      description: '',
      script: DEFAULT_SCRIPT,
    });
    setEditingFileId(null);
    setFormErrors({});
  };

  const openCreateForm = () => {
    setFormMode('create');
    resetForm(formData.applicationId || defaultApplicationId || applications[0]?.id || '');
    setShowFormModal(true);
  };

  const openEditForm = (file: PlaywrightTestFile) => {
    setFormMode('edit');
    setEditingFileId(file.id);
    setFormData({
      applicationId: file.applicationId,
      folderPath: file.folderPath,
      fileName: file.fileName,
      description: file.description || '',
      script: file.script,
    });
    setFormErrors({});
    setShowDetailModal(false);
    setShowFormModal(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.applicationId) errors.applicationId = 'انتخاب سامانه الزامی است.';
    if (!formData.folderPath) errors.folderPath = 'انتخاب پوشه الزامی است.';
    if (!formData.fileName.trim()) {
      errors.fileName = 'نام فایل تست الزامی است.';
    } else if (!PLAYWRIGHT_FILE_NAME_REGEX.test(formData.fileName.trim())) {
      errors.fileName = 'فرمت نام فایل باید مثل login-flow.spec.ts باشد؛ فقط حروف کوچک انگلیسی، عدد و خط تیره مجاز است.';
    }
    if (!formData.script.trim()) errors.script = 'اسکریپت تست الزامی است.';
    if (formData.description.length > DESCRIPTION_MAX_LENGTH) {
      errors.description = `توضیحات حداکثر ${DESCRIPTION_MAX_LENGTH} کاراکتر است.`;
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFileNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      fileName: value.replace(/[^a-zA-Z0-9.-]/g, '').toLowerCase(),
    }));
  };

  const handleSubmit = async () => {
    if (!activeContext || !validateForm()) return;
    setActionLoading(true);
    try {
      const payload = {
        applicationId: formData.applicationId,
        folderPath: formData.folderPath,
        fileName: formData.fileName.trim(),
        script: formData.script,
        description: formData.description.trim(),
      };
      if (formMode === 'edit' && editingFileId) {
        await playwrightApi.updateTestFile(editingFileId, payload, activeContext.userId);
        toast.success('فایل تست Playwright بروزرسانی شد.');
      } else {
        await playwrightApi.createTestFile(payload, activeContext.userId);
        toast.success('فایل تست Playwright ایجاد شد.');
      }
      setShowFormModal(false);
      resetForm();
      loadFiles();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'INVALID_PLAYWRIGHT_TEST_FILE_NAME') {
        setFormErrors({ fileName: 'فرمت نام فایل معتبر نیست. نمونه درست: login-flow.spec.ts' });
      } else if (message === 'PLAYWRIGHT_TEST_FILE_ALREADY_EXISTS') {
        setFormErrors({ fileName: 'در این مسیر فایلی با همین نام وجود دارد.' });
      } else if (message === 'PLAYWRIGHT_SCRIPT_REQUIRED') {
        setFormErrors({ script: 'اسکریپت تست الزامی است.' });
      } else {
        toast.error('خطا در ذخیره فایل تست Playwright.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (!activeContext) return null;

  const canManageFile = canPerformAction(activeContext.role, 'playwright:run') && canUseAutomatedTests(activeContext);
  const stats = {
    total: data?.total || 0,
    folders: folders.length,
    roots: Object.keys(foldersByRoot).length,
    applications: applications.length,
  };

  const columns = [
    {
      key: 'fileName',
      title: 'فایل تست',
      render: (item: PlaywrightTestFile) => (
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          <div>
            <p className="font-mono text-sm font-medium text-gray-900" dir="ltr">{item.fileName}</p>
            <p className="text-xs text-gray-500 font-mono" dir="ltr">{item.fullPath}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'applicationId',
      title: 'سامانه',
      render: (item: PlaywrightTestFile) => applications.find(app => app.id === item.applicationId)?.name || item.applicationId,
    },
    {
      key: 'source',
      title: 'منبع',
      render: (item: PlaywrightTestFile) => (
        <Badge variant={item.source === 'DISCOVERED' ? 'secondary' : 'success'}>
          {item.source === 'DISCOVERED' ? 'کشف‌شده از CDE' : 'مدیریت‌شده'}
        </Badge>
      ),
    },
    {
      key: 'rootKind',
      title: 'ریشه CDE',
      render: (item: PlaywrightTestFile) => (
        <Badge variant="info">{PLAYWRIGHT_CDE_ROOT_LABELS[item.rootKind]}</Badge>
      ),
    },
    {
      key: 'folderPath',
      title: 'پوشه',
      render: (item: PlaywrightTestFile) => (
        <span className="font-mono text-xs text-gray-600" dir="ltr">{item.relativeFolderPath}</span>
      ),
    },
    {
      key: 'updatedAt',
      title: 'آخرین تغییر',
      render: (item: PlaywrightTestFile) => new Date(item.updatedAt).toLocaleString('fa-IR'),
    },
    {
      key: 'actions',
      title: 'عملیات',
      render: (item: PlaywrightTestFile) => (
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="ghost"
            icon={<Eye className="w-4 h-4" />}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFile(item);
              setShowDetailModal(true);
            }}
          >
            مشاهده
          </Button>
          {canManageFile && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Edit className="w-4 h-4" />}
              onClick={(e) => {
                e.stopPropagation();
                openEditForm(item);
              }}
            >
              ویرایش
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="فایل‌های تست Playwright"
        subtitle="مشاهده، ایجاد و ویرایش فایل‌های تست خوانده‌شده از CDE"
        onRefresh={() => {
          loadFiles();
          if (formData.applicationId) loadFolders(formData.applicationId);
        }}
        refreshing={loading}
        actions={canManageFile && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateForm}>
            ایجاد فایل
          </Button>
        )}
      />

      <main className="p-4 sm:p-6 space-y-6">
        {!canManageFile && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>برای ایجاد یا ویرایش فایل تست باید دسترسی اجرای Playwright در Context فعال داشته باشید.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="کل فایل‌های تست" value={stats.total} icon={<FileText className="w-6 h-6" />} />
          <StatCard title="پوشه‌های CDE" value={stats.folders} icon={<FolderOpen className="w-6 h-6" />} variant="primary" />
          <StatCard title="ریشه‌های فعال CDE" value={stats.roots} icon={<Terminal className="w-6 h-6" />} variant="success" />
          <StatCard title="سامانه‌های مجاز" value={stats.applications} icon={<CheckCircle className="w-6 h-6" />} variant="warning" />
        </div>

        <Card padding="sm">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="جستجو در نام، مسیر، توضیحات یا اسکریپت..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                className="w-full pr-10 pl-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </Card>

        <Table
          columns={columns}
          data={data?.data || []}
          loading={loading}
          emptyMessage="فایل تستی یافت نشد"
          sortBy={filters.sortBy}
          sortOrder={filters.sortOrder}
          onSort={(key) => setFilters({
            ...filters,
            sortBy: key,
            sortOrder: filters.sortBy === key && filters.sortOrder === 'asc' ? 'desc' : 'asc',
          })}
          onRowClick={(item) => {
            setSelectedFile(item);
            setShowDetailModal(true);
          }}
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

      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={formMode === 'edit' ? 'ویرایش فایل تست Playwright' : 'ایجاد فایل تست Playwright'}
        size="wide"
      >
        <div className="grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-6 items-start">
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">مشخصات فایل</h2>
              <p className="text-sm text-gray-500 mt-1">همه اطلاعات فایل تست از همین فرم قابل ایجاد و ویرایش است.</p>
            </div>

            <Select
              label="سامانه *"
              value={formData.applicationId}
              onChange={(e) => setFormData({ ...formData, applicationId: e.target.value, folderPath: '' })}
              options={applications.map(app => ({ value: app.id, label: `${app.name} (${app.code})` }))}
              placeholder="سامانه را انتخاب کنید"
              error={formErrors.applicationId}
            />

            {selectedApplication && (
              <div className="grid grid-cols-1 gap-2 text-xs">
                <PathBadge label="Front" value={selectedApplication.cdeFrontUrl} />
                <PathBadge label="DataService" value={selectedApplication.cdeDataServiceUrl} />
                <PathBadge label="Gateway" value={selectedApplication.cdeGatewayUrl} />
              </div>
            )}

            <Select
              label="پوشه مقصد *"
              value={formData.folderPath}
              onChange={(e) => setFormData({ ...formData, folderPath: e.target.value })}
              options={folders.map(folder => ({
                value: folder.fullPath,
                label: `${PLAYWRIGHT_CDE_ROOT_LABELS[folder.rootKind]} / ${folder.relativePath}`,
              }))}
              placeholder={folders.length ? 'پوشه را انتخاب کنید' : 'پوشه‌ای از CDE خوانده نشد'}
              error={formErrors.folderPath}
              disabled={folders.length === 0}
            />

            <Input
              label="نام فایل تست *"
              value={formData.fileName}
              onChange={(e) => handleFileNameChange(e.target.value)}
              placeholder="login-flow.spec.ts"
              dir="ltr"
              error={formErrors.fileName}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">توضیحات</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value.slice(0, DESCRIPTION_MAX_LENGTH) })}
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  formErrors.description ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="هدف یا سناریوی فایل تست را کوتاه بنویسید..."
              />
              <div className="flex items-center justify-between mt-1">
                {formErrors.description ? <p className="text-sm text-red-600">{formErrors.description}</p> : <span />}
                <span className="text-xs text-gray-400">{formData.description.length}/{DESCRIPTION_MAX_LENGTH}</span>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">مسیر نهایی فایل</p>
              <p className="font-mono text-xs text-gray-800 break-all" dir="ltr">{finalPath || '-'}</p>
            </div>

            {folders.length === 0 && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-700">
                برای این سامانه آدرس CDE یا پوشه قابل خواندن ثبت نشده است.
              </div>
            )}
          </div>

          <CodeEditor
            fileName={formData.fileName || 'new-test.spec.ts'}
            value={formData.script}
            onChange={(script) => setFormData({ ...formData, script })}
            error={formErrors.script}
          />
        </div>

        <div className="flex flex-wrap gap-3 justify-end pt-5 mt-5 border-t">
          <Button variant="secondary" onClick={() => setFormData({ ...formData, script: DEFAULT_SCRIPT })}>
            قالب اولیه
          </Button>
          <Button variant="secondary" onClick={() => setShowFormModal(false)}>
            انصراف
          </Button>
          <Button icon={<Save className="w-4 h-4" />} onClick={handleSubmit} loading={actionLoading} disabled={actionLoading}>
            {formMode === 'edit' ? 'ذخیره ویرایش' : 'ایجاد فایل'}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="جزئیات فایل تست Playwright"
        size="xl"
      >
        {selectedFile && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 font-mono" dir="ltr">{selectedFile.fileName}</h3>
                <p className="text-xs text-gray-500 font-mono break-all mt-1" dir="ltr">{selectedFile.fullPath}</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <Badge variant={selectedFile.source === 'DISCOVERED' ? 'secondary' : 'success'}>
                  {selectedFile.source === 'DISCOVERED' ? 'کشف‌شده از CDE' : 'مدیریت‌شده'}
                </Badge>
                <Badge variant="info">{PLAYWRIGHT_CDE_ROOT_LABELS[selectedFile.rootKind]}</Badge>
              </div>
            </div>
            {selectedFile.description && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                {selectedFile.description}
              </div>
            )}
            <CodePreview fileName={selectedFile.fileName} value={selectedFile.script} />
            <div className="flex justify-end gap-3">
              {canManageFile && (
                <Button icon={<Edit className="w-4 h-4" />} onClick={() => openEditForm(selectedFile)}>
                  ویرایش
                </Button>
              )}
              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>بستن</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const PathBadge: React.FC<{ label: string; value?: string | undefined }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
    <span className="text-gray-500">{label}</span>
    <span className="font-mono text-gray-700 truncate" dir="ltr">{value || '-'}</span>
  </div>
);

const CodeEditor: React.FC<{
  fileName: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}> = ({ fileName, value, onChange, error }) => {
  const lineCount = Math.max(1, value.split('\n').length);
  const lineNumbers = Array.from({ length: lineCount }, (_, index) => index + 1).join('\n');

  return (
    <div className={`rounded-xl overflow-hidden border shadow-sm ${error ? 'border-red-500' : 'border-slate-700'}`}>
      <div className="bg-[#252526] text-gray-300 px-3 py-2 flex items-center justify-between text-xs" dir="ltr">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span className="mr-3 px-3 py-1 bg-[#1e1e1e] rounded-t font-mono">{fileName}</span>
        </div>
        <span>TypeScript Playwright</span>
      </div>
      <div className="grid grid-cols-[3.25rem_1fr] bg-[#1e1e1e]" dir="ltr">
        <pre className="select-none text-right px-3 py-4 text-gray-500 bg-[#1b1b1b] font-mono text-sm leading-6 overflow-hidden">
          {lineNumbers}
        </pre>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="min-h-[68vh] w-full resize-y bg-[#1e1e1e] text-gray-100 caret-blue-400 px-4 py-4 font-mono text-sm leading-6 outline-none"
          placeholder={DEFAULT_SCRIPT}
        />
      </div>
      <div className="bg-blue-700 text-white px-3 py-1.5 text-xs flex items-center justify-between" dir="ltr">
        <span>Ln {lineCount}, UTF-8</span>
        <span>Playwright Test</span>
      </div>
      {error && <p className="bg-red-50 text-red-600 text-sm px-3 py-2" dir="rtl">{error}</p>}
    </div>
  );
};

const CodePreview: React.FC<{ fileName: string; value: string }> = ({ fileName, value }) => {
  const lineNumbers = Array.from({ length: Math.max(1, value.split('\n').length) }, (_, index) => index + 1).join('\n');
  return (
    <div className="rounded-xl overflow-hidden border border-slate-700" dir="ltr">
      <div className="bg-[#252526] text-gray-300 px-3 py-2 text-xs font-mono">{fileName}</div>
      <div className="grid grid-cols-[3.25rem_1fr] bg-[#1e1e1e] max-h-[560px] overflow-auto">
        <pre className="select-none text-right px-3 py-4 text-gray-500 bg-[#1b1b1b] font-mono text-sm leading-6">{lineNumbers}</pre>
        <pre className="px-4 py-4 text-gray-100 font-mono text-sm leading-6 whitespace-pre-wrap">{value}</pre>
      </div>
    </div>
  );
};
