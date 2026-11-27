import crypto from 'node:crypto';
import express from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { feedbackSchema, notificationPrefSchema } from '../../validators/schemas';
import type { AuthenticatedRequest } from '../services/auth/authService';

export function createEngagementRouter(
  db: DatabaseSync,
  requireAuth: express.RequestHandler,
): express.Router {
  const router = express.Router();

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

  return router;
}
