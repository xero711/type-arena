import { randomUUID } from 'node:crypto';

export type QueueEntry = {
  firebaseUid: string;
  userId: string;
  socketId: string;
  displayName: string;
  rating: number;
  queuedAt: number;
};

export type MatchTicket = {
  id: string;
  players: [QueueEntry, QueueEntry];
  createdAt: number;
};

export type EnqueueResult = { kind: 'queued' } | { kind: 'matched'; ticket: MatchTicket } | { kind: 'already-queued' };

/** インメモリー待機列。対戦結果やレートはこのクラスで変更しない。 */
export class Matchmaker {
  private readonly waiting = new Map<string, QueueEntry>();
  private readonly socketOwners = new Map<string, string>();

  enqueue(entry: QueueEntry, now = Date.now()): EnqueueResult {
    if (this.waiting.has(entry.firebaseUid) || this.socketOwners.has(entry.socketId)) return { kind: 'already-queued' };
    const waitingEntry = { ...entry, queuedAt: now };
    const candidate = [...this.waiting.values()]
      .filter((other) => other.firebaseUid !== entry.firebaseUid && Math.abs(other.rating - entry.rating) <= this.ratingWindow(other, now))
      .sort((left, right) => Math.abs(left.rating - entry.rating) - Math.abs(right.rating - entry.rating) || left.queuedAt - right.queuedAt)[0];

    if (!candidate) {
      this.waiting.set(entry.firebaseUid, waitingEntry);
      this.socketOwners.set(entry.socketId, entry.firebaseUid);
      return { kind: 'queued' };
    }

    this.waiting.delete(candidate.firebaseUid);
    this.socketOwners.delete(candidate.socketId);
    return {
      kind: 'matched',
      ticket: { id: randomUUID(), players: [candidate, waitingEntry], createdAt: now },
    };
  }

  cancelSocket(socketId: string): boolean {
    const firebaseUid = this.socketOwners.get(socketId);
    if (!firebaseUid) return false;
    this.socketOwners.delete(socketId);
    return this.waiting.delete(firebaseUid);
  }

  removeUser(firebaseUid: string): boolean {
    const entry = this.waiting.get(firebaseUid);
    if (!entry) return false;
    this.waiting.delete(firebaseUid);
    this.socketOwners.delete(entry.socketId);
    return true;
  }

  get size(): number { return this.waiting.size; }

  private ratingWindow(entry: QueueEntry, now: number): number {
    const waitedSeconds = Math.max(0, (now - entry.queuedAt) / 1000);
    return Math.min(600, 150 + Math.floor(waitedSeconds / 10) * 50);
  }
}
