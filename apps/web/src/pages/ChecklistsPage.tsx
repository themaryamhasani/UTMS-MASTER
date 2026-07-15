import { useState, useEffect } from 'react';
import { Eye, Search, ShieldCheck, CheckCircle, XCircle, AlertTriangle, Minus } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Textarea, Select } from '../components/ui/Input';
import { useAuthStore, canPerformAction } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import { useApplicationLookup } from '../utils/useApplicationLookup';
import { securityChecklistApi } from '../services/api';
import { toast } from '../components/ui/Toast';

type ReviewStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
type ItemResult = 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT_TESTED' | 'N_A';

const STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: 'در انتظار بررسی',
  IN_PROGRESS: 'در حال بررسی',
  COMPLETED: 'تکمیل شده',
};

const RESULT_LABELS: Record<string, string> = {
  PASS: 'قبول',
  FAIL: 'رد',
  PARTIAL: 'ناقص',
  NOT_TESTED: 'تست نشده',
  N_A: 'غیرقابل اعمال',
};

interface SecurityReview {
  id: string;
  testCaseId: string;
  testCaseTitle: string;
  applicationId: string;
  status: ReviewStatus;
  items: Array<{
    id: string;
    title: string;
    description: string;
    result?: ItemResult;
    notes?: string;
  }>;
  reviewedById?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const ChecklistsPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { defaultApplicationId, scopeApplicationIds, isAppLevel, isMultiSystem } = useDataScope();
  const { shouldShowSystemColumn, getApplicationName } = useApplicationLookup();
  const [reviews, setReviews] = useState<SecurityReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // Item #10: APP-level users see system selector first
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const shouldSelectApplication = isAppLevel || isMultiSystem;

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<SecurityReview | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editResult, setEditResult] = useState<ItemResult | ''>('');
  const [editNotes, setEditNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Applications list for APP-level selector
  const [applications, setApplications] = useState<Array<{id: string; name: string}>>([]);

  const role = activeContext?.role;
  const canReview = canPerformAction(role!, 'checklist:review');

  useEffect(() => {
    if (activeContext) {
      if (shouldSelectApplication) {
        setLoading(false);
        setReviews([]);
        // Load applications list for selector
        import('../services/seedData').then(m => {
          setApplications(m.mockApplications
            .filter(a => isAppLevel || scopeApplicationIds.includes(a.id))
            .map(a => ({ id: a.id, name: a.name })));
        }).catch(() => {
          setApplications([]);
          toast.error('خطا در بارگذاری سامانه‌ها.');
        });
      } else {
        setSelectedAppId(defaultApplicationId);
        loadData(defaultApplicationId);
      }
    }
  }, [activeContext, shouldSelectApplication, isAppLevel, scopeApplicationIds.join('|'), defaultApplicationId]);

  useEffect(() => {
    if (selectedAppId) loadData(selectedAppId);
  }, [selectedAppId]);

  const loadData = async (appId: string) => {
    if (!activeContext || !appId) return;
    setLoading(true);
    try {
      const data = await securityChecklistApi.getAllForApp(appId);
      setReviews(data as SecurityReview[]);
    } catch { toast.error('خطا در بارگذاری.'); }
    finally { setLoading(false); }
  };

  const handleSaveItem = async () => {
    if (!selectedReview || !editingItemId || !editResult) return;
    setActionLoading(true);
    try {
      const updated = await securityChecklistApi.updateItem(
        selectedReview.id, editingItemId, editResult, editNotes, activeContext!.userId
      );
      if (updated) setSelectedReview(updated as SecurityReview);
      setEditingItemId(null); setEditResult(''); setEditNotes('');
      toast.success('آیتم ذخیره شد.');
      loadData(selectedAppId);
    } catch { toast.error('خطا.'); }
    finally { setActionLoading(false); }
  };

  const handleComplete = async () => {
    if (!selectedReview) return;
    setActionLoading(true);
    try {
      await securityChecklistApi.complete(selectedReview.id, activeContext!.userId);
      toast.success('چک‌لیست تکمیل شد.');
      setShowDetailModal(false);
      loadData(selectedAppId);
    } catch { toast.error('خطا.'); }
    finally { setActionLoading(false); }
  };

  if (!activeContext) return null;

  // Filter
  let filtered = [...reviews];
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(r => r.testCaseTitle.toLowerCase().includes(s));
  }
  if (statusFilter) {
    filtered = filtered.filter(r => r.status === statusFilter);
  }

  // Stats
  const totalCount = reviews.length;
  const pendingCount = reviews.filter(r => r.status === 'PENDING').length;
  const inProgressCount = reviews.filter(r => r.status === 'IN_PROGRESS').length;
  const completedCount = reviews.filter(r => r.status === 'COMPLETED').length;

  const getResultIcon = (result?: string) => {
    switch (result) {
      case 'PASS': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'FAIL': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'PARTIAL': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'N_A': return <Minus className="w-4 h-4 text-gray-400" />;
      default: return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const columns = [
    {
      key: 'testCase', title: 'تست کیس',
      render: (item: SecurityReview) => (
        <div>
          <p className="font-medium text-gray-900">{item.testCaseTitle}</p>
          <p className="text-xs text-gray-500 font-mono">ID: {item.testCaseId}</p>
        </div>
      ),
    },
    {
      key: 'status', title: 'وضعیت',
      render: (item: SecurityReview) => (
        <Badge
          variant={item.status === 'COMPLETED' ? 'success' : item.status === 'IN_PROGRESS' ? 'info' : 'default'}
        >
          {STATUS_LABELS[item.status]}
        </Badge>
      ),
    },
    ...(shouldShowSystemColumn ? [{
      key: 'applicationId',
      title: 'سامانه',
      render: (item: SecurityReview) => <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{getApplicationName(item.applicationId)}</span>,
    }] : []),
    {
      key: 'progress', title: 'پیشرفت',
      render: (item: SecurityReview) => {
        const done = item.items.filter(i => i.result).length;
        const total = item.items.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-gray-600">{done}/{total}</span>
          </div>
        );
      },
    },
    {
      key: 'date', title: 'تاریخ',
      render: (item: SecurityReview) => new Date(item.createdAt).toLocaleDateString('fa-IR'),
    },
    {
      key: 'actions', title: 'عملیات',
      render: (item: SecurityReview) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" icon={<Eye className="w-4 h-4" />}
            onClick={(e) => { e.stopPropagation(); setSelectedReview(item); setShowDetailModal(true); }}>
            {canReview && item.status !== 'COMPLETED' ? 'بررسی' : 'مشاهده'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="کارتابل بازبین امنیت"
        subtitle="چک‌لیست امنیتی به ازای هر تست کیس"
        onRefresh={() => { if (selectedAppId) loadData(selectedAppId); }}
        refreshing={loading}
      />

      <main className="p-4 sm:p-6">
        {/* Item #10: System selector for APP-level users */}
        {shouldSelectApplication && (
          <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <label className="block text-sm font-medium text-indigo-800 mb-2">انتخاب سامانه</label>
            <div className="flex flex-wrap gap-2">
              {applications.map(app => (
                <button key={app.id} onClick={() => setSelectedAppId(app.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedAppId === app.id
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-white text-indigo-700 border border-indigo-300 hover:bg-indigo-100'
                  }`}>
                  {app.name}
                </button>
              ))}
            </div>
            {!selectedAppId && <p className="text-sm text-indigo-600 mt-2">لطفاً ابتدا یک سامانه انتخاب کنید تا تست کیس‌ها نمایش داده شوند.</p>}
          </div>
        )}

        {/* Show content only when system is selected */}
        {(!shouldSelectApplication || selectedAppId) && (<>
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="کل تست کیس‌ها" value={totalCount} icon={<ShieldCheck className="w-6 h-6" />} />
          <StatCard title="در انتظار بررسی" value={pendingCount} icon={<AlertTriangle className="w-6 h-6" />} variant="warning" />
          <StatCard title="در حال بررسی" value={inProgressCount} icon={<ShieldCheck className="w-6 h-6" />} variant="primary" />
          <StatCard title="تکمیل شده" value={completedCount} icon={<CheckCircle className="w-6 h-6" />} variant="success" />
        </div>

        {/* Info box removed per item #7 */}

        {/* Filters */}
        <Card className="mb-6" padding="sm">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="جستجو در تست کیس‌ها..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <select value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg">
              <option value="">همه وضعیت‌ها</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </Card>

        {/* Table */}
        <Table
          columns={columns}
          data={filtered}
          loading={loading}
          emptyMessage="هیچ تست کیسی ثبت نشده است. ابتدا تست کیس ایجاد کنید."
          onRowClick={(item) => { setSelectedReview(item); setShowDetailModal(true); }}
          rowClassName={(item) =>
            item.status === 'COMPLETED' ? 'bg-green-50' :
            item.status === 'IN_PROGRESS' ? 'bg-blue-50' : ''
          }
          enableClientFilter={false}
          enableExport={false}
          enableColumnChooser={false}
        />
        </>)}
      </main>

      {/* Detail/Review Modal */}
      <Modal isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setEditingItemId(null); }}
        title={`بررسی امنیتی: ${selectedReview?.testCaseTitle || ''}`} size="xl">
        {selectedReview && (
          <div className="space-y-6">
            {/* Status header */}
            <div className="flex items-center justify-between">
              <Badge variant={selectedReview.status === 'COMPLETED' ? 'success' : selectedReview.status === 'IN_PROGRESS' ? 'info' : 'default'}>
                {STATUS_LABELS[selectedReview.status]}
              </Badge>
              <span className="text-sm text-gray-500">
                {selectedReview.items.filter(i => i.result).length} از {selectedReview.items.length} آیتم بررسی شده
              </span>
            </div>

            {/* Checklist items */}
            <div className="space-y-3">
              {selectedReview.items.map((item, idx) => (
                <div key={item.id} className={`p-4 rounded-lg border ${
                  item.result === 'PASS' ? 'bg-green-50 border-green-200' :
                  item.result === 'FAIL' ? 'bg-red-50 border-red-200' :
                  item.result === 'PARTIAL' ? 'bg-amber-50 border-amber-200' :
                  item.result === 'N_A' ? 'bg-gray-50 border-gray-200' :
                  'bg-white border-gray-200'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-medium text-gray-400 mt-0.5">{idx + 1}.</span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.title}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>
                        {item.notes && (
                          <p className="text-sm text-gray-600 mt-2 p-2 bg-white rounded border">یادداشت: {item.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getResultIcon(item.result)}
                      {item.result && <span className="text-xs">{RESULT_LABELS[item.result]}</span>}
                    </div>
                  </div>

                  {/* Edit form for this item */}
                  {canReview && selectedReview.status !== 'COMPLETED' && editingItemId === item.id && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
                      <Select label="نتیجه بررسی *" value={editResult}
                        onChange={(e) => setEditResult(e.target.value as ItemResult)}
                        options={Object.entries(RESULT_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                        placeholder="نتیجه را انتخاب کنید" />
                      <Textarea label="یادداشت (اختیاری)" value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)} placeholder="توضیحات اضافی..." />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="secondary" onClick={() => { setEditingItemId(null); setEditResult(''); setEditNotes(''); }}>انصراف</Button>
                        <Button size="sm" onClick={handleSaveItem} loading={actionLoading} disabled={!editResult || actionLoading}>ذخیره</Button>
                      </div>
                    </div>
                  )}

                  {/* Review button */}
                  {canReview && selectedReview.status !== 'COMPLETED' && editingItemId !== item.id && (
                    <div className="mt-2">
                      <Button size="sm" variant="ghost"
                        onClick={() => { setEditingItemId(item.id); setEditResult(item.result || ''); setEditNotes(item.notes || ''); }}>
                        {item.result ? 'ویرایش نتیجه' : 'ثبت نتیجه'}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              {canReview && selectedReview.status !== 'COMPLETED' && (
                <Button variant="primary" icon={<CheckCircle className="w-4 h-4" />}
                  onClick={handleComplete} loading={actionLoading}>
                  تکمیل چک‌لیست
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
