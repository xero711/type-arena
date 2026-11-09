import { describe, expect, it } from 'vitest';
import { GACHA_COST, gachaCost, rollRarity } from './gacha.js';

describe('server gacha rules', () => {
  it('charges 300 coins for every pull', () => {
    expect(GACHA_COST.single).toBe(300);
    expect(GACHA_COST.tenPull).toBe(3000);
    expect(gachaCost(1)).toBe(300);
    expect(gachaCost(10)).toBe(3000);
    expect(gachaCost(2)).toBeNull();
  });

  it('rolls all rarity boundaries without gaps or overlaps', () => {
    expect(rollRarity(0)).toBe('normal');
    expect(rollRarity(5499)).toBe('normal');
    expect(rollRarity(5500)).toBe('rare');
    expect(rollRarity(8299)).toBe('rare');
    expect(rollRarity(8300)).toBe('super_rare');
    expect(rollRarity(9499)).toBe('super_rare');
    expect(rollRarity(9500)).toBe('hyper_rare');
    expect(rollRarity(9899)).toBe('hyper_rare');
    expect(rollRarity(9900)).toBe('ultimate_rare');
    expect(rollRarity(9999)).toBe('ultimate_rare');
  });

  it('rejects rolls outside the configured probability range', () => {
    expect(() => rollRarity(-1)).toThrow(RangeError);
    expect(() => rollRarity(10_000)).toThrow(RangeError);
  });
});
