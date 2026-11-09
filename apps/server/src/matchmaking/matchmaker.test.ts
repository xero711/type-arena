import { describe, expect, it } from 'vitest';
import { Matchmaker, type QueueEntry } from './matchmaker.js';

function entry(uid: string, rating: number, socketId = `socket-${uid}`): QueueEntry {
  return { firebaseUid: uid, userId: `user-${uid}`, socketId, displayName: uid, rating, queuedAt: 0 };
}

describe('Matchmaker', () => {
  it('pairs players inside the initial rating window and removes both from queue', () => {
    const queue = new Matchmaker();
    expect(queue.enqueue(entry('a', 1000), 1).kind).toBe('queued');
    const result = queue.enqueue(entry('b', 1120), 2);
    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') expect(result.ticket.players.map((player) => player.firebaseUid)).toEqual(['a', 'b']);
    expect(queue.size).toBe(0);
  });

  it('does not match the same identity against itself', () => {
    const queue = new Matchmaker();
    queue.enqueue(entry('a', 1000), 1);
    expect(queue.enqueue(entry('a', 1000, 'socket-a-2'), 2).kind).toBe('already-queued');
    expect(queue.size).toBe(1);
  });

  it('widens rating tolerance for players who have waited longer', () => {
    const queue = new Matchmaker();
    queue.enqueue(entry('a', 1000), 1000);
    expect(queue.enqueue(entry('b', 1700), 20_000).kind).toBe('queued');
    const result = queue.enqueue(entry('c', 1250), 22_000);
    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') expect(result.ticket.players.map((player) => player.firebaseUid)).toEqual(['a', 'c']);
  });

  it('removes disconnected or cancelled queue entries', () => {
    const queue = new Matchmaker();
    queue.enqueue(entry('a', 1000), 1);
    expect(queue.cancelSocket('socket-a')).toBe(true);
    expect(queue.cancelSocket('socket-a')).toBe(false);
    queue.enqueue(entry('b', 1000), 2);
    expect(queue.removeUser('b')).toBe(true);
    expect(queue.size).toBe(0);
  });
});
