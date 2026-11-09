import { create } from 'zustand';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, firebaseConfigured, signInWithGoogle, signOutUser } from '../auth/firebase';

type AuthState = {
  user: User | null;
  configured: boolean;
  busy: boolean;
  message: string | null;
  apiStatus: 'unknown' | 'online' | 'degraded' | 'offline';
  initialize: () => () => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  configured: firebaseConfigured,
  busy: false,
  message: null,
  apiStatus: 'unknown',
  initialize: () => {
    let currentUser: User | null = null;
    let syncedUid: string | null = null;
    const syncProfile = async (user: User) => {
      const idToken = await user.getIdToken();
      const response = await fetch(`${apiUrl}/api/auth/session`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) set({ message: 'サーバーへ接続していますが、プロフィールを同期できません。' });
      else { syncedUid = user.uid; set({ message: null }); }
    };
    const checkServer = async () => {
      try {
        const response = await fetch(`${apiUrl}/health`, { cache: 'no-store', signal: AbortSignal.timeout(3500) });
        if (!response.ok) throw new Error('API health check failed');
        const health = await response.json() as { database?: string };
        const databaseReady = health.database === 'online';
        set({ apiStatus: databaseReady ? 'online' : 'degraded' });
        if (currentUser && databaseReady && syncedUid !== currentUser.uid) await syncProfile(currentUser);
        else if (currentUser && !databaseReady) set({ message: 'Googleログイン済み。ゲームサーバーの準備ができるとプロフィールを同期します。' });
      } catch {
        set({ apiStatus: 'offline' });
        if (currentUser) set({ message: 'Googleログイン済み。サーバーに接続できないため、CPU戦はオフラインで遊べます。' });
      }
    };
    const unsubscribe = auth ? onAuthStateChanged(auth, (user) => {
      currentUser = user;
      if (!user) syncedUid = null;
      set({ user, message: null });
      void checkServer();
    }) : () => undefined;
    void checkServer();
    const timer = window.setInterval(() => void checkServer(), 15000);
    return () => { unsubscribe(); window.clearInterval(timer); };
  },
  login: async () => {
    set({ busy: true, message: null });
    try { await signInWithGoogle(); }
    catch (error) { set({ message: error instanceof Error ? error.message : 'Googleログインに失敗しました。' }); }
    finally { set({ busy: false }); }
  },
  logout: async () => {
    try { await signOutUser(); set({ message: null, apiStatus: 'unknown' }); }
    catch { set({ message: 'ログアウトに失敗しました。もう一度お試しください。' }); }
  },
}));
