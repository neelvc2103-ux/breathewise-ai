import { describe, expect, it } from 'vitest';
import { getDatabase } from '../../src/server/db/database';
import { seedDatabase } from '../../src/server/db/seed';
import { registerUser } from '../../src/server/services/auth/authService';
import { getAqiSeverityMeta } from '../../src/server/services/air-quality/aqiStandards';
import { evaluateAndCreateAlert, isWithinQuietHours } from '../../src/server/services/notifications/notificationService';
import type { EnvironmentalSnapshot } from '../../src/types/domain';

describe('Notifications & Quiet Hours', () => {
  it('correctly evaluates overnight quiet hours', () => {
    const lateNightUtc = new Date('2026-11-26T23:30:00Z');
    expect(isWithinQuietHours(lateNightUtc, '22:00', '06:30', 'UTC')).toBe(true);
    const middayUtc = new Date('2026-11-26T12:00:00Z');
    expect(isWithinQuietHours(middayUtc, '22:00', '06:30', 'UTC')).toBe(false);
  });

  it('creates deduplicated AQI alerts when threshold is exceeded outside quiet hours', () => {
    const db = getDatabase(':memory:');
    seedDatabase(db);
    const { user } = registerUser(db, {
      fullName: 'Alert User',
      email: 'alert@test.local',
      password: 'Password123',
    });

    db.prepare(
      "UPDATE notification_preferences SET aqi_threshold = 150, quiet_hours_start = '03:00', quiet_hours_end = '03:05', timezone = 'UTC' WHERE user_id = ?",
    ).run(user.id);

    const snapshot: EnvironmentalSnapshot = {
      location: { name: 'New Delhi', city: 'New Delhi', region: 'Delhi', country: 'India', latitude: 28.6, longitude: 77.2 },
      standard: 'INDIA_NAQI',
      aqi: getAqiSeverityMeta(320, 'INDIA_NAQI'),
      pollutants: { pm25: 160, pm10: 280, no2: 55, so2: 12, co: 1200, o3: 30 },
      weather: { temperatureC: 14, humidityPct: 70, windSpeedKmh: 4, conditionText: 'Haze', isInversionLikely: true },
      hourlyForecast: [],
      dataSource: 'Test',
      observedAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      isCached: false,
      isStale: false,
      isDemo: true,
    };

    evaluateAndCreateAlert(db, user.id, snapshot);
    evaluateAndCreateAlert(db, user.id, snapshot); // Duplicate call should not insert second alert

    const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ?').all(user.id);
    expect(rows.length).toBe(1);
  });
});
