import { afterEach, describe, expect, it, vi } from 'vitest';
import { attackDamage, cpuDamagePerSecond, maxStatLevel, readProgress, upgradeStat } from '../../web/src/game/character-progress.js';

describe('character growth', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('spends one point and increases the selected battle stat', () => {
    const initial = { points: 2, attack: 0, defense: 0 };
    const attack = upgradeStat(initial, 'attack');
    expect(attack).toEqual({ points: 1, attack: 1, defense: 0 });
    expect(attackDamage(attack.attack)).toBeGreaterThan(attackDamage(initial.attack));
    const defense = upgradeStat(attack, 'defense');
    expect(defense.points).toBe(0);
    expect(cpuDamagePerSecond(defense.defense)).toBeLessThan(cpuDamagePerSecond(initial.defense));
  });
  it('preserves existing CPU progress when adding magic levels', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ points: 7, attack: 3, defense: 2 }) });
    expect(readProgress()).toEqual({ points: 7, attack: 3, defense: 2, magicAttack: 0, magicDefense: 0 });
    const upgraded = upgradeStat(readProgress(), 'magicAttack');
    expect(upgraded).toMatchObject({ points: 6, attack: 3, defense: 2, magicAttack: 1, magicDefense: 0 });
  });

  it('does not spend points when unavailable or already at the maximum', () => {
    const noPoints = { points: 0, attack: 0, defense: 0 };
    expect(upgradeStat(noPoints, 'attack')).toEqual(noPoints);
    const maximum = { points: 2, attack: maxStatLevel, defense: 0 };
    expect(upgradeStat(maximum, 'attack')).toEqual(maximum);
  });
});
