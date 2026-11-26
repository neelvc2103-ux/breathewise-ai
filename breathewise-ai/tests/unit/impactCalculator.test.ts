import { describe, expect, it } from 'vitest';
import { getDatabase } from '../../src/server/db/database';
import { seedDatabase } from '../../src/server/db/seed';
import {
  calculateActivityImpact,
  getImpactSummary,
  listEmissionFactors,
  logUserActivity,
} from '../../src/server/services/emissions/impactCalculator';
import { registerUser } from '../../src/server/services/auth/authService';

describe('Deterministic Environmental Impact Calculator', () => {
  it('computes avoided CO2e accurately from baseline minus alternative factor', () => {
    const db = getDatabase(':memory:');
    seedDatabase(db);
    const factors = listEmissionFactors(db);
    const metroFactor = factors.find((f) => f.code === 'COMMUTE_CAR_TO_METRO')!;

    const res = calculateActivityImpact(metroFactor, 10);
    expect(res.baselineEmissions).toBeCloseTo(1.71, 2);
    expect(res.alternativeEmissions).toBeCloseTo(0.35, 2);
    expect(res.co2eAvoidedKg).toBeCloseTo(1.36, 2);
    expect(res.fuelSavedLiters).toBeCloseTo(0.75, 2);
    expect(res.vehicleKmAvoided).toBe(10);
  });

  it('prevents duplicate identical activity submissions from inflating totals', () => {
    const db = getDatabase(':memory:');
    seedDatabase(db);
    const { user } = registerUser(db, {
      fullName: 'Test Impact User',
      email: 'impact@test.local',
      password: 'Password123',
    });

    logUserActivity(db, {
      userId: user.id,
      factorCode: 'COMMUTE_CAR_TO_METRO',
      quantity: 12,
      activityDate: '2026-11-26',
      notes: 'Morning metro',
    });

    expect(() =>
      logUserActivity(db, {
        userId: user.id,
        factorCode: 'COMMUTE_CAR_TO_METRO',
        quantity: 12,
        activityDate: '2026-11-26',
        notes: 'Morning metro',
      }),
    ).toThrow(/Duplicate activity/);

    const summary = getImpactSummary(db, user.id);
    expect(summary.totalVehicleKmAvoided).toBe(12);
  });
});
