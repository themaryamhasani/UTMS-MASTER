import { useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useDataScope } from './useDataScope';

export function useApplicationLookup() {
  const { activeContext } = useAuthStore();
  const { scopeApplicationIds, isAppLevel, isMultiSystem } = useDataScope();

  const isSystemAdmin = activeContext?.role === 'SYSTEM_ADMIN';
  const shouldShowSystemColumn =
    !!activeContext && (isAppLevel || isMultiSystem || scopeApplicationIds.length > 1);

  const lookupRows = useMemo(() => {
    if (!activeContext) return [];
    const rows = activeContext.applications?.length
      ? activeContext.applications
      : activeContext.application
        ? [activeContext.application]
        : [];
    return rows.filter(application => application.isActive);
  }, [activeContext]);

  const applications = useMemo(() => {
    const allowed = isSystemAdmin || isAppLevel
      ? lookupRows
      : lookupRows.filter(app => scopeApplicationIds.includes(app.id));

    return allowed.filter(app => app.isActive);
  }, [lookupRows, isSystemAdmin, isAppLevel, scopeApplicationIds.join('|')]);

  const applicationNameById = useMemo(
    () => lookupRows.reduce<Record<string, string>>((acc, app) => {
      acc[app.id] = app.name;
      return acc;
    }, {}),
    [lookupRows]
  );

  const getApplicationName = (applicationId?: string) => {
    if (!applicationId) return '-';
    if (applicationId === 'ALL') return 'همه سامانه‌ها';

    const lookupName = applicationNameById[applicationId];
    if (lookupName) return lookupName;

    const isSingleApplicationContext = activeContext?.scopeApplicationIds.length === 1;
    if (isSingleApplicationContext && activeContext.applicationId === applicationId) {
      return activeContext.application.name;
    }

    return 'سامانه نامشخص';
  };

  return { applications, loading: false, shouldShowSystemColumn, getApplicationName };
}
