import type { CSSProperties } from 'react';
import { itemRarities, rarityInfo, type EquipmentItem } from '@type-arena/game-data';
import armorAtlas from '../assets/armor-atlas-v2.png';
import weaponAtlas from '../assets/weapon-atlas-v2.png';

const armorColumns: Record<NonNullable<EquipmentItem['armorStyle']>, number> = {
  light: 0,
  leather: 1,
  mail: 2,
  plate: 3,
  robe: 4,
};

const weaponColumns: Record<NonNullable<EquipmentItem['weaponStyle']>, number> = {
  sword: 0,
  dagger: 1,
  hammer: 2,
  staff: 3,
  bow: 4,
};

export default function EquipmentArtwork({
  item,
  className = '',
  decorative = false,
}: {
  item: EquipmentItem;
  className?: string;
  decorative?: boolean;
}) {
  const column = item.type === 'armor'
    ? armorColumns[item.armorStyle ?? 'light']
    : weaponColumns[item.weaponStyle ?? 'sword'];
  const row = itemRarities.indexOf(item.rarity);
  const atlas = item.type === 'armor' ? armorAtlas : weaponAtlas;
  const style = {
    backgroundImage: `url("${atlas}")`,
    backgroundPosition: `${column * 25}% ${row * 25}%`,
    '--rarity-color': rarityInfo[item.rarity].color,
  } as CSSProperties;

  return <span
    className={`equipment-artwork ${className}`.trim()}
    style={style}
    role={decorative ? undefined : 'img'}
    aria-hidden={decorative || undefined}
    aria-label={decorative ? undefined : `${item.name}、${rarityInfo[item.rarity].label}`}
  />;
}
