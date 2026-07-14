import { useEffect, useState } from 'react';
import { Activity, Bell, Fingerprint, History, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { Table, Pagination } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { useAuthStore } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import { auditLogApi, commandTraceApi, notificationApi } from '../services/api';
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
  REPLAYED: 'Replay شده',
};

const DELIVERY_STATUS_LABELS: Record<NotificationOutboxItem['status'], string> = {
  QUEUED: 'در صف',
  DELIVERED: 'تحویل شده',
  FAILED: 'ناموفق',
};

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
      title: 'Command',
      render: (item: CommandTrace) => (
        <div>
          <p className="font-medium text-gray-900">{item.commandName}</p>
          <p className="text-xs text-gray-500">{item.source}</p>
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
      title: 'موجودیت',
      render: (item: CommandTrace) => (
        <div className="text-sm">
          <p>{item.entityType || '-'}</p>
          <p className="font-mono text-xs text-gray-500">{item.entityId || '-'}</p>
        </div>
      ),
    },
    {
      key: 'correlationId',
      title: 'Correlation',
      render: (item: CommandTrace) => (
        <p className="font-mono text-xs text-gray-700 break-all">{item.correlationId}</p>
      ),
    },
    {
      key: 'idempotencyKey',
      title: 'Idempotency',
      render: (item: CommandTrace) => (
        <p className="font-mono text-xs text-gray-700 break-all">{item.idempotencyKey || '-'}</p>
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
      render: (item: NotificationOutboxItem) => <Badge variant="info">{item.channel}</Badge>,
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
      title: 'Notification',
      render: (item: NotificationOutboxItem) => (
        <p className="font-mono text-xs text-gray-700 break-all">{item.notificationId}</p>
      ),
    },
    {
      key: 'correlationId',
      title: 'Correlation',
      render: (item: NotificationOutboxItem) => (
        <p className="font-mono text-xs text-gray-700 break-all">{item.correlationId || '-'}</p>
      ),
    },
    {
      key: 'retryCount',
      title: 'Retry',
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
          <p className="font-medium text-gray-900">{item.action}</p>
          <p className="text-xs text-gray-500">{item.entityType}</p>
        </div>
      ),
    },
    {
      key: 'entityId',
      title: 'موجودیت',
      render: (item: AuditLog) => <p className="font-mono text-xs break-all">{item.entityId}</p>,
    },
    {
      key: 'correlationId',
      title: 'Correlation',
      render: (item: AuditLog) => (
        <p className="font-mono text-xs break-all">{String(item.metadata?.correlationId ?? '-')}</p>
      ),
    },
    {
      key: 'idempotencyKey',
      title: 'Idempotency',
      render: (item: AuditLog) => (
        <p className="font-mono text-xs break-all">{String(item.metadata?.idempotencyKey ?? '-')}</p>
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
    { id: 'commands', label: 'Command Trace', count: commandData?.total || 0, icon: <Fingerprint className="w-4 h-4" /> },
    { id: 'outbox', label: 'Outbox اعلان', count: outboxItems.length, icon: <Bell className="w-4 h-4" /> },
    { id: 'audit', label: 'Audit مرتبط', count: auditWithCommandMetadata.length, icon: <History className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="کنسول عملیات و مشاهده‌پذیری"
        subtitle="Command Trace، Outbox و Correlation"
        onRefresh={loadData}
        refreshing={loading}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={processOutbox}>
              پردازش Outbox
            </Button>
            <Button variant="warning" icon={<RotateCcw className="w-4 h-4" />} onClick={retryFailed}>
              Retry ناموفق‌ها
            </Button>
          </div>
        }
      />

      <main className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard title="Command Trace" value={commandData?.total || 0} icon={<Fingerprint className="w-6 h-6" />} />
          <StatCard title="Outbox در صف" value={outboxItems.filter(item => item.status === 'QUEUED').length} icon={<Bell className="w-6 h-6" />} variant="warning" />
          <StatCard title="Audit با Correlation" value={auditWithCommandMetadata.length} icon={<Activity className="w-6 h-6" />} variant="primary" />
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
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="جستجو در command، correlation، idempotency..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                className="w-full pr-10 pl-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </Card>

        {activeTab === 'commands' && (
          <>
            <Table columns={commandColumns} data={commandData?.data || []} loading={loading} emptyMessage="Command trace ثبت نشده است." />
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
          <Table columns={outboxColumns} data={filteredOutbox} loading={loading} emptyMessage="Outbox فعالی وجود ندارد." />
        )}

        {activeTab === 'audit' && (
          <Table columns={auditColumns} data={auditWithCommandMetadata} loading={loading} emptyMessage="Audit مرتبط با command metadata یافت نشد." />
        )}
      </main>
    </div>
  );
};
