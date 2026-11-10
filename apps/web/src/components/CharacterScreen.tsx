import { useState } from 'react';
import { ArrowLeft, Shield, Sparkles, Swords, WandSparkles, Zap } from 'lucide-react';
import HeroSprite from './HeroSprite';
import { characterDamage, characters, magicAttackValue, magicDefenseValue, spellDamage, type CharacterId } from '@type-arena/game-data';
import { attackDamage, cpuDamagePerSecond, maxStatLevel, type CharacterProgress, type CharacterStat } from '../game/character-progress';

type Props = {
  roster: { coins: number; selected: CharacterId; unlocked: CharacterId[] };
  busy: boolean; message: string | null; canManage: boolean;
  onCharacter: (character: CharacterId, action: 'unlock' | 'select') => Promise<void>;
  progress: CharacterProgress; onUpgrade: (stat: CharacterStat) => void;
  onlineGrowth: CharacterProgress | null; onlineBusy: boolean; onlineMessage: string | null;
  onOnlineUpgrade: (stat: CharacterStat) => Promise<void>;
  onBack: () => void; onBattle: () => void;
};

export default function CharacterScreen({ roster, busy, message, canManage, onCharacter, progress, onUpgrade, onlineGrowth, onlineBusy, onlineMessage, onOnlineUpgrade, onBack, onBattle }: Props) {
  const [mode, setMode] = useState<'cpu' | 'online'>('cpu');
  const growth = mode === 'cpu' ? progress : onlineGrowth;
  const character = characters[roster.selected];
  const disabled = !growth || (mode === 'online' && (!canManage || onlineBusy));
  const upgrade = (stat: CharacterStat) => mode === 'cpu' ? onUpgrade(stat) : void onOnlineUpgrade(stat);
  const maxed = (stat: CharacterStat) => !growth || growth[stat] >= maxStatLevel;
  const button = (stat: CharacterStat) => <button className="primary-button" disabled={disabled || !growth || growth.points < 1 || maxed(stat)} onClick={() => upgrade(stat)}>{maxed(stat) && growth ? '強化完了' : '1 PT で強化'}</button>;

  return <main className="character-page">
    <div className="character-heading"><button className="secondary-button" onClick={onBack}><ArrowLeft size={15}/> ホームへ戻る</button><div><span className="section-kicker">CHARACTER GROWTH</span><h1>キャラクター選択・強化</h1></div></div>
    <section className="character-roster" aria-label="キャラクター選択">
      <div className="character-roster-heading"><div><span className="section-kicker">CHARACTERS</span><h2>キャラクターを選ぼう</h2></div><strong>🪙 {canManage ? roster.coins.toLocaleString('ja-JP') : '—'} コイン</strong></div>
      <p>選択したキャラクターはCPU戦とオンライン対戦に反映されます。</p>
      {!canManage && <p role="status">購入と切り替えにはログインとサーバー接続が必要です。</p>}
      {message && <p role="status">{message}</p>}
      <div className="character-roster-grid">{(Object.keys(characters) as CharacterId[]).map((id) => {
        const owned = roster.unlocked.includes(id);
        const selected = roster.selected === id;
        const info = characters[id];
        return <article className={`character-choice ${selected ? 'selected' : ''}`} key={id}>
          <div className="character-choice-portrait"><HeroSprite character={id} /></div>
          <h3>{info.name}</h3><p>{info.description}</p>
          <span>{info.attackType === 'magic' ? '魔法攻撃' : '物理攻撃'} ×{info.damageMultiplier} ・ 魔攻 {info.baseMagicAttack} / 魔防 {info.baseMagicDefense}</span>
          <button className={selected ? 'secondary-button' : 'primary-button'} disabled={busy || selected || !canManage} onClick={() => void onCharacter(id, owned ? 'select' : 'unlock')}>
            {selected ? '選択中' : owned ? '選択する' : `${info.price.toLocaleString('ja-JP')} コインで解放`}
          </button>
        </article>;
      })}</div>
    </section>
    <section className="character-intro"><div className="character-portrait"><HeroSprite character={roster.selected} /></div><div><span className="section-kicker">YOUR HERO</span><h2>{character.name}を育てよう</h2><p>物理と魔法、それぞれの能力を強化できます。</p><div className="character-points"><Zap size={18}/><span>{mode === 'cpu' ? 'CPU強化ポイント' : 'オンライン強化ポイント'}</span><strong>{growth?.points ?? '—'}</strong><small>PT</small></div><p className="character-note">CPU戦は勝利3 PT・敗北1 PT。ランク戦は勝利3 PT・敗北1 PT・引き分け2 PT。<br/>CPU用はこの端末、オンライン用はアカウントに別々に保存されます。プライベート戦と切断ではオンラインPTを獲得できません。</p></div></section>
    <div className="growth-tabs" aria-label="強化するモード"><button className={mode === 'cpu' ? 'active' : ''} onClick={() => setMode('cpu')} aria-pressed={mode === 'cpu'}>CPU戦の強化</button><button className={mode === 'online' ? 'active' : ''} onClick={() => setMode('online')} aria-pressed={mode === 'online'}>オンライン戦の強化</button></div>
    {mode === 'online' && !canManage && <p className="growth-message">オンライン強化にはログインとサーバー接続が必要です。</p>}
    {mode === 'online' && onlineMessage && <p className="growth-message" role="status">{onlineMessage}</p>}
    <div className="character-stats">
      <article className="character-stat"><div className="character-stat-icon attack"><Swords size={22}/></div><div className="character-stat-copy"><span>ATTACK</span><h3>物理攻撃力 <small>Lv. {growth?.attack ?? '—'} / {maxStatLevel}</small></h3><p>物理タイプの入力攻撃を強化します。</p><b>{growth ? `基礎 ${characterDamage(attackDamage(growth.attack), roster.selected)} ダメージ` : '—'}</b></div>{button('attack')}</article>
      <article className="character-stat"><div className="character-stat-icon defense"><Shield size={22}/></div><div className="character-stat-copy"><span>DEFENSE</span><h3>物理防御力 <small>Lv. {growth?.defense ?? '—'} / {maxStatLevel}</small></h3><p>物理攻撃による被ダメージを減らします。</p><b>{growth ? mode === 'cpu' ? `被ダメージ ${Math.round(cpuDamagePerSecond(growth.defense) * 1000) / 1000} / 秒` : `物理ダメージ軽減 ${growth.defense}` : '—'}</b></div>{button('defense')}</article>
      <article className="character-stat"><div className="character-stat-icon magic"><WandSparkles size={22}/></div><div className="character-stat-copy"><span>MAGIC ATTACK</span><h3>魔法攻撃力 <small>Lv. {growth?.magicAttack ?? '—'} / {maxStatLevel}</small></h3><p>魔法コマンドと魔法タイプの入力攻撃を強化します。</p><b>{growth ? `魔攻 ${magicAttackValue(roster.selected, growth.magicAttack)} ・ 魔法 ${spellDamage(roster.selected, growth.magicAttack, 2)} ダメージ目安` : '—'}</b></div>{button('magicAttack')}</article>
      <article className="character-stat"><div className="character-stat-icon magic-defense"><Sparkles size={22}/></div><div className="character-stat-copy"><span>MAGIC DEFENSE</span><h3>魔法防御力 <small>Lv. {growth?.magicDefense ?? '—'} / {maxStatLevel}</small></h3><p>魔法による被ダメージを減らします。</p><b>{growth ? `魔防 ${magicDefenseValue(roster.selected, growth.magicDefense)}` : '—'}</b></div>{button('magicDefense')}</article>
    </div>
    <div className="character-bottom"><span>魔法は10 MPを消費し、入力成功で3 MP回復。CPUも8秒ごとに魔法を使います。</span><button className="secondary-button" onClick={onBattle}><Swords size={16}/> CPUと対戦</button></div>
  </main>;
}
