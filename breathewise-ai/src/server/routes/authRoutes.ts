import express from 'express';
import type { DatabaseSync } from 'node:sqlite';
import type { UserRole } from '../../types/domain';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  profileUpdateSchema,
  registerSchema,
  resetPasswordSchema,
} from '../../validators/schemas';
import { envConfig } from '../config/env';
import {
  authenticateUser,
  changeUserPassword,
  checkAuthRateLimit,
  clearAuthRateLimit,
  createPasswordResetToken,
  createSessionForUser,
  mapRowToAuthUser,
  registerUser,
  resetPasswordWithToken,
  verifyEmailWithToken,
  writeAuditLog,
  type AuthenticatedRequest,
} from '../services/auth/authService';
import { getUserProfile } from './helpers';

const DEMO_ROLE_EMAIL_MAP: Record<string, string> = {
  INDIVIDUAL_USER: 'demo.user@breathewise.local',
  FAMILY_ADMIN: 'demo.family@breathewise.local',
  FAMILY_MEMBER: 'demo.member@breathewise.local',
  COMMUNITY_MODERATOR: 'demo.moderator@breathewise.local',
  SYSTEM_ADMIN: 'demo.admin@breathewise.local',
};

export function createAuthRouter(
  db: DatabaseSync,
  requireAuth: express.RequestHandler,
): express.Router {
  const router = express.Router();

  router.post('/auth/register', (req, res) => {
    const rateKey = `register:${req.ip ?? 'local'}`;
    if (!checkAuthRateLimit(rateKey)) {
      return res.status(429).json({ error: 'Too many registration attempts. Please wait a few minutes and try again.' });
    }
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid registration data' });
    }
    try {
      const { user, verificationToken } = registerUser(db, parsed.data);
      const session = createSessionForUser(
        db,
        user.id,
        false,
        String(req.headers['user-agent'] ?? ''),
        req.ip ?? '',
      );
      return res.status(201).json({
        user,
        token: session.token,
        expiresAt: session.expiresAt,
        verificationPreviewToken: verificationToken,
      });
    } catch (err) {
      const message = (err as Error).message;
      const status = message.includes('already exists') ? 409 : 500;
      return res.status(status).json({ error: message });
    }
  });

  router.post('/auth/login', (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid login input' });
    }

    const rateKey = `${req.ip ?? 'local'}:${parsed.data.email}`;
    if (!checkAuthRateLimit(rateKey)) {
      return res.status(429).json({ error: 'Too many login attempts. Please wait a few minutes and try again.' });
    }

    try {
      const result = authenticateUser(
        db,
        parsed.data.email,
        parsed.data.password,
        parsed.data.rememberMe,
        String(req.headers['user-agent'] ?? ''),
        req.ip ?? '',
      );
      clearAuthRateLimit(rateKey);
      return res.json(result);
    } catch (err) {
      return res.status(401).json({ error: (err as Error).message });
    }
  });

  router.post('/auth/demo-login', (req, res) => {
    if (!envConfig.demoMode) {
      return res.status(403).json({ error: 'Demo mode is disabled in this environment.' });
    }
    const rateKey = `demo:${req.ip ?? 'local'}`;
    if (!checkAuthRateLimit(rateKey, 30)) {
      return res.status(429).json({ error: 'Too many demo login attempts. Please wait a few minutes and try again.' });
    }
    const role = String(req.body?.role ?? 'FAMILY_ADMIN');
    const email = DEMO_ROLE_EMAIL_MAP[role];
    if (!email) {
      return res.status(400).json({ error: 'Unknown demo role requested.' });
    }
    const row = db
      .prepare('SELECT id, full_name, email, role, email_verified, onboarding_completed, created_at FROM users WHERE email = ? AND is_demo = 1')
      .get(email) as
      | {
          id: string;
          full_name: string;
          email: string;
          role: UserRole;
          email_verified: number;
          onboarding_completed: number;
          created_at: string;
        }
      | undefined;

    if (!row) {
      return res.status(404).json({ error: 'Demo account is not seeded.' });
    }

    const session = createSessionForUser(
      db,
      row.id,
      false,
      String(req.headers['user-agent'] ?? ''),
      req.ip ?? '',
    );
    writeAuditLog(db, row.id, 'DEMO_LOGIN', 'session', row.id, `Evaluator signed into Demo Mode role ${row.role}`);
    return res.json({
      user: mapRowToAuthUser(row),
      token: session.token,
      expiresAt: session.expiresAt,
      isDemoAccount: true,
    });
  });

  router.post('/auth/verify-email', (req, res) => {
    const token = String(req.body?.token ?? '');
    if (!token || !verifyEmailWithToken(db, token)) {
      return res.status(400).json({ error: 'Verification link is invalid or expired.' });
    }
    res.json({ verified: true });
  });

  router.post('/auth/forgot-password', (req, res) => {
    const rateKey = `forgot:${req.ip ?? 'local'}`;
    if (!checkAuthRateLimit(rateKey)) {
      return res.status(429).json({ error: 'Too many password reset requests. Please wait a few minutes.' });
    }
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }
    const { resetToken } = createPasswordResetToken(db, parsed.data.email);
    res.json({
      message: 'If an account matches this email, password reset instructions have been issued.',
      ...(envConfig.nodeEnv !== 'production' && resetToken ? { resetPreviewToken: resetToken } : {}),
    });
  });

  router.post('/auth/reset-password', (req, res) => {
    const rateKey = `reset:${req.ip ?? 'local'}`;
    if (!checkAuthRateLimit(rateKey)) {
      return res.status(429).json({ error: 'Too many password reset attempts. Please wait a few minutes.' });
    }
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid reset input' });
    }
    const ok = resetPasswordWithToken(db, parsed.data.token, parsed.data.password);
    if (!ok) {
      return res.status(400).json({ error: 'Reset token is invalid, expired, or already used.' });
    }
    res.json({ reset: true });
  });

  router.post('/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').run(new Date().toISOString(), req.authSessionId!);
    res.json({ loggedOut: true });
  });

  router.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.authUser, profile: getUserProfile(db, req.authUser!.id) });
  });

  router.get('/auth/sessions', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare('SELECT id, user_agent, ip_address, expires_at, revoked_at, created_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 15')
      .all(req.authUser!.id);
    res.json({
      sessions: rows.map((r) => ({
        id: String(r.id),
        userAgent: String(r.user_agent),
        ipAddress: String(r.ip_address),
        expiresAt: String(r.expires_at),
        revokedAt: r.revoked_at ? String(r.revoked_at) : null,
        createdAt: String(r.created_at),
        isCurrent: String(r.id) === req.authSessionId,
      })),
    });
  });

  router.delete('/auth/sessions/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = db
      .prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND user_id = ?')
      .run(new Date().toISOString(), String(req.params.id), req.authUser!.id);
    if (Number(result.changes) === 0) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    res.json({ revoked: true });
  });

  router.post('/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid password input' });
    }
    const changed = changeUserPassword(db, req.authUser!.id, parsed.data.currentPassword, parsed.data.newPassword);
    if (!changed) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    res.json({ changed: true });
  });

  router.delete('/auth/account', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    writeAuditLog(db, userId, 'ACCOUNT_DELETED', 'user', userId, 'User requested permanent account deletion');
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    res.json({ deleted: true });
  });

  router.get('/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ profile: getUserProfile(db, req.authUser!.id) });
  });

  router.put('/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid profile fields' });
    }
    const d = parsed.data;
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE user_profiles SET
        country = ?, state_region = ?, city = ?, postal_code = ?, latitude = ?, longitude = ?, aqi_standard = ?,
        work_mode = ?, commute_distance_km = ?, primary_transport = ?, outdoor_activity = ?, exercise_preference = ?,
        cooking_fuel = ?, household_size = ?, public_transit_available = ?, children_count = ?, adults_count = ?,
        elderly_count = ?, has_sensitive_members = ?, has_air_purifier = ?, ventilation_type = ?, has_balcony_windows = ?,
        indoor_cooking_ventilation = ?, has_indoor_sensor = ?, preferred_language = ?, sustainability_goal = ?,
        daily_schedule_summary = ?, budget_level = ?, consent_withdrawn = ?, updated_at = ?
      WHERE user_id = ?
    `).run(
      d.country,
      d.stateRegion,
      d.city,
      d.postalCode ?? '',
      d.latitude,
      d.longitude,
      d.aqiStandard,
      d.workMode,
      d.commuteDistanceKm,
      d.primaryTransport,
      d.outdoorActivity,
      d.exercisePreference,
      d.cookingFuel,
      d.householdSize,
      d.publicTransitAvailable ? 1 : 0,
      d.childrenCount,
      d.adultsCount,
      d.elderlyCount,
      d.hasSensitiveMembers ? 1 : 0,
      d.hasAirPurifier ? 1 : 0,
      d.ventilationType,
      d.hasBalconyWindows ? 1 : 0,
      d.indoorCookingVentilation,
      d.hasIndoorSensor ? 1 : 0,
      d.preferredLanguage,
      d.sustainabilityGoal,
      d.dailyScheduleSummary,
      d.budgetLevel,
      d.consentWithdrawn ? 1 : 0,
      now,
      req.authUser!.id,
    );

    db.prepare('UPDATE users SET onboarding_completed = 1, updated_at = ? WHERE id = ?').run(now, req.authUser!.id);
    res.json({ profile: getUserProfile(db, req.authUser!.id) });
  });

  return router;
}
