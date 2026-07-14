export const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export const SEMVER_HINT = 'فرمت نسخه باید SemVer باشد؛ مثال: 1.2.3 یا 1.2.3-beta.1';

export function isSemVer(value: string | undefined | null): boolean {
  return !!value && SEMVER_REGEX.test(value.trim());
}
