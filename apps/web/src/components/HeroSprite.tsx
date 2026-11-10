import baseSprite from '../assets/hero-adventurer-v2.png';
import flameSprite from '../assets/hero-flame.png';
import knightSprite from '../assets/hero-knight.png';
import { characters, type CharacterId } from '@type-arena/game-data';

export default function HeroSprite({ className = '', character = 'balanced' }: { className?: string; character?: CharacterId }) {
  const sprite = character === 'long' ? flameSprite : character === 'word' ? knightSprite : baseSprite;
  return <div className={`hero-sprite ${className}`.trim()} role="img" aria-label={characters[character].name}>
    <img className="hero-body-sprite" src={sprite} alt="" draggable={false} />
  </div>;
}
