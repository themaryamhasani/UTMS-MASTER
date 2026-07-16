import { useState, useEffect, type ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, canAccessCartable } from './stores/authStore';
import { Sidebar } from './components/layout/Sidebar';
import { Footer } from './components/layout/Footer';
import { Modal } from './components/ui/Modal';
import { Button } from './components/ui/Button';
import { ToastContainer } from './components/ui/Toast';
import { ThemeToggle } from './components/theme/ThemeToggle';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TestRequestsPage } from './pages/TestRequestsPage';
import { RequirementsPage } from './pages/RequirementsPage';
import { TestCasesPage } from './pages/TestCasesPage';
import { TestRunsBugsPage } from './pages/TestRunsBugsPage';
import { BugsPage } from './pages/BugsPage';
import { DeveloperBoardPage } from './pages/DeveloperBoardPage';
import { RunIssuesPage } from './pages/RunIssuesPage';
import { ChecklistsPage } from './pages/ChecklistsPage';
import { PlaywrightPage } from './pages/PlaywrightPage';
import { PlaywrightFilesPage } from './pages/PlaywrightFilesPage';
import { ReleasesPage } from './pages/ReleasesPage';
import { UsersPage } from './pages/UsersPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { AuditPage } from './pages/AuditPage';
import { SettingsPage } from './pages/SettingsPage';
import { ChecklistAdminPage } from './pages/ChecklistAdminPage';
import { ReportsPage } from './pages/ReportsPage';
import { AdminOperationsPage } from './pages/AdminOperationsPage';
import { OnlineApiConsolePage } from './pages/OnlineApiConsolePage';
import { Menu } from 'lucide-react';

const routePermissions: Record<string, string> = {
  'dashboard': 'dashboard',
  'test-requests': 'test-requests',
  'requirements': 'requirements',
  'test-cases': 'test-cases',
  'test-runs': 'test-runs-bugs',
  'bugs': 'test-runs-bugs',
  'test-runs-bugs': 'test-runs-bugs',
  'developer-board': 'developer-board',
  'run-issues': 'run-issues',
  'checklists': 'checklists',
  'playwright': 'playwright',
  'playwright-files': 'playwright-files',
  'releases': 'releases',
  'reports': 'dashboard',
  'api-console': 'api-console',
  'users': 'users',
  'applications': 'applications',
  'checklist-admin': 'users',
  'admin-operations': 'audit',
  'audit': 'audit',
  'settings': 'users',
};

const appRoutes = [
  { id: 'dashboard', path: '/dashboard', element: <DashboardPage /> },
  { id: 'test-requests', path: '/test-requests', element: <TestRequestsPage /> },
  { id: 'requirements', path: '/requirements', element: <RequirementsPage /> },
  { id: 'test-cases', path: '/test-cases', element: <TestCasesPage /> },
  { id: 'test-runs', path: '/test-runs', element: <Navigate to="/test-runs-bugs" replace /> },
  { id: 'bugs', path: '/bugs', element: <BugsPage /> },
  { id: 'test-runs-bugs', path: '/test-runs-bugs', element: <TestRunsBugsPage /> },
  { id: 'developer-board', path: '/developer-board', element: <DeveloperBoardPage /> },
  { id: 'run-issues', path: '/run-issues', element: <RunIssuesPage /> },
  { id: 'checklists', path: '/checklists', element: <ChecklistsPage /> },
  { id: 'playwright', path: '/playwright', element: <PlaywrightPage /> },
  { id: 'playwright-files', path: '/playwright-files', element: <PlaywrightFilesPage /> },
  { id: 'releases', path: '/releases', element: <ReleasesPage /> },
  { id: 'reports', path: '/reports', element: <ReportsPage /> },
  { id: 'api-console', path: '/api-console', element: <OnlineApiConsolePage /> },
  { id: 'users', path: '/users', element: <UsersPage /> },
  { id: 'applications', path: '/applications', element: <ApplicationsPage /> },
  { id: 'checklist-admin', path: '/checklist-admin', element: <ChecklistAdminPage /> },
  { id: 'admin-operations', path: '/admin-operations', element: <AdminOperationsPage /> },
  { id: 'audit', path: '/audit', element: <AuditPage /> },
  { id: 'settings', path: '/settings', element: <SettingsPage /> },
] as const;

const routePathById = Object.fromEntries(appRoutes.map(route => [route.id, route.path])) as Record<string, string>;

function getPageIdForPath(pathname: string): string {
  return appRoutes.find(route => route.path === pathname)?.id || '';
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const { isAuthenticated, activeContext, logout, refreshContexts } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const activePage = getPageIdForPath(location.pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    void refreshContexts().catch(() => undefined);
  }, [refreshContexts]);

  if (!isAuthenticated || !activeContext) {
    return (
      <div className="relative min-h-screen">
        <LoginPage
          onSuccess={() => {
            if (location.pathname === '/' || location.pathname === '/login') {
              navigate('/dashboard', { replace: true });
            }
          }}
        />
        <div className="fixed left-4 top-4 z-30">
          <ThemeToggle compact />
        </div>
        <ToastContainer />
      </div>
    );
  }

  const guardedNavigate = (page: string) => {
    const permission = routePermissions[page];
    if (permission && !canAccessCartable(activeContext.role, permission, activeContext)) {
      navigate('/dashboard', { replace: true });
      return;
    }
    navigate(routePathById[page] || '/dashboard');
  };

  return (
    <div className="flex min-h-screen min-w-0 bg-gray-50" dir="rtl">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="بستن منوی کناری"
        />
      )}
      <div className={`fixed right-0 top-0 z-50 h-dvh max-w-[calc(100vw-2rem)] transition-transform duration-300 lg:translate-x-0
        ${sidebarOpen ? 'visible translate-x-0' : 'invisible translate-x-full lg:visible lg:translate-x-0'}`}>
        <Sidebar
          activePage={activePage}
          onNavigate={guardedNavigate}
          onLogoutRequest={() => setShowLogoutModal(true)}
          onContextSwitched={() => setSidebarOpen(false)}
        />
      </div>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:mr-64">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setSidebarOpen(true)} className="-mr-2 min-h-11 min-w-11 rounded-lg p-2 hover:bg-gray-100" aria-label="باز کردن منو">
            <Menu className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">UTMS</h1>
          <ThemeToggle compact className="flex-shrink-0" />
        </div>
        <div className="min-w-0 flex-1">
          <Routes key={activeContext.contextId}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            {appRoutes.map(route => (
              <Route
                key={route.id}
                path={route.path}
                element={<GuardedRoute pageId={route.id} element={route.element} />}
              />
            ))}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
        <Footer />
      </div>
      <Modal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} title="تایید خروج" size="sm">
        <div className="space-y-5">
          <p className="text-sm text-gray-600">آیا از خروج از سیستم اطمینان دارید؟</p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowLogoutModal(false)}>انصراف</Button>
            <Button variant="danger" onClick={() => { setShowLogoutModal(false); logout(); navigate('/dashboard', { replace: true }); }}>خروج</Button>
          </div>
        </div>
      </Modal>
      <ToastContainer />
    </div>
  );
}

function GuardedRoute({ pageId, element }: { pageId: string; element: ReactElement }) {
  const { activeContext } = useAuthStore();
  const permission = routePermissions[pageId];

  if (permission && activeContext && !canAccessCartable(activeContext.role, permission, activeContext)) {
    return <Navigate to="/dashboard" replace />;
  }

  return element;
}

function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="p-4 sm:p-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-blue-600">404</p>
        <h1 className="mt-2 text-xl font-bold text-gray-900">صفحه پیدا نشد</h1>
        <p className="mt-2 text-sm text-gray-600">مسیر وارد شده در UTMS وجود ندارد یا از منو حذف شده است.</p>
        <Button className="mt-4" onClick={() => navigate('/dashboard')}>بازگشت به داشبورد</Button>
      </div>
    </main>
  );
}
