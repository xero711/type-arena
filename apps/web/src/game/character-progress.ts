import type { GrowthStat } from '@type-arena/game-data';
export type CharacterProgress = { points: number; attack: number; defense: number; magicAttack: number; magicDefense: number };
export type CharacterStat = GrowthStat;
export const maxStatLevel = 10;
const storageKey = 'type-arena-character-progress-v1';
const initialProgress: CharacterProgress = { points: 0, attack: 0, defense: 0, magicAttack: 0, magicDefense: 0 };

export function readProgress(): CharacterProgress {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (!value || typeof value !== 'object') return { ...initialProgress };
    const saved = value as Partial<CharacterProgress>;
    const valid = (n: unknown, max: number) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= max;
    if (!valid(saved.points, Number.MAX_SAFE_INTEGER) || !valid(saved.attack, maxStatLevel) || !valid(saved.defense, maxStatLevel)) return { ...initialProgress };
    // Existing saves predate the two magic levels; keep their points and physical upgrades.
    const magicAttack = saved.magicAttack ?? 0;
    const magicDefense = saved.magicDefense ?? 0;
    if (!valid(magicAttack, maxStatLevel) || !valid(magicDefense, maxStatLevel)) return { ...initialProgress };
    return { points: saved.points!, attack: saved.attack!, defense: saved.defense!, magicAttack, magicDefense };
  } catch { return { ...initialProgress }; }
}

export function saveProgress(progress: CharacterProgress) {
  try { localStorage.setItem(storageKey, JSON.stringify(progress)); } catch { /* The current session remains playable. */ }
}

export function upgradeStat(progress: CharacterProgress, stat: CharacterStat): CharacterProgress {
  if (progress.points < 1 || progress[stat] >= maxStatLevel) return progress;
  return { ...progress, points: progress.points - 1, [stat]: progress[stat] + 1 };
}

export function attackDamage(level: number): number { return 24 + level * 2; }
export function cpuDamagePerSecond(level: number): number { return Math.max(0.20, 0.45 - level * 0.025); }
