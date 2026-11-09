import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Activity, ArrowDownRight, ArrowRight, AudioLines, Bolt, ChevronDown, CircleHelp, Coins, Flame, Gamepad2, Gauge, LockKeyhole, RotateCcw, Settings2, Shield, Sparkles, Swords, Trophy, UserRound, Volume2 } from 'lucide-react';
import { prompts, type Prompt } from '@type-arena/game-data';
import { isAnyVariantComplete, matchingVariants } from '@type-arena/typing-engine';
import { useAuthStore } from './stores/authStore';
import OnlineArena from './pages/OnlineArena';
import CpuBattleScreen from './components/CpuBattleScreen';
import EquipmentScreen from './components/EquipmentScreen';
import HeroSprite from './components/HeroSprite';
import { defaultEquipment, resolveHeroAppearance, type EquipmentLoadout } from './game/hero-appearance';

type Screen = 'home' | 'battle' | 'results' | 'records' | 'online' | 'equipment';
type RecordItem = { result: 'win' | 'lose'; wpm: number; accuracy: number; date: string };
const recordsKey = 'type-arena-records-v1';
const heroEquipmentKey = 'type-arena-equipment-v2';
const legacyHeroEquipmentKey = 'type-arena-hero-equipment-v1';
const initialPlayerHp = 100;

function getCpuAttackDamage(armorDefense: number) {
  return Math.max(0.18, 0.45 - armorDefense * 0.005);
}

function getPlayerAttackDamage(weaponAttack: number) {
  return 24 + Math.round(weaponAttack / 2);
}

function readRecords(): RecordItem[] {
  try { return JSON.parse(localStorage.getItem(recordsKey) ?? '[]') as RecordItem[]; } catch { return []; }
}

function readHeroEquipment(): EquipmentLoadout {
  try {
    const stored = localStorage.getItem(heroEquipmentKey);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<EquipmentLoadout>;
      const resolved = resolveHeroAppearance(parsed.armorId ?? '', parsed.weaponId ?? '');
      return { armorId: resolved.armor.id, weaponId: resolved.weapon.id };
    }
    const legacy = localStorage.getItem(legacyHeroEquipmentKey);
    const migrated: Record<string, EquipmentLoadout> = {
      starter: defaultEquipment,
      knight: { armorId: 'armor_hyper_rare_guard', weaponId: 'weapon_hyper_rare_sword' },
      flame: { armorId: 'armor_ultimate_rare_plate', weaponId: 'weapon_ultimate_rare_axe' },
    };
    return legacy ? migrated[legacy] ?? defaultEquipment : defaultEquipment;
  } catch { return defaultEquipment; }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [promptIndex, setPromptIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [hp, setHp] = useState(initialPlayerHp);
  const [mp, setMp] = useState(30);
  const [enemyHp, setEnemyHp] = useState(initialPlayerHp);
  const [potions, setPotions] = useState(1);
  const [loadout, setLoadout] = useState<EquipmentLoadout>(readHeroEquipment);
  const [equipmentReturnScreen, setEquipmentReturnScreen] = useState<'home' | 'battle'>('home');
  const [wpm, setWpm] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [keystrokes, setKeystrokes] = useState(0);
  const [errors, setErrors] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [records, setRecords] = useState<RecordItem[]>(readRecords);
  const [soundOn, setSoundOn] = useState(true);
  const { user, busy: authBusy, message: authMessage, apiStatus, initialize, login, logout } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const prompt: Prompt = prompts[promptIndex % prompts.length];
  const accuracy = keystrokes ? Math.round(correct / keystrokes * 100) : 100;
  const result = enemyHp <= 0 ? 'win' : hp <= 0 ? 'lose' : null;
  const heroAppearance = resolveHeroAppearance(loadout.armorId, loadout.weaponId);

  useEffect(() => initialize(), [initialize]);

  useEffect(() => {
    localStorage.setItem(heroEquipmentKey, JSON.stringify(loadout));
  }, [loadout]);

  useEffect(() => {
    if (screen !== 'battle' || result) return;
    const timer = window.setInterval(() => {
      setElapsed((value) => value + 1);
      // CPUは約35WPMで一定の速度を保ち、4回攻撃で決着する。
      setEnemyHp((value) => Math.max(0, value - 0.75));
      setHp((value) => Math.max(0, value - getCpuAttackDamage(heroAppearance.armor.defense)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, result, heroAppearance.armor.defense]);

  useEffect(() => {
    if (screen === 'battle' && result) {
      const summary: RecordItem = { result, wpm, accuracy, date: new Date().toISOString() };
      const next = [summary, ...readRecords()].slice(0, 30);
      localStorage.setItem(recordsKey, JSON.stringify(next));
      setRecords(next);
      setScreen('results');
    }
  }, [screen, result, wpm, accuracy]);

  const startBattle = () => {
    setPromptIndex(0); setTyped(''); setHp(initialPlayerHp); setMp(30); setPotions(1); setEnemyHp(initialPlayerHp);
    setWpm(0); setCorrect(0); setKeystrokes(0); setErrors(0); setElapsed(0); setScreen('battle');
    window.setTimeout(() => inputRef.current?.focus(), 50);
  };

  const castMagic = () => {
    if (mp < 10) return;
    setMp((value) => Math.max(0, value - 10));
    setEnemyHp((value) => Math.max(0, value - 18));
  };

  const usePotion = () => {
    if (potions < 1 || hp >= initialPlayerHp) return;
    setPotions((value) => value - 1);
    setHp((value) => Math.min(initialPlayerHp, value + 25));
  };

  const fleeBattle = () => setHp(0);

  const openEquipment = () => {
    setEquipmentReturnScreen(screen === 'battle' ? 'battle' : 'home');
    setScreen('equipment');
  };

  const onType = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value.toLowerCase().replace(/[^a-z]/g, '');
    if (value.length < typed.length) {
      setTyped(value);
      return;
    }
    const entered = value.slice(typed.length);
    if (entered.length === 0) return;
    setKeystrokes((count) => count + entered.length);
    if (matchingVariants(prompt.romaji, value).length === 0) {
      setErrors((count) => count + entered.length);
      return;
    }
    setCorrect((count) => count + entered.length);
    setWpm(Math.round((correct + entered.length) / Math.max(1, elapsed + 1) * 12));
    if (isAnyVariantComplete(prompt.romaji, value)) {
      setEnemyHp((hpValue) => Math.max(0, hpValue - getPlayerAttackDamage(heroAppearance.weapon.attack)));
      setPromptIndex((index) => index + 1);
      setTyped('');
      return;
    }
    setTyped(value);
  };

  const completedCount = useMemo(() => records.length, [records]);

  return <div className={screen === 'battle' ? 'app-shell in-battle' : 'app-shell'}>
    {screen !== 'online' && <header className="topbar">
      <button className="brand" onClick={() => setScreen('home')} aria-label="ホームへ">
        <span className="brand-mark"><span /></span><span className="brand-name">TYPE<span>ARENA</span><small>TYPE TO CONQUER</small></span>
      </button>
      <nav className="main-nav"><button className={screen === 'home' ? 'active' : ''} onClick={() => setScreen('home')}>ホーム</button><button className={screen === 'equipment' ? 'active' : ''} onClick={openEquipment}>装備</button><button className={screen === 'records' ? 'active' : ''} onClick={() => setScreen('records')}>戦績</button><button onClick={() => setScreen('online')}>オンライン</button></nav>
      <div className="header-right"><div className={`server-status ${apiStatus}`}><i /> <span>{apiStatus === "online" ? "サーバー接続中" : apiStatus === "degraded" ? "サーバー準備中" : apiStatus === "offline" ? "サーバー未接続" : "接続確認中"}</span></div><button className="icon-button" onClick={() => setSoundOn(!soundOn)} aria-label="サウンド切替">{soundOn ? <Volume2 size={18} /> : <AudioLines size={18} />}</button>{user ? <button className="profile-button" onClick={() => void logout()} title="ログアウト"><span className="avatar-mini"><UserRound size={15} /></span><span>{user.displayName || "プレイヤー"}</span><ChevronDown size={14} /></button> : <button className="login-button" onClick={() => void login()} disabled={authBusy}>{authBusy ? "接続中…" : "Googleログイン"}</button>}</div>
    </header>}
    {authMessage && <div className="auth-message" role="status">{authMessage}</div>}
    {screen === 'online' && <OnlineArena user={user} apiReady={apiStatus === 'online'} heroArmorId={heroAppearance.armor.id} heroWeaponId={heroAppearance.weapon.id} login={login} guestLogin={useAuthStore.getState().guestLogin} onBack={() => setScreen('home')} />}
    {screen === 'home' && <main className="home-layout">
      <section className="hero-panel">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> SEASON 01 <span className="eyebrow-dot">/</span> AWAKENING</div><h1>指先で、<br /><span>運命を切り拓け。</span></h1><p>タイピングの速さが、そのまま君の強さになる。<br />仲間と競い、最強のタイパーを目指そう。</p><div className="hero-actions"><button className="primary-button" onClick={startBattle}><Swords size={18} /> CPUと対戦 <ArrowRight size={16} /></button><button className="secondary-button" onClick={() => setScreen('online')}><Swords size={17} /> ランクマッチ</button></div><div className="hero-foot"><span><i className="live-dot" /> オフラインでもプレイ可能</span><span className="foot-divider" /><span><LockKeyhole size={13} /> データはこの端末に保存</span></div></div>
        <div className="hero-art" aria-label="勇者"><div className="hero-glow" /><HeroSprite className="home-hero-sprite" armor={heroAppearance.armor} weapon={heroAppearance.weapon} /><div className="art-caption"><span>01</span><div><b>THE HERO</b><small>{heroAppearance.armor.name} / {heroAppearance.weapon.name}</small></div></div></div>
      </section>
      <section className="dashboard-row"><div className="section-heading"><div><span className="section-kicker">YOUR JOURNEY</span><h2>冒険の記録</h2></div><button className="text-link" onClick={() => setScreen('records')}>すべて見る <ArrowRight size={14}/></button></div>
        <div className="stat-grid"><div className="stat-card rank-card"><div className="stat-icon violet"><Shield size={18}/></div><div className="stat-label">現在のランク</div><div className="rank-value">未認定 <small>—</small></div><div className="rank-hint">対戦を重ねてランクを獲得</div><div className="rank-emblem"><Shield size={35}/><span>?</span></div></div><div className="stat-card"><div className="stat-top"><div className="stat-icon cyan"><Swords size={17}/></div><span className="stat-label">総対戦数</span></div><div className="stat-value">{completedCount}<small> 戦</small></div><div className="stat-note">CPUバトルの記録</div><div className="stat-decoration"><Gamepad2 size={42}/></div></div><div className="stat-card"><div className="stat-top"><div className="stat-icon orange"><Flame size={17}/></div><span className="stat-label">最高速度</span></div><div className="stat-value">{records.length ? Math.max(...records.map((r) => r.wpm)) : 0}<small> WPM</small></div><div className="stat-note">1分あたりの入力文字数</div><div className="stat-decoration"><Gauge size={42}/></div></div><div className="stat-card"><div className="stat-top"><div className="stat-icon gold"><Coins size={17}/></div><span className="stat-label">所持コイン</span></div><div className="stat-value">—<small> COIN</small></div><div className="stat-note">オンライン接続後に利用可能</div><div className="stat-decoration"><Sparkles size={42}/></div></div></div>
      </section>
      <section className="lower-row"><div className="quick-card"><div className="quick-art"><div className="quick-ring"/><Bolt size={34}/></div><div className="quick-content"><span className="section-kicker">READY WHEN YOU ARE</span><h3>まずは腕試し。</h3><p>CPUとの模擬戦で、タイピングの力を試そう。</p></div><button className="round-arrow" onClick={startBattle}><ArrowRight size={19}/></button></div><div className="online-card"><div className="online-status"><span className={`status-pill ${apiStatus}`}><i/> {apiStatus === 'online' ? 'API READY' : apiStatus === 'degraded' ? 'API SETUP' : 'OFFLINE MODE'}</span><Settings2 size={17}/></div><h3>オンライン機能</h3><p>サーバーに接続すると、ランクマッチや<br/>プロフィール同期が利用できます。</p><div className="online-foot"><span><Activity size={14}/> {apiStatus === 'online' ? 'APIへ接続済み' : apiStatus === 'degraded' ? 'DB設定を確認してください' : '接続を自動確認中'}</span><span>詳細 <ArrowDownRight size={13}/></span></div></div></section>
      <footer className="page-footer"><span>© 2025 TYPE ARENA</span><span>BUILT FOR THE LOVE OF TYPING</span><button><CircleHelp size={13}/> ヘルプ</button></footer>
    </main>}
    {screen === 'equipment' && <EquipmentScreen loadout={loadout} returnToBattle={equipmentReturnScreen === 'battle'} onEquipArmor={(armorId) => setLoadout((current) => ({ ...current, armorId }))} onEquipWeapon={(weaponId) => setLoadout((current) => ({ ...current, weaponId }))} onBack={() => setScreen(equipmentReturnScreen)} />}
    {screen === 'battle' && <CpuBattleScreen prompt={prompt} promptIndex={promptIndex} typed={typed} hp={hp} mp={mp} enemyHp={enemyHp} potions={potions} elapsed={elapsed} wpm={wpm} accuracy={accuracy} errors={errors} armorId={heroAppearance.armor.id} weaponId={heroAppearance.weapon.id} inputRef={inputRef} onType={onType} onOpenEquipment={openEquipment} onBack={() => setScreen('home')} onAttack={() => inputRef.current?.focus()} onMagic={castMagic} onPotion={usePotion} onFlee={fleeBattle} />}
    {screen === 'results' && <main className="simple-page"><div className="result-card"><div className={`result-emblem ${records[0]?.result}`}><Trophy size={31}/></div><span className="section-kicker">BATTLE COMPLETE</span><h1>{records[0]?.result === 'win' ? '勝利！' : '惜敗…'}</h1><p>{records[0]?.result === 'win' ? '見事なタイピングだった。次の戦いへ進もう。' : 'もう一度挑戦して、指先を鍛えよう。'}</p><div className="result-stats"><div><small>速度</small><b>{wpm}<i>WPM</i></b></div><div><small>正確率</small><b>{accuracy}<i>%</i></b></div><div><small>経過時間</small><b>{elapsed}<i>秒</i></b></div></div><div className="hero-actions"><button className="primary-button" onClick={startBattle}><RotateCcw size={16}/> もう一度対戦</button><button className="secondary-button" onClick={() => setScreen('home')}>ホームへ</button></div></div></main>}
    {screen === 'records' && <main className="simple-page records-page"><div className="section-heading"><div><span className="section-kicker">BATTLE HISTORY</span><h2>戦績</h2></div><button className="secondary-button compact" onClick={() => {localStorage.removeItem(recordsKey); setRecords([])}}>記録をリセット</button></div>{records.length ? <div className="records-list">{records.map((item, i) => <div className="record-row" key={`${item.date}-${i}`}><span className={`record-result ${item.result}`}>{item.result === 'win' ? 'WIN' : 'LOSE'}</span><span>{new Date(item.date).toLocaleString('ja-JP')}</span><b>{item.wpm} WPM</b><b>{item.accuracy}% ACC</b></div>)}</div> : <div className="empty-records"><Trophy size={28}/><b>まだ戦績がありません</b><span>CPUと対戦して、最初の記録を作ろう。</span><button className="primary-button" onClick={startBattle}><Swords size={16}/> CPUと対戦</button></div>}</main>}
  </div>;
}
