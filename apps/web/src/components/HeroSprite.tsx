import type { CSSProperties } from 'react';
import type { EquipmentItem } from '@type-arena/game-data';
import baseSprite from '../assets/hero-base.png';

type Props = {
  armor: EquipmentItem;
  weapon: EquipmentItem;
  className?: string;
};

function ArmorLayer({ armor }: { armor: EquipmentItem }) {
  const style = armor.armorStyle ?? 'light';
  const bodyPath = style === 'robe'
    ? 'M63 31H177L208 76L224 210L184 242H56L16 210L32 76Z'
    : style === 'leather'
      ? 'M68 30H172L204 72L187 202L160 231H80L53 202L36 72Z'
      : 'M70 28H170L207 67L190 202L160 232H80L50 202L33 67Z';

  return <svg className={`hero-armor-layer armor-${style}`} viewBox="0 0 240 260" aria-hidden="true" shapeRendering="crispEdges">
    <path d={bodyPath} fill={armor.primary} stroke={armor.accent} strokeWidth="8" />
    <path d="M69 38L45 74L68 95L87 77L104 98L120 88L136 98L153 77L172 95L195 74L171 38Z" fill={armor.secondary} stroke={armor.accent} strokeWidth="5" />
    <path d="M66 89L102 102L120 94L138 102L174 89L164 177L145 213H95L76 177Z" fill={armor.primary} stroke={armor.accent} strokeWidth="5" />
    {style === 'plate' && <g fill="none" stroke={armor.secondary} strokeWidth="8"><path d="M79 137H161"/><path d="M83 166H157"/><path d="M91 194H149"/></g>}
    {style === 'mail' && <g fill="none" stroke={armor.accent} strokeWidth="3" opacity=".8"><path d="M82 116L100 134L82 152L100 170L82 188"/><path d="M120 108L138 126L120 144L138 162L120 180L138 198"/><path d="M158 116L140 134L158 152L140 170L158 188"/></g>}
    {style === 'leather' && <g fill="none" stroke={armor.accent} strokeWidth="7"><path d="M83 109L157 191"/><path d="M157 109L83 191"/></g>}
    {style === 'robe' && <path d="M69 177H171L184 226H56Z" fill={armor.secondary} stroke={armor.accent} strokeWidth="5"/>}
    {(style === 'plate' || style === 'light') && <g fill="none" stroke={armor.accent} strokeWidth="5"><path d="M83 120H157"/><path d="M88 151H152"/></g>}
    <path d="M105 77L120 66L135 77L120 102Z" fill={armor.accent} stroke={armor.secondary} strokeWidth="4" />
    <path d="M40 73L23 85L48 112L65 94Z" fill={armor.primary} stroke={armor.accent} strokeWidth="6" />
    <path d="M200 73L217 85L192 112L175 94Z" fill={armor.primary} stroke={armor.accent} strokeWidth="6" />
    <path d="M74 210H166" stroke={armor.accent} strokeWidth="8" />
  </svg>;
}

function WeaponLayer({ weapon }: { weapon: EquipmentItem }) {
  const style = weapon.weaponStyle ?? 'sword';
  const metal = weapon.primary;
  const dark = weapon.secondary;
  const trim = weapon.accent;

  return <svg className={`hero-weapon-layer weapon-${style}`} viewBox="0 0 160 260" aria-hidden="true" shapeRendering="crispEdges">
    {style === 'sword' && <g stroke={dark} strokeWidth="5" strokeLinejoin="miter">
      <path d="M67 187L89 34L105 12L117 39L86 198Z" fill={metal}/><path d="M91 47L104 31L91 158Z" fill={trim} stroke="none"/>
      <path d="M49 178L103 190L96 205L44 193Z" fill={trim}/><path d="M70 194L54 238L69 245L87 199Z" fill={dark}/><path d="M51 236L77 246L72 255L48 247Z" fill={trim}/>
    </g>}
    {style === 'dagger' && <g stroke={dark} strokeWidth="5" strokeLinejoin="miter">
      <path d="M71 153L89 74L106 26L113 70L91 160Z" fill={metal}/><path d="M93 78L106 43L104 112Z" fill={trim} stroke="none"/>
      <path d="M55 151L101 163L95 177L51 166Z" fill={trim}/><path d="M73 164L62 218L77 222L91 169Z" fill={dark}/><path d="M59 216L83 222L79 232L56 227Z" fill={trim}/>
    </g>}
    {style === 'hammer' && <g stroke={dark} strokeWidth="5" strokeLinejoin="miter">
      <path d="M56 239L91 94L108 98L72 245Z" fill={dark}/><path d="M55 75L79 47L119 54L131 36L146 45L137 75L146 100L129 109L113 93L79 106Z" fill={metal}/>
      <path d="M84 59L119 66L126 87L109 96L79 89Z" fill={trim}/><path d="M55 218L74 223L79 207L60 202Z" fill={trim}/>
    </g>}
    {style === 'staff' && <g stroke={dark} strokeWidth="5" strokeLinejoin="miter">
      <path d="M50 232L102 43L117 48L65 237Z" fill={dark}/><path d="M55 210L69 214L73 202L59 198Z" fill={trim}/>
      <path d="M92 36L101 13L120 5L139 20L136 42L118 56L98 49Z" fill={metal}/><path d="M117 15L128 23L121 39L108 34Z" fill={trim}/>
    </g>}
    {style === 'bow' && <g fill="none" strokeLinejoin="miter">
      <path d="M107 19Q30 126 107 232" stroke={dark} strokeWidth="17"/><path d="M105 22Q47 126 105 229" stroke={trim} strokeWidth="6"/><path d="M107 20L81 126L107 232" stroke={metal} strokeWidth="3"/>
      <path d="M50 130H138L123 119M138 130L123 141" stroke={trim} strokeWidth="6"/>
    </g>}
  </svg>;
}

export default function HeroSprite({ armor, weapon, className = '' }: Props) {
  const label = `勇者。${armor.name}と${weapon.name}を装備`;
  const style = { '--weapon-rarity-color': weapon.accent } as CSSProperties;
  return <div className={`hero-sprite rarity-${weapon.rarity} ${className}`} style={style} role="img" aria-label={label}>
    <img className="hero-body-sprite" src={baseSprite} alt="" draggable={false} />
    <ArmorLayer armor={armor} />
    <WeaponLayer weapon={weapon} />
  </div>;
}
