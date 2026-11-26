import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import express from 'express';
import type { DatabaseSync } from 'node:sqlite';
import type { AqiStandard, DemoScenario, UserProfile, UserRole } from '../../types/domain';
import {
  assistantMessageSchema,
  changePasswordSchema,
  createHouseholdSchema,
  createPostSchema,
  feedbackSchema,
  forgotPasswordSchema,
  inviteMemberSchema,
  logActivitySchema,
  loginSchema,
  notificationPrefSchema,
  placesGroundingSchema,
  profileUpdateSchema,
  registerSchema,
  reportPostSchema,
  resetPasswordSchema,
} from '../../validators/schemas';
import { envConfig } from '../config/env';
import { hashToken } from '../db/seed';
import { generateAssistantReply, queryPlacesWithMapsGrounding } from '../services/ai/aiService';
import { getEnvironmentalSnapshot, searchLocations } from '../services/air-quality/environmentalService';
import { getPersonalizedAlternatives } from '../services/alternatives/alternativesService';
import {
  authenticateUser,
  checkAuthRateLimit,
  clearAuthRateLimit,
  createPasswordResetToken,
  createRequireAuth,
  createSessionForUser,
  registerUser,
  requireRoles,
  resetPasswordWithToken,
  verifyEmailWithToken,
  writeAuditLog,
  type AuthenticatedRequest,
} from '../services/auth/authService';
import {
  getImpactSummary,
  listEmissionFactors,
  logUserActivity,
} from '../services/emissions/impactCalculator';
import { getIndoorGuidance } from '../services/indoor/indoorService';
import { evaluateAndCreateAlert } from '../services/notifications/notificationService';
import { generateAndSaveRoutine, getLatestRoutine } from '../services/routines/routineService';
import { logger } from '../utils/logger';

function mapProfileRow(r: Record<string, unknown> | undefined): UserProfile | null {
  if (!r) return null;
  return {
    userId: String(r.user_id),
    country: String(r.country),
    stateRegion: String(r.state_region),
    city: String(r.city),
    postalCode: String(r.postal_code ?? ''),
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    aqiStandard: String(r.aqi_standard) === 'US_EPA' ? 'US_EPA' : 'INDIA_NAQI',
    workMode: String(r.work_mode) as UserProfile['workMode'],
    commuteDistanceKm: Number(r.commute_distance_km),
    primaryTransport: String(r.primary_transport) as UserProfile['primaryTransport'],
    outdoorActivity: String(r.outdoor_activity),
    exercisePreference: String(r.exercise_preference),
    cookingFuel: String(r.cooking_fuel) as UserProfile['cookingFuel'],
    householdSize: Number(r.household_size),
    publicTransitAvailable: Number(r.public_transit_available) === 1,
    childrenCount: Number(r.children_count),
    adultsCount: Number(r.adults_count),
    elderlyCount: Number(r.elderly_count),
    hasSensitiveMembers: Number(r.has_sensitive_members) === 1,
    hasAirPurifier: Number(r.has_air_purifier) === 1,
    ventilationType: String(r.ventilation_type) as UserProfile['ventilationType'],
    hasBalconyWindows: Number(r.has_balcony_windows) === 1,
    indoorCookingVentilation: String(r.indoor_cooking_ventilation) as UserProfile['indoorCookingVentilation'],
    hasIndoorSensor: Number(r.has_indoor_sensor) === 1,
    preferredLanguage: (String(r.preferred_language) as UserProfile['preferredLanguage']) || 'en',
    sustainabilityGoal: String(r.sustainability_goal),
    dailyScheduleSummary: String(r.daily_schedule_summary),
    budgetLevel: String(r.budget_level) as UserProfile['budgetLevel'],
    consentWithdrawn: Number(r.consent_withdrawn) === 1,
  };
}

export function createApiRouter(db: DatabaseSync): express.Router {
  const router = express.Router();
  const requireAuth = createRequireAuth(db);

  // =========================================================================
  // 1. Health & OpenAPI Documentation
  // =========================================================================
  router.get('/health', (_req, res) => {
    try {
      const check = db.prepare('SELECT 1 AS ok').get() as { ok: number };
      res.json({
        status: check?.ok === 1 ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        aiConfigured: Boolean(envConfig.geminiApiKey),
        aiModel: envConfig.aiModel,
        demoMode: envConfig.demoMode,
      });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  router.get('/docs/openapi.json', (_req, res) => {
    res.json({
      openapi: '3.0.3',
      info: {
        title: 'BreatheWise AI REST API',
        version: '1.0.0',
        description: 'Versioned REST API for air quality intelligence, GenAI guidance, adaptive routines, household impact, and RBAC administration.',
      },
      paths: {
        '/api/v1/health': { get: { summary: 'System health check' } },
        '/api/v1/auth/register': { post: { summary: 'Register new account' } },
        '/api/v1/auth/login': { post: { summary: 'Authenticate and receive Bearer session token' } },
        '/api/v1/air-quality': { get: { summary: 'Retrieve live/cached or demo-scenario AQI & weather snapshot' } },
        '/api/v1/assistant/chat': { post: { summary: 'Send context-grounded question to BreatheWise AI assistant' } },
        '/api/v1/assistant/places-grounding': { post: { summary: 'Find nearby clean-air places and transit via Gemini Maps Grounding' } },
        '/api/v1/routines/generate': { post: { summary: 'Generate AQI-adaptive daily schedule' } },
        '/api/v1/impact/activities': { post: { summary: 'Log sustainable activity with deterministic emission math' } },
        '/api/v1/households': { get: { summary: 'List user household & shared goals' }, post: { summary: 'Create household' } },
        '/api/v1/communities/posts': { get: { summary: 'List community discussions' }, post: { summary: 'Create community post' } },
        '/api/v1/admin/overview': { get: { summary: 'System Administrator monitoring summary' } },
      },
    });
  });

  // =========================================================================
  // 2. Authentication & Session Lifecycle
  // =========================================================================
  router.post('/auth/register', (req, res) => {
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
      return res.status(409).json({ error: (err as Error).message });
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
    const role = String(req.body?.role ?? 'FAMILY_ADMIN');
    const roleEmailMap: Record<string, string> = {
      INDIVIDUAL_USER: 'demo.user@breathewise.local',
      FAMILY_ADMIN: 'demo.family@breathewise.local',
      FAMILY_MEMBER: 'demo.member@breathewise.local',
      COMMUNITY_MODERATOR: 'demo.moderator@breathewise.local',
      SYSTEM_ADMIN: 'demo.admin@breathewise.local',
    };
    const email = roleEmailMap[role];
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
      user: {
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        role: row.role,
        emailVerified: row.email_verified === 1,
        onboardingCompleted: row.onboarding_completed === 1,
        createdAt: row.created_at,
      },
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
    const profileRow = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.authUser!.id);
    res.json({ user: req.authUser, profile: mapProfileRow(profileRow) });
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
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.authUser!.id) as { password_hash: string };
    if (!bcrypt.compareSync(parsed.data.currentPassword, row.password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    const newHash = bcrypt.hashSync(parsed.data.newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, new Date().toISOString(), req.authUser!.id);
    writeAuditLog(db, req.authUser!.id, 'PASSWORD_CHANGED', 'user', req.authUser!.id, 'User changed account password');
    res.json({ changed: true });
  });

  router.delete('/auth/account', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    writeAuditLog(db, userId, 'ACCOUNT_DELETED', 'user', userId, 'User requested permanent account deletion');
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    res.json({ deleted: true });
  });

  // =========================================================================
  // 3. Profile & Onboarding
  // =========================================================================
  router.get('/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const row = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.authUser!.id);
    res.json({ profile: mapProfileRow(row) });
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
    const updated = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.authUser!.id);
    res.json({ profile: mapProfileRow(updated) });
  });

  // =========================================================================
  // 4. Environmental Data & Location Search (Public + Personalized)
  // =========================================================================
  router.get('/locations/search', async (req, res) => {
    const q = String(req.query.q ?? '');
    const results = await searchLocations(db, q);
    res.json({ locations: results });
  });

  router.get('/air-quality', async (req: AuthenticatedRequest, res) => {
    const city = String(req.query.city ?? 'New Delhi');
    const region = String(req.query.region ?? '');
    const country = String(req.query.country ?? '');
    const latitude = Number(req.query.lat ?? 28.6139);
    const longitude = Number(req.query.lon ?? 77.209);
    const standard: AqiStandard = req.query.standard === 'US_EPA' ? 'US_EPA' : 'INDIA_NAQI';
    const demoScenario = (String(req.query.demoScenario ?? 'live') as DemoScenario);

    if (Number.isNaN(latitude) || Number.isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Invalid geographic coordinates.' });
    }

    try {
      // Optionally recognize authenticated user for alert evaluation
      const resolved = req.headers.authorization
        ? (await import('../services/auth/authService')).getUserFromBearerToken(db, req.headers.authorization)
        : null;

      const snapshot = await getEnvironmentalSnapshot(db, {
        city,
        region,
        country,
        latitude,
        longitude,
        standard,
        demoScenario,
        userId: resolved?.user.id,
      });

      if (resolved) {
        evaluateAndCreateAlert(db, resolved.user.id, snapshot);
      }
      res.json({ snapshot });
    } catch (err) {
      res.status(503).json({ error: (err as Error).message });
    }
  });

  // =========================================================================
  // 5. GenAI Assistant, Routines, Indoor Air & Sustainable Alternatives
  // =========================================================================
  router.post('/assistant/chat', requireAuth, async (req: AuthenticatedRequest, res) => {
    const parsed = assistantMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid chat message' });
    }
    const profileRow = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.authUser!.id);
    const profile = mapProfileRow(profileRow);

    if (profile?.consentWithdrawn) {
      return res.status(403).json({
        error: 'Personalization consent is currently withdrawn in your Settings. Re-enable personalization or use the public Air Quality Explorer.',
      });
    }

    const city = parsed.data.city || profile?.city || 'New Delhi';
    const lat = parsed.data.latitude ?? profile?.latitude ?? 28.6139;
    const lon = parsed.data.longitude ?? profile?.longitude ?? 77.209;
    const std = parsed.data.standard ?? profile?.aqiStandard ?? 'INDIA_NAQI';
    const demoScenario = parsed.data.demoScenario ?? 'live';

    try {
      const snapshot = await getEnvironmentalSnapshot(db, {
        city,
        latitude: lat,
        longitude: lon,
        standard: std,
        demoScenario: demoScenario === 'ai_failure' ? 'live' : demoScenario,
        userId: req.authUser!.id,
      });

      const reply = await generateAssistantReply(db, {
        userId: req.authUser!.id,
        message: parsed.data.message,
        conversationId: parsed.data.conversationId,
        snapshot,
        profile: profile ?? {},
        forceAiFailure: demoScenario === 'ai_failure',
      });

      res.json(reply);
    } catch (err) {
      logger.error('assistant_chat_error', { message: (err as Error).message });
      res.status(503).json({ error: 'Unable to retrieve environmental context for assistant.' });
    }
  });

  router.post('/assistant/places-grounding', requireAuth, async (req: AuthenticatedRequest, res) => {
    const parsed = placesGroundingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid place search request' });
    }
    const profileRow = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.authUser!.id);
    const profile = mapProfileRow(profileRow);

    if (profile?.consentWithdrawn) {
      return res.status(403).json({
        error: 'Personalization consent is currently withdrawn in your Settings.',
      });
    }

    const city = parsed.data.city || profile?.city || 'New Delhi';
    const std = parsed.data.standard ?? profile?.aqiStandard ?? 'INDIA_NAQI';
    const demoScenario = parsed.data.demoScenario ?? 'live';

    try {
      const snapshot = await getEnvironmentalSnapshot(db, {
        city,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        standard: std,
        demoScenario: demoScenario === 'ai_failure' ? 'live' : demoScenario,
        userId: req.authUser!.id,
      });

      const reply = await queryPlacesWithMapsGrounding(db, {
        userId: req.authUser!.id,
        query: parsed.data.query,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        snapshot,
        profile: profile ?? {},
        forceAiFailure: demoScenario === 'ai_failure',
      });

      res.json(reply);
    } catch (err) {
      logger.error('places_grounding_error', { message: (err as Error).message });
      res.status(503).json({ error: 'Unable to retrieve environmental context for nearby place grounding.' });
    }
  });

  router.get('/assistant/conversations', requireAuth, (req: AuthenticatedRequest, res) => {
    const convs = db
      .prepare('SELECT id, title, city, created_at, updated_at FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 20')
      .all(req.authUser!.id);
    res.json({ conversations: convs });
  });

  router.get('/assistant/conversations/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const conv = db
      .prepare('SELECT id, title, city FROM ai_conversations WHERE id = ? AND user_id = ?')
      .get(String(req.params.id), req.authUser!.id);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }
    const msgs = db
      .prepare('SELECT id, sender, content_text, structured_json, provider_used, created_at FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC')
      .all(String(req.params.id));
    res.json({
      conversation: conv,
      messages: msgs.map((m) => ({
        id: String(m.id),
        sender: String(m.sender),
        contentText: String(m.content_text),
        recommendations: m.structured_json ? JSON.parse(String(m.structured_json)) : [],
        providerUsed: m.provider_used ? String(m.provider_used) : null,
        createdAt: String(m.created_at),
      })),
    });
  });

  router.get('/routines/latest', requireAuth, (req: AuthenticatedRequest, res) => {
    const routine = getLatestRoutine(db, req.authUser!.id);
    res.json({ routine });
  });

  router.post('/routines/generate', requireAuth, async (req: AuthenticatedRequest, res) => {
    const profile = mapProfileRow(db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.authUser!.id));
    const city = String(req.body?.city ?? profile?.city ?? 'New Delhi');
    const lat = Number(req.body?.latitude ?? profile?.latitude ?? 28.6139);
    const lon = Number(req.body?.longitude ?? profile?.longitude ?? 77.209);
    const std: AqiStandard = req.body?.standard === 'US_EPA' ? 'US_EPA' : (profile?.aqiStandard ?? 'INDIA_NAQI');
    const demoScenario = (String(req.body?.demoScenario ?? 'live') as DemoScenario);

    try {
      const snapshot = await getEnvironmentalSnapshot(db, {
        city,
        latitude: lat,
        longitude: lon,
        standard: std,
        demoScenario: demoScenario === 'ai_failure' ? 'live' : demoScenario,
        userId: req.authUser!.id,
      });
      const routine = generateAndSaveRoutine(db, req.authUser!.id, snapshot, profile ?? {});
      res.status(201).json({ routine });
    } catch (err) {
      res.status(503).json({ error: (err as Error).message });
    }
  });

  router.patch('/routines/activities/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const actId = String(req.params.id);
    // Ownership validation via join on daily_routines
    const owned = db
      .prepare(`
        SELECT ra.id FROM routine_activities ra
        JOIN daily_routines dr ON dr.id = ra.routine_id
        WHERE ra.id = ? AND dr.user_id = ?
      `)
      .get(actId, req.authUser!.id);
    if (!owned) {
      return res.status(404).json({ error: 'Routine activity not found.' });
    }

    const completed = typeof req.body?.completed === 'boolean' ? (req.body.completed ? 1 : 0) : undefined;
    const scheduledTime = typeof req.body?.scheduledTime === 'string' ? req.body.scheduledTime.slice(0, 10) : undefined;

    if (completed !== undefined) {
      db.prepare('UPDATE routine_activities SET completed = ? WHERE id = ?').run(completed, actId);
    }
    if (scheduledTime) {
      db.prepare('UPDATE routine_activities SET scheduled_time = ? WHERE id = ?').run(scheduledTime, actId);
    }
    res.json({ updated: true });
  });

  router.get('/indoor/guidance', requireAuth, async (req: AuthenticatedRequest, res) => {
    const profile = mapProfileRow(db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.authUser!.id));
    const city = String(req.query.city ?? profile?.city ?? 'New Delhi');
    const lat = Number(req.query.lat ?? profile?.latitude ?? 28.6139);
    const lon = Number(req.query.lon ?? profile?.longitude ?? 77.209);
    const std: AqiStandard = req.query.standard === 'US_EPA' ? 'US_EPA' : (profile?.aqiStandard ?? 'INDIA_NAQI');
    const demoScenario = (String(req.query.demoScenario ?? 'live') as DemoScenario);

    try {
      const snapshot = await getEnvironmentalSnapshot(db, {
        city,
        latitude: lat,
        longitude: lon,
        standard: std,
        demoScenario,
        userId: req.authUser!.id,
      });
      res.json({ guidance: getIndoorGuidance(snapshot, profile ?? {}) });
    } catch (err) {
      res.status(503).json({ error: (err as Error).message });
    }
  });

  router.get('/alternatives', requireAuth, async (req: AuthenticatedRequest, res) => {
    const profile = mapProfileRow(db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.authUser!.id));
    const city = String(req.query.city ?? profile?.city ?? 'New Delhi');
    const lat = Number(req.query.lat ?? profile?.latitude ?? 28.6139);
    const lon = Number(req.query.lon ?? profile?.longitude ?? 77.209);
    const std: AqiStandard = req.query.standard === 'US_EPA' ? 'US_EPA' : (profile?.aqiStandard ?? 'INDIA_NAQI');
    const demoScenario = (String(req.query.demoScenario ?? 'live') as DemoScenario);

    try {
      const snapshot = await getEnvironmentalSnapshot(db, {
        city,
        latitude: lat,
        longitude: lon,
        standard: std,
        demoScenario,
        userId: req.authUser!.id,
      });
      res.json({ alternatives: getPersonalizedAlternatives(snapshot, profile ?? {}) });
    } catch (err) {
      res.status(503).json({ error: (err as Error).message });
    }
  });

  // =========================================================================
  // 6. Deterministic Impact Calculator & Activity History
  // =========================================================================
  router.get('/impact/factors', (_req, res) => {
    res.json({ factors: listEmissionFactors(db) });
  });

  router.get('/impact/summary', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ summary: getImpactSummary(db, req.authUser!.id) });
  });

  router.get('/impact/activities', requireAuth, (req: AuthenticatedRequest, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
    const rows = db
      .prepare('SELECT * FROM activity_logs WHERE user_id = ? ORDER BY activity_date DESC, created_at DESC LIMIT ?')
      .all(req.authUser!.id, limit);
    res.json({
      activities: rows.map((r) => ({
        id: String(r.id),
        userId: String(r.user_id),
        householdId: r.household_id ? String(r.household_id) : null,
        factorCode: String(r.factor_code),
        activityTitle: String(r.activity_title),
        quantity: Number(r.quantity),
        unit: String(r.unit),
        co2eAvoidedKg: Number(r.co2e_avoided_kg),
        fuelSavedLiters: Number(r.fuel_saved_liters),
        vehicleKmAvoided: Number(r.vehicle_km_avoided),
        energySavedKwh: Number(r.energy_saved_kwh),
        notes: String(r.notes ?? ''),
        activityDate: String(r.activity_date),
        createdAt: String(r.created_at),
      })),
    });
  });

  router.post('/impact/activities', requireAuth, (req: AuthenticatedRequest, res) => {
    const parsed = logActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid activity data' });
    }
    try {
      // Auto-link household if user belongs to one
      const member = db
        .prepare('SELECT household_id FROM household_members WHERE user_id = ? LIMIT 1')
        .get(req.authUser!.id) as { household_id: string } | undefined;

      const entry = logUserActivity(db, {
        userId: req.authUser!.id,
        householdId: parsed.data.householdId ?? member?.household_id ?? null,
        factorCode: parsed.data.factorCode,
        quantity: parsed.data.quantity,
        activityDate: parsed.data.activityDate,
        notes: parsed.data.notes,
      });
      res.status(201).json({ activity: entry, summary: getImpactSummary(db, req.authUser!.id) });
    } catch (err) {
      res.status(409).json({ error: (err as Error).message });
    }
  });

  router.delete('/impact/activities/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = db
      .prepare('DELETE FROM activity_logs WHERE id = ? AND user_id = ?')
      .run(String(req.params.id), req.authUser!.id);
    if (Number(result.changes) === 0) {
      return res.status(404).json({ error: 'Activity log not found.' });
    }
    res.json({ deleted: true, summary: getImpactSummary(db, req.authUser!.id) });
  });

  // =========================================================================
  // 7. Family & Household Management
  // =========================================================================
  router.get('/households', requireAuth, (req: AuthenticatedRequest, res) => {
    const memberships = db
      .prepare(`
        SELECT h.* FROM households h
        JOIN household_members hm ON hm.household_id = h.id
        WHERE hm.user_id = ?
      `)
      .all(req.authUser!.id);

    const households = memberships.map((h) => {
      const hid = String(h.id);
      const members = db
        .prepare(`
          SELECT u.id AS user_id, u.full_name, u.email, hm.household_role, hm.joined_at
          FROM household_members hm
          JOIN users u ON u.id = hm.user_id
          WHERE hm.household_id = ?
        `)
        .all(hid)
        .map((m) => ({
          userId: String(m.user_id),
          fullName: String(m.full_name),
          email: String(m.email),
          householdRole: String(m.household_role) as 'FAMILY_ADMIN' | 'FAMILY_MEMBER',
          joinedAt: String(m.joined_at),
        }));

      const invitations = db
        .prepare('SELECT id, invited_email, role, status, raw_preview_token, expires_at FROM household_invitations WHERE household_id = ?')
        .all(hid)
        .map((inv) => ({
          id: String(inv.id),
          invitedEmail: String(inv.invited_email),
          role: String(inv.role) as 'FAMILY_ADMIN' | 'FAMILY_MEMBER',
          status: String(inv.status) as 'PENDING' | 'ACCEPTED' | 'DECLINED',
          token: inv.raw_preview_token ? String(inv.raw_preview_token) : undefined,
          expiresAt: String(inv.expires_at),
        }));

      const agg = db
        .prepare('SELECT COALESCE(SUM(co2e_avoided_kg), 0) AS total FROM activity_logs WHERE household_id = ?')
        .get(hid) as { total: number };

      return {
        id: hid,
        name: String(h.name),
        city: String(h.city),
        sharedGoal: String(h.shared_goal),
        members,
        invitations,
        combinedImpactKg: Number(agg.total.toFixed(2)),
      };
    });

    // Also include pending invitations addressed to this user's email
    const pendingForUser = db
      .prepare(`
        SELECT hi.id, hi.raw_preview_token, hi.role, hi.expires_at, h.name AS household_name, h.city
        FROM household_invitations hi
        JOIN households h ON h.id = hi.household_id
        WHERE hi.invited_email = ? AND hi.status = 'PENDING'
      `)
      .all(req.authUser!.email);

    res.json({ households, incomingInvitations: pendingForUser });
  });

  router.post('/households', requireAuth, (req: AuthenticatedRequest, res) => {
    const parsed = createHouseholdSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid household data' });
    }
    const hid = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO households (id, name, city, shared_goal, created_by_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(hid, parsed.data.name, parsed.data.city, parsed.data.sharedGoal, req.authUser!.id, now, now);

    db.prepare(`
      INSERT INTO household_members (id, household_id, user_id, household_role, joined_at)
      VALUES (?, ?, ?, 'FAMILY_ADMIN', ?)
    `).run(crypto.randomUUID(), hid, req.authUser!.id, now);

    if (req.authUser!.role === 'INDIVIDUAL_USER') {
      db.prepare("UPDATE users SET role = 'FAMILY_ADMIN', updated_at = ? WHERE id = ?").run(now, req.authUser!.id);
    }

    res.status(201).json({ householdId: hid });
  });

  router.post('/households/:id/invite', requireAuth, (req: AuthenticatedRequest, res) => {
    const parsed = inviteMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid invitation email' });
    }
    const hid = String(req.params.id);
    const adminMembership = db
      .prepare("SELECT id FROM household_members WHERE household_id = ? AND user_id = ? AND household_role = 'FAMILY_ADMIN'")
      .get(hid, req.authUser!.id);
    if (!adminMembership) {
      return res.status(403).json({ error: 'Only a Family Administrator can invite members.' });
    }

    const rawToken = crypto.randomBytes(16).toString('hex');
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
    db.prepare(`
      INSERT INTO household_invitations (id, household_id, invited_email, role, token_hash, raw_preview_token, status, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `).run(
      crypto.randomUUID(),
      hid,
      parsed.data.email,
      parsed.data.role,
      hashToken(rawToken),
      envConfig.nodeEnv !== 'production' ? rawToken : null,
      expiresAt,
      now,
    );

    res.status(201).json({ invited: true, invitationToken: rawToken });
  });

  router.post('/households/invitations/:token/respond', requireAuth, (req: AuthenticatedRequest, res) => {
    const decision = req.body?.accept === true ? 'ACCEPTED' : 'DECLINED';
    const tokenHash = hashToken(String(req.params.token));
    const inv = db
      .prepare("SELECT * FROM household_invitations WHERE token_hash = ? AND status = 'PENDING'")
      .get(tokenHash) as { id: string; household_id: string; invited_email: string; role: 'FAMILY_ADMIN' | 'FAMILY_MEMBER'; expires_at: string } | undefined;

    if (!inv || new Date(inv.expires_at).getTime() < Date.now()) {
      return res.status(404).json({ error: 'Invitation not found or expired.' });
    }
    if (inv.invited_email !== req.authUser!.email) {
      return res.status(403).json({ error: 'This invitation was issued for a different email address.' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE household_invitations SET status = ? WHERE id = ?').run(decision, inv.id);
    if (decision === 'ACCEPTED') {
      db.prepare(`
        INSERT OR IGNORE INTO household_members (id, household_id, user_id, household_role, joined_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), inv.household_id, req.authUser!.id, inv.role, now);
    }
    res.json({ status: decision });
  });

  router.patch('/households/:id/goal', requireAuth, (req: AuthenticatedRequest, res) => {
    const hid = String(req.params.id);
    const adminMembership = db
      .prepare("SELECT id FROM household_members WHERE household_id = ? AND user_id = ? AND household_role = 'FAMILY_ADMIN'")
      .get(hid, req.authUser!.id);
    if (!adminMembership) {
      return res.status(403).json({ error: 'Only a Family Administrator can edit household goals.' });
    }
    const goal = String(req.body?.sharedGoal ?? '').trim().slice(0, 240);
    if (goal.length < 4) {
      return res.status(400).json({ error: 'Goal description is too short.' });
    }
    db.prepare('UPDATE households SET shared_goal = ?, updated_at = ? WHERE id = ?').run(goal, new Date().toISOString(), hid);
    res.json({ updated: true });
  });

  // =========================================================================
  // 8. Community, Challenges & Achievements
  // =========================================================================
  router.get('/communities/posts', (req, res) => {
    const city = String(req.query.city ?? '');
    const rows = city
      ? db
          .prepare('SELECT id, community_id, city, author_name, title, content, category, is_verified, created_at FROM community_posts WHERE is_removed = 0 AND LOWER(city) = LOWER(?) ORDER BY created_at DESC LIMIT 30')
          .all(city)
      : db
          .prepare('SELECT id, community_id, city, author_name, title, content, category, is_verified, created_at FROM community_posts WHERE is_removed = 0 ORDER BY created_at DESC LIMIT 30')
          .all();

    res.json({
      posts: rows.map((p) => ({
        id: String(p.id),
        communityId: String(p.community_id),
        city: String(p.city),
        authorName: String(p.author_name),
        title: String(p.title),
        content: String(p.content),
        category: String(p.category),
        isVerified: Number(p.is_verified) === 1,
        createdAt: String(p.created_at),
      })),
    });
  });

  router.post('/communities/posts', requireAuth, (req: AuthenticatedRequest, res) => {
    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid post' });
    }
    let comm = db.prepare('SELECT id FROM communities WHERE LOWER(city) = LOWER(?)').get(parsed.data.city) as { id: string } | undefined;
    if (!comm) {
      const cid = crypto.randomUUID();
      db.prepare('INSERT INTO communities (id, city, region, country, description) VALUES (?, ?, ?, ?, ?)').run(
        cid,
        parsed.data.city,
        '',
        '',
        `Local clean-air community for ${parsed.data.city}`,
      );
      comm = { id: cid };
    }
    const postId = crypto.randomUUID();
    const isVerified = req.authUser!.role === 'COMMUNITY_MODERATOR' || req.authUser!.role === 'SYSTEM_ADMIN' ? 1 : 0;
    db.prepare(`
      INSERT INTO community_posts (id, community_id, city, user_id, author_name, title, content, category, is_verified, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      postId,
      comm.id,
      parsed.data.city,
      req.authUser!.id,
      req.authUser!.fullName,
      parsed.data.title,
      parsed.data.content,
      parsed.data.category,
      isVerified,
      new Date().toISOString(),
    );
    res.status(201).json({ postId });
  });

  router.post('/communities/reports', requireAuth, (req: AuthenticatedRequest, res) => {
    const parsed = reportPostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid report' });
    }
    const post = db.prepare('SELECT id FROM community_posts WHERE id = ?').get(parsed.data.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }
    db.prepare(`
      INSERT INTO community_reports (id, post_id, reported_by_user_id, reason, status, created_at)
      VALUES (?, ?, ?, ?, 'PENDING', ?)
    `).run(crypto.randomUUID(), parsed.data.postId, req.authUser!.id, parsed.data.reason, new Date().toISOString());
    res.status(201).json({ reported: true });
  });

  router.get('/challenges', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db.prepare('SELECT * FROM challenges WHERE is_active = 1').all();
    const challenges = rows.map((c) => {
      const cid = String(c.id);
      const countRow = db
        .prepare('SELECT COUNT(*) AS cnt FROM challenge_participations WHERE challenge_id = ?')
        .get(cid) as { cnt: number };
      const mine = db
        .prepare('SELECT progress_value FROM challenge_participations WHERE challenge_id = ? AND user_id = ?')
        .get(cid, req.authUser!.id) as { progress_value: number } | undefined;

      return {
        id: cid,
        title: String(c.title),
        description: String(c.description),
        city: String(c.city),
        targetUnit: String(c.target_unit),
        targetValue: Number(c.target_value),
        safetyNote: String(c.safety_note),
        participantCount: Number(countRow.cnt),
        joined: Boolean(mine),
        userProgress: mine ? Number(mine.progress_value) : 0,
      };
    });
    res.json({ challenges });
  });

  router.post('/challenges/:id/join', requireAuth, (req: AuthenticatedRequest, res) => {
    const cid = String(req.params.id);
    const exists = db.prepare('SELECT id FROM challenges WHERE id = ?').get(cid);
    if (!exists) return res.status(404).json({ error: 'Challenge not found.' });
    db.prepare(`
      INSERT OR IGNORE INTO challenge_participations (id, challenge_id, user_id, progress_value, joined_at)
      VALUES (?, ?, ?, 0, ?)
    `).run(crypto.randomUUID(), cid, req.authUser!.id, new Date().toISOString());
    res.json({ joined: true });
  });

  router.post('/challenges/:id/progress', requireAuth, (req: AuthenticatedRequest, res) => {
    const cid = String(req.params.id);
    const delta = Number(req.body?.amount ?? 0);
    if (Number.isNaN(delta) || delta <= 0 || delta > 1000) {
      return res.status(400).json({ error: 'Progress increment must be a positive number.' });
    }
    const resUpd = db
      .prepare('UPDATE challenge_participations SET progress_value = progress_value + ? WHERE challenge_id = ? AND user_id = ?')
      .run(delta, cid, req.authUser!.id);
    if (Number(resUpd.changes) === 0) {
      return res.status(404).json({ error: 'Join the challenge before logging progress.' });
    }
    res.json({ updated: true });
  });

  router.get('/achievements', requireAuth, (req: AuthenticatedRequest, res) => {
    const all = db.prepare('SELECT * FROM achievements').all();
    const earnedRows = db
      .prepare('SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?')
      .all(req.authUser!.id);
    const earnedMap = new Map(earnedRows.map((r) => [String(r.achievement_id), String(r.unlocked_at)]));
    res.json({
      achievements: all.map((a) => ({
        id: String(a.id),
        code: String(a.code),
        title: String(a.title),
        description: String(a.description),
        unlockedAt: earnedMap.get(String(a.id)) ?? null,
      })),
    });
  });

  // =========================================================================
  // 9. Notifications & Educational Resources & Feedback
  // =========================================================================
  router.get('/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare('SELECT id, type, title, body, severity, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 40')
      .all(req.authUser!.id);
    res.json({
      notifications: rows.map((n) => ({
        id: String(n.id),
        type: String(n.type),
        title: String(n.title),
        body: String(n.body),
        severity: String(n.severity),
        isRead: Number(n.is_read) === 1,
        createdAt: String(n.created_at),
      })),
    });
  });

  router.patch('/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(String(req.params.id), req.authUser!.id);
    res.json({ updated: true });
  });

  router.delete('/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(req.authUser!.id);
    res.json({ cleared: true });
  });

  router.get('/notifications/preferences', requireAuth, (req: AuthenticatedRequest, res) => {
    const p = db.prepare('SELECT * FROM notification_preferences WHERE user_id = ?').get(req.authUser!.id);
    res.json({
      preferences: p
        ? {
            aqiThreshold: Number(p.aqi_threshold),
            quietHoursStart: String(p.quiet_hours_start),
            quietHoursEnd: String(p.quiet_hours_end),
            timezone: String(p.timezone),
            inAppEnabled: Number(p.in_app_enabled) === 1,
            emailEnabled: Number(p.email_enabled) === 1,
            browserEnabled: Number(p.browser_enabled) === 1,
            weeklyReportEnabled: Number(p.weekly_report_enabled) === 1,
            unsubscribedAll: Number(p.unsubscribed_all) === 1,
          }
        : null,
    });
  });

  router.put('/notifications/preferences', requireAuth, (req: AuthenticatedRequest, res) => {
    const parsed = notificationPrefSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid notification preferences' });
    }
    const d = parsed.data;
    db.prepare(`
      UPDATE notification_preferences SET
        aqi_threshold = ?, quiet_hours_start = ?, quiet_hours_end = ?, timezone = ?,
        in_app_enabled = ?, email_enabled = ?, browser_enabled = ?, weekly_report_enabled = ?,
        unsubscribed_all = ?, updated_at = ?
      WHERE user_id = ?
    `).run(
      d.aqiThreshold,
      d.quietHoursStart,
      d.quietHoursEnd,
      d.timezone,
      d.inAppEnabled ? 1 : 0,
      d.emailEnabled ? 1 : 0,
      d.browserEnabled ? 1 : 0,
      d.weeklyReportEnabled ? 1 : 0,
      d.unsubscribedAll ? 1 : 0,
      new Date().toISOString(),
      req.authUser!.id,
    );
    res.json({ preferences: d });
  });

  router.get('/resources', (req, res) => {
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const rows = q
      ? db
          .prepare('SELECT * FROM educational_resources WHERE LOWER(title) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(category) LIKE ? ORDER BY title ASC')
          .all(`%${q}%`, `%${q}%`, `%${q}%`)
      : db.prepare('SELECT * FROM educational_resources ORDER BY title ASC').all();

    res.json({
      resources: rows.map((r) => ({
        id: String(r.id),
        slug: String(r.slug),
        title: String(r.title),
        category: String(r.category),
        summary: String(r.summary),
        content: String(r.content),
        sourceOrganization: String(r.source_organization),
        sourceUrl: String(r.source_url),
        readingMinutes: Number(r.reading_minutes),
      })),
    });
  });

  router.post('/feedback', (req, res) => {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid feedback input' });
    }
    db.prepare(`
      INSERT INTO feedback (id, name, email, category, message, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'OPEN', ?)
    `).run(crypto.randomUUID(), parsed.data.name, parsed.data.email, parsed.data.category, parsed.data.message, new Date().toISOString());
    res.status(201).json({ submitted: true });
  });

  // =========================================================================
  // 10. Administration & Community Moderation (Server-Enforced RBAC)
  // =========================================================================
  router.get('/admin/overview', requireAuth, requireRoles('SYSTEM_ADMIN'), (_req, res) => {
    const usersCount = (db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number }).cnt;
    const activitiesCount = (db.prepare('SELECT COUNT(*) AS cnt FROM activity_logs').get() as { cnt: number }).cnt;
    const cacheCount = (db.prepare('SELECT COUNT(*) AS cnt FROM environmental_cache').get() as { cnt: number }).cnt;
    const apiStats = db
      .prepare('SELECT service_name, status, COUNT(*) AS cnt, ROUND(AVG(latency_ms)) AS avg_ms, COALESCE(SUM(tokens_estimated),0) AS tokens FROM api_metrics GROUP BY service_name, status')
      .all();

    res.json({
      stats: {
        usersCount,
        activitiesCount,
        cacheCount,
        apiConfigured: Boolean(envConfig.geminiApiKey),
        demoMode: envConfig.demoMode,
      },
      apiMetrics: apiStats,
    });
  });

  router.get('/admin/users', requireAuth, requireRoles('SYSTEM_ADMIN'), (_req, res) => {
    const rows = db
      .prepare('SELECT id, full_name, email, role, email_verified, is_demo, created_at FROM users ORDER BY created_at DESC LIMIT 100')
      .all();
    res.json({ users: rows });
  });

  router.patch('/admin/users/:id/role', requireAuth, requireRoles('SYSTEM_ADMIN'), (req: AuthenticatedRequest, res) => {
    const targetId = String(req.params.id);
    const role = String(req.body?.role ?? '');
    const allowed: UserRole[] = ['INDIVIDUAL_USER', 'FAMILY_ADMIN', 'FAMILY_MEMBER', 'COMMUNITY_MODERATOR', 'SYSTEM_ADMIN'];
    if (!allowed.includes(role as UserRole)) {
      return res.status(400).json({ error: 'Invalid role specified.' });
    }
    db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(role, new Date().toISOString(), targetId);
    writeAuditLog(db, req.authUser!.id, 'ROLE_UPDATED', 'user', targetId, `Role updated to ${role}`);
    res.json({ updated: true });
  });

  router.get(
    '/admin/moderation/reports',
    requireAuth,
    requireRoles('COMMUNITY_MODERATOR', 'SYSTEM_ADMIN'),
    (_req, res) => {
      const rows = db
        .prepare(`
          SELECT cr.id, cr.post_id, cr.reason, cr.status, cr.created_at,
                 cp.title AS post_title, cp.content AS post_content, cp.author_name, cp.city
          FROM community_reports cr
          JOIN community_posts cp ON cp.id = cr.post_id
          ORDER BY cr.created_at DESC
        `)
        .all();
      res.json({ reports: rows });
    },
  );

  router.post(
    '/admin/moderation/reports/:id/resolve',
    requireAuth,
    requireRoles('COMMUNITY_MODERATOR', 'SYSTEM_ADMIN'),
    (req: AuthenticatedRequest, res) => {
      const reportId = String(req.params.id);
      const removePost = req.body?.removePost === true;
      const report = db.prepare('SELECT post_id FROM community_reports WHERE id = ?').get(reportId) as { post_id: string } | undefined;
      if (!report) return res.status(404).json({ error: 'Report not found.' });

      db.prepare('UPDATE community_reports SET status = ?, reviewed_by_user_id = ? WHERE id = ?').run(
        removePost ? 'REVIEWED_REMOVED' : 'REVIEWED_KEPT',
        req.authUser!.id,
        reportId,
      );
      if (removePost) {
        db.prepare('UPDATE community_posts SET is_removed = 1 WHERE id = ?').run(report.post_id);
      }
      writeAuditLog(
        db,
        req.authUser!.id,
        removePost ? 'POST_REMOVED' : 'REPORT_DISMISSED',
        'community_post',
        report.post_id,
        `Moderation resolved report ${reportId}`,
      );
      res.json({ resolved: true });
    },
  );

  router.get('/admin/audit-logs', requireAuth, requireRoles('SYSTEM_ADMIN'), (_req, res) => {
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 80').all();
    res.json({ logs });
  });

  router.get('/admin/feedback', requireAuth, requireRoles('SYSTEM_ADMIN'), (_req, res) => {
    const items = db.prepare('SELECT * FROM feedback ORDER BY created_at DESC LIMIT 50').all();
    res.json({ feedback: items });
  });

  router.post('/admin/resources', requireAuth, requireRoles('SYSTEM_ADMIN'), (req: AuthenticatedRequest, res) => {
    const title = String(req.body?.title ?? '').trim();
    const category = String(req.body?.category ?? 'General').trim();
    const summary = String(req.body?.summary ?? '').trim();
    const content = String(req.body?.content ?? '').trim();
    const org = String(req.body?.sourceOrganization ?? 'WHO / EPA').trim();
    const url = String(req.body?.sourceUrl ?? 'https://www.who.int/').trim();
    if (title.length < 4 || content.length < 15) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }
    const id = crypto.randomUUID();
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${id.slice(0, 6)}`;
    db.prepare(`
      INSERT INTO educational_resources (id, slug, title, category, summary, content, source_organization, source_url, reading_minutes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 4, ?)
    `).run(id, slug, title, category, summary || content.slice(0, 140), content, org, url, new Date().toISOString());
    writeAuditLog(db, req.authUser!.id, 'RESOURCE_CREATED', 'educational_resource', id, `Added resource: ${title}`);
    res.status(201).json({ id });
  });

  // Fallback 404 for unknown API routes
  router.use((_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  return router;
}
