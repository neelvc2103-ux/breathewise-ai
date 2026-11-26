import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type {
  DailyRoutinePlan,
  EnvironmentalSnapshot,
  RoutineActivityItem,
  UserProfile,
} from '../../../types/domain';
import { findBestForecastWindow } from '../ai/aiService';

export function buildAdaptiveRoutine(
  snapshot: EnvironmentalSnapshot,
  profile: Partial<UserProfile>,
): Omit<DailyRoutinePlan, 'id' | 'createdAt'> {
  const aqi = snapshot.aqi.aqi;
  const highSmog =
    snapshot.aqi.level === 'unhealthy' ||
    snapshot.aqi.level === 'very_unhealthy' ||
    snapshot.aqi.level === 'severe';
  const moderateSmog = snapshot.aqi.level === 'sensitive' || snapshot.aqi.level === 'moderate';
  const bestWindow = findBestForecastWindow(snapshot);
  const commuteKm = profile.commuteDistanceKm ?? 12;
  const hasTransit = profile.publicTransitAvailable !== false;

  const items: RoutineActivityItem[] = [
    {
      id: crypto.randomUUID(),
      category: 'Morning Activities',
      title: highSmog ? 'Indoor Mobility & Breathing Warmup' : 'Morning Walk / Light Stretch',
      scheduledTime: '07:00',
      suggestedAlternative: highSmog
        ? '15-minute indoor yoga, stretching, or bodyweight mobility away from open windows'
        : 'Walk on tree-lined residential streets away from arterial traffic',
      exposureNote: highSmog
        ? `Avoids morning inversion PM2.5 (${snapshot.pollutants.pm25 ?? 'elevated'} µg/m³).`
        : 'Keeps morning inhalation rate moderate.',
      environmentalNote: 'Zero tailpipe emissions.',
      reason: highSmog
        ? `Current AQI is ${aqi} (${snapshot.aqi.category}). Cold winter mornings trap particulates near ground level.`
        : `Current AQI (${aqi}) allows gentle outdoor movement.`,
      isIndoor: highSmog,
      completed: false,
    },
    {
      id: crypto.randomUUID(),
      category: 'Office / School Commuting',
      title: hasTransit ? 'Low-Emission Transit or Remote Work' : 'Carpool & Anti-Idling Commute',
      scheduledTime: '08:45',
      suggestedAlternative: highSmog && profile.workMode === 'wfh'
        ? 'Work remotely today to avoid commuting exposure and vehicle emissions'
        : hasTransit
          ? `Use enclosed metro/rail for your ${commuteKm} km commute${highSmog ? ' with a fitted N95 mask' : ''}`
          : 'Carpool with 1-2 colleagues and turn off engine at signals >30s',
      exposureNote: highSmog
        ? 'Enclosed metro cabins + N95 filtration cut roadside PM2.5 inhalation versus open two-wheelers.'
        : 'Avoids congested roadside exhaust inhalation.',
      environmentalNote: `Replacing ${commuteKm} km solo car travel with metro avoids ~${(commuteKm * 0.136).toFixed(2)} kg CO2e per way.`,
      reason: `Tailored to your ${commuteKm} km commute (${profile.primaryTransport ?? 'car'}).`,
      isIndoor: profile.workMode === 'wfh',
      completed: false,
    },
    {
      id: crypto.randomUUID(),
      category: 'Home Ventilation',
      title: 'Forecast-Aligned Cross Ventilation',
      scheduledTime: bestWindow.includes(':') ? bestWindow.slice(bestWindow.indexOf(':') - 2, bestWindow.indexOf(':') + 3) : '14:00',
      suggestedAlternative: highSmog
        ? 'Keep windows sealed; rely on HEPA recirculation until forecast AQI improves'
        : `Open opposite windows for 15–20 minutes during ${bestWindow}`,
      exposureNote: 'Prevents bringing peak morning/evening smog indoors while refreshing indoor CO2.',
      environmentalNote: 'Passive ventilation uses zero electricity.',
      reason: `Based on local hourly forecast (${bestWindow}), not a fixed assumption about afternoon air.`,
      isIndoor: true,
      completed: false,
    },
    {
      id: crypto.randomUUID(),
      category: 'Cooking',
      title: 'Low-Smoke Meal Preparation',
      scheduledTime: '19:30',
      suggestedAlternative: `Run ${profile.indoorCookingVentilation || 'kitchen exhaust fan'} 5 minutes before and 15 minutes after cooking; use lids on pans`,
      exposureNote: 'Reduces indoor PM2.5 and NO2 spikes from frying and gas burners.',
      environmentalNote: 'Covered pots and induction/pressure cooking cut cooking energy by 20–35%.',
      reason: 'Cooking is one of the largest controllable sources of indoor fine particles.',
      isIndoor: true,
      completed: false,
    },
    {
      id: crypto.randomUUID(),
      category: 'Outdoor Exercise',
      title: highSmog || moderateSmog ? 'Evening Indoor Conditioning' : 'Evening Park Walk or Cycling',
      scheduledTime: '18:00',
      suggestedAlternative: highSmog
        ? 'Indoor resistance bands, stationary bike, or family stretching session'
        : 'Moderate outdoor activity if hourly AQI remains below unhealthy levels',
      exposureNote: 'Heavy breathing during exercise multiplies inhaled particle load; indoor option protects lungs.',
      environmentalNote: 'Zero energy or low-energy fitness.',
      reason: `Evening traffic + cooling air often raise particulate levels (${aqi} ${snapshot.aqi.category}).`,
      isIndoor: highSmog || moderateSmog,
      completed: false,
    },
    {
      id: crypto.randomUUID(),
      category: 'Shopping & Errands',
      title: 'Consolidated Delivery & Zero-Burn Waste',
      scheduledTime: '17:15',
      suggestedAlternative: 'Bundle weekly groceries into one trip or consolidated delivery; separate dry waste for municipal pickup',
      exposureNote: 'Minimizes repeated roadside errands during rush hour.',
      environmentalNote: 'Consolidating 1 delivery trip avoids ~0.30 kg CO2e; avoiding waste burning eliminates local black carbon.',
      reason: 'Reduces neighborhood vehicle kilometers and open-smoke episodes.',
      isIndoor: false,
      completed: false,
    },
    {
      id: crypto.randomUUID(),
      category: 'Nighttime Preparation',
      title: 'Bedroom Clean-Air Reset',
      scheduledTime: '22:00',
      suggestedAlternative: profile.hasAirPurifier
        ? 'Close bedroom doors, run HEPA purifier on medium for 45 mins before sleep, then switch to quiet night mode'
        : 'Wipe bedroom hard surfaces with a damp microfiber cloth, seal window gaps, and turn off standby electronics',
      exposureNote: 'Supports cleaner overnight breathing for children and elderly family members.',
      environmentalNote: 'Unplugging standby entertainment/chargers trims overnight phantom kWh.',
      reason: 'Nighttime temperature inversion frequently causes the highest 24-hour outdoor PM2.5 levels.',
      isIndoor: true,
      completed: false,
    },
  ];

  return {
    dateIso: new Date().toISOString().slice(0, 10),
    city: snapshot.location.city,
    aqiAtGeneration: aqi,
    aqiStandard: snapshot.standard,
    providerUsed: 'deterministic_fallback',
    summary: `Adaptive schedule for ${snapshot.location.city} at AQI ${aqi} (${snapshot.aqi.category}, ${snapshot.standard}). ${highSmog ? 'Prioritizes indoor clean-air routines and enclosed low-emission transit.' : 'Balances outdoor windows with low-emission commuting.'}`,
    activities: items,
  };
}

export function generateAndSaveRoutine(
  db: DatabaseSync,
  userId: string,
  snapshot: EnvironmentalSnapshot,
  profile: Partial<UserProfile>,
): DailyRoutinePlan {
  const plan = buildAdaptiveRoutine(snapshot, profile);
  const routineId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO daily_routines (id, user_id, date_iso, city, aqi_at_generation, aqi_standard, provider_used, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    routineId,
    userId,
    plan.dateIso,
    plan.city,
    plan.aqiAtGeneration,
    plan.aqiStandard,
    plan.providerUsed,
    plan.summary,
    now,
  );

  const insertItem = db.prepare(`
    INSERT INTO routine_activities (
      id, routine_id, category, title, scheduled_time, suggested_alternative,
      exposure_note, environmental_note, reason, is_indoor, completed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const act of plan.activities) {
    insertItem.run(
      act.id,
      routineId,
      act.category,
      act.title,
      act.scheduledTime,
      act.suggestedAlternative,
      act.exposureNote,
      act.environmentalNote,
      act.reason,
      act.isIndoor ? 1 : 0,
      0,
    );
  }

  return {
    id: routineId,
    createdAt: now,
    ...plan,
  };
}

export function getLatestRoutine(db: DatabaseSync, userId: string): DailyRoutinePlan | null {
  const r = db
    .prepare('SELECT * FROM daily_routines WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(userId);
  if (!r) return null;

  const acts = db.prepare('SELECT * FROM routine_activities WHERE routine_id = ? ORDER BY scheduled_time ASC').all(String(r.id));
  return {
    id: String(r.id),
    dateIso: String(r.date_iso),
    city: String(r.city),
    aqiAtGeneration: Number(r.aqi_at_generation),
    aqiStandard: String(r.aqi_standard) === 'US_EPA' ? 'US_EPA' : 'INDIA_NAQI',
    providerUsed: String(r.provider_used) === 'gemini' ? 'gemini' : 'deterministic_fallback',
    summary: String(r.summary),
    createdAt: String(r.created_at),
    activities: acts.map((a) => ({
      id: String(a.id),
      category: String(a.category),
      title: String(a.title),
      scheduledTime: String(a.scheduled_time),
      suggestedAlternative: String(a.suggested_alternative),
      exposureNote: String(a.exposure_note),
      environmentalNote: String(a.environmental_note),
      reason: String(a.reason),
      isIndoor: Number(a.is_indoor) === 1,
      completed: Number(a.completed) === 1,
    })),
  };
}
