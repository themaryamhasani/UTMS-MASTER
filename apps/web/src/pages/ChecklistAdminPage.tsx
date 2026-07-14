import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, ShieldCheck, CheckCircle, XCircle, AlertTriangle, Eye, Search } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Input, Textarea } from '../components/ui/Input';
import { useAuthStore } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import { securityChecklistApi } from '../services/api';
import { toast } from '../components/ui/Toast';

interface TemplateItem {
  title: string;
  description: string;
}

type SecurityReviewStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
type SecurityReviewResult = 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT_TESTED' | 'N_A';

interface SecurityReviewItem {
  id: string;
  title: string;
  description: string;
  result?: SecurityReviewResult;
  notes?: string;
}

interface SecurityReviewRecord {
  id: string;
  testCaseId: string;
  testCaseTitle: string;
  applicationId: string;
  status: SecurityReviewStatus;
  items: SecurityReviewItem[];
  reviewedById?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const ChecklistAdminPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { defaultApplicationId } = useDataScope();
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Reviews for monitoring
  const [reviews, setReviews] = useState<SecurityReviewRecord[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');

  // Template CRUD
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editIndex, setEditIndex] = useState(-1);
  const [itemForm, setItemForm] = useState({ title: '', description: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState(false);

  // Review detail
  const [showReviewDetail, setShowReviewDetail] = useState(false);
  const [selectedReview, setSelectedReview] = useState<SecurityReviewRecord | null>(null);

  const [activeTab, setActiveTab] = useState<'template' | 'reviews'>('template');

  useEffect(() => { if (activeContext) { loadTemplate(); loadReviews(); } }, [activeContext]);

  const loadTemplate = async () => {
    setLoading(true);
    try {
      const items = await securityChecklistApi.getTemplate();
      setTemplateItems(items);
    } catch { toast.error('خطا.'); }
    finally { setLoading(false); }
  };

  const loadReviews = async () => {
    if (!activeContext) return;
    setReviewsLoading(true);
    try {
      const data = await securityChecklistApi.getAllForApp(defaultApplicationId);
      setReviews(data);
    } catch { toast.error('خطا.'); }
    finally { setReviewsLoading(false); }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!itemForm.title.trim()) errors.title = 'عنوان آیتم الزامی است.';
    if (!itemForm.description.trim()) errors.description = 'توضیحات الزامی است.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAdd = async () => {
    if (!validateForm()) return;
    setActionLoading(true);
    try {
      const updated = await securityChecklistApi.addTemplateItem(itemForm.title.trim(), itemForm.description.trim());
      setTemplateItems(updated);
      setShowAddModal(false);
      setItemForm({ title: '', description: '' });
      toast.success('آیتم چک‌لیست اضافه شد.');
    } catch { toast.error('خطا.'); }
    finally { setActionLoading(false); }
  };

  const handleEdit = async () => {
    if (!validateForm() || editIndex < 0) return;
    setActionLoading(true);
    try {
      const updated = await securityChecklistApi.updateTemplateItem(editIndex, itemForm.title.trim(), itemForm.description.trim());
      setTemplateItems(updated);
      setShowEditModal(false);
      toast.success('آیتم ویرایش شد.');
    } catch { toast.error('خطا.'); }
    finally { setActionLoading(false); }
  };

  const handleDelete = async () => {
    if (editIndex < 0) return;
    setActionLoading(true);
    try {
      const updated = await securityChecklistApi.deleteTemplateItem(editIndex);
      setTemplateItems(updated);
      setShowDeleteConfirm(false);
      toast.success('آیتم حذف شد.');
    } catch { toast.error('خطا.'); }
    finally { setActionLoading(false); }
  };

  if (!activeContext) return null;

  // Stats
  const completedCount = reviews.filter(r => r.status === 'COMPLETED').length;
  const pendingCount = reviews.filter(r => r.status === 'PENDING').length;
  const inProgressCount = reviews.filter(r => r.status === 'IN_PROGRESS').length;

  // Filter reviews
  let filteredReviews = [...reviews];
  if (searchFilter) {
    const s = searchFilter.toLowerCase();
    filteredReviews = filteredReviews.filter(r => r.testCaseTitle.toLowerCase().includes(s));
  }

  const RESULT_LABELS: Record<string, string> = { PASS: 'قبول', FAIL: 'رد', PARTIAL: 'ناقص', NOT_TESTED: 'تست نشده', N_A: 'غیرقابل اعمال' };

  const getResultIcon = (result?: string) => {
    switch (result) {
      case 'PASS': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'FAIL': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'PARTIAL': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <span className="text-gray-400 text-xs">—</span>;
    }
  };

  const reviewColumns = [
    {
      key: 'testCase', title: 'تست کیس',
      render: (item: SecurityReviewRecord) => <p className="font-medium text-gray-900">{item.testCaseTitle}</p>,
    },
    {
      key: 'status', title: 'وضعیت',
      render: (item: SecurityReviewRecord) => (
        <Badge variant={item.status === 'COMPLETED' ? 'success' : item.status === 'IN_PROGRESS' ? 'info' : 'default'}>
          {item.status === 'COMPLETED' ? 'تکمیل شده' : item.status === 'IN_PROGRESS' ? 'در حال بررسی' : 'در انتظار'}
        </Badge>
      ),
    },
    {
      key: 'progress', title: 'پیشرفت',
      render: (item: SecurityReviewRecord) => {
        const done = item.items.filter(i => i.result).length;
        const total = item.items.length;
        return <span className="text-sm">{done}/{total}</span>;
      },
    },
    {
      key: 'actions', title: 'عملیات',
      render: (item: SecurityReviewRecord) => (
        <Button size="sm" variant="ghost" icon={<Eye className="w-4 h-4" />}
          onClick={() => { setSelectedReview(item); setShowReviewDetail(true); }}>جزئیات</Button>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="بک‌آفیس چک‌لیست بازبین امنیت"
        subtitle="مدیریت آیتم‌های قالب چک‌لیست و نظارت بر وضعیت بررسی‌ها"
        onRefresh={() => { loadTemplate(); loadReviews(); }}
        refreshing={loading || reviewsLoading} />

      <main className="p-4 sm:p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="آیتم‌های قالب" value={templateItems.length} icon={<ShieldCheck className="w-6 h-6" />} />
          <StatCard title="تست کیس‌ها (کل)" value={reviews.length} icon={<ShieldCheck className="w-6 h-6" />} />
          <StatCard title="در انتظار/در حال بررسی" value={pendingCount + inProgressCount} icon={<AlertTriangle className="w-6 h-6" />} variant="warning" />
          <StatCard title="تکمیل شده" value={completedCount} icon={<CheckCircle className="w-6 h-6" />} variant="success" />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button onClick={() => setActiveTab('template')}
            className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'template' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
            قالب چک‌لیست امنیتی
          </button>
          <button onClick={() => setActiveTab('reviews')}
            className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'reviews' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
            وضعیت بررسی‌ها
          </button>
        </div>

        {/* ===== TEMPLATE TAB ===== */}
        {activeTab === 'template' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-600">این آیتم‌ها به صورت خودکار برای هر تست کیس جدید ایجاد می‌شوند.</p>
              <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setItemForm({ title: '', description: '' }); setFormErrors({}); setShowAddModal(true); }}>
                افزودن آیتم
              </Button>
            </div>

            <div className="space-y-3">
              {templateItems.length === 0 ? (
                <Card className="text-center py-8">
                  <p className="text-gray-500">هیچ آیتمی در قالب وجود ندارد.</p>
                </Card>
              ) : (
                templateItems.map((item, idx) => (
                  <Card key={idx} padding="sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="text-sm font-medium text-gray-400 mt-0.5">{idx + 1}.</span>
                        <div>
                          <p className="font-medium text-gray-900">{item.title}</p>
                          <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" icon={<Edit className="w-4 h-4" />}
                          onClick={() => { setEditIndex(idx); setItemForm({ title: item.title, description: item.description }); setFormErrors({}); setShowEditModal(true); }}>
                          ویرایش
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600" icon={<Trash2 className="w-4 h-4" />}
                          onClick={() => { setEditIndex(idx); setShowDeleteConfirm(true); }}>
                          حذف
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </>
        )}

        {/* ===== REVIEWS TAB ===== */}
        {activeTab === 'reviews' && (
          <>
            <Card className="mb-4" padding="sm">
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="جستجو در تست کیس‌ها..." value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </Card>
            <Table columns={reviewColumns} data={filteredReviews} loading={reviewsLoading}
              emptyMessage="هیچ بررسی امنیتی ثبت نشده."
              onRowClick={(item) => { setSelectedReview(item); setShowReviewDetail(true); }} />
          </>
        )}
      </main>

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="افزودن آیتم به چک‌لیست" size="md">
        <div className="space-y-4">
          <Input label="عنوان آیتم *" placeholder="مثال: بررسی احراز هویت" value={itemForm.title}
            onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })} error={formErrors.title} />
          <Textarea label="توضیحات *" placeholder="شرح آیتم بررسی" value={itemForm.description}
            onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} error={formErrors.description} />
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>انصراف</Button>
            <Button onClick={handleAdd} loading={actionLoading} disabled={actionLoading}>افزودن</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="ویرایش آیتم چک‌لیست" size="md">
        <div className="space-y-4">
          <Input label="عنوان آیتم *" value={itemForm.title}
            onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })} error={formErrors.title} />
          <Textarea label="توضیحات *" value={itemForm.description}
            onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} error={formErrors.description} />
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>انصراف</Button>
            <Button onClick={handleEdit} loading={actionLoading} disabled={actionLoading}>ذخیره</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete} title="حذف آیتم چک‌لیست"
        message={`آیا از حذف آیتم «${templateItems[editIndex]?.title}» اطمینان دارید؟`}
        variant="danger" confirmText="حذف" loading={actionLoading} />

      {/* Review Detail Modal */}
      <Modal isOpen={showReviewDetail} onClose={() => setShowReviewDetail(false)} title="جزئیات بررسی امنیتی" size="xl">
        {selectedReview && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">{selectedReview.testCaseTitle}</h3>
              <Badge variant={selectedReview.status === 'COMPLETED' ? 'success' : selectedReview.status === 'IN_PROGRESS' ? 'info' : 'default'}>
                {selectedReview.status === 'COMPLETED' ? 'تکمیل شده' : selectedReview.status === 'IN_PROGRESS' ? 'در حال بررسی' : 'در انتظار'}
              </Badge>
            </div>
            <div className="space-y-2">
              {selectedReview.items.map((item, idx) => (
                <div key={item.id} className={`p-3 rounded-lg border ${
                  item.result === 'PASS' ? 'bg-green-50 border-green-200' :
                  item.result === 'FAIL' ? 'bg-red-50 border-red-200' :
                  'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-gray-400">{idx + 1}.</span>
                      <div>
                        <p className="font-medium text-sm">{item.title}</p>
                        {item.notes && <p className="text-xs text-gray-600 mt-1">{item.notes}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {getResultIcon(item.result)}
                      {item.result && <span className="text-xs">{RESULT_LABELS[item.result]}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowReviewDetail(false)}>بستن</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
