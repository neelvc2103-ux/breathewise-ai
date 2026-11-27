import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type {
  AqiStandard,
  DemoScenario,
  EnvironmentalSnapshot,
  HourlyForecastPoint,
} from '../../../types/domain';
import { envConfig } from '../../config/env';
import { logger } from '../../utils/logger';
import { computeAqiFromPollutants, getAqiSeverityMeta } from './aqiStandards';

const CACHE_TTL_MS = 15 * 60 * 1000;

interface GeocodeResult {
  name: string;
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  defaultStandard: AqiStandard;
}

async function fetchWithRetry(url: string, attempts = 2): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) return response;
      lastError = new Error(`Upstream status ${response.status}`);
    } catch (err) {
      lastError = err;
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw lastError;
}

/**
 * Searches cities via Open-Meteo Geocoding API with local fallback to seeded reference cities.
 */
export async function searchLocations(db: DatabaseSync, query: string): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    const rows = db.prepare('SELECT name, city, region, country, latitude, longitude, default_standard FROM locations LIMIT 8').all();
    return rows.map((r) => ({
      name: String(r.name),
      city: String(r.city),
      region: String(r.region),
      country: String(r.country),
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      defaultStandard: (String(r.default_standard) === 'INDIA_NAQI' ? 'INDIA_NAQI' : 'US_EPA'),
    }));
  }

  try {
    const url = `${envConfig.geocodingApiBase}/search?name=${encodeURIComponent(trimmed)}&count=6&language=en&format=json`;
    const res = await fetchWithRetry(url, 2);
    const json = (await res.json()) as {
      results?: Array<{
        name: string;
        admin1?: string;
        country?: string;
        latitude: number;
        longitude: number;
      }>;
    };
    if (json.results && json.results.length > 0) {
      return json.results.map((item) => {
        const country = item.country ?? 'Unknown';
        return {
          name: item.name,
          city: item.name,
          region: item.admin1 ?? '',
          country,
          latitude: item.latitude,
          longitude: item.longitude,
          defaultStandard: country.toLowerCase().includes('india') ? 'INDIA_NAQI' : 'US_EPA',
        };
      });
    }
  } catch (err) {
    logger.warn('geocoding_api_fallback', { query: trimmed, message: (err as Error).message });
  }

  const likeTerm = `%${trimmed.toLowerCase()}%`;
  const local = db
    .prepare(
      'SELECT name, city, region, country, latitude, longitude, default_standard FROM locations WHERE LOWER(city) LIKE ? OR LOWER(country) LIKE ? LIMIT 6',
    )
    .all(likeTerm, likeTerm);

  return local.map((r) => ({
    name: String(r.name),
    city: String(r.city),
    region: String(r.region),
    country: String(r.country),
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    defaultStandard: (String(r.default_standard) === 'INDIA_NAQI' ? 'INDIA_NAQI' : 'US_EPA'),
  }));
}

function buildDemoScenarioSnapshot(
  city: string,
  region: string,
  country: string,
  latitude: number,
  longitude: number,
  standard: AqiStandard,
  scenario: DemoScenario,
): EnvironmentalSnapshot {
  const nowIso = new Date().toISOString();
  const baseScenarios: Record<
    Exclude<DemoScenario, 'live' | 'api_failure' | 'ai_failure'>,
    { pm25: number; pm10: number; no2: number; so2: number; co: number; o3: number; temp: number; hum: number; wind: number; cond: string; inv: boolean }
  > = {
    severe_smog: {
      pm25: 238,
      pm10: 362,
      no2: 92,
      so2: 24,
      co: 2150,
      o3: 32,
      temp: 11.4,
      hum: 84,
      wind: 2.6,
      cond: 'Dense Winter Haze / Temperature Inversion',
      inv: true,
    },
    moderate_pollution: {
      pm25: 54,
      pm10: 118,
      no2: 44,
      so2: 14,
      co: 780,
      o3: 62,
      temp: 19.2,
      hum: 56,
      wind: 9.4,
      cond: 'Light Morning Mist',
      inv: false,
    },
    improved_air: {
      pm25: 16,
      pm10: 34,
      no2: 18,
      so2: 6,
      co: 320,
      o3: 48,
      temp: 21.0,
      hum: 45,
      wind: 18.5,
      cond: 'Clear Breezy Sky',
      inv: false,
    },
  };

  const preset =
    scenario === 'severe_smog' || scenario === 'moderate_pollution' || scenario === 'improved_air'
      ? baseScenarios[scenario]
      : baseScenarios.moderate_pollution;

  const hourlyForecast: HourlyForecastPoint[] = Array.from({ length: 12 }, (_, idx) => {
    const dt = new Date(Date.now() + idx * 2 * 3600 * 1000);
    // Simulate realistic diurnal dip midday when solar heating breaks inversion
    const hour = dt.getHours();
    const diurnalFactor = hour >= 12 && hour <= 16 ? 0.72 : hour >= 20 || hour <= 8 ? 1.15 : 0.95;
    const pm25 = Math.round(preset.pm25 * diurnalFactor * 10) / 10;
    const pm10 = Math.round(preset.pm10 * diurnalFactor * 10) / 10;
    return {
      timeIso: dt.toISOString(),
      hourLabel: `${String(hour).padStart(2, '0')}:00`,
      pm25,
      pm10,
      usAqi: computeAqiFromPollutants({ pm25, pm10 }, 'US_EPA'),
      indiaAqi: computeAqiFromPollutants({ pm25, pm10 }, 'INDIA_NAQI'),
      temperatureC: Math.round((preset.temp + (hour >= 12 && hour <= 16 ? 4.5 : -1.5)) * 10) / 10,
      windSpeedKmh: Math.round((preset.wind + (hour >= 12 && hour <= 16 ? 4.0 : 0)) * 10) / 10,
    };
  });

  const aqiNum = computeAqiFromPollutants({ pm25: preset.pm25, pm10: preset.pm10 }, standard);
  return {
    location: { name: city, city, region, country, latitude, longitude },
    standard,
    aqi: getAqiSeverityMeta(aqiNum, standard),
    pollutants: {
      pm25: preset.pm25,
      pm10: preset.pm10,
      no2: preset.no2,
      so2: preset.so2,
      co: preset.co,
      o3: preset.o3,
    },
    weather: {
      temperatureC: preset.temp,
      humidityPct: preset.hum,
      windSpeedKmh: preset.wind,
      conditionText: preset.cond,
      isInversionLikely: preset.inv,
    },
    hourlyForecast,
    dataSource: `Demo Mode Scenario (${scenario.replace('_', ' ')})`,
    observedAt: nowIso,
    fetchedAt: nowIso,
    isCached: false,
    isStale: false,
    isDemo: true,
    demoScenario: scenario,
  };
}

function weatherCodeToText(code: number | undefined): string {
  if (code === undefined) return 'Observed Local Conditions';
  if (code === 0) return 'Clear Sky';
  if (code <= 3) return 'Partly Cloudy';
  if (code === 45 || code === 48) return 'Fog / Winter Haze';
  if (code >= 51 && code <= 67) return 'Light Rain / Drizzle';
  if (code >= 80) return 'Showers';
  return 'Overcast';
}

function recordMetric(
  db: DatabaseSync,
  serviceName: string,
  status: 'success' | 'fallback' | 'error' | 'cache_hit',
  latencyMs: number,
  userId?: string,
) {
  try {
    db.prepare(
      'INSERT INTO api_metrics (id, service_name, status, latency_ms, tokens_estimated, user_id, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
    ).run(crypto.randomUUID(), serviceName, status, latencyMs, userId ?? null, new Date().toISOString());
  } catch {
    // Non-fatal telemetry write
  }
}

/**
 * Fetches live Air Quality & Weather data from Open-Meteo APIs, with SQLite TTL caching,
 * graceful stale-cache fallback on upstream outages, and explicit Demo Scenario overrides.
 */
export async function getEnvironmentalSnapshot(
  db: DatabaseSync,
  params: {
    city: string;
    region?: string;
    country?: string;
    latitude: number;
    longitude: number;
    standard: AqiStandard;
    demoScenario?: DemoScenario;
    userId?: string;
  },
): Promise<EnvironmentalSnapshot> {
  const {
    city,
    region = '',
    country = '',
    latitude,
    longitude,
    standard,
    demoScenario = 'live',
    userId,
  } = params;

  if (
    envConfig.demoMode &&
    (demoScenario === 'severe_smog' || demoScenario === 'moderate_pollution' || demoScenario === 'improved_air')
  ) {
    return buildDemoScenarioSnapshot(city, region, country, latitude, longitude, standard, demoScenario);
  }

  const cacheKey = `${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
  const cachedRow = db
    .prepare('SELECT payload_json, fetched_at, expires_at FROM environmental_cache WHERE cache_key = ?')
    .get(cacheKey) as { payload_json: string; fetched_at: string; expires_at: string } | undefined;

  // Simulated external API failure mode for evaluators
  if (envConfig.demoMode && demoScenario === 'api_failure') {
    recordMetric(db, 'open-meteo', 'error', 120, userId);
    if (cachedRow) {
      const parsed = JSON.parse(cachedRow.payload_json) as Omit<EnvironmentalSnapshot, 'standard' | 'aqi'> & {
        pollutants: EnvironmentalSnapshot['pollutants'];
      };
      const aqiNum = computeAqiFromPollutants(parsed.pollutants, standard);
      return {
        ...parsed,
        location: { ...parsed.location, name: city, city, region, country },
        standard,
        aqi: getAqiSeverityMeta(aqiNum, standard),
        isCached: true,
        isStale: true,
        isDemo: true,
        demoScenario: 'api_failure',
        staleReason: 'Simulated external Air Quality API outage: displaying last valid cached observation.',
      };
    }
    throw new Error('External environmental API is currently unavailable and no prior cached reading exists for this location.');
  }

  if (cachedRow && new Date(cachedRow.expires_at).getTime() > Date.now()) {
    recordMetric(db, 'open-meteo', 'cache_hit', 3, userId);
    const parsed = JSON.parse(cachedRow.payload_json) as Omit<EnvironmentalSnapshot, 'standard' | 'aqi'>;
    const aqiNum = computeAqiFromPollutants(parsed.pollutants, standard);
    return {
      ...parsed,
      location: { name: city, city, region, country, latitude, longitude },
      standard,
      aqi: getAqiSeverityMeta(aqiNum, standard),
      isCached: true,
      isStale: false,
      isDemo: false,
    };
  }

  const startedAt = Date.now();
  try {
    const aqUrl =
      `${envConfig.airQualityApiBase}/air-quality?latitude=${latitude}&longitude=${longitude}` +
      `&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi` +
      `&hourly=pm10,pm2_5,us_aqi&forecast_days=2&timezone=auto`;
    const wxUrl =
      `${envConfig.weatherApiBase}/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
      `&hourly=temperature_2m,wind_speed_10m&forecast_days=2&timezone=auto`;

    const [aqRes, wxRes] = await Promise.all([fetchWithRetry(aqUrl, 2), fetchWithRetry(wxUrl, 2)]);
    const aqData = (await aqRes.json()) as {
      current?: {
        time?: string;
        pm2_5?: number | null;
        pm10?: number | null;
        nitrogen_dioxide?: number | null;
        sulphur_dioxide?: number | null;
        carbon_monoxide?: number | null;
        ozone?: number | null;
        us_aqi?: number | null;
      };
      hourly?: {
        time?: string[];
        pm2_5?: Array<number | null>;
        pm10?: Array<number | null>;
        us_aqi?: Array<number | null>;
      };
    };
    const wxData = (await wxRes.json()) as {
      current?: {
        temperature_2m?: number | null;
        relative_humidity_2m?: number | null;
        wind_speed_10m?: number | null;
        weather_code?: number;
      };
      hourly?: {
        time?: string[];
        temperature_2m?: Array<number | null>;
        wind_speed_10m?: Array<number | null>;
      };
    };

    const pollutants = {
      pm25: aqData.current?.pm2_5 ?? null,
      pm10: aqData.current?.pm10 ?? null,
      no2: aqData.current?.nitrogen_dioxide ?? null,
      so2: aqData.current?.sulphur_dioxide ?? null,
      co: aqData.current?.carbon_monoxide ?? null,
      o3: aqData.current?.ozone ?? null,
    };

    const temp = wxData.current?.temperature_2m ?? null;
    const hum = wxData.current?.relative_humidity_2m ?? null;
    const wind = wxData.current?.wind_speed_10m ?? null;
    const isInversionLikely = Boolean(wind !== null && wind < 6.5 && temp !== null && temp < 18);

    const hourlyForecast: HourlyForecastPoint[] = [];
    const times = aqData.hourly?.time ?? [];
    const nowMs = Date.now();
    for (let i = 0; i < times.length && hourlyForecast.length < 12; i++) {
      const tMs = Date.parse(times[i]);
      if (Number.isNaN(tMs) || tMs < nowMs - 3600 * 1000) continue;
      const pm25 = aqData.hourly?.pm2_5?.[i] ?? null;
      const pm10 = aqData.hourly?.pm10?.[i] ?? null;
      hourlyForecast.push({
        timeIso: times[i],
        hourLabel: times[i].slice(11, 16),
        pm25,
        pm10,
        usAqi: aqData.hourly?.us_aqi?.[i] ?? computeAqiFromPollutants({ pm25, pm10 }, 'US_EPA'),
        indiaAqi: computeAqiFromPollutants({ pm25, pm10 }, 'INDIA_NAQI'),
        temperatureC: wxData.hourly?.temperature_2m?.[i] ?? null,
        windSpeedKmh: wxData.hourly?.wind_speed_10m?.[i] ?? null,
      });
    }

    const computedAqi =
      standard === 'US_EPA' && typeof aqData.current?.us_aqi === 'number'
        ? aqData.current.us_aqi
        : computeAqiFromPollutants(pollutants, standard);

    const nowIso = new Date().toISOString();
    const snapshotBase = {
      location: { name: city, city, region, country, latitude, longitude },
      pollutants,
      weather: {
        temperatureC: temp,
        humidityPct: hum,
        windSpeedKmh: wind,
        conditionText: weatherCodeToText(wxData.current?.weather_code),
        isInversionLikely,
      },
      hourlyForecast,
      dataSource: 'Open-Meteo Air Quality & Weather API (Copernicus CAMS)',
      observedAt: aqData.current?.time ? new Date(aqData.current.time).toISOString() : nowIso,
      fetchedAt: nowIso,
      isCached: false,
      isStale: false,
      isDemo: false,
    };

    db.prepare(`
      INSERT INTO environmental_cache (cache_key, latitude, longitude, payload_json, fetched_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET payload_json = excluded.payload_json, fetched_at = excluded.fetched_at, expires_at = excluded.expires_at
    `).run(
      cacheKey,
      latitude,
      longitude,
      JSON.stringify(snapshotBase),
      nowIso,
      new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    );

    recordMetric(db, 'open-meteo', 'success', Date.now() - startedAt, userId);

    return {
      ...snapshotBase,
      standard,
      aqi: getAqiSeverityMeta(computedAqi, standard),
    };
  } catch (err) {
    recordMetric(db, 'open-meteo', 'error', Date.now() - startedAt, userId);
    logger.warn('environmental_api_error', { city, message: (err as Error).message });

    if (cachedRow) {
      const parsed = JSON.parse(cachedRow.payload_json) as Omit<EnvironmentalSnapshot, 'standard' | 'aqi'>;
      const aqiNum = computeAqiFromPollutants(parsed.pollutants, standard);
      return {
        ...parsed,
        location: { name: city, city, region, country, latitude, longitude },
        standard,
        aqi: getAqiSeverityMeta(aqiNum, standard),
        isCached: true,
        isStale: true,
        isDemo: false,
        staleReason: 'Live air quality provider timed out; showing last valid cached observation.',
      };
    }

    throw new Error('Unable to retrieve live air quality data right now and no cached reading is available.', {
      cause: err,
    });
  }
}
