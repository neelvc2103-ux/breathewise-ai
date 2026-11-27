import express from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { envConfig } from '../config/env';
import { createRequireAuth } from '../services/auth/authService';
import { createAdminRouter } from './adminRoutes';
import { createAssistantRouter } from './assistantRoutes';
import { createAuthRouter } from './authRoutes';
import { createCommunityRouter } from './communityRoutes';
import { createEngagementRouter } from './engagementRoutes';
import { createEnvironmentRouter } from './environmentRoutes';
import { createImpactRouter } from './impactRoutes';

/**
 * Composes the versioned `/api/v1` REST API from modular domain routers.
 */
export function createApiRouter(db: DatabaseSync): express.Router {
  const router = express.Router();
  const requireAuth = createRequireAuth(db);

  // 1. Health & OpenAPI Documentation
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
        description:
          'Versioned REST API for air quality intelligence, GenAI guidance, adaptive routines, household impact, and RBAC administration.',
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

  // 2. Domain Routers
  router.use(createAuthRouter(db, requireAuth));
  router.use(createEnvironmentRouter(db));
  router.use(createAssistantRouter(db, requireAuth));
  router.use(createImpactRouter(db, requireAuth));
  router.use(createCommunityRouter(db, requireAuth));
  router.use(createEngagementRouter(db, requireAuth));
  router.use(createAdminRouter(db, requireAuth));

  // Fallback 404 for unknown API routes
  router.use((_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  return router;
}
