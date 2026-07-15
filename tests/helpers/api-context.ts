export type UtmsRole =
  | 'SYSTEM_ADMIN'
  | 'DEVELOPER'
  | 'QA_LEAD'
  | 'QA_SPECIALIST'
  | 'BA'
  | 'SECURITY_REVIEWER'
  | 'TECH_LEAD'
  | 'PRODUCT_OWNER';

const identities: Record<UtmsRole, { userId: string; name: string }> = {
  SYSTEM_ADMIN: { userId: 'user-admin', name: 'مدیر سیستم' },
  DEVELOPER: { userId: 'user-1', name: 'احمد محمدی' },
  QA_LEAD: { userId: 'user-2', name: 'سارا احمدی' },
  QA_SPECIALIST: { userId: 'user-3', name: 'علی رضایی' },
  BA: { userId: 'user-4', name: 'مریم کریمی' },
  SECURITY_REVIEWER: { userId: 'user-5', name: 'حسین نوری' },
  TECH_LEAD: { userId: 'user-6', name: 'زهرا فتحی' },
  PRODUCT_OWNER: { userId: 'user-7', name: 'محمد حسینی' },
};

export function contextFor(role: UtmsRole, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const identity = identities[role];
  return {
    userId: identity.userId,
    role,
    applicationId: 'app-1',
    scopeApplicationIds: ['app-1'],
    user: { id: identity.userId, fullName: identity.name, isActive: true },
    ...overrides,
  };
}

export function contextHeader(role: UtmsRole, overrides: Record<string, unknown> = {}): string {
  return Buffer.from(JSON.stringify(contextFor(role, overrides)), 'utf8').toString('base64');
}

export function roleStatePath(role: UtmsRole): string {
  return `.auth/${role}.json`;
}
