import { describe, expect, it } from 'vitest';
import { PrivateMatchmaker, PRIVATE_MATCH_TTL_MS } from './private-matches.js';
import type { QueueEntry } from './matchmaker.js';

const host: QueueEntry = {
  firebaseUid: 'firebase-host',
  userId: 'user-host',
  socketId: 'socket-host',
  displayName: '勇者',
  rating: 1200,
  queuedAt: 1_000,
};

describe('private match invites', () => {
  it('creates one six character unambiguous alphanumeric code per host', () => {
    const matchmaker = new PrivateMatchmaker();
    const invite = matchmaker.create(host, 1_000);
    expect(invite.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(invite.expiresAt).toBe(1_000 + PRIVATE_MATCH_TTL_MS);
    expect(matchmaker.get(invite.code.toLowerCase(), 1_001)).toEqual(invite);
    expect(matchmaker.size).toBe(1);
  });

  it('replaces and consumes invitations once', () => {
    const matchmaker = new PrivateMatchmaker();
    const first = matchmaker.create(host, 1_000);
    const second = matchmaker.create(host, 2_000);
    expect(matchmaker.get(first.code, 2_001)).toBeNull();
    expect(matchmaker.consume(second.code, 2_001)).toEqual(second);
    expect(matchmaker.consume(second.code, 2_002)).toBeNull();
    expect(matchmaker.size).toBe(0);
  });

  it('expires an invite at its deadline and supports host cleanup', () => {
    const matchmaker = new PrivateMatchmaker();
    const expired = matchmaker.create(host, 1_000);
    expect(matchmaker.get(expired.code, expired.expiresAt)).toBeNull();
    const current = matchmaker.create(host, 10_000);
    expect(matchmaker.removeHost(host.firebaseUid)).toBe(true);
    expect(matchmaker.get(current.code, 10_001)).toBeNull();
    expect(matchmaker.removeHost(host.firebaseUid)).toBe(false);
  });
});
