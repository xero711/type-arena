import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { CharacterProgress, CharacterStat } from './character-progress';

const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
export function useOnlineGrowth(user: User | null, apiReady: boolean, screen: string) {
  const [growth, setGrowth] = useState<CharacterProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const version = useRef(0);
  const refresh = useCallback(async () => {
    if (!user || !apiReady) return;
    const current = ++version.current;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${apiUrl}/api/me/growth`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('growth-unavailable');
      const data = await response.json() as CharacterProgress;
      if (current === version.current) { setGrowth(data); setMessage(null); }
    } catch { if (current === version.current) setMessage('オンライン強化の情報を取得できませんでした。'); }
  }, [user, apiReady]);
  useEffect(() => { version.current += 1; setGrowth(null); setMessage(null); }, [user?.uid]);
  useEffect(() => {
    if (!user || !apiReady || busy) return;
    void refresh();
    const timer = screen === 'character' ? window.setInterval(() => void refresh(), 15000) : undefined;
    return () => { if (timer !== undefined) window.clearInterval(timer); };
  }, [user, apiReady, screen, refresh, busy]);
  const upgrade = async (stat: CharacterStat) => {
    if (!user || !apiReady || busy) return;
    const current = ++version.current;
    setBusy(true); setMessage(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${apiUrl}/api/me/growth`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ stat }), signal: AbortSignal.timeout(8000) });
      const data = await response.json() as CharacterProgress & { error?: string };
      if (current !== version.current) return;
      if (!response.ok) { setMessage(data.error === 'insufficient-points' ? 'オンライン強化ポイントが足りません。' : '強化できませんでした。'); return; }
      setGrowth(data);
    } catch { if (current === version.current) setMessage('オンライン強化を保存できませんでした。'); }
    finally { setBusy(false); }
  };
  return { growth, busy, message, upgrade, refresh };
}
