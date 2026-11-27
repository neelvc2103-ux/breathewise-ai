import type express from 'express';
import type { DatabaseSync } from 'node:sqlite';
import type { AqiStandard, DemoScenario, UserProfile } from '../../types/domain';

/**
 * Wraps an async Express 4 route handler so rejected promises forward cleanly to `next(err)`.
 */
export function asyncHandler(
  fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<unknown>,
): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const DEFAULT_CITY = 'New Delhi';
const DEFAULT_LAT = 28.6139;
const DEFAULT_LON = 77.209;

/**
 * Maps a raw SQLite `user_profiles` row into a strongly-typed `UserProfile` domain object.
 */
export function mapProfileRow(r: Record<string, unknown> | undefined): UserProfile | null {
  if (!r) return null;
  return {
    userId: String(r.user_id),
    country: String(r.country),
    stateRegion: String(r.state_region),
    city: String(r.city),
    postalCode: String(r.postal_code ?? ''),
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    aqiStandard: String(r.aqi_standard) === 'US_EPA' ? 'US_EPA' : 'INDIA_NAQI',
    workMode: String(r.work_mode) as UserProfile['workMode'],
    commuteDistanceKm: Number(r.commute_distance_km),
    primaryTransport: String(r.primary_transport) as UserProfile['primaryTransport'],
    outdoorActivity: String(r.outdoor_activity),
    exercisePreference: String(r.exercise_preference),
    cookingFuel: String(r.cooking_fuel) as UserProfile['cookingFuel'],
    householdSize: Number(r.household_size),
    publicTransitAvailable: Number(r.public_transit_available) === 1,
    childrenCount: Number(r.children_count),
    adultsCount: Number(r.adults_count),
    elderlyCount: Number(r.elderly_count),
    hasSensitiveMembers: Number(r.has_sensitive_members) === 1,
    hasAirPurifier: Number(r.has_air_purifier) === 1,
    ventilationType: String(r.ventilation_type) as UserProfile['ventilationType'],
    hasBalconyWindows: Number(r.has_balcony_windows) === 1,
    indoorCookingVentilation: String(r.indoor_cooking_ventilation) as UserProfile['indoorCookingVentilation'],
    hasIndoorSensor: Number(r.has_indoor_sensor) === 1,
    preferredLanguage: (String(r.preferred_language) as UserProfile['preferredLanguage']) || 'en',
    sustainabilityGoal: String(r.sustainability_goal),
    dailyScheduleSummary: String(r.daily_schedule_summary),
    budgetLevel: String(r.budget_level) as UserProfile['budgetLevel'],
    consentWithdrawn: Number(r.consent_withdrawn) === 1,
  };
}

export function getUserProfile(db: DatabaseSync, userId: string): UserProfile | null {
  const row = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId) as
    | Record<string, unknown>
    | undefined;
  return mapProfileRow(row);
}

export function isValidCoordinates(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Resolves city, coordinates, AQI standard, and demo scenario from request input
 * with safe fallback to the user's saved profile or default location.
 */
export function resolveEnvironmentalParams(
  input: Record<string, unknown>,
  profile: UserProfile | null,
): {
  city: string;
  latitude: number;
  longitude: number;
  standard: AqiStandard;
  demoScenario: DemoScenario;
  validCoords: boolean;
} {
  const city = String(input.city ?? profile?.city ?? DEFAULT_CITY);
  const rawLat = input.latitude ?? input.lat ?? profile?.latitude ?? DEFAULT_LAT;
  const rawLon = input.longitude ?? input.lon ?? profile?.longitude ?? DEFAULT_LON;
  const latitude = Number(rawLat);
  const longitude = Number(rawLon);
  const standard: AqiStandard =
    input.standard === 'US_EPA' ? 'US_EPA' : (profile?.aqiStandard ?? 'INDIA_NAQI');
  const demoScenario = String(input.demoScenario ?? 'live') as DemoScenario;

  return {
    city,
    latitude,
    longitude,
    standard,
    demoScenario,
    validCoords: isValidCoordinates(latitude, longitude),
  };
}

export function parseJsonArraySafely(raw: unknown): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
