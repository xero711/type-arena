import { describe, expect, it } from 'vitest';
import { calculateRatingChanges, MATCH_REWARD } from './result-service.js';

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
