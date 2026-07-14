export const USER_ROLES = [
  'SYSTEM_ADMIN',
  'DEVELOPER',
  'QA_LEAD',
  'QA_SPECIALIST',
  'BA',
  'SECURITY_REVIEWER',
  'TECH_LEAD',
  'PRODUCT_OWNER',
] as const;

export type UserRole = (typeof USER_ROLES)[number];
