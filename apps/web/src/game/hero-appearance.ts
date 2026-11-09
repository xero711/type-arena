import { armorItems, findArmor, findWeapon, weaponItems, type EquipmentItem } from '@type-arena/game-data';

export type EquipmentLoadout = { armorId: string; weaponId: string };
export type HeroAppearance = { armor: EquipmentItem; weapon: EquipmentItem };

export const defaultEquipment: EquipmentLoadout = {
  armorId: armorItems[0].id,
  weaponId: weaponItems[0].id,
};

/** 防具と武器を別々に解決し、どちらか一方だけ替えても表示を更新する。 */
export function resolveHeroAppearance(armorId: string, weaponId: string): HeroAppearance {
  return {
    armor: findArmor(armorId) ?? armorItems[0],
    weapon: findWeapon(weaponId) ?? weaponItems[0],
  };
}
