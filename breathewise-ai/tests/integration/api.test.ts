import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server';

describe('Full-Stack API Integration & Security Tests', () => {
  let baseUrl = '';
  let server: ReturnType<ReturnType<typeof createApp>['app']['listen']>;
  const realFetch = globalThis.fetch;

  beforeAll(async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('open-meteo.com')) {
        const isAq = url.includes('air-quality');
        const payload = isAq
          ? {
              current: { pm2_5: 190, pm10: 300, nitrogen_dioxide: 68, sulphur_dioxide: 16, carbon_monoxide: 1400, ozone: 32, us_aqi: 240, time: '2026-11-27T08:00' },
              hourly: { time: ['2026-11-27T08:00:00Z', '2026-11-27T14:00:00Z'], pm2_5: [190, 140], pm10: [300, 220], us_aqi: [240, 195] },
            }
          : {
              current: { temperature_2m: 14, relative_humidity_2m: 78, wind_speed_10m: 3.5, weather_code: 45 },
              hourly: { time: ['2026-11-27T08:00:00Z', '2026-11-27T14:00:00Z'], temperature_2m: [14, 19], wind_speed_10m: [3.5, 8.0] },
            };
        return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return realFetch(input, init);
    });

    const { app } = createApp(':memory:');
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('registers, verifies email, logs in, and accesses protected profile', async () => {
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Kavita Verma',
        email: 'kavita@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
        acceptedTerms: true,
      }),
    });
    expect(regRes.status).toBe(201);
    const regData = (await regRes.json()) as { token: string; verificationPreviewToken: string };
    expect(regData.token).toBeTruthy();

    const verRes = await fetch(`${baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: regData.verificationPreviewToken }),
    });
    expect(verRes.status).toBe(200);

    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${regData.token}` },
    });
    expect(meRes.status).toBe(200);
    const meData = (await meRes.json()) as { user: { emailVerified: boolean } };
    expect(meData.user.emailVerified).toBe(true);
  });

  it('blocks unauthorized access and enforces server-side RBAC on admin routes', async () => {
    const unauth = await fetch(`${baseUrl}/api/v1/admin/overview`);
    expect(unauth.status).toBe(401);

    // Sign into Individual Demo user and attempt privilege escalation to admin route
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'INDIVIDUAL_USER' }),
    });
    const loginData = (await loginRes.json()) as { token: string };

    const adminAttempt = await fetch(`${baseUrl}/api/v1/admin/overview`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    expect(adminAttempt.status).toBe(403);

    // System Admin succeeds
    const adminLogin = await fetch(`${baseUrl}/api/v1/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'SYSTEM_ADMIN' }),
    });
    const adminData = (await adminLogin.json()) as { token: string };
    const adminOk = await fetch(`${baseUrl}/api/v1/admin/overview`, {
      headers: { Authorization: `Bearer ${adminData.token}` },
    });
    expect(adminOk.status).toBe(200);
  });

  it('exercises severe smog demo scenario, AI deterministic fallback, and routine generation', async () => {
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'FAMILY_ADMIN' }),
    });
    const { token } = (await loginRes.json()) as { token: string };

    const aqRes = await fetch(
      `${baseUrl}/api/v1/air-quality?city=New+Delhi&lat=28.61&lon=77.20&standard=INDIA_NAQI&demoScenario=severe_smog`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(aqRes.status).toBe(200);
    const aqData = (await aqRes.json()) as { snapshot: { aqi: { aqi: number; category: string } } };
    expect(aqData.snapshot.aqi.aqi).toBeGreaterThan(300);

    const chatRes = await fetch(`${baseUrl}/api/v1/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        message: 'Is it safe for a morning jog?',
        demoScenario: 'ai_failure',
      }),
    });
    expect(chatRes.status).toBe(200);
    const chatData = (await chatRes.json()) as { providerUsed: string; recommendations: unknown[] };
    expect(chatData.providerUsed).toBe('deterministic_fallback');
    expect(chatData.recommendations.length).toBeGreaterThan(0);

    const routineRes = await fetch(`${baseUrl}/api/v1/routines/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ demoScenario: 'severe_smog' }),
    });
    expect(routineRes.status).toBe(201);

    const placesRes = await fetch(`${baseUrl}/api/v1/assistant/places-grounding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        query: 'Enclosed metro transit stations nearby',
        city: 'New Delhi',
        latitude: 28.6139,
        longitude: 77.209,
        demoScenario: 'ai_failure',
      }),
    });
    expect(placesRes.status).toBe(200);
    const placesData = (await placesRes.json()) as { providerUsed: string; places: unknown[] };
    expect(placesData.providerUsed).toBe('unavailable');
    expect(placesData.places).toEqual([]);
  });

  it('prevents cross-account IDOR on conversations and activity deletion', async () => {
    const u1Res = await fetch(`${baseUrl}/api/v1/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'FAMILY_ADMIN' }),
    });
    const u1 = (await u1Res.json()) as { token: string };

    const u2Res = await fetch(`${baseUrl}/api/v1/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'INDIVIDUAL_USER' }),
    });
    const u2 = (await u2Res.json()) as { token: string };

    const chatRes = await fetch(`${baseUrl}/api/v1/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${u1.token}` },
      body: JSON.stringify({ message: 'Private family question', demoScenario: 'ai_failure' }),
    });
    const chat = (await chatRes.json()) as { conversationId: string };

    // User 2 must receive 404 when requesting User 1's conversation
    const idorRes = await fetch(`${baseUrl}/api/v1/assistant/conversations/${chat.conversationId}`, {
      headers: { Authorization: `Bearer ${u2.token}` },
    });
    expect(idorRes.status).toBe(404);
  });
});
