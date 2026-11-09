import { describe, expect, it } from 'vitest';
import { GACHA_COST, gachaCost, rollRarity } from './gacha.js';

describe('server gacha rules', () => {
  it('uses fixed single and discounted ten-pull prices', () => {
    expect(gachaCost(1)).toBe(GACHA_COST.single);
    expect(gachaCost(10)).toBe(GACHA_COST.tenPull);
    expect(gachaCost(2)).toBeNull();
  });

  it('rolls all rarity boundaries without gaps or overlaps', () => {
    expect(rollRarity(0)).toBe('normal');
    expect(rollRarity(6999)).toBe('normal');
    expect(rollRarity(7000)).toBe('rare');
    expect(rollRarity(8999)).toBe('rare');
    expect(rollRarity(9000)).toBe('super_rare');
    expect(rollRarity(9799)).toBe('super_rare');
    expect(rollRarity(9800)).toBe('hyper_rare');
    expect(rollRarity(9979)).toBe('hyper_rare');
    expect(rollRarity(9980)).toBe('ultimate_rare');
    expect(rollRarity(9999)).toBe('ultimate_rare');
  });

  it('rejects rolls outside the configured probability range', () => {
    expect(() => rollRarity(-1)).toThrow(RangeError);
    expect(() => rollRarity(10_000)).toThrow(RangeError);
  });
});
