import { afterAll, describe, expect, it } from 'vitest';
import { itemRarities } from '@type-arena/game-data';
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

  it('serves five armor and weapon choices at each rarity', async () => {
    const response = await (await appPromise).inject({ method: 'GET', url: '/api/items' });
    expect(response.statusCode).toBe(200);
    const catalog = response.json().items as Array<{ type: string; rarity: string }>;
    expect(catalog).toHaveLength(50);
    for (const rarity of itemRarities) {
      expect(catalog.filter((item) => item.type === 'armor' && item.rarity === rarity)).toHaveLength(5);
      expect(catalog.filter((item) => item.type === 'weapon' && item.rarity === rarity)).toHaveLength(5);
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

  it('rejects profile reads without a Firebase token', async () => {
    const response = await (await appPromise).inject({ method: 'GET', url: '/api/me' });
    expect(response.statusCode).toBe(401);
  });
});
