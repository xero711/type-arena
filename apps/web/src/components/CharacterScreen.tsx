import { ArrowLeft, Shield, Swords, Zap } from 'lucide-react';
import HeroSprite from './HeroSprite';
import { characterDamage, characters, type CharacterId } from '@type-arena/game-data';
import { attackDamage, cpuDamagePerSecond, maxStatLevel, type CharacterProgress, type CharacterStat } from '../game/character-progress';

type Props = { roster: { coins: number; selected: CharacterId; unlocked: CharacterId[] }; busy: boolean; message: string | null; canManage: boolean; onCharacter: (character: CharacterId, action: 'unlock' | 'select') => Promise<void>; progress: CharacterProgress; onUpgrade: (stat: CharacterStat) => void; onBack: () => void; onBattle: () => void };

export default function CharacterScreen({ roster, busy, message, canManage, onCharacter, progress, onUpgrade, onBack, onBattle }: Props) {
  return <main className="character-page">
    <div className="character-heading"><button className="secondary-button" onClick={onBack}><ArrowLeft size={15}/> ホームへ戻る</button><div><span className="section-kicker">CHARACTER GROWTH</span><h1>キャラクター選択・強化</h1></div></div>
    <section className="character-roster" aria-label="キャラクター選択">
      <div className="character-roster-heading"><div><span className="section-kicker">CHARACTERS</span><h2>キャラクターを選ぼう</h2></div><strong>🪙 {canManage ? roster.coins : '—'} コイン</strong></div>
      <p>選択したキャラクターは CPU 戦とオンライン対戦に反映されます。</p>
      {!canManage && <p role="status">購入と切り替えにはログインとサーバー接続が必要です。</p>}
      {message && <p role="status">{message}</p>}
      <div className="character-roster-grid">{(Object.keys(characters) as CharacterId[]).map((id) => {
        const owned = roster.unlocked.includes(id);
        const selected = roster.selected === id;
        return <article className={`character-choice ${selected ? 'selected' : ''}`} key={id}>
          <div className="character-choice-portrait"><HeroSprite character={id} /></div>
          <h3>{characters[id].name}</h3><p>{characters[id].description}</p>
          <span>攻撃ダメージ ×{characters[id].damageMultiplier}</span>
          <button className={selected ? 'secondary-button' : 'primary-button'} disabled={busy || selected || !canManage} onClick={() => void onCharacter(id, owned ? 'select' : 'unlock')}>
            {selected ? '選択中' : owned ? '選択する' : '500 コインで解放'}
          </button>
        </article>;
      })}</div>
    </section>
    <section className="character-intro"><div className="character-portrait"><HeroSprite character={roster.selected} /></div><div><span className="section-kicker">YOUR HERO</span><h2>勇者を育てよう</h2><p>CPU対戦でポイントを集めて、好きな能力を強化しよう。</p><div className="character-points"><Zap size={18}/><span>強化ポイント</span><strong>{progress.points}</strong><small>PT</small></div><p className="character-note">勝利で3 PT、敗北で1 PT獲得。逃走時は獲得できません。<br/>強化はこの端末に保存され、CPU戦に反映されます。</p></div></section>
    <div className="character-stats">
      <article className="character-stat"><div className="character-stat-icon attack"><Swords size={22}/></div><div className="character-stat-copy"><span>ATTACK</span><h3>攻撃力 <small>Lv. {progress.attack} / {maxStatLevel}</small></h3><p>タイピング成功時のダメージが上がります。</p><b>{characterDamage(attackDamage(progress.attack), roster.selected)} ダメージ{progress.attack < maxStatLevel && ` → ${characterDamage(attackDamage(progress.attack + 1), roster.selected)}`}</b></div><button className="primary-button" disabled={progress.points < 1 || progress.attack >= maxStatLevel} onClick={() => onUpgrade('attack')}>{progress.attack >= maxStatLevel ? '強化完了' : '1 PT で強化'}</button></article>
      <article className="character-stat"><div className="character-stat-icon defense"><Shield size={22}/></div><div className="character-stat-copy"><span>DEFENSE</span><h3>防御力 <small>Lv. {progress.defense} / {maxStatLevel}</small></h3><p>CPUから受けるダメージが減ります。</p><b>被ダメージ {Math.round(cpuDamagePerSecond(progress.defense) * 1000) / 1000} / 秒{progress.defense < maxStatLevel && ` → ${Math.round(cpuDamagePerSecond(progress.defense + 1) * 1000) / 1000}`}</b></div><button className="primary-button" disabled={progress.points < 1 || progress.defense >= maxStatLevel} onClick={() => onUpgrade('defense')}>{progress.defense >= maxStatLevel ? '強化完了' : '1 PT で強化'}</button></article>
    </div>
    <div className="character-bottom"><span>強化ポイントは戦績をリセットしても残ります。</span><button className="secondary-button" onClick={onBattle}><Swords size={16}/> CPUと対戦</button></div>
  </main>;
}
