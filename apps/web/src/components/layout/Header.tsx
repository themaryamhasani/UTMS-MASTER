import React, { useState, useEffect } from 'react';
import { Bell, Search, RefreshCw, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { notificationApi } from '../../services/api';
import { MinimalLoader } from '../ui/Loading';
import type { Notification } from '../../types';

const NOTIFICATION_CACHE_TTL_MS = 30_000;
const notificationCache = new Map<string, { expiresAt: number; rows?: Notification[]; promise?: Promise<Notification[]> }>();

async function getNotificationsForUser(userId: string): Promise<Notification[]> {
    const now = Date.now();
    const cached = notificationCache.get(userId);
    if (cached?.rows && cached.expiresAt > now) return cached.rows;
    if (cached?.promise) return cached.promise;

    const promise = notificationApi.getByUser(userId);
    notificationCache.set(userId, { expiresAt: now + NOTIFICATION_CACHE_TTL_MS, promise });

    try {
        const rows = await promise;
        notificationCache.set(userId, { expiresAt: Date.now() + NOTIFICATION_CACHE_TTL_MS, rows });
        return rows;
    } catch (error) {
        notificationCache.delete(userId);
        throw error;
    }
}

interface HeaderProps {
    title: string;
    subtitle?: string | undefined;
    onRefresh?: (() => void) | undefined;
    refreshing?: boolean | undefined;
    actions?: React.ReactNode | undefined;
}
export const Header: React.FC<HeaderProps> = ({ title, subtitle, onRefresh, refreshing, actions, }) => {
    const { activeContext } = useAuthStore();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    useEffect(() => {
        let cancelled = false;
        if (activeContext) {
            loadNotifications(() => cancelled);
        }
        return () => {
            cancelled = true;
        };
    }, [activeContext]);
    const loadNotifications = async (isCancelled = () => false) => {
        if (!activeContext)
            return;
        try {
            const notifs = await getNotificationsForUser(activeContext.userId);
            if (isCancelled())
                return;
            setNotifications(notifs.slice(0, 5));
            setUnreadCount(notifs.filter(n => !n.isRead).length);
        }
        catch {
            if (isCancelled())
                return;
            setNotifications([]);
            setUnreadCount(0);
        }
    };
    const markAllAsRead = async () => {
        if (!activeContext)
            return;
        await notificationApi.markAllAsRead(activeContext.userId);
        const cached = notificationCache.get(activeContext.userId);
        if (cached?.rows) {
            notificationCache.set(activeContext.userId, {
                expiresAt: Date.now() + NOTIFICATION_CACHE_TTL_MS,
                rows: cached.rows.map(n => ({ ...n, isRead: true })),
            });
        } else {
            notificationCache.delete(activeContext.userId);
        }
        setUnreadCount(0);
        setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    };
    return (<header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input type="text" placeholder="جستجو..." className="w-64 pr-10 pl-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
          </div>

          {/* Refresh Button */}
          {onRefresh && (<button type="button" onClick={onRefresh} disabled={refreshing} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" aria-label="به‌روزرسانی">
              {refreshing ? <MinimalLoader size="md"/> : <RefreshCw className="w-5 h-5"/>}
            </button>)}

          {/* Notifications */}
          <div className="relative">
            <button type="button" onClick={() => setShowNotifications(!showNotifications)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors relative" aria-label="اعلان‌ها" aria-expanded={showNotifications}>
              <Bell className="w-5 h-5"/>
              {unreadCount > 0 && (<span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>)}
            </button>

            {showNotifications && (<div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
                <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">اعلان‌ها</h3>
                  {unreadCount > 0 && (<button type="button" onClick={markAllAsRead} className="text-xs text-blue-600 hover:text-blue-700">
                      خواندن همه
                    </button>)}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (<p className="p-4 text-sm text-gray-500 text-center">
                      اعلانی وجود ندارد
                    </p>) : (notifications.map((notif) => (<div key={notif.id} className={`p-3 border-b border-gray-50 hover:bg-gray-50 ${!notif.isRead ? 'bg-blue-50/50' : ''}`}>
                        <p className="text-sm font-medium text-gray-900">
                          {notif.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {notif.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(notif.createdAt)}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {(notif.channels || ['IN_APP']).join(' + ')} | {notif.deliveryStatus || 'DELIVERED'}
                        </p>
                      </div>)))}
                </div>
              </div>)}
          </div>

          {/* Custom Actions */}
          {actions}

          {/* Context Switcher */}
          {activeContext && (<button type="button" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <span className="font-medium">{activeContext.application.name}</span>
              <ChevronDown className="w-4 h-4"/>
            </button>)}
        </div>
      </div>
    </header>);
};
function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1)
        return 'همین الان';
    if (minutes < 60)
        return `${minutes} دقیقه پیش`;
    if (hours < 24)
        return `${hours} ساعت پیش`;
    if (days < 7)
        return `${days} روز پیش`;
    return date.toLocaleDateString('fa-IR');
}
