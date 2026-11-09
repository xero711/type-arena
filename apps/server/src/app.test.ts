import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { readBearerToken } from './auth/bearer.js';

const appPromise = buildApp();

afterAll(async () => {
  await (await appPromise).close();
});

describe('authentication boundary', () => {
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
