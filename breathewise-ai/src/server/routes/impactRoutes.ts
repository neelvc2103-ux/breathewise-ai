import express from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { logActivitySchema } from '../../validators/schemas';
import type { AuthenticatedRequest } from '../services/auth/authService';
import {
  getImpactSummary,
  listEmissionFactors,
  logUserActivity,
} from '../services/emissions/impactCalculator';

export function createImpactRouter(
  db: DatabaseSync,
  requireAuth: express.RequestHandler,
): express.Router {
  const router = express.Router();

  router.get('/impact/factors', (_req, res) => {
    res.json({ factors: listEmissionFactors(db) });
  });

  router.get('/impact/summary', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ summary: getImpactSummary(db, req.authUser!.id) });
  });

  router.get('/impact/activities', requireAuth, (req: AuthenticatedRequest, res) => {
    const rawLimit = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 50;
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

  return router;
}
