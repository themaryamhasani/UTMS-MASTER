const sensitive = /(authorization|cookie|token|password|secret|api[-_]?key)/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sensitive.test(key) ? '[REDACTED]' : redact(item)])
    );
  }
  if (typeof value === 'string') {
    return value
      .replace(/(bearer\s+)[^\s"']+/gi, '$1[REDACTED]')
      .replace(/((?:token|password|secret|api[-_]?key)=)[^&\s]+/gi, '$1[REDACTED]');
  }
  return value;
}
