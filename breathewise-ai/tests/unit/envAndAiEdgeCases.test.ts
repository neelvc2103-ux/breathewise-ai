import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDatabase } from '../../src/server/db/database';
import { seedDatabase } from '../../src/server/db/seed';
import {
  generateAssistantReply,
  queryPlacesWithMapsGrounding,
} from '../../src/server/services/ai/aiService';
import { getAqiSeverityMeta } from '../../src/server/services/air-quality/aqiStandards';
import {
  getEnvironmentalSnapshot,
  searchLocations,
} from '../../src/server/services/air-quality/environmentalService';
import { generateAndSaveRoutine } from '../../src/server/services/routines/routineService';
import { logger } from '../../src/server/utils/logger';
import type { EnvironmentalSnapshot } from '../../src/types/domain';

function makeSnapshot(aqiVal: number): EnvironmentalSnapshot {
  return {
    location: { name: 'New Delhi', city: 'New Delhi', region: 'Delhi NCR', country: 'India', latitude: 28.6139, longitude: 77.209 },
    standard: 'INDIA_NAQI',
    aqi: getAqiSeverityMeta(aqiVal, 'INDIA_NAQI'),
    pollutants: { pm25: 18, pm10: 36, no2: 20, so2: 6, co: 320, o3: 42 },
    weather: { temperatureC: 22, humidityPct: 48, windSpeedKmh: 16, conditionText: 'Clear', isInversionLikely: false },
    hourlyForecast: [
      { timeIso: '2026-11-27T08:00:00Z', hourLabel: '08:00', pm25: 20, pm10: 40, usAqi: 68, indiaAqi: 42, temperatureC: 19, windSpeedKmh: 12 },
      { timeIso: '2026-11-27T14:00:00Z', hourLabel: '14:00', pm25: 14, pm10: 30, usAqi: 55, indiaAqi: 34, temperatureC: 24, windSpeedKmh: 18 },
    ],
    dataSource: 'Test Fixture',
    observedAt: '2026-11-27T08:00:00Z',
    fetchedAt: '2026-11-27T08:00:00Z',
    isCached: false,
    isStale: false,
    isDemo: true,
  };
}

describe('Environmental Service, AI Grounding, Routines & Logger Edge Cases', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('searches locations via mocked Open-Meteo and falls back to local DB on failure', async () => {
    const db = getDatabase(':memory:');
    seedDatabase(db);

    // Short query (< 2 chars) returns seeded locations directly
    const shortRes = await searchLocations(db, 'a');
    expect(shortRes.length).toBeGreaterThan(0);

    // Mocked Open-Meteo geocoding success
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ name: 'Pune', admin1: 'Maharashtra', country: 'India', latitude: 18.52, longitude: 73.85 }],
        }),
      }),
    );
    const liveRes = await searchLocations(db, 'Pune');
    expect(liveRes[0].city).toBe('Pune');
    expect(liveRes[0].defaultStandard).toBe('INDIA_NAQI');

    // Mocked network failure falls back to local DB
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));
    const fallbackRes = await searchLocations(db, 'Delhi');
    expect(fallbackRes.some((r) => r.city.toLowerCase().includes('delhi'))).toBe(true);
  });

  it('fetches live AQI/weather, caches it, and falls back to stale cache on upstream outage', async () => {
    const db = getDatabase(':memory:');
    seedDatabase(db);

    const aqiPayload = {
      current: { pm2_5: 45, pm10: 85, nitrogen_dioxide: 30, sulphur_dioxide: 10, carbon_monoxide: 500, ozone: 40, time: '2026-11-27T08:00' },
      hourly: {
        time: ['2026-11-27T08:00:00Z', '2026-11-27T10:00:00Z'],
        pm2_5: [45, 38],
        pm10: [85, 70],
        us_aqi: [124, 107],
      },
    };
    const weatherPayload = {
      current: { temperature_2m: 20, relative_humidity_2m: 55, wind_speed_10m: 12, weather_code: 0 },
      hourly: { time: ['2026-11-27T08:00:00Z', '2026-11-27T10:00:00Z'], temperature_2m: [20, 22], wind_speed_10m: [12, 14] },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => ({
        ok: true,
        json: async () => (String(url).includes('air-quality') ? aqiPayload : weatherPayload),
      })),
    );

    const fresh = await getEnvironmentalSnapshot(db, {
      city: 'Pune',
      latitude: 18.52,
      longitude: 73.85,
      standard: 'INDIA_NAQI',
      demoScenario: 'live',
    });
    expect(fresh.isCached).toBe(false);
    expect(fresh.pollutants.pm25).toBe(45);

    // Second call hits fresh cache
    const cached = await getEnvironmentalSnapshot(db, {
      city: 'Pune',
      latitude: 18.52,
      longitude: 73.85,
      standard: 'INDIA_NAQI',
      demoScenario: 'live',
    });
    expect(cached.isCached).toBe(true);
    expect(cached.isStale).toBe(false);

    // Expire cache and simulate upstream failure -> stale cache fallback
    db.prepare("UPDATE environmental_cache SET expires_at = '2020-01-01T00:00:00.000Z'").run();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Timeout')));

    const stale = await getEnvironmentalSnapshot(db, {
      city: 'Pune',
      latitude: 18.52,
      longitude: 73.85,
      standard: 'INDIA_NAQI',
      demoScenario: 'live',
    });
    expect(stale.isCached).toBe(true);
    expect(stale.isStale).toBe(true);

    // No cache + upstream failure throws user-safe error
    await expect(
      getEnvironmentalSnapshot(db, {
        city: 'Jaipur',
        latitude: 26.91,
        longitude: 75.78,
        standard: 'US_EPA',
        demoScenario: 'live',
      }),
    ).rejects.toThrow('Unable to retrieve live air quality data');
  });

  it('exercises Places Grounding fallback, clean-air routine generation, and logger methods', async () => {
    const db = getDatabase(':memory:');
    seedDatabase(db);
    const demoUser = db.prepare("SELECT id FROM users WHERE email = 'demo.family@breathewise.local'").get() as { id: string };
    const cleanSnap = makeSnapshot(40);

    const places = await queryPlacesWithMapsGrounding(db, {
      userId: demoUser.id,
      query: 'nearest metro station',
      latitude: 28.6139,
      longitude: 77.209,
      snapshot: cleanSnap,
      profile: { city: 'New Delhi' },
      forceAiFailure: true,
    });
    expect(places.providerUsed).toBe('unavailable');
    expect(places.answerMarkdown).toContain('New Delhi');

    const routine = generateAndSaveRoutine(db, demoUser.id, cleanSnap, { commuteDistanceKm: 8 });
    expect(routine.activities.length).toBeGreaterThan(0);

    const reply = await generateAssistantReply(db, {
      userId: demoUser.id,
      message: 'Should I open windows?',
      snapshot: cleanSnap,
      profile: {},
      forceAiFailure: true,
    });
    expect(reply.providerUsed).toBe('deterministic_fallback');

    const infoSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.info('test_info', { password: 'secret' });
    logger.warn('test_warn', { token: 'abc' });
    logger.error('test_error');
    expect(infoSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errSpy).toHaveBeenCalledOnce();
  });
});
