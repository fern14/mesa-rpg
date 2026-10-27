import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
export const initializeSession = (app: FirebaseApp) =>
  initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
