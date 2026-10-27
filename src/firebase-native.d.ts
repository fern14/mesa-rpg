import type { Persistence } from 'firebase/auth';
import type AsyncStorage from '@react-native-async-storage/async-storage';
// Metro resolves Firebase's native build, whose persistence helper is omitted
// from the default browser declarations supplied by Firebase.
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: typeof AsyncStorage): Persistence;
}
