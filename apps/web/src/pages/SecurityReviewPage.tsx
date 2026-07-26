import { useEffect, useState } from 'react';
import {
  CheckCircle,
  Eye,
  FileText,
  History,
  Paperclip,
  ShieldAlert,
  Upload,
  UserCheck,
  Wrench,
  XCircle,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { toast } from '../components/ui/Toast';
import { applicationApi, securityChecklistApi, userApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type {
  SecurityReview,
  SecurityReviewHistoryAction,
  SecurityReviewItemResult,
  SecurityReviewStatus,
  User,
} from '../types';
import { formatJalaliDateTime } from '../utils/jalaliDate';
import { useApplicationLookup } from '../utils/useApplicationLookup';
import { useDataScope } from '../utils/useDataScope';

const MAX_SECURITY_FILE_SIZE = 10 * 1024 * 1024;

const STATUS_LABELS: Record<SecurityReviewStatus, string> = {
  PENDING: 'در انتظار بررسی امنیت',
  IN_PROGRESS: 'در حال بررسی امنیت',
  NEEDS_QA_REVIEW: 'در انتظار بررسی سرپرست QA',
  ASSIGNED_TO_QA: 'ارجاع‌شده به متخصص QA',
  DEVELOPER_FIX: 'در انتظار رفع برنامه‌نویس',
  FIXED_PENDING_QA: 'در انتظار گزارش متخصص QA',
  QA_REPORT_REVIEW: 'در انتظار تأیید گزارش QA',
  RETURNED_TO_SECURITY: 'بازگشت به تیم امنیت',
  COMPLETED: 'تأیید امنیت و ارسال به سرپرست فنی',
};

const RESULT_LABELS: Record<SecurityReviewItemResult, string> = {
  PASS: 'قبول',
  FAIL: 'رد',
  PARTIAL: 'ناقص',
  N_A: 'غیرقابل اعمال',
};

const HISTORY_LABELS: Record<SecurityReviewHistoryAction, string> = {
  CREATED: 'ایجاد درخواست امنیت',
  ITEM_UPDATED: 'تغییر نتیجه چک‌لیست',
  FILE_UPLOADED: 'آپلود فایل',
  SUBMITTED_TO_TECH_LEAD: 'ارسال به سرپرست فنی',
  SUBMITTED_TO_QA_LEAD: 'ارسال موارد امنیتی به سرپرست QA',
  ASSIGNED_TO_QA_SPECIALIST: 'ارجاع به متخصص QA',
  RETURNED_TO_SECURITY: 'بازگشت به تیم امنیت',
  SECURITY_EXECUTION_CREATED: 'ایجاد اجرای امنیتی',
  DEVELOPER_FIXED: 'ثبت رفع مشکلات توسط برنامه‌نویس',
  QA_REPORT_SUBMITTED: 'ارسال گزارش متخصص QA',
  QA_REPORT_APPROVED: 'تأیید گزارش توسط سرپرست QA',
  QA_REPORT_REJECTED: 'بازگشت گزارش به متخصص QA',
};

const statusVariant = (status: SecurityReviewStatus) => {
  if (status === 'COMPLETED') return 'success' as const;
  if (['NEEDS_QA_REVIEW', 'RETURNED_TO_SECURITY', 'FIXED_PENDING_QA', 'QA_REPORT_REVIEW'].includes(status)) {
    return 'warning' as const;
  }
  if (status === 'DEVELOPER_FIX') return 'danger' as const;
  return 'info' as const;
};

const formatDate = (value?: string) => value ? formatJalaliDateTime(value) : '-';

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

export const SecurityReviewPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { defaultApplicationId, scopeApplicationIds, isAppLevel, isMultiSystem } = useDataScope();
  const { shouldShowSystemColumn, getApplicationName } = useApplicationLookup();
  const [selectedAppId, setSelectedAppId] = useState('');
  const [applications, setApplications] = useState<Array<{ id: string; name: string }>>([]);
  const [reviews, setReviews] = useState<SecurityReview[]>([]);
  const [selectedReview, setSelectedReview] = useState<SecurityReview | null>(null);
  const [qaSpecialists, setQaSpecialists] = useState<User[]>([]);
  const [developers, setDevelopers] = useState<User[]>([]);
  const [qaSpecialistId, setQaSpecialistId] = useState('');
  const [developerId, setDeveloperId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const shouldSelectApplication = isAppLevel || isMultiSystem;
  const role = activeContext?.role;

  useEffect(() => {
    if (!activeContext) return;
    if (shouldSelectApplication) {
      setSelectedAppId('');
      setReviews([]);
      applicationApi.getAll()
        .then(data => setApplications(data
          .filter(application =>
            application.isActive &&
            (isAppLevel || scopeApplicationIds.includes(application.id))
          )
          .map(application => ({ id: application.id, name: application.name }))))
        .catch(() => {
          setApplications([]);
          toast.error('خطا در بارگذاری سامانه‌ها.');
        });
    } else {
      setSelectedAppId(defaultApplicationId);
    }
  }, [
    activeContext,
    defaultApplicationId,
    isAppLevel,
    scopeApplicationIds.join('|'),
    shouldSelectApplication,
  ]);

  useEffect(() => {
    if (!selectedAppId || !activeContext) return;
    void loadData(selectedAppId);
    void Promise.all([
      userApi.getQASpecialists(selectedAppId),
      userApi.getDevelopers(selectedAppId),
    ]).then(([specialists, appDevelopers]) => {
      setQaSpecialists(specialists);
      setDevelopers(appDevelopers);
    }).catch(() => {
      setQaSpecialists([]);
      setDevelopers([]);
    });
  }, [selectedAppId, activeContext]);

  const loadData = async (applicationId: string) => {
    if (!activeContext) return;
    setLoading(true);
    try {
      const data = await securityChecklistApi.getFollowUpsForApp(
        applicationId,
        activeContext.userId,
        activeContext.role
      );
      setReviews(data as SecurityReview[]);
      setSelectedReview(current => {
        if (!current) return null;
        return (data as SecurityReview[]).find(item => item.id === current.id) || current;
      });
    } catch {
      setReviews([]);
      toast.error('خطا در بارگذاری کارتابل بررسی امنیت.');
    } finally {
      setLoading(false);
    }
  };

  const openReview = (review: SecurityReview) => {
    setSelectedReview(review);
    setQaSpecialistId(review.assignedQASpecialistId || review.requestSummary.qaSpecialistId || '');
    setDeveloperId(review.requestSummary.developerId || '');
    setNotes('');
    setShowDetail(true);
  };

  const applyUpdatedReview = async (updated: SecurityReview | null, successMessage: string) => {
    if (!updated) {
      toast.error('این اقدام در وضعیت فعلی مجاز نیست.');
      return;
    }
    setSelectedReview(updated);
    toast.success(successMessage);
    await loadData(selectedAppId);
  };

  const requireNotes = () => {
    if (notes.trim()) return true;
    toast.warning('ثبت توضیح برای این اقدام الزامی است.');
    return false;
  };

  const handleQaLeadDecision = async (decision: 'ASSIGN_QA' | 'RETURN_SECURITY') => {
    if (!selectedReview || !activeContext || !requireNotes()) return;
    if (decision === 'ASSIGN_QA' && !qaSpecialistId) {
      toast.warning('متخصص QA را انتخاب کنید.');
      return;
    }
    setActionLoading(true);
    try {
      const updated = await securityChecklistApi.qaLeadReview(
        selectedReview.id,
        decision,
        notes,
        activeContext.userId,
        qaSpecialistId || undefined
      );
      await applyUpdatedReview(
        updated as SecurityReview | null,
        decision === 'ASSIGN_QA'
          ? 'بررسی به متخصص QA ارجاع شد.'
          : 'بررسی برای اصلاح به تیم امنیت بازگردانده شد.'
      );
      setNotes('');
    } catch {
      toast.error('ثبت تصمیم سرپرست QA ناموفق بود.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateExecution = async () => {
    if (!selectedReview || !activeContext || !requireNotes()) return;
    if (!developerId) {
      toast.warning('برنامه‌نویس را انتخاب کنید.');
      return;
    }
    setActionLoading(true);
    try {
      const updated = await securityChecklistApi.createSecurityExecution(
        selectedReview.id,
        notes,
        developerId,
        activeContext.userId
      );
      await applyUpdatedReview(updated as SecurityReview | null, 'اجرای امنیتی ایجاد و به برنامه‌نویس ارجاع شد.');
      setNotes('');
    } catch {
      toast.error('ایجاد اجرای امنیتی ناموفق بود.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeveloperFixed = async () => {
    if (!selectedReview || !activeContext || !requireNotes()) return;
    const execution = selectedReview.securityExecutions.find(item =>
      item.status === 'ASSIGNED_TO_DEVELOPER' &&
      (item.developerId === activeContext.userId || role === 'SYSTEM_ADMIN')
    );
    if (!execution) {
      toast.error('اجرای امنیتی فعالی برای شما وجود ندارد.');
      return;
    }
    setActionLoading(true);
    try {
      const updated = await securityChecklistApi.resolveSecurityExecution(
        selectedReview.id,
        execution.id,
        notes,
        activeContext.userId
      );
      await applyUpdatedReview(updated as SecurityReview | null, 'رفع مشکلات ثبت و برای متخصص QA ارسال شد.');
      setNotes('');
    } catch {
      toast.error('ثبت رفع مشکلات ناموفق بود.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFileUpload = async (
    file: File | undefined,
    kind: 'SECURITY_EVIDENCE' | 'QA_REPORT'
  ) => {
    if (!file || !selectedReview || !activeContext) return;
    if (file.size <= 0 || file.size > MAX_SECURITY_FILE_SIZE) {
      toast.error('فایل باید غیرخالی و حداکثر ۱۰ مگابایت باشد.');
      return;
    }
    setUploadLoading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const updated = await securityChecklistApi.uploadEvidence(
        selectedReview.id,
        { name: file.name, size: file.size, type: file.type, dataUrl },
        kind,
        activeContext.userId
      );
      await applyUpdatedReview(
        updated as SecurityReview | null,
        kind === 'QA_REPORT' ? 'گزارش QA آپلود شد.' : 'مستند امنیت آپلود شد.'
      );
    } catch {
      toast.error('آپلود فایل ناموفق بود. سقف مجاز هر فایل ۱۰ مگابایت است.');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSubmitQaReport = async () => {
    if (!selectedReview || !activeContext || !requireNotes()) return;
    if (!selectedReview.qaReportAttachmentIds.length) {
      toast.warning('ابتدا فایل گزارش QA را آپلود کنید.');
      return;
    }
    setActionLoading(true);
    try {
      const updated = await securityChecklistApi.submitQaReport(
        selectedReview.id,
        notes,
        activeContext.userId
      );
      await applyUpdatedReview(updated as SecurityReview | null, 'گزارش برای بررسی سرپرست QA ارسال شد.');
      setNotes('');
    } catch {
      toast.error('ارسال گزارش QA ناموفق بود.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQaReportDecision = async (approved: boolean) => {
    if (!selectedReview || !activeContext || !requireNotes()) return;
    setActionLoading(true);
    try {
      const updated = await securityChecklistApi.reviewQaReport(
        selectedReview.id,
        approved,
        notes,
        activeContext.userId
      );
      await applyUpdatedReview(
        updated as SecurityReview | null,
        approved
          ? 'گزارش تأیید و برای بازبینی مجدد به تیم امنیت ارسال شد.'
          : 'گزارش برای اصلاح به متخصص QA بازگردانده شد.'
      );
      setNotes('');
    } catch {
      toast.error('ثبت نتیجه بررسی گزارش ناموفق بود.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSecurityResult = async (itemId: string, result: SecurityReviewItemResult) => {
    if (!selectedReview || !activeContext) return;
    setActionLoading(true);
    try {
      const item = selectedReview.items.find(entry => entry.id === itemId);
      const updated = await securityChecklistApi.updateItem(
        selectedReview.id,
        itemId,
        result,
        item?.notes || '',
        activeContext.userId
      );
      if (updated) setSelectedReview(updated as SecurityReview);
    } catch {
      toast.error('ثبت نتیجه چک‌لیست ناموفق بود.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSecurityResubmit = async () => {
    if (!selectedReview || !activeContext) return;
    if (selectedReview.items.some(item => !item.result)) {
      toast.warning('نتیجه همه آیتم‌ها را تکمیل کنید.');
      return;
    }
    setActionLoading(true);
    try {
      const updated = await securityChecklistApi.complete(
        selectedReview.id,
        activeContext.userId,
        notes
      );
      const review = updated as SecurityReview | null;
      await applyUpdatedReview(
        review,
        review?.status === 'COMPLETED'
          ? 'بررسی امنیت تأیید و برای تصمیم فنی ارسال شد.'
          : 'موارد باقی‌مانده برای بررسی سرپرست QA ارسال شد.'
      );
      setNotes('');
    } catch {
      toast.error('ارسال مجدد نتیجه امنیت ناموفق بود.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!activeContext) return null;

  const securityEvidence = selectedReview?.attachments.filter(item =>
    selectedReview.securityEvidenceAttachmentIds.includes(item.id)
  ) || [];
  const qaReports = selectedReview?.attachments.filter(item =>
    selectedReview.qaReportAttachmentIds.includes(item.id)
  ) || [];

  const columns = [
    {
      key: 'title',
      title: 'درخواست',
      render: (review: SecurityReview) => (
        <div>
          <p className="font-medium text-gray-900">{review.testRequestTitle}</p>
          <p className="text-xs text-gray-500">{review.requestSummary.version} / Build {review.requestSummary.buildNumber}</p>
        </div>
      ),
    },
    {
      key: 'status',
      title: 'مرحله',
      render: (review: SecurityReview) => (
        <Badge variant={statusVariant(review.status)}>{STATUS_LABELS[review.status]}</Badge>
      ),
    },
    ...(shouldShowSystemColumn ? [{
      key: 'application',
      title: 'سامانه',
      render: (review: SecurityReview) => getApplicationName(review.applicationId),
    }] : []),
    {
      key: 'updatedAt',
      title: 'آخرین تغییر',
      render: (review: SecurityReview) => formatDate(review.updatedAt),
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
          مشاهده و اقدام
        </Button>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="بررسی امنیت"
        subtitle="پیگیری موارد رد یا ناقص، اجرای امنیتی، رفع برنامه‌نویس و بازبینی مجدد"
        onRefresh={() => selectedAppId && void loadData(selectedAppId)}
        refreshing={loading}
      />

      <main className="p-4 sm:p-6">
        {shouldSelectApplication && (
          <Card className="mb-6" padding="sm">
            <p className="mb-3 text-sm font-medium text-gray-700">سامانه را انتخاب کنید</p>
            <div className="flex flex-wrap gap-2">
              {applications.map(application => (
                <Button
                  key={application.id}
                  size="sm"
                  variant={selectedAppId === application.id ? 'primary' : 'outline'}
                  onClick={() => setSelectedAppId(application.id)}
                >
                  {application.name}
                </Button>
              ))}
            </div>
          </Card>
        )}

        {selectedAppId && (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="کل پرونده‌ها" value={reviews.length} icon={<ShieldAlert className="h-6 w-6" />} />
              <StatCard title="منتظر QA Lead" value={reviews.filter(item => ['NEEDS_QA_REVIEW', 'QA_REPORT_REVIEW'].includes(item.status)).length} icon={<UserCheck className="h-6 w-6" />} variant="warning" />
              <StatCard title="در حال رفع" value={reviews.filter(item => ['ASSIGNED_TO_QA', 'DEVELOPER_FIX', 'FIXED_PENDING_QA'].includes(item.status)).length} icon={<Wrench className="h-6 w-6" />} variant="primary" />
              <StatCard title="تکمیل‌شده" value={reviews.filter(item => item.status === 'COMPLETED').length} icon={<CheckCircle className="h-6 w-6" />} variant="success" />
            </div>
            <Table
              columns={columns}
              data={reviews}
              loading={loading}
              emptyMessage="پرونده‌ای برای بررسی امنیت وجود ندارد."
              onRowClick={openReview}
              enableClientFilter
              enableExport={false}
              enableColumnChooser={false}
            />
          </>
        )}
      </main>

      <Modal
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        title={`بررسی امنیت: ${selectedReview?.testRequestTitle || ''}`}
        size="full"
      >
        {selectedReview && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge variant={statusVariant(selectedReview.status)}>
                {STATUS_LABELS[selectedReview.status]}
              </Badge>
              <span className="text-sm text-gray-500">
                آخرین تغییر: {formatDate(selectedReview.updatedAt)}
              </span>
            </div>

            {selectedReview.lastActionNotes && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <strong>آخرین توضیح:</strong> {selectedReview.lastActionNotes}
              </div>
            )}

            <section>
              <h3 className="mb-3 font-semibold text-gray-900">خلاصه درخواست</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['سامانه', selectedReview.requestSummary.applicationName],
                  ['نسخه', selectedReview.requestSummary.version],
                  ['Build', selectedReview.requestSummary.buildNumber],
                  ['برنامه‌نویس', selectedReview.requestSummary.developerName],
                  ['متخصص QA', selectedReview.requestSummary.qaSpecialistName],
                  ['سرپرست QA', selectedReview.requestSummary.qaLeadName],
                  ['تعداد تست‌کیس', String(selectedReview.requestSummary.testCases.length)],
                  ['خطاهای Blocker/Critical باز', String(
                    selectedReview.requestSummary.openBlockerBugs.length +
                    selectedReview.requestSummary.openCriticalBugs.length
                  )],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{value || '-'}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 font-semibold text-gray-900">چک‌لیست امنیت</h3>
              <div className="space-y-2">
                {selectedReview.items.map(item => (
                  <div key={item.id} className="rounded-lg border bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">{item.title}</p>
                        <p className="mt-1 text-sm text-gray-500">{item.description}</p>
                        {item.notes && <p className="mt-2 text-sm text-gray-700">یادداشت: {item.notes}</p>}
                      </div>
                      {role === 'SECURITY_REVIEWER' && selectedReview.status === 'RETURNED_TO_SECURITY' ? (
                        <select
                          value={item.result || ''}
                          disabled={actionLoading}
                          onChange={event => void handleSecurityResult(
                            item.id,
                            event.target.value as SecurityReviewItemResult
                          )}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="" disabled>انتخاب نتیجه</option>
                          {Object.entries(RESULT_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge variant={
                          item.result === 'PASS' || item.result === 'N_A'
                            ? 'success'
                            : item.result === 'FAIL'
                              ? 'danger'
                              : 'warning'
                        }>
                          {item.result ? RESULT_LABELS[item.result] : 'بدون نتیجه'}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
                <Paperclip className="h-5 w-5" />
                فایل‌ها
              </h3>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="mb-2 font-medium text-gray-800">مستندات تیم امنیت</p>
                  {securityEvidence.length ? securityEvidence.map(file => (
                    <div key={file.id} className="mb-2 rounded bg-gray-50 p-2 text-sm">
                      <p className="font-medium">{file.fileName}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.fileSize)} · {file.uploadedBy?.fullName || '-'}</p>
                      <a
                        href={file.storagePath}
                        download={file.fileName}
                        className="mt-1 inline-block text-xs font-medium text-blue-700 hover:underline"
                      >
                        دانلود فایل
                      </a>
                    </div>
                  )) : <p className="text-sm text-gray-500">فایلی ثبت نشده است.</p>}
                </div>
                <div className="rounded-lg border p-3">
                  <p className="mb-2 font-medium text-gray-800">گزارش‌های متخصص QA</p>
                  {qaReports.length ? qaReports.map(file => (
                    <div key={file.id} className="mb-2 rounded bg-gray-50 p-2 text-sm">
                      <p className="font-medium">{file.fileName}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.fileSize)} · {file.uploadedBy?.fullName || '-'}</p>
                      <a
                        href={file.storagePath}
                        download={file.fileName}
                        className="mt-1 inline-block text-xs font-medium text-blue-700 hover:underline"
                      >
                        دانلود فایل
                      </a>
                    </div>
                  )) : <p className="text-sm text-gray-500">فایلی ثبت نشده است.</p>}
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
                <Wrench className="h-5 w-5" />
                اجراهای امنیتی
              </h3>
              {selectedReview.securityExecutions.length ? (
                <div className="space-y-3">
                  {selectedReview.securityExecutions.map(execution => (
                    <div key={execution.id} className="rounded-lg border bg-gray-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{execution.title}</p>
                        <Badge variant={execution.status === 'FIXED' ? 'success' : 'warning'}>
                          {execution.status === 'FIXED' ? 'رفع‌شده' : 'در انتظار برنامه‌نویس'}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-gray-700">{execution.description}</p>
                      <p className="mt-1 text-xs text-gray-500">برنامه‌نویس: {execution.developerName}</p>
                      {execution.resolution && (
                        <p className="mt-2 rounded border border-green-200 bg-green-50 p-2 text-sm text-green-900">
                          نتیجه رفع: {execution.resolution}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">هنوز اجرای امنیتی تعریف نشده است.</p>
              )}
            </section>

            <section>
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
                <History className="h-5 w-5" />
                تاریخچه قابل ردیابی
              </h3>
              <div className="space-y-2">
                {selectedReview.history.map(entry => (
                  <div key={entry.id} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-gray-900">{HISTORY_LABELS[entry.action]}</p>
                      <span className="text-xs text-gray-500">{formatDate(entry.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      اقدام‌کننده: {entry.actorName} · وضعیت: {STATUS_LABELS[entry.toStatus]}
                    </p>
                    {entry.notes && <p className="mt-2 text-sm text-gray-700">{entry.notes}</p>}
                  </div>
                ))}
              </div>
            </section>

            {role === 'QA_LEAD' && selectedReview.status === 'NEEDS_QA_REVIEW' && (
              <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <h3 className="mb-3 font-semibold text-blue-900">تصمیم سرپرست QA</h3>
                <Select
                  label="متخصص QA"
                  value={qaSpecialistId}
                  onChange={event => setQaSpecialistId(event.target.value)}
                  options={qaSpecialists.map(user => ({ value: user.id, label: user.fullName }))}
                  placeholder="انتخاب متخصص QA"
                />
                <Textarea
                  className="mt-3"
                  label="توضیح اجباری"
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                />
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button
                    variant="danger"
                    icon={<XCircle className="h-4 w-4" />}
                    loading={actionLoading}
                    onClick={() => void handleQaLeadDecision('RETURN_SECURITY')}
                  >
                    رد و بازگشت به تیم امنیت
                  </Button>
                  <Button
                    icon={<UserCheck className="h-4 w-4" />}
                    loading={actionLoading}
                    onClick={() => void handleQaLeadDecision('ASSIGN_QA')}
                  >
                    ارجاع به متخصص QA
                  </Button>
                </div>
              </section>
            )}

            {role === 'QA_SPECIALIST' && selectedReview.status === 'ASSIGNED_TO_QA' && (
              <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <h3 className="mb-3 font-semibold text-blue-900">تعریف اجرای امنیتی</h3>
                <Select
                  label="برنامه‌نویس"
                  value={developerId}
                  onChange={event => setDeveloperId(event.target.value)}
                  options={developers.map(user => ({ value: user.id, label: user.fullName }))}
                  placeholder="انتخاب برنامه‌نویس"
                />
                <Textarea
                  className="mt-3"
                  label="شرح مشکلات و اقدامات موردنیاز"
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    icon={<Wrench className="h-4 w-4" />}
                    loading={actionLoading}
                    onClick={() => void handleCreateExecution()}
                  >
                    ایجاد اجرای امنیتی و ارجاع
                  </Button>
                </div>
              </section>
            )}

            {role === 'DEVELOPER' && selectedReview.status === 'DEVELOPER_FIX' && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="mb-3 font-semibold text-amber-900">ثبت رفع مشکلات امنیتی</h3>
                <Textarea
                  label="شرح رفع انجام‌شده"
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    icon={<CheckCircle className="h-4 w-4" />}
                    loading={actionLoading}
                    onClick={() => void handleDeveloperFixed()}
                  >
                    ثبت رفع و ارسال به متخصص QA
                  </Button>
                </div>
              </section>
            )}

            {role === 'QA_SPECIALIST' && selectedReview.status === 'FIXED_PENDING_QA' && (
              <section className="rounded-xl border border-green-200 bg-green-50 p-4">
                <h3 className="mb-3 font-semibold text-green-900">ارسال گزارش بررسی رفع</h3>
                <label
                  htmlFor="qa-security-report"
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white ${
                    uploadLoading ? 'pointer-events-none opacity-60' : ''
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  {uploadLoading ? 'در حال آپلود...' : 'آپلود فایل گزارش (حداکثر ۱۰ مگابایت)'}
                </label>
                <input
                  id="qa-security-report"
                  type="file"
                  className="sr-only"
                  disabled={uploadLoading}
                  onChange={event => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    void handleFileUpload(file, 'QA_REPORT');
                  }}
                />
                <Textarea
                  className="mt-3"
                  label="توضیح گزارش"
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    icon={<FileText className="h-4 w-4" />}
                    loading={actionLoading}
                    disabled={!selectedReview.qaReportAttachmentIds.length}
                    onClick={() => void handleSubmitQaReport()}
                  >
                    ارسال گزارش به سرپرست QA
                  </Button>
                </div>
              </section>
            )}

            {role === 'QA_LEAD' && selectedReview.status === 'QA_REPORT_REVIEW' && (
              <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <h3 className="mb-3 font-semibold text-blue-900">بررسی گزارش متخصص QA</h3>
                <Textarea
                  label="توضیح اجباری"
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                />
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button
                    variant="warning"
                    loading={actionLoading}
                    onClick={() => void handleQaReportDecision(false)}
                  >
                    بازگشت گزارش به متخصص QA
                  </Button>
                  <Button
                    icon={<CheckCircle className="h-4 w-4" />}
                    loading={actionLoading}
                    onClick={() => void handleQaReportDecision(true)}
                  >
                    تأیید و ارجاع به تیم امنیت
                  </Button>
                </div>
              </section>
            )}

            {role === 'SECURITY_REVIEWER' && selectedReview.status === 'RETURNED_TO_SECURITY' && (
              <section className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                <h3 className="mb-3 font-semibold text-purple-900">بازبینی مجدد تیم امنیت</h3>
                <p className="mb-3 text-sm text-purple-800">
                  نتایج چک‌لیست را اصلاح کنید، در صورت نیاز مستند جدید بفرستید و نتیجه را دوباره ثبت کنید.
                </p>
                <label
                  htmlFor="security-follow-up-evidence"
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white ${
                    uploadLoading ? 'pointer-events-none opacity-60' : ''
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  {uploadLoading ? 'در حال آپلود...' : 'آپلود مستند جدید (حداکثر ۱۰ مگابایت)'}
                </label>
                <input
                  id="security-follow-up-evidence"
                  type="file"
                  className="sr-only"
                  disabled={uploadLoading}
                  onChange={event => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    void handleFileUpload(file, 'SECURITY_EVIDENCE');
                  }}
                />
                <Textarea
                  className="mt-3"
                  label="توضیح بازبینی"
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    icon={<ShieldAlert className="h-4 w-4" />}
                    loading={actionLoading}
                    onClick={() => void handleSecurityResubmit()}
                  >
                    ثبت نتیجه بازبینی امنیت
                  </Button>
                </div>
              </section>
            )}

            <div className="flex justify-end border-t pt-4">
              <Button variant="secondary" onClick={() => setShowDetail(false)}>بستن</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
