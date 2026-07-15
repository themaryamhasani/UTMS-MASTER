import { useEffect, useMemo, useState } from 'react';
import { applicationApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { Application } from '../types';
import { useDataScope } from './useDataScope';

export function useApplicationLookup() {
  const { activeContext } = useAuthStore();
  const { scopeApplicationIds, isAppLevel, isMultiSystem } = useDataScope();
  const [applications, setApplications] = useState<Application[]>([]);

  const isSystemAdmin = activeContext?.role === 'SYSTEM_ADMIN';
  const shouldShowSystemColumn =
    isSystemAdmin ||
    (activeContext?.role === 'QA_LEAD' &&
      (isAppLevel || isMultiSystem || scopeApplicationIds.length > 1));

  useEffect(() => {
    if (!shouldShowSystemColumn) {
      setApplications([]);
      return;
    }
    applicationApi
      .getAll()
      .then(rows => {
        const allowed = isSystemAdmin || isAppLevel
          ? rows
          : rows.filter(app => scopeApplicationIds.includes(app.id));
        setApplications(allowed);
      })
      .catch(() => setApplications([]));
  }, [shouldShowSystemColumn, isSystemAdmin, isAppLevel, scopeApplicationIds.join('|')]);

  const applicationNameById = useMemo(
    () => applications.reduce<Record<string, string>>((acc, app) => {
      acc[app.id] = app.name;
      return acc;
    }, {}),
    [applications]
  );

  const getApplicationName = (applicationId?: string) => {
    if (!applicationId) return '-';
    return applicationNameById[applicationId]
      || (activeContext?.applicationId === applicationId ? activeContext.application?.name : undefined)
      || applicationId;
  };

  return { shouldShowSystemColumn, getApplicationName };
}
