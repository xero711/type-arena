import type { ChangeEvent, CSSProperties, RefObject } from 'react';
import { Heart, Keyboard, Sparkles, Swords, WandSparkles } from 'lucide-react';
import type { Prompt } from '@type-arena/game-data';
import { matchingVariants } from '@type-arena/typing-engine';
import background from '../assets/market-battle-bg.png';
import enemySprite from '../assets/shadow-slime.png';
import { heroLoadouts, resolveHeroAppearance } from '../game/hero-appearance';

type Props = {
  prompt: Prompt;
  promptIndex: number;
  typed: string;
  hp: number;
  mp: number;
  enemyHp: number;
  potions: number;
  elapsed: number;
  wpm: number;
  accuracy: number;
  errors: number;
  equipmentId: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onType: (event: ChangeEvent<HTMLInputElement>) => void;
  onEquipmentChange: (id: string) => void;
  onBack: () => void;
  onAttack: () => void;
  onMagic: () => void;
  onPotion: () => void;
  onFlee: () => void;
};

function HpBar({ value, tone }: { value: number; tone: 'hero' | 'enemy' }) {
  return <div className={`retro-hp-bar ${tone}`}><span style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} /></div>;
}

export default function CpuBattleScreen(props: Props) {
  const {
    prompt, promptIndex, typed, hp, mp, enemyHp, potions, elapsed, wpm,
    accuracy, errors, equipmentId, inputRef, onType, onEquipmentChange,
    onBack, onAttack, onMagic, onPotion, onFlee,
  } = props;
  const hero = resolveHeroAppearance(equipmentId);
  const matching = matchingVariants(prompt.romaji, typed);
  const target = matching[0] ?? prompt.romaji[0];
  const progress = target ? Math.round((typed.length / target.length) * 100) : 0;

  return <main className="retro-battle" style={{ '--battle-bg': `url("${background}")` } as CSSProperties}>
    <section className="retro-scene" aria-label="市場の戦闘フィールド">
      <div className="retro-scene-shade" />
      <header className="retro-battle-head">
        <button onClick={onBack} className="retro-exit">← ホームへ</button>
        <div className="retro-stage-title"><span>TYPE ARENA</span><b>CPU BATTLE</b></div>
        <div className="retro-clock">{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</div>
      </header>

      <div className="retro-character hero-character">
        <div className="retro-nameplate hero-nameplate"><b>勇者</b><span>{hero.name}</span></div>
        <img src={hero.sprite} alt={`勇者。${hero.armor}と${hero.weapon}を装備`} />
        <div className="retro-floor-shadow" />
      </div>
      <div className="retro-character enemy-character">
        <div className="retro-nameplate enemy-nameplate"><b>シャドウスライム</b><span>Lv. 12</span></div>
        <img src={enemySprite} alt="シャドウスライム" />
        <div className="retro-floor-shadow" />
      </div>

      <div className="retro-enemy-hp"><span>ENEMY HP</span><HpBar value={enemyHp} tone="enemy" /><b>{Math.ceil(enemyHp)} / 100</b></div>
      <div className="retro-typing-box">
        <div className="retro-typing-meta"><span>{prompt.category} ・ STAGE {String(promptIndex + 1).padStart(2, '0')}</span><span>連続入力 {progress}%</span></div>
        <b className="retro-prompt-ja">{prompt.text}</b>
        <span className="retro-prompt-reading">{prompt.reading}</span>
        <div className="retro-romaji" aria-label={`入力済み ${typed.length} 文字`}>
          {[...target].map((char, index) => <span key={`${prompt.id}-${index}`} className={index < typed.length ? 'typed' : index === typed.length ? 'current' : ''}>{char}</span>)}
        </div>
        <input ref={inputRef} className="retro-typing-input" value={typed} onChange={onType} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="ローマ字を入力して攻撃！" aria-label="ローマ字入力" />
        <div className="retro-typing-foot"><span><Keyboard size={13} /> ミス {errors}</span><span>{wpm} WPM <i /> 正確率 {accuracy}%</span></div>
      </div>
    </section>

    <section className="retro-console" aria-label="戦闘コマンドとステータス">
      <div className="retro-commands">
        <button onClick={onAttack}><Swords size={16} />こうげき</button>
        <button onClick={onMagic} disabled={mp < 10}><WandSparkles size={16} />まほう <small>10 MP</small></button>
        <button onClick={onPotion} disabled={potions < 1 || hp >= 100}><Heart size={16} />アイテム <small>×{potions}</small></button>
        <button onClick={onFlee}>にげる</button>
      </div>
      <div className="retro-status">
        <div className="retro-status-block hero-status">
          <div className="retro-status-heading"><b>勇者</b><label>YOU</label><select value={hero.id} onChange={(event) => onEquipmentChange(event.currentTarget.value)} aria-label="勇者の装備セット">
            {heroLoadouts.map((loadout) => <option key={loadout.id} value={loadout.id}>{loadout.name}</option>)}
          </select></div>
          <div className="retro-equipment-caption">防具：{hero.armor}　武器：{hero.weapon}</div>
          <div className="retro-stat-line"><span>HP</span><HpBar value={hp} tone="hero" /><b>{Math.ceil(hp)}/100</b></div>
          <div className="retro-stat-line mp-line"><span>MP</span><HpBar value={mp / 30 * 100} tone="hero" /><b>{mp}/30</b></div>
        </div>
        <div className="retro-status-block enemy-status">
          <div className="retro-status-heading"><b>シャドウスライム</b><label>CPU</label></div>
          <div className="retro-equipment-caption">市場に現れた魔物</div>
          <div className="retro-stat-line"><span><Heart size={12} /> HP</span><HpBar value={enemyHp} tone="enemy" /><b>{Math.ceil(enemyHp)}/100</b></div>
          <div className="retro-stat-line mp-line"><span><Sparkles size={12} /> 行動</span><span className="enemy-action">攻撃準備中</span></div>
        </div>
      </div>
    </section>
  </main>;
}
