import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { ArrowRight, Bug as BugIcon, CheckCircle, Clock, CornerDownRight, GripVertical, PlayCircle, RotateCcw, Send, XCircle } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge, PriorityBadge, StatusBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Textarea } from '../components/ui/Input';
import { useAuthStore } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import { bugApi, commentApi } from '../services/api';
import { toast } from '../components/ui/Toast';
import { isSemVer, SEMVER_HINT } from '../utils/semver';
import { sanitizeVersionInput, VERSION_INPUT_HINT } from '../utils/inputRules';
import type { Bug, BugStatus } from '../types';
import { BUG_SEVERITY_LABELS, BUG_STATUS_LABELS } from '../types';

type BoardColumn = {
  id: string;
  title: string;
  subtitle: string;
  statuses: BugStatus[];
  accent: string;
};

const BOARD_COLUMNS: BoardColumn[] = [
  {
    id: 'todo',
    title: 'برای انجام',
    subtitle: 'باگ‌هایی که به شما تخصیص داده شده‌اند',
    statuses: ['ASSIGNED'],
    accent: 'border-amber-200 bg-amber-50',
  },
  {
    id: 'doing',
    title: 'در حال رفع',
    subtitle: 'کارهایی که الان روی آن‌ها کار می‌کنید',
    statuses: ['IN_PROGRESS'],
    accent: 'border-blue-200 bg-blue-50',
  },
  {
    id: 'ready',
    title: 'آماده تست',
    subtitle: 'رفع شده و منتظر Retest/Regression',
    statuses: ['FIXED', 'RETEST_READY'],
    accent: 'border-green-200 bg-green-50',
  },
  {
    id: 'needs-action',
    title: 'نیازمند اقدام مجدد',
    subtitle: 'بازگشایی یا شکست Retest',
    statuses: ['RETEST_FAILED', 'REOPENED'],
    accent: 'border-red-200 bg-red-50',
  },
  {
    id: 'no-action',
    title: 'بدون نیاز به اقدام',
    subtitle: 'مواردی که Developer اقدام لازم ندارد',
    statuses: ['NO_ACTION_NEEDED'],
    accent: 'border-slate-200 bg-slate-50',
  },
  {
    id: 'not-bug',
    title: 'باگ نیست',
    subtitle: 'موارد ردشده توسط Developer',
    statuses: ['REJECTED'],
    accent: 'border-gray-200 bg-gray-50',
  },
];

export const DeveloperBoardPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { appId } = useDataScope();
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedBug, setSelectedBug] = useState<Bug | null>(null);
  const [showFixModal, setShowFixModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showNoActionModal, setShowNoActionModal] = useState(false);
  const [fixVersion, setFixVersion] = useState('');
  const [fixNotes, setFixNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [noActionReason, setNoActionReason] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [draggedBugId, setDraggedBugId] = useState<string | null>(null);
  const [dropColumnId, setDropColumnId] = useState<string | null>(null);

  useEffect(() => {
    if (activeContext) loadBugs();
  }, [activeContext, appId]);

  const loadBugs = async () => {
    if (!activeContext) return;
    setLoading(true);
    try {
      const response = await bugApi.getVisibleForRole(
        appId,
        { page: 1, limit: 500, search: '', status: '', sortBy: 'updatedAt', sortOrder: 'desc' },
        activeContext.userId,
        activeContext.role
      );
      setBugs(response.data);
    } catch {
      toast.error('بارگذاری برد توسعه ممکن نیست.');
    } finally {
      setLoading(false);
    }
  };

  const totalByColumn = useMemo(() => {
    return BOARD_COLUMNS.reduce<Record<string, number>>((acc, column) => {
      acc[column.id] = bugs.filter(bug => column.statuses.includes(bug.status)).length;
      return acc;
    }, {});
  }, [bugs]);

  const getBugRunLabel = (bug: Bug) =>
    bug.testRun?.testCase?.title
    || (bug.testRun?.version ? `اجرای نسخه ${bug.testRun.version}` : '')
    || bug.testRunId;

  const changeStatus = async (bug: Bug, status: BugStatus, notes = '') => {
    if (!activeContext) return;
    setActionLoading(true);
    try {
      const updated = await bugApi.updateStatus(bug.id, status, notes, activeContext.userId);
      if (!updated) throw new Error('STATUS_CHANGE_FAILED');
      await commentApi.create('BUG', bug.id, `تغییر وضعیت از برد توسعه: ${BUG_STATUS_LABELS[status]}`, activeContext.userId);
      toast.success('وضعیت باگ بروزرسانی شد.');
      await loadBugs();
    } catch {
      toast.error('تغییر وضعیت باگ ممکن نیست.');
    } finally {
      setActionLoading(false);
    }
  };

  const canRestoreBug = (bug: Bug) =>
    !bug.isLocked && !!bug.previousStatus && ['REJECTED', 'NO_ACTION_NEEDED'].includes(bug.status);

  const restorePreviousStatus = async (bug: Bug) => {
    if (!activeContext || !canRestoreBug(bug)) return;
    setActionLoading(true);
    try {
      const restored = await bugApi.restorePreviousStatus(bug.id, activeContext.userId);
      if (!restored) throw new Error('RESTORE_FAILED');
      await commentApi.create('BUG', bug.id, `بازگردانی وضعیت از ${BUG_STATUS_LABELS[bug.status]} به ${BUG_STATUS_LABELS[restored.status]}`, activeContext.userId);
      toast.success('وضعیت قبلی باگ بازگردانده شد.');
      await loadBugs();
    } catch {
      toast.error('بازگردانی وضعیت باگ ممکن نیست.');
    } finally {
      setActionLoading(false);
    }
  };

  const openFix = (bug: Bug) => {
    setSelectedBug(bug);
    setFixVersion(bug.fixedVersion || '');
    setFixNotes(bug.fixNotes || '');
    setFormErrors({});
    setShowFixModal(true);
  };

  const openReject = (bug: Bug) => {
    setSelectedBug(bug);
    setRejectReason('');
    setFormErrors({});
    setShowRejectModal(true);
  };

  const openNoAction = (bug: Bug) => {
    setSelectedBug(bug);
    setNoActionReason('');
    setFormErrors({});
    setShowNoActionModal(true);
  };

  const handleFixVersionChange = (value: string) => {
    const sanitized = sanitizeVersionInput(value);
    setFixVersion(sanitized.value);
    setFormErrors(prev => ({ ...prev, fixVersion: sanitized.error || '' }));
  };

  const submitFix = async () => {
    if (!activeContext || !selectedBug) return;
    if (!fixVersion.trim()) {
      setFormErrors({ fixVersion: 'نسخه رفع الزامی است.' });
      return;
    }
    if (!isSemVer(fixVersion)) {
      setFormErrors({ fixVersion: SEMVER_HINT });
      return;
    }
    if (sanitizeVersionInput(fixVersion).error) {
      setFormErrors({ fixVersion: VERSION_INPUT_HINT });
      return;
    }
    setActionLoading(true);
    try {
      await bugApi.setFixedVersion(selectedBug.id, fixVersion.trim(), activeContext.userId);
      if (fixNotes.trim()) {
        await commentApi.create('BUG', selectedBug.id, `یادداشت رفع: ${fixNotes.trim()}`, activeContext.userId);
      }
      const ready = await bugApi.markReadyForRetest(selectedBug.id, activeContext.userId);
      if (!ready) throw new Error('READY_FOR_RETEST_FAILED');
      await commentApi.create('BUG', selectedBug.id, `آماده Retest/Regression از برد توسعه - نسخه: ${fixVersion.trim()}`, activeContext.userId);
      toast.success('باگ برای تست مجدد آماده شد.');
      setShowFixModal(false);
      setSelectedBug(null);
      await loadBugs();
    } catch {
      toast.error('ثبت رفع باگ ممکن نیست.');
    } finally {
      setActionLoading(false);
    }
  };

  const submitReject = async () => {
    if (!activeContext || !selectedBug) return;
    if (!rejectReason.trim()) {
      setFormErrors({ rejectReason: 'دلیل باگ نبودن الزامی است.' });
      return;
    }
    setActionLoading(true);
    try {
      const updated = await bugApi.updateStatus(selectedBug.id, 'REJECTED', rejectReason.trim(), activeContext.userId);
      if (!updated) throw new Error('REJECT_FAILED');
      await commentApi.create('BUG', selectedBug.id, `باگ نیست از برد توسعه: ${rejectReason.trim()}`, activeContext.userId);
      toast.success('نتیجه «باگ نیست» ثبت شد.');
      setShowRejectModal(false);
      setSelectedBug(null);
      await loadBugs();
    } catch {
      toast.error('ثبت نتیجه «باگ نیست» ممکن نیست.');
    } finally {
      setActionLoading(false);
    }
  };

  const submitNoAction = async () => {
    if (!activeContext || !selectedBug) return;
    if (!noActionReason.trim()) {
      setFormErrors({ noActionReason: 'دلیل بدون نیاز به اقدام الزامی است.' });
      return;
    }
    setActionLoading(true);
    try {
      const updated = await bugApi.updateStatus(selectedBug.id, 'NO_ACTION_NEEDED', noActionReason.trim(), activeContext.userId);
      if (!updated) throw new Error('NO_ACTION_FAILED');
      await commentApi.create('BUG', selectedBug.id, `بدون نیاز به اقدام از برد توسعه: ${noActionReason.trim()}`, activeContext.userId);
      toast.success('وضعیت «بدون نیاز به اقدام» ثبت شد.');
      setShowNoActionModal(false);
      setSelectedBug(null);
      await loadBugs();
    } catch {
      toast.error('ثبت وضعیت «بدون نیاز به اقدام» ممکن نیست.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDragStart = (event: DragEvent, bugId: string) => {
    setDraggedBugId(bugId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', bugId);
    event.dataTransfer.setDragImage(event.currentTarget as Element, 24, 24);
  };

  const handleDropOnColumn = async (event: DragEvent, column: BoardColumn) => {
    event.preventDefault();
    const bugId = event.dataTransfer.getData('text/plain') || draggedBugId;
    setDraggedBugId(null);
    setDropColumnId(null);
    const bug = bugs.find(item => item.id === bugId);
    if (!bug) return;
    if (bug.isLocked) {
      toast.warning('باگ قفل‌شده قابل جابه‌جایی نیست.');
      return;
    }
    if (column.statuses.includes(bug.status)) return;

    if (column.id === 'no-action') {
      openNoAction(bug);
      return;
    }

    if (column.id === 'doing' && ['ASSIGNED', 'RETEST_FAILED', 'REOPENED'].includes(bug.status)) {
      await changeStatus(bug, 'IN_PROGRESS');
      return;
    }

    if (column.id === 'ready') {
      if (bug.status === 'IN_PROGRESS') {
        openFix(bug);
        return;
      }
      toast.warning('برای آماده تست کردن، باگ باید ابتدا در وضعیت «در حال رفع» باشد.');
      return;
    }

    toast.warning('این جابه‌جایی با گردش‌کار باگ مجاز نیست.');
  };

  const renderActions = (bug: Bug) => {
    if (bug.isLocked) {
      return <Badge variant="warning" size="sm">قفل شده</Badge>;
    }
    if (canRestoreBug(bug)) {
      return (
        <Button size="sm" variant="secondary" icon={<RotateCcw className="w-4 h-4" />} onClick={() => restorePreviousStatus(bug)} loading={actionLoading}>
          بازگردانی به {BUG_STATUS_LABELS[bug.previousStatus!]}
        </Button>
      );
    }
    if (['NO_ACTION_NEEDED', 'REJECTED'].includes(bug.status)) {
      return <Badge variant="default" size="sm">{BUG_STATUS_LABELS[bug.status]}</Badge>;
    }
    const noActionButton = (
      <Button size="sm" variant="ghost" icon={<CornerDownRight className="w-4 h-4" />} onClick={() => openNoAction(bug)}>
        بدون نیاز به اقدام
      </Button>
    );
    if (bug.status === 'ASSIGNED') {
      return (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<PlayCircle className="w-4 h-4" />} onClick={() => changeStatus(bug, 'IN_PROGRESS')} loading={actionLoading}>
            شروع رفع
          </Button>
          <Button size="sm" variant="ghost" icon={<XCircle className="w-4 h-4" />} onClick={() => openReject(bug)}>
            باگ نیست
          </Button>
          {noActionButton}
        </div>
      );
    }
    if (bug.status === 'IN_PROGRESS') {
      return (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<Send className="w-4 h-4" />} onClick={() => openFix(bug)}>
            رفع شد
          </Button>
          {noActionButton}
        </div>
      );
    }
    if (['RETEST_FAILED', 'REOPENED'].includes(bug.status)) {
      return (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<ArrowRight className="w-4 h-4" />} onClick={() => changeStatus(bug, 'IN_PROGRESS')} loading={actionLoading}>
            شروع مجدد
          </Button>
          {noActionButton}
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-2 items-center">
        <Badge variant="success" size="sm">منتظر QA</Badge>
        {noActionButton}
      </div>
    );
  };

  if (!activeContext) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="برد توسعه"
        subtitle={`${bugs.length} باگ قابل اقدام برای ${activeContext.user.fullName}`}
        onRefresh={loadBugs}
        refreshing={loading}
      />

      <main className="p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {BOARD_COLUMNS.map(column => (
            <Card key={column.id} className={column.accent} padding="sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{column.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{totalByColumn[column.id] || 0}</p>
                </div>
                {column.id === 'ready' ? <CheckCircle className="w-6 h-6 text-green-600" /> : <Clock className="w-6 h-6 text-gray-500" />}
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4 items-start">
          {BOARD_COLUMNS.map(column => {
            const columnBugs = bugs.filter(bug => column.statuses.includes(bug.status));
            return (
              <section
                key={column.id}
                onDragOver={(event) => { event.preventDefault(); setDropColumnId(column.id); }}
                onDragLeave={() => setDropColumnId(prev => prev === column.id ? null : prev)}
                onDrop={(event) => handleDropOnColumn(event, column)}
                className={`rounded-xl border p-3 min-h-[360px] transition-all ${column.accent} ${dropColumnId === column.id ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{column.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{column.subtitle}</p>
                  </div>
                  <Badge variant="default" size="sm">{columnBugs.length}</Badge>
                </div>

                <div className="space-y-3">
                  {loading && columnBugs.length === 0 && (
                    <div className="p-4 bg-white/70 rounded-lg text-sm text-gray-500 text-center">در حال بارگذاری...</div>
                  )}
                  {!loading && columnBugs.length === 0 && (
                    <div className="p-4 bg-white/70 rounded-lg text-sm text-gray-500 text-center">موردی وجود ندارد.</div>
                  )}
                  {columnBugs.map(bug => (
                    <article
                      key={bug.id}
                      draggable={!bug.isLocked}
                      onDragStart={(event) => handleDragStart(event, bug.id)}
                      onDragEnd={() => { setDraggedBugId(null); setDropColumnId(null); }}
                      className={`bg-white rounded-lg border border-gray-200 p-3 shadow-sm space-y-3 transition-all duration-200 cursor-grab active:cursor-grabbing ${
                        draggedBugId === bug.id ? 'opacity-75 scale-[0.98] rotate-1 ring-2 ring-blue-400 shadow-lg' : 'hover:-translate-y-0.5 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-medium text-gray-900 leading-6">{bug.title}</h4>
                          <p className="text-xs text-gray-500 mt-1">اجرا: {getBugRunLabel(bug)}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span
                            title="کارت را بکشید و در ستون مقصد رها کنید"
                            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                          >
                            <GripVertical className="w-4 h-4" />
                          </span>
                          <BugIcon className="w-5 h-5 text-red-500" />
                        </div>
                      </div>
                      {bug.description && <p className="text-sm text-gray-600 line-clamp-2">{bug.description}</p>}
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge status={bug.status} labels={BUG_STATUS_LABELS} />
                        <StatusBadge status={bug.severity} labels={BUG_SEVERITY_LABELS} />
                        <PriorityBadge priority={bug.priority} />
                      </div>
                      {bug.fixedVersion && (
                        <div className="text-xs text-green-700 bg-green-50 rounded-md px-2 py-1">
                          نسخه رفع: {bug.fixedVersion}
                        </div>
                      )}
                      <div className="pt-2 border-t border-gray-100">
                        {renderActions(bug)}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      <Modal isOpen={showFixModal} onClose={() => setShowFixModal(false)} title="ثبت رفع باگ" size="md">
        <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg border">
            <p className="text-sm font-medium text-gray-900">{selectedBug?.title}</p>
            <p className="text-xs text-gray-500 mt-1">بعد از ثبت، باگ خودکار به صف Retest/Regression می‌رود.</p>
          </div>
          <Input label="نسخه رفع *" value={fixVersion} onChange={(e) => handleFixVersionChange(e.target.value)} placeholder="2.5.1" error={formErrors.fixVersion} />
          <Textarea label="یادداشت رفع" value={fixNotes} onChange={(e) => setFixNotes(e.target.value)} placeholder="توضیح کوتاه درباره تغییر انجام‌شده..." />
          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button variant="secondary" onClick={() => setShowFixModal(false)}>انصراف</Button>
            <Button icon={<Send className="w-4 h-4" />} onClick={submitFix} loading={actionLoading} disabled={!fixVersion.trim() || actionLoading}>
              آماده تست
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="ثبت «باگ نیست»" size="md">
        <div className="space-y-4">
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm font-medium text-red-800">{selectedBug?.title}</p>
            <p className="text-xs text-red-600 mt-1">برای ثبت باگ نبودن، دلیل قابل پیگیری ثبت کنید.</p>
          </div>
          <Textarea label="دلیل باگ نبودن *" value={rejectReason} onChange={(e) => { setFormErrors({}); setRejectReason(e.target.value); }} placeholder="چرا این مورد باگ نیست؟" error={formErrors.rejectReason} />
          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button variant="secondary" onClick={() => setShowRejectModal(false)}>انصراف</Button>
            <Button variant="danger" icon={<XCircle className="w-4 h-4" />} onClick={submitReject} loading={actionLoading} disabled={!rejectReason.trim() || actionLoading}>
              ثبت باگ نیست
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showNoActionModal} onClose={() => setShowNoActionModal(false)} title="ثبت «بدون نیاز به اقدام»" size="md">
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-sm font-medium text-slate-800">{selectedBug?.title}</p>
            <p className="text-xs text-slate-600 mt-1">اگر این مورد نیاز به اقدام توسعه ندارد، دلیل قابل پیگیری ثبت کنید.</p>
          </div>
          <Textarea
            label="دلیل بدون نیاز به اقدام *"
            value={noActionReason}
            onChange={(e) => { setFormErrors({}); setNoActionReason(e.target.value); }}
            placeholder="چرا این مورد نیاز به اقدام توسعه ندارد؟"
            error={formErrors.noActionReason}
          />
          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button variant="secondary" onClick={() => setShowNoActionModal(false)}>انصراف</Button>
            <Button variant="secondary" icon={<CornerDownRight className="w-4 h-4" />} onClick={submitNoAction} loading={actionLoading} disabled={!noActionReason.trim() || actionLoading}>
              ثبت بدون نیاز به اقدام
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
