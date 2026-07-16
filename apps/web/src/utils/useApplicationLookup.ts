import { useEffect, useMemo, useState } from 'react';
import { applicationApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { Application } from '../types';
import { useDataScope } from './useDataScope';

const APPLICATION_LOOKUP_CACHE_TTL_MS = 10_000;
let applicationLookupCache: { expiresAt: number; rows?: Application[]; promise?: Promise<Application[]> } | null = null;

async function getApplicationLookupRows(): Promise<Application[]> {
  const now = Date.now();
  if (applicationLookupCache?.rows && applicationLookupCache.expiresAt > now) return applicationLookupCache.rows;
  if (applicationLookupCache?.promise) return applicationLookupCache.promise;

  const promise = applicationApi.getAll();
  applicationLookupCache = { expiresAt: now + APPLICATION_LOOKUP_CACHE_TTL_MS, promise };

  try {
    const rows = await promise;
    applicationLookupCache = { expiresAt: Date.now() + APPLICATION_LOOKUP_CACHE_TTL_MS, rows };
    return rows;
  } catch (error) {
    applicationLookupCache = null;
    throw error;
  }
}

export function useApplicationLookup() {
  const { activeContext } = useAuthStore();
  const { scopeApplicationIds, isAppLevel, isMultiSystem } = useDataScope();
  const [lookupRows, setLookupRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(!!activeContext);

  const isSystemAdmin = activeContext?.role === 'SYSTEM_ADMIN';
  const shouldShowSystemColumn =
    !!activeContext && (isAppLevel || isMultiSystem || scopeApplicationIds.length > 1);

  useEffect(() => {
    if (!activeContext) {
      setLookupRows([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getApplicationLookupRows()
      .then(rows => {
        if (cancelled) return;
        setLookupRows(rows);
      })
      .catch(() => {
        if (!cancelled) setLookupRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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

    return loading ? 'در حال بارگذاری سامانه…' : 'سامانه نامشخص';
  };

  return { applications, loading, shouldShowSystemColumn, getApplicationName };
}
