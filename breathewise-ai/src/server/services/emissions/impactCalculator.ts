import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { ActivityLogEntry, EmissionFactorRecord, ImpactSummary } from '../../../types/domain';

export function calculateActivityImpact(factor: EmissionFactorRecord, quantity: number) {
  const baselineEmissions = quantity * factor.baselineKgCo2ePerUnit;
  const alternativeEmissions = quantity * factor.alternativeKgCo2ePerUnit;
  const co2eAvoidedKg = Math.max(0, Number((baselineEmissions - alternativeEmissions).toFixed(3)));
  const fuelSavedLiters = Number((quantity * factor.fuelLitersPerUnit).toFixed(3));
  const vehicleKmAvoided = factor.category === 'Transportation' || factor.category === 'Remote Work'
    ? factor.unit === 'km'
      ? Number(quantity.toFixed(2))
      : 0
    : 0;
  const energySavedKwh = factor.code === 'ELECTRICITY_SAVED' ? Number(quantity.toFixed(2)) : 0;

  return {
    baselineEmissions: Number(baselineEmissions.toFixed(3)),
    alternativeEmissions: Number(alternativeEmissions.toFixed(3)),
    co2eAvoidedKg,
    fuelSavedLiters,
    vehicleKmAvoided,
    energySavedKwh,
  };
}

export function listEmissionFactors(db: DatabaseSync): EmissionFactorRecord[] {
  const rows = db.prepare('SELECT * FROM emission_factors ORDER BY category, label').all();
  return rows.map((r) => ({
    id: String(r.id),
    code: String(r.code),
    category: String(r.category),
    label: String(r.label),
    unit: String(r.unit),
    baselineKgCo2ePerUnit: Number(r.baseline_kg_co2e_per_unit),
    alternativeKgCo2ePerUnit: Number(r.alternative_kg_co2e_per_unit),
    fuelLitersPerUnit: Number(r.fuel_liters_per_unit),
    source: String(r.source),
    region: String(r.region),
    publicationYear: Number(r.publication_year),
    assumptions: String(r.assumptions),
  }));
}

export function logUserActivity(
  db: DatabaseSync,
  params: {
    userId: string;
    householdId?: string | null;
    factorCode: string;
    quantity: number;
    activityDate: string;
    notes?: string;
  },
): ActivityLogEntry {
  const factorRow = db.prepare('SELECT * FROM emission_factors WHERE code = ?').get(params.factorCode);
  if (!factorRow) {
    throw new Error('Selected emission factor was not found.');
  }

  const factor: EmissionFactorRecord = {
    id: String(factorRow.id),
    code: String(factorRow.code),
    category: String(factorRow.category),
    label: String(factorRow.label),
    unit: String(factorRow.unit),
    baselineKgCo2ePerUnit: Number(factorRow.baseline_kg_co2e_per_unit),
    alternativeKgCo2ePerUnit: Number(factorRow.alternative_kg_co2e_per_unit),
    fuelLitersPerUnit: Number(factorRow.fuel_liters_per_unit),
    source: String(factorRow.source),
    region: String(factorRow.region),
    publicationYear: Number(factorRow.publication_year),
    assumptions: String(factorRow.assumptions),
  };

  // Deduplication guard: prevent accidental double-submission of identical factor+quantity+date+notes
  const dedupKey = crypto
    .createHash('sha256')
    .update(`${params.factorCode}:${params.quantity}:${params.activityDate}:${(params.notes ?? '').trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, 24);

  const duplicate = db
    .prepare('SELECT id FROM activity_logs WHERE user_id = ? AND dedup_key = ?')
    .get(params.userId, dedupKey);
  if (duplicate) {
    throw new Error('Duplicate activity detected for the same date, action, and quantity.');
  }

  const calc = calculateActivityImpact(factor, params.quantity);
  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  db.prepare(`
    INSERT INTO activity_logs (
      id, user_id, household_id, factor_code, activity_title, quantity, unit,
      co2e_avoided_kg, fuel_saved_liters, vehicle_km_avoided, energy_saved_kwh,
      dedup_key, notes, activity_date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.userId,
    params.householdId ?? null,
    factor.code,
    factor.label,
    params.quantity,
    factor.unit,
    calc.co2eAvoidedKg,
    calc.fuelSavedLiters,
    calc.vehicleKmAvoided,
    calc.energySavedKwh,
    dedupKey,
    params.notes ?? '',
    params.activityDate,
    nowIso,
  );

  evaluateUserAchievements(db, params.userId);

  return {
    id,
    userId: params.userId,
    householdId: params.householdId ?? null,
    factorCode: factor.code,
    activityTitle: factor.label,
    quantity: params.quantity,
    unit: factor.unit,
    co2eAvoidedKg: calc.co2eAvoidedKg,
    fuelSavedLiters: calc.fuelSavedLiters,
    vehicleKmAvoided: calc.vehicleKmAvoided,
    energySavedKwh: calc.energySavedKwh,
    notes: params.notes ?? '',
    activityDate: params.activityDate,
    createdAt: nowIso,
  };
}

export function getImpactSummary(db: DatabaseSync, userId: string): ImpactSummary {
  const rows = db
    .prepare('SELECT * FROM activity_logs WHERE user_id = ? ORDER BY activity_date DESC, created_at DESC')
    .all(userId);

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000).toISOString().slice(0, 10);

  let daily = 0;
  let weekly = 0;
  let monthly = 0;
  let total = 0;
  let fuel = 0;
  let km = 0;
  let kwh = 0;
  let trips = 0;

  const byDate = new Map<string, { co2eKg: number; activities: number }>();

  for (const r of rows) {
    const co2 = Number(r.co2e_avoided_kg);
    const d = String(r.activity_date);
    total += co2;
    fuel += Number(r.fuel_saved_liters);
    km += Number(r.vehicle_km_avoided);
    kwh += Number(r.energy_saved_kwh);
    if (String(r.factor_code).startsWith('COMMUTE_') || String(r.factor_code) === 'CONSOLIDATE_DELIVERY') {
      trips += 1;
    }
    if (d === today) daily += co2;
    if (d >= sevenDaysAgo) weekly += co2;
    if (d >= thirtyDaysAgo) monthly += co2;

    const curr = byDate.get(d) ?? { co2eKg: 0, activities: 0 };
    curr.co2eKg = Number((curr.co2eKg + co2).toFixed(3));
    curr.activities += 1;
    byDate.set(d, curr);
  }

  const dailySeries = Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([date, val]) => ({ date, co2eKg: val.co2eKg, activities: val.activities }));

  return {
    dailyCo2eAvoidedKg: Number(daily.toFixed(2)),
    weeklyCo2eAvoidedKg: Number(weekly.toFixed(2)),
    monthlyCo2eAvoidedKg: Number(monthly.toFixed(2)),
    totalCo2eAvoidedKg: Number(total.toFixed(2)),
    totalFuelSavedLiters: Number(fuel.toFixed(2)),
    totalVehicleKmAvoided: Number(km.toFixed(1)),
    totalEnergySavedKwh: Number(kwh.toFixed(1)),
    sustainableTripsCount: trips,
    dailySeries,
    scientificNote:
      'Modeled estimates use documented emissions-factor baselines (DEFRA, EPA, CEA, IPCC). Avoiding CO2e reduces greenhouse gas contribution and tailpipe pollutants; it does not single-handedly lower citywide ambient AQI.',
  };
}

export function evaluateUserAchievements(db: DatabaseSync, userId: string): void {
  const agg = db
    .prepare(
      'SELECT COALESCE(SUM(co2e_avoided_kg),0) AS co2, COALESCE(SUM(vehicle_km_avoided),0) AS km, COALESCE(SUM(energy_saved_kwh),0) AS kwh, COUNT(*) AS cnt FROM activity_logs WHERE user_id = ?',
    )
    .get(userId) as { co2: number; km: number; kwh: number; cnt: number };

  const hh = db.prepare('SELECT COUNT(*) AS cnt FROM household_members WHERE user_id = ?').get(userId) as { cnt: number };
  const achs = db.prepare('SELECT * FROM achievements').all();
  const insert = db.prepare('INSERT OR IGNORE INTO user_achievements (id, user_id, achievement_id, unlocked_at) VALUES (?, ?, ?, ?)');
  const now = new Date().toISOString();

  for (const a of achs) {
    const metric = String(a.criteria_metric);
    const threshold = Number(a.criteria_threshold);
    let earned = false;
    if (metric === 'km' && agg.km >= threshold) earned = true;
    if (metric === 'co2e' && agg.co2 >= threshold) earned = true;
    if (metric === 'kwh' && agg.kwh >= threshold) earned = true;
    if (metric === 'count' && agg.cnt >= threshold) earned = true;
    if (metric === 'household' && hh.cnt >= threshold) earned = true;
    if (earned) {
      insert.run(crypto.randomUUID(), userId, String(a.id), now);
    }
  }
}
