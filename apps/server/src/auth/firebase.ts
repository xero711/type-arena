import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { config } from '../config.js';

const hasServiceAccount = Boolean(config.FIREBASE_PROJECT_ID && config.FIREBASE_CLIENT_EMAIL && config.FIREBASE_PRIVATE_KEY);

const adminApp = config.FIREBASE_PROJECT_ID
  ? (getApps().length ? getApp() : initializeApp({
      ...(hasServiceAccount ? {
        credential: cert({
          projectId: config.FIREBASE_PROJECT_ID,
          clientEmail: config.FIREBASE_CLIENT_EMAIL!,
          privateKey: config.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        }),
      } : {}),
      projectId: config.FIREBASE_PROJECT_ID,
    }))
  : null;

export const firebaseAuth = adminApp ? getAuth(adminApp) : null;
