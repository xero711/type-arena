import { describe, expect, it } from 'vitest';
import { attackDamage, cpuDamagePerSecond, maxStatLevel, upgradeStat } from '../../web/src/game/character-progress.js';

describe('character growth', () => {
  it('spends one point and increases the selected battle stat', () => {
    const initial = { points: 2, attack: 0, defense: 0 };
    const attack = upgradeStat(initial, 'attack');
    expect(attack).toEqual({ points: 1, attack: 1, defense: 0 });
    expect(attackDamage(attack.attack)).toBeGreaterThan(attackDamage(initial.attack));
    const defense = upgradeStat(attack, 'defense');
    expect(defense.points).toBe(0);
    expect(cpuDamagePerSecond(defense.defense)).toBeLessThan(cpuDamagePerSecond(initial.defense));
  });
  it('does not spend points when unavailable or already at the maximum', () => {
    const noPoints = { points: 0, attack: 0, defense: 0 };
    expect(upgradeStat(noPoints, 'attack')).toEqual(noPoints);
    const maximum = { points: 2, attack: maxStatLevel, defense: 0 };
    expect(upgradeStat(maximum, 'attack')).toEqual(maximum);
  });
});
