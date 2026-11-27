import { describe, expect, it } from 'vitest';
import { getDatabase } from '../../src/server/db/database';
import {
  authenticateUser,
  changeUserPassword,
  checkAuthRateLimit,
  clearAuthRateLimit,
  createPasswordResetToken,
  getUserFromBearerToken,
  hashPassword,
  registerUser,
  resetPasswordWithToken,
  verifyEmailWithToken,
  verifyPassword,
} from '../../src/server/services/auth/authService';
import { redactObject } from '../../src/server/utils/logger';

describe('Auth Service & Structured Logger Security', () => {
  it('hashes and verifies passwords safely', () => {
    const hash = hashPassword('StrongPass123!');
    expect(hash).not.toBe('StrongPass123!');
    expect(verifyPassword('StrongPass123!', hash)).toBe(true);
    expect(verifyPassword('WrongPass', hash)).toBe(false);
  });

  it('registers, verifies email once, changes password, and revokes sessions on reset', () => {
    const db = getDatabase(':memory:');
    const { user, verificationToken } = registerUser(db, {
      fullName: 'Aarav Mehta',
      email: 'aarav@example.com',
      password: 'Password123',
    });

    expect(user.emailVerified).toBe(false);
    expect(verifyEmailWithToken(db, verificationToken)).toBe(true);
    // Token is single-use
    expect(verifyEmailWithToken(db, verificationToken)).toBe(false);

    const login = authenticateUser(db, 'aarav@example.com', 'Password123');
    expect(getUserFromBearerToken(db, `Bearer ${login.token}`)?.user.emailVerified).toBe(true);

    // Wrong current password is rejected
    expect(changeUserPassword(db, user.id, 'WrongPass', 'NewPassword123')).toBe(false);
    expect(changeUserPassword(db, user.id, 'Password123', 'NewPassword123')).toBe(true);

    // Password reset revokes active sessions
    const { resetToken } = createPasswordResetToken(db, 'aarav@example.com');
    expect(resetToken).toBeTruthy();
    expect(resetPasswordWithToken(db, resetToken!, 'ResetPass123')).toBe(true);
    expect(getUserFromBearerToken(db, `Bearer ${login.token}`)).toBeNull();
  });

  it('enforces and clears sliding window rate limits', () => {
    const key = 'test-rate-limit-key';
    clearAuthRateLimit(key);
    expect(checkAuthRateLimit(key, 2, 60_000)).toBe(true);
    expect(checkAuthRateLimit(key, 2, 60_000)).toBe(true);
    expect(checkAuthRateLimit(key, 2, 60_000)).toBe(false);
    clearAuthRateLimit(key);
    expect(checkAuthRateLimit(key, 2, 60_000)).toBe(true);
  });

  it('redacts sensitive fields and handles circular references in logger', () => {
    const circular: Record<string, unknown> = {
      userId: 'u-1',
      password: 'secret-value',
      nested: {
        authorizationHeader: 'Bearer abc',
        apiSecret: 'xyz',
        safeField: 'visible',
      },
    };
    circular.self = circular;

    const redacted = redactObject(circular) as Record<string, unknown>;
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.self).toBe('[Circular]');
    const nested = redacted.nested as Record<string, unknown>;
    expect(nested.authorizationHeader).toBe('[REDACTED]');
    expect(nested.apiSecret).toBe('[REDACTED]');
    expect(nested.safeField).toBe('visible');
  });
});
