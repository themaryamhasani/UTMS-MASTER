import { useEffect, useState } from 'react';
import { Activity, Bell, Fingerprint, History, RefreshCw, RotateCcw } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { Table, Pagination } from '../components/ui/Table';
import { CartableSearchInput } from '../components/ui/CartableToolbar';
import { Badge } from '../components/ui/Badge';
import { useAuthStore } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import { auditLogApi, commandTraceApi, notificationApi } from '../services/api';
import { formatDisplayId } from '../utils/displayId';
import type {
  AuditLog,
  CartableFilterParams,
  CommandTrace,
  NotificationOutboxItem,
  PaginatedResponse,
} from '../types';

type OperationsTab = 'commands' | 'outbox' | 'audit';

const TRACE_STATUS_LABELS: Record<CommandTrace['status'], string> = {
  COMPLETED: 'تکمیل شده',
  REPLAYED: 'تکراری پذیرفته شده',
};

const DELIVERY_STATUS_LABELS: Record<NotificationOutboxItem['status'], string> = {
  QUEUED: 'در صف',
  DELIVERED: 'تحویل شده',
  FAILED: 'ناموفق',
};

const COMMAND_NAME_LABELS: Record<string, string> = {
  'versionHistory.create': 'ثبت درخواست تصمیم انتشار',
  'versionHistory.submitForQAReview': 'ارسال برای بررسی QA',
  'versionHistory.setQAQuality': 'ثبت نظر کیفیت QA',
  'versionHistory.decide': 'ثبت تصمیم نهایی انتشار',
  'versionHistory.publish': 'ثبت انتشار',
  'versionHistory.emergencyPublish': 'ثبت انتشار اضطراری',
  'versionHistory.acceptRisk': 'پذیرش ریسک انتشار',
  'testRun.unlock': 'باز کردن قفل اجرای تست',
  'bug.unlock': 'باز کردن قفل باگ',
};

const COMMAND_SOURCE_LABELS: Record<string, string> = {
  UI: 'ثبت‌شده از رابط کاربری',
  API: 'ثبت‌شده از API',
  SYSTEM: 'ثبت‌شده توسط سیستم',
  RUNNER: 'ثبت‌شده توسط Runner',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  TEST_REQUEST: 'درخواست تست',
  REQUIREMENT: 'نیازمندی',
  FLOW: 'جریان',
  TEST_CASE: 'تست‌کیس',
  TEST_RUN: 'اجرای تست',
  BUG: 'باگ',
  RETEST_TASK: 'کار تست مجدد',
  RUN_ISSUE: 'مانع اجرا',
  CHECKLIST: 'چک‌لیست',
  VERSION_HISTORY: 'تصمیم انتشار',
  RELEASE_PUBLISH: 'تصمیم انتشار',
  PLAYWRIGHT_RUN: 'اجرای Playwright',
  PLAYWRIGHT_TEST_FILE: 'فایل تست Playwright',
  USER: 'کاربر',
  APPLICATION: 'سامانه',
  ROLE_ASSIGNMENT: 'نقش کاربر',
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: 'ایجاد',
  UPDATE: 'ویرایش',
  DELETE: 'حذف',
  STATUS_CHANGE: 'تغییر وضعیت',
  ASSIGN: 'ارجاع',
  SUBMIT: 'ارسال',
  REVIEW: 'بررسی',
  APPROVE: 'تایید',
  REJECT: 'رد',
  CANCEL: 'لغو',
  FINALIZE: 'نهایی‌سازی',
  UNLOCK: 'باز کردن قفل',
  PUBLISH: 'انتشار',
  EMERGENCY_PUBLISH: 'انتشار اضطراری',
  ROLE_CHANGE: 'تغییر نقش',
  LOGIN: 'ورود',
  LOGOUT: 'خروج',
  CONTEXT_SWITCH: 'تغییر محیط کاری',
};

const CHANNEL_LABELS: Record<string, string> = {
  IN_APP: 'داخل سامانه',
  EMAIL: 'ایمیل',
  SMS: 'پیامک',
};

const getHumanLabel = (labels: Record<string, string>, value: string | undefined): string =>
  value ? labels[value] || value : '-';

const formatOperationId = (value: string | undefined, prefix: string): string =>
  value ? formatDisplayId(value, prefix) : '-';

const getTraceColor = (status: CommandTrace['status']): 'success' | 'warning' | 'default' =>
  status === 'COMPLETED' ? 'success' : 'warning';

const getDeliveryColor = (status: NotificationOutboxItem['status']): 'success' | 'warning' | 'danger' | 'default' => {
  if (status === 'DELIVERED') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'QUEUED') return 'warning';
  return 'default';
};

export const AdminOperationsPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { appId } = useDataScope();
  const [activeTab, setActiveTab] = useState<OperationsTab>('commands');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CartableFilterParams>({
    page: 1,
    limit: 20,
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [commandData, setCommandData] = useState<PaginatedResponse<CommandTrace> | null>(null);
  const [outboxItems, setOutboxItems] = useState<NotificationOutboxItem[]>([]);
  const [auditData, setAuditData] = useState<PaginatedResponse<AuditLog> | null>(null);

  useEffect(() => {
    if (activeContext) loadData();
  }, [activeContext, filters]);

  const loadData = async () => {
    if (!activeContext) return;
    setLoading(true);
    try {
      const [commands, outbox, audits] = await Promise.all([
        commandTraceApi.getAll(appId, filters),
        notificationApi.getOutbox(),
        auditLogApi.getAll({ ...filters, applicationId: appId }),
      ]);
      setCommandData(commands);
      setOutboxItems(outbox);
      setAuditData(audits);
    } finally {
      setLoading(false);
    }
  };

  const processOutbox = async () => {
    await notificationApi.processOutbox(50);
    await loadData();
  };

  const retryFailed = async () => {
    await notificationApi.retryFailed();
    await loadData();
  };

  if (!activeContext) return null;

  const filteredOutbox = outboxItems.filter(item => {
    const q = filters.search?.trim().toLowerCase();
    if (!q) return true;
    return [
      item.id,
      item.notificationId,
      item.userId,
      item.channel,
      item.status,
      item.correlationId,
    ].some(value => String(value || '').toLowerCase().includes(q));
  });

  const auditWithCommandMetadata = (auditData?.data || []).filter(log =>
    !filters.search ||
    [
      log.entityType,
      log.entityId,
      log.action,
      log.metadata?.correlationId,
      log.metadata?.idempotencyKey,
      log.metadata?.commandName,
    ].some(value => String(value || '').toLowerCase().includes(filters.search!.toLowerCase()))
  );

  const commandColumns = [
    {
      key: 'commandName',
      title: 'عملیات ثبت‌شده',
      render: (item: CommandTrace) => (
        <div>
          <p className="font-medium text-gray-900">{getHumanLabel(COMMAND_NAME_LABELS, item.commandName)}</p>
          <p className="text-xs text-gray-500">{getHumanLabel(COMMAND_SOURCE_LABELS, item.source)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      title: 'وضعیت',
      render: (item: CommandTrace) => (
        <Badge variant={getTraceColor(item.status)}>{TRACE_STATUS_LABELS[item.status]}</Badge>
      ),
    },
    {
      key: 'entity',
      title: 'موضوع اثرگرفته',
      render: (item: CommandTrace) => (
        <div className="text-sm">
          <p>{getHumanLabel(ENTITY_TYPE_LABELS, item.entityType)}</p>
          <p className="font-mono text-xs text-gray-500">{formatOperationId(item.entityId, 'ENT')}</p>
        </div>
      ),
    },
    {
      key: 'correlationId',
      title: 'شناسه پیگیری',
      render: (item: CommandTrace) => (
        <p className="font-mono text-xs text-gray-700">{formatOperationId(item.correlationId, 'COR')}</p>
      ),
    },
    {
      key: 'idempotencyKey',
      title: 'کلید جلوگیری از تکرار',
      render: (item: CommandTrace) => (
        <p className="font-mono text-xs text-gray-700">{formatOperationId(item.idempotencyKey, 'KEY')}</p>
      ),
    },
    {
      key: 'createdAt',
      title: 'زمان',
      render: (item: CommandTrace) => (
        <div className="text-xs text-gray-600">
          <p>{new Date(item.createdAt).toLocaleDateString('fa-IR')}</p>
          <p>{new Date(item.createdAt).toLocaleTimeString('fa-IR')}</p>
        </div>
      ),
    },
  ];

  const outboxColumns = [
    {
      key: 'channel',
      title: 'کانال',
      render: (item: NotificationOutboxItem) => <Badge variant="info">{getHumanLabel(CHANNEL_LABELS, item.channel)}</Badge>,
    },
    {
      key: 'status',
      title: 'وضعیت',
      render: (item: NotificationOutboxItem) => (
        <Badge variant={getDeliveryColor(item.status)}>{DELIVERY_STATUS_LABELS[item.status]}</Badge>
      ),
    },
    {
      key: 'notificationId',
      title: 'اعلان',
      render: (item: NotificationOutboxItem) => (
        <p className="font-mono text-xs text-gray-700">{formatOperationId(item.notificationId, 'NOT')}</p>
      ),
    },
    {
      key: 'correlationId',
      title: 'شناسه پیگیری',
      render: (item: NotificationOutboxItem) => (
        <p className="font-mono text-xs text-gray-700">{formatOperationId(item.correlationId, 'COR')}</p>
      ),
    },
    {
      key: 'retryCount',
      title: 'تلاش ارسال',
      render: (item: NotificationOutboxItem) => (
        <span className="text-sm font-medium">{item.retryCount}</span>
      ),
    },
    {
      key: 'createdAt',
      title: 'زمان',
      render: (item: NotificationOutboxItem) => (
        <div className="text-xs text-gray-600">
          <p>{new Date(item.createdAt).toLocaleDateString('fa-IR')}</p>
          <p>{item.deliveredAt ? `تحویل: ${new Date(item.deliveredAt).toLocaleTimeString('fa-IR')}` : 'در انتظار تحویل'}</p>
        </div>
      ),
    },
  ];

  const auditColumns = [
    {
      key: 'action',
      title: 'عملیات',
      render: (item: AuditLog) => (
        <div>
          <p className="font-medium text-gray-900">{getHumanLabel(AUDIT_ACTION_LABELS, item.action)}</p>
          <p className="text-xs text-gray-500">{getHumanLabel(ENTITY_TYPE_LABELS, item.entityType)}</p>
        </div>
      ),
    },
    {
      key: 'entityId',
      title: 'موضوع اثرگرفته',
      render: (item: AuditLog) => <p className="font-mono text-xs">{formatOperationId(item.entityId, 'ENT')}</p>,
    },
    {
      key: 'correlationId',
      title: 'شناسه پیگیری',
      render: (item: AuditLog) => (
        <p className="font-mono text-xs">{formatOperationId(String(item.metadata?.correlationId || ''), 'COR')}</p>
      ),
    },
    {
      key: 'idempotencyKey',
      title: 'کلید جلوگیری از تکرار',
      render: (item: AuditLog) => (
        <p className="font-mono text-xs">{formatOperationId(String(item.metadata?.idempotencyKey || ''), 'KEY')}</p>
      ),
    },
    {
      key: 'createdAt',
      title: 'زمان',
      render: (item: AuditLog) => (
        <div className="text-xs text-gray-600">
          <p>{new Date(item.createdAt).toLocaleDateString('fa-IR')}</p>
          <p>{new Date(item.createdAt).toLocaleTimeString('fa-IR')}</p>
        </div>
      ),
    },
  ];

  const tabs: Array<{ id: OperationsTab; label: string; count: number; icon: React.ReactNode }> = [
    { id: 'commands', label: 'ردپای دستورها', count: commandData?.total || 0, icon: <Fingerprint className="w-4 h-4" /> },
    { id: 'outbox', label: 'صف ارسال اعلان', count: outboxItems.length, icon: <Bell className="w-4 h-4" /> },
    { id: 'audit', label: 'ممیزی مرتبط', count: auditWithCommandMetadata.length, icon: <History className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="کنسول عملیات و مشاهده‌پذیری"
        subtitle="ردپای دستورها، صف اعلان‌ها و شناسه پیگیری هر عملیات"
        onRefresh={loadData}
        refreshing={loading}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={processOutbox}>
              پردازش صف اعلان
            </Button>
            <Button variant="warning" icon={<RotateCcw className="w-4 h-4" />} onClick={retryFailed}>
              تلاش دوباره ناموفق‌ها
            </Button>
          </div>
        }
      />

      <main className="p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard title="دستورهای ثبت‌شده" value={commandData?.total || 0} icon={<Fingerprint className="w-6 h-6" />} />
          <StatCard title="اعلان‌های در صف" value={outboxItems.filter(item => item.status === 'QUEUED').length} icon={<Bell className="w-6 h-6" />} variant="warning" />
          <StatCard title="ممیزی‌های قابل پیگیری" value={auditWithCommandMetadata.length} icon={<Activity className="w-6 h-6" />} variant="primary" />
        </div>

        <Card className="mb-6" padding="sm">
          <div className="flex flex-wrap items-center gap-3">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {tab.icon}
                {tab.label}
                <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{tab.count}</span>
              </button>
            ))}
            <CartableSearchInput
              value={filters.search || ''}
              onChange={(search) => setFilters({ ...filters, search, page: 1 })}
              placeholder="جستجو در عملیات، شناسه پیگیری یا کلید تکرار..."
              className="min-w-[220px]"
            />
          </div>
        </Card>

        {activeTab === 'commands' && (
          <>
            <Table columns={commandColumns} data={commandData?.data || []} loading={loading} emptyMessage="هنوز ردپای عملیاتی ثبت نشده است." />
            {commandData && commandData.total > 0 && (
              <Pagination
                page={commandData.page}
                totalPages={commandData.totalPages}
                total={commandData.total}
                limit={commandData.limit}
                onPageChange={(page) => setFilters({ ...filters, page })}
                onLimitChange={(limit) => setFilters({ ...filters, limit, page: 1 })}
              />
            )}
          </>
        )}

        {activeTab === 'outbox' && (
          <Table columns={outboxColumns} data={filteredOutbox} loading={loading} emptyMessage="اعلانی در صف ارسال نیست." />
        )}

        {activeTab === 'audit' && (
          <Table columns={auditColumns} data={auditWithCommandMetadata} loading={loading} emptyMessage="ممیزی قابل پیگیری برای این فیلتر پیدا نشد." />
        )}
      </main>
    </div>
  );
};
