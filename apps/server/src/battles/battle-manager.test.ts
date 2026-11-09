import { describe, expect, it } from 'vitest';
import { prompts } from '@type-arena/game-data';
import { BattleManager, type BattleOutcome, type BattlePlayer } from './battle-manager.js';

const players: [BattlePlayer, BattlePlayer] = [
  { firebaseUid: 'uid-a', userId: 'a', socketId: 'socket-a', displayName: 'A', rating: 1000 },
  { firebaseUid: 'uid-b', userId: 'b', socketId: 'socket-b', displayName: 'B', rating: 1000 },
];

describe('server-authoritative battle', () => {
  it('rejects non-players, incorrect prompts, invalid answers, and impossible speeds', () => {
    const battle = new BattleManager();
    battle.create('match-1', players, 1000, 3000);
    const view = battle.snapshot('match-1', 'uid-a')!;
    const answer = prompts.find((prompt) => prompt.id === view.prompt.id)!.romaji[0];
    expect(battle.submit('match-1', 'intruder', view.prompt.id, 10_000)).toMatchObject({ ok: false, code: 'not-a-player' });
    expect(battle.submit('match-1', 'uid-a', 'wrong-id', 10_000)).toMatchObject({ ok: false, code: 'wrong-prompt' });
    expect(battle.typeKey('match-1', 'uid-a', view.prompt.id, '?', 4000)).toMatchObject({ ok: false, code: 'invalid-key' });
    expect(battle.typeKey('match-1', 'uid-a', view.prompt.id, 'x', 4000)).toMatchObject({ ok: true, mistakes: 1, typed: '' });
    [...answer].forEach((char, index) => battle.typeKey('match-1', 'uid-a', view.prompt.id, char, 4020 + index * 20));
    expect(battle.submit('match-1', 'uid-a', view.prompt.id, 4000 + answer.length * 40 - 1)).toMatchObject({ ok: false, code: 'too-fast' });
    expect(battle.submit('match-1', 'uid-a', view.prompt.id, 4000 + answer.length * 40)).toMatchObject({ ok: true });
  });

  it('calculates damage on the server and ends the match when HP reaches zero', () => {
    const battle = new BattleManager();
    battle.create('match-2', players, 0, 0);
    let now = 10_000;
    let outcome: BattleOutcome | null = null;
    for (let count = 0; count < 5 && !outcome; count += 1) {
      const view = battle.snapshot('match-2', 'uid-a')!;
      const answer = prompts.find((prompt) => prompt.id === view.prompt.id)!.romaji[0];
      [...answer].forEach((char, index) => battle.typeKey('match-2', 'uid-a', view.prompt.id, char, now + index * 20));
      const submitted = battle.submit('match-2', 'uid-a', view.prompt.id, now + 1000);
      expect(submitted.ok).toBe(true);
      if (submitted.ok) { expect(submitted.damage).toBeGreaterThan(0); outcome = submitted.outcome; }
      now += 1000;
    }
    expect(outcome).toMatchObject({ winnerUid: 'uid-a', loserUid: 'uid-b', reason: 'knockout' });
    expect(outcome?.players[0]).toMatchObject({ accuracy: 100, maxCombo: expect.any(Number) });
    expect(outcome?.players[0].maxCombo).toBeGreaterThan(0);
    expect(battle.submit('match-2', 'uid-a', 'p1', now)).toMatchObject({ ok: false, code: 'battle-finished' });
  });

  it('includes the players partial input in a resumable server snapshot', () => {
    const battle = new BattleManager();
    battle.create('match-resume', players, 0, 0);
    const initial = battle.snapshot('match-resume', 'uid-a')!;
    const nextKey = prompts.find((prompt) => prompt.id === initial.prompt.id)!.romaji[0][0];
    battle.typeKey('match-resume', 'uid-a', initial.prompt.id, nextKey, 20);
    expect(battle.snapshot('match-resume', 'uid-a')).toMatchObject({
      typed: nextKey,
      accuracy: 100,
      mistakes: 0,
      maxCombo: 1,
    });
  });

  it('decides a 90 second style timeout from remaining HP', () => {
    const battle = new BattleManager();
    battle.create('match-timeout', players, 0, 0);
    const view = battle.snapshot('match-timeout', 'uid-a')!;
    const answer = prompts.find((prompt) => prompt.id === view.prompt.id)!.romaji[0];
    [...answer].forEach((char, index) => battle.typeKey('match-timeout', 'uid-a', view.prompt.id, char, 20 + index * 20));
    battle.submit('match-timeout', 'uid-a', view.prompt.id, Math.max(answer.length * 40, answer.length * 20) + 100);
    expect(battle.timeout('match-timeout', 89_999)).toBeNull();
    expect(battle.timeout('match-timeout', 90_000)).toMatchObject({ winnerUid: 'uid-a', loserUid: 'uid-b', reason: 'timeout' });
  });

  it('awards the connected player a forfeit win when an opponent disconnects', () => {
    const battle = new BattleManager();
    battle.create('match-3', players, 0, 0);
    expect(battle.forfeit('match-3', 'uid-b', 5000)).toMatchObject({ winnerUid: 'uid-a', loserUid: 'uid-b', reason: 'disconnect' });
    expect(battle.matchForUser('uid-a')).toBeNull();
  });
});
