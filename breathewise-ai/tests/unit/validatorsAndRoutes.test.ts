import { describe, expect, it } from 'vitest';
import {
  isValidCoordinates,
  parseJsonArraySafely,
  resolveEnvironmentalParams,
} from '../../src/server/routes/helpers';
import {
  adminResourceSchema,
  challengeProgressSchema,
  householdGoalSchema,
} from '../../src/validators/schemas';

describe('Validators & Route Helpers', () => {
  it('validates coordinate bounds strictly', () => {
    expect(isValidCoordinates(28.6139, 77.209)).toBe(true);
    expect(isValidCoordinates(-90, 180)).toBe(true);
    expect(isValidCoordinates(91, 77)).toBe(false);
    expect(isValidCoordinates(28, -181)).toBe(false);
    expect(isValidCoordinates(Number.NaN, 77)).toBe(false);
  });

  it('resolves environmental parameters with profile fallback', () => {
    const resolved = resolveEnvironmentalParams(
      { lat: '999', lon: '77' },
      null,
    );
    expect(resolved.validCoords).toBe(false);
    expect(resolved.city).toBe('New Delhi');
    expect(resolved.standard).toBe('INDIA_NAQI');
  });

  it('parses JSON arrays safely without throwing on malformed payloads', () => {
    expect(parseJsonArraySafely('[{"a":1}]')).toEqual([{ a: 1 }]);
    expect(parseJsonArraySafely('{not-valid-json')).toEqual([]);
    expect(parseJsonArraySafely('{"obj":true}')).toEqual([]);
    expect(parseJsonArraySafely(null)).toEqual([]);
  });

  it('rejects non-HTTP(S) URLs in adminResourceSchema', () => {
    const bad = adminResourceSchema.safeParse({
      title: 'Indoor Filtration Guide',
      content: 'Detailed evidence-based indoor filtration steps.',
      sourceUrl: 'javascript:alert(1)',
    });
    expect(bad.success).toBe(false);

    const good = adminResourceSchema.safeParse({
      title: 'Indoor Filtration Guide',
      content: 'Detailed evidence-based indoor filtration steps.',
      sourceUrl: 'https://www.who.int/health-topics/air-pollution',
    });
    expect(good.success).toBe(true);
  });

  it('validates household goals and challenge progress bounds', () => {
    expect(householdGoalSchema.safeParse({ sharedGoal: 'abc' }).success).toBe(false);
    expect(householdGoalSchema.safeParse({ sharedGoal: 'Use metro 4 days a week' }).success).toBe(true);
    expect(challengeProgressSchema.safeParse({ amount: -5 }).success).toBe(false);
    expect(challengeProgressSchema.safeParse({ amount: 12 }).success).toBe(true);
  });
});
