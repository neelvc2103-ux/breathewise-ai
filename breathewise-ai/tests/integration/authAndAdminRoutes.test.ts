import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../server';

describe('Auth Lifecycle, Profile, Sessions & Admin Moderation Routes', () => {
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

  it('exercises full auth lifecycle: register, login, sessions, password change, reset, profile, and account deletion', async () => {
    // Register
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Rohan Sharma',
        email: 'rohan.lifecycle@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
        acceptedTerms: true,
      }),
    });
    expect(regRes.status).toBe(201);

    // Duplicate email returns 409
    const dupRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Rohan Sharma',
        email: 'rohan.lifecycle@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
        acceptedTerms: true,
      }),
    });
    expect(dupRes.status).toBe(409);

    // Invalid login returns 401
    const badLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rohan.lifecycle@example.com', password: 'WrongPassword1', rememberMe: false }),
    });
    expect(badLogin.status).toBe(401);

    // Valid login
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rohan.lifecycle@example.com', password: 'Password123', rememberMe: true }),
    });
    expect(loginRes.status).toBe(200);
    const { token } = (await loginRes.json()) as { token: string };
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    // Sessions list & nonexistent revoke 404
    const sessRes = await fetch(`${baseUrl}/api/v1/auth/sessions`, { headers });
    expect(sessRes.status).toBe(200);
    const { sessions } = (await sessRes.json()) as { sessions: Array<{ id: string; isCurrent: boolean }> };
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect((await fetch(`${baseUrl}/api/v1/auth/sessions/nonexistent`, { method: 'DELETE', headers })).status).toBe(404);
    const otherSession = sessions.find((s) => !s.isCurrent);
    if (otherSession) {
      expect((await fetch(`${baseUrl}/api/v1/auth/sessions/${otherSession.id}`, { method: 'DELETE', headers })).status).toBe(200);
    }

    // Change password: wrong current -> 400, valid -> 200
    expect(
      (
        await fetch(`${baseUrl}/api/v1/auth/change-password`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ currentPassword: 'WrongPassword1', newPassword: 'NewPassword123', confirmNewPassword: 'NewPassword123' }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(`${baseUrl}/api/v1/auth/change-password`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ currentPassword: 'Password123', newPassword: 'NewPassword123', confirmNewPassword: 'NewPassword123' }),
        })
      ).status,
    ).toBe(200);

    // Profile GET & PUT
    const profGet = await fetch(`${baseUrl}/api/v1/profile`, { headers });
    expect(profGet.status).toBe(200);
    const profPut = await fetch(`${baseUrl}/api/v1/profile`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        country: 'India',
        stateRegion: 'Maharashtra',
        city: 'Pune',
        postalCode: '411001',
        latitude: 18.5204,
        longitude: 73.8567,
        aqiStandard: 'INDIA_NAQI',
        workMode: 'office',
        commuteDistanceKm: 10,
        primaryTransport: 'public_transit',
        outdoorActivity: 'Evening walk',
        exercisePreference: 'Yoga',
        cookingFuel: 'lpg_piped_gas',
        householdSize: 3,
        publicTransitAvailable: true,
        childrenCount: 0,
        adultsCount: 2,
        elderlyCount: 1,
        hasSensitiveMembers: true,
        hasAirPurifier: false,
        ventilationType: 'natural_windows',
        hasBalconyWindows: true,
        indoorCookingVentilation: 'exhaust_fan',
        hasIndoorSensor: false,
        preferredLanguage: 'hi',
        sustainabilityGoal: 'Metro commute',
        dailyScheduleSummary: '07:00 wake, 09:30 work',
        budgetLevel: 'low_cost',
        consentWithdrawn: false,
      }),
    });
    expect(profPut.status).toBe(200);

    // Forgot password + reset password
    const forgotRes = await fetch(`${baseUrl}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rohan.lifecycle@example.com' }),
    });
    expect(forgotRes.status).toBe(200);
    const forgotJson = (await forgotRes.json()) as { resetPreviewToken?: string };
    if (forgotJson.resetPreviewToken) {
      expect(
        (
          await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: forgotJson.resetPreviewToken, password: 'ResetPassword123', confirmPassword: 'ResetPassword123' }),
          })
        ).status,
      ).toBe(200);
    }

    // Re-login after reset & delete account
    const reLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rohan.lifecycle@example.com', password: 'ResetPassword123' }),
    });
    expect(reLogin.status).toBe(200);
    const { token: freshToken } = (await reLogin.json()) as { token: string };
    expect(
      (
        await fetch(`${baseUrl}/api/v1/auth/account`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${freshToken}` },
        })
      ).status,
    ).toBe(200);
  });

  it('exercises admin resource creation, role update, and moderation resolution', async () => {
    const adminLogin = await fetch(`${baseUrl}/api/v1/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'SYSTEM_ADMIN' }),
    });
    const { token } = (await adminLogin.json()) as { token: string };
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    // Valid admin resource creation
    const resCreate = await fetch(`${baseUrl}/api/v1/admin/resources`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'HEPA Filter Maintenance Guide',
        category: 'Indoor Air',
        summary: 'How to maintain HEPA filters during winter smog.',
        content: 'Check pre-filters weekly during severe smog episodes and replace HEPA cartridges per manufacturer schedule.',
        sourceOrganization: 'US EPA',
        sourceUrl: 'https://www.epa.gov/indoor-air-quality-iaq',
      }),
    });
    expect(resCreate.status).toBe(201);

    // Create post, report it, and resolve report via moderation endpoint
    const postRes = await fetch(`${baseUrl}/api/v1/communities/posts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        city: 'New Delhi',
        title: 'Moderation Test Post',
        content: 'Testing community post creation and moderation resolution.',
        category: 'discussion',
      }),
    });
    const { postId } = (await postRes.json()) as { postId: string };
    await fetch(`${baseUrl}/api/v1/communities/reports`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ postId, reason: 'Needs moderator review' }),
    });
    const reportsRes = await fetch(`${baseUrl}/api/v1/admin/moderation/reports`, { headers });
    const { reports } = (await reportsRes.json()) as { reports: Array<{ id: string; post_id: string }> };
    const targetReport = reports.find((r) => r.post_id === postId);
    expect(targetReport).toBeTruthy();

    const resolveRes = await fetch(`${baseUrl}/api/v1/admin/moderation/reports/${targetReport!.id}/resolve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ removePost: true }),
    });
    expect(resolveRes.status).toBe(200);
    expect(
      (
        await fetch(`${baseUrl}/api/v1/admin/moderation/reports/missing-id/resolve`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ removePost: false }),
        })
      ).status,
    ).toBe(404);
  });
});
