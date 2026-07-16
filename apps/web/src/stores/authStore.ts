// ============================================
// UTMS - Authentication Store
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ActiveContext,
  Application,
  AvailableContext,
  User,
  UserRole,
  UserRoleAssignment,
  WorkflowCapability,
  WorkflowPolicy,
} from '../types';
import { mockUsers, mockApplications, mockUserRoleAssignments } from '../services/seedData';
import { ensureDataPersistenceReady } from '../services/api';
import { canRolePerformWorkflowCapability, getWorkflowPolicy } from '../services/workflowPolicyStore';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  activeContext: ActiveContext | null;
  availableContexts: AvailableContext[];

  login: (phoneNumber: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshContexts: () => Promise<void>;
  switchContext: (contextId: string) => boolean;
  getAvailableContexts: () => AvailableContext[];
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getAssignmentApplicationIds(assignment: UserRoleAssignment, allApplicationIds: string[]): string[] {
  if (assignment.scope === 'APP') return allApplicationIds;
  return assignment.applicationIds?.length ? assignment.applicationIds : [assignment.applicationId];
}

function buildAvailableContexts(user: User): AvailableContext[] {
  const activeApplications = mockApplications.filter(application => application.isActive);
  const allApplicationIds = activeApplications.map(application => application.id);
  const assignmentsByRole = new Map<UserRole, UserRoleAssignment[]>();

  mockUserRoleAssignments
    .filter(assignment => assignment.userId === user.id && assignment.isActive)
    .forEach(assignment => {
      const roleAssignments = assignmentsByRole.get(assignment.role) ?? [];
      roleAssignments.push(assignment);
      assignmentsByRole.set(assignment.role, roleAssignments);
    });

  const contexts: AvailableContext[] = [];
  assignmentsByRole.forEach((roleAssignments, role) => {
    const allowedApplicationIds = new Set(
      roleAssignments.flatMap(assignment => getAssignmentApplicationIds(assignment, allApplicationIds))
    );
    const applications = activeApplications.filter(application => allowedApplicationIds.has(application.id));
    const application = applications[0];
    if (!application) return;

    const assignmentIds = roleAssignments.map(assignment => assignment.id).sort();
    const scope = roleAssignments.some(assignment => assignment.scope === 'APP') ? 'APP' : 'SYSTEMS';
    const scopeApplicationIds = applications.map(item => item.id);
    const automatedTestsEnabled = role === 'QA_SPECIALIST'
      ? roleAssignments.every(assignment => assignment.automatedTestsEnabled !== false)
      : undefined;

    contexts.push({
      contextId: `context:${user.id}:${role}:${assignmentIds.join('+')}`,
      assignmentId: assignmentIds[0]!,
      assignmentIds,
      application,
      applications,
      role,
      scope,
      scopeApplicationIds,
      automatedTestsEnabled,
    });
  });

  return contexts;
}

function createActiveContext(user: User, selectedContext: AvailableContext): ActiveContext {
  return {
    contextId: selectedContext.contextId,
    userId: user.id,
    user,
    assignmentId: selectedContext.assignmentId,
    assignmentIds: [...selectedContext.assignmentIds],
    applicationId: selectedContext.scope === 'APP'
      ? 'ALL'
      : selectedContext.scopeApplicationIds[0] ?? selectedContext.application.id,
    scopeApplicationIds: [...selectedContext.scopeApplicationIds],
    application: selectedContext.application,
    applications: [...selectedContext.applications],
    role: selectedContext.role,
    scope: selectedContext.scope,
    automatedTestsEnabled: selectedContext.automatedTestsEnabled,
    token: `mock-token-${user.id}-${selectedContext.contextId}`,
  };
}

function findMatchingContext(
  contexts: AvailableContext[],
  previousContext: Partial<ActiveContext> | null | undefined
): AvailableContext | undefined {
  if (!previousContext) return undefined;
  const previousAssignmentIds = previousContext.assignmentIds?.length
    ? previousContext.assignmentIds
    : previousContext.assignmentId
      ? [previousContext.assignmentId]
      : [];

  return contexts.find(context => context.contextId === previousContext.contextId)
    ?? contexts.find(context =>
      context.role === previousContext.role &&
      context.assignmentIds.some(assignmentId => previousAssignmentIds.includes(assignmentId))
    );
}

function contextSignature(
  context:
    | Pick<ActiveContext, 'contextId' | 'userId' | 'assignmentIds' | 'applicationId' | 'scopeApplicationIds' | 'role' | 'scope' | 'automatedTestsEnabled'>
    | null
    | undefined
): string {
  if (!context) return '';
  return JSON.stringify({
    contextId: context.contextId,
    userId: context.userId,
    assignmentIds: [...(context.assignmentIds ?? [])].sort(),
    applicationId: context.applicationId,
    scopeApplicationIds: [...(context.scopeApplicationIds ?? [])].sort(),
    role: context.role,
    scope: context.scope,
    automatedTestsEnabled: context.automatedTestsEnabled ?? null,
  });
}

function availableContextSignature(contexts: AvailableContext[]): string {
  return JSON.stringify(contexts.map(context => ({
    contextId: context.contextId,
    assignmentIds: [...context.assignmentIds].sort(),
    applicationIds: [...context.scopeApplicationIds].sort(),
    role: context.role,
    scope: context.scope,
    automatedTestsEnabled: context.automatedTestsEnabled ?? null,
  })).sort((left, right) => left.contextId.localeCompare(right.contextId)));
}

export function getContextApplicationLabel(
  context: { applications?: Application[] | undefined; application?: Application | null | undefined }
): string {
  const names = Array.from(new Set(
    (context.applications ?? []).map(application => application.name).filter(Boolean)
  ));
  if (names.length > 0) return names.join('، ');
  return context.application?.name || 'سامانه‌ای تعیین نشده';
}

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
        const user = mockUsers.find(u => u.phoneNumber === phoneNumber && u.isActive);
        if (!user) return false;

        const contexts = buildAvailableContexts(user);

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

      refreshContexts: async () => {
        await ensureDataPersistenceReady();
        const { activeContext, availableContexts, isAuthenticated, user } = get();
        if (!isAuthenticated || !user) return;

        const contexts = buildAvailableContexts(user);
        const selectedContext = findMatchingContext(contexts, activeContext);
        const nextActiveContext = selectedContext ? createActiveContext(user, selectedContext) : null;

        if (
          availableContextSignature(availableContexts) === availableContextSignature(contexts) &&
          contextSignature(activeContext) === contextSignature(nextActiveContext)
        ) {
          return;
        }

        set({
          availableContexts: contexts,
          activeContext: nextActiveContext,
        });
      },

      switchContext: (contextId: string) => {
        const { user } = get();
        if (!user?.isActive) return false;

        // Rebuild from current active assignments and resolve only the opaque
        // context id. Role/application values supplied by the UI are never trusted.
        const contexts = buildAvailableContexts(user);
        const selectedContext = contexts.find(context => context.contextId === contextId);
        if (!selectedContext) {
          const { availableContexts, activeContext } = get();
          if (
            availableContextSignature(availableContexts) === availableContextSignature(contexts) &&
            activeContext === null
          ) {
            return false;
          }
          set({ availableContexts: contexts, activeContext: null });
          return false;
        }

        const nextActiveContext = createActiveContext(user, selectedContext);
        const { availableContexts, activeContext } = get();
        if (
          availableContextSignature(availableContexts) === availableContextSignature(contexts) &&
          contextSignature(activeContext) === contextSignature(nextActiveContext)
        ) {
          return true;
        }

        set({
          isAuthenticated: true,
          availableContexts: contexts,
          activeContext: nextActiveContext,
        });
        return true;
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
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AuthState>;
        if (!persisted.isAuthenticated || !persisted.user?.isActive) {
          return {
            ...currentState,
            isAuthenticated: false,
            user: null,
            activeContext: null,
            availableContexts: [],
          };
        }

        const availableContexts = buildAvailableContexts(persisted.user);
        const selectedContext = findMatchingContext(availableContexts, persisted.activeContext);
        return {
          ...currentState,
          isAuthenticated: true,
          user: persisted.user,
          availableContexts,
          activeContext: selectedContext
            ? createActiveContext(persisted.user, selectedContext)
            : null,
        };
      },
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
