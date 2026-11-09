import { describe, expect, it } from 'vitest';
import { armorItems, itemRarities, weaponItems } from '@type-arena/game-data';

describe('equipment catalog', () => {
  it('contains five armor and five weapons for every rarity', () => {
    expect(armorItems).toHaveLength(25);
    expect(weaponItems).toHaveLength(25);
    for (const rarity of itemRarities) {
      expect(armorItems.filter((item) => item.rarity === rarity)).toHaveLength(5);
      expect(weaponItems.filter((item) => item.rarity === rarity)).toHaveLength(5);
    }
  });

  it('keeps item codes unique and grants stats to the matching slot', () => {
    const allItems = [...armorItems, ...weaponItems];
    expect(new Set(allItems.map((item) => item.code)).size).toBe(50);
    expect(armorItems.every((item) => item.type === 'armor' && item.defense > 0 && item.attack === 0)).toBe(true);
    expect(weaponItems.every((item) => item.type === 'weapon' && item.attack > 0 && item.defense === 0)).toBe(true);
    expect(new Set(weaponItems.map((item) => item.weaponStyle))).toEqual(new Set(['sword', 'dagger', 'hammer', 'staff', 'bow']));
  });
});
