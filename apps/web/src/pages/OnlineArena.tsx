import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { User } from 'firebase/auth';
import { io, type Socket } from 'socket.io-client';
import { ArrowLeft, CircleAlert, Clock3, Heart, LoaderCircle, Search, Swords, Trophy } from 'lucide-react';
import { prompts } from '@type-arena/game-data';
import { isAnyVariantComplete, matchingVariants } from '@type-arena/typing-engine';
import { defaultEquipment, resolveHeroAppearance } from '../game/hero-appearance';
import HeroSprite from '../components/HeroSprite';

type BattleView = {
  matchId: string;
  mode: 'ranked' | 'private';
  opponent: { displayName: string; rating: number };
  ownHp: number;
  opponentHp: number;
  prompt: { id: string; text: string; reading: string; category: string };
  completedPrompts: number;
  typed: string;
  accuracy: number;
  mistakes: number;
  maxCombo: number;
  startsAt: number;
  endsAt: number;
};

type Props = {
  user: User | null;
  apiReady: boolean;
  heroArmorId: string;
  heroWeaponId: string;
  login: () => Promise<void>;
  guestLogin: () => Promise<void>;
  onBack: () => void;
};

const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

function progressColor(value: number) {
  return { width: `${Math.max(0, Math.min(100, value))}%` };
}

export default function OnlineArena({ user, apiReady, heroArmorId, heroWeaponId, login, guestLogin, onBack }: Props) {
  const socketRef = useRef<Socket | null>(null);
  const submittedRef = useRef(false);
  const submitAnswerRef = useRef<(answer: string) => void>(() => undefined);
  const [connected, setConnected] = useState(false);
  const [queued, setQueued] = useState(false);
  const [queuePosition, setQueuePosition] = useState(0);
  const [battle, setBattle] = useState<BattleView | null>(null);
  const [typed, setTyped] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [accuracy, setAccuracy] = useState(100);
  const [mistakes, setMistakes] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [finalStats, setFinalStats] = useState<{ wpm: number; accuracy: number; characters: number; mistakes: number; maxCombo: number } | null>(null);
  const [outcome, setOutcome] = useState<'win' | 'lose' | 'draw' | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [privateCode, setPrivateCode] = useState('');
  const [issuedCode, setIssuedCode] = useState('');
  const heroAppearance = resolveHeroAppearance(heroArmorId, heroWeaponId);
  const rivalAppearance = resolveHeroAppearance(defaultEquipment.armorId, defaultEquipment.weaponId);
  const battleRef = useRef<BattleView | null>(battle);
  const outcomeRef = useRef<'win' | 'lose' | 'draw' | null>(outcome);
  battleRef.current = battle;
  outcomeRef.current = outcome;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let socket: Socket | null = null;
    void user.getIdToken().then((token) => {
      if (cancelled) return;
      socket = io(apiUrl, { auth: { token }, reconnection: true, reconnectionAttempts: 8, timeout: 5000 });
      socketRef.current = socket;
      socket.on('connect', () => { setConnected(true); setError(null); });
      socket.on('disconnect', (reason) => {
        setConnected(false);
        if (battleRef.current && !outcomeRef.current) setError(`対戦サーバーとの接続が切れました（${reason}）。`);
      });
      socket.on('connect_error', (connectionError: Error) => {
        setConnected(false);
        setError(connectionError.message === 'auth-not-configured'
          ? 'サーバー側のFirebase設定が必要です。'
          : 'サーバーに接続できません。接続設定を確認してください。');
      });
      socket.on('matchmaking:queued', (data: { position?: number }) => {
        setQueued(true); setQueuePosition(data.position ?? 1); setError(null);
      });
      socket.on('matchmaking:matched', () => { setQueued(false); setQueuePosition(0); setPrivateCode(''); setIssuedCode(''); setError(null); });
      socket.on('private:created', (data: { code: string }) => { setIssuedCode(data.code); setError(null); });
      socket.on('private:error', (data: { code?: string }) => {
        const messages: Record<string, string> = {
          'invalid-code': '4桁の対戦コードを確認してください。期限切れのコードは使えません。',
          'own-code': '自分が発行したコードには参加できません。',
          'host-offline': 'コードの発行者がオフラインです。新しいコードを発行してください。',
          'already-in-match': 'どちらかのプレイヤーはすでに対戦中です。',
          'database-not-configured': '対戦サーバーのデータベースが設定されていません。',
          'database-unavailable': 'データベースに接続できません。',
          'profile-not-found': 'プロフィールがまだありません。再ログインして同期してください。',
        };
        setError(messages[data.code ?? ''] ?? 'プライベート戦を開始できませんでした。');
      });
      socket.on('matchmaking:cancelled', () => { setQueued(false); setQueuePosition(0); });
      socket.on('matchmaking:error', (data: { code?: string }) => {
        const messages: Record<string, string> = {
          'database-not-configured': '対戦サーバーのデータベースが設定されていません。',
          'database-unavailable': 'データベースに接続できません。',
          'profile-not-found': 'プロフィールがまだありません。再ログインして同期してください。',
          'already-queued': 'すでにマッチング待機中です。',
          'already-in-match': 'すでに対戦中です。',
        };
        setQueued(false); setError(messages[data.code ?? ''] ?? 'マッチングに失敗しました。');
      });
      socket.on('battle:starting', (view: BattleView | null) => {
        if (!view) { setError('対戦状態を取得できませんでした。'); return; }
        submittedRef.current = false;
        setSubmitted(false); setBattle(view); setTyped(view.typed); setAccuracy(view.accuracy); setMistakes(view.mistakes); setMaxCombo(view.maxCombo); setFinalStats(null); setOutcome(null); setError(null);
      });
      socket.on('battle:update', (view: BattleView) => {
        if (battleRef.current?.prompt.id !== view.prompt.id) { submittedRef.current = false; setSubmitted(false); setTyped(''); setAccuracy(100); setMistakes(0); }
        setBattle(view);
      });
      socket.on('battle:input-state', (data: { promptId: string; typed: string; accuracy: number; mistakes: number; maxCombo: number }) => {
        if (battleRef.current?.prompt.id !== data.promptId) return;
        setTyped(data.typed); setAccuracy(data.accuracy); setMistakes(data.mistakes); setMaxCombo(data.maxCombo); setError(null);
        const candidates = prompts.find((item) => item.id === data.promptId)?.romaji ?? [];
        if (isAnyVariantComplete(candidates, data.typed)) submitAnswerRef.current(data.typed);
      });
      socket.on('battle:error', (data: { code?: string }) => {
        submittedRef.current = false;
        setSubmitted(false);
        const messages: Record<string, string> = {
          'battle-not-started': '開始の合図を待っています。',
          'battle-finished': 'この対戦は終了しています。',
          'wrong-prompt': '問題が更新されました。表示中の問題を入力してください。',
          'invalid-input': 'ローマ字の入力を確認してください。',
          'too-fast': '少しゆっくり入力してから、回答を送信してください。',
          'key-rate-limited': '入力間隔が短すぎます。少し間を空けてください。',
          'invalid-key': '英字キーでローマ字を入力してください。',
          'not-in-match': '対戦セッションが見つかりません。',
          'invalid-payload': '入力を読み取れませんでした。',
        };
        setError(messages[data.code ?? ''] ?? '対戦中にエラーが発生しました。');
      });
      socket.on('battle:finished', (data: { result?: 'win' | 'lose' | 'draw'; mode?: 'ranked' | 'private'; resultSaved?: boolean; ratingChange?: number; coins?: number; stats?: { wpm: number; accuracy: number; characters: number; mistakes: number; maxCombo: number } }) => {
        setOutcome(data.result === 'draw' ? 'draw' : data.result === 'win' ? 'win' : 'lose'); setQueued(false); setTyped('');
        if (data.stats) { setFinalStats(data.stats); setAccuracy(data.stats.accuracy); setMistakes(data.stats.mistakes); setMaxCombo(data.stats.maxCombo); }
        if (data.resultSaved && data.mode === 'private') setError('結果を保存しました。レート変動なし / コイン報酬なし');
        else if (data.resultSaved) setError(`記録を保存しました。レート ${data.ratingChange !== undefined && data.ratingChange >= 0 ? '+' : ''}${data.ratingChange ?? 0} / コイン +${data.coins ?? 0}`);
        else setError('対戦結果をサーバーへ保存できませんでした。報酬は確定していません。');
      });
      socket.on('battle:persistence-error', () => setError('対戦結果をサーバーへ保存できませんでした。報酬は確定していません。'));
    }).catch(() => setError('Firebase認証情報を取得できませんでした。再ログインしてください。'));
    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  useEffect(() => {
    if (!battle || outcome) return;
    const timer = window.setInterval(() => setClock(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [battle, outcome]);

  const submitAnswer = useCallback((answer: string) => {
    if (!battle || !socketRef.current || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    socketRef.current.emit('battle:submit', { matchId: battle.matchId, promptId: battle.prompt.id, input: answer });
  }, [battle]);
  submitAnswerRef.current = submitAnswer;

  const onType = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!battle || submittedRef.current || Date.now() < battle.startsAt) { event.preventDefault(); return; }
    const key = event.key === 'Backspace' ? 'Backspace' : /^[a-zA-Z]$/.test(event.key) ? event.key.toLowerCase() : null;
    if (!key) { event.preventDefault(); return; }
    event.preventDefault();
    socketRef.current?.emit('battle:key', { matchId: battle.matchId, promptId: battle.prompt.id, key });
  };

  const leave = () => {
    if (battle && !outcome && !window.confirm('対戦を中断すると敗北扱いになります。ホームへ戻りますか？')) return;
    if (queued) socketRef.current?.emit('matchmaking:cancel');
    socketRef.current?.disconnect();
    onBack();
  };

  const countdown = battle ? Math.max(0, Math.ceil((battle.startsAt - clock) / 1000)) : 0;
  const seconds = battle ? Math.max(0, Math.ceil((battle.endsAt - clock) / 1000)) : 0;

  return <main className="online-page">
    <div className="online-page-head"><button className="back-link" onClick={leave}><ArrowLeft size={16}/> ホームへ戻る</button><span className="online-mode"><Swords size={14}/> {battle?.mode === 'private' ? 'PRIVATE MATCH' : 'RANKED MATCH'}</span><span className={`online-connection ${connected ? 'connected' : ''}`}><i/>{connected ? 'SOCKET CONNECTED' : 'CONNECTING'}</span></div>
    {!user ? <section className="online-gate"><div className="online-gate-icon"><Swords size={25}/></div><span className="section-kicker">ONLINE ARENA</span><h1>オンライン対戦に参加</h1><p>ゲストならすぐ参加できます。戦績を保存する場合はGoogleログインをご利用ください。</p><div className="online-actions"><button className="primary-button" onClick={() => void guestLogin()}>ゲストで参加</button><button className="secondary-button" onClick={() => void login()}>Googleログイン</button></div><button className="text-link" onClick={onBack}>CPU戦を続ける</button></section>
      : !apiReady ? <section className="online-gate"><div className="online-gate-icon"><CircleAlert size={25}/></div><span className="section-kicker">SERVER NOT READY</span><h1>対戦サーバーを準備中</h1><p>API、Firebase、PostgreSQLが利用可能になるまで、CPU戦をプレイできます。</p><button className="secondary-button" onClick={onBack}>CPU戦へ戻る</button></section>
      : outcome ? <section className="online-gate"><div className={`online-gate-icon ${outcome}`}><Trophy size={25}/></div><span className="section-kicker">MATCH COMPLETE</span><h1>{outcome === 'win' ? '勝利！' : outcome === 'draw' ? '引き分け' : '敗北'}</h1><p>{outcome === 'win' ? '対戦相手を倒しました。' : outcome === 'draw' ? '時間切れです。残りHPが同じでした。' : '次の対戦で巻き返しましょう。'}</p>{finalStats && <div className="match-result-stats"><span><b>{finalStats.wpm}</b> WPM</span><span><b>{finalStats.accuracy}%</b> 正確率</span><span><b>{finalStats.maxCombo}</b> 最大コンボ</span><span><b>{finalStats.mistakes}</b> ミス</span></div>}{error && <p role="status">{error}</p>}<div className="online-actions"><button className="primary-button" onClick={() => {setBattle(null);setOutcome(null);setFinalStats(null);setError(null);socketRef.current?.emit('matchmaking:join')}}><Search size={16}/> もう一度マッチング</button><button className="secondary-button" onClick={leave}>ホームへ</button></div></section>
      : battle ? <section className="online-battle">
        <div className="online-battle-meta"><span><i className="live-dot"/> {battle.mode === 'private' ? 'PRIVATE BATTLE' : 'SERVER-VERIFIED RANKED BATTLE'}</span><span><Clock3 size={13}/> {String(Math.floor(seconds / 60)).padStart(2,'0')}:{String(seconds % 60).padStart(2,'0')}</span></div>
        <div className="online-combatants"><div className="online-combatant rival"><div className="fighter-label"><span className="rival-hero-avatar"><HeroSprite armor={rivalAppearance.armor} weapon={rivalAppearance.weapon} className="rival-hero-sprite" /></span><div><b>{battle.opponent.displayName}</b><small>RATING {battle.opponent.rating}</small></div><span className="fighter-tag">RIVAL</span></div><div className="online-hp-label"><span><Heart size={13}/> HP {Math.ceil(battle.opponentHp)} / 100</span></div><div className="progress"><span style={progressColor(battle.opponentHp)}/></div></div><div className="online-vs">VS</div><div className="online-combatant self"><div className="fighter-label"><span className="online-hero-avatar"><HeroSprite armor={heroAppearance.armor} weapon={heroAppearance.weapon} /></span><div><b>{user.displayName || 'プレイヤー'}</b><small>勇者 / RATING SYNCED</small></div><span className="fighter-tag you-tag">YOU</span></div><div className="online-hp-label"><span><Heart size={13}/> HP {Math.ceil(battle.ownHp)} / 100</span></div><div className="progress cyan"><span style={progressColor(battle.ownHp)}/></div></div></div>
        <div className="online-prompt-panel"><span className="section-kicker">{battle.prompt.category} / PROMPT {String(battle.completedPrompts + 1).padStart(2,'0')}</span><h1>{battle.prompt.text}</h1><p>{battle.prompt.reading}</p><div className="romaji-line">{[...(matchingVariants(prompts.find((item) => item.id === battle.prompt.id)?.romaji ?? [], typed)[0] ?? prompts.find((item) => item.id === battle.prompt.id)?.romaji[0] ?? '')].map((char, index) => <span key={`${battle.prompt.id}-${index}`} className={index < typed.length ? 'typed-char' : index === typed.length ? 'next-char' : ''}>{char}</span>)}</div>{countdown > 0 && <div className="battle-countdown">BATTLE STARTS IN {countdown}</div>}<input className="typing-input" value={typed} onKeyDown={onType} onChange={() => undefined} disabled={submitted || countdown > 0} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={countdown ? '開始までお待ちください' : `「${battle.prompt.reading}」をローマ字で入力`} aria-label="対戦ローマ字入力" autoFocus/><div className="online-input-stats">正確率 <b>{accuracy}%</b><span>ミス {mistakes}</span><span>最大コンボ {maxCombo}</span></div>{submitted && <div className="waiting-hit"><LoaderCircle size={14}/> サーバーで回答を検証中…</div>}{typed.length > 0 && isAnyVariantComplete(prompts.find((item) => item.id === battle.prompt.id)?.romaji ?? [], typed) && !submitted && <button className="primary-button online-submit" onClick={() => submitAnswer(typed)}>回答を送信</button>}</div>
        {error && <div className="online-error" role="status"><CircleAlert size={14}/>{error}</div>}
        <div className="online-footnote">入力をサーバーで検証し、ダメージと勝敗を計算します。最高速度は300 WPMに制限されます。</div>
      </section> : <section className="online-gate"><div className="online-gate-icon"><Search size={25}/></div><span className="section-kicker">ONLINE MATCH</span><h1>対戦相手を探す</h1><p>{connected ? 'ランクマッチ、または4桁コードでプライベート戦に参加できます。' : '対戦サーバーへ接続しています。'}</p>{queued ? <><div className="queue-wait"><LoaderCircle size={20}/> マッチング待機中 <span>待機列 {queuePosition}</span></div><button className="secondary-button" onClick={() => socketRef.current?.emit('matchmaking:cancel')}>キャンセル</button></> : <button className="primary-button" disabled={!connected} onClick={() => {setError(null);socketRef.current?.emit('matchmaking:join')}}><Search size={16}/> ランクマッチ開始</button>}<div className="online-actions" style={{marginTop:16}}><button className="secondary-button" disabled={!connected} onClick={() => { setIssuedCode(''); socketRef.current?.emit('private:create'); }}>コードを発行</button><input aria-label="4桁コード" inputMode="numeric" maxLength={4} placeholder="0123" value={privateCode} onChange={(event) => setPrivateCode(event.target.value.replace(/\D/g, '').slice(0,4))}/><button className="secondary-button" disabled={!connected || privateCode.length !== 4} onClick={() => socketRef.current?.emit('private:join', {code:privateCode})}>参加</button></div>{issuedCode && <p>対戦コード: <b>{issuedCode}</b>（10分有効）を相手に共有してください。</p>}{error && <div className="online-error" role="status"><CircleAlert size={14}/>{error}</div>}<div className="match-note">プライベート戦は戦績だけ保存し、レートとコインは変動しません。</div></section>}
  </main>;
}
