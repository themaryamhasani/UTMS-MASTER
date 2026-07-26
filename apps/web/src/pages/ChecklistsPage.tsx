import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Eye,
  Minus,
  Paperclip,
  Search,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Select, Textarea } from '../components/ui/Input';
import { useAuthStore, canPerformAction } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import { useApplicationLookup } from '../utils/useApplicationLookup';
import { applicationApi, securityChecklistApi } from '../services/api';
import { toast } from '../components/ui/Toast';
import { formatJalaliDateTime } from '../utils/jalaliDate';
import type {
  SecurityReview,
  SecurityReviewDetailItem,
  SecurityReviewItemResult,
  SecurityReviewStatus,
} from '../types';

const STATUS_LABELS: Record<SecurityReviewStatus, string> = {
  PENDING: 'در انتظار بررسی',
  IN_PROGRESS: 'در حال بررسی',
  NEEDS_QA_REVIEW: 'در انتظار بررسی سرپرست QA',
  ASSIGNED_TO_QA: 'ارجاع‌شده به متخصص QA',
  DEVELOPER_FIX: 'در انتظار رفع برنامه‌نویس',
  FIXED_PENDING_QA: 'در انتظار گزارش متخصص QA',
  QA_REPORT_REVIEW: 'در انتظار تأیید گزارش QA',
  RETURNED_TO_SECURITY: 'بازگشت به تیم امنیت',
  COMPLETED: 'تکمیل شده',
};

const RESULT_LABELS: Record<SecurityReviewItemResult, string> = {
  PASS: 'قبول',
  FAIL: 'رد',
  PARTIAL: 'ناقص',
  N_A: 'غیرقابل اعمال',
};

const MAX_SECURITY_FILE_SIZE = 10 * 1024 * 1024;

const formatFileSize = (size: number) => {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string'
    ? resolve(reader.result)
    : reject(new Error('SECURITY_REVIEW_FILE_READ_FAILED'));
  reader.onerror = () => reject(reader.error || new Error('SECURITY_REVIEW_FILE_READ_FAILED'));
  reader.readAsDataURL(file);
});

const REQUEST_TYPE_LABELS = {
  INITIAL: 'تست اولیه',
  NEW_VERSION: 'نسخه جدید',
  RETEST: 'بازآزمایی',
};

const ENVIRONMENT_LABELS = {
  DEVELOPMENT: 'Development',
  TEST: 'Test',
  PRODUCTION: 'Production',
};

const formatDate = (value?: string) => {
  if (!value || value === '-') return '-';
  return formatJalaliDateTime(value);
};

const DetailField = ({ label, value }: { label: string; value: string | undefined }) => (
  <div className="rounded-lg bg-gray-50 p-3">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="mt-1 break-words text-sm font-medium text-gray-900">{value || '-'}</p>
  </div>
);

export const ChecklistsPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { defaultApplicationId, scopeApplicationIds, isAppLevel, isMultiSystem } = useDataScope();
  const { shouldShowSystemColumn, getApplicationName } = useApplicationLookup();
  const [reviews, setReviews] = useState<SecurityReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAppId, setSelectedAppId] = useState('');
  const [applications, setApplications] = useState<Array<{ id: string; name: string }>>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<SecurityReview | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editResult, setEditResult] = useState<SecurityReviewItemResult | ''>('');
  const [editNotes, setEditNotes] = useState('');
  const [expandedMetric, setExpandedMetric] = useState<{
    title: string;
    items: SecurityReviewDetailItem[];
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  const shouldSelectApplication = isAppLevel || isMultiSystem;
  const role = activeContext?.role;
  const canReview = canPerformAction(role!, 'checklist:review');
  const canEditChecklist = Boolean(
    canReview &&
    selectedReview &&
    ['PENDING', 'IN_PROGRESS', 'RETURNED_TO_SECURITY'].includes(selectedReview.status)
  );

  useEffect(() => {
    if (!activeContext) return;
    if (shouldSelectApplication) {
      setSelectedAppId('');
      setReviews([]);
      setLoading(false);
      applicationApi.getAll()
        .then(data => {
          setApplications(data
            .filter(application =>
              application.isActive &&
              (isAppLevel || scopeApplicationIds.includes(application.id))
            )
            .map(application => ({ id: application.id, name: application.name })));
        })
        .catch(() => {
          setApplications([]);
          toast.error('خطا در بارگذاری سامانه‌ها.');
        });
    } else {
      setSelectedAppId(defaultApplicationId);
    }
  }, [
    activeContext,
    shouldSelectApplication,
    isAppLevel,
    defaultApplicationId,
    scopeApplicationIds.join('|'),
  ]);

  useEffect(() => {
    if (selectedAppId) void loadData(selectedAppId);
  }, [selectedAppId, activeContext]);

  const loadData = async (applicationId: string) => {
    if (!activeContext || !applicationId) return;
    setLoading(true);
    try {
      setReviews(await securityChecklistApi.getAllForApp(applicationId) as SecurityReview[]);
    } catch {
      setReviews([]);
      toast.error('خطا در بارگذاری درخواست‌های امنیت.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveItem = async () => {
    if (!selectedReview || !editingItemId || !editResult || !activeContext) return;
    setActionLoading(true);
    try {
      const updated = await securityChecklistApi.updateItem(
        selectedReview.id,
        editingItemId,
        editResult,
        editNotes,
        activeContext.userId
      );
      if (!updated) {
        toast.error('ثبت نتیجه این آیتم مجاز نیست.');
        return;
      }
      setSelectedReview(updated as SecurityReview);
      setEditingItemId(null);
      setEditResult('');
      setEditNotes('');
      toast.success('نتیجه آیتم ذخیره شد.');
      await loadData(selectedAppId);
    } catch {
      toast.error('خطا در ذخیره نتیجه.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!selectedReview || !activeContext) return;
    if (selectedReview.items.some(item => !item.result)) {
      toast.warning('تکمیل نتیجه همه آیتم‌های چک‌لیست الزامی است.');
      return;
    }
    if (!selectedReview.securityEvidenceAttachmentIds.length) {
      toast.warning('آپلود حداقل یک مستند امنیت الزامی است.');
      return;
    }
    setActionLoading(true);
    try {
      const updated = await securityChecklistApi.complete(
        selectedReview.id,
        activeContext.userId
      );
      if (!updated) {
        toast.error('تکمیل چک‌لیست مجاز نیست.');
        return;
      }
      setSelectedReview(updated as SecurityReview);
      if ((updated as SecurityReview).status === 'COMPLETED') {
        toast.success('نتیجه امنیت برای تصمیم نسخه‌گذاری به سرپرست فنی ارسال شد.');
      } else {
        toast.warning('موارد رد یا ناقص همراه مستندات برای بررسی سرپرست QA ارسال شد.');
      }
      await loadData(selectedAppId);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      toast.error(message.includes('EVIDENCE_REQUIRED')
        ? 'آپلود حداقل یک مستند امنیت الزامی است.'
        : 'همه آیتم‌ها باید تکمیل شده باشند.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEvidenceUpload = async (file?: File) => {
    if (!file || !selectedReview || !activeContext) return;
    if (file.size > MAX_SECURITY_FILE_SIZE) {
      toast.error('حجم فایل نباید بیشتر از ۱۰ مگابایت باشد.');
      return;
    }
    if (file.size <= 0) {
      toast.error('فایل خالی قابل آپلود نیست.');
      return;
    }
    setUploadLoading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const updated = await securityChecklistApi.uploadEvidence(
        selectedReview.id,
        { name: file.name, size: file.size, type: file.type, dataUrl },
        'SECURITY_EVIDENCE',
        activeContext.userId
      );
      if (!updated) {
        toast.error('آپلود فایل در وضعیت فعلی مجاز نیست.');
        return;
      }
      setSelectedReview(updated as SecurityReview);
      toast.success('مستند امنیت آپلود شد.');
      await loadData(selectedAppId);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      toast.error(message.includes('TOO_LARGE')
        ? 'حجم فایل نباید بیشتر از ۱۰ مگابایت باشد.'
        : 'آپلود مستند امنیت ناموفق بود.');
    } finally {
      setUploadLoading(false);
    }
  };

  if (!activeContext) return null;

  const filtered = reviews.filter(review => {
    const matchesSearch = !search ||
      review.testRequestTitle.toLowerCase().includes(search.toLowerCase()) ||
      review.requestSummary.requirementAndTestCase.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || review.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getResultIcon = (result?: SecurityReviewItemResult) => {
    if (result === 'PASS') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (result === 'FAIL') return <XCircle className="h-4 w-4 text-red-500" />;
    if (result === 'PARTIAL') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    if (result === 'N_A') return <Minus className="h-4 w-4 text-gray-400" />;
    return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
  };

  const openReview = (review: SecurityReview) => {
    setSelectedReview(review);
    setExpandedMetric(null);
    setEditingItemId(null);
    setShowDetailModal(true);
  };

  const columns = [
    {
      key: 'testRequest',
      title: 'درخواست تست امنیت',
      render: (review: SecurityReview) => (
        <div>
          <p className="font-medium text-gray-900">{review.testRequestTitle}</p>
          <p className="font-mono text-xs text-gray-500">ID: {review.testRequestId}</p>
        </div>
      ),
    },
    {
      key: 'status',
      title: 'وضعیت',
      render: (review: SecurityReview) => (
        <Badge
          variant={review.status === 'COMPLETED'
            ? 'success'
            : review.status === 'IN_PROGRESS'
              ? 'info'
              : 'default'}
        >
          {STATUS_LABELS[review.status]}
        </Badge>
      ),
    },
    ...(shouldShowSystemColumn ? [{
      key: 'applicationId',
      title: 'سامانه',
      render: (review: SecurityReview) => (
        <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
          {getApplicationName(review.applicationId)}
        </span>
      ),
    }] : []),
    {
      key: 'progress',
      title: 'پیشرفت',
      render: (review: SecurityReview) => {
        const done = review.items.filter(item => item.result).length;
        const percent = review.items.length ? Math.round((done / review.items.length) * 100) : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full ${percent === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-xs text-gray-600">{done}/{review.items.length}</span>
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      title: 'تاریخ ارجاع',
      render: (review: SecurityReview) => formatDate(review.createdAt),
    },
    {
      key: 'actions',
      title: 'عملیات',
      render: (review: SecurityReview) => (
        <Button
          size="sm"
          variant="ghost"
          icon={<Eye className="h-4 w-4" />}
          onClick={event => {
            event.stopPropagation();
            openReview(review);
          }}
        >
          {canReview && ['PENDING', 'IN_PROGRESS', 'RETURNED_TO_SECURITY'].includes(review.status)
            ? 'بررسی'
            : 'مشاهده'}
        </Button>
      ),
    },
  ];

  const metricButton = (
    title: string,
    items: SecurityReviewDetailItem[],
    tone = 'bg-white border-gray-200'
  ) => (
    <button
      type="button"
      onClick={() => setExpandedMetric({ title, items })}
      className={`rounded-lg border p-3 text-center transition-colors hover:border-blue-400 ${tone}`}
    >
      <p className="text-xl font-bold text-gray-900">{items.length}</p>
      <p className="text-xs text-gray-600">{title}</p>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="کارتابل کارشناس امنیت"
        subtitle="چک‌لیست امنیتی به ازای هر درخواست انتخاب‌شده توسط سرپرست QA"
        onRefresh={() => selectedAppId && void loadData(selectedAppId)}
        refreshing={loading}
      />

      <main className="p-4 sm:p-6">
        {shouldSelectApplication && (
          <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <label className="mb-2 block text-sm font-medium text-indigo-800">انتخاب سامانه</label>
            <div className="flex flex-wrap gap-2">
              {applications.map(application => (
                <button
                  key={application.id}
                  onClick={() => setSelectedAppId(application.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${
                    selectedAppId === application.id
                      ? 'bg-indigo-600 text-white'
                      : 'border border-indigo-300 bg-white text-indigo-700'
                  }`}
                >
                  {application.name}
                </button>
              ))}
            </div>
            {!selectedAppId && (
              <p className="mt-2 text-sm text-indigo-600">
                برای مشاهده درخواست‌های امنیت ابتدا یک سامانه را انتخاب کنید.
              </p>
            )}
          </div>
        )}

        {(!shouldSelectApplication || selectedAppId) && (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="کل درخواست‌ها" value={reviews.length} icon={<ShieldCheck className="h-6 w-6" />} />
              <StatCard title="در انتظار بررسی" value={reviews.filter(item => item.status === 'PENDING').length} icon={<AlertTriangle className="h-6 w-6" />} variant="warning" />
              <StatCard title="در حال بررسی" value={reviews.filter(item => item.status === 'IN_PROGRESS').length} icon={<ShieldCheck className="h-6 w-6" />} variant="primary" />
              <StatCard title="تکمیل شده" value={reviews.filter(item => item.status === 'COMPLETED').length} icon={<CheckCircle className="h-6 w-6" />} variant="success" />
            </div>

            <Card className="mb-6" padding="sm">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative min-w-[240px] flex-1">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="جستجو در درخواست، نیازمندی یا تست کیس..."
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-4 pr-10 text-sm"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">همه وضعیت‌ها</option>
                  {Object.entries(STATUS_LABELS).map(([status, label]) => (
                    <option key={status} value={status}>{label}</option>
                  ))}
                </select>
              </div>
            </Card>

            <Table
              columns={columns}
              data={filtered}
              loading={loading}
              emptyMessage="درخواستی برای تست امنیت ارجاع نشده است."
              onRowClick={openReview}
              rowClassName={review =>
                review.status === 'COMPLETED'
                  ? 'bg-green-50'
                  : review.status === 'IN_PROGRESS'
                    ? 'bg-blue-50'
                    : ''
              }
              enableClientFilter={false}
              enableExport={false}
              enableColumnChooser={false}
            />
          </>
        )}
      </main>

      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={`بررسی امنیتی: ${selectedReview?.testRequestTitle || ''}`}
        size="full"
      >
        {selectedReview && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge variant={selectedReview.status === 'COMPLETED' ? 'success' : selectedReview.status === 'IN_PROGRESS' ? 'info' : 'default'}>
                {STATUS_LABELS[selectedReview.status]}
              </Badge>
              <span className="text-sm text-gray-500">
                {selectedReview.items.filter(item => item.result).length} از {selectedReview.items.length} آیتم بررسی شده
              </span>
            </div>

            <section>
              <h3 className="mb-3 font-semibold text-gray-900">مشخصات درخواست</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailField label="نام سامانه" value={selectedReview.requestSummary.applicationName} />
                <DetailField label="نیازمندی - تست کیس" value={selectedReview.requestSummary.requirementAndTestCase} />
                <DetailField label="شماره نسخه" value={selectedReview.requestSummary.version} />
                <DetailField label="شماره Build" value={selectedReview.requestSummary.buildNumber} />
                <DetailField label="نوع درخواست" value={REQUEST_TYPE_LABELS[selectedReview.requestSummary.requestType]} />
                <DetailField label="تاریخ درخواست دولوپر" value={formatDate(selectedReview.requestSummary.developerRequestedAt)} />
                <DetailField label="سرپرست فنی سامانه" value={selectedReview.requestSummary.technicalLeadName} />
                <DetailField label="برنامه‌نویس سامانه" value={selectedReview.requestSummary.developerName} />
                <DetailField label="کارشناس تست نرم‌افزار" value={selectedReview.requestSummary.qaSpecialistName} />
                <DetailField label="سرپرست تست نرم‌افزار" value={selectedReview.requestSummary.qaLeadName} />
                <DetailField label="تاریخ تأیید سرپرست" value={formatDate(selectedReview.requestSummary.qaApprovedAt)} />
              </div>
            </section>

            <section>
              <h3 className="mb-3 font-semibold text-gray-900">اطلاعات درخواست تست امنیت</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailField
                  label="نوع سامانه"
                  value={selectedReview.configuration.systemType || selectedReview.configuration.production.systemType}
                />
                <DetailField
                  label="Frontend"
                  value={selectedReview.configuration.frontend || selectedReview.configuration.production.frontend}
                />
                <DetailField
                  label="Gateway"
                  value={selectedReview.configuration.gateway || selectedReview.configuration.production.gateway}
                />
                <DetailField
                  label="Backend"
                  value={selectedReview.configuration.backend || selectedReview.configuration.production.backend}
                />
                <DetailField
                  label="Database"
                  value={selectedReview.configuration.database || selectedReview.configuration.production.database}
                />
                <DetailField
                  label="Web Server / Reverse Proxy"
                  value={selectedReview.configuration.webServer || selectedReview.configuration.production.webServer}
                />
                <DetailField
                  label="مدل ارتباط"
                  value={selectedReview.configuration.communicationModel || selectedReview.configuration.production.communicationModel}
                />
                <DetailField
                  label="نوع تست"
                  value={(selectedReview.configuration.securityTestType || selectedReview.configuration.production.testType) === 'BLACK_BOX'
                    ? 'Black Box'
                    : (selectedReview.configuration.securityTestType || selectedReview.configuration.production.testType) === 'GRAY_BOX'
                      ? 'Gray Box'
                      : '-'}
                />
                <DetailField
                  label="روش اصلی تست"
                  value={selectedReview.configuration.primaryTestMethod || selectedReview.configuration.production.primaryTestMethod}
                />
              </div>
            </section>

            <section>
              <h3 className="mb-3 font-semibold text-gray-900">آمار اجرا و خطاها</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {metricButton('تعداد تست کیس‌ها', selectedReview.requestSummary.testCases)}
                {metricButton('اجراهای نهایی', selectedReview.requestSummary.finalRuns)}
                {metricButton('اجراهای باز', selectedReview.requestSummary.openRuns)}
                {metricButton('موفق', selectedReview.requestSummary.passedRuns, 'bg-green-50 border-green-200')}
                {metricButton('ناموفق', selectedReview.requestSummary.failedRuns, 'bg-red-50 border-red-200')}
                {metricButton('مسدود', selectedReview.requestSummary.blockedRuns, 'bg-amber-50 border-amber-200')}
                {metricButton('نادیده', selectedReview.requestSummary.skippedRuns)}
                {metricButton('خطای Blocker باز', selectedReview.requestSummary.openBlockerBugs, 'bg-red-50 border-red-300')}
                {metricButton('خطای Critical باز', selectedReview.requestSummary.openCriticalBugs, 'bg-orange-50 border-orange-300')}
              </div>
              {expandedMetric && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium text-blue-900">{expandedMetric.title}</p>
                    <button className="text-xs text-blue-700" onClick={() => setExpandedMetric(null)}>بستن جزئیات</button>
                  </div>
                  {expandedMetric.items.length ? (
                    <div className="max-h-48 space-y-2 overflow-y-auto">
                      {expandedMetric.items.map(item => (
                        <div key={item.id} className="rounded border bg-white p-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{item.title}</span>
                            {item.status && <Badge size="sm">{item.status}</Badge>}
                          </div>
                          {item.subtitle && <p className="mt-1 text-xs text-gray-500">{item.subtitle}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">موردی وجود ندارد.</p>
                  )}
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-3 font-semibold text-gray-900">اطلاعات محیط و دسترسی</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailField label="محیط مورد تست" value={ENVIRONMENT_LABELS[selectedReview.configuration.environment as keyof typeof ENVIRONMENT_LABELS] || selectedReview.configuration.environment} />
                <DetailField label="URL اصلی" value={selectedReview.configuration.primaryUrl} />
                <DetailField label="URLهای فرعی" value={selectedReview.configuration.secondaryUrls} />
                <DetailField label="وضعیت دسترسی" value={selectedReview.configuration.accessStatus} />
                <DetailField label="نیاز به VPN" value={selectedReview.configuration.vpnRequired === 'YES' ? 'بله' : 'خیر'} />
                <DetailField label="نیاز به IP Whitelist" value={selectedReview.configuration.ipWhitelistRequired === 'YES' ? 'بله' : 'خیر'} />
                <DetailField label="ساعات مجاز تست" value={selectedReview.configuration.allowedTestHours} />
                <DetailField label="شروع دسترسی" value={formatDate(selectedReview.configuration.accessStartAt)} />
                <DetailField label="پایان دسترسی" value={formatDate(selectedReview.configuration.accessEndAt)} />
                <DetailField label="پایداری محیط" value={selectedReview.configuration.environmentStability} />
                <DetailField label="مسئول پشتیبانی محیط" value={selectedReview.configuration.environmentSupportContact} />
                <DetailField label="تماس اضطراری توقف تست" value={selectedReview.configuration.emergencyStopContact} />
              </div>
            </section>

            <section>
              <h3 className="mb-3 font-semibold text-gray-900">اطلاعات احراز هویت</h3>
              <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                رمز عبور در این فرم نگهداری نمی‌شود. دریافت رمز فقط از روش امن ثبت‌شده انجام شود.
              </div>
              {selectedReview.configuration.environment === 'DEVELOPMENT' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <DetailField label="URL Development" value={selectedReview.configuration.development.url} />
                  <DetailField label="روش ورود" value="نام کاربری و رمز عبور محلی" />
                  <DetailField label="شناسه ورود" value={selectedReview.configuration.development.loginIdentifier} />
                  <DetailField label="حساب‌های تست" value={selectedReview.configuration.development.testAccounts} />
                  <DetailField label="نقش حساب‌ها" value={selectedReview.configuration.development.accountRoles} />
                  <DetailField label="انقضای حساب" value={formatDate(selectedReview.configuration.development.accountExpiresAt)} />
                  <DetailField label="روش تحویل رمز" value={selectedReview.configuration.development.passwordDeliveryMethod} />
                  <DetailField label="امکان Reset" value={selectedReview.configuration.development.accountResetAvailable === 'YES' ? 'بله' : 'خیر'} />
                  <DetailField label="مسئول Reset" value={selectedReview.configuration.development.accountResetContact} />
                </div>
              )}
              {selectedReview.configuration.environment === 'TEST' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <DetailField label="URL Test" value={selectedReview.configuration.test.url} />
                  <DetailField label="روش ورود" value="SSO" />
                  <DetailField label="SSO Provider" value={selectedReview.configuration.test.ssoProvider} />
                  <DetailField label="پروتکل" value={selectedReview.configuration.test.protocol} />
                  <DetailField label="حساب‌های تست SSO" value={selectedReview.configuration.test.ssoTestAccounts} />
                  <DetailField label="نقش حساب‌ها" value={selectedReview.configuration.test.accountRoles} />
                  <DetailField label="Tenant" value={selectedReview.configuration.test.tenant} />
                  <DetailField label="وضعیت MFA" value={selectedReview.configuration.test.mfaStatus} />
                  <DetailField label="Callback Domain" value={selectedReview.configuration.test.callbackDomain} />
                  <DetailField label="Redirect Domain" value={selectedReview.configuration.test.redirectDomain} />
                  <DetailField label="مدت Session" value={`${selectedReview.configuration.test.sessionDurationMinutes} دقیقه`} />
                  <DetailField label="رفتار Logout" value={selectedReview.configuration.test.logoutBehavior} />
                  <DetailField label="انقضای حساب" value={formatDate(selectedReview.configuration.test.accountExpiresAt)} />
                  <DetailField label="محدودیت SSO" value={selectedReview.configuration.test.knownSsoLimitations} />
                </div>
              )}
              {selectedReview.configuration.environment === 'PRODUCTION' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {Object.entries({
                    'URL Production': selectedReview.configuration.production.url,
                    'روش ورود': 'Government Gateway SSO',
                    'حساب تست کنترل‌شده': selectedReview.configuration.production.controlledTestAccount,
                    'مالک حساب تست': selectedReview.configuration.production.testAccountOwner,
                    'نقش حساب': selectedReview.configuration.production.accountRole,
                    'مجوز مالک کسب‌وکار': selectedReview.configuration.production.businessOwnerPermission,
                    'مجوز مسئول فنی': selectedReview.configuration.production.technicalOwnerPermission,
                    'مجوز مالک Production': selectedReview.configuration.production.productionOwnerPermission,
                    'مجوز تیم امنیت': selectedReview.configuration.production.securityTeamPermission,
                    'زمان مجاز تست': formatDate(selectedReview.configuration.production.authorizedTestDateTime),
                    'تماس اضطراری': selectedReview.configuration.production.emergencyContact,
                    'تأیید Monitoring': selectedReview.configuration.production.monitoringConfirmed,
                    'تأیید Backup/Rollback': selectedReview.configuration.production.backupOrRollbackConfirmed,
                    'محدودیت اسکن خودکار': selectedReview.configuration.production.automatedScanRestriction,
                    'محدودیت تغییر داده': selectedReview.configuration.production.dataChangeRestriction,
                    'محدودیت حذف داده': selectedReview.configuration.production.dataDeletionRestriction,
                    'شرط توقف تست': selectedReview.configuration.production.stopCondition,
                  }).map(([label, fieldValue]) => (
                    <DetailField key={label} label={label} value={fieldValue} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-3 font-semibold text-gray-900">چک‌لیست امنیت</h3>
              <div className="space-y-3">
                {selectedReview.items.map((item, index) => (
                  <div key={item.id} className={`rounded-lg border p-4 ${
                    item.result === 'PASS'
                      ? 'border-green-200 bg-green-50'
                      : item.result === 'FAIL'
                        ? 'border-red-200 bg-red-50'
                        : item.result === 'PARTIAL'
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-gray-200 bg-white'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3">
                        <span className="text-sm text-gray-400">{index + 1}.</span>
                        <div>
                          <p className="font-medium text-gray-900">{item.title}</p>
                          <p className="mt-1 text-sm text-gray-500">{item.description}</p>
                          {item.notes && <p className="mt-2 rounded border bg-white p-2 text-sm">یادداشت: {item.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getResultIcon(item.result)}
                        {item.result && <span className="text-xs">{RESULT_LABELS[item.result]}</span>}
                      </div>
                    </div>

                    {canEditChecklist && editingItemId === item.id && (
                      <div className="mt-3 space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <Select
                          label="نتیجه بررسی *"
                          value={editResult}
                          onChange={event => setEditResult(event.target.value as SecurityReviewItemResult)}
                          options={Object.entries(RESULT_LABELS).map(([result, label]) => ({ value: result, label }))}
                          placeholder="انتخاب کنید"
                        />
                        <Textarea
                          label="یادداشت"
                          value={editNotes}
                          onChange={event => setEditNotes(event.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setEditingItemId(null)}>انصراف</Button>
                          <Button size="sm" onClick={handleSaveItem} loading={actionLoading} disabled={!editResult}>ذخیره</Button>
                        </div>
                      </div>
                    )}

                    {canEditChecklist && editingItemId !== item.id && (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingItemId(item.id);
                            setEditResult(item.result || '');
                            setEditNotes(item.notes || '');
                          }}
                        >
                          {item.result ? 'ویرایش نتیجه' : 'ثبت نتیجه'}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
                <Paperclip className="h-5 w-5 text-blue-600" />
                مستندات تست امنیت
              </h3>
              <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50 p-4">
                <p className="text-sm text-blue-900">
                  حداقل یک مستند برای تکمیل چک‌لیست لازم است. حداکثر حجم هر فایل ۱۰ مگابایت است.
                </p>
                {canEditChecklist && (
                  <div className="mt-3">
                    <label
                      htmlFor="security-evidence-upload"
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
                        uploadLoading ? 'pointer-events-none opacity-60' : ''
                      }`}
                    >
                      <Upload className="h-4 w-4" />
                      {uploadLoading ? 'در حال آپلود...' : 'آپلود مستند'}
                    </label>
                    <input
                      id="security-evidence-upload"
                      type="file"
                      className="sr-only"
                      disabled={uploadLoading}
                      onChange={event => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        void handleEvidenceUpload(file);
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {selectedReview.attachments
                  .filter(attachment => selectedReview.securityEvidenceAttachmentIds.includes(attachment.id))
                  .map(attachment => (
                    <div
                      key={attachment.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{attachment.fileName}</p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(attachment.fileSize)} · {attachment.uploadedBy?.fullName || '-'} · {formatDate(attachment.createdAt)}
                        </p>
                      </div>
                      <Badge size="sm" variant="info">مستند امنیت</Badge>
                      <a
                        href={attachment.storagePath}
                        download={attachment.fileName}
                        className="text-sm font-medium text-blue-700 hover:underline"
                      >
                        دانلود
                      </a>
                    </div>
                  ))}
                {!selectedReview.securityEvidenceAttachmentIds.length && (
                  <p className="text-sm text-gray-500">هنوز مستندی آپلود نشده است.</p>
                )}
              </div>
            </section>

            <div className="flex justify-end gap-3 border-t pt-4">
              {canEditChecklist && (
                <Button
                  icon={<CheckCircle className="h-4 w-4" />}
                  onClick={handleComplete}
                  loading={actionLoading}
                  disabled={
                    selectedReview.items.some(item => !item.result) ||
                    !selectedReview.securityEvidenceAttachmentIds.length
                  }
                >
                  تکمیل چک‌لیست و ارسال نتیجه
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
