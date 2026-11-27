import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../server';

describe('Critical Security Branches: Places Grounding, 403 Consent & 429 Rate Limits', () => {
  let baseUrl = '';
  let server: ReturnType<ReturnType<typeof createApp>['app']['listen']>;

  beforeAll(async () => {
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
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('exercises /assistant/places-grounding and enforces 403 when consent is withdrawn', async () => {
    const login = await fetch(`${baseUrl}/api/v1/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'INDIVIDUAL_USER' }),
    });
    const { token } = (await login.json()) as { token: string };
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    // Valid places-grounding request (fallback when GEMINI_API_KEY is unset)
    const placesRes = await fetch(`${baseUrl}/api/v1/assistant/places-grounding`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: 'nearest metro station',
        city: 'New Delhi',
        latitude: 28.6139,
        longitude: 77.209,
        demoScenario: 'severe_smog',
      }),
    });
    expect(placesRes.status).toBe(200);

    // Invalid places-grounding request returns 400
    const badPlaces = await fetch(`${baseUrl}/api/v1/assistant/places-grounding`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: '' }),
    });
    expect(badPlaces.status).toBe(400);

    // Withdraw AI personalization consent -> 403 on chat and places-grounding
    const profRes = await fetch(`${baseUrl}/api/v1/profile`, { headers });
    const { profile } = (await profRes.json()) as { profile: Record<string, unknown> };
    const withdrawRes = await fetch(`${baseUrl}/api/v1/profile`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ ...profile, consentWithdrawn: true }),
    });
    expect(withdrawRes.status).toBe(200);

    const blockedChat = await fetch(`${baseUrl}/api/v1/assistant/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: 'Is air safe?' }),
    });
    expect(blockedChat.status).toBe(403);

    const blockedPlaces = await fetch(`${baseUrl}/api/v1/assistant/places-grounding`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: 'metro station',
        city: 'New Delhi',
        latitude: 28.6139,
        longitude: 77.209,
      }),
    });
    expect(blockedPlaces.status).toBe(403);
  });

  it('enforces 429 rate limits on register, forgot-password, and reset-password', async () => {
    // 1. Register rate limit (12 attempts allowed per IP)
    let regStatus = 0;
    for (let i = 0; i < 13; i++) {
      const r = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'X', email: 'bad', password: '123', confirmPassword: '123', acceptedTerms: true }),
      });
      regStatus = r.status;
    }
    expect(regStatus).toBe(429);

    // 2. Forgot-password rate limit
    let forgotStatus = 0;
    for (let i = 0; i < 13; i++) {
      const r = await fetch(`${baseUrl}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nobody@example.com' }),
      });
      forgotStatus = r.status;
    }
    expect(forgotStatus).toBe(429);

    // 3. Reset-password rate limit
    let resetStatus = 0;
    for (let i = 0; i < 13; i++) {
      const r = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'invalid', password: 'short', confirmPassword: 'short' }),
      });
      resetStatus = r.status;
    }
    expect(resetStatus).toBe(429);
  });
});
