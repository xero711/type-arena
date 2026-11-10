import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { readBearerToken } from './auth/bearer.js';

const appPromise = buildApp();

afterAll(async () => {
  await (await appPromise).close();
});

describe('authentication boundary', () => {
  it('exposes the documented API health endpoint', async () => {
    const response = await (await appPromise).inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', service: 'type-arena-api' });
  });

  it('does not expose retired item and gacha endpoints', async () => {
    const app = await appPromise;
    for (const [method, url] of [['GET', '/api/items'], ['GET', '/api/me/inventory'], ['POST', '/api/me/equipment'], ['POST', '/api/gacha/pull']] as const) {
      expect((await app.inject({ method, url })).statusCode).toBe(404);
    }
  });

  it('accepts only a single bearer token in the authorization header', () => {
    expect(readBearerToken('Bearer signed-token')).toBe('signed-token');
    expect(readBearerToken('Basic dXNlcjpwYXNz')).toBeNull();
    expect(readBearerToken('Bearer token with-spaces')).toBeNull();
  });

  it('rejects profile bootstrap without a Firebase token', async () => {
    const response = await (await appPromise).inject({ method: 'POST', url: '/api/auth/session' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'missing-token' });
  });

  it('requires authentication for character ownership and purchases', async () => {
    const app = await appPromise;
    expect((await app.inject({ method: 'GET', url: '/api/me/characters' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/me/characters', payload: { character: 'long', action: 'unlock' } })).statusCode).toBe(401);
  });

  it('rejects profile reads without a Firebase token', async () => {
    const response = await (await appPromise).inject({ method: 'GET', url: '/api/me' });
    expect(response.statusCode).toBe(401);
  });
});
