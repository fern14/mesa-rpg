import type { FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
export const initializeSession = (app: FirebaseApp) => getAuth(app);
