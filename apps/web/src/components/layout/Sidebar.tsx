import React from 'react';
import { cn } from '../../utils/cn';
import { useAuthStore, canAccessCartable } from '../../stores/authStore';
import { LayoutDashboard, FileText, ClipboardList, TestTube, PlayCircle, AlertTriangle, ShieldCheck, Terminal, Rocket, Users, Building2, History, Settings, LogOut, BarChart3, Activity, Braces, } from 'lucide-react';
import { ROLE_LABELS } from '../../types';
interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    cartableType?: string | undefined;
}
interface SidebarProps {
    activePage: string;
    onNavigate: (page: string) => void;
    onLogoutRequest: () => void;
}
export const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate, onLogoutRequest }) => {
    const { activeContext } = useAuthStore();
    if (!activeContext)
        return null;
    const role = activeContext.role;
    const navItems: NavItem[] = [
        { id: 'dashboard', label: 'داشبورد', icon: <LayoutDashboard className="w-5 h-5"/>, cartableType: 'dashboard' },
        { id: 'test-requests', label: 'درخواست‌های تست', icon: <FileText className="w-5 h-5"/>, cartableType: 'test-requests' },
        { id: 'requirements', label: 'نیازمندی‌ها', icon: <ClipboardList className="w-5 h-5"/>, cartableType: 'requirements' },
        { id: 'test-cases', label: 'تست کیس‌ها', icon: <TestTube className="w-5 h-5"/>, cartableType: 'test-cases' },
        { id: 'test-runs-bugs', label: 'اجرای تست و باگ‌ها', icon: <PlayCircle className="w-5 h-5"/>, cartableType: 'test-runs-bugs' },
        { id: 'developer-board', label: 'برد توسعه', icon: <Activity className="w-5 h-5"/>, cartableType: 'developer-board' },
        { id: 'run-issues', label: 'مشکلات اجرا', icon: <AlertTriangle className="w-5 h-5"/>, cartableType: 'run-issues' },
        { id: 'checklists', label: 'چک‌لیست‌ها', icon: <ShieldCheck className="w-5 h-5"/>, cartableType: 'checklists' },
        { id: 'playwright', label: 'Playwright', icon: <Terminal className="w-5 h-5"/>, cartableType: 'playwright' },
        { id: 'playwright-files', label: 'فایل تست Playwright', icon: <FileText className="w-5 h-5"/>, cartableType: 'playwright-files' },
        { id: 'releases', label: 'تصمیم و ثبت انتشار', icon: <Rocket className="w-5 h-5"/>, cartableType: 'releases' },
        { id: 'api-console', label: 'Online API Console', icon: <Braces className="w-5 h-5"/>, cartableType: 'api-console' },
        { id: 'reports', label: 'گزارش‌ها', icon: <BarChart3 className="w-5 h-5"/>, cartableType: 'dashboard' },
    ];
    const adminItems: NavItem[] = [
        { id: 'users', label: 'کاربران و نقش‌ها', icon: <Users className="w-5 h-5"/>, cartableType: 'users' },
        { id: 'applications', label: 'سامانه‌ها', icon: <Building2 className="w-5 h-5"/>, cartableType: 'applications' },
        { id: 'checklist-admin', label: 'مدیریت چک‌لیست‌ها', icon: <ShieldCheck className="w-5 h-5"/>, cartableType: 'users' },
        { id: 'admin-operations', label: 'مشاهده‌پذیری عملیات', icon: <Activity className="w-5 h-5"/>, cartableType: 'audit' },
        { id: 'audit', label: 'تاریخچه', icon: <History className="w-5 h-5"/>, cartableType: 'audit' },
        { id: 'settings', label: 'تنظیمات', icon: <Settings className="w-5 h-5"/>, cartableType: 'users' },
    ];
    const accessibleNavItems = navItems.filter(item => !item.cartableType || canAccessCartable(role, item.cartableType, activeContext));
    const accessibleAdminItems = adminItems.filter(item => !item.cartableType || canAccessCartable(role, item.cartableType, activeContext));
    const handleLogout = () => {
        onLogoutRequest();
    };
    return (<aside className="flex h-dvh w-[min(18rem,calc(100vw-2rem))] flex-col border-l border-gray-200 bg-white shadow-sm sm:w-64">
      {/* Logo + Close on mobile */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <TestTube className="w-5 h-5 text-white"/>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">UTMS</h1>
              <p className="text-xs text-gray-500">مدیریت کیفیت و انتشار</p>
            </div>
          </div>
        </div>
      </div>

      {/* User Profile & Context Info */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-l from-blue-50 to-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-blue-600">
              {activeContext.user.fullName.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {activeContext.user.fullName}
            </p>
            <p className="text-xs text-blue-600 font-medium">
              {ROLE_LABELS[role]}
            </p>
          </div>
        </div>
        <div className="mt-2 px-2 py-1.5 bg-white rounded-lg border border-gray-100">
          <p className="text-xs text-gray-500">سامانه فعال:</p>
          <p className="text-xs font-medium text-gray-800 truncate">
            {activeContext.application.name}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <p className="px-3 text-xs font-semibold text-gray-400 mb-2">
          منو
        </p>
        <ul className="space-y-0.5">
          {accessibleNavItems.map((item) => (<li key={item.id}>
              <button type="button" onClick={() => onNavigate(item.id)} className={cn('w-full min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-right transition-colors', activePage === item.id
                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')}>
                {item.icon}
                <span className="min-w-0 break-words">{item.label}</span>
              </button>
            </li>))}
        </ul>

        {accessibleAdminItems.length > 0 && (<>
            <div className="my-3 border-t border-gray-200"/>
            <p className="px-3 text-xs font-semibold text-gray-400 mb-2">
              مدیریت سیستم
            </p>
            <ul className="space-y-0.5">
              {accessibleAdminItems.map((item) => (<li key={item.id}>
                  <button type="button" onClick={() => onNavigate(item.id)} className={cn('w-full min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-right transition-colors', activePage === item.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-100'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')}>
                    {item.icon}
                    <span className="min-w-0 break-words">{item.label}</span>
                  </button>
                </li>))}
            </ul>
          </>)}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-200">
        <button type="button" onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
          <LogOut className="w-4 h-4"/>
          <span>خروج از سیستم</span>
        </button>
      </div>
    </aside>);
};
