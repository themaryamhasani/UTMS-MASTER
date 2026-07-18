const DEFAULT_DISPLAY_ID_LENGTH = 10;

const normalizePrefix = (prefix: string) =>
  prefix.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3) || 'ID';

const fnv1a = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

export const formatDisplayId = (
  value: string | undefined | null,
  prefix = 'ID',
  maxLength = DEFAULT_DISPLAY_ID_LENGTH
) => {
  if (!value) return '-';

  const compact = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (compact && compact.length <= maxLength && /[A-Z]/.test(compact) && /\d/.test(compact)) {
    return compact;
  }

  const safePrefix = normalizePrefix(prefix).slice(0, Math.max(1, maxLength - 1));
  const suffixLength = Math.max(1, maxLength - safePrefix.length);
  const hash = fnv1a(value);
  const suffix = hash.toString(36).toUpperCase().padStart(suffixLength, '0');
  const displayId = `${safePrefix}${suffix}`.slice(0, maxLength);
  return /\d/.test(displayId)
    ? displayId
    : `${displayId.slice(0, Math.max(0, maxLength - 1))}${hash % 10}`;
};
