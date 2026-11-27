import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../server';

describe('API Domain Validation, Household Flow & Error Handling', () => {
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

  it('returns healthy status and OpenAPI spec', async () => {
    const health = await fetch(`${baseUrl}/api/v1/health`);
    expect(health.status).toBe(200);
    const hJson = (await health.json()) as { status: string };
    expect(hJson.status).toBe('healthy');

    const docs = await fetch(`${baseUrl}/api/v1/docs/openapi.json`);
    expect(docs.status).toBe(200);

    const unknown = await fetch(`${baseUrl}/api/v1/does-not-exist`);
    expect(unknown.status).toBe(404);
  });

  it('rejects out-of-range coordinates across environmental endpoints', async () => {
    const demo = await fetch(`${baseUrl}/api/v1/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'INDIVIDUAL_USER' }),
    });
    const { token } = (await demo.json()) as { token: string };

    const aqiRes = await fetch(`${baseUrl}/api/v1/air-quality?lat=120&lon=77`);
    expect(aqiRes.status).toBe(400);

    const indoorRes = await fetch(`${baseUrl}/api/v1/indoor/guidance?lat=-95&lon=77`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(indoorRes.status).toBe(400);

    const altRes = await fetch(`${baseUrl}/api/v1/alternatives?lat=28&lon=220`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(altRes.status).toBe(400);
  });

  it('enforces household invitation ownership and admin validation', async () => {
    const adminLogin = await fetch(`${baseUrl}/api/v1/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'SYSTEM_ADMIN' }),
    });
    const { token: adminToken } = (await adminLogin.json()) as { token: string };

    const badUrlRes = await fetch(`${baseUrl}/api/v1/admin/resources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Unsafe Resource Test',
        content: 'Testing URL scheme validation on admin resource creation.',
        sourceUrl: 'javascript:alert(1)',
      }),
    });
    expect(badUrlRes.status).toBe(400);

    const missingUserRole = await fetch(`${baseUrl}/api/v1/admin/users/nonexistent-id/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ role: 'FAMILY_MEMBER' }),
    });
    expect(missingUserRole.status).toBe(404);
  });
});
