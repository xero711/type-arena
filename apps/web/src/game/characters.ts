import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { characters, isCharacterId, type CharacterId } from '@type-arena/game-data';

type Roster = { coins: number; selected: CharacterId; unlocked: CharacterId[] };
const initial: Roster = { coins: 0, selected: 'balanced', unlocked: ['balanced'] };
const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export function useCharacters(user: User | null, apiReady: boolean, screen: string) {
  const [roster, setRoster] = useState<Roster>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const refresh = useCallback(async () => {
    if (!user || !apiReady) return;
    const version = ++requestVersion.current;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${apiUrl}/api/me/characters`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('fetch');
      const data = await response.json() as Roster;
      if (!isCharacterId(data.selected) || !Array.isArray(data.unlocked)) throw new Error('invalid');
      if (version !== requestVersion.current) return;
      setRoster(data);
      localStorage.setItem(`type-arena-roster-${user.uid}`, JSON.stringify(data));
      setMessage(null);
    } catch { if (version === requestVersion.current) setMessage('キャラクター情報を取得できませんでした。サーバー接続を確認してください。'); }
  }, [user, apiReady]);
  useEffect(() => {
    requestVersion.current += 1;
    setRoster(initial); setMessage(null);
    if (!user) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`type-arena-roster-${user.uid}`) || 'null') as Roster | null;
      if (saved && isCharacterId(saved.selected) && Array.isArray(saved.unlocked) && saved.unlocked.includes(saved.selected)) setRoster(saved);
    } catch { /* Ignore damaged local cache. */ }
  }, [user?.uid]);
  useEffect(() => {
    if (!user || !apiReady) return;
    void refresh();
    const timer = screen === 'character' ? window.setInterval(() => void refresh(), 8000) : undefined;
    return () => { if (timer !== undefined) window.clearInterval(timer); };
  }, [refresh, user, apiReady, screen]);
  const act = async (character: CharacterId, action: 'unlock' | 'select') => {
    if (!user || !apiReady || busy) return;
    requestVersion.current += 1;
    setBusy(true); setMessage(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${apiUrl}/api/me/characters`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ character, action, ...(action === 'unlock' ? { expectedPrice: characters[character].price } : {}) }) });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        setMessage(data.error === 'insufficient-coins' ? 'コインが足りません。ランクマッチで集めましょう。' : data.error === 'price-changed' ? '価格が変更されました。画面を再読み込みしてください。' : '操作できませんでした。もう一度お試しください。');
        return;
      }
      await refresh();
    } catch { setMessage('サーバーに接続できませんでした。'); }
    finally { setBusy(false); }
  };
  return { roster, busy, message, act };
}
