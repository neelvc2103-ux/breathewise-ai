import crypto from 'node:crypto';
import express from 'express';
import type { DatabaseSync } from 'node:sqlite';
import type { UserRole } from '../../types/domain';
import { adminResourceSchema } from '../../validators/schemas';
import { envConfig } from '../config/env';
import { requireRoles, writeAuditLog, type AuthenticatedRequest } from '../services/auth/authService';

const ALLOWED_ROLES: UserRole[] = [
  'INDIVIDUAL_USER',
  'FAMILY_ADMIN',
  'FAMILY_MEMBER',
  'COMMUNITY_MODERATOR',
  'SYSTEM_ADMIN',
];

export function createAdminRouter(
  db: DatabaseSync,
  requireAuth: express.RequestHandler,
): express.Router {
  const router = express.Router();

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
    if (!ALLOWED_ROLES.includes(role as UserRole)) {
      return res.status(400).json({ error: 'Invalid role specified.' });
    }
    const result = db
      .prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?')
      .run(role, new Date().toISOString(), targetId);
    if (Number(result.changes) === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
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
      const report = db.prepare('SELECT post_id FROM community_reports WHERE id = ?').get(reportId) as
        | { post_id: string }
        | undefined;
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
    const parsed = adminResourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Title and content are required.' });
    }
    const { title, category, summary, content, sourceOrganization, sourceUrl } = parsed.data;
    const id = crypto.randomUUID();
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${id.slice(0, 6)}`;
    db.prepare(`
      INSERT INTO educational_resources (id, slug, title, category, summary, content, source_organization, source_url, reading_minutes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 4, ?)
    `).run(id, slug, title, category, summary || content.slice(0, 140), content, sourceOrganization, sourceUrl, new Date().toISOString());
    writeAuditLog(db, req.authUser!.id, 'RESOURCE_CREATED', 'educational_resource', id, `Added resource: ${title}`);
    res.status(201).json({ id });
  });

  return router;
}
