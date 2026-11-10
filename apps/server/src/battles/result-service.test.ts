import { describe, expect, it } from 'vitest';
import { calculateRatingChanges, calculateSettlement, MATCH_REWARD } from './result-service.js';
import { rankName } from '@type-arena/game-data';
import type { BattleOutcome } from './battle-manager.js';

describe('ranked match settlement rules', () => {
  it('uses zero-sum Elo changes and rewards the expected winner', () => {
    const [winner, loser] = calculateRatingChanges([1200, 1200], 0);
    expect(winner).toBe(16);
    expect(loser).toBe(-16);
    expect(winner + loser).toBe(0);
    expect(MATCH_REWARD).toMatchObject({ completion: 50, win: 30, accuracy: 10, accuracyThreshold: 95, combo: 10, comboThreshold: 10 });
  });

  it('gives a larger gain for beating a higher-rated player', () => {
    const [favoredGain] = calculateRatingChanges([1400, 1000], 0);
    const [upsetGain] = calculateRatingChanges([1000, 1400], 0);
    expect(upsetGain).toBeGreaterThan(favoredGain);
  });
});

describe('rank thresholds and placements', () => {
  it.each([
    [0, 'ルーキー'], [249, 'ルーキー'], [250, 'ブロンズ'], [499, 'ブロンズ'],
    [500, 'シルバー'], [749, 'シルバー'], [750, 'ゴールド'], [999, 'ゴールド'],
    [1000, 'プラチナ'], [1249, 'プラチナ'], [1250, 'プロ'], [1499, 'プロ'],
    [1500, 'タイプマスター'], [1749, 'タイプマスター'], [1750, 'タイプキング #42'],
  ])('assigns rating %i to %s', (rating, title) => {
    expect(rankName(rating, 5, 42)).toBe(title);
  });

  it('hides the rank until the fifth placement and handles draws by opponent rating', () => {
    expect(rankName(1750, 4, 1)).toBe('未認定');
    expect(calculateRatingChanges([500, 700], null)[0]).toBeGreaterThan(0);
    expect(calculateRatingChanges([700, 500], null)[0]).toBeLessThan(0);
  });

  it('never lets a ranked loss reduce rating below zero', () => {
    const outcome: BattleOutcome = {
      matchId: 'floor', winnerUid: 'two', loserUid: 'one', reason: 'knockout', finishedAt: 0,
      players: [
        { firebaseUid: 'one', userId: 'one', rating: 0, wpm: 0, accuracy: 0, characters: 0, mistakes: 0, maxCombo: 0 },
        { firebaseUid: 'two', userId: 'two', rating: 0, wpm: 0, accuracy: 0, characters: 0, mistakes: 0, maxCombo: 0 },
      ],
    };
    expect(calculateSettlement(outcome, [0, 0]).ratings).toEqual([0, 16]);
    expect(calculateSettlement(outcome, [0, 0]).ratingChanges).toEqual([0, 16]);
  });
});

describe('private match settlement rules', () => {
  it('keeps history while changing neither rating nor wallet rewards', () => {
    const outcome: BattleOutcome = {
      matchId: 'private-match',
      winnerUid: 'uid-one',
      loserUid: 'uid-two',
      reason: 'knockout',
      finishedAt: 10_000,
      players: [
        { firebaseUid: 'uid-one', userId: 'one', rating: 1250, wpm: 80, accuracy: 100, characters: 100, mistakes: 0, maxCombo: 20 },
        { firebaseUid: 'uid-two', userId: 'two', rating: 1150, wpm: 70, accuracy: 99, characters: 90, mistakes: 1, maxCombo: 12 },
      ],
    };
    expect(calculateSettlement(outcome, [1250, 1150], 'private')).toEqual({
      ratingChanges: [0, 0],
      coinRewards: [0, 0],
      ratings: [1250, 1150],
    });
  });

  it('gives both players only completion and performance coins for a tied timeout', () => {
    const outcome: BattleOutcome = {
      matchId: 'timeout-draw',
      winnerUid: null,
      loserUid: null,
      reason: 'timeout',
      finishedAt: 90_000,
      players: [
        { firebaseUid: 'uid-one', userId: 'one', rating: 1200, wpm: 80, accuracy: 95, characters: 100, mistakes: 5, maxCombo: 10 },
        { firebaseUid: 'uid-two', userId: 'two', rating: 1200, wpm: 70, accuracy: 94, characters: 90, mistakes: 6, maxCombo: 9 },
      ],
    };
    expect(calculateSettlement(outcome, [1200, 1200], 'ranked')).toEqual({
      ratingChanges: [0, 0],
      coinRewards: [70, 50],
      ratings: [1200, 1200],
    });
  });
});
