const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'confirmPassword',
  'currentPassword',
  'newPassword',
  'token',
  'sessionToken',
  'authorization',
  'apiKey',
  'GEMINI_API_KEY',
  'AUTH_SECRET',
  'secret',
]);

function isSensitiveKey(key: string): boolean {
  if (SENSITIVE_KEYS.has(key)) return true;
  const lower = key.toLowerCase();
  return (
    lower.includes('secret') ||
    lower.includes('token') ||
    lower.includes('password') ||
    lower.includes('authorization')
  );
}

/**
 * Recursively clones and redacts sensitive fields from structured log metadata,
 * guarding against circular object references.
 */
export function redactObject(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactObject(item, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSensitiveKey(k) ? '[REDACTED]' : redactObject(v, seen);
  }
  return out;
}

export const logger = {
  info(event: string, meta?: Record<string, unknown>) {
    console.log(
      JSON.stringify({
        level: 'info',
        timestamp: new Date().toISOString(),
        event,
        ...(meta ? { meta: redactObject(meta) } : {}),
      }),
    );
  },
  warn(event: string, meta?: Record<string, unknown>) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        timestamp: new Date().toISOString(),
        event,
        ...(meta ? { meta: redactObject(meta) } : {}),
      }),
    );
  },
  error(event: string, meta?: Record<string, unknown>) {
    console.error(
      JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        event,
        ...(meta ? { meta: redactObject(meta) } : {}),
      }),
    );
  },
};
