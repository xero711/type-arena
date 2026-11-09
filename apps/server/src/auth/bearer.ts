import type { DecodedIdToken } from 'firebase-admin/auth';
import { firebaseAuth } from './firebase.js';

export type AuthenticationResult =
  | { ok: true; identity: DecodedIdToken }
  | { ok: false; status: 401 | 503; code: 'missing-token' | 'invalid-token' | 'auth-not-configured' };

export function readBearerToken(header: string | undefined): string | null {
  const match = header?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

export async function authenticateBearer(header: string | undefined): Promise<AuthenticationResult> {
  const token = readBearerToken(header);
  if (!token) return { ok: false, status: 401, code: 'missing-token' };
  if (!firebaseAuth) return { ok: false, status: 503, code: 'auth-not-configured' };
  try {
    const identity = await firebaseAuth.verifyIdToken(token);
    return { ok: true, identity };
  } catch {
    return { ok: false, status: 401, code: 'invalid-token' };
  }
}
