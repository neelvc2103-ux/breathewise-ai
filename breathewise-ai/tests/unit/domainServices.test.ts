import { describe, expect, it } from 'vitest';
import { getAqiSeverityMeta } from '../../src/server/services/air-quality/aqiStandards';
import { getPersonalizedAlternatives } from '../../src/server/services/alternatives/alternativesService';
import { getIndoorGuidance } from '../../src/server/services/indoor/indoorService';
import type { EnvironmentalSnapshot } from '../../src/types/domain';

function makeEnvSnapshot(aqiVal: number): EnvironmentalSnapshot {
  return {
    location: { name: 'New Delhi', city: 'New Delhi', region: 'Delhi NCR', country: 'India', latitude: 28.6139, longitude: 77.209 },
    standard: 'INDIA_NAQI',
    aqi: getAqiSeverityMeta(aqiVal, 'INDIA_NAQI'),
    pollutants: { pm25: 210, pm10: 320, no2: 75, so2: 19, co: 1600, o3: 30 },
    weather: { temperatureC: 11.5, humidityPct: 82, windSpeedKmh: 2.8, conditionText: 'Winter Inversion', isInversionLikely: true },
    hourlyForecast: [
      { timeIso: '2026-11-26T08:00:00Z', hourLabel: '08:00', pm25: 220, pm10: 340, usAqi: 270, indiaAqi: 380, temperatureC: 11, windSpeedKmh: 2.5 },
      { timeIso: '2026-11-26T14:00:00Z', hourLabel: '14:00', pm25: 130, pm10: 200, usAqi: 190, indiaAqi: 290, temperatureC: 17, windSpeedKmh: 8.5 },
    ],
    dataSource: 'Test Fixture',
    observedAt: '2026-11-26T08:00:00Z',
    fetchedAt: '2026-11-26T08:00:00Z',
    isCached: false,
    isStale: false,
    isDemo: true,
  };
}

describe('Alternatives & Indoor Guidance Domain Services', () => {
  it('activates exposure guardrail during severe smog and disables cycling', () => {
    const severe = makeEnvSnapshot(420);
    const alts = getPersonalizedAlternatives(severe, { commuteDistanceKm: 15, publicTransitAvailable: true });
    expect(alts.length).toBeGreaterThanOrEqual(2);
    expect(alts[0].suggestedAlternative).toContain('Metro');
    expect(alts[0].exposureSafetyWarning).toContain('Exposure guardrail active');

    const clean = makeEnvSnapshot(45);
    const cleanAlts = getPersonalizedAlternatives(clean, { commuteDistanceKm: 8, publicTransitAvailable: false });
    expect(cleanAlts[0].exposureSafetyWarning).toBeUndefined();
    expect(cleanAlts[0].convenienceLevel).toBe('Moderate');
  });

  it('produces indoor guidance with advisory-only flag and smog-aware ventilation', () => {
    const severe = makeEnvSnapshot(380);
    const guidance = getIndoorGuidance(severe, { hasIndoorSensor: false, hasAirPurifier: true });
    expect(guidance.isAdvisoryOnly).toBe(true);
    expect(guidance.checklist.length).toBeGreaterThanOrEqual(4);
    const ventItem = guidance.checklist.find((i) => i.id === 'iaq-2');
    expect(ventItem?.action).toContain('Keep exterior windows closed');

    const clean = makeEnvSnapshot(40);
    const cleanGuidance = getIndoorGuidance(clean, { hasIndoorSensor: true, hasAirPurifier: false });
    expect(cleanGuidance.isAdvisoryOnly).toBe(false);
    const cleanVent = cleanGuidance.checklist.find((i) => i.id === 'iaq-2');
    expect(cleanVent?.action).toContain('Cross-ventilate');
  });
});
