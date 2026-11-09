import starterSprite from '../assets/hero-starter.png';
import knightSprite from '../assets/hero-knight.png';
import flameSprite from '../assets/hero-flame.png';

export const heroLoadouts = [
  {
    id: 'starter',
    name: '旅立ちの装備',
    armor: '旅人の軽鎧',
    weapon: '鋼の剣・青盾',
    sprite: starterSprite,
    accent: '#55d6e8',
  },
  {
    id: 'knight',
    name: '王国騎士の装備',
    armor: '王国騎士鎧',
    weapon: '王国の大剣・紋章盾',
    sprite: knightSprite,
    accent: '#e8d18b',
  },
  {
    id: 'flame',
    name: '焔守りの装備',
    armor: '焔守りの鎧',
    weapon: '焔の剣・焔盾',
    sprite: flameSprite,
    accent: '#ff8652',
  },
] as const;

export type HeroLoadoutId = (typeof heroLoadouts)[number]['id'];
export type HeroLoadout = (typeof heroLoadouts)[number];

/** 装備IDを見た目データへ対応づけ、未知のIDは初期装備へ戻す。 */
export function resolveHeroAppearance(id: string): HeroLoadout {
  return heroLoadouts.find((loadout) => loadout.id === id) ?? heroLoadouts[0];
}
