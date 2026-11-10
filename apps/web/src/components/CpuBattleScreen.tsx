import type { ChangeEvent, CSSProperties, RefObject } from 'react';
import { Heart, Keyboard, Sparkles, Swords, WandSparkles } from 'lucide-react';
import { characters, magicAttackValue, magicDefenseValue, MAX_MP, SPELL_COST, type CharacterId, type Prompt } from '@type-arena/game-data';
import { matchingVariants } from '@type-arena/typing-engine';
import background from '../assets/market-battle-bg.png';
import enemySprite from '../assets/shadow-imp-v2.png';
import HeroSprite from './HeroSprite';

type Props = {
  character: CharacterId;
  magicAttack: number;
  magicDefense: number;
  spellReadyAt: number;
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
  attack: number;
  defense: number;
  inputRef: RefObject<HTMLInputElement | null>;
  onType: (event: ChangeEvent<HTMLInputElement>) => void;
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
    character, magicAttack, magicDefense, spellReadyAt, prompt, promptIndex, typed, hp, mp, enemyHp, potions, elapsed, wpm,
    accuracy, errors, attack, defense, inputRef, onType,
    onBack, onAttack, onMagic, onPotion, onFlee,
  } = props;
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
        <div className="retro-nameplate hero-nameplate"><b>{characters[character].name}</b><span>攻撃 Lv.{attack} / 防御 Lv.{defense}</span></div>
        <HeroSprite character={character} />
        <div className="retro-floor-shadow" />
      </div>
      <div className="retro-character enemy-character">
        <div className="retro-nameplate enemy-nameplate"><b>市場のシャドウインプ</b><span>Lv. 12</span></div>
        <img src={enemySprite} alt="市場のシャドウインプ" />
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
        <button onMouseDown={(event) => event.preventDefault()} onClick={() => { onMagic(); inputRef.current?.focus(); }} disabled={mp < SPELL_COST || Date.now() < spellReadyAt}><WandSparkles size={16} />まほう <small>{SPELL_COST} MP</small></button>
        <button onClick={onPotion} disabled={potions < 1 || hp >= 100}><Heart size={16} />かいふく <small>×{potions}</small></button>
        <button onClick={onFlee}>にげる</button>
      </div>
      <div className="retro-status">
        <div className="retro-status-block hero-status">
          <div className="retro-status-heading"><b>{characters[character].name}</b><label>YOU</label></div>
          <div className="retro-equipment-caption">
            攻撃 Lv.{attack}　防御 Lv.{defense}　魔攻 {magicAttackValue(character, magicAttack)}　魔防 {magicDefenseValue(character, magicDefense)}
          </div>
          <div className="retro-stat-line"><span>HP</span><HpBar value={hp} tone="hero" /><b>{Math.ceil(hp)}/100</b></div>
          <div className="retro-stat-line mp-line"><span>MP</span><HpBar value={mp / MAX_MP * 100} tone="hero" /><b>{mp}/{MAX_MP}</b></div>
        </div>
        <div className="retro-status-block enemy-status">
          <div className="retro-status-heading"><b>シャドウインプ</b><label>CPU</label></div>
          <div className="retro-equipment-caption">市場に現れた魔物</div>
          <div className="retro-stat-line"><span><Heart size={12} /> HP</span><HpBar value={enemyHp} tone="enemy" /><b>{Math.ceil(enemyHp)}/100</b></div>
          <div className="retro-stat-line mp-line"><span><Sparkles size={12} /> 行動</span><span className="enemy-action">魔法まで {8 - (elapsed % 8)} 秒</span></div>
        </div>
      </div>
    </section>
  </main>;
}
