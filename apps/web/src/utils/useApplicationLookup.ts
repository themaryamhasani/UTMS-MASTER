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
    let cancelled = false;
    getApplicationLookupRows()
      .then(rows => {
        if (cancelled) return;
        const allowed = isSystemAdmin || isAppLevel
          ? rows
          : rows.filter(app => scopeApplicationIds.includes(app.id));
        setApplications(allowed);
      })
      .catch(() => {
        if (!cancelled) setApplications([]);
      });
    return () => {
      cancelled = true;
    };
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
