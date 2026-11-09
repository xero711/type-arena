import { useCallback, useEffect, useState } from 'react';
import type * as React from 'react';
import type { User } from 'firebase/auth';
import { ArrowLeft, Award, Coins, LoaderCircle, PackageOpen, RefreshCw, Sparkles, Swords, Trophy } from 'lucide-react';
import { equipmentItems, rarityInfo, type EquipmentItem, type ItemRarity } from '@type-arena/game-data';
import { defaultEquipment, type EquipmentLoadout } from '../game/hero-appearance';
import EquipmentArtwork from '../components/EquipmentArtwork';

type Tab = 'gacha' | 'inventory' | 'ranking' | 'history';
type OwnedItem = EquipmentItem & { quantity: number; acquiredAt: string };
type PlayerRank = { rank: number; id: string; displayName: string; photoUrl: string | null; rating: number };
type MatchRecord = { matchId: string; mode: string; result: 'win' | 'lose' | 'draw' | 'disconnect'; opponentId: string; wpm: number; accuracy: number; maxCombo: number; ratingChange: number; coins: number; completedAt: string };

const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
const rarityOrder: ItemRarity[] = ['normal', 'rare', 'super_rare', 'hyper_rare', 'ultimate_rare'];
const gachaOdds: Record<ItemRarity, string> = {
  normal: '55%',
  rare: '28%',
  super_rare: '12%',
  hyper_rare: '4%',
  ultimate_rare: '1%',
};

type PendingGacha = { count: 1 | 10; key: string };

function pendingGachaStorageKey(uid: string) {
  return `type-arena:gacha-pending:${uid}`;
}

function readPendingGacha(uid: string): PendingGacha | null {
  try {
    const stored = localStorage.getItem(pendingGachaStorageKey(uid));
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<PendingGacha>;
    if ((parsed.count !== 1 && parsed.count !== 10) || typeof parsed.key !== 'string' || !/^[\da-f-]{36}$/i.test(parsed.key)) return null;
    return { count: parsed.count, key: parsed.key };
  } catch {
    return null;
  }
}

async function apiRequest<T>(path: string, user: User | null, init: RequestInit = {}): Promise<T> {
  const token = user ? await user.getIdToken() : null;
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(8000),
  });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'api-unavailable');
  return body;
}

function apiErrorMessage(code: string) {
  const messages: Record<string, string> = {
    'auth-not-configured': 'Firebase認証を準備中です。',
    'database-not-configured': 'データベースを準備中です。',
    'database-unavailable': 'データベースへ接続できません。',
    'profile-not-found': 'プロフィールを同期しています。Googleログインをやり直してください。',
    'insufficient-coins': 'コインが足りません。オンライン対戦でコインを集めましょう。',
    'item-not-owned': '所持していないアイテムは装備できません。',
    'gacha-unavailable': 'ガチャを利用できません。少し待ってから再度お試しください。',
  };
  return messages[code] ?? 'サーバーへ接続できません。時間をおいて再度お試しください。';
}

export default function GameServicesScreen({ user, apiReady, onBack, onLoadout }: { user: User | null; apiReady: boolean; onBack: () => void; onLoadout: (loadout: EquipmentLoadout) => void }) {
  const [tab, setTab] = useState<Tab>('gacha');
  const [coins, setCoins] = useState(0);
  const [owned, setOwned] = useState<OwnedItem[]>([]);
  const [equipped, setEquipped] = useState<{ armor: string | null; weapon: string | null }>({ armor: null, weapon: null });
  const [ranking, setRanking] = useState<PlayerRank[]>([]);
  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [lastPull, setLastPull] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retryCount, setRetryCount] = useState<1 | 10 | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!apiReady) return;
    setLoading(true);
    setError('');
    try {
      if (tab === 'ranking') {
        const response = await apiRequest<{ ranking: PlayerRank[] }>('/api/leaderboard?limit=50', null);
        setRanking(response.ranking);
      } else if (tab === 'history') {
        if (!user) throw new Error('login-required');
        const response = await apiRequest<{ history: MatchRecord[] }>('/api/me/matches?limit=30', user);
        setHistory(response.history);
      } else {
        if (!user) throw new Error('login-required');
        const response = await apiRequest<{ items: OwnedItem[]; equipped: { armor: string | null; weapon: string | null }; coins: number }>('/api/me/inventory', user);
        setOwned(response.items);
        setEquipped(response.equipped);
        setCoins(response.coins);
        onLoadout({ armorId: response.equipped.armor ?? defaultEquipment.armorId, weaponId: response.equipped.weapon ?? defaultEquipment.weaponId });
      }
    } catch (cause) {
      setError(cause instanceof Error ? (cause.message === 'login-required' ? 'Googleログインするとオンラインデータを利用できます。' : apiErrorMessage(cause.message)) : 'サーバーへ接続できません。');
    } finally {
      setLoading(false);
    }
  }, [apiReady, onLoadout, tab, user]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    setRetryCount(user ? readPendingGacha(user.uid)?.count ?? null : null);
  }, [user]);

  const pull = async (count: 1 | 10) => {
    if (!user) { setError('Googleログインするとガチャを利用できます。'); return; }
    const storageKey = pendingGachaStorageKey(user.uid);
    const pending = readPendingGacha(user.uid);
    if ((retryCount !== null && retryCount !== count) || (pending && pending.count !== count)) {
      setError('前回の召喚結果が未確認です。同じ回数のボタンから再試行してください。');
      return;
    }
    const idempotencyKey = pending?.key ?? crypto.randomUUID();
    localStorage.setItem(storageKey, JSON.stringify({ count, key: idempotencyKey } satisfies PendingGacha));
    setRetryCount(count);
    setBusy(true); setError(''); setLastPull([]);
    try {
      const response = await apiRequest<{ items: Array<Pick<EquipmentItem, 'code'>>; coins: number }>('/api/gacha/pull', user, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ count }),
      });
      const master = new Map(equipmentItems.map((item) => [item.code, item]));
      setLastPull(response.items.map((item) => master.get(item.code)).filter((item): item is EquipmentItem => Boolean(item)));
      setCoins(response.coins);
      localStorage.removeItem(storageKey);
      setRetryCount(null);
      await load();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'gacha-unavailable';
      if (!(cause instanceof TypeError || cause instanceof DOMException) && code !== 'api-unavailable' && code !== 'gacha-unavailable') {
        localStorage.removeItem(storageKey);
        setRetryCount(null);
      }
      setError(apiErrorMessage(code));
    } finally { setBusy(false); }
  };

  const equip = async (item: OwnedItem) => {
    if (!user) return;
    setBusy(true); setError('');
    try {
      await apiRequest('/api/me/equipment', user, { method: 'POST', body: JSON.stringify({ itemCode: item.code }) });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? apiErrorMessage(cause.message) : '装備を保存できませんでした。');
    } finally { setBusy(false); }
  };

  return <main className="guild-page">
    <div className="guild-head">
      <button className="secondary-button" onClick={onBack}><ArrowLeft size={15}/> ホームへ戻る</button>
      <div><span className="section-kicker">ADVENTURERS GUILD</span><h1>冒険者ギルド</h1></div>
      <button className="guild-refresh" onClick={() => void load()} aria-label="更新" disabled={loading}><RefreshCw size={15}/></button>
    </div>
    <div className="guild-tabs" role="tablist" aria-label="冒険者ギルド">
      <button className={tab === 'gacha' ? 'active' : ''} onClick={() => setTab('gacha')}><Sparkles size={15}/> ガチャ</button>
      <button className={tab === 'inventory' ? 'active' : ''} onClick={() => setTab('inventory')}><PackageOpen size={15}/> 所持品</button>
      <button className={tab === 'ranking' ? 'active' : ''} onClick={() => setTab('ranking')}><Trophy size={15}/> ランキング</button>
      <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><Award size={15}/> オンライン戦績</button>
    </div>
    {error && <div className="guild-alert" role="status">{error}</div>}
    {!apiReady ? <section className="guild-empty"><div className="guild-empty-icon"><LoaderCircle size={22}/></div><b>サーバーへ接続できません</b><span>CPU対戦はオフラインでも遊べます。オンライン機能はAPIが復帰すると使えます。</span></section>
      : loading ? <section className="guild-empty"><LoaderCircle className="guild-spin" size={22}/><span>データを読み込み中…</span></section>
      : tab === 'gacha' ? <>
        <section className="gacha-panel">
          <div className="gacha-copy"><span className="section-kicker">EQUIPMENT RELIC</span><h2>装備召喚</h2><p>武器や防具を集めて、勇者を自分好みにカスタマイズしよう。</p></div>
          <div className="gacha-wallet"><Coins size={16}/><span>所持コイン</span><b>{user ? coins.toLocaleString('ja-JP') : '—'}</b></div>
          <div className="gacha-actions"><button className="primary-button" onClick={() => void pull(1)} disabled={busy || !user || (retryCount !== null && retryCount !== 1)}><Sparkles size={16}/> {retryCount === 1 ? '1回再試行' : '1回召喚'} <small>300 COIN</small></button><button className="secondary-button" onClick={() => void pull(10)} disabled={busy || !user || (retryCount !== null && retryCount !== 10)}><Sparkles size={16}/> {retryCount === 10 ? '10回再試行' : '10回召喚'} <small>3,000 COIN</small></button></div>
          <div className="gacha-odds">排出率 {rarityOrder.map((rarity) => <span key={rarity} style={{ color: rarityInfo[rarity].color }}>{rarityInfo[rarity].label} {gachaOdds[rarity]}</span>)}</div>
        </section>
        {lastPull.length > 0 && <section className="gacha-results" aria-live="polite"><div className="guild-section-title"><span className="section-kicker">NEW EQUIPMENT</span><h2>召喚結果</h2></div><div className="guild-item-grid">{lastPull.map((item, index) => <article className="guild-item" key={`${item.code}-${index}`} style={{ '--rarity-color': rarityInfo[item.rarity].color } as React.CSSProperties}><EquipmentArtwork item={item} className="guild-item-art" /><small>{rarityInfo[item.rarity].label}</small><b>{item.name}</b><span>{item.type === 'weapon' ? `ATK ${item.attack}` : `DEF ${item.defense}`}</span></article>)}</div></section>}
      </> : tab === 'inventory' ? <section className="guild-section"><div className="guild-section-title"><div><span className="section-kicker">YOUR COLLECTION</span><h2>所持アイテム <small>{owned.length}種類</small></h2></div><div className="gacha-wallet"><Coins size={15}/><b>{coins.toLocaleString('ja-JP')}</b></div></div>{owned.length ? <div className="guild-item-grid">{owned.map((item) => { const isEquipped = equipped[item.type as 'armor' | 'weapon'] === item.code; return <article className={`guild-item ${isEquipped ? 'equipped' : ''}`} key={item.code} style={{ '--rarity-color': rarityInfo[item.rarity].color } as React.CSSProperties}><EquipmentArtwork item={item} className="guild-item-art" /><small>{rarityInfo[item.rarity].label} · ×{item.quantity}</small><b>{item.name}</b><span>{item.type === 'weapon' ? `ATK ${item.attack}` : `DEF ${item.defense}`}</span><button onClick={() => void equip(item)} disabled={busy || isEquipped}>{isEquipped ? '装備中' : '装備する'}</button></article>; })}</div> : <div className="guild-empty"><PackageOpen size={22}/><b>所持品はまだありません</b><span>Googleログイン後の初期装備とガチャで増やせます。</span></div>}</section>
      : tab === 'ranking' ? <section className="guild-section"><div className="guild-section-title"><div><span className="section-kicker">SEASON RANKING</span><h2>レーティングランキング</h2></div></div>{ranking.length ? <div className="guild-ranking">{ranking.map((player) => <div className="guild-ranking-row" key={player.id}><span className={`guild-rank-number ${player.rank <= 3 ? 'top' : ''}`}>{String(player.rank).padStart(2,'0')}</span><span className="guild-rank-avatar">{player.displayName.slice(0,1)}</span><b>{player.displayName}</b><small>RATING</small><strong>{player.rating}</strong></div>)}</div> : <div className="guild-empty"><Trophy size={22}/><b>ランキングはまだありません</b><span>オンライン対戦を始めるとここに掲載されます。</span></div>}</section>
      : <section className="guild-section"><div className="guild-section-title"><div><span className="section-kicker">ONLINE BATTLE HISTORY</span><h2>オンライン戦績</h2></div></div>{history.length ? <div className="guild-history">{history.map((match) => <div className="guild-history-row" key={match.matchId}><span className={`guild-result ${match.result}`}>{match.result === 'win' ? 'WIN' : match.result === 'lose' ? 'LOSE' : match.result === 'draw' ? 'DRAW' : 'DISCONNECT'}</span><span>{match.mode === 'private' ? 'プライベート' : 'ランク'}</span><b>{match.wpm} WPM</b><b>{match.accuracy}%</b><span>{new Date(match.completedAt).toLocaleString('ja-JP')}</span></div>)}</div> : <div className="guild-empty"><Swords size={22}/><b>オンライン対戦の記録はありません</b><span>対戦結果はサーバーに保存されます。</span></div>}</section>}
  </main>;
}
