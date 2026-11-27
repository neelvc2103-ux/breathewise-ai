import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envConfig } from '../../src/server/config/env';
import { getDatabase } from '../../src/server/db/database';
import { seedDatabase } from '../../src/server/db/seed';
import {
  getEnvironmentalSnapshot,
  resetEnvironmentalRuntimeState,
} from '../../src/server/services/air-quality/environmentalService';

const AQ_OK = {
  current: {
    time: '2026-11-27T10:00',
    pm2_5: 142,
    pm10: 215,
    nitrogen_dioxide: 54,
    sulphur_dioxide: 14,
    carbon_monoxide: 950,
    ozone: 38,
    us_aqi: 196,
  },
  hourly: {
    time: ['2026-11-27T10:00:00Z', '2026-11-27T12:00:00Z'],
    pm2_5: [142, 128],
    pm10: [215, 190],
    us_aqi: [196, 188],
  },
};

const WX_OK = {
  current: { temperature_2m: 16.5, relative_humidity_2m: 72, wind_speed_10m: 4.2, weather_code: 45 },
  hourly: { time: ['2026-11-27T10:00:00Z', '2026-11-27T12:00:00Z'], temperature_2m: [16.5, 18.0], wind_speed_10m: [4.2, 5.1] },
};

describe('Environmental Service HTTP 429 Resilience, Dedup & Fallback', () => {
  beforeEach(() => {
    resetEnvironmentalRuntimeState();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetEnvironmentalRuntimeState();
  });

  it('deduplicates concurrent requests and reuses cache across India NAQI and US EPA switches', async () => {
    const db = getDatabase(':memory:');
    seedDatabase(db);

    const fetchMock = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => (String(url).includes('air-quality') ? AQ_OK : WX_OK),
    }));
    vi.stubGlobal('fetch', fetchMock);

    // Fire INDIA_NAQI and US_EPA concurrently for Bhuj
    const [inSnap, usSnap] = await Promise.all([
      getEnvironmentalSnapshot(db, { city: 'Bhuj', latitude: 23.24, longitude: 69.67, standard: 'INDIA_NAQI', demoScenario: 'live' }),
      getEnvironmentalSnapshot(db, { city: 'Bhuj', latitude: 23.24, longitude: 69.67, standard: 'US_EPA', demoScenario: 'live' }),
    ]);

    // Only 1 AQ + 1 Weather upstream call made despite 2 concurrent requests
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(inSnap.standard).toBe('INDIA_NAQI');
    expect(usSnap.standard).toBe('US_EPA');
    expect(inSnap.pollutants.pm25).toBe(142);

    // Subsequent standard switch hits SQLite cache with zero upstream calls
    const cachedSnap = await getEnvironmentalSnapshot(db, {
      city: 'Bhuj',
      latitude: 23.24,
      longitude: 69.67,
      standard: 'US_EPA',
      demoScenario: 'live',
    });
    expect(cachedSnap.isCached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns live air quality even when optional Weather API returns HTTP 429', async () => {
    const db = getDatabase(':memory:');
    seedDatabase(db);

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('air-quality')) {
        return { ok: true, status: 200, headers: new Headers(), json: async () => AQ_OK };
      }
      return {
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '45' }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const snap = await getEnvironmentalSnapshot(db, {
      city: 'New Delhi',
      latitude: 28.6139,
      longitude: 77.209,
      standard: 'INDIA_NAQI',
      demoScenario: 'live',
    });

    expect(snap.pollutants.pm25).toBe(142);
    expect(snap.weather.temperatureC).toBeNull();
    expect(snap.weather.conditionText).toContain('unavailable');
    expect(snap.dataSource).toBe('Open-Meteo Air Quality API (Copernicus CAMS)');
  });

  it('honors HTTP 429 Retry-After cooldown without immediate retries and recovers after cooldown', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-27T12:00:00Z'));

    const db = getDatabase(':memory:');
    seedDatabase(db);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '30' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getEnvironmentalSnapshot(db, { city: 'Bhuj', latitude: 23.24, longitude: 69.67, standard: 'INDIA_NAQI', demoScenario: 'live' }),
    ).rejects.toThrow('Unable to retrieve live air quality data');

    // Only 1 AQ + 1 WX call (never retried 429 immediately)
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Second call during 30s cooldown does NOT hit fetch at all
    await expect(
      getEnvironmentalSnapshot(db, { city: 'Bhuj', latitude: 23.24, longitude: 69.67, standard: 'INDIA_NAQI', demoScenario: 'live' }),
    ).rejects.toThrow('Unable to retrieve live air quality data');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Advance past 30s cooldown and restore healthy upstream
    vi.advanceTimersByTime(31_000);
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => (String(url).includes('air-quality') ? AQ_OK : WX_OK),
    }));

    const recovered = await getEnvironmentalSnapshot(db, {
      city: 'Bhuj',
      latitude: 23.24,
      longitude: 69.67,
      standard: 'INDIA_NAQI',
      demoScenario: 'live',
    });
    expect(recovered.pollutants.pm25).toBe(142);
  });

  it('falls back to OpenWeatherMap Air Pollution API on Open-Meteo 429 when OPENWEATHER_API_KEY is configured', async () => {
    const prevKey = envConfig.openWeatherApiKey;
    envConfig.openWeatherApiKey = 'test-owm-key';
    try {
      const db = getDatabase(':memory:');
      seedDatabase(db);

      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (String(url).includes('openweathermap.org')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({
              list: [
                {
                  dt: 1764244800,
                  components: { pm2_5: 88, pm10: 150, no2: 40, so2: 12, co: 620, o3: 35 },
                },
              ],
            }),
          };
        }
        return { ok: false, status: 429, headers: new Headers({ 'retry-after': '60' }) };
      });
      vi.stubGlobal('fetch', fetchMock);

      const snap = await getEnvironmentalSnapshot(db, {
        city: 'Bhuj',
        latitude: 23.24,
        longitude: 69.67,
        standard: 'INDIA_NAQI',
        demoScenario: 'live',
      });

      expect(snap.pollutants.pm25).toBe(88);
      expect(snap.dataSource).toContain('OpenWeatherMap Air Pollution API');
      expect(snap.isStale).toBe(false);
    } finally {
      envConfig.openWeatherApiKey = prevKey;
    }
  });

  it('respects valid Retry-After durations longer than 300 seconds without premature retry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-27T14:00:00Z'));

    const db = getDatabase(':memory:');
    seedDatabase(db);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '600' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getEnvironmentalSnapshot(db, { city: 'Bhuj', latitude: 23.24, longitude: 69.67, standard: 'INDIA_NAQI', demoScenario: 'live' }),
    ).rejects.toThrow('Unable to retrieve live air quality data');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // At +301s, 600s Retry-After is still active -> must NOT hit upstream prematurely
    vi.advanceTimersByTime(301_000);
    await expect(
      getEnvironmentalSnapshot(db, { city: 'Bhuj', latitude: 23.24, longitude: 69.67, standard: 'INDIA_NAQI', demoScenario: 'live' }),
    ).rejects.toThrow('Unable to retrieve live air quality data');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // At +601s, cooldown expires and healthy upstream succeeds
    vi.advanceTimersByTime(300_000);
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => (String(url).includes('air-quality') ? AQ_OK : WX_OK),
    }));

    const recovered = await getEnvironmentalSnapshot(db, {
      city: 'Bhuj',
      latitude: 23.24,
      longitude: 69.67,
      standard: 'INDIA_NAQI',
      demoScenario: 'live',
    });
    expect(recovered.pollutants.pm25).toBe(142);
  });
});
