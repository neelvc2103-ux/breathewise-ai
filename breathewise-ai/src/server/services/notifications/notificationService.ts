import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { EnvironmentalSnapshot } from '../../../types/domain';

export function isWithinQuietHours(
  nowDate: Date,
  quietStart: string,
  quietEnd: string,
  timezone: string,
): boolean {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const hhmm = formatter.format(nowDate);
    if (quietStart <= quietEnd) {
      return hhmm >= quietStart && hhmm <= quietEnd;
    }
    // Overnight window e.g. 22:00 to 06:30
    return hhmm >= quietStart || hhmm <= quietEnd;
  } catch {
    return false;
  }
}

export function evaluateAndCreateAlert(
  db: DatabaseSync,
  userId: string,
  snapshot: EnvironmentalSnapshot,
): void {
  const pref = db
    .prepare('SELECT * FROM notification_preferences WHERE user_id = ?')
    .get(userId) as
    | {
        aqi_threshold: number;
        quiet_hours_start: string;
        quiet_hours_end: string;
        timezone: string;
        in_app_enabled: number;
        unsubscribed_all: number;
      }
    | undefined;

  if (!pref || pref.unsubscribed_all === 1 || pref.in_app_enabled === 0) {
    return;
  }

  if (snapshot.aqi.aqi < pref.aqi_threshold) {
    return;
  }

  if (isWithinQuietHours(new Date(), pref.quiet_hours_start, pref.quiet_hours_end, pref.timezone)) {
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const dedupKey = `aqi_alert:${snapshot.location.city}:${today}:${snapshot.aqi.level}`;
  const exists = db
    .prepare('SELECT id FROM notifications WHERE user_id = ? AND dedup_key = ?')
    .get(userId, dedupKey);
  if (exists) return;

  const severity = snapshot.aqi.aqi >= 300 ? 'critical' : 'warning';
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, body, severity, dedup_key, is_read, created_at)
    VALUES (?, ?, 'AQI_THRESHOLD_ALERT', ?, ?, ?, ?, 0, ?)
  `).run(
    crypto.randomUUID(),
    userId,
    `${snapshot.location.city} AQI reached ${snapshot.aqi.aqi} (${snapshot.aqi.category})`,
    `${snapshot.aqi.outdoorGuidance} (${snapshot.standard} threshold ${pref.aqi_threshold} exceeded).`,
    severity,
    dedupKey,
    new Date().toISOString(),
  );
}
