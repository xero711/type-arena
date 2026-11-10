import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, LoaderCircle, RefreshCw, Trophy } from 'lucide-react';
import { PLACEMENT_MATCHES, rankTiers } from '@type-arena/game-data';

type RankingPlayer = { rank: number; id: string; displayName: string; rating: number; title: string };
type Leaderboard = { ranking: RankingPlayer[]; total: number };
const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
const pageSize = 50;

export default function RankingScreen({ apiReady, onBack }: { apiReady: boolean; onBack: () => void }) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Leaderboard>({ ranking: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    if (!apiReady) return;
    setLoading(true); setError(false);
    try {
      const response = await fetch(`${apiUrl}/api/leaderboard?limit=${pageSize}&offset=${page * pageSize}`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('ranking-unavailable');
      setData(await response.json() as Leaderboard);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [apiReady, page]);
  useEffect(() => { void load(); }, [load]);

  return <main className="guild-page">
    <div className="guild-head"><button className="secondary-button" onClick={onBack}><ArrowLeft size={15}/> ホームへ戻る</button><div><span className="section-kicker">SEASON RANKING</span><h1>オンラインランキング</h1></div><button className="guild-refresh" onClick={() => void load()} aria-label="更新" disabled={loading}><RefreshCw size={15}/></button></div>
    <section className="guild-section">
      <div className="guild-section-title"><div><span className="section-kicker">RATING RANKING</span><h2>レーティングランキング</h2></div></div>
      <p className="rank-explanation">レート500から開始。ランクマッチを{PLACEMENT_MATCHES}戦終えるとランクと順位が決まります。</p>
      <div className="rank-tier-list">{rankTiers.map((tier, index) => <span key={tier.min}><b>{tier.name}</b> {tier.min}{rankTiers[index + 1] ? `〜${rankTiers[index + 1].min - 1}` : '以上'}</span>)}</div>
      {!apiReady || error ? <div className="guild-empty"><b>ランキングを取得できません</b><span>サーバーへの接続を確認してください。</span></div>
        : loading ? <div className="guild-empty"><LoaderCircle className="guild-spin" size={22}/><span>データを読み込み中…</span></div>
        : data.ranking.length ? <div className="guild-ranking">{data.ranking.map((player) => <div className="guild-ranking-row" key={player.id}><span className={`guild-rank-number ${player.rank <= 3 ? 'top' : ''}`}>{String(player.rank).padStart(2, '0')}</span><span className="guild-rank-avatar">{player.displayName.slice(0, 1)}</span><b>{player.displayName}</b><small>{player.title}</small><strong>{player.rating}</strong></div>)}</div>
        : <div className="guild-empty"><Trophy size={22}/><b>ランキングはまだありません</b><span>{page > 0 ? 'このページのランキングはありません。' : '振り分け戦を終えるとここに掲載されます。'}</span></div>}
      {data.total > pageSize && <div className="ranking-pagination"><button className="secondary-button" disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))}>前へ</button><span>{page + 1} / {Math.ceil(data.total / pageSize)} ページ（{data.total}人）</span><button className="secondary-button" disabled={(page + 1) * pageSize >= data.total || loading} onClick={() => setPage((value) => value + 1)}>次へ</button></div>}
    </section>
  </main>;
}
