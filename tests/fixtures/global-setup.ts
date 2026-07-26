import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig } from '@playwright/test';

const roles = {
  SYSTEM_ADMIN: { id: 'user-admin', phone: '09120000000', name: 'مدیر سیستم', assignment: 'ura-admin', scope: 'APP' },
  DEVELOPER: {
    id: 'user-1',
    phone: '09121234567',
    name: 'احمد محمدی',
    assignment: 'ura-1',
    assignmentIds: ['ura-1', 'ura-10'],
    applicationIds: ['app-1', 'app-2'],
    scope: 'SYSTEMS',
  },
  QA_LEAD: {
    id: 'user-2',
    phone: '09122345678',
    name: 'سارا احمدی',
    assignment: 'ura-2',
    assignmentIds: ['ura-2', 'ura-9'],
    applicationIds: ['app-1', 'app-2'],
    scope: 'SYSTEMS',
  },
  QA_SPECIALIST: { id: 'user-3', phone: '09123456789', name: 'علی رضایی', assignment: 'ura-3', scope: 'SYSTEMS' },
  BA: { id: 'user-4', phone: '09124567890', name: 'مریم کریمی', assignment: 'ura-4', scope: 'SYSTEMS' },
  SECURITY_REVIEWER: { id: 'user-5', phone: '09125678901', name: 'حسین نوری', assignment: 'ura-5', scope: 'APP' },
  TECH_LEAD: { id: 'user-6', phone: '09126789012', name: 'زهرا فتحی', assignment: 'ura-6', scope: 'SYSTEMS' },
  PRODUCT_OWNER: { id: 'user-7', phone: '09127890123', name: 'محمد حسینی', assignment: 'ura-7', scope: 'SYSTEMS' },
} as const;

export default async function globalSetup(config: FullConfig): Promise<void> {
  const root = config.configFile ? path.dirname(config.configFile) : process.cwd();
  for (const directory of [
    '.auth',
    'artifacts/tests/junit',
    'artifacts/tests/json',
    'artifacts/tests/diagnostics',
    'artifacts/tests/accessibility',
    'artifacts/tests/performance',
  ]) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  }

  const origin = process.env.UTMS_WEB_BASE_URL || 'http://127.0.0.1:5173';
  for (const [role, identity] of Object.entries(roles)) {
    const applicationRows = [
      { id: 'app-1', name: 'سامانه بانکداری آنلاین', code: 'BANKING' },
      { id: 'app-2', name: 'سامانه مدیریت منابع انسانی', code: 'HRM' },
      { id: 'app-3', name: 'پورتال کارمندان', code: 'EMPLOYEE_PORTAL' },
    ];
    const identityApplicationIds = 'applicationIds' in identity
      ? [...identity.applicationIds]
      : identity.scope === 'APP'
        ? applicationRows.map(application => application.id)
        : ['app-1'];
    const identityAssignmentIds = 'assignmentIds' in identity
      ? [...identity.assignmentIds]
      : [identity.assignment];
    const contextApplications = applicationRows.filter(application =>
      identityApplicationIds.includes(application.id)
    );
    const app = contextApplications[0]!;
    const user = {
      id: identity.id,
      nationalCode: '0012345678',
      phoneNumber: identity.phone,
      fullName: identity.name,
      email: `${identity.id}@example.test`,
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };
    const activeContext = {
      contextId: `context:${identity.id}:${role}:${identityAssignmentIds.join('+')}`,
      userId: identity.id,
      user,
      assignmentId: identity.assignment,
      assignmentIds: identityAssignmentIds,
      applicationId: identity.scope === 'APP' ? 'ALL' : 'app-1',
      scopeApplicationIds: identityApplicationIds,
      application: app,
      applications: contextApplications,
      role,
      scope: identity.scope,
      automatedTestsEnabled: true,
      token: `test-token-${identity.id}`,
    };
    const availableContext = {
      contextId: activeContext.contextId,
      assignmentId: identity.assignment,
      assignmentIds: identityAssignmentIds,
      application: app,
      applications: contextApplications,
      role,
      scope: identity.scope,
      scopeApplicationIds: identityApplicationIds,
      automatedTestsEnabled: true,
    };
    const persisted = JSON.stringify({
      state: { isAuthenticated: true, user, activeContext, availableContexts: [availableContext] },
      version: 0,
    });
    const storageState = {
      cookies: [],
      origins: [{ origin, localStorage: [{ name: 'utms-auth', value: persisted }] }],
    };
    fs.writeFileSync(path.join(root, '.auth', `${role}.json`), JSON.stringify(storageState, null, 2));
  }
}
