import { randomInt } from 'node:crypto';
import type { ItemRarity } from '@type-arena/game-data';

export const GACHA_COST = { single: 100, tenPull: 900 } as const;

export const GACHA_ODDS: ReadonlyArray<{ rarity: ItemRarity; weight: number }> = [
  { rarity: 'normal', weight: 7000 },
  { rarity: 'rare', weight: 2000 },
  { rarity: 'super_rare', weight: 800 },
  { rarity: 'hyper_rare', weight: 180 },
  { rarity: 'ultimate_rare', weight: 20 },
];

const totalWeight = GACHA_ODDS.reduce((total, entry) => total + entry.weight, 0);

export function gachaCost(count: number): number | null {
  if (count === 1) return GACHA_COST.single;
  if (count === 10) return GACHA_COST.tenPull;
  return null;
}

export function rollRarity(roll = randomInt(totalWeight)): ItemRarity {
  if (!Number.isInteger(roll) || roll < 0 || roll >= totalWeight) throw new RangeError('gacha roll is outside its range');
  let boundary = 0;
  for (const entry of GACHA_ODDS) {
    boundary += entry.weight;
    if (roll < boundary) return entry.rarity;
  }
  throw new RangeError('gacha odds do not cover the roll');
}
