import express from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { assistantMessageSchema, placesGroundingSchema } from '../../validators/schemas';
import { generateAssistantReply, queryPlacesWithMapsGrounding } from '../services/ai/aiService';
import { getEnvironmentalSnapshot } from '../services/air-quality/environmentalService';
import { getPersonalizedAlternatives } from '../services/alternatives/alternativesService';
import type { AuthenticatedRequest } from '../services/auth/authService';
import { getIndoorGuidance } from '../services/indoor/indoorService';
import { generateAndSaveRoutine, getLatestRoutine } from '../services/routines/routineService';
import { logger } from '../utils/logger';
import { asyncHandler, getUserProfile, parseJsonArraySafely, resolveEnvironmentalParams } from './helpers';

export function createAssistantRouter(
  db: DatabaseSync,
  requireAuth: express.RequestHandler,
): express.Router {
  const router = express.Router();

  router.post('/assistant/chat', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = assistantMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid chat message' });
    }
    const profile = getUserProfile(db, req.authUser!.id);

    if (profile?.consentWithdrawn) {
      return res.status(403).json({
        error: 'Personalization consent is currently withdrawn in your Settings. Re-enable personalization or use the public Air Quality Explorer.',
      });
    }

    const env = resolveEnvironmentalParams(parsed.data, profile);

    try {
      const snapshot = await getEnvironmentalSnapshot(db, {
        city: env.city,
        latitude: env.latitude,
        longitude: env.longitude,
        standard: env.standard,
        demoScenario: env.demoScenario === 'ai_failure' ? 'live' : env.demoScenario,
        userId: req.authUser!.id,
      });

      const reply = await generateAssistantReply(db, {
        userId: req.authUser!.id,
        message: parsed.data.message,
        conversationId: parsed.data.conversationId,
        snapshot,
        profile: profile ?? {},
        forceAiFailure: env.demoScenario === 'ai_failure',
      });

      res.json(reply);
    } catch (err) {
      logger.error('assistant_chat_error', { message: (err as Error).message });
      res.status(503).json({ error: 'Unable to retrieve environmental context for assistant.' });
    }
  }));

  router.post('/assistant/places-grounding', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = placesGroundingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid place search request' });
    }
    const profile = getUserProfile(db, req.authUser!.id);

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
  }));

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
        recommendations: parseJsonArraySafely(m.structured_json),
        providerUsed: m.provider_used ? String(m.provider_used) : null,
        createdAt: String(m.created_at),
      })),
    });
  });

  router.get('/routines/latest', requireAuth, (req: AuthenticatedRequest, res) => {
    const routine = getLatestRoutine(db, req.authUser!.id);
    res.json({ routine });
  });

  router.post('/routines/generate', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
    const profile = getUserProfile(db, req.authUser!.id);
    const env = resolveEnvironmentalParams((req.body ?? {}) as Record<string, unknown>, profile);
    if (!env.validCoords) {
      return res.status(400).json({ error: 'Invalid geographic coordinates.' });
    }

    try {
      const snapshot = await getEnvironmentalSnapshot(db, {
        city: env.city,
        latitude: env.latitude,
        longitude: env.longitude,
        standard: env.standard,
        demoScenario: env.demoScenario === 'ai_failure' ? 'live' : env.demoScenario,
        userId: req.authUser!.id,
      });
      const routine = generateAndSaveRoutine(db, req.authUser!.id, snapshot, profile ?? {});
      res.status(201).json({ routine });
    } catch (err) {
      res.status(503).json({ error: (err as Error).message });
    }
  }));

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

  router.get('/indoor/guidance', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
    const profile = getUserProfile(db, req.authUser!.id);
    const env = resolveEnvironmentalParams(req.query as Record<string, unknown>, profile);
    if (!env.validCoords) {
      return res.status(400).json({ error: 'Invalid geographic coordinates.' });
    }

    try {
      const snapshot = await getEnvironmentalSnapshot(db, {
        city: env.city,
        latitude: env.latitude,
        longitude: env.longitude,
        standard: env.standard,
        demoScenario: env.demoScenario,
        userId: req.authUser!.id,
      });
      res.json({ guidance: getIndoorGuidance(snapshot, profile ?? {}) });
    } catch (err) {
      res.status(503).json({ error: (err as Error).message });
    }
  }));

  router.get('/alternatives', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
    const profile = getUserProfile(db, req.authUser!.id);
    const env = resolveEnvironmentalParams(req.query as Record<string, unknown>, profile);
    if (!env.validCoords) {
      return res.status(400).json({ error: 'Invalid geographic coordinates.' });
    }

    try {
      const snapshot = await getEnvironmentalSnapshot(db, {
        city: env.city,
        latitude: env.latitude,
        longitude: env.longitude,
        standard: env.standard,
        demoScenario: env.demoScenario,
        userId: req.authUser!.id,
      });
      res.json({ alternatives: getPersonalizedAlternatives(snapshot, profile ?? {}) });
    } catch (err) {
      res.status(503).json({ error: (err as Error).message });
    }
  }));

  return router;
}
