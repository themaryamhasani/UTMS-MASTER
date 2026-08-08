import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Database, Edit, Eye, FileCode2, FileText, FolderOpen, FolderTree, Link2, LogOut, Plus, Save, Server } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { Table, Pagination } from '../components/ui/Table';
import { CartableSearchInput } from '../components/ui/CartableToolbar';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, SearchableSelect } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { useAuthStore, canPerformAction, canUseAutomatedTests } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import {
  cdeApi,
  PlatformApiError,
  type CdeCatalog,
  type CdeConnectionStatus,
  type CdePackageContent,
  type CdeProjectDescriptor,
  type CdeVisibleApplication,
} from '../services/platformApi';
import type {
  Application,
  CartableFilterParams,
  PaginatedResponse,
  PlaywrightTestFile,
  PlaywrightTestFolder,
} from '../types';
import { PLAYWRIGHT_CDE_ROOT_LABELS } from '../types';

const DESCRIPTION_MAX_LENGTH = 700;
const PLAYWRIGHT_FILE_NAME_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.spec\.(?:ts|js)|\.test\.(?:ts|js)|\.js)$/;

interface CdeTestFilesResponse {
  files: PaginatedResponse<PlaywrightTestFile>;
  folders: PlaywrightTestFolder[];
  storage: {
    provider: 'COUCHDB';
    database: string;
    projectKey: string;
    bindingFingerprint: string;
    editable: boolean;
  };
}

const DEFAULT_SCRIPT = `const { test, expect } = require('@playwright/test');

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

interface PendingBranchSelection {
  repositoryType: Exclude<CdeCatalog['repositories'][number]['type'], 'TESTS'>;
  repoName: string;
  packId: string;
  branches: Array<{
    selector: CdePackageContent['branch']['selector'];
    versionId?: string | null;
    editable?: boolean;
    meta?: Record<string, unknown>;
  }>;
}

export const PlaywrightFilesPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { defaultApplicationId, scopeApplicationIds, isAppLevel } = useDataScope();
  const [applications, setApplications] = useState<Application[]>([]);
  const [cdeApplications, setCdeApplications] = useState<CdeVisibleApplication[]>([]);
  const [cdeProjects, setCdeProjects] = useState<CdeProjectDescriptor[]>([]);
  const [selectedProjectKey, setSelectedProjectKey] = useState('');
  const [cdeStatus, setCdeStatus] = useState<CdeConnectionStatus>({ connected: false });
  const [catalog, setCatalog] = useState<CdeCatalog | null>(null);
  const [packageContent, setPackageContent] = useState<CdePackageContent | null>(null);
  const [selectedSource, setSelectedSource] = useState<{ path: string; code: string } | null>(null);
  const [pendingBranchSelection, setPendingBranchSelection] = useState<PendingBranchSelection | null>(null);
  const [showCdeLogin, setShowCdeLogin] = useState(false);
  const [cdeLoginName, setCdeLoginName] = useState('');
  const [cdePassword, setCdePassword] = useState('');
  const [cdeChallenge, setCdeChallenge] = useState('');
  const [cdeLoginStep, setCdeLoginStep] = useState<'phone' | 'password'>('phone');
  const [cdeError, setCdeError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [editingRevision, setEditingRevision] = useState('');
  const [testStorage, setTestStorage] = useState<CdeTestFilesResponse['storage'] | null>(null);
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
  const mappedApplicationSelected = cdeApplications.some(application => application.id === formData.applicationId);

  useEffect(() => {
    if (activeContext) {
      void loadCdeSession();
    }
  }, [activeContext]);

  useEffect(() => {
    if (activeContext && cdeStatus.connected && formData.applicationId && mappedApplicationSelected) {
      void loadFiles();
    } else if (cdeStatus.connected && !mappedApplicationSelected) {
      setData(null);
      setFolders([]);
      setTestStorage(null);
      setLoading(false);
    }
  }, [activeContext, cdeStatus.connected, formData.applicationId, filters, mappedApplicationSelected]);

  useEffect(() => {
    if (selectedProjectKey && cdeStatus.connected) void loadCatalog(selectedProjectKey);
  }, [selectedProjectKey, cdeStatus.connected]);

  const loadCdeSession = async () => {
    if (!activeContext) return;
    try {
      const status = await cdeApi.status();
      setCdeStatus(status);
      if (status.connected) {
        await loadProjects();
        await loadApplications();
      }
      else {
        setApplications([]);
        setCdeApplications([]);
        setCdeProjects([]);
        setSelectedProjectKey('');
        setCatalog(null);
        setData(null);
        setFolders([]);
        setLoading(false);
      }
    } catch {
      setCdeStatus({ connected: false });
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    const projects = await cdeApi.projects();
    setCdeProjects(projects);
    if (!projects.length) {
      setCatalog(null);
      setPackageContent(null);
    }
    setSelectedProjectKey(previous => projects.some(project => project.projectKey === previous)
      ? previous
      : projects[0]?.projectKey || '');
  };

  const loadApplications = async () => {
    if (!activeContext) return;
    const visible = await cdeApi.applications();
    setCdeApplications(visible);
    const visibleIds = new Set(visible.map(application => application.id));
    const contextApplications = activeContext.applications?.length
      ? activeContext.applications
      : activeContext.application
        ? [activeContext.application]
        : [];
    const allowed = isAppLevel
      ? contextApplications.filter(app => app.isActive && visibleIds.has(app.id))
      : contextApplications.filter(app => app.isActive && scopeApplicationIds.includes(app.id) && visibleIds.has(app.id));
    setApplications(allowed);
    setFormData(prev => ({
      ...prev,
      applicationId: allowed.some(application => application.id === prev.applicationId)
        ? prev.applicationId
        : allowed.find(application => application.id === defaultApplicationId)?.id || allowed[0]?.id || '',
    }));
    if (!allowed.length) {
      setData(null);
      setFolders([]);
      setLoading(false);
    }
  };

  const loadCatalog = async (projectKey: string) => {
    setCatalogLoading(true);
    try {
      setCatalog(await cdeApi.projectCatalog(projectKey));
      setPackageContent(null);
    } catch (error) {
      setCatalog(null);
      if (error instanceof PlatformApiError && ['CDE_RECONNECT_REQUIRED', 'CDE_NOT_CONNECTED'].includes(error.code)) {
        setCdeStatus({ connected: false, reconnectRequired: true });
      }
      toast.error('خطا در خواندن فهرست پروژه از CDE.');
    } finally {
      setCatalogLoading(false);
    }
  };

  const loadFiles = async () => {
    if (!activeContext || !formData.applicationId) return;
    setLoading(true);
    try {
      const response = await cdeApi.testFiles<CdeTestFilesResponse>(formData.applicationId, {
        page: filters.page,
        limit: filters.limit,
        ...(filters.search ? { search: filters.search } : {}),
      });
      setData(response.files);
      setTestStorage(response.storage);
      setFolders(response.folders.map(folder => ({ ...folder, applicationId: formData.applicationId })));
      setFormData(prev => ({
        ...prev,
        folderPath: response.folders.some(folder => folder.fullPath === prev.folderPath) ? prev.folderPath : 'tests',
      }));
    } catch (error) {
      setData(null);
      setTestStorage(null);
      if (error instanceof PlatformApiError && ['CDE_RECONNECT_REQUIRED', 'CDE_NOT_CONNECTED'].includes(error.code)) {
        setCdeStatus({ connected: false, reconnectRequired: true });
      }
      toast.error('خطا در بارگذاری فایل‌های تست از CouchDB.');
    } finally {
      setLoading(false);
    }
  };

  const handleCdeLogin = async () => {
    setActionLoading(true);
    setCdeError('');
    try {
      if (cdeLoginStep === 'phone') {
        const response = await cdeApi.startLogin(cdeLoginName.trim());
        if (response.connected) {
          setCdeStatus(response);
          setShowCdeLogin(false);
          await loadProjects();
          await loadApplications();
        } else {
          setCdeChallenge(response.challenge || '');
          setCdeLoginStep('password');
        }
      } else {
        const response = await cdeApi.finishPassword(cdeChallenge, cdePassword);
        setCdeStatus(response);
        setCdePassword('');
        setShowCdeLogin(false);
        await loadProjects();
        await loadApplications();
      }
    } catch (error) {
      setCdeError(error instanceof PlatformApiError ? error.message : 'ارتباط با CDE ناموفق بود.');
    } finally {
      setActionLoading(false);
    }
  };

  const disconnectCde = async () => {
    await cdeApi.disconnect();
    setCdeStatus({ connected: false });
    setApplications([]);
    setCdeApplications([]);
    setCdeProjects([]);
    setSelectedProjectKey('');
    setCatalog(null);
    setPackageContent(null);
    setData(null);
    setTestStorage(null);
  };

  const openPackage = async (
    repositoryType: Exclude<CdeCatalog['repositories'][number]['type'], 'TESTS'>,
    repoName: string,
    packId: string,
    branch?: CdePackageContent['branch']['selector']
  ) => {
    if (!selectedProjectKey) return;
    setCatalogLoading(true);
    try {
      setPackageContent(await cdeApi.projectPackage(selectedProjectKey, {
        repositoryType,
        packId,
        ...(branch ? { branch } : {}),
      }));
    } catch (error) {
      if (error instanceof PlatformApiError && error.code === 'BRANCH_SELECTION_REQUIRED') {
        const branches = (error.details as { branches?: PendingBranchSelection['branches'] } | undefined)?.branches || [];
        setPendingBranchSelection({ repositoryType, repoName, packId, branches });
      } else {
        toast.error('خطا در خواندن محتوای بسته CDE.');
      }
    } finally {
      setCatalogLoading(false);
    }
  };

  const selectPackageBranch = async (branch: PendingBranchSelection['branches'][number]) => {
    if (!pendingBranchSelection || !selectedProjectKey) return;
    setCatalogLoading(true);
    try {
      const request = {
        repositoryType: pendingBranchSelection.repositoryType,
        packId: pendingBranchSelection.packId,
        branch: branch.selector,
      };
      setPackageContent(await cdeApi.projectPackage(selectedProjectKey, request));
      setPendingBranchSelection(null);
    } catch {
      toast.error('شاخه CDE دیگر قابل دسترسی نیست؛ فهرست را دوباره بارگذاری کنید.');
    } finally {
      setCatalogLoading(false);
    }
  };

  const selectedApplication = applications.find(app => app.id === formData.applicationId);
  const selectedCdeApplication = cdeApplications.find(app => app.id === formData.applicationId);
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
      folderPath: folders.some(folder => folder.fullPath === 'tests') ? 'tests' : folders[0]?.fullPath || '',
      fileName: '',
      description: '',
      script: DEFAULT_SCRIPT,
    });
    setEditingFileId(null);
    setEditingRevision('');
    setFormErrors({});
  };

  const openCreateForm = () => {
    setFormMode('create');
    resetForm(formData.applicationId || defaultApplicationId || applications[0]?.id || '');
    setShowFormModal(true);
  };

  const openEditForm = (file: PlaywrightTestFile) => {
    if (file.source !== 'COUCHDB') {
      toast.error('فایل‌های قدیمی و CDE فقط خواندنی هستند؛ یک نسخه در CouchDB بسازید.');
      return;
    }
    setFormMode('edit');
    setEditingFileId(file.id);
    setEditingRevision(file.couchRevision || file.remoteVersionId || '');
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
      errors.fileName = 'نام فایل باید مانند province-ask.js، login-flow.spec.js یا login-flow.spec.ts باشد؛ فقط حروف کوچک انگلیسی، عدد و خط تیره مجاز است.';
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
        path: finalPath,
        script: formData.script,
        description: formData.description.trim(),
        ...(formMode === 'edit' ? { expectedRevision: editingRevision } : {}),
      };
      if (formMode === 'edit' && editingFileId) {
        await cdeApi.updateTestFile(formData.applicationId, editingFileId, payload);
        toast.success('فایل تست Playwright بروزرسانی شد.');
      } else {
        await cdeApi.createTestFile(formData.applicationId, payload);
        toast.success('فایل تست Playwright ایجاد شد.');
      }
      setShowFormModal(false);
      resetForm();
      await loadFiles();
    } catch (error) {
      const message = error instanceof PlatformApiError ? error.code : error instanceof Error ? error.message : '';
      if (message === 'INVALID_PLAYWRIGHT_TEST_FILE_NAME') {
        setFormErrors({ fileName: 'فرمت نام فایل معتبر نیست. نمونه درست: province-ask.js یا login-flow.spec.ts' });
      } else if (message === 'PLAYWRIGHT_TEST_FILE_ALREADY_EXISTS') {
        setFormErrors({ fileName: 'در این مسیر فایلی با همین نام وجود دارد.' });
      } else if (message === 'PLAYWRIGHT_SCRIPT_REQUIRED') {
        setFormErrors({ script: 'اسکریپت تست الزامی است.' });
      } else if (message === 'COUCHDB_WRITE_CONFLICT') {
        toast.error('نسخه CouchDB تغییر کرده است. فایل‌ها دوباره بارگذاری شدند؛ تغییر را روی نسخه جدید اعمال کنید.');
        await loadFiles();
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
      render: (item: PlaywrightTestFile) => applications.find(app => app.id === item.applicationId)?.name || 'سامانه نامشخص',
    },
    {
      key: 'source',
      title: 'منبع',
      render: (item: PlaywrightTestFile) => (
        <Badge variant={item.source === 'COUCHDB' ? 'success' : 'secondary'}>
          {item.source === 'COUCHDB' ? 'CouchDB' : 'قدیمی - فقط خواندنی'}
        </Badge>
      ),
    },
    {
      key: 'rootKind',
      title: 'ریشه ذخیره‌سازی',
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
          {canManageFile && item.source === 'COUCHDB' && (
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
        onRefresh={() => {
          void loadCdeSession();
          if (selectedProjectKey && cdeStatus.connected) void loadCatalog(selectedProjectKey);
        }}
        refreshing={loading}
        actions={canManageFile && cdeStatus.connected && mappedApplicationSelected && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateForm}>
            ایجاد فایل
          </Button>
        )}
      />

      <main className="mx-auto max-w-[1800px] space-y-5 p-4 sm:p-6">
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm ${
          cdeStatus.connected ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
        }`}>
          <div className="flex items-center gap-3">
            {cdeStatus.connected
              ? <CheckCircle className="w-5 h-5 text-emerald-600" />
              : <AlertTriangle className="w-5 h-5 text-amber-600" />}
            <div>
              <p className="font-semibold text-gray-900">
                {cdeStatus.connected ? `اتصال CDE برقرار است${cdeStatus.user?.displayName ? ` · ${cdeStatus.user.displayName}` : ''}` : 'اتصال به CDE الزامی است'}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {cdeStatus.connected
                  ? 'سورس پروژه با Session سروری CDE خوانده و فایل‌های Playwright در CouchDB سامانه ذخیره می‌شوند.'
                  : 'حساب CDE خود را متصل کنید؛ رمز عبور فقط یک‌بار ارسال می‌شود و ذخیره نخواهد شد.'}
              </p>
            </div>
          </div>
          {cdeStatus.connected ? (
            <Button variant="secondary" icon={<LogOut className="w-4 h-4" />} onClick={() => void disconnectCde()}>
              قطع اتصال CDE
            </Button>
          ) : (
            <Button icon={<Link2 className="w-4 h-4" />} onClick={() => {
              setCdeLoginStep('phone');
              setCdeError('');
              setShowCdeLogin(true);
            }}>
              اتصال به CDE
            </Button>
          )}
        </div>

        {!canManageFile && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>برای ایجاد یا ویرایش فایل تست باید دسترسی اجرای Playwright در Context فعال داشته باشید.</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard title="کل فایل‌های تست" value={stats.total} icon={<FileText className="h-5 w-5" />} />
          <StatCard title="پوشه‌های CouchDB" value={stats.folders} icon={<FolderTree className="h-5 w-5" />} variant="primary" />
          <StatCard title="ریشه‌های ذخیره‌سازی" value={stats.roots} icon={<Database className="h-5 w-5" />} variant="success" />
          <StatCard title="سامانه‌های مجاز" value={stats.applications} icon={<Server className="h-5 w-5" />} variant="warning" />
        </div>

        <div className={`grid min-w-0 items-start gap-5 ${cdeStatus.connected ? '2xl:grid-cols-[minmax(0,2fr)_minmax(340px,0.85fr)]' : 'grid-cols-1'}`}>
          <section className="min-w-0 space-y-4">
            <Card className="relative z-20 overflow-visible" padding="sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
                <div>
                  <h2 className="font-semibold text-gray-900">کارتابل فایل‌های تست</h2>
                  <p className="mt-1 text-xs text-gray-500">فایل‌های CouchDB را براساس سامانه، نام، مسیر یا محتوا پیدا کنید.</p>
                </div>
                {testStorage && (
                  <Badge variant="success">{testStorage.provider} · {testStorage.database}</Badge>
                )}
              </div>
              <div className="grid items-end gap-4 lg:grid-cols-[minmax(260px,0.9fr)_minmax(280px,1.1fr)]">
                <SearchableSelect
                  label="سامانه متصل به فایل‌های تست"
                  value={formData.applicationId}
                  onValueChange={(applicationId) => setFormData(previous => ({ ...previous, applicationId, folderPath: '' }))}
                  options={applications.map(application => ({
                    value: application.id,
                    label: `${application.name} (${application.code})`,
                    keywords: `${application.name} ${application.code}`,
                  }))}
                  placeholder="سامانه مپ‌شده‌ای وجود ندارد"
                  searchPlaceholder="جستجوی نام یا کد سامانه..."
                  disabled={applications.length === 0}
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">جستجوی فایل</label>
                  <CartableSearchInput
                    value={filters.search || ''}
                    onChange={(search) => setFilters({ ...filters, search, page: 1 })}
                    placeholder="نام، مسیر، توضیحات یا اسکریپت..."
                    className="min-w-0"
                  />
                </div>
              </div>
              {selectedCdeApplication && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">CDE: {selectedCdeApplication.projectKey}</span>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 font-mono text-gray-600" dir="ltr">{selectedCdeApplication.repositories.tests}</span>
                </div>
              )}
            </Card>

            {cdeStatus.connected && applications.length === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                مشاهده سورس پروژه‌ها فعال است، اما برای ایجاد فایل Playwright باید مدیر سیستم سامانه UTMS را به پروژه CDE متناظر مپ کند.
              </div>
            )}

            <Table
              columns={columns}
              data={data?.data || []}
              loading={loading}
              emptyMessage="فایل تستی با فیلترهای فعلی یافت نشد."
              sortBy={filters.sortBy}
              sortOrder={filters.sortOrder}
              enableClientFilter={false}
              exportFilename="playwright-test-files"
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
          </section>

          {cdeStatus.connected && (
            <aside className="min-w-0 2xl:sticky 2xl:top-4">
              <Card className="relative z-30 overflow-visible">
                <div className="mb-4 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-blue-600" />
                    <h2 className="font-semibold text-gray-900">مرورگر سورس CDE</h2>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-gray-500">سورس فقط‌خواندنی و نسخه دقیق هر پکیج را بررسی کنید.</p>
                </div>

                <SearchableSelect
                  label="پروژه CDE"
                  value={selectedProjectKey}
                  onValueChange={setSelectedProjectKey}
                  options={cdeProjects.map(project => ({ value: project.projectKey, label: project.projectKey }))}
                  placeholder="پروژه CDE را انتخاب کنید"
                  searchPlaceholder="جستجوی پروژه CDE..."
                  emptyMessage="پروژه‌ای با این عبارت پیدا نشد."
                  dir="ltr"
                />

                {cdeProjects.length === 0 && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    حساب CDE متصل‌شده هیچ پروژه‌ای برنگرداند.
                  </div>
                )}

                <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-1">
                  {catalog?.repositories.map(repository => (
                    <div key={`${repository.type}:${repository.repoName}`} className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50/60">
                      <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2.5">
                        <Badge variant="info">{repository.type}</Badge>
                        <span className="truncate font-mono text-[11px] text-gray-500" dir="ltr">{repository.repoName}</span>
                      </div>
                      <div className="max-h-44 space-y-1 overflow-auto p-2">
                        {repository.error && <p className="rounded-lg bg-amber-50 px-2 py-2 text-xs text-amber-700">{repository.error.message}</p>}
                        {!repository.error && repository.packages.length === 0 && <p className="px-2 py-2 text-xs text-gray-400">پکیجی برنگشته نشد.</p>}
                        {repository.packages.map(pack => (
                          <button
                            key={pack.id}
                            type="button"
                            onClick={() => void openPackage(
                              repository.type as Exclude<CdeCatalog['repositories'][number]['type'], 'TESTS'>,
                              repository.repoName,
                              pack.id
                            )}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left font-mono text-xs text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            dir="ltr"
                          >
                            <FileCode2 className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{pack.id}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {packageContent && (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-semibold text-gray-900" dir="ltr">{packageContent.packId}</p>
                        <p className="mt-1 text-xs text-gray-500">نسخه {packageContent.branch.versionId || 'نامشخص'} · {packageContent.branch.editable ? 'قابل ویرایش' : 'فقط‌خواندنی'}</p>
                      </div>
                      <Badge variant="secondary">{packageContent.files.length} فایل</Badge>
                    </div>
                    <div className="max-h-52 space-y-1 overflow-y-auto">
                      {packageContent.files.map(file => (
                        <button
                          key={file.path}
                          type="button"
                          onClick={() => setSelectedSource(file)}
                          className="block w-full truncate rounded-lg bg-white px-2.5 py-2 text-left font-mono text-xs text-gray-700 shadow-sm transition hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          dir="ltr"
                        >
                          {file.path}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {catalogLoading && <p className="mt-4 text-sm text-gray-500">در حال بارگذاری داده‌های CDE…</p>}
              </Card>
            </aside>
          )}
        </div>
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

            <SearchableSelect
              label="سامانه *"
              value={formData.applicationId}
              onValueChange={(applicationId) => setFormData({ ...formData, applicationId, folderPath: '' })}
              options={applications.map(app => ({
                value: app.id,
                label: `${app.name} (${app.code})`,
                keywords: `${app.name} ${app.code}`,
              }))}
              placeholder="سامانه را انتخاب کنید"
              searchPlaceholder="جستجوی نام یا کد سامانه..."
              error={formErrors.applicationId}
              disabled={formMode === 'edit'}
            />

            {selectedApplication && (
              <div className="grid grid-cols-1 gap-2 text-xs">
                <PathBadge label="CDE project" value={selectedCdeApplication?.projectKey} />
                <PathBadge label="Test repository" value={selectedCdeApplication?.repositories.tests || undefined} />
                <PathBadge label="Storage" value={testStorage ? `${testStorage.provider}/${testStorage.database}` : undefined} />
                {formMode === 'edit' && <PathBadge label="CouchDB revision" value={editingRevision || undefined} />}
              </div>
            )}

            <SearchableSelect
              label="پوشه مقصد *"
              value={formData.folderPath}
              onValueChange={(folderPath) => setFormData({ ...formData, folderPath })}
              options={folders.map(folder => ({
                value: folder.fullPath,
                label: `${PLAYWRIGHT_CDE_ROOT_LABELS[folder.rootKind]} / ${folder.relativePath}`,
                keywords: `${folder.fullPath} ${folder.rootKind}`,
              }))}
              placeholder={folders.length ? 'پوشه را انتخاب کنید' : 'پوشه‌ای در CouchDB وجود ندارد'}
              searchPlaceholder="جستجوی نام یا مسیر پوشه..."
              error={formErrors.folderPath}
              disabled={folders.length === 0}
              dir="ltr"
            />

            <Input
              label="نام فایل تست *"
              value={formData.fileName}
              onChange={(e) => handleFileNameChange(e.target.value)}
              placeholder="province-ask.js یا login-flow.spec.ts"
              dir="ltr"
              error={formErrors.fileName}
            />
            <p className="-mt-3 text-xs text-gray-500">
              فرمت‌های قابل اجرا: <span dir="ltr" className="font-mono">.js، .spec.js، .test.js، .spec.ts و .test.ts</span>
            </p>

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
                برای این پروژه هنوز فایل تستی در CouchDB ثبت نشده است.
              </div>
            )}
          </div>

          <CodeEditor
            fileName={formData.fileName || 'new-test.js'}
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
                <Badge variant={selectedFile.source === 'COUCHDB' ? 'success' : 'secondary'}>
                  {selectedFile.source === 'COUCHDB' ? `CouchDB · ${selectedFile.couchRevision || 'unknown revision'}` : 'قدیمی - فقط خواندنی'}
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
              {canManageFile && selectedFile.source === 'COUCHDB' && (
                <Button icon={<Edit className="w-4 h-4" />} onClick={() => openEditForm(selectedFile)}>
                  ویرایش
                </Button>
              )}
              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>بستن</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showCdeLogin}
        onClose={() => !actionLoading && setShowCdeLogin(false)}
        title="Connect CDE account"
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            UTMS keeps only the encrypted CDE cookie jar. Your password is forwarded once through Core's POST form endpoint and is not stored.
          </div>
          {cdeLoginStep === 'phone' ? (
            <Input
              label="CDE cellphone"
              value={cdeLoginName}
              onChange={(event) => setCdeLoginName(event.target.value.replace(/\D/g, '').slice(0, 13))}
              placeholder="9020000000"
              dir="ltr"
            />
          ) : (
            <Input
              label="CDE password"
              type="password"
              value={cdePassword}
              onChange={(event) => setCdePassword(event.target.value)}
              dir="ltr"
            />
          )}
          {cdeError && <p className="text-sm text-red-600">{cdeError}</p>}
          <div className="flex justify-end gap-2 border-t pt-4">
            {cdeLoginStep === 'password' && (
              <Button variant="secondary" onClick={() => {
                setCdeLoginStep('phone');
                setCdePassword('');
                setCdeChallenge('');
              }}>
                Back
              </Button>
            )}
            <Button
              onClick={() => void handleCdeLogin()}
              loading={actionLoading}
              disabled={actionLoading || (cdeLoginStep === 'phone' ? cdeLoginName.length < 10 : !cdePassword)}
            >
              {cdeLoginStep === 'phone' ? 'Continue' : 'Connect'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(pendingBranchSelection)}
        onClose={() => setPendingBranchSelection(null)}
        title="انتخاب شاخه CDE"
        size="lg"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            این بسته چند شاخه خواندنی دارد. UTMS هیچ شاخه‌ای را حدس نمی‌زند؛ شاخه و نسخه دقیق را انتخاب کنید.
          </p>
          {pendingBranchSelection?.branches.map((branch, index) => (
            <button
              key={`${branch.selector.kind}-${branch.selector.kind === 'PERSONAL' ? branch.selector.randId || branch.selector.index : 'public'}-${index}`}
              type="button"
              onClick={() => void selectPackageBranch(branch)}
              disabled={catalogLoading}
              className="flex w-full items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 text-right transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
            >
              <span>
                <span className="block font-medium text-gray-900">
                  {branch.selector.kind === 'PUBLIC'
                    ? 'Public (read-only)'
                    : `Personal · ${branch.selector.randId || `index ${branch.selector.index}`}`}
                </span>
                <span className="mt-1 block font-mono text-xs text-gray-500" dir="ltr">
                  version: {branch.versionId || 'unknown'}
                </span>
              </span>
              <Badge variant={branch.editable ? 'success' : 'secondary'}>{branch.editable ? 'editable' : 'read-only'}</Badge>
            </button>
          ))}
          {!pendingBranchSelection?.branches.length && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">هیچ شاخه قابل انتخابی در پاسخ CDE نبود.</p>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(selectedSource)}
        onClose={() => setSelectedSource(null)}
        title={selectedSource?.path || 'CDE source'}
        size="xl"
      >
        {selectedSource && <CodePreview fileName={selectedSource.path} value={selectedSource.code} />}
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
