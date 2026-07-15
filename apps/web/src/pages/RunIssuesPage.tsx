import { useState, useEffect } from 'react';
import { Eye, AlertTriangle, CheckCircle } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Table, Pagination } from '../components/ui/Table';
import { CartableSearchInput } from '../components/ui/CartableToolbar';
import { StatusBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Textarea } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { useAuthStore, canPerformAction } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import { useApplicationLookup } from '../utils/useApplicationLookup';
import { runIssueApi } from '../services/api';
import type { RunIssue, CartableFilterParams, PaginatedResponse } from '../types';
import { RUN_ISSUE_STATUS_LABELS, RUN_ISSUE_TYPE_LABELS } from '../types';

export const RunIssuesPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { appId } = useDataScope();
  const { shouldShowSystemColumn, getApplicationName } = useApplicationLookup();
  const [data, setData] = useState<PaginatedResponse<RunIssue> | null>(null);
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
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<RunIssue | null>(null);
  const [resolution, setResolution] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (activeContext) {
      loadData();
    }
  }, [activeContext, filters]);

  const loadData = async () => {
    if (!activeContext) return;
    setLoading(true);
    try {
      const response = await runIssueApi.getAll(appId, filters);
      setData(response);
    } catch {
      setData(null);
      toast.error('خطا در بارگذاری مشکلات اجرا.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!activeContext || !selectedIssue || !resolution) return;
    setActionLoading(true);
    try {
      await runIssueApi.resolve(selectedIssue.id, resolution, activeContext.userId);
      setShowResolveModal(false);
      setResolution('');
      setShowDetailModal(false);
      loadData();
    } catch {
      toast.error('خطا در ثبت رفع مشکل اجرا.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!activeContext) return null;

  const role = activeContext.role;
  const canResolve = canPerformAction(role, 'run-issue:resolve');

  const getTypeIcon = (type: string) => {
    const colors: Record<string, string> = {
      ENVIRONMENT: 'bg-blue-100 text-blue-600',
      ACCESS: 'bg-amber-100 text-amber-600',
      DATA: 'bg-purple-100 text-purple-600',
      DEPENDENCY: 'bg-gray-100 text-gray-600',
    };
    return colors[type] || 'bg-gray-100 text-gray-600';
  };

  const columns = [
    {
      key: 'title',
      title: 'عنوان',
      sortable: true,
      render: (item: RunIssue) => (
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded ${getTypeIcon(item.issueType)}`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{item.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {RUN_ISSUE_TYPE_LABELS[item.issueType]}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      title: 'وضعیت',
      render: (item: RunIssue) => (
        <StatusBadge status={item.status} labels={RUN_ISSUE_STATUS_LABELS} />
      ),
    },
    ...(shouldShowSystemColumn ? [{
      key: 'applicationId',
      title: 'سامانه',
      render: (item: RunIssue) => <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{getApplicationName(item.applicationId)}</span>,
    }] : []),
    {
      key: 'reportedBy',
      title: 'گزارش‌دهنده',
      render: (item: RunIssue) => item.reportedBy?.fullName || '-',
    },
    {
      key: 'assignee',
      title: 'ارجاع به',
      render: (item: RunIssue) => item.assignee?.fullName || '-',
    },
    {
      key: 'createdAt',
      title: 'تاریخ',
      sortable: true,
      render: (item: RunIssue) => new Date(item.createdAt).toLocaleDateString('fa-IR'),
    },
    {
      key: 'actions',
      title: 'عملیات',
      render: (item: RunIssue) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<Eye className="w-4 h-4" />}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedIssue(item);
              setShowDetailModal(true);
            }}
          >
            مشاهده
          </Button>
          {canResolve && item.status !== 'RESOLVED' && item.status !== 'CLOSED' && (
            <Button
              size="sm"
              variant="secondary"
              icon={<CheckCircle className="w-4 h-4" />}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIssue(item);
                setShowResolveModal(true);
              }}
            >
              حل
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="کارتابل مشکلات اجرا"
        subtitle={`${data?.total || 0} مشکل`}
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
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">همه وضعیت‌ها</option>
              {Object.entries(RUN_ISSUE_STATUS_LABELS).map(([value, label]) => (
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
          emptyMessage="مشکلی یافت نشد"
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
            setSelectedIssue(item);
            setShowDetailModal(true);
          }}
          rowClassName={(item) =>
            item.status === 'RESOLVED' || item.status === 'CLOSED' ? 'bg-green-50' :
            item.status === 'OPEN' ? 'bg-amber-50' : ''
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

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="جزئیات مشکل اجرا"
        size="lg"
      >
        {selectedIssue && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${getTypeIcon(selectedIssue.issueType)}`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedIssue.title}
                  </h3>
                  <p className="text-sm text-gray-500">
                    نوع: {RUN_ISSUE_TYPE_LABELS[selectedIssue.issueType]}
                  </p>
                </div>
              </div>
              <StatusBadge
                status={selectedIssue.status}
                labels={RUN_ISSUE_STATUS_LABELS}
              />
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">توضیحات</p>
              <p className="text-sm">{selectedIssue.description}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">گزارش‌دهنده</p>
                <p className="font-medium">{selectedIssue.reportedBy?.fullName || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">ارجاع به</p>
                <p className="font-medium">{selectedIssue.assignee?.fullName || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">تاریخ ثبت</p>
                <p className="font-medium">
                  {new Date(selectedIssue.createdAt).toLocaleDateString('fa-IR')}
                </p>
              </div>
              <div>
                <p className="text-gray-500">آخرین بروزرسانی</p>
                <p className="font-medium">
                  {new Date(selectedIssue.updatedAt).toLocaleDateString('fa-IR')}
                </p>
              </div>
            </div>

            {selectedIssue.resolution && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-gray-500 mb-1">راه‌حل</p>
                <p className="text-sm">{selectedIssue.resolution}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              {canResolve && selectedIssue.status !== 'RESOLVED' && selectedIssue.status !== 'CLOSED' && (
                <Button
                  variant="primary"
                  icon={<CheckCircle className="w-4 h-4" />}
                  onClick={() => setShowResolveModal(true)}
                >
                  ثبت راه‌حل
                </Button>
              )}
              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                بستن
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Resolve Modal */}
      <Modal
        isOpen={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        title="ثبت راه‌حل"
        size="md"
      >
        <div className="space-y-4">
          <Textarea
            label="راه‌حل *"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="راه‌حل مشکل را توضیح دهید..."
          />
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowResolveModal(false)}>
              انصراف
            </Button>
            <Button
              onClick={handleResolve}
              loading={actionLoading}
              disabled={!resolution}
            >
              ثبت
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
