import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { ArrowLeft, Award, LoaderCircle, RefreshCw, Swords, Trophy } from 'lucide-react';

type Tab = 'ranking' | 'history';
type PlayerRank = { rank: number; id: string; displayName: string; photoUrl: string | null; rating: number };
type MatchRecord = { matchId: string; mode: string; result: 'win' | 'lose' | 'draw' | 'disconnect'; wpm: number; accuracy: number; completedAt: string };
const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

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

export default function GameServicesScreen({ user, apiReady, onBack }: { user: User | null; apiReady: boolean; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('ranking');
  const [ranking, setRanking] = useState<PlayerRank[]>([]);
  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!apiReady) return;
    setLoading(true); setError('');
    try {
      if (tab === 'ranking') setRanking((await apiRequest<{ ranking: PlayerRank[] }>('/api/leaderboard?limit=50', null)).ranking);
      else if (user) setHistory((await apiRequest<{ history: MatchRecord[] }>('/api/me/matches?limit=30', user)).history);
      else throw new Error('login-required');
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'login-required' ? 'Googleログインするとオンライン戦績を利用できます。' : 'サーバーへ接続できません。時間をおいて再度お試しください。');
    } finally { setLoading(false); }
  }, [apiReady, tab, user]);
  useEffect(() => { void load(); }, [load]);
  return <main className="guild-page">
    <div className="guild-head"><button className="secondary-button" onClick={onBack}><ArrowLeft size={15}/> ホームへ戻る</button><div><span className="section-kicker">ADVENTURERS GUILD</span><h1>冒険者ギルド</h1></div><button className="guild-refresh" onClick={() => void load()} aria-label="更新" disabled={loading}><RefreshCw size={15}/></button></div>
    <div className="guild-tabs" role="tablist" aria-label="冒険者ギルド"><button className={tab === 'ranking' ? 'active' : ''} onClick={() => setTab('ranking')}><Trophy size={15}/> ランキング</button><button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><Award size={15}/> オンライン戦績</button></div>
    {error && <div className="guild-alert" role="status">{error}</div>}
    {!apiReady ? <section className="guild-empty"><div className="guild-empty-icon"><LoaderCircle size={22}/></div><b>サーバーへ接続できません</b><span>CPU対戦はオフラインでも遊べます。</span></section>
      : loading ? <section className="guild-empty"><LoaderCircle className="guild-spin" size={22}/><span>データを読み込み中…</span></section>
      : tab === 'ranking' ? <section className="guild-section"><div className="guild-section-title"><div><span className="section-kicker">SEASON RANKING</span><h2>レーティングランキング</h2></div></div>{ranking.length ? <div className="guild-ranking">{ranking.map((player) => <div className="guild-ranking-row" key={player.id}><span className={`guild-rank-number ${player.rank <= 3 ? 'top' : ''}`}>{String(player.rank).padStart(2,'0')}</span><span className="guild-rank-avatar">{player.displayName.slice(0,1)}</span><b>{player.displayName}</b><small>RATING</small><strong>{player.rating}</strong></div>)}</div> : <div className="guild-empty"><Trophy size={22}/><b>ランキングはまだありません</b><span>オンライン対戦を始めるとここに掲載されます。</span></div>}</section>
      : <section className="guild-section"><div className="guild-section-title"><div><span className="section-kicker">ONLINE BATTLE HISTORY</span><h2>オンライン戦績</h2></div></div>{history.length ? <div className="guild-history">{history.map((match) => <div className="guild-history-row" key={match.matchId}><span className={`guild-result ${match.result}`}>{match.result === 'win' ? 'WIN' : match.result === 'lose' ? 'LOSE' : match.result === 'draw' ? 'DRAW' : 'DISCONNECT'}</span><span>{match.mode === 'private' ? 'プライベート' : 'ランク'}</span><b>{match.wpm} WPM</b><b>{match.accuracy}%</b><span>{new Date(match.completedAt).toLocaleString('ja-JP')}</span></div>)}</div> : <div className="guild-empty"><Swords size={22}/><b>オンライン対戦の記録はありません</b><span>対戦結果はサーバーに保存されます。</span></div>}</section>}
  </main>;
}
