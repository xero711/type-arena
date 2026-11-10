import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';

export type PlayerRank = { rating: number; placementMatches: number; placementRequired: number; position: number | null; title: string };
const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export function useRank(user: User | null, apiReady: boolean, screen: string) {
  const [rank, setRank] = useState<PlayerRank | null>(null);
  const requestVersion = useRef(0);
  const refreshRank = useCallback(async () => {
    if (!user || !apiReady) return;
    const version = ++requestVersion.current;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${apiUrl}/api/me/rank`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('rank-unavailable');
      const value = await response.json() as PlayerRank;
      if (version === requestVersion.current) setRank(value);
    } catch { if (version === requestVersion.current) setRank(null); }
  }, [user, apiReady]);
  useEffect(() => { requestVersion.current += 1; setRank(null); }, [user?.uid]);
  useEffect(() => {
    if (!user || !apiReady) return;
    void refreshRank();
    const timer = window.setInterval(() => void refreshRank(), 15000);
    return () => window.clearInterval(timer);
  }, [user, apiReady, screen, refreshRank]);
  return { rank, refreshRank };
}
