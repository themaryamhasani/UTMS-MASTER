import { useState, useEffect } from 'react';
import { History, User, FileText, Bug, Rocket, Shield, Eye } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Table, Pagination } from '../components/ui/Table';
import { CartableSearchInput } from '../components/ui/CartableToolbar';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { useAuthStore } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import { auditLogApi } from '../services/api';
import type { AuditLog, CartableFilterParams, PaginatedResponse } from '../types';

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'ایجاد',
  UPDATE: 'بروزرسانی',
  DELETE: 'حذف',
  STATUS_CHANGE: 'تغییر وضعیت',
  ASSIGN: 'ارجاع',
  SUBMIT: 'ارسال',
  REVIEW: 'بررسی',
  APPROVE: 'تایید',
  REJECT: 'رد',
  CANCEL: 'لغو',
  FINALIZE: 'نهایی‌سازی',
  PUBLISH: 'ثبت تصمیم انتشار',
  EMERGENCY_PUBLISH: 'ثبت Tag اضطراری',
  ROLE_CHANGE: 'تغییر نقش',
  LOGIN: 'ورود',
  LOGOUT: 'خروج',
  CONTEXT_SWITCH: 'تغییر محیط',
};

const ENTITY_LABELS: Record<string, string> = {
  TEST_REQUEST: 'درخواست تست',
  REQUIREMENT: 'نیازمندی',
  FLOW: 'جریان',
  TEST_CASE: 'تست کیس',
  TEST_RUN: 'اجرای تست',
  BUG: 'باگ',
  RETEST_TASK: 'Task بازآزمون',
  RUN_ISSUE: 'مشکل اجرا',
  CHECKLIST: 'چک‌لیست',
  RELEASE_PUBLISH: 'VersionHistory',
  VERSION_HISTORY: 'VersionHistory',
  PLAYWRIGHT_RUN: 'تست Playwright',
  USER: 'کاربر',
  APPLICATION: 'سامانه',
  ROLE_ASSIGNMENT: 'تخصیص نقش',
};

export const AuditPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { appId } = useDataScope();
  const [data, setData] = useState<PaginatedResponse<AuditLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CartableFilterParams>({
    page: 1,
    limit: 20,
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // Modals
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    if (activeContext) {
      loadData();
    }
  }, [activeContext, filters]);

  const loadData = async () => {
    if (!activeContext) return;
    setLoading(true);
    try {
      const response = await auditLogApi.getAll({
        ...filters,
        applicationId: appId,
      });
      setData(response);
    } catch {
      setData(null);
      toast.error('خطا در بارگذاری تاریخچه.');
    } finally {
      setLoading(false);
    }
  };

  if (!activeContext) return null;

  const getEntityIcon = (entityType: string) => {
    const icons: Record<string, React.ReactNode> = {
      TEST_REQUEST: <FileText className="w-4 h-4 text-blue-500" />,
      BUG: <Bug className="w-4 h-4 text-red-500" />,
      RETEST_TASK: <Bug className="w-4 h-4 text-purple-500" />,
      RELEASE_PUBLISH: <Rocket className="w-4 h-4 text-green-500" />,
      VERSION_HISTORY: <Rocket className="w-4 h-4 text-green-500" />,
      CHECKLIST: <Shield className="w-4 h-4 text-purple-500" />,
      USER: <User className="w-4 h-4 text-gray-500" />,
    };
    return icons[entityType] || <History className="w-4 h-4 text-gray-400" />;
  };

  const getActionColor = (action: string): 'default' | 'success' | 'warning' | 'danger' | 'info' => {
    const colors: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
      CREATE: 'info',
      UPDATE: 'warning',
      DELETE: 'danger',
      APPROVE: 'success',
      REJECT: 'danger',
      PUBLISH: 'success',
      EMERGENCY_PUBLISH: 'danger',
      SUBMIT: 'info',
      ASSIGN: 'warning',
    };
    return colors[action] || 'default';
  };

  const columns = [
    {
      key: 'timestamp',
      title: 'زمان',
      render: (item: AuditLog) => (
        <div className="text-sm">
          <p className="font-medium">{new Date(item.createdAt).toLocaleDateString('fa-IR')}</p>
          <p className="text-xs text-gray-500">
            {new Date(item.createdAt).toLocaleTimeString('fa-IR')}
          </p>
        </div>
      ),
    },
    {
      key: 'user',
      title: 'کاربر',
      render: (item: AuditLog) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-gray-500" />
          </div>
          <span className="text-sm font-medium">{item.user?.fullName || '-'}</span>
        </div>
      ),
    },
    {
      key: 'action',
      title: 'عملیات',
      render: (item: AuditLog) => (
        <Badge variant={getActionColor(item.action)}>
          {ACTION_LABELS[item.action] || item.action}
        </Badge>
      ),
    },
    {
      key: 'entity',
      title: 'موجودیت',
      render: (item: AuditLog) => (
        <div className="flex items-center gap-2">
          {getEntityIcon(item.entityType)}
          <span className="text-sm">{ENTITY_LABELS[item.entityType] || item.entityType}</span>
        </div>
      ),
    },
    {
      key: 'application',
      title: 'سامانه',
      render: (item: AuditLog) => (
        <span className="text-sm text-gray-600">
          {item.application?.name || '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: 'جزئیات',
      render: (item: AuditLog) => (
        <Button
          size="sm"
          variant="ghost"
          icon={<Eye className="w-4 h-4" />}
          onClick={() => {
            setSelectedLog(item);
            setShowDetailModal(true);
          }}
        >
          مشاهده
        </Button>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="تاریخچه عملیات (Audit Trail)"
        subtitle={`${data?.total || 0} رویداد`}
        onRefresh={loadData}
        refreshing={loading}
      />

      <main className="p-6">
        {/* Filters */}
        <Card className="mb-6" padding="sm">
          <div className="flex flex-wrap gap-4 items-center">
            <CartableSearchInput
              value={filters.search || ''}
              onChange={(search) => setFilters({ ...filters, search, page: 1 })}
            />
          </div>
        </Card>

        {/* Table */}
        <Table
          columns={columns}
          data={data?.data || []}
          loading={loading}
          emptyMessage="رویدادی ثبت نشده است"
          onRowClick={(item) => {
            setSelectedLog(item);
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

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="جزئیات رویداد"
        size="lg"
      >
        {selectedLog && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <History className="w-6 h-6 text-gray-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={getActionColor(selectedLog.action)}>
                    {ACTION_LABELS[selectedLog.action] || selectedLog.action}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    {ENTITY_LABELS[selectedLog.entityType] || selectedLog.entityType}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(selectedLog.createdAt).toLocaleString('fa-IR')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">کاربر</p>
                <p className="font-medium">{selectedLog.user?.fullName || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">سامانه</p>
                <p className="font-medium">{selectedLog.application?.name || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">شناسه موجودیت</p>
                <p className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                  {selectedLog.entityId}
                </p>
              </div>
            </div>

            {selectedLog.previousValue && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-xs text-gray-500 mb-2">مقدار قبلی:</p>
                <pre className="text-sm text-red-700 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(JSON.parse(selectedLog.previousValue), null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.newValue && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-gray-500 mb-2">مقدار جدید:</p>
                <pre className="text-sm text-green-700 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(JSON.parse(selectedLog.newValue), null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.metadata && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">اطلاعات اضافی:</p>
                <pre className="text-sm text-gray-700 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4 border-t">
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
