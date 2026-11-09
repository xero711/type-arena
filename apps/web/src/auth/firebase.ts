import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';

const clientConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(clientConfig).every((value) => typeof value === 'string' && value.length > 0);
export const auth = firebaseConfigured
  ? getAuth(getApps().length ? getApp() : initializeApp(clientConfig))
  : null;
if (auth) auth.languageCode = 'ja';

export async function signInWithGoogle(): Promise<void> {
  if (!auth) throw new Error('Googleログインの設定がまだありません。Firebaseの設定後に利用できます。');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  if (window.matchMedia('(max-width: 700px)').matches) {
    await signInWithRedirect(auth, provider);
    return;
  }
  await signInWithPopup(auth, provider);
}

export async function signOutUser(): Promise<void> {
  if (auth) await signOut(auth);
}
