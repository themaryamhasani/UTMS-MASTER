import React, { useState, useEffect } from 'react';
import { Eye, CheckCircle, XCircle, Search, UserPlus, Bug as BugIcon } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Table, Pagination } from '../components/ui/Table';
import { StatusBadge, PriorityBadge } from '../components/ui/Badge';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Input, Select } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { useAuthStore, canPerformAction } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import { bugApi, userApi, commentApi } from '../services/api';
import type { Bug, User, CartableFilterParams, PaginatedResponse, Comment } from '../types';
import { BUG_STATUS_LABELS, BUG_SEVERITY_LABELS } from '../types';
import { isSemVer, SEMVER_HINT } from '../utils/semver';
import { sanitizeVersionInput, VERSION_INPUT_HINT } from '../utils/inputRules';

export const BugsPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { appId } = useDataScope();
  const [data, setData] = useState<PaginatedResponse<Bug> | null>(null);
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
  const [showAssignModal, setShowAssignModal] = useState(false);
  // Status modal for future use
  // const [showStatusModal, setShowStatusModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedBug, setSelectedBug] = useState<Bug | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: string; message: string } | null>(null);

  // Form state
  const [developers, setDevelopers] = useState<User[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  // const [statusNotes, setStatusNotes] = useState('');
  const [fixedVersion, setFixedVersion] = useState('');
  const [fixedVersionError, setFixedVersionError] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (activeContext) {
      loadData();
    }
  }, [activeContext, filters]);

  useEffect(() => {
    if (activeContext && showAssignModal) {
      loadDevelopers();
    }
  }, [activeContext, showAssignModal]);

  useEffect(() => {
    if (selectedBug && showDetailModal) {
      loadComments();
    }
  }, [selectedBug, showDetailModal]);

  const loadData = async () => {
    if (!activeContext) return;
    setLoading(true);
    try {
      const response = await bugApi.getVisibleForRole(appId, filters, activeContext.userId, activeContext.role);
      setData(response);
    } catch {
      setData(null);
      toast.error('خطا در بارگذاری باگ‌ها.');
    } finally {
      setLoading(false);
    }
  };

  const loadDevelopers = async () => {
    if (!activeContext) return;
    try {
      const devs = await userApi.getDevelopers(appId);
      setDevelopers(devs);
    } catch {
      setDevelopers([]);
      toast.error('خطا در بارگذاری توسعه‌دهندگان.');
    }
  };

  const loadComments = async () => {
    if (!selectedBug) return;
    try {
      const cmts = await commentApi.getByEntity('BUG', selectedBug.id);
      setComments(cmts);
    } catch {
      setComments([]);
      toast.error('خطا در بارگذاری دیدگاه‌ها.');
    }
  };

  const handleAssign = async () => {
    if (!activeContext || !selectedBug || !selectedAssignee) return;
    setActionLoading(true);
    try {
      await bugApi.assign(selectedBug.id, selectedAssignee, activeContext.userId);
      setShowAssignModal(false);
      setSelectedAssignee('');
      loadData();
    } catch {
      toast.error('خطا در ارجاع باگ.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetFixed = async () => {
    if (!activeContext || !selectedBug || !fixedVersion) return;
    const sanitized = sanitizeVersionInput(fixedVersion);
    if (sanitized.error) {
      setFixedVersionError(VERSION_INPUT_HINT);
      return;
    }
    if (!isSemVer(fixedVersion)) {
      setFixedVersionError(SEMVER_HINT);
      return;
    }
    setActionLoading(true);
    try {
      await bugApi.setFixedVersion(selectedBug.id, fixedVersion, activeContext.userId);
      setFixedVersion('');
      setFixedVersionError('');
      setShowDetailModal(false);
      loadData();
    } catch {
      toast.error('خطا در ثبت نسخه رفع.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetest = async (passed: boolean) => {
    if (!activeContext || !selectedBug) return;
    setActionLoading(true);
    try {
      await bugApi.retest(selectedBug.id, passed, activeContext.userId);
      setShowConfirmModal(false);
      setShowDetailModal(false);
      loadData();
    } catch {
      toast.error('خطا در ثبت نتیجه بازآزمون.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    if (!activeContext || !selectedBug) return;
    setActionLoading(true);
    try {
      await bugApi.close(selectedBug.id, activeContext.userId);
      setShowConfirmModal(false);
      setShowDetailModal(false);
      loadData();
    } catch {
      toast.error('خطا در بستن باگ.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!activeContext || !selectedBug || !newComment.trim()) return;
    setActionLoading(true);
    try {
      await commentApi.create('BUG', selectedBug.id, newComment, activeContext.userId);
      setNewComment('');
      loadComments();
    } catch {
      toast.error('خطا در ثبت دیدگاه.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkReadyForRetest = async () => {
    if (!activeContext || !selectedBug) return;
    setActionLoading(true);
    try {
      await bugApi.markReadyForRetest(selectedBug.id, activeContext.userId);
      setShowDetailModal(false);
      loadData();
    } catch {
      toast.error('خطا در آماده‌سازی بازآزمون.');
    } finally {
      setActionLoading(false);
    }
  };

  const openConfirmModal = (action: string, message: string) => {
    setConfirmAction({ action, message });
    setShowConfirmModal(true);
  };

  const executeConfirmAction = () => {
    if (!confirmAction) return;
    switch (confirmAction.action) {
      case 'retest-pass':
        handleRetest(true);
        break;
      case 'retest-fail':
        handleRetest(false);
        break;
      case 'close':
        handleClose();
        break;
    }
  };

  if (!activeContext) return null;

  const role = activeContext.role;
  const canAssign = canPerformAction(role, 'bug:assign');
  const canRetest = canPerformAction(role, 'bug:retest');
  const isDeveloper = role === 'DEVELOPER';

  const columns = [
    {
      key: 'title',
      title: 'عنوان',
      sortable: true,
      render: (item: Bug) => (
        <div>
          <p className="font-medium text-gray-900">{item.title}</p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
            {item.description}
          </p>
        </div>
      ),
    },
    {
      key: 'severity',
      title: 'شدت',
      render: (item: Bug) => (
        <StatusBadge status={item.severity} labels={BUG_SEVERITY_LABELS} />
      ),
    },
    {
      key: 'priority',
      title: 'اولویت',
      render: (item: Bug) => <PriorityBadge priority={item.priority} />,
    },
    {
      key: 'status',
      title: 'وضعیت',
      render: (item: Bug) => (
        <StatusBadge status={item.status} labels={BUG_STATUS_LABELS} />
      ),
    },
    {
      key: 'assignee',
      title: 'توسعه‌دهنده',
      render: (item: Bug) => item.assignee?.fullName || '-',
    },
    {
      key: 'createdAt',
      title: 'تاریخ',
      sortable: true,
      render: (item: Bug) => new Date(item.createdAt).toLocaleDateString('fa-IR'),
    },
    {
      key: 'actions',
      title: 'عملیات',
      render: (item: Bug) => (
        <Button
          size="sm"
          variant="ghost"
          icon={<Eye className="w-4 h-4" />}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedBug(item);
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
        title="کارتابل باگ‌ها"
        subtitle={isDeveloper ? 'باگ‌های تخصیص یافته به شما' : `${data?.total || 0} باگ`}
        onRefresh={loadData}
        refreshing={loading}
      />

      <main className="p-6">
        {/* Filters */}
        {!isDeveloper && (
          <Card className="mb-6" padding="sm">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="جستجو..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                  className="w-full pr-10 pl-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">همه وضعیت‌ها</option>
                {Object.entries(BUG_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </Card>
        )}

        {/* Table */}
        <Table
          columns={columns}
          data={data?.data || []}
          loading={loading}
          emptyMessage="باگی یافت نشد"
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
            setSelectedBug(item);
            setShowDetailModal(true);
          }}
          rowClassName={(item) => 
            item.severity === 'CRITICAL' ? 'bg-red-50' : ''
          }
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
        title="جزئیات باگ"
        size="xl"
      >
        {selectedBug && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <BugIcon className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedBug.title}
                  </h3>
                  <p className="text-sm text-gray-500">
                    گزارش‌دهنده: {selectedBug.reportedBy?.fullName}
                  </p>
                </div>
              </div>
              <StatusBadge
                status={selectedBug.status}
                labels={BUG_STATUS_LABELS}
              />
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">{selectedBug.description}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">شدت</p>
                <StatusBadge status={selectedBug.severity} labels={BUG_SEVERITY_LABELS} />
              </div>
              <div>
                <p className="text-xs text-gray-500">اولویت</p>
                <PriorityBadge priority={selectedBug.priority} />
              </div>
              <div>
                <p className="text-xs text-gray-500">توسعه‌دهنده</p>
                <p className="font-medium">{selectedBug.assignee?.fullName || 'تخصیص نیافته'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">نسخه رفع شده</p>
                <p className="font-medium">{selectedBug.fixedVersion || '-'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">مراحل بازتولید</p>
                <p className="text-sm whitespace-pre-wrap">{selectedBug.stepsToReproduce}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">نتیجه واقعی</p>
                <p className="text-sm">{selectedBug.actualResult}</p>
              </div>
            </div>

            {selectedBug.fixNotes && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-gray-500 mb-1">یادداشت رفع</p>
                <p className="text-sm">{selectedBug.fixNotes}</p>
              </div>
            )}

            {/* Developer actions for fixing */}
            {isDeveloper && selectedBug.assigneeId === activeContext?.userId && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm font-medium text-amber-800 mb-3">ثبت اصلاح</p>
                <div className="flex gap-3">
                  <Input
                    label="نسخه رفع *"
                    placeholder="نسخه رفع شده"
                    value={fixedVersion}
                    onChange={(e) => {
                      const sanitized = sanitizeVersionInput(e.target.value);
                      setFixedVersion(sanitized.value);
                      setFixedVersionError(sanitized.error || '');
                    }}
                    hint={SEMVER_HINT}
                    error={fixedVersionError}
                  />
                  <Button
                    onClick={handleSetFixed}
                    loading={actionLoading}
                    disabled={!fixedVersion}
                  >
                    ثبت رفع
                  </Button>
                </div>
              </div>
            )}

            {/* Comments */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">نظرات</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                {comments.length === 0 ? (
                  <p className="text-sm text-gray-500">نظری ثبت نشده است</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{comment.author?.fullName}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(comment.createdAt).toLocaleDateString('fa-IR')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="نظر جدید..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <Button
                  onClick={handleAddComment}
                  loading={actionLoading}
                  disabled={!newComment.trim()}
                >
                  ارسال
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              {canAssign && selectedBug.status === 'NEW' && (
                <Button
                  variant="secondary"
                  icon={<UserPlus className="w-4 h-4" />}
                  onClick={() => setShowAssignModal(true)}
                >
                  تخصیص
                </Button>
              )}

              {isDeveloper && selectedBug.status === 'FIXED' && 
               selectedBug.assigneeId === activeContext?.userId && (
                <Button
                  variant="primary"
                  onClick={handleMarkReadyForRetest}
                  loading={actionLoading}
                >
                  آماده تست مجدد
                </Button>
              )}

              {canRetest && selectedBug.status === 'RETEST_READY' && (
                <>
                  <Button
                    variant="primary"
                    icon={<CheckCircle className="w-4 h-4" />}
                    onClick={() => openConfirmModal('retest-pass', 'تست مجدد موفق؟')}
                  >
                    تست موفق
                  </Button>
                  <Button
                    variant="danger"
                    icon={<XCircle className="w-4 h-4" />}
                    onClick={() => openConfirmModal('retest-fail', 'تست مجدد ناموفق؟')}
                  >
                    تست ناموفق
                  </Button>
                </>
              )}

              {canRetest && selectedBug.status === 'RETEST_PASSED' && (
                <Button
                  variant="primary"
                  onClick={() => openConfirmModal('close', 'بستن باگ؟')}
                >
                  بستن باگ
                </Button>
              )}

              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                بستن
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Assign Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="تخصیص باگ"
        size="sm"
      >
        <div className="space-y-4">
          <Select
            label="تخصیص به"
            value={selectedAssignee}
            onChange={(e) => setSelectedAssignee(e.target.value)}
            options={developers.map((u) => ({ value: u.id, label: u.fullName }))}
            placeholder="انتخاب کنید"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowAssignModal(false)}>
              انصراف
            </Button>
            <Button
              onClick={handleAssign}
              loading={actionLoading}
              disabled={!selectedAssignee}
            >
              تخصیص
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={executeConfirmAction}
        title="تایید عملیات"
        message={confirmAction?.message || ''}
        variant={confirmAction?.action === 'retest-fail' ? 'danger' : 'primary'}
        loading={actionLoading}
      />
    </div>
  );
};
