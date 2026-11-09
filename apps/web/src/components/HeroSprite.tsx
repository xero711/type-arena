import type { CSSProperties } from 'react';
import type { EquipmentItem } from '@type-arena/game-data';
import baseSprite from '../assets/hero-adventurer-v2.png';
import EquipmentArtwork from './EquipmentArtwork';

type Props = {
  armor: EquipmentItem;
  weapon: EquipmentItem;
  className?: string;
};

export default function HeroSprite({ armor, weapon, className = '' }: Props) {
  const label = `勇者。${armor.name}と${weapon.name}を装備`;
  const style = { '--weapon-rarity-color': weapon.accent } as CSSProperties;

  return <div className={`hero-sprite rarity-${weapon.rarity} ${className}`.trim()} style={style} role="img" aria-label={label}>
    <img className="hero-body-sprite" src={baseSprite} alt="" draggable={false} />
    <EquipmentArtwork item={armor} className="hero-armor-layer" decorative />
    <EquipmentArtwork item={weapon} className="hero-weapon-layer" decorative />
  </div>;
}
