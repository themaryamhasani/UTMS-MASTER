// ============================================
// UTMS - Authentication Store
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ActiveContext, User, Application, UserRole, AccessScope, WorkflowCapability, WorkflowPolicy } from '../types';
import { mockUsers, mockApplications, mockUserRoleAssignments } from '../services/seedData';
import { ensureDataPersistenceReady } from '../services/api';
import { canRolePerformWorkflowCapability, getWorkflowPolicy } from '../services/workflowPolicyStore';

// Virtual "all apps" application for APP-scoped contexts
const ALL_APPS_APPLICATION: Application = {
  id: 'ALL',
  name: 'کل اپلیکیشن (تمام سامانه‌ها)',
  code: 'ALL_APPS',
  description: 'دسترسی به تمام سامانه‌ها',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  activeContext: ActiveContext | null;
  availableContexts: Array<{
    assignmentId: string;
    application: Application;
    role: UserRole;
    scope: AccessScope;
    scopeApplicationIds: string[];
    automatedTestsEnabled?: boolean;
  }>;
  
  login: (phoneNumber: string, password: string) => Promise<boolean>;
  logout: () => void;
  selectContext: (applicationId: string, role: UserRole) => void;
  getAvailableContexts: () => Array<{
    assignmentId: string;
    application: Application;
    role: UserRole;
    scope: AccessScope;
    scopeApplicationIds: string[];
    automatedTestsEnabled?: boolean;
  }>;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function canUseAutomatedTests(context: Pick<ActiveContext, 'role' | 'automatedTestsEnabled'> | null | undefined): boolean {
  if (!context) return false;
  if (context.role !== 'QA_SPECIALIST') return true;
  return context.automatedTestsEnabled !== false;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      activeContext: null,
      availableContexts: [],

      login: async (phoneNumber: string, _password: string) => {
        await ensureDataPersistenceReady();
        await delay(500);
        const user = mockUsers.find(u => u.phoneNumber === phoneNumber);
        if (!user) return false;

        const assignments = mockUserRoleAssignments.filter(
          a => a.userId === user.id && a.isActive
        );

        const allApplicationIds = mockApplications.filter(app => app.isActive).map(app => app.id);

        // Build available contexts.
        // APP-scoped: show as "کل اپلیکیشن" with applicationId='ALL'.
        // SYSTEMS-scoped: show one selected system or a virtual multi-system context.
        const contexts = assignments.map(a => {
          if (a.scope === 'APP') {
            return {
              assignmentId: a.id,
              application: ALL_APPS_APPLICATION,
              role: a.role,
              scope: 'APP' as AccessScope,
              scopeApplicationIds: a.applicationIds?.length ? a.applicationIds : allApplicationIds,
              automatedTestsEnabled: a.automatedTestsEnabled,
            };
          } else {
            const appIds = a.applicationIds?.length ? a.applicationIds : [a.applicationId];
            const app = appIds.length === 1
              ? mockApplications.find(app => app.id === appIds[0])
              : {
                  id: appIds.join(','),
                  name: `چند سامانه (${appIds.length})`,
                  code: 'MULTI_SYSTEMS',
                  description: 'Context چندسامانه‌ای',
                  isActive: true,
                  createdAt: '2024-01-01T00:00:00Z',
                  updatedAt: '2024-01-01T00:00:00Z',
                } satisfies Application;
            if (!app) return null;
            return {
              assignmentId: a.id,
              application: app,
              role: a.role,
              scope: 'SYSTEMS' as AccessScope,
              scopeApplicationIds: appIds,
              automatedTestsEnabled: a.automatedTestsEnabled,
            };
          }
        }).filter(Boolean) as AuthState['availableContexts'];

        set({
          isAuthenticated: true,
          user,
          availableContexts: contexts,
          activeContext: null,
        });

        return true;
      },

      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          activeContext: null,
          availableContexts: [],
        });
      },

      selectContext: (applicationId: string, role: UserRole) => {
        const { user, availableContexts } = get();
        if (!user) return;

        const selectedContext = availableContexts.find(
          c => c.application.id === applicationId && c.role === role
        );
        if (!selectedContext) return;

        const activeContext: ActiveContext = {
          userId: user.id,
          user,
          assignmentId: selectedContext.assignmentId,
          applicationId: selectedContext.scope === 'APP'
            ? 'ALL'
            : selectedContext.scopeApplicationIds[0] ?? 'ALL',
          scopeApplicationIds: selectedContext.scopeApplicationIds,
          application: selectedContext.application,
          role: selectedContext.role,
          scope: selectedContext.scope,
          automatedTestsEnabled: selectedContext.automatedTestsEnabled,
          token: `mock-token-${user.id}-${selectedContext.assignmentId}-${role}`,
        };

        set({ activeContext });
      },

      getAvailableContexts: () => get().availableContexts,
    }),
    {
      name: 'utms-auth',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        activeContext: state.activeContext,
        availableContexts: state.availableContexts,
      }),
    }
  )
);

// ============================================
// Helper: Get application ID for data queries
// Returns undefined for APP scope (= show ALL data), or an app id list for SYSTEMS scope.
// ============================================
export function getDataApplicationId(context: ActiveContext): string | string[] | undefined {
  if (context.scope === 'APP') {
    return undefined; // No filter = show all applications
  }
  return context.scopeApplicationIds.length === 1
    ? context.scopeApplicationIds[0]
    : context.scopeApplicationIds;
}

// ============================================
// RBAC: Cartable access per role
// SYSTEM_ADMIN gets access to ALL cartables
// ============================================
export const canAccessCartable = (role: UserRole, cartableType: string, context?: Pick<ActiveContext, 'role' | 'automatedTestsEnabled'> | null): boolean => {
  if (role === 'SYSTEM_ADMIN') return true;
  if (['playwright', 'playwright-files'].includes(cartableType) && context && !canUseAutomatedTests(context)) return false;

  const permissions: Record<string, UserRole[]> = {
    'test-requests': ['DEVELOPER', 'QA_LEAD', 'QA_SPECIALIST', 'BA', 'TECH_LEAD', 'PRODUCT_OWNER'],
    'requirements': ['BA', 'QA_LEAD', 'QA_SPECIALIST', 'PRODUCT_OWNER', 'DEVELOPER', 'TECH_LEAD'],
    'test-cases': ['QA_LEAD', 'QA_SPECIALIST', 'DEVELOPER', 'TECH_LEAD'],
    'test-runs-bugs': ['QA_LEAD', 'QA_SPECIALIST', 'DEVELOPER', 'TECH_LEAD'],
    'developer-board': ['DEVELOPER'],
    'run-issues': ['QA_LEAD', 'QA_SPECIALIST'],
    'checklists': ['SECURITY_REVIEWER', 'QA_LEAD', 'TECH_LEAD'],
    'playwright': ['QA_LEAD', 'QA_SPECIALIST'],
    'playwright-files': ['QA_LEAD', 'QA_SPECIALIST'],
    'releases': ['QA_LEAD', 'TECH_LEAD', 'PRODUCT_OWNER', 'DEVELOPER'],
    'api-console': ['SYSTEM_ADMIN', 'QA_LEAD', 'QA_SPECIALIST', 'BA', 'SECURITY_REVIEWER', 'TECH_LEAD', 'PRODUCT_OWNER', 'DEVELOPER'],
    'users': ['SYSTEM_ADMIN'],
    'applications': ['SYSTEM_ADMIN'],
    'audit': ['SYSTEM_ADMIN'],
    'dashboard': ['SYSTEM_ADMIN', 'QA_LEAD', 'TECH_LEAD', 'PRODUCT_OWNER', 'DEVELOPER', 'QA_SPECIALIST', 'BA', 'SECURITY_REVIEWER'],
  };

  return permissions[cartableType]?.includes(role) ?? false;
};

// ============================================
// RBAC: Action permissions per role
// SYSTEM_ADMIN gets ALL actions
// ============================================
export const canPerformAction = (role: UserRole, action: string): boolean => {
  if (role === 'SYSTEM_ADMIN') return true;

  const actionPermissions: Record<string, UserRole[]> = {
    'test-request:create': ['DEVELOPER'],
    'test-request:submit': ['DEVELOPER'],
    'test-request:review': ['QA_LEAD'],
    'test-request:accept': ['QA_LEAD'],
    'test-request:reject': ['QA_LEAD'],
    'test-request:assign': ['QA_LEAD'],
    'test-request:cancel': ['DEVELOPER', 'QA_LEAD'],
    'requirement:create': ['BA', 'QA_LEAD'],
    'requirement:edit': ['BA', 'QA_LEAD'],
    'requirement:delete': ['QA_LEAD'],
    'requirement:archive': ['QA_LEAD'],
    'requirement:approve': ['QA_LEAD'],
    'flow:create': ['BA', 'QA_LEAD'],
    'flow:edit': ['BA', 'QA_LEAD'],
    'test-case:create': ['QA_LEAD', 'QA_SPECIALIST'],
    'test-case:edit': ['QA_LEAD', 'QA_SPECIALIST'],
    'test-case:delete': ['QA_LEAD', 'QA_SPECIALIST'],
    'test-case:archive': ['QA_LEAD', 'QA_SPECIALIST'],
    'test-run:create': ['QA_LEAD', 'QA_SPECIALIST'],
    'test-run:execute': ['QA_LEAD', 'QA_SPECIALIST'],
    'test-run:finalize': ['QA_LEAD', 'QA_SPECIALIST'],
    'test-run:delete': ['QA_LEAD', 'QA_SPECIALIST'],
    'test-run:edit': ['QA_LEAD', 'QA_SPECIALIST'],
    'bug:create': ['QA_LEAD', 'QA_SPECIALIST'],
    'bug:edit': ['QA_LEAD', 'QA_SPECIALIST'],
    'bug:delete': ['QA_LEAD', 'QA_SPECIALIST'],
    'bug:archive': ['QA_LEAD'],
    'bug:assign': ['QA_LEAD'],
    'bug:update-status': ['DEVELOPER', 'QA_LEAD', 'QA_SPECIALIST'],
    'bug:update-severity': ['QA_LEAD'],
    'bug:retest': ['QA_LEAD', 'QA_SPECIALIST'],
    'run-issue:create': ['QA_LEAD', 'QA_SPECIALIST'],
    'run-issue:resolve': ['QA_LEAD', 'QA_SPECIALIST'],
    'checklist:review': ['SECURITY_REVIEWER'],
    'checklist:view': ['QA_LEAD', 'TECH_LEAD'],
    'playwright:run': ['QA_LEAD', 'QA_SPECIALIST'],
    'playwright:view': ['QA_LEAD', 'QA_SPECIALIST', 'TECH_LEAD'],
    'release:create': ['QA_LEAD'],
    'release:qa-review': ['QA_LEAD'],
    'release:decide': ['TECH_LEAD'],
    'release:emergency': ['TECH_LEAD'],
    'release:view': ['PRODUCT_OWNER', 'QA_LEAD', 'TECH_LEAD'],
    'release:comment': ['PRODUCT_OWNER', 'QA_LEAD', 'TECH_LEAD'],
    'admin:manage-users': ['SYSTEM_ADMIN'],
    'admin:create-user': ['SYSTEM_ADMIN'],
    'admin:edit-user': ['SYSTEM_ADMIN'],
    'admin:delete-user': ['SYSTEM_ADMIN'],
    'admin:manage-apps': ['SYSTEM_ADMIN'],
    'admin:view-audit': ['SYSTEM_ADMIN'],
    'admin:manage-settings': ['SYSTEM_ADMIN'],
    'admin:unlock': ['SYSTEM_ADMIN'],
  };

  return actionPermissions[action]?.includes(role) ?? false;
};

export const canPerformWorkflowAction = (
  context: ActiveContext | null | undefined,
  capability: WorkflowCapability,
  applicationId?: string
): boolean => {
  if (!context) return false;
  if (context.role === 'SYSTEM_ADMIN') return true;

  const contextApplicationIds = context.scopeApplicationIds?.length
    ? context.scopeApplicationIds
    : [context.applicationId];

  const scopedIds = applicationId && applicationId !== 'ALL'
    ? [applicationId]
    : contextApplicationIds;

  return scopedIds.some(appId =>
    canRolePerformWorkflowCapability(context.role, capability, appId)
  );
};

export const getWorkflowPolicyForContext = (
  context: ActiveContext | null | undefined,
  applicationId?: string
): WorkflowPolicy => {
  const fallbackApplicationId = applicationId && applicationId !== 'ALL'
    ? applicationId
    : context?.scopeApplicationIds[0];
  return getWorkflowPolicy(fallbackApplicationId);
};

export const getDashboardType = (role: UserRole): string => {
  const dashboards: Record<UserRole, string> = {
    SYSTEM_ADMIN: 'admin',
    DEVELOPER: 'developer',
    QA_LEAD: 'qa-lead',
    QA_SPECIALIST: 'qa-specialist',
    BA: 'ba',
    SECURITY_REVIEWER: 'security',
    TECH_LEAD: 'tech-lead',
    PRODUCT_OWNER: 'product-owner',
  };
  return dashboards[role] || 'default';
};
