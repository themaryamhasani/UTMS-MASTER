export function redactSecret(value: string, visibleCharacters = 4): string {
  if (!value) return '';
  if (value.length <= visibleCharacters * 2) return '*'.repeat(Math.max(value.length, 6));
  return `${value.slice(0, visibleCharacters)}********${value.slice(-visibleCharacters)}`;
}
