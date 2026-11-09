import { randomInt, randomUUID } from 'node:crypto';
import type { QueueEntry } from './matchmaker.js';

export const PRIVATE_MATCH_TTL_MS = 10 * 60 * 1000;

export type PrivateMatchInvite = {
  code: string;
  host: QueueEntry;
  createdAt: number;
  expiresAt: number;
};

/** 一時的な4桁招待コードを管理し、切断・期限切れで古い招待を破棄する。 */
export class PrivateMatchmaker {
  private readonly invites = new Map<string, PrivateMatchInvite>();
  private readonly codeByHost = new Map<string, string>();

  create(host: QueueEntry, now = Date.now()): PrivateMatchInvite {
    this.expire(now);
    this.removeHost(host.firebaseUid);

    let code = '';
    do { code = String(randomInt(10_000)).padStart(4, '0'); } while (this.invites.has(code));

    const invite = { code, host, createdAt: now, expiresAt: now + PRIVATE_MATCH_TTL_MS };
    this.invites.set(code, invite);
    this.codeByHost.set(host.firebaseUid, code);
    return invite;
  }

  get(code: string, now = Date.now()): PrivateMatchInvite | null {
    this.expire(now);
    return this.invites.get(code.toUpperCase()) ?? null;
  }

  consume(code: string, now = Date.now()): PrivateMatchInvite | null {
    const invite = this.get(code, now);
    if (!invite) return null;
    this.removeHost(invite.host.firebaseUid);
    return invite;
  }

  removeHost(firebaseUid: string): boolean {
    const code = this.codeByHost.get(firebaseUid);
    if (!code) return false;
    this.codeByHost.delete(firebaseUid);
    return this.invites.delete(code);
  }

  expire(now = Date.now()): number {
    let removed = 0;
    for (const invite of this.invites.values()) {
      if (invite.expiresAt > now) continue;
      this.removeHost(invite.host.firebaseUid);
      removed += 1;
    }
    return removed;
  }

  get size(): number { return this.invites.size; }
}

export function createPrivateMatchId(): string { return randomUUID(); }
