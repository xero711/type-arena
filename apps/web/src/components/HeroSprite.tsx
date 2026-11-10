import baseSprite from '../assets/hero-adventurer-v2.png';

export default function HeroSprite({ className = '' }: { className?: string }) {
  return <div className={`hero-sprite ${className}`.trim()} role="img" aria-label="勇者">
    <img className="hero-body-sprite" src={baseSprite} alt="" draggable={false} />
  </div>;
}
