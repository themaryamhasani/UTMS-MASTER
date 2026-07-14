export function createCorrelationId(prefix: string, uniquePart: string): string {
  const safePrefix = prefix.trim() || 'correlation';
  const safeUniquePart = uniquePart.trim() || 'unknown';
  return `${safePrefix}:${safeUniquePart}`;
}
