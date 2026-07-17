export function redact(value) {
  return JSON.stringify(value, (key, val) => {
    if (/password|secret|token|authorization|cookie/i.test(key)) return '{{redacted}}';
    return val;
  }, 2);
}
