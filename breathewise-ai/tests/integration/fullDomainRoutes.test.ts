import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../server';

describe('Full Domain Routes Regression & Coverage', () => {
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

  it('covers impact factors, logging, listing, summary, and deletion', async () => {
    const login = await fetch(`${baseUrl}/api/v1/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'FAMILY_ADMIN' }),
    });
    const { token } = (await login.json()) as { token: string };
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    const factorsRes = await fetch(`${baseUrl}/api/v1/impact/factors`);
    expect(factorsRes.status).toBe(200);
    const { factors } = (await factorsRes.json()) as { factors: Array<{ code: string }> };
    expect(factors.length).toBeGreaterThan(0);

    const logRes = await fetch(`${baseUrl}/api/v1/impact/activities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        factorCode: factors[0].code,
        quantity: 10,
        activityDate: '2026-11-27',
        notes: 'Metro commute',
      }),
    });
    expect(logRes.status).toBe(201);
    const { activity } = (await logRes.json()) as { activity: { id: string } };

    const listRes = await fetch(`${baseUrl}/api/v1/impact/activities`, { headers });
    expect(listRes.status).toBe(200);

    const sumRes = await fetch(`${baseUrl}/api/v1/impact/summary`, { headers });
    expect(sumRes.status).toBe(200);

    const delRes = await fetch(`${baseUrl}/api/v1/impact/activities/${activity.id}`, {
      method: 'DELETE',
      headers,
    });
    expect(delRes.status).toBe(200);
  });

  it('covers households, invitations, community posts, challenges, and achievements', async () => {
    const adminLogin = await fetch(`${baseUrl}/api/v1/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'INDIVIDUAL_USER' }),
    });
    const { token: userToken } = (await adminLogin.json()) as { token: string };
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` };

    const createHouse = await fetch(`${baseUrl}/api/v1/households`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Green Home', city: 'New Delhi', sharedGoal: 'Metro 4 days/week' }),
    });
    expect(createHouse.status).toBe(201);
    const { householdId } = (await createHouse.json()) as { householdId: string };

    const goalRes = await fetch(`${baseUrl}/api/v1/households/${householdId}/goal`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ sharedGoal: 'Zero car idling and metro commute' }),
    });
    expect(goalRes.status).toBe(200);

    const inviteRes = await fetch(`${baseUrl}/api/v1/households/${householdId}/invite`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'invited.member@example.com', role: 'FAMILY_MEMBER' }),
    });
    expect(inviteRes.status).toBe(201);

    const housesRes = await fetch(`${baseUrl}/api/v1/households`, { headers });
    expect(housesRes.status).toBe(200);

    const postRes = await fetch(`${baseUrl}/api/v1/communities/posts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        city: 'New Delhi',
        title: 'Carpool group from Dwarka',
        content: 'Sharing morning metro feeder rides every weekday.',
        category: 'initiative',
      }),
    });
    expect(postRes.status).toBe(201);
    const { postId } = (await postRes.json()) as { postId: string };

    const postsList = await fetch(`${baseUrl}/api/v1/communities/posts?city=New%20Delhi`);
    expect(postsList.status).toBe(200);

    const reportRes = await fetch(`${baseUrl}/api/v1/communities/reports`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ postId, reason: 'Test moderation report workflow' }),
    });
    expect(reportRes.status).toBe(201);

    const chList = await fetch(`${baseUrl}/api/v1/challenges`, { headers });
    expect(chList.status).toBe(200);
    const { challenges } = (await chList.json()) as { challenges: Array<{ id: string }> };
    if (challenges[0]) {
      expect((await fetch(`${baseUrl}/api/v1/challenges/${challenges[0].id}/join`, { method: 'POST', headers })).status).toBe(200);
      expect(
        (
          await fetch(`${baseUrl}/api/v1/challenges/${challenges[0].id}/progress`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ amount: 5 }),
          })
        ).status,
      ).toBe(200);
    }

    expect((await fetch(`${baseUrl}/api/v1/achievements`, { headers })).status).toBe(200);
  });

  it('covers notifications, preferences, resources, feedback, and admin moderation', async () => {
    const adminLogin = await fetch(`${baseUrl}/api/v1/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'SYSTEM_ADMIN' }),
    });
    const { token } = (await adminLogin.json()) as { token: string };
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    expect((await fetch(`${baseUrl}/api/v1/notifications`, { headers })).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/v1/notifications/preferences`, { headers })).status).toBe(200);
    expect(
      (
        await fetch(`${baseUrl}/api/v1/notifications/preferences`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            aqiThreshold: 180,
            quietHoursStart: '22:00',
            quietHoursEnd: '06:30',
            timezone: 'Asia/Kolkata',
            inAppEnabled: true,
            emailEnabled: false,
            browserEnabled: false,
            weeklyReportEnabled: true,
            unsubscribedAll: false,
          }),
        })
      ).status,
    ).toBe(200);

    expect((await fetch(`${baseUrl}/api/v1/resources?q=pm2`)).status).toBe(200);
    expect(
      (
        await fetch(`${baseUrl}/api/v1/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Tester',
            email: 'tester@example.com',
            category: 'general',
            message: 'Great air quality guidance for families.',
          }),
        })
      ).status,
    ).toBe(201);

    expect((await fetch(`${baseUrl}/api/v1/admin/users`, { headers })).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/v1/admin/moderation/reports`, { headers })).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/v1/admin/audit-logs`, { headers })).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/v1/admin/feedback`, { headers })).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/v1/indoor/guidance?demoScenario=severe_smog`, { headers })).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/v1/alternatives?demoScenario=severe_smog`, { headers })).status).toBe(200);
  });
});
