import { USER_ROLES } from '../../packages/contracts/src';

export function contractsExposeUserRoles(): boolean {
  return USER_ROLES.includes('SYSTEM_ADMIN');
}
