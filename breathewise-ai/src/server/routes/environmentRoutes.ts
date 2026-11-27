import express from 'express';
import type { DatabaseSync } from 'node:sqlite';
import type { AqiStandard, DemoScenario } from '../../types/domain';
import { getEnvironmentalSnapshot, searchLocations } from '../services/air-quality/environmentalService';
import { getUserFromBearerToken, type AuthenticatedRequest } from '../services/auth/authService';
import { evaluateAndCreateAlert } from '../services/notifications/notificationService';
import { asyncHandler, isValidCoordinates } from './helpers';

export function createEnvironmentRouter(db: DatabaseSync): express.Router {
  const router = express.Router();

  router.get('/locations/search', asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '');
    const results = await searchLocations(db, q);
    res.json({ locations: results });
  }));

  router.get('/air-quality', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const city = String(req.query.city ?? 'New Delhi');
    const region = String(req.query.region ?? '');
    const country = String(req.query.country ?? '');
    const latitude = Number(req.query.lat ?? 28.6139);
    const longitude = Number(req.query.lon ?? 77.209);
    const standard: AqiStandard = req.query.standard === 'US_EPA' ? 'US_EPA' : 'INDIA_NAQI';
    const demoScenario = String(req.query.demoScenario ?? 'live') as DemoScenario;

    if (!isValidCoordinates(latitude, longitude)) {
      return res.status(400).json({ error: 'Invalid geographic coordinates.' });
    }

    try {
      // Optionally recognize authenticated user for alert evaluation
      const resolved = req.headers.authorization
        ? getUserFromBearerToken(db, req.headers.authorization)
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
  }));

  return router;
}
