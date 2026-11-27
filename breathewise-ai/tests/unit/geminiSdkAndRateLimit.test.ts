import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDatabase } from '../../src/server/db/database';
import { seedDatabase } from '../../src/server/db/seed';
import { getAqiSeverityMeta } from '../../src/server/services/air-quality/aqiStandards';
import { checkAuthRateLimit, clearAuthRateLimit } from '../../src/server/services/auth/authService';
import type { EnvironmentalSnapshot } from '../../src/types/domain';

const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent: mockGenerateContent,
    };
  },
  Type: {
    OBJECT: 'OBJECT',
    ARRAY: 'ARRAY',
    STRING: 'STRING',
  },
}));

function makeSnapshot(): EnvironmentalSnapshot {
  return {
    location: { name: 'New Delhi', city: 'New Delhi', region: 'Delhi NCR', country: 'India', latitude: 28.6139, longitude: 77.209 },
    standard: 'INDIA_NAQI',
    aqi: getAqiSeverityMeta(340, 'INDIA_NAQI'),
    pollutants: { pm25: 170, pm10: 290, no2: 65, so2: 16, co: 1200, o3: 30 },
    weather: { temperatureC: 12, humidityPct: 80, windSpeedKmh: 3.0, conditionText: 'Winter Smog', isInversionLikely: true },
    hourlyForecast: [
      { timeIso: '2026-11-27T08:00:00Z', hourLabel: '08:00', pm25: 190, pm10: 310, usAqi: 240, indiaAqi: 350, temperatureC: 11, windSpeedKmh: 2.5 },
    ],
    dataSource: 'Test Fixture',
    observedAt: '2026-11-27T08:00:00Z',
    fetchedAt: '2026-11-27T08:00:00Z',
    isCached: false,
    isStale: false,
    isDemo: true,
  };
}

describe('Gemini SDK Mocking, Invalid Schema Fallback & Rate-Limit Recovery', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockGenerateContent.mockReset();
  });

  it('parses valid structured Gemini SDK JSON response when API key is configured', async () => {
    const { envConfig } = await import('../../src/server/config/env');
    const prevKey = envConfig.geminiApiKey;
    envConfig.geminiApiKey = 'test-mock-key-not-real';

    try {
      const db = getDatabase(':memory:');
      seedDatabase(db);
      const user = db.prepare("SELECT id FROM users WHERE email = 'demo.family@breathewise.local'").get() as { id: string };

      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          summary: 'Air quality in New Delhi is Very Poor (340 India NAQI). Stay indoors during morning inversion.',
          recommendations: [
            {
              title: 'Indoor Mobility Routine',
              suggestedAction: 'Complete stretching indoors.',
              recommendedTime: '07:00 AM',
              reason: 'PM2.5 is 170 µg/m³.',
              personalRelevance: 'Protects sensitive family members.',
              exposureBenefit: 'Reduces inhaled fine particulates.',
              environmentalBenefit: 'Zero emissions.',
              estimatedCost: 'Free',
              difficultyLevel: 'UnknownLevel',
              supportingSource: 'WHO Guidelines',
              uncertaintyOrLimitations: 'Model grid estimate.',
              safetyPrecautions: 'Wear N95 if going outside.',
            },
          ],
        }),
      });

      const { generateAssistantReply } = await import('../../src/server/services/ai/aiService');
      const reply = await generateAssistantReply(db, {
        userId: user.id,
        message: 'Is it safe to jog?',
        snapshot: makeSnapshot(),
        profile: { commuteDistanceKm: 10 },
      });

      expect(reply.providerUsed).toBe('gemini');
      expect(reply.recommendations[0].difficultyLevel).toBe('Easy');
      expect(reply.groundedDataSnapshot.aqi).toBe(340);
    } finally {
      envConfig.geminiApiKey = prevKey;
    }
  });

  it('falls back to deterministic engine on invalid Gemini JSON or SDK rejection', async () => {
    const { envConfig } = await import('../../src/server/config/env');
    const prevKey = envConfig.geminiApiKey;
    envConfig.geminiApiKey = 'test-mock-key-not-real';

    try {
      const db = getDatabase(':memory:');
      seedDatabase(db);
      const user = db.prepare("SELECT id FROM users WHERE email = 'demo.family@breathewise.local'").get() as { id: string };

      // Invalid schema (empty recommendations)
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({ summary: 'Only summary', recommendations: [] }),
      });

      const { generateAssistantReply } = await import('../../src/server/services/ai/aiService');
      const invalidSchemaReply = await generateAssistantReply(db, {
        userId: user.id,
        message: 'Should I open windows?',
        snapshot: makeSnapshot(),
        profile: {},
      });
      expect(invalidSchemaReply.providerUsed).toBe('deterministic_fallback');

      // SDK network error
      mockGenerateContent.mockRejectedValueOnce(new Error('503 Service Unavailable'));
      const errorReply = await generateAssistantReply(db, {
        userId: user.id,
        message: 'Commute advice?',
        snapshot: makeSnapshot(),
        profile: {},
      });
      expect(errorReply.providerUsed).toBe('deterministic_fallback');
    } finally {
      envConfig.geminiApiKey = prevKey;
    }
  });

  it('recovers rate-limit allowance automatically after window expires', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-27T10:00:00Z'));
    const key = 'expiry-recovery-key';
    clearAuthRateLimit(key);

    expect(checkAuthRateLimit(key, 2, 60_000)).toBe(true);
    expect(checkAuthRateLimit(key, 2, 60_000)).toBe(true);
    expect(checkAuthRateLimit(key, 2, 60_000)).toBe(false);

    // Advance past 60s window -> rate limit resets
    vi.advanceTimersByTime(61_000);
    expect(checkAuthRateLimit(key, 2, 60_000)).toBe(true);
  });
});
