import crypto from 'node:crypto';
import express from 'express';
import type { DatabaseSync } from 'node:sqlite';
import {
  challengeProgressSchema,
  createHouseholdSchema,
  createPostSchema,
  householdGoalSchema,
  inviteMemberSchema,
  reportPostSchema,
} from '../../validators/schemas';
import { envConfig } from '../config/env';
import { hashToken } from '../db/seed';
import type { AuthenticatedRequest } from '../services/auth/authService';

const INVITATION_TTL_MS = 7 * 86400 * 1000;

export function createCommunityRouter(
  db: DatabaseSync,
  requireAuth: express.RequestHandler,
): express.Router {
  const router = express.Router();

  // =========================================================================
  // Households & Invitations
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
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();
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
    const parsed = householdGoalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Goal description is too short.' });
    }
    db.prepare('UPDATE households SET shared_goal = ?, updated_at = ? WHERE id = ?').run(
      parsed.data.sharedGoal,
      new Date().toISOString(),
      hid,
    );
    res.json({ updated: true });
  });

  // =========================================================================
  // Community Posts, Challenges & Achievements
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
    const parsed = challengeProgressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Progress increment must be a positive number.' });
    }
    const resUpd = db
      .prepare('UPDATE challenge_participations SET progress_value = progress_value + ? WHERE challenge_id = ? AND user_id = ?')
      .run(parsed.data.amount, cid, req.authUser!.id);
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

  return router;
}
