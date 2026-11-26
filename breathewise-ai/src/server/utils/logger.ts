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

function redactObject(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redactObject);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k) || k.toLowerCase().includes('secret') || k.toLowerCase().includes('token')) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactObject(v);
      }
    }
    return out;
  }
  return value;
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
