import { randomInt } from 'node:crypto';
import type { ItemRarity } from '@type-arena/game-data';

export const GACHA_COST = { single: 300, tenPull: 3000 } as const;

export type GachaItemResult = {
  id: string;
  code: string;
  name: string;
  rarity: ItemRarity;
  type: string;
  attack: number;
  defense: number;
};

export type GachaResponse =
  | { ok: true; coins: number; items: GachaItemResult[]; count: 1 | 10; cost: number }
  | { ok: false; error: 'insufficient-coins'; coins: number };

export const GACHA_ODDS: ReadonlyArray<{ rarity: ItemRarity; weight: number }> = [
  { rarity: 'normal', weight: 5500 },
  { rarity: 'rare', weight: 2800 },
  { rarity: 'super_rare', weight: 1200 },
  { rarity: 'hyper_rare', weight: 400 },
  { rarity: 'ultimate_rare', weight: 100 },
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
