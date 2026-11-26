import { describe, expect, it } from 'vitest';
import { computeAqiFromPollutants, getAqiSeverityMeta } from '../../src/server/services/air-quality/aqiStandards';

describe('AQI Standards & Breakpoints', () => {
  it('computes US EPA AQI accurately from PM2.5 concentrations', () => {
    expect(computeAqiFromPollutants({ pm25: 9.0, pm10: 20 }, 'US_EPA')).toBe(50);
    expect(computeAqiFromPollutants({ pm25: 150, pm10: 100 }, 'US_EPA')).toBeGreaterThan(200);
  });

  it('computes India NAQI separately from US EPA AQI without mixing scales', () => {
    const pm25 = 65;
    const usAqi = computeAqiFromPollutants({ pm25, pm10: 80 }, 'US_EPA');
    const indiaAqi = computeAqiFromPollutants({ pm25, pm10: 80 }, 'INDIA_NAQI');
    expect(usAqi).not.toBe(indiaAqi);
    expect(getAqiSeverityMeta(indiaAqi, 'INDIA_NAQI').category).toBe('Moderate');
    expect(getAqiSeverityMeta(usAqi, 'US_EPA').standard).toBe('US_EPA');
  });

  it('provides accessible category, icon, and plain-language guidance across severity bands', () => {
    const severe = getAqiSeverityMeta(420, 'INDIA_NAQI');
    expect(severe.category).toBe('Severe');
    expect(severe.level).toBe('severe');
    expect(severe.iconName).toBe('AlertOctagon');
    expect(severe.outdoorGuidance.length).toBeGreaterThan(10);
  });
});
