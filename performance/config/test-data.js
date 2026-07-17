export const roles = {
  SYSTEM_ADMIN: { userId: 'user-admin', name: 'مدیر سیستم' },
  DEVELOPER: { userId: 'user-1', name: 'احمد محمدی' },
  QA_LEAD: { userId: 'user-2', name: 'سارا احمدی' },
  QA_SPECIALIST: { userId: 'user-3', name: 'علی رضایی' },
  BA: { userId: 'user-4', name: 'مریم کریمی' },
  SECURITY_REVIEWER: { userId: 'user-5', name: 'حسین نوری' },
  TECH_LEAD: { userId: 'user-6', name: 'زهرا فتحی' },
  PRODUCT_OWNER: { userId: 'user-7', name: 'محمد حسینی' },
};

export function contextFor(role, config, overrides = {}) {
  const identity = roles[role] || roles.DEVELOPER;
  return {
    userId: identity.userId,
    role,
    applicationId: config.appId,
    scopeApplicationIds: [config.appId],
    scope: config.scope,
    user: { id: identity.userId, fullName: identity.name, isActive: true },
    ...overrides,
  };
}

export function uniqueName(config, prefix) {
  return `${prefix}-${config.runId}-vu${__VU || 0}-it${__ITER || 0}`;
}
