// ============================================
// Hook to get scope-aware application filters for data queries.
// APP scope: returns undefined → API fetches ALL data across all systems.
// SYSTEMS scope: returns one id or an id array → API filters to selected systems.
// ============================================

import { useAuthStore } from '../stores/authStore';
import type { ApplicationScopeFilter, AccessScope } from '../types';

/**
 * Returns the applicationId to pass to API calls.
 * - For APP-scoped users: returns undefined (= no filter, see ALL systems)
 * - For SYSTEMS-scoped users: returns the selected application id(s)
 */
export function useDataScope(): {
  /** Pass this to API getAll calls. undefined = all apps */
  appId: ApplicationScopeFilter;
  /** Use this for create flows until those forms expose an explicit system picker */
  defaultApplicationId: string;
  /** All application ids included in this context */
  scopeApplicationIds: string[];
  /** The scope type for display purposes */
  scope: AccessScope;
  /** Whether this user sees all applications */
  isAppLevel: boolean;
  /** Whether this user is scoped to more than one selected system */
  isMultiSystem: boolean;
  /** Display label for current scope */
  scopeLabel: string;
} {
  const { activeContext } = useAuthStore();
  
  if (!activeContext) {
    return {
      appId: undefined,
      defaultApplicationId: '',
      scopeApplicationIds: [],
      scope: 'SYSTEMS',
      isAppLevel: false,
      isMultiSystem: false,
      scopeLabel: '',
    };
  }

  const isApp = activeContext.scope === 'APP';
  const ids = activeContext.scopeApplicationIds || [];
  const appId = isApp ? undefined : ids.length === 1 ? ids[0] : ids;
  
  return {
    appId,
    defaultApplicationId: ids[0] || activeContext.applicationId,
    scopeApplicationIds: ids,
    scope: activeContext.scope,
    isAppLevel: isApp,
    isMultiSystem: !isApp && ids.length > 1,
    scopeLabel: isApp ? 'کل اپلیکیشن (تمام سامانه‌ها)' : activeContext.application.name,
  };
}
