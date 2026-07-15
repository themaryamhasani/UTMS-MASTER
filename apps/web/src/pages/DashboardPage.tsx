import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Bug, 
  TestTube, 
  PlayCircle, 
  CheckCircle, 
  XCircle,
  Clock,
  AlertTriangle,
  Rocket,
  ShieldCheck,
} from 'lucide-react';
import { Card, StatCard } from '../components/ui/Card';
import { Header } from '../components/layout/Header';
import { useAuthStore } from '../stores/authStore';
import { useDataScope } from '../utils/useDataScope';
import { dashboardApi, testRequestApi, bugApi, checklistApi, releasePublishApi } from '../services/api';
import type { DashboardStats, TestRequest, Bug as BugType, Checklist, ReleasePublish } from '../types';
import { TEST_REQUEST_STATUS_LABELS, BUG_STATUS_LABELS, RELEASE_PUBLISH_STATUS_LABELS } from '../types';
import { StatusBadge, PriorityBadge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toast';

export const DashboardPage: React.FC = () => {
  const { activeContext } = useAuthStore();
  const { appId } = useDataScope();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentRequests, setRecentRequests] = useState<TestRequest[]>([]);
  const [criticalBugs, setCriticalBugs] = useState<BugType[]>([]);
  const [pendingChecklists, setPendingChecklists] = useState<Checklist[]>([]);
  const [pendingReleases, setPendingReleases] = useState<ReleasePublish[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeContext) {
      loadDashboardData();
    }
  }, [activeContext]);

  const loadDashboardData = async () => {
    if (!activeContext) return;
    setLoading(true);

    try {
      const [statsData, requestsData, bugsData, checklistsData, releasesData] = await Promise.all([
        dashboardApi.getStats(appId, activeContext.userId, activeContext.role),
        testRequestApi.getVisibleForRole(appId, { page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }, activeContext.userId, activeContext.role),
        bugApi.getCriticalOpenVisible(appId, activeContext.userId, activeContext.role),
        checklistApi.getPending(appId),
        releasePublishApi.getPendingQAReview(appId),
      ]);

      setStats(statsData);
      setRecentRequests(requestsData.data);
      setCriticalBugs(bugsData);
      setPendingChecklists(checklistsData);
      setPendingReleases(releasesData);
    } catch {
      setStats(null);
      setRecentRequests([]);
      setCriticalBugs([]);
      setPendingChecklists([]);
      setPendingReleases([]);
      toast.error('خطا در بارگذاری داشبورد.');
    } finally {
      setLoading(false);
    }
  };

  if (!activeContext) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title={`داشبورد ${getRoleLabel(activeContext.role)}`}
        subtitle={`خوش آمدید، ${activeContext.user.fullName}`}
        onRefresh={loadDashboardData}
        refreshing={loading}
      />

      <main className="p-4 sm:p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="درخواست‌های در انتظار"
            value={stats?.pendingTestRequests || 0}
            icon={<Clock className="w-6 h-6" />}
            variant="warning"
          />
          <StatCard
            title="درخواست‌های در حال انجام"
            value={stats?.inProgressTestRequests || 0}
            icon={<PlayCircle className="w-6 h-6" />}
            variant="primary"
          />
          <StatCard
            title="باگ‌های باز"
            value={stats?.pendingBugs || 0}
            icon={<Bug className="w-6 h-6" />}
            variant={stats?.criticalBugs ? 'danger' : 'default'}
          />
          <StatCard
            title="تصمیم‌های انتشار در انتظار"
            value={stats?.pendingReleases || 0}
            icon={<Rocket className="w-6 h-6" />}
            variant="success"
          />
        </div>

        {/* Second Row Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="تست کیس‌ها"
            value={stats?.totalTestCases || 0}
            icon={<TestTube className="w-6 h-6" />}
          />
          <StatCard
            title="تست‌های موفق"
            value={stats?.passedTestRuns || 0}
            icon={<CheckCircle className="w-6 h-6" />}
            variant="success"
          />
          <StatCard
            title="تست‌های ناموفق"
            value={stats?.failedTestRuns || 0}
            icon={<XCircle className="w-6 h-6" />}
            variant="danger"
          />
          <StatCard
            title="چک‌لیست‌های در انتظار"
            value={stats?.pendingChecklists || 0}
            icon={<ShieldCheck className="w-6 h-6" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Test Requests */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                درخواست‌های تست اخیر
              </h3>
            </div>
            <div className="space-y-3">
              {recentRequests.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  درخواستی وجود ندارد
                </p>
              ) : (
                recentRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{req.title}</p>
                        <p className="text-sm text-gray-700 mt-0.5">
                          نسخه: {req.version}
                        </p>
                      </div>
                      <StatusBadge
                        status={req.status}
                        labels={TEST_REQUEST_STATUS_LABELS}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <PriorityBadge priority={req.priority} />
                        <span className="text-xs text-gray-600">
                        {formatDate(req.createdAt)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Critical Bugs */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                باگ‌های بحرانی و اصلی
              </h3>
            </div>
            <div className="space-y-3">
              {criticalBugs.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  باگ بحرانی یا اصلی وجود ندارد ✓
                </p>
              ) : (
                criticalBugs.slice(0, 5).map((bug) => (
                  <div
                    key={bug.id}
                    className="p-3 bg-red-50 rounded-lg border border-red-100"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{bug.title}</p>
                        <p className="text-sm text-gray-700 mt-0.5">
                          گزارش‌دهنده: {bug.reportedBy?.fullName}
                        </p>
                      </div>
                      <StatusBadge
                        status={bug.status}
                        labels={BUG_STATUS_LABELS}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <PriorityBadge priority={bug.severity} />
                      {bug.assignee && (
                        <span className="text-xs text-gray-500">
                          تخصیص به: {bug.assignee.fullName}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Pending Checklists */}
          {pendingChecklists.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-500" />
                  چک‌لیست‌های در انتظار
                </h3>
              </div>
              <div className="space-y-3">
                {pendingChecklists.map((cl) => (
                  <div
                    key={cl.id}
                    className="p-3 bg-purple-50 rounded-lg border border-purple-100"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          چک‌لیست {getChecklistTypeLabel(cl.type)}
                        </p>
                        <p className="text-sm text-gray-700 mt-0.5">
                          {cl.items.filter(i => i.result).length} از {cl.items.length} مورد تکمیل شده
                        </p>
                      </div>
                      <StatusBadge
                        status={cl.status}
                        labels={{ PENDING: 'در انتظار', IN_PROGRESS: 'در حال بررسی' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Pending Releases */}
          {pendingReleases.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-green-500" />
                  تصمیم‌های انتشار در انتظار
                </h3>
              </div>
              <div className="space-y-3">
                {pendingReleases.map((rp) => (
                  <div
                    key={rp.id}
                    className="p-3 bg-green-50 rounded-lg border border-green-100"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          نسخه {rp.version}
                          {rp.buildNumber && ` (${rp.buildNumber})`}
                        </p>
                        <p className="text-sm text-gray-700 mt-0.5">
                          {rp.isEmergency ? 'Tag اضطراری' : 'تصمیم عادی'}
                        </p>
                      </div>
                      <StatusBadge
                        status={rp.status}
                        labels={RELEASE_PUBLISH_STATUS_LABELS}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    SYSTEM_ADMIN: 'مدیر سیستم',
    DEVELOPER: 'توسعه‌دهنده',
    QA_LEAD: 'سرپرست QA',
    QA_SPECIALIST: 'متخصص QA',
    BA: 'تحلیلگر کسب‌وکار',
    SECURITY_REVIEWER: 'بازبین امنیت',
    TECH_LEAD: 'سرپرست فنی',
    PRODUCT_OWNER: 'مالک محصول',
  };
  return labels[role] || role;
}

function getChecklistTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    SECURITY: 'امنیت',
    PERFORMANCE: 'کارایی',
    PENETRATION: 'نفوذ',
  };
  return labels[type] || type;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fa-IR');
}
