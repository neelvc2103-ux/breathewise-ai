import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { DatabaseSync } from 'node:sqlite';
import type { Request, Response, NextFunction } from 'express';
import type { AuthUser, UserRole } from '../../../types/domain';
import { hashToken } from '../../db/seed';
import { logger } from '../../utils/logger';

const BCRYPT_COST_ROUNDS = 10;
const DEFAULT_RATE_LIMIT_MAX_ATTEMPTS = 12;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const MAX_RATE_LIMIT_ENTRIES = 5000;
const STANDARD_SESSION_TTL_MS = 24 * 3600 * 1000;
const REMEMBER_ME_SESSION_TTL_MS = 14 * 24 * 3600 * 1000;
const VERIFICATION_TOKEN_TTL_MS = 24 * 3600 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 3600 * 1000;
const MAX_USER_AGENT_LENGTH = 160;
const MAX_IP_LENGTH = 64;

interface UserAuthRow {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  email_verified: number;
  onboarding_completed: number;
  created_at: string;
}

// In-memory rate limiter for brute-force protection on auth endpoints
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function pruneExpiredRateLimits(now: number): void {
  for (const [k, v] of loginAttempts.entries()) {
    if (v.resetAt < now) {
      loginAttempts.delete(k);
    }
  }
}

export function mapRowToAuthUser(row: UserAuthRow): AuthUser {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    emailVerified: row.email_verified === 1,
    onboardingCompleted: row.onboarding_completed === 1,
    createdAt: row.created_at,
  };
}

export function hashPassword(plainPassword: string): string {
  return bcrypt.hashSync(plainPassword, BCRYPT_COST_ROUNDS);
}

export function verifyPassword(plainPassword: string, passwordHash: string): boolean {
  return bcrypt.compareSync(plainPassword, passwordHash);
}

/**
 * Checks and increments an in-memory sliding window rate limit for a given key.
 * Returns false once maxAttempts is reached within the active window.
 */
export function checkAuthRateLimit(
  key: string,
  maxAttempts = DEFAULT_RATE_LIMIT_MAX_ATTEMPTS,
  windowMs = DEFAULT_RATE_LIMIT_WINDOW_MS,
): boolean {
  const now = Date.now();
  if (loginAttempts.size >= MAX_RATE_LIMIT_ENTRIES) {
    pruneExpiredRateLimits(now);
  }
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count += 1;
  return true;
}

export function clearAuthRateLimit(key: string): void {
  loginAttempts.delete(key);
}

export function writeAuditLog(
  db: DatabaseSync,
  actorUserId: string | null,
  action: string,
  targetType: string,
  targetId: string | null,
  details: string,
  ipAddress = '',
): void {
  db.prepare(`
    INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, details, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), actorUserId, action, targetType, targetId, details, ipAddress, new Date().toISOString());
}

export function registerUser(
  db: DatabaseSync,
  input: { fullName: string; email: string; password: string },
): { user: AuthUser; verificationToken: string } {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(input.email);
  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = hashPassword(input.password);

  db.prepare(`
    INSERT INTO users (id, full_name, email, password_hash, role, email_verified, onboarding_completed, accepted_terms_at, is_demo, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'INDIVIDUAL_USER', 0, 0, ?, 0, ?, ?)
  `).run(userId, input.fullName, input.email, passwordHash, now, now, now);

  db.prepare('INSERT INTO user_profiles (user_id, updated_at) VALUES (?, ?)').run(userId, now);
  db.prepare('INSERT INTO notification_preferences (user_id, updated_at) VALUES (?, ?)').run(userId, now);

  const verificationToken = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS).toISOString();
  db.prepare(`
    INSERT INTO verification_tokens (id, user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), userId, hashToken(verificationToken), expiresAt, now);

  writeAuditLog(db, userId, 'USER_REGISTERED', 'user', userId, 'New account registered');
  logger.info('user_registered', { userId });

  return {
    user: {
      id: userId,
      fullName: input.fullName,
      email: input.email,
      role: 'INDIVIDUAL_USER',
      emailVerified: false,
      onboardingCompleted: false,
      createdAt: now,
    },
    verificationToken,
  };
}

export function createSessionForUser(
  db: DatabaseSync,
  userId: string,
  rememberMe: boolean,
  userAgent = '',
  ipAddress = '',
): { token: string; expiresAt: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const ttlMs = rememberMe ? REMEMBER_ME_SESSION_TTL_MS : STANDARD_SESSION_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, user_agent, ip_address, remember_me, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    userId,
    hashToken(rawToken),
    userAgent.slice(0, MAX_USER_AGENT_LENGTH),
    ipAddress.slice(0, MAX_IP_LENGTH),
    rememberMe ? 1 : 0,
    expiresAt,
    now,
  );

  return { token: rawToken, expiresAt };
}

export function authenticateUser(
  db: DatabaseSync,
  email: string,
  password: string,
  rememberMe = false,
  userAgent = '',
  ipAddress = '',
): { user: AuthUser; token: string; expiresAt: string } {
  const row = db
    .prepare('SELECT id, full_name, email, password_hash, role, email_verified, onboarding_completed, created_at FROM users WHERE email = ?')
    .get(email) as (UserAuthRow & { password_hash: string }) | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new Error('Invalid email or password.');
  }

  const session = createSessionForUser(db, row.id, rememberMe, userAgent, ipAddress);
  writeAuditLog(db, row.id, 'USER_LOGIN', 'session', row.id, 'Successful password authentication', ipAddress);

  return {
    user: mapRowToAuthUser(row),
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

export function verifyEmailWithToken(db: DatabaseSync, rawToken: string): boolean {
  const tHash = hashToken(rawToken);
  const tokenRow = db
    .prepare('SELECT id, user_id, expires_at, used_at FROM verification_tokens WHERE token_hash = ?')
    .get(tHash) as { id: string; user_id: string; expires_at: string; used_at: string | null } | undefined;

  if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return false;
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE verification_tokens SET used_at = ? WHERE id = ?').run(now, tokenRow.id);
  db.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?').run(now, tokenRow.user_id);
  writeAuditLog(db, tokenRow.user_id, 'EMAIL_VERIFIED', 'user', tokenRow.user_id, 'Email verification completed');
  return true;
}

export function createPasswordResetToken(db: DatabaseSync, email: string): { resetToken?: string } {
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
  // Prevent account enumeration: always return cleanly even if user doesn't exist
  if (!user) {
    return {};
  }

  const rawToken = crypto.randomBytes(24).toString('hex');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS).toISOString();

  db.prepare(`
    INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), user.id, hashToken(rawToken), expiresAt, now);

  writeAuditLog(db, user.id, 'PASSWORD_RESET_REQUESTED', 'user', user.id, 'Single-use reset token issued');
  return { resetToken: rawToken };
}

export function resetPasswordWithToken(db: DatabaseSync, rawToken: string, newPassword: string): boolean {
  const tHash = hashToken(rawToken);
  const row = db
    .prepare('SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?')
    .get(tHash) as { id: string; user_id: string; expires_at: string; used_at: string | null } | undefined;

  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    return false;
  }

  const now = new Date().toISOString();
  const newHash = hashPassword(newPassword);
  db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').run(now, row.id);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, now, row.user_id);
  // Revoke all existing sessions after password reset
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(now, row.user_id);
  writeAuditLog(db, row.user_id, 'PASSWORD_RESET_COMPLETED', 'user', row.user_id, 'Password updated and prior sessions revoked');
  return true;
}

export function changeUserPassword(
  db: DatabaseSync,
  userId: string,
  currentPassword: string,
  newPassword: string,
): boolean {
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as { password_hash: string } | undefined;
  if (!row || !verifyPassword(currentPassword, row.password_hash)) {
    return false;
  }
  const newHash = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, new Date().toISOString(), userId);
  writeAuditLog(db, userId, 'PASSWORD_CHANGED', 'user', userId, 'User changed account password');
  return true;
}

export function getUserFromBearerToken(db: DatabaseSync, authHeader?: string): { user: AuthUser; sessionId: string } | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) return null;

  const row = db
    .prepare(`
      SELECT s.id AS session_id, s.expires_at, s.revoked_at,
             u.id, u.full_name, u.email, u.role, u.email_verified, u.onboarding_completed, u.created_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
    `)
    .get(hashToken(rawToken)) as (UserAuthRow & { session_id: string; expires_at: string; revoked_at: string | null }) | undefined;

  if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
    return null;
  }

  return {
    sessionId: row.session_id,
    user: mapRowToAuthUser(row),
  };
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
  authSessionId?: string;
}

export function createRequireAuth(db: DatabaseSync) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const resolved = getUserFromBearerToken(db, req.headers.authorization);
    if (!resolved) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    req.authUser = resolved.user;
    req.authSessionId = resolved.sessionId;
    next();
  };
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role permissions.' });
    }
    next();
  };
}
